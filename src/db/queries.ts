/**
 * Typed query helpers over the Drizzle client. Centralizes all DB access used by
 * the Mastra workflows, API routes, and UI server components.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { parseEmbedding } from "@/lib/embeddings";
import { newId } from "@/lib/ids";

import { db, schema } from "./client";
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

// ---------------------------------------------------------------------------
// Sources & versions
// ---------------------------------------------------------------------------

export function listSources(): Source[] {
  return db.select().from(sources).all();
}

export function getSourceVersions(sourceId: string): SourceVersion[] {
  return db
    .select()
    .from(sourceVersions)
    .where(eq(sourceVersions.sourceId, sourceId))
    .orderBy(desc(sourceVersions.version))
    .all();
}

export function getLatestSourceVersion(
  sourceId: string,
): SourceVersion | undefined {
  return getSourceVersions(sourceId)[0];
}

export function getSourceVersionById(
  id: string,
): SourceVersion | undefined {
  return db
    .select()
    .from(sourceVersions)
    .where(eq(sourceVersions.id, id))
    .get();
}

export function getSourceVersionsByIds(ids: string[]): SourceVersion[] {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(sourceVersions)
    .where(inArray(sourceVersions.id, ids))
    .all();
}

export function insertSourceVersion(input: {
  id: string;
  sourceId: string;
  version: number;
  title: string;
  body: string;
  embedding: string;
}): void {
  db.insert(sourceVersions).values(input).run();
}

export function listSourceVersions(): (SourceVersion & {
  sourceName: string;
})[] {
  return db
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
    .orderBy(desc(sourceVersions.createdAt))
    .all();
}

// ---------------------------------------------------------------------------
// Change events
// ---------------------------------------------------------------------------

export function insertChangeEvent(input: {
  sourceVersionId: string;
  changeType: ChangeType;
  summary: string;
  detail: string;
  severity: number;
  affectedTopics: string[];
}): ChangeEvent {
  const row = {
    id: newId("ce"),
    sourceVersionId: input.sourceVersionId,
    changeType: input.changeType,
    summary: input.summary,
    detail: input.detail,
    severity: input.severity,
    affectedTopics: JSON.stringify(input.affectedTopics),
  };
  db.insert(changeEvents).values(row).run();
  return db.select().from(changeEvents).where(eq(changeEvents.id, row.id)).get()!;
}

export function getChangeEventsForVersions(
  versionIds: string[],
): ChangeEvent[] {
  if (versionIds.length === 0) return [];
  return db
    .select()
    .from(changeEvents)
    .where(inArray(changeEvents.sourceVersionId, versionIds))
    .all();
}

export function recentChangeEvents(limit = 20): (ChangeEvent & {
  sourceVersionTitle: string;
})[] {
  return db
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
    .limit(limit)
    .all();
}

// ---------------------------------------------------------------------------
// Topics (knowledge graph)
// ---------------------------------------------------------------------------

export function listTopics(): Topic[] {
  return db.select().from(topics).all();
}

/** Count of content items linked to each topic id. */
export function contentCountByTopic(): Record<string, number> {
  const rows = db
    .select({
      topicId: contentTopics.topicId,
      count: sql<number>`COUNT(*)`,
    })
    .from(contentTopics)
    .groupBy(contentTopics.topicId)
    .all();
  return Object.fromEntries(rows.map((r) => [r.topicId, r.count]));
}

/** Content items (with title/type/status) linked to a topic id. */
export function contentItemsForTopic(topicId: string): ContentItem[] {
  return db
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
    .where(eq(contentTopics.topicId, topicId))
    .all();
}

export function getTopicsBySlugs(slugs: string[]): Topic[] {
  if (slugs.length === 0) return [];
  return db.select().from(topics).where(inArray(topics.slug, slugs)).all();
}

