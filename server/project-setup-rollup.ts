/**
 * Project Setup rollup — the single computation behind the health endpoint,
 * the Executive OS portfolio cards, and the Mobilization soft gate.
 *
 * Kept out of routes.ts for the same reason as mobilizationRollup: the gate
 * endpoint and the portfolio endpoint both need this math, and two copies
 * would eventually disagree about whether a project is ready to mobilize.
 */
import { storage } from "./storage";
import { pct } from "@shared/mobilization-catalog";
import { CRITICAL_DELIVERABLES } from "@shared/project-setup-catalog";

export type ProjectSetupHealth = {
  seeded: boolean;
  status: string;
  completePct: number;
  deliverablesComplete: number;
  deliverablesTotal: number;
  missingCritical: string[];
  kickoffScheduled: boolean;
  charterApproved: boolean;
};

export async function projectSetupRollup(projectId: number): Promise<ProjectSetupHealth> {
  const { setup, deliverables } = await storage.getProjectSetupBundle(projectId);

  // "na" deliverables drop out of the denominator — marking one not-applicable
  // should raise the percentage, not permanently cap it.
  const countable = deliverables.filter((d) => d.status !== "na");
  const complete = countable.filter((d) => d.status === "complete").length;

  // A critical deliverable only counts as missing while it is still untouched.
  // Once it is in_progress the PM has visibly picked it up, and "complete" and
  // "na" are both resolutions.
  const missingCritical = deliverables
    .filter((d) => CRITICAL_DELIVERABLES.includes(d.label) && d.status === "pending")
    .map((d) => d.label);

  return {
    seeded: setup != null,
    status: setup?.status ?? "in_progress",
    completePct: pct(complete, countable.length),
    deliverablesComplete: complete,
    deliverablesTotal: countable.length,
    missingCritical,
    kickoffScheduled: !!setup?.kickoffScheduledAt,
    charterApproved: !!setup?.charterApprovedAt,
  };
}
