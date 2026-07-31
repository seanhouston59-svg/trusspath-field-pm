/**
 * Shared app manifest — single source of truth for routes, sidebar nav, and
 * landing feature links. Imported by BOTH the frontend (layout, health UI) and
 * the backend (server/health.ts link scanner) so the health scan never drifts
 * from what the app actually renders.
 *
 * NOTE on icons: stored as string keys here (no React imports) so the server can
 * import this file too. layout.tsx maps keys -> lucide components via ICONS.
 */

export type RoutePattern = string;

/** Every route registered in App.tsx (patterns; :id = dynamic segment). */
export const APP_ROUTES: RoutePattern[] = [
  "/", "/app", "/notifications", "/projects", "/projects/:id", "/projects/:id/sub-uploads", "/schedule", "/gantt", "/cpm", "/integrations",
  "/tasks", "/action-items", "/rfis", "/submittals", "/change-orders", "/punch",
  "/daily-logs", "/photos", "/documents", "/company-documents", "/blueprints", "/equipment", "/drone",
  "/team", "/contacts", "/messages", "/notes", "/timesheets", "/deleted-items", "/settings", "/settings/team",
  "/teams", "/excel",
  "/executive-os", "/executive-os/upsell",
  "/executive-os/project-setup", "/executive-os/project-setup/:id",
  "/executive-os/pre-construction", "/executive-os/pre-construction/:id",
  "/executive-os/mobilization", "/executive-os/mobilization/:id",
  // Skeleton routes (modules 4-22) — placeholder pages until each ships.
  "/executive-os/site-logistics", "/executive-os/site-logistics/:id",
  "/executive-os/sitework", "/executive-os/sitework/:id",
  "/executive-os/foundations", "/executive-os/foundations/:id",
  "/executive-os/structure", "/executive-os/structure/:id",
  "/executive-os/envelope", "/executive-os/envelope/:id",
  "/executive-os/mep", "/executive-os/mep/:id",
  "/executive-os/interior-framing", "/executive-os/interior-framing/:id",
  "/executive-os/interior-finishes", "/executive-os/interior-finishes/:id",
  "/executive-os/vertical-transportation", "/executive-os/vertical-transportation/:id",
  "/executive-os/site-improvements", "/executive-os/site-improvements/:id",
  "/executive-os/commissioning", "/executive-os/commissioning/:id",
  "/executive-os/punch-list", "/executive-os/punch-list/:id",
  "/executive-os/closeout", "/executive-os/closeout/:id",
  "/executive-os/warranty", "/executive-os/warranty/:id",
  "/executive-os/safety", "/executive-os/safety/:id",
  "/executive-os/quality", "/executive-os/quality/:id",
  "/executive-os/financials", "/executive-os/financials/:id",
  "/executive-os/schedule", "/executive-os/schedule/:id",
  "/executive-os/risk", "/executive-os/risk/:id",
  // New lean modules (lifecycle overhaul, Jul 2026).
  "/executive-os/material-tracking", "/executive-os/material-tracking/:id",
  "/executive-os/om-manuals", "/executive-os/om-manuals/:id",
  "/executive-os/as-builts", "/executive-os/as-builts/:id",
  "/executive-os/owner-training", "/executive-os/owner-training/:id",
  "/executive-os/turnover-package", "/executive-os/turnover-package/:id",
  "/executive-os/risk-register", "/executive-os/risk-register/:id",
  "/executive-os/meetings", "/executive-os/meetings/:id",
  // Purpose-built exec-os surfaces.
  "/executive-os/contracts", "/executive-os/contracts/:id",
  "/executive-os/inspections", "/executive-os/inspections/:id",
  "/executive-os/board-packets",
  "/field", "/field/daily-log", "/field/timecard", "/field/photo", "/field/observation", "/field/voice-note", "/field/punch",
];

export type NavLink = { href: string; label: string; icon: string };
/** A non-clickable label that divides a group's links into labelled runs. */
export type NavSubheader = { subheader: string };
export type NavItem = NavLink | NavSubheader;
export type NavGroup = { title: string; items: NavItem[] };

export function isNavLink(item: NavItem): item is NavLink {
  return "href" in item;
}

