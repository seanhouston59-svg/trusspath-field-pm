import { cn } from "@/lib/utils";
import logoUrl from "@/../public/trusspath-logo.jpg";

/* ----------------------------- Brand logo ----------------------------- */
/* TrussPath app icon — 3D T-mark with truss crown. */
export function Logo({ className }: { className?: string }) {
  return (
    <img src={logoUrl} alt="TrussPath" className={cn("object-contain rounded-lg", className)} />
  );
}

/* --------------------------- Team avatar ------------------------------ */
const AVATAR_COLORS: Record<string, string> = {
  amber: "#e07412", blue: "#2f7fd4", emerald: "#1f9d6b", violet: "#7c5cff",
  rose: "#e0457b", cyan: "#16a6b8", orange: "#ea7316", slate: "#5b6675",
};

export function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  const bg = AVATAR_COLORS[color] ?? AVATAR_COLORS.slate;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ background: bg, width: size, height: size, fontSize: size * 0.36 }}
      data-testid={`avatar-${initials}`}
    >
      {initials}
    </span>
  );
}

/* --------------------------- Status badges ---------------------------- */
const STATUS_STYLES: Record<string, string> = {
  "On Track": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  "At Risk": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  "Planning": "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/25",
  "Completed": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
};

export function ProjectStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLES[status] ?? STATUS_STYLES["On Track"])} data-testid={`status-project-${status}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const TASK_STATUS: Record<string, string> = {
  "Not Started": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
  "In Progress": "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/25",
  "Blocked": "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
  "Complete": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
};

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", TASK_STATUS[status] ?? TASK_STATUS["Not Started"])} data-testid={`status-task-${status}`}>
      {status}
    </span>
  );
}

const PRIORITY: Record<string, string> = {
  "Critical": "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
  "High": "bg-orange-500/12 text-orange-600 dark:text-orange-400 ring-orange-500/25",
  "Medium": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  "Low": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", PRIORITY[priority] ?? PRIORITY["Low"])} data-testid={`priority-${priority}`}>
      {priority}
    </span>
  );
}

const RFI_STATUS: Record<string, string> = {
  "Open": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  "Answered": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  "Draft": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
  "Closed": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
};

export function RfiStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", RFI_STATUS[status] ?? RFI_STATUS["Open"])} data-testid={`status-rfi-${status}`}>
      {status}
    </span>
  );
}

const SUB_STATUS: Record<string, string> = {
  "Open": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  "Approved": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  "Revise": "bg-orange-500/12 text-orange-600 dark:text-orange-400 ring-orange-500/25",
  "Closed": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
};
export function SubmittalStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", SUB_STATUS[status] ?? SUB_STATUS["Open"])} data-testid={`status-sub-${status}`}>{status}</span>;
}

const CO_STATUS: Record<string, string> = {
  "Pending": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  "Approved": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  "Rejected": "bg-red-500/12 text-red-600 dark:text-red-400 ring-red-500/25",
};
export function ChangeOrderStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", CO_STATUS[status] ?? CO_STATUS["Pending"])} data-testid={`status-co-${status}`}>{status}</span>;
}

const EQ_STATUS: Record<string, string> = {
  "On Site": "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  "Off Site": "bg-slate-500/12 text-slate-600 dark:text-slate-300 ring-slate-500/25",
  "In Maintenance": "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
};
export function EquipmentStatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", EQ_STATUS[status] ?? EQ_STATUS["Off Site"])} data-testid={`status-eq-${status}`}>{status}</span>;
}

const CONTACT_TINT: Record<string, string> = {
  Owner: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  Architect: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  Subcontractor: "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-sky-500/25",
  Authority: "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-rose-500/25",
};
export function ContactTypeBadge({ type }: { type: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", CONTACT_TINT[type] ?? CONTACT_TINT["Subcontractor"])} data-testid={`type-contact-${type}`}>{type}</span>;
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" }) {
  const toneClass = tone === "success" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-primary";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" data-testid="progress-bar">
      <div className={cn("h-full rounded-full transition-all", toneClass)} style={{ width: `${value}%` }} />
    </div>
  );
}
