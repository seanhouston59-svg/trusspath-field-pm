import { Link } from "wouter";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * GhostState — shown when a page has no data after a wipe or on a fresh account.
 * Shows skeleton placeholder cards + a call-to-action to create the first record.
 */
export function GhostState({
  title,
  description,
  icon: Icon = Inbox,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref}>
          <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="size-4" /> {ctaLabel}
          </button>
        </Link>
      )}
    </div>
  );
}

/** Skeleton card grid for dashboards and list pages */
export function GhostCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-border bg-muted/50"
        />
      ))}
    </div>
  );
}

/** Skeleton rows for table-based pages */
export function GhostRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg border border-border bg-muted/50"
        />
      ))}
    </div>
  );
}

/* ---------- Ghost Data Rows — sample content showing what to enter ---------- */

const ghostRow = "border-b border-dashed border-border/50 text-muted-foreground/40";

/** Ghost task rows showing example task data */
export function GhostTaskRows() {
  const samples = [
    { task: "Install HVAC ductwork on floor 3", trade: "Mechanical", assignee: "TBD", due: "Mon, Jul 28", priority: "High", status: "Not Started" },
    { task: "Pour concrete slab — north wing", trade: "Concrete", assignee: "TBD", due: "Wed, Jul 30", priority: "Critical", status: "In Progress" },
    { task: "Rough-in electrical — rooms 201-210", trade: "Electrical", assignee: "TBD", due: "Fri, Aug 1", priority: "Medium", status: "Not Started" },
  ];
  return (
    <tbody className="divide-y divide-dashed divide-border/40">
      {samples.map((s, i) => (
        <tr key={i} className={ghostRow}>
          <td className="px-4 py-2.5">{s.task}</td>
          <td className="px-4 py-2.5">{s.trade}</td>
          <td className="px-4 py-2.5">{s.assignee}</td>
          <td className="px-4 py-2.5 tabular">{s.due}</td>
          <td className="px-4 py-2.5">{s.priority}</td>
          <td className="px-4 py-2.5">{s.status}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ghost RFI rows showing example RFI data */
export function GhostRfiRows() {
  const samples = [
    { num: "RFI-001", subject: "Clarify structural steel connection detail at grid C-4", assignee: "TBD", created: "Jul 22", due: "Jul 29", status: "Open" },
    { num: "RFI-002", subject: "Confirm door hardware schedule for fire-rated openings", assignee: "TBD", created: "Jul 23", due: "Jul 30", status: "In Review" },
    { num: "RFI-003", subject: "Verify waterproofing membrane transition at plaza deck", assignee: "TBD", created: "Jul 24", due: "Jul 31", status: "Open" },
  ];
  return (
    <tbody className="divide-y divide-dashed divide-border/40">
      {samples.map((s, i) => (
        <tr key={i} className={ghostRow}>
          <td className="px-4 py-2.5 font-mono text-xs">{s.num}</td>
          <td className="px-4 py-2.5">{s.subject}</td>
          <td className="px-4 py-2.5">{s.assignee}</td>
          <td className="px-4 py-2.5 tabular">{s.created}</td>
          <td className="px-4 py-2.5 tabular">{s.due}</td>
          <td className="px-4 py-2.5">{s.status}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ghost punch list rows showing example punch items */
export function GhostPunchRows() {
  const samples = [
    { item: "Touch-up paint — lobby east wall", location: "Lobby", trade: "Painting", assignee: "TBD", status: "Open" },
    { item: "Replace cracked floor tile — restroom 2", location: "Restroom 2", trade: "Flooring", assignee: "TBD", status: "Open" },
    { item: "Adjust door closer — unit 101 entry", location: "Unit 101", trade: "Doors", assignee: "TBD", status: "In Progress" },
  ];
  return (
    <tbody className="divide-y divide-dashed divide-border/40">
      {samples.map((s, i) => (
        <tr key={i} className={ghostRow}>
          <td className="px-4 py-2.5">{s.item}</td>
          <td className="px-4 py-2.5">{s.location}</td>
          <td className="px-4 py-2.5">{s.trade}</td>
          <td className="px-4 py-2.5">{s.assignee}</td>
          <td className="px-4 py-2.5">{s.status}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ghost change order rows showing example CO data */
export function GhostChangeOrderRows() {
  const samples = [
    { num: "CO-001", title: "Upgrade slab reinforcement to epoxy coating", amount: "$24,800", impact: "+3d", issued: "Jul 20", status: "Pending" },
    { num: "CO-002", title: "Add ADA-compliant door hardware to entries", amount: "$8,400", impact: "—", issued: "Jul 22", status: "Approved" },
    { num: "CO-003", title: "Revise MEP rough-in for conference room layout", amount: "$15,200", impact: "+1d", issued: "Jul 24", status: "Pending" },
  ];
  return (
    <tbody className="divide-y divide-dashed divide-border/40">
      {samples.map((s, i) => (
        <tr key={i} className={ghostRow}>
          <td className="px-4 py-2.5 font-mono text-xs">{s.num}</td>
          <td className="px-4 py-2.5">{s.title}</td>
          <td className="px-4 py-2.5 text-right tabular">{s.amount}</td>
          <td className="px-4 py-2.5 text-right tabular">{s.impact}</td>
          <td className="px-4 py-2.5 tabular">{s.issued}</td>
          <td className="px-4 py-2.5">{s.status}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ghost submittal rows showing example submittal data */
export function GhostSubmittalRows() {
  const samples = [
    { num: "SUB-001", subject: "Structural steel shop drawings — grid A-D", type: "Shop Drawings", assignee: "TBD", submitted: "Jul 22", due: "Jul 29", status: "In Review" },
    { num: "SUB-002", subject: "HVAC equipment cut sheets — rooftop units", type: "Product Data", assignee: "TBD", submitted: "Jul 23", due: "Jul 30", status: "Approved" },
    { num: "SUB-003", subject: "Floor tile samples — lobby and corridors", type: "Samples", assignee: "TBD", submitted: "Jul 24", due: "Jul 31", status: "Submitted" },
  ];
  return (
    <tbody className="divide-y divide-dashed divide-border/40">
      {samples.map((s, i) => (
        <tr key={i} className={ghostRow}>
          <td className="px-4 py-2.5 font-mono text-xs">{s.num}</td>
          <td className="px-4 py-2.5">{s.subject}</td>
          <td className="px-4 py-2.5">{s.type}</td>
          <td className="px-4 py-2.5">{s.assignee}</td>
          <td className="px-4 py-2.5 tabular">{s.submitted}</td>
          <td className="px-4 py-2.5 tabular">{s.due}</td>
          <td className="px-4 py-2.5">{s.status}</td>
        </tr>
      ))}
    </tbody>
  );
}

/** Ghost daily log entries showing example log data */
export function GhostDailyLogCards() {
  const samples = [
    { date: "Jul 25, 2026", weather: "88°F Sunny", crew: "8 on site", notes: "Poured slab in north wing. Framing crew started on floor 2 walls." },
    { date: "Jul 24, 2026", weather: "85°F Partly Cloudy", crew: "6 on site", notes: "MEP rough-in inspection passed. Electrical continuing on floor 3." },
  ];
  return (
    <div className="space-y-3">
      {samples.map((s, i) => (
        <div key={i} className={cn("rounded-lg border border-dashed border-border/40 p-4 text-muted-foreground/40")}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{s.date}</span>
            <span className="text-xs">{s.weather} · {s.crew}</span>
          </div>
          <p className="mt-2 text-sm">{s.notes}</p>
        </div>
      ))}
    </div>
  );
}

/** Ghost project cards showing example project data */
export function GhostProjectCards() {
  const samples = [
    { name: "Downtown Office Tower", client: "Meridian Development", type: "Commercial", status: "Active", budget: "$2.4M", progress: 45 },
    { name: "Riverside Medical Center", client: "HealthFirst", type: "Healthcare", status: "Active", budget: "$5.1M", progress: 28 },
    { name: "Summit High School Addition", client: "Summit School District", type: "Education", status: "Planning", budget: "$890K", progress: 5 },
  ];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <div className="h-px flex-1 bg-border/40" />
        <span>Preview — sample data</span>
        <div className="h-px flex-1 bg-border/40" />
      </div>
      <div className="relative">
        <div className="grid gap-4 opacity-40 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {samples.map((s, i) => (
            <div key={i} className="rounded-lg border border-dashed border-border p-4 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold">PRJ-00{i + 1}</span>
                <span className="text-xs">{s.status}</span>
              </div>
              <h3 className="mt-1 font-medium">{s.name}</h3>
              <p className="text-xs">{s.client} · {s.type}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span>{s.budget}</span>
                <span>{s.progress}%</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted">
                <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${s.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
        {/* Diagonal "SAMPLE" watermark so nobody thinks these are real projects. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="select-none font-display text-5xl font-black tracking-[0.3em] text-foreground/[0.06] md:text-6xl" style={{ transform: "rotate(-12deg)" }}>
            SAMPLE
          </span>
        </div>
      </div>
    </div>
  );
}

/** Ghost Gantt chart showing sample bars to demonstrate what it looks like */
export function GhostGantt() {
  const ghostLanes = [
    { trade: "Site Work", bars: [{ off: 0, w: 15, progress: 100, status: "Done" }] },
    { trade: "Concrete", bars: [{ off: 5, w: 20, progress: 60, status: "In Progress" }] },
    { trade: "Structural Steel", bars: [{ off: 12, w: 25, progress: 30, status: "In Progress" }] },
    { trade: "MEP Rough-In", bars: [{ off: 20, w: 30, progress: 10, status: "Not Started" }] },
    { trade: "Drywall & Finishes", bars: [{ off: 30, w: 25, progress: 0, status: "Not Started" }] },
  ];
  const ghostOverlays = [
    { label: "CO-001", off: 8, w: 3, color: "bg-blue-400/30" },
    { label: "RFI-002", off: 15, w: 7, color: "bg-purple-400/30" },
    { label: "SUB-001", off: 18, w: 7, color: "bg-cyan-400/30" },
  ];
  const totalDays = 60;
  const pxPerDay = 12;
  const labelW = 180;
  const headerH = 52;
  const laneH = 44;
  const totalW = labelW + totalDays * pxPerDay;
  const barColors: Record<string, string> = {
    "Done": "from-emerald-500/30 to-emerald-600/30",
    "In Progress": "from-amber-500/30 to-amber-600/30",
    "Not Started": "from-slate-400/20 to-slate-500/20",
  };
  const dotColors: Record<string, string> = {
    "Done": "bg-emerald-500/40",
    "In Progress": "bg-amber-500/40",
    "Not Started": "bg-slate-400/30",
  };

  return (
    <div className="rounded-xl border border-dashed border-border/40 bg-card/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-muted-foreground/50">
        <span className="text-xs font-semibold uppercase tracking-wide">Sample Gantt — create a project to see real data</span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex" style={{ width: totalW }}>
          {/* Label column */}
          <div className="shrink-0 border-r border-border/30" style={{ width: labelW }}>
            <div className="flex items-center px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/40" style={{ height: headerH }}>
              Work Breakdown
            </div>
            {ghostLanes.map((lane, i) => (
              <div key={i} className="flex items-center gap-1.5 px-3" style={{ height: laneH }}>
                <span className={cn("inline-block size-2 rounded-sm", dotColors[lane.bars[0].status])} />
                <span className="text-xs text-muted-foreground/40">{lane.trade}</span>
              </div>
            ))}
          </div>
          {/* Timeline column */}
          <div className="relative" style={{ width: totalDays * pxPerDay }}>
            {/* Header */}
            <div className="relative border-b border-border/30" style={{ height: headerH }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={cn("absolute top-0 h-full border-l border-border/20", i % 2 ? "bg-muted/20" : "")} style={{ left: i * 20 * pxPerDay, width: 20 * pxPerDay }}>
                  <span className="absolute top-1 left-1 text-[10px] text-muted-foreground/30">
                    Month {i + 1}
                  </span>
                </div>
              ))}
              {/* Ghost overlays in header */}
              {ghostOverlays.map((o, i) => (
                <div key={i} className={cn("absolute rounded-sm", o.color)} style={{ top: 2, left: o.off * pxPerDay, width: o.w * pxPerDay, height: 16 }}>
                  <span className="px-1 text-[8px] text-muted-foreground/40">{o.label}</span>
                </div>
              ))}
            </div>
            {/* Bars */}
            {ghostLanes.map((lane, i) => (
              <div key={i} className="relative border-b border-border/20" style={{ height: laneH }}>
                {lane.bars.map((bar, j) => (
                  <div
                    key={j}
                    className={cn("absolute top-1/2 -translate-y-1/2 rounded-md bg-gradient-to-b", barColors[bar.status])}
                    style={{ left: bar.off * pxPerDay, width: bar.w * pxPerDay, height: 20 }}
                  >
                    {bar.progress > 0 && (
                      <div className="absolute inset-y-0 left-0 rounded-l-md bg-foreground/5" style={{ width: `${bar.progress}%` }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
            {/* Today line */}
            <div className="absolute top-0 w-px bg-primary/20" style={{ left: 25 * pxPerDay, height: headerH + ghostLanes.length * laneH }}>
              <div className="absolute -top-0 -translate-x-1/2 rounded bg-primary/20 px-1 text-[8px] text-primary/30">Today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ghost calendar showing sample events to demonstrate the schedule page */
export function GhostCalendarEvents() {
  const samples = [
    { day: 15, title: "Pre-construction meeting", type: "Meeting" },
    { day: 20, title: "Foundation inspection", type: "Inspection" },
    { day: 25, title: "Steel delivery", type: "Delivery" },
    { day: 28, title: "Substantial completion", type: "Milestone" },
  ];
  return (
    <div className="space-y-2">
      {samples.map((s, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed border-border/40 px-3 py-2 text-muted-foreground/40">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted/50 text-xs font-semibold">{s.day}</span>
          <div>
            <div className="text-sm">{s.title}</div>
            <div className="text-xs">{s.type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
