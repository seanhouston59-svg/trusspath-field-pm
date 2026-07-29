import { useEffect, useMemo, useState } from "react";
import { Plus, FileEdit, Clock, CheckCircle2, XCircle, Zap, UserCheck } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { GhostState, GhostChangeOrderRows } from "@/components/ghost-state";
import { ChangeOrderTable } from "@/components/tables";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { PUNCH_TRADES } from "@/lib/punch-catalog";
import { titlesForTrade, tradeForCoTitle } from "@/lib/co-catalog";
import { GenericBoard, type BoardColumn } from "@/components/generic-board";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import { useHashParam } from "@/hooks/use-hash-param";
import {
  useChangeOrders,
  useProjects,
  useCreateChangeOrder,
  useUpdateChangeOrderStatus,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { formatCurrency, shortDate } from "@/lib/format";
import type { ChangeOrder } from "@shared/schema";

type Status = "sub_draft" | "Draft" | "Pending" | "Approved" | "Rejected" | "Executed";

const COLUMNS: BoardColumn<Status>[] = [
  { status: "sub_draft", label: "Sub draft", icon: UserCheck, accent: "text-amber-600" },
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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const acceptSubDraft = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/change-orders/${id}/accept-sub-draft`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-orders"] });
      toast({ title: "Change order accepted", description: "Now in the Pending column." });
    },
    onError: (err: any) => {
      toast({ title: "Could not accept change order", description: err?.message || "Try again.", variant: "destructive" });
    },
  });

  // Dashboard badges deep-link here as "/change-orders?project=<id>".
  const linkedProject = useHashParam("project");
  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>(linkedProject ?? "all");
  const [selected, setSelected] = useState<ChangeOrder | null>(null);

  useEffect(() => {
    if (linkedProject) setProjectFilter(linkedProject);
  }, [linkedProject]);

  const filtered = useMemo(() => {
    return items.filter((c) => {
      if (projectFilter !== "all" && String(c.projectId) !== projectFilter) return false;
      return true;
    });
  }, [items, projectFilter]);

  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;

  // Title + Trade are combo boxes sourced from a shared catalog. Picking a
  // title auto-fills Trade (when Trade is empty), and picking a Trade
  // narrows the Title list. Free-typing works on both.
  const tradeOptions = PUNCH_TRADES.map((v) => ({ value: v, label: v }));

  const baseFields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "number", label: "CO Number", type: "text", placeholder: "CO-001", required: true, half: true },
    { name: "title", label: "Title", type: "combo", required: true, placeholder: "Type or pick a change order title…" },
    { name: "trade", label: "Trade", type: "combo", options: tradeOptions, half: true, placeholder: "Type or pick a trade…" },
    { name: "status", label: "Status", type: "select", options: ["Draft", "Pending", "Approved", "Rejected", "Executed"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "amount", label: "Amount ($)", type: "number", required: true, half: true },
    { name: "scheduleImpact", label: "Schedule Impact (days)", type: "number", required: true, half: true },
    { name: "dateIssued", label: "Date Issued", type: "date", required: true, half: true },
  ];

  const fieldsForValues = (values: Record<string, string | number>): FieldDef[] => {
    const currentTrade = String(values.trade ?? "");
    const titleOptions = titlesForTrade(currentTrade).map((c) => ({ value: c.label, label: c.label }));
    return baseFields.map((f) =>
      f.name === "title" ? { ...f, options: titleOptions } : f
    );
  };

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
        fields={baseFields}
        fieldsForValues={fieldsForValues}
        // Picking a known title auto-fills Trade (only if Trade is empty).
        onFieldChange={(name, value, next) => {
          if (name === "title" && !String(next.trade ?? "").trim()) {
            const trade = tradeForCoTitle(String(value));
            if (trade) return { trade };
          }
          return;
        }}
        defaults={{ status: "Draft", amount: 0, scheduleImpact: 0, title: "", trade: "" }}
        submitLabel="Create Change Order"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            number: String(v.number),
            title: String(v.title),
            trade: String(v.trade || "").trim() || undefined,
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
      ) : filtered.length === 0 && items.length === 0 ? (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Title</th><th className="px-4 py-2.5 font-medium text-right">Amount</th><th className="px-4 py-2.5 font-medium text-right">Sched. Impact</th><th className="px-4 py-2.5 font-medium">Issued</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <GhostChangeOrderRows />
            </table>
          </div>
          <div className="mt-4">
            <GhostState
              title="No change orders yet"
              description="The sample rows above show what change orders will look like. They appear here once your team submits modifications to project scope."
              icon={FileEdit}
            />
          </div>
        </div>
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
          statusOptions={selected.status === "sub_draft" ? ["sub_draft", "Draft", "Pending", "Approved", "Rejected", "Executed"] : ["Draft", "Pending", "Approved", "Rejected", "Executed"]}
          onStatusChange={(s) => {
            updateStatus.mutate({ id: selected.id, status: s as Status });
            setSelected({ ...selected, status: s });
          }}
          isStatusPending={updateStatus.isPending}
          fields={[
            { label: "Amount", value: <span className={selected.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{selected.amount >= 0 ? "+" : ""}{formatCurrency(selected.amount)}</span>, mono: true },
            { label: "Schedule impact", value: `${selected.scheduleImpact > 0 ? "+" : ""}${selected.scheduleImpact} day${Math.abs(selected.scheduleImpact) === 1 ? "" : "s"}`, mono: true },
            { label: "Trade", value: selected.trade || "—" },
            { label: "Project", value: projectName(selected.projectId), full: true },
            { label: "Date issued", value: shortDate(selected.dateIssued), mono: true },
          ]}
          footer={selected.status === "sub_draft" ? (
            <div className="space-y-2">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-2 font-medium"><UserCheck className="size-4" /> Draft from sub</div>
                <p className="mt-1 text-xs">Review the amount + scope, then accept to promote this into the Pending queue.</p>
              </div>
              <Button
                className="w-full"
                disabled={acceptSubDraft.isPending}
                onClick={() => acceptSubDraft.mutateAsync(selected.id).then(() => { setSelected({ ...selected, status: "Pending" }); })}
                data-testid="button-accept-sub-draft-co"
              >
                {acceptSubDraft.isPending ? "Accepting\u2026" : "Accept draft"}
              </Button>
            </div>
          ) : undefined}
        />
      )}
    </Layout>
  );
}
