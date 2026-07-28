/**
 * Design Review Report — the coordination read of Pre-Construction.
 *
 * Where the Pre-Construction Plan summarises design in one section, this report
 * is the design meeting's working document: every open RFI printed in full so
 * the answer can be written against it, the resolved ones reduced to a table,
 * and value engineering split by whether a decision has been made.
 *
 * Open RFIs and accepted VE items render as per-item blocks rather than table
 * rows because their question, response and decision text are paragraphs — a
 * table cell would either wrap them into an unreadable column or clip them.
 */
import { ReportBuilder, formatDate, formatMoney } from "./engine";
import {
  groupByDiscipline, signaturesFor, reportMeta,
  designPhaseLabel, planStatusLabel, disciplineLabel, docTypeLabel, docStatusLabel,
  rfiStatusLabel, rfiImpactLabel, veStatusLabel,
  blank, text, days, money, sumMoney,
  type PreConstructionReportContext, type PreConstructionReportOptions,
} from "./pre-construction-shared";
import type {
  PreConstructionDesignDoc, PreConstructionDesignRfi, PreConstructionVeItem,
} from "@shared/schema";

/** Roles that sign a design review. */
const COORDINATION_ROLES = [
  "Design Manager", "Architect of Record", "Engineer of Record", "Preconstruction Lead",
];

/* ------------------------------- deliverables ----------------------------- */

/**
 * Same 504pt budget as the Plan's tables, with the received date the Plan drops
 * — a design review cares about the gap between issued and in-hand.
 */
const DOC_COLS = [
  { header: "Type", width: 74 }, { header: "Document" }, { header: "Rev", width: 44 },
  { header: "Issued", width: 62 }, { header: "Received", width: 62 },
  { header: "Status", width: 64 },
];

/** Trailing integer of a revision label, so `Rev 10` sorts above `Rev 9`. */
function revisionRank(v: string | null | undefined): number {
  const m = /(\d+)\s*$/.exec((v ?? "").trim());
  return m ? parseInt(m[1], 10) : -1;
}

/**
 * Grouped by label so a document's revision history reads as one block, newest
 * revision first. Labels themselves stay in alphabetical order rather than the
 * module's sort order: this is a register to look a sheet up in.
 */
function docRows(rows: PreConstructionDesignDoc[]): string[][] {
  return [...rows]
    .sort((a, b) =>
      a.label.localeCompare(b.label) ||
      revisionRank(b.revision) - revisionRank(a.revision) ||
      (b.revision ?? "").localeCompare(a.revision ?? ""))
    .map((d) => [
      docTypeLabel(d.docType), d.label, text(d.revision),
      formatDate(d.issuedDate), formatDate(d.receivedDate), docStatusLabel(d.status),
    ]);
}

/* ----------------------------------- RFIs --------------------------------- */

/** A blank status is treated as open — an unanswered question is the default
 *  state of a row somebody just typed. */
function isOpen(r: PreConstructionDesignRfi): boolean {
  const s = (r.status ?? "").trim();
  return s === "" || s === "open";
}

const RESOLVED_RFI_COLS = [
  { header: "RFI #", width: 52 }, { header: "Subject" }, { header: "Discipline", width: 62 },
  { header: "Status", width: 52 }, { header: "Responded", width: 66 },
  { header: "Cost", width: 70, align: "right" as const },
  { header: "Days", width: 34, align: "right" as const },
];

/** Cost and schedule read as an impact pair, so the grid states both even when
 *  the row logs neither. */
function impactCells(r: { costImpactUsd: string | null; scheduleImpactDays: number | null }) {
  return [
    ["Cost Impact", money(r.costImpactUsd)] as [string, string],
    ["Schedule Impact", r.scheduleImpactDays == null ? "—" : `${r.scheduleImpactDays} days`] as [string, string],
  ];
}

function rfiBlock(r: ReportBuilder, rfi: PreConstructionDesignRfi): void {
  r.h2(`${text(rfi.rfiNumber)} — ${rfi.subject}`);
  r.keyValueGrid([
    ["Discipline", disciplineLabel(rfi.discipline)],
    ["Status", rfiStatusLabel(rfi.status)],
    ["Impact", rfiImpactLabel(rfi.impact)],
    ["Asked", formatDate(rfi.askedDate)],
    ...impactCells(rfi),
  ], 3);
  if (blank(rfi.question)) r.p("No question text recorded.", { muted: true });
  r.narrativeBlock("Question", rfi.question);
  r.narrativeBlock("Response To Date", rfi.response);
  r.narrativeBlock("Notes", rfi.notes);
}

/* ---------------------------- value engineering --------------------------- */

