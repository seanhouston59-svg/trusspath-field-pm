import { Flag, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/mobilization/bits";
import { daysUntil } from "@shared/mobilization-catalog";
import type { Milestone } from "@shared/schema";

function isDone(m: Milestone) {
  return /^complete|^done/i.test(m.status ?? "");
}

/** A milestone has slipped when its date has passed and it isn't complete. */
function hasSlipped(m: Milestone) {
  if (isDone(m)) return false;
  const d = daysUntil(m.date);
  return d !== null && d < 0;
}

export function TimelineTab({
  milestones, onSeed, seeding, seeded,
}: {
  milestones: Milestone[];
  onSeed: () => void;
  seeding: boolean;
  seeded: boolean;
}) {
  if (milestones.length === 0) {
    return (
      <EmptyState
        message={seeded
          ? "No mobilization milestones on this project yet."
          : "This project predates the Mobilization module — seed it to create the checklist, permits, and NTP-to-earthwork timeline."}
        action={!seeded ? <Button size="sm" onClick={onSeed} disabled={seeding}>{seeding ? "Seeding…" : "Seed mobilization plan"}</Button> : undefined}
      />
    );
  }

  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
  const todayIso = new Date().toISOString().slice(0, 10);
  // Index of the first milestone on/after today — the "today" marker slots in
  // just before it, or at the very end when everything is in the past.
  const todayIndex = sorted.findIndex((m) => m.date >= todayIso);

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
      <ol className="relative space-y-0">
        {sorted.map((m, i) => {
          const done = isDone(m);
          const slipped = hasSlipped(m);
          const d = daysUntil(m.date);
          return (
            <li key={m.id}>
              {i === todayIndex && <TodayMarker />}
              <div className="relative flex gap-4 pb-6 last:pb-0">
                {i < sorted.length - 1 && (
                  <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
                )}
                <span className="relative z-10 mt-0.5 shrink-0">
                  {done
                    ? <CheckCircle2 className="size-6 text-emerald-500" />
                    : <Circle className={cn("size-6", slipped ? "text-red-500" : "text-muted-foreground/50")} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("font-display text-sm font-bold", done && "text-muted-foreground line-through")}>
                      {m.title}
                    </span>
                    {slipped && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400">
                        <Flag className="size-3" /> Slipped
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {m.date}
                    {d !== null && !done && (
                      <span className={cn("ml-2", slipped && "font-semibold text-red-600 dark:text-red-400")}>
                        {d < 0 ? `${Math.abs(d)} days late` : d === 0 ? "Today" : `in ${d} days`}
                      </span>
                    )}
                  </div>
                  {m.notes && <p className="mt-1 text-xs text-muted-foreground">{m.notes}</p>}
                </div>
              </div>
            </li>
          );
        })}
        {todayIndex === -1 && <TodayMarker />}
      </ol>
    </div>
  );
}

function TodayMarker() {
  return (
    <div className="relative mb-4 flex items-center gap-3" aria-label="Today">
      <span className="z-10 size-[10px] shrink-0 translate-x-[7px] rounded-full bg-primary ring-4 ring-primary/20" />
      <div className="h-px flex-1 bg-primary/40" />
      <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Today</span>
    </div>
  );
}