/** Topic subtree (the matched topics plus their direct children) for grounding. */
export function getTopicContext(slugs: string[]): Topic[] {
  const matched = getTopicsBySlugs(slugs);
  if (matched.length === 0) return [];
  const ids = matched.map((t) => t.id);
  const children = db
    .select()
    .from(topics)
    .where(inArray(topics.parentId, ids))
    .all();
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
export function getContentCandidates(): ContentCandidate[] {
  const items = db.select().from(contentItems).all();
  return items
    .map((item): ContentCandidate | null => {
      if (!item.currentVersionId) return null;
      const version = db
        .select()
        .from(contentVersions)
        .where(eq(contentVersions.id, item.currentVersionId))
        .get();
      if (!version) return null;
      const slugs = db
        .select({ slug: topics.slug })
        .from(contentTopics)
        .innerJoin(topics, eq(topics.id, contentTopics.topicId))
        .where(eq(contentTopics.contentItemId, item.id))
        .all()
        .map((r) => r.slug);
      return {
        item,
        version,
        embedding: parseEmbedding(version.embedding),
        topicSlugs: slugs,
      };
    })
    .filter((c): c is ContentCandidate => c !== null);
}

export function getContentItem(id: string): ContentItem | undefined {
  return db.select().from(contentItems).where(eq(contentItems.id, id)).get();
}

export function getContentVersion(id: string): ContentVersion | undefined {
  return db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, id))
    .get();
}

export function getContentVersions(itemId: string): ContentVersion[] {
  return db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.contentItemId, itemId))
    .orderBy(desc(contentVersions.version))
    .all();
}

export function getTopicSlugsForItem(itemId: string): string[] {
  return db
    .select({ slug: topics.slug })
    .from(contentTopics)
    .innerJoin(topics, eq(topics.id, contentTopics.topicId))
    .where(eq(contentTopics.contentItemId, itemId))
    .all()
    .map((r) => r.slug);
}

export function nextContentVersionNumber(itemId: string): number {
  const row = db
    .select({ max: sql<number>`COALESCE(MAX(${contentVersions.version}), 0)` })
    .from(contentVersions)
    .where(eq(contentVersions.contentItemId, itemId))
    .get();
  return (row?.max ?? 0) + 1;
}

export function insertProposedVersion(input: {
  contentItemId: string;
  version: number;
  bodyJson: string;
  embedding: string;
  sourceVersionIds: string[];
  kgSnapshot: unknown;
  agentContext: unknown;
}): string {
  const id = newId("cv");
  db.insert(contentVersions)
    .values({
      id,
      contentItemId: input.contentItemId,
      version: input.version,
      bodyJson: input.bodyJson,
      embedding: input.embedding,
      sourceVersionIds: JSON.stringify(input.sourceVersionIds),
      kgSnapshot: JSON.stringify(input.kgSnapshot),
      agentContext: JSON.stringify(input.agentContext),
      status: "proposed",
    })
    .run();
  return id;
}

export function updateContentVersionBody(
  versionId: string,
  bodyJson: string,
  embedding: string,
  agentContext?: unknown,
): void {
  const patch: Partial<typeof contentVersions.$inferInsert> = {
    bodyJson,
    embedding,
  };
  if (agentContext !== undefined) {
    patch.agentContext = JSON.stringify(agentContext);
  }
  db.update(contentVersions)
    .set(patch)
    .where(eq(contentVersions.id, versionId))
    .run();
}

export function setContentItemStatus(
  itemId: string,
  status: ContentStatus,
): void {
  db.update(contentItems)
    .set({ status })
    .where(eq(contentItems.id, itemId))
    .run();
}

/** Item ids linked to any of the given topic slugs (via the join table). */
export function getContentItemIdsByTopics(slugs: string[]): string[] {
  if (slugs.length === 0) return [];
  const rows = db
    .selectDistinct({ id: contentTopics.contentItemId })
    .from(contentTopics)
    .innerJoin(topics, eq(topics.id, contentTopics.topicId))
    .where(inArray(topics.slug, slugs))
    .all();
  return rows.map((r) => r.id);
}

