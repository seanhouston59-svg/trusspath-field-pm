import { useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { PunchList } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
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

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "title", label: "Item", type: "text", required: true, placeholder: "Touch up drywall at Room 112" },
    { name: "location", label: "Location", type: "text", required: true, half: true, placeholder: "Level 1, Rm 112" },
    { name: "trade", label: "Trade", type: "text", required: true, half: true, placeholder: "Drywall" },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
  ];

  return (
    <Layout title="Punch List" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-punch"><Plus className="size-4" /> Add Item</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Punch Item"
        fields={fields}
        defaults={{ status: "Open", assigneeId: "0" }}
        submitLabel="Create Item"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          title: String(v.title),
          location: String(v.location),
          trade: String(v.trade),
          status: String(v.status),
          assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
        })}
      />
      {isLoading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" /> : <PunchList items={items} team={team} projects={projectList} />}
    </Layout>
  );
}
