/**
 * Renders all three Pre-Construction PDFs from fixture data — no database.
 *
 * Unlike script/fixture-mobilization-pdf.ts, which re-states its report's
 * section order by hand, this calls the real renderers. The synthetic bundle is
 * deliberately awkward — an unissued critical permit, at-risk long-lead items,
 * a package awarded over its estimate, a negative RFI cost impact — so the
 * branches a clean project never reaches still get drawn.
 *
 * Run: npm run fixture:pre-con-pdf -- [outDir]
 */
import { createWriteStream, statSync, readFileSync } from "fs";
import { ReportBuilder } from "../server/reports/engine";
import { computePreConstructionHealth } from "../server/pre-construction-health";
import {
  renderPreConstructionPlan, preConstructionPlanMeta,
} from "../server/reports/pre-construction-plan";
import {
  renderDesignReviewReport, designReviewReportMeta,
} from "../server/reports/design-review-report";
import { renderBuyoutPlan, buyoutPlanMeta } from "../server/reports/buyout-plan";
import type {
  PreConstructionReportContext, PreConstructionReportOptions,
} from "../server/reports/pre-construction-shared";
import type {
  PreConstruction, PreConstructionDesignDoc, PreConstructionDesignRfi,
  PreConstructionVeItem, PreConstructionPermit, PreConstructionPrequalSub,
  PreConstructionBidPackage, PreConstructionLongLeadItem, PreConstructionSignature,
  ProjectSetupStakeholder,
} from "../shared/schema";

const PROJECT_ID = 1;

/** Row factory: fills the columns the fixture doesn't care about so each literal
 *  below states only what the report actually renders. */
function rows<T extends { id: number; projectId: number; sortOrder: number }>(
  base: Omit<T, "id" | "projectId" | "sortOrder">,
  overrides: Array<Partial<T>>,
): T[] {
  return overrides.map((o, i) => ({
    ...base,
    id: i + 1,
    projectId: PROJECT_ID,
    sortOrder: i,
    ...o,
  }) as T);
}

/* ------------------------------- design docs ------------------------------ */

const designDocs = rows<PreConstructionDesignDoc>(
  {
    discipline: "architectural", docType: "drawing_set", label: "", revision: null,
    issuedDate: null, receivedDate: null, status: "current", location: null, notes: null,
  },
  [
    // Two rows share this label so the deliverables table shows a superseded
    // revision sitting alongside the current one.
    { label: "Architectural Drawing Set", revision: "Rev 3", issuedDate: "2026-05-18", status: "current" },
    { label: "Architectural Drawing Set", revision: "Rev 2", issuedDate: "2026-03-02", status: "superseded" },
    { label: "Enlarged Plans & Details", docType: "sketch", revision: "Rev 1", issuedDate: "2026-05-22" },
    { label: "Division 09 Finishes", docType: "spec_section", revision: "Rev 0", issuedDate: "2026-04-11" },
    { discipline: "structural", label: "Structural Drawing Set", revision: "Rev 2", issuedDate: "2026-05-14" },
    { discipline: "structural", label: "Foundation Design Narrative", docType: "narrative", revision: "Rev 1", issuedDate: "2026-04-28" },
    { discipline: "structural", label: "Geotechnical Report", docType: "report", revision: "Final", issuedDate: "2026-01-30" },
    { discipline: "mep", label: "MEP Coordination Set", revision: "Rev 4", issuedDate: "2026-05-26" },
    { discipline: "mep", label: "Addendum 3 — Mechanical Scope", docType: "addendum", revision: "Add 3", issuedDate: "2026-06-02" },
    { discipline: "mep", label: "Division 23 HVAC", docType: "spec_section", revision: "Rev 1", issuedDate: "2026-04-19", status: "pending" },
    { discipline: "civil", label: "Civil Site & Utility Plan", revision: "Rev 2", issuedDate: "2026-05-08" },
    { discipline: "civil", label: "Stormwater Bulletin 1", docType: "bulletin", revision: "Bull 1", issuedDate: "2026-06-09", status: "pending" },
  ],
);

/* ---------------------------------- RFIs ---------------------------------- */

