/**
 * Buyout Plan — the procurement read of Pre-Construction.
 *
 * The Pre-Construction Plan reports buyout as two tables and a stat row. This
 * document is what the estimating team works from: packages bucketed by where
 * they are in the award cycle, the prequal roster that can bid them, and the
 * long-lead register with its order and delivery dates side by side.
 *
 * The engine's table has no per-row styling, so at-risk long-lead items are
 * flagged with a marker and a footnote — the same device the Plan uses for
 * critical permits.
 */
import { ReportBuilder, formatDate, formatMoney } from "./engine";
import {
  buyoutSummary, longLeadSummary, signaturesFor, reportMeta,
  planStatusLabel, packageStatusLabel, prequalStatusLabel, leadStatusLabel,
  blank, text, money, sumMoney, daysUntil,
  type PreConstructionReportContext, type PreConstructionReportOptions,
} from "./pre-construction-shared";
import type {
  PreConstructionBidPackage, PreConstructionLongLeadItem,
} from "@shared/schema";

/** Roles that sign a buyout plan. */
const BUYOUT_ROLES = ["Preconstruction Lead", "Chief Estimator", "Project Executive"];

/** Marks a long-lead row the delivery-risk section repeats in full. */
const AT_RISK_MARK = " *";

/* --------------------------------- prequal -------------------------------- */

/**
 * Insurance and prequal expiries sit next to each other because a sub whose
 * coverage lapses before the package is awarded cannot hold the award. The
 * Plan's version of this table carries limits and EMR instead; this one is
 * about whether the roster is still current.
 */
const PREQUAL_COLS = [
  { header: "Company" }, { header: "Trade", width: 66 }, { header: "Status", width: 74 },
  { header: "Prequal'd", width: 62 }, { header: "Expires", width: 62 },
  { header: "Ins. Exp.", width: 62 },
  { header: "Bond Cap.", width: 70, align: "right" as const },
];

/* ------------------------------- bid packages ----------------------------- */

const PACKAGE_COLS = [
  { header: "Pkg #", width: 42 }, { header: "Package" }, { header: "CSI", width: 36 },
  { header: "Estimated", width: 72, align: "right" as const },
  { header: "Bid Due", width: 62 }, { header: "Awarded To", width: 86 },
  { header: "Awarded", width: 72, align: "right" as const },
];

function packageRows(rows: PreConstructionBidPackage[]): string[][] {
  return rows.map((b) => [
    text(b.packageNumber), b.label, text(b.csiDivision), money(b.estimatedValueUsd),
    formatDate(b.bidDueDate), text(b.awardedTo), money(b.awardedValueUsd),
  ]);
}

/**
 * Packages bucketed by award stage, in the order they move through it. Anything
 * off that path — not ready, on hold, an off-catalog status — collects in a
 * trailing bucket so no package is dropped from the totals a reader checks
 * against.
 */
const AWARD_STAGES = ["out_for_bid", "bids_received", "awarded", "contract_executed"];

function packageGroups(
  rows: PreConstructionBidPackage[],
): Array<{ label: string; rows: PreConstructionBidPackage[] }> {
  const groups = AWARD_STAGES
    .map((value) => ({
      label: packageStatusLabel(value),
      rows: rows.filter((b) => (b.status ?? "") === value),
    }))
    .filter((g) => g.rows.length > 0);
  const staged = new Set(AWARD_STAGES);
  const rest = rows.filter((b) => !staged.has(b.status ?? ""));
  if (rest.length) groups.push({ label: "Not in the award cycle", rows: rest });
  return groups;
}

/* ------------------------------ long-lead items --------------------------- */

const LONG_LEAD_COLS = [
  { header: "Item #", width: 44 }, { header: "Description" }, { header: "Supplier", width: 72 },
  { header: "PO #", width: 52 }, { header: "Ordered", width: 62 },
  { header: "Expected", width: 62 }, { header: "Status", width: 66 },
  { header: "Lead", width: 34, align: "right" as const },
];

function longLeadRows(rows: PreConstructionLongLeadItem[]): string[][] {
  return rows.map((l) => [
    text(l.itemNumber) + (l.status === "at_risk" ? AT_RISK_MARK : ""),
    l.description, text(l.supplier), text(l.poNumber),
    formatDate(l.orderedDate), formatDate(l.expectedDeliveryDate),
    leadStatusLabel(l.status), l.leadTimeWeeks == null ? "—" : `${l.leadTimeWeeks}w`,
  ]);
}

/** Delivered-against-expected, split out so the procurement table above can
 *  keep the order-side columns without running past the right margin. */
