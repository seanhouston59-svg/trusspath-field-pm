/**
 * Financials rollup — aggregates every financial signal in the app into a
 * single portfolio snapshot for the Executive OS Financials dashboard.
 *
 * There is no dedicated "actuals" or "invoices" table today, so this
 * aggregator pulls what the app actually has:
 *   - projects.budget                         → original approved budget
 *   - projectSetup.originalContractValue      → contract value (text $)
 *   - changeOrders (approved)                 → adds to revised contract
 *   - changeOrders (pending)                  → pending exposure
 *   - preConstructionBidPackages.awardedValueUsd → subcontract commitments
 *   - preConstructionLongLeadItems.poValueUsd    → PO commitments
 *   - preConstructionVeItems.estimatedSavingsUsd → VE savings (accepted only)
 *   - preConstructionDesignRfis.costImpactUsd    → design-RFI cost exposure
 *
 * When "actuals" (pay applications / invoices) become a real table, this
 * module is the single place to wire them in.
 *
 * All USD-in-text columns run through `parseUsd()`, which tolerates commas,
 * dollar signs, negatives, parentheses, and blank/dash placeholders so a
 * bad free-text entry never crashes the rollup.
 */

import type { IStorage } from "./storage/types";
import type { Project, ChangeOrder } from "@shared/schema";

/** Per-project financial snapshot. All amounts in USD. */
export type ProjectFinancials = {
  projectId: number;
  projectName: string;
  // High-level position
  budget: number;                    // projects.budget (source of truth)
  originalContract: number | null;   // projectSetup.originalContractValue if parsed
  approvedChangeOrders: number;      // sum of approved CO amounts
  pendingChangeOrders: number;       // sum of pending CO amounts (exposure)
  revisedContract: number;           // originalContract (or budget) + approved COs
  // Commitments (what we've promised to subs / vendors)
  subcontractCommitments: number;    // sum awardedValueUsd across bid packages
  poCommitments: number;             // sum poValueUsd across long-lead items
  committedCost: number;             // sub + PO
  // Adjustments already accounted for in the plan
  veSavings: number;                 // sum estimatedSavingsUsd on accepted VE items
  designRfiCostExposure: number;     // sum costImpactUsd across open design RFIs
  // Counts, useful for badges
  approvedCoCount: number;
  pendingCoCount: number;
  bidPackageCount: number;
  poCount: number;
  // Derived signal — % of budget already committed. Null when budget is 0.
  committedPct: number | null;
};

export type OrgFinancialTotals = {
  projectCount: number;
  budget: number;
  originalContract: number;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContract: number;
  subcontractCommitments: number;
  poCommitments: number;
  committedCost: number;
  veSavings: number;
  designRfiCostExposure: number;
  approvedCoCount: number;
  pendingCoCount: number;
  bidPackageCount: number;
  poCount: number;
};

export type FinancialsRollup = {
  orgTotals: OrgFinancialTotals;
  projects: ProjectFinancials[];
};

/**
 * Parse a user-entered USD string into a number. Returns 0 (not null) for
 * blanks and dashes so downstream sums treat "missing" as "zero committed"
 * rather than propagating NaN into every derived metric. Handles:
 *   "$1,234,567"     → 1234567
 *   "(4,500.00)"     → -4500
 *   "  — "           → 0
 *   "n/a" / "TBD"    → 0
 *   undefined / null → 0
 */