const designRfis = rows<PreConstructionDesignRfi>(
  {
    rfiNumber: null, subject: "", discipline: "architectural", question: null, response: null,
    status: "open", askedById: null, askedDate: null, respondedById: null, respondedDate: null,
    impact: "none", costImpactUsd: null, scheduleImpactDays: null, notes: null,
  },
  [
    {
      rfiNumber: "DRFI-001", subject: "Curtain wall head detail at level 7 parapet",
      question:
        "The parapet detail on A-502 shows a 6\" upstand that conflicts with the curtain wall head " +
        "anchor shown on A-741. Confirm which governs and whether the upstand can be reduced to 4\".",
      status: "open", impact: "both", costImpactUsd: "38400", scheduleImpactDays: 6,
      askedDate: "2026-06-14",
    },
    {
      rfiNumber: "DRFI-002", subject: "Slab depression at elevator pit — dimension conflict",
      question:
        "S-201 calls a 4'-6\" pit depth; the elevator vendor submittal requires 5'-2\". Confirm the " +
        "structural depth so we can release rebar.",
      status: "open", discipline: "structural", impact: "cost", costImpactUsd: "12750",
      askedDate: "2026-06-20",
    },
    {
      rfiNumber: "DRFI-003", subject: "Mechanical shaft clear dimensions at grid D",
      question: "Confirm the 30\" clear required for the return duct riser between grids D-3 and D-4.",
      status: "open", discipline: "mep", impact: "schedule", scheduleImpactDays: 9,
      askedDate: "2026-06-25",
    },
    {
      rfiNumber: "DRFI-004", subject: "Site retaining wall reinforcement at south property line",
      question: "C-301 and S-501 disagree on the wall stem thickness. Which drawing governs?",
      response:
        "S-501 governs. Stem is 12\" with #6 @ 10\" o.c. each face. C-301 will be revised in the next issue.",
      status: "answered", discipline: "civil", impact: "none",
      askedDate: "2026-05-11", respondedDate: "2026-05-19",
    },
    {
      rfiNumber: "DRFI-005", subject: "Storefront glazing type substitution",
      question: "Is a 1\" IGU with a low-E #2 coating acceptable in lieu of the specified assembly?",
      response: "Accepted. Provide a sample and thermal performance data with the submittal.",
      status: "closed", impact: "cost", costImpactUsd: "-21000",
      askedDate: "2026-04-22", respondedDate: "2026-05-02",
    },
    {
      rfiNumber: "DRFI-006", subject: "Roof drain overflow routing",
      question: "Overflow scuppers are shown on A-201 but not plumbed on P-301. Confirm routing.",
      response: "Route overflow to daylight at the north facade per revised P-301, issued with Addendum 3.",
      status: "closed", discipline: "mep", impact: "schedule", scheduleImpactDays: 3,
      askedDate: "2026-04-30", respondedDate: "2026-05-15",
    },
    {
      rfiNumber: "DRFI-007", subject: "Duplicate — see DRFI-005",
      status: "void", askedDate: "2026-04-23",
    },
    {
      rfiNumber: "DRFI-008", subject: "Fire-rated assembly at stair 2 shaft wall",
      question: "Confirm the UL assembly number for the 2-hour shaft wall at stair 2.",
      response: "UL U438 with 2 layers of 5/8\" Type X each side.",
      status: "answered", discipline: "architectural", impact: "none",
      askedDate: "2026-06-01", respondedDate: "2026-06-08",
    },
  ],
);

/* ----------------------------- value engineering -------------------------- */

