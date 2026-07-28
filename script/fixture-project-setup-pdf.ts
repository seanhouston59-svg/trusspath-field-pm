/**
 * Renders the Project Charter and Kickoff Meeting Agenda PDFs from fixture data
 * — no database required.
 *
 * Mirrors the section order of server/reports/project-charter.ts and
 * server/reports/kickoff-agenda.ts so layout regressions in the shared engine
 * surface here before they reach a real report. Both documents are rendered
 * twice: once fully populated, once nearly empty, because the "unavailable"
 * path is the one that regresses silently.
 *
 * Run: npx tsx script/fixture-project-setup-pdf.ts /tmp/charter.pdf /tmp/kickoff.pdf
 */
import { createWriteStream } from "fs";
import { ReportBuilder, formatDate, formatMoney, type ReportMeta } from "../server/reports/engine";
import {
  CONTRACT_DOC_KINDS, PROJECT_SETUP_DELIVERABLES, PROJECT_SETUP_SIGNERS,
  PROJECT_SETUP_DELIVERABLE_STATUS_LABELS,
} from "../shared/project-setup-catalog";

const STATUS_LABELS: Record<string, string> = PROJECT_SETUP_DELIVERABLE_STATUS_LABELS;

const setup = {
  projectNumber: "NB-2041",
  contractNumber: "AIA-A102-2041",
  awardDate: "2026-05-18",
  noticeToProceedDate: "2026-06-01",
  substantialCompletionDate: "2027-11-15",
  finalCompletionDate: "2027-12-20",
  contractType: "Guaranteed Maximum Price",
  deliveryMethod: "CM at Risk",
  originalContractValue: "$48,250,000.00",
  contingencyPercent: "5",
  retainagePercent: "10",
  billingCycle: "Monthly",
  paymentTerms:
    "Pay applications due the 25th of each month for work through month end. Owner review 10 business days, " +
    "payment net 30 from approval. Retainage reduced to 5% at 50% completion with owner consent.",
  insuranceCarrier: "Meridian Casualty",
  insurancePolicyNumber: "MC-4471-2026",
  bondCarrier: "Great Lakes Surety",
  bondPolicyNumber: "GLS-88120",
  bondAmount: "$48,250,000.00",
  projectDescription:
    "Ground-up seven-story mixed-use building at 1400 Foster Avenue: 148,500 gross square feet with " +
    "ground-floor retail, six residential levels, and one below-grade parking level. Cast-in-place podium " +
    "with light-gauge framing above.",
  businessCase:
    "The Foster Avenue corridor has absorbed every Class A unit delivered since 2023. Northbridge Partners " +
    "underwrote this asset at a 6.1% yield-on-cost, which holds only if substantial completion lands before " +
    "the November 2027 leasing season.",
  strategicGoals:
    "Deliver substantial completion by Nov 15, 2027.\nHold GMP with no owner-funded change orders above 2%.\n" +
    "Zero lost-time incidents.\nAchieve LEED Silver certification.",
  successCriteria:
    "Substantial completion on or before the contract date.\nFinal cost within the GMP plus approved owner changes.\n" +
    "TRIR below 1.0 for the duration.\nPunch list under 200 items at substantial completion.",
  keyRisks:
    "Combined sewer conflict at grid A-1 discovered in geotech — may require a redesign of the below-grade wall.\n" +
    "Switchgear lead time quoted at 44 weeks; any slip pushes energization past the temporary-power window.\n" +
    "Rail spur along the south boundary limits crane swing and requires railroad flagging on pick days.",
  keyAssumptions:
    "Notice to Proceed issued no later than Jun 1, 2026.\nBuilding permit approved within 21 days of application.\n" +
    "Owner-furnished equipment delivered per the submittal schedule.",
  keyConstraints:
    "No work Sundays or holidays per the Evanston noise ordinance.\nStaging limited to Lot B; no public " +
    "right-of-way storage.\nGMP is fixed — scope growth trades against the allowance schedule.",
  communicationPlan:
    "Owner-Architect-Contractor meeting every Tuesday 9:00 AM on site. Weekly written report distributed " +
    "Friday by 5:00 PM. All formal correspondence through Procore; email is not a contract record.",
  changeControlProcess:
    "Any scope question begins as an RFI. A cost impact becomes a Change Order Request within 5 business days " +
    "of the RFI response. Nothing proceeds on a verbal directive — a signed Construction Change Directive is " +
    "the minimum authorization to perform changed work.",
  documentationStandards:
    "Procore is the system of record for RFIs, submittals, daily logs, and photos. Drawing revisions are " +
    "issued as full sets, never as sheet replacements.",
  qualityStandards:
    "Mock-ups required for the exterior wall assembly, the typical unit bathroom, and the lobby storefront. " +
    "Third-party envelope testing at the first three floors.",
  safetyStandards:
    "100% tie-off above 6 feet. Daily pre-task planning by every crew. Weekly all-hands safety meeting Monday " +
    "6:30 AM. Substance testing per the owner's site agreement.",
  submittalWorkflow:
    "Contractor review 5 business days, architect review 10 business days, resubmittal 5 business days. " +
    "Long-lead items flagged on the submittal register and expedited to a 5-day architect review.",
  rfiWorkflow:
    "RFIs answered within 7 calendar days. Anything schedule-critical is marked urgent and escalated to the " +
    "architect's principal after 3 days without a response.",
  payAppWorkflow:
    "Schedule of values locked before the first pay application. Continuation sheet plus lien waivers from " +
    "every tier-one subcontractor required for payment release.",
  closeoutRequirements:
    "As-built drawings, O&M manuals, all permits closed with the AHJ, final lien waivers, and a completed " +
    "punch list before final payment. Training sessions recorded and delivered digitally.",
  warrantyRequirements:
    "One-year general warranty from substantial completion. Roofing 20-year NDL. Envelope sealants 10 years. " +
    "Eleven-month walkthrough scheduled by the owner.",
  kickoffScheduledAt: "2026-06-09T09:30",
  kickoffLocation: "Northbridge Partners, 200 W Adams St, Suite 1400, Chicago — Conference Room B",
  kickoffAgendaNotes:
    "Owner has asked that we cover the below-grade sewer conflict early rather than under Risks — it is the " +
    "only item that could move the GMP before permit.",
  kickoffAttendeesNarrative:
    "Full owner team, architect of record plus the MEP and structural engineers of record, GC project " +
    "executive, PM, and superintendent. Subcontractors are not invited to this session.",
  kickoffDecisions:
    "Below-grade wall redesign approved to proceed at the architect's risk pending the geotech addendum.\n" +
    "Switchgear released for fabrication against the allowance rather than waiting on the final electrical package.\n" +
    "Tuesday 9:00 AM confirmed as the standing OAC time for the duration of the project.",
  kickoffActionItems:
    "Raman + Locke to issue the geotech addendum by Jun 19 — P. Raman.\n" +
    "GC to submit the switchgear purchase order and lead-time confirmation by Jun 15 — D. Shah.\n" +
    "Owner to confirm the Lot B staging agreement extension through Q1 2027 by Jun 30 — D. Whitfield.",
  charterApprovedAt: "2026-06-05T14:22:00.000Z",
};

