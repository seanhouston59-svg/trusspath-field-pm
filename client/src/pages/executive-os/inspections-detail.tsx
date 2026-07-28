/**
 * Executive OS — Inspection Detail.
 *
 * Edit surface for a single inspection: type, inspector, date, result,
 * follow-up items, notes. Delete via confirm.
 */
import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Inspection, Project } from "@shared/schema";

const INSPECTION_TYPES = [
  "Foundation", "Framing", "MEP Rough-in", "Fire / Life Safety", "Insulation",
  "Envelope / Waterproofing", "Elevator", "Final",
  "Third-party (concrete, welding, geotech)",
  "AHJ (building)", "AHJ (electrical)", "AHJ (plumbing)", "AHJ (mechanical)",
  "AHJ (fire marshal)", "Certificate of Occupancy", "Other",
];

const RESULT_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "pass", label: "Pass" },
  { value: "conditional", label: "Conditional" },
  { value: "fail", label: "Fail" },
];

export default function InspectionDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const inspectionId = Number(id);

  const { data, isLoading, error } = useQuery<Inspection>({
    queryKey: [`/api/executive-os/inspections/${inspectionId}`],
    queryFn: async () => (await apiRequest("GET", `/api/executive-os/inspections/${inspectionId}`)).json(),
    enabled: Number.isFinite(inspectionId),
  });
  const { data: projects } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const [form, setForm] = useState<Partial<Inspection>>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      const keys: (keyof Inspection)[] = [
        "projectId", "inspectionType", "inspector", "inspectorAgency",
        "inspectionDate", "result", "followUpItems", "notes",
      ];
      for (const k of keys) {
        const v = (form as Record<string, unknown>)[k];
        payload[k] = v === "" ? null : v ?? null;
      }
      const res = await apiRequest("PATCH", `/api/executive-os/inspections/${inspectionId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/executive-os/inspections/${inspectionId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/executive-os/inspections"] });
      toast({ title: "Inspection updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/executive-os/inspections/${inspectionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/executive-os/inspections"] });
      toast({ title: "Inspection deleted" });
      setLocation("/executive-os/inspections");
    },
    onError: (e: Error) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout title="Inspection">
        <div className="mx-auto max-w-3xl p-4"><Skeleton className="h-64 w-full" /></div>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout title="Inspection">
        <div className="mx-auto max-w-3xl p-4">
          <div className="text-sm text-red-500">Inspection not found.</div>
          <Link href="/executive-os/inspections" className="mt-4 inline-flex items-center gap-1 text-sm underline">
            <ArrowLeft className="size-4" /> Back to Inspections
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={data.inspectionType}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          href="/executive-os/inspections"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All inspections
        </Link>
        <Card>
          <CardHeader><CardTitle className="text-lg">{data.inspectionType}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Project</Label>
                <Select value={String(form.projectId ?? "")} onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={(form.inspectionType as string) ?? "Foundation"} onValueChange={(v) => setForm({ ...form, inspectionType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Result</Label>
                <Select value={(form.result as string) ?? "scheduled"} onValueChange={(v) => setForm({ ...form, result: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESULT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inspector</Label>
                <Input value={(form.inspector as string) ?? ""} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
              </div>
              <div>
                <Label>Agency</Label>
                <Input value={(form.inspectorAgency as string) ?? ""} onChange={(e) => setForm({ ...form, inspectorAgency: e.target.value })} />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={(form.inspectionDate as string) ?? ""} onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Follow-up items</Label>
                <Textarea value={(form.followUpItems as string) ?? ""} onChange={(e) => setForm({ ...form, followUpItems: e.target.value })} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={(form.notes as string) ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => { if (confirm("Delete this inspection?")) deleteMut.mutate(); }}
                disabled={deleteMut.isPending}
                data-testid="inspection-delete-btn"
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="inspection-save-btn">
                <Save className="mr-2 size-4" /> {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
