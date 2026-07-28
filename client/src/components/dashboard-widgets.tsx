import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, CloudSun, StickyNote, ArrowRight, AlertTriangle, HelpCircle, GitPullRequestArrow, ClipboardList, Plus, ChevronDown, ChevronLeft, ChevronRight, CornerDownRight, Wrench, Car, HardHat, Flag, ClipboardCheck, ShieldAlert, Rocket } from "lucide-react";
import { Avatar } from "@/components/bits";
import { useCreateNote, useNotes, useAddNoteReply, useProjects, useEquipment } from "@/hooks/use-data";
import { relativeDays, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Task, Rfi, ChangeOrder, DailyLog, Project, Equipment } from "@shared/schema";

/* ---------------------------- Notifications ---------------------------- */
// The dashboard NotificationsBox is now driven by the server-side aggregator
// at /api/dashboard/alerts. That endpoint pulls milestones (due-soon +
// overdue), tasks, RFIs, submittals, change orders, inspections, contract
// COIs, and mobilization plans, sorts them by severity, and returns a flat
// list. This keeps the dashboard a single call away from a full "what does
// a PM need to know right now" picture.

type ServerAlert = {
  id: string;
  tone: "red" | "amber" | "sky" | "violet" | "emerald";
  icon: string;
  text: string;
  meta: string;
  href: string;
  phase: string;
  dueDate: string | null;
};

const ICON_MAP: Record<string, any> = {
  Flag,
  AlertTriangle,
  HelpCircle,
  ClipboardList,
  GitPullRequestArrow,
  ClipboardCheck,
  ShieldAlert,
  Rocket,
};

const TONE_CLASS: Record<ServerAlert["tone"], string> = {
  red: "text-red-500 bg-red-500/12",
  amber: "text-amber-500 bg-amber-500/12",
  sky: "text-sky-500 bg-sky-500/12",
  violet: "text-violet-500 bg-violet-500/12",
  emerald: "text-emerald-500 bg-emerald-500/12",
};

