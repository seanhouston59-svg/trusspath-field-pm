/**
 * Dashboard Alerts aggregator.
 *
 * Consolidates the "PM needs to know" signals from every relevant table
 * into a single flat list the dashboard NotificationsBox renders. Each
 * alert carries:
 *   - id: stable across polls so React can key rows
 *   - tone: color hint (red = overdue, amber = due soon, sky = pending, violet = info)
 *   - icon: string name (client maps to a lucide icon)
 *   - text: short one-line title
 *   - meta: secondary line (project name, due date, counterparty, etc.)
 *   - href: deep link
 *   - phase: category tag for filtering / grouping
 *   - dueDate: ISO — used by the client to sort within a phase
 *
 * Everything is scoped to `req.organizationId` before it enters here.
 */

import type { storage as Storage } from "./storage";
import type { Project, Task, Rfi, Submittal, ChangeOrder, Milestone, Contract, Inspection } from "@shared/schema";

export type DashboardAlert = {
  id: string;
  tone: "red" | "amber" | "sky" | "violet" | "emerald";
  icon: string;
  text: string;
  meta: string;
  href: string;
  phase: "milestones" | "tasks" | "rfis" | "submittals" | "change-orders" | "inspections" | "contracts" | "mobilization";
  dueDate: string | null;
};

function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
}

