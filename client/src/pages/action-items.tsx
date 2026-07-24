import { useMemo, useState } from "react";
import { Plus, Circle, Clock, CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { ActionItemTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { GenericBoard, type BoardColumn } from "@/components/generic-board";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import {
  useActionItems,
  useProjects,
  useCreateActionItem,
  useUpdateActionItemStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/bits";
import { shortDate, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@shared/schema";

type Status = "Open" | "In Progress" | "Done";

const COLUMNS: BoardColumn<Status>[] = [
  { status: "Open", label: "Open", icon: Circle, accent: "text-amber-500" },
  { status: "In Progress", label: "In Progress", icon: Clock, accent: "text-primary" },
  { status: "Done", label: "Done", icon: CheckCircle2, accent: "text-emerald-500" },
];

export default function ActionItemsPage() {
  const { data: items = [], isLoading } = useActionItems();
  const { data: projects = [] } = useProjects();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const create = useCreateActionItem();
  const updateStatus = useUpdateActionItemStatus();
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ActionItem | null>(null);

  const ownerOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.owner))).sort().map((o) => ({ value: o, label: o })),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (projectFilter !== "all" && String(i.projectId) !== projectFilter) return false;
      if (ownerFilter !== "all" && i.owner !== ownerFilter) return false;
      return true;
    });
  }, [items, projectFilter, ownerFilter]);

  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

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
    <Layout
      title="Action Items"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-ai">
          <Plus className="size-4" /> New Action Item
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Action Item"
        fields={fields}
        defaults={{ status: "Open", priority: "Medium", source: "Manual" }}
        submitLabel="Create Action Item"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            title: String(v.title),
            owner: String(v.owner),
            status: String(v.status),
            priority: String(v.priority),
            dueDate: String(v.dueDate),
            source: String(v.source),
          })
        }
      />

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        peopleLabel="owners"
        peopleOptions={ownerOptions}
        peopleFilter={ownerFilter}
        onPeopleFilter={setOwnerFilter}
        count={filtered.length}
        total={items.length}
        view={view}
        onView={setView}
        countTestId="text-ai-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : view === "board" ? (
        <GenericBoard<ActionItem, Status>
          items={filtered}
          columns={COLUMNS}
          getStatus={(i) => i.status}
          getId={(i) => i.id}
          mutate={(args) => updateStatus.mutate(args)}
          entityLabel="Action item"
          entityTitle={(i) => i.title}
          idPrefix="ai"
          columnClassName="md:grid-cols-2 xl:grid-cols-3"
          onCardClick={(i) => setSelected(i)}
          renderCard={(i) => {
            const overdue = isOverdue(i.dueDate) && i.status !== "Done";
            return (
              <>
                <div className="mb-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium leading-snug">{i.title}</h4>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {projectName(i.projectId) ?? "—"}
                    </p>
                  </div>
                  <PriorityBadge priority={i.priority} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="truncate">{i.owner}</span>
                  <span className={cn("shrink-0 tabular-nums", overdue && "font-medium text-red-500")}>
                    {shortDate(i.dueDate)}
                  </span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {i.source}
                </div>
              </>
            );
          }}
        />
      ) : (
        <ActionItemTable items={filtered} projects={projectList} onRowClick={(i) => setSelected(i)} />
      )}

      {selected && (
        <ItemDetailSheet
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          title={selected.title}
          subtitle={projectName(selected.projectId)}
          currentStatus={selected.status}
          statusOptions={["Open", "In Progress", "Done"]}
          onStatusChange={(s) => {
            updateStatus.mutate({ id: selected.id, status: s as Status });
            setSelected({ ...selected, status: s });
          }}
          isStatusPending={updateStatus.isPending}
          fields={[
            { label: "Owner", value: selected.owner },
            { label: "Priority", value: <PriorityBadge priority={selected.priority} /> },
            { label: "Project", value: projectName(selected.projectId), full: true },
            { label: "Due date", value: shortDate(selected.dueDate), mono: true },
            { label: "Source", value: selected.source },
          ]}
        />
      )}
    </Layout>
  );
}
