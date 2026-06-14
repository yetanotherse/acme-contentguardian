/**
 * Deterministic mock scenario for the Google Cloud Next heal.
 *
 * Active only in MOCK mode (no Gemini key). Every function returns schema-valid
 * output so the workflow, persistence, and trace code paths behave identically
 * to real Gemini. Marquee content items get hand-authored, high-quality
 * proposals (so some auto-approve); everything else gets a templated rewrite
 * that applies the deprecation/rename substitutions (so it routes to a human).
 *
 * This is a DEMO CONVENIENCE, not a production technique — see README.
 */
import { bodyToText, type LessonBody, type QuestionBody } from "@/lib/content-types";

import { SEED_SOURCE_CHANGES } from "@/db/seed-data";
import type {
  Change,
  ChangeSet,
  Evaluation,
  ProposedLesson,
  ProposedQuestion,
} from "../schemas";

const V2_CITATIONS = [
  "Professional Cloud Architect Exam Guide (Rev. 2025 — Cloud Next)",
  "Google Cloud Well-Architected Framework (2025 — Cloud Next)",
];

/** Text substitutions reflecting the Cloud Next changes (templated fallback). */
const SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/Google Cloud Deployment Manager/g, "Infrastructure Manager"],
  [/Deployment Manager/g, "Infrastructure Manager"],
  [
    /YAML\/Python\/Jinja2 templates|YAML configuration files, optionally using \*\*Python or Jinja2 templates\*\*/g,
    "Terraform configurations",
  ],
  [/Architecture Framework/g, "Well-Architected Framework"],
];