const VE_SUMMARY_COLS = [
  { header: "VE #", width: 50 }, { header: "Description" }, { header: "Discipline", width: 66 },
  { header: "Est. Savings", width: 78, align: "right" as const },
  { header: "Days", width: 34, align: "right" as const }, { header: "Decided", width: 66 },
];

function veSummaryRows(rows: PreConstructionVeItem[]): string[][] {
  return rows.map((v) => [
    text(v.veNumber), v.description, disciplineLabel(v.discipline),
    money(v.estimatedSavingsUsd), days(v.scheduleImpactDays), formatDate(v.decisionDate),
  ]);
}

function veBlock(r: ReportBuilder, v: PreConstructionVeItem): void {
  r.h2(`${text(v.veNumber)} — ${v.description}`);
  r.keyValueGrid([
    ["Discipline", disciplineLabel(v.discipline)],
    ["Status", veStatusLabel(v.status)],
    ["Estimated Savings", money(v.estimatedSavingsUsd)],
    ["Schedule Impact", v.scheduleImpactDays == null ? "—" : `${v.scheduleImpactDays} days`],
    ["Proposed", formatDate(v.proposedDate)],
    ["Decided", formatDate(v.decisionDate)],
  ], 3);
  if (blank(v.decisionNotes)) r.p("No decision notes recorded.", { muted: true });
  r.narrativeBlock("Decision", v.decisionNotes);
  r.narrativeBlock("Notes", v.notes);
}

/* --------------------------------- render --------------------------------- */

