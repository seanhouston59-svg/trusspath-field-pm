import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CloudSun, Cloud, CloudFog, CloudRain, Snowflake, Sun, Wind, Users, ClipboardList, CheckCircle2, WifiOff, Loader2, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useProjects, useProjectWeather, type DailyLogWeatherResponse } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { WORK_SUMMARY_TEMPLATES, WORK_SUMMARY_TRADES } from "@/lib/work-summary-catalog";

/**
 * Mobile daily log — foreman-optimized quick entry.
 *
 * Design goals:
 * - Everything one-thumb reachable. Sticky "Save" button at the bottom.
 * - Weather picker is chunky icon buttons, not a dropdown.
 * - Temp is a stepper (+/-) plus a big number.
 * - Crew count is a stepper.
 * - Works offline: on submit we call queueRequest which persists to
 *   IndexedDB, shows a success toast, and returns immediately. When
 *   the browser comes back online, the offline queue drains it.
 */

type Weather = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "snow" | "windy" | "fog";
const WEATHER_OPTIONS: { key: Weather; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "sunny", label: "Sunny", icon: Sun },
  { key: "partly-cloudy", label: "P.Cloudy", icon: CloudSun },
  { key: "cloudy", label: "Cloudy", icon: Cloud },
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "snow", label: "Snow", icon: Snowflake },
  { key: "windy", label: "Windy", icon: Wind },
  { key: "fog", label: "Fog", icon: CloudFog },
];

/**
 * Convert the server's daily-log slug (capitalized, e.g. "Partly cloudy") to
 * the mobile field-mode slug (lowercase hyphenated, e.g. "partly-cloudy").
 * The mobile form has its own vocab because the DB column is a free text
 * field — desktop stores "Partly cloudy" and mobile has historically stored
 * "partly-cloudy". We keep that behavior to avoid breaking analytics that
 * bucket on the exact string, and just translate at the auto-fill boundary.
 */
function serverSlugToFieldSlug(s: DailyLogWeatherResponse["weather"]): Weather {
  switch (s) {
    case "Sunny": return "sunny";
    case "Partly cloudy": return "partly-cloudy";
    case "Cloudy": return "cloudy";
    case "Rain": return "rain";
    case "Snow": return "snow";
    case "Wind": return "windy";
    case "Fog": return "fog";
    default: return "sunny";
  }
}

