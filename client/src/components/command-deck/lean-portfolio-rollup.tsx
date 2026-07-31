/**
 * Lean-module portfolio rollup for the Command Deck landing page.
 *
 * Renders one row per project. Each row shows a 19-cell strip \u2014 one cell per
 * lean lifecycle module, colored by status and badged with an open-item count.
 * Click a cell to jump straight to that project's module detail page.
 *
 * The whole thing is powered by a single call to
 * GET /api/executive-os/lean-rollup, which returns every project the caller's
 * org can see plus the aggregate state/item counts for every (project, module)
 * pair that has activity. Empty pairs render as "not started" without a
 * dedicated backend row.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { LEAN_MODULES } from "@shared/lean-modules-catalog";
import type { Project } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RollupEntry = {
  projectId: number;
  moduleId: string;
  status: string;
  ownerName: string | null;
  targetCompleteDate: string | null;
  updatedAt: string | null;
  itemsTotal: number;
  itemsOpen: number;
  itemsOverdue: number;
  itemsAtRisk: number;
};

type RollupResponse = {
  projects: Project[];
  rollups: RollupEntry[];
};

/**
 * Cell background per status. Kept muted so a strip of 19 cells isn't visually
 * overwhelming; overdue/at-risk badges provide the loud signal.
 */
const STATUS_CELL_STYLES: Record<string, string> = {
  not_started: "bg-muted/50 text-muted-foreground hover:bg-muted",
  in_progress: "bg-blue-500/12 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20",
  ready_for_review:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25",
  approved:
    "bg-violet-500/12 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20",
  complete:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
  on_hold:
    "bg-slate-500/12 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  approved: "Approved",
  complete: "Complete",
  on_hold: "On hold",
};

/**
 * Build a synthetic empty entry for (project, module) pairs the backend didn't
 * return. Keeps the render loop uniform \u2014 the grid always has 19 cells.
 */
function emptyEntry(projectId: number, moduleId: string): RollupEntry {
  return {
    projectId,
    moduleId,
    status: "not_started",
    ownerName: null,
    targetCompleteDate: null,
    updatedAt: null,
    itemsTotal: 0,
    itemsOpen: 0,
    itemsOverdue: 0,
    itemsAtRisk: 0,
  };
}

function ProjectRollupRow({
  project,
  entries,
}: {
  project: Project;
  entries: Map<string, RollupEntry>;
}) {
  // Portfolio-level counts for the row header.
  let atRiskModules = 0;
  let overdueTotal = 0;
  let openTotal = 0;
  let completeModules = 0;
  let touchedModules = 0;
  for (const m of LEAN_MODULES) {
    const e = entries.get(m.slug) ?? emptyEntry(project.id, m.slug);
    openTotal += e.itemsOpen;
    overdueTotal += e.itemsOverdue;
    if (e.itemsAtRisk > 0 || e.itemsOverdue > 0) atRiskModules += 1;
    if (e.status === "complete") completeModules += 1;
    if (e.status !== "not_started" || e.itemsTotal > 0) touchedModules += 1;
  }

  return (
    <div
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      data-testid={`lean-rollup-project-${project.id}`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/projects/${project.id}`}
          className="group inline-flex items-center gap-1.5 font-display text-sm font-bold hover:text-primary"
        >
          {project.name}
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {touchedModules}/{LEAN_MODULES.length} modules active
          </span>
          {completeModules > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {completeModules} complete
            </span>
          )}
          {openTotal > 0 && <span>{openTotal} open</span>}
          {overdueTotal > 0 && (
            <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3" />
              {overdueTotal} overdue
            </span>
          )}
          {atRiskModules > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {atRiskModules} at risk
            </span>
          )}
        </div>
      </div>

      {/*
        19-cell mini-grid. Compact enough to fit on a laptop screen; wraps on
        mobile. Each cell is a link straight to that project's module page.
      */}
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10">
        {LEAN_MODULES.map((m) => {
          const e = entries.get(m.slug) ?? emptyEntry(project.id, m.slug);
          const cellClass = STATUS_CELL_STYLES[e.status] ?? STATUS_CELL_STYLES.not_started;
          const flagged = e.itemsOverdue > 0 || e.itemsAtRisk > 0;
          return (
            <TooltipProvider key={m.slug} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/executive-os/${m.slug}/${project.id}`}
                    className={cn(
                      "relative flex min-h-[52px] flex-col items-start justify-between rounded-md px-2 py-1.5 text-[10px] font-semibold leading-tight transition-colors",
                      cellClass,
                      flagged &&
                        "ring-1 ring-inset ring-red-500/40 dark:ring-red-400/40",
                    )}
                    data-testid={`lean-rollup-cell-${project.id}-${m.slug}`}
                  >
                    <span className="line-clamp-2 pr-1">{m.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold">
                      {e.itemsTotal > 0 && <span>{e.itemsOpen}/{e.itemsTotal}</span>}
                      {e.itemsOverdue > 0 && (
                        <span className="inline-flex items-center rounded-full bg-red-500/20 px-1 text-red-700 dark:text-red-300">
                          {e.itemsOverdue}!
                        </span>
                      )}
                    </span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <div className="font-semibold">{m.title}</div>
                  <div className="mt-0.5 text-muted-foreground">
                    {STATUS_LABELS[e.status] ?? e.status}
                    {e.ownerName ? ` · ${e.ownerName}` : ""}
                  </div>
                  <div className="mt-1">
                    {e.itemsTotal === 0
                      ? "No items yet"
                      : `${e.itemsOpen} open of ${e.itemsTotal} · ${
                          e.itemsTotal - e.itemsOpen
                        } done`}
                  </div>
                  {e.itemsOverdue > 0 && (
                    <div className="text-red-600 dark:text-red-400">
                      {e.itemsOverdue} overdue
                    </div>
                  )}
                  {e.itemsAtRisk > 0 && (
                    <div className="text-amber-600 dark:text-amber-400">
                      {e.itemsAtRisk} at risk
                    </div>
                  )}
                  {e.targetCompleteDate && (
                    <div className="mt-1 text-muted-foreground">
                      Target complete {e.targetCompleteDate}
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}

export function LeanPortfolioRollup() {
  const { data, isLoading, isError } = useQuery<RollupResponse>({
    queryKey: ["/api/executive-os/lean-rollup"],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Portfolio Rollup</span>
          <span className="text-xs font-normal text-muted-foreground">
            All 19 lifecycle modules across every project
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading portfolio…
          </div>
        ) : isError ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            Couldn’t load rollup. Reload the page or try again in a moment.
          </div>
        ) : !data || data.projects.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            No projects yet. Create your first project from the Projects page
            and every lifecycle module will show up here automatically.
          </div>
        ) : (
          data.projects.map((p) => {
            // Build per-project map so ProjectRollupRow can O(1) look up each
            // module. Doing the group-by here avoids re-scanning the flat
            // array N × 19 times inside the render loop.
            const entries = new Map<string, RollupEntry>();
            for (const r of data.rollups) {
              if (r.projectId === p.id) entries.set(r.moduleId, r);
            }
            return (
              <ProjectRollupRow key={p.id} project={p} entries={entries} />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
