export function formatCurrency(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function relativeDays(iso: string, now = new Date()): string {
  const due = new Date(iso + "T00:00:00");
  const ms = due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
}

export function isOverdue(iso: string, now = new Date()): boolean {
  const due = new Date(iso + "T00:00:00");
  return due.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
