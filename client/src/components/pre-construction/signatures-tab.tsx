import { useState } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/mobilization/bits";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  useCreatePreconSignature, useUpdatePreconSignature, useDeletePreconSignature,
  useSeedDefaultPreconSignatures,
} from "@/hooks/use-pre-construction";
import type { PreConstructionSignature } from "@shared/schema";
import { LABEL_CLASS, SaveStatusPill, type SaveRow } from "./fields";

function SigInput({ sig, field, label, type, placeholder, save }: {
  sig: PreConstructionSignature;
  field: "name" | "title" | "signedDate";
  label: string;
  type?: string;
  placeholder?: string;
  save: SaveRow;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    sig[field] ?? "",
    async (v) => { await save(sig.id, { [field]: v.trim() === "" ? null : v }); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type={type} value={value} placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`precon-sig-${sig.id}-${field}`}
      />
    </div>
  );
}

function SigNotes({ sig, save }: { sig: PreConstructionSignature; save: SaveRow }) {
  const { value, setValue } = useDebouncedSave<string>(
    sig.notes ?? "",
    async (v) => { await save(sig.id, { notes: v.trim() === "" ? null : v }); },
  );
  return (
    <div className="sm:col-span-2">
      <Label className={LABEL_CLASS}>Notes</Label>
      <Textarea value={value} rows={2} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}

export function SignaturesTab({ signatures, projectId }: {
  signatures: PreConstructionSignature[];
  projectId: number | undefined;
}) {
  const create = useCreatePreconSignature(projectId);
  const update = useUpdatePreconSignature(projectId);
  const remove = useDeletePreconSignature(projectId);
  const seedDefaults = useSeedDefaultPreconSignatures(projectId);

  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");

  const save: SaveRow = (id, patch) => update.mutateAsync({ id, ...patch });

  const move = (i: number, dir: -1 | 1) => {
    const a = signatures[i];
    const b = signatures[i + dir];
    if (!a || !b) return;
    update.mutate({ id: a.id, sortOrder: b.sortOrder });
    update.mutate({ id: b.id, sortOrder: a.sortOrder });
  };

  const addSigner = () => {
    const role = newRole.trim();
    if (!role) return;
    create.mutate({ role, sortOrder: signatures.length }, {
      onSuccess: () => { setNewRole(""); setAdding(false); },
    });
  };

  if (signatures.length === 0) {
    return (
      <EmptyState
        message="No sign-off block yet. Seed the default roles to start collecting approvals on the Pre-Construction Plan."
        action={
          <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending} data-testid="precon-seed-signers">
            {seedDefaults.isPending ? "Adding signers…" : "Seed default 8 signers"}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[create, update, remove, seedDefaults]} />
      </div>

      {signatures.map((sig, i) => (
        <div key={sig.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
          <div className="w-40 shrink-0">
            <p className="text-sm font-bold leading-tight">{sig.role}</p>
            <div className="mt-1 flex gap-1">
              <Button
                size="icon" variant="ghost" className="size-6" disabled={i === 0}
                onClick={() => move(i, -1)} aria-label={`Move ${sig.role} up`}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="size-6" disabled={i === signatures.length - 1}
                onClick={() => move(i, 1)} aria-label={`Move ${sig.role} down`}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <SigInput sig={sig} field="name" label="Name" save={save} />
            <SigInput sig={sig} field="title" label="Title" placeholder={sig.role} save={save} />
            <SigInput sig={sig} field="signedDate" label="Signed date" type="date" save={save} />
            <SigNotes sig={sig} save={save} />
          </div>

          <Button
            size="icon" variant="ghost"
            className="size-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => remove.mutate(sig.id)} aria-label={`Remove ${sig.role}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex-1">
            <Label className={LABEL_CLASS}>Role</Label>
            <Input
              autoFocus value={newRole} placeholder="e.g. Preconstruction Director"
              onChange={(e) => setNewRole(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addSigner(); }}
            />
          </div>
          <Button onClick={addSigner} disabled={!newRole.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add"}
          </Button>
          <Button variant="outline" onClick={() => { setAdding(false); setNewRole(""); }}>Cancel</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="precon-add-signer">
          <Plus className="size-4" /> Add signer
        </Button>
      )}
    </div>
  );
}
