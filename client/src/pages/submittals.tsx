import { useMemo, useState } from "react";
import { Plus, FileEdit, Send, Search, CheckCircle2, XCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostSubmittalRows } from "@/components/ghost-state";
import { SubmittalTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { PUNCH_TRADES } from "@/lib/punch-catalog";
import { subjectsForTrade, tradeForSubmittalSubject } from "@/lib/submittal-catalog";
import { GenericBoard, type BoardColumn } from "@/components/generic-board";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import {
  useSubmittals,
  useTeamMap,
  useProjects,
  useTeam,
  useCreateSubmittal,
  useUpdateSubmittalStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/bits";
import { shortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Submittal } from "@shared/schema";

type Status = "Draft" | "Submitted" | "In Review" | "Approved" | "Rejected";

const COLUMNS: BoardColumn<Status>[] = [
  { status: "Draft", label: "Draft", icon: FileEdit, accent: "text-muted-foreground" },
  { status: "Submitted", label: "Submitted", icon: Send, accent: "text-primary" },
  { status: "In Review", label: "In Review", icon: Search, accent: "text-amber-500" },
  { status: "Approved", label: "Approved", icon: CheckCircle2, accent: "text-emerald-500" },
  { status: "Rejected", label: "Rejected", icon: XCircle, accent: "text-red-500" },
];

export default function SubmittalsPage() {
  const { data: items = [], isLoading } = useSubmittals();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateSubmittal();
  const updateStatus = useUpdateSubmittalStatus();
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Submittal | null>(null);

  const filtered = useMemo(() => {
    return items.filter((s) => {
      if (projectFilter !== "all" && String(s.projectId) !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "0" && s.assigneeId != null) return false;
        if (assigneeFilter !== "0" && String(s.assigneeId ?? "") !== assigneeFilter) return false;
      }
      return true;
    });
  }, [items, projectFilter, assigneeFilter]);

  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

  // Subject + Trade are combo boxes sourced from a shared catalog. Picking a
  // subject auto-fills Trade (when Trade is empty); picking a Trade narrows
  // the Subject list. Free-typing works on both.
  const tradeOptions = PUNCH_TRADES.map((v) => ({ value: v, label: v }));

  const baseFields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "Submittal #", type: "text", placeholder: "SUB-001", required: true, half: true },
    { name: "subject", label: "Subject", type: "combo", required: true, placeholder: "Type or pick a subject…" },
    { name: "trade", label: "Trade", type: "combo", options: tradeOptions, half: true, placeholder: "Type or pick a trade…" },
    { name: "type", label: "Type", type: "select", options: ["Shop Drawings", "Product Data", "Samples", "Calculations", "Other"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Draft", "Submitted", "In Review", "Approved", "Rejected"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
    { name: "dateSubmitted", label: "Date Submitted", type: "date", required: true, half: true },
    { name: "dueDate", label: "Due Date", type: "date", required: true, half: true },
  ];

  const fieldsForValues = (values: Record<string, string | number>): FieldDef[] => {
    const currentTrade = String(values.trade ?? "");
    const subjectOptions = subjectsForTrade(currentTrade).map((s) => ({ value: s.label, label: s.label }));
    return baseFields.map((f) =>
      f.name === "subject" ? { ...f, options: subjectOptions } : f
    );
  };

  const peopleOptions = [
    { value: "0", label: "Unassigned" },
    ...teamList.map((m) => ({ value: String(m.id), label: m.name })),
  ];

  return (
    <Layout
      title="Submittals"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-submittal">
          <Plus className="size-4" /> New Submittal
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Submittal"
        fields={baseFields}
        fieldsForValues={fieldsForValues}
        // Picking a known subject auto-fills Trade (only if Trade is empty).
        onFieldChange={(name, value, next) => {
          if (name === "subject" && !String(next.trade ?? "").trim()) {
            const trade = tradeForSubmittalSubject(String(value));
            if (trade) return { trade };
          }
          return;
        }}
        defaults={{ status: "Draft", type: "Shop Drawings", assigneeId: "0", subject: "", trade: "" }}
        submitLabel="Create Submittal"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            number: String(v.number),
            subject: String(v.subject),
            trade: String(v.trade || "").trim() || undefined,
            type: String(v.type),
            status: String(v.status),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
            dateSubmitted: String(v.dateSubmitted),
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
        total={items.length}
        view={view}
        onView={setView}
        countTestId="text-sub-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : filtered.length === 0 && items.length === 0 ? (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Subject</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Assignee</th><th className="px-4 py-2.5 font-medium">Submitted</th><th className="px-4 py-2.5 font-medium">Due</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <GhostSubmittalRows />
            </table>
          </div>
          <div className="mt-4">
            <GhostState
              title="No submittals yet"
              description="The sample rows above show what submittals will look like. They appear here once your team submits shop drawings, product data, or samples."
              icon={FileEdit}
            />
          </div>
        </div>
      ) : view === "board" ? (
        <GenericBoard<Submittal, Status>
          items={filtered}
          columns={COLUMNS}
          getStatus={(s) => s.status}
          getId={(s) => s.id}
          mutate={(args) => updateStatus.mutate(args)}
          entityLabel="Submittal"
          entityTitle={(s) => `${s.number} — ${s.subject}`}
          idPrefix="sub"
          columnClassName="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          onCardClick={(s) => setSelected(s)}
          renderCard={(s) => {
            const a = s.assigneeId ? team.get(s.assigneeId) : undefined;
            const overdue = isOverdue(s.dueDate) && s.status !== "Approved" && s.status !== "Rejected";
            return (
              <>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    {s.number}
                  </span>
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                    {s.type}
                  </span>
                </div>
                <h4 className="text-sm font-medium leading-snug">{s.subject}</h4>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {projectName(s.projectId) ?? "—"}
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
                    {shortDate(s.dueDate)}
                  </span>
                </div>
              </>
            );
          }}
        />
      ) : (
        <SubmittalTable items={filtered} team={team} projects={projectList} onRowClick={(s) => setSelected(s)} />
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
            statusOptions={["Draft", "Submitted", "In Review", "Approved", "Rejected"]}
            onStatusChange={(s) => {
              updateStatus.mutate({ id: selected.id, status: s as Status });
              setSelected({ ...selected, status: s });
            }}
            isStatusPending={updateStatus.isPending}
            fields={[
              { label: "Type", value: selected.type },
              { label: "Trade", value: selected.trade || "—" },
              { label: "Assignee", value: a?.name ?? "Unassigned" },
              { label: "Project", value: projectName(selected.projectId), full: true },
              { label: "Date submitted", value: shortDate(selected.dateSubmitted), mono: true },
              { label: "Due date", value: shortDate(selected.dueDate), mono: true },
            ]}
          />
        );
      })()}
    </Layout>
  );
}
