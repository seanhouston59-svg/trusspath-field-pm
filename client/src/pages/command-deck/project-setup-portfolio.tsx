import { Link } from "wouter";
import { ClipboardList, ChevronRight, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProgressRing, EmptyState } from "@/components/mobilization/bits";
import { PROJECT_SETUP_STATUSES } from "@shared/project-setup-catalog";
import {
  useProjectSetupPortfolio, useSeedProjectSetup, type ProjectSetupPortfolioRow,
} from "@/hooks/use-project-setup";

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(PROJECT_SETUP_STATUSES.map((s) => [s.value, s.label]));

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  ready_for_kickoff: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  kicked_off: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
};

/** Portfolio sort order — the lifecycle, so the projects still being set up
 *  sit above the ones already kicked off. */
const STATUS_RANK: Record<string, number> = {
  in_progress: 0, ready_for_kickoff: 1, kicked_off: 2, complete: 3,
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

function ProjectCard({ row }: { row: ProjectSetupPortfolioRow }) {
  return (
    <Link
      href={`/executive-os/project-setup/${row.projectId}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
      data-testid={`setup-portfolio-card-${row.projectId}`}
    >
      <ProgressRing value={row.completePct} size={56} stroke={5} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">{row.projectName}</span>
          <StatusPill status={row.status} />
          {row.missingCritical.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400">
              <AlertTriangle className="size-3" /> {row.missingCritical.length} critical missing
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Deliverables {row.deliverablesComplete}/{row.deliverablesTotal}</span>
          <span className={cn(row.charterApproved && "text-emerald-600 dark:text-emerald-400")}>
            {row.charterApproved ? "Charter approved" : "Charter not approved"}
          </span>
          <span>{row.kickoffScheduled ? "Kickoff scheduled" : "Kickoff not scheduled"}</span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Projects created before this module shipped have no setup row. They get an
 *  opt-in card rather than a link — PATCH 404s against an unseeded project. */
function OptInCard({ row }: { row: ProjectSetupPortfolioRow }) {
  const seed = useSeedProjectSetup(row.projectId);
  return (
    <div
      className="flex items-center gap-4 rounded-lg border border-dashed border-border bg-card p-4"
      data-testid={`setup-portfolio-optin-${row.projectId}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-bold">{row.projectName}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Project Setup has not been initialized for this project.
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => seed.mutate(undefined)}
        disabled={seed.isPending}
        data-testid={`setup-optin-btn-${row.projectId}`}
      >
        {seed.isPending ? "Setting up…" : "Opt in — set up module"}
      </Button>
    </div>
  );
}

export default function ProjectSetupPortfolio() {
  const { data, isLoading } = useProjectSetupPortfolio();

  const rows = [...(data ?? [])].sort((a, b) => {
    const rank = (r: ProjectSetupPortfolioRow) => STATUS_RANK[r.status] ?? 0;
    return rank(a) - rank(b) || a.completePct - b.completePct;
  });

  return (
    <Layout title="Project Setup">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">Project Setup</h1>
            <p className="text-sm text-muted-foreground">
              Pre-mobilization intake — the charter, the directory, and everything that has to be
              true before a crew shows up.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="No projects yet. Create a project and its setup record is generated automatically." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => row.seeded
              ? <ProjectCard key={row.projectId} row={row} />
              : <OptInCard key={row.projectId} row={row} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
