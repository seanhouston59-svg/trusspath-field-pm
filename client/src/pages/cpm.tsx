import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { useProjects, useTasks } from "@/hooks/use-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Info } from "lucide-react";
import type { Task } from "@shared/schema";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ----------------------------- CPM computation ---------------------------- */

type Cpm = {
  id: number;
  code: string;               // T-###
  label: string;
  status: string;
  duration: number;           // days
  es: number;                 // early start (day offset from project start)
  ef: number;                 // early finish
  ls: number;                 // late start
  lf: number;                 // late finish
  slack: number;              // total float in days
  critical: boolean;
  predecessors: number[];
  successors: number[];
};

function parseDeps(t: Task): number[] {
  const raw = (t as any).dependsOn as string | null | undefined;
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a + "T00:00:00").getTime();
  const t2 = new Date(b + "T00:00:00").getTime();
  return Math.max(1, Math.round((t2 - t1) / 86400000) + 1);
}

/** Compute CPM: forward + backward pass. Falls back to task duration from start/end
 *  dates when dependencies are present. Ignores cyclic edges defensively. */
function computeCpm(tasks: Task[]): { rows: Cpm[]; projectDuration: number } {
  if (tasks.length === 0) return { rows: [], projectDuration: 0 };

  const byId = new Map<number, Task>();
  tasks.forEach((t) => byId.set(t.id, t));

  // Build filtered predecessor + successor sets (drop refs to tasks not in this project).
  const preds = new Map<number, number[]>();
  const succs = new Map<number, number[]>();
  tasks.forEach((t) => {
    const filtered = parseDeps(t).filter((id) => byId.has(id) && id !== t.id);
    preds.set(t.id, filtered);
    filtered.forEach((p) => {
      if (!succs.has(p)) succs.set(p, []);
      succs.get(p)!.push(t.id);
    });
  });

  // Topological sort (Kahn). If cycle exists, remaining nodes get appended in id order.
  const indeg = new Map<number, number>();
  tasks.forEach((t) => indeg.set(t.id, (preds.get(t.id) ?? []).length));
  const queue: number[] = [];
  indeg.forEach((n, id) => { if (n === 0) queue.push(id); });
  const order: number[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    (succs.get(id) ?? []).forEach((s) => {
      indeg.set(s, (indeg.get(s) ?? 0) - 1);
      if ((indeg.get(s) ?? 0) === 0) queue.push(s);
    });
  }
  if (order.length < tasks.length) {
    tasks.forEach((t) => { if (!order.includes(t.id)) order.push(t.id); });
  }

  const dur = new Map<number, number>();
  tasks.forEach((t) => {
    dur.set(
      t.id,
      t.startDate && t.endDate ? daysBetween(t.startDate, t.endDate) : 1
    );
  });

  // Forward pass — ES/EF
  const es = new Map<number, number>();
  const ef = new Map<number, number>();
  order.forEach((id) => {
    const ps = preds.get(id) ?? [];
    const start = ps.length === 0 ? 0 : Math.max(...ps.map((p) => ef.get(p) ?? 0));
    es.set(id, start);
    ef.set(id, start + (dur.get(id) ?? 1));
  });

  const projectDuration = Math.max(0, ...Array.from(ef.values()));

  // Backward pass — LF/LS
  const lf = new Map<number, number>();
  const ls = new Map<number, number>();
  [...order].reverse().forEach((id) => {
    const ss = succs.get(id) ?? [];
    const finish = ss.length === 0 ? projectDuration : Math.min(...ss.map((s) => ls.get(s) ?? projectDuration));
    lf.set(id, finish);
    ls.set(id, finish - (dur.get(id) ?? 1));
  });

  const rows: Cpm[] = tasks.map((t) => {
    const slack = (ls.get(t.id) ?? 0) - (es.get(t.id) ?? 0);
    return {
      id: t.id,
      code: `T-${String(t.id).padStart(3, "0")}`,
      label: t.title,
      status: t.status,
      duration: dur.get(t.id) ?? 1,
      es: es.get(t.id) ?? 0,
      ef: ef.get(t.id) ?? 0,
      ls: ls.get(t.id) ?? 0,
      lf: lf.get(t.id) ?? 0,
      slack,
      critical: slack === 0,
      predecessors: preds.get(t.id) ?? [],
      successors: succs.get(t.id) ?? [],
    };
  });

  return { rows, projectDuration };
}

/* ------------------------------- Node layout ------------------------------ */

