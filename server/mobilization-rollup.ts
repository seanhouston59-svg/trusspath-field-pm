/**
 * Mobilization rollup — the single computation behind the bundle endpoint, the
 * health endpoint, the portfolio cards, and the Mobilization Plan PDF.
 *
 * Kept out of routes.ts so the report generator can reuse it verbatim; two
 * copies of this math would eventually disagree about a project's health.
 */
import { storage } from "./storage";
import {
  MOBILIZATION_SECTIONS, MOBILIZATION_MILESTONE_KIND, EARTHWORK_MILESTONE_TITLE,
  computeHealth, daysUntil, pct,
} from "@shared/mobilization-catalog";

export async function mobilizationRollup(projectId: number) {
  const [plan, items, permits, equipmentRows, utilities, staff, subs, risks, allMilestones] = await Promise.all([
    storage.getMobilizationPlan(projectId),
    storage.getMobilizationItems(projectId),
    storage.getMobilizationPermits(projectId),
    storage.getMobilizationEquipment(projectId),
    storage.getMobilizationUtilities(projectId),
    storage.getMobilizationStaff(projectId),
    storage.getMobilizationSubs(projectId),
    storage.getMobilizationRisks(projectId),
    storage.getMilestones(projectId),
  ]);
  const mobMilestones = allMilestones.filter((m) => m.kind === MOBILIZATION_MILESTONE_KIND);

  // "na" items drop out of the denominator — marking something not-applicable
  // should raise the percentage, not permanently cap it.
  const countable = items.filter((i) => i.status !== "na");
  const doneCount = countable.filter((i) => i.status === "done").length;
  const overallPct = pct(doneCount, countable.length);

  const sectionPct: Record<string, number> = {};
  for (const section of MOBILIZATION_SECTIONS) {
    const inSection = countable.filter((i) => i.section === section);
    sectionPct[section] = pct(inSection.filter((i) => i.status === "done").length, inSection.length);
  }

  const approved = permits.filter((p) => p.status === "Approved").length;
  const notStarted = permits.filter((p) => p.status === "Not Started").length;
  const blocked = permits.filter((p) => p.status === "Rejected" || p.status === "Expired").length;
  const permitStatus = { approved, pending: permits.length - approved - notStarted - blocked, notStarted, blocked, total: permits.length };

  const earthwork = mobMilestones.find((m) => m.title === EARTHWORK_MILESTONE_TITLE);
  const milestoneDaysToEarthwork = daysUntil(earthwork?.date);

  return {
    seeded: !!plan,
    plan, items, permits, equipment: equipmentRows, utilities, staff, subs, risks,
    milestones: mobMilestones,
    overallPct,
    sectionPct,
    permitStatus,
    equipmentOnSitePct: pct(equipmentRows.filter((e) => e.onSiteConfirmed).length, equipmentRows.length),
    utilitiesInstalledPct: pct(utilities.filter((u) => !!u.installedDate).length, utilities.length),
    staffOnboardedPct: pct(staff.filter((s) => s.orientationDone && s.drugTestDone && s.ppeIssued).length, staff.length),
    subsReadyPct: pct(subs.filter((s) => s.insuranceOnFile && s.w9OnFile && s.msaSigned).length, subs.length),
    risksOpen: risks.filter((r) => r.status === "open").length,
    milestoneDaysToEarthwork,
    health: computeHealth({ overallPct, hasBlockedPermit: blocked > 0, daysToEarthwork: milestoneDaysToEarthwork }),
  };
}

export type MobilizationRollup = Awaited<ReturnType<typeof mobilizationRollup>>;
