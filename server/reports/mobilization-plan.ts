/**
 * Mobilization Plan — the first Executive OS deliverable.
 *
 * Renders the full 15-section mobilization outline plus the standard executive
 * report sections (financials, quality, safety, RFI/CO, manpower) from the
 * eight mobilization tables and the surrounding notebook data. Sections whose
 * source module doesn't exist yet render an explicit "unavailable" marker
 * rather than being silently omitted, so the outline stays stable across
 * releases.
 */
import type { Response } from "express";
import { storage } from "../storage";
import { mobilizationRollup } from "../mobilization-rollup";
import { ReportBuilder, formatDate, formatMoney, type ReportMeta } from "./engine";
import {
  loadCoreProject, loadRfiRollup, loadSubmittalRollup, loadChangeOrderRollup,
  loadPunchRollup, loadObservationRollup, loadTimesheetRollup,
} from "./data-loaders";
import {
  MOBILIZATION_SECTIONS, DEFAULT_MOBILIZATION_ITEMS, UTILITY_KIND_LABELS,
  EARTHWORK_MILESTONE_TITLE, daysUntil,
} from "@shared/mobilization-catalog";
import type { MobilizationItem, TeamMember } from "@shared/schema";

/** An item is "overdue" once its target date has passed and it isn't done. */
const OVERDUE_GRACE_DAYS = 5;

const RISK_WEIGHT: Record<string, number> = { low: 1, med: 2, high: 3 };

/** Roles we try to pre-fill on the sign-off block, in render order. */
const SIGNER_ROLES = [
  "Chief Executive Officer",
  "Project Executive",
  "Project Manager",
  "Superintendent",
  "Safety Manager",
];

/** Loose matching so "PM", "Project Mgr" and "Project Manager" all resolve. */
const ROLE_ALIASES: Record<string, string[]> = {
  "Chief Executive Officer": ["ceo", "chief executive"],
  "Project Executive": ["project executive", "exec", "px"],
  "Project Manager": ["project manager", "pm", "project mgr"],
  "Superintendent": ["superintendent", "super", "supt"],
  "Safety Manager": ["safety manager", "safety", "ehs"],
};

function findSigner(team: TeamMember[], role: string): string {
  const aliases = ROLE_ALIASES[role] ?? [role.toLowerCase()];
  const hit = team.find((m) => {
    const r = (m.role ?? "").trim().toLowerCase();
    return aliases.some((a) => r === a || r.includes(a));
  });
  return hit?.name ?? "";
}

function yesNo(v: boolean): string {
  return v ? "Yes" : "No";
}

