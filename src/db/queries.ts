/**
 * Typed query helpers over the Drizzle client. Centralizes all DB access used by
 * the Mastra workflows, API routes, and UI server components.
 *
 * Dialect-agnostic: every statement runs through the `rows/row/run` adapters
 * (sync better-sqlite3 vs async postgres-js), JSON columns through
 * `encodeJson`/`decodeJson` (text vs jsonb), and embeddings through
 * `toDbEmbedding`/`fromDbEmbedding` (text vs vector). All functions are async.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { newId, nowIso } from "@/lib/ids";

import { db, schema } from "./client";
import { encodeJson, fromDbEmbedding, row, rows, run } from "./exec";
import type {
  ChangeEvent,
  ChangeType,
  ContentItem,
  ContentStatus,
  ContentVersion,
  ReviewStatus,
  RunStep,
  RunStepStatus,
  Source,
  SourceVersion,
  Topic,
  WorkflowKind,
  WorkflowRun,
  WorkflowStatus,
} from "./schema";

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

/** Coerce a SQL aggregate (Postgres returns bigint/numeric as string) to number. */
const num = (v: unknown): number => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Sources & versions
// ---------------------------------------------------------------------------

export function listSources(): Promise<Source[]> {
  return rows<Source>(db.select().from(sources));
}

export function getSourceVersions(sourceId: string): Promise<SourceVersion[]> {
  return rows<SourceVersion>(
    db
      .select()
      .from(sourceVersions)
      .where(eq(sourceVersions.sourceId, sourceId))
      .orderBy(desc(sourceVersions.version)),
  );
}

export async function getLatestSourceVersion(
  sourceId: string,
): Promise<SourceVersion | undefined> {
  return (await getSourceVersions(sourceId))[0];
}

export function getSourceVersionById(
  id: string,
): Promise<SourceVersion | undefined> {
  return row<SourceVersion>(
    db.select().from(sourceVersions).where(eq(sourceVersions.id, id)),
  );
}

export async function getSourceVersionsByIds(
  ids: string[],
): Promise<SourceVersion[]> {
  if (ids.length === 0) return [];
  return rows<SourceVersion>(
    db.select().from(sourceVersions).where(inArray(sourceVersions.id, ids)),
  );
}

export async function insertSourceVersion(input: {
  id: string;
  sourceId: string;
  version: number;
  title: string;
  body: string;
  embedding: string;
}): Promise<void> {
  await run(db.insert(sourceVersions).values(input));
}

export function listSourceVersions(): Promise<
  (SourceVersion & { sourceName: string })[]
> {
  return rows(
    db
      .select({
        id: sourceVersions.id,
        sourceId: sourceVersions.sourceId,
        version: sourceVersions.version,
        title: sourceVersions.title,
        body: sourceVersions.body,
        embedding: sourceVersions.embedding,
        createdAt: sourceVersions.createdAt,
        sourceName: sources.name,
      })
      .from(sourceVersions)
      .innerJoin(sources, eq(sources.id, sourceVersions.sourceId))
      .orderBy(desc(sourceVersions.createdAt)),
  );
}

// ---------------------------------------------------------------------------
// Change events
// ---------------------------------------------------------------------------

export async function insertChangeEvent(input: {
  sourceVersionId: string;
  changeType: ChangeType;
  summary: string;
  detail: string;
  severity: number;
  affectedTopics: string[];
}): Promise<ChangeEvent> {
  const id = newId("ce");
  await run(
    db.insert(changeEvents).values({
      id,
      sourceVersionId: input.sourceVersionId,
      changeType: input.changeType,
      summary: input.summary,
      detail: input.detail,
      severity: input.severity,
      affectedTopics: encodeJson(input.affectedTopics) as string,
    }),
  );
  return (await row<ChangeEvent>(
    db.select().from(changeEvents).where(eq(changeEvents.id, id)),
  ))!;
}

export async function getChangeEventsForVersions(
  versionIds: string[],
): Promise<ChangeEvent[]> {
  if (versionIds.length === 0) return [];
  return rows<ChangeEvent>(
    db
      .select()
      .from(changeEvents)
      .where(inArray(changeEvents.sourceVersionId, versionIds)),
  );
}

