import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, FolderKanban, ListChecks, HelpCircle, ClipboardList,
  CheckSquare, Users, Sun, Moon, Search, Menu, X, CalendarRange,
  FileStack, GitPullRequestArrow, StickyNote, Wrench, Image, FileText,
  Contact as ContactIcon, MessageSquare, Building2, Clock,
  GanttChartSquare, Plug, PencilRuler, Plane, Settings as SettingsIcon, ShieldCheck,
  LogOut, ChevronLeft, Network, MoreVertical, Pencil, Trash2, Smartphone,
  ClipboardEdit, Timer, Camera, AlertTriangle, CheckCircle2, ChevronRight,
  Video, FileSpreadsheet,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/command-palette";
import { ClockStatusLight } from "@/components/clock-status-light";
import { useToast } from "@/hooks/use-toast";
import { useFieldMode } from "@/hooks/use-field-mode";
import { HardHat, WifiOff } from "lucide-react";

const ICONS: Record<string, any> = {
  LayoutDashboard, FolderKanban, ListChecks, HelpCircle, ClipboardList,
  CheckSquare, Users, CalendarRange, FileStack, GitPullRequestArrow,
  StickyNote, Wrench, Image, FileText, Contact: ContactIcon, MessageSquare, Building2, Clock,
  GanttChartSquare, Plug, PencilRuler, Plane, Settings: SettingsIcon, Trash2, Network,
  ShieldCheck, Smartphone,
  ClipboardEdit, Timer, Camera, AlertTriangle, CheckCircle2,
  Video, FileSpreadsheet,
};

// Collapse state is persisted per-group in localStorage. Missing entries
// default to "expanded" so the sidebar isn't a wall of collapsed headers
// the first time you load. The group containing the active route is force-
// expanded regardless of persisted state.
const NAV_COLLAPSE_STORAGE_KEY = "trusspath:nav:collapsed";

function readCollapsedGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCollapsedGroups(state: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage might be blocked (private mode etc) — collapse just won't persist */
  }
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { isAllowed } = useAccess();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readCollapsedGroups());

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      writeCollapsedGroups(next);
      return next;
    });
  };

  // Precompute active-href logic once per render.
  const allHrefs = APP_NAV.flatMap((g) => g.items.map((i) => i.href));
  const isActiveHref = (href: string) => {
    if (href === "/") return location === "/";
    if (!location.startsWith(href)) return false;
    return !allHrefs.some((h) => h !== href && h.startsWith(href) && location.startsWith(h));
  };

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: "touch" }} aria-label="Primary">
      {APP_NAV.map((group) => {
        const items = group.items.filter(({ href }) => isAllowed(href));
        if (items.length === 0) return null;
        const groupHasActive = items.some((it) => isActiveHref(it.href));
        // Force expand if this group contains the active route — you should
        // always see where you are.
        const isCollapsed = collapsed[group.title] && !groupHasActive;
        return (
          <div key={group.title}>
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={!isCollapsed}
              aria-controls={`nav-group-${group.title.replace(/\s+/g, "-")}`}
              data-testid={`nav-group-toggle-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
              className="group flex w-full items-center gap-1 rounded-md px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/80"
            >
              <ChevronRight
                className={cn(
                  "size-3 shrink-0 transition-transform text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70",
                  !isCollapsed && "rotate-90",
                )}
              />
              <span className="flex-1">{group.title}</span>
              {isCollapsed && (
                <span className="rounded-full bg-sidebar-accent/50 px-1.5 py-0.5 text-[9px] font-bold text-sidebar-foreground/60">
                  {items.length}
                </span>
              )}
            </button>
            {!isCollapsed && (
              <div id={`nav-group-${group.title.replace(/\s+/g, "-")}`} className="mt-0.5 flex flex-col gap-0">
                {items.map(({ href, label, icon }) => {
                  const active = isActiveHref(href);
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
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-primary")} />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
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
        <Logo className="size-9 transition-transform group-hover:-rotate-3" />
        <div className="leading-tight">
          <div className="font-display text-base font-extrabold tracking-tight text-sidebar-accent-foreground">{company}</div>
          <div className="text-[11px] text-sidebar-foreground/50">Field Project Management</div>
        </div>
      </div>
      <div className="ff-section-rule" />
    </Link>
  );
}

/* ---- Edit Profile dialog (shared) ---- */
function EditProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { account, updateProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync form when dialog opens
  useEffect(() => {
    if (open && account) {
      setName(account.displayName || "");
      setPosition(account.position || "");
    }
  }, [open, account]);

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: "Name cannot be empty", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await updateProfile({ displayName: name.trim(), position: position.trim() || undefined });
      toast({ title: "Profile updated" });
      onOpenChange(false);
    } catch {
      toast({ title: "Failed to update profile", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="mt-1.5"
              data-testid="input-profile-name"
            />
          </div>
          <div>
            <Label>Position / Title</Label>
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Project Executive, Site Superintendent"
              className="mt-1.5"
              data-testid="input-profile-position"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-profile-save">
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidebarFooter() {
  const { def } = useAccess();
  const { account, logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const displayName = account?.displayName || "User";
  const position = account?.position || def.label;
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const doLogout = async () => {
    await logout();
    window.location.hash = "/login";
  };
  return (
    <div className="mt-2 space-y-2">
      <button
        onClick={() => setEditOpen(true)}
        data-testid="button-edit-profile"
        className="flex w-full items-center gap-3 rounded-md bg-sidebar-accent/50 p-3 text-left transition hover:bg-sidebar-accent"
      >
        <Avatar initials={initials} color="amber" size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-sidebar-accent-foreground" data-testid="text-user-name">{displayName}</div>
          <div className="ff-kicker truncate text-sidebar-foreground/50" style={{ fontSize: "0.6rem" }} data-testid="text-user-position">{position}</div>
        </div>
        <Pencil className="size-3.5 text-sidebar-foreground/40" />
      </button>
      <button
        onClick={doLogout}
        data-testid="button-logout"
        className="flex w-full items-center gap-2 rounded-md border border-sidebar-border/60 bg-transparent px-3 py-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover-elevate"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
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
  const [editOpen, setEditOpen] = useState(false);
  const displayName = account?.displayName || "User";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
  const doLogout = async () => {
    await logout();
    window.location.hash = "/login";
  };
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditOpen(true)}
        aria-label="Edit profile"
        title="Edit profile"
        data-testid="button-edit-profile-topbar"
        className="inline-flex items-center justify-center rounded-full transition hover:ring-2 hover:ring-primary/30"
      >
        <Avatar initials={initials} color="amber" size={36} />
      </button>
      <button
        onClick={doLogout}
        aria-label="Sign out"
        title="Sign out"
        data-testid="button-logout-topbar"
        className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function MobileOverflowMenu() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { level, setLevel } = useAccess();
  const { account, logout } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const field = useFieldMode();
  const displayName = account?.displayName || "User";
  const position = account?.position || "";
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const doLogout = async () => {
    setOpen(false);
    await logout();
    window.location.hash = "/login";
  };

  return (
    <div className="relative md:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="More"
        aria-expanded={open}
        data-testid="button-overflow-menu"
        className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate"
      >
        <MoreVertical className="size-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
            data-testid="overflow-menu"
          >
            <div className="flex items-center gap-3 border-b border-border px-3 py-3">
              <Avatar initials={initials} color="amber" size={36} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium">{displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{position || (account?.email ?? "")}</div>
              </div>
              <button onClick={() => { setOpen(false); setEditOpen(true); }} className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" data-testid="button-edit-profile-mobile">
                <Pencil className="size-3.5" />
              </button>
            </div>
            <div className="px-3 pt-3 pb-2">
              <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Access level</div>
              <Select value={level} onValueChange={(v) => setLevel(v as AccessLevel)}>
                <SelectTrigger className="h-10 w-full gap-2" data-testid="role-switcher-mobile">
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
            <button
              onClick={() => {
                setOpen(false);
                field.enter();
                // Take the user to the field hub — the whole point of the mobile
                // shortcut. If they're already on a /field route it's a no-op.
                if (!window.location.hash.startsWith("#/field")) {
                  window.location.hash = "/field";
                }
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
              data-testid="button-field-mode-mobile"
            >
              <HardHat className="size-4 text-amber-600 dark:text-amber-400" />
              Enter Field mode
            </button>
            <button
              onClick={() => { toggle(); }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
              data-testid="button-theme-mobile"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <div className="border-t border-border">
              <button
                onClick={doLogout}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-foreground hover:bg-muted"
                data-testid="button-logout-mobile"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
      <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

/**
 * Topbar toggle for entering field mode from anywhere in the app.
 * When already in field mode the FieldModeLayout renders instead of the
 * normal Layout, so this button is only ever shown in the full-chrome view
 * and always enters (never exits) — the FieldModeLayout has its own Exit.
 */
function FieldModeToggle() {
  const field = useFieldMode();
  const [, navigate] = useLocation();
  // The hardhat is the primary discovery point for Field mode. Clicking
  // it should take the user to the Field Kit *hub* (the on-site launcher
  // grid: Clock, Punches, Daily log, Photos, Observations) — not just
  // flip the current page into chromeless mode. Otherwise, from the
  // dashboard, the hardhat looks like it "does nothing" (the same
  // dashboard just loses its chrome).
  return (
    <button
      type="button"
      onClick={() => {
        field.enter();
        navigate("/field");
      }}
      aria-label="Open Field Kit"
      title="Open Field Kit — on-site launcher"
      data-testid="button-field-mode-toggle"
      className="group inline-flex size-9 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-600 hover-elevate hover:border-amber-500/70 hover:bg-amber-500/10 dark:text-amber-400"
    >
      <HardHat className="size-4 origin-bottom animate-hardhat-wiggle group-hover:[animation-play-state:paused] motion-reduce:animate-none" />
    </button>
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
  // Nav drawer state — lives on every viewport now (the permanent
  // desktop rail was removed). The variable name is kept as `mobileOpen`
  // to minimize churn but semantically it is just "nav drawer open".
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [loc] = useLocation();

  // Close the drawer on route change so nav feels instant.
  useEffect(() => {
    setMobileOpen(false);
  }, [loc]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);
  const field = useFieldMode();
  const { toast } = useToast();

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

  // Surface global mutation errors (dispatched from queryClient) as a toast so
  // silent 4xx/5xx write failures are visible even if the origin dialog closed.
  useEffect(() => {
    const onMutErr = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      const msg = detail?.message || "Something went wrong saving your changes.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    };
    window.addEventListener("trusspath:mutation-error", onMutErr);
    return () => window.removeEventListener("trusspath:mutation-error", onMutErr);
  }, [toast]);

  // Field mode: chromeless layout for on-site use. No sidebar, no top nav
  // clutter, no command palette — just the page, a slim header with the
  // field-kit brand + online indicator + exit, and the content.
  if (field.enabled) {
    // Exiting field mode drops the user back to the office-view dashboard —
    // otherwise they'd be left staring at the field page they were on but
    // rendered in full chrome, which is almost never what they want.
    //
    // Special case: if we were opened as a popup window (desktop 'Open Field
    // kit' from the dashboard), close the popup instead of navigating — the
    // parent tab still has the office view.
    const exitToDashboard = () => {
      field.exit();
      const isPopup = typeof window !== "undefined" && !!window.opener && window.opener !== window;
      if (isPopup) {
        try { window.close(); return; } catch { /* fall through to hash nav */ }
      }
      window.location.hash = "/app";
    };
    return <FieldModeLayout title={title} actions={actions} onExit={exitToDashboard}>{children}</FieldModeLayout>;
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Sidebar — always collapsed to an off-canvas drawer on every
          viewport. Opened by the hamburger button in the topbar. The
          previous 256px permanent rail was hidden per user request to
          reclaim horizontal space; keep navigation reachable via a
          single, consistent gesture on desktop and mobile. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-sidebar shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            >
              <X className="size-5" />
            </button>
            <div className="min-h-0 flex-1 overflow-hidden pt-4">
              <SidebarInner onNavigate={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 md:h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-3 md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            data-testid="button-menu"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate"
          >
            <Menu className="size-5" />
          </button>
          <BackButton />
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden sm:block size-2.5 rounded-sm bg-primary shrink-0" aria-hidden="true" />
            <h1 className="truncate font-display text-base md:text-lg font-bold tracking-tight">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              onKeyDown={(e) => { if (e.key === "/") { e.preventDefault(); setCmdOpen(true); } }}
              data-testid="button-search"
              className="relative hidden lg:flex h-9 w-56 items-center rounded-md border border-border bg-muted/40 pl-9 pr-2 text-sm text-muted-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open search"
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="ml-2 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            {/* Mobile: search as icon only */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              data-testid="button-search-mobile"
              aria-label="Search"
              className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate lg:hidden"
            >
              <Search className="size-4" />
            </button>
            {actions && <div className="flex items-center gap-2 [&_button]:h-10 md:[&_button]:h-9">{actions}</div>}
            {/* Clock status indicator — visible on both mobile and desktop so
                users always know their punch state at a glance. */}
            <ClockStatusLight />
            {/* Field mode hardhat — shown on every viewport now that the
                large dashboard launcher card is gone. Its wiggle keeps it
                discoverable. */}
            <FieldModeToggle />
            {/* Desktop: show remaining controls inline */}
            <div className="hidden md:flex items-center gap-2">
              <RoleSwitcher />
              <ThemeToggle />
              <TopbarUser />
            </div>
            {/* Mobile: collapse into overflow menu */}
            <MobileOverflowMenu />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}

// FieldModeLayout — chromeless, task-focused shell for the field kit. Used
// whenever ?field=1 is present in the URL, sessionStorage has the sticky
// flag, or an installed PWA launches into a /field route. See
// hooks/use-field-mode.ts for the trigger logic.
function FieldModeLayout({
  children,
  title,
  actions,
  onExit,
}: {
  children: ReactNode;
  title: string;
  actions?: ReactNode;
  onExit: () => void;
}) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const [, navigate] = useLocation();
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Slim field header — brand chip, page title, online pill, exit */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
        <button
          onClick={() => navigate("/field")}
          className="inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-left hover-elevate"
          data-testid="field-mode-brand"
          aria-label="Field kit home"
        >
          <span className="grid size-8 place-items-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <HardHat className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Field kit</span>
            <span className="truncate font-display text-sm font-bold">{title}</span>
          </span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {!online && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
              data-testid="field-mode-offline"
            >
              <WifiOff className="size-3.5" /> Offline
            </span>
          )}
          {actions && <div className="flex items-center gap-2 [&_button]:h-9">{actions}</div>}
          <ClockStatusLight />
          <Button size="sm" variant="ghost" onClick={onExit} data-testid="field-mode-exit">
            Exit
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-3 sm:p-4">{children}</div>
      </main>
    </div>
  );
}