function applySubstitutions(text: string): string {
  return SUBSTITUTIONS.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

// ---------------------------------------------------------------------------
// Change Detector (mock)
// ---------------------------------------------------------------------------

export function mockDetect(sourceId: string): ChangeSet {
  const change = SEED_SOURCE_CHANGES.find((c) => c.sourceId === sourceId);
  if (!change) return { changes: [] };
  return {
    changes: change.changes.map(
      (c): Change => ({
        changeType: c.changeType,
        summary: c.summary,
        detail: c.detail,
        severity: c.severity,
        affectedTopics: c.affectedTopics,
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Content Regenerator (mock)
// ---------------------------------------------------------------------------

const MARQUEE_QUESTIONS: Record<string, ProposedQuestion> = {
  ci_q_iac_dm: {
    stem: "Your team needs a Google Cloud-native, declarative way to provision and repeatably manage VPCs, instances, and firewall rules as version-controlled configuration. Which managed service should you recommend?",
    options: [
      "Infrastructure Manager (Terraform-based, the successor to Deployment Manager)",
      "A custom Bash script invoking gcloud commands",
      "Manually creating resources in the Cloud Console",
      "Cloud Scheduler triggering Cloud Functions",
    ],
    answerIndex: 0,
    rationale:
      "Infrastructure Manager is Google Cloud's managed, native infrastructure-as-code service, using Terraform configurations to provision resources declaratively and repeatably. It is the recommended successor now that Deployment Manager is deprecated and scheduled for shutdown. Imperative scripts and manual Console steps are neither declarative nor repeatable.",
    changeNotes:
      "Replaced the now-deprecated Deployment Manager with Infrastructure Manager (Terraform-based) as the correct answer and rewrote the rationale accordingly.",
    citations: V2_CITATIONS,
  },
};

const MARQUEE_LESSONS: Record<string, ProposedLesson> = {
  ci_l_iac_overview: {
    markdown: `## Infrastructure as Code on Google Cloud

Infrastructure as code (IaC) lets you define cloud resources declaratively so deployments are **repeatable, reviewable, and version-controlled**.

### Google Cloud's native IaC service
**Infrastructure Manager** is Google Cloud's managed, native IaC service. You describe the resources you want — networks, instances, firewall rules — using **Terraform configurations (HCL)**, and Infrastructure Manager provisions and manages them as a deployment. It is the recommended successor to **Deployment Manager, which is now deprecated and scheduled for shutdown**. You can also run Terraform directly.

### Why it matters for architects
- **Repeatability:** identical environments for dev, staging, and prod.
- **Auditability:** configuration lives in source control alongside application code.
- **Consistency:** reduces manual, error-prone Console changes.

### Best practices
1. Keep Terraform modules small and composable.
2. Parameterize environment-specific values with variables.
3. Store configurations in a version-controlled repository and review changes via pull requests.

> **Migration note:** Existing Deployment Manager templates should be migrated to Infrastructure Manager or Terraform before Deployment Manager is shut down.`,
    changeNotes:
      "Rewrote the lesson to teach Infrastructure Manager + Terraform as the native IaC approach, marked Deployment Manager deprecated, and added a migration note.",
    citations: V2_CITATIONS,
  },
  ci_l_genai_vertex: {
    markdown: `## Generative AI on Google Cloud

**Vertex AI** is Google Cloud's managed platform for building generative AI solutions, providing access to **Gemini foundation models**.

### Recommended enterprise patterns
- **Choose a Gemini model** in Vertex AI sized to your latency, cost, and quality needs.
- **Retrieval-augmented generation (RAG):** ground responses in your enterprise data (e.g., via Vertex AI Search / vector search) to improve accuracy and reduce hallucination.
- **Grounding & citations:** attach sources so outputs are verifiable.
- **Evaluation:** measure output quality with Vertex AI evaluation before and after changes.
- **Responsible AI:** apply safety filters and review for bias and harmful content.

### Reference architecture
1. Ingest and embed enterprise documents into a vector store.
2. Retrieve relevant context for a user query.
3. Prompt a grounded Gemini model with the retrieved context.
4. Evaluate and apply Responsible AI safety checks before returning the answer.

Generative AI is now a core architecture competency: architects should know where Gemini, RAG, grounding, and evaluation fit in an enterprise solution.`,
    changeNotes:
      "Expanded the lesson from generic foundation models to Gemini-specific guidance with RAG, grounding, evaluation, and Responsible AI, reflecting the new exam emphasis.",
    citations: V2_CITATIONS,
  },
  ci_l_sre_monitoring: {
    markdown: `## SLIs, SLOs, Error Budgets, and Cloud Monitoring

Site Reliability Engineering (SRE) makes reliability measurable.

- **SLI (indicator):** a quantitative measure of service behavior, e.g. request latency or availability.
- **SLO (objective):** a target value for an SLI over a window, e.g. 99.9% of requests succeed per 28 days.
- **Error budget:** 1 − SLO; the allowable unreliability for the window.

### Error-budget policy
An **error-budget policy** turns the budget into governance: it defines what the team does as the budget is consumed. A typical policy **gates feature launches** — when the budget is exhausted, releases pause and the team prioritizes reliability work until the service is back within SLO.

### Multi-window, multi-burn-rate alerting
Alert on **how fast** the error budget is burning rather than on raw thresholds:
- **Fast-burn** (e.g. 2% of the 30-day budget in 1 hour) → page immediately.
- **Slow-burn** (e.g. 10% over several hours) → ticket / non-paging alert.

Combining short and long windows catches both acute outages and slow degradations while **reducing alert fatigue**.

**Cloud Monitoring** and **Cloud Logging** implement SLOs, burn-rate alerting policies, and dashboards. Alert on **symptoms users feel** (latency, errors) rather than every low-level cause.`,
    changeNotes:
      "Expanded the SRE lesson to add error-budget policy (release gating) and multi-window, multi-burn-rate alerting, reflecting the deepened reliability emphasis in the exam guide.",
    citations: V2_CITATIONS,
  },
  ci_l_waf_reliability: {
    markdown: `## Reliability in the Google Cloud Well-Architected Framework

The **Google Cloud Well-Architected Framework** (formerly the Architecture Framework) describes best practices across operational excellence, security, reliability, cost optimization, and performance.

### Reliability essentials
- **Define SLOs** based on user-centric service level indicators (SLIs).
- **Use error budgets** to balance feature velocity against stability.
- **Build redundancy** across zones and, where required, regions.
- **Plan disaster recovery** using explicit RPO and RTO targets.

### Putting it together
Reliable architectures combine redundancy, automated health checks, and tested recovery procedures so that the system degrades gracefully rather than failing outright.`,
    changeNotes:
      "Updated terminology from 'Architecture Framework' to 'Well-Architected Framework' to match the renamed framework.",
    citations: V2_CITATIONS,
  },
};

export function mockRegenerateQuestion(
  itemId: string,
  current: QuestionBody,
): ProposedQuestion {
  const marquee = MARQUEE_QUESTIONS[itemId];
  if (marquee) return marquee;
  // Templated fallback: apply substitutions to every text field.
  return {
    stem: applySubstitutions(current.stem),
    options: current.options.map(applySubstitutions),
    answerIndex: current.answerIndex,
    rationale: applySubstitutions(current.rationale),
    changeNotes:
      "Applied terminology updates from the latest sources (deprecations and renames).",
    citations: V2_CITATIONS,
  };
}

export function mockRegenerateLesson(
  itemId: string,
  current: LessonBody,
): ProposedLesson {
  const marquee = MARQUEE_LESSONS[itemId];
  if (marquee) return marquee;
  return {
    markdown: applySubstitutions(current.markdown),
    changeNotes:
      "Applied terminology updates from the latest sources (deprecations and renames).",
    citations: V2_CITATIONS,
  };
}

// ---------------------------------------------------------------------------
// Content Evaluator (mock)
// ---------------------------------------------------------------------------

/**
 * Per-item evaluator scores. Mechanical, high-confidence deprecation fixes clear
 * the auto-approve gate; substantive rewrites (a large GenAI expansion) score
 * lower on pedagogy and route to a human — demonstrating governance, not just
 * automation.
 */
const MARQUEE_EVAL: Record<string, Evaluation> = {
  ci_q_iac_dm: {
    groundedness: 0.95,
    accuracy: 0.94,
    pedagogicalQuality: 0.91,
    hallucinationRisk: 0.04,
    verdict: "approve",
    rationale:
      "The corrected answer (Infrastructure Manager) is directly grounded in the updated exam guide and docs, the rationale is accurate, and the question remains pedagogically clean. Safe to auto-approve.",
  },
  ci_l_iac_overview: {
    groundedness: 0.93,
    accuracy: 0.92,
    pedagogicalQuality: 0.88,
    hallucinationRisk: 0.05,
    verdict: "approve",
    rationale:
      "Lesson now teaches Infrastructure Manager + Terraform with an accurate deprecation note for Deployment Manager, fully grounded in the new sources. Clear and well-structured.",
  },
  ci_l_genai_vertex: {
    groundedness: 0.9,
    accuracy: 0.9,
    pedagogicalQuality: 0.76,
    hallucinationRisk: 0.12,
    verdict: "revise",
    rationale:
      "The expanded GenAI content (Gemini, RAG, grounding, Responsible AI) is grounded and accurate, but it is a substantial rewrite that materially changes scope. A human should confirm depth and sequencing before publishing.",
  },
  ci_l_waf_reliability: {
    groundedness: 0.92,
    accuracy: 0.93,
    pedagogicalQuality: 0.87,
    hallucinationRisk: 0.06,
    verdict: "approve",
    rationale:
      "A precise terminology update (Architecture Framework → Well-Architected Framework) with no change to the underlying guidance. Low risk; safe to auto-approve.",
  },
  ci_l_sre_monitoring: {
    groundedness: 0.89,
    accuracy: 0.9,
    pedagogicalQuality: 0.82,
    hallucinationRisk: 0.12,
    verdict: "revise",
    rationale:
      "The added error-budget-policy and burn-rate-alerting material is accurate and grounded, but it meaningfully deepens scope. A human should confirm the worked thresholds and pacing are right for the target audience before publishing.",
  },
};

export function mockEvaluate(itemId: string): Evaluation {
  const marquee = MARQUEE_EVAL[itemId];
  if (marquee) return marquee;
  // Templated rewrites are plausible but warrant human eyes before going live.
  return {
    groundedness: 0.78,
    accuracy: 0.82,
    pedagogicalQuality: 0.7,
    hallucinationRisk: 0.18,
    verdict: "revise",
    rationale:
      "Terminology was updated correctly, but the rewrite is mechanical: a human should confirm the surrounding explanation and examples remain accurate and well-paced before publishing.",
  };
}

/** Convenience for tracing: a single text blob of the proposed body. */
export function proposedToText(
  type: "question" | "lesson",
  proposed: ProposedQuestion | ProposedLesson,
): string {
  if (type === "question" && "stem" in proposed) {
    return bodyToText("question", {
      stem: proposed.stem,
      options: proposed.options,
      answerIndex: proposed.answerIndex,
      rationale: proposed.rationale,
    });
  }
  if ("markdown" in proposed) {
    return bodyToText("lesson", { markdown: proposed.markdown });
  }
  return "";
}