export function recentChangeEvents(
  limit = 20,
): Promise<(ChangeEvent & { sourceVersionTitle: string })[]> {
  return rows(
    db
      .select({
        id: changeEvents.id,
        sourceVersionId: changeEvents.sourceVersionId,
        changeType: changeEvents.changeType,
        summary: changeEvents.summary,
        detail: changeEvents.detail,
        severity: changeEvents.severity,
        affectedTopics: changeEvents.affectedTopics,
        createdAt: changeEvents.createdAt,
        sourceVersionTitle: sourceVersions.title,
      })
      .from(changeEvents)
      .innerJoin(
        sourceVersions,
        eq(sourceVersions.id, changeEvents.sourceVersionId),
      )
      .orderBy(desc(changeEvents.createdAt))
      .limit(limit),
  );
}

export function getChangeEventById(
  id: string,
): Promise<ChangeEvent | undefined> {
  return row<ChangeEvent>(
    db.select().from(changeEvents).where(eq(changeEvents.id, id)),
  );
}

// ---------------------------------------------------------------------------
// Topics (knowledge graph)
// ---------------------------------------------------------------------------

export function listTopics(): Promise<Topic[]> {
  return rows<Topic>(db.select().from(topics));
}

/** Count of content items linked to each topic id. */
export async function contentCountByTopic(): Promise<Record<string, number>> {
  const result = await rows<{ topicId: string; count: number }>(
    db
      .select({ topicId: contentTopics.topicId, count: sql<number>`COUNT(*)` })
      .from(contentTopics)
      .groupBy(contentTopics.topicId),
  );
  return Object.fromEntries(result.map((r) => [r.topicId, num(r.count)]));
}

/** Content items (with title/type/status) linked to a topic id. */
export function contentItemsForTopic(topicId: string): Promise<ContentItem[]> {
  return rows<ContentItem>(
    db
      .select({
        id: contentItems.id,
        type: contentItems.type,
        title: contentItems.title,
        status: contentItems.status,
        currentVersionId: contentItems.currentVersionId,
        confidence: contentItems.confidence,
        lastHealedAt: contentItems.lastHealedAt,
        createdAt: contentItems.createdAt,
      })
      .from(contentTopics)
      .innerJoin(contentItems, eq(contentItems.id, contentTopics.contentItemId))
      .where(eq(contentTopics.topicId, topicId)),
  );
}

export async function getTopicsBySlugs(slugs: string[]): Promise<Topic[]> {
  if (slugs.length === 0) return [];
  return rows<Topic>(
    db.select().from(topics).where(inArray(topics.slug, slugs)),
  );
}

/** Topic subtree (the matched topics plus their direct children) for grounding. */
export async function getTopicContext(slugs: string[]): Promise<Topic[]> {
  const matched = await getTopicsBySlugs(slugs);
  if (matched.length === 0) return [];
  const ids = matched.map((t) => t.id);
  const children = await rows<Topic>(
    db.select().from(topics).where(inArray(topics.parentId, ids)),
  );
  const seen = new Set<string>();
  return [...matched, ...children].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Content items & versions
// ---------------------------------------------------------------------------

export interface ContentCandidate {
  item: ContentItem;
  version: ContentVersion;
  embedding: number[];
  topicSlugs: string[];
}

/** All content items joined with their current live version + topic slugs. */
export async function getContentCandidates(): Promise<ContentCandidate[]> {
  const items = await rows<ContentItem>(db.select().from(contentItems));
  const candidates: ContentCandidate[] = [];
  for (const item of items) {
    if (!item.currentVersionId) continue;
    const version = await getContentVersion(item.currentVersionId);
    if (!version) continue;
    const slugRows = await rows<{ slug: string }>(
      db
        .select({ slug: topics.slug })
        .from(contentTopics)
        .innerJoin(topics, eq(topics.id, contentTopics.topicId))
        .where(eq(contentTopics.contentItemId, item.id)),
    );
    candidates.push({
      item,
      version,
      embedding: fromDbEmbedding(version.embedding),
      topicSlugs: slugRows.map((r) => r.slug),
    });
  }
  return candidates;
}

export function getContentItem(id: string): Promise<ContentItem | undefined> {
  return row<ContentItem>(
    db.select().from(contentItems).where(eq(contentItems.id, id)),
  );
}

export function getContentVersion(
  id: string,
): Promise<ContentVersion | undefined> {
  return row<ContentVersion>(
    db.select().from(contentVersions).where(eq(contentVersions.id, id)),
  );
}

export function getContentVersions(
  itemId: string,
): Promise<ContentVersion[]> {
  return rows<ContentVersion>(
    db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, itemId))
      .orderBy(desc(contentVersions.version)),
  );
}

