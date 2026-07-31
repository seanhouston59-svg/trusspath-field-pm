import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Ban, Copy, RotateCcw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { RequireOwner, formatDate, useAdminDemoAccounts } from "@/components/admin-shared";
import type { AccountPublic } from "@shared/schema";

type DemoCreateResponse = {
  account: AccountPublic;
  organizationId: number;
  credentials: { email: string; password: string };
  expiresAt: string;
};
type PurgeResponse = { purgedAccountIds: number[]; purgedOrgIds: number[]; graceDays: number };

function hoursUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 3600_000);
}

function AdminDemoAccountsBody() {
  const { toast } = useToast();
  const demoAccounts = useAdminDemoAccounts();

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [lastDemo, setLastDemo] = useState<DemoCreateResponse | null>(null);
  const [expireTarget, setExpireTarget] = useState<AccountPublic | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);

  const createDemo = useMutation({
    mutationFn: async (demoLabel: string) => {
      const res = await apiRequest("POST", "/api/admin/demo-accounts", { label: demoLabel });
      return (await res.json()) as DemoCreateResponse;
    },
    onSuccess: (data) => {
      setLastDemo(data);
      setLabel("");
      setCreateOpen(false);
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
      setExpireTarget(null);
      toast({ title: "Demo login revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-accounts"] });
    },
    onError: (e: any) => {
      toast({ title: "Revoke failed", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const purgeExpired = useMutation({
    mutationFn: async () => {
      // graceDays: 0 purges everything already past its expiry. Omitting it
      // would default to a 7-day grace window server-side.
      const res = await apiRequest("POST", "/api/admin/demo-accounts/purge", { graceDays: 0 });
      return (await res.json()) as PurgeResponse;
    },
    onSuccess: (data) => {
      setPurgeOpen(false);
      const n = data.purgedAccountIds.length;
      toast({
        title: n ? `Purged ${n} expired demo${n === 1 ? "" : "s"}` : "Nothing to purge",
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

  const copyCredentials = async () => {
    if (!lastDemo) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${lastDemo.credentials.email}\nPassword: ${lastDemo.credentials.password}`,
      );
      toast({ title: "Credentials copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" });
    }
  };

  const rows = (demoAccounts.data?.demoAccounts ?? [])
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="mx-auto max-w-6xl space-y-6" data-testid="page-admin-demo-accounts">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <Link href="/admin" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-testid="link-back-admin">
            <ArrowLeft className="size-3" /> Admin
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Demo Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Time-boxed sandbox logins for prospects. Each gets its own isolated org and expires after 48 hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)} data-testid="button-open-create-demo">
            <Sparkles className="mr-1.5 size-4" /> Create demo account
          </Button>
          <Button
            variant="outline"
            onClick={() => setPurgeOpen(true)}
            disabled={purgeExpired.isPending}
            data-testid="button-open-purge"
          >
            <Trash2 className="mr-1.5 size-4" />
            {purgeExpired.isPending ? "Purging…" : "Purge expired"}
          </Button>
        </div>
      </header>

      {lastDemo && (
        <Card className="border-primary/30 bg-primary/5" data-testid="panel-demo-credentials">
          <CardContent className="space-y-2 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-primary" />
              New demo credentials — copy these now; they won&rsquo;t be shown again.
            </div>
            <div className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-2">
              <div className="min-w-0 flex-1 font-mono text-xs">
                <div className="truncate" data-testid="demo-email">{lastDemo.credentials.email}</div>
                <div className="truncate" data-testid="demo-password">{lastDemo.credentials.password}</div>
              </div>
              <Button size="sm" variant="outline" onClick={copyCredentials} data-testid="button-copy-demo">
                <Copy className="size-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expires {formatDate(lastDemo.expiresAt)}</p>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-demo-accounts">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-semibold">Demo logins</CardTitle>
          <Badge variant="outline" data-testid="count-demo-accounts">{rows.length} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {demoAccounts.isLoading ? (
            <div className="p-6" data-testid="state-demo-loading"><Skeleton className="h-24" /></div>
          ) : demoAccounts.error ? (
            <div className="space-y-3 p-6 text-sm" data-testid="state-demo-error">
              <p className="text-destructive">Failed to load demo accounts.</p>
              <Button size="sm" variant="outline" onClick={() => demoAccounts.refetch()} data-testid="button-retry-demo">
                <RotateCcw className="mr-1 size-3.5" /> Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground" data-testid="state-demo-empty">No demo accounts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Email</th>
                    <th className="px-4 py-2 font-medium">Label</th>
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">Expires</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((a) => {
                    const exp = a.demoExpiresAt || "";
                    const hrs = exp ? hoursUntil(exp) : 0;
                    const expired = !exp || hrs <= 0;
                    const busy = expireDemo.isPending && expireDemo.variables === a.id;
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
                              disabled={busy}
                              onClick={() => setExpireTarget(a)}
                              data-testid={`button-expire-demo-${a.id}`}
                            >
                              <Ban className="mr-1 size-3.5" />
                              {busy ? "Expiring…" : "Expire"}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="dialog-create-demo">
          <DialogHeader>
            <DialogTitle>Create demo account</DialogTitle>
            <DialogDescription>
              Generates a login plus an isolated sandbox org, seeded with a demo project. Valid for 48 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="demo-label" className="text-xs font-medium text-muted-foreground">
              Optional label (helps you remember who you gave it to)
            </Label>
            <Input
              id="demo-label"
              placeholder="e.g. Acme Distribution"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              data-testid="input-demo-label"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create-demo">
              Cancel
            </Button>
            <Button
              onClick={() => createDemo.mutate(label)}
              disabled={createDemo.isPending}
              data-testid="button-create-demo"
            >
              {createDemo.isPending ? "Creating…" : "Create demo account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!expireTarget} onOpenChange={(open) => !open && setExpireTarget(null)}>
        <AlertDialogContent data-testid="dialog-confirm-expire">
          <AlertDialogHeader>
            <AlertDialogTitle>Expire this demo account?</AlertDialogTitle>
            <AlertDialogDescription>
              They&rsquo;ll lose access immediately. {expireTarget?.email}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-expire">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (expireTarget) expireDemo.mutate(expireTarget.id);
              }}
              disabled={expireDemo.isPending}
              data-testid="button-confirm-expire"
            >
              {expireDemo.isPending ? "Expiring…" : "Expire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent data-testid="dialog-confirm-purge">
          <AlertDialogHeader>
            <AlertDialogTitle>Purge all expired demo accounts?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every expired demo account along with its sandbox org and all seeded data.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-purge">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                purgeExpired.mutate();
              }}
              disabled={purgeExpired.isPending}
              data-testid="button-confirm-purge"
            >
              {purgeExpired.isPending ? "Purging…" : "Purge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminDemoAccountsPage() {
  return (
    <Layout title="Demo Accounts">
      <RequireOwner>{() => <AdminDemoAccountsBody />}</RequireOwner>
    </Layout>
  );
}
