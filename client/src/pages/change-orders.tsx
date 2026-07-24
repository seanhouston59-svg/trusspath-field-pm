import { useMemo, useState } from "react";
import { Plus, FileEdit, Clock, CheckCircle2, XCircle, Zap } from "lucide-react";
import { Layout } from "@/components/layout";
import { ChangeOrderTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { GenericBoard, type BoardColumn } from "@/components/generic-board";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import {
  useChangeOrders,
  useProjects,
  useCreateChangeOrder,
  useUpdateChangeOrderStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { formatCurrency, shortDate } from "@/lib/format";
import type { ChangeOrder } from "@shared/schema";

type Status = "Draft" | "Pending" | "Approved" | "Rejected" | "Executed";

const COLUMNS: BoardColumn<Status>[] = [
  { status: "Draft", label: "Draft", icon: FileEdit, accent: "text-muted-foreground" },
  { status: "Pending", label: "Pending", icon: Clock, accent: "text-amber-500" },
  { status: "Approved", label: "Approved", icon: CheckCircle2, accent: "text-emerald-500" },
  { status: "Rejected", label: "Rejected", icon: XCircle, accent: "text-red-500" },
  { status: "Executed", label: "Executed", icon: Zap, accent: "text-primary" },
];

export default function ChangeOrdersPage() {
  const { data: items = [], isLoading } = useChangeOrders();
  const { data: projects = [] } = useProjects();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const create = useCreateChangeOrder();
  const updateStatus = useUpdateChangeOrderStatus();
  const [open, setOpen] = useState(false);

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ChangeOrder | null>(null);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (projectFilter !== "all" && String(c.projectId) !== projectFilter) return false;
      return true;
    });
  }, [items, projectFilter]);

  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

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
    <Layout
      title="Change Orders"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-co">
          <Plus className="size-4" /> New Change Order
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Change Order"
        fields={fields}
        defaults={{ status: "Draft", amount: 0, scheduleImpact: 0 }}
        submitLabel="Create Change Order"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            number: String(v.number),
            title: String(v.title),
            status: String(v.status),
            amount: Number(v.amount),
            scheduleImpact: Number(v.scheduleImpact),
            dateIssued: String(v.dateIssued),
          })
        }
      />

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        count={filtered.length}
        total={items.length}
        view={view}
        onView={setView}
        countTestId="text-co-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : view === "board" ? (
        <GenericBoard<ChangeOrder, Status>
          items={filtered}
          columns={COLUMNS}
          getStatus={(c) => c.status}
          getId={(c) => c.id}
          mutate={(args) => updateStatus.mutate(args)}
          entityLabel="Change order"
          entityTitle={(c) => `${c.number} — ${c.title}`}
          idPrefix="co"
          columnClassName="md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
          onCardClick={(c) => setSelected(c)}
          renderCard={(c) => {
            const positive = c.amount >= 0;
            return (
              <>
                <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                  {c.number}
                </div>
                <h4 className="text-sm font-medium leading-snug">{c.title}</h4>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {projectName(c.projectId) ?? "—"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={
                      positive
                        ? "font-mono font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
                        : "font-mono font-medium tabular-nums text-red-600 dark:text-red-400"
                    }
                  >
                    {positive ? "+" : ""}
                    {formatCurrency(c.amount, { compact: true })}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.scheduleImpact > 0
                      ? `+${c.scheduleImpact}d`
                      : c.scheduleImpact < 0
                        ? `${c.scheduleImpact}d`
                        : "0d"}
                    <span className="mx-1.5 opacity-50">·</span>
                    {shortDate(c.dateIssued)}
                  </span>
                </div>
              </>
            );
          }}
        />
      ) : (
        <ChangeOrderTable items={filtered} projects={projectList} onRowClick={(c) => setSelected(c)} />
      )}

      {selected && (
        <ItemDetailSheet
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          eyebrow={selected.number}
          title={selected.title}
          subtitle={projectName(selected.projectId)}
          currentStatus={selected.status}
          statusOptions={["Draft", "Pending", "Approved", "Rejected", "Executed"]}
          onStatusChange={(s) => {
            updateStatus.mutate({ id: selected.id, status: s as Status });
            setSelected({ ...selected, status: s });
          }}
          isStatusPending={updateStatus.isPending}
          fields={[
            { label: "Amount", value: <span className={selected.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{selected.amount >= 0 ? "+" : ""}{formatCurrency(selected.amount)}</span>, mono: true },
            { label: "Schedule impact", value: `${selected.scheduleImpact > 0 ? "+" : ""}${selected.scheduleImpact} day${Math.abs(selected.scheduleImpact) === 1 ? "" : "s"}`, mono: true },
            { label: "Project", value: projectName(selected.projectId), full: true },
            { label: "Date issued", value: shortDate(selected.dateIssued), mono: true },
          ]}
        />
      )}
    </Layout>
  );
}
