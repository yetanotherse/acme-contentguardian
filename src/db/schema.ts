/**
 * ContentGuardian data model (Drizzle ORM + SQLite).
 *
 * Design notes:
 * - All `embedding` columns are TEXT holding a JSON array of numbers. This keeps
 *   the demo zero-config (no pgvector) while remaining trivially portable: in
 *   production these become `vector` columns and `cosineSimilarity` (see
 *   src/lib/embeddings.ts) is replaced by the pgvector `<=>` operator.
 * - JSON payload columns (bodyJson, kgSnapshot, agentContext, evalScores, impact)
 *   are TEXT holding JSON. Typed accessors live in src/db/queries.
 * - Provenance lives on `content_versions`: which source versions grounded a
 *   version, the KG snapshot at generation time, and the agent context.
 */
import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Shared literal unions (stored as TEXT, typed via Drizzle $type)
// ---------------------------------------------------------------------------

export type SourceKind = "exam_guide" | "documentation" | "best_practices";
export type ContentType = "question" | "lesson";
/** Lifecycle of a content item's live state. */
export type ContentStatus = "fresh" | "stale" | "in_review" | "healing";
/** Lifecycle of a specific content version. */
export type ContentVersionStatus =
  | "live"
  | "proposed"
  | "superseded"
  | "rejected";
export type ChangeType = "deprecation" | "addition" | "emphasis" | "wording";
export type ReviewStatus =
  | "needs_human"
  | "auto_approved"
  | "approved"
  | "rejected"
  | "regenerating";
export type WorkflowKind =
  | "healing"
  | "full_scan"
  | "feedback_loop";
export type WorkflowStatus = "running" | "completed" | "failed";
export type RunStepStatus = "ok" | "error";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

// ---------------------------------------------------------------------------
// Sources & versions
// ---------------------------------------------------------------------------

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").$type<SourceKind>().notNull(),
  createdAt: text("created_at").notNull().default(now),
});

export const sourceVersions = sqliteTable("source_versions", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** JSON array<number>; null until embedded. */
  embedding: text("embedding"),
  createdAt: text("created_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Knowledge graph (hierarchical topics)
// ---------------------------------------------------------------------------

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  embedding: text("embedding"),
  createdAt: text("created_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Content items & versions
// ---------------------------------------------------------------------------

export const contentItems = sqliteTable("content_items", {
  id: text("id").primaryKey(),
  type: text("type").$type<ContentType>().notNull(),
  title: text("title").notNull(),
  status: text("status").$type<ContentStatus>().notNull().default("fresh"),
  /** Pointer to the currently live content_versions row. */
  currentVersionId: text("current_version_id"),
  confidence: real("confidence").notNull().default(1),
  lastHealedAt: text("last_healed_at"),
  createdAt: text("created_at").notNull().default(now),
});

export const contentVersions = sqliteTable("content_versions", {
  id: text("id").primaryKey(),
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  version: integer("version").notNull(),
  /** JSON: question = { stem, options[], answerIndex, rationale }; lesson = { markdown }. */
  bodyJson: text("body_json").notNull(),
  embedding: text("embedding"),
  /** JSON string[]: source_versions.id used to ground this version (provenance). */
  sourceVersionIds: text("source_version_ids").notNull().default("[]"),
  /** JSON: topic subtree snapshot at generation time (provenance). */
  kgSnapshot: text("kg_snapshot").notNull().default("{}"),
  /** JSON: { model, promptSummary, toolCalls[], changeNotes } (provenance). */
  agentContext: text("agent_context").notNull().default("{}"),
  status: text("status")
    .$type<ContentVersionStatus>()
    .notNull()
    .default("live"),
  createdAt: text("created_at").notNull().default(now),
});

/** Many-to-many: content_items <-> topics. */
export const contentTopics = sqliteTable("content_topics", {
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
});

// ---------------------------------------------------------------------------
// Change detection
// ---------------------------------------------------------------------------

export const changeEvents = sqliteTable("change_events", {
  id: text("id").primaryKey(),
  sourceVersionId: text("source_version_id")
    .notNull()
    .references(() => sourceVersions.id),
  changeType: text("change_type").$type<ChangeType>().notNull(),
  summary: text("summary").notNull(),
  detail: text("detail").notNull(),
  /** 0..1 severity from the Change Detector agent. */
  severity: real("severity").notNull().default(0.5),
  /** JSON string[]: topic slugs the agent flagged. */
  affectedTopics: text("affected_topics").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Human-in-the-loop review
// ---------------------------------------------------------------------------

export const reviewTasks = sqliteTable("review_tasks", {
  id: text("id").primaryKey(),
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  changeEventId: text("change_event_id").references(() => changeEvents.id),
  workflowRunId: text("workflow_run_id").references(() => workflowRuns.id),
  /** Draft content_versions.id awaiting approval. */
  proposedVersionId: text("proposed_version_id").references(
    () => contentVersions.id,
  ),
  /** The version the proposal was generated against (for a stable before/after diff). */
  baseVersionId: text("base_version_id").references(() => contentVersions.id),
  status: text("status").$type<ReviewStatus>().notNull().default("needs_human"),
  /** JSON: { groundedness, accuracy, pedagogicalQuality, hallucinationRisk, verdict, rationale }. */
  evalScores: text("eval_scores").notNull().default("{}"),
  /** JSON: { impactScore, staleReason, affectedAspects[] }. */
  impact: text("impact").notNull().default("{}"),
  /** Human-readable agent reasoning summary for this task. */
  reasoning: text("reasoning").notNull().default(""),
  /** JSON { kind, title, message } explaining WHY this task was routed as it was. */
  reviewReason: text("review_reason").notNull().default("{}"),
  /** Structured human feedback when rejected (drives re-generation). */
  humanFeedback: text("human_feedback"),
  confidence: real("confidence").notNull().default(0),
  createdAt: text("created_at").notNull().default(now),
  resolvedAt: text("resolved_at"),
});

// ---------------------------------------------------------------------------
// Observability: workflow runs + step traces
// ---------------------------------------------------------------------------

export const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<WorkflowKind>().notNull(),
  status: text("status").$type<WorkflowStatus>().notNull().default("running"),
  inputJson: text("input_json").notNull().default("{}"),
  summaryJson: text("summary_json").notNull().default("{}"),
  startedAt: text("started_at").notNull().default(now),
  finishedAt: text("finished_at"),
});

export const runSteps = sqliteTable("run_steps", {
  id: text("id").primaryKey(),
  workflowRunId: text("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id),
  agent: text("agent").notNull(),
  step: text("step").notNull(),
  status: text("status").$type<RunStepStatus>().notNull().default("ok"),
  inputJson: text("input_json").notNull().default("{}"),
  outputJson: text("output_json").notNull().default("{}"),
  reasoning: text("reasoning").notNull().default(""),
  seq: integer("seq").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull().default(now),
});

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type Source = typeof sources.$inferSelect;
export type SourceVersion = typeof sourceVersions.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type ContentItem = typeof contentItems.$inferSelect;
export type ContentVersion = typeof contentVersions.$inferSelect;
export type ContentTopic = typeof contentTopics.$inferSelect;
export type ChangeEvent = typeof changeEvents.$inferSelect;
export type ReviewTask = typeof reviewTasks.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
