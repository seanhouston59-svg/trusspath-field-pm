import { storage } from "./storage";
import { APP_LINKS, APP_ROUTES, isKnownRoute } from "@shared/app-manifest";

export type HealthCheck = { name: string; status: "ok" | "fail"; detail: string };
export type BrokenLink = { href: string; label: string; source: "nav" | "landing" };
export type HealthReport = {
  scannedAt: string;
  ok: boolean;
  brokenLinks: BrokenLink[];
  moduleChecks: HealthCheck[];
  routeCount: number;
  linkCount: number;
  summary: string;
};

/**
 * Deterministic app health scan — no AI required.
 *
 * What it can reliably verify (server-side):
 *  - Every in-app link href (sidebar + landing feature cards) resolves to a
 *    registered route pattern. Unresolved = "broken link".
 *  - Every core data module's storage read succeeds without throwing and
 *    reports a record count (read from the active project).
 *
 * What it CANNOT verify: that every button/dialog renders correctly in the
 * browser. For full UI QA, run a Playwright pass. This scan is a fast,
 * honest link + module integrity check.
 */
export function runHealthScan(): HealthReport {
  const brokenLinks: BrokenLink[] = APP_LINKS.filter((l) => !isKnownRoute(l.href))
    .map((l) => ({ href: l.href, label: l.label, source: l.source }));

  const pid = storage.getProjects()[0]?.id;

  const mods: [string, () => any[]][] = [
    ["Projects", () => storage.getProjects()],
    ["Tasks", () => storage.getTasks(pid)],
    ["RFIs", () => storage.getRfis(pid)],
    ["Submittals", () => storage.getSubmittals(pid)],
    ["Change Orders", () => storage.getChangeOrders(pid)],
    ["Action Items", () => storage.getActionItems(pid)],
    ["Daily Logs", () => storage.getDailyLogs(pid)],
    ["Punch Items", () => storage.getPunchItems(pid)],
    ["Team", () => storage.getTeam()],
    ["Contacts", () => storage.getContacts()],
    ["Equipment", () => storage.getEquipment(pid)],
    ["Photos", () => storage.getPhotos(pid)],
    ["Documents", () => storage.getDocuments(pid)],
    ["Blueprints", () => storage.getBlueprints(pid)],
    ["Drone Captures", () => storage.getDroneCaptures(pid)],
    ["Messages", () => (pid ? storage.getMessages(pid) : [])],
    ["Notes", () => storage.getNotes(pid)],
    ["Integrations", () => storage.getIntegrations()],
  ];

  const moduleChecks: HealthCheck[] = mods.map(([name, fn]) => {
    try {
      const rows = fn();
      return { name, status: "ok" as const, detail: `${rows.length} records` };
    } catch (e: any) {
      return { name, status: "fail" as const, detail: e?.message ?? "error reading module" };
    }
  });

  const failedModules = moduleChecks.filter((c) => c.status === "fail");
  const ok = brokenLinks.length === 0 && failedModules.length === 0;

  const summary = ok
    ? `All clear, sir. ${moduleChecks.length} modules healthy, ${APP_LINKS.length} links resolve to ${APP_ROUTES.length} registered routes — no broken items detected.`
    : `Found ${brokenLinks.length} broken link(s) and ${failedModules.length} failing module(s). Details below.`;

  return {
    scannedAt: new Date().toISOString(),
    ok,
    brokenLinks,
    moduleChecks,
    routeCount: APP_ROUTES.length,
    linkCount: APP_LINKS.length,
    summary,
  };
}
