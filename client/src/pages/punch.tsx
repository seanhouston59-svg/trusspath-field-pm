import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { PunchList } from "@/components/tables";
import { PunchBoard } from "@/components/punch-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { usePunchItems, useTeamMap, useProjects, useTeam, useCreatePunchItem } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

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

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        peopleLabel="assignees"
        peopleOptions={[{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))]}
        peopleFilter={assigneeFilter}
        onPeopleFilter={setAssigneeFilter}
        count={filtered.length}
        total={items.length}
        view={view}
        onView={setView}
        countTestId="text-punch-count"
      />

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
