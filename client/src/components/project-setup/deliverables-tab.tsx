import { useState } from "react";
import { Plus, Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeam } from "@/hooks/use-data";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  useCreateDeliverable, useUpdateDeliverable, useDeleteDeliverable, useUpdateProjectSetup,
} from "@/hooks/use-project-setup";
import {
  CRITICAL_DELIVERABLES, PROJECT_SETUP_DELIVERABLE_STATUSES,
  PROJECT_SETUP_DELIVERABLE_STATUS_LABELS,
} from "@shared/project-setup-catalog";
import type { ProjectSetup, ProjectSetupDeliverable } from "@shared/schema";
import { LABEL_CLASS, SaveStatusPill, SetupArea, SetupText, type SaveSetup } from "./fields";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  na: "bg-muted/60 text-muted-foreground line-through",
};

type SaveCell = (id: number, patch: Record<string, unknown>) => Promise<unknown>;

function LabelCell({ row, save }: { row: ProjectSetupDeliverable; save: SaveCell }) {
  const { value, setValue } = useDebouncedSave<string>(
    row.label,
    async (v) => { if (v.trim()) await save(row.id, { label: v.trim() }); },
  );
  const critical = CRITICAL_DELIVERABLES.includes(row.label);
  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8 min-w-[12rem]" />
      {critical && (
        <span className="whitespace-nowrap rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">
          Critical
        </span>
      )}
    </div>
  );
}

function DateCell({ row, field, save }: {
  row: ProjectSetupDeliverable; field: "dueDate" | "completedAt"; save: SaveCell;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    row[field] ?? "",
    async (v) => { await save(row.id, { [field]: v.trim() === "" ? null : v }); },
  );
  return (
    <Input
      type="date" value={value} onChange={(e) => setValue(e.target.value)}
      className="h-8 min-w-[8.5rem]"
      data-testid={`deliverable-${row.id}-${field}`}
    />
  );
}

function NotesCell({ row, save }: { row: ProjectSetupDeliverable; save: SaveCell }) {
  const { value, setValue } = useDebouncedSave<string>(
    row.notes ?? "",
    async (v) => { await save(row.id, { notes: v.trim() === "" ? null : v }); },
  );
  return <Textarea value={value} rows={2} onChange={(e) => setValue(e.target.value)} className="min-w-[12rem] text-sm" />;
}

function KickoffCard({ setup, save, pending }: {
  setup: ProjectSetup | null; save: SaveSetup; pending: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="setup-kickoff-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <CalendarClock className="size-4.5" />
        </div>
        <div>
          <p className="font-display text-sm font-bold">Kickoff meeting</p>
          <p className="text-xs text-muted-foreground">
            Scheduling and agenda before the meeting; decisions and actions after it. Both print in
            the Kickoff Agenda PDF.
          </p>
        </div>
        {pending && <span className="ml-auto text-xs text-muted-foreground">Saving…</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SetupText setup={setup} field="kickoffScheduledAt" label="Scheduled at" save={save} type="datetime-local" />
        <SetupText setup={setup} field="kickoffLocation" label="Location" save={save} placeholder="Site trailer / Teams link" />
      </div>
      <div className="mt-4 space-y-4">
        <SetupArea setup={setup} field="kickoffAgendaNotes" label="Agenda notes" save={save} rows={6} />
        <SetupArea setup={setup} field="kickoffAttendeesNarrative" label="Attendees" save={save} rows={4} />
        <SetupArea
          setup={setup} field="kickoffDecisions" label="Decisions" save={save} rows={6}
          hint="Captured after the meeting — filling this in turns the agenda PDF into minutes."
        />
        <SetupArea
          setup={setup} field="kickoffActionItems" label="Action items" save={save} rows={6}
          hint="Captured after the meeting."
        />
      </div>
    </div>
  );
}

function AddDeliverableRow({ nextSortOrder, create }: {
  nextSortOrder: number; create: ReturnType<typeof useCreateDeliverable>;
}) {
  const [label, setLabel] = useState("");
  const submit = () => {
    if (!label.trim()) return;
    create.mutate(
      { label: label.trim(), status: "pending", sortOrder: nextSortOrder },
      { onSuccess: () => setLabel("") },
    );
  };
  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <div className="flex-1">
        <Label className={LABEL_CLASS}>Add custom deliverable</Label>
        <Input
          value={label}
          placeholder="e.g. Owner-furnished equipment schedule received"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          data-testid="deliverable-add-input"
        />
      </div>
      <Button onClick={submit} disabled={!label.trim() || create.isPending} data-testid="deliverable-add-btn">
        <Plus className="size-4" /> {create.isPending ? "Adding…" : "Add"}
      </Button>
    </div>
  );
}

const HEADERS = ["Deliverable", "Status", "Due", "Owner", "Completed", "Notes", ""];

export function DeliverablesTab({ setup, deliverables, projectId }: {
  setup: ProjectSetup | null;
  deliverables: ProjectSetupDeliverable[];
  projectId: number | undefined;
}) {
  const { data: team = [] } = useTeam();
  const create = useCreateDeliverable(projectId);
  const update = useUpdateDeliverable(projectId);
  const remove = useDeleteDeliverable(projectId);
  const updateSetup = useUpdateProjectSetup(projectId);

  const save: SaveCell = (id, patch) => update.mutateAsync({ id, ...patch });
  const saveSetup: SaveSetup = (data) => updateSetup.mutateAsync(data);

  // Moving to "complete" stamps the date the same way the server-side event
  // hook reads it, so the row and the timeline entry agree.
  const setStatus = (row: ProjectSetupDeliverable, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "complete" && !row.completedAt) patch.completedAt = new Date().toISOString().slice(0, 10);
    if (status !== "complete") patch.completedAt = null;
    update.mutate({ id: row.id, ...patch });
  };

  return (
    <div className="space-y-4">
      <KickoffCard setup={setup} save={saveSetup} pending={updateSetup.isPending} />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Critical deliverables gate Mobilization while they are still pending.
        </p>
        <SaveStatusPill mutations={[create, update, remove, updateSetup]} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {HEADERS.map((h) => (
                  <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliverables.map((row) => (
                <tr key={row.id} className="border-b border-border align-top last:border-0">
                  <td className="px-2 py-2"><LabelCell row={row} save={save} /></td>
                  <td className="px-2 py-2">
                    <Select value={row.status} onValueChange={(v) => setStatus(row, v)}>
                      <SelectTrigger
                        className={cn("h-8 min-w-[9rem]", STATUS_STYLES[row.status])}
                        data-testid={`deliverable-${row.id}-status`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_SETUP_DELIVERABLE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{PROJECT_SETUP_DELIVERABLE_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2"><DateCell row={row} field="dueDate" save={save} /></td>
                  <td className="px-2 py-2">
                    <Select
                      value={row.ownerId ? String(row.ownerId) : "none"}
                      onValueChange={(v) => update.mutate({ id: row.id, ownerId: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger className="h-8 min-w-[9rem]" data-testid={`deliverable-${row.id}-owner`}>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {team.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2"><DateCell row={row} field="completedAt" save={save} /></td>
                  <td className="px-2 py-2"><NotesCell row={row} save={save} /></td>
                  <td className="px-2 py-2">
                    <Button
                      size="icon" variant="ghost"
                      className="size-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => remove.mutate(row.id)} aria-label={`Remove ${row.label}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddDeliverableRow nextSortOrder={deliverables.length} create={create} />
      </div>
    </div>
  );
}
