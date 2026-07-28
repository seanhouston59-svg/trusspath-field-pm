/**
 * Renders a Mobilization Plan PDF from fixture data — no database required.
 *
 * Mirrors the section order of server/reports/mobilization-plan.ts so layout
 * regressions in the shared engine show up here before they reach a real
 * report. Run: npx tsx script/fixture-mobilization-pdf.ts /tmp/out.pdf
 */
import { createWriteStream } from "fs";
import { ReportBuilder, type ReportMeta } from "../server/reports/engine";
import { MOBILIZATION_SECTIONS, DEFAULT_SIGNER_ROLES } from "../shared/mobilization-catalog";

const LOREM =
  "Deliveries stage on the north apron and enter through Gate 2 only. Loads over 40 feet " +
  "must be escorted from the Foster Avenue signal. No staging on public right-of-way at any time.";

const plan = {
  ownerRep: "Dana Whitfield", ownerRepPhone: "(312) 555-0142", ownerRepEmail: "dana@northbridge.example",
  architect: "Priya Raman", architectFirm: "Raman + Locke Architects",
  architectPhone: "(312) 555-0188", architectEmail: "praman@ramanlocke.example",
  engineerOfRecord: "Marcus Doyle", engineerFirm: "Doyle Structural Group",
  engineerPhone: "(312) 555-0199", engineerEmail: "mdoyle@doylestructural.example",
  jurisdiction: "City of Evanston", permitExpediter: "Kate Sorensen", permitExpediterPhone: "(847) 555-0110",
  projectType: "Ground-up mixed use", squareFootage: 148_500, stories: 7,
  occupancyType: "B / R-2", weatherStation: "KORD — Chicago O'Hare",
  truckRoutes: LOREM, deliveryHours: "6:30 AM – 3:30 PM weekdays. No Saturday deliveries without 48h notice.",
  cranePicks: "Tower crane erects week 3 at grid C-4. All picks over the sidewalk require a street closure permit.",
  laydownAreas: "Primary laydown on the east half of Lot B. Secondary overflow at 1420 Foster by agreement.",
  gateSchedule: "Gate 1 personnel 6:00–17:00. Gate 2 deliveries 6:30–15:30. Gate 3 emergency only.",
  neighborCommsPlan: "Weekly bulletin to the Foster Avenue block association; 72h notice before any noise variance work.",
  noiseOrdinanceHours: "7:00 AM – 7:00 PM Mon–Sat. No work Sundays or holidays.",
  objectivesNarrative:
    "Establish a fully operational site within 14 days of Notice to Proceed: fencing and gates set, " +
    "temporary power energized, office trailer online, and earthwork crews able to start without permit holds.",
  scopeSummary: "Site preparation, temporary facilities, utility connections, and crew onboarding for the mobilization phase.",
  exclusions: "Off-site roadway improvements. Owner-furnished equipment storage beyond 30 days.",
  assumptions: "Notice to Proceed issued no later than the baseline start date. Permits approved within 21 days of application.",
  workNotIncluded: "Hazardous material abatement, tenant fit-out, landscaping.",
  siteSpecificHazards:
    "Active rail spur along the south boundary. Overhead 12kV distribution on Foster. Known combined sewer at grid A-1.",
  eapDetails:
    "Evacuation is signalled by three long air-horn blasts. All crews muster at the primary point and report by trade. " +
    "The superintendent performs the headcount and is the sole point of contact for responding agencies.",
  hospitalName: "Evanston Regional Medical Center", hospitalPhone: "(847) 555-0000",
  hospitalRoute: "North on Foster to Ridge, right on Ridge for 1.2 miles, emergency entrance on the left. Approx. 6 minutes.",
  musterPoint: "Northwest corner of Lot B, at the flagpole.",
  secondaryMusterPoint: "Foster Avenue sidewalk, west of Gate 1.",
  spillResponsePlan: "Spill kits at the fuel island and both trailers. Any release over 5 gallons is reported to the state within 24 hours.",
  msdsLocation: "Binder in the site office, east wall; digital copy in the project folder.",
  environmentalNarrative: "Erosion control installed before any earth is disturbed. Street sweeping daily during export.",
  superintendentPhone: "(312) 555-0170", projectManagerPhone: "(312) 555-0171",
  safetyOfficerName: "Angela Ruiz", safetyOfficerPhone: "(312) 555-0172",
  emergencyContact24hName: "Site Duty Line", emergencyContact24hPhone: "(312) 555-0911",
  onCallRotation: "Week 1 Ruiz · Week 2 Doyle · Week 3 Whitfield. Rotation posted in the trailer.",
  subcontractorForemen:
    "Luis Fontana — Earthwork — (312) 555-0201\nRay Ellis — Electrical — (312) 555-0202\n" +
    "Tomas Berg — Plumbing — (312) 555-0203\nNina Kaur — Concrete — (312) 555-0204",
};

