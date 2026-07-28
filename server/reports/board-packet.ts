/**
 * Board packet PDF renderer.
 *
 * Assembles an executive-facing PDF combining:
 *   - Cover page with org name + reporting period
 *   - Portfolio health summary (project counts, active/at-risk breakdown)
 *   - Financial rollup (org-wide + per-project table)
 *   - Consolidated risk register (all mobilization risks across projects)
 *   - Sign-off block
 *
 * All data is pre-loaded by the caller and passed in; this module owns the
 * PDF layout and nothing else. That mirrors the pattern already used by
 * mobilization-plan.ts / project-charter.ts / kickoff-agenda.ts.
 */

import type { Project } from "@shared/schema";
import { storage } from "../storage";
import type { FinancialsRollup, ProjectFinancials } from "../financials-rollup";
import {
  ReportBuilder,
  formatMoney,
  type ReportMeta,
  type Tone,
} from "./engine";

export type BoardPacketInput = {
  orgName: string;
  projects: Project[];
  rollup: FinancialsRollup;
  preparedBy: string;
  preparedByRole?: string;
  /** e.g. "Q3 2026" or "July 2026". Optional \u2014 falls back to current month. */
  period?: string;
};

/**
 * Format a number as compact USD ("$1.2M", "$248K") when large, full otherwise.
 * Board packets are read at portfolio scale so headline chips need to fit
 * without wrapping. `formatMoney` from engine.ts handles the fine-grained
 * per-project table cells.
 */
function formatCompactMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return formatMoney(n);
}

/** Choose a stat-chip tone based on how much of the revised contract is committed. */
function committedTone(pct: number | null): Tone {
  if (pct === null) return "default";
  if (pct >= 95) return "red";
  if (pct >= 80) return "yellow";
  return "green";
}

/** Health inferred from project status text; kept lenient because status
 *  strings vary across seeds and older rows. */
function projectHealth(status: string | null | undefined): {
  label: string;
  tone: Tone;
} {
  const s = (status ?? "").trim().toLowerCase();
  if (!s || s === "planning" || s === "pre-construction") return { label: "Planning", tone: "default" };
  if (s.includes("hold") || s.includes("paused")) return { label: "On Hold", tone: "yellow" };
  if (s.includes("behind") || s.includes("delayed") || s.includes("at risk")) return { label: "At Risk", tone: "red" };
  if (s.includes("complete") || s.includes("closed")) return { label: "Complete", tone: "green" };
  return { label: "Active", tone: "green" };
}

/**
 * Render a board packet into the given writable stream. Owns pipe + end.
 * Errors are thrown \u2014 the caller decides whether to close the response
 * with a partial PDF or a JSON 500.
 */
