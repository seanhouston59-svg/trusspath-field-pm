import { Link } from "wouter";
import {
  FolderKanban, HelpCircle, ListChecks, CheckSquare, ArrowRight, AlertTriangle, TrendingUp,
  Activity, CircleDot, Clock, Building2, Hammer, FileWarning, GitPullRequestArrow,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostCards } from "@/components/ghost-state";
import { Avatar, ProjectStatusBadge, PriorityBadge, Progress } from "@/components/bits";
import { cn } from "@/lib/utils";
import { useProjects, useTasks, useRfis, useSubmittals, usePunchItems, useTeamMap, useDailyLogs, useChangeOrders } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import { formatCurrency, shortDate, relativeDays, isOverdue } from "@/lib/format";
import { useAccess } from "@/lib/access";
import { NotificationsBox, WeatherBar, StickyNotepadBox } from "@/components/dashboard-widgets";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

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
      <Link href={href} className="relative block overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={testid}>
        {inner}
      </Link>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm" data-testid={testid}>
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

export default function Dashboard() {
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

  type FeedItem = { id: string; kind: "Blocked" | "Overdue RFI" | "Pending CO"; title: string; meta: string; priority?: string; testid: string; href: string };
  const feed: FeedItem[] = [
    ...blockedTasks.map<FeedItem>((t) => ({ id: `task-${t.id}`, kind: "Blocked", title: t.title, meta: `${t.trade} · ${relativeDays(t.dueDate)}`, priority: t.priority, testid: `attention-task-${t.id}`, href: "/tasks" })),
    ...overdueRfis.map<FeedItem>((r) => {
      const proj = projects.find((p) => p.id === r.projectId);
      return { id: `rfi-${r.id}`, kind: "Overdue RFI", title: `${r.number} ${r.subject}`, meta: `${proj?.name.split(" ").slice(0, 2).join(" ") ?? "Project"} · due ${shortDate(r.dueDate)}`, testid: `attention-rfi-${r.id}`, href: "/rfis" };
    }),
    ...pendingCOs.map<FeedItem>((c) => ({ id: `co-${c.id}`, kind: "Pending CO", title: `${c.number} ${c.title}`, meta: `$${c.amount.toLocaleString()} · ${shortDate(c.dateIssued)}`, testid: `attention-co-${c.id}`, href: "/change-orders" })),
  ];

  const chartData = projects.map((p) => ({
    name: p.name.split(" ")[0],
    Budget: Math.round(p.budget / 1_000_000),
    Spent: Math.round(p.spent / 1_000_000),
  }));

  return (
    <Layout title="Dashboard">
      {/* Collapsible weather bar (top) */}
      <WeatherBar logs={dailyLogs} projects={projects} />

      {projects.length === 0 ? (
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

      {/* Branded command hero */}
      <section className="mb-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-testid="dashboard-hero">
        <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="ff-kicker text-primary">{account?.position || "Field Command · Ops Briefing"}</div>
            <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight">
              Good day, {(account?.displayName || "there").split(/\s+/)[0]}.
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              <span className="mx-1.5 text-muted-foreground/50">•</span>
              {activeProjects.length} active projects across the portfolio
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center gap-1">
              <ProgressRing value={portfolioProgress} />
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
                <div className="font-display text-lg font-bold tabular">{showMoney ? formatCurrency(totalSpent, { compact: true }) : "—"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular">{showMoney ? `${spendPct}% of budget` : "restricted"}</div>
              </Link>
              <Link
                href="/rfis"
                data-testid="hero-stat-open-rfis"
                className="group -m-2 block rounded-md p-2 text-right transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="ff-kicker text-muted-foreground group-hover:text-primary">Open RFIs</div>
                <div className="font-display text-lg font-bold tabular">{openRfis.length}</div>
                <div className="mt-0.5 text-xs text-muted-foreground tabular">{overdueRfis.length} overdue</div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={FolderKanban} label="Active Projects" value={String(activeProjects.length)} sub={`${projects.length} total in portfolio`} href="/projects" />
        <Kpi icon={HelpCircle} label="Open RFIs" value={String(openRfis.length)} sub={`${rfis.length} all-time`} href="/rfis" />
        <Kpi icon={ListChecks} label="Due This Week" value={String(dueThisWeek.length)} sub={`${blockedTasks.length} blocked`} tone="warning" href="/tasks" />
        <Kpi icon={CheckSquare} label="Open Punch" value={String(openPunch.length)} sub="items to close out" href="/punch" />
      </div>

      {/* Widget row: notifications + sticky note */}
      <div className="mt-3 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 h-full [&>div]:h-full"><NotificationsBox tasks={tasks} rfis={rfis} changeOrders={changeOrders} projects={projects} /></div>
        <StickyNotepadBox />
      </div>

      {/* Project Command + Ops Feed */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Project command deck */}
        <div className="lg:col-span-2">
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
            {projects.map((p) => {
              const pct = p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0;
              const counts = projectCounts(p.id);
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

        {/* Ops feed */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-amber-500" />
              <h2 className="font-display text-base font-bold">Ops Feed</h2>
            </div>
            <span className="ff-kicker text-muted-foreground">Needs Attention</span>
          </div>
          <div className="mt-3 space-y-2">
            {feed.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CircleDot className="size-6 text-emerald-500" />
                <p className="text-sm text-muted-foreground">Field execution is flowing. Nothing flagged.</p>
              </div>
            )}
            {feed.slice(0, 6).map((f) => {
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
      </div>

      {/* Budget burn + Open RFIs */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Budget chart (restyled) */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-2">
          {showMoney ? (
          <div className="relative flex items-center justify-between">
            <div>
              <div className="ff-kicker text-primary">Financials</div>
              <h2 className="font-display text-base font-bold">Budget vs. Spent</h2>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(totalSpent, { compact: true })} of {formatCurrency(totalBudget, { compact: true })} committed · {spendPct}%
              </p>
            </div>
            <TrendingUp className="size-5 text-muted-foreground" />
          </div>
          ) : (
          <div className="relative flex items-center justify-between">
            <div>
              <div className="ff-kicker text-primary">Financials</div>
              <h2 className="font-display text-base font-bold">Budget vs. Spent</h2>
              <p className="text-xs text-muted-foreground">Financial detail is restricted for your access level.</p>
            </div>
            <TrendingUp className="size-5 text-muted-foreground" />
          </div>
          )}
          {showMoney && (
          <div className="relative mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} unit="M" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Bar dataKey="Budget" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-2))" fillOpacity={0.35} />
                <Bar dataKey="Spent" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-1))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
          {showMoney && (
          <div className="relative mt-3 flex items-center gap-4 border-t border-border pt-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Spent</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-500/40" />Budget</span>
            <span className="ml-auto font-mono text-muted-foreground">{formatCurrency(totalBudget - totalSpent, { compact: true })} remaining</span>
          </div>
          )}
        </div>

        {/* Open RFIs */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
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
            {openRfis.slice(0, 5).map((r) => {
              const proj = projects.find((p) => p.id === r.projectId);
              const assignee = r.assigneeId ? team.get(r.assigneeId) : undefined;
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
            {openRfis.length === 0 && <p className="text-sm text-muted-foreground">No open RFIs.</p>}
          </div>
        </div>
      </div>

      {/* spacer so the floating Jarvis launcher never overlaps content */}
      <div className="h-20" />
      </>
      )}
    </Layout>
  );
}

// Field kit is now surfaced via the wiggling hardhat icon in the topbar
// (see FieldModeToggle in client/src/components/layout.tsx). The dedicated
// dashboard launcher card was removed to reclaim vertical space — the
// icon on every page is a more consistent entry point.

