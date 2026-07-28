/**
 * The Pre-Construction health math, over rows rather than a project id.
 *
 * Split from pre-construction-rollup.ts so callers that already hold the bundle
 * — the report fixture harness in particular — can compute health without
 * importing the storage layer and its database connection.
 */
import { CRITICAL_PERMIT_TYPES } from "@shared/pre-construction-catalog";
import type {
  PreConstruction, PreConstructionPermit, PreConstructionPrequalSub,
  PreConstructionBidPackage, PreConstructionLongLeadItem,
} from "@shared/schema";

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

export function computePreConstructionHealth({
  preCon, permits, prequalSubs, bidPackages, longLeadItems,
}: {
  preCon: PreConstruction | null;
  permits: PreConstructionPermit[];
  prequalSubs: PreConstructionPrequalSub[];
  bidPackages: PreConstructionBidPackage[];
  longLeadItems: PreConstructionLongLeadItem[];
}): PreConstructionHealth {
  const criticalPermits = permits.filter((p) => CRITICAL_PERMIT_TYPES.includes(p.permitType ?? ""));
  const criticalPermitsIssued = criticalPermits.filter((p) => p.status === "issued").length;

  // Every critical type with no issued row — including types nobody has created
  // a permit row for yet, since an untracked permit is still a missing permit.
  const issuedTypes = new Set(permits.filter((p) => p.status === "issued").map((p) => p.permitType));
  // Suppress the "missing" list when no permits have been added yet — otherwise a fresh project shows all critical permits as missing before the user has done anything.
  const missingCriticalPermits = permits.length
    ? CRITICAL_PERMIT_TYPES.filter((t) => !issuedTypes.has(t))
    : [];

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