export function renderDesignReviewReport(
  r: ReportBuilder,
  ctx: PreConstructionReportContext,
): void {
  const { preCon, project } = ctx;

  // ------------------------------------------------------------- 1. Cover
  r.coverPage(`${project.name} · ${project.number} · ${planStatusLabel(preCon.status)}`);

  // --------------------------------------------------- 2. Design snapshot
  r.sectionBreak();
  r.h1("1. Design Status");
  const openRfis = ctx.designRfis.filter(isOpen);
  const resolvedRfis = ctx.designRfis.filter((x) => !isOpen(x));
  // Phase and completion are text, and a stat chip renders its value at 14pt in
  // roughly 100pt of width — "Construction Documents" would wrap mid-word. The
  // grid takes the labels, the chips take the counts.
  r.keyValueGrid([
    ["Design Phase", designPhaseLabel(preCon.designPhase)],
    [
      "Design Complete",
      preCon.designCompletionPercent == null ? "—" : `${preCon.designCompletionPercent}%`,
    ],
    ["Plan Status", planStatusLabel(preCon.status)],
  ], 3);
  r.statRow([
    { label: "Documents", value: String(ctx.designDocs.length) },
    { label: "Open RFIs", value: String(openRfis.length), tone: openRfis.length ? "yellow" : "green" },
    { label: "Resolved RFIs", value: String(resolvedRfis.length) },
    { label: "VE Logged", value: String(ctx.veItems.length) },
  ]);
  if (preCon.designCompletionPercent != null) {
    r.progressBar(preCon.designCompletionPercent, "Design completion");
  }
  if (blank(preCon.designNarrative)) {
    r.p("No design narrative has been recorded.", { muted: true });
  }
  r.narrativeBlock("Design Narrative", preCon.designNarrative);

  // ------------------------------------------------- 3. Deliverables register
  r.sectionBreak();
  r.h1("2. Design Deliverables Register");
  r.p(
    "Grouped by discipline, then by document. Rows sharing a document name are its " +
    "revision history, newest first.",
    { muted: true },
  );
  const groups = groupByDiscipline(ctx.designDocs);
  if (!groups.length) {
    r.table(DOC_COLS, []);
  } else {
    for (const g of groups) {
      r.h2(`${g.label} (${g.rows.length})`);
      r.table(DOC_COLS, docRows(g.rows));
    }
  }

  // -------------------------------------------------------- 4. Open RFIs
  r.sectionBreak();
  r.h1("3. Open Design RFIs");
  if (!openRfis.length) {
    r.callout("No design RFIs are open. Every logged question has an answer on record.", "success");
  } else {
    r.callout(
      `${openRfis.length} design RFI${openRfis.length === 1 ? "" : "s"} awaiting a response, ` +
      `carrying ${formatMoney(sumMoney(openRfis.map((x) => x.costImpactUsd)))} of unresolved cost ` +
      `and ${openRfis.reduce((s, x) => s + (x.scheduleImpactDays ?? 0), 0)} days of unresolved schedule impact.`,
      openRfis.length > 2 ? "warn" : "info",
    );
    for (const rfi of openRfis) rfiBlock(r, rfi);
  }

  // ---------------------------------------------------- 5. Resolved RFIs
  r.sectionBreak();
  r.h1("4. Resolved Design RFIs");
  r.p(
    "Answered, closed and withdrawn RFIs. The status column distinguishes a question " +
    "that was answered from one that was voided without one.",
    { muted: true },
  );
  r.table(RESOLVED_RFI_COLS, resolvedRfis.map((x) => [
    text(x.rfiNumber), x.subject, disciplineLabel(x.discipline), rfiStatusLabel(x.status),
    formatDate(x.respondedDate), money(x.costImpactUsd), days(x.scheduleImpactDays),
  ]));

  // ------------------------------------------------- 6. Value engineering
  r.sectionBreak();
  r.h1("5. Value Engineering");
  const accepted = ctx.veItems.filter((v) => v.status === "accepted");
  const rejected = ctx.veItems.filter((v) => v.status === "rejected");
  const pending = ctx.veItems.filter((v) => v.status === "proposed" || v.status === "held");
  // Four chips, not five: a money value needs ~100pt at the chip's 14pt face, and
  // five chips leave 78pt. The rejected count lives in its sub-heading instead.
  r.statRow([
    { label: "Accepted", value: String(accepted.length), tone: "green" },
    { label: "Accepted Savings", value: formatMoney(sumMoney(accepted.map((v) => v.estimatedSavingsUsd))), tone: "green" },
    { label: "Awaiting Decision", value: String(pending.length), tone: pending.length ? "yellow" : "green" },
    { label: "Open Value", value: formatMoney(sumMoney(pending.map((v) => v.estimatedSavingsUsd))) },
  ]);
  r.narrativeBlock("Value Engineering Strategy", preCon.veStrategy);

  r.h1(`5.1 Accepted (${accepted.length})`);
  if (!accepted.length) {
    r.p("No value engineering has been accepted.", { muted: true });
  } else {
    for (const v of accepted) veBlock(r, v);
  }

  r.h1(`5.2 Rejected (${rejected.length})`);
  r.table(VE_SUMMARY_COLS, veSummaryRows(rejected));
  const reasons = rejected.filter((v) => !blank(v.decisionNotes));
  if (reasons.length) {
    // One list rather than a heading and a paragraph per item: a per-item heading
    // strands itself at the foot of a page when its prose doesn't fit below it.
    r.h2("Reasons");
    r.bulletList(reasons.map((v) => `${text(v.veNumber)} — ${v.decisionNotes?.trim()}`));
  }

  r.h1(`5.3 Awaiting Decision (${pending.length})`);
  if (!pending.length) {
    r.p("No value engineering is awaiting a decision.", { muted: true });
  } else {
    r.bulletList(pending.map((v) =>
      `${text(v.veNumber)} — ${v.description} (${veStatusLabel(v.status)}, ` +
      `${money(v.estimatedSavingsUsd)} estimated)`,
    ));
  }

  // ------------------------------------------- 7. Constructability findings
  r.sectionBreak();
  r.h1("6. Constructability Findings");
  if (blank(preCon.constructabilityFindings) && blank(preCon.constructabilitySummary)) {
    r.p("No constructability review has been recorded.", { muted: true });
  }
  r.narrativeBlock("Findings", preCon.constructabilityFindings);
  r.narrativeBlock("Summary", preCon.constructabilitySummary);

  // --------------------------------------- 8. Assumptions and exclusions
  r.sectionBreak();
  r.h1("7. Design Assumptions & Exclusions");
  if (blank(preCon.designAssumptions) && blank(preCon.designExclusions)) {
    r.p("No design assumptions or exclusions have been recorded.", { muted: true });
  }
  r.narrativeBlock("Assumptions", preCon.designAssumptions);
  r.narrativeBlock("Exclusions", preCon.designExclusions);

  // ------------------------------------------- 9. Coordination signatures
  r.sectionBreak();
  const signers = signaturesFor(ctx.signatures, COORDINATION_ROLES);
  if (!signers.length) {
    r.h1("8. Coordination Sign-Off");
    r.p(
      "No design coordination signers are on the Pre-Construction sign-off block. " +
      "Add the Design Manager, Architect of Record and Engineer of Record in " +
      "Executive OS → Pre-Construction → Signatures.",
      { muted: true },
    );
  } else {
    r.signOffBlock({ signers });
  }
}

export function designReviewReportMeta(
  ctx: PreConstructionReportContext,
  opts: PreConstructionReportOptions,
) {
  return reportMeta(ctx, "Design Review Report", opts, [
    "Design Manager", "Architect of Record", "Engineer of Record",
    "Preconstruction Lead", "Project Executive",
  ]);
}
