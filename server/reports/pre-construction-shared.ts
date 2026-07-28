/**
 * Shared vocabulary for the Pre-Construction PDFs.
 *
 * The Plan renders all nine pre-con tables; the Design Review Report and the
 * Buyout Plan re-render subsets of the same rows. Keeping the row builders and
 * money math here means the three documents cannot end up with three different
 * opinions about what an empty cell or an unparseable bid value looks like.
 *
 * The context type is deliberately structural rather than the full Project row:
 * these reports read nine project columns, and narrowing lets the fixture
 * harness build a context without inventing a whole database record.
 */
import { formatDate, formatMoney, type ReportMeta } from "./engine";
import {
  DESIGN_DISCIPLINES, DOC_TYPES, DESIGN_DOC_STATUSES, DESIGN_RFI_STATUSES,
  DESIGN_RFI_IMPACTS, VE_STATUSES, PERMIT_TYPES, PERMIT_STATUSES,
  PREQUAL_STATUSES, BID_PACKAGE_STATUSES, LONG_LEAD_STATUSES,
  DESIGN_PHASES, PRE_CONSTRUCTION_STATUSES, CRITICAL_PERMIT_TYPES,
} from "@shared/pre-construction-catalog";
import type {
  Project, PreConstruction, PreConstructionDesignDoc, PreConstructionDesignRfi,
  PreConstructionVeItem, PreConstructionPermit, PreConstructionPrequalSub,
  PreConstructionBidPackage, PreConstructionLongLeadItem, PreConstructionSignature,
  ProjectSetupStakeholder,
} from "@shared/schema";
import type { PreConstructionHealth } from "../pre-construction-health";

/** The project columns these reports actually render. */
export type ReportProject = Pick<
  Project,
  "name" | "number" | "client" | "address" | "type" | "status" | "startDate" | "endDate" | "budget"
>;

export type PreConstructionReportContext = {
  project: ReportProject;
  /** Renders as the General Contractor on the cover. */
  gcName: string;
  preCon: PreConstruction;
  health: PreConstructionHealth;
  designDocs: PreConstructionDesignDoc[];
  designRfis: PreConstructionDesignRfi[];
  veItems: PreConstructionVeItem[];
  permits: PreConstructionPermit[];
  prequalSubs: PreConstructionPrequalSub[];
  bidPackages: PreConstructionBidPackage[];
  longLeadItems: PreConstructionLongLeadItem[];
  signatures: PreConstructionSignature[];
  /** Charter directory, used to fill team roles the pre-con row leaves blank. */
  stakeholders: ProjectSetupStakeholder[];
  /** Resolved from preconPlanApprovedById; null when unapproved or unknown. */
  approver: { name: string; email: string } | null;
};

/** Per-request cover-page inputs. The renderers take these separately from the
 *  data so the fixture harness can name itself without faking a session. */
export type PreConstructionReportOptions = {
  preparedBy: string;
  preparedByRole?: string;
  revision?: string;
};

/* ------------------------------- labelling -------------------------------- */

function labelMap(defs: ReadonlyArray<{ value: string; label: string }>): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.value, d.label]));
}

const DISCIPLINE = labelMap(DESIGN_DISCIPLINES);
const DOC_TYPE = labelMap(DOC_TYPES);
const DOC_STATUS = labelMap(DESIGN_DOC_STATUSES);
const RFI_STATUS = labelMap(DESIGN_RFI_STATUSES);
const RFI_IMPACT = labelMap(DESIGN_RFI_IMPACTS);
const VE_STATUS = labelMap(VE_STATUSES);
const PERMIT_TYPE = labelMap(PERMIT_TYPES);
const PERMIT_STATUS = labelMap(PERMIT_STATUSES);
const PREQUAL_STATUS = labelMap(PREQUAL_STATUSES);
const PACKAGE_STATUS = labelMap(BID_PACKAGE_STATUSES);
const LEAD_STATUS = labelMap(LONG_LEAD_STATUSES);
const PHASE = labelMap(DESIGN_PHASES);
const PLAN_STATUS = labelMap(PRE_CONSTRUCTION_STATUSES);

/** Catalog values are the persisted strings, so anything off-catalog — a legacy
 *  row, a hand-edited value — prints as-is rather than vanishing. */
function label(map: Record<string, string>, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v ? (map[v] ?? v) : "—";
}

