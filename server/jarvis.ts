import OpenAI from "openai";
import { storage } from "./storage";
import { runHealthScan } from "./health";

// Model routed through the platform OpenAI proxy (Responses API).
const MODEL = "gpt_5_1";

function buildPersona(s: Record<string, any> = {}): string {
  const term = (s.addressTerm as string)?.trim() || "sir";
  const tone = s.tone === "detailed" ? "detailed" : "concise";
  const length = tone === "detailed"
    ? "You may go into more depth when it helps, but stay organized."
    : "Keep answers short unless asked for detail.";
  return `You are Jarvis, the AI assistant inside TrussPath, a field construction project management platform.
You speak like a knowledgeable, friendly colleague — not a robot. Use contractions (I'm, can't, here's, that's). Be warm but professional. Be concise — don't over-explain or pad answers with filler.
Address the user as "${term}". Write numbers the way a person would say them out loud — "five thousand pounds" not "5,000 lbs", "six feet" not "6ft", "eighty-five decibels" not "85dB". Read dollar amounts naturally — "fifty grand" or "fifty thousand dollars" depending on context. Percentages should sound conversational — "around ten percent" not "10%".
Avoid ALL CAPS headers, robotic phrasing, or overly formatted lists. Use natural transitions instead of section headers. Bullet points are fine when there's a real list, but keep them short and conversational.
You have live read-only access to the project's data (tasks, RFIs, submittals, change orders, action items, team). Use it to give accurate, actionable answers.
You cannot write data yourself. When the user asks to create or change something, tell them what to do and which tab to use, and offer to help draft the wording.
You can run an APP HEALTH SCAN to find broken links or non-working modules. When the user asks about broken links, app health, what's broken, or what doesn't work, use the supplied scan results to answer concretely.
You're also a knowledgeable general assistant. Answer everyday questions helpfully:
- Weather — you have LIVE weather data when the project has an address set. Give current temperature, conditions, wind, humidity, and a 3-day forecast. Include construction-relevant safety notes for heat, wind, storms, or precipitation when applicable. If no weather data is available, suggest weather.gov or the OSHA-NIOSH Heat Safety app.
- Lunch/restaurants — when Google Maps is connected, you can find real nearby restaurants, coffee shops, and other places. When it's not connected, suggest checking Google Maps or Yelp near the site, mention food trucks and meal prep tips. Be practical.
- Construction safety — provide thorough OSHA-compliant guidance on PPE, fall protection, excavation, electrical safety, heat stress, toolbox talks, etc.
- General knowledge — answer questions on any topic. Be helpful, concise, and accurate.
You can LEARN from the user. When you don't know something, ask the user to tell you the answer and say you'll remember it. If the user says "remember that...", acknowledge that you've saved it.
When you don't know something, just say so — don't guess.
${length}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOpen(status: string): boolean {
  const s = (status || "").toLowerCase();
  return !["complete", "completed", "closed", "approved", "done"].includes(s);
}

function overdue(arr: any[], field: string): any[] {
  const t = today();
  return arr.filter((x) => x[field] && x[field] < t && isOpen(x.status));
}
function dueToday(arr: any[], field: string): any[] {
  const t = today();
  return arr.filter((x) => x[field] === t);
}

export type ContextBundle = { compact: string; projectName?: string };

export async function buildContext(projectId?: number): Promise<ContextBundle> {
  const p = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const pid = p?.id;
  const tasks = await storage.getTasks(pid);
  const rfis = await storage.getRfis(pid);
  const subs = await storage.getSubmittals(pid);
  const cos = await storage.getChangeOrders(pid);
  const actions = await storage.getActionItems(pid);
  const team = await storage.getTeam();

  const L = (arr: any[], label: string, field: string) => {
    const ov = overdue(arr, field).slice(0, 6);
    const dt = dueToday(arr, field).slice(0, 6);
    const open = arr.filter((x) => isOpen(x.status)).length;
    const lines: string[] = [];
    lines.push(`${label}: ${arr.length} total, ${open} open, ${overdue(arr, field).length} overdue, ${dueToday(arr, field).length} due today`);
    if (ov.length) lines.push("  OVERDUE: " + ov.map((x) => `${x.number || ""} ${x.title || x.subject || ""}`.trim()).join(" | "));
    if (dt.length) lines.push("  DUE TODAY: " + dt.map((x) => `${x.number || ""} ${x.title || x.subject || ""}`.trim()).join(" | "));
    return lines.join("\n");
  };

  const blocks: string[] = [
    `PROJECT: ${p?.name ?? "—"} | status ${p?.status ?? "—"} | ${p?.startDate ?? "?"} → ${p?.endDate ?? "?"}`,
    `TODAY: ${today()}`,
    L(tasks, "TASKS", "dueDate"),
    L(rfis, "RFIS", "dueDate"),
    L(subs, "SUBMITTALS", "dueDate"),
    L(cos, "CHANGE ORDERS", "dateIssued"),
    L(actions, "ACTION ITEMS", "dueDate"),
    `TEAM: ${team.length} members (${team.slice(0, 8).map((m) => `${m.name} (${m.role})`).join(", ")})`,
  ];

  return { compact: blocks.join("\n"), projectName: p?.name };
}

type Msg = { role: "user" | "assistant"; content: string };

const HEALTH_INTENT = /\b(broken|health|scan|not work|doesn'?t work|don'?t work|broken link|issues? in the app|what'?s broken|integrity)\b/i;
const SAFETY_BRIEF_INTENT = /\b(safety brief|safety briefing|toolbox talk|safety meeting|team safety|give me a safety|generate a safety|safety stand)\b/i;

function formatScan(r: Awaited<ReturnType<typeof runHealthScan>>): string {
  const lines: string[] = [
    `APP HEALTH SCAN — ${r.ok ? "PASS" : "ISSUES FOUND"}`,
    `${r.linkCount} links checked against ${r.routeCount} registered routes; ${r.brokenLinks.length} broken.`,
    `${r.moduleChecks.length} modules scanned; ${r.moduleChecks.filter((c) => c.status === "fail").length} failing.`,
  ];
  if (r.brokenLinks.length) lines.push("BROKEN LINKS: " + r.brokenLinks.map((l) => `${l.label} -> ${l.href} (${l.source})`).join(" | "));
  const failing = r.moduleChecks.filter((c) => c.status === "fail");
  if (failing.length) lines.push("FAILING MODULES: " + failing.map((c) => `${c.name} (${c.detail})`).join(" | "));
  return lines.join("\n");
}

export async function jarvisChat(projectId: number | undefined, history: Msg[]): Promise<{ reply: string }> {
  const { compact } = await buildContext(projectId);
  const settings = await storage.getSettings();
  const persona = buildPersona(settings);
  const client = new OpenAI();

  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lowerUser = lastUser.toLowerCase();
  const scanBlock = HEALTH_INTENT.test(lastUser) ? `\n\n--- APP HEALTH SCAN (live) ---\n${formatScan(await runHealthScan())}` : "";

  // Check for safety brief intent — generate structured safety brief with live weather
  const safetyBriefIntent = SAFETY_BRIEF_INTENT.test(lowerUser);

  // Fetch live weather/places data when relevant to the question
  let liveApiBlock = "";
  const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const address = project?.address;
  if (address) {
    // Always fetch weather for safety briefs
    if (safetyBriefIntent || /\b(weather|forecast|temperature|how hot|how cold|raining|rain|snow|wind|storm)\b/i.test(lowerUser)) {
      const { getWeather } = await import("./apis");
      const weather = await getWeather(address);
      if (weather) liveApiBlock += `\n\n--- LIVE WEATHER DATA ---\n${weather}`;
    }
    if (/\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee|hardware|supplies|hotel|gas)\b/i.test(lowerUser)) {
      const { getNearbyPlaces, hasPlacesApi } = await import("./apis");
      if (hasPlacesApi()) {
        const places = await getNearbyPlaces(address, lowerUser);
        if (places) liveApiBlock += `\n\n--- LIVE NEARBY PLACES ---\n${places}`;
      }
    }
  }

  // For safety briefs, use a specialized system prompt
  const safetyBriefBlock = safetyBriefIntent
    ? `\n\nThe user is asking for a TEAM SAFETY BRIEF. Generate a comprehensive safety briefing suitable for a superintendent to read aloud to the crew at the start of the day. Include:\n1. Date and project name\n2. Current weather conditions (use the live weather data if available) and weather-related safety warnings\n3. Seasonal hazards relevant to the current time of year\n4. Two rotating safety topics from this list: fall protection, PPE, trenching/excavation, electrical safety/lockout-tagout, material handling/crane ops, housekeeping/trip hazards, hand/power tools, hot work/fire prevention\n5. Any project-specific safety concerns (overdue work, due-today items that could create pressure to rush)\n6. A strong closing reminder about everyone going home safe\n\nKeep it conversational — like a real superintendent talking, not a textbook. Write numbers out naturally. Use contractions.\n`
    : "";

  const resp = await client.responses.create({
    model: MODEL,
    instructions: `${persona}${safetyBriefBlock}\n\n--- LIVE PROJECT DATA ---\n${compact}${scanBlock}${liveApiBlock}`,
    input: history.map((m) => ({ role: m.role, content: m.content })),
  });
  return { reply: resp.output_text ?? "" };
}

export async function jarvisBrief(projectId: number | undefined): Promise<{ brief: string; context: ContextBundle }> {
  const context = await buildContext(projectId);
  const settings = await storage.getSettings();
  const persona = buildPersona(settings);
  const client = new OpenAI();
  const resp = await client.responses.create({
    model: MODEL,
    instructions: persona,
    input: `Produce a crisp MORNING BRIEFING for today using the live project data below.
Structure: (1) a one-line greeting, (2) "Priorities" — the 2-3 most urgent items today, (3) "Overdue" — what slipped, (4) one proactive recommendation.
Keep it under ~160 words. Use short bullets. Do not invent items not in the data.

--- LIVE PROJECT DATA ---
${context.compact}`,
  });
  return { brief: resp.output_text ?? "", context };
}
