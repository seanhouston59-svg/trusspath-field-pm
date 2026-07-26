/* Per-day bucketing for weekly timesheets.
 * Date keys are always local calendar dates: `Date.toISOString()` shifts to UTC
 * and yields the previous day for any positive-offset timezone. */

function pad(n: number): string { return String(n).padStart(2, "0"); }

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayOfWeekIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function groupEntriesByDay<T extends { entryDate: string }>(
  entries: T[],
  weekDates: Date[],
): T[][] {
  const keys = weekDates.map(toDateKey);
  const groups: T[][] = [[], [], [], [], [], [], []];
  for (const entry of entries) {
    const idx = keys.indexOf(entry.entryDate);
    // Entries outside the displayed week still belong on their own weekday column.
    groups[idx >= 0 ? idx : dayOfWeekIndex(entry.entryDate)]?.push(entry);
  }
  return groups;
}

export function sumHours(entries: { hoursWorked: string }[]): number {
  return entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0);
}

export function computeDayTotals(groups: { hoursWorked: string }[][]): string[] {
  return groups.map((dayEntries) => sumHours(dayEntries).toFixed(2));
}
