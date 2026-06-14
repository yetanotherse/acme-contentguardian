/**
 * Full healing scan — runs the same detect → impact → regenerate → evaluate →
 * triage pipeline across the whole library, recorded as a `full_scan` run. In
 * the demo this finds drift introduced by the latest source versions.
 */
import { runHealing, type HealingSummary } from "./healing";

export async function runFullScan(): Promise<HealingSummary> {
  return runHealing("full_scan");
}