// Column = longest path length from source (rank). Row = collision-avoiding slot per column.
function layout(rows: Cpm[]): {
  byId: Map<number, Cpm & { col: number; row: number }>;
  cols: number;
  rowsPerCol: number[];
} {
  const rank = new Map<number, number>();
  const idToRow = new Map<number, Cpm>();
  rows.forEach((r) => idToRow.set(r.id, r));

  // BFS-ish: iterate; a node's rank = max(pred.rank) + 1.
  // Cap iterations to avoid infinite loops from cycles.
  for (let i = 0; i < rows.length * 2; i++) {
    let changed = false;
    rows.forEach((r) => {
      const base = r.predecessors.length === 0 ? 0 : Math.max(...r.predecessors.map((p) => rank.get(p) ?? 0)) + 1;
      if ((rank.get(r.id) ?? -1) < base) { rank.set(r.id, base); changed = true; }
    });
    if (!changed) break;
  }
  rows.forEach((r) => { if (!rank.has(r.id)) rank.set(r.id, 0); });

  const colBuckets = new Map<number, number[]>();
  rows
    .slice()
    .sort((a, b) => (rank.get(a.id)! - rank.get(b.id)!) || a.es - b.es || a.id - b.id)
    .forEach((r) => {
      const col = rank.get(r.id)!;
      if (!colBuckets.has(col)) colBuckets.set(col, []);
      colBuckets.get(col)!.push(r.id);
    });

  const byId = new Map<number, Cpm & { col: number; row: number }>();
  const rowsPerCol: number[] = [];
  const cols = Math.max(0, ...Array.from(colBuckets.keys())) + 1;
  for (let c = 0; c < cols; c++) {
    const list = colBuckets.get(c) ?? [];
    rowsPerCol[c] = list.length;
    list.forEach((id, i) => {
      byId.set(id, { ...idToRow.get(id)!, col: c, row: i });
    });
  }
  return { byId, cols, rowsPerCol };
}

/* --------------------------------- Page ----------------------------------- */

const NODE_W = 200;
const NODE_H = 108;
const COL_GAP = 96;
const ROW_GAP = 32;

