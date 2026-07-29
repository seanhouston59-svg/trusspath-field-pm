import { useMemo, useState, useEffect } from "react";
import { Plus, ListChecks, HardHat } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { GhostState, GhostTaskRows } from "@/components/ghost-state";
import { TaskTable } from "@/components/tables";
import { TaskBoard } from "@/components/task-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { useTasks, useTeamMap, useProjects, useTeam, useCreateTask, useUpdateTaskStatus } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import { PriorityBadge } from "@/components/bits";
import { shortDate } from "@/lib/format";
import type { Task } from "@shared/schema";

export default function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];

  // Selected project id inside the create dialog (kept in local state so we
  // can lazily load its attached sub companies). Cleared when the dialog
  // closes so we don't hold stale project state.
  const [dialogProjectId, setDialogProjectId] = useState<string>("");
  type SubOnProject = { subCompanyId: number; companyName: string; trade: string | null };
  const { data: projectSubs = [] } = useQuery<SubOnProject[]>({
    queryKey: ["/api/projects", dialogProjectId, "sub-companies"],
    enabled: !!dialogProjectId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${dialogProjectId}/sub-companies`);
      return await res.json();
    },
  });

  // Assignee dropdown mixes team members + subs on the currently-picked
  // project. Sub entries use a "sub:<id>" value so the submit handler can
  // route them to `assignedSubCompanyId` instead of `assigneeId`.
  const assigneeOptionsForProject = (projectId: string) => [
    { value: "0", label: "Unassigned" },
    ...teamList.map((m) => ({ value: String(m.id), label: m.name })),
    ...(projectId ? projectSubs.map(s => ({
      value: `sub:${s.subCompanyId}`,
      label: `\u{1F477} ${s.companyName}${s.trade ? ` \u2014 ${s.trade}` : ""}`,
    })) : []),
  ];

  const create = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const [open, setOpen] = useState(false);

  // Auto-open create dialog when navigated with ?new=1. The app uses wouter's
  // useHashLocation which strips the query string from useLocation(), so we
  // read the raw hash ourselves and listen for hashchange. Mirrors the pattern
  // in projects.tsx.
  useEffect(() => {
    const checkAndOpen = () => {
      const hash = window.location.hash || "";
      const qIdx = hash.indexOf("?");
      if (qIdx === -1) return;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      if (params.get("new") === "1") {
        setOpen(true);
        const cleanHash = hash.slice(0, qIdx);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${cleanHash}`);
      }
    };
    checkAndOpen();
    window.addEventListener("hashchange", checkAndOpen);
    return () => window.removeEventListener("hashchange", checkAndOpen);
  }, []);
  const [selected, setSelected] = useState<Task | null>(null);
  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

  // View + filters
  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (projectFilter !== "all" && String(t.projectId) !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "0" && t.assigneeId != null) return false;
        if (assigneeFilter !== "0" && String(t.assigneeId ?? "") !== assigneeFilter) return false;
      }
      return true;
    });
  }, [tasks, projectFilter, assigneeFilter]);

  const baseFields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "title", label: "Task Title", type: "text", required: true, placeholder: "Install HVAC ductwork on floor 3" },
    { name: "trade", label: "Trade", type: "text", placeholder: "Electrical", required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Not Started", "In Progress", "Blocked", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
    { name: "startDate", label: "Start Date", type: "date", half: true },
    { name: "endDate", label: "End Date", type: "date", half: true },
  ];

  // Rebuilt every render based on the picked project so subs on that project
  // appear in the Assignee dropdown alongside team members. We rely on
  // onFieldChange to keep dialogProjectId in sync \u2014 avoiding setState
  // during render, which would loop.
  const fieldsForValues = (_values: Record<string, string | number>): FieldDef[] => {
    const options = assigneeOptionsForProject(dialogProjectId);
    return baseFields.map(f => f.name === "assigneeId" ? { ...f, options } : f);
  };

  return (
    <Layout
      title="Tasks"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-task">
          <Plus className="size-4" /> New Task
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Task"
        fields={baseFields}
        fieldsForValues={fieldsForValues}
        onFieldChange={(name, value, next) => {
          if (name === "projectId") {
            const p = String(value ?? "");
            if (p !== dialogProjectId) setDialogProjectId(p);
            // If the current assignee is a sub-token, clear it \u2014 the sub
            // may not be on the newly-picked project.
            if (String(next.assigneeId ?? "").startsWith("sub:")) return { assigneeId: "0" };
          }
          return;
        }}
        defaults={{ status: "Not Started", priority: "Medium", assigneeId: "0" }}
        submitLabel="Create Task"
        isPending={create.isPending}
        onSubmit={(v) => {
          const raw = String(v.assigneeId ?? "0");
          const isSubAssign = raw.startsWith("sub:");
          return create.mutateAsync({
            projectId: Number(v.projectId),
            title: String(v.title),
            trade: String(v.trade),
            status: String(v.status),
            priority: String(v.priority),
            // Route "sub:<id>" values to the sub-company FK; team ids to
            // the team-member FK. "0" = unassigned.
            assigneeId: (!isSubAssign && raw !== "0") ? Number(raw) : undefined,
            assignedSubCompanyId: isSubAssign ? Number(raw.slice(4)) : undefined,
            dueDate: String(v.dueDate),
            // Gantt needs start/end to render a bar with proper width. Fall
            // back to dueDate so “bare” tasks still get a visible sliver.
            startDate: v.startDate ? String(v.startDate) : String(v.dueDate),
            endDate: v.endDate ? String(v.endDate) : String(v.dueDate),
          });
        }}
      />

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        peopleLabel="assignees"
        peopleOptions={[{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))]}
        peopleFilter={assigneeFilter}
        onPeopleFilter={setAssigneeFilter}
        count={filtered.length}
        total={tasks.length}
        view={view}
        onView={setView}
        countTestId="text-task-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : filtered.length === 0 && tasks.length === 0 ? (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Task</th><th className="px-4 py-2.5 font-medium">Trade</th><th className="px-4 py-2.5 font-medium">Assignee</th><th className="px-4 py-2.5 font-medium">Due</th><th className="px-4 py-2.5 font-medium">Priority</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <GhostTaskRows />
            </table>
          </div>
          <div className="mt-4">
            <GhostState
              title="No tasks yet"
              description="The sample rows above show what your tasks will look like. Create your first task to get started."
              icon={ListChecks}
              ctaLabel="Create task"
              ctaOnClick={() => setOpen(true)}
            />
          </div>
        </div>
      ) : view === "board" ? (
        <TaskBoard tasks={filtered} team={team} projects={projectList} onCardClick={(t) => setSelected(t)} />
      ) : (
        <TaskTable tasks={filtered} team={team} projects={projectList} onRowClick={(t) => setSelected(t)} />
      )}

      {selected && (() => {
        const a = selected.assigneeId ? team.get(selected.assigneeId) : undefined;
        const assigneeLabel = a?.name
          ?? (selected.assignedSubCompanyId ? "Sub company" : "Unassigned");
        return (
          <ItemDetailSheet
            open={!!selected}
            onOpenChange={(o) => !o && setSelected(null)}
            title={selected.title}
            subtitle={projectName(selected.projectId)}
            currentStatus={selected.status}
            statusOptions={["Not Started", "In Progress", "Blocked", "Complete"]}
            onStatusChange={(s) => {
              updateStatus.mutate({ id: selected.id, status: s });
              setSelected({ ...selected, status: s });
            }}
            isStatusPending={updateStatus.isPending}
            fields={[
              { label: "Trade", value: selected.trade },
              { label: "Priority", value: <PriorityBadge priority={selected.priority} /> },
              { label: "Assignee", value: assigneeLabel },
              { label: "Project", value: projectName(selected.projectId) },
              { label: "Due date", value: shortDate(selected.dueDate), mono: true },
              ...(selected.startDate ? [{ label: "Start date", value: shortDate(selected.startDate), mono: true }] : []),
              ...(selected.endDate ? [{ label: "End date", value: shortDate(selected.endDate), mono: true }] : []),
              ...(selected.subCompletedAt ? [{ label: "Sub marked complete", value: shortDate(selected.subCompletedAt), mono: true }] : []),
              ...(selected.subCompletionNote ? [{ label: "Sub note", value: selected.subCompletionNote, full: true }] : []),
            ]}
            footer={selected.assignedSubCompanyId ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <div className="flex items-center gap-2 font-medium"><HardHat className="size-3.5" /> Assigned to a sub company</div>
                <p className="mt-1">This sub can see this task in their portal and mark it complete.</p>
              </div>
            ) : undefined}
          />
        );
      })()}
    </Layout>
  );
}