const disciplineLabel = (v: string | null | undefined) => label(DISCIPLINE, v);
const docTypeLabel = (v: string | null | undefined) => label(DOC_TYPE, v);
const docStatusLabel = (v: string | null | undefined) => label(DOC_STATUS, v);
const rfiStatusLabel = (v: string | null | undefined) => label(RFI_STATUS, v);
const rfiImpactLabel = (v: string | null | undefined) => label(RFI_IMPACT, v);
const veStatusLabel = (v: string | null | undefined) => label(VE_STATUS, v);
export const permitTypeLabel = (v: string | null | undefined) => label(PERMIT_TYPE, v);
const permitStatusLabel = (v: string | null | undefined) => label(PERMIT_STATUS, v);
const prequalStatusLabel = (v: string | null | undefined) => label(PREQUAL_STATUS, v);
const packageStatusLabel = (v: string | null | undefined) => label(PACKAGE_STATUS, v);
const leadStatusLabel = (v: string | null | undefined) => label(LEAD_STATUS, v);
export const designPhaseLabel = (v: string | null | undefined) => label(PHASE, v);
export const planStatusLabel = (v: string | null | undefined) => label(PLAN_STATUS, v);

export function text(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  return s || "—";
}

export function blank(v: string | null | undefined): boolean {
  return !(v ?? "").trim();
}

function days(v: number | null | undefined): string {
  return v == null ? "—" : String(v);
}

/* --------------------------------- money ---------------------------------- */

/**
 * Money columns are text so a numeric round-trip can't shift a bid value, which
 * means a total has to parse them. Anything unparseable contributes zero to a
 * sum rather than poisoning it with NaN.
 */
