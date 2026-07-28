/**
 * Pre-Construction rollup — the single computation behind the health endpoint,
 * the Executive OS portfolio cards, and the Mobilization soft gate.
 *
 * Same reason as projectSetupRollup for living outside routes.ts: three callers
 * need this math and two copies would eventually disagree about whether a
 * project is ready to mobilize.
 */
import { storage } from "./storage";
import { CRITICAL_PERMIT_TYPES } from "@shared/pre-construction-catalog";

export type PreConstructionHealth = {
  seeded: boolean;
  status: string;
  designPhase: string | null;
  designCompletionPercent: number | null;
  permitsIssued: number;
  permitsTotal: number;
  criticalPermitsIssued: number;
  criticalPermitsTotal: number;
  missingCriticalPermits: string[];
  prequalApproved: number;
  prequalTotal: number;
  bidPackagesBoughtOut: number;
  bidPackagesTotal: number;
  longLeadItemsAtRisk: number;
  longLeadItemsTotal: number;
  planApproved: boolean;
  completePct: number;
};

export async function preConstructionRollup(projectId: number): Promise<PreConstructionHealth> {
  const { preCon, permits, prequalSubs, bidPackages, longLeadItems } =
    await storage.getPreConstructionBundle(projectId);

  const criticalPermits = permits.filter((p) => CRITICAL_PERMIT_TYPES.includes(p.permitType ?? ""));
  const criticalPermitsIssued = criticalPermits.filter((p) => p.status === "issued").length;

  // Every critical type with no issued row — including types nobody has created
  // a permit row for yet, since an untracked permit is still a missing permit.
  const issuedTypes = new Set(permits.filter((p) => p.status === "issued").map((p) => p.permitType));
  const missingCriticalPermits = CRITICAL_PERMIT_TYPES.filter((t) => !issuedTypes.has(t));

  const bidPackagesBoughtOut = bidPackages.filter(
    (b) => b.status === "awarded" || b.status === "contract_executed",
  ).length;
  const planApproved = !!preCon?.preconPlanApprovedAt;

  // Equal-weight thirds. A dimension with nothing tracked counts as satisfied
  // rather than as zero, so an empty module doesn't read as 0% forever.
  const critical = criticalPermits.length ? criticalPermitsIssued / criticalPermits.length : 1;
  const buyout = bidPackages.length ? bidPackagesBoughtOut / bidPackages.length : 1;
  const plan = planApproved ? 1 : 0;

  return {
    seeded: preCon != null,
    status: preCon?.status ?? "in_progress",
    designPhase: preCon?.designPhase ?? null,
    designCompletionPercent: preCon?.designCompletionPercent ?? null,
    permitsIssued: permits.filter((p) => p.status === "issued").length,
    permitsTotal: permits.length,
    criticalPermitsIssued,
    criticalPermitsTotal: criticalPermits.length,
    missingCriticalPermits,
    prequalApproved: prequalSubs.filter(
      (s) => s.prequalStatus === "approved" || s.prequalStatus === "conditionally_approved",
    ).length,
    prequalTotal: prequalSubs.length,
    bidPackagesBoughtOut,
    bidPackagesTotal: bidPackages.length,
    longLeadItemsAtRisk: longLeadItems.filter((l) => l.status === "at_risk").length,
    longLeadItemsTotal: longLeadItems.length,
    planApproved,
    completePct: Math.round(((critical + buyout + plan) / 3) * 100),
  };
}
