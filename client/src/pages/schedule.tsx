import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Download, Upload, Calendar as CalIcon, ChevronLeft, ChevronRight, ExternalLink, Network } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useProjects, useTasks, useRfis, useSubmittals, useChangeOrders } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/format";
import {
  type CalEvent, googleCalendarUrl, buildICS, downloadICS, parseICS,
} from "@/lib/calendar";

const TYPE_STYLE: Record<string, { bar: string; chip: string }> = {
  Task: { bar: "bg-primary", chip: "bg-primary/10 text-primary" },
  RFI: { bar: "bg-sky-500", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  Submittal: { bar: "bg-violet-500", chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  "Change Order": { bar: "bg-amber-500", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  Milestone: { bar: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  Imported: { bar: "bg-rose-500", chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};
function styleFor(type: string) { return TYPE_STYLE[type] ?? TYPE_STYLE.Task; }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
function clamp(iso: string): string | null {
  // accept YYYY-MM-DD only; reject non-date strings
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}
function todayIso(): string { return isoDate(new Date()); }

type DayEvent = { event: CalEvent; isStart: boolean };

export default function SchedulePage() {
  const { data: projects = [] } = useProjects();
  const active = projects.filter((p) => p.status !== "Planning");
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const projectId = selectedId ?? active[0]?.id;
  const project = projects.find((p) => p.id === projectId);

  const { data: tasks = [] } = useTasks(projectId);
  const { data: rfis = [] } = useRfis(projectId);
  const { data: subs = [] } = useSubmittals(projectId);
  const { data: cos = [] } = useChangeOrders(projectId);

  const [imported, setImported] = useState<CalEvent[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // view month
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());

  const fieldEvents = useMemo<CalEvent[]>(() => {
    if (!project) return [];
    const evs: CalEvent[] = [];
    tasks.forEach((t) => { const s = clamp(t.startDate ?? project.startDate); const e = clamp(t.endDate ?? t.dueDate); if (s && e) evs.push({ id: `task-${t.id}`, title: t.title, type: "Task", source: "TrussPath", start: s, end: e, description: `${t.trade} · ${t.status}` }); });
    rfis.forEach((r) => { const s = clamp(r.dateCreated); const e = clamp(r.dueDate); if (s && e) evs.push({ id: `rfi-${r.id}`, title: `${r.number} ${r.subject}`, type: "RFI", source: "TrussPath", start: s, end: e, description: `RFI · ${r.status}` }); });
    subs.forEach((s2) => { const s = clamp(s2.dateSubmitted); const e = clamp(s2.dueDate); if (s && e) evs.push({ id: `sub-${s2.id}`, title: `${s2.number} ${s2.subject}`, type: "Submittal", source: "TrussPath", start: s, end: e, description: `Submittal · ${s2.status}` }); });
    cos.forEach((c) => { const s = clamp(c.dateIssued); const e = s ? (c.scheduleImpact > 0 ? addDays(s, c.scheduleImpact) : s) : null; if (s && e) evs.push({ id: `co-${c.id}`, title: `${c.number} ${c.title}`, type: "Change Order", source: "TrussPath", start: s, end: e, description: `CO · ${c.status} · $${c.amount.toLocaleString()}` }); });
    if (project.startDate) evs.push({ id: `ms-s-${project.id}`, title: `${project.name} — Start`, type: "Milestone", source: "TrussPath", start: project.startDate, end: project.startDate, description: "Project start" });
    if (project.endDate) evs.push({ id: `ms-e-${project.id}`, title: `${project.name} — Completion`, type: "Milestone", source: "TrussPath", start: project.endDate, end: project.endDate, description: "Project end" });
    return evs;
  }, [project, tasks, rfis, subs, cos]);

  const allEvents = useMemo(() => [...fieldEvents, ...imported], [fieldEvents, imported]);

  // build 6-week grid starting on Sunday
  const gridDays = useMemo(() => {
    const monthStart = new Date(viewYear, viewMonth, 1);
    const startWeekday = monthStart.getDay();
    const gridStart = new Date(viewYear, viewMonth, 1 - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  // index events onto each grid day (multi-day events span as continuation bars)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const gridIso = gridDays.map(isoDate);
    const minDate = gridIso[0], maxDate = gridIso[gridIso.length - 1];
    for (const e of allEvents) {
      let cur = clamp(e.start); const end = clamp(e.end);
      if (!cur || !end) continue;
      while (cur <= end) {
        if (cur >= minDate && cur <= maxDate) {
          if (!map.has(cur)) map.set(cur, []);
          map.get(cur)!.push({ event: e, isStart: cur === e.start });
        }
        cur = addDays(cur, 1);
      }
    }
    return map;
  }, [allEvents, gridDays]);

  const today = todayIso();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
  };
  const goToday = () => { setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); setSelectedDay(today); };

  const handleExport = () => {
    const ics = buildICS(fieldEvents, `${project?.name ?? "TrussPath"} Schedule`);
    downloadICS(`${(project?.name ?? "trusspath").replace(/\s+/g, "-").toLowerCase()}-schedule.ics`, ics);
  };
  const handleImport = async (file: File) => {
    const text = await file.text();
    setImported((prev) => [...prev.filter((e) => e.source !== "Google Calendar"), ...parseICS(text)]);
  };

  const selectedEvents = eventsByDay.get(selectedDay) ?? [];
  const selectedDate = new Date(selectedDay + "T00:00:00");

  return (
    <Layout title="Schedule">
      {/* Project selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project:</span>
        {active.map((p) => (
          <button key={p.id} onClick={() => setSelectedId(p.id)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", projectId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
            {p.name.split(" ")[0]}
          </button>
        ))}
        <Link
          href="/cpm"
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          data-testid="link-cpm-schedule"
        >
          <Network className="size-3.5" /> CPM Diagram
        </Link>
      </div>

      {/* Google Calendar integration card */}
      <div className="mb-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><CalIcon className="size-5" /></div>
            <div>
              <h2 className="font-display text-sm font-bold">Google Calendar Integration</h2>
              <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
                Export the full schedule as an <span className="font-medium text-foreground">.ics</span> for Google Calendar, add any event with one click, or import a Google Calendar export to overlay here.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} data-testid="button-export-ics"><Download className="size-4" /> Export .ics</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-import-ics"><Upload className="size-4" /> Import .ics</Button>
            <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" data-testid="input-import-ics"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
          </div>
        </div>
        {imported.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-rose-500" />
            {imported.length} event{imported.length === 1 ? "" : "s"} loaded from Google Calendar export
            <button className="ml-1 text-rose-500 hover:underline" onClick={() => setImported([])} data-testid="button-clear-imported">clear</button>
          </div>
        )}
      </div>

      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold tracking-tight" data-testid="sched-month-label">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => shiftMonth(-1)} data-testid="sched-prev-month"><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={goToday} data-testid="sched-today">Today</Button>
          <Button size="icon" variant="outline" onClick={() => shiftMonth(1)} data-testid="sched-next-month"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" data-testid="sched-calendar">
        {/* weekday header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
        </div>
        {/* day cells */}
        <div className="grid grid-cols-7 grid-rows-6">
          {gridDays.map((d, i) => {
            const iso = isoDate(d);
            const inMonth = d.getMonth() === viewMonth;
            const isToday = iso === today;
            const isSelected = iso === selectedDay;
            const dayEvs = eventsByDay.get(iso) ?? [];
            const visible = dayEvs.slice(0, 3);
            const extra = dayEvs.length - visible.length;
            return (
              <button key={i} onClick={() => setSelectedDay(iso)} data-testid={`sched-day-${iso}`}
                className={cn(
                  "flex min-h-[96px] flex-col items-stretch border-b border-r border-border p-1 text-left align-top transition-colors hover:bg-muted/50",
                  !inMonth && "bg-muted/20 opacity-50",
                  isSelected && "ring-2 ring-inset ring-primary",
                  (i + 1) % 7 === 0 && "border-r-0",
                  i >= 35 && "border-b-0"
                )}>
                <span className={cn("mb-1 inline-flex size-6 items-center justify-center self-start rounded-full text-xs font-semibold", isToday ? "bg-primary text-primary-foreground" : "text-foreground")}>
                  {d.getDate()}
                </span>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {visible.map(({ event, isStart }, j) => {
                    const st = styleFor(event.type);
                    return (
                      <a key={j} href={googleCalendarUrl(event)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className={cn("flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-foreground/90 hover:opacity-90", st.bar, !isStart && "opacity-80")}
                        title={`${event.title}${event.start === event.end ? "" : ` (${shortDate(event.start)} – ${shortDate(event.end)})`}`}>
                        {!isStart && <span className="shrink-0">»</span>}
                        <span className="truncate">{isStart ? event.title : event.title}</span>
                      </a>
                    );
                  })}
                  {extra > 0 && <span className="px-1.5 text-[10px] font-medium text-muted-foreground">+{extra} more</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h3>
          <span className="text-xs text-muted-foreground">{selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}</span>
        </div>
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events scheduled this day.</p>
        ) : (
          <div className="space-y-2">
            {[...selectedEvents].reverse().map(({ event }, i) => {
              const st = styleFor(event.type);
              const range = event.start === event.end ? shortDate(event.start) : `${shortDate(event.start)} – ${shortDate(event.end)}`;
              return (
                <div key={i} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2.5" data-testid={`sched-detail-${event.id}`}>
                  <span className={cn("size-2.5 shrink-0 rounded-full", st.bar)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">{range}{event.description ? ` · ${event.description}` : ""}</div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", st.chip)}>{event.type}</span>
                  {event.source === "Google Calendar" && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">Google</span>}
                  <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary">
                    <CalendarPlus className="size-3.5" /> Add to Google <ExternalLink className="size-3 opacity-60" />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* spacer so the floating Jarvis launcher never overlaps content */}
      <div className="h-20" />
    </Layout>
  );
}
