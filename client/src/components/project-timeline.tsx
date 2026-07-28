import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, Camera, HelpCircle, FileText, CheckSquare, ClipboardList,
  ListChecks, FileSignature, Truck, MessageSquare, StickyNote, Search,
  Flag, Layers, Plane, ShieldAlert, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EVENT_KINDS, EVENT_KIND_META, EVENT_CATEGORIES_ORDER, EVENT_CATEGORY_LABEL,
  eventKindsForCategory, type EventCategory,
} from "@shared/project-event-kinds";

// Timeline event as returned by GET /api/projects/:id/events.
// Shape matches ProjectEvent from shared/schema.ts but with all timestamps
// serialized to ISO strings.
type TimelineEvent = {
  id: number;
  projectId: number;
  organizationId: number | null;
  actorAccountId: number | null;
  actorName: string | null;
  kind: string;
  title: string;
  subtitle: string | null;
  meta: Record<string, any>;
  sourceType: string | null;
  sourceId: number | null;
  occurredAt: string;
  createdAt: string;
};

type EventsResponse = {
  events: TimelineEvent[];
  counts: Record<string, number>;
};

// --- Icon + colour resolution ---------------------------------------------
// Keep this map local to the client so the shared kinds file stays
// server-friendly (no lucide dependency). If a new kind lands without an
// entry here it falls back to the generic Clock icon.
const ICONS: Record<string, { icon: any; className: string }> = {
  [EVENT_KINDS.TIMESHEET_CLOCKIN]: { icon: Clock, className: "text-sky-500 bg-sky-500/10" },
  [EVENT_KINDS.TIMESHEET_CLOCKOUT]: { icon: Clock, className: "text-sky-600 bg-sky-500/10" },
  [EVENT_KINDS.TIMESHEET_SUBMITTED]: { icon: FileSignature, className: "text-sky-500 bg-sky-500/10" },
  [EVENT_KINDS.TIMESHEET_APPROVED]: { icon: FileSignature, className: "text-emerald-500 bg-emerald-500/10" },
  [EVENT_KINDS.PHOTO_UPLOADED]: { icon: Camera, className: "text-violet-500 bg-violet-500/10" },
  [EVENT_KINDS.OBSERVATION_LOGGED]: { icon: ShieldAlert, className: "text-amber-500 bg-amber-500/10" },
  [EVENT_KINDS.RFI_CREATED]: { icon: HelpCircle, className: "text-amber-500 bg-amber-500/10" },
  [EVENT_KINDS.RFI_RESOLVED]: { icon: HelpCircle, className: "text-emerald-500 bg-emerald-500/10" },
  [EVENT_KINDS.CHANGE_ORDER_CREATED]: { icon: FileText, className: "text-orange-500 bg-orange-500/10" },
  [EVENT_KINDS.CHANGE_ORDER_APPROVED]: { icon: FileText, className: "text-emerald-500 bg-emerald-500/10" },
  [EVENT_KINDS.PUNCH_CREATED]: { icon: CheckSquare, className: "text-red-500 bg-red-500/10" },
  [EVENT_KINDS.PUNCH_CLOSED]: { icon: CheckSquare, className: "text-emerald-500 bg-emerald-500/10" },
  [EVENT_KINDS.DAILY_LOG_SUBMITTED]: { icon: ClipboardList, className: "text-indigo-500 bg-indigo-500/10" },
  [EVENT_KINDS.DOC_UPLOADED]: { icon: FileSignature, className: "text-teal-500 bg-teal-500/10" },
  [EVENT_KINDS.BLUEPRINT_UPLOADED]: { icon: Layers, className: "text-teal-500 bg-teal-500/10" },
  [EVENT_KINDS.DRONE_CAPTURED]: { icon: Plane, className: "text-cyan-500 bg-cyan-500/10" },
  [EVENT_KINDS.TASK_CREATED]: { icon: ListChecks, className: "text-blue-500 bg-blue-500/10" },
  [EVENT_KINDS.TASK_COMPLETED]: { icon: ListChecks, className: "text-emerald-500 bg-emerald-500/10" },
  [EVENT_KINDS.PROJECT_CREATED]: { icon: Flag, className: "text-primary bg-primary/10" },
  [EVENT_KINDS.MEMBER_ADDED]: { icon: User, className: "text-primary bg-primary/10" },
  [EVENT_KINDS.MILESTONE_REACHED]: { icon: Flag, className: "text-fuchsia-500 bg-fuchsia-500/10" },
  [EVENT_KINDS.EQUIPMENT_ADDED]: { icon: Truck, className: "text-gray-500 bg-gray-500/10" },
  [EVENT_KINDS.MESSAGE_POSTED]: { icon: MessageSquare, className: "text-slate-500 bg-slate-500/10" },
  [EVENT_KINDS.NOTE_ADDED]: { icon: StickyNote, className: "text-amber-500 bg-amber-500/10" },
};

