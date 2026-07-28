/**
 * Pre-Construction rollup — the single computation behind the health endpoint,
 * the Executive OS portfolio cards, and the Mobilization soft gate.
 *
 * Same reason as projectSetupRollup for living outside routes.ts: three callers
 * need this math and two copies would eventually disagree about whether a
 * project is ready to mobilize. The math itself lives in
 * pre-construction-health.ts so it can be used without a database.
 */
import { storage } from "./storage";
import { computePreConstructionHealth, type PreConstructionHealth } from "./pre-construction-health";

export type { PreConstructionHealth };

export async function preConstructionRollup(projectId: number): Promise<PreConstructionHealth> {
  return computePreConstructionHealth(await storage.getPreConstructionBundle(projectId));
}