export default function CpmPage() {
  const { data: projects = [] } = useProjects();
  const { data: allTasks = [], isLoading } = useTasks();

  const defaultProjectId = projects[0]?.id;
  const [projectId, setProjectId] = useState<number | null>(null);
  const activeProjectId = projectId ?? defaultProjectId ?? null;

  const tasks = useMemo(
    () => (activeProjectId ? allTasks.filter((t) => t.projectId === activeProjectId) : allTasks),
    [allTasks, activeProjectId]
  );

  const { rows: cpm, projectDuration } = useMemo(() => computeCpm(tasks), [tasks]);
  const laid = useMemo(() => layout(cpm), [cpm]);
  const maxRowsPerCol = Math.max(1, ...laid.rowsPerCol);
  const width = Math.max(720, laid.cols * (NODE_W + COL_GAP) + 40);
  const height = Math.max(300, maxRowsPerCol * (NODE_H + ROW_GAP) + 40);

  const criticalPath = useMemo(
    () => cpm.filter((r) => r.critical).sort((a, b) => a.es - b.es),
    [cpm]
  );

  return (
    <Layout title="CPM Diagram">
      <div className="space-y-6 p-6" data-testid="page-cpm">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Planning</p>
            <h1 className="text-2xl font-semibold tracking-tight">Critical Path Method</h1>
            <p className="text-sm text-muted-foreground">
              Activity-on-node network showing task dependencies, float, and the critical path — the longest chain of work that drives project completion.
            </p>
          </div>
          <div className="min-w-52">
            <Select
              value={activeProjectId ? String(activeProjectId) : ""}
              onValueChange={(v) => setProjectId(parseInt(v, 10))}
            >
              <SelectTrigger data-testid="select-project"><SelectValue placeholder="Choose project" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : cpm.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No tasks in this project yet.</CardContent></Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold">Network diagram</CardTitle>
                <Legend />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto rounded-b-lg border-t bg-muted/10">
                  <svg
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label="CPM network diagram"
                    data-testid="svg-cpm"
                  >
                    <defs>
                      <marker id="cpm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-muted-foreground" />
                      </marker>
                      <marker id="cpm-arrow-critical" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-red-500" />
                      </marker>
                    </defs>

                    {/* Edges */}
                    {cpm.flatMap((r) => {
                      const from = laid.byId.get(r.id)!;
                      return r.successors
                        .map((sid) => {
                          const to = laid.byId.get(sid);
                          if (!to) return null;
                          const x1 = 20 + from.col * (NODE_W + COL_GAP) + NODE_W;
                          const y1 = 20 + from.row * (NODE_H + ROW_GAP) + NODE_H / 2;
                          const x2 = 20 + to.col * (NODE_W + COL_GAP);
                          const y2 = 20 + to.row * (NODE_H + ROW_GAP) + NODE_H / 2;
                          const mx = (x1 + x2) / 2;
                          const crit = r.critical && laid.byId.get(sid)!.critical;
                          return (
                            <path
                              key={`${r.id}-${sid}`}
                              d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                              fill="none"
                              className={crit ? "stroke-red-500" : "stroke-muted-foreground/70"}
                              strokeWidth={crit ? 2 : 1.25}
                              markerEnd={crit ? "url(#cpm-arrow-critical)" : "url(#cpm-arrow)"}
                            />
                          );
                        })
                        .filter(Boolean);
                    })}

                    {/* Nodes */}
                    {Array.from(laid.byId.values()).map((n) => {
                      const x = 20 + n.col * (NODE_W + COL_GAP);
                      const y = 20 + n.row * (NODE_H + ROW_GAP);
                      return (
                        <g key={n.id} data-testid={`cpm-node-${n.id}`} transform={`translate(${x} ${y})`}>
                          <rect
                            width={NODE_W}
                            height={NODE_H}
                            rx={10}
                            className={cn(
                              "fill-background stroke-2",
                              n.critical ? "stroke-red-500" : "stroke-border"
                            )}
                          />
                          {/* Header strip */}
                          <rect
                            width={NODE_W}
                            height={22}
                            rx={10}
                            className={n.critical ? "fill-red-500/10" : "fill-muted/40"}
                          />
                          {/* Trim the bottom of the rounded rect strip so it looks flat where it meets the body */}
                          <rect y={12} width={NODE_W} height={10} className={n.critical ? "fill-red-500/10" : "fill-muted/40"} />
                          <text x={10} y={15} className="fill-foreground text-[10px] font-semibold uppercase tracking-widest">{n.code}</text>
                          <text x={NODE_W - 10} y={15} textAnchor="end" className="fill-muted-foreground text-[10px] font-medium">
                            {n.duration}d · slack {n.slack}d
                          </text>

                          {/* Title */}
                          <foreignObject x={10} y={26} width={NODE_W - 20} height={30}>
                            <div className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                              {n.label}
                            </div>
                          </foreignObject>

                          {/* ES / EF / LS / LF grid */}
                          <line x1={0} x2={NODE_W} y1={64} y2={64} className="stroke-border" />
                          <line x1={NODE_W / 2} x2={NODE_W / 2} y1={64} y2={NODE_H} className="stroke-border" />
                          <text x={NODE_W / 4} y={78} textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-widest">ES</text>
                          <text x={NODE_W / 4} y={96} textAnchor="middle" className="fill-foreground text-[13px] font-semibold tabular-nums">{n.es}</text>
                          <text x={(NODE_W * 3) / 4} y={78} textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-widest">EF</text>
                          <text x={(NODE_W * 3) / 4} y={96} textAnchor="middle" className="fill-foreground text-[13px] font-semibold tabular-nums">{n.ef}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Project summary</CardTitle></CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Total duration</span>
                    <span className="text-lg font-semibold tabular-nums" data-testid="stat-duration">{projectDuration}d</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Activities</span>
                    <span className="tabular-nums">{cpm.length}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">On critical path</span>
                    <span className="tabular-nums text-red-600 dark:text-red-500" data-testid="stat-critical">{criticalPath.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-semibold">Critical path</CardTitle>
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" />
                    Zero slack
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {criticalPath.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground">No critical path detected.</div>
                  ) : (
                    <ol className="divide-y">
                      {criticalPath.map((r, i) => {
                        const original = tasks.find((t) => t.id === r.id);
                        return (
                          <li key={r.id} className="flex items-start gap-3 p-3 text-sm" data-testid={`crit-row-${r.id}`}>
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.label}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {r.code} · {r.duration}d
                                {original?.startDate && original?.endDate
                                  ? ` · ${shortDate(original.startDate)} → ${shortDate(original.endDate)}`
                                  : ""}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Info className="size-4 text-muted-foreground" /> How to read this
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <p><span className="font-medium text-foreground">ES / EF</span> — earliest a task can start / finish based on predecessors.</p>
                  <p><span className="font-medium text-foreground">Slack</span> — days you can delay this task without pushing the project. Zero slack = critical.</p>
                  <p><span className="font-medium text-foreground">Red nodes and edges</span> — the critical path. Any delay here delays the whole project.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-red-500 bg-background" /> Critical
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded border-2 border-border bg-background" /> Non-critical
      </span>
    </div>
  );
}