function iconFor(kind: string) {
  return ICONS[kind] ?? { icon: Clock, className: "text-muted-foreground bg-muted" };
}

// Deep link back to the source entity's screen. We route by sourceType so
// a click on any row jumps to the RFIs page, punch list, etc. — with the
// projectId in the query so those pages can pre-filter (the server keeps
// them all project-aware already).
function deepLinkFor(ev: TimelineEvent): string | null {
  if (!ev.sourceType || !ev.sourceId) return null;
  const pid = ev.projectId;
  switch (ev.sourceType) {
    case "rfi": return `/rfis?projectId=${pid}`;
    case "change_order": return `/change-orders?projectId=${pid}`;
    case "punch": return `/punch?projectId=${pid}`;
    case "daily_log": return `/daily-logs?projectId=${pid}`;
    case "task": return `/tasks?projectId=${pid}`;
    case "photo": return `/photos?projectId=${pid}`;
    case "document": return `/documents?projectId=${pid}`;
    case "blueprint": return `/blueprints?projectId=${pid}`;
    case "drone_capture": return `/drone?projectId=${pid}`;
    case "timesheet": return `/timesheets?open=${ev.sourceId}`;
    case "field_punch": return `/timesheets?projectId=${pid}`;
    case "field_observation": return `/rfis?projectId=${pid}`;
    case "milestone": return `/milestones?projectId=${pid}`;
    case "equipment": return `/equipment`;
    case "message": return `/messages?projectId=${pid}`;
    case "note": return `/projects/${pid}`;
    default: return null;
  }
}

// Format the event's timestamp as HH:mm in the user's local timezone.
function timeOfDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Group by YYYY-MM-DD day header. Returns [dayIso, events[]] pairs preserving
// input order (server already returns DESC).
function groupByDay(events: TimelineEvent[]): [string, TimelineEvent[]][] {
  const map = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    const day = ev.occurredAt.slice(0, 10);
    const list = map.get(day) ?? [];
    list.push(ev);
    map.set(day, list);
  }
  return Array.from(map.entries());
}

function friendlyDay(iso: string): string {
  // iso is YYYY-MM-DD. Compare against today / yesterday to render "Today" /
  // "Yesterday" instead of the full date so recent activity is easy to scan.
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(d, today)) return `Today \u00b7 ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
  if (isSameDay(d, yest)) return `Yesterday \u00b7 ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// Compact initials from a name, for the actor avatar.
function initials(name: string | null | undefined): string {
  if (!name) return "\u00b7";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || name.slice(0, 2).toUpperCase();
}