const emergencyContacts = [
  { label: "Superintendent", name: "Ken Alvarez", phone: plan.superintendentPhone },
  { label: "Project Manager", name: "Dev Shah", phone: plan.projectManagerPhone },
  { label: "Safety Officer", name: plan.safetyOfficerName, phone: plan.safetyOfficerPhone },
  { label: "24-Hour Contact", name: plan.emergencyContact24hName, phone: plan.emergencyContact24hPhone },
  { label: "Hospital", name: plan.hospitalName, phone: plan.hospitalPhone },
];

const meta: ReportMeta = {
  title: "Mobilization Plan",
  projectName: "Northbridge Commons",
  projectNumber: "NB-2041",
  owner: "Northbridge Partners LLC",
  gcName: "TrussPath Construction",
  address: "1400 Foster Avenue, Evanston, IL 60201",
  reportingPeriod: "As of Jul 28, 2026",
  preparedBy: "Sean Houston",
  preparedByRole: "Project Executive",
  distribution: ["CEO", "Owner", "Project Executive", "Project Manager"],
  revision: "Rev 2",
  health: "yellow",
  phase: "Mobilization",
  ownerRep: plan.ownerRep,
  architect: plan.architect,
  engineerOfRecord: plan.engineerOfRecord,
  jurisdiction: plan.jurisdiction,
};

const out = process.argv[2] ?? "/tmp/mobilization-fixture.pdf";
const r = new ReportBuilder(meta);
r.pipe(createWriteStream(out));

r.coverPage("Northbridge Commons · NB-2041");

// Project Information directory + emergency contacts.
r.sectionBreak();
r.h1("Project Information");
r.keyValueGrid([
  ["Owner Representative", plan.ownerRep], ["Owner Rep Phone", plan.ownerRepPhone],
  ["Owner Rep Email", plan.ownerRepEmail], ["Architect", plan.architect],
  ["Architect Firm", plan.architectFirm], ["Architect Phone", plan.architectPhone],
  ["Architect Email", plan.architectEmail], ["Engineer of Record", plan.engineerOfRecord],
  ["Engineer Firm", plan.engineerFirm], ["Engineer Phone", plan.engineerPhone],
  ["Engineer Email", plan.engineerEmail], ["Jurisdiction", plan.jurisdiction],
  ["Permit Expediter", plan.permitExpediter], ["Permit Expediter Phone", plan.permitExpediterPhone],
  ["Project Type", plan.projectType],
  ["Square Footage", `${plan.squareFootage.toLocaleString("en-US")} sq ft`],
  ["Stories", String(plan.stories)], ["Occupancy Type", plan.occupancyType],
  ["Weather Station", plan.weatherStation], ["Nearest Hospital", plan.hospitalName],
  ["Hospital Phone", plan.hospitalPhone],
], 2);
r.emergencyContactCard(emergencyContacts);

