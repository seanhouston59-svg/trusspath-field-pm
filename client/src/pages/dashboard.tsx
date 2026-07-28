import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  FolderKanban, HelpCircle, ListChecks, CheckSquare, ArrowRight, AlertTriangle, TrendingUp,
  Activity, CircleDot, Clock, Building2, Hammer, FileWarning, GitPullRequestArrow,
  LayoutGrid, Eye, EyeOff, GripVertical, RotateCcw, Check, Plus, CloudSun, Bell, StickyNote, Wrench,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Layout } from "@/components/layout";
import { GhostState, GhostCards } from "@/components/ghost-state";
import { Avatar, ProjectStatusBadge, PriorityBadge, Progress } from "@/components/bits";
import { cn } from "@/lib/utils";
import { useProjects, useTasks, useRfis, useSubmittals, usePunchItems, useTeamMap, useDailyLogs, useChangeOrders } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import { formatCurrency, shortDate, relativeDays, isOverdue } from "@/lib/format";
import { useAccess } from "@/lib/access";
import { NotificationsBox, WeatherBar, StickyNotepadBox, NoteWallCarouselBox, FleetServiceBox } from "@/components/dashboard-widgets";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

import {
  useDashboardLayout,
  mergeWithCatalog,
  defaultLayoutForRole,
  type WidgetPref,
  type WidgetSize,
} from "@/lib/dashboard-layout";

/* -------------------------- Small primitives -------------------------- */

function Kpi({ icon: Icon, label, value, sub, tone, href }: {
  icon: any; label: string; value: string; sub?: string; tone?: "warning"; href?: string;
}) {
  const rail = tone === "warning" ? "bg-amber-500" : "bg-primary";
  const testid = `kpi-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const inner = (
    <>
      <span className={cn("absolute inset-y-0 left-0 w-1", rail)} aria-hidden="true" />
      <div className="flex items-center justify-between pl-2">
        <span className="ff-kicker text-muted-foreground">{label}</span>
        <span className={`inline-flex size-8 items-center justify-center rounded-md ${tone === "warning" ? "bg-amber-500/12 text-amber-500" : "bg-primary/10 text-primary"}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 pl-2 font-display text-2xl font-bold tabular">{value}</div>
      {sub && <div className="mt-0.5 pl-2 text-xs text-muted-foreground">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="relative block h-full overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={testid}>
        {inner}
      </Link>
    );
  }
  return (
    <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm" data-testid={testid}>
      {inner}
    </div>
  );
}

function ProgressRing({ value, size = 60, stroke = 6, tone = "primary" }: { value: number; size?: number; stroke?: number; tone?: "primary" | "warning" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const color = tone === "warning" ? "hsl(41 86% 52%)" : "hsl(var(--primary))";
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <span className="absolute font-display text-sm font-bold tabular">{value}%</span>
    </div>
  );
}

/* ============================ WIDGET REGISTRY ============================
 *
 * Each widget is defined once here with:
 *   - id: stable string persisted in the user's layout row
 *   - title / icon / description: shown in the Customize panel
 *   - fullBleed: true = widget renders its own outer card and should span
 *     across ALL grid columns (weather, hero). false = flow with the grid.
 *   - render(ctx): actual JSX given a shared context of derived data.
 *   - visible(ctx): optional guard (e.g. financials hidden by role)
 *
 * The dashboard body is just: layout.widgets.map(render).
 * -------------------------------------------------------------------- */

type WidgetCtx = ReturnType<typeof useDashboardCtx>;

