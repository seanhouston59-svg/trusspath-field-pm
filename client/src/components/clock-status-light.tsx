// Clock status light shown in the top nav — also a one-tap punch toggle.
//
// Green pulsing dot  = currently clocked in (open punch exists)
// Amber              = on break
// Grey               = clocked out
//
// Interactions:
//   Click          → toggle punch (in ↔ out, or resume break)
//   Right-click /  → open /timesheets (review)
//   long-press
//
// The one-tap punch reuses the last-used project id from localStorage
// (set by the timecard page) or falls back to the first accessible
// project. If neither is available, we route to /field/timecard so the
// user can pick a project explicitly.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  // Also read the projects list so we can pick a fallback default when
  // the user has never clocked in from this device before.
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

  const open = data?.open ?? null;
  const onBreak = open?.kind === "break_start";
  const clockedIn = open?.kind === "in" || open?.kind === "break_end";
  const state: "in" | "break" | "out" = clockedIn ? "in" : onBreak ? "break" : "out";
  const label = state === "in" ? "Clocked in" : state === "break" ? "On break" : "Clocked out";
  const nextAction = state === "in" ? "Clock out" : state === "break" ? "Resume" : "Clock in";

  // Resolve the project id we should attribute a new "in" punch to.
  //  1. The last "in" we saw on this account (server truth)
  //  2. The last project id used on this device (localStorage)
  //  3. The first project in the org
  const resolveProjectId = (): number | null => {
    if (open?.projectId) return open.projectId;
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("trusspath.field.lastProjectId");
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
    if (projects && projects.length > 0) return projects[0].id;
    return null;
  };

  const doPunch = async () => {
    if (busy) return;
    const kind: "in" | "out" | "break_end" =
      state === "in" ? "out" : state === "break" ? "break_end" : "in";

    // Clock-in needs a project. If we can't resolve one, route to the
    // full timecard so the user can pick one explicitly.
    let projectId: number | null = null;
    if (kind === "in") {
      projectId = resolveProjectId();
      if (projectId == null) {
        toast({ title: "Pick a project first", description: "Opening timecard\u2026" });
        setLocation("/field/timecard");
        return;
      }
    } else {
      // out / break_end reuse whatever the open punch is tied to.
      projectId = open?.projectId ?? resolveProjectId();
      if (projectId == null) {
        toast({ title: "Couldn't find your active project", variant: "destructive" });
        return;
      }
    }

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

      // Notify the rest of the app (timecard page, etc.) so their local
      // state refreshes without waiting for the next poll.
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

  // Long-press (600ms) opens the timesheets page for review. Works on
  // both touch and mouse.
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

  return (
    <button
      type="button"
      onClick={() => {
        if (longPressed.current) return; // long-press already handled
        void doPunch();
      }}
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
}