const mobPlan = {
  jurisdiction: "City of Evanston",
  architect: "Priya Raman",
  engineerOfRecord: "Marcus Doyle",
  ownerRep: "Dana Whitfield",
  scopeSummary:
    "Site preparation, temporary facilities, utility connections, and crew onboarding for the mobilization phase.",
  exclusions: "Off-site roadway improvements. Owner-furnished equipment storage beyond 30 days.",
  assumptions: "Notice to Proceed issued no later than the baseline start date. Permits approved within 21 days.",
  workNotIncluded: "Hazardous material abatement, tenant fit-out, landscaping.",
  objectivesNarrative:
    "Establish a fully operational site within 14 days of Notice to Proceed: fencing and gates set, temporary " +
    "power energized, office trailer online, and earthwork crews able to start without permit holds.",
};

const stakeholders = [
  { role: "Owner", name: "Dana Whitfield", title: "VP Development", organization: "Northbridge Partners LLC", email: "dana@northbridge.example", phone: "(312) 555-0142" },
  { role: "Owner Rep", name: "Curtis Nwosu", title: "Program Manager", organization: "Halstead Advisory", email: "cnwosu@halstead.example", phone: "(312) 555-0155" },
  { role: "Architect", name: "Priya Raman", title: "Principal", organization: "Raman + Locke Architects", email: "praman@ramanlocke.example", phone: "(312) 555-0188" },
  { role: "Structural Engineer", name: "Marcus Doyle", title: "Engineer of Record", organization: "Doyle Structural Group", email: "mdoyle@doylestructural.example", phone: "(312) 555-0199" },
  { role: "MEP Engineer", name: "Hannah Iyer", title: "Associate", organization: "Iyer Mechanical Design", email: "hiyer@iyermech.example", phone: "(847) 555-0121" },
  { role: "AHJ Inspector", name: "Robert Kline", title: "Building Inspector", organization: "City of Evanston", email: "rkline@cityofevanston.example", phone: "(847) 555-0100" },
  { role: "GC PM", name: "Dev Shah", title: "Project Manager", organization: "TrussPath Construction", email: "dshah@trusspath.example", phone: "(312) 555-0171" },
  { role: "GC Super", name: "Ken Alvarez", title: "Superintendent", organization: "TrussPath Construction", email: "kalvarez@trusspath.example", phone: "(312) 555-0170" },
  { role: "Safety Officer", name: "Angela Ruiz", title: "Safety Manager", organization: "TrussPath Construction", email: "aruiz@trusspath.example", phone: "(312) 555-0172" },
];

