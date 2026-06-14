/**
 * Tunable thresholds for the healing engine. Centralized so the auto-approve
 * policy and impact sensitivity are explicit and adjustable in one place.
 */
export const HEALING_CONFIG = {
  /** Cosine floor for an item to be considered a candidate for impact analysis. */
  candidateSimilarityFloor: 0.2,
  /** Max candidates passed to the Impact Analyzer per change set (cost guard). */
  maxCandidates: 10,
  /** Min impactScore (0..1) for an item to be regenerated. */
  impactThreshold: 0.35,

  /**
   * Auto-approve gate. A proposal is auto-approved only if ALL evaluator
   * dimensions clear their floors AND deterministic guardrails pass. Otherwise
   * it routes to a human reviewer.
   */
  autoApprove: {
    groundedness: 0.85,
    accuracy: 0.85,
    pedagogicalQuality: 0.85,
    hallucinationRiskMax: 0.15,
  },

  /**
   * Governance policy: substantive changes that expand or reshape scope
   * (the Change Detector classifies these as "addition" or "emphasis") always
   * require human sign-off, even at high confidence — adding new curriculum
   * scope is an editorial decision. Mechanical changes ("deprecation",
   * "wording") may still auto-approve. This makes the auto vs human mix a
   * function of the *kind* of change, not a hardcoded item list.
   */
  requireHumanReviewForScopeChanges: true,
  substantiveChangeTypes: ["addition", "emphasis"] as const,
} as const;

/** Whether a change type reshapes scope (and thus needs human sign-off). */
export function isSubstantiveChange(changeType: string): boolean {
  return (HEALING_CONFIG.substantiveChangeTypes as readonly string[]).includes(
    changeType,
  );
}

export type HealingConfig = typeof HEALING_CONFIG;
