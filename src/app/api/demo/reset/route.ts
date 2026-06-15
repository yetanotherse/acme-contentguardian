import { fail, ok } from "@/lib/api";
import { seedDatabase } from "@/db/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/demo/reset — restore the database to the initial seeded state.
 * Runs WITHOUT migrations: the schema already exists (applied at deploy via
 * `npm run db:migrate:pg`), and the drizzle migration files aren't bundled into
 * the serverless function. Reset only clears + re-inserts data.
 */
export async function POST() {
  try {
    await seedDatabase({ migrate: false });
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
