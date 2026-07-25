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
  settings: "/settings",
};

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
    allowedRoutes: ALL.filter((r) => r !== R.settings),
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
      R.contacts, R.messages, R.notes,
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
      R.messages, R.notes,
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
      R.rfis, R.submittals, R.photos, R.documents, R.companyDocuments, R.blueprints, R.messages,
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
      R.contacts, R.messages, R.notes,
    ],
  },
];

export const ACCESS_BY_SLUG: Record<AccessLevel, AccessLevelDef> = Object.fromEntries(
  ACCESS_LEVELS.map((l) => [l.slug, l]),
) as Record<AccessLevel, AccessLevelDef>;

export const DEFAULT_ACCESS_LEVEL: AccessLevel = "project_executive";

export function isRouteAllowed(level: AccessLevel, path: string): boolean {
  if (path === "/" || path === "") return true;
  const def = ACCESS_BY_SLUG[level];
  return def.allowedRoutes.some((p) => hrefMatchesRoute(path, p));
}
