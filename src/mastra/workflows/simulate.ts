/**
 * Simulates a "Google Cloud Next" wave of source updates: inserts a v2 of each
 * source, runs change detection to persist change_events, and marks topically
 * affected content as stale. After this, the healing pipeline has something to
 * detect, triage, and fix.
 */
import { embedText } from "@/lib/embeddings";
import { toDbEmbedding } from "@/db/exec";
import {
  getLatestSourceVersion,
  insertChangeEvent,
  insertSourceVersion,
  markStaleByTopics,
} from "@/db/queries";

import { SEED_SOURCE_CHANGES } from "@/db/seed-data";

export interface SimulationResult {
  applied: boolean;
  newSourceVersions: number;
  changeEvents: number;
  staleItems: number;
  message: string;
}

export async function applySimulatedUpdate(): Promise<SimulationResult> {
  let newSourceVersions = 0;
  let changeEvents = 0;
  const affectedTopics = new Set<string>();

  for (const change of SEED_SOURCE_CHANGES) {
    const latest = await getLatestSourceVersion(change.sourceId);
    // Idempotent: skip sources already advanced to v2+.
    if (latest && latest.version >= 2) continue;

    const embedding = await embedText(change.newVersion.body);
    await insertSourceVersion({
      id: change.newVersion.id,
      sourceId: change.sourceId,
      version: (latest?.version ?? 1) + 1,
      title: change.newVersion.title,
      body: change.newVersion.body,
      embedding: toDbEmbedding(embedding),
    });
    newSourceVersions++;

    for (const c of change.changes) {
      await insertChangeEvent({
        sourceVersionId: change.newVersion.id,
        changeType: c.changeType,
        summary: c.summary,
        detail: c.detail,
        severity: c.severity,
        affectedTopics: c.affectedTopics,
      });
      changeEvents++;
      c.affectedTopics.forEach((t) => affectedTopics.add(t));
    }
  }

  if (newSourceVersions === 0) {
    return {
      applied: false,
      newSourceVersions: 0,
      changeEvents: 0,
      staleItems: 0,
      message:
        "Sources are already updated. Reset the demo to simulate again.",
    };
  }

  const staleItems = await markStaleByTopics([...affectedTopics]);

  return {
    applied: true,
    newSourceVersions,
    changeEvents,
    staleItems,
    message: `Applied ${newSourceVersions} source update(s), detected ${changeEvents} change(s), flagged ${staleItems} content item(s) as stale.`,
  };
}
