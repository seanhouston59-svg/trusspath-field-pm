import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Flag, Milestone, Layers, AlertTriangle, CalendarDays, Maximize2, Minimize2, Workflow, ChevronRight, BarChart3, X, FileText, ClipboardList, HelpCircle, Network } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { GhostGantt } from "@/components/ghost-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjects, useTasks, useChangeOrders, useSubmittals, useRfis, useSettings, useMilestones } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/format";

const LABEL_W = 268;
const BASE_PX_PER_DAY = 9;
const ROW_H = 40;
const SECTION_H = 34;
const HEADER_H = 78; // 20 (milestones) + 34 (months) + 24 (weeks)
const MILESTONE_H = 20;
const SUMMARY_H = 6;

// Cool operational palette — amber reserved for today / priority / brand.
const STATUS_BAR: Record<string, string> = {
  Complete: "bg-gradient-to-b from-emerald-400 to-emerald-600",
  "In Progress": "bg-gradient-to-b from-blue-400 to-blue-600",
  "Not Started": "bg-gradient-to-b from-slate-400 to-slate-500",
  Blocked: "bg-gradient-to-b from-red-400 to-red-600",
};
const STATUS_DOT: Record<string, string> = {
  Complete: "bg-emerald-500",
  "In Progress": "bg-blue-500",
  "Not Started": "bg-slate-400",
  Blocked: "bg-red-500",
};
const STATUS_PROGRESS: Record<string, number> = {
  Complete: 100, "In Progress": 62, "Not Started": 6, Blocked: 38,
};
const CO_BAR = "bg-gradient-to-b from-orange-400 to-orange-600";
const SUB_BAR = "bg-gradient-to-b from-violet-400 to-violet-600";
const RFI_BAR = "bg-gradient-to-b from-cyan-400 to-cyan-600";