export async function getTopicSlugsForItem(itemId: string): Promise<string[]> {
  const slugRows = await rows<{ slug: string }>(
    db
      .select({ slug: topics.slug })
      .from(contentTopics)
      .innerJoin(topics, eq(topics.id, contentTopics.topicId))
      .where(eq(contentTopics.contentItemId, itemId)),
  );
  return slugRows.map((r) => r.slug);
}

export async function nextContentVersionNumber(
  itemId: string,
): Promise<number> {
  const r = await row<{ max: number }>(
    db
      .select({ max: sql<number>`COALESCE(MAX(${contentVersions.version}), 0)` })
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, itemId)),
  );
  return num(r?.max) + 1;
}

export async function insertProposedVersion(input: {
  contentItemId: string;
  version: number;
  bodyJson: unknown;
  embedding: string;
  sourceVersionIds: string[];
  kgSnapshot: unknown;
  agentContext: unknown;
}): Promise<string> {
  const id = newId("cv");
  await run(
    db.insert(contentVersions).values({
      id,
      contentItemId: input.contentItemId,
      version: input.version,
      bodyJson: encodeJson(input.bodyJson) as string,
      embedding: input.embedding,
      sourceVersionIds: encodeJson(input.sourceVersionIds) as string,
      kgSnapshot: encodeJson(input.kgSnapshot) as string,
      agentContext: encodeJson(input.agentContext) as string,
      status: "proposed",
    }),
  );
  return id;
}

export async function updateContentVersionBody(
  versionId: string,
  bodyJson: unknown,
  embedding: string,
  agentContext?: unknown,
): Promise<void> {
  const patch: Record<string, unknown> = {
    bodyJson: encodeJson(bodyJson),
    embedding,
  };
  if (agentContext !== undefined) {
    patch.agentContext = encodeJson(agentContext);
  }
  await run(
    db.update(contentVersions).set(patch).where(eq(contentVersions.id, versionId)),
  );
}

export async function setContentItemStatus(
  itemId: string,
  status: ContentStatus,
): Promise<void> {
  await run(
    db.update(contentItems).set({ status }).where(eq(contentItems.id, itemId)),
  );
}

/** Item ids linked to any of the given topic slugs (via the join table). */
export async function getContentItemIdsByTopics(
  slugs: string[],
): Promise<string[]> {
  if (slugs.length === 0) return [];
  const idRows = await rows<{ id: string }>(
    db
      .selectDistinct({ id: contentTopics.contentItemId })
      .from(contentTopics)
      .innerJoin(topics, eq(topics.id, contentTopics.topicId))
      .where(inArray(topics.slug, slugs)),
  );
  return idRows.map((r) => r.id);
}

/** Mark content linked to the given topics as stale and lower its confidence. */
export async function markStaleByTopics(
  slugs: string[],
  confidence = 0.4,
): Promise<number> {
  const ids = await getContentItemIdsByTopics(slugs);
  for (const id of ids) {
    await run(
      db
        .update(contentItems)
        .set({ status: "stale", confidence })
        .where(and(eq(contentItems.id, id), eq(contentItems.status, "fresh"))),
    );
  }
  return ids.length;
}

// ---------------------------------------------------------------------------
// Workflow runs + step traces
// ---------------------------------------------------------------------------

export async function createWorkflowRun(input: {
  kind: WorkflowKind;
  input: unknown;
}): Promise<string> {
  const id = newId("run");
  await run(
    db.insert(workflowRuns).values({
      id,
      kind: input.kind,
      status: "running",
      inputJson: encodeJson(input.input) as string,
    }),
  );
  return id;
}

export async function finishWorkflowRun(
  id: string,
  status: WorkflowStatus,
  summary: unknown,
): Promise<void> {
  await run(
    db
      .update(workflowRuns)
      .set({
        status,
        summaryJson: encodeJson(summary) as string,
        finishedAt: nowIso(),
      })
      .where(eq(workflowRuns.id, id)),
  );
}

