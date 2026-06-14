import { randomUUID } from "node:crypto";

/** Generate a prefixed, sortable-enough id (e.g. `cv_a1b2c3d4`). */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** ISO-8601 UTC timestamp matching the SQLite default column format. */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, (m) => m);
}
