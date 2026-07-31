/**
 * Command Deck — Contracts Portfolio.
 *
 * Org-wide contracts register. One row per contract or subcontract, with
 * counterparty, value, dates, insurance certificate, bond, and status. Rows
 * link to a detail page for full edit; a quick-create dialog covers the
 * common "new sub just executed" case without leaving the list.
 *
 * Data source: GET /api/executive-os/contracts
 */
import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Plus, ChevronRight, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contract } from "@shared/schema";

const COUNTERPARTY_TYPES = [
  { value: "subcontractor", label: "Subcontractor" },
  { value: "vendor", label: "Vendor" },
  { value: "owner", label: "Owner" },
  { value: "consultant", label: "Consultant" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "executed", label: "Executed" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

function fmtMoney(v: string | null | undefined): string {
  if (!v) return "—";
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function statusTone(s: string): string {
  if (s === "executed") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (s === "expired") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (s === "terminated") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
  return "bg-muted text-muted-foreground border-border";
}

/**
 * Certificate-expired badge — surface COI lapses on the portfolio without
 * requiring the executive to open every contract.
 */
function insuranceExpired(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = Date.parse(dateStr);
  if (!Number.isFinite(d)) return false;
  return d < Date.now();
}

export default function ContractsPortfolio() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    counterpartyName: "",
    counterpartyType: "subcontractor",
    scopeSummary: "",
    contractValue: "",
    startDate: "",
    endDate: "",
    insuranceCertNumber: "",
    insuranceCertExpiration: "",
    bondNumber: "",
    status: "draft",
    notes: "",
  });

  const { data: rows, isLoading, error } = useQuery<Contract[]>({
    queryKey: ["/api/executive-os/contracts"],
    queryFn: async () => (await apiRequest("GET", "/api/executive-os/contracts")).json(),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...form };
      // Blank strings on optional fields would fail nullable string checks
      // silently; strip them so the server sees "unset" instead of "empty".
      for (const k of Object.keys(payload)) {
        if (payload[k] === "") payload[k] = null;
      }
      const res = await apiRequest("POST", "/api/executive-os/contracts", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive-os/contracts"] });
      setDialogOpen(false);
      setForm({
        counterpartyName: "", counterpartyType: "subcontractor", scopeSummary: "",
        contractValue: "", startDate: "", endDate: "", insuranceCertNumber: "",
        insuranceCertExpiration: "", bondNumber: "", status: "draft", notes: "",
      });
      toast({ title: "Contract added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add contract", description: e.message, variant: "destructive" }),
  });

  const totalValue = (rows ?? []).reduce((acc, r) => {
    const n = Number((r.contractValue ?? "").replace(/[^0-9.\-]/g, ""));
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
  const executedCount = (rows ?? []).filter((r) => r.status === "executed").length;
  const coiExpiredCount = (rows ?? []).filter((r) => insuranceExpired(r.insuranceCertExpiration)).length;

  return (
    <Layout title="Contracts">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <FileSignature className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Contracts Register</h1>
              <p className="text-sm text-muted-foreground">
                Owner, subcontractor, vendor, and consultant agreements across the portfolio.
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="contract-add-btn">
            <Plus className="mr-2 size-4" /> New contract
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total value</div>
            <div className="mt-1 font-display text-lg font-bold">{fmtMoney(String(totalValue))}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Executed</div>
            <div className="mt-1 font-display text-lg font-bold">{executedCount} of {rows?.length ?? 0}</div>
          </div>
          <div className={`rounded-lg border p-3 ${coiExpiredCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">COI expired</div>
            <div className="mt-1 flex items-center gap-2 font-display text-lg font-bold">
              {coiExpiredCount > 0 && <AlertTriangle className="size-4 text-red-500" />}
              {coiExpiredCount}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All contracts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}
            {error && <div className="text-sm text-red-500">Failed to load contracts</div>}
            {!isLoading && !error && (rows?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No contracts yet. Click "New contract" to add one.
              </div>
            )}
            {!isLoading && (rows?.length ?? 0) > 0 && (
              <div className="divide-y divide-border rounded-md border border-border">
                {rows!.map((r) => (
                  <Link
                    key={r.id}
                    href={`/executive-os/contracts/${r.id}`}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                    data-testid={`contract-row-${r.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{r.counterpartyName}</div>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone(r.status)}`}>
                          {r.status}
                        </span>
                        {insuranceExpired(r.insuranceCertExpiration) && (
                          <span className="rounded-md border border-red-500/40 bg-red-500/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 dark:text-red-300">
                            COI expired
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {r.counterpartyType} · {r.scopeSummary}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-sm sm:block">
                      <div className="font-semibold">{fmtMoney(r.contractValue)}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.startDate || "—"} → {r.endDate || "—"}
                      </div>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New contract</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="counterpartyName">Counterparty</Label>
              <Input
                id="counterpartyName"
                value={form.counterpartyName}
                onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
                placeholder="e.g. Rocky Mountain Concrete"
              />
            </div>
            <div>
              <Label htmlFor="counterpartyType">Type</Label>
              <Select value={form.counterpartyType} onValueChange={(v) => setForm({ ...form, counterpartyType: v })}>
                <SelectTrigger id="counterpartyType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTERPARTY_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="scopeSummary">Scope</Label>
              <Textarea
                id="scopeSummary"
                value={form.scopeSummary}
                onChange={(e) => setForm({ ...form, scopeSummary: e.target.value })}
                placeholder="e.g. Cast-in-place concrete for foundations and slabs"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="contractValue">Value (USD)</Label>
              <Input
                id="contractValue"
                value={form.contractValue}
                onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                placeholder="1250000"
              />
            </div>
            <div>
              <Label htmlFor="bondNumber">Bond #</Label>
              <Input
                id="bondNumber"
                value={form.bondNumber}
                onChange={(e) => setForm({ ...form, bondNumber: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <Label htmlFor="startDate">Start</Label>
              <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="endDate">End</Label>
              <Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="insuranceCertNumber">COI #</Label>
              <Input id="insuranceCertNumber" value={form.insuranceCertNumber} onChange={(e) => setForm({ ...form, insuranceCertNumber: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="insuranceCertExpiration">COI expiration</Label>
              <Input id="insuranceCertExpiration" type="date" value={form.insuranceCertExpiration} onChange={(e) => setForm({ ...form, insuranceCertExpiration: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={!form.counterpartyName.trim() || !form.scopeSummary.trim() || createMut.isPending}
              data-testid="contract-save-btn"
            >
              {createMut.isPending ? "Saving…" : "Save contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
