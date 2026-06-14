/**
 * End-to-end integration test of the healing engine in MOCK mode against an
 * isolated SQLite database (DATABASE_PATH=./.test.db, set by vitest.config.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed";
import {
  getContentItem,
  getReviewTask,
  getRunSteps,
  listReviewTasks,
} from "@/db/queries";

import { applySimulatedUpdate } from "./workflows/simulate";
import { runHealing } from "./workflows/healing";
import { approveTask, rejectTask } from "./review";

beforeAll(async () => {
  await seedDatabase();
});

describe("simulate → heal → review", () => {
  it("applies the simulated Cloud Next update", async () => {
    const sim = await applySimulatedUpdate();
    expect(sim.applied).toBe(true);
    expect(sim.newSourceVersions).toBe(2);
    expect(sim.changeEvents).toBe(6);
    expect(sim.staleItems).toBe(5);
  });

  it("is idempotent (no duplicate source versions on re-run)", async () => {
    const second = await applySimulatedUpdate();
    expect(second.applied).toBe(false);
  });

  it("heals: 5 impacted → 3 auto-approved, 2 routed to a human", async () => {
    const summary = await runHealing();
    expect(summary.changesDetected).toBe(6);
    expect(summary.itemsImpacted).toBe(5);
    expect(summary.autoApproved).toBe(3);
    expect(summary.needsReview).toBe(2);

    // A full reasoning trace is persisted.
    const steps = await getRunSteps(summary.runId);
    expect(steps.length).toBeGreaterThanOrEqual(13);
    expect(steps.some((s) => s.agent === "Change Detector")).toBe(true);
    expect(steps.some((s) => s.agent === "Content Evaluator")).toBe(true);
  });

  it("creates review tasks with a mix of statuses", async () => {
    const tasks = await listReviewTasks();
    expect(tasks).toHaveLength(5);
    expect(tasks.filter((t) => t.task.status === "auto_approved")).toHaveLength(
      3,
    );
    expect(tasks.filter((t) => t.task.status === "needs_human")).toHaveLength(2);
  });

  it("auto-approved items are promoted to fresh/live", async () => {
    const iac = await getContentItem("ci_q_iac_dm");
    expect(iac?.status).toBe("fresh");
    expect(iac?.lastHealedAt).toBeTruthy();
  });

  it("retains a distinct base version on every task (so diffs render)", async () => {
    for (const { task } of await listReviewTasks()) {
      expect(task.baseVersionId).toBeTruthy();
      expect(task.baseVersionId).not.toBe(task.proposedVersionId);
    }
  });

  it("stores a human-readable review reason explaining each routing decision", async () => {
    const tasks = await listReviewTasks();
    for (const { task } of tasks) {
      const reason = JSON.parse(task.reviewReason || "{}");
      expect(reason.message).toBeTruthy();
      expect(reason.title).toBeTruthy();
    }
    // Auto-approved items explain they cleared the gate.
    for (const { task } of tasks.filter((t) => t.task.status === "auto_approved")) {
      expect(JSON.parse(task.reviewReason).kind).toBe("auto");
    }
    // At least one human-review item cites the governance policy.
    const policyTasks = tasks.filter(
      (t) => JSON.parse(t.task.reviewReason || "{}").kind === "policy",
    );
    expect(policyTasks.length).toBeGreaterThanOrEqual(1);
  });

  it("reject feeds back a revised proposal that stays in review", async () => {
    const task = (await listReviewTasks("needs_human"))[0];
    const originalProposed = task.task.proposedVersionId;
    const result = await rejectTask(
      task.task.id,
      "Mention Vertex AI Search by name and add a RAG reference architecture.",
    );
    expect(result.newProposedVersionId).not.toBe(originalProposed);
    const after = await getReviewTask(task.task.id);
    expect(after?.status).toBe("needs_human");
    expect(after?.proposedVersionId).toBe(result.newProposedVersionId);
  });

  it("approve promotes the proposed version to live", async () => {
    const task = (await listReviewTasks("needs_human"))[0];
    const result = await approveTask(task.task.id);
    expect(result.approved).toBe(true);
    const item = await getContentItem(result.contentItemId);
    expect(item?.status).toBe("fresh");
    expect(item?.currentVersionId).toBe(result.versionId);
    expect((await getReviewTask(task.task.id))?.status).toBe("approved");
  });
});
