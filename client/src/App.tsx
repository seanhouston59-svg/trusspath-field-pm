import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

/**
 * Wouter's built-in useHashLocation returns the pathname WITH the query
 * string still appended (e.g. "/field?field=1"). wouter uses `regexparam`
 * to match Route paths, and its parser produces a regex like ^/field/?$
 * which does NOT match a location containing a "?". Result: every route
 * fails on the very first load if the URL includes any query flag, and
 * we fall through to the <Route component={NotFound}> catch-all.
 *
 * We wrap useHashLocation to strip the query (and any accidental hash
 * fragment) before it reaches the matcher. Field-mode still reads the
 * ?field=1 flag directly from window.location, so nothing else breaks.
 */
function useHashLocationNoQuery(): [string, (to: string, opts?: unknown) => void] {
  const [loc] = useHashLocation();
  const clean = loc.split("?")[0].split("#")[0] || "/";
  return [clean, hashNavigate];
}

/**
 * wouter's hash navigate() peels the query off the target and assigns it to
 * `url.search`, so navigating to "/rfis?project=3" lands on "/?project=3#/rfis"
 * and the stale param survives the next navigation. Keep the whole target
 * inside the hash instead.
 */
function hashNavigate(to: string, rawOpts?: unknown) {
  const opts = (rawOpts ?? undefined) as { replace?: boolean; state?: unknown } | undefined;
  const oldURL = window.location.href;
  const path = to.replace(/^#/, "");
  const url = new URL(window.location.href);
  url.hash = path.startsWith("/") ? path : `/${path}`;
  const newURL = url.href;
  if (newURL === oldURL) return;
  if (opts?.replace) window.history.replaceState(opts?.state ?? null, "", newURL);
  else window.history.pushState(opts?.state ?? null, "", newURL);
  window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL }));
}

// wouter reads `hook.hrefs` to turn a Link's `href` into a real anchor href.
// The wrapper above hides useHashLocation.hrefs, so re-declare it or every
// <Link href="/x"> renders a non-hash anchor that reloads the app.
useHashLocationNoQuery.hrefs = (href: string) => `#${href}`;
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { APP_ROUTES } from "@shared/app-manifest";
import { AccessProvider, useAccess, ACCESS_LEVELS } from "@/lib/access";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useStickyDing } from "@/hooks/use-sticky-ding";
import { useBillingStatus } from "@/hooks/use-data";
import { useExecutiveOsEntitlement } from "@/hooks/use-entitlements";
import { setPendingRedirect } from "@/lib/queryClient";
import type { AccessLevel } from "@shared/access-levels";
import { Layout } from "@/components/layout";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import NotificationsPage from "@/pages/notifications";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import SubUploadsPage from "@/pages/sub-uploads";
import Tasks from "@/pages/tasks";
import Rfis from "@/pages/rfis";
import Submittals from "@/pages/submittals";
import ChangeOrders from "@/pages/change-orders";
import ActionItems from "@/pages/action-items";
import DailyLogs from "@/pages/daily-logs";
import Punch from "@/pages/punch";
import Team from "@/pages/team";
import Contacts from "@/pages/contacts";
import Equipment from "@/pages/equipment";
import Photos from "@/pages/photos";
import Documents from "@/pages/documents";
import CompanyDocuments from "@/pages/company-documents";
import Schedule from "@/pages/schedule";
import Gantt from "@/pages/gantt";
import Integrations from "@/pages/integrations";
import TeamsPage from "@/pages/teams";
import ExcelPage from "@/pages/excel";
import { JarvisPanel } from "@/components/jarvis-panel";
import { BillingBanner } from "@/components/billing-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import Messages from "@/pages/messages";
import Notes from "@/pages/notes";
import Timesheets from "@/pages/timesheets";
import Blueprints from "@/pages/blueprints";
import Drone from "@/pages/drone";
import SettingsPage from "@/pages/settings";
import DeletedItemsPage from "@/pages/deleted-items";
import { TermsOfService, PrivacyPolicy } from "@/pages/legal";
import { ForgotPassword, ResetPassword } from "@/pages/password-reset";
import AdminSignups from "@/pages/admin-signups";
import AdminIndex from "@/pages/admin-index";
import AdminAccounts from "@/pages/admin-accounts";
import AdminDemoAccounts from "@/pages/admin-demo-accounts";
import Cpm from "@/pages/cpm";
import Paywall from "@/pages/paywall";
import TeamSettingsPage from "@/pages/team-settings";
import ExecutiveOs from "@/pages/executive-os";
import ExecutiveOsUpsell from "@/pages/executive-os-upsell";
import MobilizationPortfolio from "@/pages/executive-os/mobilization-portfolio";
import MobilizationDetail from "@/pages/executive-os/mobilization-detail";
import ProjectSetupPortfolio from "@/pages/executive-os/project-setup-portfolio";
import ProjectSetupDetail from "@/pages/executive-os/project-setup-detail";
import PreConstructionPortfolio from "@/pages/executive-os/pre-construction-portfolio";
import PreConstructionDetail from "@/pages/executive-os/pre-construction-detail";
import FinancialsPortfolio from "@/pages/executive-os/financials-portfolio";
import BoardPackets from "@/pages/executive-os/board-packets";
import ContractsPortfolio from "@/pages/executive-os/contracts-portfolio";
import ContractDetail from "@/pages/executive-os/contracts-detail";
import InspectionsPortfolio from "@/pages/executive-os/inspections-portfolio";
import InspectionDetail from "@/pages/executive-os/inspections-detail";
import { LEAN_MODULES } from "@shared/lean-modules-catalog";
import { LeanModuleDetailPage, LeanModulePortfolioPage } from "@/pages/executive-os/lean-module";
import InviteAcceptPage from "@/pages/invite-accept";
// Lazy: subs never touch the rest of the app, and PMs never touch this page.
// Keeping it out of the main chunk trims the initial bundle for both.
const SubDropPage = lazy(() => import("@/pages/drop"));
const SubResetPage = lazy(() => import("@/pages/sub-reset"));
// Standalone marketing page for the subs.trusspath.com host. Lives in its own
// chunk so the main app doesn't pay for its bundle, and vice versa — subs who
// land on this page never load the PM app's JS.
const SubsLandingPage = lazy(() => import("@/pages/subs-landing"));
import FieldHub from "@/pages/field/hub";
import FieldDailyLog from "@/pages/field/daily-log";
import FieldTimecard from "@/pages/field/timecard";
import FieldPhoto from "@/pages/field/photo";
import FieldObservation from "@/pages/field/observation";
import FieldVoiceNote from "@/pages/field/voice-note";
import FieldPunch from "@/pages/field/punch";

