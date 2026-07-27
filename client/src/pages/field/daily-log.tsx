import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CloudSun, Cloud, CloudRain, Snowflake, Sun, Wind, Users, ClipboardList, CheckCircle2, WifiOff, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-data";
import { useAuth } from "@/lib/auth";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

type Weather = "sunny" | "partly-cloudy" | "cloudy" | "rain" | "snow" | "windy";
const WEATHER_OPTIONS: { key: Weather; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "sunny", label: "Sunny", icon: Sun },
  { key: "partly-cloudy", label: "P.Cloudy", icon: CloudSun },
  { key: "cloudy", label: "Cloudy", icon: Cloud },
  { key: "rain", label: "Rain", icon: CloudRain },
  { key: "snow", label: "Snow", icon: Snowflake },
  { key: "windy", label: "Windy", icon: Wind },
];

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
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => subscribeQueue(setQueueSize), []);
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
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Weather</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {WEATHER_OPTIONS.map((w) => {
                const Icon = w.icon;
                const active = weather === w.key;
                return (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setWeather(w.key)}
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
              <Button type="button" variant="outline" size="lg" onClick={() => setTemp((t) => t - 1)} className="h-14 w-14 shrink-0 text-2xl">−</Button>
              <Input
                type="number"
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value) || 0)}
                data-testid="field-log-temp"
                className="h-14 flex-1 text-center font-display text-3xl font-bold"
              />
              <Button type="button" variant="outline" size="lg" onClick={() => setTemp((t) => t + 1)} className="h-14 w-14 shrink-0 text-2xl">+</Button>
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
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">What got done</Label>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="Framed the second-floor walls east side. Rebar deliv. 9am. Small delay from morning rain."
              data-testid="field-log-summary"
              className="text-base"
            />
          </div>
        </div>

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