// Grouped compute — every widget reads from this so we don't refetch or
// recompute per widget.
function useDashboardCtx() {
  const { can } = useAccess();
  const { account } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: rfis = [] } = useRfis();
  const { data: subs = [] } = useSubmittals();
  const { data: punch = [] } = usePunchItems();
  const { data: dailyLogs = [] } = useDailyLogs();
  const { data: changeOrders = [] } = useChangeOrders();
  const team = useTeamMap();

  const activeProjects = projects.filter((p) => p.status !== "Planning");
  const openRfis = rfis.filter((r) => r.status === "Open");
  const overdueRfis = openRfis.filter((r) => isOverdue(r.dueDate));
  const pendingCOs = changeOrders.filter((c) => c.status === "Pending");
  const dueThisWeek = tasks.filter((t) => {
    if (t.status === "Complete") return false;
    const d = new Date(t.dueDate + "T00:00:00");
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / 86400000;
    return diff <= 7;
  });
  const openPunch = punch.filter((p) => p.status !== "Complete");
  const blockedTasks = tasks.filter((t) => t.status === "Blocked");
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);
  const portfolioProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;
  const spendPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const showMoney = can("canViewFinancials");
  const projectCounts = (id: number) => ({
    rfi: rfis.filter((r) => r.projectId === id && r.status === "Open").length,
    sub: subs.filter((s) => s.projectId === id && s.status !== "Closed").length,
    co: changeOrders.filter((c) => c.projectId === id && c.status === "Pending").length,
  });
  // Chart data — auto-scale the Y-axis unit so a portfolio of $50k projects
  // looks the same as a portfolio of $50M projects. We used to hard-divide by
  // 1_000_000 which floored everything under a million dollars to 0, leaving
  // the chart empty for smaller orgs. Now we pick K / M / "$" based on the
  // biggest raw value across all budgets + spent numbers.
  const rawMax = projects.reduce((m, p) => Math.max(m, p.budget, p.spent), 0);
  const chartUnit: "M" | "K" | "" =
    rawMax >= 1_000_000 ? "M" : rawMax >= 1_000 ? "K" : "";
  const chartDivisor = chartUnit === "M" ? 1_000_000 : chartUnit === "K" ? 1_000 : 1;
  const chartData = projects.map((p) => ({
    name: p.name.split(" ")[0] || p.name,
    // Use one decimal when the divisor could round otherwise-nonzero values to
    // zero (e.g. $200k / 1M = 0.2 — we want the bar to show).
    Budget: Number((p.budget / chartDivisor).toFixed(chartDivisor === 1 ? 0 : 1)),
    Spent: Number((p.spent / chartDivisor).toFixed(chartDivisor === 1 ? 0 : 1)),
  }));
  type FeedItem = { id: string; kind: "Blocked" | "Overdue RFI" | "Pending CO"; title: string; meta: string; priority?: string; testid: string; href: string };
  const feed: FeedItem[] = [
    ...blockedTasks.map<FeedItem>((t) => ({ id: `task-${t.id}`, kind: "Blocked", title: t.title, meta: `${t.trade} · ${relativeDays(t.dueDate)}`, priority: t.priority, testid: `attention-task-${t.id}`, href: "/tasks" })),
    ...overdueRfis.map<FeedItem>((r) => {
      const proj = projects.find((p) => p.id === r.projectId);
      return { id: `rfi-${r.id}`, kind: "Overdue RFI", title: `${r.number} ${r.subject}`, meta: `${proj?.name.split(" ").slice(0, 2).join(" ") ?? "Project"} · due ${shortDate(r.dueDate)}`, testid: `attention-rfi-${r.id}`, href: "/rfis" };
    }),
    ...pendingCOs.map<FeedItem>((c) => ({ id: `co-${c.id}`, kind: "Pending CO", title: `${c.number} ${c.title}`, meta: `$${c.amount.toLocaleString()} · ${shortDate(c.dateIssued)}`, testid: `attention-co-${c.id}`, href: "/change-orders" })),
  ];
  return {
    account, projects, tasks, rfis, subs, punch, dailyLogs, changeOrders, team,
    activeProjects, openRfis, overdueRfis, pendingCOs, dueThisWeek, openPunch,
    blockedTasks, totalBudget, totalSpent, portfolioProgress, spendPct, showMoney,
    projectCounts, chartData, chartUnit, feed,
  };
}

type WidgetDef = {
  id: string;
  title: string;
  description: string;
  icon: any;
  fullBleed?: boolean;
  visible?: (ctx: WidgetCtx) => boolean;
  render: (ctx: WidgetCtx) => JSX.Element;
};

