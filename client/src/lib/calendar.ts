// Google Calendar integration helpers — pure client-side, no auth required.
// Works in preview and after publishing.

export type CalEvent = {
  id: string;
  title: string;
  start: string; // ISO date YYYY-MM-DD
  end: string;   // ISO date YYYY-MM-DD (inclusive end date)
  type: string;  // Task | RFI | Submittal | Change Order | Milestone | Imported
  source: "TrussPath" | "Google Calendar";
  description?: string;
  location?: string;
};

/* ----------------------------- date helpers ----------------------------- */
function pad(n: number): string { return String(n).padStart(2, "0"); }

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

// compact YYYYMMDD for Google Calendar all-day dates
function compact(iso: string): string {
  return iso.replace(/-/g, "");
}

/* --------------------------- google calendar --------------------------- */
// Builds a "Add to Google Calendar" link using Google's TEMPLATE action.
// All-day events use YYYYMMDD/YYYYMMDD (end is exclusive, so +1 day).
export function googleCalendarUrl(e: CalEvent): string {
  const startCompact = compact(e.start);
  const endExclusive = compact(addDays(e.end, 1));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${startCompact}/${endExclusive}`,
    details: e.description || e.type,
  });
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* -------------------------------- ICS ----------------------------------- */
// DTSTART/DTEND for all-day events: YYYYMMDD with VALUE=DATE.
function icsDate(iso: string): string { return compact(iso); }

function escapeICS(text: string): string {
  return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildICS(events: CalEvent[], calendarName = "TrussPath"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TrussPath//Field PM//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeICS(calendarName)}`,
  ];
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  for (const e of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.id}@trusspath`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDate(e.start)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(addDays(e.end, 1))}`);
    lines.push(`SUMMARY:${escapeICS(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeICS(e.location)}`);
    lines.push("CATEGORIES:" + escapeICS(e.type));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // CRLF line endings per RFC 5545
  return lines.join("\r\n");
}

export function downloadICS(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------ ICS parse ------------------------------ */
function unfold(text: string): string[] {
  // RFC 5545 line folding: a CRLF followed by space/tab continues the line.
  const raw = text.replace(/\r\n[ \t]/g, "");
  return raw.split(/\r\n|\n|\r/);
}

function icsToIsoDate(value: string): string {
  // value is YYYYMMDD or YYYYMMDDTHHMMSS[Z]
  const v = value.replace(/Z$/, "");
  if (v.length === 8) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  // datetime -> take date portion
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

export function parseICS(text: string): CalEvent[] {
  const lines = unfold(text);
  const events: CalEvent[] = [];
  let inEvent = false;
  let cur: Partial<CalEvent> & { id: string } = { id: "" };
  let i = 0;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEvent = true; cur = { id: `ics-${Date.now()}-${i++}`, source: "Google Calendar", type: "Imported" }; continue; }
    if (line === "END:VEVENT") {
      if (cur.title && cur.start) {
        events.push({
          id: cur.id,
          title: cur.title,
          start: cur.start,
          end: cur.end || cur.start,
          type: cur.type || "Imported",
          source: "Google Calendar",
          description: cur.description,
          location: cur.location,
        });
      }
      inEvent = false; continue;
    }
    if (!inEvent) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const keyProp = line.slice(0, colon);
    const val = line.slice(colon + 1);
    const key = keyProp.split(";")[0].toUpperCase();
    if (key === "SUMMARY") cur.title = val;
    else if (key === "DTSTART") cur.start = icsToIsoDate(val);
    else if (key === "DTEND") cur.end = icsToIsoDate(val);
    else if (key === "DESCRIPTION") cur.description = val;
    else if (key === "LOCATION") cur.location = val;
    else if (key === "CATEGORIES") cur.type = val.split(",")[0] || "Imported";
  }
  return events;
}