function parseDate(iso: string): number { return new Date(iso + "T00:00:00").getTime(); }
function dayDiff(a: string, b: string): number { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type OverlayRow = {
  key: string; label: string; sub: string; kind: "CO" | "SUB" | "RFI";
  start: string; end: string; barClass: string; route: string; testId: string;
};

type BarSpec = {
  off: number; dur: number; color: string; progress?: number;
  label: string; title: string; testId: string; striped?: boolean; onClick?: () => void;
  priority?: "Critical" | "High" | null;
};
type RowSpec = {
  h: number; section?: boolean; summary?: BarSpec; empty?: string;
  label: ReactNode; bar?: BarSpec; laneColor?: string;
  taskId?: number;
};

export default function SchedulePage() {
  const { data: projects = [] } = useProjects();
  const { data: settings } = useSettings();
  const active = projects.filter((p) => p.status !== "Planning");
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (selectedId !== undefined) return;
    const dp = settings?.defaultProjectId;
    if (dp && dp > 0 && active.some((p) => p.id === dp)) setSelectedId(dp);
  }, [settings, active, selectedId]);
  const projectId = selectedId ?? active[0]?.id;
  const { data: tasks = [] } = useTasks(projectId);
  const { data: cos = [] } = useChangeOrders(projectId);
  const { data: subs = [] } = useSubmittals(projectId);
  const { data: rfis = [] } = useRfis(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const project = projects.find((p) => p.id === projectId);
  const [scrollLeft, setScrollLeft] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const [narrow, setNarrow] = useState(false);
  const [fs, setFs] = useState(false);
  const [visibleDays, setVisibleDays] = useState(14);
  const [vpWidth, setVpWidth] = useState(0);
  const [view, setView] = useState<"gantt" | "flow">("gantt");
  const [drill, setDrill] = useState<null | "tasks" | "risks">(null);
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFs(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs]);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const LABEL_W_RES = narrow ? 184 : LABEL_W;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setVpWidth(Math.max(0, el.clientWidth - LABEL_W_RES));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [LABEL_W_RES, project]);

  const PX_PER_DAY = visibleDays > 0 && vpWidth > 0 ? Math.max(BASE_PX_PER_DAY, Math.round(vpWidth / visibleDays)) : BASE_PX_PER_DAY;

  const { start, end, months, weeks, days, totalDays, todayOffset, timelineWidth } = useMemo(() => {
    if (!project) return { start: "", end: "", months: [] as string[], weeks: [] as string[], days: [] as string[], totalDays: 0, todayOffset: 0, timelineWidth: 0 };
    const s = project.startDate;
    const e = addMonths(project.endDate, 1);
    const total = Math.max(1, dayDiff(s, e));
    const ms: string[] = [];
    let cur = s;
    while (parseDate(cur) < parseDate(e)) { ms.push(cur); cur = addMonths(cur, 1); }
    const ws: string[] = [];
    let cw = s;
    while (parseDate(cw) < parseDate(e)) { ws.push(cw); cw = addDays(cw, 7); }
    const ds: string[] = [];
    let cd = s;
    while (parseDate(cd) < parseDate(e)) { ds.push(cd); cd = addDays(cd, 1); }
    const today = new Date().toISOString().slice(0, 10);
    const off = dayDiff(s, today);
    return { start: s, end: e, months: ms, weeks: ws, days: ds, totalDays: total, todayOffset: off, timelineWidth: total * PX_PER_DAY };
  }, [project, PX_PER_DAY]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (todayOffset > 0) {
      el.scrollTo({ left: Math.max(0, todayOffset * PX_PER_DAY - vpWidth * 0.3), behavior: "auto" });
    }
  }, [todayOffset, projectId, PX_PER_DAY, vpWidth, visibleDays]);

  const overlays = useMemo<OverlayRow[]>(() => {
    if (!project) return [];
    const rows: OverlayRow[] = [];
    cos.forEach((c) => {
      const s = c.dateIssued;
      const dur = Math.max(3, c.scheduleImpact || 0);
      const endDate = new Date(parseDate(s) + dur * 86400000).toISOString().slice(0, 10);
      rows.push({ key: `co-${c.id}`, label: `${c.number}`, sub: `CO · ${c.status}`, kind: "CO", start: s, end: endDate, barClass: CO_BAR, route: "/change-orders", testId: `gantt-co-${c.id}` });
    });
    subs.forEach((s) => {
      rows.push({ key: `sub-${s.id}`, label: `${s.number}`, sub: `Submittal · ${s.status}`, kind: "SUB", start: s.dateSubmitted, end: s.dueDate, barClass: SUB_BAR, route: "/submittals", testId: `gantt-sub-${s.id}` });
    });
    rfis.forEach((r) => {
      rows.push({ key: `rfi-${r.id}`, label: `${r.number}`, sub: `RFI · ${r.status}`, kind: "RFI", start: r.dateCreated, end: r.dueDate, barClass: RFI_BAR, route: "/rfis", testId: `gantt-rfi-${r.id}` });
    });
    return rows;
  }, [cos, subs, rfis, project]);

  // Group tasks into trade/phase lanes with a summary bar each.
  const rows: RowSpec[] = useMemo(() => {
    if (!project) return [];
    const out: RowSpec[] = [];
    const section = (label: ReactNode, count: number, color: string, summary?: BarSpec) => out.push({
      h: SECTION_H, section: true, summary,
      label: (
        <div className="flex items-center gap-2">
          <span className={cn("inline-block size-2.5 rounded-sm", color)} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground/70">({count})</span>
        </div>
      ),
    });

    if (!tasks.length) {
      section("Schedule", 0, "bg-primary");
      out.push({ h: 92, empty: "No scheduled tasks for this project yet.", label: <span /> });
    } else {
      const tradeOrder: string[] = [];
      tasks.forEach((t) => { if (!tradeOrder.includes(t.trade)) tradeOrder.push(t.trade); });
      tradeOrder.forEach((trade) => {
        const group = tasks.filter((t) => t.trade === trade);
        const starts = group.map((t) => t.startDate ?? project.startDate);
        const ends = group.map((t) => t.endDate ?? t.dueDate);
        const minStart = starts.reduce((a, b) => (a < b ? a : b));
        const maxEnd = ends.reduce((a, b) => (a > b ? a : b));
        const avg = Math.round(group.reduce((a, t) => a + (STATUS_PROGRESS[t.status] ?? 0), 0) / group.length);
        const soff = Math.max(0, dayDiff(start, minStart));
        const sdur = Math.max(3, dayDiff(minStart, maxEnd));
        const summaryBar: BarSpec = {
          off: soff, dur: sdur, color: "bg-gradient-to-b from-slate-400 to-slate-500",
          progress: avg, label: "", title: `${trade} · ${avg}% · ${group.length} task(s)`,
          testId: `gantt-summary-${trade}`, priority: null,
        };
        section(trade, group.length, STATUS_DOT[group[0].status] ?? "bg-slate-400", summaryBar);
        group.forEach((t) => {
          const ts = t.startDate ?? project.startDate;
          const te = t.endDate ?? t.dueDate;
          const off = Math.max(0, dayDiff(start, ts));
          const dur = Math.max(3, dayDiff(ts, te));
          const color = STATUS_BAR[t.status] ?? STATUS_BAR["Not Started"];
          const priority = (t.priority === "Critical" || t.priority === "High") ? (t.priority as "Critical" | "High") : null;
          out.push({
            h: ROW_H,
            taskId: t.id,
            label: (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium leading-tight">{t.title}</div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[t.status] ?? "bg-slate-400")} />
                  {t.status}
                </div>
              </div>
            ),
            bar: {
              off, dur, color, progress: STATUS_PROGRESS[t.status] ?? 0,
              label: priority ?? "", title: `${t.title} · ${shortDate(ts)} – ${shortDate(te)} · ${t.status}`,
              testId: `gantt-bar-${t.id}`, priority,
            },
          });
        });
      });
    }

    const riskCount = cos.length + subs.length + rfis.length;
    if (riskCount) {
      section("Risk & Approvals", riskCount, "bg-amber-500");
      if (cos.length) {
        section(<span className="normal-case tracking-normal text-muted-foreground/80">Change Orders</span>, cos.length, "bg-orange-500");
        overlays.filter((r) => r.kind === "CO").forEach((r) => pushOverlay(out, r, start));
      }
      if (subs.length) {
        section(<span className="normal-case tracking-normal text-muted-foreground/80">Submittals</span>, subs.length, "bg-violet-500");
        overlays.filter((r) => r.kind === "SUB").forEach((r) => pushOverlay(out, r, start));
      }
      if (rfis.length) {
        section(<span className="normal-case tracking-normal text-muted-foreground/80">RFIs</span>, rfis.length, "bg-cyan-500");
        overlays.filter((r) => r.kind === "RFI").forEach((r) => pushOverlay(out, r, start));
      }
    }
    return out;
  }, [tasks, overlays, cos, subs, rfis, project, start]);

  // Build per-task geometry map: taskId -> { yCenter, xStart, xEnd }
  const taskGeom = useMemo(() => {
    const map = new Map<number, { y: number; x1: number; x2: number }>();
    let y = 0;
    rows.forEach((r) => {
      if (r.taskId && r.bar) {
        const yCenter = y + r.h / 2;
        const x1 = r.bar.off * PX_PER_DAY;
        const x2 = (r.bar.off + r.bar.dur) * PX_PER_DAY;
        map.set(r.taskId, { y: yCenter, x1, x2 });
      }
      y += r.h;
    });
    return map;
  }, [rows, PX_PER_DAY]);

  // Dependency arrows: for each task with dependsOn, draw finish-to-start L-shaped arrow
  const depArrows = useMemo(() => {
    const arrows: Array<{ id: string; d: string; slipped: boolean }> = [];
    tasks.forEach((t) => {
      if (!t.dependsOn) return;
      const succ = taskGeom.get(t.id);
      if (!succ) return;
      const predIds = String(t.dependsOn).split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n));
      predIds.forEach((pid) => {
        const pred = taskGeom.get(pid);
        if (!pred) return;
        // Check if successor starts before predecessor ends (schedule slip / risk)
        const slipped = succ.x1 < pred.x2 - 1;
        // L-shape: right edge of predecessor → left edge of successor
        const startX = pred.x2;
        const startY = pred.y;
        const endX = succ.x1;
        const endY = succ.y;
        // Route with a small horizontal stub before the vertical bend to avoid overlap with bar cap
        const stub = 8;
        const midX = Math.max(startX + stub, endX - stub);
        const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
        arrows.push({ id: `${pid}->${t.id}`, d, slipped });
      });
    });
    return arrows;
  }, [tasks, taskGeom]);

  const overallPct = tasks.length
    ? Math.round(tasks.reduce((a, t) => a + (STATUS_PROGRESS[t.status] ?? 0), 0) / tasks.length)
    : 0;
  const riskCount = cos.length + subs.length + rfis.length;
  const phases = useMemo(() => {
    if (!project || !tasks.length) return [];
    const order: string[] = [];
    tasks.forEach((t) => { if (!order.includes(t.trade)) order.push(t.trade); });
    return order.map((trade) => {
      const group = tasks.filter((t) => t.trade === trade);
      const avg = Math.round(group.reduce((a, t) => a + (STATUS_PROGRESS[t.status] ?? 0), 0) / group.length);
      const starts = group.map((t) => t.startDate ?? project.startDate).sort();
      const ends = group.map((t) => t.endDate ?? t.dueDate ?? project.endDate).sort();
      const lead = group[0];
      return {
        trade, count: group.length, avg,
        color: STATUS_DOT[lead.status] ?? "bg-slate-400",
        bar: STATUS_BAR[lead.status] ?? STATUS_BAR["Not Started"],
        start: shortDate(starts[0]), end: shortDate(ends[ends.length - 1]),
      };
    });
  }, [tasks, project]);
  const riskNodes = [
    { kind: "CO", label: "Change Orders", count: cos.length, color: "bg-orange-500", route: "/change-orders" },
    { kind: "SUB", label: "Submittals", count: subs.length, color: "bg-violet-500", route: "/submittals" },
    { kind: "RFI", label: "RFIs", count: rfis.length, color: "bg-cyan-500", route: "/rfis" },
  ].filter((n) => n.count > 0);
  const bodyHeight = rows.reduce((a, r) => a + r.h, 0);
  const showToday = todayOffset >= 0 && todayOffset <= totalDays;

  const Bar = ({ b, tall }: { b: BarSpec; tall?: boolean }) => {
    return (
      <div
        className={cn(
          "group/bar absolute top-1/2 -translate-y-1/2",
          b.onClick && "cursor-pointer",
        )}
        style={{ left: b.off * PX_PER_DAY, width: b.dur * PX_PER_DAY }}
        title={b.title}
        data-testid={b.testId}
        onClick={b.onClick}
        role={b.onClick ? "button" : undefined}
        tabIndex={b.onClick ? 0 : undefined}
        onKeyDown={b.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); b.onClick?.(); } } : undefined}
      >
        <div
          className={cn(
            "relative flex items-center overflow-hidden rounded-full text-[10px] font-semibold text-white shadow-sm ring-1 ring-inset ring-white/20 transition",
            tall ? "h-[22px]" : "h-2.5",
            b.onClick && "cursor-pointer group-hover/bar:brightness-110 group-hover/bar:ring-2 group-hover/bar:ring-white/40",
            !tall && "opacity-80",
          )}
          style={{ width: b.dur * PX_PER_DAY }}
        >
          <div className={cn("absolute inset-0", b.color)} />
          {b.progress !== undefined && b.progress > 0 && (
            <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${b.progress}%` }} />
          )}
          {b.striped && (
            <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 5px, transparent 5px 10px)" }} />
          )}
          {tall && (
            <span className="relative z-10 flex items-center gap-1 truncate px-2.5 drop-shadow-sm">
              {b.priority && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1.5 py-px text-[8px] font-bold uppercase text-white">
                  <AlertTriangle className="size-2.5" />{b.priority}
                </span>
              )}
              {!b.priority && b.label && <span className="truncate">{b.label}</span>}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout title="Gantt">
      {/* Project selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project:</span>
        {active.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            data-testid={`gantt-project-${p.id}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", projectId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {p.name.split(" ")[0]}
          </button>
        ))}
        <Link
          href="/cpm"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="link-cpm"
        >
          <Network className="size-3.5" /> CPM Diagram
        </Link>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" data-testid="gantt-view-tabs">
          <button onClick={() => setView("gantt")} data-testid="gantt-view-gantt" className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", view === "gantt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <BarChart3 className="size-3.5" /> Gantt
          </button>
          <button onClick={() => setView("flow")} data-testid="gantt-view-flow" className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors", view === "flow" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <Workflow className="size-3.5" /> Flow Chart
          </button>
        </div>
      </div>

      {view === "flow" ? (
        project ? (
          <div className="rounded-xl border border-border bg-card pb-20 shadow-sm sm:pb-0">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-bold">Project Flow</div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Workflow className="size-3" /> {phases.length} phases · {tasks.length} tasks · {shortDate(project.startDate)} → {shortDate(project.endDate)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Stat icon={<Layers className="size-3.5" />} label="Tasks" value={String(tasks.length)} tint="text-blue-500" onClick={() => setDrill("tasks")} testId="flow-stat-tasks" />
                <Stat icon={<AlertTriangle className="size-3.5" />} label="Risks" value={String(riskCount)} tint="text-amber-500" onClick={() => setDrill("risks")} testId="flow-stat-risks" />
                <Stat icon={<Milestone className="size-3.5" />} label="Milestones" value={String(milestones.length)} tint="text-emerald-500" testId="flow-stat-milestones" />
                <Stat icon={<CalendarDays className="size-3.5" />} label="Span" value={`${totalDays}d`} tint="text-muted-foreground" onClick={() => setView("gantt")} testId="flow-stat-span" />
              </div>
            </div>

            {/* Phase flow */}
            <div className="overflow-x-auto px-4 py-5">
              <div className="flex items-stretch gap-2" style={{ minWidth: "max-content" }}>
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center">
                  <Flag className="size-4 text-primary" />
                  <div className="mt-1 text-[11px] font-semibold">Kickoff</div>
                  <div className="text-[10px] text-muted-foreground">{shortDate(project.startDate)}</div>
                </div>
                <div className="flex items-center"><ChevronRight className="size-5 text-muted-foreground/40" /></div>
                {phases.map((p, i) => (
                  <Fragment key={p.trade}>
                    <div data-testid={`flow-phase-${p.trade}`} className="relative flex w-[168px] flex-col gap-1.5 rounded-xl border border-border bg-card p-3 shadow-sm">
                      <span className={cn("absolute left-0 top-0 h-full w-1 rounded-l-xl", p.bar)} />
                      <div className="flex items-center justify-between pl-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{p.trade}</span>
                        <span className={cn("size-2.5 rounded-full", p.color)} />
                      </div>
                      <div className="pl-1.5 text-[10px] text-muted-foreground">{p.count} task(s) · {p.avg}%</div>
                      <div className="ml-1.5 h-1.5 w-[calc(100%-0.375rem)] overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", p.bar)} style={{ width: `${p.avg}%` }} />
                      </div>
                      <div className="pl-1.5 text-[10px] text-muted-foreground/80">{p.start} → {p.end}</div>
                    </div>
                    {i < phases.length - 1 && <div className="flex items-center"><ChevronRight className="size-5 text-muted-foreground/40" /></div>}
                  </Fragment>
                ))}
                <div className="flex items-center"><ChevronRight className="size-5 text-muted-foreground/40" /></div>
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-center">
                  <Milestone className="size-4 text-emerald-500" />
                  <div className="mt-1 text-[11px] font-semibold">Closeout</div>
                  <div className="text-[10px] text-muted-foreground">{shortDate(project.endDate)}</div>
                </div>
              </div>
            </div>

            {/* Risk & Approvals */}
            {riskNodes.length > 0 && (
              <div id="flow-risks" className="border-t border-border px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block size-2.5 rounded-sm bg-amber-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk & Approvals</span>
                </div>
                <div className="flex flex-wrap items-stretch gap-3">
                  {riskNodes.map((n) => (
                    <button key={n.kind} onClick={() => navigate(n.route)} data-testid={`flow-risk-${n.kind}`} className="group flex w-[150px] flex-col gap-1 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider">{n.label}</span>
                        <span className={cn("size-2.5 rounded-full", n.color)} />
                      </div>
                      <div className="text-2xl font-bold tabular-nums">{n.count}</div>
                      <div className="text-[10px] text-muted-foreground group-hover:text-primary">Open →</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">Status</span>
              {Object.entries(STATUS_BAR).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1.5"><span className={cn("inline-block h-3.5 w-6 rounded-full", v)} />{k}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
        )
      ) : !project ? (
        <div>
          <GhostGantt />
          <div className="mt-4 flex flex-col items-center justify-center py-8 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <BarChart3 className="size-6" />
            </div>
            <h3 className="font-display text-lg font-bold">No project selected</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">The sample Gantt above shows what your project schedule will look like. Create a project with start and end dates to populate the chart.</p>
            <Link href="/projects?new=1">
              <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                Create project
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className={cn("rounded-xl border border-border bg-card shadow-sm", fs ? "fixed inset-0 z-[80] flex flex-col overflow-auto bg-background p-3 sm:p-4" : "pb-20 sm:pb-0")}>
          {fs && (
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-display text-sm font-bold truncate">{project.name}</div>
                <div className="text-[11px] text-muted-foreground">{shortDate(project.startDate)} → {shortDate(project.endDate)} · {totalDays}d</div>
              </div>
              <button onClick={() => setFs(false)} data-testid="gantt-exit-fullscreen" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted">
                <Minimize2 className="size-3.5" /> Exit full screen
              </button>
            </div>
          )}
          {/* Top control strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="font-display text-sm font-bold">{project.name}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <CalendarDays className="size-3" /> {shortDate(project.startDate)} → {shortDate(project.endDate)}
                <span className="text-muted-foreground/60">· {totalDays} days</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Stat icon={<Layers className="size-3.5" />} label="Tasks" value={String(tasks.length)} tint="text-blue-500" onClick={() => setDrill("tasks")} testId="gantt-stat-tasks" />
              <Stat icon={<AlertTriangle className="size-3.5" />} label="Risks" value={String(riskCount)} tint="text-amber-500" onClick={() => setDrill("risks")} testId="gantt-stat-risks" />
              <Stat icon={<Milestone className="size-3.5" />} label="Milestones" value={String(milestones.length)} tint="text-emerald-500" testId="gantt-stat-milestones" />
              <Stat icon={<CalendarDays className="size-3.5" />} label="Span" value={`${totalDays}d`} tint="text-muted-foreground" />
              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" data-testid="gantt-zoom">
                {[{ d: 7, l: "1W" }, { d: 14, l: "2W" }, { d: 30, l: "1M" }, { d: 90, l: "Qtr" }, { d: 0, l: "All" }].map((o) => (
                  <button key={o.l} onClick={() => setVisibleDays(o.d)} data-testid={`gantt-zoom-${o.l}`} className={cn("rounded-md px-2 py-1 text-[11px] font-semibold transition-colors", visibleDays === o.d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{o.l}</button>
                ))}
              </div>
              <button onClick={() => setFs(true)} data-testid="gantt-fullscreen" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                <Maximize2 className="size-3.5" /> Full screen
              </button>
              <div className="hidden h-9 w-px bg-border sm:block" />
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                <div className="relative size-9">
                  <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E07412" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${(overallPct / 100) * 97.4} 97.4`} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">{overallPct}%</span>
                </div>
                <div className="leading-tight">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Overall</div>
                  <div className="text-[11px] font-semibold">Progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div ref={scrollRef} onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)} className="overflow-x-auto" data-testid="gantt-scroll">
            <div className="flex" style={{ width: LABEL_W_RES + timelineWidth }}>
              {/* Sticky label column */}
              <div className="shrink-0 border-r border-border bg-card" style={{ width: LABEL_W_RES, position: "sticky", left: 0, zIndex: 30 }}>
                <div className="flex items-center px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur" style={{ height: HEADER_H, borderBottom: "1px solid hsl(var(--border))" }}>
                  Work Breakdown
                </div>
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={cn("flex items-center px-4", r.section ? "border-y border-amber-500/40 bg-amber-500/10" : "border-b border-amber-500/20 odd:bg-transparent even:bg-slate-500/[0.06]")}
                    style={{ height: r.h }}
                    data-testid={r.section ? `gantt-section-${i}` : r.bar ? `gantt-row-${i}` : `gantt-empty-${i}`}
                  >
                    {r.empty ? <span className="text-xs italic text-muted-foreground">{r.empty}</span> : r.label}
                  </div>
                ))}
              </div>

              {/* Timeline column */}
              <div className="relative" style={{ width: timelineWidth }}>
                {/* Two-tier glassy header */}
                <div className="relative sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur" style={{ height: HEADER_H }}>
                  {/* Milestone strip */}
                  <div className="absolute inset-x-0 top-0 border-b border-border/40 bg-gradient-to-b from-amber-500/[0.04] to-transparent" style={{ height: MILESTONE_H }}>
                    {milestones.map((m) => {
                      const off = dayDiff(start, m.date);
                      if (off < 0 || off > totalDays) return null;
                      const x = off * PX_PER_DAY;
                      const isRisk = m.status === "At Risk" || m.status === "Missed";
                      const isDone = m.status === "Complete";
                      const diaFill = isDone ? "fill-emerald-500 stroke-emerald-600"
                        : isRisk ? "fill-rose-500 stroke-rose-600"
                        : "fill-amber-500 stroke-amber-600";
                      return (
                        <div key={`ms-h-${m.id}`} className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: x }}
                          title={`${m.title} — ${shortDate(m.date)}${m.notes ? " — " + m.notes : ""} · ${m.status}`}
                          data-testid={`gantt-milestone-${m.id}`}>
                          <svg width="14" height="14" viewBox="0 0 14 14" className="drop-shadow-sm">
                            <path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" className={diaFill} strokeWidth="1.5" />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                  {months.map((m, i) => {
                    const off = dayDiff(start, m);
                    const next = months[i + 1] ?? end;
                    const w = (dayDiff(m, next)) * PX_PER_DAY;
                    const bandLeft = off * PX_PER_DAY;
                    // Keep label visible while band is scrolled through the viewport
                    const visibleLeft = Math.max(0, scrollLeft - bandLeft);
                    const maxOffset = Math.max(0, w - 88); // reserve room for label text
                    const labelOffset = Math.min(visibleLeft, maxOffset);
                    return (
                      <div key={m} className={cn("absolute h-[34px] border-l border-amber-500/25 overflow-hidden", i % 2 ? "bg-amber-500/[0.05]" : "bg-transparent")} style={{ top: MILESTONE_H, left: bandLeft, width: w }}>
                        <span className="absolute top-0 whitespace-nowrap px-2 text-[11px] font-semibold leading-[34px] text-foreground/80" style={{ left: labelOffset }}>
                          {new Date(m + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                  <div className="absolute left-0 h-6 border-t border-border w-full" style={{ top: MILESTONE_H + 34 }}>
                    {PX_PER_DAY >= 26 && days.length > 0 ? (
                      // Full day cells: weekday letter + day number
                      days.map((d) => {
                        const dt = new Date(d + "T00:00:00");
                        const off = dayDiff(start, d);
                        const dow = dt.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isMonthStart = dt.getDate() === 1;
                        return (
                          <div
                            key={d}
                            className={cn(
                              "absolute top-0 flex h-full flex-col items-center justify-center border-l",
                              isMonthStart ? "border-amber-500/40" : "border-border/30",
                              isWeekend && "bg-amber-500/[0.06]"
                            )}
                            style={{ left: off * PX_PER_DAY, width: PX_PER_DAY }}
                          >
                            <span className={cn("text-[8px] uppercase leading-none tracking-wide", isWeekend ? "text-amber-500/80" : "text-muted-foreground/60")}>
                              {dt.toLocaleDateString("en-US", { weekday: "narrow" })}
                            </span>
                            <span className={cn("text-[10px] font-semibold leading-tight tabular-nums", isWeekend ? "text-amber-600 dark:text-amber-400" : "text-foreground/80")}>
                              {dt.getDate()}
                            </span>
                          </div>
                        );
                      })
                    ) : PX_PER_DAY >= 14 ? (
                      // Weekly markers with day number on every week
                      weeks.map((w) => {
                        const off = dayDiff(start, w);
                        const dt = new Date(w + "T00:00:00");
                        const major = dt.getDate() <= 7;
                        return (
                          <div key={w} className="absolute top-0 h-full" style={{ left: off * PX_PER_DAY, width: 7 * PX_PER_DAY }}>
                            <div className={cn("absolute inset-y-0 left-0 w-px", major ? "bg-border/70" : "bg-border/40")} />
                            <span className="absolute left-1 top-1 text-[9px] font-semibold tabular-nums text-muted-foreground/80">
                              {dt.getDate()}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      // Sparse ticks (original behavior)
                      weeks.map((w, i) => {
                        const off = dayDiff(start, w);
                        const dt = new Date(w + "T00:00:00");
                        const major = dt.getDate() <= 7;
                        return (
                          <div key={w} className="absolute top-0 h-full" style={{ left: off * PX_PER_DAY }}>
                            <div className={cn("h-full w-px", major ? "bg-border/70" : "bg-border/30")} />
                            {i % 2 === 0 && (
                              <span className="absolute left-1 top-1 text-[8px] tabular-nums text-muted-foreground/70">
                                {dt.getDate()}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="relative" style={{ minHeight: bodyHeight }}>
                  {/* gridlines + month bands overlay */}
                  <div className="pointer-events-none absolute inset-0 z-0">
                    {months.map((m, i) => {
                      const off = dayDiff(start, m);
                      const next = months[i + 1] ?? end;
                      const w = dayDiff(m, next) * PX_PER_DAY;
                      return <div key={m} className={cn("absolute top-0 h-full border-l border-amber-500/20", i % 2 ? "bg-amber-500/[0.04]" : "bg-transparent")} style={{ left: off * PX_PER_DAY, width: w }} />;
                    })}
                    {weeks.map((w) => {
                      const off = dayDiff(start, w);
                      return <div key={w} className="absolute top-0 h-full w-px bg-border/20" style={{ left: off * PX_PER_DAY }} />;
                    })}
                    {PX_PER_DAY >= 26 && days.length > 0 && days.map((d) => {
                      const off = dayDiff(start, d);
                      const dt = new Date(d + "T00:00:00");
                      const dow = dt.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      return (
                        <div key={"d" + d} className={cn("absolute top-0 h-full", isWeekend && "bg-amber-500/[0.03]")} style={{ left: off * PX_PER_DAY, width: PX_PER_DAY }}>
                          <div className="h-full w-px bg-border/15" />
                        </div>
                      );
                    })}
                    {showToday && (
                      <div className="absolute top-0 h-full" style={{ left: todayOffset * PX_PER_DAY }}>
                        <div className="absolute top-0 h-full w-px bg-amber-500 shadow-[0_0_8px_rgba(224,116,18,0.6)]" />
                        <div className="absolute -left-7 -top-0 flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md">
                          <Flag className="size-2.5" /> TODAY
                        </div>
                      </div>
                    )}
                  </div>

                  {/* rows */}
                  {rows.map((r, i) => (
                    <div
                      key={i}
                      className={cn("relative", r.section ? "border-y border-amber-500/40 bg-amber-500/10" : "border-b border-amber-500/20 odd:bg-transparent even:bg-slate-500/[0.06] hover:bg-primary/5", r.bar && "group/row")}
                      style={{ height: r.h }}
                      data-testid={r.bar ? `gantt-track-${i}` : undefined}
                    >
                      {r.summary && (
                        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2" style={{ left: r.summary.off * PX_PER_DAY, width: r.summary.dur * PX_PER_DAY }}>
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-500/20" title={r.summary.title}>
                            <div className={cn("absolute inset-y-0 left-0 rounded-full", r.summary.color)} style={{ width: `${r.summary.progress ?? 0}%` }} />
                          </div>
                        </div>
                      )}
                      {r.bar && <Bar b={r.bar} tall />}
                    </div>
                  ))}

                  {/* Dependency arrows overlay (SVG, pointer-events-none so bars remain interactive) */}
                  {depArrows.length > 0 && (
                    <svg
                      className="pointer-events-none absolute inset-0 z-10"
                      width={timelineWidth}
                      height={bodyHeight}
                      viewBox={`0 0 ${timelineWidth} ${bodyHeight}`}
                      preserveAspectRatio="none"
                      data-testid="gantt-dep-arrows"
                    >
                      <defs>
                        <marker id="gantt-arrow-ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-slate-400 dark:text-slate-500" />
                        </marker>
                        <marker id="gantt-arrow-slip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-rose-500" />
                        </marker>
                      </defs>
                      {depArrows.map((a) => (
                        <path
                          key={a.id}
                          d={a.d}
                          fill="none"
                          strokeWidth={1.5}
                          strokeDasharray={a.slipped ? "4 3" : undefined}
                          className={a.slipped ? "stroke-rose-500" : "stroke-slate-400 dark:stroke-slate-500"}
                          markerEnd={a.slipped ? "url(#gantt-arrow-slip)" : "url(#gantt-arrow-ok)"}
                        />
                      ))}
                    </svg>
                  )}

                  {/* Milestone vertical guides in body (diamonds are in header) */}
                  {milestones.length > 0 && (
                    <div className="pointer-events-none absolute inset-0 z-[11]">
                      {milestones.map((m) => {
                        const off = dayDiff(start, m.date);
                        if (off < 0 || off > totalDays) return null;
                        const x = off * PX_PER_DAY;
                        const isRisk = m.status === "At Risk" || m.status === "Missed";
                        const isDone = m.status === "Complete";
                        const line = isDone ? "bg-emerald-500/25" : isRisk ? "bg-rose-500/40" : "bg-amber-500/25";
                        return (
                          <div key={m.id} className="absolute top-0 h-full" style={{ left: x }}>
                            <div className={cn("absolute inset-y-0 w-px", line)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide">Status</span>
            {Object.entries(STATUS_BAR).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="relative inline-block h-3.5 w-6 overflow-hidden rounded-full">
                  <span className={cn("absolute inset-0", v)} />
                  <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${STATUS_PROGRESS[k] ?? 0}%` }} />
                </span>
                {k}
              </span>
            ))}
            <span className="mx-1 h-3.5 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <span className="relative inline-block h-3.5 w-6 overflow-hidden rounded-full">
                <span className={cn("absolute inset-0", CO_BAR)} />
                <span className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 4px, transparent 4px 8px)" }} />
              </span>
              Change Order
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative inline-block h-3.5 w-6 overflow-hidden rounded-full">
                <span className={cn("absolute inset-0", SUB_BAR)} />
                <span className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 4px, transparent 4px 8px)" }} />
              </span>
              Submittal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative inline-block h-3.5 w-6 overflow-hidden rounded-full">
                <span className={cn("absolute inset-0", RFI_BAR)} />
                <span className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.7) 0 4px, transparent 4px 8px)" }} />
              </span>
              RFI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-px text-[8px] font-bold uppercase text-white"><AlertTriangle className="size-2.5" />High</span>
              Priority
            </span>
            <span className="mx-1 h-3.5 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 14 14" className="inline-block"><path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" className="fill-amber-500 stroke-amber-600" strokeWidth="1.5" /></svg>
              Milestone
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="11" height="11" viewBox="0 0 14 14" className="inline-block"><path d="M 7 1 L 13 7 L 7 13 L 1 7 Z" className="fill-rose-500 stroke-rose-600" strokeWidth="1.5" /></svg>
              At risk
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="22" height="6" viewBox="0 0 22 6" className="inline-block"><path d="M 0 3 L 22 3" className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" /></svg>
              Dependency
            </span>
            <span className="ml-auto flex items-center gap-1.5"><span className="inline-block h-3.5 w-px bg-amber-500" /> Today</span>
          </div>
        </div>
      )}

      <Dialog open={drill !== null} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0" data-testid={`drill-${drill ?? "none"}`}>
          <DialogHeader className="flex flex-row items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                {drill === "tasks" ? <><Layers className="size-4 text-blue-500" /> Tasks</> : <><AlertTriangle className="size-4 text-amber-500" /> Risk & Approvals</>}
              </DialogTitle>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {drill === "tasks" ? `${tasks.length} in ${project?.name ?? ""}` : `${riskCount} open item${riskCount === 1 ? "" : "s"} · ${cos.length} CO · ${subs.length} SUB · ${rfis.length} RFI`}
              </div>
            </div>
            <button type="button" onClick={() => setDrill(null)} data-testid="drill-close" aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-y-auto">
            {drill === "tasks" ? (
              tasks.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">No tasks scheduled yet.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {tasks.map((t) => {
                    const ts = t.startDate ?? project?.startDate ?? "";
                    const te = t.endDate ?? t.dueDate ?? "";
                    const dot = STATUS_DOT[t.status] ?? "bg-slate-400";
                    const isPriority = t.priority === "Critical" || t.priority === "High";
                    return (
                      <li key={t.id} data-testid={`drill-task-${t.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40">
                        <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", dot)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold">{t.title}</div>
                            {isPriority && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/90 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                                <AlertTriangle className="size-2.5" />{t.priority}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="font-medium uppercase tracking-wide">{t.trade}</span>
                            <span>{t.status}</span>
                            {ts && te && <span>{shortDate(ts)} → {shortDate(te)}</span>}
                          </div>
                        </div>
                        <button type="button" onClick={() => { setDrill(null); navigate("/tasks"); }} className="shrink-0 self-center rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground">Open</button>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : (
              <div className="divide-y divide-border">
                {cos.length > 0 && (
                  <RiskSection title="Change Orders" icon={<FileText className="size-3.5 text-orange-500" />} route="/change-orders" onNavigate={(r) => { setDrill(null); navigate(r); }}>
                    {cos.map((c) => (
                      <li key={c.id} data-testid={`drill-co-${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{c.number} · {c.title}</div>
                          <div className="text-[11px] text-muted-foreground">{c.status} · Issued {shortDate(c.dateIssued)} · {c.scheduleImpact ?? 0}d impact</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">CO</span>
                      </li>
                    ))}
                  </RiskSection>
                )}
                {subs.length > 0 && (
                  <RiskSection title="Submittals" icon={<ClipboardList className="size-3.5 text-violet-500" />} route="/submittals" onNavigate={(r) => { setDrill(null); navigate(r); }}>
                    {subs.map((s) => (
                      <li key={s.id} data-testid={`drill-sub-${s.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{s.number} · {s.subject}</div>
                          <div className="text-[11px] text-muted-foreground">{s.status} · Due {shortDate(s.dueDate)}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600 dark:text-violet-400">SUB</span>
                      </li>
                    ))}
                  </RiskSection>
                )}
                {rfis.length > 0 && (
                  <RiskSection title="RFIs" icon={<HelpCircle className="size-3.5 text-cyan-500" />} route="/rfis" onNavigate={(r) => { setDrill(null); navigate(r); }}>
                    {rfis.map((r) => (
                      <li key={r.id} data-testid={`drill-rfi-${r.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{r.number} · {r.subject}</div>
                          <div className="text-[11px] text-muted-foreground">{r.status} · Due {shortDate(r.dueDate)}</div>
                        </div>
                        <span className="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400">RFI</span>
                      </li>
                    ))}
                  </RiskSection>
                )}
                {riskCount === 0 && <div className="px-5 py-10 text-center text-sm text-muted-foreground">No open change orders, submittals, or RFIs.</div>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );

  function RiskSection({ title, icon, route, onNavigate, children }: { title: string; icon: ReactNode; route: string; onNavigate: (r: string) => void; children: ReactNode }) {
    return (
      <section>
        <div className="flex items-center justify-between px-5 py-2 bg-muted/30">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{icon} {title}</div>
          <button type="button" onClick={() => onNavigate(route)} className="text-[10px] font-semibold text-primary hover:underline">View all →</button>
        </div>
        <ul>{children}</ul>
      </section>
    );
  }

  function Stat({ icon, label, value, tint, onClick, testId }: { icon: ReactNode; label: string; value: string; tint: string; onClick?: () => void; testId?: string }) {
    const cls = cn("flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5 transition-colors", onClick && "cursor-pointer hover:border-primary/40 hover:bg-muted/60");
    const inner = (
      <>
        <span className={cn("shrink-0", tint)}>{icon}</span>
        <div className="leading-tight text-left">
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-[12px] font-bold tabular-nums">{value}</div>
        </div>
      </>
    );
    if (onClick) {
      return (
        <button type="button" onClick={onClick} data-testid={testId} className={cls}>{inner}</button>
      );
    }
    return <div className={cls} data-testid={testId}>{inner}</div>;
  }

  function pushOverlay(out: RowSpec[], r: OverlayRow, startISO: string) {
    const off = Math.max(0, dayDiff(startISO, r.start));
    const dur = Math.max(3, dayDiff(r.start, r.end));
    out.push({
      h: ROW_H,
      label: (
        <div className="min-w-0">
          <button onClick={() => navigate(r.route)} className="block w-full truncate text-left text-[13px] font-medium leading-tight text-primary hover:underline" data-testid={`gantt-link-${r.key}`}>{r.label}</button>
          <div className="text-[10px] text-muted-foreground">{r.sub}</div>
        </div>
      ),
      bar: {
        off, dur, color: r.barClass, striped: true,
        label: r.label, title: `${r.label} · ${shortDate(r.start)} – ${shortDate(r.end)}`,
        testId: r.testId, onClick: () => navigate(r.route),
      },
    });
  }
}