const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "weather",
    title: "Site weather",
    description: "7-day forecast for the active site.",
    icon: CloudSun,
    fullBleed: true,
    render: (c) => <WeatherBar logs={c.dailyLogs} projects={c.projects} />,
  },
  {
    id: "hero",
    title: "Command hero",
    description: "Greeting, portfolio ring, and top stats.",
    icon: LayoutGrid,
    fullBleed: true,
    render: (c) => (
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-testid="dashboard-hero">
        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="ff-kicker text-primary">{c.account?.position || "Field Command · Ops Briefing"}</div>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">
              Good day, {(c.account?.displayName || "there").split(/\s+/)[0]}.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              <span className="mx-1.5 text-muted-foreground/50">•</span>
              {c.activeProjects.length} active projects across the portfolio
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={c.portfolioProgress} />
              <span className="ff-kicker text-muted-foreground">Portfolio</span>
            </div>
            <span className="hidden h-12 w-px bg-border sm:block" />
            <div className="flex gap-3">
              <Link
                href="/projects"
                data-testid="hero-stat-committed"
                className="group -m-2 block rounded-md p-2 text-right transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="ff-kicker text-muted-foreground group-hover:text-primary">Committed</div>
                <div className="font-display text-lg font-bold tabular">{c.showMoney ? formatCurrency(c.totalSpent, { compact: true }) : "—"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular">{c.showMoney ? `${c.spendPct}% of budget` : "restricted"}</div>
              </Link>
              <Link
                href="/rfis"
                data-testid="hero-stat-open-rfis"
                className="group -m-2 block rounded-md p-2 text-right transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="ff-kicker text-muted-foreground group-hover:text-primary">Open RFIs</div>
                <div className="font-display text-lg font-bold tabular">{c.openRfis.length}</div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular">{c.overdueRfis.length} overdue</div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    ),
  },
  {
    id: "kpi-projects",
    title: "KPI · Active projects",
    description: "Count of non-planning projects.",
    icon: FolderKanban,
    render: (c) => <Kpi icon={FolderKanban} label="Active Projects" value={String(c.activeProjects.length)} sub={`${c.projects.length} total in portfolio`} href="/projects" />,
  },
  {
    id: "kpi-rfis",
    title: "KPI · Open RFIs",
    description: "Open RFI count with all-time total.",
    icon: HelpCircle,
    render: (c) => <Kpi icon={HelpCircle} label="Open RFIs" value={String(c.openRfis.length)} sub={`${c.rfis.length} all-time`} href="/rfis" />,
  },
  {
    id: "kpi-due",
    title: "KPI · Due this week",
    description: "Tasks due in the next 7 days.",
    icon: ListChecks,
    render: (c) => <Kpi icon={ListChecks} label="Due This Week" value={String(c.dueThisWeek.length)} sub={`${c.blockedTasks.length} blocked`} tone="warning" href="/tasks" />,
  },
  {
    id: "kpi-punch",
    title: "KPI · Open punch",
    description: "Open punch-list items across projects.",
    icon: CheckSquare,
    render: (c) => <Kpi icon={CheckSquare} label="Open Punch" value={String(c.openPunch.length)} sub="items to close out" href="/punch" />,
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Overdue tasks, RFIs, and pending change orders.",
    icon: Bell,
    render: (c) => (
      <div className="h-full [&>div]:h-full">
        <NotificationsBox tasks={c.tasks} rfis={c.rfis} changeOrders={c.changeOrders} projects={c.projects} />
      </div>
    ),
  },
  {
    id: "notepad",
    title: "Sticky notepad",
    description: "Quick note pinned to your first active project.",
    icon: StickyNote,
    render: () => <StickyNotepadBox />,
  },
  {
    id: "note-wall",
    title: "Note Wall",
    description: "Slide through sticky notes from the board and reply inline.",
    icon: StickyNote,
    render: () => <NoteWallCarouselBox />,
  },
  {
    id: "fleet-service",
    title: "Service reminders",
    description: "Vehicles and equipment overdue or due within 14 days.",
    icon: Wrench,
    render: () => (
      <div className="h-full [&>div]:h-full">
        <FleetServiceBox />
      </div>
    ),
  },
  {
    id: "projects",
    title: "Project Command",
    description: "Card grid of all projects with progress + counts.",
    icon: Building2,
    render: (c) => (
      <div className="h-full">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h2 className="font-display text-base font-bold">Project Command</h2>
          </div>
          <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {c.projects.map((p) => {
            const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
            const counts = c.projectCounts(p.id);
            const tone = pct > 90 || p.status === "At Risk" ? "warning" : "primary";
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="group block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50" data-testid={`dash-project-${p.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-bold">{p.name}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.number} · {p.client}</div>
                  </div>
                  <ProgressRing value={p.progress} size={48} stroke={5} tone={tone} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <ProjectStatusBadge status={p.status} />
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular">{formatCurrency(p.spent, { compact: true })}</div>
                    <div className="text-[11px] text-muted-foreground tabular">of {formatCurrency(p.budget, { compact: true })}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-[11px] font-medium">
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-600 dark:text-amber-400"><FileWarning className="size-3" />{counts.rfi} RFI</span>
                  <span className="inline-flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-600 dark:text-violet-400"><FileWarning className="size-3" />{counts.sub} SUB</span>
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-600 dark:text-sky-400"><GitPullRequestArrow className="size-3" />{counts.co} CO</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    id: "ops-feed",
    title: "Ops feed",
    description: "Blocked tasks, overdue RFIs, and pending COs.",
    icon: Activity,
    render: (c) => (
      <div className="h-full rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-amber-500" />
            <h2 className="font-display text-base font-bold">Ops Feed</h2>
          </div>
          <span className="ff-kicker text-muted-foreground">Needs Attention</span>
        </div>
        <div className="mt-3 space-y-2">
          {c.feed.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CircleDot className="size-6 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Field execution is flowing. Nothing flagged.</p>
            </div>
          )}
          {c.feed.slice(0, 6).map((f) => {
            const rail = f.kind === "Blocked" ? "bg-red-500" : f.kind === "Overdue RFI" ? "bg-amber-500" : "bg-sky-500";
            return (
              <Link key={f.id} href={f.href} className="flex items-center gap-3 rounded-md border border-border p-2.5 hover-elevate" data-testid={f.testid}>
                <span className={cn("h-full min-h-[28px] w-1 shrink-0 rounded-full", rail)} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="ff-kicker shrink-0 text-muted-foreground">{f.kind}</span>
                    {f.priority && <PriorityBadge priority={f.priority} />}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm font-medium">{f.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{f.meta}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    ),
  },
  {
    id: "financials",
    title: "Financials · Budget vs Spent",
    description: "Portfolio budget-burn chart. Hidden by role.",
    icon: TrendingUp,
    visible: (c) => c.showMoney,
    render: (c) => (
      <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="relative flex items-center justify-between">
          <div>
            <div className="ff-kicker text-primary">Financials</div>
            <h2 className="font-display text-base font-bold">Budget vs. Spent</h2>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(c.totalSpent, { compact: true })} of {formatCurrency(c.totalBudget, { compact: true })} committed · {c.spendPct}%
            </p>
          </div>
          <TrendingUp className="size-5 text-muted-foreground" />
        </div>
        <div className="relative mt-4 h-64 w-full">
          {c.chartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center">
              <TrendingUp className="size-5 text-muted-foreground" />
              <div className="text-sm font-medium">No projects yet</div>
              <div className="text-xs text-muted-foreground">Create a project with a budget to see budget-vs-spent bars here.</div>
            </div>
          ) : c.totalBudget === 0 && c.totalSpent === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center">
              <TrendingUp className="size-5 text-muted-foreground" />
              <div className="text-sm font-medium">No budget data</div>
              <div className="text-xs text-muted-foreground">Set a budget on your projects to populate this chart. Edit a project → Budget field.</div>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={c.chartData} barGap={4} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} unit={c.chartUnit} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "hsl(var(--muted))" }}
              />
              <Bar dataKey="Budget" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-2))" fillOpacity={0.35} />
              <Bar dataKey="Spent" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="relative mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Spent</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-500/40" />Budget</span>
          <span className="ml-auto font-mono text-muted-foreground">{formatCurrency(c.totalBudget - c.totalSpent, { compact: true })} remaining</span>
        </div>
      </div>
    ),
  },
  {
    id: "rfis-list",
    title: "Open RFIs list",
    description: "Latest open RFIs with due date + assignee.",
    icon: HelpCircle,
    render: (c) => (
      <div className="h-full rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-primary" />
            <h2 className="font-display text-base font-bold">Open RFIs</h2>
          </div>
          <Link href="/rfis" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            All <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {c.openRfis.slice(0, 5).map((r) => {
            const proj = c.projects.find((p) => p.id === r.projectId);
            const assignee = r.assigneeId ? c.team.get(r.assigneeId) : undefined;
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-md border border-border p-3" data-testid={`dash-rfi-${r.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{r.number}</span>
                    <span className="line-clamp-2 text-sm font-medium">{r.subject}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span className={cn(isOverdue(r.dueDate) && "text-red-500")}>{proj?.name.split(" ").slice(0, 3).join(" ")} · due {shortDate(r.dueDate)}</span>
                  </div>
                </div>
                {assignee && <Avatar initials={assignee.initials} color={assignee.color} size={28} />}
              </div>
            );
          })}
          {c.openRfis.length === 0 && <p className="text-sm text-muted-foreground">No open RFIs.</p>}
        </div>
      </div>
    ),
  },
];

const WIDGET_INDEX = new Map(WIDGET_REGISTRY.map((w) => [w.id, w] as const));
const WIDGET_IDS = WIDGET_REGISTRY.map((w) => w.id);

// Map a widget size to a column span. Grid is 4 cols on lg+, 2 cols on
// sm/md. Widgets under sm are one cell, xl is full-width.
function sizeToSpan(size: WidgetSize): string {
  switch (size) {
    case "sm": return "col-span-2 sm:col-span-1 lg:col-span-1"; // 1/4
    case "md": return "col-span-2 sm:col-span-1 lg:col-span-2"; // 2/4
    case "lg": return "col-span-2 sm:col-span-2 lg:col-span-2"; // 2/4
    case "xl": return "col-span-2 sm:col-span-2 lg:col-span-4"; // full row
  }
}

/* ============================== Edit mode ============================== */

function SortableTile({
  pref, def, editMode, ctx, onToggleHidden, onCycleSize, onRemove,
}: {
  pref: WidgetPref;
  def: WidgetDef;
  editMode: boolean;
  ctx: WidgetCtx;
  onToggleHidden: () => void;
  onCycleSize: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pref.id, disabled: !editMode });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const span = sizeToSpan(pref.size);
  const bodyHidden = editMode && pref.hidden;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        span,
        editMode ? "relative" : "",
        // In edit mode always show a thin outline so tiles are visible even
        // when the widget itself has no background (KPI cards etc).
        editMode && "rounded-lg outline outline-2 outline-dashed outline-primary/30",
      )}
      data-widget-id={pref.id}
      data-testid={`widget-${pref.id}`}
    >
      {editMode && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-1 rounded-t-lg border-b border-primary/20 bg-background/90 px-2 py-1 backdrop-blur">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="inline-flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
            data-testid={`widget-drag-${pref.id}`}
          >
            <GripVertical className="size-3.5" />
          </button>
          <span className="truncate text-[11px] font-semibold text-muted-foreground">{def.title}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={onCycleSize}
              className="inline-flex h-6 items-center rounded border border-border px-1.5 text-[10px] font-semibold uppercase text-muted-foreground hover:bg-muted"
              title="Change size"
              data-testid={`widget-size-${pref.id}`}
            >
              {pref.size}
            </button>
            <button
              type="button"
              onClick={onToggleHidden}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
              title={pref.hidden ? "Show" : "Hide"}
              data-testid={`widget-toggle-${pref.id}`}
            >
              {pref.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-red-500"
              title="Remove"
              data-testid={`widget-remove-${pref.id}`}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className={cn(editMode && "pt-8", bodyHidden && "opacity-40 pointer-events-none", "h-full")}>
        {bodyHidden ? (
          <div className="grid h-24 place-items-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground">
            Hidden — toggle to show
          </div>
        ) : (
          def.render(ctx)
        )}
      </div>
    </div>
  );
}

