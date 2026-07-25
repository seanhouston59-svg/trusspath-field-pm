import { storage } from "./storage";
import { buildContext, type ContextBundle } from "./jarvis";
import { runHealthScan } from "./health";

// When no LLM API key is available, Jarvis uses this local response engine.
// It handles: greetings, construction Q&A, project data summaries, app help.

const CONSTRUCTION_QA: { keywords: string[]; answer: string }[] = [
  {
    keywords: ["what is rfi", "what's an rfi", "what is a rfi", "rfi mean", "define rfi"],
    answer: "An RFI (Request for Information) is a formal written question from a contractor to the architect, engineer, or owner asking for clarification about the design, specs, or contract documents. RFIs are tracked to document decisions and prevent delays. In TrussPath, you can create and manage RFIs under the RFIs tab.",
  },
  {
    keywords: ["what is change order", "what's a change order", "change order mean", "define change order"],
    answer: "A Change Order is a formal modification to the original contract scope, schedule, or budget. It documents additions, deletions, or revisions to the work. Change orders must be approved by the owner before execution. In TrussPath, track them under the Change Orders tab with amounts and schedule impact.",
  },
  {
    keywords: ["what is submittal", "what's a submittal", "submittal mean", "define submittal"],
    answer: "A Submittal is a document or sample submitted by the contractor to the architect/engineer for review and approval before fabrication or installation. Common types include shop drawings, product data, and material samples. TrussPath tracks submittals under the Submittals tab.",
  },
  {
    keywords: ["what is punch list", "what's a punch list", "punch list mean", "define punch list", "punch out"],
    answer: "A Punch List is a document listing items that need correction or completion before a project is considered finished. It's typically compiled near the end of the project during a walkthrough. Items include minor repairs, touch-ups, and missing work. TrussPath manages punch items under the Punch List tab.",
  },
  {
    keywords: ["what is daily log", "what's a daily log", "daily log mean", "daily report"],
    answer: "A Daily Log records site activity for each working day, including weather, crew count, work performed, deliveries, visitors, and incidents. It's essential for project documentation and potential claims. TrussPath supports daily logs under the Daily Logs tab.",
  },
  {
    keywords: ["what is milestone", "milestone mean", "define milestone"],
    answer: "A Milestone is a significant point or event in a project schedule with zero duration — it marks the start or completion of a major phase. Examples include 'Substantial Completion,' 'Notice to Proceed,' or 'Site Mobilization.' TrussPath tracks milestones on the Schedule page.",
  },
  {
    keywords: ["what is gantt", "gantt chart", "define gantt"],
    answer: "A Gantt Chart is a horizontal bar chart showing project tasks over time. Each bar represents a task's start date, duration, and end date. It visualizes the schedule, dependencies, and progress. TrussPath includes a Gantt chart view under the Schedule tab.",
  },
  {
    keywords: ["substantial completion", "what is substantial completion"],
    answer: "Substantial Completion is the stage when the work (or a designated portion) is sufficiently complete for the owner to occupy or utilize it for its intended purpose. It typically triggers warranty periods, final payment, and transfer of responsibility. It's a key project milestone.",
  },
  {
    keywords: ["notice to proceed", "ntp", "what is ntp"],
    answer: "Notice to Proceed (NTP) is the owner's formal authorization for the contractor to begin work. It establishes the project start date and the clock for the contract duration. It's typically recorded as a milestone in the schedule.",
  },
  {
    keywords: ["what is cpm", "critical path method", "define cpm"],
    answer: "The Critical Path Method (CPM) is a scheduling technique that identifies the longest sequence of dependent tasks — the critical path — which determines the shortest possible project duration. Delays to critical path tasks delay the entire project. TrussPath includes a CPM diagram view.",
  },
  {
    keywords: ["what is rfi vs submittal", "difference rfi submittal", "rfi versus submittal"],
    answer: "An RFI asks a question to clarify design intent when documents are ambiguous or conflicting. A Submittal provides specific product/shop drawing info for approval before installation. RFIs resolve questions; submittals confirm materials and methods. Both are tracked separately in TrussPath.",
  },
  {
    keywords: ["retainage", "what is retainage", "retention"],
    answer: "Retainage (or retention) is a percentage of each payment withheld by the owner until the project is complete. It protects the owner and incentivizes the contractor to finish. Typically 5-10%, it's released at substantial completion and final completion.",
  },
  {
    keywords: ["what is lien waiver", "lien waiver"],
    answer: "A Lien Waiver is a document in which a contractor or subcontractor relinquishes their right to file a mechanic's lien against the property, typically in exchange for payment. Common types include conditional (upon receipt) and unconditional waivers.",
  },
  {
    keywords: ["what is o&m", "o&m manual", "operation maintenance manual"],
    answer: "O&M (Operations & Maintenance) Manuals are documentation provided to the owner at project closeout, containing operating instructions, maintenance schedules, warranties, and equipment info for all installed systems. They're essential for long-term facility management.",
  },
  {
    keywords: ["construction safety", "safety protocols", "site safety", "safety on site", "safety procedures", "safety rules", "osha"],
    answer: "Here are the core construction site safety protocols, sir:\n\nPERSONAL PROTECTIVE EQUIPMENT (PPE):\n• Hard hats at all times in active work zones\n• Safety glasses for cutting, grinding, or drilling\n• Steel-toe boots\n• High-visibility vests near equipment and traffic\n• Gloves and hearing protection as needed\n\nFALL PROTECTION:\n• Guardrails, safety nets, or personal fall arrest systems at heights over 6 feet (construction standard)\n• Secure ladders — 3 points of contact, extend 3 feet above landing\n• Cover and mark all floor openings\n\nEXCAVATION & TRENCHING:\n• Trenches over 5 feet need sloping, shoring, or shielding\n• Daily inspection by a competent person\n• Keep spoil piles at least 2 feet from edge\n\nELECTRICAL:\n• Lockout/tagout (LOTO) before servicing equipment\n• GFCI protection on all temporary power\n• Maintain minimum clearances from power lines\n\nGENERAL:\n• Daily safety briefings / toolbox talks\n• Keep walkways clear of debris\n• Fire extinguishers within 100 feet travel distance\n• Report all incidents and near-misses immediately\n\nWould you like detail on any specific area?",
  },
  {
    keywords: ["fall protection", "harness", "fall arrest"],
    answer: "Fall protection is required at heights of 6 feet or more in construction (OSHA 1926.501). Options include:\n• Guardrail systems — top rail at 42 inches +/- 3 inches\n• Safety net systems — installed as close under the work surface as practical\n• Personal fall arrest systems (PFAS) — full-body harness, lanyard, and anchor point rated for 5,000 lbs\n• Positioning device systems — for work on vertical surfaces\n• Warning line + safety monitoring for low-slope roofs\n\nAnchors must support 5,000 lbs per worker. Inspect harnesses before each use. D-ring placement: center back. Never tie a knot in a lanyard.",
  },
  {
    keywords: ["toolbox talk", "safety meeting", "safety briefing", "pre-job briefing"],
    answer: "A Toolbox Talk is a short (5-15 minute) safety meeting held before work begins, typically covering:\n• The day's specific hazards and tasks\n• Required PPE for the day's work\n• Emergency procedures and evacuation routes\n• Equipment inspections needed\n• Weather conditions and heat/cold stress\n• Recent incidents or near-misses as learning moments\n\nBest practice: hold them daily, document attendance, and rotate topics. Keep them interactive — ask the crew what hazards they see.",
  },
  {
    keywords: ["heat stress", "heat exhaustion", "heat stroke", "hot weather safety"],
    answer: "Heat illness prevention on construction sites:\n\nPREVENTION:\n• Provide shade and cool drinking water (1 quart/hour minimum)\n• Schedule heavy work for cooler hours\n• Acclimatize new workers — 20% exposure day 1, increasing over 7-14 days\n• Take frequent breaks in shade\n• Monitor weather and heat index\n\nSIGNS OF HEAT EXHAUSTION: heavy sweating, weakness, dizziness, nausea, headache. Get to shade, drink water, cool down.\n\nSIGNS OF HEAT STROKE (emergency): confusion, loss of consciousness, hot dry skin (may still sweat), body temp above 103°F. Call 911 immediately.\n\nOSHA doesn't have a specific heat standard yet, but the General Duty Clause applies. Some states (CA, WA, MN) have explicit heat illness prevention rules.",
  },
  {
    keywords: ["ppe", "personal protective equipment", "safety gear"],
    answer: "Required PPE on construction sites (OSHA 1926):\n• Head protection (hard hats) — ANSI Z89.1\n• Eye and face protection — ANSI Z87.1\n• Foot protection (steel-toe boots) — ASTM F2413\n• Hand protection (gloves appropriate to task)\n• Hearing protection — needed at 85 dB+ exposure (8-hour TWA)\n• Respiratory protection — when airborne hazards exceed PELs\n• High-visibility apparel — ANSI/ISEA 107\n\nThe employer must provide PPE at no cost to employees (with limited exceptions). Workers must be trained on proper use, maintenance, and limitations.",
  },
  {
    keywords: ["weather"],
    answer: "I can't pull live weather data yet, sir, but here's what I'd recommend for checking conditions on site:\n\n• OSHA-NIOSH Heat Safety Tool app — real-time heat index and precautions\n• NOAA Weather Radio or weather.gov for forecasts and severe weather alerts\n• Wind speed monitoring — crane operations must stop at 20+ mph sustained (manufacturer specs may be lower)\n• Lightning — the 30/30 rule: if thunder follows lightning by less than 30 seconds, seek shelter; wait 30 minutes after last thunder before resuming\n\nIf you connect a weather API, I can give you live conditions and alerts directly. Would you like me to note that as a feature request?",
  },
  {
    keywords: ["lunch", "food", "eat", "restaurant", "lunch spots", "where to eat", "hungry"],
    answer: "I can't browse nearby restaurants yet, sir, but here are some tips for site lunch planning:\n\n• Check Google Maps or Yelp for spots within 10-15 minutes of your site address\n• Look for places with quick service — delis, food trucks, fast-casual\n• Many job sites arrange a catering truck or food truck on-site for lunch\n• Consider meal prep — a cooler with sandwiches saves time and money\n• Stay hydrated — keep water and electrolyte drinks on hand, especially in summer\n\nIf you give me your project's address, I can note it so a future update could suggest nearby options. Would that be helpful?",
  },
  {
    keywords: ["joke", "funny", "tell me something"],
    answer: "Why did the construction worker bring a pencil to the job site?\n\nTo draw up plans, of course.\n\nIn all seriousness, sir — what can I help you with?",
  },
  {
    keywords: ["time", "what time", "date", "what day", "today's date"],
    answer: `It's currently ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}, sir.`,
  },
  {
    keywords: ["who made you", "who created you", "who built you"],
    answer: "I'm JARVIS, built into TrussPath to assist with project management and general questions. Think of me as your digital site steward — always on duty.",
  },
];

