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
  "/field", "/field/daily-log", "/field/timecard", "/field/photo", "/field/observation", "/field/punch",
];

export type NavLink = { href: string; label: string; icon: string };
export type NavGroup = { title: string; items: NavLink[] };

/** Sidebar navigation groups (mirrors client/src/components/layout.tsx). */
export const APP_NAV: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/app", label: "Dashboard", icon: "LayoutDashboard" },
      { href: "/notes", label: "Sticky Board", icon: "StickyNote" },
      { href: "/timesheets", label: "Time Tracking", icon: "Clock" },
    ],
  },
  {
    title: "Planning",
    items: [
      { href: "/projects", label: "Projects", icon: "FolderKanban" },
      { href: "/schedule", label: "Schedule", icon: "CalendarRange" },
      { href: "/gantt", label: "Gantt", icon: "GanttChartSquare" },
      { href: "/cpm", label: "CPM Diagram", icon: "Network" },
    ],
  },
  {
    title: "Workflows",
    items: [
      { href: "/tasks", label: "Tasks", icon: "ListChecks" },
      { href: "/action-items", label: "Action Items", icon: "CheckSquare" },
      { href: "/rfis", label: "RFIs", icon: "HelpCircle" },
      { href: "/submittals", label: "Submittals", icon: "FileStack" },
      { href: "/change-orders", label: "Change Orders", icon: "GitPullRequestArrow" },
      { href: "/punch", label: "Punch List", icon: "CheckSquare" },
    ],
  },
  // Field kit routes intentionally omitted from the sidebar — they're reached
  // via the dedicated Field mode (topbar hard-hat toggle, dashboard launcher
  // card, or the PWA homescreen shortcuts). Keeping them out of the sidebar
  // avoids duplicating the same nav in two places and keeps the office view
  // focused on office-side workflows. The /field routes still exist and are
  // still whitelisted in shared/access-levels.ts.
  {
    title: "Field records",
    items: [
      { href: "/daily-logs", label: "Daily Logs", icon: "ClipboardList" },
      { href: "/photos", label: "Photo Log", icon: "Image" },
      { href: "/documents", label: "Documents", icon: "FileText" },
      { href: "/company-documents", label: "Company Documents", icon: "Building2" },
      { href: "/blueprints", label: "Blueprints", icon: "PencilRuler" },
      { href: "/equipment", label: "Fleet & Equipment", icon: "Wrench" },
    ],
  },
  {
    title: "Add-ons",
    items: [
      { href: "/drone", label: "Drone Captures", icon: "Plane" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/team", label: "Project Team", icon: "Users" },
      { href: "/contacts", label: "Contacts", icon: "Contact" },
      { href: "/messages", label: "Messages", icon: "MessageSquare" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/integrations", label: "Integrations", icon: "Plug" },
      { href: "/deleted-items", label: "Deleted Items", icon: "Trash2" },
      { href: "/settings", label: "Settings", icon: "Settings" },
      { href: "/settings/team", label: "Team & Access", icon: "ShieldCheck" },
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
