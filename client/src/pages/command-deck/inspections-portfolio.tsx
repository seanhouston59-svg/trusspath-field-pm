/**
 * Command Deck — Inspections Portfolio.
 *
 * Org-wide list of every AHJ / third-party inspection captured on any project.
 * Rows show type, inspector, date, and result with pass/fail traffic-light
 * styling. Quick-create dialog covers the "just left the site, need to log
 * a passed inspection" case.
 *
 * Data source: GET /api/executive-os/inspections
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
import { ClipboardCheck, Plus, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Inspection, Project } from "@shared/schema";

const INSPECTION_TYPES = [
  "Foundation",
  "Framing",
  "MEP Rough-in",
  "Fire / Life Safety",
  "Insulation",
  "Envelope / Waterproofing",
  "Elevator",
  "Final",
  "Third-party (concrete, welding, geotech)",
  "AHJ (building)",
  "AHJ (electrical)",
  "AHJ (plumbing)",
  "AHJ (mechanical)",
  "AHJ (fire marshal)",
  "Certificate of Occupancy",
  "Other",
];

const RESULT_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "pass", label: "Pass" },
  { value: "conditional", label: "Conditional" },
  { value: "fail", label: "Fail" },
];

function resultTone(r: string): string {
  if (r === "pass") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  if (r === "fail") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
  if (r === "conditional") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function InspectionsPortfolio() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    inspectionType: "Foundation",
    inspector: "",
    inspectorAgency: "",
    inspectionDate: new Date().toISOString().slice(0, 10),
    result: "scheduled",
    followUpItems: "",
    notes: "",
  });

  const { data: rows, isLoading, error } = useQuery<Inspection[]>({
    queryKey: ["/api/executive-os/inspections"],
    queryFn: async () => (await apiRequest("GET", "/api/executive-os/inspections")).json(),
  });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { ...form };
      payload.projectId = form.projectId ? Number(form.projectId) : undefined;
      for (const k of Object.keys(payload)) {
        if (payload[k] === "") payload[k] = null;
      }
      const res = await apiRequest("POST", "/api/executive-os/inspections", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive-os/inspections"] });
      setDialogOpen(false);
      setForm({
        projectId: "", inspectionType: "Foundation", inspector: "", inspectorAgency: "",
        inspectionDate: new Date().toISOString().slice(0, 10), result: "scheduled",
        followUpItems: "", notes: "",
      });
      toast({ title: "Inspection logged" });
    },
    onError: (e: Error) => toast({ title: "Failed to log inspection", description: e.message, variant: "destructive" }),
  });

  const passCount = (rows ?? []).filter((r) => r.result === "pass").length;
  const failCount = (rows ?? []).filter((r) => r.result === "fail").length;
  const scheduledCount = (rows ?? []).filter((r) => r.result === "scheduled").length;

  const projectName = (pid: number | null | undefined) =>
    projects?.find((p) => p.id === pid)?.name ?? "—";

  return (
    <Layout title="Inspections">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Inspections</h1>
              <p className="text-sm text-muted-foreground">
                AHJ and third-party inspections across every project — type, inspector, result, follow-ups.
              </p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)} data-testid="inspection-add-btn">
            <Plus className="mr-2 size-4" /> Log inspection
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-1 font-display text-lg font-bold">{rows?.length ?? 0}</div>
          </div>
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Passed</div>
            <div className="mt-1 font-display text-lg font-bold">{passCount}</div>
          </div>
          <div className={`rounded-lg border p-3 ${failCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-border bg-card"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Failed</div>
            <div className="mt-1 font-display text-lg font-bold">{failCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scheduled</div>
            <div className="mt-1 font-display text-lg font-bold">{scheduledCount}</div>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">All inspections</CardTitle></CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            )}
            {error && <div className="text-sm text-red-500">Failed to load inspections</div>}
            {!isLoading && !error && (rows?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No inspections yet. Click "Log inspection" to add one.
              </div>
            )}
            {!isLoading && (rows?.length ?? 0) > 0 && (
              <div className="divide-y divide-border rounded-md border border-border">
                {rows!.map((r) => (
                  <Link
                    key={r.id}
                    href={`/command-deck/inspections/${r.id}`}
                    className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50"
                    data-testid={`inspection-row-${r.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{r.inspectionType}</div>
                        <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${resultTone(r.result)}`}>
                          {r.result}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {projectName(r.projectId)} · {r.inspector}
                        {r.inspectorAgency ? ` (${r.inspectorAgency})` : ""}
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-sm sm:block">
                      <div className="font-semibold">{r.inspectionDate}</div>
                      {r.followUpItems ? (
                        <div className="text-xs text-amber-600 dark:text-amber-400">Follow-up items</div>
                      ) : null}
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
          <DialogHeader><DialogTitle>Log inspection</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="projectId">Project</Label>
              <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                <SelectTrigger id="projectId"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inspectionType">Type</Label>
              <Select value={form.inspectionType} onValueChange={(v) => setForm({ ...form, inspectionType: v })}>
                <SelectTrigger id="inspectionType"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="result">Result</Label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger id="result"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inspector">Inspector</Label>
              <Input
                id="inspector"
                value={form.inspector}
                onChange={(e) => setForm({ ...form, inspector: e.target.value })}
                placeholder="e.g. Sam Rodriguez"
              />
            </div>
            <div>
              <Label htmlFor="inspectorAgency">Agency</Label>
              <Input
                id="inspectorAgency"
                value={form.inspectorAgency}
                onChange={(e) => setForm({ ...form, inspectorAgency: e.target.value })}
                placeholder="Boulder Building Dept."
              />
            </div>
            <div>
              <Label htmlFor="inspectionDate">Date</Label>
              <Input id="inspectionDate" type="date" value={form.inspectionDate} onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="followUpItems">Follow-up items</Label>
              <Textarea
                id="followUpItems"
                value={form.followUpItems}
                onChange={(e) => setForm({ ...form, followUpItems: e.target.value })}
                placeholder="e.g. Fix hangers at Line 6 before re-inspect"
                rows={2}
              />
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
              disabled={!form.projectId || !form.inspector.trim() || createMut.isPending}
              data-testid="inspection-save-btn"
            >
              {createMut.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
