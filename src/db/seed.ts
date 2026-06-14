/**
 * Seeds the database with the static PCA dataset (src/db/seed-data.ts).
 *
 * Idempotent: clears all domain tables, then inserts topics, sources (v1),
 * and content items with their initial live version + provenance + embeddings.
 * Re-running restores the exact initial demo state (used by `db:seed`,
 * `db:reset`, and the in-app "Reset Demo" button).
 *
 * Run: `npm run db:seed`
 */
import { bodyToText } from "@/lib/content-types";
import { embedTexts, serializeEmbedding } from "@/lib/embeddings";

import { db, schema, sqliteConnection } from "./client";
import { runMigrations } from "./migrate";
import {
  SEED_CONTENT,
  SEED_SOURCES,
  SEED_TOPICS,
} from "./seed-data";

const {
  changeEvents,
  contentItems,
  contentTopics,
  contentVersions,
  reviewTasks,
  runSteps,
  sources,
  sourceVersions,
  topics,
  workflowRuns,
} = schema;

/** Wipe all domain tables in FK-safe order. */
function clearAll(): void {
  db.delete(runSteps).run();
  db.delete(reviewTasks).run();
  db.delete(changeEvents).run();
  db.delete(contentTopics).run();
  db.delete(contentVersions).run();
  db.delete(workflowRuns).run();
  db.delete(contentItems).run();
  db.delete(sourceVersions).run();
  db.delete(topics).run();
  db.delete(sources).run();
}

export async function seedDatabase(): Promise<void> {
  runMigrations();
  clearAll();

  // --- Embed everything up front (one batched call in real mode) -----------
  const topicTexts = SEED_TOPICS.map((t) => `${t.name}. ${t.description}`);
  const sourceTexts = SEED_SOURCES.map((s) => s.version.body);
  const contentTexts = SEED_CONTENT.map((c) =>
    bodyToText(c.type, c.body),
  );

  const [topicEmb, sourceEmb, contentEmb] = await Promise.all([
    embedTexts(topicTexts),
    embedTexts(sourceTexts),
    embedTexts(contentTexts),
  ]);

  // --- Topics --------------------------------------------------------------
  SEED_TOPICS.forEach((t, i) => {
    db.insert(topics)
      .values({
        id: t.id,
        parentId: t.parentId,
        name: t.name,
        slug: t.slug,
        description: t.description,
        embedding: serializeEmbedding(topicEmb[i]),
      })
      .run();
  });

  // --- Sources + v1 versions ----------------------------------------------
  SEED_SOURCES.forEach((s, i) => {
    db.insert(sources)
      .values({ id: s.id, name: s.name, kind: s.kind })
      .run();
    db.insert(sourceVersions)
      .values({
        id: s.version.id,
        sourceId: s.id,
        version: 1,
        title: s.version.title,
        body: s.version.body,
        embedding: serializeEmbedding(sourceEmb[i]),
      })
      .run();
  });

  // --- Content items + initial live version + topic links ------------------
  SEED_CONTENT.forEach((c, i) => {
    const versionId = `cv_${c.id}_v1`;
    db.insert(contentItems)
      .values({
        id: c.id,
        type: c.type,
        title: c.title,
        status: "fresh",
        currentVersionId: versionId,
        confidence: 1,
      })
      .run();

    db.insert(contentVersions)
      .values({
        id: versionId,
        contentItemId: c.id,
        version: 1,
        bodyJson: JSON.stringify(c.body),
        embedding: serializeEmbedding(contentEmb[i]),
        sourceVersionIds: JSON.stringify(c.sourceVersionIds),
        kgSnapshot: JSON.stringify({ topics: c.topicSlugs }),
        agentContext: JSON.stringify({
          origin: "initial_seed",
          note: "Authored from PCA exam guide + GCP architecture docs (static excerpts).",
        }),
        status: "live",
      })
      .run();

    for (const slug of c.topicSlugs) {
      const topic = SEED_TOPICS.find((t) => t.slug === slug);
      if (topic) {
        db.insert(contentTopics)
          .values({ contentItemId: c.id, topicId: topic.id })
          .run();
      }
    }
  });
}

// Allow direct execution.
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDatabase()
    .then(() => {
      sqliteConnection.close();
      console.log(
        `✅ Seeded ${SEED_TOPICS.length} topics, ${SEED_SOURCES.length} sources, ${SEED_CONTENT.length} content items.`,
      );
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
