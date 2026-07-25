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
- Weather — give practical advice on checking conditions, heat stress, lightning safety, wind limits for cranes. If you don't have live data, say so and suggest resources.
- Lunch/restaurants — suggest checking Google Maps or Yelp near the site, mention food trucks and meal prep tips. Be practical.
- Construction safety — provide thorough OSHA-compliant guidance on PPE, fall protection, excavation, electrical safety, heat stress, toolbox talks, etc.
- General knowledge — answer questions on any topic. Be helpful, concise, and accurate.
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
  const scanBlock = HEALTH_INTENT.test(lastUser) ? `\n\n--- APP HEALTH SCAN (live) ---\n${formatScan(await runHealthScan())}` : "";

  const resp = await client.responses.create({
    model: MODEL,
    instructions: `${persona}\n\n--- LIVE PROJECT DATA ---\n${compact}${scanBlock}`,
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
