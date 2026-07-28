import { AlertTriangle } from "lucide-react";
import { PERMIT_TYPES, PERMIT_STATUSES, CRITICAL_PERMIT_TYPES } from "@shared/pre-construction-catalog";
import type { PreConstructionPermit } from "@shared/schema";
import { EmptyState } from "@/components/mobilization/bits";
import { useCreatePermit, useUpdatePermit, useDeletePermit } from "@/hooks/use-pre-construction";
import {
  SaveStatusPill, EditableTable, QuickAddStrip, SectionHeader, type Col, type SaveRow,
} from "./fields";

const TYPE_LABELS: Record<string, string> =
  Object.fromEntries(PERMIT_TYPES.map((t) => [t.value, t.label]));

const COLS: Col<PreConstructionPermit>[] = [
  {
    key: "permitType", label: "Type", type: "select", options: PERMIT_TYPES,
    note: <span className="text-red-500"> *</span>,
  },
  { key: "permitNumber", label: "Permit #", className: "min-w-[7rem]" },
  { key: "jurisdiction", label: "Jurisdiction", className: "min-w-[9rem]" },
  { key: "applicationDate", label: "Applied", type: "date" },
  { key: "hearingDate", label: "Hearing", type: "date" },
  { key: "issuedDate", label: "Issued", type: "date" },
  { key: "expirationDate", label: "Expires", type: "date" },
  { key: "status", label: "Status", type: "select", options: PERMIT_STATUSES },
  { key: "expediter", label: "Expediter", className: "min-w-[8rem]" },
  { key: "expediterPhone", label: "Expediter phone", className: "min-w-[8rem]" },
  { key: "feePaid", label: "Fee paid", className: "min-w-[6rem]" },
  { key: "conditions", label: "Conditions", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export function PermitsTab({ permits, missingCriticalPermits, projectId }: {
  permits: PreConstructionPermit[];
  missingCriticalPermits: string[];
  projectId: number | undefined;
}) {
  const create = useCreatePermit(projectId);
  const update = useUpdatePermit(projectId);
  const remove = useDeletePermit(projectId);
  const save: SaveRow = (id, patch) => update.mutateAsync({ id, ...patch });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[create, update, remove]} />
      </div>

      <SectionHeader
        title="Permits"
        blurb="Critical permit types are marked with a red asterisk — Mobilization warns until each one is issued."
      />
      <QuickAddStrip
        title="Add permit"
        options={PERMIT_TYPES}
        pending={create.isPending}
        onAdd={(permitType) => create.mutate({
          permitType, status: "not_started", sortOrder: permits.length,
        })}
        critical={CRITICAL_PERMIT_TYPES}
        testId="precon-add-permit"
      />
      {permits.length === 0
        ? <EmptyState message="No permits tracked yet. Use a type button above to start the log." />
        : <EditableTable
            rows={permits}
            cols={COLS}
            save={save}
            remove={remove.mutate}
            testId="precon-permit"
            rowLabel={(r) => TYPE_LABELS[r.permitType ?? ""] ?? "permit"}
          />}

      {missingCriticalPermits.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300"
          data-testid="precon-missing-critical"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Critical permits not yet issued</p>
            <p className="text-xs">
              {missingCriticalPermits.map((t) => TYPE_LABELS[t] ?? t).join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
