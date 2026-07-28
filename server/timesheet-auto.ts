// Auto-timesheet automation
//
// Threads field-punch clock events into a weekly timesheet without the
// employee having to fill anything out.
//
// * Every clock-in "in" event ensures a draft timesheet exists for
//   (accountId, weekStart).
// * Every "out" or "break_end" recomputes today's total hours from the
//   full punch stream and upserts one time_entries row per day.
// * The Sunday roll-over cron flips draft → needs-signature and (when
//   RESEND_API_KEY is set) emails the employee a reminder link.
// * Employee sign → notify the project superintendent for countersign.

import { storage } from "./storage";
import type { FieldPunch, Project, TeamMember } from "@shared/schema";

// ISO YYYY-MM-DD for the Monday that starts a given ISO date's week.
// We use Monday as week-start because that's the most common construction
// pay-period boundary in the US. Callers can override if their org runs
// Sunday-start payroll later.
export function weekStartMonday(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  // Days to subtract to reach Monday: Sun→6, Mon→0, Tue→1, ..., Sat→5.
  const back = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
  return monday.toISOString().slice(0, 10);
}

export function weekEndSunday(weekStartIso: string): string {
  const d = new Date(weekStartIso + "T00:00:00Z");
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 6));
  return end.toISOString().slice(0, 10);
}

export function dayBoundsUtc(iso: string): { start: string; end: string } {
  // We derive a day window from the ISO occurredAt. Using UTC boundaries
  // keeps things predictable across time zones for the aggregation math;
  // display code later formats to the org's local zone.
  const d = new Date(iso);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

// Compute worked hours from a day's ordered punch stream.
// Rules:
//   in   → open shift
//   break_start → pause accumulation
//   break_end   → resume shift
//   out  → close shift, add elapsed
// Stray states (out before in, etc.) are ignored so a mis-tap never
// blows up the day's total.
export function computeHoursFromPunches(punches: Pick<FieldPunch, "kind" | "occurredAt">[]): number {
  let total = 0;
  let openAt: number | null = null;
  let breakAt: number | null = null;
  for (const p of punches) {
    const t = new Date(p.occurredAt).getTime();
    if (!Number.isFinite(t)) continue;
    switch (p.kind) {
      case "in":
        if (openAt == null) openAt = t;
        break;
      case "out":
        if (openAt != null) {
          total += Math.max(0, t - openAt);
          openAt = null;
        }
        break;
      case "break_start":
        if (openAt != null && breakAt == null) {
          total += Math.max(0, t - openAt);
          breakAt = t;
          openAt = null;
        }
        break;
      case "break_end":
        if (breakAt != null) {
          openAt = t;
          breakAt = null;
        }
        break;
    }
  }
  // If they're still clocked in at query time, count up to now.
  if (openAt != null) total += Math.max(0, Date.now() - openAt);
  return total / (1000 * 60 * 60);
}

// Ensure there's a draft timesheet for this account+week. Idempotent —
// safe to call on every clock-in.
export async function ensureTimesheetForWeek(params: {
  accountId: number;
  organizationId: number | null;
  projectId: number;
  employeeName: string;
  weekStart: string;
}) {
  const existing = await storage.getTimesheetByAccountWeek(params.accountId, params.weekStart);
  if (existing) return existing;
  return await storage.createTimesheet({
    projectId: params.projectId,
    accountId: params.accountId,
    organizationId: params.organizationId ?? undefined,
    employeeName: params.employeeName,
    weekStart: params.weekStart,
    weekEnd: weekEndSunday(params.weekStart),
    totalHours: "0",
    status: "draft",
    employeeSignature: null,
    employeeSubmittedAt: null,
    managerSignature: null,
    managerApprovedAt: null,
    managerName: null,
    managerEmail: null,
    notes: null,
  } as any);
}

// Recompute today's hours from the full day's punch stream and roll into
// the current-week timesheet. Also refreshes the timesheet's totalHours
// so the header count stays in sync.
export async function rollupPunchToTimesheet(params: {
  accountId: number;
  timesheetId: number;
  occurredAt: string;
  projectName: string | null;
}): Promise<{ hoursToday: number; totalHours: number }> {
  const { start, end } = dayBoundsUtc(params.occurredAt);
  const dayPunches = await storage.getFieldPunchesForDay(params.accountId, start, end);
  const hoursToday = computeHoursFromPunches(dayPunches);
  const entryDate = start.slice(0, 10);
  const dayOfWeek = new Date(entryDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  await storage.upsertDailyTimeEntry(params.timesheetId, entryDate, {
    dayOfWeek,
    hoursWorked: hoursToday.toFixed(2),
    projectName: params.projectName ?? undefined,
  });
  // Sum every day of the current week (from persisted rows, not just today).
  const allEntries = await storage.getTimeEntries(params.timesheetId);
  const totalHours = allEntries.reduce((s, e) => s + (parseFloat(e.hoursWorked) || 0), 0);
  await storage.updateTimesheet(params.timesheetId, { totalHours: totalHours.toFixed(2) });
  return { hoursToday, totalHours };
}

// Find the manager for a project — currently the assigned superintendent.
// Returns null if none is set; caller falls back to "your project manager".
export async function findManagerForProject(project: Project | undefined): Promise<TeamMember | null> {
  if (!project?.superintendentId) return null;
  return (await storage.getTeamMember(project.superintendentId)) ?? null;
}

// Roll every stale draft timesheet whose week has ended over into
// "needs-signature" so employees see the sign-and-submit prompt. Runs
// opportunistically piggy-backed on any /api/timesheets request.
let lastRolloverAt = 0;
export async function runWeeklyRolloverIfDue(): Promise<{ rolled: number }> {
  const now = Date.now();
  if (now - lastRolloverAt < 30 * 60 * 1000) return { rolled: 0 };
  lastRolloverAt = now;

  // Only bother running late Sun / early Mon window. Cheap check.
  const todayIso = new Date().toISOString().slice(0, 10);
  // Fetch all draft timesheets (limit to those with accountId set — legacy
  // manual ones don't participate in this automation).
  // UNSCOPED: intentionally deployment-wide. This is a maintenance sweep that
  // flips stale drafts to needs-signature for every tenant; scoping it to the
  // requesting org would leave other orgs' timesheets stuck in draft. It
  // returns only a count and never hands rows to the caller.
  const all = await storage.getTimesheets();
  let rolled = 0;
  for (const ts of all) {
    if (!ts.accountId) continue;
    if (ts.status !== "draft") continue;
    if (ts.weekEnd >= todayIso) continue; // still current week
    await storage.updateTimesheet(ts.id, { status: "needs-signature" });
    rolled++;
  }
  if (rolled > 0) console.log(`[timesheets] rolled ${rolled} draft(s) to needs-signature`);
  return { rolled };
}