/* ========================== Customize sheet =========================== */

function CustomizePanel({
  open, onClose, layout, setLayout, onReset,
}: {
  open: boolean;
  onClose: () => void;
  layout: WidgetPref[];
  setLayout: (next: WidgetPref[]) => void;
  onReset: () => void;
}) {
  if (!open) return null;
  const shownIds = new Set(layout.map((w) => w.id));
  const missing = WIDGET_REGISTRY.filter((d) => !shownIds.has(d.id));
  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-background shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border p-4">
          <LayoutGrid className="size-4 text-primary" />
          <h2 className="font-display text-base font-bold">Customize dashboard</h2>
          <button onClick={onClose} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">×</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-xs text-muted-foreground">
            Drag tiles on the dashboard to reorder. Use the controls per tile to change size, hide, or remove.
          </p>
          {missing.length > 0 && (
            <div className="mt-5">
              <div className="ff-kicker text-muted-foreground">Add widgets</div>
              <div className="mt-2 space-y-2">
                {missing.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setLayout([...layout, { id: d.id, size: "md", hidden: false }])}
                    className="flex w-full items-center gap-3 rounded-md border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
                    data-testid={`add-widget-${d.id}`}
                  >
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <d.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{d.description}</div>
                    </div>
                    <Plus className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              data-testid="button-reset-layout"
            >
              <RotateCcw className="size-3.5" /> Reset to defaults
            </button>
          </div>
        </div>
        <footer className="border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            data-testid="button-done-customize"
          >
            <Check className="size-4" /> Done
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ============================== Dashboard ============================== */

export default function Dashboard() {
  const ctx = useDashboardCtx();
  const { account } = ctx;
  const { layout: serverLayout, save, reset } = useDashboardLayout();

  // The layout the user is EDITING. In view mode we render straight from
  // the server value; in edit mode we buffer changes locally so drag/drop
  // and size cycles feel instant, then save on drop / control change.
  const roleDefault = defaultLayoutForRole((account as any)?.role);
  const effective = useMemo(
    () => mergeWithCatalog(serverLayout, WIDGET_IDS, roleDefault),
    [serverLayout, roleDefault],
  );
  const widgets = effective.widgets;

  const [editMode, setEditMode] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setLayout = (next: WidgetPref[]) => {
    save({ widgets: next });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = widgets.findIndex((w) => w.id === active.id);
    const to = widgets.findIndex((w) => w.id === over.id);
    if (from < 0 || to < 0) return;
    setLayout(arrayMove(widgets, from, to));
  };

  const cycleSize = (id: string) => {
    const order: WidgetSize[] = ["sm", "md", "lg", "xl"];
    setLayout(
      widgets.map((w) => (w.id === id ? { ...w, size: order[(order.indexOf(w.size) + 1) % order.length] } : w)),
    );
  };
  const toggleHidden = (id: string) => setLayout(widgets.map((w) => (w.id === id ? { ...w, hidden: !w.hidden } : w)));
  const removeWidget = (id: string) => setLayout(widgets.filter((w) => w.id !== id));

  const renderable = widgets.filter((w) => {
    const def = WIDGET_INDEX.get(w.id);
    if (!def) return false;
    if (!editMode && w.hidden) return false;
    if (def.visible && !def.visible(ctx)) return false;
    return true;
  });

  return (
    <Layout
      title="Dashboard"
      actions={
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                type="button"
                onClick={() => setCustomizeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
                data-testid="button-customize-open"
              >
                <Plus className="size-3.5" /> Add
              </button>
              <button
                type="button"
                onClick={() => { setEditMode(false); setCustomizeOpen(false); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                data-testid="button-edit-done"
              >
                <Check className="size-3.5" /> Done
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              data-testid="button-edit-dashboard"
            >
              <LayoutGrid className="size-3.5" /> Customize
            </button>
          )}
        </div>
      }
    >
      {ctx.projects.length === 0 ? (
        <div className="space-y-4">
          <section className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="p-6">
              <div className="ff-kicker text-primary">Welcome to TrussPath</div>
              <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">
                Good day, {(account?.displayName || "there").split(/\s+/)[0]}.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your workspace is ready. Create your first project to start tracking tasks, RFIs, daily logs, and more.
              </p>
            </div>
          </section>
          <GhostCards count={4} />
          <GhostState
            title="No projects yet"
            description="Create your first project to populate the dashboard with real-time stats, tasks, and field updates."
            icon={FolderKanban}
            ctaLabel="Create your first project"
            ctaHref="/projects?new=1"
          />
        </div>
      ) : (
        <>
          {editMode && (
            <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
              You're in customize mode — drag tiles to reorder, click a size chip to cycle sm → md → lg → xl, use the eye to hide, or × to remove. Press Done when you're happy.
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={renderable.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid auto-rows-min grid-cols-2 gap-3 lg:grid-cols-4">
                {renderable.map((w) => {
                  const def = WIDGET_INDEX.get(w.id)!;
                  return (
                    <SortableTile
                      key={w.id}
                      pref={w}
                      def={def}
                      editMode={editMode}
                      ctx={ctx}
                      onToggleHidden={() => toggleHidden(w.id)}
                      onCycleSize={() => cycleSize(w.id)}
                      onRemove={() => removeWidget(w.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <CustomizePanel
            open={customizeOpen}
            onClose={() => setCustomizeOpen(false)}
            layout={widgets}
            setLayout={setLayout}
            onReset={() => { reset(); setCustomizeOpen(false); }}
          />

          {/* spacer so the floating Jarvis launcher never overlaps content */}
          <div className="h-20" />
        </>
      )}
    </Layout>
  );
}
