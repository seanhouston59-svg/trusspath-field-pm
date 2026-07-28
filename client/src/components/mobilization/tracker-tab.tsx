import { useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/mobilization/bits";
import {
  useCreateMobilizationRow, useUpdateMobilizationRow, useDeleteMobilizationRow,
} from "@/hooks/use-mobilization";

/**
 * Field-spec driven table + create/edit dialog.
 *
 * Permits, Equipment, Utilities, Staff, Subs, and Risks are the same shape —
 * a flat list of rows with a handful of typed fields. Rather than six
 * near-identical files, each tab declares its fields and this renders the
 * table, the "Add" dialog, and the edit dialog against the generic
 * /api/projects/:id/mobilization/<resource> endpoints.
 */

export type TrackerFieldType = "text" | "textarea" | "date" | "bool" | "select";

export type TrackerField<Row> = {
  key: string;
  label: string;
  type: TrackerFieldType;
  /** Plain string options for a select whose value is its own label. */
  options?: readonly string[];
  /** Value/label pairs — used for foreign keys (team member pickers). */
  choices?: { value: string; label: string }[];
  /** Send as a number instead of a string. Required for integer FK columns,
   *  which the insert schema rejects when given the raw "5" from a <Select>. */
  numeric?: boolean;
  required?: boolean;
  /** Omit from the table but keep in the edit dialog (e.g. long notes). */
  hideInTable?: boolean;
  /** Custom cell renderer — falls back to the raw value. */
  cell?: (row: Row) => ReactNode;
};

type Resource = "items" | "permits" | "equipment" | "utilities" | "staff" | "subs" | "risks";

type FormState = Record<string, string | boolean>;

function blankForm<Row>(fields: TrackerField<Row>[]): FormState {
  const out: FormState = {};
  fields.forEach((f) => { out[f.key] = f.type === "bool" ? false : ""; });
  return out;
}

function rowToForm<Row extends Record<string, any>>(fields: TrackerField<Row>[], row: Row): FormState {
  const out: FormState = {};
  fields.forEach((f) => {
    const v = row[f.key];
    out[f.key] = f.type === "bool" ? !!v : (v ?? "");
  });
  return out;
}

/** Empty strings become null so an untouched optional date stays NULL in the DB
 *  rather than being stored as "". */
function formToPayload<Row>(fields: TrackerField<Row>[], form: FormState) {
  const out: Record<string, unknown> = {};
  fields.forEach((f) => {
    const v = form[f.key];
    if (f.type === "bool") out[f.key] = !!v;
    else if (v === "" || v === "none") out[f.key] = null;
    else out[f.key] = f.numeric ? Number(v) : v;
  });
  return out;
}

function FieldInput<Row>({ field, value, onChange }: {
  field: TrackerField<Row>; value: string | boolean; onChange: (v: string | boolean) => void;
}) {
  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 py-1">
        <Checkbox checked={!!value} onCheckedChange={(c) => onChange(c === true)} />
        <span className="text-sm">{field.label}</span>
      </label>
    );
  }
  if (field.type === "select") {
    const choices = field.choices ?? (field.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <Select value={String(value || "")} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {!field.required && <SelectItem value="none">Unassigned</SelectItem>}
          {choices.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "textarea") {
    return <Textarea value={String(value || "")} onChange={(e) => onChange(e.target.value)} rows={3} />;
  }
  return (
    <Input
      type={field.type === "date" ? "date" : "text"}
      value={String(value || "")}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function RowDialog<Row>({
  open, onOpenChange, title, fields, form, setForm, onSubmit, submitting,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string;
  fields: TrackerField<Row>[]; form: FormState;
  setForm: (f: FormState) => void; onSubmit: () => void; submitting: boolean;
}) {
  const missingRequired = fields.some((f) => f.required && !String(form[f.key] ?? "").trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              {f.type !== "bool" && (
                <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </Label>
              )}
              <FieldInput
                field={f}
                value={form[f.key]}
                onChange={(v) => setForm({ ...form, [f.key]: v })}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={submitting || missingRequired}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TrackerTab<Row extends { id: number } & Record<string, any>>({
  projectId, resource, rows, fields, addLabel, emptyMessage, canEdit = true,
}: {
  projectId: number | undefined;
  resource: Resource;
  rows: Row[];
  fields: TrackerField<Row>[];
  addLabel: string;
  emptyMessage: string;
  canEdit?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(fields));

  const create = useCreateMobilizationRow<Row>(projectId, resource);
  const update = useUpdateMobilizationRow<Row>(projectId, resource);
  const remove = useDeleteMobilizationRow(projectId, resource);

  const tableFields = fields.filter((f) => !f.hideInTable);

  const openAdd = () => { setForm(blankForm(fields)); setAdding(true); };
  const openEdit = (row: Row) => { setForm(rowToForm(fields, row)); setEditing(row); };

  const submitAdd = () => {
    create.mutate(formToPayload(fields, form), { onSuccess: () => setAdding(false) });
  };
  const submitEdit = () => {
    if (!editing) return;
    update.mutate({ id: editing.id, ...formToPayload(fields, form) }, { onSuccess: () => setEditing(null) });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "row" : "rows"}</p>
        {canEdit && (
          <Button size="sm" onClick={openAdd} data-testid={`mob-add-${resource}`}>
            <Plus className="size-4" /> {addLabel}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={emptyMessage}
          action={canEdit ? <Button size="sm" onClick={openAdd}><Plus className="size-4" /> {addLabel}</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {tableFields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                {canEdit && <TableHead className="w-[90px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`mob-${resource}-row-${row.id}`}>
                  {tableFields.map((f) => (
                    <TableCell key={f.key} className="align-top text-sm">
                      {f.cell
                        ? f.cell(row)
                        : f.type === "bool"
                          ? (row[f.key] ? "Yes" : "No")
                          : (row[f.key] || <span className="text-muted-foreground">—</span>)}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" aria-label="Delete"
                        onClick={() => remove.mutate(row.id)}
                      >
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <RowDialog
        open={adding} onOpenChange={setAdding} title={addLabel}
        fields={fields} form={form} setForm={setForm}
        onSubmit={submitAdd} submitting={create.isPending}
      />
      <RowDialog
        open={!!editing} onOpenChange={(v) => !v && setEditing(null)} title="Edit"
        fields={fields} form={form} setForm={setForm}
        onSubmit={submitEdit} submitting={update.isPending}
      />
    </div>
  );
}
