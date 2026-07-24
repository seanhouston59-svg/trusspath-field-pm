import { useState } from "react";
import { Plus } from "lucide-react";
import { Layout } from "@/components/layout";
import { RfiTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useRfis, useTeamMap, useProjects, useTeam, useCreateRfi } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

export default function RfisPage() {
  const { data: rfis = [], isLoading } = useRfis();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateRfi();
  const [open, setOpen] = useState(false);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "RFI #", type: "text", placeholder: "RFI-001", required: true, half: true },
    { name: "subject", label: "Subject", type: "text", required: true },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Review", "Answered", "Closed"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dateCreated", label: "Date Created", type: "date", required: true, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
  ];

  return (
    <Layout title="RFIs" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-rfi"><Plus className="size-4" /> New RFI</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New RFI"
        fields={fields}
        defaults={{ status: "Open", assigneeId: "0" }}
        submitLabel="Create RFI"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          number: String(v.number),
          subject: String(v.subject),
          status: String(v.status),
          assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
          dateCreated: String(v.dateCreated),
          dueDate: String(v.dueDate),
        })}
      />
      {isLoading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" /> : <RfiTable rfis={rfis} team={team} projects={projectList} />}
    </Layout>
  );
}
