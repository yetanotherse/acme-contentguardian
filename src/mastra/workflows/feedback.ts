/**
 * Human-feedback incorporation loop. When a reviewer rejects a proposal with
 * structured feedback, this re-runs the Regenerator (with the feedback) and the
 * Evaluator, producing a fresh proposal and routing it back for review.
 */
import { bodyToText, parseBody } from "@/lib/content-types";
import { embedText, serializeEmbedding } from "@/lib/embeddings";
import { isMockMode, providerLabel } from "@/lib/providers";
import type { LessonBody, QuestionBody } from "@/lib/content-types";

import {
  addRunStep,
  createWorkflowRun,
  finishWorkflowRun,
  getContentItem,
  getContentVersion,
  getLatestSourceVersion,
  getReviewTask,
  getTopicContext,
  getTopicSlugsForItem,
  insertProposedVersion,
  listSources,
  nextContentVersionNumber,
  rejectProposedVersion,
  updateReviewTask,
} from "@/db/queries";

import {
  regenerateLesson,
  regenerateQuestion,
} from "../agents/regenerator";
import { evaluateProposal } from "../agents/evaluator";
import {
  checkGuardrails,
  computeConfidence,
  shouldAutoApprove,
} from "../scoring";

export interface FeedbackResult {
  runId: string;
  newProposedVersionId: string;
  confidence: number;
}

export async function runFeedbackLoop(
  taskId: string,
  feedback: string,
): Promise<FeedbackResult> {
  const task = getReviewTask(taskId);
  if (!task) throw new Error(`Review task ${taskId} not found.`);
  const item = getContentItem(task.contentItemId);
  if (!item || !item.currentVersionId) {
    throw new Error(`Content item for task ${taskId} not found.`);
  }
  const currentVersion = getContentVersion(item.currentVersionId);
  if (!currentVersion) throw new Error("Current content version missing.");

  const runId = createWorkflowRun({
    kind: "feedback_loop",
    input: { taskId, feedback, provider: providerLabel("pro") },
  });
  let seq = 1;

  try {
    // Mark the previously-rejected proposal as rejected.
    if (task.proposedVersionId) rejectProposedVersion(task.proposedVersionId);

    const topicSlugs = getTopicSlugsForItem(item.id);
    const kgContext = getTopicContext(topicSlugs).map((t) => ({
      name: t.name,
      description: t.description,
    }));
    const excerpts = listSources()
      .map((s) => getLatestSourceVersion(s.id))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .map((v) => `${v.title}\n${v.body}`);
    const currentBody = parseBody(currentVersion.bodyJson);
    const originalText = bodyToText(item.type, currentBody);
    const impact = JSON.parse(task.impact || "{}");
    const staleReason: string =
      typeof impact.staleReason === "string"
        ? impact.staleReason
        : "Content flagged as stale by a source change.";

    // --- Regenerate with feedback ------------------------------------------
    const regenStart = Date.now();
    const proposed =
      item.type === "question"
        ? await regenerateQuestion({
            itemId: item.id,
            title: item.title,
            type: item.type,
            currentBody: currentBody as QuestionBody,
            staleReason,
            sourceExcerpts: excerpts,
            kgContext,
            humanFeedback: feedback,
          })
        : await regenerateLesson({
            itemId: item.id,
            title: item.title,
            type: item.type,
            currentBody: currentBody as LessonBody,
            staleReason,
            sourceExcerpts: excerpts,
            kgContext,
            humanFeedback: feedback,
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
    const changeNotes = `${(proposed as { changeNotes: string }).changeNotes} (Revised per reviewer feedback: "${feedback}")`;

    const proposedVersionId = insertProposedVersion({
      contentItemId: item.id,
      version: nextContentVersionNumber(item.id),
      bodyJson: JSON.stringify(proposedBody),
      embedding: serializeEmbedding(await embedText(proposedText)),
      sourceVersionIds: JSON.parse(currentVersion.sourceVersionIds || "[]"),
      kgSnapshot: { topics: kgContext },
      agentContext: {
        model: providerLabel("pro"),
        mode: isMockMode() ? "mock" : "gemini",
        regeneratedFromFeedback: feedback,
        changeNotes,
        citations,
      },
    });

    addRunStep({
      workflowRunId: runId,
      agent: "Content Regenerator",
      step: `regenerate-with-feedback:${item.id}`,
      input: { feedback, staleReason },
      output: { proposedBody, changeNotes },
      reasoning: `Re-generated "${item.title}" incorporating reviewer feedback.`,
      seq: seq++,
      durationMs: Date.now() - regenStart,
    });

    // --- Evaluate ----------------------------------------------------------
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
    const autoApprove = shouldAutoApprove(evaluation, guardrails);

    addRunStep({
      workflowRunId: runId,
      agent: "Content Evaluator",
      step: `evaluate:${item.id}`,
      output: { evaluation, guardrails, confidence, autoApprove },
      reasoning: `${evaluation.verdict.toUpperCase()} — ${evaluation.rationale}`,
      seq: seq++,
    });

    // --- Route back for review --------------------------------------------
    updateReviewTask(taskId, {
      proposedVersionId,
      baseVersionId: currentVersion.id,
      status: "needs_human",
      evalScores: JSON.stringify({ ...evaluation, guardrails }),
      reasoning: changeNotes,
      reviewReason: JSON.stringify({
        kind: "quality",
        title: "Re-review required",
        message:
          "This proposal was regenerated to incorporate your feedback and needs another review before it can go live.",
      }),
      confidence,
      humanFeedback: feedback,
      resolvedAt: null,
    });

    finishWorkflowRun(runId, "completed", {
      taskId,
      newProposedVersionId: proposedVersionId,
      confidence,
    });

    return { runId, newProposedVersionId: proposedVersionId, confidence };
  } catch (error: unknown) {
    addRunStep({
      workflowRunId: runId,
      agent: "Orchestrator",
      step: "fatal",
      status: "error",
      reasoning: error instanceof Error ? error.message : String(error),
      seq: seq++,
    });
    finishWorkflowRun(runId, "failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
