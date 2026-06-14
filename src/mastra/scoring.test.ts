import { describe, expect, it } from "vitest";

import {
  checkGuardrails,
  computeConfidence,
  shouldAutoApprove,
} from "./scoring";
import type { Evaluation } from "./schemas";

const goodEval: Evaluation = {
  groundedness: 0.95,
  accuracy: 0.94,
  pedagogicalQuality: 0.9,
  hallucinationRisk: 0.05,
  verdict: "approve",
  rationale: "Grounded and accurate.",
};

describe("checkGuardrails", () => {
  it("passes a well-formed question", () => {
    const r = checkGuardrails(
      "question",
      {
        stem: "Which IaC service is recommended?",
        options: ["Infrastructure Manager", "A bash script"],
        answerIndex: 0,
        rationale:
          "Infrastructure Manager is the Google-native Terraform-based IaC service.",
      },
      ["Exam Guide v2"],
    );
    expect(r.passed).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("flags an out-of-range answer index and missing citations", () => {
    const r = checkGuardrails(
      "question",
      {
        stem: "Short?",
        options: ["only one"],
        answerIndex: 5,
        rationale: "too short",
      },
      [],
    );
    expect(r.passed).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("flags a too-short lesson", () => {
    const r = checkGuardrails("lesson", { markdown: "tiny" }, ["src"]);
    expect(r.passed).toBe(false);
  });
});

describe("computeConfidence", () => {
  it("produces a high confidence for a strong evaluation", () => {
    expect(computeConfidence(goodEval)).toBeGreaterThan(0.9);
  });

  it("penalizes high hallucination risk", () => {
    const risky = { ...goodEval, hallucinationRisk: 0.9 };
    expect(computeConfidence(risky)).toBeLessThan(computeConfidence(goodEval));
  });
});

describe("shouldAutoApprove", () => {
  const pass = { passed: true, issues: [] };

  it("auto-approves a strong, guardrail-passing proposal", () => {
    expect(shouldAutoApprove(goodEval, pass)).toBe(true);
  });

  it("does not auto-approve when guardrails fail", () => {
    expect(shouldAutoApprove(goodEval, { passed: false, issues: ["x"] })).toBe(
      false,
    );
  });

  it("does not auto-approve a 'revise' verdict or weak pedagogy", () => {
    expect(shouldAutoApprove({ ...goodEval, verdict: "revise" }, pass)).toBe(
      false,
    );
    expect(
      shouldAutoApprove({ ...goodEval, pedagogicalQuality: 0.5 }, pass),
    ).toBe(false);
  });

  it("does not auto-approve when hallucination risk exceeds the cap", () => {
    expect(
      shouldAutoApprove({ ...goodEval, hallucinationRisk: 0.4 }, pass),
    ).toBe(false);
  });
});
