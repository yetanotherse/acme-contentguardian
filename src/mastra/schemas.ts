/**
 * Zod schemas for every agent's structured output. These are the contract
 * between agents and workflows — used both as Mastra `structuredOutput` schemas
 * (real mode) and to validate scripted mock outputs (mock mode), guaranteeing
 * identical downstream behavior.
 */
import { z } from "zod";

export const changeTypeEnum = z.enum([
  "deprecation",
  "addition",
  "emphasis",
  "wording",
]);

export const ChangeSchema = z.object({
  changeType: changeTypeEnum,
  summary: z.string().describe("One-line description of the change."),
  detail: z
    .string()
    .describe("Why the change matters and what content it affects."),
  severity: z
    .number()
    .min(0)
    .max(1)
    .describe("0 (cosmetic) to 1 (breaking/critical)."),
  affectedTopics: z
    .array(z.string())
    .describe("Knowledge-graph topic slugs impacted by this change."),
});

export const ChangeSetSchema = z.object({
  changes: z.array(ChangeSchema),
});

export const ImpactItemSchema = z.object({
  contentItemId: z.string(),
  impactScore: z
    .number()
    .min(0)
    .max(1)
    .describe("How stale this item now is, 0 (fine) to 1 (must fix)."),
  staleReason: z.string(),
  affectedAspects: z
    .array(z.string())
    .describe("Which parts are stale, e.g. 'answer', 'rationale', 'terminology'."),
});

export const ImpactReportSchema = z.object({
  items: z.array(ImpactItemSchema),
});

export const ProposedQuestionSchema = z.object({
  stem: z.string(),
  options: z.array(z.string()).min(2),
  answerIndex: z.number().int().min(0),
  rationale: z.string(),
  changeNotes: z.string().describe("What changed versus the previous version."),
  citations: z
    .array(z.string())
    .describe("Source version titles/snippets grounding the update."),
});

export const ProposedLessonSchema = z.object({
  markdown: z.string(),
  changeNotes: z.string(),
  citations: z.array(z.string()),
});

export const EvaluationSchema = z.object({
  groundedness: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  pedagogicalQuality: z.number().min(0).max(1),
  hallucinationRisk: z.number().min(0).max(1),
  verdict: z.enum(["approve", "revise", "reject"]),
  rationale: z.string(),
});

export type ChangeSet = z.infer<typeof ChangeSetSchema>;
export type Change = z.infer<typeof ChangeSchema>;
export type ImpactReport = z.infer<typeof ImpactReportSchema>;
export type ImpactItem = z.infer<typeof ImpactItemSchema>;
export type ProposedQuestion = z.infer<typeof ProposedQuestionSchema>;
export type ProposedLesson = z.infer<typeof ProposedLessonSchema>;
export type ProposedContent = ProposedQuestion | ProposedLesson;
export type Evaluation = z.infer<typeof EvaluationSchema>;
