import { CheckCircle2, AlertTriangle } from "lucide-react";
import { LONG_LEAD_STATUSES, DESIGN_DISCIPLINES } from "@shared/pre-construction-catalog";
import type { PreConstructionLongLeadItem } from "@shared/schema";
import { EmptyState } from "@/components/mobilization/bits";
import {
  useCreateLongLeadItem, useUpdateLongLeadItem, useDeleteLongLeadItem,
} from "@/hooks/use-pre-construction";
import {
  SaveStatusPill, EditableTable, QuickAdd, SectionHeader, type Col, type SaveRow,
} from "./fields";

const COLS: Col<PreConstructionLongLeadItem>[] = [
  { key: "itemNumber", label: "Item #", className: "min-w-[6rem]" },
  { key: "description", label: "Description", required: true, className: "min-w-[12rem]" },
  { key: "status", label: "Status", type: "select", options: LONG_LEAD_STATUSES },
  { key: "discipline", label: "Discipline", type: "select", options: DESIGN_DISCIPLINES },
  { key: "csiDivision", label: "CSI div", className: "min-w-[6rem]" },
  { key: "leadTimeWeeks", label: "Lead (wks)", type: "number", className: "min-w-[5.5rem]" },
  { key: "submittedDate", label: "Submitted", type: "date" },
  { key: "approvedDate", label: "Approved", type: "date" },
  { key: "orderedDate", label: "Ordered", type: "date" },
  { key: "fabricationStartDate", label: "Fab start", type: "date" },
  { key: "expectedDeliveryDate", label: "Expected", type: "date" },
  { key: "actualDeliveryDate", label: "Delivered", type: "date" },
  { key: "supplier", label: "Supplier", className: "min-w-[9rem]" },
  { key: "supplierContact", label: "Supplier contact", className: "min-w-[9rem]" },
  { key: "supplierPhone", label: "Supplier phone", className: "min-w-[8rem]" },
  { key: "poNumber", label: "PO #", className: "min-w-[6rem]" },
  { key: "poValueUsd", label: "PO value", className: "min-w-[7rem]" },
  { key: "alternatives", label: "Alternatives", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

/** Status colouring on the row itself, so a superintendent scanning nineteen
 *  columns sees the at-risk items without reading the status cell. */
function rowClass(row: PreConstructionLongLeadItem) {
  if (row.status === "at_risk") return "bg-amber-500/10";
  if (row.status === "installed") return "opacity-55";
  return undefined;
}

function rowIcon(row: PreConstructionLongLeadItem) {
  if (row.status === "at_risk") return <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />;
  if (row.status === "delivered") return <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />;
  return null;
}

export function LongLeadTab({ items, projectId }: {
  items: PreConstructionLongLeadItem[];
  projectId: number | undefined;
}) {
  const create = useCreateLongLeadItem(projectId);
  const update = useUpdateLongLeadItem(projectId);
  const remove = useDeleteLongLeadItem(projectId);
  const save: SaveRow = (id, patch) => update.mutateAsync({ id, ...patch });

  const atRisk = items.filter((i) => i.status === "at_risk").length;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[create, update, remove]} />
      </div>

      <SectionHeader
        title="Long-lead items"
        blurb="Procurement that has to start before the schedule needs it."
        right={atRisk > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400">
            <AlertTriangle className="size-3.5" /> {atRisk} at risk
          </span>
        ) : undefined}
      />
      <QuickAdd
        label="Add long-lead item"
        placeholder="Item description"
        pending={create.isPending}
        onAdd={(description) => create.mutate({
          description, status: "identified", sortOrder: items.length,
        })}
        testId="precon-add-long-lead"
      />
      {items.length === 0
        ? <EmptyState message="No long-lead items tracked yet." />
        : <EditableTable
            rows={items}
            cols={COLS}
            save={save}
            remove={remove.mutate}
            testId="precon-long-lead"
            rowLabel={(r) => r.description}
            rowClass={rowClass}
            rowIcon={rowIcon}
          />}
    </div>
  );
}