// Single source of truth for routes lives in shared/app-manifest.ts (APP_ROUTES).
// Map each manifest route pattern to its page component here.
const ROUTE_COMPONENTS: Record<string, ComponentType> = {
  "/": Landing,
  "/app": Dashboard,
  "/notifications": NotificationsPage,
  "/projects": Projects,
  "/projects/:id": ProjectDetail,
  "/projects/:id/sub-uploads": SubUploadsPage,
  "/schedule": Schedule,
  "/gantt": Gantt,
  "/cpm": Cpm,
  "/integrations": Integrations,
  "/teams": TeamsPage,
  "/excel": ExcelPage,
  "/tasks": Tasks,
  "/action-items": ActionItems,
  "/rfis": Rfis,
  "/submittals": Submittals,
  "/change-orders": ChangeOrders,
  "/punch": Punch,
  "/daily-logs": DailyLogs,
  "/photos": Photos,
  "/documents": Documents,
  "/company-documents": CompanyDocuments,
  "/equipment": Equipment,
  "/blueprints": Blueprints,
  "/drone": Drone,
  "/team": Team,
  "/contacts": Contacts,
  "/messages": Messages,
  "/notes": Notes,
  "/timesheets": Timesheets,
  "/deleted-items": DeletedItemsPage,
  "/settings": SettingsPage,
  "/settings/team": TeamSettingsPage,
  "/executive-os": ExecutiveOs,
  "/executive-os/upsell": ExecutiveOsUpsell,
  "/executive-os/project-setup": ProjectSetupPortfolio,
  "/executive-os/project-setup/:id": ProjectSetupDetail,
  "/executive-os/pre-construction": PreConstructionPortfolio,
  "/executive-os/pre-construction/:id": PreConstructionDetail,
  "/executive-os/mobilization": MobilizationPortfolio,
  "/executive-os/mobilization/:id": MobilizationDetail,
  // Financials + Board Packets: explicit mappings live in ROUTE_OVERRIDES below
  // so they win over the LEAN_MODULES generic fallback. See the note there.
  // Modules 4-22 all render the shared lean module page (portfolio + detail).
  // The moduleId is bound per slug so each URL renders the correct catalog
  // entry (title, blurb, categories). When a module graduates to a purpose-
  // built schema (like Pre-Con did) it swaps out of this block and into an
  // explicit route mapping above.
  ...Object.fromEntries(
    LEAN_MODULES.flatMap((m) => {
      const Portfolio = () => <LeanModulePortfolioPage moduleId={m.slug} />;
      const Detail = () => <LeanModuleDetailPage moduleId={m.slug} />;
      return [
        [`/executive-os/${m.slug}`, Portfolio],
        [`/executive-os/${m.slug}/:id`, Detail],
      ];
    }),
  ),
  // Explicit overrides for graduated exec-os modules. These MUST come after
  // the LEAN_MODULES.flatMap spread above so they win the key collision on
  // /executive-os/financials. Board packets is a fresh route with no lean-
  // module analog, but lives here to keep the graduated modules together.
  "/executive-os/financials": FinancialsPortfolio,
  // Per-project financials still delegate to the lean-module detail page
  // (change orders + budget lines already live there). Wrap with a local
  // component so we don't have to duplicate the moduleId binding.
  "/executive-os/financials/:id": () => <LeanModuleDetailPage moduleId="financials" />,
  "/executive-os/board-packets": BoardPackets,
  "/executive-os/contracts": ContractsPortfolio,
  "/executive-os/contracts/:id": ContractDetail,
  "/executive-os/inspections": InspectionsPortfolio,
  "/executive-os/inspections/:id": InspectionDetail,
  "/field": FieldHub,
  "/field/daily-log": FieldDailyLog,
  "/field/timecard": FieldTimecard,
  "/field/photo": FieldPhoto,
  "/field/observation": FieldObservation,
  "/field/voice-note": FieldVoiceNote,
  "/field/punch": FieldPunch,
};

