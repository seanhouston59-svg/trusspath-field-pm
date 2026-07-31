/**
 * Shared plumbing for the /admin surface: the owner-only guard plus the two
 * admin list queries that more than one admin page reads.
 *
 * The guard is a UX redirect only — every /api/admin/* endpoint is enforced
 * server-side by requireOwner. Non-owners are bounced to the dashboard rather
 * than shown a 403 so the admin area reads as "not a thing" for them.
 */
import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import type { AccountPublic } from "@shared/schema";

export type AccountsPayload = { accounts: AccountPublic[] };
export type DemoAccountsPayload = { demoAccounts: AccountPublic[] };

export function useAdminAccounts() {
  return useQuery<AccountsPayload>({
    queryKey: ["/api/admin/accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/accounts")).json(),
    refetchInterval: 30_000,
  });
}

export function useAdminDemoAccounts() {
  return useQuery<DemoAccountsPayload>({
    queryKey: ["/api/admin/demo-accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/demo-accounts")).json(),
    refetchInterval: 60_000,
  });
}

export function RequireOwner({ children }: { children: (account: AccountPublic) => ReactNode }) {
  const { account, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="grid place-items-center py-20 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }
  if (account?.role !== "owner") return <Redirect to="/app" />;
  return <>{children(account)}</>;
}

export function formatDate(iso: string): string {
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

export function ApprovalBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="default">approved</Badge>;
  if (status === "denied") return <Badge variant="destructive">denied</Badge>;
  return <Badge variant="secondary">pending</Badge>;
}