export async function addRunStep(input: {
  workflowRunId: string;
  agent: string;
  step: string;
  status?: RunStepStatus;
  input?: unknown;
  output?: unknown;
  reasoning?: string;
  seq: number;
  durationMs?: number;
}): Promise<void> {
  await run(
    db.insert(runSteps).values({
      id: newId("step"),
      workflowRunId: input.workflowRunId,
      agent: input.agent,
      step: input.step,
      status: input.status ?? "ok",
      inputJson: encodeJson(input.input) as string,
      outputJson: encodeJson(input.output) as string,
      reasoning: input.reasoning ?? "",
      seq: input.seq,
      durationMs: input.durationMs,
    }),
  );
}

export function listWorkflowRuns(limit = 30): Promise<WorkflowRun[]> {
  return rows<WorkflowRun>(
    db
      .select()
      .from(workflowRuns)
      .orderBy(desc(workflowRuns.startedAt))
      .limit(limit),
  );
}

export function getWorkflowRun(id: string): Promise<WorkflowRun | undefined> {
  return row<WorkflowRun>(
    db.select().from(workflowRuns).where(eq(workflowRuns.id, id)),
  );
}

export function getRunSteps(runId: string): Promise<RunStep[]> {
  return rows<RunStep>(
    db
      .select()
      .from(runSteps)
      .where(eq(runSteps.workflowRunId, runId))
      .orderBy(runSteps.seq),
  );
}

// ---------------------------------------------------------------------------
// Review tasks
// ---------------------------------------------------------------------------

export async function insertReviewTask(input: {
  contentItemId: string;
  changeEventId?: string;
  workflowRunId: string;
  proposedVersionId: string;
  baseVersionId?: string;
  status: ReviewStatus;
  evalScores: unknown;
  impact: unknown;
  reasoning: string;
  reviewReason?: unknown;
  confidence: number;
}): Promise<string> {
  const id = newId("task");
  await run(
    db.insert(reviewTasks).values({
      id,
      contentItemId: input.contentItemId,
      changeEventId: input.changeEventId,
      workflowRunId: input.workflowRunId,
      proposedVersionId: input.proposedVersionId,
      baseVersionId: input.baseVersionId,
      status: input.status,
      evalScores: encodeJson(input.evalScores) as string,
      impact: encodeJson(input.impact) as string,
      reasoning: input.reasoning,
      reviewReason: encodeJson(input.reviewReason) as string,
      confidence: input.confidence,
    }),
  );
  return id;
}

export interface ReviewTaskRow {
  task: typeof reviewTasks.$inferSelect;
  item: ContentItem;
}

export async function listReviewTasks(
  status?: ReviewStatus,
): Promise<ReviewTaskRow[]> {
  const taskRows = await rows<typeof reviewTasks.$inferSelect>(
    db
      .select()
      .from(reviewTasks)
      .where(status ? eq(reviewTasks.status, status) : undefined)
      .orderBy(desc(reviewTasks.createdAt)),
  );
  const result: ReviewTaskRow[] = [];
  for (const task of taskRows) {
    const item = await getContentItem(task.contentItemId);
    if (item) result.push({ task, item });
  }
  return result;
}

export function getReviewTask(
  id: string,
): Promise<typeof reviewTasks.$inferSelect | undefined> {
  return row<typeof reviewTasks.$inferSelect>(
    db.select().from(reviewTasks).where(eq(reviewTasks.id, id)),
  );
}

export interface ReviewTaskDetail {
  task: typeof reviewTasks.$inferSelect;
  item: ContentItem;
  /** The version the proposal should be diffed against (stable across promotion). */
  baseVersion?: ContentVersion;
  proposedVersion?: ContentVersion;
  changeEvent?: ChangeEvent;
  runSteps: RunStep[];
  topicSlugs: string[];
}