function fmtDue(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days}d`;
}

/**
 * Build the alert set for a single organization. Reads every relevant
 * collection with an org-scoped query, filters to the "worth notifying"
 * subset, and returns a flat sorted list. Callers can further slice by
 * phase or tone client-side.
 */
export async function buildDashboardAlerts(
  storage: typeof Storage,
  organizationId: number,
): Promise<DashboardAlert[]> {
  const projects = await storage.getProjects(organizationId);
  const projectIds = new Set(projects.map((p) => p.id));
  const projectName = (id: number): string =>
    projects.find((p) => p.id === id)?.name ?? "—";

  // Pull every collection then filter to this org's project set. The shared
  // reads below have no organizationId scope parameter today (they're keyed
  // by projectId only) so we fetch all rows and immediately drop anything
  // outside this org's project set. Every filter below is enforced by
  // `projectIds.has(x.projectId)` on the org-scoped projects list.
  const [
    allMilestones,
    allTasks,
    allRfis,
    allSubmittals,
    allChangeOrders,
  ] = await Promise.all([
    // UNSCOPED: shared read, filtered to org projectIds on the next line
    storage.getMilestones().then((r) => r.filter((x) => projectIds.has(x.projectId))),
    // UNSCOPED: shared read, filtered to org projectIds on the next line
    storage.getTasks().then((r) => r.filter((x) => projectIds.has(x.projectId))),
    // UNSCOPED: shared read, filtered to org projectIds on the next line
    storage.getRfis().then((r) => r.filter((x) => projectIds.has(x.projectId))),
    // UNSCOPED: shared read, filtered to org projectIds on the next line
    storage.getSubmittals().then((r) => r.filter((x) => projectIds.has(x.projectId))),
    // UNSCOPED: shared read, filtered to org projectIds on the next line
    storage.getChangeOrders().then((r) => r.filter((x) => projectIds.has(x.projectId))),
  ]);

  // Contracts + inspections are org-scoped directly by the repo (they carry
  // organizationId on the row), so no post-filter is needed. They're on the
  // non-IStorage direct repo access pattern.
  const allContracts: Contract[] = await storage.contracts.list(organizationId);
  const allInspections: Inspection[] = await storage.inspections.list(organizationId);

  const out: DashboardAlert[] = [];

  // ------- Milestones: overdue + due within 30 days -------
  const activeMilestones = allMilestones.filter(
    (m) => !/^complete/i.test(m.status ?? "") && !/^skipped/i.test(m.status ?? ""),
  );
  for (const m of activeMilestones) {
    const d = daysFromToday(m.date);
    if (d === null) continue;
    if (d <= 30) {
      out.push({
        id: `ms-${m.id}`,
        tone: d < 0 ? "red" : d <= 7 ? "amber" : "sky",
        icon: "Flag",
        text: m.title,
        meta: `${projectName(m.projectId)} · ${fmtDue(d)}`,
        href: `/projects/${m.projectId}`,
        phase: "milestones",
        dueDate: m.date,
      });
    }
  }

  // ------- Tasks: overdue open items -------
  for (const t of allTasks) {
    if (t.status === "Complete") continue;
    const d = daysFromToday(t.dueDate);
    if (d === null) continue;
    if (d < 0) {
      out.push({
        id: `t-${t.id}`,
        tone: "red",
        icon: "AlertTriangle",
        text: t.title,
        meta: `${projectName(t.projectId)} · ${fmtDue(d)}${t.trade ? ` · ${t.trade}` : ""}`,
        href: "/tasks",
        phase: "tasks",
        dueDate: t.dueDate,
      });
    } else if (d <= 3) {
      out.push({
        id: `t-${t.id}`,
        tone: "amber",
        icon: "AlertTriangle",
        text: t.title,
        meta: `${projectName(t.projectId)} · ${fmtDue(d)}`,
        href: "/tasks",
        phase: "tasks",
        dueDate: t.dueDate,
      });
    }
  }

  // ------- RFIs: overdue + due-soon on open items -------
  for (const r of allRfis) {
    if (r.status !== "Open") continue;
    const d = daysFromToday(r.dueDate);
    if (d === null) continue;
    if (d < 0) {
      out.push({
        id: `rfi-${r.id}`,
        tone: "red",
        icon: "HelpCircle",
        text: `${r.number} — ${r.subject}`,
        meta: `${projectName(r.projectId)} · ${fmtDue(d)}`,
        href: "/rfis",
        phase: "rfis",
        dueDate: r.dueDate,
      });
    } else if (d <= 3) {
      out.push({
        id: `rfi-${r.id}`,
        tone: "amber",
        icon: "HelpCircle",
        text: `${r.number} — ${r.subject}`,
        meta: `${projectName(r.projectId)} · ${fmtDue(d)}`,
        href: "/rfis",
        phase: "rfis",
        dueDate: r.dueDate,
      });
    }
  }

  // ------- Submittals: under review with a returnBy date approaching -------
  for (const s of allSubmittals as Array<Submittal & { returnBy?: string | null }>) {
    const status = (s.status ?? "").toLowerCase();
    if (!/review|submitted|open|pending/.test(status)) continue;
    const due = (s as any).returnBy ?? (s as any).dueDate ?? null;
    const d = daysFromToday(due);
    if (d === null) continue;
    if (d <= 5) {
      out.push({
        id: `sub-${s.id}`,
        tone: d < 0 ? "red" : "amber",
        icon: "ClipboardList",
        text: `${s.number} — ${s.subject}`,
        meta: `${projectName(s.projectId)} · ${fmtDue(d)}`,
        href: "/submittals",
        phase: "submittals",
        dueDate: due,
      });
    }
  }

  // ------- Change orders: pending approval -------
  for (const c of allChangeOrders) {
    if (c.status !== "Pending") continue;
    out.push({
      id: `co-${c.id}`,
      tone: "sky",
      icon: "GitPullRequestArrow",
      text: `${c.number} pending approval`,
      meta: `${projectName(c.projectId)} · ${c.title}`,
      href: "/change-orders",
      phase: "change-orders",
      dueDate: null,
    });
  }

  // ------- Inspections: scheduled within 14 days OR failed with follow-up -------
  for (const ins of allInspections) {
    if (ins.result === "fail" && ins.followUpItems) {
      out.push({
        id: `ins-${ins.id}`,
        tone: "red",
        icon: "ClipboardCheck",
        text: `${ins.inspectionType} — failed, follow-up open`,
        meta: `${projectName(ins.projectId)} · ${ins.followUpItems.split("\n")[0].slice(0, 60)}`,
        href: `/command-deck/inspections/${ins.id}`,
        phase: "inspections",
        dueDate: ins.inspectionDate,
      });
      continue;
    }
    if (ins.result === "scheduled") {
      const d = daysFromToday(ins.inspectionDate);
      if (d === null) continue;
      if (d <= 14 && d >= -7) {
        out.push({
          id: `ins-${ins.id}`,
          tone: d < 0 ? "red" : d <= 3 ? "amber" : "sky",
          icon: "ClipboardCheck",
          text: `${ins.inspectionType} inspection`,
          meta: `${projectName(ins.projectId)} · ${ins.inspector} · ${fmtDue(d)}`,
          href: `/command-deck/inspections/${ins.id}`,
          phase: "inspections",
          dueDate: ins.inspectionDate,
        });
      }
    }
  }

  // ------- Contracts: expired COIs + COIs expiring in 30 days -------
  for (const c of allContracts) {
    const d = daysFromToday(c.insuranceCertExpiration);
    if (d === null) continue;
    if (d < 0) {
      out.push({
        id: `coi-${c.id}`,
        tone: "red",
        icon: "ShieldAlert",
        text: `COI expired — ${c.counterpartyName}`,
        meta: `${Math.abs(d)}d past expiration${c.insuranceCertNumber ? ` · ${c.insuranceCertNumber}` : ""}`,
        href: `/command-deck/contracts/${c.id}`,
        phase: "contracts",
        dueDate: c.insuranceCertExpiration,
      });
    } else if (d <= 30) {
      out.push({
        id: `coi-${c.id}`,
        tone: "amber",
        icon: "ShieldAlert",
        text: `COI expires soon — ${c.counterpartyName}`,
        meta: `expires in ${d}d${c.insuranceCertNumber ? ` · ${c.insuranceCertNumber}` : ""}`,
        href: `/command-deck/contracts/${c.id}`,
        phase: "contracts",
        dueDate: c.insuranceCertExpiration,
      });
    }
  }

  // ------- Mobilization: projects in Planning without a mobilization plan -------
  for (const p of projects) {
    if (p.status === "Planning") {
      out.push({
        id: `mob-${p.id}`,
        tone: "violet",
        icon: "Rocket",
        text: "Mobilization plan pending",
        meta: p.name,
        href: `/projects/${p.id}`,
        phase: "mobilization",
        dueDate: null,
      });
    }
  }

  // Sort by: red first, then amber, then sky/violet/emerald; within tone, by
  // absolute days-from-today so the most-imminent items float to the top.
  const toneRank: Record<DashboardAlert["tone"], number> = { red: 0, amber: 1, sky: 2, violet: 3, emerald: 4 };
  out.sort((a, b) => {
    const t = toneRank[a.tone] - toneRank[b.tone];
    if (t !== 0) return t;
    const da = daysFromToday(a.dueDate);
    const db = daysFromToday(b.dueDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return Math.abs(da) - Math.abs(db);
  });

  return out;
}
