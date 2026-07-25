import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Download, Upload, Calendar as CalIcon, ChevronLeft, ChevronRight, ExternalLink, Network, Plus, Pencil, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useProjects, useTasks, useRfis, useSubmittals, useChangeOrders, useMilestones, useCreateMilestone, useUpdateMilestone, useDeleteMilestone } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [showAll, setShowAll] = useState(true);
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
  const projectId = showAll ? undefined : (selectedId ?? active[0]?.id);
  const project = projects.find((p) => p.id === projectId);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  const { data: tasks = [] } = useTasks(projectId);
  const { data: rfis = [] } = useRfis(projectId);
  const { data: subs = [] } = useSubmittals(projectId);
  const { data: cos = [] } = useChangeOrders(projectId);
  const { data: milestones = [] } = useMilestones(projectId);

  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  // Event dialog state
  const [eventDialog, setEventDialog] = useState<{ open: boolean; editId?: number; defaults?: { title?: string; date?: string; kind?: string; notes?: string } }>({ open: false });
  const [evTitle, setEvTitle] = useState("");
  const [evDate, setEvDate] = useState("");
  const [evKind, setEvKind] = useState("Milestone");
  const [evNotes, setEvNotes] = useState("");

  function openAddEvent(day: string) {
    setEvTitle(""); setEvDate(day); setEvKind("Milestone"); setEvNotes("");
    setEventDialog({ open: true });
  }
  function openEditEvent(m: { id: number; title: string; date: string; kind: string; notes?: string | null }) {
    setEvTitle(m.title); setEvDate(m.date); setEvKind(m.kind); setEvNotes(m.notes ?? "");
    setEventDialog({ open: true, editId: m.id });
  }
  function submitEvent() {
    const targetProject = project ?? projects[0];
    if (!targetProject || !evTitle.trim() || !evDate) return;
    const payload = { projectId: targetProject.id, title: evTitle.trim(), date: evDate, kind: evKind, status: "Scheduled", notes: evNotes.trim() || undefined };
    if (eventDialog.editId) {
      updateMilestone.mutate({ id: eventDialog.editId, data: payload }, { onSuccess: () => setEventDialog({ open: false }) });
    } else {
      createMilestone.mutate(payload, { onSuccess: () => setEventDialog({ open: false }) });
    }
  }

  const [imported, setImported] = useState<CalEvent[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // view month
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<string>(todayIso());

  const fieldEvents = useMemo<CalEvent[]>(() => {
    const evs: CalEvent[] = [];
    const pName = (pid: number) => showAll ? `${projectMap.get(pid) ?? ""} · ` : "";

    // When a single project is selected, use its dates as fallback; otherwise require item dates
    tasks.forEach((t) => {
      const s = clamp(t.startDate ?? project?.startDate ?? ""); const e = clamp(t.endDate ?? t.dueDate ?? "");
      if (s && e) evs.push({ id: `task-${t.id}`, title: `${pName(t.projectId)}${t.title}`, type: "Task", source: "TrussPath", start: s, end: e, description: `${t.trade} · ${t.status}` });
    });
    rfis.forEach((r) => {
      const s = clamp(r.dateCreated); const e = clamp(r.dueDate);
      if (s && e) evs.push({ id: `rfi-${r.id}`, title: `${pName(r.projectId)}${r.number} ${r.subject}`, type: "RFI", source: "TrussPath", start: s, end: e, description: `RFI · ${r.status}` });
    });
    subs.forEach((s2) => {
      const s = clamp(s2.dateSubmitted); const e = clamp(s2.dueDate);
      if (s && e) evs.push({ id: `sub-${s2.id}`, title: `${pName(s2.projectId)}${s2.number} ${s2.subject}`, type: "Submittal", source: "TrussPath", start: s, end: e, description: `Submittal · ${s2.status}` });
    });
    cos.forEach((c) => {
      const s = clamp(c.dateIssued); const e = s ? (c.scheduleImpact > 0 ? addDays(s, c.scheduleImpact) : s) : null;
      if (s && e) evs.push({ id: `co-${c.id}`, title: `${pName(c.projectId)}${c.number} ${c.title}`, type: "Change Order", source: "TrussPath", start: s, end: e, description: `CO · ${c.status} · $${c.amount.toLocaleString()}` });
    });

    // Project start/end milestones for all visible projects
    const visProjects = project ? [project] : projects;
    visProjects.forEach((p) => {
      if (p.startDate) evs.push({ id: `ms-s-${p.id}`, title: `${showAll ? `${p.name} — ` : ""}Start`, type: "Milestone", source: "TrussPath", start: p.startDate, end: p.startDate, description: "Project start" });
      if (p.endDate) evs.push({ id: `ms-e-${p.id}`, title: `${showAll ? `${p.name} — ` : ""}Completion`, type: "Milestone", source: "TrussPath", start: p.endDate, end: p.endDate, description: "Project end" });
    });

    milestones.forEach((m) => {
      const d = clamp(m.date);
      if (d) evs.push({ id: `milestone-${m.id}`, title: `${showAll ? `${projectMap.get(m.projectId) ?? ""} · ` : ""}${m.title}`, type: "Milestone", source: "TrussPath", start: d, end: d, description: m.notes || m.kind });
    });
    return evs;
  }, [project, projects, showAll, projectMap, tasks, rfis, subs, cos, milestones]);

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
    const label = showAll ? "All Projects" : (project?.name ?? "TrussPath");
    const ics = buildICS(fieldEvents, `${label} Schedule`);
    downloadICS(`${label.replace(/\s+/g, "-").toLowerCase()}-schedule.ics`, ics);
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
        <button onClick={() => setShowAll(true)}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", showAll ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          data-testid="sched-all-projects">
          All Projects
        </button>
        {active.map((p) => (
          <button key={p.id} onClick={() => { setShowAll(false); setSelectedId(p.id); }}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", !showAll && projectId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
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
          <Button size="sm" variant="default" onClick={() => openAddEvent(selectedDay)} data-testid="button-add-event"><Plus className="size-4" /> Add Event</Button>
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No events scheduled this day.</p>
            <Button size="sm" variant="outline" onClick={() => openAddEvent(selectedDay)} data-testid="button-add-event-day"><Plus className="size-4" /> Add Event</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...selectedEvents].reverse().map(({ event }, i) => {
              const st = styleFor(event.type);
              const range = event.start === event.end ? shortDate(event.start) : `${shortDate(event.start)} – ${shortDate(event.end)}`;
              const milestoneId = event.id.startsWith("milestone-") ? parseInt(event.id.replace("milestone-", ""), 10) : null;
              return (
                <div key={i} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-2.5" data-testid={`sched-detail-${event.id}`}>
                  <span className={cn("size-2.5 shrink-0 rounded-full", st.bar)} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">{range}{event.description ? ` · ${event.description}` : ""}</div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", st.chip)}>{event.type}</span>
                  {event.source === "Google Calendar" && <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">Google</span>}
                  {milestoneId && milestones.find((m) => m.id === milestoneId) && (
                    <>
                      <button onClick={() => openEditEvent(milestones.find((m) => m.id === milestoneId)!)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary" data-testid={`button-edit-event-${milestoneId}`}>
                        <Pencil className="size-3.5" /> Edit
                      </button>
                      <button onClick={() => { if (milestoneId) deleteMilestone.mutate(milestoneId); }} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-red-500 transition hover:border-red-500" data-testid={`button-delete-event-${milestoneId}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                  <a href={googleCalendarUrl(event)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary">
                    <CalendarPlus className="size-3.5" /> Google <ExternalLink className="size-3 opacity-60" />
                  </a>
                </div>
              );
            })}
            <Button size="sm" variant="outline" onClick={() => openAddEvent(selectedDay)} className="mt-2" data-testid="button-add-event-day"><Plus className="size-4" /> Add Event</Button>
          </div>
        )}
      </div>

      {/* spacer so the floating Jarvis launcher never overlaps content */}
      <div className="h-20" />

      {/* Add/Edit Event Dialog */}
      <Dialog open={eventDialog.open} onOpenChange={(o) => setEventDialog({ ...eventDialog, open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{eventDialog.editId ? "Edit Event" : "Add Calendar Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-title" className="text-xs">Title</Label>
              <Input id="ev-title" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} placeholder="Site mobilization" data-testid="field-ev-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-date" className="text-xs">Date</Label>
                <Input id="ev-date" type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} data-testid="field-ev-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-kind" className="text-xs">Type</Label>
                <Select value={evKind} onValueChange={setEvKind}>
                  <SelectTrigger id="ev-kind" data-testid="field-ev-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Milestone">Milestone</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                    <SelectItem value="Deadline">Deadline</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-notes" className="text-xs">Notes</Label>
              <Input id="ev-notes" value={evNotes} onChange={(e) => setEvNotes(e.target.value)} placeholder="Optional details" data-testid="field-ev-notes" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {eventDialog.editId && (
              <Button variant="destructive" size="sm" onClick={() => { deleteMilestone.mutate(eventDialog.editId!, { onSuccess: () => setEventDialog({ open: false }) }); }} data-testid="button-ev-delete">
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEventDialog({ open: false })}>Cancel</Button>
            <Button size="sm" onClick={submitEvent} disabled={!evTitle.trim() || !evDate || createMilestone.isPending || updateMilestone.isPending} data-testid="button-ev-save">
              {(createMilestone.isPending || updateMilestone.isPending) ? "Saving…" : eventDialog.editId ? "Save Changes" : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