/** Mark content linked to the given topics as stale and lower its confidence. */
export function markStaleByTopics(slugs: string[], confidence = 0.4): number {
  const ids = getContentItemIdsByTopics(slugs);
  for (const id of ids) {
    db.update(contentItems)
      .set({ status: "stale", confidence })
      .where(and(eq(contentItems.id, id), eq(contentItems.status, "fresh")))
      .run();
  }
  return ids.length;
}

// ---------------------------------------------------------------------------
// Workflow runs + step traces
// ---------------------------------------------------------------------------

export function createWorkflowRun(input: {
  kind: WorkflowKind;
  input: unknown;
}): string {
  const id = newId("run");
  db.insert(workflowRuns)
    .values({
      id,
      kind: input.kind,
      status: "running",
      inputJson: JSON.stringify(input.input ?? {}),
    })
    .run();
  return id;
}

export function finishWorkflowRun(
  id: string,
  status: WorkflowStatus,
  summary: unknown,
): void {
  db.update(workflowRuns)
    .set({
      status,
      summaryJson: JSON.stringify(summary ?? {}),
      finishedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .where(eq(workflowRuns.id, id))
    .run();
}

export function addRunStep(input: {
  workflowRunId: string;
  agent: string;
  step: string;
  status?: RunStepStatus;
  input?: unknown;
  output?: unknown;
  reasoning?: string;
  seq: number;
  durationMs?: number;
}): void {
  db.insert(runSteps)
    .values({
      id: newId("step"),
      workflowRunId: input.workflowRunId,
      agent: input.agent,
      step: input.step,
      status: input.status ?? "ok",
      inputJson: JSON.stringify(input.input ?? {}),
      outputJson: JSON.stringify(input.output ?? {}),
      reasoning: input.reasoning ?? "",
      seq: input.seq,
      durationMs: input.durationMs,
    })
    .run();
}

export function listWorkflowRuns(limit = 30): WorkflowRun[] {
  return db
    .select()
    .from(workflowRuns)
    .orderBy(desc(workflowRuns.startedAt))
    .limit(limit)
    .all();
}

export function getWorkflowRun(id: string): WorkflowRun | undefined {
  return db.select().from(workflowRuns).where(eq(workflowRuns.id, id)).get();
}

export function getRunSteps(runId: string): RunStep[] {
  return db
    .select()
    .from(runSteps)
    .where(eq(runSteps.workflowRunId, runId))
    .orderBy(runSteps.seq)
    .all();
}

// ---------------------------------------------------------------------------
// Review tasks
// ---------------------------------------------------------------------------

export function insertReviewTask(input: {
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
}): string {
  const id = newId("task");
  db.insert(reviewTasks)
    .values({
      id,
      contentItemId: input.contentItemId,
      changeEventId: input.changeEventId,
      workflowRunId: input.workflowRunId,
      proposedVersionId: input.proposedVersionId,
      baseVersionId: input.baseVersionId,
      status: input.status,
      evalScores: JSON.stringify(input.evalScores ?? {}),
      impact: JSON.stringify(input.impact ?? {}),
      reasoning: input.reasoning,
      reviewReason: JSON.stringify(input.reviewReason ?? {}),
      confidence: input.confidence,
    })
    .run();
  return id;
}

export interface ReviewTaskRow {
  task: typeof reviewTasks.$inferSelect;
  item: ContentItem;
}

export function listReviewTasks(status?: ReviewStatus): ReviewTaskRow[] {
  const rows = db
    .select()
    .from(reviewTasks)
    .where(status ? eq(reviewTasks.status, status) : undefined)
    .orderBy(desc(reviewTasks.createdAt))
    .all();
  return rows
    .map((task): ReviewTaskRow | null => {
      const item = getContentItem(task.contentItemId);
      return item ? { task, item } : null;
    })
    .filter((r): r is ReviewTaskRow => r !== null);
}

export function getReviewTask(
  id: string,
): typeof reviewTasks.$inferSelect | undefined {
  return db.select().from(reviewTasks).where(eq(reviewTasks.id, id)).get();
}

export function getChangeEventById(id: string): ChangeEvent | undefined {
  return db.select().from(changeEvents).where(eq(changeEvents.id, id)).get();
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

export function getReviewTaskDetail(
  id: string,
): ReviewTaskDetail | undefined {
  const task = getReviewTask(id);
  if (!task) return undefined;
  const item = getContentItem(task.contentItemId);
  if (!item) return undefined;
  // Prefer the explicit base version; fall back to the item's current version
  // (covers older tasks created before base_version_id existed).
  const baseVersionId = task.baseVersionId ?? item.currentVersionId;
  return {
    task,
    item,
    baseVersion: baseVersionId
      ? getContentVersion(baseVersionId)
      : undefined,
    proposedVersion: task.proposedVersionId
      ? getContentVersion(task.proposedVersionId)
      : undefined,
    changeEvent: task.changeEventId
      ? getChangeEventById(task.changeEventId)
      : undefined,
    runSteps: task.workflowRunId ? getRunSteps(task.workflowRunId) : [],
    topicSlugs: getTopicSlugsForItem(item.id),
  };
}

export function updateReviewTask(
  id: string,
  patch: Partial<typeof reviewTasks.$inferInsert>,
): void {
  db.update(reviewTasks).set(patch).where(eq(reviewTasks.id, id)).run();
}

// ---------------------------------------------------------------------------
// Promotion: approve a proposed version → make it live
// ---------------------------------------------------------------------------

/** Flip the live pointer to the proposed version and supersede the old one. */
export function promoteVersion(
  itemId: string,
  proposedVersionId: string,
): void {
  const item = getContentItem(itemId);
  if (!item) return;
  if (item.currentVersionId && item.currentVersionId !== proposedVersionId) {
    db.update(contentVersions)
      .set({ status: "superseded" })
      .where(eq(contentVersions.id, item.currentVersionId))
      .run();
  }
  db.update(contentVersions)
    .set({ status: "live" })
    .where(eq(contentVersions.id, proposedVersionId))
    .run();
  db.update(contentItems)
    .set({
      currentVersionId: proposedVersionId,
      status: "fresh",
      confidence: 1,
      lastHealedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .where(eq(contentItems.id, itemId))
    .run();
}

export function rejectProposedVersion(versionId: string): void {
  db.update(contentVersions)
    .set({ status: "rejected" })
    .where(eq(contentVersions.id, versionId))
    .run();
}

// ---------------------------------------------------------------------------
// Aggregate metrics (dashboard / analytics)
// ---------------------------------------------------------------------------

export function contentStatusCounts(): Record<ContentStatus, number> {
  const rows = db
    .select({
      status: contentItems.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(contentItems)
    .groupBy(contentItems.status)
    .all();
  const base: Record<ContentStatus, number> = {
    fresh: 0,
    stale: 0,
    in_review: 0,
    healing: 0,
  };
  for (const r of rows) base[r.status as ContentStatus] = r.count;
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

export function dashboardMetrics(): DashboardMetrics {
  const statusCounts = contentStatusCounts();
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const reviewCounts = countReviewTasksByStatus();
  const confRow = db
    .select({ avg: sql<number>`COALESCE(AVG(${contentItems.confidence}), 0)` })
    .from(contentItems)
    .get();
  const healedRow = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(contentItems)
    .where(sql`${contentItems.lastHealedAt} IS NOT NULL`)
    .get();

  return {
    totalContent: total,
    statusCounts,
    upToDatePct: total === 0 ? 0 : statusCounts.fresh / total,
    pendingReviews: reviewCounts.needs_human ?? 0,
    recentHeals: healedRow?.count ?? 0,
    avgConfidence: Math.round((confRow?.avg ?? 0) * 100) / 100,
  };
}

export function countReviewTasksByStatus(): Record<string, number> {
  const rows = db
    .select({
      status: reviewTasks.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(reviewTasks)
    .groupBy(reviewTasks.status)
    .all();
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
