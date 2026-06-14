/**
 * Dialect adapters that let the query layer be written once.
 *
 * Execution: better-sqlite3 is synchronous (`.all/.get/.run`); postgres-js query
 * builders are awaited. `rows/row/run` normalize both to Promises.
 *
 * Encoding: JSON columns are `text` in SQLite (we store/parse strings) and
 * `jsonb` in Postgres (Drizzle returns/accepts objects). Embeddings are `text`
 * JSON in SQLite and `vector` in Postgres. The encodeJson/decodeJson and
 * toDbEmbedding/fromDbEmbedding helpers bridge those so callers always work
 * with plain JS values.
 */
import { dialect } from "./client";

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

interface SyncSelect<T> {
  all: () => T[];
  get: () => T | undefined;
}
interface SyncRun {
  run: () => unknown;
}

/** Set DB_DEBUG=1 to log every query's SQL + duration to the server console
 * (visible in `next dev` and Vercel function logs) — useful for pinpointing a
 * slow or hanging query. No-op (zero overhead) when unset. */
const DB_DEBUG = !!process.env.DB_DEBUG;

function sqlLabel(qb: unknown): string {
  try {
    const sql = (qb as { toSQL?: () => { sql: string } }).toSQL?.().sql;
    return sql ? sql.replace(/\s+/g, " ").slice(0, 100) : "query";
  } catch {
    return "query";
  }
}

async function timed<T>(qb: unknown, exec: () => Promise<T>): Promise<T> {
  if (!DB_DEBUG) return exec();
  const start = Date.now();
  const label = sqlLabel(qb);
  try {
    const result = await exec();
    console.log(`[db ${dialect}] ${Date.now() - start}ms · ${label}`);
    return result;
  } catch (error) {
    console.error(`[db ${dialect}] FAILED ${Date.now() - start}ms · ${label}`, error);
    throw error;
  }
}

export function rows<T>(qb: unknown): Promise<T[]> {
  return timed(qb, async () => {
    if (dialect === "sqlite") return (qb as SyncSelect<T>).all();
    return (await (qb as Promise<T[]>)) ?? [];
  });
}

export function row<T>(qb: unknown): Promise<T | undefined> {
  return timed(qb, async () => {
    if (dialect === "sqlite") return (qb as SyncSelect<T>).get();
    const result = (await (qb as Promise<T[]>)) ?? [];
    return result[0];
  });
}

export function run(qb: unknown): Promise<void> {
  return timed(qb, async () => {
    if (dialect === "sqlite") {
      (qb as SyncRun).run();
      return;
    }
    await (qb as Promise<unknown>);
  });
}

// ---------------------------------------------------------------------------
// JSON columns (text in SQLite, jsonb in Postgres)
// ---------------------------------------------------------------------------

/** Prepare a JS value for a JSON column. */
export function encodeJson(value: unknown): unknown {
  if (dialect === "sqlite") return JSON.stringify(value ?? {});
  return value ?? {};
}

/** Read a JSON column back into a JS value, regardless of dialect. */
export function decodeJson<T = Record<string, unknown>>(value: unknown): T {
  if (value == null) return {} as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return {} as T;
    }
  }
  return value as T;
}

// ---------------------------------------------------------------------------
// Embedding columns (text JSON in SQLite, vector in Postgres)
// ---------------------------------------------------------------------------

/**
 * Prepare a vector for an embedding column. Returns a JSON string for SQLite
 * `text` and the raw `number[]` for the Postgres `vector` column. The return is
 * typed `string` because the shared `db`/`schema` are typed against the SQLite
 * schema (text); the pgvector driver accepts the array at runtime.
 */
export function toDbEmbedding(vector: number[]): string {
  return (
    dialect === "sqlite" ? JSON.stringify(vector) : vector
  ) as unknown as string;
}

/** Read an embedding column back into a number[] regardless of dialect. */
export function fromDbEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as number[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