r.sectionBreak();
r.executiveSummary({
  currentPhase: "Mobilization",
  health: "yellow",
  daysToNextMilestone: 6,
  keyWins: ["41 mobilization checklist items complete (63% overall).", "4 of 7 permits approved."],
  topRisks: ["Combined sewer conflict at grid A-1 — likelihood med, impact high."],
  topIssues: ["Overdue — Temp Power Energized (Temporary Utilities), 3 days past target."],
  decisionsRequired: ["Street closure permit for tower crane erection needs owner sign-off."],
});
r.h2("Overall Mobilization Progress");
r.progressBar(63, "All sections");
r.h2("Progress by Section");
for (const s of MOBILIZATION_SECTIONS) r.progressBar(Math.round(Math.random() * 100), s);

// Objectives & Scope.
r.sectionBreak();
r.h1("Objectives & Scope");
r.narrativeBlock("Mobilization Objectives", plan.objectivesNarrative);
r.narrativeBlock("Scope Summary", plan.scopeSummary);
r.narrativeBlock("Exclusions", plan.exclusions);
r.narrativeBlock("Key Assumptions", plan.assumptions);
r.narrativeBlock("Work Not Included", plan.workNotIncluded);
// An absent narrative must render nothing at all.
r.narrativeBlock("Should Not Appear", null);
r.narrativeBlock("Should Not Appear Either", "   ");

// Every catalog section gets a narrative under its header.
const sampleChecklist = [
  { label: "Construction entrance", done: true, subtitle: "Ken Alvarez  ·  due Jul 20, 2026" },
  { label: "Fencing", done: true },
  { label: "Gates", done: false, subtitle: "due Jul 30, 2026" },
  { label: "Signage", done: false },
];
MOBILIZATION_SECTIONS.forEach((section, i) => {
  if (i % 4 === 0) r.sectionBreak();
  r.h1(`${i + 1}. ${section}`);
  r.narrativeBlock("Section Narrative", `Authored narrative for ${section}. ${LOREM}`);
  r.checklist(sampleChecklist);

  if (section === "Staffing Plan") {
    r.emergencyContactCard(emergencyContacts);
    r.narrativeBlock("On-Call Rotation", plan.onCallRotation);
    r.narrativeBlock("Subcontractor Foremen", plan.subcontractorForemen);
  }
  if (section === "Safety Mobilization") {
    r.narrativeBlock("Site-Specific Hazards", plan.siteSpecificHazards);
    r.narrativeBlock("Emergency Action Plan", plan.eapDetails);
    r.emergencyContactCard([{ label: "Nearest Hospital", name: plan.hospitalName, phone: plan.hospitalPhone }]);
    r.narrativeBlock("Hospital Route", plan.hospitalRoute);
    r.narrativeBlock("Primary Muster Point", plan.musterPoint);
    r.narrativeBlock("Secondary Muster Point", plan.secondaryMusterPoint);
    r.narrativeBlock("SDS Location", plan.msdsLocation);
  }
  if (section === "Environmental Plan") {
    r.narrativeBlock("Environmental Narrative", plan.environmentalNarrative);
    r.narrativeBlock("Spill Response", plan.spillResponsePlan);
  }
  if (section === "Logistics Plan") {
    r.narrativeBlock("Truck Routes", plan.truckRoutes);
    r.narrativeBlock("Delivery Hours", plan.deliveryHours);
    r.narrativeBlock("Crane Picks", plan.cranePicks);
    r.narrativeBlock("Laydown Areas", plan.laydownAreas);
    r.narrativeBlock("Gate Schedule", plan.gateSchedule);
    r.narrativeBlock("Neighbor Communications", plan.neighborCommsPlan);
    r.narrativeBlock("Noise Ordinance Hours", plan.noiseOrdinanceHours);
  }
});

// An all-empty contact list must render nothing.
r.emergencyContactCard([{ label: "Nobody", name: "", phone: "" }]);

// Nine data-driven signers rather than the legacy five.
r.sectionBreak();
r.signOffBlock({
  signers: DEFAULT_SIGNER_ROLES.map((role, i) => ({
    role,
    name: i < 5 ? ["Marta Quinn", "Dev Shah", "Ken Alvarez", "Angela Ruiz", "Dana Whitfield"][i] : "",
    date: i === 0 ? "2026-07-24" : undefined,
  })),
});

r.end();
console.log(`wrote ${out}`);
