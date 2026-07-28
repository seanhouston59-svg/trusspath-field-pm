// Soft gates between Executive OS lifecycle modules.
//
// A gate never blocks — `blockedBy` exists for a future module that needs a
// hard stop, but every current gate returns warnings only. The rule is that a
// PM can always proceed; the banner just makes the cost of proceeding visible.

export type LifecycleGate = { blockedBy?: string[]; warnings: string[] };

// Both arguments are nullable because a project can predate either module. A
// null health means "this module was never wired up for this project", which is
// not the same as "this module reports nothing done" — we stay silent rather
// than warn about work the PM was never asked to do.
export function computeMobilizationGate(
  setupHealth: {
    charterApproved: boolean;
    missingCritical: string[];
    status: string;
  } | null,
  preconHealth?: {
    missingCriticalPermits: string[];
    longLeadItemsAtRisk: number;
    prequalApproved: number;
    prequalTotal: number;
    status: string;
    planApproved: boolean;
  } | null,
): LifecycleGate {
  const warnings: string[] = [];
  if (setupHealth) {
    if (!setupHealth.charterApproved) warnings.push("Project Charter not yet approved");
    if (setupHealth.missingCritical.length) {
      warnings.push(`Setup missing: ${setupHealth.missingCritical.join(", ")}`);
    }
  }
  if (preconHealth) {
    if (preconHealth.missingCriticalPermits.length) {
      warnings.push(`Critical permits not received: ${preconHealth.missingCriticalPermits.join(", ")}`);
    }
    if (!preconHealth.planApproved) warnings.push("Pre-Construction Plan not yet approved");
    if (preconHealth.longLeadItemsAtRisk > 0) {
      warnings.push(`${preconHealth.longLeadItemsAtRisk} long-lead item(s) at risk`);
    }
  }
  return { warnings };
}