export function ProjectTimeline({ projectId }: { projectId: number }) {
  const [query, setQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<EventCategory>>(new Set());

  // Which kinds to filter to on the server? Union of every kind in each
  // active category. Empty set means \u201cshow all\u201d (send no filter).
  const kindsParam = useMemo(() => {
    if (activeCats.size === 0) return "";
    const kinds: string[] = [];
    activeCats.forEach((cat) => kinds.push(...eventKindsForCategory(cat)));
    return kinds.join(",");
  }, [activeCats]);

  const { data, isLoading, error } = useQuery<EventsResponse>({
    queryKey: ["/api/projects", projectId, "events", query, kindsParam],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (query.trim()) p.set("q", query.trim());
      if (kindsParam) p.set("kinds", kindsParam);
      p.set("limit", "200");
      const res = await fetch(`/api/projects/${projectId}/events?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Timeline load failed (${res.status})`);
      return res.json();
    },
    // Timeline updates as users work \u2014 keep it fresh but not chatty.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const events = data?.events ?? [];
  const counts = data?.counts ?? {};

  // Sum kind counts per category for the filter chip badge.
  const categoryCounts = useMemo(() => {
    const out: Record<EventCategory, number> = {} as any;
    for (const cat of EVENT_CATEGORIES_ORDER) {
      const kinds = eventKindsForCategory(cat);
      out[cat] = kinds.reduce((acc, k) => acc + (counts[k] ?? 0), 0);
    }
    return out;
  }, [counts]);

  const grouped = useMemo(() => groupByDay(events), [events]);

  const toggleCat = (cat: EventCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search + filter row */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the timeline\u2026 (RFI number, punch title, name, keyword)"
            className="w-full rounded-md border border-border bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            data-testid="input-timeline-search"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EVENT_CATEGORIES_ORDER.map((cat) => {
            const on = activeCats.has(cat);
            const count = categoryCounts[cat] ?? 0;
            if (count === 0 && !on) return null; // hide empty categories
            return (
              <button
                key={cat}
                onClick={() => toggleCat(cat)}
                data-testid={`chip-${cat}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {EVENT_CATEGORY_LABEL[cat]}
                {count > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold tabular",
                    on ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground",
                  )}>{count}</span>
                )}
              </button>
            );
          })}
          {activeCats.size > 0 && (
            <button
              onClick={() => setActiveCats(new Set())}
              className="ml-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
              data-testid="button-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading timeline\u2026
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-500">
          Couldn't load the timeline. Try refreshing the page.
        </div>
      )}
      {!isLoading && !error && events.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center">
          <Clock className="mx-auto size-8 text-muted-foreground" />
          <div className="mt-3 font-display text-base font-semibold">Nothing captured yet</div>
          <p className="mt-1 text-sm text-muted-foreground">
            As your team clocks in, uploads photos, submits RFIs, and closes punch items,
            everything shows up here \u2014 timestamped and searchable.
          </p>
        </div>
      )}

      {/* Day-grouped feed */}
      {grouped.map(([day, dayEvents]) => (
        <div key={day} className="space-y-2">
          <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-background/95 px-1 py-2 backdrop-blur">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {friendlyDay(day)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ol className="space-y-1.5">
            {dayEvents.map((ev) => {
              const { icon: Icon, className } = iconFor(ev.kind);
              const link = deepLinkFor(ev);
              const kindMeta = EVENT_KIND_META[ev.kind];
              const row = (
                <div
                  className="group flex items-start gap-3 rounded-lg border border-transparent bg-card px-3 py-2.5 hover:border-border"
                  data-testid={`event-${ev.id}`}
                >
                  <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", className)}>
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 font-mono text-xs tabular text-muted-foreground">
                        {timeOfDay(ev.occurredAt)}
                      </span>
                      <span className="truncate text-sm font-medium text-foreground">
                        {ev.title}
                      </span>
                    </div>
                    {ev.subtitle && (
                      <div className="mt-0.5 line-clamp-1 pl-[52px] text-xs text-muted-foreground sm:pl-0">
                        {ev.subtitle}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {ev.actorName ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground">
                            {initials(ev.actorName)}
                          </span>
                          {ev.actorName}
                        </span>
                      ) : (
                        <span>System</span>
                      )}
                      {kindMeta && (
                        <>
                          <span>\u00b7</span>
                          <span>{kindMeta.label}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={ev.id}>
                  {link ? (
                    <a href={link} className="block transition-colors">{row}</a>
                  ) : row}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
