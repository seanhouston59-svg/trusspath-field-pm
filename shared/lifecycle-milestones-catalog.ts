/**
 * Standard construction-lifecycle milestone set.
 *
 * These are the go-to "big picture" milestones a project manager tracks
 * regardless of trade or project type — from Notice to Proceed through
 * Final Closeout. They live on the shared `milestones` table alongside the
 * mobilization-kind milestones (which are startup-specific) and any custom
 * milestones a PM adds. The `kind` tag disambiguates them at read time.
 *
 * Day offsets are relative to project.startDate (falling back to "today"
 * when the project has no start date yet). They're deliberately spaced so a
 * newly-created project has a full lifecycle laid out for the dashboard to
 * light up; a PM will tighten them once a real schedule is drawn.
 */

import { addDays } from "./mobilization-catalog";

/** Milestone kind used to tag lifecycle rows in the shared milestones table. */
export const LIFECYCLE_MILESTONE_KIND = "lifecycle";

export type LifecycleMilestoneSpec = {
  title: string;
  dayOffset: number;
  phase: "start" | "site" | "structure" | "envelope" | "interiors" | "closeout";
};

/**
 * Ordered set of milestones a PM should see on every project. Order matches
 * a typical vertical construction sequence; horizontal / civil / renovation
 * projects will still find most of these useful, and PMs can delete the
 * ones that don't apply.
 */
export const LIFECYCLE_MILESTONES: LifecycleMilestoneSpec[] = [
  { title: "Notice to Proceed", dayOffset: 0, phase: "start" },
  { title: "Mobilization Complete", dayOffset: 14, phase: "start" },
  { title: "Site Work Complete", dayOffset: 45, phase: "site" },
  { title: "Foundation Complete", dayOffset: 90, phase: "structure" },
  { title: "Structure Topped Out", dayOffset: 180, phase: "structure" },
  { title: "Building Dry-In", dayOffset: 240, phase: "envelope" },
  { title: "MEP Rough-In Complete", dayOffset: 270, phase: "interiors" },
  { title: "Interior Finishes Complete", dayOffset: 330, phase: "interiors" },
  { title: "Commissioning Complete", dayOffset: 360, phase: "closeout" },
  { title: "Substantial Completion", dayOffset: 375, phase: "closeout" },
  { title: "Certificate of Occupancy", dayOffset: 390, phase: "closeout" },
  { title: "Final Closeout & Turnover", dayOffset: 420, phase: "closeout" },
];

/**
 * Build a full set of lifecycle milestone rows for a project, anchored to
 * its start date. Callers should filter out any titles that already exist
 * on the project before inserting to keep the seed idempotent.
 */
export function buildLifecycleMilestoneRows(
  projectId: number,
  startDate: string | null | undefined,
): Array<{ projectId: number; title: string; date: string; kind: string; status: string }> {
  return LIFECYCLE_MILESTONES.map((m) => ({
    projectId,
    title: m.title,
    date: addDays(startDate ?? undefined, m.dayOffset),
    kind: LIFECYCLE_MILESTONE_KIND,
    status: "pending",
  }));
}
