import { fail, ok } from "@/lib/api";
import { applySimulatedUpdate } from "@/mastra/workflows/simulate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/simulate/gcp-next — apply the simulated Google Cloud Next source wave. */
export async function POST() {
  try {
    const result = await applySimulatedUpdate();
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