const veItems = rows<PreConstructionVeItem>(
  {
    veNumber: null, description: "", discipline: "architectural", status: "proposed",
    estimatedSavingsUsd: null, scheduleImpactDays: null, proposedById: null,
    proposedDate: null, decisionDate: null, decisionNotes: null, notes: null,
  },
  [
    {
      veNumber: "VE-01", description: "Substitute painted CMU for split-face at the loading dock",
      status: "accepted", estimatedSavingsUsd: "84500", scheduleImpactDays: -4,
      proposedDate: "2026-03-14", decisionDate: "2026-04-02",
      decisionNotes: "Accepted by Owner on the condition that the public-facing north elevation keeps split-face.",
    },
    {
      veNumber: "VE-02", description: "Reduce structural steel tonnage via composite deck redesign",
      discipline: "structural", status: "accepted", estimatedSavingsUsd: "212000",
      scheduleImpactDays: 5, proposedDate: "2026-03-20", decisionDate: "2026-04-10",
      decisionNotes: "Accepted. Engineer of Record to reissue S-200 series; adds five days to the design release.",
    },
    {
      veNumber: "VE-03", description: "VRF system in lieu of central chilled water at levels 5–7",
      discipline: "mep", status: "rejected", estimatedSavingsUsd: "168000",
      proposedDate: "2026-03-28", decisionDate: "2026-04-18",
      decisionNotes: "Rejected — Owner's facilities group standardized on chilled water.",
    },
    {
      veNumber: "VE-04", description: "Delete the decorative site lighting bollards along the west walk",
      discipline: "landscape", status: "rejected", estimatedSavingsUsd: "34000",
      proposedDate: "2026-04-04", decisionDate: "2026-04-22",
      decisionNotes: "Rejected — required by the zoning approval condition.",
    },
    {
      veNumber: "VE-05", description: "Single-ply TPO roof in lieu of modified bitumen",
      status: "proposed", estimatedSavingsUsd: "61500", proposedDate: "2026-06-11",
    },
    {
      veNumber: "VE-06", description: "Value-engineer the elevator cab finishes package",
      status: "held", estimatedSavingsUsd: "27800", proposedDate: "2026-06-18",
      notes: "Held pending the Owner's finish selections meeting.",
    },
  ],
);

/* -------------------------------- permits --------------------------------- */

const JURISDICTION = "City of Evanston";

const permits = rows<PreConstructionPermit>(
  {
    permitType: "other", permitNumber: null, jurisdiction: JURISDICTION,
    applicationDate: null, hearingDate: null, issuedDate: null, expirationDate: null,
    status: "not_started", expediter: "Kate Sorensen", expediterPhone: "(847) 555-0110",
    feePaid: null, conditions: null, notes: null,
  },
  [
    {
      permitType: "building", permitNumber: "BLD-2026-01844", status: "issued",
      applicationDate: "2026-02-10", issuedDate: "2026-04-28", expirationDate: "2027-04-28",
      feePaid: "184250", conditions: "Special inspection required for all cast-in-place concrete.",
    },
    {
      permitType: "demolition", permitNumber: "DEM-2026-00291", status: "issued",
      applicationDate: "2026-01-22", issuedDate: "2026-02-19", expirationDate: "2026-08-19",
      feePaid: "6400",
    },
    {
      permitType: "earthwork", permitNumber: "ERT-2026-00512", status: "issued",
      applicationDate: "2026-02-04", issuedDate: "2026-03-11", expirationDate: "2026-12-11",
      feePaid: "11900",
    },
    {
      permitType: "foundation", permitNumber: "FND-2026-00733", status: "issued",
      applicationDate: "2026-02-18", issuedDate: "2026-04-02", expirationDate: "2027-04-02",
      feePaid: "22750",
    },
    // The missing critical permit — this is what fires the danger callout.
    {
      permitType: "right_of_way", permitNumber: "ROW-2026-01120", status: "in_review",
      applicationDate: "2026-05-06", hearingDate: "2026-08-12",
      conditions: "Traffic control plan under review by the Transportation Division.",
      notes: "Third round of comments returned; expediter escalated to the division chief.",
    },
    {
      permitType: "mep", permitNumber: "MEP-2026-02010", status: "submitted",
      applicationDate: "2026-06-01",
    },
    {
      permitType: "electrical", status: "application_in_progress",
      notes: "Awaiting the sealed one-line from the Engineer of Record.",
    },
    {
      permitType: "fire", permitNumber: "FIR-2026-00884", status: "conditions_pending",
      applicationDate: "2026-04-15",
      conditions: "Fire department connection location must be relocated 12' north of the shown position.",
    },
    {
      permitType: "zoning", permitNumber: "ZON-2025-04417", status: "issued",
      applicationDate: "2025-10-02", issuedDate: "2025-12-15", expirationDate: "2027-12-15",
      feePaid: "3200",
    },
    {
      permitType: "environmental", permitNumber: "ENV-2026-00077", status: "expired",
      applicationDate: "2026-01-08", issuedDate: "2026-02-01", expirationDate: "2026-06-01",
      notes: "Stormwater NOI lapsed; renewal application filed.",
    },
  ],
);

