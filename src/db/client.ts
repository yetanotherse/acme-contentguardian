/**
 * SQLite (better-sqlite3) + Drizzle client.
 *
 * A single connection is reused across the process. The DB file path is
 * configurable via DATABASE_PATH (defaults to ./contentguardian.db at the repo
 * root) so the same code works in scripts, tests, and the Next.js server.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "node:path";

import * as schema from "./schema";

const DB_PATH =
  process.env.DATABASE_PATH ??
  path.join(process.cwd(), "contentguardian.db");

// Reuse the connection in dev to survive Next.js hot-reloads.
const globalForDb = globalThis as unknown as {
  __cg_sqlite?: Database.Database;
};

const sqlite =
  globalForDb.__cg_sqlite ??
  (() => {
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    return db;
  })();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__cg_sqlite = sqlite;
}

export const sqliteConnection = sqlite;
export const db = drizzle(sqlite, { schema });
export { schema };
export type DB = typeof db;
