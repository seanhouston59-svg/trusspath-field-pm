/**
 * Pre-Construction Plan — the comprehensive output of the Pre-Construction
 * module, and the document the Mobilization gate points at.
 *
 * Sixteen sections spanning design, permitting, prequal, buyout and long-lead
 * procurement. It renders its whole outline even when a section has no rows,
 * because a reader needs to see that permitting is empty, not to wonder whether
 * the report dropped it.
 */
import { ReportBuilder, formatDate, formatMoney, type StatChip } from "./engine";
import {
  DOC_COLS, docRows, RFI_COLS, rfiRows, VE_COLS, veRows,
  PERMIT_COLS, permitRows, PREQUAL_COLS, prequalRows,
  PACKAGE_COLS, packageRows, LONG_LEAD_COLS, longLeadRows,
  buyoutSummary, longLeadSummary, rfiSummary, groupByDiscipline,
  designPhaseLabel, permitTypeLabel, planStatusLabel,
  blank, text, sumMoney, daysUntil, personFor, reportMeta,
  type PreConstructionReportContext, type PreConstructionReportOptions,
} from "./pre-construction-shared";

/** Narratives that carry the plan's argument, in the order a reader wants them.
 *  The first three that exist become the executive summary's talking points. */
function summaryPoints(ctx: PreConstructionReportContext): string[] {
  const { preCon, health } = ctx;
  const points: string[] = [];

  const pct = health.designCompletionPercent;
  points.push(
    `Design is at ${designPhaseLabel(preCon.designPhase)}` +
    (pct == null ? "." : ` and ${pct}% complete.`),
  );

  if (health.permitsTotal === 0) {
    points.push("No permits have been logged yet.");
  } else {
    points.push(
      `${health.permitsIssued} of ${health.permitsTotal} permits issued, ` +
      `including ${health.criticalPermitsIssued} of ${health.criticalPermitsTotal} critical permits.`,
    );
  }

  if (health.bidPackagesTotal === 0) {
    points.push("No bid packages have been scoped yet.");
  } else {
    const b = buyoutSummary(ctx.bidPackages);
    points.push(
      `Buyout is ${b.boughtOutPct}% complete — ${health.bidPackagesBoughtOut} of ` +
      `${health.bidPackagesTotal} packages awarded or executed, ${formatMoney(b.awardedTotal)} committed.`,
    );
  }

  const rfi = rfiSummary(ctx.designRfis);
  if (rfi.open > 0) {
    points.push(`${rfi.open} design RFI${rfi.open === 1 ? "" : "s"} remain open.`);
  }
  if (health.longLeadItemsAtRisk > 0) {
    points.push(
      `${health.longLeadItemsAtRisk} long-lead item${health.longLeadItemsAtRisk === 1 ? " is" : "s are"} flagged at risk.`,
    );
  }
  return points;
}

function riskLines(ctx: PreConstructionReportContext): string[] {
  const risks: string[] = [];
  const missing = ctx.health.missingCriticalPermits;
  if (missing.length) {
    risks.push(`Critical permits not yet issued: ${missing.map(permitTypeLabel).join(", ")}.`);
  }
  const atRisk = ctx.longLeadItems.filter((l) => l.status === "at_risk");
  for (const l of atRisk.slice(0, 3)) {
    risks.push(
      `Long-lead item at risk: ${l.description}` +
      (l.expectedDeliveryDate ? ` (expected ${formatDate(l.expectedDeliveryDate)})` : ""),
    );
  }
  const openRfiCount = rfiSummary(ctx.designRfis).open;
  if (openRfiCount > 0) risks.push(`${openRfiCount} unanswered design RFI(s) holding scope open.`);
  if (!ctx.health.planApproved) risks.push("Pre-Construction Plan has not been approved.");
  return risks;
}