/* ------------------------------- prequal subs ----------------------------- */

const prequalSubs = rows<PreConstructionPrequalSub>(
  {
    companyName: "", trade: null, contact: null, phone: null, email: null,
    insuranceExpires: null, insuranceLimit: null, bondCapacity: null, emrRating: null,
    prequalStatus: "not_started", prequalDate: null, prequalExpires: null, notes: null,
  },
  [
    {
      companyName: "Halvorsen Concrete", trade: "Concrete", contact: "Erik Halvorsen",
      phone: "(847) 555-0231", email: "erik@halvorsenconcrete.example",
      insuranceLimit: "5000000", bondCapacity: "25000000", emrRating: "0.71",
      prequalStatus: "approved", prequalDate: "2026-01-15", prequalExpires: "2027-01-15",
    },
    {
      companyName: "Ridgeline Steel Erectors", trade: "Structural Steel", contact: "Tanya Cruz",
      phone: "(312) 555-0417", email: "tcruz@ridgelinesteel.example",
      insuranceLimit: "10000000", bondCapacity: "40000000", emrRating: "0.84",
      prequalStatus: "approved", prequalDate: "2026-01-22", prequalExpires: "2027-01-22",
    },
    {
      companyName: "Northlake Mechanical", trade: "HVAC", contact: "Ben Okafor",
      phone: "(847) 555-0388", email: "bokafor@northlakemech.example",
      insuranceLimit: "5000000", bondCapacity: "30000000", emrRating: "0.93",
      prequalStatus: "approved", prequalDate: "2026-02-05", prequalExpires: "2027-02-05",
    },
    {
      companyName: "Kellerman Electric", trade: "Electrical", contact: "Susan Kellerman",
      phone: "(312) 555-0126", email: "skellerman@kellermanelectric.example",
      insuranceLimit: "5000000", bondCapacity: "18000000", emrRating: "1.02",
      prequalStatus: "conditionally_approved", prequalDate: "2026-02-19", prequalExpires: "2026-11-19",
      notes: "EMR above 1.0 — conditional on a project-specific safety plan and monthly audits.",
    },
    {
      companyName: "Brightwater Plumbing", trade: "Plumbing", contact: "Marco Diaz",
      phone: "(847) 555-0459", email: "mdiaz@brightwaterplumbing.example",
      insuranceLimit: "3000000", bondCapacity: "12000000", emrRating: "0.88",
      prequalStatus: "submitted", prequalDate: "2026-06-10",
    },
    {
      companyName: "Foster Glazing Systems", trade: "Curtain Wall", contact: "Ann Petrov",
      phone: "(312) 555-0630", email: "apetrov@fosterglazing.example",
      insuranceLimit: "5000000", bondCapacity: "22000000", emrRating: "0.79",
      prequalStatus: "submitted", prequalDate: "2026-06-16",
    },
    {
      companyName: "Cardinal Drywall", trade: "Drywall", contact: "Luis Ferrara",
      phone: "(847) 555-0712", email: "lferrara@cardinaldrywall.example",
      insuranceLimit: "2000000", bondCapacity: "6000000", emrRating: "1.34",
      prequalStatus: "declined", prequalDate: "2026-03-08",
      notes: "Declined — EMR and bond capacity below threshold for a package of this size.",
    },
    {
      companyName: "Yarrow Site Utilities", trade: "Site Utilities", contact: "Dee Yarrow",
      phone: "(847) 555-0844", email: "dee@yarrowsite.example",
      insuranceLimit: "4000000", bondCapacity: "15000000", emrRating: "0.91",
      prequalStatus: "expired", prequalDate: "2025-03-01", prequalExpires: "2026-03-01",
      notes: "Prequal lapsed; renewal packet requested.",
    },
  ],
);

/* ------------------------------- bid packages ----------------------------- */

