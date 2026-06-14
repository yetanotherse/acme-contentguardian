/**
 * Healing pipeline — composes the four Mastra agents into the end-to-end
 * detect → analyze impact → regenerate → evaluate → triage flow, persisting a
 * full step-by-step trace (run_steps) for observability.
 *
 * This is the orchestrator the API routes invoke. Each agent call is a Mastra
 * agent in REAL mode and a deterministic scripted output in MOCK mode — the
 * orchestration, persistence, and tracing are identical either way.
 */
import { bodyToText, parseBody } from "@/lib/content-types";
import { cosineSimilarity, embedText } from "@/lib/embeddings";
import { providerLabel, isMockMode } from "@/lib/providers";
import type { LessonBody, QuestionBody } from "@/lib/content-types";
import { decodeJson, toDbEmbedding } from "@/db/exec";

import {
  addRunStep,
  createWorkflowRun,
  finishWorkflowRun,
  getChangeEventsForVersions,
  getContentCandidates,
  getContentItem,
  getContentVersion,
  getLatestSourceVersion,
  getSourceVersions,
  getTopicContext,
  getTopicSlugsForItem,
  insertProposedVersion,
  insertReviewTask,
  listSources,
  nextContentVersionNumber,
  promoteVersion,
  setContentItemStatus,
  type ContentCandidate,
} from "@/db/queries";

import { detectChanges } from "../agents/change-detector";
import { analyzeImpact } from "../agents/impact-analyzer";
import {
  regenerateLesson,
  regenerateQuestion,
} from "../agents/regenerator";
import { evaluateProposal } from "../agents/evaluator";
import { HEALING_CONFIG, isSubstantiveChange } from "../config";
import type { Change } from "../schemas";
import {
  buildReviewReason,
  checkGuardrails,
  computeConfidence,
  shouldAutoApprove,
} from "../scoring";

interface EnrichedChange {
  change: Change;
  changeEventId?: string;
  sourceVersionId: string;
}

export interface HealingSummary {
  runId: string;
  changesDetected: number;
  itemsImpacted: number;
  autoApproved: number;
  needsReview: number;
}

/**
 * Gather changes for the latest (>v1) source versions. Reuses change_events
 * persisted by the simulate step; if none exist, runs the Change Detector agent
 * to derive them so the workflow is self-contained.
 */
async function gatherChanges(
  runId: string,
  seq: number,
): Promise<{ changes: EnrichedChange[]; sourceVersionIds: string[]; excerpts: string[] }> {
  const start = Date.now();
  const enriched: EnrichedChange[] = [];
  const sourceVersionIds: string[] = [];
  const excerpts: string[] = [];
  const sourceList = await listSources();

  for (const source of sourceList) {
    const latest = await getLatestSourceVersion(source.id);
    if (!latest || latest.version <= 1) continue;
    sourceVersionIds.push(latest.id);
    excerpts.push(`${latest.title}\n${latest.body}`);

    const events = await getChangeEventsForVersions([latest.id]);
    if (events.length > 0) {
      for (const e of events) {
        enriched.push({
          change: {
            changeType: e.changeType,
            summary: e.summary,
            detail: e.detail,
            severity: e.severity,
            affectedTopics: decodeJson<string[]>(e.affectedTopics),
          },
          changeEventId: e.id,
          sourceVersionId: latest.id,
        });
      }
    } else {
      // No persisted detection — run the detector agent on the version delta.
      const versions = await getSourceVersions(source.id);
      const previous = versions[1];
      const detected = await detectChanges({
        sourceId: source.id,
        oldBody: previous?.body ?? "",
        newBody: latest.body,
        topicSlugs: (await getTopicContext([])).map((t) => t.slug),
      });
      for (const c of detected.changes) {
        enriched.push({ change: c, sourceVersionId: latest.id });
      }
    }
  }

  await addRunStep({
    workflowRunId: runId,
    agent: "Change Detector",
    step: "detectChanges",
    input: { sources: sourceList.map((s) => s.name) },
    output: { changes: enriched.map((e) => e.change) },
    reasoning: `Detected ${enriched.length} change(s) across ${sourceVersionIds.length} updated source version(s): ${enriched
      .map((e) => `${e.change.changeType} (sev ${e.change.severity})`)
      .join(", ")}.`,
    seq,
    durationMs: Date.now() - start,
  });

  return { changes: enriched, sourceVersionIds, excerpts };
}

