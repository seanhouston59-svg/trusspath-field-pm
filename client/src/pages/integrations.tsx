import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Search, Check, Plug, Download, ExternalLink, ArrowRight, Users, Calculator,
  Building2, FileSpreadsheet, HardDrive, Box, MessageSquare, MessagesSquare,
  Mail, CalendarRange, GanttChartSquare, PenTool, FileText, Clock,
  Timer, Activity, Wallet,
} from "lucide-react";
import {
  SiAdp, SiGooglesheets, SiGoogledrive, SiQuickbooks, SiDropbox, SiAutodesk,
  SiGusto, SiPaychex, SiSage,
} from "react-icons/si";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useProjects, useTasks, useRfis, useSubmittals, useChangeOrders,
  useIntegrations, useToggleIntegration,
} from "@/hooks/use-data";

type IconType = React.ComponentType<{ className?: string; size?: number | string }>;
type CatKey = "Payroll & HR" | "Accounting" | "Spreadsheets" | "Documents" | "Communication" | "Scheduling" | "Design & BIM" | "Time Tracking";

interface CatalogItem {
  key: string;
  name: string;
  category: CatKey;
  description: string;
  Icon: IconType;
  tint: string;
  action: "toggle" | "export-csv" | "link";
  href?: string;
  native?: boolean;
}

