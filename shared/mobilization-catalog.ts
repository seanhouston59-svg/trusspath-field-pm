// Mobilization catalog — the canonical list of sections, default checklist
// items, default permits, and milestone day-offsets used to seed a new
// project's mobilization plan.
//
// Lives in shared/ because the server imports it for seeding (storage.seedMobilization)
// and the client imports it for section ordering and labels. Changing a section
// name here does NOT rename already-seeded rows — mobilization_items.section is
// persisted text. Add new sections at the end.

export const MOBILIZATION_SECTIONS = [
  "Project Information",
  "Mobilization Objectives",
  "Staffing Plan",
  "Site Setup",
  "Temporary Utilities",
  "Equipment Mobilization",
  "Permits",
  "Procurement",
  "Safety Mobilization",
  "Environmental Plan",
  "Communications Plan",
  "Logistics Plan",
  "Schedule",
  "Risk Register",
  "Mobilization Checklist",
] as const;

export type MobilizationSection = (typeof MOBILIZATION_SECTIONS)[number];

export const MOBILIZATION_ITEM_STATUSES = ["not_started", "in_progress", "done", "na"] as const;
export type MobilizationItemStatus = (typeof MOBILIZATION_ITEM_STATUSES)[number];

export const MOBILIZATION_ITEM_STATUS_LABELS: Record<MobilizationItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  na: "N/A",
};

export const PERMIT_STATUSES = ["Not Started", "Applied", "Approved", "Rejected", "Expired"] as const;
export type PermitStatus = (typeof PERMIT_STATUSES)[number];

export const UTILITY_KINDS = [
  "power", "water", "internet", "wifi", "cameras", "security", "lighting", "hvac", "other",
] as const;
export type UtilityKind = (typeof UTILITY_KINDS)[number];

export const UTILITY_KIND_LABELS: Record<UtilityKind, string> = {
  power: "Temp Power",
  water: "Water",
  internet: "Internet",
  wifi: "Site Wi-Fi",
  cameras: "Cameras",
  security: "Security",
  lighting: "Lighting",
  hvac: "HVAC",
  other: "Other",
};

export const RISK_SCALES = ["low", "med", "high"] as const;
export type RiskScale = (typeof RISK_SCALES)[number];

export const RISK_STATUSES = ["open", "monitoring", "mitigated", "closed"] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];

/** Sections whose checklist items are informational — the real data lives in a
 *  dedicated tracker tab, so the checklist renders them as pointers. */
export const SECTION_FEEDS_TRACKER: Partial<Record<MobilizationSection, string>> = {
  "Temporary Utilities": "utilities",
  "Equipment Mobilization": "equipment",
  Permits: "permits",
  Schedule: "timeline",
  "Risk Register": "risks",
};

type CatalogItem = { title: string; description?: string };

