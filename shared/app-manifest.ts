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

export const COMMAND_DECK_PREFIX = "/command-deck";
/** Command Deck shipped as "Executive OS" and its URLs still circulate in
 *  bookmarks, emails, and board packets, so the old prefix stays routable. */
const LEGACY_COMMAND_DECK_PREFIX = "/executive-os";

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isCommandDeckPath(path: string): boolean {
  return hasPrefix(path, COMMAND_DECK_PREFIX);
}

/** `/command-deck/mep` -> `/executive-os/mep`. Expects a Command Deck path. */
export function toLegacyCommandDeckPath(path: string): string {
  return LEGACY_COMMAND_DECK_PREFIX + path.slice(COMMAND_DECK_PREFIX.length);
}

/** `/executive-os/mep?x=1` -> `/command-deck/mep?x=1`, keeping any query or
 *  fragment tail intact. Returns null when `url` is not a legacy URL. */
export function toCommandDeckUrl(url: string): string | null {
  const tailAt = url.search(/[?#]/);
  const path = tailAt === -1 ? url : url.slice(0, tailAt);
  if (!hasPrefix(path, LEGACY_COMMAND_DECK_PREFIX)) return null;
  const tail = tailAt === -1 ? "" : url.slice(tailAt);
  return COMMAND_DECK_PREFIX + path.slice(LEGACY_COMMAND_DECK_PREFIX.length) + tail;
}

/** Command Deck route patterns (:id = dynamic segment). */
export const COMMAND_DECK_ROUTES: RoutePattern[] = [
  "/command-deck", "/command-deck/upsell",
  "/command-deck/project-setup", "/command-deck/project-setup/:id",
  "/command-deck/pre-construction", "/command-deck/pre-construction/:id",
  "/command-deck/mobilization", "/command-deck/mobilization/:id",
  // Skeleton routes (modules 4-22) — placeholder pages until each ships.
  "/command-deck/site-logistics", "/command-deck/site-logistics/:id",
  "/command-deck/sitework", "/command-deck/sitework/:id",
  "/command-deck/foundations", "/command-deck/foundations/:id",
  "/command-deck/structure", "/command-deck/structure/:id",
  "/command-deck/envelope", "/command-deck/envelope/:id",
  "/command-deck/mep", "/command-deck/mep/:id",
  "/command-deck/interior-framing", "/command-deck/interior-framing/:id",
  "/command-deck/interior-finishes", "/command-deck/interior-finishes/:id",
  "/command-deck/vertical-transportation", "/command-deck/vertical-transportation/:id",
  "/command-deck/site-improvements", "/command-deck/site-improvements/:id",
  "/command-deck/commissioning", "/command-deck/commissioning/:id",
  "/command-deck/punch-list", "/command-deck/punch-list/:id",
  "/command-deck/closeout", "/command-deck/closeout/:id",
  "/command-deck/warranty", "/command-deck/warranty/:id",
  "/command-deck/safety", "/command-deck/safety/:id",
  "/command-deck/quality", "/command-deck/quality/:id",
  "/command-deck/financials", "/command-deck/financials/:id",
  "/command-deck/schedule", "/command-deck/schedule/:id",
  "/command-deck/risk", "/command-deck/risk/:id",
  // New lean modules (lifecycle overhaul, Jul 2026).
  "/command-deck/material-tracking", "/command-deck/material-tracking/:id",
  "/command-deck/om-manuals", "/command-deck/om-manuals/:id",
  "/command-deck/as-builts", "/command-deck/as-builts/:id",
  "/command-deck/owner-training", "/command-deck/owner-training/:id",
  "/command-deck/turnover-package", "/command-deck/turnover-package/:id",
  "/command-deck/risk-register", "/command-deck/risk-register/:id",
  "/command-deck/meetings", "/command-deck/meetings/:id",
  // Purpose-built (non-lean) Command Deck surfaces.
  "/command-deck/contracts", "/command-deck/contracts/:id",
  "/command-deck/inspections", "/command-deck/inspections/:id",
  "/command-deck/board-packets",
];

/** The pre-rename URLs. Registered as real routes so legacy links resolve to a
 *  redirect instead of the 404 page, and so the health scan doesn't flag them. */
export const LEGACY_COMMAND_DECK_ROUTES: RoutePattern[] =
  COMMAND_DECK_ROUTES.map(toLegacyCommandDeckPath);

/** Every route registered in App.tsx (patterns; :id = dynamic segment). */
export const APP_ROUTES: RoutePattern[] = [
  "/", "/app", "/notifications", "/projects", "/projects/:id", "/projects/:id/sub-uploads", "/schedule", "/gantt", "/cpm", "/integrations",
  "/tasks", "/action-items", "/rfis", "/submittals", "/change-orders", "/punch",
  "/daily-logs", "/photos", "/documents", "/company-documents", "/blueprints", "/equipment", "/drone",
  "/team", "/contacts", "/messages", "/notes", "/timesheets", "/deleted-items", "/settings", "/settings/team",
  "/teams", "/excel",
  ...COMMAND_DECK_ROUTES,
  ...LEGACY_COMMAND_DECK_ROUTES,
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
    // Command Deck lays out job lifecycle first, then cross-cutting workstreams.
    // "Phases" runs in job order from Project Setup through Post-Occupancy.
    // "Always On" holds modules that run every day of the job (Schedule, Financials,
    // Safety, Quality, etc.) and have no natural phase slot.
    title: "Command Deck",
    items: [
      { href: "/command-deck", label: "Overview", icon: "Sparkles" },
      { subheader: "Phases" },
      { href: "/command-deck/project-setup", label: "Project Setup", icon: "ClipboardList" },
      { href: "/command-deck/pre-construction", label: "Pre-Construction", icon: "Ruler" },
      { href: "/command-deck/mobilization", label: "Mobilization", icon: "Rocket" },
      { href: "/command-deck/site-logistics", label: "Site Logistics", icon: "Truck" },
      { href: "/command-deck/sitework", label: "Sitework & Earthwork", icon: "Mountain" },
      { href: "/command-deck/foundations", label: "Foundations", icon: "Layers" },
      { href: "/command-deck/structure", label: "Structure", icon: "Building2" },
      { href: "/command-deck/envelope", label: "Building Envelope", icon: "Home" },
      { href: "/command-deck/mep", label: "MEP Rough-in", icon: "Cable" },
      { href: "/command-deck/interior-framing", label: "Interior Framing", icon: "Boxes" },
      { href: "/command-deck/vertical-transportation", label: "Vertical Transportation", icon: "ArrowUpDown" },
      { href: "/command-deck/interior-finishes", label: "Interior Finishes", icon: "Paintbrush" },
      { href: "/command-deck/site-improvements", label: "Site Improvements", icon: "Trees" },
      { href: "/command-deck/commissioning", label: "Commissioning", icon: "Gauge" },
      { href: "/command-deck/inspections", label: "Inspections", icon: "ClipboardCheck" },
      { href: "/command-deck/punch-list", label: "Punch List", icon: "ListTodo" },
      { href: "/command-deck/closeout", label: "Closeout & C of O", icon: "PackageCheck" },
      { href: "/command-deck/as-builts", label: "As-Built Drawings", icon: "FileSpreadsheet" },
      { href: "/command-deck/om-manuals", label: "O&M Manuals", icon: "BookOpen" },
      { href: "/command-deck/owner-training", label: "Owner Training", icon: "GraduationCap" },
      { href: "/command-deck/turnover-package", label: "Turnover Package", icon: "PackageOpen" },
      { href: "/command-deck/warranty", label: "Post-Occupancy / Warranty", icon: "BadgeCheck" },
      { subheader: "Always On" },
      { href: "/command-deck/schedule", label: "Schedule Control", icon: "CalendarClock" },
      { href: "/command-deck/financials", label: "Financials", icon: "DollarSign" },
      { href: "/command-deck/safety", label: "Safety", icon: "HardHat" },
      { href: "/command-deck/quality", label: "Quality", icon: "CheckCheck" },
      { href: "/command-deck/meetings", label: "Meetings & Minutes", icon: "Users" },
      { href: "/command-deck/contracts", label: "Contracts Register", icon: "FileSignature" },
      { href: "/command-deck/material-tracking", label: "Material Tracking", icon: "PackageSearch" },
      { href: "/command-deck/risk-register", label: "Risk Register", icon: "AlertOctagon" },
      { href: "/command-deck/risk", label: "Insurance & COI", icon: "ShieldAlert" },
      { href: "/command-deck/board-packets", label: "Board Packets", icon: "FileText" },
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