function AppRouter() {
  return (
    <Switch>
      <Route path="/admin" component={AdminIndex} />
      <Route path="/admin/signups" component={AdminSignups} />
      <Route path="/admin/accounts" component={AdminAccounts} />
      <Route path="/admin/demo-accounts" component={AdminDemoAccounts} />
      {APP_ROUTES.filter((p) => ROUTE_COMPONENTS[p]).map((p) => (
        <Route key={p} path={p} component={ROUTE_COMPONENTS[p]} />
      ))}
      <Route component={NotFound} />
    </Switch>
  );
}

function AccessRestricted() {
  const { level, setLevel, def } = useAccess();
  return (
    <Layout title="Access restricted">
      <div className="grid place-items-center py-20">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-amber-500/10 text-amber-500">
            <ShieldAlert className="size-7" />
          </div>
          <h2 className="font-display text-lg font-bold">This view isn’t available for {def.label}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your current access level doesn’t include this page. Switch levels to preview what each role sees — this is an access preview, not production security.
          </p>
          <div className="mt-5 flex justify-center">
            <Select value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
              <SelectTrigger className="h-9 w-[200px] gap-2" data-testid="role-switcher-restricted">
                <ShieldCheck className="size-4 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_LEVELS.map((l) => (
                  <SelectItem key={l.slug} value={l.slug}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </Layout>
  );
}

const EXEC_OS_UPSELL_PATH = "/executive-os/upsell";

function AccessGate() {
  const [loc] = useLocation();
  const { isAllowed } = useAccess();
  // Executive OS is a paid per-seat add-on. Gating here rather than at each of
  // the ~60 exec-OS route patterns covers the generated lean-module routes too.
  // This is a UX redirect only — the API is enforced by requireExecutiveOs.
  const execOs = useExecutiveOsEntitlement();
  // Play a soft ding whenever a new sticky note or sticker appears on the
  // org's shared corkboard. Mounted here (inside the auth wall) so we don't
  // poll for anonymous users and so the hook has a session identity to skip
  // self-authored notes.
  useStickyDing();
  if (!isAllowed(loc)) return <AccessRestricted />;
  // RequireAuth already blocks paint until billing status resolves, so there is
  // no upsell flash here; the isLoading check is belt-and-braces.
  if (
    loc.startsWith("/executive-os") &&
    loc !== EXEC_OS_UPSELL_PATH &&
    !execOs.isLoading &&
    !execOs.hasAccess
  ) {
    return <Redirect to={EXEC_OS_UPSELL_PATH} />;
  }
  return <AppRouter />;
}