export function NotificationsBox(_props: {
  tasks?: Task[]; rfis?: Rfi[]; changeOrders?: ChangeOrder[]; projects?: Project[];
}) {
  // Poll every 60s so long-running dashboards pick up new alerts (e.g. an
  // inspection just scheduled, or a milestone just marked complete) without a
  // manual refresh.
  const { data } = useQuery<{ alerts: ServerAlert[] }>({
    queryKey: ["/api/dashboard/alerts"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const alerts = data?.alerts ?? [];
  // Cap the visible list so the box doesn't dominate the dashboard. Users
  // can drill into each phase's dedicated page for the full list.
  const VISIBLE = 8;
  const visible = alerts.slice(0, VISIBLE);
  const overflow = Math.max(0, alerts.length - VISIBLE);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="box-notifications">
      <Link
        href="/notifications"
        className="group -m-1 flex items-center justify-between rounded-md p-1 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        data-testid="notif-header-link"
      >
        <h3 className="font-display text-sm font-bold">Notifications</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          <Bell className="size-3" /> {alerts.length}
          <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
      </Link>
      <div className="mt-3 flex-1 space-y-2">
        {alerts.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">You're all caught up.</p>
        )}
        {visible.map((n) => {
          const Icon = ICON_MAP[n.icon] ?? Bell;
          return (
            <Link
              key={n.id}
              href={n.href}
              className="flex items-start gap-2.5 rounded-md border border-border p-2.5 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid={`notif-${n.id}`}
            >
              <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md", TONE_CLASS[n.tone])}>
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight">{n.text}</div>
                <div className="truncate text-xs text-muted-foreground">{n.meta}</div>
              </div>
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
        {overflow > 0 && (
          <Link
            href="/notifications"
            className="block rounded-md py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-muted/40"
            data-testid="notif-see-all"
          >
            +{overflow} more · see all notifications
          </Link>
        )}
        {alerts.length > 0 && overflow === 0 && (
          <Link
            href="/notifications"
            className="block rounded-md py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-muted/40"
            data-testid="notif-see-all"
          >
            See all notifications
          </Link>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Weather ------------------------------- */
// Live 7-day forecast via Open-Meteo (no API key required). We geocode the
// project's address to lat/lng, then request a 7-day daily forecast. Both
// endpoints are cached for a day so the dashboard doesn't re-hit them on
// every render.

// Map Open-Meteo WMO weather codes to an emoji + short label.
// https://open-meteo.com/en/docs#weathervariables
function wmoToIconLabel(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Clear" };
  if (code === 1) return { icon: "🌤️", label: "Mostly clear" };
  if (code === 2) return { icon: "⛅", label: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", label: "Overcast" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Foggy" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Drizzle" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "🌨️", label: "Snow" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", label: "Showers" };
  if (code >= 85 && code <= 86) return { icon: "🌨️", label: "Snow showers" };
  if (code === 95) return { icon: "⛈️", label: "Thunderstorm" };
  if (code === 96 || code === 99) return { icon: "⛈️", label: "Thunder + hail" };
  return { icon: "🌤️", label: "Fair" };
}

type Geocode = { lat: number; lng: number; label: string };
type ForecastDay = { date: string; hi: number; lo: number; code: number; precip: number };
type WeatherPayload = { geo: Geocode; today: { temp: number; code: number }; days: ForecastDay[] };

async function geocodeAddress(address: string): Promise<Geocode> {
  // Open-Meteo geocoding takes only a place-name-style query; strip street
  // numbers so "1234 Main St, Denver, CO" becomes "Denver, CO".
  const cleaned = address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => !/^\d+[A-Za-z]?/.test(p)) // drop leading street number tokens
    .join(", ")
    .trim();
  const q = cleaned || address || "Denver, CO";
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) {
    // Fallback to Denver, CO if geocoding turns up nothing.
    return { lat: 39.7392, lng: -104.9903, label: "Denver, CO" };
  }
  const label = [hit.name, hit.admin1, hit.country_code].filter(Boolean).join(", ");
  return { lat: hit.latitude, lng: hit.longitude, label };
}

async function fetchForecast(geo: Geocode): Promise<WeatherPayload> {
  const params = new URLSearchParams({
    latitude: String(geo.lat),
    longitude: String(geo.lng),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "7",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`forecast ${res.status}`);
  const data = await res.json();
  const days: ForecastDay[] = (data.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    hi: Math.round(data.daily.temperature_2m_max[i]),
    lo: Math.round(data.daily.temperature_2m_min[i]),
    code: data.daily.weather_code[i] ?? 0,
    precip: Math.round(data.daily.precipitation_probability_max?.[i] ?? 0),
  }));
  return {
    geo,
    today: {
      temp: Math.round(data.current?.temperature_2m ?? days[0]?.hi ?? 70),
      code: data.current?.weather_code ?? days[0]?.code ?? 0,
    },
    days,
  };
}

function useSiteWeather(address: string) {
  return useQuery({
    queryKey: ["weather", address],
    queryFn: async () => {
      const geo = await geocodeAddress(address);
      return fetchForecast(geo);
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

function dayShort(dateISO: string, i: number): string {
  if (i === 0) return "Today";
  // dateISO is YYYY-MM-DD in the site's local timezone; parse as local to
  // avoid a UTC offset ever landing on the wrong weekday.
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { weekday: "short" });
}

export function WeatherBar({ logs, projects }: { logs: DailyLog[]; projects: Project[] }) {
  const [open, setOpen] = useState(false);
  const latest = [...logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const proj = latest ? projects.find((p) => p.id === latest.projectId) : projects[0];
  const site = proj?.name?.split(" ").slice(0, 2).join(" ") ?? "Site";
  const address = proj?.address?.trim() || "Denver, CO";

  const { data, isLoading, isError } = useSiteWeather(address);

  // Fallback to log-derived numbers if the live fetch fails, so the widget
  // still looks presentable.
  const fallbackTemp = latest?.temp ?? 72;
  const fallbackCond = latest?.weather ?? "Fair";

  const temp = data?.today?.temp ?? fallbackTemp;
  const cond = data ? wmoToIconLabel(data.today.code).label : fallbackCond;
  const locLabel = data?.geo?.label ?? address;
  const days = data?.days ?? [];
  const previewDays = days.slice(0, 4); // collapsed row shows today + next 3

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" data-testid="box-weather">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="button-weather-toggle"
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CloudSun className="size-5" />
        </span>
        <span className="hidden font-display text-sm font-bold sm:inline">Site Weather</span>
        <span className="font-display text-2xl font-bold tabular">{temp}°</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium leading-tight">{cond}</div>
          <div className="truncate text-xs text-muted-foreground">{locLabel} · {site}</div>
        </div>
        {/* inline mini-forecast when collapsed — today + next 3 days */}
        {!open && previewDays.length > 0 && (
          <div className="ml-auto hidden items-center gap-4 sm:flex">
            {previewDays.map((f, i) => {
              const w = wmoToIconLabel(f.code);
              const key = dayShort(f.date, i);
              return (
                <div key={f.date} className="text-center" data-testid={`forecast-${key}`}>
                  <div className="text-[10px] font-medium uppercase text-muted-foreground">{key}</div>
                  <div className="text-base leading-tight">{w.icon}</div>
                  <div className="text-[10px] tabular text-muted-foreground"><span className="font-semibold text-foreground">{f.hi}°</span> {f.lo}°</div>
                </div>
              );
            })}
          </div>
        )}
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180", !open && "sm:ml-4")} />
      </button>
      {open && (
        <div className="border-t border-border p-4" data-testid="weather-expanded">
          <div className="flex items-center gap-4">
            <span className="font-display text-4xl font-bold tabular">{temp}°</span>
            <div className="min-w-0">
              <div className="text-sm font-medium">{cond}</div>
              <div className="truncate text-xs text-muted-foreground">{locLabel} · {site}</div>
            </div>
          </div>
          {isLoading && (
            <div className="mt-3 text-xs text-muted-foreground">Loading 7-day forecast…</div>
          )}
          {isError && !isLoading && (
            <div className="mt-3 text-xs text-muted-foreground">Couldn't load live forecast. Showing latest log.</div>
          )}
          {days.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((f, i) => {
                const w = wmoToIconLabel(f.code);
                const key = dayShort(f.date, i);
                return (
                  <div
                    key={f.date}
                    className="rounded-md bg-muted/50 py-2 text-center"
                    data-testid={`forecast-expanded-${key}`}
                    title={`${w.label} · ${f.precip}% precip`}
                  >
                    <div className="text-[10px] font-medium uppercase text-muted-foreground">{key}</div>
                    <div className="text-lg leading-tight">{w.icon}</div>
                    <div className="text-[10px] tabular text-muted-foreground">
                      <span className="font-semibold text-foreground">{f.hi}°</span> {f.lo}°
                    </div>
                    <div className="text-[10px] text-sky-600 dark:text-sky-400">{f.precip}%</div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-[10px] text-muted-foreground">
            Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline hover:text-foreground">Open-Meteo</a>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Sticky notepad ---------------------------- */
export function StickyNotepadBox() {
  const { data: projects = [] } = useProjects();
  const active = projects.filter((p) => p.status !== "Planning");
  const projectId = active[0]?.id ?? projects[0]?.id;
  const create = useCreateNote(projectId ?? 0);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [color, setColor] = useState("amber");
  const [lifted, setLifted] = useState(false);

  // paper palette per color (lighter than the board sticky notes)
  const paper: Record<string, { bg: string; edge: string; ink: string; tape: string }> = {
    amber:   { bg: "#fef08a", edge: "#eab308", ink: "#422006", tape: "#fde68a" },
    blue:    { bg: "#bfdbfe", edge: "#3b82f6", ink: "#0c1d4f", tape: "#dbeafe" },
    emerald: { bg: "#bbf7d0", edge: "#22c55e", ink: "#052e16", tape: "#dcfce7" },
    rose:    { bg: "#fecdd3", edge: "#f43f5e", ink: "#4c0519", tape: "#ffe4e6" },
    violet:  { bg: "#ddd6fe", edge: "#8b5cf6", ink: "#2e1065", tape: "#ede9fe" },
  };
  const p = paper[color];
  const COLOR_KEYS = Object.keys(paper);

  const add = () => {
    if (!text.trim() || projectId === undefined) return;
    create.mutate({ body: text.trim(), color });
    setText("");
    toast({ title: "Note added to the board", description: "Open the Sticky Board to view it." });
  };

  return (
    <div className="flex items-center justify-center" data-testid="box-notepad">
      <div
        className="relative w-full max-w-[260px] -rotate-2 rounded-sm p-4 transition-transform duration-200 ease-out hover:z-10 hover:-translate-y-1.5 hover:rotate-0"
        onMouseEnter={() => setLifted(true)}
        onMouseLeave={() => setLifted(false)}
        style={{
          background: p.bg,
          color: p.ink,
          boxShadow: lifted
            ? "0 22px 30px -8px rgba(0,0,0,0.45), 0 6px 10px rgba(0,0,0,0.18)"
            : "0 10px 18px -6px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.15)",
          transition: "transform 200ms ease-out, box-shadow 200ms ease-out",
          minHeight: 224,
        }}
        data-testid="sticky-notepad"
      >
        {/* tape strip */}
        <div
          className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-3 rounded-[2px]"
          style={{ background: p.tape, opacity: 0.85, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }}
          aria-hidden
        />
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">Quick Note</h3>
          <StickyNote className="size-4 opacity-70" />
        </div>
        {/* lined textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Jot a note for the crew…"
          rows={4}
          data-testid="input-quick-note"
          className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-[1.5rem] outline-none placeholder:opacity-50"
          style={{
            color: p.ink,
            backgroundImage: `repeating-linear-gradient(transparent 0 1.5rem, ${p.edge}55 1.5rem 1.5625rem)`,
            backgroundSize: "100% 1.5rem",
          }}
        />
        {/* color dots + add */}
        <div className="mt-3 flex items-center gap-1.5">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setColor(k)}
              aria-label={`Color ${k}`}
              data-testid={`quick-note-color-${k}`}
              className={cn("size-4 rounded-full ring-2 ring-offset-1 transition", color === k ? "ring-foreground" : "ring-transparent")}
              style={{ background: paper[k].bg, boxShadow: `inset 0 0 0 1.5px ${paper[k].edge}` }}
            />
          ))}
          <button
            onClick={add}
            disabled={!text.trim() || create.isPending}
            data-testid="button-quick-note-add"
            className="ml-auto inline-flex items-center gap-1 rounded-md bg-foreground/85 px-2.5 py-1 text-xs font-semibold text-background disabled:opacity-40"
          >
            <Plus className="size-3" /> Add
          </button>
        </div>
        {/* view wall link */}
        <Link
          href="/notes"
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium opacity-80 hover:opacity-100"
          style={{ borderColor: p.edge, color: p.ink }}
          data-testid="link-view-note-wall"
        >
          View Note Wall <ArrowRight className="size-3.5" />
        </Link>
        {/* curled bottom-right corner */}
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0"
          style={{
            borderTop: "14px solid transparent",
            borderBottom: "14px solid " + p.edge,
            borderLeft: "14px solid transparent",
            filter: "drop-shadow(-1px -1px 1px rgba(0,0,0,0.15))",
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/* ------------------------ Note Wall carousel --------------------------- */
// Sliding tab that pages through the sticky notes on the Sticky Board wall
// straight from the dashboard, so you can read (and reply to) recent notes
// without opening /notes. Colors mirror the corkboard palette used on the
// full page so the stickies feel like the same paper.

type NoteReplyLite = { author: string; initials: string; body: string; at: string };

function parseNoteReplies(raw: unknown): NoteReplyLite[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r): r is NoteReplyLite => !!r && typeof r === "object" && typeof (r as any).body === "string");
  } catch {
    return [];
  }
}

const WALL_COLORS: Record<string, { bg: string; bar: string; text: string; pin: string }> = {
  amber:   { bg: "#fef3c7", bar: "#e07412", text: "#5c2e07", pin: "#c0392b" },
  blue:    { bg: "#dbeafe", bar: "#2f7fd4", text: "#0c3a66", pin: "#1e3a8a" },
  emerald: { bg: "#d1fae5", bar: "#1f9d6b", text: "#064e3b", pin: "#065f46" },
  rose:    { bg: "#ffe4e6", bar: "#e0457b", text: "#6b0f2a", pin: "#9d174d" },
  violet:  { bg: "#ede9fe", bar: "#7c5cff", text: "#2e1065", pin: "#5b21b6" },
};

export function NoteWallCarouselBox() {
  const { data: projects = [] } = useProjects();
  // Default to first project; give the user a chip switcher below if there
  // are multiple. Matches /notes behavior.
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const pid = projectId ?? projects[0]?.id;
  const { data: notes = [] } = useNotes(pid);
  const addReply = useAddNoteReply();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [replyDraft, setReplyDraft] = useState("");

  // Keep idx in bounds when the notes list shrinks (deletes) or the user
  // switches projects.
  const safeIdx = notes.length === 0 ? 0 : Math.min(idx, notes.length - 1);
  const current = notes[safeIdx];

  const goPrev = () => {
    if (notes.length === 0) return;
    setIdx((i) => (i - 1 + notes.length) % notes.length);
    setReplyDraft("");
  };
  const goNext = () => {
    if (notes.length === 0) return;
    setIdx((i) => (i + 1) % notes.length);
    setReplyDraft("");
  };

  const submit = () => {
    if (!current || !replyDraft.trim()) return;
    addReply.mutate(
      { id: current.id, body: replyDraft.trim() },
      {
        onSuccess: () => setReplyDraft(""),
        onError: (err: any) => toast({ title: "Couldn't add reply", description: err?.message ?? "Unknown error" }),
      },
    );
  };

  const c = current ? (WALL_COLORS[current.color] ?? WALL_COLORS.amber) : WALL_COLORS.amber;
  const replies = useMemo(() => parseNoteReplies((current as any)?.replies), [current]);

  return (
    <div className="flex h-full flex-col" data-testid="box-note-wall-carousel">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="size-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Note Wall</h3>
        </div>
        <Link href="/notes" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="link-open-note-wall">
          Open <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Project switcher — only if user has more than one */}
      {projects.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => { setProjectId(p.id); setIdx(0); setReplyDraft(""); }}
              data-testid={`carousel-project-${p.id}`}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                pid === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      {/* Sticky viewport */}
      <div className="relative flex-1">
        {notes.length === 0 || !current ? (
          <div className="flex h-full min-h-[180px] items-center justify-center rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {projects.length === 0
              ? "Add a project first, then jot a note."
              : "No notes on the wall yet. Open the board to add one."}
          </div>
        ) : (
          <div
            className="relative rounded-md p-3 shadow-md"
            style={{ background: c.bg, color: c.text, minHeight: 180 }}
            data-testid={`carousel-note-${current.id}`}
          >
            {/* Colored header stripe */}
            <div className="-mx-3 -mt-3 mb-2 flex items-center justify-between px-3 py-1" style={{ background: c.bar }}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">Note</span>
              <span className="text-[10px] font-semibold text-white/85">{safeIdx + 1} / {notes.length}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm font-medium leading-snug">{current.body}</p>

            {replies.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
                {replies.slice(-3).map((r, ri) => (
                  <div key={ri} className="flex items-start gap-1.5 text-xs leading-snug">
                    <CornerDownRight className="mt-0.5 size-3 shrink-0 opacity-60" />
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words">{r.body}</p>
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-60">
                        — {r.initials || r.author}
                      </div>
                    </div>
                  </div>
                ))}
                {replies.length > 3 && (
                  <div className="text-[10px] opacity-60">+{replies.length - 3} more on the board</div>
                )}
              </div>
            )}

            {/* Reply composer */}
            <div className="mt-2 flex items-center gap-1 rounded border border-black/10 bg-white/40 p-1">
              <input
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
                placeholder="Reply…"
                data-testid="carousel-reply-input"
                className="h-6 min-w-0 flex-1 bg-transparent px-1 text-xs outline-none placeholder:opacity-60"
                style={{ color: c.text }}
                maxLength={500}
              />
              <button
                onClick={submit}
                disabled={!replyDraft.trim() || addReply.isPending}
                data-testid="carousel-reply-post"
                className="inline-flex h-6 items-center rounded px-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-40"
                style={{ background: c.bar }}
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      {notes.length > 1 && (
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={goPrev}
            data-testid="carousel-prev"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
            aria-label="Previous note"
          >
            <ChevronLeft className="size-4" />
          </button>
          {/* Dot indicator (max 8 dots) */}
          <div className="flex items-center gap-1">
            {notes.slice(0, 8).map((_, i) => (
              <span
                key={i}
                className={cn("size-1.5 rounded-full transition-colors", i === safeIdx ? "bg-primary" : "bg-border")}
              />
            ))}
            {notes.length > 8 && <span className="text-[10px] text-muted-foreground">…</span>}
          </div>
          <button
            onClick={goNext}
            data-testid="carousel-next"
            className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-background hover:bg-muted"
            aria-label="Next note"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Fleet service reminders --------------------------- */
export function FleetServiceBox() {
  const { data: equipment = [] } = useEquipment();
  const today = new Date().toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const items = useMemo(() => {
    const flagged = (equipment as Equipment[])
      .filter((e) => (e.assetClass ?? "Equipment") !== "Tech")
      .map((e) => {
        const overdue =
          (!!e.nextServiceDate && e.nextServiceDate <= today) ||
          !!(e.nextServiceMileage && e.currentMileage != null && e.currentMileage >= e.nextServiceMileage);
        const dueSoon = !overdue && !!e.nextServiceDate && e.nextServiceDate <= in14;
        return { e, overdue, dueSoon };
      })
      .filter((x) => x.overdue || x.dueSoon)
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return (a.e.nextServiceDate ?? "").localeCompare(b.e.nextServiceDate ?? "");
      });
    return flagged.slice(0, 5);
  }, [equipment, today, in14]);

  const totalFlagged = (equipment as Equipment[]).filter((e) => {
    if ((e.assetClass ?? "Equipment") === "Tech") return false;
    const overdue =
      (!!e.nextServiceDate && e.nextServiceDate <= today) ||
      !!(e.nextServiceMileage && e.currentMileage != null && e.currentMileage >= e.nextServiceMileage);
    const dueSoon = !overdue && !!e.nextServiceDate && e.nextServiceDate <= in14;
    return overdue || dueSoon;
  }).length;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="box-fleet-service">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-sm font-bold">
          <Wrench className="size-4" /> Service reminders
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            totalFlagged > 0 ? "bg-red-500/12 text-red-600" : "bg-emerald-500/12 text-emerald-600"
          )}
        >
          {totalFlagged}
        </span>
      </div>
      <div className="mt-3 flex-1 space-y-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">Everything's caught up on service.</p>
        )}
        {items.map(({ e, overdue }) => {
          const isVehicle = (e.assetClass ?? "Equipment") === "Vehicle";
          const Icon = isVehicle ? Car : HardHat;
          const meta: string[] = [];
          if (e.nextServiceDate) meta.push(overdue ? `Due ${e.nextServiceDate}` : `Due ${e.nextServiceDate}`);
          if (e.nextServiceMileage && e.currentMileage != null) {
            meta.push(`${e.currentMileage.toLocaleString()} / ${e.nextServiceMileage.toLocaleString()} mi`);
          }
          return (
            <Link
              key={e.id}
              href="/equipment"
              className="flex items-start gap-2.5 rounded-md border border-border p-2.5 transition-colors hover:border-primary/50 hover:bg-muted/30"
              data-testid={`svc-${e.id}`}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md",
                  overdue ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium leading-tight">{e.name}</div>
                <div className="truncate text-xs text-muted-foreground">{meta.join(" · ") || "Service due"}</div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  overdue ? "bg-red-500/15 text-red-600" : "bg-amber-500/15 text-amber-600"
                )}
              >
                {overdue ? "Overdue" : "Soon"}
              </span>
            </Link>
          );
        })}
      </div>
      {totalFlagged > 0 && (
        <Link
          href="/equipment"
          className="mt-3 inline-flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open Fleet & Assets <ArrowRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
