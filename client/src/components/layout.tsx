import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FolderKanban, ListChecks, HelpCircle, ClipboardList,
  CheckSquare, Users, Sun, Moon, Search, Menu, X, HardHat, CalendarRange,
  FileStack, GitPullRequestArrow, StickyNote, Wrench, Image, FileText,
  Contact as ContactIcon, MessageSquare,
  GanttChartSquare, Plug, PencilRuler, Plane, Settings as SettingsIcon, ShieldCheck,
  LogOut, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { Logo, Avatar } from "@/components/bits";
import { APP_NAV } from "@shared/app-manifest";
import { useSettings } from "@/hooks/use-data";
import { useAccess, ACCESS_LEVELS } from "@/lib/access";
import { useAuth } from "@/lib/auth";
import type { AccessLevel } from "@shared/access-levels";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommandPalette } from "@/components/command-palette";

const ICONS: Record<string, any> = {
  LayoutDashboard, FolderKanban, ListChecks, HelpCircle, ClipboardList,
  CheckSquare, Users, CalendarRange, FileStack, GitPullRequestArrow,
  StickyNote, Wrench, Image, FileText, Contact: ContactIcon, MessageSquare,
  GanttChartSquare, Plug, PencilRuler, Plane, Settings: SettingsIcon,
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { isAllowed } = useAccess();
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1" aria-label="Primary">
      {APP_NAV.map((group) => {
        const items = group.items.filter(({ href }) => isAllowed(href));
        if (items.length === 0) return null;
        return (
        <div key={group.title}>
          <div className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{group.title}</div>
          <div className="flex flex-col gap-0">
            {items.map(({ href, label, icon }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              const Icon = ICONS[icon] ?? LayoutDashboard;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-primary")} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  const { data: settings } = useSettings();
  const company = settings?.companyName?.trim() || "TrussPath";
  return (
    <Link href="/app" className="group flex flex-col gap-2 px-1" data-testid="nav-brand">
      <div className="flex items-center gap-2.5">
        <Logo className="size-8 text-primary transition-transform group-hover:-rotate-3" />
        <div className="leading-tight">
          <div className="font-display text-base font-extrabold tracking-tight text-sidebar-accent-foreground">{company}</div>
          <div className="text-[11px] text-sidebar-foreground/50">Field Project Management</div>
        </div>
      </div>
      <div className="ff-section-rule" />
    </Link>
  );
}

function SidebarFooter() {
  const { def } = useAccess();
  const { account, logout } = useAuth();
  const displayName = account?.displayName || "Marcus Reyes";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "MR";
  const doLogout = async () => {
    await logout();
    window.location.hash = "/login";
  };
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-3 rounded-md bg-sidebar-accent/50 p-3">
        <Avatar initials={initials} color="amber" size={36} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-sm font-medium text-sidebar-accent-foreground" data-testid="text-user-name">{displayName}</div>
          <div className="ff-kicker truncate text-sidebar-foreground/50" style={{ fontSize: "0.6rem" }}>{def.label}</div>
        </div>
        <HardHat className="ml-auto size-4 text-sidebar-foreground/40" />
      </div>
      <button
        onClick={doLogout}
        data-testid="button-logout"
        className="flex w-full items-center gap-2 rounded-md border border-sidebar-border/60 bg-transparent px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover-elevate"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </div>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <SidebarBrand />
      <NavList onNavigate={onNavigate} />
      <SidebarFooter />
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      data-testid="button-theme"
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function RoleSwitcher() {
  const { level, setLevel } = useAccess();
  return (
    <Select value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
      <SelectTrigger className="h-9 w-[178px] gap-2" data-testid="role-switcher" aria-label="Switch access level">
        <ShieldCheck className="size-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCESS_LEVELS.map((l) => (
          <SelectItem key={l.slug} value={l.slug}>{l.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TopbarUser() {
  const { account, logout } = useAuth();
  const displayName = account?.displayName || "Marcus Reyes";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "MR";
  const doLogout = async () => {
    await logout();
    window.location.hash = "/login";
  };
  return (
    <div className="flex items-center gap-2">
      <Avatar initials={initials} color="amber" size={36} />
      <button
        onClick={doLogout}
        aria-label="Sign out"
        title="Sign out"
        data-testid="button-logout-topbar"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function BackButton() {
  const [location] = useLocation();
  // Don't show on the dashboard itself
  if (location === "/app" || location === "/" || location === "") return null;
  const goBack = () => {
    if (typeof window === "undefined") return;
    // If there's an in-app history entry, go back; otherwise fall back to /app.
    // window.history.length > 1 alone isn't enough — after auth redirects that entry may be the login page,
    // so we also require the previous URL to be same-origin via referrer (best-effort).
    const canGoBack = window.history.length > 1;
    if (canGoBack) {
      window.history.back();
      // Safety net: if for some reason back() lands us outside the app hash routes, bounce to /app.
      window.setTimeout(() => {
        const h = window.location.hash;
        if (!h || h === "#" || h === "#/" || h.startsWith("#/login") || h.startsWith("#/signup")) {
          window.location.hash = "/app";
        }
      }, 120);
    } else {
      window.location.hash = "/app";
    }
  };
  return (
    <button
      onClick={goBack}
      aria-label="Go back"
      title="Back"
      data-testid="button-back"
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate hover:text-foreground"
    >
      <ChevronLeft className="size-5" />
    </button>
  );
}

export function Layout({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // ⌘K / Ctrl+K opens the command palette anywhere in the app.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 bg-sidebar md:block">
        <SidebarInner />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-sidebar shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <X className="size-5" />
            </button>
            <div className="pt-4">
              <SidebarInner onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <BackButton />
          <div className="flex items-center gap-2.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
            <h1 className="font-display text-lg font-bold tracking-tight">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              onKeyDown={(e) => { if (e.key === "/") { e.preventDefault(); setCmdOpen(true); } }}
              data-testid="button-search"
              className="relative hidden sm:flex h-9 w-56 items-center rounded-md border border-border bg-muted/40 pl-9 pr-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open search"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="ml-2 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            {actions}
            <RoleSwitcher />
            <ThemeToggle />
            <TopbarUser />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 md:p-6">{children}</div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
