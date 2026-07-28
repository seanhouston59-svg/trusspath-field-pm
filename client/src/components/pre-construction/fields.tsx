import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import type { PreConstruction } from "@shared/schema";

// CollapsibleCard, SaveStatusPill and LABEL_CLASS are module-agnostic — the
// same reason project-setup imports EmptyState from mobilization/bits. Re-exported
// so a tab needs one import rather than two.
export { CollapsibleCard, SaveStatusPill, LABEL_CLASS } from "@/components/project-setup/fields";
import { LABEL_CLASS } from "@/components/project-setup/fields";

/* ------------------------------- main row -------------------------------- */

/** Text-valued columns the Overview tab edits. Narrowing here makes a typo in a
 *  field name a compile error rather than a silently dropped autosave. */
export type PreconField = Extract<
  keyof PreConstruction,
  | "status" | "designPhase"
  | "permitTargetDate" | "permitReceivedDate" | "buyoutTargetDate" | "buyoutCompleteDate"
  | "preconLeadName" | "preconLeadPhone" | "preconLeadEmail"
  | "estimatorName" | "estimatorPhone" | "estimatorEmail"
  | "designNarrative" | "designAssumptions" | "designExclusions" | "veStrategy"
  | "constructabilityFindings" | "constructabilitySummary" | "siteConditionsNotes"
  | "logisticsConsiderations"
  | "permitStrategy" | "jurisdictionalNarrative" | "openConditionsNarrative"
  | "prequalCriteria" | "bidStrategy" | "bidderOutreachNarrative"
  | "buyoutStrategy" | "longLeadStrategy" | "deliveryRiskNarrative"
  | "overallRisks" | "overallAssumptions" | "openIssues" | "nextSteps"
>;

/** Integer-valued columns. Split from PreconField because these must be sent as
 *  numbers — the insert schema rejects the raw string from an <input>.
 *  bidPackagesCount/bidPackagesBoughtOutCount are deliberately absent: they are
 *  deprecated, derived from bidPackages rows, and stripped by the PATCH route. */
export type PreconNumField = Extract<keyof PreConstruction, "designCompletionPercent">;

export type SavePrecon = (data: Partial<PreConstruction>) => Promise<unknown>;

export function preconString(preCon: PreConstruction | null, field: PreconField | PreconNumField): string {
  const v = preCon?.[field];
  return v == null ? "" : String(v);
}

export function countFilled(
  preCon: PreConstruction | null,
  fields: (PreconField | PreconNumField)[],
): number {
  return fields.filter((f) => preconString(preCon, f).trim() !== "").length;
}

type BaseProps = {
  preCon: PreConstruction | null;
  label: string;
  save: SavePrecon;
};

export function PreconText({ preCon, field, label, save, type, placeholder }: BaseProps & {
  field: PreconField; type?: string; placeholder?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    preconString(preCon, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<PreConstruction>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`precon-${field}`}
      />
    </div>
  );
}