function parseUsd(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  // Placeholders that clearly mean "no value yet".
  if (/^(—|-|n\/?a|tbd|pending|unknown)$/i.test(s)) return 0;
  // Parenthesized negatives (accounting convention).
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  // Strip common decoration.
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

/** Case-insensitive approved-status check that tolerates leading/trailing whitespace. */
function isApproved(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === "approved";
}
/** Anything that isn't approved and isn't rejected/void counts as pending exposure. */
function isPending(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return !!s && s !== "approved" && s !== "rejected" && s !== "denied" && s !== "void" && s !== "voided" && s !== "cancelled" && s !== "canceled";
}

/** VE items in "accepted" state are the ones actually applied to the budget. */
function isVeAccepted(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "accepted" || s === "approved" || s === "implemented";
}

/**
 * Aggregate financial signals across every project the caller can see.
 *
 * Callers must pre-filter `projects` to the org-scoped list — this function
 * does NOT re-check tenancy. Follows the same contract as
 * `getLeanModuleRollup(projectIds)`.
 */
export async function buildFinancialsRollup(
  storage: IStorage,
  projects: Project[],
): Promise<FinancialsRollup> {
  // Fetch every needed collection ONCE (per project). Sequential per-project
  // avoids a burst of concurrent Neon connections on portfolios with 20+
  // projects; each iteration is cheap.
  const perProject: ProjectFinancials[] = [];
  for (const p of projects) {
    const [changeOrdersRows, setup, bundle] = await Promise.all([
      storage.getChangeOrders(p.id),
      storage.getProjectSetup(p.id),
      storage.getPreConstructionBundle(p.id),
    ]);

    let approvedCo = 0;
    let pendingCo = 0;
    let approvedCoCount = 0;
    let pendingCoCount = 0;
    for (const co of changeOrdersRows as ChangeOrder[]) {
      if (isApproved(co.status)) {
        approvedCo += co.amount;
        approvedCoCount += 1;
      } else if (isPending(co.status)) {
        pendingCo += co.amount;
        pendingCoCount += 1;
      }
    }

    const originalContractParsed = setup?.originalContractValue
      ? parseUsd(setup.originalContractValue)
      : null;
    // Prefer the explicit contract value when the user has filled it in; fall
    // back to `projects.budget` (which is required at project creation) so
    // every project has a baseline even before Project Setup is populated.
    const originalContract = originalContractParsed && originalContractParsed > 0
      ? originalContractParsed
      : p.budget;

    const subcontractCommitments = (bundle.bidPackages ?? [])
      .reduce((s: number, b) => s + parseUsd(b.awardedValueUsd), 0);
    const poCommitments = (bundle.longLeadItems ?? [])
      .reduce((s: number, i) => s + parseUsd(i.poValueUsd), 0);
    const veSavings = (bundle.veItems ?? [])
      .filter((v) => isVeAccepted(v.status))
      .reduce((s: number, v) => s + parseUsd(v.estimatedSavingsUsd), 0);
    const designRfiCostExposure = (bundle.designRfis ?? [])
      .filter((r) => (r.impact ?? "").toLowerCase().includes("cost"))
      .reduce((s: number, r) => s + parseUsd(r.costImpactUsd), 0);

    const committedCost = subcontractCommitments + poCommitments;
    const revisedContract = originalContract + approvedCo;
    const committedPct = revisedContract > 0
      ? (committedCost / revisedContract) * 100
      : null;

    perProject.push({
      projectId: p.id,
      projectName: p.name,
      budget: p.budget,
      originalContract: originalContractParsed,
      approvedChangeOrders: approvedCo,
      pendingChangeOrders: pendingCo,
      revisedContract,
      subcontractCommitments,
      poCommitments,
      committedCost,
      veSavings,
      designRfiCostExposure,
      approvedCoCount,
      pendingCoCount,
      bidPackageCount: bundle.bidPackages?.length ?? 0,
      poCount: bundle.longLeadItems?.length ?? 0,
      committedPct,
    });
  }

  const orgTotals: OrgFinancialTotals = perProject.reduce<OrgFinancialTotals>(
    (acc, r) => {
      acc.budget += r.budget;
      acc.originalContract += r.originalContract ?? r.budget;
      acc.approvedChangeOrders += r.approvedChangeOrders;
      acc.pendingChangeOrders += r.pendingChangeOrders;
      acc.revisedContract += r.revisedContract;
      acc.subcontractCommitments += r.subcontractCommitments;
      acc.poCommitments += r.poCommitments;
      acc.committedCost += r.committedCost;
      acc.veSavings += r.veSavings;
      acc.designRfiCostExposure += r.designRfiCostExposure;
      acc.approvedCoCount += r.approvedCoCount;
      acc.pendingCoCount += r.pendingCoCount;
      acc.bidPackageCount += r.bidPackageCount;
      acc.poCount += r.poCount;
      return acc;
    },
    {
      projectCount: perProject.length,
      budget: 0,
      originalContract: 0,
      approvedChangeOrders: 0,
      pendingChangeOrders: 0,
      revisedContract: 0,
      subcontractCommitments: 0,
      poCommitments: 0,
      committedCost: 0,
      veSavings: 0,
      designRfiCostExposure: 0,
      approvedCoCount: 0,
      pendingCoCount: 0,
      bidPackageCount: 0,
      poCount: 0,
    },
  );

  return { orgTotals, projects: perProject };
}
