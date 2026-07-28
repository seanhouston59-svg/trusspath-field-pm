import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PRE_CONSTRUCTION_STATUSES, DESIGN_PHASES } from "@shared/pre-construction-catalog";
import { Label } from "@/components/ui/label";
import type { PreConstruction, PreConstructionBidPackage } from "@shared/schema";
import { useUpdatePreConstruction } from "@/hooks/use-pre-construction";
import {
  CollapsibleCard, SaveStatusPill, LABEL_CLASS, PreconText, PreconArea, PreconNumber, PreconSelect,
  countFilled, type PreconField, type PreconNumField, type SavePrecon,
} from "./fields";

/** Field groups double as the card contents and the "n of m" counter in each
 *  header, so a lead can see which sections are still blank without opening them. */
const TEAM: PreconField[] = [
  "preconLeadName", "preconLeadPhone", "preconLeadEmail",
  "estimatorName", "estimatorPhone", "estimatorEmail",
];
const DESIGN: (PreconField | PreconNumField)[] = [
  "designPhase", "designCompletionPercent", "designNarrative", "designAssumptions",
  "designExclusions", "veStrategy",
];
const CONSTRUCTABILITY: PreconField[] = [
  "constructabilityFindings", "constructabilitySummary", "siteConditionsNotes",
  "logisticsConsiderations",
];
const PERMITTING: PreconField[] = [
  "permitTargetDate", "permitReceivedDate", "permitStrategy", "jurisdictionalNarrative",
  "openConditionsNarrative",
];
const BIDDING: PreconField[] = ["bidStrategy", "prequalCriteria", "bidderOutreachNarrative"];
const BUYOUT: PreconField[] = [
  "buyoutTargetDate", "buyoutCompleteDate", "buyoutStrategy", "longLeadStrategy",
  "deliveryRiskNarrative",
];
const RISKS: PreconField[] = ["overallRisks", "overallAssumptions", "openIssues", "nextSteps"];

function count(preCon: PreConstruction | null, fields: (PreconField | PreconNumField)[]) {
  return `${countFilled(preCon, fields)} of ${fields.length}`;
}

/**
 * Approving stamps preconPlanApprovedAt, which emits PRECON_PLAN_APPROVED and
 * clears the soft-gate warning on Mobilization — so both directions are behind a
 * confirmation rather than a single stray click.
 */
