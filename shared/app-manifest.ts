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
  "/", "/app", "/projects", "/projects/:id", "/schedule", "/gantt", "/cpm", "/integrations",
  "/tasks", "/action-items", "/rfis", "/submittals", "/change-orders", "/punch",
  "/daily-logs", "/photos", "/documents", "/company-documents", "/blueprints", "/equipment", "/drone",
  "/team", "/contacts", "/messages", "/notes", "/timesheets", "/deleted-items", "/settings", "/settings/team",
  "/teams", "/excel",
  "/executive-os",
  "/field", "/field/daily-log", "/field/timecard", "/field/photo", "/field/observation", "/field/punch",
];

export type NavLink = { href: string; label: string; icon: string };
export type NavGroup = { title: string; items: NavLink[] };

/**
 * Sidebar navigation groups (mirrors client/src/components/layout.tsx).
 *
 * Grouping principle: each section answers a single question a construction
 * PM or owner asks themselves during the day — "where do things stand?",
 * "what's on the schedule?", "what's happening in the field?", etc. Sections
 * default to collapsed (see NavList in layout.tsx) so the sidebar is a short
 * clean list of intents, not a wall of links. The group holding the active
 * route auto-expands so you always see where you are.
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
    ],
  },
  {
    title: "Field Ops",
    items: [
      { href: "/daily-logs", label: "Daily Logs", icon: "ClipboardList" },
      { href: "/photos", label: "Photo Log", icon: "Image" },
      { href: "/punch", label: "Punch List", icon: "CheckSquare" },
      { href: "/blueprints", label: "Blueprints", icon: "PencilRuler" },
      { href: "/drone", label: "Drone Captures", icon: "Plane" },
      { href: "/equipment", label: "Fleet & Equipment", icon: "Wrench" },
      // Requests & Tasks — collapsed into Field Ops so PMs/supers see the
      // paperwork they own next to the daily-log tools they use every morning.
      { href: "/rfis", label: "RFIs", icon: "HelpCircle" },
      { href: "/submittals", label: "Submittals", icon: "FileStack" },
      { href: "/change-orders", label: "Change Orders", icon: "GitPullRequestArrow" },
      { href: "/tasks", label: "Tasks", icon: "ListChecks" },
      { href: "/action-items", label: "Action Items", icon: "CheckSquare" },
    ],
  },
  {
    title: "Documents",
    items: [
      { href: "/documents", label: "Project Documents", icon: "FileText" },
      { href: "/company-documents", label: "Company Documents", icon: "Building2" },
    ],
  },
  {
    title: "People & Time",
    items: [
      { href: "/team", label: "Project Team", icon: "Users" },
      { href: "/contacts", label: "Contacts", icon: "Contact" },
      { href: "/messages", label: "Messages", icon: "MessageSquare" },
      { href: "/timesheets", label: "Time Tracking", icon: "Clock" },
    ],
  },
  {
    title: "Apps & Admin",
    items: [
      { href: "/teams", label: "Microsoft Teams", icon: "Video" },
      { href: "/excel", label: "Microsoft Excel", icon: "FileSpreadsheet" },
      { href: "/integrations", label: "Integrations", icon: "Plug" },
      { href: "/settings", label: "Settings", icon: "Settings" },
      { href: "/settings/team", label: "Team & Access", icon: "ShieldCheck" },
      { href: "/deleted-items", label: "Deleted Items", icon: "Trash2" },
    ],
  },
  {
    // Executive OS — exec-only surface. Contents grow over time; for now a
    // single Overview link points at a “coming soon” placeholder.
    title: "Executive OS",
    items: [
      { href: "/executive-os", label: "Overview", icon: "Sparkles" },
    ],
  },
];

/** Landing-page feature cards (mirrors client/src/pages/landing.tsx). */
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
  ...APP_NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, source: "nav" as const }))),
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
