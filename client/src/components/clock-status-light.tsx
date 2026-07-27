// Clock-in status light shown in the top nav.
//
// Green pulsing dot  = currently clocked in (open punch exists)
// Amber              = on break (open break_start with no matching break_end)
// Grey               = clocked out (no open punch)
//
// Clicking navigates to /timecard so the user can act on it. The light
// polls every 30s to stay in sync when other devices punch, and also
// invalidates on the `trusspath:timesheet-ready` custom event fired by
// the timecard page after a clock in/out.

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type OpenPunch = {
  id: number;
  kind: "in" | "out" | "break_start" | "break_end";
  occurredAt: string;
  projectId?: number;
};

type PunchesResp = { punches: OpenPunch[]; open: OpenPunch | null };

export function ClockStatusLight() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { data } = useQuery<PunchesResp>({
    queryKey: ["/api/field/punches", { limit: 5 }],
    // Poll every 30s so multi-device use stays in sync. Cheap query.
    refetchInterval: 30_000,
    // Don't retry hard on 401 \u2014 users hitting nav pre-login shouldn't
    // spam the endpoint.
    retry: false,
    staleTime: 15_000,
  });

  // Listen for local punches (from timecard.tsx) so the light updates
  // instantly instead of waiting for the next poll.
  useEffect(() => {
    const onPunch = () => qc.invalidateQueries({ queryKey: ["/api/field/punches"] });
    window.addEventListener("trusspath:punch", onPunch);
    return () => window.removeEventListener("trusspath:punch", onPunch);
  }, [qc]);

  const open = data?.open ?? null;
  const onBreak = open?.kind === "break_start";
  const clockedIn = open?.kind === "in" || open?.kind === "break_end";
  const state: "in" | "break" | "out" = clockedIn ? "in" : onBreak ? "break" : "out";

  const label =
    state === "in" ? "Clocked in" : state === "break" ? "On break" : "Clocked out";

  return (
    <button
      type="button"
      onClick={() => setLocation("/timecard")}
      aria-label={`${label} \u2014 open timecard`}
      title={label}
      data-testid="clock-status-light"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover-elevate",
        state === "in" && "text-emerald-700 dark:text-emerald-400",
        state === "break" && "text-amber-700 dark:text-amber-400",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex size-2.5 rounded-full",
          state === "in" && "bg-emerald-500",
          state === "break" && "bg-amber-500",
          state === "out" && "bg-muted-foreground/40",
        )}
      >
        {state === "in" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" aria-hidden="true" />
        )}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
