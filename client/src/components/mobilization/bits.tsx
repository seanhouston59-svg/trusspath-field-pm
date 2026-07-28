import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { HealthTone } from "@shared/mobilization-catalog";

/** SVG progress ring. Sized for the page header (64) and the portfolio cards (56). */
export function ProgressRing({
  value, size = 64, stroke = 6, tone = "primary", label,
}: {
  value: number; size?: number; stroke?: number;
  tone?: HealthTone | "primary"; label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c - (clamped / 100) * c;
  const color = tone === "green" ? "hsl(var(--chart-2, 142 71% 45%))"
    : tone === "yellow" ? "hsl(38 92% 50%)"
    : tone === "red" ? "hsl(0 84% 60%)"
    : "hsl(var(--primary))";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display font-bold leading-none" style={{ fontSize: size * 0.26 }}>
          {clamped}%
        </span>
        {label && <span className="text-[9px] uppercase text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}

const HEALTH_STYLES: Record<HealthTone, string> = {
  green: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25",
  yellow: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/25",
  red: "bg-red-500/12 text-red-600 dark:text-red-400 ring-1 ring-red-500/25",
};

const HEALTH_LABELS: Record<HealthTone, string> = {
  green: "On track", yellow: "At risk", red: "Behind",
};

export function HealthChip({ tone, className }: { tone: HealthTone; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", HEALTH_STYLES[tone], className)}
      data-testid={`health-chip-${tone}`}
    >
      <span className={cn("size-1.5 rounded-full", tone === "green" ? "bg-emerald-500" : tone === "yellow" ? "bg-amber-500" : "bg-red-500")} />
      {HEALTH_LABELS[tone]}
    </span>
  );
}

/** Dashboard stat tile — big number, small caption. */
export function StatTile({
  label, value, hint, tone,
}: {
  label: string; value: string | number; hint?: string; tone?: "default" | "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-1 font-display text-2xl font-bold",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "danger" && "text-red-600 dark:text-red-400",
      )}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  done: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  na: "bg-muted/60 text-muted-foreground line-through",
};

export function ItemStatusPill({ status }: { status: string }) {
  const label = status === "not_started" ? "Not started"
    : status === "in_progress" ? "In progress"
    : status === "done" ? "Done" : "N/A";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", ITEM_STATUS_STYLES[status] ?? ITEM_STATUS_STYLES.not_started)}>
      {label}
    </span>
  );
}

const PERMIT_STATUS_VARIANTS: Record<string, string> = {
  Approved: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  Applied: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  Rejected: "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
  Expired: "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
  "Not Started": "bg-muted text-muted-foreground ring-border",
};

export function PermitStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
      PERMIT_STATUS_VARIANTS[status] ?? PERMIT_STATUS_VARIANTS["Not Started"],
    )}>
      {status}
    </span>
  );
}

/** Small date chip; muted when unset, red when overdue and not yet done. */
export function DateChip({ date, overdue }: { date?: string | null; overdue?: boolean }) {
  if (!date) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("whitespace-nowrap text-xs", overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
      {date}
    </span>
  );
}

export function SectionProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 shrink-0 truncate text-xs font-medium">{label}</div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", value >= 90 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{value}%</div>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function YesNoBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? "default" : "secondary"} className={cn(!value && "text-muted-foreground")}>
      {value ? "Yes" : "No"}
    </Badge>
  );
}
