import { useMemo, useState } from "react";
import { Plus, CheckSquare } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostPunchRows } from "@/components/ghost-state";
import { PunchList } from "@/components/tables";
import { PunchBoard } from "@/components/punch-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import {
  PUNCH_TRADES, PUNCH_PRIORITIES,
  itemsForTrade, tradeForItem,
} from "@/lib/punch-catalog";
import { ListToolbar, type View } from "@/components/list-toolbar";
import { usePunchItems, useTeamMap, useProjects, useTeam, useCreatePunchItem, useUpdatePunchStatus } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { ItemDetailSheet } from "@/components/item-detail-sheet";
import type { PunchItem } from "@shared/schema";

export default function PunchPage() {
  const { data: items = [], isLoading } = usePunchItems();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projectList = projects.map((p) => ({ id: p.id, name: p.name, address: p.address }));
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreatePunchItem();
  const updateStatus = useUpdatePunchStatus();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PunchItem | null>(null);
  const projectName = (id: number) => projectList.find((p) => p.id === id)?.name;
  const projectAddress = (id: number) => projectList.find((p) => p.id === id)?.address;

  const [view, setView] = useState<View>("board");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (projectFilter !== "all" && String(it.projectId) !== projectFilter) return false;
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "0" && it.assigneeId != null) return false;
        if (assigneeFilter !== "0" && String(it.assigneeId ?? "") !== assigneeFilter) return false;
      }
      return true;
    });
  }, [items, projectFilter, assigneeFilter]);

  // Combo boxes for Item + Trade: users can type freely OR pick from the
  // filtered dropdown. Item and Trade are linked \u2014 picking an item auto-
  // fills the trade tagged on that template, and picking a trade narrows the
  // item list to that discipline. See client/src/lib/punch-catalog.ts.
  const priorityOptions = PUNCH_PRIORITIES.map((v) => ({ value: v, label: v }));
  const tradeOptions = PUNCH_TRADES.map((v) => ({ value: v, label: v }));

  const baseFields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "priority", label: "Priority", type: "select", options: priorityOptions, required: true, half: true },
    { name: "title", label: "Item", type: "combo", required: true, placeholder: "Type or pick an item\u2026" },
    { name: "location", label: "Location", type: "text", required: true, half: true, placeholder: "Level 1, Rm 112" },
    { name: "trade", label: "Trade", type: "combo", options: tradeOptions, required: true, half: true, placeholder: "Type or pick a trade\u2026" },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
  ];

  // Item options are re-derived every render based on the current Trade
  // value. If the user hasn't picked a trade yet, or picked something we
  // don't recognize, we show every item.
  const fieldsForValues = (values: Record<string, string | number>): FieldDef[] => {
    const currentTrade = String(values.trade ?? "");
    const itemTemplates = itemsForTrade(currentTrade);
    const itemOptions = itemTemplates.map((t) => ({ value: t.label, label: t.label }));
    return baseFields.map((f) =>
      f.name === "title" ? { ...f, options: itemOptions } : f
    );
  };

  return (
    <Layout
      title="Punch List"
      actions={
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-punch">
          <Plus className="size-4" /> Add Item
        </Button>
      }
    >
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Punch Item"
        fields={baseFields}
        fieldsForValues={fieldsForValues}
        // When the user picks an item that has a known trade, auto-fill Trade
        // (only if Trade is empty, so we never stomp on an explicit choice).
        onFieldChange={(name, value, next) => {
          if (name === "title" && !String(next.trade ?? "").trim()) {
            const trade = tradeForItem(String(value));
            if (trade) return { trade };
          }
          return;
        }}
        defaults={{
          status: "Open", assigneeId: "0", priority: "Medium",
          title: "", trade: "",
        }}
        submitLabel="Create Item"
        isPending={create.isPending}
        onSubmit={(v) =>
          create.mutateAsync({
            projectId: Number(v.projectId),
            title: String(v.title).trim(),
            location: String(v.location),
            trade: String(v.trade).trim(),
            status: String(v.status),
            priority: String(v.priority || "Medium"),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
          })
        }
      />

      <ListToolbar
        projects={projectList}
        projectFilter={projectFilter}
        onProjectFilter={setProjectFilter}
        peopleLabel="assignees"
        peopleOptions={[{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))]}
        peopleFilter={assigneeFilter}
        onPeopleFilter={setAssigneeFilter}
        count={filtered.length}
        total={items.length}
        view={view}
        onView={setView}
        countTestId="text-punch-count"
      />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : filtered.length === 0 && items.length === 0 ? (
        <div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">Item</th><th className="px-4 py-2.5 font-medium">Location</th><th className="px-4 py-2.5 font-medium">Trade</th><th className="px-4 py-2.5 font-medium">Assignee</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <GhostPunchRows />
            </table>
          </div>
          <div className="mt-4">
            <GhostState
              title="No punch items yet"
              description="The sample rows above show what punch list items will look like. They appear here as your team identifies items needing correction."
              icon={CheckSquare}
            />
          </div>
        </div>
      ) : view === "board" ? (
        <PunchBoard items={filtered} team={team} projects={projectList} onCardClick={(i) => setSelected(i)} />
      ) : (
        <PunchList items={filtered} team={team} projects={projectList} onRowClick={(i) => setSelected(i)} />
      )}

      {selected && (() => {
        const a = selected.assigneeId ? team.get(selected.assigneeId) : undefined;
        return (
          <ItemDetailSheet
            open={!!selected}
            onOpenChange={(o) => !o && setSelected(null)}
            title={selected.title}
            subtitle={projectName(selected.projectId)}
            currentStatus={selected.status}
            statusOptions={["Open", "In Progress", "Complete"]}
            onStatusChange={(s) => {
              updateStatus.mutate({ id: selected.id, status: s });
              setSelected({ ...selected, status: s });
            }}
            isStatusPending={updateStatus.isPending}
            fields={[
              { label: "Location", value: selected.location, mapAddress: projectAddress(selected.projectId) },
              { label: "Trade", value: selected.trade },
              { label: "Assignee", value: a?.name ?? "Unassigned" },
              { label: "Project", value: projectName(selected.projectId) },
            ]}
          />
        );
      })()}
    </Layout>
  );
}
