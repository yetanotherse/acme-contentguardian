import { fail, ok } from "@/lib/api";
import { dialect, rawPostgres, rawSqlite } from "@/db/client";
import {
  contentStatusCounts,
  countReviewTasksByStatus,
  listWorkflowRuns,
} from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reject if a step takes longer than `ms` — converts a hang into a reported timeout. */
function withTimeout<T>(label: string, ms: number, p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
    ),
  ]).catch((e) => {
    throw new Error(`[${label}] ${e instanceof Error ? e.message : String(e)}`);
  });
}

async function time<T>(p: Promise<T>): Promise<{ ms: number; value: T }> {
  const start = Date.now();
  const value = await p;
  return { ms: Date.now() - start, value };
}

/**
 * GET /api/health/db — pinpoints where (if anywhere) the database stalls.
 * Each step is bounded by an 8s timeout so a hang is reported, not infinite.
 */
export async function GET() {
  const result: Record<string, unknown> = { dialect };
  try {
    // 1) Raw connectivity — isolates connect/auth from app queries.
    const select1 = await time(
      withTimeout(
        "select1",
        8000,
        dialect === "postgres"
          ? rawPostgres!`select 1 as ok`.then(() => true)
          : Promise.resolve(rawSqlite!.prepare("SELECT 1 AS ok").get()),
      ),
    );
    result.select1Ms = select1.ms;

    // 2) The exact query the root layout runs.
    const count = await time(
      withTimeout("countReviewTasks", 8000, countReviewTasksByStatus()),
    );
    result.countMs = count.ms;
    result.reviewCounts = count.value;

    // 3) Reproduce the page's CONCURRENCY (the suspected hang).
    const concurrent = await time(
      withTimeout(
        "concurrent",
        8000,
        Promise.all([
          contentStatusCounts(),
          countReviewTasksByStatus(),
          listWorkflowRuns(5),
        ]),
      ),
    );
    result.concurrentMs = concurrent.ms;
    result.poolMax = Number(process.env.DB_POOL_MAX ?? 10);

    return ok({ ok: true, ...result });
  } catch (error) {
    return fail(
      `${error instanceof Error ? error.message : String(error)} | partial=${JSON.stringify(result)}`,
    );
  }
}
