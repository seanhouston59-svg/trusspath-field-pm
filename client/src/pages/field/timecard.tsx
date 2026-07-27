import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Clock, MapPin, Loader2, WifiOff, LogIn, LogOut as LogOutIcon, Coffee, CheckCircle2, RefreshCw } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-data";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Mobile timecard — clock in / out / break with optional GPS.
 *
 * The server-side field_punches table is append-only. Each tap creates a
 * single event. The UI derives current state ("clocked in since 7:14 AM")
 * from the most recent event.
 *
 * GPS: requested via navigator.geolocation with a 5s timeout. If the user
 * denies or the location doesn't resolve fast enough we still send the
 * punch — we don't want to block someone in a basement from clocking in.
 *
 * Offline: same pattern as daily log. Try immediate POST; on any failure
 * queue with a stable client_id so retries are idempotent server-side.
 */

type Punch = {
  id: number;
  kind: "in" | "out" | "break_start" | "break_end";
  projectId: number;
  occurredAt: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  note: string | null;
  clientId: string | null;
};

type PunchesResponse = { punches: Punch[]; open: Punch | null };

async function fetchPunches(): Promise<PunchesResponse | null> {
  try {
    const resp = await fetch("/api/field/punches?limit=10", { credentials: "include" });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// Best-effort GPS with a hard 5s cap so we never block the punch.
async function getCoords(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { lat: number; lng: number; accuracyM: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timeout = setTimeout(() => finish(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
      },
      () => { clearTimeout(timeout); finish(null); },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 30_000 },
    );
  });
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}
function formatDurationSince(iso: string): string {
  const start = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.max(0, Math.round((now - start) / 60_000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function FieldTimecard() {
  const [, navigate] = useLocation();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();

  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);

  const [state, setState] = useState<PunchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<null | "in" | "out" | "break_start" | "break_end">(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const [tick, setTick] = useState(0); // used to re-render the "clocked in for XXm" counter every 30s
  // Server-echoed timesheet id from the most recent punch response. Persists
  // in localStorage so the CTA survives a page reload. When null we skip
  // showing the "open this week's timesheet" card.
  const [lastTimesheetId, setLastTimesheetIdState] = useState<number | null>(() => {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem("trusspath.field.lastTimesheetId");
    return v ? Number(v) : null;
  });
  const setLastTimesheetId = (id: number | null) => {
    setLastTimesheetIdState(id);
    if (typeof localStorage !== "undefined") {
      if (id == null) localStorage.removeItem("trusspath.field.lastTimesheetId");
      else localStorage.setItem("trusspath.field.lastTimesheetId", String(id));
    }
  };

  useEffect(() => subscribeQueue(setQueueSize), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (projectId == null && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const refresh = async () => {
    setLoading(true);
    const resp = await fetchPunches();
    setState(resp);
    setLoading(false);
  };

  const open = state?.open ?? null;
  const clockedIn = open?.kind === "in";
  const onBreak = open?.kind === "break_start";

  const submitPunch = async (kind: "in" | "out" | "break_start" | "break_end") => {
    if (submitting) return;
    if (kind === "in" && projectId == null) {
      toast({ title: "Pick a project first", variant: "destructive" });
      return;
    }
    setSubmitting(kind);
    try {
      // Use the most recent open punch's project for out/break to keep continuity.
      const effectiveProjectId = kind === "in" ? projectId! : (open?.projectId ?? projectId);
      if (effectiveProjectId == null) {
        toast({ title: "Pick a project first", variant: "destructive" });
        return;
      }

      const coords = await getCoords();
      const clientId = `punch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = {
        kind,
        projectId: effectiveProjectId,
        clientId,
        occurredAt: new Date().toISOString(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accuracyM: coords?.accuracyM ?? null,
      };
      if (kind === "in") localStorage.setItem("trusspath.field.lastProjectId", String(effectiveProjectId));

      if (online) {
        try {
          const resp = await fetch("/api/field/punches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          // Server returns { punch, timesheetId, hoursToday, totalHours } —
          // pull the linkage so we can surface a jump-to-timesheet CTA and
          // fire the global event that refreshes the top-nav clock light.
          let timesheetId: number | null = null;
          let hoursToday: number | null = null;
          try {
            const body = await resp.json();
            timesheetId = body?.timesheetId ?? null;
            hoursToday = body?.hoursToday ?? null;
            if (timesheetId) setLastTimesheetId(timesheetId);
          } catch {}
          window.dispatchEvent(new CustomEvent("trusspath:punch", { detail: { kind } }));
          const project = projects.find((p) => p.id === effectiveProjectId)?.name || `Project #${effectiveProjectId}`;
          const desc =
            timesheetId != null
              ? `${project} · ${hoursToday != null ? hoursToday.toFixed(2) + "h today" : "linked to timesheet"}`
              : (coords ? `Location captured · ${project}` : `${project} · location unavailable`);
          toast({ title: describeKind(kind), description: desc });
          await refresh();
          return;
        } catch {
          // fall through to queue
        }
      }

      await queueRequest({
        kind: "timecard",
        url: "/api/field/punches",
        method: "POST",
        body: payload,
        meta: { kind, projectId: effectiveProjectId },
      });
      toast({ title: `${describeKind(kind)} (offline)`, description: "We'll upload when you're back online." });
      // Optimistically reflect the new state locally.
      setState((prev) => {
        const nowIso = new Date().toISOString();
        const optimistic: Punch = {
          id: -Math.floor(Math.random() * 1e9),
          kind,
          projectId: effectiveProjectId,
          occurredAt: nowIso,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          accuracyM: coords?.accuracyM ?? null,
          note: null,
          clientId,
        };
        const punches = [optimistic, ...(prev?.punches ?? [])].slice(0, 10);
        const openNow = kind === "in" || kind === "break_start" ? optimistic : null;
        return { punches, open: openNow };
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Layout title="Timecard">
      <div className="mx-auto max-w-2xl pb-8">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/field" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Field
          </Link>
          <div className="flex items-center gap-2">
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
            <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} data-testid="timecard-refresh">
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Clock className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Timecard</h1>
            <p className="text-xs text-muted-foreground">Clock in, take a break, clock out</p>
          </div>
        </div>

        {/* Current state */}
        <div className={cn(
          "mt-6 rounded-2xl border-2 p-5",
          clockedIn && "border-emerald-500/60 bg-emerald-500/5",
          onBreak && "border-amber-500/60 bg-amber-500/5",
          !clockedIn && !onBreak && "border-border bg-muted/20",
        )}>
          {open ? (
            <>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase",
                  clockedIn ? "bg-emerald-500 text-white" : "bg-amber-500 text-white",
                )}>
                  {clockedIn ? "Clocked in" : "On break"}
                </span>
                <span className="text-xs text-muted-foreground">since {formatTime(open.occurredAt)}</span>
              </div>
              <div key={tick} className="mt-2 font-display text-3xl font-bold tracking-tight">
                {formatDurationSince(open.occurredAt)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {projects.find((p) => p.id === open.projectId)?.name || `Project #${open.projectId}`}
                {open.lat != null && open.lng != null && (
                  <> · <MapPin className="inline size-3" /> {open.lat.toFixed(4)}, {open.lng.toFixed(4)}</>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-bold uppercase text-muted-foreground">
                Clocked out
              </div>
              <div className="mt-2 font-display text-2xl font-bold tracking-tight">Ready when you are</div>
              <div className="mt-1 text-xs text-muted-foreground">Pick a project below and tap Clock in.</div>
            </>
          )}
        </div>

        {/* This week's timesheet — shown any time we have a server-linked
            timesheet id. Deep-links straight into /timesheets so the user can
            sign & submit at end of week without hunting for the row. */}
        {lastTimesheetId != null && (
          <Link
            href={`/timesheets?open=${lastTimesheetId}`}
            className="mt-4 block rounded-xl border border-border bg-card p-4 hover-elevate"
            data-testid="timecard-timesheet-link"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This week&apos;s timesheet</div>
                <div className="mt-0.5 font-display text-base font-bold">Open &amp; review</div>
              </div>
              <div className="text-sm font-semibold text-primary">Go →</div>
            </div>
          </Link>
        )}

        {/* Project picker — only used when clocking in */}
        {!open && (
          <div className="mt-6">
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
            <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
              <SelectTrigger data-testid="timecard-project" className="h-12 text-base">
                <SelectValue placeholder="Pick a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 grid grid-cols-1 gap-3">
          {!open && (
            <Button
              size="lg"
              className="h-16 gap-2 bg-emerald-500 text-lg font-bold text-white hover:bg-emerald-600"
              onClick={() => submitPunch("in")}
              disabled={submitting !== null || projectId == null}
              data-testid="timecard-in"
            >
              {submitting === "in" ? <Loader2 className="size-6 animate-spin" /> : <LogIn className="size-6" />}
              Clock in
            </Button>
          )}
          {clockedIn && (
            <>
              <Button
                size="lg"
                className="h-16 gap-2 bg-amber-500 text-lg font-bold text-white hover:bg-amber-600"
                onClick={() => submitPunch("break_start")}
                disabled={submitting !== null}
                data-testid="timecard-break-start"
              >
                {submitting === "break_start" ? <Loader2 className="size-6 animate-spin" /> : <Coffee className="size-6" />}
                Start break
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-16 gap-2 border-rose-500/60 text-lg font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                onClick={() => submitPunch("out")}
                disabled={submitting !== null}
                data-testid="timecard-out"
              >
                {submitting === "out" ? <Loader2 className="size-6 animate-spin" /> : <LogOutIcon className="size-6" />}
                Clock out
              </Button>
            </>
          )}
          {onBreak && (
            <Button
              size="lg"
              className="h-16 gap-2 bg-emerald-500 text-lg font-bold text-white hover:bg-emerald-600"
              onClick={() => submitPunch("break_end")}
              disabled={submitting !== null}
              data-testid="timecard-break-end"
            >
              {submitting === "break_end" ? <Loader2 className="size-6 animate-spin" /> : <CheckCircle2 className="size-6" />}
              End break
            </Button>
          )}
        </div>

        {/* Recent punches */}
        <div className="mt-8">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent activity</div>
          {loading && !state ? (
            <div className="h-32 animate-pulse rounded-xl border border-border bg-muted" />
          ) : state && state.punches.length > 0 ? (
            <ul className="space-y-1.5">
              {state.punches.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <span className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg",
                    p.kind === "in" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                    p.kind === "out" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}>
                    {p.kind === "in" ? <LogIn className="size-4" /> :
                     p.kind === "out" ? <LogOutIcon className="size-4" /> :
                     <Coffee className="size-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold">{describeKind(p.kind)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {projects.find((pj) => pj.id === p.projectId)?.name || `Project #${p.projectId}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold">{formatTime(p.occurredAt)}</div>
                    {p.lat != null && <div className="text-[10px] text-muted-foreground">GPS</div>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
              No punches yet. Your first clock-in will show up here.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function describeKind(k: string): string {
  switch (k) {
    case "in": return "Clocked in";
    case "out": return "Clocked out";
    case "break_start": return "Break started";
    case "break_end": return "Break ended";
    default: return k;
  }
}