export async function generateBoardPacket(
  stream: NodeJS.WritableStream,
  input: BoardPacketInput,
): Promise<void> {
  const { orgName, projects, rollup, preparedBy, preparedByRole, period } = input;

  // Fetch mobilization risks for every project once. Sequential to be
  // conservative with the Neon pool on large portfolios; risks tables are
  // small so per-project latency dominates anyway.
  //
  // NOTE: The Executive OS "Risk Register" lean module (slug: risk-register)
  // stores generic items in lean_module_items and is a separate surface for
  // cross-lifecycle risk tracking outside the mobilization gate. It is NOT
  // consolidated into the board packet yet — consumers should treat the board
  // risk table as the mobilization-derived view. Future work: merge both.

  const allRisks: Array<{
    projectName: string;
    risk: string;
    likelihood: string;
    impact: string;
    mitigation: string;
    owner: string;
    status: string;
  }> = [];
  for (const p of projects) {
    const rows = await storage.getMobilizationRisks(p.id).catch(() => []);
    for (const r of rows) {
      allRisks.push({
        projectName: p.name,
        risk: r.risk,
        likelihood: (r.likelihood ?? "med").toUpperCase(),
        impact: (r.impact ?? "med").toUpperCase(),
        mitigation: r.mitigation ?? "—",
        owner: "—", // ownerId → team_members lookup omitted for now; ownerId is nullable and portfolio-wide name resolution is out of scope for MVP
        status: r.status ?? "open",
      });
    }
  }

  // Sort highest-severity first so the risk table starts with the rows a
  // board would ask about. Score = likelihood*3 + impact (impact weighted 1x,
  // likelihood weighted 3x is arbitrary but pushes "high likelihood" up top).
  const sev = (s: string): number =>
    s.toLowerCase().startsWith("hig") ? 3 : s.toLowerCase().startsWith("med") ? 2 : 1;
  allRisks.sort(
    (a, b) => sev(b.likelihood) + sev(b.impact) - (sev(a.likelihood) + sev(a.impact)),
  );

  const meta: ReportMeta = {
    title: "Board Packet",
    projectName: orgName,
    projectNumber: `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    owner: orgName,
    gcName: "—",
    address: "Portfolio-wide",
    reportingPeriod: period ?? new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    preparedBy,
    preparedByRole: preparedByRole ?? "Executive Team",
  };

  const b = new ReportBuilder(meta);
  b.pipe(stream);

  // ----- Cover -----
  b.coverPage(`Portfolio review \u2014 ${meta.reportingPeriod}`);

  // ----- Portfolio Summary -----
  b.h1("Portfolio Summary");

  const activeCount = projects.filter((p) => {
    const h = projectHealth(p.status);
    return h.label !== "Complete";
  }).length;
  const atRiskCount = projects.filter((p) => projectHealth(p.status).tone === "red").length;
  const onHoldCount = projects.filter((p) => projectHealth(p.status).label === "On Hold").length;

  b.statRow([
    { label: "Projects", value: String(projects.length) },
    { label: "Active", value: String(activeCount) },
    { label: "At Risk", value: String(atRiskCount), tone: atRiskCount > 0 ? "red" : "default" },
    { label: "On Hold", value: String(onHoldCount), tone: onHoldCount > 0 ? "yellow" : "default" },
  ]);

  b.table(
    [
      { header: "Project" },
      { header: "Status", width: 76, align: "center" },
      { header: "Budget", width: 78, align: "right" },
      { header: "Revised", width: 78, align: "right" },
      { header: "Committed", width: 78, align: "right" },
      { header: "Committed %", width: 68, align: "right" },
    ],
    projects.map((p) => {
      const f = rollup.projects.find((r) => r.projectId === p.id);
      const health = projectHealth(p.status);
      return [
        p.name,
        health.label,
        formatCompactMoney(f?.budget ?? p.budget),
        formatCompactMoney(f?.revisedContract ?? null),
        formatCompactMoney(f?.committedCost ?? null),
        f?.committedPct !== null && f?.committedPct !== undefined
          ? `${f.committedPct.toFixed(0)}%`
          : "—",
      ];
    }),
  );

  // ----- Financial Rollup -----
  b.h1("Financial Rollup");

  const totals = rollup.orgTotals;
  b.statRow([
    { label: "Approved Budget", value: formatCompactMoney(totals.budget) },
    { label: "Revised Contract", value: formatCompactMoney(totals.revisedContract) },
    { label: "Committed", value: formatCompactMoney(totals.committedCost) },
    {
      label: "Pending COs",
      value: formatCompactMoney(totals.pendingChangeOrders),
      tone: totals.pendingChangeOrders > 0 ? "yellow" : "default",
    },
  ]);

  b.keyValueGrid([
    ["Original contract value", formatMoney(totals.originalContract)],
    ["Approved change orders", `${formatMoney(totals.approvedChangeOrders)} (${totals.approvedCoCount})`],
    ["Revised contract value", formatMoney(totals.revisedContract)],
    ["Pending change orders", `${formatMoney(totals.pendingChangeOrders)} (${totals.pendingCoCount})`],
    ["Subcontract commitments", `${formatMoney(totals.subcontractCommitments)} (${totals.bidPackageCount})`],
    ["PO / long-lead commitments", `${formatMoney(totals.poCommitments)} (${totals.poCount})`],
    ["Total committed cost", formatMoney(totals.committedCost)],
    ["Value engineering savings", formatMoney(totals.veSavings)],
    ["Design RFI cost exposure", formatMoney(totals.designRfiCostExposure)],
  ], 2);

  if (rollup.projects.length > 0) {
    b.h2("Per-project financials");
    b.table(
      [
        { header: "Project" },
        { header: "Contract", width: 74, align: "right" },
        { header: "Appr. COs", width: 66, align: "right" },
        { header: "Pend. COs", width: 66, align: "right" },
        { header: "Committed", width: 74, align: "right" },
        { header: "% Committed", width: 66, align: "right" },
      ],
      rollup.projects.map((f: ProjectFinancials) => [
        f.projectName,
        formatCompactMoney(f.revisedContract),
        formatCompactMoney(f.approvedChangeOrders),
        formatCompactMoney(f.pendingChangeOrders),
        formatCompactMoney(f.committedCost),
        f.committedPct !== null ? `${f.committedPct.toFixed(0)}%` : "—",
      ]),
    );
  }

  // ----- Risk register -----
  b.h1("Portfolio Risk Register");
  if (allRisks.length === 0) {
    b.p("No open risks recorded across any project.", { muted: true });
  } else {
    b.table(
      [
        { header: "Project", width: 90 },
        { header: "Risk" },
        { header: "L", width: 26, align: "center" },
        { header: "I", width: 26, align: "center" },
        { header: "Mitigation", width: 130 },
        { header: "Status", width: 54, align: "center" },
      ],
      allRisks.map((r) => [
        r.projectName,
        r.risk,
        r.likelihood.charAt(0),
        r.impact.charAt(0),
        r.mitigation,
        r.status,
      ]),
    );
  }

  // ----- Sign-off -----
  b.signOffBlock({
    signers: [
      { role: "Prepared by", name: preparedBy },
      { role: "CEO", name: "" },
      { role: "CFO", name: "" },
      { role: "Board Chair", name: "" },
    ],
  });

  b.end();
}
