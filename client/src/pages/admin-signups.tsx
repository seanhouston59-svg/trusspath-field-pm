import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function AdminSignupsPage() {
  const { data, isLoading, error } = useQuery<SignupPayload>({
    queryKey: ["/api/admin/signups"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/admin/signups");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6" data-testid="page-admin-signups">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Admin</p>
        <h1 className="text-2xl font-semibold tracking-tight">Landing-page signups</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who subscribed or requested a demo from the marketing site. New signups also trigger an email
          to <span className="font-medium">houston.sean90@gmail.com</span> when <code className="rounded bg-muted px-1 py-0.5 text-xs">RESEND_API_KEY</code> is set in Vercel.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Failed to load signups.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-subscribers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-base font-semibold">Subscribers</CardTitle>
              <Badge variant="secondary" data-testid="count-subscribers">
                {data?.subscribers.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {data && data.subscribers.length > 0 ? (
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
                    {data.subscribers
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
                {data?.demoRequests.length ?? 0}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {data && data.demoRequests.length > 0 ? (
                <div className="divide-y">
                  {data.demoRequests
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
