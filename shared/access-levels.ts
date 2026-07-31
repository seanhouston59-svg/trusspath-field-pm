import { hrefMatchesRoute } from "./app-manifest";

export type AccessLevel =
  | "project_executive"
  | "project_manager"
  | "superintendent"
  | "foreman"
  | "subcontractor"
  | "viewer";

export interface AccessCapabilities {
  canManageTeam: boolean;
  canManageSettings: boolean;
  canManageIntegrations: boolean;
  canViewFinancials: boolean;
  canDelete: boolean;
  canCreateEdit: boolean;
  canResetData: boolean;
  allowedRoutes: string[];
}

export interface AccessLevelDef extends AccessCapabilities {
  slug: AccessLevel;
  label: string;
  blurb: string;
  order: number;
}

// Route patterns (mirror APP_ROUTES). "/" (landing) is public to all levels.
const R = {
  dashboard: "/app",
  notifications: "/notifications",
  projects: "/projects",
  projectDetail: "/projects/:id",
  // Sub Drop Portal PM-side inbox: review, categorize, and act on documents
  // that subs uploaded via the /drop/:token portal. PM/exec workflow only —
  // gated below to PE, PM, and Super.
  projectSubUploads: "/projects/:id/sub-uploads",
  schedule: "/schedule",
  gantt: "/gantt",
  cpm: "/cpm",
  integrations: "/integrations",
  tasks: "/tasks",
  actionItems: "/action-items",
  rfis: "/rfis",
  submittals: "/submittals",
  changeOrders: "/change-orders",
  punch: "/punch",
  dailyLogs: "/daily-logs",
  photos: "/photos",
  documents: "/documents",
  companyDocuments: "/company-documents",
  blueprints: "/blueprints",
  equipment: "/equipment",
  drone: "/drone",
  team: "/team",
  contacts: "/contacts",
  messages: "/messages",
  notes: "/notes",
  timesheets: "/timesheets",
  deletedItems: "/deleted-items",
  settings: "/settings",
  settingsTeam: "/settings/team",
  commandDeck: "/executive-os",
  commandDeckUpsell: "/executive-os/upsell",
  commandDeckProjectSetup: "/executive-os/project-setup",
  commandDeckProjectSetupDetail: "/executive-os/project-setup/:id",
  commandDeckPreConstruction: "/executive-os/pre-construction",
  commandDeckPreConstructionDetail: "/executive-os/pre-construction/:id",
  commandDeckMobilization: "/executive-os/mobilization",
  commandDeckMobilizationDetail: "/executive-os/mobilization/:id",
  // Skeleton routes for lifecycle modules 4-22. Placeholder pages until each ships.
  commandDeckSiteLogistics: "/executive-os/site-logistics",
  commandDeckSiteLogisticsDetail: "/executive-os/site-logistics/:id",
  commandDeckSitework: "/executive-os/sitework",
  commandDeckSiteworkDetail: "/executive-os/sitework/:id",
  commandDeckFoundations: "/executive-os/foundations",
  commandDeckFoundationsDetail: "/executive-os/foundations/:id",
  commandDeckStructure: "/executive-os/structure",
  commandDeckStructureDetail: "/executive-os/structure/:id",
  commandDeckEnvelope: "/executive-os/envelope",
  commandDeckEnvelopeDetail: "/executive-os/envelope/:id",
  commandDeckMep: "/executive-os/mep",
  commandDeckMepDetail: "/executive-os/mep/:id",
  commandDeckInteriorFraming: "/executive-os/interior-framing",
  commandDeckInteriorFramingDetail: "/executive-os/interior-framing/:id",
  commandDeckInteriorFinishes: "/executive-os/interior-finishes",
  commandDeckInteriorFinishesDetail: "/executive-os/interior-finishes/:id",
  commandDeckVerticalTransportation: "/executive-os/vertical-transportation",
  commandDeckVerticalTransportationDetail: "/executive-os/vertical-transportation/:id",
  commandDeckSiteImprovements: "/executive-os/site-improvements",
  commandDeckSiteImprovementsDetail: "/executive-os/site-improvements/:id",
  commandDeckCommissioning: "/executive-os/commissioning",
  commandDeckCommissioningDetail: "/executive-os/commissioning/:id",
  commandDeckPunchList: "/executive-os/punch-list",
  commandDeckPunchListDetail: "/executive-os/punch-list/:id",
  commandDeckCloseout: "/executive-os/closeout",
  commandDeckCloseoutDetail: "/executive-os/closeout/:id",
  commandDeckWarranty: "/executive-os/warranty",
  commandDeckWarrantyDetail: "/executive-os/warranty/:id",
  commandDeckSafety: "/executive-os/safety",
  commandDeckSafetyDetail: "/executive-os/safety/:id",
  commandDeckQuality: "/executive-os/quality",
  commandDeckQualityDetail: "/executive-os/quality/:id",
  commandDeckFinancials: "/executive-os/financials",
  commandDeckFinancialsDetail: "/executive-os/financials/:id",
  commandDeckSchedule: "/executive-os/schedule",
  commandDeckScheduleDetail: "/executive-os/schedule/:id",
  commandDeckRisk: "/executive-os/risk",
  commandDeckRiskDetail: "/executive-os/risk/:id",
  // New lean modules added Jul 2026 based on lifecycle overhaul feedback.
  commandDeckMaterialTracking: "/executive-os/material-tracking",
  commandDeckMaterialTrackingDetail: "/executive-os/material-tracking/:id",
  commandDeckOmManuals: "/executive-os/om-manuals",
  commandDeckOmManualsDetail: "/executive-os/om-manuals/:id",
  commandDeckAsBuilts: "/executive-os/as-builts",
  commandDeckAsBuiltsDetail: "/executive-os/as-builts/:id",
  commandDeckOwnerTraining: "/executive-os/owner-training",
  commandDeckOwnerTrainingDetail: "/executive-os/owner-training/:id",
  commandDeckTurnoverPackage: "/executive-os/turnover-package",
  commandDeckTurnoverPackageDetail: "/executive-os/turnover-package/:id",
  commandDeckRiskRegister: "/executive-os/risk-register",
  commandDeckRiskRegisterDetail: "/executive-os/risk-register/:id",
  commandDeckMeetings: "/executive-os/meetings",
  commandDeckMeetingsDetail: "/executive-os/meetings/:id",
  // Purpose-built (non-lean) exec-os surfaces.
  commandDeckContracts: "/executive-os/contracts",
  commandDeckContractsDetail: "/executive-os/contracts/:id",
  commandDeckInspections: "/executive-os/inspections",
  commandDeckInspectionsDetail: "/executive-os/inspections/:id",
  commandDeckBoardPackets: "/executive-os/board-packets",
  adminIndex: "/admin",
  adminSignups: "/admin/signups",
  adminAccounts: "/admin/accounts",
  adminDemoAccounts: "/admin/demo-accounts",
  // Mobile field kit (PWA) routes
  field: "/field",
  fieldDailyLog: "/field/daily-log",
  fieldTimecard: "/field/timecard",
  fieldPhoto: "/field/photo",
  fieldObservation: "/field/observation",
  fieldVoiceNote: "/field/voice-note",
  fieldPunch: "/field/punch",
  // External tool launchers — universal, available to every role.
  teams: "/teams",
  excel: "/excel",
};