function parseMoney(v: string | null | undefined): number | null {
  const s = (v ?? "").replace(/[$,\s]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function money(v: string | null | undefined): string {
  const n = parseMoney(v);
  return n === null ? text(v) : formatMoney(n);
}

export function sumMoney(values: Array<string | null | undefined>): number {
  return values.reduce((s, v) => s + (parseMoney(v) ?? 0), 0);
}

/* ------------------------------ date helpers ------------------------------ */

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Whole days from today to an ISO date; negative when already past. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.round((t - Date.parse(TODAY())) / 86_400_000);
}

/* ------------------------------- grouping --------------------------------- */

/** Docs grouped in catalog order, with off-catalog disciplines last so a row
 *  with a blank or legacy discipline still prints. */
export function groupByDiscipline<T extends { discipline: string | null }>(
  rows: T[],
): Array<{ label: string; rows: T[] }> {
  const groups: Array<{ label: string; rows: T[] }> = DESIGN_DISCIPLINES
    .map((d) => ({ label: d.label as string, rows: rows.filter((r) => r.discipline === d.value) }))
    .filter((g) => g.rows.length > 0);
  const known = new Set<string>(DESIGN_DISCIPLINES.map((d) => d.value));
  const orphans = rows.filter((r) => !known.has(r.discipline ?? ""));
  if (orphans.length) groups.push({ label: "Unassigned discipline", rows: orphans });
  return groups;
}

/* -------------------------------- people ---------------------------------- */

/**
 * A person for a role, preferring the pre-con sign-off block (authored for this
 * document) and falling back to the charter directory. Returns an empty string
 * rather than an em dash so callers can test for presence.
 */
export function personFor(
  ctx: Pick<PreConstructionReportContext, "signatures" | "stakeholders">,
  roles: string[],
): string {
  const wanted = roles.map((r) => r.toLowerCase());
  const signed = ctx.signatures.find(
    (s) => wanted.includes(s.role.trim().toLowerCase()) && (s.name ?? "").trim(),
  );
  if (signed) return (signed.name ?? "").trim();
  const stake = ctx.stakeholders.find(
    (s) => wanted.includes(s.role.trim().toLowerCase()) && (s.name ?? "").trim(),
  );
  return (stake?.name ?? "").trim();
}

/* ------------------------------ row builders ------------------------------ */

/**
 * Column widths share a 504pt budget (LETTER less margins) and each cell loses
 * 10pt to padding. The unweighted column absorbs the remainder, but the engine
 * floors it at 40pt, so over-specifying the fixed widths pushes the table past
 * the right margin instead of failing loudly — the fixed widths below leave at
 * least ~96pt for the flexible column. Columns dropped for space (RFI response
 * date, prequal contact and phone, award date, order date) stay visible in the
 * app; this is the executive read, not the audit trail.
 */
export const DOC_COLS = [
  { header: "Document" }, { header: "Type", width: 74 }, { header: "Rev", width: 40 },
  { header: "Issued", width: 72 }, { header: "Status", width: 64 },
];

export function docRows(rows: PreConstructionDesignDoc[]): string[][] {
  return rows.map((d) => [
    d.label, docTypeLabel(d.docType), text(d.revision),
    formatDate(d.issuedDate), docStatusLabel(d.status),
  ]);
}

export function rfiRows(rows: PreConstructionDesignRfi[]): string[][] {
  return rows.map((r) => [
    text(r.rfiNumber), r.subject, disciplineLabel(r.discipline), rfiStatusLabel(r.status),
    rfiImpactLabel(r.impact), formatDate(r.askedDate),
    money(r.costImpactUsd), days(r.scheduleImpactDays),
  ]);
}

export const RFI_COLS = [
  { header: "RFI #", width: 50 }, { header: "Subject" }, { header: "Discipline", width: 60 },
  { header: "Status", width: 48 }, { header: "Impact", width: 54 },
  { header: "Asked", width: 62 },
  { header: "Cost", width: 70, align: "right" as const }, { header: "Days", width: 34, align: "right" as const },
];

export function veRows(rows: PreConstructionVeItem[]): string[][] {
  return rows.map((v) => [
    text(v.veNumber), v.description, disciplineLabel(v.discipline), veStatusLabel(v.status),
    money(v.estimatedSavingsUsd), days(v.scheduleImpactDays), formatDate(v.decisionDate),
  ]);
}

export const VE_COLS = [
  { header: "VE #", width: 48 }, { header: "Description" }, { header: "Discipline", width: 66 },
  { header: "Status", width: 58 }, { header: "Est. Savings", width: 74, align: "right" as const },
  { header: "Days", width: 34, align: "right" as const }, { header: "Decided", width: 66 },
];

export function permitRows(rows: PreConstructionPermit[]): string[][] {
  return rows.map((p) => [
    permitTypeLabel(p.permitType) + (CRITICAL_PERMIT_TYPES.includes(p.permitType ?? "") ? " *" : ""),
    text(p.permitNumber), text(p.jurisdiction), permitStatusLabel(p.status),
    formatDate(p.applicationDate), formatDate(p.issuedDate), formatDate(p.expirationDate),
  ]);
}

export const PERMIT_COLS = [
  { header: "Type", width: 76 }, { header: "Permit #", width: 82 }, { header: "Jurisdiction" },
  { header: "Status", width: 72 }, { header: "Applied", width: 62 },
  { header: "Issued", width: 62 }, { header: "Expires", width: 62 },
];

export function prequalRows(rows: PreConstructionPrequalSub[]): string[][] {
  return rows.map((s) => [
    s.companyName, text(s.trade),
    prequalStatusLabel(s.prequalStatus), money(s.insuranceLimit), money(s.bondCapacity),
    text(s.emrRating), formatDate(s.prequalExpires),
  ]);
}

export const PREQUAL_COLS = [
  { header: "Company" }, { header: "Trade", width: 66 }, { header: "Prequal", width: 64 },
  { header: "Ins. Limit", width: 70, align: "right" as const },
  { header: "Bond Cap.", width: 70, align: "right" as const },
  { header: "EMR", width: 34, align: "right" as const }, { header: "Expires", width: 62 },
];

export function packageRows(rows: PreConstructionBidPackage[]): string[][] {
  return rows.map((b) => [
    text(b.packageNumber), b.label, text(b.csiDivision), packageStatusLabel(b.status),
    money(b.estimatedValueUsd), String(b.bidsReceivedCount), text(b.awardedTo),
    money(b.awardedValueUsd),
  ]);
}

export const PACKAGE_COLS = [
  { header: "Pkg #", width: 40 }, { header: "Package" }, { header: "CSI", width: 38 },
  { header: "Status", width: 66 }, { header: "Estimated", width: 70, align: "right" as const },
  { header: "Bids", width: 32, align: "right" as const }, { header: "Awarded To", width: 80 },
  { header: "Awarded", width: 70, align: "right" as const },
];

export function longLeadRows(rows: PreConstructionLongLeadItem[]): string[][] {
  return rows.map((l) => [
    text(l.itemNumber), l.description, text(l.supplier), leadStatusLabel(l.status),
    l.leadTimeWeeks == null ? "—" : `${l.leadTimeWeeks}w`,
    formatDate(l.expectedDeliveryDate), formatDate(l.actualDeliveryDate),
    money(l.poValueUsd),
  ]);
}

export const LONG_LEAD_COLS = [
  { header: "Item #", width: 42 }, { header: "Description" }, { header: "Supplier", width: 74 },
  { header: "Status", width: 66 }, { header: "Lead", width: 34, align: "right" as const },
  { header: "Expected", width: 62 }, { header: "Delivered", width: 62 },
  { header: "PO Value", width: 70, align: "right" as const },
];

/* ------------------------------- summaries -------------------------------- */

/** Statuses that mean the item is physically here or installed. */
const ARRIVED = new Set(["delivered", "installed"]);
const ORDERED = new Set(["ordered", "in_fabrication", "shipped", "delivered", "installed"]);

export function longLeadSummary(rows: PreConstructionLongLeadItem[]): {
  ordered: number; delivered: number; atRisk: number; poTotal: number;
} {
  return {
    ordered: rows.filter((l) => ORDERED.has(l.status ?? "")).length,
    delivered: rows.filter((l) => ARRIVED.has(l.status ?? "")).length,
    atRisk: rows.filter((l) => l.status === "at_risk").length,
    poTotal: sumMoney(rows.map((l) => l.poValueUsd)),
  };
}

/** Packages counted as bought out — the same pair the health rollup uses. */
const BOUGHT_OUT = new Set(["awarded", "contract_executed"]);

export function buyoutSummary(rows: PreConstructionBidPackage[]): {
  boughtOut: number;
  estimatedTotal: number;
  awardedTotal: number;
  /** Estimate minus award across bought-out packages only: comparing an award
   *  against packages nobody has bid would read as a fake saving. */
  variance: number;
  boughtOutPct: number;
} {
  const awarded = rows.filter((b) => BOUGHT_OUT.has(b.status ?? ""));
  const estimatedTotal = sumMoney(rows.map((b) => b.estimatedValueUsd));
  const awardedTotal = sumMoney(awarded.map((b) => b.awardedValueUsd));
  const awardedEstimate = sumMoney(awarded.map((b) => b.estimatedValueUsd));
  return {
    boughtOut: awarded.length,
    estimatedTotal,
    awardedTotal,
    variance: awardedEstimate - awardedTotal,
    boughtOutPct: rows.length ? Math.round((awarded.length / rows.length) * 100) : 0,
  };
}

/** An RFI still waiting on the design team. `void` is closed, not open. */
function openRfis(rows: PreConstructionDesignRfi[]): PreConstructionDesignRfi[] {
  return rows.filter((r) => (r.status ?? "open") === "open");
}

export function rfiSummary(rows: PreConstructionDesignRfi[]): {
  open: number; responded: number; costImpact: number; scheduleImpact: number;
} {
  const responded = rows.filter((r) => r.status === "answered" || r.status === "closed");
  return {
    open: openRfis(rows).length,
    responded: responded.length,
    costImpact: sumMoney(rows.map((r) => r.costImpactUsd)),
    scheduleImpact: rows.reduce((s, r) => s + (r.scheduleImpactDays ?? 0), 0),
  };
}

/* --------------------------------- cover ---------------------------------- */

/** Whichever jurisdiction the permit rows agree on, for the cover block. The
 *  pre-con row has no jurisdiction column and reaching into the mobilization
 *  plan for one would couple these reports to a downstream module. */
function primaryJurisdiction(permits: PreConstructionPermit[]): string | null {
  const counts = new Map<string, number>();
  for (const p of permits) {
    const j = (p.jurisdiction ?? "").trim();
    if (j) counts.set(j, (counts.get(j) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  counts.forEach((n, j) => { if (n > bestN) { best = j; bestN = n; } });
  return best;
}

/** Red once a critical permit is missing or a long-lead item is at risk, yellow
 *  while the plan is unapproved, green when both are settled. */
function healthTone(health: PreConstructionHealth): "green" | "yellow" | "red" {
  if (health.missingCriticalPermits.length || health.longLeadItemsAtRisk > 0) return "red";
  if (!health.planApproved) return "yellow";
  return "green";
}

export function reportMeta(
  ctx: PreConstructionReportContext,
  title: string,
  opts: PreConstructionReportOptions,
  distribution: string[],
): ReportMeta {
  return {
    title,
    projectName: ctx.project.name,
    projectNumber: ctx.project.number,
    owner: ctx.project.client,
    gcName: ctx.gcName,
    address: ctx.project.address,
    reportingPeriod: `As of ${formatDate(TODAY())}`,
    preparedBy: opts.preparedBy,
    preparedByRole: opts.preparedByRole,
    distribution,
    revision: opts.revision ?? "Rev 0",
    health: healthTone(ctx.health),
    phase: designPhaseLabel(ctx.preCon.designPhase),
    jurisdiction: primaryJurisdiction(ctx.permits),
    ownerRep: personFor(ctx, ["Owner Representative", "Owner Rep"]) || null,
    architect: personFor(ctx, ["Architect of Record", "Architect"]) || null,
    engineerOfRecord: personFor(ctx, ["Engineer of Record", "Structural Engineer"]) || null,
  };
}

/** `pre-construction-plan-1042.pdf` — safe for a Content-Disposition value. */
export function reportFilename(slug: string, project: ReportProject): string {
  const num = (project.number ?? "").trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug}-${num || "project"}.pdf`;
}
