/**
 * Resets the database to the initial seeded demo state.
 * Used by `npm run db:reset` and the in-app "Reset Demo" button (/api/demo/reset).
 */
import { sqliteConnection } from "./client";
import { seedDatabase } from "./seed";

if (process.argv[1] && process.argv[1].endsWith("reset.ts")) {
  seedDatabase()
    .then(() => {
      sqliteConnection.close();
      console.log("✅ Demo reset to initial seeded state.");
    })
    .catch((err) => {
      console.error("❌ Reset failed:", err);
      process.exit(1);
    });
}
