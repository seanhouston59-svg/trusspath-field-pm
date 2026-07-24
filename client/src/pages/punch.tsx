import { useMemo, useState } from "react";
import { Plus, LayoutGrid, Rows3 } from "lucide-react";
import { Layout } from "@/components/layout";
import { PunchList } from "@/components/tables";
import { PunchBoard } from "@/components/punch-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { usePunchItems, useTeamMap, useProjects, useTeam, useCreatePunchItem } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type View = "table" | "board";

export default function PunchPage() {
  const { data: items = [], isLoading } = usePunchItems();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreatePunchItem();
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (projectFilter !== "all" && String(it.projectId) !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "0" && it.assigneeId != null) return false;
        if (assigneeFilter !== "0" && String(it.assigneeId ?? "") !== assigneeFilter) return false;
      }
      return true;
    });
  }, [items, projectFilter, assigneeFilter]);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "title", label: "Item", type: "text", required: true, placeholder: "Touch up drywall at Room 112" },
    { name: "location", label: "Location", type: "text", required: true, half: true, placeholder: "Level 1, Rm 112" },
    { name: "trade", label: "Trade", type: "text", required: true, half: true, placeholder: "Drywall" },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
  ];

  return (
    <Layout
      title="Punch List"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-punch">
          <Plus className="size-4" /> Add Item
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Punch Item"
        fields={fields}
        defaults={{ status: "Open", assigneeId: "0" }}
        submitLabel="Create Item"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            title: String(v.title),
            location: String(v.location),
            trade: String(v.trade),
            status: String(v.status),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
          })
        }
      />

      {/* Toolbar */}
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

        <span className="ml-1 text-xs text-muted-foreground" data-testid="text-punch-count">
          {filtered.length} of {items.length}
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
        <PunchBoard items={filtered} team={team} projects={projectList} />
      ) : (
        <PunchList items={filtered} team={team} projects={projectList} />
      )}
    </Layout>
  );
}
