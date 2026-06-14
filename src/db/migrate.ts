/**
 * Applies generated Drizzle migrations to the SQLite database.
 * Run via `npm run db:migrate` (invoked automatically by the seed script).
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db, sqliteConnection } from "./client";

export function runMigrations(): void {
  migrate(db, { migrationsFolder: "./drizzle" });
}

// Allow direct execution: `tsx src/db/migrate.ts`
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations();
  sqliteConnection.close();
  console.log("✅ Migrations applied.");
}