const contractDocs = [
  { kind: "contract", label: "AIA A102-2017 — Executed", revision: "—", issuedDate: "2026-05-18", receivedDate: "2026-05-20", location: "Procore / 00 Contracts", notes: "GMP with shared savings at 50/50." },
  { kind: "exhibit", label: "Exhibit A — Schedule of Values", revision: "Rev 2", issuedDate: "2026-05-22", receivedDate: "2026-05-22", location: "Procore / 00 Contracts", notes: null },
  { kind: "exhibit", label: "Exhibit B — Allowance Schedule", revision: "Rev 1", issuedDate: "2026-05-22", receivedDate: "2026-05-22", location: "Procore / 00 Contracts", notes: "Switchgear allowance $1.2M." },
  { kind: "spec", label: "Project Manual — Divisions 00–33", revision: "Rev 3", issuedDate: "2026-04-30", receivedDate: "2026-05-02", location: "SharePoint / Specs", notes: null },
  { kind: "drawing_set", label: "Permit Set — Full", revision: "Rev 4", issuedDate: "2026-05-11", receivedDate: "2026-05-11", location: "Procore / Drawings", notes: "Sheets S-101 through S-140 reissued." },
  { kind: "addendum", label: "Addendum 3 — Below-Grade Wall", revision: "—", issuedDate: "2026-06-19", receivedDate: null, location: null, notes: "Pending geotech." },
  { kind: "insurance_cert", label: "GL / Umbrella / WC Certificate", revision: "—", issuedDate: "2026-05-25", receivedDate: "2026-05-26", location: "Procore / Insurance", notes: "Expires 2027-05-25." },
  { kind: "bond", label: "Performance & Payment Bond", revision: "—", issuedDate: "2026-05-28", receivedDate: "2026-05-29", location: "Physical — PM file cabinet", notes: null },
  { kind: "permit", label: "Building Permit — BP-2026-11482", revision: "—", issuedDate: "2026-06-15", receivedDate: "2026-06-16", location: "Procore / Permits", notes: null },
  // A legacy kind must still print rather than vanish from the register.
  { kind: "legacy_unknown_kind", label: "Pre-2026 Letter of Intent", revision: "—", issuedDate: "2026-03-02", receivedDate: "2026-03-04", location: "Archive", notes: "Kind no longer in the catalog." },
];

