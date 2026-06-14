import { fail, ok } from "@/lib/api";
import { runHealing } from "@/mastra/workflows/healing";
import { runFullScan } from "@/mastra/workflows/full-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/workflows/run
 * Body: { kind: "healing" | "full_scan" }
 * Runs the requested healing pipeline and returns its summary.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      kind?: string;
    };
    const kind = body.kind === "full_scan" ? "full_scan" : "healing";
    const summary =
      kind === "full_scan" ? await runFullScan() : await runHealing();
    return ok(summary);
  } catch (error) {
    return fail(error);
  }
}