/**
 * Sidebar navigation groups (mirrors client/src/components/layout.tsx).
 *
 * Grouping principle: sections mirror the departments of a construction
 * company — Home, Projects, Field, HR, Admin — so a link lives wherever the
 * person who owns that work sits. Sections default to collapsed (see NavList
 * in layout.tsx) so the sidebar is a short clean list, not a wall of links.
 * The group holding the active route auto-expands so you always see where
 * you are.
 *
 * /deleted-items is intentionally absent — the route still works, it's just
 * not worth a permanent sidebar slot.
 *
 * Field kit routes are intentionally NOT in the sidebar — they're reached
 * via the dedicated Field mode (topbar hard-hat toggle or PWA homescreen).
 * They remain whitelisted in shared/access-levels.ts.
 */
export const APP_NAV: NavGroup[] = [
  {
    title: "Home",
    items: [
      { href: "/app", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/notes", label: "Sticky Board", icon: "StickyNote" },
    ],
  },
  {
    title: "Projects",
    items: [
      { href: "/projects", label: "Projects", icon: "FolderKanban" },
      { href: "/schedule", label: "Schedule", icon: "CalendarRange" },
      { href: "/gantt", label: "Gantt", icon: "GanttChartSquare" },
      { href: "/cpm", label: "CPM Diagram", icon: "Network" },
      { href: "/rfis", label: "RFIs", icon: "HelpCircle" },
      { href: "/submittals", label: "Submittals", icon: "FileStack" },
      { href: "/change-orders", label: "Change Orders", icon: "GitPullRequestArrow" },
      { href: "/tasks", label: "Tasks", icon: "ListChecks" },
      { href: "/action-items", label: "Action Items", icon: "CheckSquare" },
      { href: "/documents", label: "Project Documents", icon: "FileText" },
    ],
  },
  {
    title: "Field",
    items: [
      { href: "/daily-logs", label: "Daily Logs", icon: "ClipboardList" },
      { href: "/photos", label: "Photo Log", icon: "Image" },
      { href: "/punch", label: "Punch List", icon: "CheckSquare" },
      { href: "/blueprints", label: "Blueprints", icon: "PencilRuler" },
      { href: "/drone", label: "Drone Captures", icon: "Plane" },
      { href: "/equipment", label: "Fleet & Equipment", icon: "Wrench" },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/team", label: "Project Team", icon: "Users" },
      { href: "/contacts", label: "Contacts", icon: "Contact" },
      { href: "/timesheets", label: "Time Tracking", icon: "Clock" },
      { href: "/messages", label: "Messages", icon: "MessageSquare" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/settings", label: "Settings", icon: "Settings" },
      { href: "/settings/team", label: "Team & Access", icon: "ShieldCheck" },
      { href: "/teams", label: "Microsoft Teams", icon: "Video" },
      { href: "/excel", label: "Microsoft Excel", icon: "FileSpreadsheet" },
      { href: "/integrations", label: "Integrations", icon: "Plug" },
      { href: "/company-documents", label: "Company Documents", icon: "Building2" },
    ],
  },
  {
    // Executive OS lays out job lifecycle first, then cross-cutting workstreams.
    // "Phases" runs in job order from Project Setup through Post-Occupancy.
    // "Always On" holds modules that run every day of the job (Schedule, Financials,
    // Safety, Quality, etc.) and have no natural phase slot.
    title: "Executive OS",
    items: [
      { href: "/executive-os", label: "Overview", icon: "Sparkles" },
      { subheader: "Phases" },
      { href: "/executive-os/project-setup", label: "Project Setup", icon: "ClipboardList" },
      { href: "/executive-os/pre-construction", label: "Pre-Construction", icon: "Ruler" },
      { href: "/executive-os/mobilization", label: "Mobilization", icon: "Rocket" },
      { href: "/executive-os/site-logistics", label: "Site Logistics", icon: "Truck" },
      { href: "/executive-os/sitework", label: "Sitework & Earthwork", icon: "Mountain" },
      { href: "/executive-os/foundations", label: "Foundations", icon: "Layers" },
      { href: "/executive-os/structure", label: "Structure", icon: "Building2" },
      { href: "/executive-os/envelope", label: "Building Envelope", icon: "Home" },
      { href: "/executive-os/mep", label: "MEP Rough-in", icon: "Cable" },
      { href: "/executive-os/interior-framing", label: "Interior Framing", icon: "Boxes" },
      { href: "/executive-os/vertical-transportation", label: "Vertical Transportation", icon: "ArrowUpDown" },
      { href: "/executive-os/interior-finishes", label: "Interior Finishes", icon: "Paintbrush" },
      { href: "/executive-os/site-improvements", label: "Site Improvements", icon: "Trees" },
      { href: "/executive-os/commissioning", label: "Commissioning", icon: "Gauge" },
      { href: "/executive-os/inspections", label: "Inspections", icon: "ClipboardCheck" },
      { href: "/executive-os/punch-list", label: "Punch List", icon: "ListTodo" },
      { href: "/executive-os/closeout", label: "Closeout & C of O", icon: "PackageCheck" },
      { href: "/executive-os/as-builts", label: "As-Built Drawings", icon: "FileSpreadsheet" },
      { href: "/executive-os/om-manuals", label: "O&M Manuals", icon: "BookOpen" },
      { href: "/executive-os/owner-training", label: "Owner Training", icon: "GraduationCap" },
      { href: "/executive-os/turnover-package", label: "Turnover Package", icon: "PackageOpen" },
      { href: "/executive-os/warranty", label: "Post-Occupancy / Warranty", icon: "BadgeCheck" },
      { subheader: "Always On" },
      { href: "/executive-os/schedule", label: "Schedule Control", icon: "CalendarClock" },
      { href: "/executive-os/financials", label: "Financials", icon: "DollarSign" },
      { href: "/executive-os/safety", label: "Safety", icon: "HardHat" },
      { href: "/executive-os/quality", label: "Quality", icon: "CheckCheck" },
      { href: "/executive-os/meetings", label: "Meetings & Minutes", icon: "Users" },
      { href: "/executive-os/contracts", label: "Contracts Register", icon: "FileSignature" },
      { href: "/executive-os/material-tracking", label: "Material Tracking", icon: "PackageSearch" },
      { href: "/executive-os/risk-register", label: "Risk Register", icon: "AlertOctagon" },
      { href: "/executive-os/risk", label: "Insurance & COI", icon: "ShieldAlert" },
      { href: "/executive-os/board-packets", label: "Board Packets", icon: "FileText" },
    ],
  },
];

/** Marketing-surface deep links. The redesigned landing page groups these into
 *  thematic buckets rather than one card per route, so this list is no longer a
 *  one-to-one mirror of the page — it stays as the route-coverage set that
 *  server/health.ts checks for broken links. */
export const LANDING_FEATURE_LINKS: { label: string; href: string }[] = [
  { label: "Daily Logs", href: "/daily-logs" },
  { label: "RFIs & Submittals", href: "/rfis" },
  { label: "Change Orders", href: "/change-orders" },
  { label: "Punch Lists", href: "/punch" },
  { label: "Schedule + Gantt", href: "/schedule" },
  { label: "Photo Log", href: "/photos" },
  { label: "Blueprints", href: "/blueprints" },
  { label: "Drone Captures", href: "/drone" },
  { label: "Fleet & Equipment", href: "/equipment" },
  { label: "Documents", href: "/documents" },
  { label: "Messages & Notes", href: "/messages" },
  { label: "Jarvis AI", href: "/app" },
];

/** Flatten every link href the app exposes (nav + landing features). */
export const APP_LINKS: { href: string; label: string; source: "nav" | "landing" }[] = [
  ...APP_NAV.flatMap((g) =>
    g.items.filter(isNavLink).map((i) => ({ href: i.href, label: i.label, source: "nav" as const })),
  ),
  ...LANDING_FEATURE_LINKS.map((f) => ({ href: f.href, label: f.label, source: "landing" as const })),
];

/** Match a concrete href (e.g. "/projects/3") against the route patterns.
 *
 * Callers sometimes pass a full location value like "/field?field=1" or
 * "/projects/3#section" — in particular wouter's useHashLocation returns
 * the pathname with any query string still appended. Strip the query and
 * hash before comparing so a query flag doesn't accidentally lock a user
 * out of a page they should be able to see.
 */
export function hrefMatchesRoute(href: string, pattern: string): boolean {
  const cleanHref = href.split("?")[0].split("#")[0];
  if (pattern === cleanHref) return true;
  const seg = pattern.split("/");
  const h = cleanHref.split("/");
  if (seg.length !== h.length) return false;
  return seg.every((s, i) => s.startsWith(":") || s === h[i]);
}

export function isKnownRoute(href: string): boolean {
  return APP_ROUTES.some((p) => hrefMatchesRoute(href, p));
}
