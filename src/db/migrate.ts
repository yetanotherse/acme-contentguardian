/**
 * Applies generated Drizzle migrations to the active database.
 * Dialect-aware: SQLite migrations live in ./drizzle, Postgres in ./drizzle/postgres.
 * Run via `npm run db:migrate` (also invoked automatically by the seed script).
 */
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { migrate as migrateSqlite } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";

import { closeDb, dialect, rawPostgres, rawSqlite } from "./client";

export async function runMigrations(): Promise<void> {
  if (dialect === "postgres") {
    await migratePostgres(drizzlePostgres(rawPostgres!), {
      migrationsFolder: "./drizzle/postgres",
    });
  } else {
    migrateSqlite(drizzleSqlite(rawSqlite!), { migrationsFolder: "./drizzle" });
  }
}

// Allow direct execution: `tsx src/db/migrate.ts`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(async () => {
      await closeDb();
      console.log(`✅ Migrations applied (${dialect}).`);
    })
    .catch((err) => {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    });
}
