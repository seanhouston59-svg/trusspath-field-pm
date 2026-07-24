import { useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { ChangeOrderTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useChangeOrders, useProjects, useCreateChangeOrder } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

export default function ChangeOrdersPage() {
  const { data: items = [], isLoading } = useChangeOrders();
  const { data: projects = [] } = useProjects();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const create = useCreateChangeOrder();
  const [open, setOpen] = useState(false);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "CO Number", type: "text", placeholder: "CO-001", required: true, half: true },
    { name: "title", label: "Title", type: "text", required: true },
    { name: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Approved", "Rejected", "Executed"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "amount", label: "Amount ($)", type: "number", required: true, half: true },
    { name: "scheduleImpact", label: "Schedule Impact (days)", type: "number", required: true, half: true },
    { name: "dateIssued", label: "Date Issued", type: "date", required: true, half: true },
  ];

  return (
    <Layout title="Change Orders" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-co"><Plus className="size-4" /> New Change Order</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Change Order"
        fields={fields}
        defaults={{ status: "Draft", amount: 0, scheduleImpact: 0 }}
        submitLabel="Create Change Order"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          number: String(v.number),
          title: String(v.title),
          status: String(v.status),
          amount: Number(v.amount),
          scheduleImpact: Number(v.scheduleImpact),
          dateIssued: String(v.dateIssued),
        })}
      />
      {isLoading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" /> : <ChangeOrderTable items={items} projects={projectList} />}
    </Layout>
  );
}
