import { storage, normalizeQuestion, inferTopic } from "./storage";
import { buildContext, type ContextBundle } from "./jarvis";
import { runHealthScan } from "./health";
import { getWeather, getWeatherOneLiner, getNearbyPlaces, hasPlacesApi } from "./apis";
import { getOrganization, isValidTimezone } from "./lib/orgs";

// Resolve the caller's org timezone — falls back to America/Denver whenever
// the org can't be looked up or its stored timezone is invalid. Used to keep
// greetings, "today", and other user-facing dates in local time on Vercel
// serverless (which runs in UTC).
async function resolveOrgTimezone(organizationId?: number): Promise<string> {
  const FALLBACK = "America/Denver";
  if (!organizationId) return FALLBACK;
  try {
    const org = await getOrganization(organizationId);
    const tz = org?.timezone;
    return isValidTimezone(tz) ? (tz as string) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// Local YYYY-MM-DD in a specific IANA timezone — so "today" doesn't roll over
// at 6pm Denver just because it's midnight UTC.
function todayInTz(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    // en-CA yields YYYY-MM-DD already.
    return parts;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// When no LLM API key is available, Jarvis uses this local response engine.
// Responses are written to sound natural and conversational, the way a real
// person would talk — numbers spelled out, contractions, warm tone.

const CONSTRUCTION_QA: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["what is rfi", "what's an rfi", "what is a rfi", "rfi mean", "define rfi"],
    answer: "An RFI, or Request for Information, is basically a formal question you send to the architect, engineer, or owner when something in the plans or specs isn't clear. It's a paper trail — you ask, they answer, and everyone's on the same page. Helps avoid costly mistakes down the road. You can create and track RFIs right here in TrussPath under the RFIs tab.",
  },
  {
    keywords: ["what is change order", "what's a change order", "change order mean", "define change order"],
    answer: "A change order is a formal change to the original contract — could be scope, schedule, or budget. Maybe the owner wants to add a room, or swap out a material. Whatever it is, it gets documented with a price and a schedule impact, and the owner has to sign off before the work happens. You can track all of that under the Change Orders tab in TrussPath.",
  },
  {
    keywords: ["what is submittal", "what's a submittal", "submittal mean", "define submittal"],
    answer: "A submittal is when you send shop drawings, product data, or material samples to the architect or engineer for approval before you actually buy or install anything. Think of it as a double-check — making sure what you're planning to use matches what the design calls for. TrussPath tracks all your submittals under the Submittals tab.",
  },
  {
    keywords: ["what is punch list", "what's a punch list", "punch list mean", "define punch list", "punch out"],
    answer: "A punch list is that final to-do list you put together near the end of a project — all the little things that need fixing before you hand over the keys. Could be a scratched wall, a missing cover plate, a door that doesn't close right. You walk through with the owner, make the list, and knock it out. TrussPath manages all of that under the Punch List tab.",
  },
  {
    keywords: ["what is daily log", "what's a daily log", "daily log mean", "daily report"],
    answer: "A daily log is your record of what happened on site each day — weather, how many guys were out there, what work got done, what got delivered, who visited, any incidents. It's one of those things that feels tedious until you need it for a claim or a dispute, and then it's worth its weight in gold. TrussPath has daily logs under the Daily Logs tab.",
  },
  {
    keywords: ["what is milestone", "milestone mean", "define milestone"],
    answer: "A milestone is just a key date in your schedule — it marks a big moment, like breaking ground, or hitting substantial completion. It doesn't have a duration, it's just a point in time. TrussPath tracks your milestones on the Schedule page so you can see them coming.",
  },
  {
    keywords: ["what is gantt", "gantt chart", "define gantt"],
    answer: "A Gantt chart is one of those horizontal bar charts that shows your tasks laid out over time — each bar is a task, and you can see when it starts, how long it runs, and when it wraps up. It's the easiest way to visualize a schedule at a glance. TrussPath has a Gantt view right under the Schedule tab.",
  },
  {
    keywords: ["substantial completion", "what is substantial completion"],
    answer: "Substantial completion is the moment the project is far enough along that the owner can actually use it for what it was built for — they can move in, start operating, that kind of thing. It's a big deal because it usually kicks off the warranty period, triggers final payment, and shifts responsibility over to the owner.",
  },
  {
    keywords: ["notice to proceed", "ntp", "what is ntp"],
    answer: "Notice to Proceed, or NTP, is the green light from the owner to start work. That's day one of your project — the clock starts ticking on your contract duration from that point. Usually recorded as a milestone on the schedule.",
  },
  {
    keywords: ["what is cpm", "critical path method", "define cpm"],
    answer: "The Critical Path Method is a way of scheduling where you figure out the longest chain of dependent tasks — the ones that have to happen in order and can't be delayed without pushing back the whole project. That chain is your critical path. If anything on it slips, your finish date slips. TrussPath includes a CPM view so you can see it visually.",
  },
  {
    keywords: ["what is rfi vs submittal", "difference rfi submittal", "rfi versus submittal"],
    answer: "Good question — they're easy to mix up. An RFI is when you're asking a question because the plans aren't clear. A submittal is when you're showing the architect what you plan to use or build, and you need their thumbs-up before you proceed. RFIs resolve confusion; submittals confirm materials and methods. Both get tracked separately in TrussPath.",
  },
  {
    keywords: ["retainage", "what is retainage", "retention"],
    answer: "Retainage is a chunk of money the owner holds back from each payment — usually five to ten percent — until the whole project is done. It's basically their insurance policy to make sure you finish the job. You get it released at substantial completion and then again at final completion.",
  },
  {
    keywords: ["what is lien waiver", "lien waiver"],
    answer: "A lien waiver is a document where you give up your right to file a mechanic's lien on the property, usually in exchange for getting paid. There are two main flavors — conditional, which kicks in when the check actually clears, and unconditional, which is a straight release. You'll sign these on pretty much every payment.",
  },
  {
    keywords: ["what is o&m", "o&m manual", "operation maintenance manual"],
    answer: "O&M manuals are the binders of documentation you hand over at closeout — operating instructions, maintenance schedules, warranties, equipment info, all of it. The owner needs these to keep the building running after you're gone. They're not the most exciting part of the job, but they're essential for facility management.",
  },
  {
    keywords: ["construction safety", "safety protocols", "site safety", "safety on site", "safety procedures", "safety rules", "osha"],
    answer: "Here's a rundown of the main safety protocols on a construction site:\n\nPPE is your baseline — hard hats in active work zones, safety glasses when you're cutting or drilling, steel-toe boots, high-vis vests around equipment and traffic, gloves and hearing protection as needed.\n\nFall protection kicks in at six feet or higher. That means guardrails, safety nets, or a personal fall arrest system — harness, lanyard, and an anchor point. Ladders need three points of contact and should extend three feet above the landing. Cover and mark any floor openings.\n\nExcavation and trenching — trenches deeper than five feet need sloping, shoring, or shielding. A competent person has to inspect them daily. Keep spoil piles at least two feet back from the edge.\n\nElectrical — lockout and tagout before you service anything. GFCI on all temporary power. Maintain clearance from overhead lines.\n\nGeneral stuff — hold a toolbox talk every morning, keep walkways clear, have fire extinguishers within a hundred feet of travel, and report any incidents or near-misses right away.\n\nWant me to go deeper on any of those?",
  },
  {
    keywords: ["fall protection", "harness", "fall arrest"],
    answer: "OSHA requires fall protection at six feet or higher in construction. Your main options are guardrail systems (top rail at forty-two inches, give or take three), safety nets underneath the work area, or a personal fall arrest system — that's a full-body harness, lanyard, and an anchor point rated for five thousand pounds per worker.\n\nA few key things — inspect your harness before every use, the D-ring goes in the center of your back, and never tie a knot in a lanyard. For low-slope roofs, you can use a warning line plus a safety monitor.",
  },
  {
    keywords: ["toolbox talk", "safety meeting", "safety briefing", "pre-job briefing"],
    answer: "A toolbox talk is just a quick safety huddle — five, maybe fifteen minutes — before the crew starts work. You cover what everyone's doing that day, what hazards to watch for, what PPE they need, where the emergency exits are, what the weather's doing, and any recent incidents or near-misses worth learning from.\n\nBest practice is to hold one every morning, keep a sign-in sheet, and rotate the topics so it doesn't get stale. The best ones are interactive — ask the crew what they think the hazards are, don't just lecture them.",
  },
  {
    keywords: ["heat stress", "heat exhaustion", "heat stroke", "hot weather safety"],
    answer: "Heat illness is a real risk on site. Here's what to watch for:\n\nPrevention — provide shade and cool water, at least a quart an hour per person. Schedule the heavy stuff for early morning when it's cooler. Break in new workers gradually — start them at twenty percent of a normal day and ramp up over a week or two. Take frequent shade breaks.\n\nHeat exhaustion looks like heavy sweating, weakness, dizziness, nausea, headache. Get that person to shade, give them water, let them cool down.\n\nHeat stroke is a medical emergency — confusion, passing out, skin that's hot to the touch, body temp over a hundred and three. Call nine-one-one immediately. Don't wait.\n\nOSHA uses the General Duty Clause for heat right now. Some states like California, Washington, and Minnesota have their own specific heat rules.",
  },
  {
    keywords: ["ppe", "personal protective equipment", "safety gear"],
    answer: "Here's the PPE you need on a construction site, per OSHA:\n\nHard hats — ANSI Z eighty-nine point one\nEye and face protection — ANSI Z eighty-seven point one\nSteel-toe boots — ASTM F twenty-four thirteen\nGloves — matched to whatever task you're doing\nHearing protection — needed at eighty-five decibels or higher over an eight-hour shift\nRespiratory protection — when airborne hazards exceed permissible exposure limits\nHigh-visibility apparel — ANSI/ISEA one-oh-seven\n\nThe employer has to provide all of this at no cost to the worker, with a few exceptions. And workers need to be trained on how to use it, maintain it, and know its limits.",
  },
  {
    keywords: ["weather"],
    answer: "I'm trying to pull live weather for your project, but it looks like I couldn't get it. Here's what I'd suggest for checking conditions on site:\n\nThe OSHA-NIOSH Heat Safety app gives you the real-time heat index and precautions. For forecasts and severe weather, weather.gov or a NOAA weather radio is your best bet.\n\nA couple of rules of thumb — crane operations need to stop when sustained winds hit twenty miles per hour or more, though check the manufacturer specs because some are lower. And for lightning, use the thirty/thirty rule: if thunder follows lightning by less than thirty seconds, get to shelter, and wait thirty minutes after the last thunder before going back out.\n\nMake sure your project has an address set and I can fetch live conditions for you. Or if you've got a weather tip specific to your area, just say \"remember that...\" and I'll save it for next time.",
  },
  {
    keywords: ["lunch", "food", "eat", "restaurant", "lunch spots", "where to eat", "hungry"],
    answer: "I'd love to pull up nearby lunch spots for you, but I need a Google Maps API key set up first. Once that's connected, I can find restaurants, coffee shops, hardware stores, gas stations — anything near your project site automatically.\n\nIn the meantime, check Google Maps or Yelp for spots within ten or fifteen minutes of your site address. Look for places with quick service — delis, food trucks, fast-casual spots. A lot of sites actually bring a food truck on-site for lunch, which saves everyone a trip.\n\nIf you know some good spots near your site, just tell me — say something like \"remember that the best lunch spot near here is Tony's Deli\" and I'll save it. Next time you ask, I'll have it ready.",
  },
  {
    keywords: ["joke", "funny", "tell me something"],
    answer: "Why did the construction worker bring a pencil to the job site?\n\nTo draw up plans, of course.\n\nAlright, bad joke aside — what can I actually help you with?",
  },
  {
    keywords: ["time", "what time", "date", "what day", "today's date"],
    answer: `Right now it's ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
  },
  {
    keywords: ["who made you", "who created you", "who built you"],
    answer: "I'm Jarvis, built into TrussPath. I'm here to help with your project, answer construction questions, or just be a sounding board. Think of me as your right-hand guy on the site.",
  },
];

const GREETING_PATTERNS = [
  { keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"], answer: "Hey, good to see you. What can I help with today?" },
  { keywords: ["how are you", "how's it going", "you good"], answer: "Doing great, thanks! What's on your mind?" },
  { keywords: ["thank you", "thanks", "cheers"], answer: "Anytime! Let me know if you need anything else." },
  { keywords: ["who are you", "what are you", "your name"], answer: "I'm Jarvis — your AI assistant inside TrussPath. I can answer construction questions, pull up your project status, help you navigate the app, or just chat. What do you need?" },
  { keywords: ["what can you do", "help", "capabilities", "features"], answer: "Here's what I can help with:\n• Construction questions — RFIs, change orders, submittals, safety protocols, PPE, fall protection, OSHA standards\n• General stuff — weather guidance, lunch spots near your site, jokes, the time and date\n• Project status — just ask \"what's overdue?\" or \"give me a briefing\"\n• Navigation — \"where do I create a task?\" or \"how do I find the Gantt chart?\"\n• App health — \"is anything broken?\"\n\nWhat would you like to know?" },
];

function matchPatterns(input: string, patterns: { keywords: string[]; answer: string }[]): string | null {
  const lower = input.toLowerCase().trim();
  for (const p of patterns) {
    if (p.keywords.some((k) => lower.includes(k))) {
      return p.answer;
    }
  }
  return null;
}

/**
 * Legacy synchronous brief — kept only for callers that still pass a
 * ContextBundle. New code should call {@link buildRichLocalBrief} which does
 * its own storage queries and produces a much more useful, natural brief with
 * named items, weather, and a specific recommendation.
 */
export function buildLocalBrief(ctx: ContextBundle): string {
  const lines = ctx.compact.split("\n");
  const projectLine = lines[0] ?? "No active project found.";
  const today = lines[1] ?? "";
  const overdueLines = lines.filter((l) => l.includes("OVERDUE"));
  const dueTodayLines = lines.filter((l) => l.includes("DUE TODAY"));
  const priorities: string[] = [];
  if (overdueLines.length) priorities.push(`You've got overdue items \u2014 ${overdueLines.length} ${overdueLines.length === 1 ? "category has" : "categories have"} work that's slipped past the due date`);
  if (dueTodayLines.length) priorities.push("Some items are due today, so make sure the right people are on them");
  if (!priorities.length) priorities.push("Nothing urgent \u2014 everything's on track");
  const overdue = overdueLines.length ? overdueLines.join("\n") : "Nothing overdue, which is great.";
  return `Here's your morning briefing.\n\n${projectLine}\n${today}\n\nPriorities:\n${priorities.map((p) => `- ${p}`).join("\n")}\n\nOverdue:\n${overdue}\n\nOne thing to stay on top of \u2014 check the Schedule tab for any milestones coming up, and make sure everyone on the team has their tasks assigned.`;
}

/* ---------- Rich local brief (no LLM required) ---------- */

// A construction PM briefing is only useful if it names specific items,
// specific counts, and gives one concrete next action. buildRichLocalBrief
// pulls the raw project data itself so it can do all three without an LLM.

const YYYY_MM_DD = () => new Date().toISOString().slice(0, 10);
const OPEN_STATUSES = new Set(["open", "in_progress", "pending", "submitted", "under_review", "resubmitted", "active", "draft"]);
const isOpen = (s: string | null | undefined) => !s || OPEN_STATUSES.has(String(s).toLowerCase());

function fmtDaysLate(dateStr: string): string {
  const days = Math.max(0, Math.floor((Date.parse(YYYY_MM_DD()) - Date.parse(dateStr)) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day late";
  return `${days} days late`;
}

function pickOverdue<T extends Record<string, any>>(items: T[], field: string): T[] {
  const today = YYYY_MM_DD();
  return items
    .filter((x) => x[field] && x[field] < today && isOpen(x.status))
    .sort((a, b) => String(a[field]).localeCompare(String(b[field]))); // oldest slip first
}

function pickDueToday<T extends Record<string, any>>(items: T[], field: string): T[] {
  const today = YYYY_MM_DD();
  return items.filter((x) => x[field] === today && isOpen(x.status));
}

function itemLabel(x: Record<string, any>): string {
  const num = x.number ? `${x.number}` : "";
  const title = (x.title || x.subject || x.description || "untitled").toString().trim();
  return num ? `${num} \u2014 ${title}` : title;
}

// Local time-of-day + weekday for a given IANA timezone. Vercel's runtime is
// UTC, so this is what makes "morning" mean 9am in Denver instead of 3pm UTC.
function localHourAndDay(timezone: string): { hour: number; day: string } {
  const now = new Date();
  // Grab the hour in the requested timezone as an integer (0–23).
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(now);
  return { hour: Number.isFinite(hour) ? hour : 12, day };
}

function weekdayGreeting(timezone: string = "America/Denver"): string {
  const { hour: hr, day } = localHourAndDay(timezone);
  if (hr < 5) return `Late night check-in, ${day.toLowerCase()}. Here's where things stand.`;
  if (hr < 12) return `Good morning \u2014 here's your ${day} briefing.`;
  if (hr < 17) return `Afternoon check-in for ${day}. Here's where the project stands.`;
  return `Evening wrap on ${day}. Here's where the project stands.`;
}

function projectHealthLine(project: any, today: string): string | null {
  if (!project) return null;
  const start = project.startDate;
  const end = project.endDate;
  if (!start || !end) return null;
  const total = Math.max(1, (Date.parse(end) - Date.parse(start)) / 86_400_000);
  const elapsed = Math.max(0, (Date.parse(today) - Date.parse(start)) / 86_400_000);
  const pct = Math.min(100, Math.round((elapsed / total) * 100));
  const daysToEnd = Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000);
  if (daysToEnd < 0) return `You're past the scheduled end date (${end}) by ${Math.abs(daysToEnd)} days.`;
  if (daysToEnd === 0) return `Today is the scheduled end date. Confirm closeout status.`;
  if (pct < 5) return `Project just kicked off \u2014 you're about ${pct}% through the contract duration, ${daysToEnd} days to end date.`;
  return `You're roughly ${pct}% through the contract duration, ${daysToEnd} days to end date (${end}).`;
}

function buildRecommendation(bucket: { overdueRfis: any[]; overdueSubs: any[]; overdueTasks: any[]; overdueActions: any[]; overdueCos: any[]; dueTodayTotal: number; nothingOverdue: boolean }): string {
  // Order matters — pick the highest-leverage thing to nudge on today.
  if (bucket.overdueRfis.length >= 2) {
    return `Focus today \u2014 you've got ${bucket.overdueRfis.length} RFIs waiting on responses. Chase the oldest one (${itemLabel(bucket.overdueRfis[0])}) with the architect first; nothing else moves until questions get answered.`;
  }
  if (bucket.overdueSubs.length >= 2) {
    return `Focus today \u2014 ${bucket.overdueSubs.length} submittals are past due. Push the oldest (${itemLabel(bucket.overdueSubs[0])}) through review; late submittals delay procurement.`;
  }
  if (bucket.overdueRfis[0]) {
    return `Chase the overdue RFI ${itemLabel(bucket.overdueRfis[0])} \u2014 it's been sitting for ${fmtDaysLate(bucket.overdueRfis[0].dueDate)}.`;
  }
  if (bucket.overdueSubs[0]) {
    return `Chase submittal ${itemLabel(bucket.overdueSubs[0])} \u2014 ${fmtDaysLate(bucket.overdueSubs[0].dueDate)} on the review turnaround.`;
  }
  if (bucket.overdueTasks[0]) {
    return `Get ${itemLabel(bucket.overdueTasks[0])} reassigned or closed today \u2014 it's ${fmtDaysLate(bucket.overdueTasks[0].dueDate)}.`;
  }
  if (bucket.overdueActions[0]) {
    return `Circle back on the overdue action item: ${itemLabel(bucket.overdueActions[0])} \u2014 ${fmtDaysLate(bucket.overdueActions[0].dueDate)}.`;
  }
  if (bucket.overdueCos[0]) {
    return `Chase change order ${itemLabel(bucket.overdueCos[0])} for owner sign-off \u2014 unsigned COs block invoicing.`;
  }
  if (bucket.dueTodayTotal > 0) {
    return `${bucket.dueTodayTotal} ${bucket.dueTodayTotal === 1 ? "item is" : "items are"} due today \u2014 confirm each owner has what they need before end of day.`;
  }
  if (bucket.nothingOverdue) {
    return `Nothing overdue right now. Good time to look ahead \u2014 review upcoming milestones on the Schedule tab and confirm next week's task assignments.`;
  }
  return `Keep the crew focused on their assigned tasks today. Check the Schedule tab for upcoming milestones.`;
}

export async function buildRichLocalBrief(projectId?: number, organizationId?: number): Promise<string> {
  // Resolve the org's timezone so "today", "morning", etc. mean the user's local
  // time — not UTC (Vercel serverless runs in UTC by default).
  const timezone = await resolveOrgTimezone(organizationId);
  const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  if (!project) {
    return `${weekdayGreeting(timezone)}\n\nNo active project found yet. Head to the Projects tab and create one \u2014 once it's set up I can give you real briefings with overdue items, weather, and priorities.`;
  }
  const pid = project.id;
  const today = todayInTz(timezone);

  const [tasks, rfis, subs, cos, actions, team] = await Promise.all([
    storage.getTasks(pid),
    storage.getRfis(pid),
    storage.getSubmittals(pid),
    storage.getChangeOrders(pid),
    storage.getActionItems(pid),
    storage.getTeam(),
  ]);

  const overdueTasks = pickOverdue(tasks, "dueDate");
  const overdueRfis = pickOverdue(rfis, "dueDate");
  const overdueSubs = pickOverdue(subs, "dueDate");
  const overdueCos = pickOverdue(cos, "dateIssued");
  const overdueActions = pickOverdue(actions, "dueDate");
  const dueTodayTasks = pickDueToday(tasks, "dueDate");
  const dueTodayRfis = pickDueToday(rfis, "dueDate");
  const dueTodaySubs = pickDueToday(subs, "dueDate");
  const dueTodayActions = pickDueToday(actions, "dueDate");

  const overdueTotal = overdueTasks.length + overdueRfis.length + overdueSubs.length + overdueCos.length + overdueActions.length;
  const dueTodayTotal = dueTodayTasks.length + dueTodayRfis.length + dueTodaySubs.length + dueTodayActions.length;

  // Try to pull a compact weather line — optional, brief works without it.
  let weatherLine: string | null = null;
  if (project.address) {
    try { weatherLine = await getWeatherOneLiner(project.address); } catch { /* ignore */ }
  }

  // Assemble the brief. Kept warm and specific — real names, real counts.
  const lines: string[] = [];
  lines.push(weekdayGreeting(timezone));
  lines.push("");
  const status = project.status ? ` (${project.status})` : "";
  lines.push(`PROJECT: ${project.name}${status}`);
  const health = projectHealthLine(project, today);
  if (health) lines.push(health);
  if (weatherLine) lines.push(`On site: ${weatherLine}.`);
  lines.push("");

  // Priorities section — specific items named, not a generic "you have overdue items".
  lines.push("PRIORITIES");
  if (overdueTotal === 0 && dueTodayTotal === 0) {
    lines.push("- Nothing overdue, nothing due today. Everything's on track.");
  } else {
    if (dueTodayTotal > 0) {
      const dueBits: string[] = [];
      if (dueTodayTasks.length) dueBits.push(`${dueTodayTasks.length} ${dueTodayTasks.length === 1 ? "task" : "tasks"}`);
      if (dueTodayRfis.length) dueBits.push(`${dueTodayRfis.length} ${dueTodayRfis.length === 1 ? "RFI" : "RFIs"}`);
      if (dueTodaySubs.length) dueBits.push(`${dueTodaySubs.length} ${dueTodaySubs.length === 1 ? "submittal" : "submittals"}`);
      if (dueTodayActions.length) dueBits.push(`${dueTodayActions.length} action ${dueTodayActions.length === 1 ? "item" : "items"}`);
      lines.push(`- Due today: ${dueBits.join(", ")}. Make sure owners have what they need.`);
    }
    if (overdueRfis.length) {
      const top = overdueRfis.slice(0, 2).map(itemLabel).join("; ");
      lines.push(`- ${overdueRfis.length} ${overdueRfis.length === 1 ? "RFI is" : "RFIs are"} overdue \u2014 oldest: ${top} (${fmtDaysLate(overdueRfis[0].dueDate)}).`);
    }
    if (overdueSubs.length) {
      const top = overdueSubs.slice(0, 2).map(itemLabel).join("; ");
      lines.push(`- ${overdueSubs.length} ${overdueSubs.length === 1 ? "submittal is" : "submittals are"} overdue \u2014 oldest: ${top} (${fmtDaysLate(overdueSubs[0].dueDate)}).`);
    }
    if (overdueTasks.length) {
      const top = overdueTasks.slice(0, 2).map(itemLabel).join("; ");
      lines.push(`- ${overdueTasks.length} ${overdueTasks.length === 1 ? "task is" : "tasks are"} past due \u2014 e.g. ${top}.`);
    }
    if (overdueActions.length) {
      lines.push(`- ${overdueActions.length} action ${overdueActions.length === 1 ? "item is" : "items are"} overdue.`);
    }
    if (overdueCos.length) {
      lines.push(`- ${overdueCos.length} change ${overdueCos.length === 1 ? "order" : "orders"} still pending sign-off.`);
    }
  }
  lines.push("");

  // Numbers section — quick at-a-glance counts for anyone who wants the totals.
  const openTasks = tasks.filter((t: any) => isOpen(t.status)).length;
  const openRfis = rfis.filter((r: any) => isOpen(r.status)).length;
  const openSubs = subs.filter((s: any) => isOpen(s.status)).length;
  const openCos = cos.filter((c: any) => isOpen(c.status)).length;
  lines.push("NUMBERS");
  lines.push(`- Tasks: ${tasks.length} total, ${openTasks} open`);
  lines.push(`- RFIs: ${rfis.length} total, ${openRfis} open`);
  lines.push(`- Submittals: ${subs.length} total, ${openSubs} open`);
  lines.push(`- Change orders: ${cos.length} total, ${openCos} open`);
  lines.push(`- Team: ${team.length} ${team.length === 1 ? "member" : "members"}`);
  lines.push("");

  // One concrete recommendation.
  lines.push("RECOMMENDATION");
  lines.push(buildRecommendation({
    overdueRfis, overdueSubs, overdueTasks, overdueActions, overdueCos,
    dueTodayTotal, nothingOverdue: overdueTotal === 0,
  }));

  return lines.join("\n");
}

/* --------------------- Team Safety Brief Generator --------------------- */

// Seasonal hazard topics based on current month
function seasonalHazards(): string[] {
  const month = new Date().getMonth(); // 0-11
  const hazards: string[] = [];

  // Summer months (June-August)
  if (month >= 5 && month <= 7) {
    hazards.push(
      "Heat stress is the top concern right now. Provide shade and at least a quart of cool water per person per hour. Schedule heavy work for early morning. Watch for signs of heat exhaustion — heavy sweating, dizziness, nausea. If someone stops sweating or gets confused, that's heat stroke — call nine-one-one immediately."
    );
    hazards.push(
      "Afternoon thunderstorms are common this time of year, especially in Colorado. Keep an eye on the sky. If you hear thunder within thirty seconds of lightning, get everyone to shelter and wait thirty minutes after the last thunder before going back out."
    );
  }
  // Fall months (September-November)
  else if (month >= 8 && month <= 10) {
    hazards.push(
      "Mornings are getting cold and frosty. Watch for slippery surfaces, especially scaffolding, ladders, and metal decking. Give surfaces time to dry or de-ice before starting work."
    );
    hazards.push(
      "Shorter days mean less daylight. Make sure all work areas have adequate temporary lighting, and plan to wrap up exterior work before dusk. High-visibility vests are a must for everyone on site."
    );
  }
  // Winter months (December-February)
  else if (month === 11 || month <= 1) {
    hazards.push(
      "Winter conditions — ice and snow accumulation on scaffolds, ladders, roofs, and walkways. Clear snow and ice before work begins. Salt or sand walkways. No one works on an icy roof, period."
    );
    hazards.push(
      "Cold stress is real. Dress in layers, take warm-up breaks, and watch for frostbite and hypothermia. Fingers, toes, ears, and nose go first. If someone gets sluggish or confused in the cold, get them warm and inside immediately."
    );
  }
  // Spring months (March-May)
  else {
    hazards.push(
      "Spring weather is unpredictable — watch for sudden rain, wind, and temperature swings. Rain makes surfaces slippery and can destabilize trenches. Inspect excavations after any rain before sending anyone in."
    );
    hazards.push(
      "Mud and soft ground conditions — make sure equipment has stable footing and access roads are maintained. Watch for rutting that could cause equipment to tip."
    );
  }

  return hazards;
}

// Always-relevant safety topics that rotate
const DAILY_SAFETY_TOPICS = [
  {
    title: "Fall protection",
    body: "Anyone working at six feet or higher needs fall protection — guardrails, safety nets, or personal fall arrest systems. Inspect your harness, lanyard, and anchor point before every use. A harness that's been through a fall gets tagged out and replaced, no exceptions. Tie off to something rated for five thousand pounds, not just whatever's handy.",
  },
  {
    title: "PPE check",
    body: "Hard hats, safety glasses, steel-toe boots, and high-visibility vests for everyone on site. If you're grinding, drilling, or welding, add face shields and the right respiratory protection. Hearing protection above eighty-five decibels. If your PPE is damaged or worn out, replace it before you start working — not after.",
  },
  {
    title: "Trenching and excavation",
    body: "Trenches deeper than five feet need a protective system — sloping, shoring, or shielding. Never enter a trench without it. Keep spoil piles at least two feet back from the edge. Daily inspections by a competent person before anyone goes in, and after any rain or vibration event. Ladders every twenty-five feet of lateral travel in trench excavations over four feet deep.",
  },
  {
    title: "Electrical safety and lockout/tagout",
    body: "All temporary wiring needs GFCI protection. Inspect cords and tools before use — no frayed cables, no missing ground prongs. When working on electrical systems, follow lockout/tagout: isolate, lock, tag, verify dead, then work. Test before you touch. Only qualified electricians open panels or work on energized circuits.",
  },
  {
    title: "Material handling and crane ops",
    body: "Rigging inspections before every lift — check slings, hooks, and shackles for wear. Never walk under a suspended load. Wind limits are twenty miles per hour sustained for most cranes, but check manufacturer specs because some are lower. Have a dedicated signal person for any lift where the operator can't see the load clearly.",
  },
  {
    title: "Housekeeping and trip hazards",
    body: "Keep walkways clear of debris, tools, and materials. Clean up spills immediately — especially oil and grease. Stack materials neatly and away from edges. Extension cords should be routed overhead or protected, not running across walkways where people trip over them. A clean site is a safe site.",
  },
  {
    title: "Hand and power tools",
    body: "Inspect tools before each use — guards in place, cords intact, blades sharp. Use the right tool for the job, not a make-do. Disconnect power before changing blades or bits. Never carry a tool by the cord or yank it to unplug. Tool handles should be tight and crack-free.",
  },
  {
    title: "Hot work and fire prevention",
    body: "If you're welding, cutting, or grinding, clear the area of combustibles for at least thirty-five feet. Have a fire extinguisher within arm's reach. Assign a fire watch for at least thirty minutes after hot work ends — smoldering fires can start after everyone leaves. Check above and below the work area, not just at ground level.",
  },
];

export async function buildSafetyBrief(projectId: number | undefined): Promise<string> {
  const ctx = await buildContext(projectId);
  const lines = ctx.compact.split("\n");
  const projectLine = lines[0] ?? "No active project found.";
  const todayLine = lines[1] ?? "";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Get project for weather
  const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const address = project?.address;

  // Get live weather if available
  let weatherBlock = "";
  if (address) {
    try {
      const weather = await getWeather(address);
      if (weather) {
        weatherBlock = weather;
      }
    } catch {
      // Weather optional
    }
  }

  // Pick 2 rotating safety topics (based on day of year so it changes daily)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const topic1 = DAILY_SAFETY_TOPICS[dayOfYear % DAILY_SAFETY_TOPICS.length];
  const topic2 = DAILY_SAFETY_TOPICS[(dayOfYear + 3) % DAILY_SAFETY_TOPICS.length];

  // Seasonal hazards
  const seasonal = seasonalHazards();

  // Extract overdue items for safety relevance
  const overdueLines = lines.filter((l) => l.includes("OVERDUE"));
  const dueTodayLines = lines.filter((l) => l.includes("DUE TODAY"));

  // Build the brief
  let brief = `TEAM SAFETY BRIEF — ${dateStr}\n`;
  brief += `${projectLine}\n`;
  brief += `${todayLine}\n\n`;

  // Weather conditions
  if (weatherBlock) {
    brief += `WEATHER CONDITIONS\n`;
    brief += `${weatherBlock}\n\n`;
  } else {
    brief += `WEATHER CONDITIONS\n`;
    brief += `Check local conditions before starting. weather.gov and the OSHA-NIOSH Heat Safety app are your best bet for real-time info.\n\n`;
  }

  // Seasonal hazards
  brief += `SEASONAL HAZARDS\n`;
  for (const h of seasonal) {
    brief += `- ${h}\n`;
  }
  brief += `\n`;

  // Today's safety topics
  brief += `TODAY'S SAFETY TOPICS\n`;
  brief += `${topic1.title}\n${topic1.body}\n\n`;
  brief += `${topic2.title}\n${topic2.body}\n\n`;

  // Project-specific safety items
  if (overdueLines.length || dueTodayLines.length) {
    brief += `PROJECT-SPECIFIC ITEMS\n`;
    if (overdueLines.length) {
      brief += `- You've got overdue work across ${overdueLines.length} ${overdueLines.length === 1 ? "category" : "categories"}. Rushed work leads to mistakes and injuries. Make sure the crew has the time and resources to do it right.\n`;
    }
    if (dueTodayLines.length) {
      brief += `- Items due today — confirm the right people are assigned and have what they need. Don't let deadlines push safety shortcuts.\n`;
    }
    brief += `\n`;
  }

  // Closing
  brief += `REMEMBER\n`;
  brief += `Everyone goes home the way they came in. If you see something unsafe, stop work and fix it. No deadline is worth a injury. Speak up — your crew is counting on you.\n\n`;
  brief += `Questions? Ask your superintendent or site safety officer. Stay sharp out there.`;

  return brief;
}

export async function localJarvisChat(projectId: number | undefined, history: { role: "user" | "assistant"; content: string }[], organizationId?: number): Promise<{ reply: string }> {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase().trim();

  // --- Check if user is teaching Jarvis ("remember that...", "note that...", etc.) ---
  const teachMatch = lower.match(/^(?:remember|note|store|save|for this site|jarvis[,\s]+remember|jarvis[,\s]+note|jarvis[,\s]+save)[\s:,]+(.+)/i);
  if (teachMatch) {
    const fact = teachMatch[1].trim();
    const topic = inferTopic(fact);
    try {
      await storage.createJarvisMemory({
        projectId: projectId ?? null,
        question: fact,
        normalizedQuestion: normalizeQuestion(fact),
        topic: topic || undefined,
        answer: fact,
        status: "learned",
        source: "user_taught",
      });
      return { reply: `Got it — I'll remember that for next time${topic ? ` (filed under ${topic})` : ""}. Anything else you want me to keep track of?` };
    } catch {
      return { reply: "I tried to save that but ran into an issue. Try again in a moment." };
    }
  }

  // --- Check if user is answering a pending question ---
  // Look at the previous assistant message for the "teach me" prompt pattern
  const prevAssistant = [...history].reverse().find((m, i, arr) => m.role === "assistant" && i > 0);
  if (prevAssistant && /teach me|i don'?t have that|if you tell me|note that as|save that|i'?ll remember/i.test(prevAssistant.content)) {
    // User might be providing an answer to a previous unanswered question
    // Try to find the pending question from the previous user message
    const prevUserMsg = [...history].reverse().find((m, i, arr) => m.role === "user" && i > 0);
    if (prevUserMsg) {
      const pendingQuestion = prevUserMsg.content;
      const topic = inferTopic(pendingQuestion) || inferTopic(lastUser);
      try {
        // Check if there's already a pending memory for this question
        const memories = await storage.getJarvisMemories(projectId);
        const existing = memories.find((m) => m.status === "pending" && m.normalizedQuestion === normalizeQuestion(pendingQuestion));
        if (existing) {
          await storage.updateJarvisMemory(existing.id, {
            answer: lastUser,
            status: "learned",
          });
        } else {
          await storage.createJarvisMemory({
            projectId: projectId ?? null,
            question: pendingQuestion,
            normalizedQuestion: normalizeQuestion(pendingQuestion),
            topic: topic || undefined,
            answer: lastUser,
            status: "learned",
            source: "user_taught",
          });
        }
        return { reply: `Perfect, I've got that saved now${topic ? ` under ${topic}` : ""}. Next time you ask, I'll have it ready. Anything else?` };
      } catch {
        // Fall through to normal processing if save fails
      }
    }
  }

  // --- Check learned memories first (before built-in responses) ---
  try {
    const learned = await storage.searchJarvisMemory(lastUser, projectId);
    if (learned && learned.answer) {
      return { reply: learned.answer };
    }
  } catch {
    // Memory search failed, continue with built-in responses
  }

  // --- Live weather API (Open-Meteo, no key needed) ---
  if (/\b(weather|forecast|temperature|how hot|how cold|raining|rain|snow|wind|storm)\b/i.test(lower)) {
    try {
      const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
      const address = project?.address;
      if (address) {
        const weather = await getWeather(address);
        if (weather) return { reply: weather };
      }
      // Fallback if no project address or API failed
      return {
        reply: "I couldn't pull live weather for your project. Make sure the project has an address set, and I'll fetch conditions automatically. In the meantime, check weather.gov or the OSHA-NIOSH Heat Safety app for real-time conditions on site.\n\nIf you've got a weather tip specific to your area, just say \"remember that...\" and I'll save it for next time."
      };
    } catch {
      // Fall through to static answer
    }
  }

  // --- Live Google Maps Places API ---
  if (hasPlacesApi() && /\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee|hardware|supplies|hotel|motel|gas|fuel)\b/i.test(lower)) {
    try {
      const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
      const address = project?.address;
      if (address) {
        const places = await getNearbyPlaces(address, lower);
        if (places) return { reply: places };
      }
    } catch {
      // Fall through to static answer
    }
  }

  // Check for health scan intent
  if (/\b(broken|health|scan|not work|doesn'?t work|what'?s broken|integrity)\b/i.test(lower)) {
    try {
      const scan = await runHealthScan();
      const failing = scan.moduleChecks.filter((c) => c.status === "fail");
      const lines: string[] = [
        `Ran a health scan — ${scan.ok ? "everything looks good." : "found some issues."}`,
        `Checked ${scan.linkCount} links and ${scan.brokenLinks.length} ${scan.brokenLinks.length === 1 ? "is" : "are"} broken.`,
        `Scanned ${scan.moduleChecks.length} modules and ${failing.length} ${failing.length === 1 ? "is" : "are"} failing.`,
      ];
      if (scan.brokenLinks.length) lines.push("Broken links: " + scan.brokenLinks.map((l) => `${l.label} -> ${l.href}`).join(" | "));
      if (failing.length) lines.push("Failing: " + failing.map((c) => `${c.name} (${c.detail})`).join(" | "));
      return { reply: lines.join("\n") };
    } catch {
      return { reply: "I tried running a health scan but ran into an error. It might not be available in this environment." };
    }
  }

  // Check for safety brief intent
  if (/\b(safety brief|safety briefing|toolbox talk|safety meeting|team safety|give me a safety|generate a safety|safety stand)\b/i.test(lower)) {
    try {
      const brief = await buildSafetyBrief(projectId);
      return { reply: brief };
    } catch {
      return { reply: "I tried generating a safety brief but ran into an issue. Make sure you have a project selected with an address set, and I'll pull live weather data into it too." };
    }
  }

  // Check for briefing/status intent — use the rich local brief.
  if (/\b(brief|briefing|status|update|summary|overview|morning|standup|what'?s happening|what'?s the status|overdue|what.?s due)\b/i.test(lower)) {
    return { reply: await buildRichLocalBrief(projectId, organizationId) };
  }

  // Check for "how many" project data queries
  if (/\bhow many\b/i.test(lower)) {
    const ctx = await buildContext(projectId);
    const tasksLine = ctx.compact.split("\n").find((l) => l.startsWith("TASKS:"));
    const rfiLine = ctx.compact.split("\n").find((l) => l.startsWith("RFIS:"));
    const subLine = ctx.compact.split("\n").find((l) => l.startsWith("SUBMITTALS:"));
    const coLine = ctx.compact.split("\n").find((l) => l.startsWith("CHANGE ORDERS:"));
    return { reply: `Here's where things stand right now:\n${tasksLine}\n${rfiLine}\n${subLine}\n${coLine}` };
  }

  // Greetings
  const greeting = matchPatterns(lastUser, GREETING_PATTERNS);
  if (greeting) return { reply: greeting };

  // Construction Q&A
  const qa = matchPatterns(lastUser, CONSTRUCTION_QA);
  if (qa) return { reply: qa };

  // General knowledge catch-all for "what is" / "tell me about" / "explain" questions
  if (/\b(what is|what's|tell me about|explain|how do|how does|what are)\b/i.test(lower)) {
    if (/\b(safety|osha|safe)\b/i.test(lower)) {
      return { reply: "Construction safety covers a lot of ground. You can ask me specifically about:\n- PPE (personal protective equipment)\n- Fall protection\n- Excavation and trenching safety\n- Electrical safety and lockout/tagout\n- Heat stress prevention\n- Toolbox talks\n- General site safety protocols\n\nWhat area are you most interested in?" };
    }
    if (/\b(weather|rain|snow|wind|storm|temperature)\b/i.test(lower)) {
      return { reply: "I can't pull live weather yet, but for site planning I'd recommend:\n- weather.gov for forecasts and severe weather alerts\n- The OSHA-NIOSH Heat Safety app for the heat index\n- Lightning thirty/thirty rule — if thunder follows lightning by less than thirty seconds, get to shelter, and wait thirty minutes after the last thunder\n- Crane ops should stop at twenty-plus mile-per-hour sustained winds (check your manufacturer specs though)\n\nIf we connect a weather API, I can pull live conditions for you right here." };
    }
    if (/\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee)\b/i.test(lower)) {
      return { reply: "I can't browse restaurants yet, but for site lunch planning:\n- Check Google Maps or Yelp for spots within ten or fifteen minutes of your site\n- Look for quick service — delis, food trucks, fast-casual\n- A lot of sites bring a food truck on-site for lunch\n- Meal prep with a cooler saves time and money\n- Stay hydrated, especially in summer" };
    }
    return { reply: `That's a good one. I've got solid knowledge on construction topics — RFIs, change orders, submittals, safety protocols, PPE, OSHA standards, fall protection, heat stress, you name it. I also have your live project data, so I can tell you what's overdue or give you a status update.\n\nFor general questions like weather or lunch spots, I can point you in the right direction. And if I'm connected to the full AI model, I can answer just about anything.\n\nWhat else would you like to know?` };
  }

  // Navigation help
  if (/\b(where|how|which tab|navigate|find|go to)\b/i.test(lower)) {
    const navMap: { keywords: string[]; answer: string }[] = [
      { keywords: ["task", "to do", "todo", "work item"], answer: "Tasks are under the Tasks tab. Hit 'New Task' to create one, and you can switch between list and board views." },
      { keywords: ["rfi", "question", "clarification"], answer: "RFIs are under the RFIs tab. Just click 'New RFI' to submit one." },
      { keywords: ["submittal", "shop drawing", "product data"], answer: "Submittals are under the Submittals tab. That's where you track shop drawings, product data, and samples." },
      { keywords: ["change order", "co ", "variation"], answer: "Change Orders are under the Change Orders tab. You can document scope changes with amounts and schedule impact there." },
      { keywords: ["punch", "deficiency", "correction", "punch list"], answer: "Punch List items are under the Punch List tab. That's where you track anything needing correction before closeout." },
      { keywords: ["daily log", "daily report", "site report"], answer: "Daily Logs are under the Daily Logs tab. Record the weather, crew, and what got done each day." },
      { keywords: ["calendar", "schedule", "event", "meeting"], answer: "The Schedule tab shows a calendar with all your project dates. You can add events, meetings, and milestones there." },
      { keywords: ["gantt", "chart", "timeline", "bar chart"], answer: "The Gantt chart is under the Schedule tab — just click the Gantt button. It lays out your tasks as bars across a timeline." },
      { keywords: ["team", "member", "people", "crew", "assignee"], answer: "Team members are under the Team tab. Add people, assign roles, keep everyone organized." },
      { keywords: ["setting", "config", "preferences"], answer: "Settings are under the Settings tab. You can configure your name, tone, and manage data from there." },
      { keywords: ["project", "new project", "create project"], answer: "Projects are on the Projects page. Click 'New Project' to create one, or click a project card to view details and edit." },
    ];
    const nav = matchPatterns(lastUser, navMap);
    if (nav) return { reply: nav };
  }

  // Default fallback — store the question as pending and ask the user to teach Jarvis
  const topic = inferTopic(lastUser);
  try {
    // Check if we already have a pending memory for this question
    const memories = await storage.getJarvisMemories(projectId);
    const alreadyPending = memories.find((m) =>
      m.status === "pending" &&
      m.normalizedQuestion === normalizeQuestion(lastUser)
    );
    if (!alreadyPending) {
      await storage.createJarvisMemory({
        projectId: projectId ?? null,
        question: lastUser,
        normalizedQuestion: normalizeQuestion(lastUser),
        topic: topic || undefined,
        answer: null,
        status: "pending",
        source: "user_taught",
      });
    }
  } catch {
    // Storage failed, still give a helpful response
  }

  if (topic) {
    return {
      reply: `I don't have an answer for that one yet${topic === "lunch" ? " — I can't browse restaurants from here" : ""}. But here's the thing — if you tell me the answer, I'll remember it for next time.\n\nJust say something like "remember that the best lunch spot near this site is Jimmy's Deli" and I'll file it away. Next time you ask, I'll have it ready.\n\nWhat would you like to know?`
    };
  }

  return {
    reply: `I'm not quite sure I caught that. Here's what I can help with:\n\n- Construction questions — RFIs, change orders, submittals, safety protocols, PPE, OSHA standards\n- General stuff — weather guidance, lunch spots, the time, jokes\n- Project data — "what's overdue?", "give me a briefing", "how many tasks are open?"\n- Navigation — "where do I create a task?", "how do I find the Gantt chart?"\n- App health — "is anything broken?"\n\nAnd if there's something I don't know, just tell me the answer and I'll remember it for next time. What would you like to know?`
  };
}