const GREETING_PATTERNS = [
  { keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"], answer: "Good day, sir. Jarvis at your service. How may I assist with your project today?" },
  { keywords: ["how are you", "how's it going", "you good"], answer: "All systems operational, sir. Ready to assist with project management tasks." },
  { keywords: ["thank you", "thanks", "cheers"], answer: "You're most welcome, sir." },
  { keywords: ["who are you", "what are you", "your name"], answer: "I'm JARVIS, your AI site assistant for TrussPath. I can answer construction questions, give project status updates, and help you navigate the platform." },
  { keywords: ["what can you do", "help", "capabilities", "features"], answer: "I can help with:\n• Construction questions (RFIs, change orders, submittals, safety protocols, PPE, fall protection, OSHA standards)\n• General questions — weather guidance, lunch spots near your site, jokes, time/date\n• Project status — ask 'What's overdue?' or 'Give me a briefing'\n• Guidance on which tab to use for tasks\n• App health checks — ask 'Is anything broken?'\n\nWhat would you like to know?" },
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

export function buildLocalBrief(ctx: ContextBundle): string {
  const lines = ctx.compact.split("\n");
  const greeting = `Good day, sir. Here's your morning briefing.`;
  const projectLine = lines[0] ?? "No active project found.";
  const today = lines[1] ?? "";
  
  // Extract overdue items
  const overdueLines = lines.filter((l) => l.includes("OVERDUE"));
  const dueTodayLines = lines.filter((l) => l.includes("DUE TODAY"));
  
  const priorities: string[] = [];
  if (overdueLines.length) priorities.push(`• Overdue items need attention — ${overdueLines.length} category(ies) have overdue work`);
  if (dueTodayLines.length) priorities.push(`• Items due today — review and assign resources`);
  if (!priorities.length) priorities.push("• No urgent items — all tasks on schedule");
  
  const overdue = overdueLines.length ? overdueLines.join("\n") : "Nothing overdue.";
  
  return `${greeting}

PROJECT: ${projectLine}
${today}

PRIORITIES:
${priorities.join("\n")}

OVERDUE:
${overdue}

PROACTIVE: Review the Schedule tab for upcoming milestones and ensure all team members have assigned tasks.`;
}

export async function localJarvisChat(projectId: number | undefined, history: { role: "user" | "assistant"; content: string }[]): Promise<{ reply: string }> {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase().trim();
  
  // Check for health scan intent
  if (/\b(broken|health|scan|not work|doesn'?t work|what'?s broken|integrity)\b/i.test(lower)) {
    try {
      const scan = await runHealthScan();
      const failing = scan.moduleChecks.filter((c) => c.status === "fail");
      const lines = [
        `APP HEALTH SCAN — ${scan.ok ? "PASS" : "ISSUES FOUND"}`,
        `${scan.linkCount} links checked, ${scan.brokenLinks.length} broken.`,
        `${scan.moduleChecks.length} modules scanned, ${failing.length} failing.`,
      ];
      if (scan.brokenLinks.length) lines.push("BROKEN LINKS: " + scan.brokenLinks.map((l) => `${l.label} -> ${l.href}`).join(" | "));
      if (failing.length) lines.push("FAILING: " + failing.map((c) => `${c.name} (${c.detail})`).join(" | "));
      return { reply: lines.join("\n") };
    } catch {
      return { reply: "I attempted a health scan but encountered an error. The scan may not be available in this environment." };
    }
  }
  
  // Check for briefing/status intent
  if (/\b(brief|briefing|status|update|summary|overview|morning|standup|what'?s happening|what'?s the status|overdue|what.?s due)\b/i.test(lower)) {
    const ctx = await buildContext(projectId);
    return { reply: buildLocalBrief(ctx) };
  }
  
  // Check for "how many" project data queries
  if (/\bhow many\b/i.test(lower)) {
    const ctx = await buildContext(projectId);
    const tasksLine = ctx.compact.split("\n").find((l) => l.startsWith("TASKS:"));
    const rfiLine = ctx.compact.split("\n").find((l) => l.startsWith("RFIS:"));
    const subLine = ctx.compact.split("\n").find((l) => l.startsWith("SUBMITTALS:"));
    const coLine = ctx.compact.split("\n").find((l) => l.startsWith("CHANGE ORDERS:"));
    return { reply: `Here's the current count, sir:\n${tasksLine}\n${rfiLine}\n${subLine}\n${coLine}` };
  }
  
  // Greetings
  const greeting = matchPatterns(lastUser, GREETING_PATTERNS);
  if (greeting) return { reply: greeting };
  
  // Construction Q&A
  const qa = matchPatterns(lastUser, CONSTRUCTION_QA);
  if (qa) return { reply: qa };
  
  // General knowledge catch-all for "what is" / "tell me about" / "explain" questions
  if (/\b(what is|what's|tell me about|explain|how do|how does|what are)\b/i.test(lower)) {
    // Try to give a helpful response for general questions not in the Q&A list
    if (/\b(safety|osha|safe)\b/i.test(lower)) {
      return { reply: "Construction safety covers many areas, sir. Ask me specifically about:\n• PPE (personal protective equipment)\n• Fall protection\n• Excavation and trenching safety\n• Electrical safety (lockout/tagout)\n• Heat stress prevention\n• Toolbox talks\n• General site safety protocols" };
    }
    if (/\b(weather|rain|snow|wind|storm|temperature)\b/i.test(lower)) {
      return { reply: "I can't pull live weather data yet, sir, but for site planning I'd recommend:\n• weather.gov for forecasts and severe weather alerts\n• OSHA-NIOSH Heat Safety Tool app for heat index\n• Lightning 30/30 rule: if thunder follows lightning by less than 30 seconds, seek shelter; wait 30 min after last thunder\n• Crane ops: stop at 20+ mph sustained wind (check manufacturer specs)\n\nConnect a weather API and I can give live conditions directly." };
    }
    if (/\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee)\b/i.test(lower)) {
      return { reply: "I can't browse restaurants yet, sir, but for site lunch planning:\n• Check Google Maps or Yelp for spots within 10-15 min of your site\n• Look for quick service — delis, food trucks, fast-casual\n• Consider arranging a food truck on-site\n• Meal prep with a cooler saves time and money\n• Stay hydrated, especially in summer" };
    }
    // For other general questions, acknowledge and try to help
    return { reply: `That's a good question, sir. In the local mode I have detailed knowledge of construction topics (RFIs, change orders, submittals, safety protocols, PPE, OSHA standards, fall protection, heat stress) and your project data. \n\nFor questions outside construction, I have general knowledge built in — feel free to ask about weather, lunch spots, safety, or anything else. If I'm connected to the full LLM, I can answer virtually any question.\n\nCould you rephrase or be more specific about what you'd like to know?` };
  }
  
  // Navigation help
  if (/\b(where|how|which tab|navigate|find|go to)\b/i.test(lower)) {
    const navMap: { keywords: string[]; answer: string }[] = [
      { keywords: ["task", "to do", "todo", "work item"], answer: "Tasks are under the Tasks tab. Click 'New Task' to create one, or switch between list and board views." },
      { keywords: ["rfi", "question", "clarification"], answer: "RFIs are under the RFIs tab. Click 'New RFI' to submit a request for information." },
      { keywords: ["submittal", "shop drawing", "product data"], answer: "Submittals are under the Submittals tab. Track shop drawings, product data, and samples there." },
      { keywords: ["change order", "co ", "variation"], answer: "Change Orders are under the Change Orders tab. Document scope changes with amounts and schedule impact." },
      { keywords: ["punch", "deficiency", "correction", "punch list"], answer: "Punch List items are under the Punch List tab. Track items needing correction before project closeout." },
      { keywords: ["daily log", "daily report", "site report"], answer: "Daily Logs are under the Daily Logs tab. Record weather, crew, and work performed each day." },
      { keywords: ["calendar", "schedule", "event", "meeting"], answer: "The Schedule tab shows a calendar with all project dates. You can add events, meetings, and milestones there." },
      { keywords: ["gantt", "chart", "timeline", "bar chart"], answer: "The Gantt chart is under the Schedule tab — click the Gantt button. It shows tasks as bars across a timeline." },
      { keywords: ["team", "member", "people", "crew", "assignee"], answer: "Team members are managed under the Team tab. Add members and assign them roles." },
      { keywords: ["setting", "config", "preferences"], answer: "Settings are under the Settings tab. Configure your name, tone, and manage data." },
      { keywords: ["project", "new project", "create project"], answer: "Projects are listed on the Projects page. Click 'New Project' to create one, or click a project card to view details and edit." },
    ];
    const nav = matchPatterns(lastUser, navMap);
    if (nav) return { reply: nav };
  }
  
  // Default fallback
  return { 
    reply: `I'm not sure I caught that, sir. Here's what I can help with:\n\n• Construction questions — RFIs, change orders, safety protocols, PPE, OSHA standards\n• General questions — weather guidance, lunch spots, time/date, jokes\n• Project data — \"What's overdue?\", \"Give me a briefing\", \"How many tasks are open?\"\n• Navigation — \"Where do I create a task?\", \"How do I find the Gantt chart?\"\n• App health — \"Is anything broken?\"\n\nWhat would you like to know?` 
  };
}
