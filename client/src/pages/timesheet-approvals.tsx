// Manager inbox for timesheets awaiting their signature. Populated by
// GET /api/timesheets/pending, which resolves the signed-in account to a team
// member and returns the rows routed to them via designated_manager_id.

import { useState } from "react";
import { Check, X, FileSignature, ExternalLink, ChevronLeft } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState } from "@/components/ghost-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Timesheet, TimeEntry, TeamMember } from "@shared/schema";

type PendingTimesheet = Timesheet & {
  docusignUrl: string | null;
  employeeMember: TeamMember | null;
};

type PendingResponse = { managerMemberId: number | null; timesheets: PendingTimesheet[] };

export default function TimesheetApprovals() {
  const { data, isLoading } = useQuery<PendingResponse>({ queryKey: ["/api/timesheets/pending"] });
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const pending = data?.timesheets ?? [];

  if (reviewingId) {
    const ts = pending.find((t) => t.id === reviewingId);
    if (ts) return <ReviewPanel ts={ts} onBack={() => setReviewingId(null)} />;
  }

  return (
    <Layout title="Timesheet Approvals">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : pending.length === 0 ? (
        <GhostState
          icon={FileSignature}
          title="Nothing awaiting your signature"
          description="Timesheets appear here once an employee whose designated manager is you signs and sends theirs."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((ts) => (
            <div
              key={ts.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
              data-testid={`card-pending-${ts.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{ts.employeeName}</span>
                  <Badge variant="secondary" className="text-xs">Awaiting your signature</Badge>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  Week of {ts.weekStart} – {ts.weekEnd} · {ts.totalHours}h
                  {ts.sentToManagerAt && ` · sent ${ts.sentToManagerAt.slice(0, 10)}`}
                </div>
              </div>
              {ts.docusignUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={ts.docusignUrl} target="_blank" rel="noreferrer" data-testid={`link-docusign-${ts.id}`}>
                    <ExternalLink className="size-4" /> DocuSign
                  </a>
                </Button>
              )}
              <Button size="sm" onClick={() => setReviewingId(ts.id)} data-testid={`button-review-${ts.id}`}>
                Review & Sign
              </Button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

function ReviewPanel({ ts, onBack }: { ts: PendingTimesheet; onBack: () => void }) {
  const { toast } = useToast();
  const [signature, setSignature] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const { data: detail } = useQuery<Timesheet & { entries: TimeEntry[] }>({
    queryKey: ["/api/timesheets", ts.id],
  });
  const entries = detail?.entries ?? [];

  const done = (title: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/timesheets/pending"] });
    queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
    toast({ title });
    onBack();
  };

  const signMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/timesheets/${ts.id}/manager-sign`, { signature: signature.trim() });
      return res.json();
    },
    onSuccess: () => done("Approved — filed into Company Documents"),
  });

  const rejectMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/timesheets/${ts.id}/manager-reject`, { reason: rejectReason.trim() || undefined });
      return res.json();
    },
    onSuccess: () => done("Timesheet rejected"),
  });

  return (
    <Layout
      title="Review Timesheet"
      actions={
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft className="size-4" /> Back
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-border px-4 py-3">
          <div className="text-sm"><span className="text-muted-foreground">Employee:</span> <b>{ts.employeeName}</b></div>
          <div className="text-sm"><span className="text-muted-foreground">Week:</span> {ts.weekStart} – {ts.weekEnd}</div>
          <div className="text-sm"><span className="text-muted-foreground">Total:</span> <b>{ts.totalHours}h</b></div>
          {ts.docusignUrl && (
            <a href={ts.docusignUrl} target="_blank" rel="noreferrer" className="ml-auto text-sm font-medium text-primary underline">
              Sign in DocuSign instead
            </a>
          )}
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3">Day</th>
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Client</th>
                <th className="pb-2 pr-3">Project</th>
                <th className="pb-2 pr-3 text-right">Hours</th>
                <th className="pb-2">Activities</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No hours logged</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="border-t border-border/50">
                  <td className="py-1.5 pr-3">{e.dayOfWeek}</td>
                  <td className="py-1.5 pr-3">{e.entryDate}</td>
                  <td className="py-1.5 pr-3">{e.clientName || "—"}</td>
                  <td className="py-1.5 pr-3">{e.projectName || "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">{e.hoursWorked}</td>
                  <td className="py-1.5">{e.activities || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border bg-muted/20 p-4">
          <div className="text-sm font-semibold text-muted-foreground">Employee Signature</div>
          <div className="mt-1 flex items-center gap-2 border-b border-border pb-1">
            <span className="text-lg font-medium italic">{ts.employeeSignature ?? "—"}</span>
            {ts.employeeSignature && <Check className="size-4 text-green-600" />}
          </div>

          <div className="mt-5 text-sm font-semibold text-muted-foreground">Your Signature</div>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your full name to approve"
              className="h-9 max-w-xs"
              data-testid="input-manager-signature"
            />
            <Button
              size="sm"
              onClick={() => signMut.mutate()}
              disabled={!signature.trim() || signMut.isPending}
              data-testid="button-manager-approve"
            >
              <Check className="size-4" /> {signMut.isPending ? "Approving..." : "Approve & File"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRejecting((r) => !r)} data-testid="button-manager-reject">
              <X className="size-4" /> Reject
            </Button>
          </div>

          {rejecting && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (optional)"
                className="h-9 max-w-md"
                data-testid="input-reject-reason"
              />
              <Button variant="destructive" size="sm" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                {rejectMut.isPending ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