const bidPackages = rows<PreConstructionBidPackage>(
  {
    packageNumber: null, label: "", csiDivision: null, estimatedValueUsd: null,
    bidDueDate: null, bidsReceivedCount: 0, awardedTo: null, awardedDate: null,
    awardedValueUsd: null, status: "not_ready", notes: null,
  },
  [
    {
      packageNumber: "BP-01", label: "Sitework & Earthwork", csiDivision: "31",
      estimatedValueUsd: "2450000", bidDueDate: "2026-03-06", bidsReceivedCount: 4,
      awardedTo: "Yarrow Site Utilities", awardedDate: "2026-03-20",
      awardedValueUsd: "2318000", status: "contract_executed",
    },
    {
      packageNumber: "BP-02", label: "Cast-in-Place Concrete", csiDivision: "03",
      estimatedValueUsd: "8900000", bidDueDate: "2026-03-27", bidsReceivedCount: 5,
      awardedTo: "Halvorsen Concrete", awardedDate: "2026-04-14",
      awardedValueUsd: "9145000", status: "contract_executed",
      notes: "Award exceeds estimate — rebar escalation absorbed from contingency.",
    },
    {
      packageNumber: "BP-03", label: "Structural Steel & Deck", csiDivision: "05",
      estimatedValueUsd: "6200000", bidDueDate: "2026-05-01", bidsReceivedCount: 3,
      awardedTo: "Ridgeline Steel Erectors", awardedDate: "2026-05-19",
      awardedValueUsd: "5980000", status: "awarded",
    },
    {
      packageNumber: "BP-04", label: "Curtain Wall & Glazing", csiDivision: "08",
      estimatedValueUsd: "4750000", bidDueDate: "2026-07-10", bidsReceivedCount: 3,
      status: "bids_received",
      notes: "Low bid is 11% over estimate; scope review scheduled before award.",
    },
    {
      packageNumber: "BP-05", label: "Mechanical & Plumbing", csiDivision: "23",
      estimatedValueUsd: "7300000", bidDueDate: "2026-08-07", bidsReceivedCount: 0,
      status: "out_for_bid",
    },
    {
      packageNumber: "BP-06", label: "Interior Finishes", csiDivision: "09",
      estimatedValueUsd: "3100000", status: "on_hold",
      notes: "Held until the Owner completes finish selections.",
    },
  ],
);

/* ------------------------------ long-lead items --------------------------- */

