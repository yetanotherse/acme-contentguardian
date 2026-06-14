/**
 * Mastra tools available to the agents (used in REAL mode; in MOCK mode the
 * scripted scenario stands in for the whole agent call). Each tool reads from
 * the live database so agents reason over real content + knowledge graph.
 */
import { createTool } from "@mastra/core/tools";
import { diffLines } from "diff";
import { z } from "zod";

import { cosineSimilarity, embedText } from "@/lib/embeddings";
import {
  getContentCandidates,
  getTopicContext,
} from "@/db/queries";
import { bodyToText, parseBody } from "@/lib/content-types";

export const fetchKGContextTool = createTool({
  id: "fetch-kg-context",
  description:
    "Fetch knowledge-graph topic descriptions (and their child topics) by slug, to ground content generation.",
  inputSchema: z.object({
    topicSlugs: z.array(z.string()),
  }),
  outputSchema: z.object({
    topics: z.array(
      z.object({
        slug: z.string(),
        name: z.string(),
        description: z.string(),
      }),
    ),
  }),
  execute: async ({ topicSlugs }) => {
    const topics = getTopicContext(topicSlugs).map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
    }));
    return { topics };
  },
});

export const findAffectedContentTool = createTool({
  id: "find-affected-content",
  description:
    "Find content items most likely affected by a change, ranked by semantic similarity to the change text and by knowledge-graph topic overlap.",
  inputSchema: z.object({
    changeText: z.string(),
    topicSlugs: z.array(z.string()),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  outputSchema: z.object({
    candidates: z.array(
      z.object({
        contentItemId: z.string(),
        title: z.string(),
        similarity: z.number(),
        topicMatch: z.boolean(),
      }),
    ),
  }),
  execute: async ({ changeText, topicSlugs, limit }) => {
    const queryEmbedding = await embedText(changeText);
    const topicSet = new Set(topicSlugs);
    const ranked = getContentCandidates()
      .map((c) => ({
        contentItemId: c.item.id,
        title: c.item.title,
        similarity: cosineSimilarity(queryEmbedding, c.embedding),
        topicMatch: c.topicSlugs.some((s) => topicSet.has(s)),
      }))
      .sort(
        (a, b) =>
          Number(b.topicMatch) - Number(a.topicMatch) ||
          b.similarity - a.similarity,
      )
      .slice(0, limit ?? 10);
    return { candidates: ranked };
  },
});

export const diffSourceTool = createTool({
  id: "diff-source",
  description:
    "Compute a line-level diff between two versions of a source document.",
  inputSchema: z.object({
    oldText: z.string(),
    newText: z.string(),
  }),
  outputSchema: z.object({
    added: z.array(z.string()),
    removed: z.array(z.string()),
  }),
  execute: async ({ oldText, newText }) => {
    const parts = diffLines(oldText, newText);
    const added: string[] = [];
    const removed: string[] = [];
    for (const part of parts) {
      const lines = part.value.split("\n").filter((l) => l.trim().length > 0);
      if (part.added) added.push(...lines);
      else if (part.removed) removed.push(...lines);
    }
    return { added, removed };
  },
});

/** Read a content item's current body as plain text (helper for grounding). */
export function contentBodyText(
  type: "question" | "lesson",
  bodyJson: string,
): string {
  return bodyToText(type, parseBody(bodyJson));
}

export const guardianTools = {
  fetchKGContextTool,
  findAffectedContentTool,
  diffSourceTool,
};