/** Default checklist items grouped by section, seeded on project create. */
export const DEFAULT_MOBILIZATION_ITEMS: Record<MobilizationSection, CatalogItem[]> = {
  "Project Information": [
    { title: "Confirm project name, number, and address", description: "Auto-populated from the project record — verify and correct in Project settings." },
    { title: "Confirm owner and architect of record" },
    { title: "Confirm contract value and delivery method" },
    { title: "Confirm baseline start and substantial completion dates" },
  ],
  "Mobilization Objectives": [
    { title: "Define mobilization success criteria" },
    { title: "Set target date for field work to begin" },
    { title: "Identify long-lead constraints that gate mobilization" },
    { title: "Publish objectives to the project team" },
  ],
  "Staffing Plan": [
    { title: "Assign Project Executive" },
    { title: "Assign Project Manager" },
    { title: "Assign Superintendent" },
    { title: "Assign Field Engineer / Project Engineer" },
    { title: "Assign Safety Manager" },
    { title: "Confirm start dates and responsibilities for each role" },
  ],
  "Site Setup": [
    { title: "Construction entrance" },
    { title: "Fencing" },
    { title: "Gates" },
    { title: "Signage" },
    { title: "Office trailers" },
    { title: "Parking" },
    { title: "Laydown yard" },
    { title: "Material storage" },
    { title: "Fuel storage" },
    { title: "Portable toilets" },
    { title: "Dumpster locations" },
    { title: "First aid station" },
    { title: "Emergency assembly point" },
  ],
  "Temporary Utilities": [
    { title: "Temporary power" },
    { title: "Temporary water" },
    { title: "Internet service" },
    { title: "Site Wi-Fi" },
    { title: "Site cameras" },
    { title: "Security system" },
    { title: "Temporary lighting" },
    { title: "Trailer HVAC" },
  ],
  "Equipment Mobilization": [
    { title: "Tower / mobile crane" },
    { title: "Excavator" },
    { title: "Dozer" },
    { title: "Skid steer" },
    { title: "Telehandler / forklift" },
    { title: "Generators" },
    { title: "Light towers" },
    { title: "Survey equipment" },
  ],
  Permits: [
    { title: "Building Permit" },
    { title: "Grading Permit" },
    { title: "Utility Permit" },
    { title: "Stormwater Permit" },
    { title: "Environmental Permit" },
    { title: "Fire Department Approval" },
    { title: "OSHA Notifications" },
  ],
  Procurement: [
    { title: "Structural steel", description: "Track ordered / approved / fab status / delivery date." },
    { title: "HVAC equipment", description: "Track ordered / approved / fab status / delivery date." },
    { title: "Electrical switchgear", description: "Track ordered / approved / fab status / delivery date." },
    { title: "Generators", description: "Track ordered / approved / fab status / delivery date." },
    { title: "Roofing", description: "Track ordered / approved / fab status / delivery date." },
    { title: "Doors", description: "Track ordered / approved / fab status / delivery date." },
    { title: "Windows", description: "Track ordered / approved / fab status / delivery date." },
  ],
  "Safety Mobilization": [
    { title: "Site Safety Plan" },
    { title: "Emergency Action Plan" },
    { title: "OSHA orientation" },
    { title: "PPE requirements" },
    { title: "Drug testing" },
    { title: "Site-specific training" },
    { title: "Daily briefing process" },
    { title: "Emergency contacts" },
  ],
  "Environmental Plan": [
    { title: "Dust control" },
    { title: "Noise mitigation" },
    { title: "Erosion control" },
    { title: "Stormwater protection" },
    { title: "Spill kits" },
    { title: "Waste management" },
    { title: "Hazmat procedures" },
  ],
  "Communications Plan": [
    { title: "Daily super meeting" },
    { title: "Weekly owner meeting" },
    { title: "Weekly sub meeting" },
    { title: "Monthly exec review" },
    { title: "RFI workflow" },
    { title: "Submittal process" },
    { title: "Change order process" },
    { title: "Document control platform" },
  ],
  "Logistics Plan": [
    { title: "Truck routes" },
    { title: "Delivery hours" },
    { title: "Crane access" },
    { title: "Material laydown areas" },
    { title: "Employee parking" },
    { title: "Visitor parking" },
    { title: "Traffic control" },
    { title: "Gate schedule" },
  ],
  Schedule: [
    { title: "Baseline mobilization schedule published" },
    { title: "Notice to Proceed logged" },
    { title: "Earthwork start date confirmed" },
    { title: "Schedule reviewed with owner" },
  ],
  "Risk Register": [
    { title: "Initial risk workshop held" },
    { title: "Top mobilization risks logged with mitigations" },
    { title: "Risk owners assigned" },
  ],
  "Mobilization Checklist": [
    { title: "Contracts executed" },
    { title: "Insurance received" },
    { title: "Bonds received" },
    { title: "Permits approved" },
    { title: "Utilities installed" },
    { title: "Office trailer operational" },
    { title: "Internet active" },
    { title: "Fencing complete" },
    { title: "Safety orientation completed" },
    { title: "First subs mobilized" },
    { title: "Equipment on site" },
    { title: "Site logistics approved" },
    { title: "Emergency contacts posted" },
    { title: "Environmental controls installed" },
    { title: "Baseline schedule approved" },
  ],
};

