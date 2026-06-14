import { fail, ok } from "@/lib/api";
import type { ContentBody } from "@/lib/content-types";
import { approveTask, rejectTask } from "@/mastra/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReviewBody {
  action: "approve" | "reject";
  editedBody?: ContentBody;
  feedback?: string;
}

/**
 * POST /api/review/:taskId
 * Body: { action: "approve", editedBody? } | { action: "reject", feedback }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    const body = (await request.json()) as ReviewBody;

    if (body.action === "approve") {
      const result = await approveTask(taskId, body.editedBody);
      return ok(result);
    }
    if (body.action === "reject") {
      const result = await rejectTask(taskId, body.feedback ?? "");
      return ok(result);
    }
    return fail("Unknown review action.", 400);
  } catch (error) {
    return fail(error);
  }
}
