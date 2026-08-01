import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Inbox, ShieldCheck, Sparkles } from "lucide-react";
import { RequireOwner, useAdminAccounts, useAdminDemoAccounts } from "@/components/admin-shared";

type SignupPayload = { subscribers: unknown[]; demoRequests: unknown[] };

const TILES = [
  {
    href: "/admin/signups",
    title: "Signups",
    subtitle: "Pending signup applications",
    icon: Inbox,
  },
  {
    href: "/admin/accounts",
    title: "Accounts",
    subtitle: "All customer accounts, approve/reject",
    icon: ShieldCheck,
  },
  {
    href: "/admin/demo-accounts",
    title: "Demo Accounts",
    subtitle: "Sandbox accounts for prospects",
    icon: Sparkles,
  },
] as const;

/** Total length of every list, or undefined if any of them isn't an array. */
function sumLengths(...lists: unknown[]): number | undefined {
  if (!lists.every(Array.isArray)) return undefined;
  return (lists as unknown[][]).reduce((n, list) => n + list.length, 0);
}

function AdminIndexBody({ ownerEmail }: { ownerEmail: string }) {
  const signups = useQuery<SignupPayload>({
    queryKey: ["/api/admin/signups"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/signups")).json(),
  });
  const accounts = useAdminAccounts();
  const demoAccounts = useAdminDemoAccounts();

  // Undefined means "still loading, failed, or the payload wasn't the shape we
  // expect" — the tile just omits its badge rather than rendering a misleading
  // zero. Reading `.length` straight off the payload is not safe: a perfectly
  // ordinary 200 whose list key is absent (Express drops undefined values, so
  // res.json({ accounts: undefined }) ships `{}`) would throw during render,
  // and this component sits under an error boundary that blanks the app.
  const counts: Record<string, number | undefined> = {
    "/admin/signups": sumLengths(signups.data?.subscribers, signups.data?.demoRequests),
    "/admin/accounts": sumLengths(accounts.data?.accounts),
    "/admin/demo-accounts": sumLengths(demoAccounts.data?.demoAccounts),
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6" data-testid="page-admin-index">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-admin-owner">
          Owner tools. Signed in as {ownerEmail}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const count = counts[tile.href];
          return (
            <Link key={tile.href} href={tile.href} data-testid={`link-admin-${tile.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <Card className="h-full cursor-pointer transition hover-elevate">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    {count !== undefined && (
                      <Badge variant="secondary" data-testid={`count-admin-${tile.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        {count}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-1 font-medium">
                      {tile.title}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{tile.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminIndexPage() {
  return (
    <Layout title="Admin">
      <RequireOwner>{(account) => <AdminIndexBody ownerEmail={account.email} />}</RequireOwner>
    </Layout>
  );
}
