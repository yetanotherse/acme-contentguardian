/**
 * Impact Analyzer Agent — determines which existing content items are made stale
 * by a set of changes, with an impact score and reason.
 *
 * MOCK mode uses a deterministic scorer fusing knowledge-graph topic overlap,
 * change severity, and embedding similarity — the same signals the cheap
 * candidate pre-filter (findAffectedContentTool) uses, so results are
 * explainable and reproducible.
 */
import { Agent } from "@mastra/core/agent";

import { cosineSimilarity, embedText } from "@/lib/embeddings";
import type { ContentCandidate } from "@/db/queries";
import { isMockMode, modelId } from "@/lib/providers";

import { HEALING_CONFIG } from "../config";
import { generateStructured } from "../llm";
import {
  ImpactReportSchema,
  type Change,
  type ImpactReport,
} from "../schemas";
import { fetchKGContextTool, findAffectedContentTool } from "../tools";

export const impactAnalyzerAgent = new Agent({
  id: "impact-analyzer",
  name: "Impact Analyzer",
  instructions: `You assess how a set of source changes affects an existing library of certification content. For each content item provided, decide whether it is now stale and assign an impactScore from 0 (unaffected) to 1 (must be fixed).

Consider: does the change deprecate something the item recommends? Does it rename terminology the item uses? Does a new emphasis make the item under-scoped? Use the knowledge-graph topic overlap as a strong signal. Only include items that are genuinely affected. Explain the staleReason and list the affectedAspects (e.g. "answer", "rationale", "terminology", "coverage").`,
  model: `google/${modelId("flash")}`,
  tools: { findAffectedContentTool, fetchKGContextTool },
});

function affectedAspects(changeType: Change["changeType"]): string[] {
  switch (changeType) {
    case "deprecation":
      return ["answer", "rationale", "terminology"];
    case "wording":
      return ["terminology"];
    case "addition":
      return ["coverage", "depth"];
    case "emphasis":
      return ["coverage", "depth", "examples"];
  }
}

async function deterministicImpact(
  changes: Change[],
  candidates: ContentCandidate[],
): Promise<ImpactReport> {
  const changeEmbeddings = await Promise.all(
    changes.map((c) => embedText(`${c.summary}. ${c.detail}`)),
  );

  const items = candidates
    .map(
      (
        cand,
      ): { cand: ContentCandidate; score: number; change: Change | null } => {
      let bestScore = 0;
      let bestChange: Change | null = null;
      changes.forEach((change, i) => {
        const topicOverlap = change.affectedTopics.some((t) =>
          cand.topicSlugs.includes(t),
        );
        const sim = cosineSimilarity(changeEmbeddings[i], cand.embedding);
        const score = Math.min(
          1,
          0.6 * (topicOverlap ? 1 : 0) * change.severity +
            0.5 * sim +
            (topicOverlap ? 0.15 : 0),
        );
        if (score > bestScore) {
          bestScore = score;
          bestChange = change;
        }
      });
      return { cand, score: bestScore, change: bestChange };
    })
    .filter(
      (r): r is { cand: ContentCandidate; score: number; change: Change } =>
        r.change !== null && r.score >= HEALING_CONFIG.impactThreshold,
    )
    .sort((a, b) => b.score - a.score)
    .map(({ cand, score, change }) => ({
      contentItemId: cand.item.id,
      impactScore: Math.round(score * 100) / 100,
      staleReason: `${change.summary} — ${change.detail}`,
      affectedAspects: affectedAspects(change.changeType),
    }));

  return { items };
}

export async function analyzeImpact(input: {
  changes: Change[];
  candidates: ContentCandidate[];
}): Promise<ImpactReport> {
  if (isMockMode()) {
    return deterministicImpact(input.changes, input.candidates);
  }

  const candidateSummaries = input.candidates
    .map(
      (c) =>
        `- id=${c.item.id} | "${c.item.title}" | topics=[${c.topicSlugs.join(", ")}]`,
    )
    .join("\n");
  const changeSummaries = input.changes
    .map(
      (c) =>
        `- [${c.changeType}, severity ${c.severity}] ${c.summary}: ${c.detail} (topics: ${c.affectedTopics.join(", ")})`,
    )
    .join("\n");

  const prompt = `CHANGES:
${changeSummaries}

CANDIDATE CONTENT ITEMS:
${candidateSummaries}

Return only the items that are genuinely affected, each with an impactScore, staleReason, and affectedAspects.`;
  const { object } = await generateStructured(
    impactAnalyzerAgent,
    prompt,
    ImpactReportSchema,
  );
  return object;
}
