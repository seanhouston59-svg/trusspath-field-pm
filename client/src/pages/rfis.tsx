import { useMemo, useState } from "react";
import { Plus, HelpCircle, Search, MessageSquare, Archive } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostRfiRows } from "@/components/ghost-state";
import { RfiTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { GenericBoard, type BoardColumn } from "@/components/generic-board";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import {
  useRfis,
  useTeamMap,
  useProjects,
  useTeam,
  useCreateRfi,
  useUpdateRfiStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/bits";
import { shortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Rfi } from "@shared/schema";

type Status = "Open" | "In Review" | "Answered" | "Closed";

const COLUMNS: BoardColumn<Status>[] = [
  { status: "Open", label: "Open", icon: HelpCircle, accent: "text-amber-500" },
  { status: "In Review", label: "In Review", icon: Search, accent: "text-primary" },
  { status: "Answered", label: "Answered", icon: MessageSquare, accent: "text-blue-500" },
  { status: "Closed", label: "Closed", icon: Archive, accent: "text-emerald-500" },
];

export default function RfisPage() {
  const { data: rfis = [], isLoading } = useRfis();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateRfi();
  const updateStatus = useUpdateRfiStatus();
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Rfi | null>(null);

  const filtered = useMemo(() => {
    return rfis.filter((r) => {
      if (projectFilter !== "all" && String(r.projectId) !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "0" && r.assigneeId != null) return false;
        if (assigneeFilter !== "0" && String(r.assigneeId ?? "") !== assigneeFilter) return false;
      }
      return true;
    });
  }, [rfis, projectFilter, assigneeFilter]);

  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "RFI #", type: "text", placeholder: "RFI-001", required: true, half: true },
    { name: "subject", label: "Subject", type: "text", required: true },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Review", "Answered", "Closed"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dateCreated", label: "Date Created", type: "date", required: true, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
  ];

  const peopleOptions = [
    { value: "0", label: "Unassigned" },
    ...teamList.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  return (
    <Layout
      title="RFIs"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-rfi">
          <Plus className="size-4" /> New RFI
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New RFI"
        fields={fields}
        defaults={{ status: "Open", assigneeId: "0" }}
        submitLabel="Create RFI"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            number: String(v.number),
            subject: String(v.subject),
            status: String(v.status),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
            dateCreated: String(v.dateCreated),
            dueDate: String(v.dueDate),
          })
        }
      />

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        peopleLabel="assignees"
        peopleOptions={peopleOptions}
        peopleFilter={assigneeFilter}
        onPeopleFilter={setAssigneeFilter}
        count={filtered.length}
        total={rfis.length}
        view={view}
        onView={setView}
        countTestId="text-rfi-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : filtered.length === 0 && rfis.length === 0 ? (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Subject</th><th className="px-4 py-2.5 font-medium">Assignee</th><th className="px-4 py-2.5 font-medium">Created</th><th className="px-4 py-2.5 font-medium">Due</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <GhostRfiRows />
            </table>
          </div>
          <div className="mt-4">
            <GhostState
              title="No RFIs yet"
              description="The sample rows above show what your RFIs will look like. They appear here once your team submits requests for information."
              icon={HelpCircle}
            />
          </div>
        </div>
      ) : view === "board" ? (
        <GenericBoard<Rfi, Status>
          items={filtered}
          columns={COLUMNS}
          getStatus={(r) => r.status}
          getId={(r) => r.id}
          mutate={(args) => updateStatus.mutate(args)}
          entityLabel="RFI"
          entityTitle={(r) => `${r.number} — ${r.subject}`}
          idPrefix="rfi"
          onCardClick={(r) => setSelected(r)}
          renderCard={(r) => {
            const a = r.assigneeId ? team.get(r.assigneeId) : undefined;
            const overdue = isOverdue(r.dueDate) && r.status !== "Closed";
            return (
              <>
                <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  {r.number}
                </div>
                <h4 className="text-sm font-medium leading-snug">{r.subject}</h4>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {projectName(r.projectId) ?? "—"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {a ? (
                      <>
                        <Avatar initials={a.initials} color={a.color} size={18} />
                        <span className="truncate text-muted-foreground">{a.name.split(" ")[0]}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                  <span className={cn("shrink-0 tabular-nums text-muted-foreground", overdue && "font-medium text-red-500")}>
                    {shortDate(r.dueDate)}
                  </span>
                </div>
              </>
            );
          }}
        />
      ) : (
        <RfiTable rfis={filtered} team={team} projects={projectList} onRowClick={(r) => setSelected(r)} />
      )}

      {selected && (() => {
        const a = selected.assigneeId ? team.get(selected.assigneeId) : undefined;
        return (
          <ItemDetailSheet
            open={!!selected}
            onOpenChange={(o) => !o && setSelected(null)}
            eyebrow={selected.number}
            title={selected.subject}
            subtitle={projectName(selected.projectId)}
            currentStatus={selected.status}
            statusOptions={["Open", "In Review", "Answered", "Closed"]}
            onStatusChange={(s) => {
              updateStatus.mutate({ id: selected.id, status: s as Status });
              setSelected({ ...selected, status: s });
            }}
            isStatusPending={updateStatus.isPending}
            fields={[
              { label: "Assignee", value: a?.name ?? "Unassigned" },
              { label: "Project", value: projectName(selected.projectId) },
              { label: "Date created", value: shortDate(selected.dateCreated), mono: true },
              { label: "Due date", value: shortDate(selected.dueDate), mono: true },
            ]}
          />
        );
      })()}
    </Layout>
  );
}
