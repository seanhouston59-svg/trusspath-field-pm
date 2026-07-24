import { useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { SubmittalTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useSubmittals, useTeamMap, useProjects, useTeam, useCreateSubmittal } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

export default function SubmittalsPage() {
  const { data: items = [], isLoading } = useSubmittals();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateSubmittal();
  const [open, setOpen] = useState(false);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "Submittal #", type: "text", placeholder: "SUB-001", required: true, half: true },
    { name: "subject", label: "Subject", type: "text", required: true },
    { name: "type", label: "Type", type: "select", options: ["Shop Drawings", "Product Data", "Samples", "Calculations", "Other"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Draft", "Submitted", "In Review", "Approved", "Rejected"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dateSubmitted", label: "Date Submitted", type: "date", required: true, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
  ];

  return (
    <Layout title="Submittals" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-submittal"><Plus className="size-4" /> New Submittal</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Submittal"
        fields={fields}
        defaults={{ status: "Draft", type: "Shop Drawings", assigneeId: "0" }}
        submitLabel="Create Submittal"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          number: String(v.number),
          subject: String(v.subject),
          type: String(v.type),
          status: String(v.status),
          assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
          dateSubmitted: String(v.dateSubmitted),
          dueDate: String(v.dueDate),
        })}
      />
      {isLoading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" /> : <SubmittalTable items={items} team={team} projects={projectList} />}
    </Layout>
  );
}
