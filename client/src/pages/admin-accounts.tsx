import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check, RotateCcw, Search, ShieldCheck, X } from "lucide-react";
import {
  ApprovalBadge,
  RequireOwner,
  formatDate,
  useAdminAccounts,
} from "@/components/admin-shared";
import type { AccountPublic } from "@shared/schema";

type ApprovalStatus = "pending" | "approved" | "denied";

function SubscriptionBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="secondary">none</Badge>;
  if (status === "active" || status === "trialing") return <Badge variant="default">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function AdminAccountsBody() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const accounts = useAdminAccounts();

  const approvalMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ApprovalStatus }) => {
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
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        (a.company || "").toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const pendingCount = rows.filter((a) => a.approvalStatus === "pending").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="page-admin-accounts">
      <header className="space-y-1">
        <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-back-admin">
          <ArrowLeft className="size-3" /> Admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="text-sm text-muted-foreground">
          Every customer account on the platform. Approve or deny access here.
        </p>
      </header>

      <Card data-testid="card-accounts">
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Accounts
            <Badge variant="secondary" data-testid="count-accounts-pending">{pendingCount} pending</Badge>
            <Badge variant="outline" data-testid="count-accounts-total">{rows.length} total</Badge>
          </CardTitle>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search email or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-accounts"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {accounts.isLoading ? (
            <div className="p-6" data-testid="state-accounts-loading"><Skeleton className="h-24" /></div>
          ) : accounts.error ? (
            <div className="space-y-3 p-6 text-sm" data-testid="state-accounts-error">
              <p className="text-destructive">Failed to load accounts.</p>
              <Button size="sm" variant="outline" onClick={() => accounts.refetch()} data-testid="button-retry-accounts">
                <RotateCcw className="mr-1 size-3.5" /> Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="state-accounts-empty">No accounts yet.</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="state-accounts-no-match">
              No accounts match “{search}”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name / Email</th>
                    <th className="px-4 py-2 font-medium">Company</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Approval</th>
                    <th className="px-4 py-2 font-medium">Subscription</th>
                    <th className="px-4 py-2 font-medium">Plan</th>
                    <th className="px-4 py-2 font-medium">Signed up</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((a) => {
                    const busy = approvalMut.isPending && approvalMut.variables?.id === a.id;
                    // Platform-owners can't be approved/denied — the server
                    // rejects self-demotion and primary-owner changes anyway.
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
                        <td className="px-4 py-2 text-muted-foreground">{a.subscriptionPlan || "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(a.createdAt)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOwner ? (
                              <span className="text-xs text-muted-foreground">Owner</span>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  disabled={busy || a.approvalStatus === "approved"}
                                  onClick={() => approvalMut.mutate({ id: a.id, status: "approved" })}
                                  data-testid={`button-approve-${a.id}`}
                                >
                                  <Check className="mr-1 size-3.5" />
                                  {busy ? "Saving…" : "Approve"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || a.approvalStatus === "denied"}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminAccountsPage() {
  return (
    <Layout title="Accounts">
      <RequireOwner>{() => <AdminAccountsBody />}</RequireOwner>
    </Layout>
  );
}
