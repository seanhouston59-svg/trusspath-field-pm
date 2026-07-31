/**
 * Command Deck \u2014 Board Packets.
 *
 * One-click PDF export that assembles the org's portfolio health, financial
 * rollup, and consolidated risk register into a single board-ready document.
 * The endpoint streams the PDF back (application/pdf), so we open it in a new
 * tab; the browser handles download/save.
 *
 * Download history is derived from projectEvents where kind='board_packet'.
 * The server logs one event per successful export.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, Loader2, History, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectEventRow = {
  id: number;
  projectId: number;
  kind: string;
  title: string | null;
  subtitle: string | null;
  createdAt: string;
  actorName: string | null;
  meta: Record<string, unknown> | null;
};

function formatEventDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function BoardPackets() {
  const [period, setPeriod] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  });
  const [preparedBy, setPreparedBy] = useState<string>("");
  const [preparedByRole, setPreparedByRole] = useState<string>("Executive Team");
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Org-wide board-packet export history. Endpoint returns the latest 20
  // `board_packet` events across every project the caller can see.
  const { data: historyData, isLoading: historyLoading, refetch } = useQuery<ProjectEventRow[]>({
    queryKey: ["/api/command-deck/board-packet-history"],
  });

  const events = historyData ?? [];

  const handleGenerate = () => {
    setError(null);
    setGenerating(true);
    const params = new URLSearchParams();
    if (period.trim()) params.set("period", period.trim());
    if (preparedBy.trim()) params.set("preparedBy", preparedBy.trim());
    if (preparedByRole.trim()) params.set("preparedByRole", preparedByRole.trim());
    const url = `/api/command-deck/board-packet.pdf${params.toString() ? `?${params.toString()}` : ""}`;
    // Opening in a new tab keeps the current page mounted so history refreshes
    // don't lose form state. The browser's PDF viewer handles print/download.
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      setError("Popup blocked. Allow popups for this site and try again.");
    }
    // Give the server a beat to log the event, then refresh history.
    setTimeout(() => {
      refetch();
      setGenerating(false);
    }, 1500);
  };

  return (
    <Layout title="Board Packets">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Board Packets</h1>
            <p className="text-sm text-muted-foreground">
              Generate a portfolio-wide PDF combining project health, financial rollup, and consolidated risks.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Generate a new packet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bp-period">Reporting period</Label>
                <Input
                  id="bp-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="e.g. Q3 2026 or August 2026"
                  data-testid="bp-period-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp-prepared-by">Prepared by</Label>
                <Input
                  id="bp-prepared-by"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Your name (optional)"
                  data-testid="bp-prepared-by-input"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="bp-prepared-role">Role</Label>
                <Input
                  id="bp-prepared-role"
                  value={preparedByRole}
                  onChange={(e) => setPreparedByRole(e.target.value)}
                  placeholder="Executive Team"
                  data-testid="bp-prepared-by-role-input"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-end">
              <Button onClick={handleGenerate} disabled={generating} data-testid="bp-generate-button">
                {generating ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Preparing PDF…
                  </>
                ) : (
                  <>
                    <Download className="mr-2 size-4" />
                    Generate board packet
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Includes: portfolio summary, financial rollup (contract, committed, pending COs), per-project drill-down, and consolidated risk register across every project you can see.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Recent exports</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No packets generated yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {events.slice(0, 20).map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-4" data-testid={`bp-history-row-${e.id}`}>
                    <div>
                      <div className="text-sm font-medium">{e.title ?? "Board packet exported"}</div>
                      {e.subtitle && <div className="text-xs text-muted-foreground">{e.subtitle}</div>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatEventDate(e.createdAt)}
                      {e.actorName && <span className="ml-2">· {e.actorName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