const deliverables = PROJECT_SETUP_DELIVERABLES.map((d, i) => ({
  label: d.label,
  status: (["complete", "complete", "in_progress", "pending", "na"] as const)[i % 5],
  dueDate: i % 3 === 0 ? `2026-06-${String(10 + i).padStart(2, "0")}` : null,
  completedAt: i % 5 < 2 ? `2026-06-${String(5 + i).padStart(2, "0")}` : null,
  notes: i === 2 ? "Register drafted; owner review outstanding." : null,
}));

const signatures = PROJECT_SETUP_SIGNERS.map((role, i) => ({
  role,
  name: ["Marta Quinn", "Sean Houston", "Dev Shah", "Dana Whitfield", "Priya Raman"][i] ?? "",
  signedDate: i < 3 ? "2026-06-05" : null,
}));

const DOC_KIND_LABELS: Record<string, string> =
  Object.fromEntries(CONTRACT_DOC_KINDS.map((k) => [k.value, k.label]));

const DIRECTORY_COLS = [
  { header: "Role", width: 86 }, { header: "Name / Title", width: 108 },
  { header: "Organization", width: 90 }, { header: "Email" }, { header: "Phone", width: 74 },
] as const;

const DOC_COLS = [
  { header: "Document" }, { header: "Rev", width: 42 },
  { header: "Issued", width: 70 }, { header: "Received", width: 70 },
  { header: "Location", width: 96 }, { header: "Notes", width: 96 },
] as const;

const DELIVERABLE_COLS = [
  { header: "Deliverable" }, { header: "Status", width: 74 },
  { header: "Due", width: 76 }, { header: "Completed", width: 76 },
  { header: "Notes", width: 120 },
] as const;

function directoryRows() {
  return stakeholders.map((s) => [
    s.role,
    [s.name, s.title].filter((x) => (x ?? "").trim()).join(" — ") || "—",
    s.organization ?? "—", s.email ?? "—", s.phone ?? "—",
  ]);
}

function docRows(rows: typeof contractDocs) {
  return rows.map((d) => [
    d.label, d.revision ?? "—", formatDate(d.issuedDate), formatDate(d.receivedDate),
    d.location ?? "—", d.notes ?? "—",
  ]);
}

function deliverableRows() {
  return deliverables.map((d) => [
    d.label, STATUS_LABELS[d.status] ?? d.status,
    formatDate(d.dueDate), formatDate(d.completedAt), d.notes ?? "—",
  ]);
}