const DELIVERY_COLS = [
  { header: "Item #", width: 44 }, { header: "Description" },
  { header: "Expected", width: 66 }, { header: "Delivered", width: 66 },
  { header: "Variance", width: 62, align: "right" as const },
  { header: "PO Value", width: 74, align: "right" as const },
];

/** Whole days between two ISO dates; positive means the item landed late. */
function deliveryVariance(l: PreConstructionLongLeadItem): string {
  if (!l.expectedDeliveryDate || !l.actualDeliveryDate) return "—";
  const a = Date.parse(l.expectedDeliveryDate);
  const b = Date.parse(l.actualDeliveryDate);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "—";
  const d = Math.round((b - a) / 86_400_000);
  return d === 0 ? "On time" : d > 0 ? `${d}d late` : `${Math.abs(d)}d early`;
}

const AT_RISK_COLS = [
  { header: "Item #", width: 44 }, { header: "Description" }, { header: "Supplier", width: 84 },
  { header: "Expected", width: 66 }, { header: "Alternatives", width: 160 },
];

/* --------------------------------- render --------------------------------- */

export function renderBuyoutPlan(
  r: ReportBuilder,
  ctx: PreConstructionReportContext,
): void {
  const { preCon, health, project } = ctx;

  // ------------------------------------------------------------- 1. Cover
  r.coverPage(`${project.name} · ${project.number} · ${planStatusLabel(preCon.status)}`);

  // ---------------------------------------------------- 2. Buyout strategy
  r.sectionBreak();
  r.h1("1. Buyout Strategy");
  if (blank(preCon.buyoutStrategy) && blank(preCon.longLeadStrategy)) {
    r.p("No buyout or long-lead strategy has been recorded.", { muted: true });
  }
  r.narrativeBlock("Buyout Strategy", preCon.buyoutStrategy);
  r.narrativeBlock("Long-Lead Strategy", preCon.longLeadStrategy);

  // ----------------------------------------------------- 3. Target vs actual
  r.h1("2. Target vs Actual");
  const delta = daysUntil(preCon.buyoutTargetDate);
  r.keyValueGrid([
    ["Buyout Target", formatDate(preCon.buyoutTargetDate)],
    ["Buyout Complete", formatDate(preCon.buyoutCompleteDate)],
    [
      "Target Status",
      preCon.buyoutCompleteDate
        ? "Complete"
        : delta == null
          ? "—"
          : delta >= 0 ? `${delta} days remaining` : `${Math.abs(delta)} days overdue`,
    ],
  ], 3);
  if (!preCon.buyoutCompleteDate && delta != null && delta < 0) {
    r.callout(
      `Buyout is ${Math.abs(delta)} days past its ${formatDate(preCon.buyoutTargetDate)} target ` +
      `with ${health.bidPackagesTotal - health.bidPackagesBoughtOut} of ` +
      `${health.bidPackagesTotal} packages still to award.`,
      "warn",
    );
  }

  // ----------------------------------------- 4. Prequalified subcontractors
  r.sectionBreak();
  r.h1("3. Prequalified Subcontractors");
  r.narrativeBlock("Prequalification Criteria", preCon.prequalCriteria);
  r.table(PREQUAL_COLS, ctx.prequalSubs.map((s) => [
    s.companyName, text(s.trade), prequalStatusLabel(s.prequalStatus),
    formatDate(s.prequalDate), formatDate(s.prequalExpires),
    formatDate(s.insuranceExpires), money(s.bondCapacity),
  ]));
  const lapsed = ctx.prequalSubs.filter((s) => s.prequalStatus === "expired");
  if (lapsed.length) {
    r.callout(
      `Prequalification has lapsed for ${lapsed.map((s) => s.companyName).join(", ")}. ` +
      "A lapsed sub cannot hold an award until the packet is renewed.",
      "warn",
    );
  }

  // -------------------------------------------------------- 5. Bid packages
  r.sectionBreak();
  r.h1("4. Bid Packages");
  r.p("Grouped by where each package sits in the award cycle.", { muted: true });
  const groups = packageGroups(ctx.bidPackages);
  if (!groups.length) {
    r.table(PACKAGE_COLS, []);
  } else {
    for (const g of groups) {
      r.h2(`${g.label} (${g.rows.length})`);
      r.table(PACKAGE_COLS, packageRows(g.rows));
    }
  }
  const buyout = buyoutSummary(ctx.bidPackages);
  r.h2("Totals");
  r.table(
    [
      { header: "Scope" },
      { header: "Estimated", width: 120, align: "right" as const },
      { header: "Awarded", width: 120, align: "right" as const },
    ],
    [[
      `All packages (${ctx.bidPackages.length})`,
      formatMoney(buyout.estimatedTotal),
      formatMoney(buyout.awardedTotal),
    ]],
  );

  // ------------------------------------------------- 6. Summary metrics
  r.sectionBreak();
  r.h1("5. Buyout Summary");
  const savings = buyout.variance >= 0;
  // Four chips, not five: a nine-figure total needs ~100pt at the chip's 14pt
  // face, and five chips leave 78pt — the cents wrap onto a second line. The
  // bought-out percentage is on the progress bar directly below.
  r.statRow([
    { label: "Estimated", value: formatMoney(buyout.estimatedTotal) },
    { label: "Awarded", value: formatMoney(buyout.awardedTotal) },
    {
      label: savings ? "Savings" : "Overrun",
      value: formatMoney(Math.abs(buyout.variance)),
      tone: savings ? "green" : "red",
    },
    {
      label: "Bought Out",
      value: `${health.bidPackagesBoughtOut}/${health.bidPackagesTotal}`,
      tone: health.bidPackagesTotal && health.bidPackagesBoughtOut === health.bidPackagesTotal
        ? "green" : "yellow",
    },
  ]);
  r.progressBar(buyout.boughtOutPct, "Packages bought out");
  r.p(
    `${savings ? "Savings" : "Overrun"} compares each award against its own estimate across the ` +
    `${buyout.boughtOut} bought-out package(s) only. Measuring the total award against the full ` +
    "estimate would read as a saving for every package nobody has bid yet.",
    { muted: true },
  );

  // -------------------------------------------- 7. Long-lead procurement
  r.sectionBreak();
  r.h1("6. Long-Lead Procurement Plan");
  const lead = longLeadSummary(ctx.longLeadItems);
  r.statRow([
    { label: "Ordered", value: `${lead.ordered}/${ctx.longLeadItems.length}` },
    { label: "Delivered", value: String(lead.delivered), tone: "green" },
    { label: "At Risk", value: String(lead.atRisk), tone: lead.atRisk ? "red" : "green" },
    { label: "PO Value", value: formatMoney(lead.poTotal) },
  ]);
  r.table(LONG_LEAD_COLS, longLeadRows(ctx.longLeadItems));
  r.p("* At risk — detailed in section 7.", { muted: true });

  r.h2("Delivery Performance");
  r.table(DELIVERY_COLS, ctx.longLeadItems.map((l) => [
    text(l.itemNumber), l.description,
    formatDate(l.expectedDeliveryDate), formatDate(l.actualDeliveryDate),
    deliveryVariance(l), money(l.poValueUsd),
  ]));

  // ----------------------------------------------------- 8. Delivery risk
  r.sectionBreak();
  r.h1("7. Delivery Risk Assessment");
  const atRisk = ctx.longLeadItems.filter((l) => l.status === "at_risk");
  if (!atRisk.length) {
    r.callout("No long-lead item is flagged at risk.", "success");
  } else {
    r.callout(
      `${atRisk.length} long-lead item${atRisk.length === 1 ? " is" : "s are"} flagged at risk, ` +
      `covering ${formatMoney(sumMoney(atRisk.map((l) => l.poValueUsd)))} of committed purchase orders.`,
      "danger",
    );
  }
  r.narrativeBlock("Delivery Risk", preCon.deliveryRiskNarrative);
  if (atRisk.length) {
    r.h2("At-Risk Items");
    r.table(AT_RISK_COLS, atRisk.map((l) => [
      text(l.itemNumber), l.description, text(l.supplier),
      formatDate(l.expectedDeliveryDate), text(l.alternatives),
    ]));
    for (const l of atRisk.filter((x) => !blank(x.notes))) {
      r.h3(`${text(l.itemNumber)} — recovery`);
      r.p(l.notes ?? "");
    }
  }

  // -------------------------------------------------------- 9. Signatures
  r.sectionBreak();
  const signers = signaturesFor(ctx.signatures, BUYOUT_ROLES);
  if (!signers.length) {
    r.h1("8. Buyout Sign-Off");
    r.p(
      "No buyout signers are on the Pre-Construction sign-off block. Add the " +
      "Preconstruction Lead, Chief Estimator and Project Executive in " +
      "Command Deck → Pre-Construction → Signatures.",
      { muted: true },
    );
  } else {
    r.signOffBlock({ signers });
  }
}

export function buyoutPlanMeta(
  ctx: PreConstructionReportContext,
  opts: PreConstructionReportOptions,
) {
  return reportMeta(ctx, "Buyout Plan", opts, [
    "Project Executive", "Preconstruction Lead", "Chief Estimator", "CEO",
  ]);
}
