import type { ComponentType } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { APP_ROUTES } from "@shared/app-manifest";
import { AccessProvider, useAccess, ACCESS_LEVELS } from "@/lib/access";
import { AuthProvider, useAuth } from "@/lib/auth";
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
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
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
import Schedule from "@/pages/schedule";
import Gantt from "@/pages/gantt";
import Integrations from "@/pages/integrations";
import { JarvisPanel } from "@/components/jarvis-panel";
import Messages from "@/pages/messages";
import Notes from "@/pages/notes";
import Blueprints from "@/pages/blueprints";
import Drone from "@/pages/drone";
import SettingsPage from "@/pages/settings";

// Single source of truth for routes lives in shared/app-manifest.ts (APP_ROUTES).
// Map each manifest route pattern to its page component here.
const ROUTE_COMPONENTS: Record<string, ComponentType> = {
  "/": Landing,
  "/app": Dashboard,
  "/projects": Projects,
  "/projects/:id": ProjectDetail,
  "/schedule": Schedule,
  "/gantt": Gantt,
  "/integrations": Integrations,
  "/tasks": Tasks,
  "/action-items": ActionItems,
  "/rfis": Rfis,
  "/submittals": Submittals,
  "/change-orders": ChangeOrders,
  "/punch": Punch,
  "/daily-logs": DailyLogs,
  "/photos": Photos,
  "/documents": Documents,
  "/equipment": Equipment,
  "/blueprints": Blueprints,
  "/drone": Drone,
  "/team": Team,
  "/contacts": Contacts,
  "/messages": Messages,
  "/notes": Notes,
  "/settings": SettingsPage,
};

function AppRouter() {
  return (
    <Switch>
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
  if (!isAllowed(loc)) return <AccessRestricted />;
  return <AppRouter />;
}

/** Renders children only if the user is authenticated. While the auth check is
 *  in flight, shows a splash. If unauthenticated, redirects to /login and shows
 *  a splash until the redirect takes effect. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [loc] = useLocation();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setPendingRedirect(loc || "/app");
      window.location.hash = `/login`;
    }
  }, [isLoading, isAuthenticated, loc]);
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
  return <>{children}</>;
}

function AppChrome() {
  const [loc] = useLocation();
  const { isAuthenticated } = useAuth();
  // Jarvis is only useful once you’re inside the app.
  if (!isAuthenticated) return null;
  if (loc === "/" || loc === "/login" || loc.startsWith("/login") || loc === "/signup") return null;
  return <JarvisPanel />;
}

/** Top-level router: public shell first, protected app second. */
function RootRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
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
              <Router hook={useHashLocation}>
                <RootRouter />
                <AppChrome />
              </Router>
            </TooltipProvider>
          </AccessProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
