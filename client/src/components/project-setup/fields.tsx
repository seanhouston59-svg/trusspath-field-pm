import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedSave } from "@/lib/use-debounced-save";
import type { ProjectSetup } from "@shared/schema";

export const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase text-muted-foreground";

/** Every column the intake form edits. Narrowing here makes a typo in a field
 *  name a compile error rather than a silently dropped autosave. */
export type SetupField = Extract<
  keyof ProjectSetup,
  | "projectNumber" | "contractNumber" | "awardDate" | "noticeToProceedDate"
  | "substantialCompletionDate" | "finalCompletionDate" | "contractType" | "deliveryMethod"
  | "originalContractValue" | "contingencyPercent" | "retainagePercent" | "paymentTerms"
  | "billingCycle"
  | "insuranceCarrier" | "insurancePolicyNumber" | "bondCarrier" | "bondPolicyNumber" | "bondAmount"
  | "projectDescription" | "businessCase" | "strategicGoals" | "successCriteria"
  | "keyRisks" | "keyAssumptions" | "keyConstraints"
  | "communicationPlan" | "changeControlProcess" | "documentationStandards"
  | "qualityStandards" | "safetyStandards" | "submittalWorkflow" | "rfiWorkflow" | "payAppWorkflow"
  | "closeoutRequirements" | "warrantyRequirements"
  | "kickoffScheduledAt" | "kickoffLocation" | "kickoffAgendaNotes"
  | "kickoffAttendeesNarrative" | "kickoffDecisions" | "kickoffActionItems"
  | "status"
>;

export type SaveSetup = (data: Partial<ProjectSetup>) => Promise<unknown>;

export function setupString(setup: ProjectSetup | null, field: SetupField): string {
  const v = setup?.[field];
  return v == null ? "" : String(v);
}

export function countFilled(setup: ProjectSetup | null, fields: SetupField[]): number {
  return fields.filter((f) => setupString(setup, f).trim() !== "").length;
}

type BaseProps = {
  setup: ProjectSetup | null;
  field: SetupField;
  label: string;
  save: SaveSetup;
};

export function SetupText({ setup, field, label, save, type, placeholder }: BaseProps & {
  type?: string; placeholder?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    setupString(setup, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<ProjectSetup>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`setup-${field}`}
      />
    </div>
  );
}

export function SetupArea({ setup, field, label, save, rows = 4, placeholder, hint }: BaseProps & {
  rows?: number; placeholder?: string; hint?: string;
}) {
  const { value, setValue } = useDebouncedSave<string>(
    setupString(setup, field),
    async (v) => { await save({ [field]: v.trim() === "" ? null : v } as Partial<ProjectSetup>); },
  );
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        data-testid={`setup-${field}`}
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Selects write through immediately — there is nothing to debounce about a
 *  single click, and waiting 800ms to persist a dropdown feels broken. */
export function SetupSelect({ setup, field, label, save, options }: BaseProps & {
  options: readonly { value: string; label: string }[];
}) {
  const current = setupString(setup, field);
  return (
    <div>
      <Label className={LABEL_CLASS}>{label}</Label>
      <Select
        value={current === "" ? "none" : current}
        onValueChange={(v) => { void save({ [field]: v === "none" ? null : v } as Partial<ProjectSetup>); }}
      >
        <SelectTrigger data-testid={`setup-${field}`}>
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

export function CollapsibleCard({ title, hint, defaultOpen = false, testId, children }: {
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

/** Watches every mutation on the tab, not just one — a pill wired to a single
 *  mutation goes blind the moment a second one starts failing. */
export function SaveStatusPill({ mutations }: {
  mutations: { isPending: boolean; isError: boolean; error: unknown }[];
}) {
  const { toast } = useToast();
  const pending = mutations.some((m) => m.isPending);
  const failed = mutations.some((m) => m.isError);
  const error = mutations.find((m) => m.isError)?.error;
  const message = error instanceof Error ? error.message : null;
  const label = failed ? "Save failed" : pending ? "Saving…" : "All changes saved";

  return (
    <button
      type="button"
      onClick={() => {
        if (failed) {
          toast({
            variant: "destructive",
            title: "Save failed",
            description: message ?? "The last change could not be saved.",
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
      data-testid="setup-save-status"
    >
      {label}
    </button>
  );
}
