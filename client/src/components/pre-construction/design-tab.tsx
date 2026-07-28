import {
  DESIGN_DISCIPLINES, DOC_TYPES, DESIGN_DOC_STATUSES,
  DESIGN_RFI_STATUSES, DESIGN_RFI_IMPACTS, VE_STATUSES,
} from "@shared/pre-construction-catalog";
import type {
  PreConstructionDesignDoc, PreConstructionDesignRfi, PreConstructionVeItem,
} from "@shared/schema";
import { EmptyState } from "@/components/mobilization/bits";
import {
  useCreateDesignDoc, useUpdateDesignDoc, useDeleteDesignDoc,
  useCreateDesignRfi, useUpdateDesignRfi, useDeleteDesignRfi,
  useCreateVeItem, useUpdateVeItem, useDeleteVeItem,
} from "@/hooks/use-pre-construction";
import {
  CollapsibleCard, SaveStatusPill, EditableTable, QuickAdd, QuickAddStrip, SectionHeader,
  type Col, type SaveRow,
} from "./fields";

const DOC_COLS: Col<PreConstructionDesignDoc>[] = [
  { key: "label", label: "Label", required: true, className: "min-w-[10rem]" },
  { key: "docType", label: "Type", type: "select", options: DOC_TYPES },
  { key: "revision", label: "Rev", className: "min-w-[5rem]" },
  { key: "issuedDate", label: "Issued", type: "date" },
  { key: "receivedDate", label: "Received", type: "date" },
  { key: "status", label: "Status", type: "select", options: DESIGN_DOC_STATUSES },
  { key: "location", label: "Location", className: "min-w-[10rem]" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const RFI_COLS: Col<PreConstructionDesignRfi>[] = [
  { key: "rfiNumber", label: "RFI #", className: "min-w-[6rem]" },
  { key: "subject", label: "Subject", required: true, className: "min-w-[10rem]" },
  { key: "discipline", label: "Discipline", type: "select", options: DESIGN_DISCIPLINES },
  { key: "status", label: "Status", type: "select", options: DESIGN_RFI_STATUSES },
  { key: "impact", label: "Impact", type: "select", options: DESIGN_RFI_IMPACTS },
  { key: "askedDate", label: "Asked", type: "date" },
  { key: "respondedDate", label: "Responded", type: "date" },
  { key: "question", label: "Question", type: "textarea" },
  { key: "response", label: "Response", type: "textarea" },
  { key: "costImpactUsd", label: "Cost impact", className: "min-w-[7rem]" },
  { key: "scheduleImpactDays", label: "Days", type: "number", className: "min-w-[5rem]" },
  { key: "notes", label: "Notes", type: "textarea" },
];

const VE_COLS: Col<PreConstructionVeItem>[] = [
  { key: "veNumber", label: "VE #", className: "min-w-[6rem]" },
  { key: "description", label: "Description", required: true, className: "min-w-[12rem]" },
  { key: "discipline", label: "Discipline", type: "select", options: DESIGN_DISCIPLINES },
  { key: "status", label: "Status", type: "select", options: VE_STATUSES },
  { key: "estimatedSavingsUsd", label: "Est. savings", className: "min-w-[7rem]" },
  { key: "scheduleImpactDays", label: "Days", type: "number", className: "min-w-[5rem]" },
  { key: "proposedDate", label: "Proposed", type: "date" },
  { key: "decisionDate", label: "Decision", type: "date" },
  { key: "decisionNotes", label: "Decision notes", type: "textarea" },
  { key: "notes", label: "Notes", type: "textarea" },
];

export function DesignTab({ designDocs, designRfis, veItems, projectId }: {
  designDocs: PreConstructionDesignDoc[];
  designRfis: PreConstructionDesignRfi[];
  veItems: PreConstructionVeItem[];
  projectId: number | undefined;
}) {
  const createDoc = useCreateDesignDoc(projectId);
  const updateDoc = useUpdateDesignDoc(projectId);
  const removeDocMut = useDeleteDesignDoc(projectId);
  const createRfi = useCreateDesignRfi(projectId);
  const updateRfi = useUpdateDesignRfi(projectId);
  const removeRfiMut = useDeleteDesignRfi(projectId);
  const createVe = useCreateVeItem(projectId);
  const updateVe = useUpdateVeItem(projectId);
  const removeVeMut = useDeleteVeItem(projectId);

  const saveDoc: SaveRow = (id, patch) => updateDoc.mutateAsync({ id, ...patch });
  const saveRfi: SaveRow = (id, patch) => updateRfi.mutateAsync({ id, ...patch });
  const saveVe: SaveRow = (id, patch) => updateVe.mutateAsync({ id, ...patch });

  // A doc added from a discipline button needs a label to satisfy the NOT NULL
  // column; the discipline name is the most useful placeholder to type over.
  const addDoc = (discipline: string) => createDoc.mutate({
    discipline,
    label: DESIGN_DISCIPLINES.find((d) => d.value === discipline)?.label ?? "Untitled",
    status: "current",
    sortOrder: designDocs.length,
  });

  // Docs are grouped so a 40-sheet drawing set reads as seven short tables
  // instead of one wall. Disciplines with no docs are omitted entirely.
  const byDiscipline = DESIGN_DISCIPLINES
    .map((d) => ({ discipline: d, docs: designDocs.filter((doc) => doc.discipline === d.value) }))
    .filter((g) => g.docs.length > 0);
  const unassigned = designDocs.filter(
    (doc) => !DESIGN_DISCIPLINES.some((d) => d.value === doc.discipline),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SaveStatusPill mutations={[
          createDoc, updateDoc, removeDocMut,
          createRfi, updateRfi, removeRfiMut,
          createVe, updateVe, removeVeMut,
        ]} />
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Design documents"
          blurb="The drawing and specification set, grouped by discipline."
        />
        <QuickAddStrip
          title="Add design doc"
          options={DESIGN_DISCIPLINES}
          pending={createDoc.isPending}
          onAdd={addDoc}
          testId="precon-add-doc"
        />
        {designDocs.length === 0 ? (
          <EmptyState message="No design documents yet. Use a discipline button above to add the first sheet." />
        ) : (
          <div className="space-y-3">
            {byDiscipline.map((g) => (
              <CollapsibleCard
                key={g.discipline.value}
                title={g.discipline.label}
                hint={`${g.docs.length} doc${g.docs.length === 1 ? "" : "s"}`}
                defaultOpen
                testId={`precon-docs-${g.discipline.value}`}
              >
                <EditableTable
                  rows={g.docs}
                  cols={DOC_COLS}
                  save={saveDoc}
                  remove={removeDocMut.mutate}
                  testId="precon-doc"
                  rowLabel={(r) => r.label}
                />
              </CollapsibleCard>
            ))}
            {unassigned.length > 0 && (
              <CollapsibleCard
                title="Unassigned discipline"
                hint={`${unassigned.length}`}
                defaultOpen
                testId="precon-docs-unassigned"
              >
                <EditableTable
                  rows={unassigned}
                  cols={DOC_COLS}
                  save={saveDoc}
                  remove={removeDocMut.mutate}
                  testId="precon-doc"
                  rowLabel={(r) => r.label}
                />
              </CollapsibleCard>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Design RFIs" blurb="Open questions to the design team and their answers." />
        <QuickAdd
          label="Add RFI"
          placeholder="RFI subject"
          pending={createRfi.isPending}
          onAdd={(subject) => createRfi.mutate({ subject, status: "open", impact: "none", sortOrder: designRfis.length })}
          testId="precon-add-rfi"
        />
        {designRfis.length === 0
          ? <EmptyState message="No design RFIs logged." />
          : <EditableTable
              rows={designRfis}
              cols={RFI_COLS}
              save={saveRfi}
              remove={removeRfiMut.mutate}
              testId="precon-rfi"
              rowLabel={(r) => r.subject}
            />}
      </section>

      <section className="space-y-3">
        <SectionHeader title="Value engineering log" blurb="Proposed cost and schedule reductions and their disposition." />
        <QuickAdd
          label="Add VE item"
          placeholder="VE description"
          pending={createVe.isPending}
          onAdd={(description) => createVe.mutate({ description, status: "proposed", sortOrder: veItems.length })}
          testId="precon-add-ve"
        />
        {veItems.length === 0
          ? <EmptyState message="No value engineering items logged." />
          : <EditableTable
              rows={veItems}
              cols={VE_COLS}
              save={saveVe}
              remove={removeVeMut.mutate}
              testId="precon-ve"
              rowLabel={(r) => r.description}
            />}
      </section>
    </div>
  );
}
