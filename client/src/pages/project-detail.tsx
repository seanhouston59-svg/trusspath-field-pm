import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft, MapPin, Calendar, Building2, DollarSign, ListChecks, HelpCircle, ClipboardList, CheckSquare,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ProjectStatusBadge, Progress } from "@/components/bits";
import { TaskTable, RfiTable, DailyLogList, PunchList } from "@/components/tables";
import {
  useProject, useTasks, useRfis, useDailyLogs, usePunchItems, useTeamMap,
} from "@/hooks/use-data";
import { formatCurrency, shortDate, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "overview", label: "Overview", icon: DollarSign },
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "rfis", label: "RFIs", icon: HelpCircle },
  { key: "logs", label: "Daily Logs", icon: ClipboardList },
  { key: "punch", label: "Punch List", icon: CheckSquare },
] as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id!, 10);
  const { data: project, isLoading } = useProject(projectId);
  const team = useTeamMap();
  const { data: tasks = [] } = useTasks(projectId);
  const { data: rfis = [] } = useRfis(projectId);
  const { data: logs = [] } = useDailyLogs(projectId);
  const { data: punch = [] } = usePunchItems(projectId);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");

  if (isLoading || !project) {
    return (
      <Layout title="Project">
        <div className="h-72 animate-pulse rounded-lg border border-border bg-muted" />
      </Layout>
    );
  }

  const pct = Math.round((project.spent / project.budget) * 100);
  const overBudget = pct > 95;
  const openTasks = tasks.filter((t) => t.status !== "Complete").length;
  const openRfis = rfis.filter((r) => r.status === "Open").length;
  const openPunch = punch.filter((p) => p.status !== "Complete").length;
  const sup = project.superintendentId ? team.get(project.superintendentId) : undefined;

  return (
    <Layout title={project.name} actions={
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back
      </Link>
    }>
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-primary">{project.number}</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight">{project.name}</h2>
            <div className="mt-1 text-sm text-muted-foreground">{project.client} · {project.type}</div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {project.address}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Budget" value={formatCurrency(project.budget, { compact: true })} sub={`${formatCurrency(project.spent, { compact: true })} spent (${pct}%)`} />
          <Stat label="Schedule" value={`${project.progress}% complete`} sub={`${shortDate(project.startDate)} – ${shortDate(project.endDate)}`} />
          <Stat label="Open Tasks" value={String(openTasks)} sub={`${tasks.length} total`} />
          <Stat label="Open RFIs / Punch" value={`${openRfis} / ${openPunch}`} sub="awaiting action" />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Budget burn</span>
            <span className={cn("font-medium tabular", overBudget && "text-amber-500")}>{formatCurrency(project.spent)} / {formatCurrency(project.budget)}</span>
          </div>
          <div className="mt-1.5"><Progress value={pct} tone={overBudget ? "warning" : "primary"} /></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 flex items-center gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`tab-${t.key}`}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4" data-testid={`panel-${tab}`}>
        {tab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
              <h3 className="font-display text-base font-bold">Scope summary</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {project.name} is a {project.type.toLowerCase()} project for {project.client}, currently <strong className="text-foreground">{project.status.toLowerCase()}</strong> and {project.progress}% complete. The crew is tracking {openTasks} open tasks and {openRfis} open RFIs. Spend stands at {formatCurrency(project.spent)} of a {formatCurrency(project.budget)} budget.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /> Start: {formatDate(project.startDate)}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /> Substantial: {formatDate(project.endDate)}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Building2 className="size-4" /> {project.type}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><DollarSign className="size-4" /> {pct}% budget consumed</div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="font-display text-base font-bold">Superintendent</h3>
              {sup && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="size-10 rounded-full bg-primary/15 text-sm font-semibold leading-10 text-primary">{sup.initials}</span>
                  <div>
                    <div className="text-sm font-semibold">{sup.name}</div>
                    <div className="text-xs text-muted-foreground">{sup.role} · {sup.company}</div>
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Crew on site</span><span className="font-medium tabular">{logs[0]?.crewCount ?? "—"}</span></div>
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Today's weather</span><span className="font-medium">{logs[0]?.weather ?? "—"} {logs[0] ? `${logs[0].temp}°F` : ""}</span></div>
              </div>
            </div>
          </div>
        )}
        {tab === "tasks" && <TaskTable tasks={tasks} team={team} />}
        {tab === "rfis" && <RfiTable rfis={rfis} team={team} />}
        {tab === "logs" && <DailyLogList logs={logs} team={team} />}
        {tab === "punch" && <PunchList items={punch} team={team} />}
      </div>
    </Layout>
  );
}
