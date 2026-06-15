/**
 * Seeds the database with the static PCA dataset (src/db/seed-data.ts).
 *
 * Idempotent: clears all domain tables, then inserts topics, sources (v1),
 * and content items with their initial live version + provenance + embeddings.
 * Re-running restores the exact initial demo state (used by `db:seed`,
 * `db:reset`, and the in-app "Reset Demo" button). Works on both SQLite and
 * Postgres via the dialect adapters.
 *
 * Run: `npm run db:seed`
 */
import { bodyToText } from "@/lib/content-types";
import { embedTexts } from "@/lib/embeddings";

import { closeDb, db, dialect, schema } from "./client";
import { encodeJson, run, toDbEmbedding } from "./exec";
import { runMigrations } from "./migrate";
import { SEED_CONTENT, SEED_SOURCES, SEED_TOPICS } from "./seed-data";

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
async function clearAll(): Promise<void> {
  await run(db.delete(runSteps));
  await run(db.delete(reviewTasks));
  await run(db.delete(changeEvents));
  await run(db.delete(contentTopics));
  await run(db.delete(contentVersions));
  await run(db.delete(workflowRuns));
  await run(db.delete(contentItems));
  await run(db.delete(sourceVersions));
  await run(db.delete(topics));
  await run(db.delete(sources));
}

/**
 * Seed (or re-seed) the database.
 *
 * `migrate` controls whether schema migrations run first:
 *   - CLI (`db:seed`/`db:reset`) and tests → default `true` (local convenience;
 *     the drizzle migration folder is on disk).
 *   - The in-app "Reset Demo" route passes `false` — on Vercel the migration
 *     files aren't in the serverless bundle, and the schema already exists
 *     (migrations are applied once at deploy via `npm run db:migrate:pg`).
 *     Reset only needs to clear + re-insert data.
 */
export async function seedDatabase(
  opts: { migrate?: boolean } = {},
): Promise<void> {
  if (opts.migrate ?? true) await runMigrations();
  await clearAll();

  // --- Embed everything up front (one batched call in real mode) -----------
  const topicTexts = SEED_TOPICS.map((t) => `${t.name}. ${t.description}`);
  const sourceTexts = SEED_SOURCES.map((s) => s.version.body);
  const contentTexts = SEED_CONTENT.map((c) => bodyToText(c.type, c.body));

  const [topicEmb, sourceEmb, contentEmb] = await Promise.all([
    embedTexts(topicTexts),
    embedTexts(sourceTexts),
    embedTexts(contentTexts),
  ]);

  // --- Topics --------------------------------------------------------------
  for (let i = 0; i < SEED_TOPICS.length; i++) {
    const t = SEED_TOPICS[i];
    await run(
      db.insert(topics).values({
        id: t.id,
        parentId: t.parentId,
        name: t.name,
        slug: t.slug,
        description: t.description,
        embedding: toDbEmbedding(topicEmb[i]),
      }),
    );
  }

  // --- Sources + v1 versions ----------------------------------------------
  for (let i = 0; i < SEED_SOURCES.length; i++) {
    const s = SEED_SOURCES[i];
    await run(
      db.insert(sources).values({ id: s.id, name: s.name, kind: s.kind }),
    );
    await run(
      db.insert(sourceVersions).values({
        id: s.version.id,
        sourceId: s.id,
        version: 1,
        title: s.version.title,
        body: s.version.body,
        embedding: toDbEmbedding(sourceEmb[i]),
      }),
    );
  }

  // --- Content items + initial live version + topic links ------------------
  for (let i = 0; i < SEED_CONTENT.length; i++) {
    const c = SEED_CONTENT[i];
    const versionId = `cv_${c.id}_v1`;
    await run(
      db.insert(contentItems).values({
        id: c.id,
        type: c.type,
        title: c.title,
        status: "fresh",
        currentVersionId: versionId,
        confidence: 1,
      }),
    );

    await run(
      db.insert(contentVersions).values({
        id: versionId,
        contentItemId: c.id,
        version: 1,
        bodyJson: encodeJson(c.body) as string,
        embedding: toDbEmbedding(contentEmb[i]),
        sourceVersionIds: encodeJson(c.sourceVersionIds) as string,
        kgSnapshot: encodeJson({ topics: c.topicSlugs }) as string,
        agentContext: encodeJson({
          origin: "initial_seed",
          note: "Authored from PCA exam guide + GCP architecture docs (static excerpts).",
        }) as string,
        status: "live",
      }),
    );

    for (const slug of c.topicSlugs) {
      const topic = SEED_TOPICS.find((t) => t.slug === slug);
      if (topic) {
        await run(
          db
            .insert(contentTopics)
            .values({ contentItemId: c.id, topicId: topic.id }),
        );
      }
    }
  }
}

// Allow direct execution.
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  seedDatabase()
    .then(async () => {
      await closeDb();
      console.log(
        `✅ Seeded ${SEED_TOPICS.length} topics, ${SEED_SOURCES.length} sources, ${SEED_CONTENT.length} content items (${dialect}).`,
      );
    })
    .catch((err) => {
      console.error("❌ Seed failed:", err);
      process.exit(1);
    });
}