export async function getReviewTaskDetail(
  id: string,
): Promise<ReviewTaskDetail | undefined> {
  const task = await getReviewTask(id);
  if (!task) return undefined;
  const item = await getContentItem(task.contentItemId);
  if (!item) return undefined;
  // Prefer the explicit base version; fall back to the item's current version
  // (covers older tasks created before base_version_id existed).
  const baseVersionId = task.baseVersionId ?? item.currentVersionId;
  return {
    task,
    item,
    baseVersion: baseVersionId
      ? await getContentVersion(baseVersionId)
      : undefined,
    proposedVersion: task.proposedVersionId
      ? await getContentVersion(task.proposedVersionId)
      : undefined,
    changeEvent: task.changeEventId
      ? await getChangeEventById(task.changeEventId)
      : undefined,
    runSteps: task.workflowRunId ? await getRunSteps(task.workflowRunId) : [],
    topicSlugs: await getTopicSlugsForItem(item.id),
  };
}

export async function updateReviewTask(
  id: string,
  patch: Partial<typeof reviewTasks.$inferInsert>,
): Promise<void> {
  await run(db.update(reviewTasks).set(patch).where(eq(reviewTasks.id, id)));
}

// ---------------------------------------------------------------------------
// Promotion: approve a proposed version → make it live
// ---------------------------------------------------------------------------

/** Flip the live pointer to the proposed version and supersede the old one. */
export async function promoteVersion(
  itemId: string,
  proposedVersionId: string,
): Promise<void> {
  const item = await getContentItem(itemId);
  if (!item) return;
  if (item.currentVersionId && item.currentVersionId !== proposedVersionId) {
    await run(
      db
        .update(contentVersions)
        .set({ status: "superseded" })
        .where(eq(contentVersions.id, item.currentVersionId)),
    );
  }
  await run(
    db
      .update(contentVersions)
      .set({ status: "live" })
      .where(eq(contentVersions.id, proposedVersionId)),
  );
  await run(
    db
      .update(contentItems)
      .set({
        currentVersionId: proposedVersionId,
        status: "fresh",
        confidence: 1,
        lastHealedAt: nowIso(),
      })
      .where(eq(contentItems.id, itemId)),
  );
}

export async function rejectProposedVersion(
  versionId: string,
): Promise<void> {
  await run(
    db
      .update(contentVersions)
      .set({ status: "rejected" })
      .where(eq(contentVersions.id, versionId)),
  );
}

// ---------------------------------------------------------------------------
// Aggregate metrics (dashboard / analytics)
// ---------------------------------------------------------------------------

export async function contentStatusCounts(): Promise<
  Record<ContentStatus, number>
> {
  const statusRows = await rows<{ status: string; count: number }>(
    db
      .select({ status: contentItems.status, count: sql<number>`COUNT(*)` })
      .from(contentItems)
      .groupBy(contentItems.status),
  );
  const base: Record<ContentStatus, number> = {
    fresh: 0,
    stale: 0,
    in_review: 0,
    healing: 0,
  };
  for (const r of statusRows) base[r.status as ContentStatus] = num(r.count);
  return base;
}

export interface DashboardMetrics {
  totalContent: number;
  statusCounts: Record<ContentStatus, number>;
  upToDatePct: number;
  pendingReviews: number;
  recentHeals: number;
  avgConfidence: number;
}

export async function dashboardMetrics(): Promise<DashboardMetrics> {
  const statusCounts = await contentStatusCounts();
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const reviewCounts = await countReviewTasksByStatus();
  const confRow = await row<{ avg: number }>(
    db
      .select({ avg: sql<number>`COALESCE(AVG(${contentItems.confidence}), 0)` })
      .from(contentItems),
  );
  const healedRow = await row<{ count: number }>(
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(contentItems)
      .where(sql`${contentItems.lastHealedAt} IS NOT NULL`),
  );

  return {
    totalContent: total,
    statusCounts,
    upToDatePct: total === 0 ? 0 : statusCounts.fresh / total,
    pendingReviews: reviewCounts.needs_human ?? 0,
    recentHeals: num(healedRow?.count),
    avgConfidence: Math.round(num(confRow?.avg) * 100) / 100,
  };
}

export async function countReviewTasksByStatus(): Promise<
  Record<string, number>
> {
  const statusRows = await rows<{ status: string; count: number }>(
    db
      .select({ status: reviewTasks.status, count: sql<number>`COUNT(*)` })
      .from(reviewTasks)
      .groupBy(reviewTasks.status),
  );
  return Object.fromEntries(statusRows.map((r) => [r.status, num(r.count)]));
}
