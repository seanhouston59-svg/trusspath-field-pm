import { useState } from "react";
import { Plus, Wrench, MapPin, User } from "lucide-react";
import { Layout } from "@/components/layout";
import { EquipmentStatusBadge } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useEquipment, useProjects, useCreateEquipment } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

const TYPE_ICON: Record<string, string> = {
  Crane: "🏗️", Excavator: "⛏️", "Skid Steer": "🚜", Lift: "🛗", Pump: "🚿",
};

export default function EquipmentPage() {
  const { data: items = [], isLoading } = useEquipment();
  const { data: projects = [] } = useProjects();
  const projName = (id: number | null) => projects.find((p) => p.id === id)?.name ?? "Fleet yard";
  const projectOptions = [{ value: "0", label: "Fleet yard" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))];
  const create = useCreateEquipment();
  const [open, setOpen] = useState(false);

  const fields: FieldDef[] = [
    { name: "name", label: "Equipment name", type: "text", required: true, placeholder: "Link-Belt 80T Crane #1" },
    { name: "type", label: "Type", type: "select", options: ["Crane", "Excavator", "Skid Steer", "Lift", "Pump"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["On Site", "In Maintenance", "Off Site"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "projectId", label: "Assigned to", type: "select", options: projectOptions, half: true },
    { name: "operator", label: "Operator", type: "text", half: true, placeholder: "T. Bradshaw" },
    { name: "location", label: "Location", type: "text", half: true, placeholder: "North pad" },
  ];

  return (
    <Layout title="Fleet & Equipment" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-eq"><Plus className="size-4" /> Add Equipment</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Equipment"
        fields={fields}
        defaults={{ type: "Crane", status: "On Site", projectId: "0" }}
        submitLabel="Add Equipment"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          name: String(v.name),
          type: String(v.type),
          status: String(v.status),
          projectId: v.projectId === "0" ? null : Number(v.projectId),
          operator: v.operator ? String(v.operator) : null,
          location: v.location ? String(v.location) : null,
        })}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e) => (
            <div key={e.id} className="rounded-lg border border-border bg-card p-5 shadow-sm" data-testid={`card-eq-${e.id}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted text-lg">{TYPE_ICON[e.type] ?? <Wrench className="size-5 text-muted-foreground" />}</span>
                  <div>
                    <div className="font-display text-sm font-bold leading-tight">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.type}</div>
                  </div>
                </div>
                <EquipmentStatusBadge status={e.status} />
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="size-3.5" /> {e.location ?? "—"}</div>
                <div className="flex items-center gap-2"><User className="size-3.5" /> Operator: {e.operator ?? "—"}</div>
                <div className="flex items-center gap-2"><span className="size-3.5">📁</span> {projName(e.projectId ?? null)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
