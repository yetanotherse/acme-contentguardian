import { fail, ok } from "@/lib/api";
import { seedDatabase } from "@/db/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/demo/reset — restore the database to the initial seeded state. */
export async function POST() {
  try {
    await seedDatabase();
    return ok({ reset: true });
  } catch (error) {
    return fail(error);
  }
}