export function renderPreConstructionPlan(
  r: ReportBuilder,
  ctx: PreConstructionReportContext,
): void {
  const { preCon, health, project } = ctx;

  // ------------------------------------------------------------- 1. Cover
  r.coverPage(`${project.name} · ${project.number} · ${planStatusLabel(preCon.status)}`);

  // ------------------------------------------------- 2. Executive summary
  r.sectionBreak();
  r.h1("1. Executive Summary");
  const chips: StatChip[] = [
    { label: "Plan Complete", value: `${health.completePct}%` },
    { label: "Design", value: health.designCompletionPercent == null ? "—" : `${health.designCompletionPercent}%` },
    {
      label: "Permits",
      value: `${health.permitsIssued}/${health.permitsTotal}`,
      tone: health.missingCriticalPermits.length ? "red" : "green",
    },
    {
      label: "Buyout",
      value: `${health.bidPackagesBoughtOut}/${health.bidPackagesTotal}`,
      tone: health.bidPackagesTotal && health.bidPackagesBoughtOut === health.bidPackagesTotal ? "green" : "yellow",
    },
    {
      label: "Long-Lead At Risk",
      value: String(health.longLeadItemsAtRisk),
      tone: health.longLeadItemsAtRisk ? "red" : "green",
    },
    {
      label: "Plan Approved",
      value: health.planApproved ? "Yes" : "No",
      tone: health.planApproved ? "green" : "yellow",
    },
  ];
  r.statRow(chips);
  r.progressBar(health.completePct, "Pre-Construction readiness");
  r.bulletList(summaryPoints(ctx));

  r.h3("Top Risks");
  r.bulletList(riskLines(ctx).slice(0, 3));

  // ------------------------------------------------------- 3. Project team
  r.sectionBreak();
  r.h1("2. Project Team");
  r.p(
    "Pre-Construction ownership. Names left blank on the module are filled from the " +
    "project sign-off block and the charter stakeholder directory.",
    { muted: true },
  );
  const team: Array<[string, string]> = [
    ["Preconstruction Lead", text(preCon.preconLeadName || personFor(ctx, ["Preconstruction Lead"]))],
    ["Lead Phone", text(preCon.preconLeadPhone)],
    ["Lead Email", text(preCon.preconLeadEmail)],
    ["Chief Estimator", text(preCon.estimatorName || personFor(ctx, ["Chief Estimator", "Estimator"]))],
    ["Estimator Phone", text(preCon.estimatorPhone)],
    ["Estimator Email", text(preCon.estimatorEmail)],
    ["Design Manager", text(personFor(ctx, ["Design Manager"]))],
    ["Owner Representative", text(personFor(ctx, ["Owner Representative", "Owner Rep"]))],
    ["Architect of Record", text(personFor(ctx, ["Architect of Record", "Architect"]))],
    ["Engineer of Record", text(personFor(ctx, ["Engineer of Record", "Structural Engineer"]))],
    ["Project Executive", text(personFor(ctx, ["Project Executive"]))],
    ["Owner / Client", text(project.client)],
  ];
  r.keyValueGrid(team, 3);

  // ------------------------------------------------------- 4. Design status
  r.sectionBreak();
  r.h1("3. Design Status");
  r.keyValueGrid([
    ["Design Phase", designPhaseLabel(preCon.designPhase)],
    ["Design Complete", preCon.designCompletionPercent == null ? "—" : `${preCon.designCompletionPercent}%`],
    ["Documents Logged", String(ctx.designDocs.length)],
  ], 3);
  if (preCon.designCompletionPercent != null) {
    r.progressBar(preCon.designCompletionPercent, "Design completion");
  }
  const hasDesignNarrative = [
    preCon.designNarrative, preCon.designAssumptions, preCon.designExclusions, preCon.veStrategy,
  ].some((v) => !blank(v));
  if (!hasDesignNarrative) {
    r.p("No design narrative has been recorded.", { muted: true });
  }
  r.narrativeBlock("Design Narrative", preCon.designNarrative);
  r.narrativeBlock("Design Assumptions", preCon.designAssumptions);
  r.narrativeBlock("Design Exclusions", preCon.designExclusions);
  r.narrativeBlock("Value Engineering Strategy", preCon.veStrategy);

  // -------------------------------------------------- 5. Design deliverables
  r.sectionBreak();
  r.h1("4. Design Deliverables");
  const docGroups = groupByDiscipline(ctx.designDocs);
  if (!docGroups.length) {
    r.table(DOC_COLS, []);
  } else {
    for (const g of docGroups) {
      r.h2(`${g.label} (${g.rows.length})`);
      r.table(DOC_COLS, docRows(g.rows));
    }
  }

  // -------------------------------------------------------- 6. Design RFIs
  r.sectionBreak();
  r.h1("5. Design RFIs");
  const rfi = rfiSummary(ctx.designRfis);
  r.statRow([
    { label: "Open", value: String(rfi.open), tone: rfi.open ? "yellow" : "green" },
    { label: "Responded", value: String(rfi.responded) },
    { label: "Total Logged", value: String(ctx.designRfis.length) },
    { label: "Cost Impact", value: formatMoney(rfi.costImpact) },
    { label: "Schedule Impact", value: `${rfi.scheduleImpact} d` },
  ]);
  r.table(RFI_COLS, rfiRows(ctx.designRfis));

  // ------------------------------------------------- 7. Value engineering
  r.sectionBreak();
  r.h1("6. Value Engineering Log");
  const accepted = ctx.veItems.filter((v) => v.status === "accepted");
  const proposed = ctx.veItems.filter((v) => v.status === "proposed" || v.status === "held");
  r.statRow([
    { label: "Accepted", value: String(accepted.length), tone: "green" },
    { label: "Accepted Savings", value: formatMoney(sumMoney(accepted.map((v) => v.estimatedSavingsUsd))), tone: "green" },
    { label: "Open For Decision", value: String(proposed.length) },
    { label: "Open Value", value: formatMoney(sumMoney(proposed.map((v) => v.estimatedSavingsUsd))) },
    { label: "Total Logged", value: String(ctx.veItems.length) },
  ]);
  r.table(VE_COLS, veRows(ctx.veItems));

  // -------------------------------------------- 8. Constructability review
  r.sectionBreak();
  r.h1("7. Constructability Review");
  const hasConstructability = [
    preCon.constructabilitySummary, preCon.constructabilityFindings,
    preCon.siteConditionsNotes, preCon.logisticsConsiderations,
  ].some((v) => !blank(v));
  if (!hasConstructability) r.p("No constructability review has been recorded.", { muted: true });
  r.narrativeBlock("Summary", preCon.constructabilitySummary);
  r.narrativeBlock("Findings", preCon.constructabilityFindings);
  r.narrativeBlock("Site Conditions", preCon.siteConditionsNotes);
  r.narrativeBlock("Logistics Considerations", preCon.logisticsConsiderations);

  // ------------------------------------------------- 9. Permitting strategy
  r.sectionBreak();
  r.h1("8. Permitting Strategy");
  const permitDelta = daysUntil(preCon.permitTargetDate);
  r.keyValueGrid([
    ["Permit Target", formatDate(preCon.permitTargetDate)],
    ["Permit Received", formatDate(preCon.permitReceivedDate)],
    [
      "Target Status",
      preCon.permitReceivedDate
        ? "Received"
        : permitDelta == null
          ? "—"
          : permitDelta >= 0 ? `${permitDelta} days remaining` : `${Math.abs(permitDelta)} days overdue`,
    ],
  ], 3);
  r.narrativeBlock("Permitting Strategy", preCon.permitStrategy);
  r.narrativeBlock("Jurisdictional Notes", preCon.jurisdictionalNarrative);
  r.narrativeBlock("Open Conditions", preCon.openConditionsNarrative);

  // ---- 10. Critical permit callout, ahead of the register so the gate verdict
  // reads before its evidence and can't be stranded on a page of its own.
  r.h2("Critical Permit Status");
  if (health.missingCriticalPermits.length) {
    r.callout(
      `${health.missingCriticalPermits.length} critical permit(s) not yet issued: ` +
      `${health.missingCriticalPermits.map(permitTypeLabel).join(", ")}. ` +
      "Mobilization is gated until each of these is issued.",
      "danger",
    );
  } else if (health.permitsTotal === 0) {
    r.callout(
      "No permits have been logged for this project yet, so critical-permit status cannot be " +
      "assessed. Add the permit register before relying on this plan for Mobilization.",
      "warn",
    );
  } else {
    r.callout(
      `All critical permits accounted for — ${health.criticalPermitsIssued} of ` +
      `${health.criticalPermitsTotal} issued.`,
      "success",
    );
  }

  r.h2("Permit Register");
  r.table(PERMIT_COLS, permitRows(ctx.permits));
  r.p("* Critical permit — gates Mobilization.", { muted: true });

  // ------------------------------------- 11. Prequalification and bidding
  r.sectionBreak();
  r.h1("9. Prequalification & Bidding Strategy");
  r.statRow([
    { label: "Subs Tracked", value: String(health.prequalTotal) },
    { label: "Approved", value: String(health.prequalApproved), tone: health.prequalApproved ? "green" : "yellow" },
    {
      label: "Declined",
      value: String(ctx.prequalSubs.filter((s) => s.prequalStatus === "declined").length),
    },
    {
      label: "Expired",
      value: String(ctx.prequalSubs.filter((s) => s.prequalStatus === "expired").length),
      tone: ctx.prequalSubs.some((s) => s.prequalStatus === "expired") ? "red" : "default",
    },
  ]);
  r.narrativeBlock("Bid Strategy", preCon.bidStrategy);
  r.narrativeBlock("Prequalification Criteria", preCon.prequalCriteria);
  r.narrativeBlock("Bidder Outreach", preCon.bidderOutreachNarrative);
  r.h2("Prequalified Subcontractors");
  r.table(PREQUAL_COLS, prequalRows(ctx.prequalSubs));

  // ---------------------------------------------------- 12. Buyout strategy
  r.sectionBreak();
  r.h1("10. Buyout Strategy");
  const buyout = buyoutSummary(ctx.bidPackages);
  const buyoutDelta = daysUntil(preCon.buyoutTargetDate);
  r.keyValueGrid([
    ["Buyout Target", formatDate(preCon.buyoutTargetDate)],
    ["Buyout Complete", formatDate(preCon.buyoutCompleteDate)],
    [
      "Target Status",
      preCon.buyoutCompleteDate
        ? "Complete"
        : buyoutDelta == null
          ? "—"
          : buyoutDelta >= 0 ? `${buyoutDelta} days remaining` : `${Math.abs(buyoutDelta)} days overdue`,
    ],
  ], 3);
  r.narrativeBlock("Buyout Strategy", preCon.buyoutStrategy);
  r.narrativeBlock("Long-Lead Strategy", preCon.longLeadStrategy);
  r.narrativeBlock("Delivery Risk", preCon.deliveryRiskNarrative);
  r.h2("Bid Packages");
  r.table(PACKAGE_COLS, packageRows(ctx.bidPackages));
  r.statRow([
    { label: "Bought Out", value: `${buyout.boughtOut}/${ctx.bidPackages.length}` },
    { label: "Estimated", value: formatMoney(buyout.estimatedTotal) },
    { label: "Awarded", value: formatMoney(buyout.awardedTotal) },
    {
      label: buyout.variance >= 0 ? "Savings" : "Overrun",
      value: formatMoney(Math.abs(buyout.variance)),
      tone: buyout.variance >= 0 ? "green" : "red",
    },
  ]);

  // ------------------------------------------------------ 13. Long-lead items
  r.sectionBreak();
  r.h1("11. Long-Lead Items");
  const lead = longLeadSummary(ctx.longLeadItems);
  r.statRow([
    { label: "Ordered", value: `${lead.ordered}/${ctx.longLeadItems.length}` },
    { label: "Delivered", value: String(lead.delivered), tone: "green" },
    { label: "At Risk", value: String(lead.atRisk), tone: lead.atRisk ? "red" : "green" },
    { label: "PO Value", value: formatMoney(lead.poTotal) },
  ]);
  r.table(LONG_LEAD_COLS, longLeadRows(ctx.longLeadItems));
  const atRisk = ctx.longLeadItems.filter((l) => l.status === "at_risk");
  if (atRisk.length) {
    r.callout(
      `At risk: ${atRisk.map((l) => l.description).join("; ")}.`,
      "danger",
    );
  }

  // --------------------------------- 14. Risks, assumptions, issues, steps
  r.sectionBreak();
  r.h1("12. Risks, Assumptions, Open Issues & Next Steps");
  const hasOverall = [
    preCon.overallRisks, preCon.overallAssumptions, preCon.openIssues, preCon.nextSteps,
  ].some((v) => !blank(v));
  if (!hasOverall) {
    r.p("No overall risks, assumptions, issues or next steps have been recorded.", { muted: true });
    r.h3("Derived Risks");
    r.bulletList(riskLines(ctx));
  }
  r.narrativeBlock("Risks", preCon.overallRisks);
  r.narrativeBlock("Assumptions", preCon.overallAssumptions);
  r.narrativeBlock("Open Issues", preCon.openIssues);
  r.narrativeBlock("Next Steps", preCon.nextSteps);

  // --------------------------------------------------- 15. Plan approval
  r.sectionBreak();
  r.h1("13. Plan Approval");
  if (preCon.preconPlanApprovedAt) {
    const approvedOn = formatDate(preCon.preconPlanApprovedAt.slice(0, 10));
    r.callout(
      `Approved ${approvedOn}` + (ctx.approver ? ` by ${ctx.approver.name}` : "") + ".",
      "success",
    );
    r.keyValueGrid([
      ["Approved At", approvedOn],
      ["Approved By", text(ctx.approver?.name)],
      ["Approver Email", text(ctx.approver?.email)],
      ["Module Status", planStatusLabel(preCon.status)],
    ], 2);
  } else {
    r.callout(
      "Not yet approved. This plan is a working document until the Preconstruction Lead " +
      "and Project Executive approve it in Command Deck → Pre-Construction.",
      "warn",
    );
  }

  // ------------------------------------------------------- 16. Signatures
  r.sectionBreak();
  r.signOffBlock({
    signers: ctx.signatures.map((s) => ({
      role: s.role,
      name: s.name ?? "",
      date: s.signedDate ?? undefined,
    })),
  });
}

export function preConstructionPlanMeta(
  ctx: PreConstructionReportContext,
  opts: PreConstructionReportOptions,
) {
  return reportMeta(ctx, "Pre-Construction Plan", opts, [
    "CEO", "Project Executive", "Preconstruction Lead", "Chief Estimator", "Owner",
  ]);
}
