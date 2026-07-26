import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RotateCcw, ShieldCheck } from "lucide-react";
import type { AccountPublic } from "@shared/schema";

type Subscriber = {
  id: number;
  email: string;
  plan?: string | null;
  source?: string | null;
  createdAt: string;
};
type DemoRequest = {
  id: number;
  name?: string | null;
  email: string;
  company?: string | null;
  role?: string | null;
  phone?: string | null;
  projectCount?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt: string;
};
type SignupPayload = { subscribers: Subscriber[]; demoRequests: DemoRequest[] };
type AccountsPayload = { accounts: AccountPublic[] };

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="default" data-testid={`badge-approval-approved`}>approved</Badge>;
  if (status === "denied") return <Badge variant="destructive" data-testid={`badge-approval-denied`}>denied</Badge>;
  return <Badge variant="secondary" data-testid={`badge-approval-pending`}>pending</Badge>;
}

function SubscriptionBadge({ status }: { status: string | null | undefined }) {
  if (status === "active" || status === "trialing") return <Badge variant="default">{status}</Badge>;
  if (!status) return <Badge variant="secondary">none</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminSignupsPage() {
  const { toast } = useToast();

  const signups = useQuery<SignupPayload>({
    queryKey: ["/api/admin/signups"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/signups")).json(),
    refetchInterval: 30_000,
  });

  const accounts = useQuery<AccountsPayload>({
    queryKey: ["/api/admin/accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/accounts")).json(),
    refetchInterval: 30_000,
  });

  const approvalMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "pending" | "approved" | "denied" }) => {
      const res = await apiRequest("POST", `/api/admin/accounts/${id}/approval`, { status });
      return (await res.json()) as { account: AccountPublic };
    },
    onSuccess: (_data, vars) => {
      toast({ title: `Account marked ${vars.status}` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
    },
    onError: (e: any) => {
      toast({ title: "Update failed", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const rows = accounts.data?.accounts ?? [];
  const pendingCount = rows.filter((a) => a.approvalStatus !== "approved").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" data-testid="page-admin-signups">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts &amp; signups</h1>
        <p className="text-sm text-muted-foreground">
          Approve new TrussPath accounts and see everyone who has subscribed or requested a demo from the marketing site.
        </p>
      </header>

      {/* Accounts approval */}
      <Card data-testid="card-accounts">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Accounts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="count-accounts-pending">{pendingCount} pending</Badge>
            <Badge variant="outline" data-testid="count-accounts-total">{rows.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.isLoading ? (
            <div className="p-6"><Skeleton className="h-24" /></div>
          ) : accounts.error ? (
            <div className="p-6 text-sm text-destructive">Failed to load accounts.</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No accounts yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name / Email</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Approval</th>
                  <th className="px-4 py-2 font-medium">Subscription</th>
                  <th className="px-4 py-2 font-medium">Signed up</th>
                  <th className="px-4 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((a) => {
                  const busy = approvalMut.isPending && approvalMut.variables?.id === a.id;
                  const isOwner = a.role === "owner";
                  return (
                    <tr key={a.id} data-testid={`row-account-${a.id}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.displayName}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{a.company || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.role}</td>
                      <td className="px-4 py-2"><ApprovalBadge status={a.approvalStatus} /></td>
                      <td className="px-4 py-2"><SubscriptionBadge status={a.subscriptionStatus} /></td>
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(a.createdAt)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOwner ? (
                            <span className="text-xs text-muted-foreground">Owner</span>
                          ) : a.approvalStatus === "approved" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => approvalMut.mutate({ id: a.id, status: "pending" })}
                                data-testid={`button-revoke-${a.id}`}
                              >
                                <RotateCcw className="mr-1 size-3.5" /> Revoke
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => approvalMut.mutate({ id: a.id, status: "denied" })}
                                data-testid={`button-deny-${a.id}`}
                              >
                                <X className="mr-1 size-3.5" /> Deny
                              </Button>
                            </>
                          ) : a.approvalStatus === "denied" ? (
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() => approvalMut.mutate({ id: a.id, status: "approved" })}
                              data-testid={`button-reapprove-${a.id}`}
                            >
                              <Check className="mr-1 size-3.5" /> Re-approve
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                disabled={busy}
                                onClick={() => approvalMut.mutate({ id: a.id, status: "approved" })}
                                data-testid={`button-approve-${a.id}`}
                              >
                                <Check className="mr-1 size-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => approvalMut.mutate({ id: a.id, status: "denied" })}
                                data-testid={`button-deny-${a.id}`}
                              >
                                <X className="mr-1 size-3.5" /> Deny
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Marketing signups */}
      {signups.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : signups.error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Failed to load marketing signups.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-subscribers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">Landing-page subscribers</CardTitle>
              <Badge variant="secondary" data-testid="count-subscribers">
                {signups.data?.subscribers.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {signups.data && signups.data.subscribers.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Plan</th>
                      <th className="px-4 py-2 font-medium">Source</th>
                      <th className="px-4 py-2 font-medium">Signed up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {signups.data.subscribers
                      .slice()
                      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                      .map((s) => (
                        <tr key={s.id} data-testid={`row-subscriber-${s.id}`}>
                          <td className="px-4 py-2">{s.email}</td>
                          <td className="px-4 py-2 text-muted-foreground">{s.plan || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{s.source || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{formatDate(s.createdAt)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No subscribers yet.</div>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-demo-requests">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">Demo requests</CardTitle>
              <Badge variant="secondary" data-testid="count-demo-requests">
                {signups.data?.demoRequests.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {signups.data && signups.data.demoRequests.length > 0 ? (
                <div className="divide-y">
                  {signups.data.demoRequests
                    .slice()
                    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                    .map((d) => (
                      <div key={d.id} className="p-4 text-sm" data-testid={`row-demo-request-${d.id}`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                          <div className="font-medium">{d.name || d.email}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</div>
                        </div>
                        <div className="mt-1 text-muted-foreground">{d.email}</div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {d.company && <div><span className="text-muted-foreground">Company:</span> {d.company}</div>}
                          {d.role && <div><span className="text-muted-foreground">Role:</span> {d.role}</div>}
                          {d.phone && <div><span className="text-muted-foreground">Phone:</span> {d.phone}</div>}
                          {d.projectCount && <div><span className="text-muted-foreground">Projects:</span> {d.projectCount}</div>}
                          {d.source && <div><span className="text-muted-foreground">Source:</span> {d.source}</div>}
                        </div>
                        {d.message && (
                          <div className="mt-2 rounded border bg-muted/30 p-2 text-xs leading-relaxed">{d.message}</div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-6 text-sm text-muted-foreground">No demo requests yet.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
