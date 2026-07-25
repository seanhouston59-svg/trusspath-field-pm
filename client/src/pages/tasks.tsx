import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Plus, ListChecks } from "lucide-react";
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
  const create = useCreateTask();
  const updateStatus = useUpdateTaskStatus();
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("new=1")) setOpen(true);
  }, [location]);
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

  const fields: FieldDef[] = [
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
        fields={fields}
        defaults={{ status: "Not Started", priority: "Medium", assigneeId: "0" }}
        submitLabel="Create Task"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            title: String(v.title),
            trade: String(v.trade),
            status: String(v.status),
            priority: String(v.priority),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
            dueDate: String(v.dueDate),
          })
        }
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
              ctaHref="/tasks?new=1"
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
              { label: "Assignee", value: a?.name ?? "Unassigned" },
              { label: "Project", value: projectName(selected.projectId) },
              { label: "Due date", value: shortDate(selected.dueDate), mono: true },
              ...(selected.startDate ? [{ label: "Start date", value: shortDate(selected.startDate), mono: true }] : []),
              ...(selected.endDate ? [{ label: "End date", value: shortDate(selected.endDate), mono: true }] : []),
            ]}
          />
        );
      })()}
    </Layout>
  );
}
