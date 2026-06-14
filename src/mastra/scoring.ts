/**
 * Deterministic guardrails + confidence + auto-approve gate.
 *
 * The evaluator (LLM-as-judge) is fused with mechanical guardrails so a proposal
 * is only auto-approved when both the rubric AND structural checks pass. This is
 * the safety net described in the README: even a confident judge cannot publish
 * a structurally broken question.
 */
import type { ContentType } from "@/db/schema";
import type { ContentBody, QuestionBody } from "@/lib/content-types";

import { HEALING_CONFIG } from "./config";
import type { Evaluation } from "./schemas";

export interface GuardrailResult {
  passed: boolean;
  issues: string[];
}

export function checkGuardrails(
  type: ContentType,
  body: ContentBody,
  citations: string[],
): GuardrailResult {
  const issues: string[] = [];
  if (type === "question" && "stem" in body) {
    const q = body as QuestionBody;
    if (q.stem.trim().length < 10) issues.push("Question stem is too short.");
    if (q.options.length < 2) issues.push("Fewer than two answer options.");
    if (q.answerIndex < 0 || q.answerIndex >= q.options.length)
      issues.push("answerIndex is out of range.");
    if (q.rationale.trim().length < 20)
      issues.push("Rationale is too short to be useful.");
  } else if ("markdown" in body) {
    if (body.markdown.trim().length < 50)
      issues.push("Lesson body is too short.");
  }
  if (citations.length === 0) issues.push("No source citations provided.");
  return { passed: issues.length === 0, issues };
}

/** Weighted blend of the evaluator dimensions into a single 0..1 confidence. */
export function computeConfidence(evaluation: Evaluation): number {
  const raw =
    0.3 * evaluation.groundedness +
    0.3 * evaluation.accuracy +
    0.25 * evaluation.pedagogicalQuality +
    0.15 * (1 - evaluation.hallucinationRisk);
  return Math.round(raw * 100) / 100;
}

export function shouldAutoApprove(
  evaluation: Evaluation,
  guardrails: GuardrailResult,
): boolean {
  const gate = HEALING_CONFIG.autoApprove;
  return (
    guardrails.passed &&
    evaluation.verdict === "approve" &&
    evaluation.groundedness >= gate.groundedness &&
    evaluation.accuracy >= gate.accuracy &&
    evaluation.pedagogicalQuality >= gate.pedagogicalQuality &&
    evaluation.hallucinationRisk <= gate.hallucinationRiskMax
  );
}

export type ReviewReasonKind = "policy" | "quality" | "guardrail" | "auto";

export interface ReviewReason {
  kind: ReviewReasonKind;
  title: string;
  message: string;
}

/** List evaluator dimensions that fell below the auto-approve bar. */
function failedDimensions(evaluation: Evaluation): string[] {
  const gate = HEALING_CONFIG.autoApprove;
  const failed: string[] = [];
  if (evaluation.groundedness < gate.groundedness) failed.push("groundedness");
  if (evaluation.accuracy < gate.accuracy) failed.push("accuracy");
  if (evaluation.pedagogicalQuality < gate.pedagogicalQuality)
    failed.push("pedagogical quality");
  if (evaluation.hallucinationRisk > gate.hallucinationRiskMax)
    failed.push("hallucination risk");
  return failed;
}

/**
 * Explain WHY a proposal was routed the way it was. The governance policy takes
 * priority: a substantive scope change is the headline reason even when scores
 * are high (which is exactly the case the UI needs to make obvious).
 */
export function buildReviewReason(input: {
  autoApprove: boolean;
  blockedByPolicy: boolean;
  changeType: string;
  evaluation: Evaluation;
  guardrails: GuardrailResult;
}): ReviewReason {
  const { autoApprove, blockedByPolicy, changeType, evaluation, guardrails } =
    input;

  if (autoApprove) {
    return {
      kind: "auto",
      title: "Auto-approved",
      message:
        "This is a mechanical update (a deprecation or terminology fix) that cleared every evaluator threshold and passed all structural guardrails, so it was published automatically and logged here for audit.",
    };
  }

  if (blockedByPolicy) {
    const extra =
      failedDimensions(evaluation).length > 0
        ? " (The evaluator also rated it below the bar on " +
          failedDimensions(evaluation).join(", ") +
          ".)"
        : "";
    const message =
      changeType === "addition"
        ? `New curriculum scope addition detected. Changes that expand exam coverage into new domains require human approval, even when AI confidence is high.${extra}`
        : `Expanded emphasis detected. Substantive changes that deepen or reshape existing coverage require human editorial approval, even when AI confidence is high.${extra}`;
    return { kind: "policy", title: "Why human review is required", message };
  }

  if (!guardrails.passed) {
    return {
      kind: "guardrail",
      title: "Why human review is required",
      message: `A structural guardrail did not pass: ${guardrails.issues.join(
        " ",
      )} Manual review is required before publishing.`,
    };
  }

  const failed = failedDimensions(evaluation);
  return {
    kind: "quality",
    title: "Why human review is required",
    message:
      failed.length > 0
        ? `The evaluator rated this proposal below the auto-approve bar on ${failed.join(
            ", ",
          )}. A human should confirm the content before it goes live.`
        : `The evaluator returned a "${evaluation.verdict}" verdict, so a human should confirm the content before it goes live.`,
  };
}
