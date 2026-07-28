import { useState } from "react";
import { ShieldCheck, CircleSlash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateProjectSetup } from "@/hooks/use-project-setup";
import { CONTRACT_TYPES, DELIVERY_METHODS, BILLING_CYCLES } from "@shared/project-setup-catalog";
import type { ProjectSetup } from "@shared/schema";
import {
  CollapsibleCard, SaveStatusPill, SetupArea, SetupSelect, SetupText,
  countFilled, type SaveSetup, type SetupField,
} from "./fields";

const IDENTITY_FIELDS: SetupField[] = [
  "projectNumber", "contractNumber", "awardDate", "noticeToProceedDate",
  "substantialCompletionDate", "finalCompletionDate", "contractType", "deliveryMethod",
];
const FINANCIAL_FIELDS: SetupField[] = [
  "originalContractValue", "contingencyPercent", "retainagePercent", "paymentTerms", "billingCycle",
];
const INSURANCE_FIELDS: SetupField[] = [
  "insuranceCarrier", "insurancePolicyNumber", "bondCarrier", "bondPolicyNumber", "bondAmount",
];
const NARRATIVE_FIELDS: SetupField[] = [
  "projectDescription", "businessCase", "strategicGoals", "successCriteria",
];
const RISK_FIELDS: SetupField[] = ["keyRisks", "keyAssumptions", "keyConstraints"];
const STANDARDS_FIELDS: SetupField[] = [
  "communicationPlan", "changeControlProcess", "documentationStandards", "qualityStandards",
  "safetyStandards", "submittalWorkflow", "rfiWorkflow", "payAppWorkflow",
];
const CLOSEOUT_FIELDS: SetupField[] = ["closeoutRequirements", "warrantyRequirements"];

