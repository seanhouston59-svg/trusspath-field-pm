import { useMemo, useState } from "react";
import { Plus, LayoutGrid, Rows3 } from "lucide-react";
import { Layout } from "@/components/layout";
import { TaskTable } from "@/components/tables";
import { TaskBoard } from "@/components/task-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useTasks, useTeamMap, useProjects, useTeam, useCreateTask } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type View = "table" | "board";

export default function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateTask();
  const [open, setOpen] = useState(false);

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
    { name: "title", label: "Task Title", type: "text", required: true },
    { name: "trade", label: "Trade", type: "text", placeholder: "Electrical", required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Not Started", "In Progress", "Blocked", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
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

      {/* Toolbar: filters + view toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-9 w-[200px]" data-testid="filter-project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="filter-assignee">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value="0">Unassigned</SelectItem>
            {teamList.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-1 text-xs text-muted-foreground" data-testid="text-task-count">
          {filtered.length} of {tasks.length}
        </span>

        <div className="ml-auto inline-flex rounded-md border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setView("board")}
            data-testid="view-board"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
              view === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" /> Board
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            data-testid="view-table"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
              view === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Rows3 className="size-3.5" /> Table
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : view === "board" ? (
        <TaskBoard tasks={filtered} team={team} projects={projectList} />
      ) : (
        <TaskTable tasks={filtered} team={team} projects={projectList} />
      )}
    </Layout>
  );
}
