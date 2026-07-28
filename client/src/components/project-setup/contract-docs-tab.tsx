import { useState } from "react";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/mobilization/bits";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  useCreateContractDoc, useUpdateContractDoc, useDeleteContractDoc, useUpdateDeliverable,
} from "@/hooks/use-project-setup";
import { CONTRACT_DOC_KINDS } from "@shared/project-setup-catalog";
import type { ProjectSetupContractDoc, ProjectSetupDeliverable } from "@shared/schema";
import { CollapsibleCard, LABEL_CLASS, SaveStatusPill } from "./fields";

/** Three document kinds each satisfy a critical setup deliverable. Filing the
 *  document and ticking the deliverable are two different actions, so the tab
 *  offers the second one rather than doing it silently. */
const DOC_KIND_TO_DELIVERABLE: Record<string, string> = {
  insurance_cert: "Insurance Certs on File",
  bond: "Bond Recorded",
  permit: "Permits Received",
};

const KIND_LABELS: Record<string, string> =
  Object.fromEntries(CONTRACT_DOC_KINDS.map((k) => [k.value, k.label]));

type SaveCell = (id: number, patch: Record<string, unknown>) => Promise<unknown>;
type DocField = "label" | "revision" | "issuedDate" | "receivedDate" | "location";

function CellInput({ row, field, save, type }: {
  row: ProjectSetupContractDoc; field: DocField; save: SaveCell; type?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    row[field] ?? "",
    async (v) => {
      // label is NOT NULL — keep the last good value rather than 500.
      if (field === "label" && v.trim() === "") return;
      await save(row.id, { [field]: v.trim() === "" ? null : v });
    },
  );
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="h-8 min-w-[8rem]"
      data-testid={`contract-doc-${row.id}-${field}`}
    />
  );
}

function CellNotes({ row, save }: { row: ProjectSetupContractDoc; save: SaveCell }) {
  const { value, setValue } = useDebouncedSave<string>(
    row.notes ?? "",
    async (v) => { await save(row.id, { notes: v.trim() === "" ? null : v }); },
  );
  return <Textarea value={value} rows={2} onChange={(e) => setValue(e.target.value)} className="min-w-[12rem] text-sm" />;
}

function AddDocRow({ defaultKind, nextSortOrder, create }: {
  defaultKind: string;
  nextSortOrder: number;
  create: ReturnType<typeof useCreateContractDoc>;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [label, setLabel] = useState("");
  const [revision, setRevision] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    if (!label.trim()) return;
    create.mutate({
      kind,
      label: label.trim(),
      revision: revision.trim() || null,
      issuedDate: issuedDate || null,
      receivedDate: receivedDate || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      sortOrder: nextSortOrder,
    }, {
      onSuccess: () => {
        setLabel(""); setRevision(""); setIssuedDate(""); setReceivedDate("");
        setLocation(""); setNotes(""); setOpen(false);
      },
    });
  };

  if (!open) {
    return (
      <Button
        variant="outline" size="sm" onClick={() => { setKind(defaultKind); setOpen(true); }}
        data-testid={`contract-doc-add-${defaultKind}`}
      >
        <Plus className="size-4" /> Add document
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className={LABEL_CLASS}>Kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONTRACT_DOC_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className={LABEL_CLASS}>Label</Label>
          <Input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. AIA A102 — Executed" />
        </div>
        <div>
          <Label className={LABEL_CLASS}>Revision</Label>
          <Input value={revision} onChange={(e) => setRevision(e.target.value)} />
        </div>
        <div>
          <Label className={LABEL_CLASS}>Issued</Label>
          <Input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} />
        </div>
        <div>
          <Label className={LABEL_CLASS}>Received</Label>
          <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
        </div>
        <div className="sm:col-span-3">
          <Label className={LABEL_CLASS}>Location</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="URL, folder path, or physical location" />
        </div>
        <div className="sm:col-span-3">
          <Label className={LABEL_CLASS}>Notes</Label>
          <Textarea value={notes} rows={2} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={!label.trim() || create.isPending}>
          {create.isPending ? "Adding…" : "Add document"}
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

/** Shown inside a group once a document of that kind exists but the deliverable
 *  it satisfies is still open. */
function CompleteDeliverablePrompt({ deliverable, update }: {
  deliverable: ProjectSetupDeliverable;
  update: ReturnType<typeof useUpdateDeliverable>;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-emerald-500/10 px-3 py-2 ring-1 ring-emerald-500/25">
      <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="flex-1 text-xs">
        A document is on file, but the <strong>{deliverable.label}</strong> deliverable is still open.
      </span>
      <Button
        size="sm" variant="outline" disabled={update.isPending}
        onClick={() => update.mutate({
          id: deliverable.id,
          status: "complete",
          completedAt: new Date().toISOString().slice(0, 10),
        })}
        data-testid={`contract-doc-complete-${deliverable.id}`}
      >
        Complete this deliverable
      </Button>
    </div>
  );
}

const HEADERS = ["Label", "Revision", "Issued", "Received", "Location", "Notes", ""];

export function ContractDocsTab({ contractDocs, deliverables, projectId }: {
  contractDocs: ProjectSetupContractDoc[];
  deliverables: ProjectSetupDeliverable[];
  projectId: number | undefined;
}) {
  const create = useCreateContractDoc(projectId);
  const update = useUpdateContractDoc(projectId);
  const remove = useDeleteContractDoc(projectId);
  const updateDeliverable = useUpdateDeliverable(projectId);

  const save: SaveCell = (id, patch) => update.mutateAsync({ id, ...patch });

  const openDeliverableFor = (kind: string) => {
    const label = DOC_KIND_TO_DELIVERABLE[kind];
    if (!label) return undefined;
    return deliverables.find((d) => d.label === label && d.status !== "complete" && d.status !== "na");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Contract, exhibit, and permit register. Everything here prints in the Charter.
        </p>
        <SaveStatusPill mutations={[create, update, remove, updateDeliverable]} />
      </div>

      {contractDocs.length === 0 && (
        <EmptyState message="No contract documents registered yet. Add the executed contract and its exhibits to build the register." />
      )}

      {CONTRACT_DOC_KINDS.map((kindDef) => {
        const rows = contractDocs.filter((d) => d.kind === kindDef.value);
        const prompt = rows.length > 0 ? openDeliverableFor(kindDef.value) : undefined;
        return (
          <CollapsibleCard
            key={kindDef.value}
            title={kindDef.label}
            hint={rows.length ? `${rows.length}` : undefined}
            defaultOpen={rows.length > 0}
            testId={`setup-doc-group-${kindDef.value}`}
          >
            {prompt && <CompleteDeliverablePrompt deliverable={prompt} update={updateDeliverable} />}

            {rows.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      {HEADERS.map((h) => (
                        <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-border align-top last:border-0">
                        <td className="px-2 py-2"><CellInput row={row} field="label" save={save} /></td>
                        <td className="px-2 py-2"><CellInput row={row} field="revision" save={save} /></td>
                        <td className="px-2 py-2"><CellInput row={row} field="issuedDate" save={save} type="date" /></td>
                        <td className="px-2 py-2"><CellInput row={row} field="receivedDate" save={save} type="date" /></td>
                        <td className="px-2 py-2"><CellInput row={row} field="location" save={save} /></td>
                        <td className="px-2 py-2"><CellNotes row={row} save={save} /></td>
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
            )}

            <AddDocRow defaultKind={kindDef.value} nextSortOrder={contractDocs.length} create={create} />
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
