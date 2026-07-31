/**
 * Command Deck \u2014 Financials Portfolio.
 *
 * Org-wide rollup of every dollar signal the app currently tracks: contract
 * value, approved + pending change orders, subcontract commitments, PO
 * commitments, VE savings, and cost-impact exposure from open design RFIs.
 *
 * Data source: GET /api/command-deck/financials-rollup
 * Server aggregator: server/financials-rollup.ts
 *
 * Per-project rows link to the existing lean-module Financials detail page
 * for change-management drill-down. That keeps the CRUD surface (budget
 * lines, change orders, contingency draws, forecasts, etc.) exactly where
 * users already know to find it.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, ChevronRight, AlertTriangle, TrendingDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProjectFinancials = {
  projectId: number;
  projectName: string;
  budget: number;
  originalContract: number | null;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContract: number;
  subcontractCommitments: number;
  poCommitments: number;
  committedCost: number;
  veSavings: number;
  designRfiCostExposure: number;
  approvedCoCount: number;
  pendingCoCount: number;
  bidPackageCount: number;
  poCount: number;
  committedPct: number | null;
};

type OrgTotals = {
  projectCount: number;
  budget: number;
  originalContract: number;
  approvedChangeOrders: number;
  pendingChangeOrders: number;
  revisedContract: number;
  subcontractCommitments: number;
  poCommitments: number;
  committedCost: number;
  veSavings: number;
  designRfiCostExposure: number;
  approvedCoCount: number;
  pendingCoCount: number;
  bidPackageCount: number;
  poCount: number;
};

type FinancialsRollup = {
  orgTotals: OrgTotals;
  projects: ProjectFinancials[];
};

/**
 * Compact USD formatter for the headline chips. Full-precision numbers get
 * shown in the drill-down table.
 */
function fmtCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "\u2014";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** Full-precision USD for table cells. Blank/NaN \u2192 em dash. */
function fmtFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "\u2014";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

/** Traffic-light color for % committed. */
function pctTone(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct >= 95) return "text-red-600 dark:text-red-400 font-semibold";
  if (pct >= 80) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-emerald-600 dark:text-emerald-400";
}

function StatChip({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" | "good" }) {
  const toneClass =
    tone === "danger" ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300" :
    tone === "warn"   ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300" :
    tone === "good"   ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300" :
                        "border-border bg-card";
  return (
    <div className={`rounded-lg border ${toneClass} p-3`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-bold">{value}</div>
    </div>
  );
}

export default function FinancialsPortfolio() {
  const { data, isLoading, error } = useQuery<FinancialsRollup>({
    queryKey: ["/api/command-deck/financials-rollup"],
  });

  const projects = data?.projects ?? [];
  // Highest exposure first (pending COs + design RFI exposure), then by
  // committed % descending. This matches how a CFO scans the page: "what
  // needs my attention today?"
  const sortedProjects = [...projects].sort((a, b) => {
    const expA = a.pendingChangeOrders + a.designRfiCostExposure;
    const expB = b.pendingChangeOrders + b.designRfiCostExposure;
    if (expA !== expB) return expB - expA;
    return (b.committedPct ?? 0) - (a.committedPct ?? 0);
  });

  return (
    <Layout title="Financials">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <DollarSign className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Financials</h1>
            <p className="text-sm text-muted-foreground">
              Org-wide budget, contract value, committed cost, and change-order exposure across every project.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        )}

        {error && (
          <Card className="border-red-500/40 bg-red-500/5">
            <CardContent className="flex items-center gap-3 py-6 text-sm">
              <AlertTriangle className="size-5 text-red-500" />
              <span>Failed to load financials rollup. Try refreshing.</span>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Headline chips */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatChip label="Approved Budget" value={fmtCompact(data.orgTotals.budget)} />
              <StatChip label="Revised Contract" value={fmtCompact(data.orgTotals.revisedContract)} />
              <StatChip label="Committed" value={fmtCompact(data.orgTotals.committedCost)} />
              <StatChip
                label="Pending COs"
                value={fmtCompact(data.orgTotals.pendingChangeOrders)}
                tone={data.orgTotals.pendingChangeOrders > 0 ? "warn" : undefined}
              />
            </div>

            {/* Detailed org totals */}
            <Card className="mt-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Org totals</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {[
                    ["Original contract value", fmtFull(data.orgTotals.originalContract), null],
                    ["Approved change orders", `${fmtFull(data.orgTotals.approvedChangeOrders)} (${data.orgTotals.approvedCoCount})`, null],
                    ["Revised contract value", fmtFull(data.orgTotals.revisedContract), null],
                    ["Pending change orders", `${fmtFull(data.orgTotals.pendingChangeOrders)} (${data.orgTotals.pendingCoCount})`, data.orgTotals.pendingChangeOrders > 0 ? "warn" as const : null],
                    ["Subcontract commitments", `${fmtFull(data.orgTotals.subcontractCommitments)} (${data.orgTotals.bidPackageCount})`, null],
                    ["PO / long-lead commitments", `${fmtFull(data.orgTotals.poCommitments)} (${data.orgTotals.poCount})`, null],
                    ["Total committed cost", fmtFull(data.orgTotals.committedCost), null],
                    ["Value engineering savings", fmtFull(data.orgTotals.veSavings), data.orgTotals.veSavings > 0 ? "good" as const : null],
                    ["Design RFI cost exposure", fmtFull(data.orgTotals.designRfiCostExposure), data.orgTotals.designRfiCostExposure > 0 ? "warn" as const : null],
                  ].map(([label, value, tone]) => (
                    <div key={label as string} className="flex items-baseline justify-between border-b border-border/50 pb-1.5 last:border-b-0">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className={`font-mono text-sm tabular-nums ${
                        tone === "warn" ? "text-amber-600 dark:text-amber-400 font-semibold" :
                        tone === "good" ? "text-emerald-600 dark:text-emerald-400 font-semibold" :
                        ""
                      }`}>{value as string}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Per-project drill-down */}
            <Card className="mt-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Per-project financials</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {sortedProjects.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No projects yet. Create a project to see financials roll up here.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedProjects.map((p) => (
                      <Link
                        key={p.projectId}
                        href={`/command-deck/financials/${p.projectId}`}
                        className="group grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_1fr_auto] items-center gap-3 p-4 transition-colors hover:bg-muted/30"
                        data-testid={`financials-row-${p.projectId}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-display text-sm font-bold">{p.projectName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span>{p.approvedCoCount} appr CO</span>
                            {p.pendingCoCount > 0 && (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">
                                {p.pendingCoCount} pending
                              </span>
                            )}
                            <span>{p.bidPackageCount} bid pkg</span>
                            <span>{p.poCount} PO</span>
                            {p.designRfiCostExposure > 0 && (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                <TrendingDown className="size-3" />
                                {fmtCompact(p.designRfiCostExposure)} RFI exposure
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="hidden text-right sm:block">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contract</div>
                          <div className="font-mono text-sm tabular-nums">{fmtCompact(p.revisedContract)}</div>
                        </div>
                        <div className="hidden text-right sm:block">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Appr COs</div>
                          <div className="font-mono text-sm tabular-nums">{fmtCompact(p.approvedChangeOrders)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Committed</div>
                          <div className="font-mono text-sm tabular-nums">{fmtCompact(p.committedCost)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">% Comm</div>
                          <div className={`font-mono text-sm tabular-nums ${pctTone(p.committedPct)}`}>
                            {p.committedPct !== null ? `${p.committedPct.toFixed(0)}%` : "\u2014"}
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Data from projects, change orders, project setup, and pre-construction. Click a row to drill into change management.
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}
