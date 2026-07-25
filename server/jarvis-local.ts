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
    keywords: ["what is", "what's", "explain", "define", "how do", "how does"],
    answer: "I can explain construction terms and concepts. Try asking about: RFIs, change orders, submittals, punch lists, daily logs, milestones, Gantt charts, CPM, substantial completion, retainage, lien waivers, or O&M manuals. I also have live access to your project data — ask 'What's overdue?' or 'Give me a status update.'",
  },
];

const GREETING_PATTERNS = [
  { keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"], answer: "Good day, sir. Jarvis at your service. How may I assist with your project today?" },
  { keywords: ["how are you", "how's it going", "you good"], answer: "All systems operational, sir. Ready to assist with project management tasks." },
  { keywords: ["thank you", "thanks", "cheers"], answer: "You're most welcome, sir." },
  { keywords: ["who are you", "what are you", "your name"], answer: "I'm JARVIS, your AI site assistant for TrussPath. I can answer construction questions, give project status updates, and help you navigate the platform." },
  { keywords: ["what can you do", "help", "capabilities", "features"], answer: "I can help with:\n• Answering construction questions (RFIs, change orders, submittals, etc.)\n• Project status — ask 'What's overdue?' or 'Give me a briefing'\n• Guidance on which tab to use for tasks\n• App health checks — ask 'Is anything broken?'\n\nWhat would you like to know?" },
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
    reply: `I can help with construction questions and your project data, sir. Try asking:\n• "What is an RFI?"\n• "What's overdue?"\n• "Give me a status update"\n• "How many tasks are open?"\n• "What can you do?"\n• "Is anything broken?"` 
  };
}