const longLeadItems = rows<PreConstructionLongLeadItem>(
  {
    itemNumber: null, description: "", discipline: "mep", csiDivision: null,
    orderedDate: null, submittedDate: null, approvedDate: null, fabricationStartDate: null,
    expectedDeliveryDate: null, actualDeliveryDate: null, leadTimeWeeks: null,
    status: "identified", supplier: null, supplierContact: null, supplierPhone: null,
    poNumber: null, poValueUsd: null, alternatives: null, notes: null,
  },
  [
    {
      itemNumber: "LL-01", description: "Main switchgear — 4000A service entrance",
      csiDivision: "26", supplier: "Meridian Power Systems", leadTimeWeeks: 46,
      submittedDate: "2026-02-14", approvedDate: "2026-03-06", orderedDate: "2026-03-10",
      expectedDeliveryDate: "2027-01-22", status: "at_risk", poNumber: "PO-4411",
      poValueUsd: "684000",
      notes:
        "Vendor pushed the ship date eight weeks citing breaker availability. Recovery plan: " +
        "temporary service through the demolition period and a shipment split so the main section lands first.",
      alternatives: "Alternate manufacturer quoted at 34 weeks, +$71k.",
    },
    {
      itemNumber: "LL-02", description: "Rooftop air handling units (3) — 40,000 CFM each",
      csiDivision: "23", supplier: "Northlake Mechanical", leadTimeWeeks: 38,
      submittedDate: "2026-03-01", approvedDate: "2026-03-24", orderedDate: "2026-04-01",
      expectedDeliveryDate: "2026-12-18", status: "at_risk", poNumber: "PO-4478",
      poValueUsd: "1240000",
      notes: "Fabrication slot slipped to the December window; crane pick sequence needs to be resequenced.",
    },
    {
      itemNumber: "LL-03", description: "Elevator equipment — two traction passenger cars",
      csiDivision: "14", supplier: "Ascend Vertical", leadTimeWeeks: 32,
      submittedDate: "2026-01-20", approvedDate: "2026-02-10", orderedDate: "2026-02-17",
      expectedDeliveryDate: "2026-09-29", actualDeliveryDate: "2026-09-24",
      status: "delivered", poNumber: "PO-4302", poValueUsd: "812000",
    },
    {
      itemNumber: "LL-04", description: "Structural steel — primary frame fabrication",
      discipline: "structural", csiDivision: "05", supplier: "Ridgeline Steel Erectors",
      leadTimeWeeks: 22, submittedDate: "2026-05-22", approvedDate: "2026-06-09",
      orderedDate: "2026-06-12", fabricationStartDate: "2026-06-24",
      expectedDeliveryDate: "2026-11-13", actualDeliveryDate: "2026-11-10",
      status: "delivered", poNumber: "PO-4520", poValueUsd: "2960000",
    },
    {
      itemNumber: "LL-05", description: "Emergency generator — 500kW diesel",
      csiDivision: "26", supplier: "Meridian Power Systems", leadTimeWeeks: 28,
      submittedDate: "2026-02-26", approvedDate: "2026-03-18", orderedDate: "2026-03-25",
      expectedDeliveryDate: "2026-10-08", actualDeliveryDate: "2026-10-02",
      status: "installed", poNumber: "PO-4455", poValueUsd: "398000",
    },
    {
      itemNumber: "LL-06", description: "Curtain wall unitized panels — north and east elevations",
      discipline: "architectural", csiDivision: "08", supplier: "Foster Glazing Systems",
      leadTimeWeeks: 30, submittedDate: "2026-06-20", status: "submittal_pending",
      expectedDeliveryDate: "2027-03-05",
      notes: "Cannot order until BP-04 is awarded.",
    },
    {
      itemNumber: "LL-07", description: "Chilled water pumps and VFDs",
      csiDivision: "23", supplier: "Northlake Mechanical", leadTimeWeeks: 20,
      submittedDate: "2026-05-30", approvedDate: "2026-06-22", orderedDate: "2026-06-26",
      fabricationStartDate: "2026-07-06", expectedDeliveryDate: "2026-11-20",
      status: "in_fabrication", poNumber: "PO-4562", poValueUsd: "276000",
    },
    {
      itemNumber: "LL-08", description: "Fire pump and controller assembly",
      csiDivision: "21", supplier: "Brightwater Plumbing", leadTimeWeeks: 24,
      submittedDate: "2026-06-05", approvedDate: "2026-06-27", orderedDate: "2026-07-01",
      expectedDeliveryDate: "2026-12-04", status: "shipped", poNumber: "PO-4590",
      poValueUsd: "164500",
    },
  ],
);

/* ------------------------------- signatures ------------------------------- */

const signatures = rows<PreConstructionSignature>(
  { role: "", name: null, title: null, signedDate: null, notes: null },
  [
    { role: "Chief Executive Officer", name: "Sean Houston", title: "CEO", signedDate: "2026-07-02" },
    { role: "Project Executive", name: "Dana Whitfield", title: "Project Executive", signedDate: "2026-07-02" },
    { role: "Preconstruction Lead", name: "Alicia Ruiz", title: "Director of Preconstruction", signedDate: "2026-07-06" },
    { role: "Chief Estimator", name: "Tom Bianchi", title: "Chief Estimator" },
    { role: "Design Manager", name: "Priya Raman", title: "Design Manager" },
    { role: "Owner Representative", name: "Gordon Lee", title: "Owner's Representative" },
    { role: "Architect of Record", name: "Priya Raman", title: "Raman + Locke Architects" },
    { role: "Engineer of Record", name: "Marcus Doyle", title: "Doyle Structural Group" },
  ],
);

/* --------------------------- the pre-con row itself ----------------------- */

