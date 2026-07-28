import { PREQUAL_STATUSES, BID_PACKAGE_STATUSES } from "@shared/pre-construction-catalog";
import type { PreConstructionPrequalSub, PreConstructionBidPackage } from "@shared/schema";
import { EmptyState } from "@/components/mobilization/bits";
import {
  useCreatePrequalSub, useUpdatePrequalSub, useDeletePrequalSub,
  useCreateBidPackage, useUpdateBidPackage, useDeleteBidPackage,
} from "@/hooks/use-pre-construction";
import {
  SaveStatusPill, EditableTable, QuickAdd, SectionHeader, type Col, type SaveRow,
} from "./fields";

const SUB_COLS: Col<PreConstructionPrequalSub>[] = [
  { key: "companyName", label: "Company", required: true, className: "min-w-[11rem]" },
  { key: "trade", label: "Trade", className: "min-w-[8rem]" },
  { key: "contact", label: "Contact", className: "min-w-[8rem]" },
  { key: "phone", label: "Phone", className: "min-w-[8rem]" },
  { key: "email", label: "Email", className: "min-w-[10rem]" },
  { key: "prequalStatus", label: "Status", type: "select", options: PREQUAL_STATUSES },
  { key: "prequalDate", label: "Prequal", type: "date" },
  { key: "prequalExpires", label: "Expires", type: "date" },
  { key: "insuranceExpires", label: "Ins. expires", type: "date" },
  { key: "insuranceLimit", label: "Ins. limit", className: "min-w-[7rem]" },
  { key: "bondCapacity", label: "Bond capacity", className: "min-w-[7rem]" },
  { key: "emrRating", label: "EMR", className: "min-w-[5rem]" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const PACKAGE_COLS: Col<PreConstructionBidPackage>[] = [
  { key: "packageNumber", label: "Pkg #", className: "min-w-[6rem]" },
  { key: "label", label: "Label", required: true, className: "min-w-[11rem]" },
  { key: "csiDivision", label: "CSI div", className: "min-w-[6rem]" },
  { key: "status", label: "Status", type: "select", options: BID_PACKAGE_STATUSES },
  { key: "estimatedValueUsd", label: "Est. value", className: "min-w-[7rem]" },
  { key: "bidDueDate", label: "Bids due", type: "date" },
  { key: "bidsReceivedCount", label: "Bids in", type: "number", required: true, className: "min-w-[5rem]" },
  { key: "awardedTo", label: "Awarded to", className: "min-w-[9rem]" },
  { key: "awardedDate", label: "Awarded", type: "date" },
  { key: "awardedValueUsd", label: "Awarded value", className: "min-w-[7rem]" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export function PrequalTab({ prequalSubs, bidPackages, projectId }: {
  prequalSubs: PreConstructionPrequalSub[];
  bidPackages: PreConstructionBidPackage[];
  projectId: number | undefined;
}) {
  const createSub = useCreatePrequalSub(projectId);
  const updateSub = useUpdatePrequalSub(projectId);
  const removeSub = useDeletePrequalSub(projectId);
  const createPkg = useCreateBidPackage(projectId);
  const updatePkg = useUpdateBidPackage(projectId);
  const removePkg = useDeleteBidPackage(projectId);

  const saveSub: SaveRow = (id, patch) => updateSub.mutateAsync({ id, ...patch });
  const savePackage: SaveRow = (id, patch) => updatePkg.mutateAsync({ id, ...patch });

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[createSub, updateSub, removeSub, createPkg, updatePkg, removePkg]} />
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Prequalified subcontractors"
          blurb="Insurance, bonding, and safety record for every bidder cleared to price work."
        />
        <QuickAdd
          label="Add subcontractor"
          placeholder="Company name"
          pending={createSub.isPending}
          onAdd={(companyName) => createSub.mutate({
            companyName, prequalStatus: "not_started", sortOrder: prequalSubs.length,
          })}
          testId="precon-add-sub"
        />
        {prequalSubs.length === 0
          ? <EmptyState message="No prequalified subcontractors yet." />
          : <EditableTable
              rows={prequalSubs}
              cols={SUB_COLS}
              save={saveSub}
              remove={removeSub.mutate}
              testId="precon-sub"
              rowLabel={(r) => r.companyName}
            />}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Bid packages"
          blurb="Scope packages out for bid, and who each one was awarded to."
        />
        <QuickAdd
          label="Add bid package"
          placeholder="Package label"
          pending={createPkg.isPending}
          onAdd={(label) => createPkg.mutate({
            label, status: "not_ready", sortOrder: bidPackages.length,
          })}
          testId="precon-add-package"
        />
        {bidPackages.length === 0
          ? <EmptyState message="No bid packages yet." />
          : <EditableTable
              rows={bidPackages}
              cols={PACKAGE_COLS}
              save={savePackage}
              remove={removePkg.mutate}
              testId="precon-package"
              rowLabel={(r) => r.label}
            />}
      </section>
    </div>
  );
}
