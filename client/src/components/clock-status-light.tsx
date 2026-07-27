// Clock status light shown in the top nav — also a one-tap punch toggle.
//
// Green pulsing dot  = currently clocked in (open punch exists)
// Amber              = on break
// Grey               = clocked out
//
// Interactions:
//   Click while clocked out    → open a small project picker popover;
//                                choosing a project clocks in immediately
//   Click while clocked in     → clock out (reuses the active project)
//   Click while on break       → resume from break
//   Long-press / right-click   → open /timesheets for review
//
// The popover remembers the last picked project in localStorage so
// repeat clock-ins are one tap (the row is auto-highlighted). This keeps
// the fast path fast without forcing anyone off the current page.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Check, MapPin, Search } from "lucide-react";
import type { Project } from "@shared/schema";

type OpenPunch = {
  id: number;
  kind: "in" | "out" | "break_start" | "break_end";
  occurredAt: string;
  projectId?: number;
};

type PunchesResp = { punches: OpenPunch[]; open: OpenPunch | null };

// Best-effort geolocation. We never block the punch on it — if the user
// denies location or is indoors we still record the event.
function getCoords(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    const timer = setTimeout(() => resolve(null), 2500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 2000, maximumAge: 60_000 },
    );
  });
}

export function ClockStatusLight() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const { data } = useQuery<PunchesResp>({
    queryKey: ["/api/field/punches"],
    // Explicit queryFn — the shared default one joins queryKey with "/", so
    // an object in the key would produce "/api/field/punches/[object Object]".
    // We hit the base URL directly with a real query string instead.
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/field/punches?limit=5");
      return (await res.json()) as PunchesResp;
    },
    refetchInterval: 20_000,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const onPunch = () => qc.invalidateQueries({ queryKey: ["/api/field/punches"] });
    window.addEventListener("trusspath:punch", onPunch);
    return () => window.removeEventListener("trusspath:punch", onPunch);
  }, [qc]);

  // Reset the filter each time the picker closes so the next open is a
  // clean slate.
  useEffect(() => {
    if (!pickerOpen) setFilter("");
  }, [pickerOpen]);

  const open = data?.open ?? null;
  const onBreak = open?.kind === "break_start";
  const clockedIn = open?.kind === "in" || open?.kind === "break_end";
  const state: "in" | "break" | "out" = clockedIn ? "in" : onBreak ? "break" : "out";
  const label = state === "in" ? "Clocked in" : state === "break" ? "On break" : "Clocked out";
  const nextAction = state === "in" ? "Clock out" : state === "break" ? "Resume" : "Clock in";

  const lastProjectId = (() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    if (!stored) return null;
    const n = Number(stored);
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const submitPunch = async (kind: "in" | "out" | "break_end", projectId: number) => {
    setBusy(true);
    try {
      const coords = await getCoords();
      const clientId = `punch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await apiRequest("POST", "/api/field/punches", {
        kind,
        projectId,
        clientId,
        occurredAt: new Date().toISOString(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accuracyM: coords?.accuracyM ?? null,
      });
      const body = await res.json().catch(() => ({}));

      if (kind === "in") {
        localStorage.setItem("trusspath.field.lastProjectId", String(projectId));
      }
      if (body?.timesheetId) {
        localStorage.setItem("trusspath.field.lastTimesheetId", String(body.timesheetId));
      }

      window.dispatchEvent(new CustomEvent("trusspath:punch", { detail: { kind } }));
      qc.invalidateQueries({ queryKey: ["/api/field/punches"] });
      qc.invalidateQueries({ queryKey: ["/api/timesheets"] });

      const projectName =
        projects?.find((p) => p.id === projectId)?.name ?? `Project #${projectId}`;
      const title =
        kind === "in" ? "Clocked in" : kind === "break_end" ? "Break ended" : "Clocked out";
      const desc =
        body?.hoursToday != null
          ? `${projectName} \u00b7 ${Number(body.hoursToday).toFixed(2)}h today`
          : projectName;
      toast({ title, description: desc });
    } catch (err) {
      console.warn("[clock-light] punch failed:", (err as Error)?.message ?? err);
      toast({
        title: "Couldn't record punch",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleMainClick = () => {
    if (longPressed.current || busy) return;
    if (state === "in") {
      // Clock out from the currently open project — no picker needed.
      const projectId = open?.projectId ?? lastProjectId;
      if (projectId == null) {
        toast({ title: "Couldn't find your active project", variant: "destructive" });
        return;
      }
      void submitPunch("out", projectId);
      return;
    }
    if (state === "break") {
      const projectId = open?.projectId ?? lastProjectId;
      if (projectId == null) {
        toast({ title: "Couldn't find your active project", variant: "destructive" });
        return;
      }
      void submitPunch("break_end", projectId);
      return;
    }
    // Clocked out: open the picker.
    setPickerOpen(true);
  };

  const startLongPress = () => {
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setLocation("/timesheets");
    }, 600);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Filter projects for the picker. Exclude clearly-inactive statuses so
  // the list stays short; users can still find them via search text.
  const visibleProjects = (() => {
    const list = projects ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.number?.toLowerCase().includes(q) ||
            p.client?.toLowerCase().includes(q),
        )
      : list.filter((p) => (p.status ?? "").toLowerCase() !== "completed");
    // Put the last-used project first so the fast-path is always at the
    // top of the list.
    if (lastProjectId != null) {
      const last = filtered.find((p) => p.id === lastProjectId);
      if (last) {
        return [last, ...filtered.filter((p) => p.id !== lastProjectId)];
      }
    }
    return filtered;
  })();

  const trigger = (
    <button
      type="button"
      onClick={handleMainClick}
      onContextMenu={(e) => {
        e.preventDefault();
        setLocation("/timesheets");
      }}
      onMouseDown={startLongPress}
      onMouseUp={cancelLongPress}
      onMouseLeave={cancelLongPress}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      disabled={busy}
      aria-label={`${label} \u2014 tap to ${nextAction.toLowerCase()}, long-press for timesheets`}
      title={`${label} \u00b7 Tap: ${nextAction} \u00b7 Long-press: Timesheets`}
      data-testid="clock-status-light"
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-wait",
        state === "in" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
        state === "break" && "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex size-2.5 rounded-full",
          state === "in" && "bg-emerald-500",
          state === "break" && "bg-amber-500",
          state === "out" && "bg-muted-foreground/40",
          busy && "animate-pulse",
        )}
      >
        {state === "in" && !busy && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" aria-hidden="true" />
        )}
      </span>
      <span className="hidden sm:inline">{busy ? "Working\u2026" : label}</span>
    </button>
  );

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="clock-project-picker">
        <div className="border-b border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clock in to</div>
          <div className="mt-1 font-display text-base font-bold">Pick a project</div>
        </div>
        {(projects?.length ?? 0) > 6 && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search projects\u2026"
                data-testid="clock-project-picker-search"
                className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm outline-none focus:border-foreground/30"
              />
            </div>
          </div>
        )}
        <div className="max-h-72 overflow-y-auto py-1">
          {visibleProjects.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              {filter ? "No matches" : "No projects available yet"}
            </div>
          ) : (
            visibleProjects.map((p) => {
              const isLast = p.id === lastProjectId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    void submitPunch("in", p.id);
                  }}
                  data-testid={`clock-project-option-${p.id}`}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                >
                  <span className={cn(
                    "grid size-8 place-items-center rounded-md text-xs font-bold",
                    isLast ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                  )}>
                    {isLast ? <Check className="size-4" /> : <MapPin className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[p.number, p.client, p.status].filter(Boolean).join(" \u00b7 ")}
                    </span>
                  </span>
                  {isLast && (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Last
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setLocation("/field/timecard");
            }}
            data-testid="clock-picker-open-timecard"
            className="w-full rounded-md px-2 py-2 text-center text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Open full timecard \u2192
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
