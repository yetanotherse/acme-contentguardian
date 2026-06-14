import { defineConfig } from "drizzle-kit";

/**
 * Postgres (Supabase) migration config. Used by `npm run db:generate:pg` and
 * `npm run db:migrate:pg`. Migrations are generated/applied against the DIRECT
 * connection (`DIRECT_URL`, port 5432) — not the transaction pooler — because
 * DDL and prepared statements aren't supported through pgBouncer.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.pg.ts",
  out: "./drizzle/postgres",
  dbCredentials: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/contentguardian",
  },
});
