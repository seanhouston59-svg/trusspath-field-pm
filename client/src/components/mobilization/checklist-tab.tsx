import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Avatar } from "@/components/bits";
import { ItemStatusPill, DateChip } from "@/components/mobilization/bits";
import {
  useUpdateItem, useUpdateSectionNote, type MobilizationSectionNoteRow,
} from "@/hooks/use-mobilization";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  MOBILIZATION_SECTIONS, MOBILIZATION_ITEM_STATUSES, MOBILIZATION_ITEM_STATUS_LABELS,
  SECTION_FEEDS_TRACKER, daysUntil,
} from "@shared/mobilization-catalog";
import type { MobilizationItem, TeamMember } from "@shared/schema";

/** Checkbox toggles between not_started and done; the sheet handles the two
 *  intermediate states. completedAt is stamped here so the server stays a
 *  dumb writer and the timestamp always matches the click. */
function nextStatus(current: string): "done" | "not_started" {
  return current === "done" ? "not_started" : "done";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

/** Free-text narrative for the whole section. Prints in the Mobilization Plan
 *  PDF under the section header, above the checklist. */
function SectionNarrative({
  section, note, projectId,
}: {
  section: string;
  note: MobilizationSectionNoteRow | undefined;
  projectId: number | undefined;
}) {
  const update = useUpdateSectionNote(projectId);
  const { value, setValue, saving } = useDebouncedSave<string>(
    note?.narrative ?? "",
    async (v) => { await update.mutateAsync({ section, narrative: v }); },
  );
  const stamp = relativeTime(note?.updatedAt);

  return (
    <div className="border-b border-border/60 px-4 pb-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Section narrative (prints in the plan)"
        rows={3}
        className="mt-2"
      />
      {(saving || stamp) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {saving ? "Saving…" : `Saved · ${stamp}`}
        </p>
      )}
    </div>
  );
}

function SectionCard({
  section, items, note, team, projectId, onOpen, onJumpToTab,
}: {
  section: string;
  items: MobilizationItem[];
  note: MobilizationSectionNoteRow | undefined;
  team: Map<number, TeamMember>;
  projectId: number | undefined;
  onOpen: (item: MobilizationItem) => void;
  onJumpToTab: (tab: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateItem(projectId);

  const countable = items.filter((i) => i.status !== "na");
  const done = countable.filter((i) => i.status === "done").length;
  const pctDone = countable.length === 0 ? 0 : Math.round((done / countable.length) * 100);
  const feedsTab = SECTION_FEEDS_TRACKER[section as keyof typeof SECTION_FEEDS_TRACKER];

  const toggle = (item: MobilizationItem) => {
    const status = nextStatus(item.status);
    update.mutate({
      id: item.id,
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        data-testid={`mob-section-${section.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="flex-1 font-display text-sm font-bold">{section}</span>
        <span className="text-xs tabular-nums text-muted-foreground">{done}/{countable.length}</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", pctDone >= 90 ? "bg-emerald-500" : pctDone >= 60 ? "bg-amber-500" : "bg-red-500")}
            style={{ width: `${pctDone}%` }}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border">
          {feedsTab && (
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
              <span className="text-xs text-muted-foreground">
                Detailed records for this section live in the dedicated tracker.
              </span>
              <Button size="sm" variant="outline" onClick={() => onJumpToTab(feedsTab)}>
                Open tracker <ExternalLink className="size-3.5" />
              </Button>
            </div>
          )}
          <SectionNarrative section={section} note={note} projectId={projectId} />
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No items in this section.</p>
          ) : items.map((item) => {
            const owner = item.ownerId ? team.get(item.ownerId) : undefined;
            const overdue = item.status !== "done" && item.status !== "na"
              && (daysUntil(item.targetDate) ?? 1) < 0;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0 hover:bg-muted/30"
              >
                <Checkbox
                  checked={item.status === "done"}
                  onCheckedChange={() => toggle(item)}
                  aria-label={`Mark ${item.title} complete`}
                />
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex-1 truncate text-left text-sm hover:underline"
                >
                  <span className={cn(item.status === "done" && "text-muted-foreground line-through", item.status === "na" && "text-muted-foreground")}>
                    {item.title}
                  </span>
                </button>
                {owner
                  ? <Avatar initials={owner.initials} color={owner.color} size={22} />
                  : <span className="size-[22px] shrink-0 rounded-full border border-dashed border-border" />}
                <DateChip date={item.targetDate} overdue={overdue} />
                <ItemStatusPill status={item.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ItemSheet({
  item, team, projectId, onClose,
}: {
  item: MobilizationItem | null; team: TeamMember[]; projectId: number | undefined; onClose: () => void;
}) {
  const update = useUpdateItem(projectId);
  const [status, setStatus] = useState(item?.status ?? "not_started");
  const [ownerId, setOwnerId] = useState(item?.ownerId ? String(item.ownerId) : "none");
  const [targetDate, setTargetDate] = useState(item?.targetDate ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");

  if (!item) return null;

  const save = () => {
    update.mutate({
      id: item.id,
      status,
      ownerId: ownerId === "none" ? null : Number(ownerId),
      targetDate: targetDate || null,
      notes: notes || null,
      completedAt: status === "done" ? (item.completedAt ?? new Date().toISOString()) : null,
    }, { onSuccess: onClose });
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="pr-6 text-left">{item.title}</SheetTitle>
          <p className="text-left text-xs text-muted-foreground">{item.section}</p>
        </SheetHeader>

        {item.description && (
          <p className="mt-3 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{item.description}</p>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOBILIZATION_ITEM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{MOBILIZATION_ITEM_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {team.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Target date</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ChecklistTab({
  items, sectionNotes, team, projectId, onJumpToTab,
}: {
  items: MobilizationItem[];
  sectionNotes: MobilizationSectionNoteRow[];
  team: TeamMember[];
  projectId: number | undefined;
  onJumpToTab: (tab: string) => void;
}) {
  const [openItem, setOpenItem] = useState<MobilizationItem | null>(null);
  const teamMap = new Map(team.map((m) => [m.id, m]));
  const noteBySection = new Map(sectionNotes.map((n) => [n.section, n]));

  // Sections render in catalog order; anything with an unrecognised section
  // (renamed catalog entry, hand-added row) is appended so it never vanishes.
  const known = new Set<string>(MOBILIZATION_SECTIONS);
  const extraSections = Array.from(new Set(items.map((i) => i.section))).filter((s) => !known.has(s));
  const ordered = [...MOBILIZATION_SECTIONS, ...extraSections];

  const bySection = new Map<string, MobilizationItem[]>();
  items.forEach((i) => {
    const list = bySection.get(i.section) ?? [];
    list.push(i);
    bySection.set(i.section, list);
  });
  bySection.forEach((list) => list.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id));

  return (
    <div className="space-y-2">
      {ordered.map((section) => (
        <SectionCard
          key={section}
          section={section}
          items={bySection.get(section) ?? []}
          note={noteBySection.get(section)}
          team={teamMap}
          projectId={projectId}
          onOpen={setOpenItem}
          onJumpToTab={onJumpToTab}
        />
      ))}
      {/* Remount on item change so the sheet's local state picks up the new row. */}
      {openItem && (
        <ItemSheet
          key={openItem.id}
          item={openItem}
          team={team}
          projectId={projectId}
          onClose={() => setOpenItem(null)}
        />
      )}
    </div>
  );
}
