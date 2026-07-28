import { useState } from "react";
import { ChevronRight, ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/mobilization/bits";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import {
  useUpdatePlan, useCreateSignature, useUpdateSignature, useDeleteSignature,
  useSeedDefaultSignatures,
} from "@/hooks/use-mobilization";
import type { MobilizationPlan, MobilizationSignature } from "@shared/schema";

/** Only the free-text/number columns the Overview tab edits — narrowing here
 *  keeps a typo in a field name a compile error rather than a silent no-op. */
type PlanField = Extract<
  keyof MobilizationPlan,
  | "ownerRep" | "ownerRepPhone" | "ownerRepEmail"
  | "architect" | "architectFirm" | "architectPhone" | "architectEmail"
  | "engineerOfRecord" | "engineerFirm" | "engineerPhone" | "engineerEmail"
  | "jurisdiction" | "permitExpediter" | "permitExpediterPhone"
  | "projectType" | "squareFootage" | "stories" | "occupancyType" | "weatherStation"
  | "truckRoutes" | "deliveryHours" | "cranePicks" | "laydownAreas" | "gateSchedule"
  | "neighborCommsPlan" | "noiseOrdinanceHours"
  | "objectivesNarrative" | "scopeSummary" | "exclusions" | "assumptions" | "workNotIncluded"
  | "siteSpecificHazards" | "eapDetails" | "hospitalName" | "hospitalPhone" | "hospitalRoute"
  | "musterPoint" | "secondaryMusterPoint" | "spillResponsePlan" | "msdsLocation"
  | "environmentalNarrative"
  | "superintendentPhone" | "projectManagerPhone" | "safetyOfficerName" | "safetyOfficerPhone"
  | "emergencyContact24hName" | "emergencyContact24hPhone" | "onCallRotation"
  | "subcontractorForemen"
>;

type SavePlan = (data: Partial<MobilizationPlan>) => Promise<unknown>;

function planString(plan: MobilizationPlan | null, field: PlanField): string {
  const v = plan?.[field];
  return v == null ? "" : String(v);
}

function countFilled(plan: MobilizationPlan | null, fields: PlanField[]): number {
  return fields.filter((f) => planString(plan, f).trim() !== "").length;
}

const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase text-muted-foreground";

function PlanText({
  plan, field, label, save, type, placeholder,
}: {
  plan: MobilizationPlan | null;
  field: PlanField;
  label: string;
  save: SavePlan;
  type?: string;
  placeholder?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    planString(plan, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<MobilizationPlan>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`mob-plan-${field}`}
      />
    </div>
  );
}

function PlanNumber({
  plan, field, label, save,
}: {
  plan: MobilizationPlan | null; field: PlanField; label: string; save: SavePlan;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    planString(plan, field),
    async (v) => {
      const trimmed = v.trim();
      const n = trimmed === "" ? null : Number(trimmed);
      if (n !== null && !Number.isFinite(n)) return;
      await save({ [field]: n } as Partial<MobilizationPlan>);
    },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`mob-plan-${field}`}
      />
    </div>
  );
}

function PlanArea({
  plan, field, label, save, rows = 3, placeholder,
}: {
  plan: MobilizationPlan | null;
  field: PlanField;
  label: string;
  save: SavePlan;
  rows?: number;
  placeholder?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    planString(plan, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<MobilizationPlan>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`mob-plan-${field}`}
      />
    </div>
  );
}

