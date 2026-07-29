import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
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
import { setPendingRedirect } from "@/lib/queryClient";
import type { AccessLevel } from "@shared/access-levels";
import { Layout } from "@/components/layout";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BillingBanner } from "@/components/billing-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { LEAN_MODULES } from "@shared/lean-modules-catalog";

/* ============================== PAGE CHUNKS ==============================
 *
 * Every page is lazy. Statically importing them put all ~62 pages — plus the
 * one-screen-only heavyweights they pull in (xlsx, pdfjs-dist, recharts) — in
 * a single chunk that even anonymous visitors to the marketing page had to
 * download before anything rendered.
 *
 * All of these render inside the one <Suspense> in RootRouter, so a route
 * change shows the shared fallback while its chunk streams in.
 * ---------------------------------------------------------------------- */
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const Login = lazy(() => import("@/pages/login"));
const Signup = lazy(() => import("@/pages/signup"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectDetail = lazy(() => import("@/pages/project-detail"));
const SubUploadsPage = lazy(() => import("@/pages/sub-uploads"));
const Tasks = lazy(() => import("@/pages/tasks"));
const Rfis = lazy(() => import("@/pages/rfis"));
const Submittals = lazy(() => import("@/pages/submittals"));
const ChangeOrders = lazy(() => import("@/pages/change-orders"));
const ActionItems = lazy(() => import("@/pages/action-items"));
const DailyLogs = lazy(() => import("@/pages/daily-logs"));
const Punch = lazy(() => import("@/pages/punch"));
const Team = lazy(() => import("@/pages/team"));
const Contacts = lazy(() => import("@/pages/contacts"));
const Equipment = lazy(() => import("@/pages/equipment"));
const Photos = lazy(() => import("@/pages/photos"));
const Documents = lazy(() => import("@/pages/documents"));
const CompanyDocuments = lazy(() => import("@/pages/company-documents"));
const Schedule = lazy(() => import("@/pages/schedule"));
const Gantt = lazy(() => import("@/pages/gantt"));
const Integrations = lazy(() => import("@/pages/integrations"));
const TeamsPage = lazy(() => import("@/pages/teams"));
const ExcelPage = lazy(() => import("@/pages/excel"));
const Messages = lazy(() => import("@/pages/messages"));
const Notes = lazy(() => import("@/pages/notes"));
const Timesheets = lazy(() => import("@/pages/timesheets"));
const Blueprints = lazy(() => import("@/pages/blueprints"));
const Drone = lazy(() => import("@/pages/drone"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const DeletedItemsPage = lazy(() => import("@/pages/deleted-items"));
const TermsOfService = lazy(() => import("@/pages/legal").then((m) => ({ default: m.TermsOfService })));
const PrivacyPolicy = lazy(() => import("@/pages/legal").then((m) => ({ default: m.PrivacyPolicy })));
const ForgotPassword = lazy(() => import("@/pages/password-reset").then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("@/pages/password-reset").then((m) => ({ default: m.ResetPassword })));
const AdminSignups = lazy(() => import("@/pages/admin-signups"));
const Cpm = lazy(() => import("@/pages/cpm"));
const Paywall = lazy(() => import("@/pages/paywall"));
const TeamSettingsPage = lazy(() => import("@/pages/team-settings"));
const ExecutiveOs = lazy(() => import("@/pages/executive-os"));
const MobilizationPortfolio = lazy(() => import("@/pages/executive-os/mobilization-portfolio"));
const MobilizationDetail = lazy(() => import("@/pages/executive-os/mobilization-detail"));
const ProjectSetupPortfolio = lazy(() => import("@/pages/executive-os/project-setup-portfolio"));
const ProjectSetupDetail = lazy(() => import("@/pages/executive-os/project-setup-detail"));
const PreConstructionPortfolio = lazy(() => import("@/pages/executive-os/pre-construction-portfolio"));
const PreConstructionDetail = lazy(() => import("@/pages/executive-os/pre-construction-detail"));
const FinancialsPortfolio = lazy(() => import("@/pages/executive-os/financials-portfolio"));
const BoardPackets = lazy(() => import("@/pages/executive-os/board-packets"));
const ContractsPortfolio = lazy(() => import("@/pages/executive-os/contracts-portfolio"));
const ContractDetail = lazy(() => import("@/pages/executive-os/contracts-detail"));
const InspectionsPortfolio = lazy(() => import("@/pages/executive-os/inspections-portfolio"));
const InspectionDetail = lazy(() => import("@/pages/executive-os/inspections-detail"));
const LeanModulePortfolioPage = lazy(() => import("@/pages/executive-os/lean-module").then((m) => ({ default: m.LeanModulePortfolioPage })));
const LeanModuleDetailPage = lazy(() => import("@/pages/executive-os/lean-module").then((m) => ({ default: m.LeanModuleDetailPage })));
const InviteAcceptPage = lazy(() => import("@/pages/invite-accept"));
// Subs never touch the rest of the app, and PMs never touch these pages.
const SubDropPage = lazy(() => import("@/pages/drop"));
const SubResetPage = lazy(() => import("@/pages/sub-reset"));
// Standalone marketing page for the subs.trusspath.com host. Lives in its own
// chunk so the main app doesn't pay for its bundle, and vice versa — subs who
// land on this page never load the PM app's JS.
const SubsLandingPage = lazy(() => import("@/pages/subs-landing"));
const FieldHub = lazy(() => import("@/pages/field/hub"));
const FieldDailyLog = lazy(() => import("@/pages/field/daily-log"));
const FieldTimecard = lazy(() => import("@/pages/field/timecard"));
const FieldPhoto = lazy(() => import("@/pages/field/photo"));
const FieldObservation = lazy(() => import("@/pages/field/observation"));
const FieldVoiceNote = lazy(() => import("@/pages/field/voice-note"));
const FieldPunch = lazy(() => import("@/pages/field/punch"));
// Auth-gated and renders null until then, so it never needs to be in the
// first-load chunk.
const JarvisPanel = lazy(() => import("@/components/jarvis-panel").then((m) => ({ default: m.JarvisPanel })));

/** Shared fallback while a route's chunk streams in. */
function RouteFallback() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    </div>
  );
}

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
      <Route path="/admin/signups" component={AdminSignups} />
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

function AccessGate() {
  const [loc] = useLocation();
  const { isAllowed } = useAccess();
  // Play a soft ding whenever a new sticky note or sticker appears on the
  // org's shared corkboard. Mounted here (inside the auth wall) so we don't
  // poll for anonymous users and so the hook has a session identity to skip
  // self-authored notes.
  useStickyDing();
  if (!isAllowed(loc)) return <AccessRestricted />;
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
      {/* Renders nothing while the chunk loads — Jarvis is a floating panel,
          so a spinner here would just be visual noise over the page. */}
      <Suspense fallback={null}>
        <JarvisPanel />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Top-level router: public shell first, protected app second. */
// One Suspense for the whole tree: every page below is a lazy chunk, and
// AppRouter's nested <Switch> resolves under this same fallback.
function RootRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
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
        <Route path="/drop/:token" component={SubDropPage} />
        {/* Sub password reset lives outside the drop-token flow: the reset link
            comes from the sub's inbox, not a QR scan, so we don't need (or
            have) a project context here. Publicly reachable, sets a new
            password, then bounces the sub to /#/subs to sign in fresh. */}
        <Route path="/sub-reset/:token" component={SubResetPage} />
        {/* Subs landing page: marketing / "what is Sub Drop?" for the
            subs.trusspath.com subdomain. Also reachable at /subs on the main
            host so we can preview it. Public, no auth. */}
        <Route path="/subs" component={SubsLandingPage} />
        {/* Everything else is a protected app route. */}
        <Route>
          <RequireAuth>
            <AccessGate />
          </RequireAuth>
        </Route>
      </Switch>
    </Suspense>
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