const CATALOG: CatalogItem[] = [
  // Payroll & HR
  { key: "adp", name: "ADP", category: "Payroll & HR", description: "Sync crew payroll, benefits and time cards for field labor.", Icon: SiAdp, tint: "text-red-600", action: "toggle" },
  { key: "trinet", name: "TriNet", category: "Payroll & HR", description: "PEO HR, benefits and payroll for your workforce.", Icon: Users, tint: "text-emerald-600", action: "toggle" },
  { key: "paychex", name: "Paychex", category: "Payroll & HR", description: "Payroll processing, HR and retirement services.", Icon: SiPaychex, tint: "text-orange-600", action: "toggle" },
  { key: "gusto", name: "Gusto", category: "Payroll & HR", description: "Modern payroll, benefits and crew onboarding.", Icon: SiGusto, tint: "text-rose-600", action: "toggle" },
  { key: "intuit-payroll", name: "QuickBooks Payroll", category: "Payroll & HR", description: "Intuit payroll tied to job-cost accounting.", Icon: SiQuickbooks, tint: "text-green-600", action: "toggle" },

  // Accounting
  { key: "quickbooks", name: "QuickBooks Online", category: "Accounting", description: "Two-way sync of invoices, bills and job costs.", Icon: SiQuickbooks, tint: "text-green-600", action: "toggle" },
  { key: "sage", name: "Sage 100 Contractor", category: "Accounting", description: "Construction accounting and job-cost sync.", Icon: SiSage, tint: "text-emerald-600", action: "toggle" },
  { key: "foundation", name: "Foundation", category: "Accounting", description: "Foundation Software construction accounting.", Icon: Calculator, tint: "text-blue-600", action: "toggle" },
  { key: "netsuite", name: "Oracle NetSuite", category: "Accounting", description: "ERP financials, procurement and project accounting.", Icon: Building2, tint: "text-sky-600", action: "toggle" },

  // Spreadsheets
  { key: "google-sheets", name: "Google Sheets", category: "Spreadsheets", description: "Export your schedule, RFIs, submittals and COs to Sheets.", Icon: SiGooglesheets, tint: "text-emerald-600", action: "export-csv" },
  { key: "excel", name: "Microsoft Excel", category: "Spreadsheets", description: "Export project data to an Excel-ready workbook.", Icon: FileSpreadsheet, tint: "text-green-600", action: "export-csv" },

  // Documents
  { key: "google-drive", name: "Google Drive", category: "Documents", description: "Attach drawings, submittals and photos from Drive.", Icon: SiGoogledrive, tint: "text-amber-600", action: "toggle" },
  { key: "dropbox", name: "Dropbox", category: "Documents", description: "Sync project documents and field photos.", Icon: SiDropbox, tint: "text-blue-600", action: "toggle" },
  { key: "onedrive", name: "Microsoft OneDrive", category: "Documents", description: "Browse and attach OneDrive files to records.", Icon: HardDrive, tint: "text-sky-600", action: "toggle" },
  { key: "box", name: "Box", category: "Documents", description: "Enterprise document storage and plan sets.", Icon: Box, tint: "text-blue-600", action: "toggle" },

  // Communication
  { key: "slack", name: "Slack", category: "Communication", description: "Send the daily brief and alerts to project channels.", Icon: MessageSquare, tint: "text-purple-600", action: "toggle" },
  { key: "teams", name: "Microsoft Teams", category: "Communication", description: "Post updates and RFIs into Teams channels.", Icon: MessagesSquare, tint: "text-indigo-600", action: "toggle" },
  { key: "gmail", name: "Gmail", category: "Communication", description: "Email RFIs, submittals and daily logs directly.", Icon: Mail, tint: "text-red-600", action: "toggle" },
  { key: "outlook", name: "Outlook", category: "Communication", description: "Outlook email and calendar integration.", Icon: Mail, tint: "text-blue-600", action: "toggle" },

  // Scheduling
  { key: "google-calendar", name: "Google Calendar", category: "Scheduling", description: "Two-way calendar sync with tasks, RFIs and milestones.", Icon: CalendarRange, tint: "text-blue-600", action: "link", href: "/schedule", native: true },
  { key: "ms-project", name: "Microsoft Project", category: "Scheduling", description: "Import .mpp schedules into the Gantt view.", Icon: GanttChartSquare, tint: "text-emerald-600", action: "toggle" },

  // Design & BIM
  { key: "autodesk", name: "Autodesk Construction Cloud", category: "Design & BIM", description: "Link ACC drawings, models and sheets to records.", Icon: SiAutodesk, tint: "text-slate-700 dark:text-slate-300", action: "toggle" },
  { key: "bluebeam", name: "Bluebeam Revu", category: "Design & BIM", description: "Sync markups and punch from Bluebeam sessions.", Icon: PenTool, tint: "text-orange-600", action: "toggle" },

  // Time Tracking
  { key: "clockshark", name: "ClockShark", category: "Time Tracking", description: "Crew time tracking with GPS and clock-in data.", Icon: Clock, tint: "text-sky-600", action: "toggle" },
  { key: "tsheets", name: "QuickBooks Time (TSheets)", category: "Time Tracking", description: "Employee time tracking and timesheet approval.", Icon: Timer, tint: "text-green-600", action: "toggle" },
  { key: "hubstaff", name: "Hubstaff", category: "Time Tracking", description: "Time, activity and location for field crews.", Icon: Activity, tint: "text-orange-600", action: "toggle" },
];

