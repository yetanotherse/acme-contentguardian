/**
 * Postgres mirror of ./schema.ts for Supabase production deployments.
 *
 * Intentional duplication (see README "Database strategy"): kept separate from
 * the SQLite schema to avoid disturbing the working local path. Table/column
 * NAMES match schema.ts exactly so src/db/queries.ts is dialect-agnostic.
 *
 * Differences from SQLite:
 *   - JSON columns are `jsonb` (vs `text`) — bridged by encodeJson/decodeJson.
 *   - Embedding columns are pgvector `vector(EMBEDDING_DIM)` (vs `text`).
 *   - Timestamps are `text` holding ISO-8601 UTC strings (matching SQLite reads),
 *     defaulted to an ISO string so the UI's `new Date(iso)` works identically.
 */
import { sql } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  vector,
} from "drizzle-orm/pg-core";

import { EMBEDDING_DIM } from "@/lib/providers";
import type {
  ChangeType,
  ContentStatus,
  ContentType,
  ContentVersionStatus,
  ReviewStatus,
  RunStepStatus,
  SourceKind,
  WorkflowKind,
  WorkflowStatus,
} from "./schema";

/** ISO-8601 UTC string, matching src/lib/ids.ts `nowIso()` and the SQLite format. */
const pgNow = sql`to_char((now() AT TIME ZONE 'utc'), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").$type<SourceKind>().notNull(),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const sourceVersions = pgTable("source_versions", {
  id: text("id").primaryKey(),
  sourceId: text("source_id")
    .notNull()
    .references(() => sources.id),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const contentItems = pgTable("content_items", {
  id: text("id").primaryKey(),
  type: text("type").$type<ContentType>().notNull(),
  title: text("title").notNull(),
  status: text("status").$type<ContentStatus>().notNull().default("fresh"),
  currentVersionId: text("current_version_id"),
  confidence: doublePrecision("confidence").notNull().default(1),
  lastHealedAt: text("last_healed_at"),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const contentVersions = pgTable("content_versions", {
  id: text("id").primaryKey(),
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  version: integer("version").notNull(),
  bodyJson: jsonb("body_json").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
  sourceVersionIds: jsonb("source_version_ids").notNull().default([]),
  kgSnapshot: jsonb("kg_snapshot").notNull().default({}),
  agentContext: jsonb("agent_context").notNull().default({}),
  status: text("status")
    .$type<ContentVersionStatus>()
    .notNull()
    .default("live"),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const contentTopics = pgTable("content_topics", {
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id),
});

export const changeEvents = pgTable("change_events", {
  id: text("id").primaryKey(),
  sourceVersionId: text("source_version_id")
    .notNull()
    .references(() => sourceVersions.id),
  changeType: text("change_type").$type<ChangeType>().notNull(),
  summary: text("summary").notNull(),
  detail: text("detail").notNull(),
  severity: doublePrecision("severity").notNull().default(0.5),
  affectedTopics: jsonb("affected_topics").notNull().default([]),
  createdAt: text("created_at").notNull().default(pgNow),
});

export const reviewTasks = pgTable("review_tasks", {
  id: text("id").primaryKey(),
  contentItemId: text("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  changeEventId: text("change_event_id").references(() => changeEvents.id),
  workflowRunId: text("workflow_run_id").references(() => workflowRuns.id),
  proposedVersionId: text("proposed_version_id").references(
    () => contentVersions.id,
  ),
  baseVersionId: text("base_version_id").references(() => contentVersions.id),
  status: text("status").$type<ReviewStatus>().notNull().default("needs_human"),
  evalScores: jsonb("eval_scores").notNull().default({}),
  impact: jsonb("impact").notNull().default({}),
  reasoning: text("reasoning").notNull().default(""),
  reviewReason: jsonb("review_reason").notNull().default({}),
  humanFeedback: text("human_feedback"),
  confidence: doublePrecision("confidence").notNull().default(0),
  createdAt: text("created_at").notNull().default(pgNow),
  resolvedAt: text("resolved_at"),
});

export const workflowRuns = pgTable("workflow_runs", {
  id: text("id").primaryKey(),
  kind: text("kind").$type<WorkflowKind>().notNull(),
  status: text("status").$type<WorkflowStatus>().notNull().default("running"),
  inputJson: jsonb("input_json").notNull().default({}),
  summaryJson: jsonb("summary_json").notNull().default({}),
  startedAt: text("started_at").notNull().default(pgNow),
  finishedAt: text("finished_at"),
});

export const runSteps = pgTable("run_steps", {
  id: text("id").primaryKey(),
  workflowRunId: text("workflow_run_id")
    .notNull()
    .references(() => workflowRuns.id),
  agent: text("agent").notNull(),
  step: text("step").notNull(),
  status: text("status").$type<RunStepStatus>().notNull().default("ok"),
  inputJson: jsonb("input_json").notNull().default({}),
  outputJson: jsonb("output_json").notNull().default({}),
  reasoning: text("reasoning").notNull().default(""),
  seq: integer("seq").notNull(),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull().default(pgNow),
});
