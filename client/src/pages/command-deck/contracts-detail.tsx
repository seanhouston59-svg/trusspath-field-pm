/**
 * Command Deck — Contract Detail.
 *
 * Full-field edit surface for a single contract row. Inline save on every
 * field group so an executive can update COI expiration or status in seconds
 * without a modal.
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

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const contractId = Number(id);

  const { data, isLoading, error } = useQuery<Contract>({
    queryKey: [`/api/command-deck/contracts/${contractId}`],
    queryFn: async () => (await apiRequest("GET", `/api/command-deck/contracts/${contractId}`)).json(),
    enabled: Number.isFinite(contractId),
  });

  const [form, setForm] = useState<Partial<Contract>>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {};
      const keys: (keyof Contract)[] = [
        "counterpartyName", "counterpartyType", "scopeSummary", "contractValue",
        "startDate", "endDate", "insuranceCertNumber", "insuranceCertExpiration",
        "bondNumber", "status", "notes", "projectId",
      ];
      for (const k of keys) {
        const v = (form as Record<string, unknown>)[k];
        payload[k] = v === "" ? null : v ?? null;
      }
      const res = await apiRequest("PATCH", `/api/command-deck/contracts/${contractId}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/command-deck/contracts/${contractId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/command-deck/contracts"] });
      toast({ title: "Contract updated" });
    },
    onError: (e: Error) => toast({ title: "Failed to update", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/command-deck/contracts/${contractId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/command-deck/contracts"] });
      toast({ title: "Contract deleted" });
      setLocation("/command-deck/contracts");
    },
    onError: (e: Error) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout title="Contract">
        <div className="mx-auto max-w-3xl p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }
  if (error || !data) {
    return (
      <Layout title="Contract">
        <div className="mx-auto max-w-3xl p-4">
          <div className="text-sm text-red-500">Contract not found.</div>
          <Link href="/command-deck/contracts" className="mt-4 inline-flex items-center gap-1 text-sm underline">
            <ArrowLeft className="size-4" /> Back to Contracts
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={data.counterpartyName}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          href="/command-deck/contracts"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All contracts
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{data.counterpartyName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Counterparty</Label>
                <Input
                  value={(form.counterpartyName as string) ?? ""}
                  onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={(form.counterpartyType as string) ?? "subcontractor"} onValueChange={(v) => setForm({ ...form, counterpartyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTERPARTY_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={(form.status as string) ?? "draft"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Scope</Label>
                <Textarea
                  value={(form.scopeSummary as string) ?? ""}
                  onChange={(e) => setForm({ ...form, scopeSummary: e.target.value })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Contract value (USD)</Label>
                <Input
                  value={(form.contractValue as string) ?? ""}
                  onChange={(e) => setForm({ ...form, contractValue: e.target.value })}
                />
              </div>
              <div>
                <Label>Bond #</Label>
                <Input
                  value={(form.bondNumber as string) ?? ""}
                  onChange={(e) => setForm({ ...form, bondNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={(form.startDate as string) ?? ""}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End date</Label>
                <Input
                  type="date"
                  value={(form.endDate as string) ?? ""}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Insurance certificate #</Label>
                <Input
                  value={(form.insuranceCertNumber as string) ?? ""}
                  onChange={(e) => setForm({ ...form, insuranceCertNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Insurance expiration</Label>
                <Input
                  type="date"
                  value={(form.insuranceCertExpiration as string) ?? ""}
                  onChange={(e) => setForm({ ...form, insuranceCertExpiration: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={(form.notes as string) ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm("Delete this contract? This cannot be undone.")) deleteMut.mutate();
                }}
                disabled={deleteMut.isPending}
                data-testid="contract-delete-btn"
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="contract-save-btn">
                <Save className="mr-2 size-4" /> {saveMut.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
