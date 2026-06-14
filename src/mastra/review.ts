/**
 * Human review actions over a proposed content version: approve (optionally with
 * inline edits), or reject (which kicks off the feedback-incorporation loop).
 */
import { bodyToText, type ContentBody } from "@/lib/content-types";
import { embedText, serializeEmbedding } from "@/lib/embeddings";
import { nowIso } from "@/lib/ids";

import {
  getContentItem,
  getContentVersion,
  getReviewTask,
  promoteVersion,
  updateContentVersionBody,
  updateReviewTask,
} from "@/db/queries";

import { runFeedbackLoop, type FeedbackResult } from "./workflows/feedback";

export interface ApproveResult {
  approved: true;
  contentItemId: string;
  versionId: string;
}

/** Approve a proposal — promoting it to live. Optional `editedBody` saves inline edits first. */
export async function approveTask(
  taskId: string,
  editedBody?: ContentBody,
): Promise<ApproveResult> {
  const task = getReviewTask(taskId);
  if (!task) throw new Error(`Review task ${taskId} not found.`);
  if (!task.proposedVersionId) {
    throw new Error(`Task ${taskId} has no proposed version.`);
  }
  const version = getContentVersion(task.proposedVersionId);
  if (!version) throw new Error("Proposed version not found.");
  const item = getContentItem(task.contentItemId);
  if (!item) throw new Error("Content item not found.");

  if (editedBody) {
    const text = bodyToText(item.type, editedBody);
    const embedding = await embedText(text);
    const prevContext = JSON.parse(version.agentContext || "{}");
    updateContentVersionBody(
      version.id,
      JSON.stringify(editedBody),
      serializeEmbedding(embedding),
      { ...prevContext, humanEdited: true, editedAt: nowIso() },
    );
  }

  promoteVersion(task.contentItemId, task.proposedVersionId);
  updateReviewTask(taskId, {
    status: "approved",
    resolvedAt: nowIso(),
  });

  return {
    approved: true,
    contentItemId: task.contentItemId,
    versionId: task.proposedVersionId,
  };
}

/** Reject a proposal with structured feedback → triggers the feedback loop. */
export async function rejectTask(
  taskId: string,
  feedback: string,
): Promise<FeedbackResult> {
  if (!feedback.trim()) {
    throw new Error("Rejection requires structured feedback.");
  }
  return runFeedbackLoop(taskId, feedback);
}