function formatDateTime(iso: string): string {
  const date = formatDate(iso.slice(0, 10));
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return date;
  const h24 = parseInt(m[1], 10);
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${date} at ${h12}:${m[2]} ${suffix}`;
}

const BASE: Omit<ReportMeta, "title" | "distribution"> = {
  projectName: "Northbridge Commons",
  projectNumber: setup.projectNumber,
  owner: "Northbridge Partners LLC",
  gcName: "TrussPath Construction",
  address: "1400 Foster Avenue, Evanston, IL 60201",
  reportingPeriod: "As of Jul 28, 2026",
  preparedBy: "Sean Houston",
  preparedByRole: "Project Executive",
  revision: "Rev 2",
  phase: "Project Setup",
  jurisdiction: mobPlan.jurisdiction,
  architect: mobPlan.architect,
  engineerOfRecord: mobPlan.engineerOfRecord,
  ownerRep: mobPlan.ownerRep,
};

/* ---------------------------------------------------------------- Charter */

function renderCharter(out: string) {
  const r = new ReportBuilder({
    ...BASE,
    title: "Project Charter",
    distribution: ["CEO", "Owner", "Project Executive", "Project Manager", "Architect of Record"],
  });
  r.pipe(createWriteStream(out));

  r.coverPage(`Northbridge Commons · ${setup.projectNumber}`);

  r.sectionBreak();
  r.h1("1. Project Information");
  r.keyValueGrid([
    ["Project Name", "Northbridge Commons"],
    ["Project Number", setup.projectNumber],
    ["Contract Number", setup.contractNumber],
    ["Owner / Client", "Northbridge Partners LLC"],
    ["General Contractor", "TrussPath Construction"],
    ["Address", "1400 Foster Avenue, Evanston, IL 60201"],
    ["Award Date", formatDate(setup.awardDate)],
    ["Notice to Proceed", formatDate(setup.noticeToProceedDate)],
    ["Substantial Completion", formatDate(setup.substantialCompletionDate)],
    ["Final Completion", formatDate(setup.finalCompletionDate)],
    ["Contract Type", setup.contractType],
    ["Delivery Method", setup.deliveryMethod],
    ["Original Contract Value", setup.originalContractValue],
    ["Contingency", `${setup.contingencyPercent}%`],
    ["Retainage", `${setup.retainagePercent}%`],
    ["Billing Cycle", setup.billingCycle],
    ["Insurance Carrier", setup.insuranceCarrier],
    ["Insurance Policy #", setup.insurancePolicyNumber],
    ["Bond Carrier", setup.bondCarrier],
    ["Bond Policy #", setup.bondPolicyNumber],
    ["Bond Amount", setup.bondAmount],
    ["Baseline Budget", formatMoney(48_250_000)],
    ["Charter Approved", formatDate(setup.charterApprovedAt.slice(0, 10))],
  ], 2);
  r.narrativeBlock("Payment Terms", setup.paymentTerms);

  r.sectionBreak();
  r.h1("2. Executive Summary");
  r.narrativeBlock("Project Description", setup.projectDescription);
  r.narrativeBlock("Business Case", setup.businessCase);

  r.h1("3. Strategic Goals & Success Criteria");
  r.narrativeBlock("Strategic Goals", setup.strategicGoals);
  r.narrativeBlock("Success Criteria", setup.successCriteria);

  r.sectionBreak();
  r.h1("4. Scope Narrative");
  r.p("Scope language is authored once on the Mobilization plan and mirrored here.", { muted: true });
  r.narrativeBlock("Scope Summary", mobPlan.scopeSummary);
  r.narrativeBlock("Exclusions", mobPlan.exclusions);
  r.narrativeBlock("Key Assumptions", mobPlan.assumptions);
  r.narrativeBlock("Work Not Included", mobPlan.workNotIncluded);

  r.h1("5. Risks, Assumptions & Constraints");
  r.narrativeBlock("Key Risks", setup.keyRisks);
  r.narrativeBlock("Key Assumptions", setup.keyAssumptions);
  r.narrativeBlock("Key Constraints", setup.keyConstraints);

  r.sectionBreak();
  r.h1("6. Project Directory");
  r.table([...DIRECTORY_COLS], directoryRows());

  r.sectionBreak();
  r.h1("7. Contract Documents Register");
  for (const kind of CONTRACT_DOC_KINDS) {
    const rows = contractDocs.filter((d) => d.kind === kind.value);
    if (!rows.length) continue;
    r.h2(DOC_KIND_LABELS[kind.value] ?? kind.value);
    r.table([...DOC_COLS], docRows(rows));
  }
  const known = new Set<string>(CONTRACT_DOC_KINDS.map((k) => k.value));
  const orphans = contractDocs.filter((d) => !known.has(d.kind));
  if (orphans.length) {
    r.h2("Other");
    r.table([...DOC_COLS], docRows(orphans));
  }

  r.sectionBreak();
  r.h1("8. Communications & Workflows");
  r.narrativeBlock("Communication Plan", setup.communicationPlan);
  r.narrativeBlock("Change Control Process", setup.changeControlProcess);
  r.narrativeBlock("Documentation Standards", setup.documentationStandards);
  r.narrativeBlock("Quality Standards", setup.qualityStandards);
  r.narrativeBlock("Safety Standards", setup.safetyStandards);
  r.narrativeBlock("Submittal Workflow", setup.submittalWorkflow);
  r.narrativeBlock("RFI Workflow", setup.rfiWorkflow);
  r.narrativeBlock("Pay Application Workflow", setup.payAppWorkflow);
  // An absent narrative must render nothing at all.
  r.narrativeBlock("Should Not Appear", null);
  r.narrativeBlock("Should Not Appear Either", "   ");

  r.sectionBreak();
  r.h1("9. Closeout & Warranty");
  r.narrativeBlock("Closeout Requirements", setup.closeoutRequirements);
  r.narrativeBlock("Warranty Requirements", setup.warrantyRequirements);

  r.h1("10. Setup Deliverables");
  r.table([...DELIVERABLE_COLS], deliverableRows());

  r.sectionBreak();
  r.signOffBlock({
    signers: signatures.map((s) => ({ role: s.role, name: s.name, date: s.signedDate ?? undefined })),
  });
  r.p(`Charter approved ${formatDate(setup.charterApprovedAt.slice(0, 10))}.`, { muted: true });

  r.end();
  console.log(`wrote ${out}`);
}

/* -------------------------------------------------------- Kickoff Agenda */

function renderKickoff(out: string) {
  const r = new ReportBuilder({
    ...BASE,
    title: "Kickoff Meeting Agenda",
    reportingPeriod: `Kickoff ${formatDateTime(setup.kickoffScheduledAt)}`,
    distribution: ["Owner", "Project Executive", "Project Manager", "Superintendent", "Architect of Record"],
  });
  r.pipe(createWriteStream(out));

  r.coverPage(`Northbridge Commons · ${setup.projectNumber}`);

  r.sectionBreak();
  r.h1("Meeting Details");
  r.keyValueGrid([
    ["Project", "Northbridge Commons"],
    ["Project Number", setup.projectNumber],
    ["Date & Time", formatDateTime(setup.kickoffScheduledAt)],
    ["Location", setup.kickoffLocation],
    ["Prepared By", "Sean Houston"],
    ["Revision", "Rev 2"],
  ], 2);

  r.h1("Attendees");
  r.narrativeBlock("Expected Attendance", setup.kickoffAttendeesNarrative);
  r.table([...DIRECTORY_COLS], directoryRows());

  r.sectionBreak();
  r.h1("Agenda");

  let n = 0;
  const item = (title: string) => { n += 1; r.h2(`${n}. ${title}`); };

  item("Welcome & Introductions");
  r.p("Round-the-room introductions. Confirm the directory above is complete and correct.");
  r.narrativeBlock("Additional Agenda Notes", setup.kickoffAgendaNotes);

  item("Project Overview");
  r.p(setup.projectDescription);

  item("Contract & Delivery");
  r.p("Review contract type, delivery method, key dates, and the billing/retainage terms recorded on the Charter.");
  r.narrativeBlock("Payment Terms", setup.paymentTerms);

  item("Strategic Goals & Success Criteria");
  r.narrativeBlock("Strategic Goals", setup.strategicGoals);
  r.narrativeBlock("Success Criteria", setup.successCriteria);

  item("Scope Walkthrough");
  r.narrativeBlock("Scope Summary", mobPlan.scopeSummary);
  r.narrativeBlock("Exclusions", mobPlan.exclusions);
  r.narrativeBlock("Key Assumptions", mobPlan.assumptions);
  r.narrativeBlock("Work Not Included", mobPlan.workNotIncluded);

  item("Risks, Assumptions & Constraints");
  r.narrativeBlock("Key Risks", setup.keyRisks);
  r.narrativeBlock("Key Assumptions", setup.keyAssumptions);
  r.narrativeBlock("Key Constraints", setup.keyConstraints);

  r.sectionBreak();
  item("Communications Plan");
  r.p(setup.communicationPlan);

  item("Submittal, RFI & Pay Application Workflows");
  r.narrativeBlock("Submittal Workflow", setup.submittalWorkflow);
  r.narrativeBlock("RFI Workflow", setup.rfiWorkflow);
  r.narrativeBlock("Pay Application Workflow", setup.payAppWorkflow);

  item("Change Control");
  r.p(setup.changeControlProcess);

  item("Quality, Safety & Documentation Standards");
  r.narrativeBlock("Quality Standards", setup.qualityStandards);
  r.narrativeBlock("Safety Standards", setup.safetyStandards);
  r.narrativeBlock("Documentation Standards", setup.documentationStandards);

  item("Mobilization Plan Review");
  r.p("Walk the Mobilization Plan PDF: staffing, site setup, temporary utilities, equipment, permits, and the go/no-go checklist.");
  r.narrativeBlock("Mobilization Objectives", mobPlan.objectivesNarrative);

  r.sectionBreak();
  item("Setup Deliverables Checklist");
  r.table([...DELIVERABLE_COLS], deliverableRows());

  item("Q&A / Open Items");
  r.p("Open floor. Anything unresolved becomes an action item below.");

  item("Action Items & Next Steps");
  r.p("Confirm owners and due dates before adjourning.");

  r.sectionBreak();
  r.h1("Decisions & Action Items Captured");
  r.narrativeBlock("Decisions", setup.kickoffDecisions);
  r.narrativeBlock("Action Items", setup.kickoffActionItems);

  r.sectionBreak();
  r.signOffBlock({
    signers: ["Project Manager", "Owner Representative", "Architect of Record"].map((role) => {
      const hit = signatures.find((s) => s.role.toLowerCase() === role.toLowerCase());
      return { role, name: hit?.name ?? "", date: hit?.signedDate ?? undefined };
    }),
  });
  r.p("Signing above confirms attendance and agreement with the decisions recorded in this document.", { muted: true });

  r.end();
  console.log(`wrote ${out}`);
}

/* --------------------------------------- Empty variants (unavailable path) */

function renderEmpty(out: string, title: string) {
  const r = new ReportBuilder({
    ...BASE, title, projectNumber: "—", revision: "Rev 0",
    jurisdiction: null, architect: null, engineerOfRecord: null, ownerRep: null,
    distribution: ["CEO", "Owner"],
  });
  r.pipe(createWriteStream(out));
  r.coverPage("Greenfield Site · —");

  r.sectionBreak();
  r.h1("1. Project Information");
  r.keyValueGrid([["Project Name", "Greenfield Site"], ["Charter Approved", "Not yet approved"]], 2);

  r.sectionBreak();
  r.h1("2. Executive Summary");
  r.unavailable("Project description and business case have not been authored yet.");

  r.h1("3. Strategic Goals & Success Criteria");
  r.unavailable("Strategic goals and success criteria have not been authored yet.");

  r.h1("4. Scope Narrative");
  r.unavailable("Mobilization plan not yet initialized");

  r.h1("5. Risks, Assumptions & Constraints");
  r.unavailable("No risks, assumptions, or constraints recorded yet.");

  r.h1("6. Project Directory");
  r.unavailable("No stakeholders added yet");

  r.h1("7. Contract Documents Register");
  r.unavailable("No contract documents registered yet.");

  r.h1("8. Communications & Workflows");
  r.unavailable("No communication plan or workflow standards authored yet.");

  r.h1("9. Closeout & Warranty");
  r.unavailable("Closeout and warranty requirements have not been authored yet.");

  r.h1("10. Setup Deliverables");
  // An empty table must print its header plus "No records.", not collapse.
  r.table([...DELIVERABLE_COLS], []);

  r.sectionBreak();
  // No signature rows on file — the five canonical roles stand in, unnamed.
  r.signOffBlock({ signers: PROJECT_SETUP_SIGNERS.map((role) => ({ role, name: "" })) });
  r.p("This charter is not yet approved. The signatures above constitute approval once executed.", { muted: true });

  r.end();
  console.log(`wrote ${out}`);
}

renderCharter(process.argv[2] ?? "/tmp/project-charter-fixture.pdf");
renderKickoff(process.argv[3] ?? "/tmp/kickoff-agenda-fixture.pdf");
renderEmpty(process.argv[4] ?? "/tmp/project-charter-empty-fixture.pdf", "Project Charter");
