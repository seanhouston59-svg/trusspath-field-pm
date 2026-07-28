import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  MapPin, Calendar, Building2, DollarSign, ListChecks, HelpCircle, ClipboardList, CheckSquare,
  ExternalLink, Pencil, X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ProjectStatusBadge, Progress } from "@/components/bits";
import { TaskTable, RfiTable, DailyLogList, PunchList } from "@/components/tables";
import {
  useProject, useTasks, useRfis, useDailyLogs, usePunchItems, useTeamMap, useUpdateProject,
} from "@/hooks/use-data";
import { formatCurrency, shortDate, formatDate } from "@/lib/format";
import { googleMapsUrl } from "@/lib/maps";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/address-autocomplete";

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
  const updateProject = useUpdateProject();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        client: project.client,
        type: project.type,
        status: project.status,
        address: project.address,
        startDate: project.startDate,
        endDate: project.endDate,
        budget: String(project.budget),
        spent: String(project.spent),
        progress: String(project.progress),
      });
    }
  }, [project]);

  function saveEdit() {
    if (!project) return;
    updateProject.mutate({
      id: project.id,
      data: {
        name: form.name,
        client: form.client,
        type: form.type,
        status: form.status,
        address: form.address,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: parseFloat(form.budget) || 0,
        spent: parseFloat(form.spent) || 0,
        progress: parseInt(form.progress) || 0,
      },
    }, { onSuccess: () => setEditing(false) });
  }

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
    <Layout title={project.name}>
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
            <button
              onClick={() => setEditing(true)}
              data-testid="button-edit-project"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-muted"
            >
              <Pencil className="size-3.5" /> Edit Project
            </button>
            {googleMapsUrl(project.address) ? (
              <a
                href={googleMapsUrl(project.address)!}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Open in Google Maps"
                aria-label={`Open ${project.address} in Google Maps`}
                data-testid="link-project-address"
              >
                <MapPin className="size-4" />
                <span className="underline-offset-2 group-hover:underline">{project.address}</span>
                <ExternalLink className="size-3 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
              </a>
            ) : (
              <span className="flex items-center gap-1.5"><MapPin className="size-4" /> {project.address}</span>
            )}
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

      {/* Edit Dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Edit Project</h3>
              <button onClick={() => setEditing(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project Name</label>
                <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</label>
                  <input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-client" />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</label>
                  <select value={form.type ?? ""} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-type">
                    <option value="Commercial">Commercial</option>
                    <option value="Residential">Residential</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Education">Education</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Civil">Civil</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
                  <select value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-status">
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progress (%)</label>
                  <input type="number" value={form.progress ?? "0"} onChange={(e) => setForm({ ...form, progress: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-progress" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Address</label>
                <div className="mt-1">
                  <AddressAutocomplete
                    value={form.address ?? ""}
                    onChange={(v) => setForm({ ...form, address: v })}
                    placeholder="Start typing the job site address…"
                    multiline
                    data-testid="input-edit-address"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Start Date</label>
                  <input type="date" value={form.startDate ?? ""} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-start-date" />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">End Date</label>
                  <input type="date" value={form.endDate ?? ""} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-end-date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Budget ($)</label>
                  <input type="number" value={form.budget ?? "0"} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-budget" />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Spent ($)</label>
                  <input type="number" value={form.spent ?? "0"} onChange={(e) => setForm({ ...form, spent: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-edit-spent" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={saveEdit} disabled={updateProject.isPending} data-testid="button-save-project" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {updateProject.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
