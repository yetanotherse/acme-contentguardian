/**
 * Embeddings + similarity utilities.
 *
 * REAL mode  : Gemini gemini-embedding-001 vectors.
 * MOCK mode  : deterministic feature-hashing embeddings (MOCK_EMBED_DIM) seeded
 *              purely by token content → identical vectors on every run, so the
 *              demo's impact analysis is fully reproducible.
 *
 * All vectors are stored as JSON TEXT and compared with `cosineSimilarity` in
 * TypeScript. In production these become pgvector columns and similarity moves
 * into the database (`<=>`). Because a single DB is seeded under one mode, every
 * stored vector shares the same space — switching modes requires a re-seed.
 */
import { embed, embedMany } from "ai";

import {
  EMBEDDING_DIM,
  embeddingProviderOptions,
  getEmbeddingModel,
  isMockMode,
} from "./providers";

/** Cosine similarity of two equal-length vectors. Returns 0 for degenerate input. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function serializeEmbedding(vector: number[]): string {
  return JSON.stringify(vector);
}

export function parseEmbedding(json: string | null): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Deterministic feature-hashing embedding (MOCK mode)
// ---------------------------------------------------------------------------

/** Stable 32-bit string hash (FNV-1a). */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Bag-of-words feature hashing into a fixed-dim L2-normalized vector. Documents
 * sharing vocabulary land close in cosine space — good enough to drive impact
 * analysis recall in the demo, and fully deterministic.
 */
export function hashEmbedding(text: string, dim = EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dim).fill(0);
  for (const token of tokenize(text)) {
    const h = fnv1a(token);
    const bucket = h % dim;
    const sign = (h >>> 31) & 1 ? 1 : -1;
    vector[bucket] += sign;
  }
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

// ---------------------------------------------------------------------------
// Public embedding API (mode-aware)
// ---------------------------------------------------------------------------

export async function embedText(text: string): Promise<number[]> {
  if (isMockMode()) return hashEmbedding(text);
  const { embedding } = await embed({
    model: getEmbeddingModel(),
    value: text,
    providerOptions: embeddingProviderOptions,
  });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (isMockMode()) return texts.map((t) => hashEmbedding(t));
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts,
    providerOptions: embeddingProviderOptions,
  });
  return embeddings;
}