// Field kit routes as a bundle for reuse across roles.
const FIELD_KIT_ROUTES = [
  "/field",
  "/field/daily-log",
  "/field/timecard",
  "/field/photo",
  "/field/observation",
  "/field/voice-note",
  "/field/punch",
];

const ALL = Object.values(R);

export const ACCESS_LEVELS: AccessLevelDef[] = [
  {
    slug: "project_executive",
    label: "Project Executive",
    blurb: "Full org access — every project, financials, team, settings, integrations, and data controls.",
    order: 1,
    canManageTeam: true, canManageSettings: true, canManageIntegrations: true,
    canViewFinancials: true, canDelete: true, canCreateEdit: true, canResetData: true,
    allowedRoutes: ALL,
  },
  {
    slug: "project_manager",
    label: "Project Manager",
    blurb: "Full project workflow control — create/edit records, team, integrations, and budgets. No org settings.",
    order: 2,
    canManageTeam: true, canManageSettings: false, canManageIntegrations: true,
    canViewFinancials: true, canDelete: true, canCreateEdit: true, canResetData: false,
    // Command Deck is no longer filtered out here — it is a paid per-seat
    // add-on enforced server-side off memberships.has_executive_os, and this
    // access-level system is a client-side preview, not authorization.
    allowedRoutes: ALL.filter(
      (r) =>
        r !== R.settings &&
        r !== R.settingsTeam &&
        r !== R.adminIndex &&
        r !== R.adminSignups &&
        r !== R.adminAccounts &&
        r !== R.adminDemoAccounts,
    ),
  },
  {
    slug: "superintendent",
    label: "Superintendent",
    blurb: "Field execution — schedule, tasks, RFIs, submittals, punch, daily logs, photos, blueprints, drone, and fleet.",
    order: 3,
    canManageTeam: false, canManageSettings: false, canManageIntegrations: false,
    canViewFinancials: false, canDelete: false, canCreateEdit: true, canResetData: false,
    allowedRoutes: [
      R.dashboard, R.notifications, R.projects, R.projectDetail, R.projectSubUploads, R.schedule, R.gantt, R.cpm,
      R.tasks, R.actionItems, R.rfis, R.submittals, R.changeOrders, R.punch,
      R.dailyLogs, R.photos, R.documents, R.companyDocuments, R.blueprints, R.equipment, R.drone,
      R.contacts, R.messages, R.notes, R.timesheets,
      R.teams, R.excel,
      ...FIELD_KIT_ROUTES,
    ],
  },
  {
    slug: "foreman",
    label: "Foreman",
    blurb: "Crew lead — update assigned tasks, daily logs, photos, punch, and view plans and schedule.",
    order: 4,
    canManageTeam: false, canManageSettings: false, canManageIntegrations: false,
    canViewFinancials: false, canDelete: false, canCreateEdit: true, canResetData: false,
    allowedRoutes: [
      R.dashboard, R.notifications, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
      R.tasks, R.punch, R.dailyLogs, R.photos, R.documents, R.companyDocuments, R.blueprints,
      R.messages, R.notes, R.timesheets,
      R.teams, R.excel,
      ...FIELD_KIT_ROUTES,
    ],
  },
  {
    slug: "subcontractor",
    label: "Subcontractor",
    blurb: "External contributor — view project info and plans, submit RFIs, submittals, photos, and documents for your scope.",
    order: 5,
    canManageTeam: false, canManageSettings: false, canManageIntegrations: false,
    canViewFinancials: false, canDelete: false, canCreateEdit: true, canResetData: false,
    allowedRoutes: [
      R.dashboard, R.notifications, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
      R.rfis, R.submittals, R.photos, R.documents, R.companyDocuments, R.blueprints, R.messages, R.timesheets,
      R.teams, R.excel,
      // Subs can log field activity for their own scope (photos, observations, voice notes).
      R.field, R.fieldPhoto, R.fieldObservation, R.fieldVoiceNote,
    ],
  },
  {
    slug: "viewer",
    label: "Viewer",
    blurb: "General read-only access — browse projects, plans, logs, and records without editing.",
    order: 6,
    canManageTeam: false, canManageSettings: false, canManageIntegrations: false,
    canViewFinancials: false, canDelete: false, canCreateEdit: false, canResetData: false,
    allowedRoutes: [
      R.dashboard, R.notifications, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
      R.tasks, R.actionItems, R.rfis, R.submittals, R.changeOrders, R.punch,
      R.dailyLogs, R.photos, R.documents, R.companyDocuments, R.blueprints, R.equipment, R.drone,
      R.contacts, R.messages, R.notes, R.timesheets,
      R.teams, R.excel,
      // Field kit hub is browsable in read-only mode; individual pages remain gated by canCreateEdit inside the pages themselves.
      R.field,
    ],
  },
];

