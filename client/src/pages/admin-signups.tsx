import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Check, X, RotateCcw, ShieldCheck, Sparkles, Copy, Ban, Clock } from "lucide-react";
import type { AccountPublic } from "@shared/schema";

type DemoAccountsPayload = { demoAccounts: AccountPublic[] };
type DemoCreateResponse = {
  account: AccountPublic;
  organizationId: number;
  credentials: { email: string; password: string };
  expiresAt: string;
};

function hoursUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / 3600_000);
}

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
  const [demoLabel, setDemoLabel] = useState("");
  const [lastDemo, setLastDemo] = useState<DemoCreateResponse | null>(null);

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

  const demoAccounts = useQuery<DemoAccountsPayload>({
    queryKey: ["/api/admin/demo-accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/demo-accounts")).json(),
    refetchInterval: 60_000,
  });

  const createDemo = useMutation({
    mutationFn: async (label: string) => {
      const res = await apiRequest("POST", "/api/admin/demo-accounts", { label });
      return (await res.json()) as DemoCreateResponse;
    },
    onSuccess: (data) => {
      setLastDemo(data);
      setDemoLabel("");
      toast({ title: "Demo login created — valid for 48 hours" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed to create demo login", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const expireDemo = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/admin/demo-accounts/${id}/expire`);
      return (await res.json()) as { account: AccountPublic };
    },
    onSuccess: () => {
      toast({ title: "Demo login revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts"] });
    },
    onError: (e: any) => {
      toast({ title: "Revoke failed", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const purgeExpired = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/demo-accounts/purge", { graceDays: 0 });
      return (await res.json()) as { purgedAccountIds: number[]; purgedOrgIds: number[]; graceDays: number };
    },
    onSuccess: (data) => {
      const n = data.purgedAccountIds.length;
      toast({
        title: n
          ? `Purged ${n} expired demo${n === 1 ? "" : "s"}`
          : "Nothing to purge",
        description: n
          ? `Also removed ${data.purgedOrgIds.length} sandbox org${data.purgedOrgIds.length === 1 ? "" : "s"} and all their seeded data.`
          : "No expired demo accounts were past the grace window.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
    },
    onError: (e: any) => {
      toast({ title: "Purge failed", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", description: "Long-press or select the text manually.", variant: "destructive" });
    }
  };

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

      {/* Demo login generator */}
      <Card data-testid="card-demo-login">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="size-4 text-primary" /> Demo logins (48 hours)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Generate a temporary login you can hand to a prospect. They land in their own isolated sandbox
                with full edit access, and the login stops working automatically after 48 hours.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => purgeExpired.mutate()}
              disabled={purgeExpired.isPending}
              data-testid="button-purge-expired-demos"
              title="Delete every expired demo account plus its sandbox org and all its seeded data."
            >
              {purgeExpired.isPending ? "Purging\u2026" : "Purge expired"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="demo-label" className="text-xs font-medium text-muted-foreground">
                Optional label (helps you remember who you gave it to)
              </Label>
              <Input
                id="demo-label"
                placeholder="e.g. Acme Distribution"
                value={demoLabel}
                onChange={(e) => setDemoLabel(e.target.value)}
                data-testid="input-demo-label"
              />
            </div>
            <Button
              onClick={() => createDemo.mutate(demoLabel)}
              disabled={createDemo.isPending}
              data-testid="button-create-demo"
            >
              <Sparkles className="mr-1.5 size-4" />
              {createDemo.isPending ? "Creating…" : "Create demo login"}
            </Button>
          </div>

          {lastDemo && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm" data-testid="panel-demo-credentials">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <ShieldCheck className="size-4 text-primary" />
                New demo credentials — copy these now; they won&rsquo;t be shown again.
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Email</div>
                    <div className="truncate font-mono text-sm" data-testid="demo-email">{lastDemo.credentials.email}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyText(lastDemo.credentials.email, "Email")} data-testid="button-copy-demo-email">
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Password</div>
                    <div className="truncate font-mono text-sm" data-testid="demo-password">{lastDemo.credentials.password}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyText(lastDemo.credentials.password, "Password")} data-testid="button-copy-demo-password">
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">Both, copy-paste friendly</div>
                    <div className="truncate font-mono text-xs" data-testid="demo-combined">
                      {lastDemo.credentials.email} / {lastDemo.credentials.password}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(`Email: ${lastDemo.credentials.email}\nPassword: ${lastDemo.credentials.password}\nLogin: https://www.trusspath.com/#/login`, "Credentials")}
                    data-testid="button-copy-demo-both"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" /> Expires {formatDate(lastDemo.expiresAt)}
              </div>
            </div>
          )}

          {demoAccounts.data && demoAccounts.data.demoAccounts.length > 0 && (
            <div className="rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active demo logins
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {demoAccounts.data.demoAccounts
                    .slice()
                    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                    .map((a) => {
                      const exp = a.demoExpiresAt || "";
                      const hrs = exp ? hoursUntil(exp) : 0;
                      const expired = hrs <= 0;
                      return (
                        <tr key={a.id} data-testid={`row-demo-${a.id}`}>
                          <td className="px-4 py-2 font-mono text-xs">{a.email}</td>
                          <td className="px-4 py-2 text-muted-foreground">{a.displayName}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                          <td className="px-4 py-2 text-xs">
                            {expired ? (
                              <Badge variant="destructive">Expired</Badge>
                            ) : (
                              <span className="text-muted-foreground">{formatDate(exp)} ({hrs}h left)</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {!expired && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={expireDemo.isPending}
                                onClick={() => {
                                  if (window.confirm(`Revoke demo login for ${a.email}?`)) expireDemo.mutate(a.id);
                                }}
                                data-testid={`button-revoke-demo-${a.id}`}
                              >
                                <Ban className="mr-1 size-3.5" /> Revoke now
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