function CharterApprovalCard({ setup, save, pending }: {
  setup: ProjectSetup | null; save: SaveSetup; pending: boolean;
}) {
  const [confirming, setConfirming] = useState<"approve" | "unapprove" | null>(null);
  const approvedAt = setup?.charterApprovedAt ?? null;

  const commit = () => {
    if (confirming === "approve") void save({ charterApprovedAt: new Date().toISOString() });
    if (confirming === "unapprove") void save({ charterApprovedAt: null });
    setConfirming(null);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="setup-charter-approval">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ShieldCheck className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-bold">Charter approval</p>
          <p className="text-xs text-muted-foreground">
            {approvedAt
              ? `Approved ${new Date(approvedAt).toLocaleString()}`
              : "Not yet approved. Mobilization shows a warning banner until this is signed off."}
          </p>
        </div>
        {approvedAt ? (
          <Button
            variant="outline" size="sm" disabled={pending}
            onClick={() => setConfirming("unapprove")}
            data-testid="setup-unapprove-charter"
          >
            <CircleSlash className="size-4" /> Unapprove
          </Button>
        ) : (
          <Button
            size="sm" disabled={pending}
            onClick={() => setConfirming("approve")}
            data-testid="setup-approve-charter"
          >
            Approve charter
          </Button>
        )}
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => { if (!o) setConfirming(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "approve" ? "Approve the Project Charter?" : "Withdraw charter approval?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "approve"
                ? "This records a project_setup.charter_approved event on the project timeline and clears the soft-gate warning on the Mobilization page. It does not lock any fields — you can withdraw approval later."
                : "This clears the approval date. The soft-gate warning returns on the Mobilization page. The original approval event stays on the timeline."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={commit}>
              {confirming === "approve" ? "Approve" : "Withdraw approval"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OverviewTab({ setup, projectId }: {
  setup: ProjectSetup | null; projectId: number | undefined;
}) {
  const update = useUpdateProjectSetup(projectId);
  const save: SaveSetup = (data) => update.mutateAsync(data);
  const hint = (fields: SetupField[]) => `${countFilled(setup, fields)}/${fields.length}`;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[update]} />
      </div>

      <CollapsibleCard title="Project identity" hint={hint(IDENTITY_FIELDS)} defaultOpen testId="setup-card-identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <SetupText setup={setup} field="projectNumber" label="Project number" save={save} />
          <SetupText setup={setup} field="contractNumber" label="Contract number" save={save} />
          <SetupText setup={setup} field="awardDate" label="Award date" save={save} type="date" />
          <SetupText setup={setup} field="noticeToProceedDate" label="Notice to proceed" save={save} type="date" />
          <SetupText setup={setup} field="substantialCompletionDate" label="Substantial completion" save={save} type="date" />
          <SetupText setup={setup} field="finalCompletionDate" label="Final completion" save={save} type="date" />
          <SetupSelect setup={setup} field="contractType" label="Contract type" save={save} options={CONTRACT_TYPES} />
          <SetupSelect setup={setup} field="deliveryMethod" label="Delivery method" save={save} options={DELIVERY_METHODS} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Financial" hint={hint(FINANCIAL_FIELDS)} testId="setup-card-financial">
        <div className="grid gap-4 sm:grid-cols-2">
          <SetupText setup={setup} field="originalContractValue" label="Original contract value" save={save} placeholder="$0.00" />
          <SetupText setup={setup} field="contingencyPercent" label="Contingency %" save={save} placeholder="5" />
          <SetupText setup={setup} field="retainagePercent" label="Retainage %" save={save} placeholder="10" />
          <SetupSelect setup={setup} field="billingCycle" label="Billing cycle" save={save} options={BILLING_CYCLES} />
          <div className="sm:col-span-2">
            <SetupArea setup={setup} field="paymentTerms" label="Payment terms" save={save} rows={3} />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Insurance & bonding" hint={hint(INSURANCE_FIELDS)} testId="setup-card-insurance">
        <div className="grid gap-4 sm:grid-cols-2">
          <SetupText setup={setup} field="insuranceCarrier" label="Insurance carrier" save={save} />
          <SetupText setup={setup} field="insurancePolicyNumber" label="Insurance policy number" save={save} />
          <SetupText setup={setup} field="bondCarrier" label="Bond carrier" save={save} />
          <SetupText setup={setup} field="bondPolicyNumber" label="Bond policy number" save={save} />
          <SetupText setup={setup} field="bondAmount" label="Bond amount" save={save} placeholder="$0.00" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Project narratives" hint={hint(NARRATIVE_FIELDS)} testId="setup-card-narratives">
        <div className="space-y-4">
          <SetupArea setup={setup} field="projectDescription" label="Project description" save={save} rows={5} />
          <SetupArea setup={setup} field="businessCase" label="Business case" save={save} rows={5} />
          <SetupArea setup={setup} field="strategicGoals" label="Strategic goals" save={save} rows={4} />
          <SetupArea setup={setup} field="successCriteria" label="Success criteria" save={save} rows={4} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Risks, assumptions & constraints" hint={hint(RISK_FIELDS)} testId="setup-card-risks">
        <div className="space-y-4">
          <SetupArea setup={setup} field="keyRisks" label="Key risks" save={save} rows={5} />
          <SetupArea setup={setup} field="keyAssumptions" label="Key assumptions" save={save} rows={4} />
          <SetupArea setup={setup} field="keyConstraints" label="Key constraints" save={save} rows={4} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Standards & workflows" hint={hint(STANDARDS_FIELDS)} testId="setup-card-standards">
        <div className="space-y-4">
          <SetupArea setup={setup} field="communicationPlan" label="Communication plan" save={save} rows={5} />
          <SetupArea setup={setup} field="changeControlProcess" label="Change control process" save={save} rows={4} />
          <SetupArea setup={setup} field="documentationStandards" label="Documentation standards" save={save} rows={4} />
          <SetupArea setup={setup} field="qualityStandards" label="Quality standards" save={save} rows={4} />
          <SetupArea setup={setup} field="safetyStandards" label="Safety standards" save={save} rows={4} />
          <SetupArea setup={setup} field="submittalWorkflow" label="Submittal workflow" save={save} rows={4} />
          <SetupArea setup={setup} field="rfiWorkflow" label="RFI workflow" save={save} rows={4} />
          <SetupArea setup={setup} field="payAppWorkflow" label="Pay application workflow" save={save} rows={4} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Closeout & warranty" hint={hint(CLOSEOUT_FIELDS)} testId="setup-card-closeout">
        <div className="space-y-4">
          <SetupArea setup={setup} field="closeoutRequirements" label="Closeout requirements" save={save} rows={5} />
          <SetupArea setup={setup} field="warrantyRequirements" label="Warranty requirements" save={save} rows={4} />
        </div>
      </CollapsibleCard>

      <CharterApprovalCard setup={setup} save={save} pending={update.isPending} />
    </div>
  );
}