function CollapsibleCard({
  title, hint, defaultOpen = false, testId, children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  testId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        data-testid={testId}
      >
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="flex-1 font-display text-sm font-bold">{title}</span>
        {hint && <span className="text-xs tabular-nums text-muted-foreground">{hint}</span>}
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

// --------------------------------------------------------------- signatures

/** Patches one column of one signature row. Owned by OverviewTab so every
 *  field shares a single mutation and the save pill sees all of them. */
type SaveSig = (id: number, patch: Record<string, unknown>) => Promise<unknown>;

function SigInput({
  sig, field, label, type, placeholder, save,
}: {
  sig: MobilizationSignature;
  field: "name" | "title" | "signedDate";
  label: string;
  type?: string;
  placeholder?: string;
  save: SaveSig;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    sig[field] ?? "",
    async (v) => { await save(sig.id, { [field]: v.trim() === "" ? null : v }); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}

function SigNotes({ sig, save }: { sig: MobilizationSignature; save: SaveSig }) {
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

function SignatureRow({
  sig, save, canMoveUp, canMoveDown, onMove, onDelete,
}: {
  sig: MobilizationSignature;
  save: SaveSig;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      <div className="w-40 shrink-0">
        <p className="text-sm font-bold leading-tight">{sig.role}</p>
        <div className="mt-1 flex gap-1">
          <Button
            size="icon" variant="ghost" className="size-6" disabled={!canMoveUp}
            onClick={() => onMove(-1)} aria-label={`Move ${sig.role} up`}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            size="icon" variant="ghost" className="size-6" disabled={!canMoveDown}
            onClick={() => onMove(1)} aria-label={`Move ${sig.role} down`}
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
        onClick={onDelete} aria-label={`Remove ${sig.role}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function SignaturesCard({
  signatures, save, create, update, remove, seedDefaults,
}: {
  signatures: MobilizationSignature[];
  save: SaveSig;
  create: ReturnType<typeof useCreateSignature>;
  update: ReturnType<typeof useUpdateSignature>;
  remove: ReturnType<typeof useDeleteSignature>;
  seedDefaults: ReturnType<typeof useSeedDefaultSignatures>;
}) {
  const [adding, setAdding] = useState(false);
  const [newRole, setNewRole] = useState("");

  // The list arrives ordered by (sortOrder, id); swapping the pair's sortOrder
  // is enough to move a row one position because the seed assigns 0..n-1 and
  // hand-added rows append at length.
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
        message="No signature block yet. This project was seeded before the sign-off block existed."
        action={
          <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
            {seedDefaults.isPending ? "Adding signers…" : "Seed default 9 signers"}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {signatures.map((sig, i) => (
        <SignatureRow
          key={sig.id}
          sig={sig}
          save={save}
          canMoveUp={i > 0}
          canMoveDown={i < signatures.length - 1}
          onMove={(dir) => move(i, dir)}
          onDelete={() => remove.mutate(sig.id)}
        />
      ))}

      {adding ? (
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
          <div className="flex-1">
            <Label className={LABEL_CLASS}>Role</Label>
            <Input
              autoFocus
              value={newRole}
              placeholder="e.g. Owner Representative"
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
        <Button variant="outline" size="sm" onClick={() => setAdding(true)} data-testid="mob-add-signer">
          <Plus className="size-4" /> Add signer
        </Button>
      )}
    </div>
  );
}

// -------------------------------------------------------------- save status

function SaveStatusPill({
  pending, failed, error,
}: {
  pending: boolean; failed: boolean; error: string | null;
}) {
  const { toast } = useToast();
  const label = failed ? "Save failed" : pending ? "Saving…" : "All changes saved";

  return (
    <button
      type="button"
      onClick={() => {
        if (failed) {
          toast({
            variant: "destructive",
            title: "Save failed",
            description: error ?? "The last change could not be saved.",
          });
        }
      }}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        failed ? "bg-red-100 text-red-700"
          : pending ? "bg-amber-100 text-amber-700"
          : "bg-muted text-muted-foreground",
        !failed && "cursor-default",
      )}
      data-testid="mob-save-status"
    >
      {label}
    </button>
  );
}

// -------------------------------------------------------------------- cards

const HEADER_FIELDS: PlanField[] = [
  "ownerRep", "ownerRepPhone", "ownerRepEmail",
  "architect", "architectFirm", "architectPhone", "architectEmail",
  "engineerOfRecord", "engineerFirm", "engineerPhone", "engineerEmail",
  "jurisdiction", "permitExpediter", "permitExpediterPhone",
  "projectType", "occupancyType", "weatherStation", "squareFootage", "stories",
];

const LOGISTICS_FIELDS: PlanField[] = [
  "truckRoutes", "deliveryHours", "cranePicks", "laydownAreas", "gateSchedule",
  "neighborCommsPlan", "noiseOrdinanceHours",
];

const OBJECTIVES_FIELDS: PlanField[] = [
  "objectivesNarrative", "scopeSummary", "exclusions", "assumptions", "workNotIncluded",
];

const SAFETY_FIELDS: PlanField[] = [
  "hospitalName", "hospitalPhone", "msdsLocation", "siteSpecificHazards", "eapDetails",
  "hospitalRoute", "musterPoint", "secondaryMusterPoint", "spillResponsePlan",
  "environmentalNarrative",
];

const STAFFING_FIELDS: PlanField[] = [
  "superintendentPhone", "projectManagerPhone", "safetyOfficerName", "safetyOfficerPhone",
  "emergencyContact24hName", "emergencyContact24hPhone", "onCallRotation", "subcontractorForemen",
];

export function OverviewTab({
  plan, signatures, projectId,
}: {
  plan: MobilizationPlan | null;
  signatures: MobilizationSignature[];
  projectId: number | undefined;
}) {
  const updatePlan = useUpdatePlan(projectId);
  const updateSig = useUpdateSignature(projectId);
  const createSig = useCreateSignature(projectId);
  const deleteSig = useDeleteSignature(projectId);
  const seedDefaults = useSeedDefaultSignatures(projectId);

  const save: SavePlan = (data) => updatePlan.mutateAsync(data);
  const saveSig: SaveSig = (id, patch) => updateSig.mutateAsync({ id, ...patch });

  const mutations = [updatePlan, updateSig, createSig, deleteSig, seedDefaults];
  const pending = mutations.some((m) => m.isPending);
  const failed = mutations.some((m) => m.isError);
  const error = mutations.find((m) => m.isError)?.error?.message ?? null;

  const hint = (fields: PlanField[]) => `${countFilled(plan, fields)}/${fields.length}`;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <SaveStatusPill pending={pending} failed={failed} error={error} />
      </div>

      <CollapsibleCard title="Project Header" hint={hint(HEADER_FIELDS)} defaultOpen testId="mob-card-header">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlanText plan={plan} field="ownerRep" label="Owner representative" save={save} />
          <PlanText plan={plan} field="ownerRepPhone" label="Owner rep phone" save={save} type="tel" />
          <PlanText plan={plan} field="ownerRepEmail" label="Owner rep email" save={save} type="email" />
          <PlanText plan={plan} field="architect" label="Architect" save={save} />
          <PlanText plan={plan} field="architectFirm" label="Architect firm" save={save} />
          <PlanText plan={plan} field="architectPhone" label="Architect phone" save={save} type="tel" />
          <PlanText plan={plan} field="architectEmail" label="Architect email" save={save} type="email" />
          <PlanText plan={plan} field="engineerOfRecord" label="Engineer of Record" save={save} />
          <PlanText plan={plan} field="engineerFirm" label="Engineer firm" save={save} />
          <PlanText plan={plan} field="engineerPhone" label="Engineer phone" save={save} type="tel" />
          <PlanText plan={plan} field="engineerEmail" label="Engineer email" save={save} type="email" />
          <PlanText plan={plan} field="jurisdiction" label="Jurisdiction" save={save} />
          <PlanText plan={plan} field="permitExpediter" label="Permit expediter" save={save} />
          <PlanText plan={plan} field="permitExpediterPhone" label="Permit expediter phone" save={save} type="tel" />
          <PlanText plan={plan} field="projectType" label="Project type" save={save} />
          <PlanText plan={plan} field="occupancyType" label="Occupancy type" save={save} />
          <PlanText plan={plan} field="weatherStation" label="Weather station" save={save} />
          <PlanNumber plan={plan} field="squareFootage" label="Square footage" save={save} />
          <PlanNumber plan={plan} field="stories" label="Stories" save={save} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Site Logistics" hint={hint(LOGISTICS_FIELDS)} testId="mob-card-logistics">
        <div className="space-y-4">
          <PlanArea plan={plan} field="truckRoutes" label="Truck routes" save={save} rows={4} />
          <PlanArea plan={plan} field="deliveryHours" label="Delivery hours" save={save} />
          <PlanArea plan={plan} field="cranePicks" label="Crane picks" save={save} rows={4} />
          <PlanArea plan={plan} field="laydownAreas" label="Laydown areas" save={save} rows={4} />
          <PlanArea plan={plan} field="gateSchedule" label="Gate schedule" save={save} />
          <PlanArea plan={plan} field="neighborCommsPlan" label="Neighbor communications plan" save={save} />
          <PlanArea plan={plan} field="noiseOrdinanceHours" label="Noise ordinance hours" save={save} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Objectives & Scope" hint={hint(OBJECTIVES_FIELDS)} testId="mob-card-objectives">
        <div className="space-y-4">
          <PlanArea plan={plan} field="objectivesNarrative" label="Mobilization objectives" save={save} rows={5} />
          <PlanArea plan={plan} field="scopeSummary" label="Scope summary" save={save} rows={5} />
          <PlanArea plan={plan} field="exclusions" label="Exclusions" save={save} />
          <PlanArea plan={plan} field="assumptions" label="Key assumptions" save={save} />
          <PlanArea plan={plan} field="workNotIncluded" label="Work not included" save={save} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Safety & Environmental" hint={hint(SAFETY_FIELDS)} testId="mob-card-safety">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanText plan={plan} field="hospitalName" label="Nearest hospital" save={save} />
            <PlanText plan={plan} field="hospitalPhone" label="Hospital phone" save={save} type="tel" />
            <PlanText plan={plan} field="msdsLocation" label="SDS / MSDS location" save={save} />
          </div>
          <PlanArea plan={plan} field="siteSpecificHazards" label="Site-specific hazards" save={save} rows={5} />
          <PlanArea plan={plan} field="eapDetails" label="Emergency action plan" save={save} rows={5} />
          <PlanArea plan={plan} field="hospitalRoute" label="Hospital route" save={save} rows={4} />
          <PlanArea plan={plan} field="musterPoint" label="Primary muster point" save={save} />
          <PlanArea plan={plan} field="secondaryMusterPoint" label="Secondary muster point" save={save} rows={2} />
          <PlanArea plan={plan} field="spillResponsePlan" label="Spill response plan" save={save} rows={4} />
          <PlanArea plan={plan} field="environmentalNarrative" label="Environmental narrative" save={save} rows={4} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Staffing & Emergency Contacts" hint={hint(STAFFING_FIELDS)} testId="mob-card-staffing">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PlanText plan={plan} field="superintendentPhone" label="Superintendent phone" save={save} type="tel" />
            <PlanText plan={plan} field="projectManagerPhone" label="Project manager phone" save={save} type="tel" />
            <PlanText plan={plan} field="safetyOfficerName" label="Safety officer" save={save} />
            <PlanText plan={plan} field="safetyOfficerPhone" label="Safety officer phone" save={save} type="tel" />
            <PlanText plan={plan} field="emergencyContact24hName" label="24-hour contact" save={save} />
            <PlanText plan={plan} field="emergencyContact24hPhone" label="24-hour contact phone" save={save} type="tel" />
          </div>
          <PlanArea plan={plan} field="onCallRotation" label="On-call rotation" save={save} />
          <PlanArea
            plan={plan} field="subcontractorForemen" label="Subcontractor foremen" save={save} rows={6}
            placeholder="One per line: Name — Trade — Phone"
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Signatures"
        hint={signatures.length ? `${signatures.length} signers` : undefined}
        testId="mob-card-signatures"
      >
        <SignaturesCard
          signatures={signatures}
          save={saveSig}
          create={createSig}
          update={updateSig}
          remove={deleteSig}
          seedDefaults={seedDefaults}
        />
      </CollapsibleCard>
    </div>
  );
}
