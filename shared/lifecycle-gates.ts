// Soft gates between Executive OS lifecycle modules.
//
// A gate never blocks — `blockedBy` exists for a future module that needs a
// hard stop, but every current gate returns warnings only. The rule is that a
// PM can always proceed; the banner just makes the cost of proceeding visible.

export type LifecycleGate = { blockedBy?: string[]; warnings: string[] };

export function computeMobilizationGate(setupHealth: {
  charterApproved: boolean;
  missingCritical: string[];
  status: string;
}): LifecycleGate {
  const warnings: string[] = [];
  if (!setupHealth.charterApproved) warnings.push("Project Charter not yet approved");
  if (setupHealth.missingCritical.length) {
    warnings.push(`Setup missing: ${setupHealth.missingCritical.join(", ")}`);
  }
  return { warnings };
}