function PlanApprovalCard({ preCon, save }: { preCon: PreConstruction | null; save: SavePrecon }) {
  const [confirming, setConfirming] = useState<"approve" | "unapprove" | null>(null);
  const approvedAt = preCon?.preconPlanApprovedAt ?? null;

  const commit = () => {
    const value = confirming === "approve" ? new Date().toISOString() : null;
    void save({ preconPlanApprovedAt: value } as Partial<PreConstruction>);
    setConfirming(null);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="precon-plan-approval">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={approvedAt ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
            {approvedAt ? <CheckCircle2 className="size-6" /> : <ShieldCheck className="size-6" />}
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">Pre-Construction Plan approval</h3>
            <p className="text-xs text-muted-foreground">
              {approvedAt
                ? `Approved ${new Date(approvedAt).toLocaleString()}`
                : "Not yet approved. Mobilization shows a soft-gate warning until the plan is approved."}
            </p>
          </div>
        </div>
        {approvedAt ? (
          <Button variant="outline" size="sm" onClick={() => setConfirming("unapprove")} data-testid="precon-unapprove-btn">
            Unapprove
          </Button>
        ) : (
          <Button size="sm" onClick={() => setConfirming("approve")} data-testid="precon-approve-btn">
            Approve Pre-Construction Plan
          </Button>
        )}
      </div>

      <AlertDialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === "approve" ? "Approve Pre-Construction Plan?" : "Withdraw approval?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === "approve"
                ? "This records the approval timestamp, fires a PRECON_PLAN_APPROVED event, and clears the Pre-Construction soft-gate warning on Mobilization."
                : "This clears the approval timestamp. The Pre-Construction soft-gate warning will reappear on Mobilization."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={commit} data-testid="precon-approval-confirm">
              {confirming === "approve" ? "Approve" : "Unapprove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function OverviewTab({ preCon, bidPackages, projectId }: {
  preCon: PreConstruction | null;
  /** Buyout progress is derived from these rows, not from the deprecated
   *  bidPackagesCount columns, which nothing maintains. */
  bidPackages: PreConstructionBidPackage[];
  projectId: number | undefined;
}) {
  const boughtOut = bidPackages.filter(
    (b) => b.status === "awarded" || b.status === "contract_executed",
  ).length;
  const update = useUpdatePreConstruction(projectId);
  const save: SavePrecon = (data) => update.mutateAsync(data);
  const p = { preCon, save };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[update]} />
      </div>

      <CollapsibleCard title="Plan status" hint={preCon?.status ?? "in_progress"} defaultOpen testId="precon-card-status">
        <div className="grid gap-4 sm:grid-cols-2">
          <PreconSelect {...p} field="status" label="Status" options={PRE_CONSTRUCTION_STATUSES} />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Project team" hint={count(preCon, TEAM)} testId="precon-card-team">
        <div className="grid gap-4 sm:grid-cols-3">
          <PreconText {...p} field="preconLeadName" label="Pre-con lead" />
          <PreconText {...p} field="preconLeadPhone" label="Lead phone" type="tel" />
          <PreconText {...p} field="preconLeadEmail" label="Lead email" type="email" />
          <PreconText {...p} field="estimatorName" label="Estimator" />
          <PreconText {...p} field="estimatorPhone" label="Estimator phone" type="tel" />
          <PreconText {...p} field="estimatorEmail" label="Estimator email" type="email" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Design status" hint={count(preCon, DESIGN)} defaultOpen testId="precon-card-design">
        <div className="grid gap-4 sm:grid-cols-2">
          <PreconSelect {...p} field="designPhase" label="Design phase" options={DESIGN_PHASES} />
          <PreconNumber {...p} field="designCompletionPercent" label="Design complete %" min={0} max={100} />
        </div>
        <div className="mt-4 grid gap-4">
          <PreconArea {...p} field="designNarrative" label="Design narrative" />
          <PreconArea {...p} field="designAssumptions" label="Design assumptions" />
          <PreconArea {...p} field="designExclusions" label="Design exclusions" />
          <PreconArea {...p} field="veStrategy" label="Value engineering strategy" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Constructability" hint={count(preCon, CONSTRUCTABILITY)} testId="precon-card-constructability">
        <div className="grid gap-4">
          <PreconArea {...p} field="constructabilityFindings" label="Constructability findings" />
          <PreconArea {...p} field="constructabilitySummary" label="Constructability summary" />
          <PreconArea {...p} field="siteConditionsNotes" label="Site conditions" />
          <PreconArea {...p} field="logisticsConsiderations" label="Logistics considerations" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Permit strategy" hint={count(preCon, PERMITTING)} testId="precon-card-permitting">
        <div className="grid gap-4 sm:grid-cols-2">
          <PreconText {...p} field="permitTargetDate" label="Permit target date" type="date" />
          <PreconText {...p} field="permitReceivedDate" label="Permit received date" type="date" />
        </div>
        <div className="mt-4 grid gap-4">
          <PreconArea {...p} field="permitStrategy" label="Permit strategy" />
          <PreconArea {...p} field="jurisdictionalNarrative" label="Jurisdictional narrative" />
          <PreconArea {...p} field="openConditionsNarrative" label="Open conditions" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Prequal & bidding" hint={count(preCon, BIDDING)} testId="precon-card-bidding">
        <div className="grid gap-4">
          <PreconArea {...p} field="bidStrategy" label="Bid strategy" />
          <PreconArea {...p} field="prequalCriteria" label="Prequalification criteria" />
          <PreconArea {...p} field="bidderOutreachNarrative" label="Bidder outreach" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Buyout" hint={count(preCon, BUYOUT)} testId="precon-card-buyout">
        <div className="grid gap-4 sm:grid-cols-2">
          <PreconText {...p} field="buyoutTargetDate" label="Buyout target date" type="date" />
          <PreconText {...p} field="buyoutCompleteDate" label="Buyout complete date" type="date" />
        </div>
        <div className="mt-4">
          <Label className={LABEL_CLASS}>Bid packages</Label>
          <p className="text-sm" data-testid="precon-buyout-derived">
            <span className="font-semibold">{boughtOut}</span> of{" "}
            <span className="font-semibold">{bidPackages.length}</span> bought out
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Counted from the Bid Packages tab — award a package there to move this.
          </p>
        </div>
        <div className="mt-4 grid gap-4">
          <PreconArea {...p} field="buyoutStrategy" label="Buyout strategy" />
          <PreconArea {...p} field="longLeadStrategy" label="Long-lead strategy" />
          <PreconArea {...p} field="deliveryRiskNarrative" label="Delivery risk" />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Risks & next steps" hint={count(preCon, RISKS)} testId="precon-card-risks">
        <div className="grid gap-4">
          <PreconArea {...p} field="overallRisks" label="Overall risks" />
          <PreconArea {...p} field="overallAssumptions" label="Overall assumptions" />
          <PreconArea {...p} field="openIssues" label="Open issues" />
          <PreconArea {...p} field="nextSteps" label="Next steps" />
        </div>
      </CollapsibleCard>

      <PlanApprovalCard preCon={preCon} save={save} />
    </div>
  );
}