/** Cheap recall pre-filter before the (costly) Impact Analyzer agent. */
async function prefilterCandidates(
  changes: Change[],
): Promise<ContentCandidate[]> {
  const all = await getContentCandidates();
  const changeEmbeddings = await Promise.all(
    changes.map((c) => embedText(`${c.summary}. ${c.detail}`)),
  );
  const affectedTopics = new Set(changes.flatMap((c) => c.affectedTopics));
  return all
    .map((cand) => {
      const topicMatch = cand.topicSlugs.some((s) => affectedTopics.has(s));
      const sim = Math.max(
        0,
        ...changeEmbeddings.map((e) => cosineSimilarity(e, cand.embedding)),
      );
      return { cand, topicMatch, sim };
    })
    .filter(
      (r) => r.topicMatch || r.sim >= HEALING_CONFIG.candidateSimilarityFloor,
    )
    .sort(
      (a, b) => Number(b.topicMatch) - Number(a.topicMatch) || b.sim - a.sim,
    )
    .slice(0, HEALING_CONFIG.maxCandidates)
    .map((r) => r.cand);
}

export async function runHealing(
  kind: "healing" | "full_scan" = "healing",
): Promise<HealingSummary> {
  const runId = await createWorkflowRun({
    kind,
    input: {
      trigger: kind === "full_scan" ? "manual_scan" : "source_change",
      provider: providerLabel("flash"),
    },
  });
  let seq = 1;

  try {
    // 1) Detect ----------------------------------------------------------------
    const { changes, sourceVersionIds, excerpts } = await gatherChanges(
      runId,
      seq++,
    );

    if (changes.length === 0) {
      await addRunStep({
        workflowRunId: runId,
        agent: "Orchestrator",
        step: "noop",
        reasoning:
          "No updated source versions found. Run 'Simulate Google Cloud Next Update' first.",
        seq: seq++,
      });
      await finishWorkflowRun(runId, "completed", {
        changesDetected: 0,
        itemsImpacted: 0,
        autoApproved: 0,
        needsReview: 0,
      });
      return {
        runId,
        changesDetected: 0,
        itemsImpacted: 0,
        autoApproved: 0,
        needsReview: 0,
      };
    }

    const changeList = changes.map((c) => c.change);

    // 2) Impact analysis -------------------------------------------------------
    const impactStart = Date.now();
    const candidates = await prefilterCandidates(changeList);
    const impact = await analyzeImpact({ changes: changeList, candidates });
    await addRunStep({
      workflowRunId: runId,
      agent: "Impact Analyzer",
      step: "analyzeImpact",
      input: {
        candidateCount: candidates.length,
        candidates: candidates.map((c) => c.item.title),
      },
      output: { impacted: impact.items },
      reasoning: `Pre-filtered ${candidates.length} candidate(s); flagged ${impact.items.length} as impacted (threshold ${HEALING_CONFIG.impactThreshold}).`,
      seq: seq++,
      durationMs: Date.now() - impactStart,
    });

    // 3) Regenerate + evaluate + triage per impacted item ---------------------
    let autoApproved = 0;
    let needsReview = 0;

    for (const impacted of impact.items) {
      const item = await getContentItem(impacted.contentItemId);
      if (!item || !item.currentVersionId) continue;
      const currentVersion = await getContentVersion(item.currentVersionId);
      if (!currentVersion) continue;

      const topicSlugs = await getTopicSlugsForItem(item.id);
      const kgContext = (await getTopicContext(topicSlugs)).map((t) => ({
        name: t.name,
        description: t.description,
      }));
      const currentBody = parseBody(currentVersion.bodyJson);
      const originalText = bodyToText(item.type, currentBody);

      // Pick the change event most relevant to this item (topic overlap).
      const matchingChange =
        changes.find((c) =>
          c.change.affectedTopics.some((t) => topicSlugs.includes(t)),
        ) ?? changes[0];

      try {
        // --- Regenerate ------------------------------------------------------
        const regenStart = Date.now();
        const proposed =
          item.type === "question"
            ? await regenerateQuestion({
                itemId: item.id,
                title: item.title,
                type: item.type,
                currentBody: currentBody as QuestionBody,
                staleReason: impacted.staleReason,
                sourceExcerpts: excerpts,
                kgContext,
              })
            : await regenerateLesson({
                itemId: item.id,
                title: item.title,
                type: item.type,
                currentBody: currentBody as LessonBody,
                staleReason: impacted.staleReason,
                sourceExcerpts: excerpts,
                kgContext,
              });

        const proposedBody =
          item.type === "question"
            ? {
                stem: (proposed as { stem: string }).stem,
                options: (proposed as { options: string[] }).options,
                answerIndex: (proposed as { answerIndex: number }).answerIndex,
                rationale: (proposed as { rationale: string }).rationale,
              }
            : { markdown: (proposed as { markdown: string }).markdown };
        const proposedText = bodyToText(item.type, proposedBody);
        const citations = (proposed as { citations: string[] }).citations;
        const changeNotes = (proposed as { changeNotes: string }).changeNotes;

        const proposedEmbedding = await embedText(proposedText);
        const proposedVersionId = await insertProposedVersion({
          contentItemId: item.id,
          version: await nextContentVersionNumber(item.id),
          bodyJson: proposedBody,
          embedding: toDbEmbedding(proposedEmbedding),
          sourceVersionIds,
          kgSnapshot: { topics: kgContext },
          agentContext: {
            model: providerLabel("pro"),
            mode: isMockMode() ? "mock" : "gemini",
            staleReason: impacted.staleReason,
            changeNotes,
            citations,
          },
        });

        await addRunStep({
          workflowRunId: runId,
          agent: "Content Regenerator",
          step: `regenerate:${item.id}`,
          input: { title: item.title, staleReason: impacted.staleReason },
          output: { proposedBody, changeNotes, citations },
          reasoning: changeNotes,
          seq: seq++,
          durationMs: Date.now() - regenStart,
        });

        // --- Evaluate --------------------------------------------------------
        const evalStart = Date.now();
        const evaluation = await evaluateProposal({
          itemId: item.id,
          title: item.title,
          originalText,
          proposedText,
          changeNotes,
          sourceExcerpts: excerpts,
        });
        const guardrails = checkGuardrails(item.type, proposedBody, citations);
        const confidence = computeConfidence(evaluation);
        // Governance: substantive scope changes (additions/new emphasis) always
        // need human sign-off, even at high confidence.
        const substantive = isSubstantiveChange(matchingChange.change.changeType);
        const blockedByPolicy =
          HEALING_CONFIG.requireHumanReviewForScopeChanges && substantive;
        const autoApprove =
          shouldAutoApprove(evaluation, guardrails) && !blockedByPolicy;

        await addRunStep({
          workflowRunId: runId,
          agent: "Content Evaluator",
          step: `evaluate:${item.id}`,
          input: { title: item.title },
          output: {
            evaluation,
            guardrails,
            confidence,
            autoApprove,
            policy: blockedByPolicy
              ? `Held for human review: substantive ${matchingChange.change.changeType} change.`
              : "eligible",
          },
          reasoning: `${evaluation.verdict.toUpperCase()} — ${evaluation.rationale} (confidence ${confidence}; guardrails ${guardrails.passed ? "passed" : "FAILED"}${blockedByPolicy ? `; held for review: substantive ${matchingChange.change.changeType}` : ""}).`,
          seq: seq++,
          durationMs: Date.now() - evalStart,
        });

        // --- Triage ----------------------------------------------------------
        const reviewStatus = autoApprove ? "auto_approved" : "needs_human";
        const reviewReason = buildReviewReason({
          autoApprove,
          blockedByPolicy,
          changeType: matchingChange.change.changeType,
          evaluation,
          guardrails,
        });
        await insertReviewTask({
          contentItemId: item.id,
          changeEventId: matchingChange.changeEventId,
          workflowRunId: runId,
          proposedVersionId,
          baseVersionId: currentVersion.id,
          status: reviewStatus,
          evalScores: { ...evaluation, guardrails },
          impact: impacted,
          reasoning: changeNotes,
          reviewReason,
          confidence,
        });

        if (autoApprove) {
          await promoteVersion(item.id, proposedVersionId);
          autoApproved++;
        } else {
          await setContentItemStatus(item.id, "in_review");
          needsReview++;
        }
      } catch (error: unknown) {
        await addRunStep({
          workflowRunId: runId,
          agent: "Orchestrator",
          step: `error:${item.id}`,
          status: "error",
          reasoning: `Failed to heal "${item.title}": ${
            error instanceof Error ? error.message : String(error)
          }`,
          seq: seq++,
        });
      }
    }

    // 4) Triage summary -------------------------------------------------------
    const summary = {
      changesDetected: changes.length,
      itemsImpacted: impact.items.length,
      autoApproved,
      needsReview,
    };
    await addRunStep({
      workflowRunId: runId,
      agent: "Triage",
      step: "summary",
      output: summary,
      reasoning: `Healing complete: ${impact.items.length} item(s) impacted → ${autoApproved} auto-approved, ${needsReview} routed to human review.`,
      seq: seq++,
    });
    await finishWorkflowRun(runId, "completed", summary);

    return { runId, ...summary };
  } catch (error: unknown) {
    await addRunStep({
      workflowRunId: runId,
      agent: "Orchestrator",
      step: "fatal",
      status: "error",
      reasoning: error instanceof Error ? error.message : String(error),
      seq: seq++,
    });
    await finishWorkflowRun(runId, "failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
