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
export async function runHealthScan(): Promise<HealthReport> {
  const brokenLinks: BrokenLink[] = APP_LINKS.filter((l) => !isKnownRoute(l.href))
    .map((l) => ({ href: l.href, label: l.label, source: l.source }));

  // UNSCOPED: deliberately deployment-wide. This is an integrity probe — it
  // asserts each storage read does not throw and reports only `rows.length`,
  // never row content. Scoping it per-org would make the probe pass for an
  // empty org while a broken table went unnoticed. The counts it returns are
  // aggregate, so no tenant records cross an org boundary.
  const projects = await storage.getProjects();
  const pid = projects[0]?.id;

  const mods: [string, () => Promise<any[]>][] = [
    ["Projects", async () => storage.getProjects()], // UNSCOPED: counts only, per the note above
    ["Tasks", async () => storage.getTasks(pid)],
    ["RFIs", async () => storage.getRfis(pid)],
    ["Submittals", async () => storage.getSubmittals(pid)],
    ["Change Orders", async () => storage.getChangeOrders(pid)],
    ["Action Items", async () => storage.getActionItems(pid)],
    ["Daily Logs", async () => storage.getDailyLogs(pid)],
    ["Punch Items", async () => storage.getPunchItems(pid)],
    ["Team", async () => storage.getTeam()], // UNSCOPED: counts only, per the note above
    ["Contacts", async () => storage.getContacts()], // UNSCOPED: counts only, per the note above
    ["Equipment", async () => storage.getEquipment(pid)],
    ["Photos", async () => storage.getPhotos(pid)],
    ["Documents", async () => storage.getDocuments(pid)],
    ["Blueprints", async () => storage.getBlueprints(pid)],
    ["Drone Captures", async () => storage.getDroneCaptures(pid)],
    ["Messages", async () => (pid ? storage.getMessages(pid) : [])],
    ["Notes", async () => storage.getNotes(pid)],
    ["Integrations", async () => storage.getIntegrations()], // UNSCOPED: counts only, per the note above
  ];

  const moduleChecks: HealthCheck[] = [];
  for (const [name, fn] of mods) {
    try {
      const rows = await fn();
      moduleChecks.push({ name, status: "ok" as const, detail: `${rows.length} records` });
    } catch (e: any) {
      moduleChecks.push({ name, status: "fail" as const, detail: e?.message ?? "error reading module" });
    }
  }

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
