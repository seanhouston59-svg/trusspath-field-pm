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
  projects: "/projects",
  projectDetail: "/projects/:id",
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
  executiveOs: "/executive-os",
  executiveOsProjectSetup: "/executive-os/project-setup",
  executiveOsProjectSetupDetail: "/executive-os/project-setup/:id",
  executiveOsPreConstruction: "/executive-os/pre-construction",
  executiveOsPreConstructionDetail: "/executive-os/pre-construction/:id",
  executiveOsMobilization: "/executive-os/mobilization",
  executiveOsMobilizationDetail: "/executive-os/mobilization/:id",
  // Skeleton routes for lifecycle modules 4-22. Placeholder pages until each ships.
  executiveOsSiteLogistics: "/executive-os/site-logistics",
  executiveOsSiteLogisticsDetail: "/executive-os/site-logistics/:id",
  executiveOsSitework: "/executive-os/sitework",
  executiveOsSiteworkDetail: "/executive-os/sitework/:id",
  executiveOsFoundations: "/executive-os/foundations",
  executiveOsFoundationsDetail: "/executive-os/foundations/:id",
  executiveOsStructure: "/executive-os/structure",
  executiveOsStructureDetail: "/executive-os/structure/:id",
  executiveOsEnvelope: "/executive-os/envelope",
  executiveOsEnvelopeDetail: "/executive-os/envelope/:id",
  executiveOsMep: "/executive-os/mep",
  executiveOsMepDetail: "/executive-os/mep/:id",
  executiveOsInteriorFraming: "/executive-os/interior-framing",
  executiveOsInteriorFramingDetail: "/executive-os/interior-framing/:id",
  executiveOsInteriorFinishes: "/executive-os/interior-finishes",
  executiveOsInteriorFinishesDetail: "/executive-os/interior-finishes/:id",
  executiveOsVerticalTransportation: "/executive-os/vertical-transportation",
  executiveOsVerticalTransportationDetail: "/executive-os/vertical-transportation/:id",
  executiveOsSiteImprovements: "/executive-os/site-improvements",
  executiveOsSiteImprovementsDetail: "/executive-os/site-improvements/:id",
  executiveOsCommissioning: "/executive-os/commissioning",
  executiveOsCommissioningDetail: "/executive-os/commissioning/:id",
  executiveOsPunchList: "/executive-os/punch-list",
  executiveOsPunchListDetail: "/executive-os/punch-list/:id",
  executiveOsCloseout: "/executive-os/closeout",
  executiveOsCloseoutDetail: "/executive-os/closeout/:id",
  executiveOsWarranty: "/executive-os/warranty",
  executiveOsWarrantyDetail: "/executive-os/warranty/:id",
  executiveOsSafety: "/executive-os/safety",
  executiveOsSafetyDetail: "/executive-os/safety/:id",
  executiveOsQuality: "/executive-os/quality",
  executiveOsQualityDetail: "/executive-os/quality/:id",
  executiveOsFinancials: "/executive-os/financials",
  executiveOsFinancialsDetail: "/executive-os/financials/:id",
  executiveOsSchedule: "/executive-os/schedule",
  executiveOsScheduleDetail: "/executive-os/schedule/:id",
  executiveOsRisk: "/executive-os/risk",
  executiveOsRiskDetail: "/executive-os/risk/:id",
  // New lean modules added Jul 2026 based on lifecycle overhaul feedback.
  executiveOsMaterialTracking: "/executive-os/material-tracking",
  executiveOsMaterialTrackingDetail: "/executive-os/material-tracking/:id",
  executiveOsOmManuals: "/executive-os/om-manuals",
  executiveOsOmManualsDetail: "/executive-os/om-manuals/:id",
  executiveOsAsBuilts: "/executive-os/as-builts",
  executiveOsAsBuiltsDetail: "/executive-os/as-builts/:id",
  executiveOsOwnerTraining: "/executive-os/owner-training",
  executiveOsOwnerTrainingDetail: "/executive-os/owner-training/:id",
  executiveOsTurnoverPackage: "/executive-os/turnover-package",
  executiveOsTurnoverPackageDetail: "/executive-os/turnover-package/:id",
  executiveOsRiskRegister: "/executive-os/risk-register",
  executiveOsRiskRegisterDetail: "/executive-os/risk-register/:id",
  executiveOsMeetings: "/executive-os/meetings",
  executiveOsMeetingsDetail: "/executive-os/meetings/:id",
  // Purpose-built (non-lean) exec-os surfaces.
  executiveOsContracts: "/executive-os/contracts",
  executiveOsContractsDetail: "/executive-os/contracts/:id",
  executiveOsInspections: "/executive-os/inspections",
  executiveOsInspectionsDetail: "/executive-os/inspections/:id",
  executiveOsBoardPackets: "/executive-os/board-packets",
  adminSignups: "/admin/signups",
  // Mobile field kit (PWA) routes
  field: "/field",
  fieldDailyLog: "/field/daily-log",
  fieldTimecard: "/field/timecard",
  fieldPhoto: "/field/photo",
  fieldObservation: "/field/observation",
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
    allowedRoutes: ALL.filter((r) => r !== R.settings && r !== R.settingsTeam && r !== R.adminSignups && !r.startsWith(R.executiveOs)),
  },
  {
    slug: "superintendent",
    label: "Superintendent",
    blurb: "Field execution — schedule, tasks, RFIs, submittals, punch, daily logs, photos, blueprints, drone, and fleet.",
    order: 3,
    canManageTeam: false, canManageSettings: false, canManageIntegrations: false,
    canViewFinancials: false, canDelete: false, canCreateEdit: true, canResetData: false,
    allowedRoutes: [
      R.dashboard, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
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
      R.dashboard, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
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
      R.dashboard, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
      R.rfis, R.submittals, R.photos, R.documents, R.companyDocuments, R.blueprints, R.messages, R.timesheets,
      R.teams, R.excel,
      // Subs can log field activity for their own scope (photos, observations).
      R.field, R.fieldPhoto, R.fieldObservation,
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
      R.dashboard, R.projects, R.projectDetail, R.schedule, R.gantt, R.cpm,
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
