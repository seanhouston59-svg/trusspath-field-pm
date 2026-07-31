import { Link } from "wouter";
import { DraftingCompass, ChevronRight, AlertTriangle, Check, Clock } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProgressRing, EmptyState } from "@/components/mobilization/bits";
import { PRE_CONSTRUCTION_STATUSES, DESIGN_PHASES } from "@shared/pre-construction-catalog";
import {
  usePreConstructionPortfolio, useSeedPreConstruction, type PreConstructionPortfolioRow,
} from "@/hooks/use-pre-construction";

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(PRE_CONSTRUCTION_STATUSES.map((s) => [s.value, s.label]));

const PHASE_LABELS: Record<string, string> =
  Object.fromEntries(DESIGN_PHASES.map((p) => [p.value, p.label]));

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  design_locked: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  bought_out: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
};

/** Lifecycle order, so plans still in design sit above ones already bought out. */
const STATUS_RANK: Record<string, number> = {
  in_progress: 0, design_locked: 1, bought_out: 2, complete: 3,
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn(
      "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
      STATUS_STYLES[status] ?? STATUS_STYLES.in_progress,
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ProjectCard({ row }: { row: PreConstructionPortfolioRow }) {
  const h = row.health;
  const criticalShort = h.missingCriticalPermits.length > 0;
  return (
    <Link
      href={`/command-deck/pre-construction/${row.project.id}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
      data-testid={`precon-portfolio-card-${row.project.id}`}
    >
      <ProgressRing value={h.completePct} size={56} stroke={5} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">{row.project.name}</span>
          <StatusPill status={h.status} />
          {h.designPhase && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {PHASE_LABELS[h.designPhase] ?? h.designPhase}
              {h.designCompletionPercent != null && ` · ${h.designCompletionPercent}%`}
            </span>
          )}
          {h.longLeadItemsAtRisk > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400">
              <Clock className="size-3" /> {h.longLeadItemsAtRisk} long-lead at risk
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className={cn(
            criticalShort && "inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400",
          )}>
            {criticalShort && <AlertTriangle className="size-3" />}
            Critical permits {h.criticalPermitsIssued}/{h.criticalPermitsTotal}
          </span>
          <span>Prequal {h.prequalApproved}/{h.prequalTotal}</span>
          <span>Buyout {h.bidPackagesBoughtOut}/{h.bidPackagesTotal}</span>
          <span className={cn("inline-flex items-center gap-1", h.planApproved && "text-emerald-600 dark:text-emerald-400")}>
            {h.planApproved ? <><Check className="size-3" /> Plan approved</> : "Not approved"}
          </span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Projects created before this module shipped have no pre-con row. They get an
 *  opt-in card rather than a link — PATCH 404s against an unseeded project. */
function OptInCard({ row }: { row: PreConstructionPortfolioRow }) {
  const seed = useSeedPreConstruction(row.project.id);
  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4"
      data-testid={`precon-portfolio-optin-${row.project.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold">{row.project.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Pre-Construction has not been initialized for this project.
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => seed.mutate(undefined)}
        disabled={seed.isPending}
        data-testid={`precon-optin-btn-${row.project.id}`}
      >
        {seed.isPending ? "Setting up…" : "Opt in — set up module"}
      </Button>
    </div>
  );
}

export default function PreConstructionPortfolio() {
  const { data, isLoading } = usePreConstructionPortfolio();

  const rows = [...(data ?? [])].sort((a, b) => {
    const rank = (r: PreConstructionPortfolioRow) => STATUS_RANK[r.health.status] ?? 0;
    return rank(a) - rank(b) || a.health.completePct - b.health.completePct;
  });

  return (
    <Layout title="Pre-Construction">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <DraftingCompass className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Pre-Construction</h1>
            <p className="text-sm text-muted-foreground">
              Design, permitting, prequal, and buyout — everything that has to be resolved before
              the plan is locked.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No projects yet. Create a project and its pre-construction record is generated automatically." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => row.health.seeded
              ? <ProjectCard key={row.project.id} row={row} />
              : <OptInCard key={row.project.id} row={row} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
