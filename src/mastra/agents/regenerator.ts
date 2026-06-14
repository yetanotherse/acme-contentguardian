/**
 * Content Regenerator Agent — produces an updated, grounded version of a stale
 * content item using the new source excerpts and knowledge-graph context.
 */
import { Agent } from "@mastra/core/agent";

import type { ContentType } from "@/db/schema";
import { isMockMode, modelId } from "@/lib/providers";
import type { LessonBody, QuestionBody } from "@/lib/content-types";

import { generateStructured } from "../llm";
import {
  mockRegenerateLesson,
  mockRegenerateQuestion,
} from "../mock/scenario";
import {
  ProposedLessonSchema,
  ProposedQuestionSchema,
  type ProposedLesson,
  type ProposedQuestion,
} from "../schemas";
import { fetchKGContextTool } from "../tools";

export const contentRegeneratorAgent = new Agent({
  id: "content-regenerator",
  name: "Content Regenerator",
  instructions: `You update Google Cloud certification content so it is accurate against the latest sources, while preserving its pedagogical intent and difficulty.

Rules:
- Ground every change in the provided source excerpts; do not invent facts.
- For questions: keep a single clearly-correct answer; update options and rationale as needed; keep distractors plausible.
- For lessons: keep structure and reading level; update terminology, recommendations, and add newly-emphasized material where warranted.
- Always explain what changed in changeNotes and list the sources you used in citations.`,
  model: `google/${modelId("pro")}`,
  tools: { fetchKGContextTool },
});

interface RegenContext {
  itemId: string;
  title: string;
  type: ContentType;
  currentBody: QuestionBody | LessonBody;
  staleReason: string;
  sourceExcerpts: string[];
  kgContext: Array<{ name: string; description: string }>;
  /** Structured reviewer feedback to incorporate (feedback-loop runs). */
  humanFeedback?: string;
}

export async function regenerateQuestion(
  ctx: RegenContext & { currentBody: QuestionBody },
): Promise<ProposedQuestion> {
  if (isMockMode()) {
    return mockRegenerateQuestion(ctx.itemId, ctx.currentBody);
  }
  const prompt = buildPrompt(ctx);
  const { object } = await generateStructured(
    contentRegeneratorAgent,
    prompt,
    ProposedQuestionSchema,
  );
  return object;
}

export async function regenerateLesson(
  ctx: RegenContext & { currentBody: LessonBody },
): Promise<ProposedLesson> {
  if (isMockMode()) {
    return mockRegenerateLesson(ctx.itemId, ctx.currentBody);
  }
  const prompt = buildPrompt(ctx);
  const { object } = await generateStructured(
    contentRegeneratorAgent,
    prompt,
    ProposedLessonSchema,
  );
  return object;
}

function buildPrompt(ctx: RegenContext): string {
  const feedbackBlock = ctx.humanFeedback
    ? `\nREVIEWER FEEDBACK TO INCORPORATE (a previous proposal was rejected):\n${ctx.humanFeedback}\n`
    : "";
  return `CONTENT ITEM: "${ctx.title}" (type: ${ctx.type})

WHY IT IS STALE:
${ctx.staleReason}
${feedbackBlock}

CURRENT CONTENT (JSON):
${JSON.stringify(ctx.currentBody, null, 2)}

UPDATED SOURCE EXCERPTS:
${ctx.sourceExcerpts.map((e, i) => `[Source ${i + 1}]\n${e}`).join("\n\n")}

KNOWLEDGE-GRAPH CONTEXT:
${ctx.kgContext.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Produce an updated version grounded in the sources above.`;
}
