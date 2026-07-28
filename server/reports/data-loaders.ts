/**
 * Cross-module rollups for Executive OS reports.
 *
 * Every report pulls from the same notebook tables, so the aggregation lives
 * here rather than in each report file. Loaders return plain numbers/arrays and
 * never throw on missing data — a project with no RFIs yields zeroes, not an
 * error, so a report can always render its full outline.
 */
import { eq } from "drizzle-orm";
import { db, storage } from "../storage";
import { organizations } from "@shared/schema";
import type { Project, Organization } from "@shared/schema";

/** Statuses that mean "still needs someone's attention". */
const OPEN_RFI = new Set(["open", "in review"]);
const OPEN_SUBMITTAL = new Set(["draft", "submitted", "in review"]);
const OPEN_CO = new Set(["draft", "pending"]);
const CLOSED_PUNCH = new Set(["closed", "complete", "completed", "done", "verified"]);

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Whole days between two ISO dates; null when either is unparseable. */
function daysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

function isAfter(iso: string | null | undefined, since?: Date): boolean {
  if (!since) return true;
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= since.getTime();
}

export async function loadCoreProject(projectId: number): Promise<{
  project: Project;
  organization: Organization | null;
  gcName: string;
}> {
  const project = await storage.getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  let organization: Organization | null = null;
  if (project.organizationId != null) {
    const rows = await db.select().from(organizations).where(eq(organizations.id, project.organizationId)).limit(1);
    organization = rows[0] ?? null;
  }
  return { project, organization, gcName: organization?.name || "—" };
}

export async function loadRfiRollup(projectId: number): Promise<{
  openRfis: number;
  avgResponseDays: number | undefined;
  topOpen: Array<{ number: string; subject: string; dueDate: string }>;
}> {
  const rfis = await storage.getRfis(projectId);
  const open = rfis.filter((r) => OPEN_RFI.has(norm(r.status)));

  // Closed/answered RFIs approximate turnaround as created -> due. The schema
  // has no answered-on column, so this is the best available proxy.
  const spans = rfis
    .filter((r) => !OPEN_RFI.has(norm(r.status)))
    .map((r) => daysBetween(r.dateCreated, r.dueDate))
    .filter((n): n is number => n !== null && n >= 0);
  const avgResponseDays = spans.length
    ? spans.reduce((s, n) => s + n, 0) / spans.length
    : undefined;

  const topOpen = [...open]
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 5)
    .map((r) => ({ number: r.number, subject: r.subject, dueDate: r.dueDate }));

  return { openRfis: open.length, avgResponseDays, topOpen };
}

export async function loadSubmittalRollup(projectId: number): Promise<{ openSubmittals: number }> {
  const rows = await storage.getSubmittals(projectId);
  return { openSubmittals: rows.filter((s) => OPEN_SUBMITTAL.has(norm(s.status))).length };
}

export async function loadChangeOrderRollup(projectId: number): Promise<{
  approvedTotal: number;
  pendingCount: number;
  pendingValue: number;
}> {
  const rows = await storage.getChangeOrders(projectId);
  let approvedTotal = 0;
  let pendingCount = 0;
  let pendingValue = 0;
  for (const co of rows) {
    const status = norm(co.status);
    const amount = Number.isFinite(co.amount) ? co.amount : 0;
    // "Executed" counts as approved — it's approved plus signed.
    if (status === "approved" || status === "executed") approvedTotal += amount;
    else if (OPEN_CO.has(status)) { pendingCount += 1; pendingValue += amount; }
  }
  return { approvedTotal, pendingCount, pendingValue };
}

export async function loadPunchRollup(projectId: number): Promise<{ openItems: number }> {
  const rows = await storage.getPunchItems(projectId);
  return { openItems: rows.filter((p) => !CLOSED_PUNCH.has(norm(p.status))).length };
}

/**
 * Field observations split into executive buckets.
 *
 * There is no dedicated "near miss" kind in the schema, so severity carries
 * the distinction: a high/urgent safety observation is treated as an incident,
 * anything lower as a near miss.
 */
export async function loadObservationRollup(projectId: number, since?: Date): Promise<{
  safetyIncidents: number;
  nearMisses: number;
  qualityIssues: number;
}> {
  const rows = await storage.getRecentFieldObservations({ projectId, limit: 500 });
  let safetyIncidents = 0;
  let nearMisses = 0;
  let qualityIssues = 0;

  for (const o of rows) {
    if (!isAfter(o.occurredAt ?? o.createdAt, since)) continue;
    const kind = norm(o.kind);
    const severity = norm(o.severity);
    if (kind === "safety") {
      if (severity === "high" || severity === "urgent") safetyIncidents += 1;
      else nearMisses += 1;
    } else if (kind === "quality") {
      qualityIssues += 1;
    }
  }
  return { safetyIncidents, nearMisses, qualityIssues };
}

/**
 * Timesheet hours grouped by trade. Timesheets store an employee name rather
 * than a team_members FK, so trade is resolved by name lookup; anyone not on
 * the project team rolls up under "Unassigned".
 */
export async function loadTimesheetRollup(projectId: number, since?: Date): Promise<{
  totalHours: number;
  byTrade: Array<{ trade: string; headcount: number; hours: number }>;
}> {
  const [sheets, team] = await Promise.all([
    storage.getTimesheets(projectId),
    storage.getTeam(),
  ]);
  const tradeByName = new Map(team.map((m) => [norm(m.name), m.trade || "Unassigned"]));

  const buckets = new Map<string, { hours: number; people: Set<string> }>();
  let totalHours = 0;

  for (const ts of sheets) {
    if (!isAfter(ts.weekStart, since)) continue;
    const hours = parseFloat(ts.totalHours ?? "0");
    if (!Number.isFinite(hours)) continue;
    const trade = tradeByName.get(norm(ts.employeeName)) ?? "Unassigned";
    const bucket = buckets.get(trade) ?? { hours: 0, people: new Set<string>() };
    bucket.hours += hours;
    bucket.people.add(norm(ts.employeeName));
    buckets.set(trade, bucket);
    totalHours += hours;
  }

  const byTrade = Array.from(buckets.entries())
    .map(([trade, b]) => ({ trade, headcount: b.people.size, hours: b.hours }))
    .sort((a, b) => b.hours - a.hours);

  return { totalHours, byTrade };
}

export async function loadDailyLogRollup(projectId: number, since?: Date): Promise<{
  logCount: number;
  avgCrew: number;
}> {
  const rows = (await storage.getDailyLogs(projectId)).filter((l) => isAfter(l.date, since));
  if (!rows.length) return { logCount: 0, avgCrew: 0 };
  const crew = rows.reduce((s, l) => s + (Number.isFinite(l.crewCount) ? l.crewCount : 0), 0);
  return { logCount: rows.length, avgCrew: crew / rows.length };
}