export function PreconArea({ preCon, field, label, save, rows = 4, placeholder, hint }: BaseProps & {
  field: PreconField; rows?: number; placeholder?: string; hint?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    preconString(preCon, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<PreConstruction>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`precon-${field}`}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Clamped so a typo can't store 900% design completion. */
export function PreconNumber({ preCon, field, label, save, min = 0, max, hint }: BaseProps & {
  field: PreconNumField; min?: number; max?: number; hint?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    preconString(preCon, field),
    async (v) => {
      const t = v.trim();
      if (t === "") return void (await save({ [field]: null } as Partial<PreConstruction>));
      const n = Number(t);
      if (!Number.isFinite(n)) return;
      const clamped = Math.min(max ?? Infinity, Math.max(min, Math.round(n)));
      await save({ [field]: clamped } as Partial<PreConstruction>);
    },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`precon-${field}`}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Selects write through immediately — there is nothing to debounce about a
 *  single click, and waiting 800ms to persist a dropdown feels broken. */
export function PreconSelect({ preCon, field, label, save, options }: BaseProps & {
  field: PreconField; options: readonly { value: string; label: string }[];
}) {
  const current = preconString(preCon, field);
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Select
        value={current === "" ? "none" : current}
        onValueChange={(v) => { void save({ [field]: v === "none" ? null : v } as Partial<PreConstruction>); }}
      >
        <SelectTrigger data-testid={`precon-${field}`}>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">—</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------- child rows ------------------------------ */

export type SaveRow = (id: number, patch: Record<string, unknown>) => Promise<unknown>;

export type Col<Row> = {
  key: Extract<keyof Row, string>;
  label: string;
  type?: "text" | "date" | "number" | "textarea" | "select";
  options?: readonly { value: string; label: string }[];
  /** NOT NULL column — an empty value is never sent, so the last good value
   *  stays on screen instead of the write 500ing. */
  required?: boolean;
  /** Rendered after the header label, e.g. the critical-permit asterisk. */
  note?: ReactNode;
  className?: string;
};

function Cell<Row extends { id: number }>({ row, col, save, testId }: {
  row: Row; col: Col<Row>; save: SaveRow; testId: string;
}) {
  const raw = row[col.key] as unknown;
  const initial = raw == null ? "" : String(raw);

  const { value, setValue } = useDebouncedSave<string>(initial, async (v) => {
    const t = v.trim();
    if (col.required && t === "") return;
    if (col.type === "number") {
      if (t === "") return void (await save(row.id, { [col.key]: null }));
      const n = Number(t);
      if (!Number.isFinite(n)) return;
      await save(row.id, { [col.key]: Math.round(n) });
      return;
    }
    await save(row.id, { [col.key]: t === "" ? null : v });
  });

  if (col.type === "select") {
    return (
      <Select
        value={initial === "" ? "none" : initial}
        onValueChange={(v) => { void save(row.id, { [col.key]: v === "none" ? null : v }); }}
      >
        <SelectTrigger className={cn("h-8 min-w-[9rem]", col.className)} data-testid={testId}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {!col.required && <SelectItem value="none">—</SelectItem>}
          {(col.options ?? []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (col.type === "textarea") {
    return (
      <Textarea
        value={value}
        rows={2}
        onChange={(e) => setValue(e.target.value)}
        className={cn("min-w-[12rem] text-sm", col.className)}
        data-testid={testId}
      />
    );
  }

  return (
    <Input
      type={col.type === "date" ? "date" : col.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={cn("h-8", col.type === "date" ? "min-w-[8.5rem]" : "min-w-[8rem]", col.className)}
      data-testid={testId}
    />
  );
}

/**
 * Inline-autosave table over one child collection.
 *
 * Eight child tables with up to nineteen columns each would be eight
 * near-identical files, so each tab declares its columns and this renders the
 * grid. Every cell owns its own debounce, which is what lets a user tab across
 * a row without a save-per-keystroke storm.
 */
export function EditableTable<Row extends { id: number }>({
  rows, cols, save, remove, testId, rowLabel, rowClass, rowIcon,
}: {
  rows: Row[];
  cols: Col<Row>[];
  save: SaveRow;
  remove: (id: number) => void;
  testId: string;
  rowLabel: (row: Row) => string;
  /** Per-row styling — used to flag at-risk long-lead items. */
  rowClass?: (row: Row) => string | undefined;
  /** Leading status glyph, e.g. the delivered check on a long-lead row. */
  rowIcon?: (row: Row) => ReactNode;
}) {
  // One dialog for the whole table rather than one per row — the id in state is
  // what the confirm acts on.
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  if (rows.length === 0) return null;
  return (
    <>
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {rowIcon && <th className="w-8 px-2 py-2" />}
            {cols.map((c) => (
              <th key={c.key} className="whitespace-nowrap px-2 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">
                {c.label}{c.note}
              </th>
            ))}
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn("border-b border-border align-top last:border-0", rowClass?.(row))}
              data-testid={`${testId}-row-${row.id}`}
            >
              {rowIcon && <td className="px-2 py-3 align-middle">{rowIcon(row)}</td>}
              {cols.map((c) => (
                <td key={c.key} className="px-2 py-2">
                  <Cell row={row} col={c} save={save} testId={`${testId}-${row.id}-${c.key}`} />
                </td>
              ))}
              <td className="px-2 py-2">
                <Button
                  size="icon" variant="ghost"
                  className="size-7 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setPendingDelete(row.id)}
                  aria-label={`Remove ${rowLabel(row)}`}
                  data-testid={`${testId}-${row.id}-delete`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this row?</AlertDialogTitle>
          <AlertDialogDescription>Delete this row? This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingDelete !== null) remove(pendingDelete);
              setPendingDelete(null);
            }}
            data-testid={`${testId}-delete-confirm`}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

/** Add-row control for a table whose only required column is a single label.
 *  Everything else is filled in inline afterwards. */
export function QuickAdd({ label, placeholder, pending, onAdd, testId }: {
  label: string;
  placeholder: string;
  pending: boolean;
  onAdd: (value: string) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} data-testid={testId}>
        <Plus className="size-4" /> {label}
      </Button>
    );
  }

  return (
    <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
      <div className="flex-1">
        <Label className={LABEL_CLASS}>{placeholder}</Label>
        <Input
          autoFocus value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          data-testid={`${testId}-input`}
        />
      </div>
      <Button onClick={submit} disabled={!text.trim() || pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <Button variant="outline" onClick={() => { setOpen(false); setText(""); }}>Cancel</Button>
    </div>
  );
}

/** One button per catalog value — creates a row with that value pre-set so the
 *  common case (add a Building permit) is a single click. */
export function QuickAddStrip({ title, options, pending, onAdd, critical, testId }: {
  title: string;
  options: readonly { value: string; label: string }[];
  pending: boolean;
  onAdd: (value: string) => void;
  critical?: readonly string[];
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button
            key={o.value} variant="outline" size="sm" disabled={pending}
            onClick={() => onAdd(o.value)}
            data-testid={`${testId}-${o.value}`}
          >
            <Plus className="size-3.5" /> {o.label}
            {critical?.includes(o.value) && <span className="text-red-500">*</span>}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Section heading for tabs that stack more than one table. */
export function SectionHeader({ title, blurb, right }: {
  title: string; blurb?: string; right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-display text-sm font-bold">{title}</h3>
        {blurb && <p className="text-xs text-muted-foreground">{blurb}</p>}
      </div>
      {right}
    </div>
  );
}