const preCon: PreConstruction = {
  id: 1,
  projectId: PROJECT_ID,
  organizationId: 1,
  status: "design_locked",
  designPhase: "cd",
  designCompletionPercent: 82,
  permitTargetDate: "2026-05-01",
  permitReceivedDate: "2026-04-28",
  buyoutTargetDate: "2026-07-15",
  buyoutCompleteDate: null,
  bidPackagesCount: 0,
  bidPackagesBoughtOutCount: 0,
  preconLeadName: "Alicia Ruiz",
  preconLeadPhone: "(312) 555-0104",
  preconLeadEmail: "aruiz@trusspath.example",
  estimatorName: "Tom Bianchi",
  estimatorPhone: "(312) 555-0119",
  estimatorEmail: "tbianchi@trusspath.example",
  designNarrative:
    "Construction Documents are 82% complete and were locked for pricing on June 1. The remaining " +
    "effort is Division 09 finish selections and the curtain wall shop-drawing coordination, neither " +
    "of which gates the foundation or steel packages. Addendum 3 captured the mechanical scope changes " +
    "that came out of the May coordination review.",
  designAssumptions:
    "Owner finish selections complete by August 1. No change to the approved zoning envelope. " +
    "Engineer of Record reissues the S-200 series with the VE-02 deck redesign by July 20.",
  designExclusions:
    "Tenant fit-out beyond core and shell. Signage and wayfinding package. Off-site roadway improvements.",
  veStrategy:
    "Target $400k of accepted value engineering before the mechanical package is awarded. Ideas are " +
    "logged with an estimate and a schedule impact, then decided at the biweekly Owner meeting; " +
    "anything not decided within two meetings is held rather than left open.",
  constructabilityFindings:
    "The elevator pit depth conflict between S-201 and the vendor submittal is the only open " +
    "sequencing risk on the foundation package. The mechanical shaft at grid D is 2\" short of the " +
    "return-duct clearance and needs either a wall shift or a transition fitting. Two of three " +
    "crane pick locations require a sidewalk closure and therefore depend on the right-of-way permit.",
  constructabilitySummary:
    "Three constructability items are open, all resolvable in design. None of the three blocks the " +
    "concrete package, which is the critical-path release.",
  siteConditionsNotes:
    "Geotechnical report calls for over-excavation to 4' below the footing bearing plane at the " +
    "northeast corner. Known combined sewer at grid A-1 requires hand excavation within 5'.",
  logisticsConsiderations:
    "Single-gate site with a shared alley on the south boundary. Material laydown is limited to the " +
    "east half of Lot B, so steel delivery must be sequenced with the erection plan rather than stockpiled.",
  permitStrategy:
    "Sequence permits so the foundation package can start ahead of the full building permit: " +
    "demolition and earthwork first, then foundation, then building. Right-of-way is pursued in " +
    "parallel because the crane picks depend on it.",
  jurisdictionalNarrative:
    "City of Evanston reviews in three rounds with a nominal 21-day cycle per round. The " +
    "Transportation Division reviews right-of-way separately and does not run in parallel with " +
    "the building review, which is what pushed the ROW hearing to August 12.",
  openConditionsNarrative:
    "Building permit carries a special-inspection condition for all cast-in-place concrete. " +
    "Fire permit requires the fire department connection to move 12' north. The stormwater NOI " +
    "lapsed on June 1 and the renewal is filed but not issued.",
  prequalCriteria:
    "Minimum $5M general liability, bond capacity of at least 3× the package value, EMR at or below " +
    "1.00, and three references on comparable mixed-use work in the last five years. Anything above " +
    "1.00 EMR can be conditionally approved with a project-specific safety plan.",
  bidStrategy:
    "Six packages, bid in critical-path order. Three bidders minimum per package, five on concrete. " +
    "Scope review before award on any package where the low bid lands more than 5% off the estimate.",
  bidderOutreachNarrative:
    "Eight subcontractors prequalified across six trades. Outreach for the mechanical package went " +
    "to five firms; two declined for capacity, which is why BP-05 is out with a longer bid window.",
  buyoutStrategy:
    "Award the packages that gate the foundation and steel releases first, then hold interior " +
    "finishes until the Owner's selections are complete. Target 100% buyout by July 15.",
  longLeadStrategy:
    "Anything over a 20-week lead time is identified, submitted and approved before the package it " +
    "belongs to is awarded, so a PO can be released the same week. Switchgear and air handling units " +
    "were ordered ahead of the mechanical award for exactly this reason.",
  deliveryRiskNarrative:
    "Two items are at risk. The switchgear ship date moved eight weeks on breaker availability and " +
    "is now inside the temporary-power window; the mitigation is a split shipment plus temporary " +
    "service. The rooftop units slipped into the December crane window, which forces a resequence " +
    "of the picks and depends on the right-of-way permit landing first.",
  overallRisks:
    "Right-of-way permit is the single largest schedule risk — the crane picks, and therefore steel " +
    "erection, depend on it. Switchgear delivery is the largest procurement risk. Curtain wall low " +
    "bid at 11% over estimate is the largest cost risk.",
  overallAssumptions:
    "Right-of-way issues within 30 days of the August 12 hearing. Owner finish selections complete " +
    "by August 1. No further escalation on structural steel beyond what BP-03 captured.",
  openIssues:
    "Elevator pit depth conflict (DRFI-002) blocks rebar release. Mechanical shaft clearance " +
    "(DRFI-003) blocks the shaft wall layout. Stormwater NOI renewal is outstanding.",
  nextSteps:
    "Close DRFI-002 and DRFI-003 before July 31. Complete the BP-04 scope review and award by " +
    "August 15. Escalate the right-of-way application ahead of the August 12 hearing. Confirm the " +
    "switchgear split shipment in writing.",
  preconPlanApprovedAt: "2026-07-06T15:22:00.000Z",
  preconPlanApprovedById: 7,
  createdAt: "2026-01-05T09:00:00.000Z",
  updatedAt: "2026-07-06T15:22:00.000Z",
};

