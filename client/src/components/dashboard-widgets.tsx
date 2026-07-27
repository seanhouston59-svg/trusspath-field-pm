import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, CloudSun, StickyNote, ArrowRight, AlertTriangle, HelpCircle, GitPullRequestArrow, ClipboardList, Plus, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/bits";
import { useCreateNote, useProjects } from "@/hooks/use-data";
import { relativeDays, isOverdue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { Task, Rfi, ChangeOrder, DailyLog, Project } from "@shared/schema";

/* ---------------------------- Notifications ---------------------------- */
type Notif = { id: string; icon: any; tone: string; text: string; meta: string; href: string };

export function NotificationsBox({ tasks, rfis, changeOrders, projects }: {
  tasks: Task[]; rfis: Rfi[]; changeOrders: ChangeOrder[]; projects: Project[];
}) {
  const notifs: Notif[] = [];
  const overdue = tasks.filter((t) => isOverdue(t.dueDate) && t.status !== "Complete");
  overdue.slice(0, 1).forEach((t) => notifs.push({
    id: `od-${t.id}`, icon: AlertTriangle, tone: "text-red-500 bg-red-500/12",
    text: t.title, meta: `${relativeDays(t.dueDate)} · ${t.trade}`, href: "/tasks",
  }));
  rfis.filter((r) => r.status === "Open" && isOverdue(r.dueDate)).slice(0, 1).forEach((r) => notifs.push({
    id: `rfi-${r.id}`, icon: HelpCircle, tone: "text-amber-500 bg-amber-500/12",
    text: `${r.number} due`, meta: r.subject, href: "/rfis",
  }));
  changeOrders.filter((c) => c.status === "Pending").slice(0, 1).forEach((c) => notifs.push({
    id: `co-${c.id}`, icon: GitPullRequestArrow, tone: "text-sky-500 bg-sky-500/12",
    text: `${c.number} pending approval`, meta: c.title, href: "/change-orders",
  }));
  projects.filter((p) => p.status === "Planning").slice(0, 1).forEach((p) => notifs.push({
    id: `log-${p.id}`, icon: ClipboardList, tone: "text-violet-500 bg-violet-500/12",
    text: "Mobilization plan due", meta: p.name, href: `/projects/${p.id}`,
  }));

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="box-notifications">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Notifications</h3>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          <Bell className="size-3" /> {notifs.length}
        </span>
      </div>
      <div className="mt-3 flex-1 space-y-2">
        {notifs.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">You're all caught up.</p>}
        {notifs.map((n) => (
          <Link
            key={n.id}
            href={n.href}
            className="flex items-start gap-2.5 rounded-md border border-border p-2.5 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid={`notif-${n.id}`}
          >
            <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md", n.tone)}>
              <n.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium leading-tight">{n.text}</div>
              <div className="truncate text-xs text-muted-foreground">{n.meta}</div>
            </div>
            <ArrowRight className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
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
