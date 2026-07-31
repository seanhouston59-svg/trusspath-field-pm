import { Link } from "wouter";
import { Rocket, ChevronRight, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing, HealthChip, EmptyState } from "@/components/mobilization/bits";
import { useMobilizationPortfolio, type MobilizationPortfolioRow } from "@/hooks/use-mobilization";

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">No earthwork date</span>;
  if (days < 0) {
    return <span className="text-xs font-semibold text-red-600 dark:text-red-400">Earthwork {Math.abs(days)}d late</span>;
  }
  return (
    <span className={days < 3 ? "text-xs font-semibold text-amber-600 dark:text-amber-400" : "text-xs text-muted-foreground"}>
      Earthwork in {days}d
    </span>
  );
}

function ProjectCard({ row }: { row: MobilizationPortfolioRow }) {
  const { permitStatus } = row;
  return (
    <Link
      href={`/executive-os/mobilization/${row.projectId}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
      data-testid={`mob-portfolio-card-${row.projectId}`}
    >
      <ProgressRing value={row.overallPct} size={56} stroke={5} tone={row.health} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">{row.projectName}</span>
          {row.seeded
            ? <HealthChip tone={row.health} />
            : <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Not set up</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <DaysChip days={row.daysToEarthwork} />
          <span className="text-xs text-muted-foreground">
            Permits {permitStatus.approved}/{permitStatus.total} approved
          </span>
          {permitStatus.blocked > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5" /> {permitStatus.blocked} blocked
            </span>
          )}
          {row.risksOpen > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">{row.risksOpen} open risks</span>
          )}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function MobilizationPortfolio() {
  const { data, isLoading } = useMobilizationPortfolio();

  // Least-ready first — the portfolio exists to surface what needs attention.
  const rows = [...(data ?? [])].sort((a, b) => {
    const rank = { red: 0, yellow: 1, green: 2 } as const;
    return rank[a.health] - rank[b.health] || a.overallPct - b.overallPct;
  });

  return (
    <Layout title="Mobilization">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Rocket className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Mobilization</h1>
            <p className="text-sm text-muted-foreground">
              Readiness across every project — from Notice to Proceed through the first day of earthwork.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No projects yet. Create a project and its mobilization plan is generated automatically." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => <ProjectCard key={row.projectId} row={row} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