/* ------------------------------- stakeholders ----------------------------- */

const stakeholders = rows<ProjectSetupStakeholder>(
  {
    role: "", name: null, title: null, organization: null, email: null, phone: null, notes: null,
  },
  [
    { role: "Project Executive", name: "Dana Whitfield", organization: "TrussPath Construction" },
    { role: "Project Manager", name: "Renee Salcedo", organization: "TrussPath Construction" },
    { role: "Superintendent", name: "Curtis Mabry", organization: "TrussPath Construction" },
  ],
);

/* ---------------------------------- render -------------------------------- */

const ctx: PreConstructionReportContext = {
  project: {
    name: "Northbridge Commons",
    number: "NB-2041",
    client: "Northbridge Partners LLC",
    address: "1420 Foster Avenue, Evanston, IL 60201",
    type: "Mixed Use",
    status: "Pre-Construction",
    startDate: "2026-08-24",
    endDate: "2028-02-11",
    budget: 42_600_000,
  },
  gcName: "TrussPath Construction",
  preCon,
  health: computePreConstructionHealth({ preCon, permits, prequalSubs, bidPackages, longLeadItems }),
  designDocs,
  designRfis,
  veItems,
  permits,
  prequalSubs,
  bidPackages,
  longLeadItems,
  signatures,
  stakeholders,
  approver: { name: "Dana Whitfield", email: "dana.whitfield@trusspath.example" },
};

const opts: PreConstructionReportOptions = {
  preparedBy: "Alicia Ruiz",
  preparedByRole: "Director of Preconstruction",
  revision: "Rev 2",
};

const outDir = process.argv[2] ?? "/tmp";

/** All three documents read the same context, so they render from one table. */
const TARGETS = [
  {
    label: "Pre-Construction Plan",
    file: `${outDir}/pre-construction-plan.pdf`,
    meta: preConstructionPlanMeta,
    render: renderPreConstructionPlan,
  },
  {
    label: "Design Review Report",
    file: `${outDir}/design-review-report.pdf`,
    meta: designReviewReportMeta,
    render: renderDesignReviewReport,
  },
  {
    label: "Buyout Plan",
    file: `${outDir}/buyout-plan.pdf`,
    meta: buyoutPlanMeta,
    render: renderBuyoutPlan,
  },
];

/** `/Type /Page` per page object; `/Type /Pages` is the tree node, hence the
 *  negative lookahead. Cheaper than pulling in a PDF parser for one number. */
function pageCount(path: string): number {
  const body = readFileSync(path).toString("latin1");
  return (body.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

async function main(): Promise<void> {
  for (const target of TARGETS) {
    const builder = new ReportBuilder(target.meta(ctx, opts));
    const stream = createWriteStream(target.file);
    builder.pipe(stream);
    target.render(builder, ctx);
    builder.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });

    const bytes = statSync(target.file).size;
    if (bytes === 0) throw new Error(`${target.file} rendered zero bytes`);
    console.log(
      `${target.label.padEnd(22)} ${String(pageCount(target.file)).padStart(2)} pages  ` +
      `${(bytes / 1024).toFixed(1).padStart(6)} KB  ${target.file}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