const CATEGORIES: CatKey[] = ["Payroll & HR", "Accounting", "Spreadsheets", "Documents", "Communication", "Scheduling", "Design & BIM", "Time Tracking"];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function IntegrationsPage() {
  const [loc, navigate] = useLocation();
  void loc;
  const { data: projects = [] } = useProjects();
  const active = projects.filter((p) => p.status !== "Planning");
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const pid = projectId ?? active[0]?.id;
  const project = projects.find((p) => p.id === pid);

  const { data: tasks = [] } = useTasks(pid);
  const { data: rfis = [] } = useRfis(pid);
  const { data: subs = [] } = useSubmittals(pid);
  const { data: cos = [] } = useChangeOrders(pid);

  const { data: rows = [], isLoading } = useIntegrations();
  const toggle = useToggleIntegration();

  const connectedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    rows.forEach((r) => m.set(r.key, !!r.connected));
    return m;
  }, [rows]);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CatKey | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((c) => {
      if (cat !== "All" && c.category !== cat) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    });
  }, [query, cat]);

  const connectedCount = CATALOG.filter((c) => c.native || connectedMap.get(c.key)).length;

  const exportCsv = (item: CatalogItem) => {
    const rows: string[][] = [["Type", "Number", "Title", "Trade/Category", "Start", "End/Due", "Status", "Amount"]];
    tasks.forEach((t) => rows.push(["Task", t.seq ? String(t.seq) : `T-${t.id}`, t.title, t.trade, t.startDate ?? project?.startDate ?? "", t.endDate ?? t.dueDate, t.status, ""]));
    rfis.forEach((r) => rows.push(["RFI", r.number, r.subject, "", r.dateCreated, r.dueDate, r.status, ""]));
    subs.forEach((s) => rows.push(["Submittal", s.number, s.subject, s.type, s.dateSubmitted, s.dueDate, s.status, ""]));
    cos.forEach((c) => rows.push(["Change Order", c.number, c.title, "", c.dateIssued, c.dateIssued, c.status, String(c.amount)]));
    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project?.name ?? "trusspath").replace(/\s+/g, "-").toLowerCase()}-${item.key}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const handleToggle = (item: CatalogItem) => {
    const next = !(connectedMap.get(item.key) ?? false);
    toggle.mutate({ key: item.key, connected: next });
  };

  const grouped = CATEGORIES.map((c) => ({ cat: c, items: filtered.filter((i) => i.category === c) })).filter((g) => g.items.length > 0);

  return (
    <Layout title="Integrations">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Plug className="size-6" /></div>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight">Integrations Hub</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Connect TrussPath to the payroll, accounting, document and field tools your crew already uses.
              {connectedCount > 0 && <span className="ml-1 font-medium text-foreground">{connectedCount} connected.</span>}
            </p>
          </div>
        </div>
        {/* project selector */}
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project:</span>
            {active.map((p) => (
              <button key={p.id} onClick={() => setProjectId(p.id)}
                className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", pid === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                {p.name.split(" ")[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search + category filter */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search integrations…"
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            data-testid="input-integration-search"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="integration-filters">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", cat === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Cards by category */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-muted/40" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No integrations match “{query}”.
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ cat: c, items }) => (
            <section key={c}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const connected = item.native || (connectedMap.get(item.key) ?? false);
                  return (
                    <div key={item.key}
                      className={cn("flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors", connected ? "border-primary/40" : "border-border")}
                      data-testid={`integration-card-${item.key}`}>
                      <div className="flex items-start gap-3">
                        <div className={cn("grid size-10 shrink-0 place-items-center rounded-md bg-muted", item.tint)} data-testid={`integration-icon-${item.key}`}>
                          <item.Icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-display text-sm font-bold">{item.name}</h3>
                            {item.native && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">NATIVE</span>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} data-testid={`integration-status-${item.key}`}>
                          {connected ? <><Check className="size-3.5" /> Connected</> : <>Not connected</>}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.action === "export-csv" && (
                            <Button size="sm" variant="outline" onClick={() => exportCsv(item)} data-testid={`integration-export-${item.key}`}>
                              <Download className="size-3.5" /> Export CSV
                            </Button>
                          )}
                          {item.action === "link" ? (
                            <Button size="sm" onClick={() => navigate(item.href!)} data-testid={`integration-open-${item.key}`}>
                              Open <ArrowRight className="size-3.5" />
                            </Button>
                          ) : (
                            <Button size="sm" variant={connected ? "outline" : "default"} onClick={() => handleToggle(item)} disabled={toggle.isPending} data-testid={`integration-toggle-${item.key}`}>
                              {connected ? (<><ExternalLink className="size-3.5" /> Disconnect</>) : (<><Plug className="size-3.5" /> Connect</>)}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Footnote */}
      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How connections work.</span>{" "}
            Google Calendar and the spreadsheet exports work out of the box today. Connecting a payroll, accounting or document
            service saves its status so your team sees what's wired up; full data sync for each provider is configured with your
            API credentials during onboarding. Toggle any card to mark it as connected.
          </p>
        </div>
      </div>
    </Layout>
  );
}
