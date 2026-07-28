// Project Setup catalog — default deliverables, stakeholder roles, signer
// roles, and the contract/delivery enumerations used by the pre-mobilization
// intake module.
//
// Lives in shared/ because the server imports it for seeding
// (storage.seedProjectSetup) and the health rollup, and the client imports it
// for labels and select options. Changing a label here does NOT rename
// already-seeded rows — project_setup_deliverables.label is persisted text.
// Add new deliverables at the end so existing sortOrder values stay stable.

export const PROJECT_SETUP_DELIVERABLES: { label: string; sortOrder: number }[] = [
  { label: "Project Charter", sortOrder: 0 },
  { label: "Kickoff Meeting", sortOrder: 1 },
  { label: "Risk Register", sortOrder: 2 },
  { label: "Communication Plan Distribution", sortOrder: 3 },
  { label: "Insurance Certs on File", sortOrder: 4 },
  { label: "Bond Recorded", sortOrder: 5 },
  { label: "Permits Received", sortOrder: 6 },
  { label: "Baseline Schedule Accepted", sortOrder: 7 },
  { label: "Baseline Budget Locked", sortOrder: 8 },
  { label: "Team Directory Published", sortOrder: 9 },
  { label: "SharePoint / Procore Setup", sortOrder: 10 },
  { label: "Field Trailer Set", sortOrder: 11 },
  { label: "Site Sign Installed", sortOrder: 12 },
];

/** Deliverables that gate Mobilization. Any of these left `pending` shows up in
 *  the health rollup's `missingCritical` and warns on the Mobilization page. */
export const CRITICAL_DELIVERABLES: string[] = [
  "Insurance Certs on File",
  "Bond Recorded",
  "Permits Received",
  "Baseline Schedule Accepted",
  "Baseline Budget Locked",
];

/** Suggested stakeholder roles. Not seeded — the directory is per-project, so
 *  these drive the "add stakeholder" role picker rather than default rows. */
export const PROJECT_SETUP_STAKEHOLDER_ROLES: string[] = [
  "Owner",
  "Owner Rep",
  "Architect",
  "MEP Engineer",
  "Structural Engineer",
  "Civil Engineer",
  "Geotech",
  "AHJ Inspector",
  "GC PM",
  "GC Super",
  "Safety Officer",
];

/** Charter sign-off block, seeded in this order. */
export const PROJECT_SETUP_SIGNERS: string[] = [
  "Chief Executive Officer",
  "Project Executive",
  "Project Manager",
  "Owner Representative",
  "Architect of Record",
];

export const PROJECT_SETUP_DELIVERABLE_STATUSES = ["pending", "in_progress", "complete", "na"] as const;
export type ProjectSetupDeliverableStatus = (typeof PROJECT_SETUP_DELIVERABLE_STATUSES)[number];

export const PROJECT_SETUP_DELIVERABLE_STATUS_LABELS: Record<ProjectSetupDeliverableStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  complete: "Complete",
  na: "N/A",
};

export const PROJECT_SETUP_STATUSES = [
  { value: "in_progress", label: "In progress" },
  { value: "ready_for_kickoff", label: "Ready for kickoff" },
  { value: "kicked_off", label: "Kicked off" },
  { value: "complete", label: "Complete" },
] as const;

export type ProjectSetupStatus = (typeof PROJECT_SETUP_STATUSES)[number]["value"];

export const CONTRACT_TYPES = [
  { value: "lump_sum", label: "Lump Sum" },
  { value: "gmp", label: "Guaranteed Maximum Price" },
  { value: "cost_plus", label: "Cost Plus" },
  { value: "t_and_m", label: "Time & Materials" },
  { value: "unit_price", label: "Unit Price" },
  { value: "design_build", label: "Design-Build" },
  { value: "other", label: "Other" },
] as const;

export const DELIVERY_METHODS = [
  { value: "dbb", label: "Design-Bid-Build" },
  { value: "cmar", label: "CM at Risk" },
  { value: "design_build", label: "Design-Build" },
  { value: "ipd", label: "Integrated Project Delivery" },
  { value: "other", label: "Other" },
] as const;

export const BILLING_CYCLES = [
  { value: "monthly", label: "Monthly" },
  { value: "bi_monthly", label: "Bi-monthly" },
  { value: "milestone", label: "Milestone" },
] as const;

export const CONTRACT_DOC_KINDS = [
  { value: "contract", label: "Contract" },
  { value: "exhibit", label: "Exhibit" },
  { value: "spec", label: "Specification" },
  { value: "drawing_set", label: "Drawing Set" },
  { value: "addendum", label: "Addendum" },
  { value: "insurance_cert", label: "Insurance Certificate" },
  { value: "bond", label: "Bond" },
  { value: "permit", label: "Permit" },
  { value: "other", label: "Other" },
] as const;

/** Best-effort roster matching for the charter sign-off block, mirroring the
 *  aliases the Mobilization signer block uses. */
export const PROJECT_SETUP_SIGNER_ALIASES: Record<string, string[]> = {
  "Chief Executive Officer": ["ceo", "chief executive", "owner", "president"],
  "Project Executive": ["project executive", "px", "executive"],
  "Project Manager": ["project manager", "pm"],
  "Owner Representative": ["owner rep", "owner representative", "client rep"],
  "Architect of Record": ["architect", "aor", "architect of record"],
};
