import { useMemo, useState } from "react";
import { Plus, CheckSquare } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostPunchRows } from "@/components/ghost-state";
import { PunchList } from "@/components/tables";
import { PunchBoard } from "@/components/punch-board";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import {
  PUNCH_ITEM_TEMPLATES, PUNCH_TRADES, PUNCH_PRIORITIES, PUNCH_OTHER,
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

  // Item + trade are drop-downs sourced from a shared catalog. Picking
  // "Other…" reveals a plain text input right below so users can still enter
  // anything unusual without being boxed in by the preset list.
  const itemOptions = [
    ...PUNCH_ITEM_TEMPLATES.map((v) => ({ value: v, label: v })),
    { value: PUNCH_OTHER, label: "Other… (type in)" },
  ];
  const tradeOptions = [
    ...PUNCH_TRADES.map((v) => ({ value: v, label: v })),
    { value: PUNCH_OTHER, label: "Other… (type in)" },
  ];
  const priorityOptions = PUNCH_PRIORITIES.map((v) => ({ value: v, label: v }));

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "priority", label: "Priority", type: "select", options: priorityOptions, required: true, half: true },
    { name: "titleChoice", label: "Item", type: "select", options: itemOptions, required: true, placeholder: "Pick a common item…" },
    { name: "titleCustom", label: "Item (custom)", type: "text", placeholder: "Describe the item…" },
    { name: "location", label: "Location", type: "text", required: true, half: true, placeholder: "Level 1, Rm 112" },
    { name: "tradeChoice", label: "Trade", type: "select", options: tradeOptions, required: true, half: true },
    { name: "tradeCustom", label: "Trade (custom)", type: "text", half: true, placeholder: "Specify trade…" },
    { name: "status", label: "Status", type: "select", options: ["Open", "In Progress", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "assigneeId", label: "Assignee", type: "select", options: teamOptions, half: true },
  ];

  // Hide the custom text fields unless the user picked "Other…" for that
  // dropdown. Keeps the form compact for the 95% case while preserving the
  // escape hatch.
  const visibleFields = (values: Record<string, string | number>): FieldDef[] =>
    fields.filter((f) => {
      if (f.name === "titleCustom") return values.titleChoice === PUNCH_OTHER;
      if (f.name === "tradeCustom") return values.tradeChoice === PUNCH_OTHER;
      return true;
    });

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
        fields={fields}
        fieldsForValues={visibleFields}
        defaults={{
          status: "Open", assigneeId: "0", priority: "Medium",
          titleChoice: "", titleCustom: "", tradeChoice: "", tradeCustom: "",
        }}
        submitLabel="Create Item"
        isPending={create.isPending}
        onSubmit={(v) => {
          // Fold the dropdown + "Other…" custom text into the single string
          // the API expects. If the user picked "Other…" but typed nothing,
          // fall back to the label so we never send an empty title/trade.
          const title = v.titleChoice === PUNCH_OTHER
            ? String(v.titleCustom || "").trim() || "Other"
            : String(v.titleChoice || "").trim();
          const trade = v.tradeChoice === PUNCH_OTHER
            ? String(v.tradeCustom || "").trim() || "Other"
            : String(v.tradeChoice || "").trim();
          return create.mutateAsync({
            projectId: Number(v.projectId),
            title,
            location: String(v.location),
            trade,
            status: String(v.status),
            priority: String(v.priority || "Medium"),
            assigneeId: v.assigneeId === "0" ? undefined : Number(v.assigneeId),
          });
        }}
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