/** Renders children only if the user is authenticated AND their org is in good
 *  standing. Multi-tenant model: billing lives on the org, not the account.
 *  Legacy platform-owners (account.role='owner') bypass the paywall entirely.
 *  While the check is in flight, shows a splash.
 *  If unauthenticated, redirects to /login; if their org isn't in good standing,
 *  redirects to /paywall. */
function isOrgInGoodStanding(billing: { status: string | null } | null | undefined): boolean {
  if (!billing) return false;
  return billing.status === "active" || billing.status === "trialing";
}
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, account } = useAuth();
  const billing = useBillingStatus();
  const [loc] = useLocation();

  // Platform-owners bypass the billing check.
  const isPlatformOwner = account?.role === "owner";
  const orgOk = isPlatformOwner || isOrgInGoodStanding(billing.data);
  const billingLoading = !!isAuthenticated && !isPlatformOwner && billing.isLoading;

  useEffect(() => {
    if (isLoading || billingLoading) return;
    if (!isAuthenticated) {
      setPendingRedirect(loc || "/app");
      window.location.hash = `/login`;
      return;
    }
    if (!orgOk) {
      window.location.hash = `/paywall`;
    }
  }, [isLoading, billingLoading, isAuthenticated, orgOk, loc]);

  if (isLoading || billingLoading || !isAuthenticated || !orgOk) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }
  return (
    <>
      {/* Platform-owners bypass billing entirely, so skip the banner for them. */}
      {!isPlatformOwner && <BillingBanner />}
      {children}
    </>
  );
}

/** Wrapper for /paywall: only reachable when authenticated. */
function PaywallGate() {
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.hash = `/login`;
    }
  }, [isLoading, isAuthenticated]);
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }
  return <Paywall />;
}

function AppChrome() {
  const [loc] = useLocation();
  const { isAuthenticated } = useAuth();
  // Jarvis is only useful once you’re inside the app.
  if (!isAuthenticated) return null;
  if (loc === "/" || loc === "/login" || loc.startsWith("/login") || loc === "/signup" || loc.startsWith("/signup") || loc === "/paywall" || loc.startsWith("/invite/") || loc.startsWith("/drop/") || loc.startsWith("/sub-reset/")) return null;
  // Jarvis lives in a boundary because it drives async voice/speech APIs that
  // can throw in ways we don't want to blank out the whole app.
  return (
    <ErrorBoundary label="Jarvis" silent>
      <JarvisPanel />
    </ErrorBoundary>
  );
}

/** Top-level router: public shell first, protected app second. */
function RootRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      {/* Aliases redirect rather than mounting Login twice, so /login stays the
          one canonical location the loc checks below have to know about. */}
      <Route path="/sign-in"><Redirect to="/login" /></Route>
      <Route path="/signin"><Redirect to="/login" /></Route>
      <Route path="/signup" component={Signup} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      {/* Paywall lives outside RequireAuth so pending/unpaid users can reach it. */}
      <Route path="/paywall" component={PaywallGate} />
      {/* Invite acceptance is public: unauthenticated users can view the invite and sign up. */}
      <Route path="/invite/:token" component={InviteAcceptPage} />
      {/* Sub Drop Portal is public: subs scan a QR, register, and drop files. */}
      <Route path="/drop/:token">
        {(params) => (
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>}>
            <SubDropPage />
          </Suspense>
        )}
      </Route>
      {/* Sub password reset lives outside the drop-token flow: the reset link
          comes from the sub's inbox, not a QR scan, so we don't need (or
          have) a project context here. Publicly reachable, sets a new
          password, then bounces the sub to /#/subs to sign in fresh. */}
      <Route path="/sub-reset/:token">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>}>
          <SubResetPage />
        </Suspense>
      </Route>
      {/* Subs landing page: marketing / "what is Sub Drop?" for the
          subs.trusspath.com subdomain. Also reachable at /subs on the main
          host so we can preview it. Public, no auth, lazy-loaded. */}
      <Route path="/subs">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>}>
          <SubsLandingPage />
        </Suspense>
      </Route>
      {/* Everything else is a protected app route. */}
      <Route>
        <RequireAuth>
          <AccessGate />
        </RequireAuth>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AccessProvider>
            <TooltipProvider>
              <Toaster />
              <ErrorBoundary label="App">
                <Router hook={useHashLocationNoQuery}>
                  <RootRouter />
                  <AppChrome />
                </Router>
              </ErrorBoundary>
            </TooltipProvider>
          </AccessProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
