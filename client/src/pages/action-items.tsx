import { useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { ActionItemTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useActionItems, useProjects, useCreateActionItem } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

export default function ActionItemsPage() {
  const { data: items = [], isLoading } = useActionItems();
  const { data: projects = [] } = useProjects();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const create = useCreateActionItem();
  const [open, setOpen] = useState(false);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "title", label: "Action Item", type: "text", required: true },
    { name: "owner", label: "Owner", type: "text", required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Done"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "priority", label: "Priority", type: "select", options: ["Low", "Medium", "High"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
    { name: "source", label: "Source", type: "text", placeholder: "Manual", required: true, half: true },
  ];

  return (
    <Layout title="Action Items" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-ai"><Plus className="size-4" /> New Action Item</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Action Item"
        fields={fields}
        defaults={{ status: "Open", priority: "Medium", source: "Manual" }}
        submitLabel="Create Action Item"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          title: String(v.title),
          owner: String(v.owner),
          status: String(v.status),
          priority: String(v.priority),
          dueDate: String(v.dueDate),
          source: String(v.source),
        })}
      />
      {isLoading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" /> : <ActionItemTable items={items} projects={projectList} />}
    </Layout>
  );
}