export const ACCESS_BY_SLUG: Record<AccessLevel, AccessLevelDef> = Object.fromEntries(
  ACCESS_LEVELS.map((l) => [l.slug, l]),
) as Record<AccessLevel, AccessLevelDef>;

export const DEFAULT_ACCESS_LEVEL: AccessLevel = "project_executive";

/**
 * Maps a project-roster access level to the org-level login role (OrgRole).
 * Used when converting a Team roster entry into a paid seat via the
 * "Invite as user" flow. The mapping is intentionally conservative — project
 * roles that carry admin/finance/team-management responsibility become the
 * closest OrgRole with those capabilities; field roles collapse to "foreman";
 * everyone else gets read-only "viewer".
 *
 * Mapping table:
 *   project_executive  → owner   (billing, members, projects, all data)
 *   project_manager    → admin   (members + projects, no billing)
 *   superintendent     → pm      (projects + editing, no member mgmt)
 *   foreman            → foreman (crew lead, edit assigned projects only)
 *   subcontractor      → viewer  (external; read-only via project scope)
 *   viewer             → viewer
 *
 * Note: "owner" is the highest-privilege role. Server-side invite creation
 * additionally requires the inviter to already BE an owner — non-owners
 * inviting a project_executive will be automatically stepped down to admin
 * by the client before submit. See client/src/pages/team.tsx.
 */
export const ACCESS_LEVEL_TO_ORG_ROLE: Record<AccessLevel, "owner" | "admin" | "pm" | "foreman" | "viewer"> = {
  project_executive: "owner",
  project_manager:   "admin",
  superintendent:    "pm",
  foreman:           "foreman",
  subcontractor:     "viewer",
  viewer:            "viewer",
};

export function isRouteAllowed(level: AccessLevel, path: string): boolean {
  if (path === "/" || path === "") return true;
  const def = ACCESS_BY_SLUG[level];
  return def.allowedRoutes.some((p) => hrefMatchesRoute(path, p));
}