/** Permit rows seeded on project create — all start at "Not Started". */
export const DEFAULT_PERMITS: { name: string; agency: string }[] = [
  { name: "Building Permit", agency: "City Building Department" },
  { name: "Grading Permit", agency: "City Engineering" },
  { name: "Utility Permit", agency: "Public Works" },
  { name: "Stormwater Permit", agency: "State Environmental Agency" },
  { name: "Environmental Permit", agency: "State Environmental Agency" },
  { name: "Fire Department Approval", agency: "Fire Marshal" },
  { name: "OSHA Notifications", agency: "OSHA" },
];

/** Mobilization milestone titles + day offsets from the project start date.
 *  Seeded into the shared `milestones` table with kind="mobilization". */
export const DEFAULT_MILESTONE_OFFSETS: { title: string; dayOffset: number }[] = [
  { title: "Notice to Proceed", dayOffset: 0 },
  { title: "Survey Complete", dayOffset: 2 },
  { title: "Site Fence Installed", dayOffset: 3 },
  { title: "Temp Power Energized", dayOffset: 5 },
  { title: "Site Office Operational", dayOffset: 7 },
  { title: "Utilities Connected", dayOffset: 10 },
  { title: "Equipment Delivered", dayOffset: 12 },
  { title: "Safety Orientation Held", dayOffset: 13 },
  { title: "Earthwork Begins", dayOffset: 14 },
];

/** Sign-off roles seeded onto every new mobilization plan, in render order.
 *  The last four have no internal counterpart, so they are never auto-filled. */
export const DEFAULT_SIGNER_ROLES: string[] = [
  "Chief Executive Officer",
  "Project Executive",
  "Project Manager",
  "Superintendent",
  "Safety Manager",
  "Owner Representative",
  "Architect of Record",
  "Engineer of Record",
  "Permit Authority",
];

/** Loose matching against team_members.role so "PM", "Project Mgr" and
 *  "Project Manager" all resolve to the same signer. */
export const SIGNER_ROLE_ALIASES: Record<string, string[]> = {
  "Chief Executive Officer": ["ceo", "chief executive"],
  "Project Executive": ["project executive", "exec", "px"],
  "Project Manager": ["project manager", "pm", "project mgr"],
  "Superintendent": ["superintendent", "super", "supt"],
  "Safety Manager": ["safety manager", "safety", "ehs"],
};

/** The milestone that marks "field work begins" — drives days-to-earthwork. */
export const EARTHWORK_MILESTONE_TITLE = "Earthwork Begins";

/** Milestone kind used to tag mobilization rows in the shared milestones table. */
export const MOBILIZATION_MILESTONE_KIND = "mobilization";

/** Total number of checklist items seeded for a fresh project. */
export const DEFAULT_ITEM_COUNT = Object.values(DEFAULT_MOBILIZATION_ITEMS)
  .reduce((n, items) => n + items.length, 0);

/** Add `days` to an ISO date string, returning YYYY-MM-DD. Falls back to today
 *  when the input is missing or unparseable so seeding never throws. */
export function addDays(isoDate: string | null | undefined, days: number): string {
  const base = isoDate ? new Date(isoDate) : new Date();
  const d = Number.isNaN(base.getTime()) ? new Date() : base;
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + days);
  return out.toISOString().slice(0, 10);
}

/** Whole days from today until `isoDate`. Negative when the date has passed. */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const a = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((a - b) / 86400000);
}

export type HealthTone = "green" | "yellow" | "red";

/**
 * Health rules (shared by the health endpoint and the portfolio cards so a
 * project never shows two different colours):
 *   red    — under 60%, OR any permit rejected/expired, OR earthwork is less
 *            than 3 days out while the plan is still below 80%.
 *   green  — 90%+ with no rejected/expired permits.
 *   yellow — everything in between.
 */
export function computeHealth(args: {
  overallPct: number;
  hasBlockedPermit: boolean;
  daysToEarthwork: number | null;
}): HealthTone {
  const { overallPct, hasBlockedPermit, daysToEarthwork } = args;
  if (hasBlockedPermit) return "red";
  if (overallPct < 60) return "red";
  if (daysToEarthwork !== null && daysToEarthwork < 3 && overallPct < 80) return "red";
  if (overallPct >= 90) return "green";
  return "yellow";
}

/** Percentage helper — returns 0 (not NaN) for an empty denominator. */
export function pct(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
