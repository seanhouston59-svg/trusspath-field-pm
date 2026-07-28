// Pre-Construction catalog — the enumerations behind the design, permitting,
// prequal, buyout and long-lead tracking in the Pre-Construction module, plus
// the default signer roles for the Pre-Construction Plan sign-off block.
//
// Lives in shared/ because the server imports it for seeding and the health
// rollup, and the client imports it for labels and select options. Changing a
// label here does NOT rename already-seeded rows — the `value` strings are the
// persisted ones, so add new entries rather than renaming existing values.

export const PRE_CONSTRUCTION_STATUSES = [
  { value: "in_progress", label: "In progress" },
  { value: "design_locked", label: "Design locked" },
  { value: "bought_out", label: "Bought out" },
  { value: "complete", label: "Complete" },
] as const;

export type PreConstructionStatus = (typeof PRE_CONSTRUCTION_STATUSES)[number]["value"];

/** Design maturity, in order. The list is ordered so a UI can render it as a
 *  progression and the rollup can compare two phases by index. */
export const DESIGN_PHASES = [
  { value: "sd", label: "Schematic Design" },
  { value: "dd", label: "Design Development" },
  { value: "cd", label: "Construction Documents" },
  { value: "permit_set", label: "Permit Set" },
  { value: "bid_set", label: "Bid Set" },
  { value: "for_construction", label: "For Construction" },
] as const;

export type DesignPhase = (typeof DESIGN_PHASES)[number]["value"];

export const DESIGN_DISCIPLINES = [
  { value: "architectural", label: "Architectural" },
  { value: "structural", label: "Structural" },
  { value: "mep", label: "MEP" },
  { value: "civil", label: "Civil" },
  { value: "landscape", label: "Landscape" },
  { value: "interiors", label: "Interiors" },
  { value: "other", label: "Other" },
] as const;

export type DesignDiscipline = (typeof DESIGN_DISCIPLINES)[number]["value"];

export const DOC_TYPES = [
  { value: "drawing_set", label: "Drawing Set" },
  { value: "spec_section", label: "Spec Section" },
  { value: "addendum", label: "Addendum" },
  { value: "bulletin", label: "Bulletin" },
  { value: "sketch", label: "Sketch" },
  { value: "narrative", label: "Narrative" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
] as const;

export type DocType = (typeof DOC_TYPES)[number]["value"];

export const DESIGN_RFI_STATUSES = [
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "void", label: "Void" },
] as const;

export type DesignRfiStatus = (typeof DESIGN_RFI_STATUSES)[number]["value"];

export const VE_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "held", label: "Held" },
] as const;

export type VeStatus = (typeof VE_STATUSES)[number]["value"];

export const PERMIT_TYPES = [
  { value: "building", label: "Building" },
  { value: "demolition", label: "Demolition" },
  { value: "earthwork", label: "Earthwork" },
  { value: "foundation", label: "Foundation" },
  { value: "mep", label: "MEP" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "mechanical", label: "Mechanical" },
  { value: "fire", label: "Fire" },
  { value: "zoning", label: "Zoning" },
  { value: "right_of_way", label: "Right of Way" },
  { value: "environmental", label: "Environmental" },
  { value: "other", label: "Other" },
] as const;

export type PermitType = (typeof PERMIT_TYPES)[number]["value"];

export const PERMIT_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "application_in_progress", label: "Application in progress" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "conditions_pending", label: "Conditions pending" },
  { value: "issued", label: "Issued" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
] as const;

export type PermitStatus = (typeof PERMIT_STATUSES)[number]["value"];

export const PREQUAL_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "conditionally_approved", label: "Conditionally approved" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
] as const;

export type PrequalStatus = (typeof PREQUAL_STATUSES)[number]["value"];

export const BID_PACKAGE_STATUSES = [
  { value: "not_ready", label: "Not ready" },
  { value: "out_for_bid", label: "Out for bid" },
  { value: "bids_received", label: "Bids received" },
  { value: "awarded", label: "Awarded" },
  { value: "contract_executed", label: "Contract executed" },
  { value: "on_hold", label: "On hold" },
] as const;

export type BidPackageStatus = (typeof BID_PACKAGE_STATUSES)[number]["value"];

export const LONG_LEAD_STATUSES = [
  { value: "identified", label: "Identified" },
  { value: "submittal_pending", label: "Submittal pending" },
  { value: "submittal_approved", label: "Submittal approved" },
  { value: "ordered", label: "Ordered" },
  { value: "in_fabrication", label: "In fabrication" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "installed", label: "Installed" },
  { value: "at_risk", label: "At risk" },
] as const;

export type LongLeadStatus = (typeof LONG_LEAD_STATUSES)[number]["value"];

/** Pre-Construction Plan sign-off block, seeded in this order. */
export const PRE_CONSTRUCTION_SIGNERS: string[] = [
  "Chief Executive Officer",
  "Project Executive",
  "Preconstruction Lead",
  "Chief Estimator",
  "Design Manager",
  "Owner Representative",
  "Architect of Record",
  "Engineer of Record",
];

/** Permits that gate Mobilization. Any of these not yet `issued` shows up in
 *  the health rollup and warns on the Mobilization page. */
export const CRITICAL_PERMIT_TYPES: string[] = [
  "building",
  "demolition",
  "earthwork",
  "foundation",
  "right_of_way",
];