function itemsIn(items: MobilizationItem[], section: string): MobilizationItem[] {
  return items
    .filter((i) => i.section === section)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** "Owner · due Jul 27, 2026 · overdue" — whichever parts exist. */
function itemSubtitle(item: MobilizationItem, teamMap: Map<number, TeamMember>): string | undefined {
  const parts: string[] = [];
  if (item.ownerId != null) {
    const owner = teamMap.get(item.ownerId);
    if (owner) parts.push(owner.name);
  }
  if (item.targetDate) {
    parts.push(`due ${formatDate(item.targetDate)}`);
    const d = daysUntil(item.targetDate);
    if (d !== null && d < 0 && item.status !== "done" && item.status !== "na") {
      parts.push(`${Math.abs(d)}d overdue`);
    }
  }
  if (item.status === "na") parts.push("N/A");
  else if (item.status === "in_progress") parts.push("in progress");
  return parts.length ? parts.join("  ·  ") : undefined;
}

function toChecklist(items: MobilizationItem[], teamMap: Map<number, TeamMember>) {
  return items.map((i) => ({
    label: i.title,
    done: i.status === "done",
    subtitle: itemSubtitle(i, teamMap),
  }));
}

export async function generateMobilizationPlan(
  projectId: number,
  opts: { preparedBy: string; preparedByRole?: string; revision?: string; res: Response },
): Promise<void> {
  const { res } = opts;

  const [core, roll, team] = await Promise.all([
    loadCoreProject(projectId),
    mobilizationRollup(projectId),
    storage.getTeam(),
  ]);
  const { project, gcName } = core;
  const teamMap = new Map(team.map((m) => [m.id, m]));

  const since = project.startDate ? new Date(project.startDate) : undefined;
  const [rfi, submittals, cos, punch, obs, labor] = await Promise.all([
    loadRfiRollup(projectId),
    loadSubmittalRollup(projectId),
    loadChangeOrderRollup(projectId),
    loadPunchRollup(projectId),
    loadObservationRollup(projectId, since),
    loadTimesheetRollup(projectId, since),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const meta: ReportMeta = {
    title: "Mobilization Plan",
    projectName: project.name,
    projectNumber: project.number,
    owner: project.client,
    gcName,
    address: project.address,
    reportingPeriod: `As of ${formatDate(today)}`,
    preparedBy: opts.preparedBy,
    preparedByRole: opts.preparedByRole,
    distribution: ["CEO", "Owner", "Project Executive", "Project Manager"],
    revision: opts.revision ?? "Rev 0",
    health: roll.health,
    phase: "Mobilization",
  };

  const filename = `Mobilization Plan — ${project.name} — ${today}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  // RFC 5987 filename* carries the em dash; the ASCII fallback stays quoted.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/[^\x20-\x7E]/g, "-").replace(/"/g, "")}"; ` +
    `filename*=UTF-8''${encodeURIComponent(filename)}`,
  );

  const r = new ReportBuilder(meta);
  r.pipe(res);

  // ---------------------------------------------------------- 1. Cover
  r.coverPage(`${project.name} · ${project.number}`);

  // ----------------------------------------------- 2. Executive Summary
  r.sectionBreak();

  const daysToEarthwork = roll.milestoneDaysToEarthwork;
  const openRisks = roll.risks.filter((x) => x.status === "open");
  const topRisks = [...openRisks]
    .sort((a, b) =>
      (RISK_WEIGHT[b.likelihood] ?? 2) * (RISK_WEIGHT[b.impact] ?? 2) -
      (RISK_WEIGHT[a.likelihood] ?? 2) * (RISK_WEIGHT[a.impact] ?? 2))
    .slice(0, 3);

  const blockedPermits = roll.permits.filter((p) => p.status === "Rejected" || p.status === "Expired");
  const overdueItems = roll.items.filter((i) => {
    if (i.status === "done" || i.status === "na" || !i.targetDate) return false;
    const d = daysUntil(i.targetDate);
    return d !== null && d < 0;
  });

  const keyWins: string[] = [];
  const doneItems = roll.items.filter((i) => i.status === "done");
  if (doneItems.length) keyWins.push(`${doneItems.length} mobilization checklist items complete (${roll.overallPct}% overall).`);
  if (roll.permitStatus.approved > 0) keyWins.push(`${roll.permitStatus.approved} of ${roll.permitStatus.total} permits approved.`);
  if (roll.equipmentOnSitePct > 0) keyWins.push(`${roll.equipmentOnSitePct}% of mobilization equipment confirmed on site.`);
  if (roll.utilitiesInstalledPct > 0) keyWins.push(`${roll.utilitiesInstalledPct}% of temporary utilities installed.`);
  if (roll.staffOnboardedPct > 0) keyWins.push(`${roll.staffOnboardedPct}% of assigned staff fully onboarded.`);
  if (!keyWins.length) keyWins.push("Mobilization plan established; execution has not yet started.");

  const topIssues: string[] = [
    ...blockedPermits.map((p) => `Permit blocked — ${p.name}${p.agency ? ` (${p.agency})` : ""}: ${p.status}.`),
    ...overdueItems.slice(0, 3).map((i) => {
      const d = daysUntil(i.targetDate);
      return `Overdue — ${i.title} (${i.section}), ${Math.abs(d ?? 0)} days past target.`;
    }),
  ].slice(0, 3);
  if (!topIssues.length) topIssues.push("No blocked permits or overdue mobilization items.");

  // Anything badly overdue or a high-impact open risk needs a decision, not
  // just a status update.
  const decisionsRequired: string[] = [
    ...roll.items
      .filter((i) => {
        if (i.status !== "in_progress" || !i.targetDate) return false;
        const d = daysUntil(i.targetDate);
        return d !== null && d < -OVERDUE_GRACE_DAYS;
      })
      .map((i) => `${i.title} (${i.section}) is ${Math.abs(daysUntil(i.targetDate) ?? 0)} days past target and still in progress.`),
    ...openRisks
      .filter((x) => x.impact === "high")
      .map((x) => `High-impact open risk: ${x.risk}`),
  ];

  r.executiveSummary({
    currentPhase: "Mobilization",
    health: roll.health,
    daysToNextMilestone: daysToEarthwork ?? undefined,
    keyWins,
    topRisks: topRisks.length
      ? topRisks.map((x) => `${x.risk} — likelihood ${x.likelihood}, impact ${x.impact}${x.mitigation ? `. Mitigation: ${x.mitigation}` : ""}`)
      : ["No open risks recorded."],
    topIssues,
    decisionsRequired,
  });

  r.h2("Overall Mobilization Progress");
  r.progressBar(roll.overallPct, "All sections");

  r.h2("Progress by Section");
  for (const section of MOBILIZATION_SECTIONS) {
    r.progressBar(roll.sectionPct[section] ?? 0, section);
  }

  // --------------------------------------------- 3. Project Information
  r.sectionBreak();
  r.h1("1. Project Information");
  r.keyValueGrid([
    ["Project Name", project.name],
    ["Project Number", project.number],
    ["Owner / Client", project.client],
    ["General Contractor", gcName],
    ["Address", project.address],
    ["Project Type", project.type],
    ["Status", project.status],
    ["Baseline Start", formatDate(project.startDate)],
    ["Baseline Finish", formatDate(project.endDate)],
    ["Contract Value", formatMoney(project.budget)],
    ["Reported Progress", `${project.progress}%`],
    ["Target Earthwork", daysToEarthwork === null
      ? "Not scheduled"
      : daysToEarthwork < 0 ? `${Math.abs(daysToEarthwork)} days late` : `In ${daysToEarthwork} days`],
  ], 2);
  r.h2("Section Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Project Information"), teamMap));

  // ------------------------------------------ 4. Mobilization Objectives
  r.h1("2. Mobilization Objectives");
  const objectives = itemsIn(roll.items, "Mobilization Objectives");
  r.bulletList(objectives.map((i) => i.description ? `${i.title} — ${i.description}` : i.title));
  r.h2("Status");
  r.checklist(toChecklist(objectives, teamMap));

  // ------------------------------------------------------ 5. Staffing Plan
  r.sectionBreak();
  r.h1("3. Staffing Plan");
  r.statRow([
    { label: "Assigned Staff", value: String(roll.staff.length) },
    { label: "Fully Onboarded", value: `${roll.staffOnboardedPct}%`, tone: roll.staffOnboardedPct >= 90 ? "green" : roll.staffOnboardedPct >= 60 ? "yellow" : "red" },
    { label: "Subcontractors", value: String(roll.subs.length) },
    { label: "Subs Ready", value: `${roll.subsReadyPct}%`, tone: roll.subsReadyPct >= 90 ? "green" : roll.subsReadyPct >= 60 ? "yellow" : "red" },
  ]);
  r.table(
    [
      { header: "Role", width: 92 }, { header: "Name", width: 96 },
      { header: "Start", width: 74 }, { header: "Orient.", width: 44, align: "center" },
      { header: "Drug Test", width: 52, align: "center" }, { header: "PPE", width: 34, align: "center" },
      { header: "Notes" },
    ],
    roll.staff.map((s) => {
      const m = teamMap.get(s.teamMemberId);
      return [
        m?.role ?? "—", m?.name ?? `#${s.teamMemberId}`, formatDate(s.startDate),
        yesNo(s.orientationDone), yesNo(s.drugTestDone), yesNo(s.ppeIssued), s.notes ?? "—",
      ];
    }),
  );

  r.h2("Subcontractor Onboarding");
  r.table(
    [
      { header: "Trade", width: 86 }, { header: "Company" }, { header: "Contact", width: 84 },
      { header: "Ins.", width: 34, align: "center" }, { header: "W-9", width: 34, align: "center" },
      { header: "MSA", width: 34, align: "center" }, { header: "On Site", width: 74 },
    ],
    roll.subs.map((s) => [
      s.trade, s.company, s.contactName ?? "—",
      yesNo(s.insuranceOnFile), yesNo(s.w9OnFile), yesNo(s.msaSigned), formatDate(s.onSiteDate),
    ]),
  );

  r.h2("Staffing Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Staffing Plan"), teamMap));

  // ---------------------------------------------------------- 6. Site Setup
  r.sectionBreak();
  r.h1("4. Site Setup");
  r.checklist(toChecklist(itemsIn(roll.items, "Site Setup"), teamMap));

  // ------------------------------------------------- 7. Temporary Utilities
  r.h1("5. Temporary Utilities");
  r.statRow([
    { label: "Utilities Tracked", value: String(roll.utilities.length) },
    { label: "Installed", value: `${roll.utilitiesInstalledPct}%`, tone: roll.utilitiesInstalledPct >= 90 ? "green" : "yellow" },
  ]);
  r.table(
    [
      { header: "Utility", width: 82 }, { header: "Provider", width: 100 },
      { header: "Requested", width: 76 }, { header: "Installed", width: 76 },
      { header: "Account #", width: 74 }, { header: "Notes" },
    ],
    roll.utilities.map((u) => [
      UTILITY_KIND_LABELS[u.kind as keyof typeof UTILITY_KIND_LABELS] ?? u.kind,
      u.provider ?? "—", formatDate(u.requestedDate), formatDate(u.installedDate),
      u.accountNumber ?? "—", u.notes ?? "—",
    ]),
  );
  r.h2("Utilities Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Temporary Utilities"), teamMap));

  // ---------------------------------------------- 8. Equipment Mobilization
  r.sectionBreak();
  r.h1("6. Equipment Mobilization");
  r.statRow([
    { label: "Equipment Tracked", value: String(roll.equipment.length) },
    { label: "On Site", value: `${roll.equipmentOnSitePct}%`, tone: roll.equipmentOnSitePct >= 90 ? "green" : "yellow" },
  ]);
  r.table(
    [
      { header: "Equipment" }, { header: "Vendor", width: 96 }, { header: "Arrival", width: 76 },
      { header: "On Site?", width: 52, align: "center" }, { header: "Departure", width: 76 },
      { header: "Notes", width: 96 },
    ],
    roll.equipment.map((e) => [
      e.name, e.vendor ?? "—", formatDate(e.arrivalDate),
      yesNo(e.onSiteConfirmed), formatDate(e.departureDate), e.notes ?? "—",
    ]),
  );
  r.h2("Equipment Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Equipment Mobilization"), teamMap));

  // -------------------------------------------------------------- 9. Permits
  r.sectionBreak();
  r.h1("7. Permits");
  r.statRow([
    { label: "Approved", value: String(roll.permitStatus.approved), tone: "green" },
    { label: "Pending", value: String(roll.permitStatus.pending), tone: roll.permitStatus.pending > 0 ? "yellow" : "default" },
    { label: "Not Started", value: String(roll.permitStatus.notStarted) },
    { label: "Blocked", value: String(roll.permitStatus.blocked), tone: roll.permitStatus.blocked > 0 ? "red" : "green" },
    { label: "Total", value: String(roll.permitStatus.total) },
  ]);
  if (blockedPermits.length) {
    r.callout(
      `${blockedPermits.length} permit${blockedPermits.length === 1 ? " is" : "s are"} rejected or expired and will block earthwork until resolved.`,
      "danger",
    );
  }
  r.table(
    [
      { header: "Permit" }, { header: "Agency", width: 92 }, { header: "Permit #", width: 74 },
      { header: "Status", width: 62, align: "center" }, { header: "Applied", width: 70 },
      { header: "Approved", width: 70 }, { header: "Expires", width: 70 },
    ],
    roll.permits.map((p) => [
      p.name, p.agency ?? "—", p.permitNumber ?? "—", p.status,
      formatDate(p.appliedDate), formatDate(p.approvedDate), formatDate(p.expirationDate),
    ]),
  );
  r.h2("Permits Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Permits"), teamMap));

  // --------------------------------------- 10. Procurement (Long-Lead Items)
  r.h1("8. Procurement — Long-Lead Items");
  r.checklist(toChecklist(itemsIn(roll.items, "Procurement"), teamMap));

  // ------------------------------------------------- 11. Safety Mobilization
  r.sectionBreak();
  r.h1("9. Safety Mobilization");
  r.statRow([
    { label: "Incidents", value: String(obs.safetyIncidents), tone: obs.safetyIncidents > 0 ? "red" : "green" },
    { label: "Near Misses", value: String(obs.nearMisses), tone: obs.nearMisses > 0 ? "yellow" : "green" },
    { label: "Quality Issues", value: String(obs.qualityIssues) },
  ]);
  r.p(
    `Field observations logged since project start (${formatDate(project.startDate)}). ` +
    "High and urgent safety observations are counted as incidents; all other safety observations are treated as near misses.",
    { muted: true },
  );
  r.checklist(toChecklist(itemsIn(roll.items, "Safety Mobilization"), teamMap));

  // ------------------------------------------------- 12. Environmental Plan
  r.h1("10. Environmental Plan");
  r.checklist(toChecklist(itemsIn(roll.items, "Environmental Plan"), teamMap));

  // ------------------------------------------------ 13. Communications Plan
  r.sectionBreak();
  r.h1("11. Communications Plan");
  r.checklist(toChecklist(itemsIn(roll.items, "Communications Plan"), teamMap));

  // ----------------------------------------------------- 14. Logistics Plan
  r.h1("12. Logistics Plan");
  r.checklist(toChecklist(itemsIn(roll.items, "Logistics Plan"), teamMap));

  // ----------------------------------------------------------- 15. Schedule
  r.sectionBreak();
  r.h1("13. Schedule");

  const sortedMilestones = [...roll.milestones].sort((a, b) => a.date.localeCompare(b.date));
  const ntp = sortedMilestones[0];
  r.table(
    [
      { header: "Milestone" }, { header: "Target Date", width: 96 },
      { header: "Status", width: 80 }, { header: "Days from NTP", width: 90, align: "right" },
    ],
    sortedMilestones.map((m) => {
      const offset = ntp ? Math.round((Date.parse(m.date) - Date.parse(ntp.date)) / 86_400_000) : null;
      return [m.title, formatDate(m.date), m.status, offset === null || !Number.isFinite(offset) ? "—" : String(offset)];
    }),
  );

  const earthwork = sortedMilestones.find((m) => m.title === EARTHWORK_MILESTONE_TITLE);
  const upcoming = sortedMilestones
    .filter((m) => m.date >= today)
    .slice(0, 6)
    .map((m) => ({ name: m.title, date: m.date, status: m.status }));

  r.scheduleSection({
    baselineStart: project.startDate,
    baselineEnd: project.endDate,
    currentStart: ntp?.date ?? project.startDate,
    currentEnd: earthwork?.date ?? project.endDate,
    percentComplete: roll.overallPct,
    // Positive = ahead. Earthwork already in the past with work outstanding
    // reads as days behind.
    daysAheadBehind: daysToEarthwork ?? 0,
    upcomingMilestones: upcoming,
    criticalPathNote:
      "Mobilization critical path runs Notice to Proceed → permits approved → temporary power energized → site office operational → earthwork. " +
      "Permit approval is the usual gating constraint.",
  });

  // ------------------------------------------------------ 16. Risk Register
  r.sectionBreak();
  r.h1("14. Risk Register");
  r.riskRegisterSection({
    risks: roll.risks.map((x) => ({
      risk: x.risk,
      likelihood: x.likelihood,
      impact: x.impact,
      mitigation: x.mitigation ?? "—",
      owner: x.ownerId != null ? (teamMap.get(x.ownerId)?.name ?? `#${x.ownerId}`) : "—",
      status: x.status,
    })),
  });
  r.h2("Risk Register Checklist");
  r.checklist(toChecklist(itemsIn(roll.items, "Risk Register"), teamMap));

  // ------------------------------------------ 17. Final Mobilization Checklist
  r.sectionBreak();
  r.h1("15. Final Mobilization Checklist");
  r.p("Go / no-go items. All must be complete before field work begins.");
  r.progressBar(roll.sectionPct["Mobilization Checklist"] ?? 0, "Go / no-go complete");
  r.checklist(toChecklist(itemsIn(roll.items, "Mobilization Checklist"), teamMap));
  r.h2("Overall Readiness");
  r.progressBar(roll.overallPct, "All sections");

  // -------------------------------------------- 18. Executive report sections
  r.sectionBreak();
  const revisedContract = project.budget + cos.approvedTotal;
  r.financialsSection({
    originalContract: project.budget,
    approvedChangeOrders: cos.approvedTotal,
    revisedContract,
    pendingChangeOrders: cos.pendingCount,
    unavailableSections: [
      "Cost to date, cost to complete, and estimate at completion — pending Cost Control module.",
      "Contingency tracking — pending Cost Control module.",
      "Pay application status — pending Billing module.",
      "Cash flow curve — pending Cost Control module.",
    ],
  });

  r.sectionBreak();
  r.qualitySection({
    openPunchItems: punch.openItems,
    unavailableSections: [
      "Non-conformance reports — pending Quality module.",
      "Inspection pass rate and testing log — pending Quality module.",
    ],
  });

  r.safetySection({
    incidentsThisPeriod: obs.safetyIncidents,
    nearMisses: obs.nearMisses,
    unavailableSections: [
      "Training hours — pending Safety module.",
      "TRIR and DART rates — pending Safety module.",
      "Corrective action log — pending Safety module.",
    ],
  });

  r.sectionBreak();
  r.rfiSubmittalCoSection({
    openRfis: rfi.openRfis,
    avgRfiResponseDays: rfi.avgResponseDays,
    topOpenRfis: rfi.topOpen,
    openSubmittals: submittals.openSubmittals,
    openChangeOrders: cos.pendingCount,
    pendingChangeOrderValue: cos.pendingValue,
  });

  r.manpowerSection({
    trades: labor.byTrade.map((t) => ({ trade: t.trade, headcount: t.headcount, hoursThisPeriod: t.hours })),
    totalHeadcount: labor.byTrade.reduce((s, t) => s + t.headcount, 0),
    totalHours: labor.totalHours,
  });

  // Look-ahead is driven off the mobilization milestones we already have rather
  // than left blank — the Schedule module will replace this with real activities.
  const lookAhead = sortedMilestones
    .filter((m) => {
      const d = daysUntil(m.date);
      return d !== null && d >= 0 && d <= 21;
    })
    .map((m) => ({
      activity: m.title,
      owner: findSigner(team, "Superintendent") || "Unassigned",
      startDate: m.date,
      blockers: blockedPermits.length ? "Permit approval outstanding" : undefined,
    }));
  r.sectionBreak();
  r.lookAheadSection({ weeks: 3, activities: lookAhead });
  r.p(
    "Look-ahead is derived from mobilization milestones falling in the next 21 days. " +
    "Activity-level detail will populate from the Schedule module.",
    { muted: true },
  );

  r.photosSection({
    captions: ["Site entrance & signage", "Temporary power drop", "Site office / trailer", "Laydown yard"],
    note: "Photo capture from the field kit is not yet wired into report generation; placeholders shown for the standard mobilization shots.",
  });

  // ---------------------------------------------------------- 19. Sign-off
  r.sectionBreak();
  r.signOffBlock({
    signers: SIGNER_ROLES.map((role) => ({ role, name: findSigner(team, role) })),
  });

  // ---------------------------------------------------------- 20. Appendix
  r.appendix(
    MOBILIZATION_SECTIONS.map((section) => ({
      title: section,
      body: DEFAULT_MOBILIZATION_ITEMS[section]
        .map((i, n) => `${n + 1}. ${i.title}${i.description ? ` — ${i.description}` : ""}`)
        .join("\n"),
    })),
  );

  r.end();
}
