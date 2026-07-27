import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EquipmentStatusBadge } from "@/components/bits";
import { Camera, Plus, Trash2, Wrench, Receipt, FileText, AlertTriangle, PenLine, Loader2 } from "lucide-react";
import { useMaintenanceLogs, useAddMaintenanceLog, useUpdateEquipment, useDeleteEquipment } from "@/hooks/use-data";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Equipment, Project, TeamMember } from "@shared/schema";

const STATUSES = ["On Site", "In Maintenance", "Off Site"];
const CONDITIONS = ["New", "Good", "Fair", "Poor", "Lost"];

export function EquipmentDetailSheet({
  item, open, onOpenChange, projects, team,
}: {
  item: Equipment | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: Project[];
  team: TeamMember[];
}) {
  if (!item) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg" data-testid="equipment-detail-sheet">
        <Inner item={item} projects={projects} team={team} onClose={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function Inner({ item, projects, team, onClose }: { item: Equipment; projects: Project[]; team: TeamMember[]; onClose: () => void }) {
  const cls = (item.assetClass ?? "Equipment") as "Equipment" | "Vehicle" | "Tech";
  const isTech = cls === "Tech";
  const { data: logs = [] } = useMaintenanceLogs(item.id);
  const addLog = useAddMaintenanceLog();
  const updateEq = useUpdateEquipment();
  const deleteEq = useDeleteEquipment();

  const teamName = (id: number | null | undefined) => team.find((t) => t.id === id)?.name ?? "—";
  const projName = (id: number | null | undefined) => projects.find((p) => p.id === id)?.name ?? "Fleet yard";

  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    (!!item.nextServiceDate && item.nextServiceDate <= today) ||
    !!(item.nextServiceMileage && item.currentMileage != null && item.currentMileage >= item.nextServiceMileage);

  return (
    <>
      <SheetHeader className="text-left">
        <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          {cls}{isTech && item.type ? ` · ${item.type}` : ""}
        </div>
        <div className="flex items-start justify-between gap-3">
          <SheetTitle className="text-base leading-snug">{item.name}</SheetTitle>
          <EquipmentStatusBadge status={item.status} />
        </div>
      </SheetHeader>

      {/* Status selector */}
      <div className="mt-5 space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</div>
        <Select
          value={item.status}
          onValueChange={(v) => updateEq.mutate({ id: item.id, patch: { status: v } })}
          disabled={updateEq.isPending}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Details grid */}
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {isTech ? (
          <>
            <Field label="Device type" value={item.type} />
            <Field label="Condition" value={
              <Select value={item.condition ?? ""} onValueChange={(v) => updateEq.mutate({ id: item.id, patch: { condition: v } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            } />
            <Field label="Make / Model" value={[item.make, item.model].filter(Boolean).join(" ") || "—"} />
            <Field label="Serial / IMEI" value={item.serialNumber || "—"} mono />
            <Field label="Assigned to" value={
              <Select value={item.assignedToId ? String(item.assignedToId) : "0"} onValueChange={(v) => updateEq.mutate({ id: item.id, patch: { assignedToId: v === "0" ? null : Number(v) } })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— Unassigned —</SelectItem>
                  {team.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            } />
            <Field label="Issue date" value={item.issueDate ?? "—"} />
            <Field label="Purchase date" value={item.purchaseDate ?? "—"} />
            <Field label="Purchase cost" value={item.purchaseCost ?? "—"} />
          </>
        ) : (
          <>
            <Field label="Type" value={item.type} />
            <Field label="Project" value={projName(item.projectId)} />
            {cls === "Vehicle" && (
              <>
                <Field label="Make / Model" value={[item.year, item.make, item.model].filter(Boolean).join(" ") || "—"} />
                <Field label="Plate" value={item.plate ?? "—"} mono />
                <Field label="VIN" value={item.vin ?? "—"} mono />
                <Field label="Driver" value={
                  <Select value={item.assignedToId ? String(item.assignedToId) : "0"} onValueChange={(v) => updateEq.mutate({ id: item.id, patch: { assignedToId: v === "0" ? null : Number(v) } })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">— Unassigned —</SelectItem>
                      {team.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                } />
              </>
            )}
            {cls === "Equipment" && <Field label="Operator" value={item.operator ?? "—"} />}
            <Field label="Location" value={item.location ?? "—"} />
            <Field label={cls === "Vehicle" ? "Mileage" : "Hours"} value={
              <MileageInline current={item.currentMileage} onSave={(n) => updateEq.mutate({ id: item.id, patch: { currentMileage: n } })} />
            } />
            <Field label="Next service" value={
              <NextServiceInline eq={item} onSave={(patch) => updateEq.mutate({ id: item.id, patch })} />
            } full />
            {overdue && (
              <div className="col-span-2 flex items-center gap-2 rounded-md bg-red-100 px-3 py-2 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                <AlertTriangle className="size-3.5" /> Service is overdue
              </div>
            )}
          </>
        )}
      </div>

      {/* Tech return signature block */}
      {isTech && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PenLine className="size-3.5" /> Return / Recovery
          </div>
          {item.returnedDate ? (
            <div className="space-y-1 text-sm">
              <div>Returned {item.returnedDate}</div>
              {item.returnSignature && (
                <div className="mt-2 border-t border-border pt-2 font-mono text-xs italic">Signed: {item.returnSignature}</div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-7 text-xs"
                onClick={() => updateEq.mutate({ id: item.id, patch: { returnedDate: null, returnSignature: null } })}
              >
                Undo return
              </Button>
            </div>
          ) : (
            <ReturnForm item={item} onSave={(patch) => updateEq.mutate({ id: item.id, patch })} />
          )}
        </div>
      )}

      {/* Notes */}
      <div className="mt-6">
        <NotesInline notes={item.notes ?? ""} onSave={(v) => updateEq.mutate({ id: item.id, patch: { notes: v || null } })} />
      </div>

      {/* Maintenance history (Equipment + Vehicle only) */}
      {!isTech && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-display text-sm font-bold"><Wrench className="size-4" /> Maintenance history</h4>
            <span className="text-xs text-muted-foreground">{logs.length} entries</span>
          </div>
          <MaintenanceLogList logs={logs} />
          <AddMaintenanceForm
            equipmentId={item.id}
            projectId={item.projectId}
            onAdd={(data) => addLog.mutateAsync({ equipmentId: item.id, data })}
            isPending={addLog.isPending}
          />
        </div>
      )}

      {/* Delete */}
      <div className="mt-8 border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
          onClick={() => {
            if (confirm(`Delete "${item.name}"? This also removes all maintenance history.`)) {
              deleteEq.mutate(item.id, { onSuccess: () => onClose() });
            }
          }}
          disabled={deleteEq.isPending}
          data-testid="button-delete-asset"
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </>
  );
}

function Field({ label, value, mono, full }: { label: string; value: React.ReactNode; mono?: boolean; full?: boolean }) {
  return (
    <div className={cn(full && "col-span-2")}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-sm", mono && "font-mono text-xs")}>{value}</div>
    </div>
  );
}

function MileageInline({ current, onSave }: { current: number | null; onSave: (n: number | null) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(current?.toString() ?? "");
  if (!edit) {
    return (
      <button className="text-left text-sm text-primary hover:underline" onClick={() => { setV(current?.toString() ?? ""); setEdit(true); }} data-testid="edit-mileage">
        {current != null ? current.toLocaleString() : "Set"}
      </button>
    );
  }
  return (
    <div className="flex gap-1">
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        className="h-8 text-xs"
        autoFocus
      />
      <Button size="sm" className="h-8 px-2 text-xs" onClick={() => { onSave(v === "" ? null : Number(v)); setEdit(false); }}>Save</Button>
      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setEdit(false)}>×</Button>
    </div>
  );
}

function NextServiceInline({ eq, onSave }: { eq: Equipment; onSave: (patch: Partial<Equipment>) => void }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState(eq.nextServiceDate ?? "");
  const [m, setM] = useState(eq.nextServiceMileage?.toString() ?? "");
  if (!edit) {
    const parts: string[] = [];
    if (eq.nextServiceDate) parts.push(eq.nextServiceDate);
    if (eq.nextServiceMileage) parts.push(`${eq.nextServiceMileage.toLocaleString()} mi`);
    return (
      <button className="text-left text-sm text-primary hover:underline" onClick={() => setEdit(true)}>
        {parts.length ? parts.join(" · ") : "Set reminder"}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <Input type="date" value={d} onChange={(e) => setD(e.target.value)} className="h-8 flex-1 text-xs" />
      <Input type="number" placeholder="mileage" value={m} onChange={(e) => setM(e.target.value)} className="h-8 w-24 text-xs" />
      <Button size="sm" className="h-8 px-2 text-xs" onClick={() => {
        onSave({ nextServiceDate: d || null, nextServiceMileage: m === "" ? null : Number(m) });
        setEdit(false);
      }}>Save</Button>
      <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setEdit(false)}>×</Button>
    </div>
  );
}

function NotesInline({ notes, onSave }: { notes: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(notes);
  const [dirty, setDirty] = useState(false);
  return (
    <div>
      <Label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Notes</Label>
      <Textarea
        value={v}
        rows={2}
        onChange={(e) => { setV(e.target.value); setDirty(e.target.value !== notes); }}
        placeholder="Any details worth remembering…"
      />
      {dirty && (
        <div className="mt-1 flex justify-end gap-1">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setV(notes); setDirty(false); }}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" onClick={() => { onSave(v); setDirty(false); }}>Save notes</Button>
        </div>
      )}
    </div>
  );
}

function ReturnForm({ item, onSave }: { item: Equipment; onSave: (patch: Partial<Equipment>) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sig, setSig] = useState("");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Return date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Signature (typed)</Label>
          <Input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="Sean Houston" className="h-8 font-mono text-xs italic" />
        </div>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!sig.trim()}
        onClick={() => onSave({ returnedDate: date, returnSignature: sig.trim() })}
      >
        Mark returned
      </Button>
    </div>
  );
}

function MaintenanceLogList({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="mb-3 rounded-md border border-dashed border-border bg-muted/20 py-6 text-center text-xs text-muted-foreground">
        No service records yet. Add the first one below.
      </div>
    );
  }
  return (
    <div className="mb-3 space-y-2">
      {logs.map((l) => (
        <div key={l.id} className="rounded-md border border-border bg-card p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{l.serviceType || "Service"}</span>
                <span className="text-muted-foreground">· {l.date}</span>
              </div>
              {l.notes && <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{l.notes}</div>}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {l.mileage != null && <span>🛞 {l.mileage.toLocaleString()}</span>}
                {l.cost && <span>💵 {l.cost}</span>}
                {l.performedBy && <span>👤 {l.performedBy}</span>}
                {l.receiptDocumentId && (
                  <a
                    href={`/api/documents/${l.receiptDocumentId}/file`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    data-testid={`receipt-link-${l.id}`}
                  >
                    <Receipt className="size-3" /> Receipt
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddMaintenanceForm({
  equipmentId, projectId, onAdd, isPending,
}: {
  equipmentId: number;
  projectId: number | null;
  onAdd: (data: any) => Promise<any>;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceType, setServiceType] = useState("Oil change");
  const [mileage, setMileage] = useState("");
  const [cost, setCost] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptDocId, setReceiptDocId] = useState<number | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setServiceType("Oil change");
    setMileage("");
    setCost("");
    setPerformedBy("");
    setNotes("");
    setReceiptDocId(null);
    setReceiptName(null);
  };

  const uploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("projectId", String(projectId ?? 0));
      fd.append("name", `Receipt — ${serviceType} — ${date}`);
      fd.append("type", "Receipt");
      fd.append("date", date);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const doc = await res.json();
      setReceiptDocId(doc.id);
      setReceiptName(doc.name);
      // Also invalidate documents so the Documents page picks it up.
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    } catch (e: any) {
      alert(`Upload failed: ${e?.message || e}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    await onAdd({
      date,
      mileage: mileage === "" ? null : Number(mileage),
      cost: cost || null,
      serviceType: serviceType || null,
      notes: notes || null,
      performedBy: performedBy || null,
      receiptDocumentId: receiptDocId,
    });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)} data-testid="button-add-log">
        <Plus className="size-3.5" /> Log service
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">New service entry</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <Label className="text-[10px] uppercase">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Service type</Label>
          <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} placeholder="Oil change" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Mileage / hrs</Label>
          <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase">Cost</Label>
          <Input value={cost} onChange={(e) => setCost(e.target.value)} placeholder="$85.00" className="h-8 text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase">Performed by</Label>
          <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} placeholder="Jiffy Lube" className="h-8 text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase">Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase">Receipt photo</Label>
          {receiptDocId ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-1.5 text-xs">
              <div className="flex items-center gap-2 truncate"><Receipt className="size-3.5 text-primary" /> {receiptName}</div>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => { setReceiptDocId(null); setReceiptName(null); }}>Remove</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                data-testid="button-attach-receipt"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
                {uploading ? "Uploading…" : "Take / attach photo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadReceipt(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { reset(); setOpen(false); }}>Cancel</Button>
        <Button size="sm" className="h-8 text-xs" onClick={submit} disabled={isPending} data-testid="button-save-log">
          {isPending ? "Saving…" : "Save entry"}
        </Button>
      </div>
    </div>
  );
}