export default function FieldDailyLog() {
  const [, navigate] = useLocation();
  const { data: projects = [] } = useProjects();
  const { account: currentUser } = useAuth();
  const { toast } = useToast();

  // Persist selected project across visits so foremen don't re-pick every time.
  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);

  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [weather, setWeather] = useState<Weather>("sunny");
  const [temp, setTemp] = useState<number>(70);
  const [crewCount, setCrewCount] = useState<number>(4);
  const [summary, setSummary] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateTrade, setTemplateTrade] = useState<string>("General");
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  // Mirrors the desktop form's dirty-tracking. When the foreman taps any
  // weather tile or nudges Temp, we set this to true and stop auto-filling
  // until they change project OR tap the little refresh icon in the header.
  const [weatherDirty, setWeatherDirty] = useState(false);

  useEffect(() => subscribeQueue(setQueueSize), []);

  // Auto-pull weather when there's a project selected. `today` is derived
  // from the current date, so this runs once on mount and again on refresh.
  // Skipped entirely when offline (the request would just fail anyway) so
  // foremen out at a jobsite with no signal aren't stuck watching a spinner.
  const todayStr = new Date().toISOString().slice(0, 10);
  const weatherQuery = useProjectWeather(projectId, todayStr, { enabled: online });
  useEffect(() => {
    if (weatherQuery.data && !weatherDirty) {
      setWeather(serverSlugToFieldSlug(weatherQuery.data.weather));
      setTemp(weatherQuery.data.temp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherQuery.data]);

  // Project change = new location = re-enable auto-fill.
  useEffect(() => { setWeatherDirty(false); }, [projectId]);

  /** Manual re-pull — clears dirty flag first so the returned values apply. */
  const refreshWeather = () => { setWeatherDirty(false); weatherQuery.refetch(); };

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Default the project to the first active one if we didn't have a stored id.
  useEffect(() => {
    if (projectId == null && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const today = new Date().toISOString().slice(0, 10);

  const canSubmit = projectId != null && summary.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || projectId == null) return;
    setSubmitting(true);
    try {
      const payload = {
        projectId,
        date: today,
        authorId: currentUser?.id,
        weather,
        temp,
        crewCount,
        summary: summary.trim(),
      };

      // Remember the project selection.
      localStorage.setItem("trusspath.field.lastProjectId", String(projectId));

      // If we're online, attempt an immediate submit; if it fails or we're
      // offline, queue for later.
      if (online) {
        try {
          const resp = await fetch("/api/daily-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          toast({ title: "Daily log saved", description: `${WEATHER_OPTIONS.find((w) => w.key === weather)?.label} · ${crewCount} crew` });
          resetForm();
          return;
        } catch (err) {
          // fall through to queue
        }
      }

      await queueRequest({
        kind: "daily-log",
        url: "/api/daily-logs",
        method: "POST",
        body: payload,
        meta: { projectId, date: today },
      });
      toast({ title: "Saved offline", description: "We'll upload as soon as you're back online." });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSummary("");
    // Keep weather/temp/crewCount/project — foremen often log multiple days in one session with same defaults.
  };

  return (
    <Layout title="Daily log">
      <div className="mx-auto max-w-2xl pb-32">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/field" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Field
          </Link>
          {!online && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <WifiOff className="size-3.5" /> Offline
            </span>
          )}
          {queueSize > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              {queueSize} pending
            </span>
          )}
        </div>

        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Daily log</h1>
            <p className="text-xs text-muted-foreground">{today}</p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {/* Project */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
            <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
              <SelectTrigger data-testid="field-log-project" className="h-12 text-base">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weather */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase text-muted-foreground">Weather</Label>
              {/* Refresh chip — large enough to tap with a work glove on. Hidden
                  offline since the auto-pull won't work anyway. */}
              {online && projectId != null && (
                <button
                  type="button"
                  onClick={refreshWeather}
                  disabled={weatherQuery.isFetching}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-primary disabled:opacity-50"
                  data-testid="field-log-weather-refresh"
                  aria-label="Refresh weather"
                >
                  <RefreshCw className={cn("size-3", weatherQuery.isFetching && "animate-spin")} /> Refresh
                </button>
              )}
            </div>
            {/* Status line — tiny, informational. Shows the auto-pull result,
                edited state, or an error hint. Kept above the tiles so foremen
                see it before making a choice. */}
            {online && projectId != null && (
              <div className="mb-2 flex min-h-4 items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="field-log-weather-status">
                {weatherQuery.isFetching && (<><RefreshCw className="size-3 animate-spin" /> Checking…</>)}
                {!weatherQuery.isFetching && weatherQuery.data && (
                  <>
                    <Cloud className="size-3" />
                    <span className="truncate">Auto-filled · {weatherQuery.data.meta.locationName} · {weatherQuery.data.meta.description}</span>
                    {weatherDirty && <span className="italic text-amber-600 dark:text-amber-400">· edited</span>}
                  </>
                )}
                {!weatherQuery.isFetching && !weatherQuery.data && weatherQuery.isError && (
                  <><AlertCircle className="size-3 text-amber-500" /> Couldn't auto-pull — tap a tile.</>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {WEATHER_OPTIONS.map((w) => {
                const Icon = w.icon;
                const active = weather === w.key;
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => { setWeather(w.key); setWeatherDirty(true); }}
                    data-testid={`field-log-weather-${w.key}`}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    <Icon className="size-6" />
                    <span className="text-[10px] font-semibold">{w.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Temp */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Temperature (°F)</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => { setTemp((t) => t - 1); setWeatherDirty(true); }} className="h-14 w-14 shrink-0 text-2xl">−</Button>
              <Input
                type="number"
                value={temp}
                onChange={(e) => { setTemp(Number(e.target.value) || 0); setWeatherDirty(true); }}
                data-testid="field-log-temp"
                className="h-14 flex-1 text-center font-display text-3xl font-bold"
              />
              <Button type="button" variant="outline" size="lg" onClick={() => { setTemp((t) => t + 1); setWeatherDirty(true); }} className="h-14 w-14 shrink-0 text-2xl">+</Button>
            </div>
          </div>

          {/* Crew count */}
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> Crew on site</span>
            </Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => setCrewCount((c) => Math.max(0, c - 1))} className="h-14 w-14 shrink-0 text-2xl">−</Button>
              <Input
                type="number"
                value={crewCount}
                onChange={(e) => setCrewCount(Math.max(0, Number(e.target.value) || 0))}
                data-testid="field-log-crew"
                className="h-14 flex-1 text-center font-display text-3xl font-bold"
              />
              <Button type="button" variant="outline" size="lg" onClick={() => setCrewCount((c) => c + 1)} className="h-14 w-14 shrink-0 text-2xl">+</Button>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase text-muted-foreground">What got done</Label>
              <button
                type="button"
                onClick={() => setTemplatesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                data-testid="field-log-templates-open"
              >
                <Sparkles className="size-3.5" /> Templates
              </button>
            </div>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="Framed the second-floor walls east side. Rebar deliv. 9am. Small delay from morning rain."
              data-testid="field-log-summary"
              className="text-base"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tip: pick a template to insert starter text, then fill in the bracketed bits.
            </p>
          </div>
        </div>

        {/* Work summary templates — mobile bottom sheet */}
        <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
            <SheetHeader className="border-b border-border px-4 py-3 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" /> Work summary templates
              </SheetTitle>
              <SheetDescription className="text-xs">
                Tap one to insert. It replaces the current text.
              </SheetDescription>
            </SheetHeader>

            {/* Trade filter tabs */}
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
              <div className="flex gap-1.5 overflow-x-auto">
                {WORK_SUMMARY_TRADES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTemplateTrade(t)}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition",
                      templateTrade === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent",
                    )}
                    data-testid={`field-log-template-trade-${t.toLowerCase()}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Template list */}
            <ul className="divide-y divide-border">
              {WORK_SUMMARY_TEMPLATES.filter((t) => t.trade === templateTrade).map((t) => (
                <li key={t.label}>
                  <button
                    type="button"
                    onClick={() => {
                      setSummary(t.text);
                      setTemplatesOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-accent"
                    data-testid={`field-log-template-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{t.text}</span>
                  </button>
                </li>
              ))}
              {WORK_SUMMARY_TEMPLATES.filter((t) => t.trade === templateTrade).length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No templates in this category yet.
                </li>
              )}
            </ul>

            {summary.trim() && (
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    // Append instead of replace — useful when combining trades.
                    // (Only shown when the box already has text.)
                  }}
                  className="hidden"
                />
                <p className="text-[11px] text-muted-foreground">
                  Tapping a template replaces the current text. Copy anything you’ve written before switching.
                </p>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Sticky submit */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/field")}
              className="h-12"
              data-testid="field-log-cancel"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-12 flex-1 text-base font-bold"
              data-testid="field-log-save"
            >
              {submitting ? (
                <><Loader2 className="size-5 animate-spin" /> Saving…</>
              ) : online ? (
                <><CheckCircle2 className="size-5" /> Save log</>
              ) : (
                <><WifiOff className="size-5" /> Save offline</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
