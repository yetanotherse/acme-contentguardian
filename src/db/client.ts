/**
 * Database client factory — selects the driver at runtime.
 *
 *   - DATABASE_URL starts with postgres:// or postgresql://  → Postgres
 *     (postgres-js, async) using the pgvector/jsonb schema (schema.pg.ts).
 *   - otherwise (default)                                    → SQLite
 *     (better-sqlite3, sync) using schema.ts — the zero-config local path.
 *
 * The rest of the app imports `{ db, schema, dialect }` and never branches on
 * the database; the sync/async + text/jsonb + text/vector differences are
 * absorbed by the adapters in ./exec.ts.
 *
 * `db` is typed as the better-sqlite3 Drizzle database for build-time ergonomics
 * (the query-builder API is identical across dialects); the Postgres instance is
 * cast to the same type and executed through the exec adapters at runtime.
 */
import Database from 'better-sqlite3';
import {
  drizzle as drizzleSqlite,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'node:path';

import * as sqliteSchema from './schema';
import * as pgSchema from './schema.pg';

export type Dialect = 'sqlite' | 'postgres';

const databaseUrl = process.env.DATABASE_URL?.trim();
const isPostgres = !!databaseUrl && /^postgres(ql)?:\/\//i.test(databaseUrl);

export const dialect: Dialect = isPostgres ? 'postgres' : 'sqlite';

type AppDb = BetterSQLite3Database<typeof sqliteSchema>;

const globalForDb = globalThis as unknown as {
  __cg_sqlite?: Database.Database;
  __cg_postgres?: ReturnType<typeof postgres>;
};

let dbInstance: AppDb;
let rawSqlite: Database.Database | undefined;
let rawPostgres: ReturnType<typeof postgres> | undefined;
let activeSchema: typeof sqliteSchema;

if (isPostgres) {
  // Supabase transaction pooler (pgBouncer) configuration:
  // - `prepare: false`            — pgBouncer transaction mode can't keep prepared statements.
  // - `max`                       — allow several connections so the app's CONCURRENT queries
  //                                 (layout + page render together; pages use Promise.all) don't
  //                                 serialize/stall on a single connection. The pooler is built
  //                                 to multiplex many client connections. Override via DB_POOL_MAX.
  // - `connect_timeout`           — fail fast (thrown error → error boundary) instead of an
  //                                 infinite "loading forever" spinner if the DB is unreachable.
  // - `idle_timeout`/`max_lifetime` — recycle idle/long-lived connections (serverless-friendly).
  // - `fetch_types: false`        — skip startup type-introspection round-trips through the pooler
  //                                 (embeddings read back as text via fromDbEmbedding; jsonb is built-in).
  rawPostgres =
    globalForDb.__cg_postgres ??
    postgres(databaseUrl!, {
      prepare: false,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      connect_timeout: 15,
      idle_timeout: 20,
      max_lifetime: 60 * 30,
      fetch_types: false,
      onnotice: (notice) => console.warn('[pg notice]', notice.message),
    });
  // Cache the pool on the global in ALL environments so warm serverless
  // invocations reuse one pool instead of churning connections.
  globalForDb.__cg_postgres = rawPostgres;
  dbInstance = drizzlePostgres(rawPostgres, {
    schema: pgSchema,
  }) as unknown as AppDb;
  activeSchema = pgSchema as unknown as typeof sqliteSchema;
} else {
  const DB_PATH =
    process.env.DATABASE_PATH ?? path.join(process.cwd(), 'contentguardian.db');
  rawSqlite =
    globalForDb.__cg_sqlite ??
    (() => {
      const d = new Database(DB_PATH);
      d.pragma('journal_mode = WAL');
      d.pragma('foreign_keys = ON');
      return d;
    })();
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.__cg_sqlite = rawSqlite;
  }
  dbInstance = drizzleSqlite(rawSqlite, { schema: sqliteSchema });
  activeSchema = sqliteSchema;
}

export const db = dbInstance;
export const schema = activeSchema;
export { rawSqlite, rawPostgres };
export type DB = typeof db;

/** Close the active connection (for CLI scripts). */
export async function closeDb(): Promise<void> {
  if (rawSqlite) rawSqlite.close();
  if (rawPostgres) await rawPostgres.end();
}
