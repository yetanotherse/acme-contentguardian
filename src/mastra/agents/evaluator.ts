/**
 * Content Evaluator Agent — LLM-as-judge that scores a proposed update against a
 * rubric (groundedness, accuracy, pedagogical quality, hallucination risk).
 */
import { Agent } from "@mastra/core/agent";

import { isMockMode, modelId } from "@/lib/providers";

import { generateStructured } from "../llm";
import { mockEvaluate } from "../mock/scenario";
import { EvaluationSchema, type Evaluation } from "../schemas";

export const contentEvaluatorAgent = new Agent({
  id: "content-evaluator",
  name: "Content Evaluator",
  instructions: `You are a strict reviewer of certification content updates. Score the PROPOSED content versus the ORIGINAL and the SOURCES on four dimensions, each 0..1:

- groundedness: is every claim supported by the provided sources?
- accuracy: is the content factually correct for Google Cloud today?
- pedagogicalQuality: is it clear, correctly scoped, and at the right difficulty?
- hallucinationRisk: likelihood of unsupported or fabricated claims (higher is worse).

Then give a verdict: "approve" (ready to publish), "revise" (needs human edits), or "reject" (fundamentally wrong). Be conservative: substantial rewrites that change scope should not be auto-approved without human review. Provide a concise rationale.`,
  model: `google/${modelId("flash")}`,
  tools: {},
});

export async function evaluateProposal(input: {
  itemId: string;
  title: string;
  originalText: string;
  proposedText: string;
  changeNotes: string;
  sourceExcerpts: string[];
}): Promise<Evaluation> {
  if (isMockMode()) return mockEvaluate(input.itemId);

  const prompt = `CONTENT ITEM: "${input.title}"

ORIGINAL:
"""
${input.originalText}
"""

PROPOSED:
"""
${input.proposedText}
"""

CHANGE NOTES FROM AUTHOR AGENT:
${input.changeNotes}

SOURCES:
${input.sourceExcerpts.map((e, i) => `[Source ${i + 1}]\n${e}`).join("\n\n")}

Score the proposal and return the rubric.`;
  const { object } = await generateStructured(
    contentEvaluatorAgent,
    prompt,
    EvaluationSchema,
  );
  return object;
}
