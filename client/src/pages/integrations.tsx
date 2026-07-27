import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Search, Check, Plug, Download, ExternalLink, ArrowRight, Users, Calculator,
  Building2, FileSpreadsheet, HardDrive, Box, MessageSquare, MessagesSquare,
  Mail, CalendarRange, GanttChartSquare, PenTool, FileText, Clock,
  Timer, Activity, Wallet, Unplug, Zap, Loader2,
} from "lucide-react";
import {
  SiAdp, SiGooglesheets, SiGoogledrive, SiQuickbooks, SiDropbox, SiAutodesk,
  SiGusto, SiPaychex, SiSage,
} from "react-icons/si";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useProjects, useTasks, useRfis, useSubmittals, useChangeOrders,
  useIntegrations, useConnectIntegration, useDisconnectIntegration, useTestIntegration,
  useCurrentOrg, useUpdateOrg, useIntegrationEnabled, type IntegrationKey,
} from "@/hooks/use-data";
import type { Integration } from "@shared/schema";

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
  setupUrl?: string;
  // When set, the org owner/admin can turn this native integration off for the
  // whole org. Reads/writes /api/org/current disabledIntegrations JSONB.
  orgToggleKey?: IntegrationKey;
}

const CATALOG: CatalogItem[] = [
  // Payroll & HR
  { key: "adp", name: "ADP", category: "Payroll & HR", description: "Sync crew payroll, benefits and time cards for field labor.", Icon: SiAdp, tint: "text-red-600", action: "toggle", setupUrl: "https://adp.com" },
  { key: "trinet", name: "TriNet", category: "Payroll & HR", description: "PEO HR, benefits and payroll for your workforce.", Icon: Users, tint: "text-emerald-600", action: "toggle", setupUrl: "https://trinet.com" },
  { key: "paychex", name: "Paychex", category: "Payroll & HR", description: "Payroll processing, HR and retirement services.", Icon: SiPaychex, tint: "text-orange-600", action: "toggle", setupUrl: "https://paychex.com" },
  { key: "gusto", name: "Gusto", category: "Payroll & HR", description: "Modern payroll, benefits and crew onboarding.", Icon: SiGusto, tint: "text-rose-600", action: "toggle", setupUrl: "https://gusto.com" },
  { key: "intuit-payroll", name: "QuickBooks Payroll", category: "Payroll & HR", description: "Intuit payroll tied to job-cost accounting.", Icon: SiQuickbooks, tint: "text-green-600", action: "toggle", setupUrl: "https://quickbooks.intuit.com" },

  // Accounting
  { key: "quickbooks", name: "QuickBooks Online", category: "Accounting", description: "Two-way sync of invoices, bills and job costs.", Icon: SiQuickbooks, tint: "text-green-600", action: "toggle", setupUrl: "https://quickbooks.intuit.com" },
  { key: "sage", name: "Sage 100 Contractor", category: "Accounting", description: "Construction accounting and job-cost sync.", Icon: SiSage, tint: "text-emerald-600", action: "toggle", setupUrl: "https://sage.com" },
  { key: "foundation", name: "Foundation", category: "Accounting", description: "Foundation Software construction accounting.", Icon: Calculator, tint: "text-blue-600", action: "toggle", setupUrl: "https://foundationsoft.com" },
  { key: "netsuite", name: "Oracle NetSuite", category: "Accounting", description: "ERP financials, procurement and project accounting.", Icon: Building2, tint: "text-sky-600", action: "toggle", setupUrl: "https://netsuite.com" },

  // Spreadsheets
  { key: "google-sheets", name: "Google Sheets", category: "Spreadsheets", description: "Export your schedule, RFIs, submittals and COs to Sheets.", Icon: SiGooglesheets, tint: "text-emerald-600", action: "export-csv" },
  { key: "excel", name: "Microsoft Excel", category: "Spreadsheets", description: "Export project data to an Excel-ready workbook.", Icon: FileSpreadsheet, tint: "text-green-600", action: "export-csv" },

  // Documents
  { key: "google-drive", name: "Google Drive", category: "Documents", description: "Attach drawings, submittals and photos from Drive.", Icon: SiGoogledrive, tint: "text-amber-600", action: "toggle", setupUrl: "https://drive.google.com" },
  { key: "dropbox", name: "Dropbox", category: "Documents", description: "Sync project documents and field photos.", Icon: SiDropbox, tint: "text-blue-600", action: "toggle", setupUrl: "https://dropbox.com" },
  { key: "onedrive", name: "Microsoft OneDrive", category: "Documents", description: "Browse and attach OneDrive files to records.", Icon: HardDrive, tint: "text-sky-600", action: "toggle", setupUrl: "https://onedrive.live.com" },
  { key: "box", name: "Box", category: "Documents", description: "Enterprise document storage and plan sets.", Icon: Box, tint: "text-blue-600", action: "toggle", setupUrl: "https://box.com" },

  // Communication
  { key: "slack", name: "Slack", category: "Communication", description: "Send the daily brief and alerts to project channels.", Icon: MessageSquare, tint: "text-purple-600", action: "toggle", setupUrl: "https://slack.com" },
  { key: "teams", name: "Microsoft Teams", category: "Communication", description: "Post updates and RFIs into Teams channels.", Icon: MessagesSquare, tint: "text-indigo-600", action: "toggle", setupUrl: "https://teams.microsoft.com" },
  { key: "gmail", name: "Gmail", category: "Communication", description: "Email RFIs, submittals and daily logs directly.", Icon: Mail, tint: "text-red-600", action: "toggle", setupUrl: "https://gmail.com" },
  { key: "outlook", name: "Outlook", category: "Communication", description: "Outlook email and calendar integration.", Icon: Mail, tint: "text-blue-600", action: "toggle", setupUrl: "https://outlook.live.com" },

  // Scheduling
  { key: "google-calendar", name: "Google Calendar", category: "Scheduling", description: "Two-way calendar sync with tasks, RFIs and milestones.", Icon: CalendarRange, tint: "text-blue-600", action: "link", href: "/schedule", native: true, orgToggleKey: "googleCalendar" },
  { key: "ms-project", name: "Microsoft Project", category: "Scheduling", description: "Import .mpp schedules into the Gantt view.", Icon: GanttChartSquare, tint: "text-emerald-600", action: "toggle" },

  // Design & BIM
  { key: "autodesk", name: "Autodesk Construction Cloud", category: "Design & BIM", description: "Link ACC drawings, models and sheets to records.", Icon: SiAutodesk, tint: "text-slate-700 dark:text-slate-300", action: "toggle", setupUrl: "https://construction.autodesk.com" },
  { key: "bluebeam", name: "Bluebeam Revu", category: "Design & BIM", description: "Sync markups and punch from Bluebeam sessions.", Icon: PenTool, tint: "text-orange-600", action: "toggle", setupUrl: "https://bluebeam.com" },

  // Time Tracking
  { key: "clockshark", name: "ClockShark", category: "Time Tracking", description: "Crew time tracking with GPS and clock-in data.", Icon: Clock, tint: "text-sky-600", action: "toggle", setupUrl: "https://clockshark.com" },
  { key: "tsheets", name: "QuickBooks Time (TSheets)", category: "Time Tracking", description: "Employee time tracking and timesheet approval.", Icon: Timer, tint: "text-green-600", action: "toggle", setupUrl: "https://tsheets.intuit.com" },
  { key: "hubstaff", name: "Hubstaff", category: "Time Tracking", description: "Time, activity and location for field crews.", Icon: Activity, tint: "text-orange-600", action: "toggle", setupUrl: "https://hubstaff.com" },
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
  const connectMut = useConnectIntegration();
  const disconnectMut = useDisconnectIntegration();
  const testMut = useTestIntegration();
  const { toast } = useToast();

  // Org-level org-toggle state. Only owners + admins can hit the PATCH route;
  // for anyone else the toggle renders as a read-only "ON"/"OFF" pill.
  const { data: orgData } = useCurrentOrg();
  const orgRole = orgData?.membership?.role;
  const canManageOrg = orgRole === "owner" || orgRole === "admin";
  const updateOrg = useUpdateOrg();
  const gcalEnabled = useIntegrationEnabled("googleCalendar");
  const isNativeEnabled = (item: CatalogItem): boolean => {
    if (!item.orgToggleKey) return true;
    if (item.orgToggleKey === "googleCalendar") return gcalEnabled;
    return true;
  };
  const toggleNativeIntegration = (item: CatalogItem) => {
    if (!item.orgToggleKey || !canManageOrg) return;
    const currentlyEnabled = isNativeEnabled(item);
    const nextDisabled = currentlyEnabled; // if it was enabled, we're turning it OFF (disabled=true)
    updateOrg.mutate(
      { disabledIntegrations: { [item.orgToggleKey]: nextDisabled } },
      {
        onSuccess: () => {
          toast({
            title: nextDisabled ? `${item.name} turned off` : `${item.name} turned on`,
            description: nextDisabled
              ? `Hidden from the Schedule page for everyone in your org.`
              : `Restored on the Schedule page for everyone in your org.`,
          });
        },
        onError: (e: any) => {
          toast({ title: "Couldn't update integration", description: String(e?.message ?? e), variant: "destructive" });
        },
      },
    );
  };

  const integrationMap = useMemo(() => {
    const m = new Map<string, Integration>();
    rows.forEach((r) => m.set(r.key, r));
    return m;
  }, [rows]);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<CatKey | "All">("All");
  const [connectItem, setConnectItem] = useState<CatalogItem | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [testing, setTesting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG.filter((c) => {
      if (cat !== "All" && c.category !== cat) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q);
    });
  }, [query, cat]);

  // A native integration counts as "connected" only when the org hasn't turned
  // it off. A user-connected row counts based on the DB row.
  const connectedCount = CATALOG.filter((c) => {
    if (c.native) return isNativeEnabled(c);
    return !!integrationMap.get(c.key)?.connected;
  }).length;

  const exportCsv = (item: CatalogItem) => {
    const csvRows: string[][] = [["Type", "Number", "Title", "Trade/Category", "Start", "End/Due", "Status", "Amount"]];
    tasks.forEach((t) => csvRows.push(["Task", t.seq ? String(t.seq) : `T-${t.id}`, t.title, t.trade, t.startDate ?? project?.startDate ?? "", t.endDate ?? t.dueDate, t.status, ""]));
    rfis.forEach((r) => csvRows.push(["RFI", r.number, r.subject, "", r.dateCreated, r.dueDate, r.status, ""]));
    subs.forEach((s) => csvRows.push(["Submittal", s.number, s.subject, s.type, s.dateSubmitted, s.dueDate, s.status, ""]));
    cos.forEach((c) => csvRows.push(["Change Order", c.number, c.title, "", c.dateIssued, c.dateIssued, c.status, String(c.amount)]));
    const csv = csvRows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project?.name ?? "trusspath").replace(/\s+/g, "-").toLowerCase()}-${item.key}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const openConnect = (item: CatalogItem) => {
    const existing = integrationMap.get(item.key);
    setAccountLabel(existing?.accountLabel ?? "");
    setConnectItem(item);
  };

  const handleConnect = async () => {
    if (!connectItem) return;
    try {
      await connectMut.mutateAsync({ key: connectItem.key, accountLabel: accountLabel.trim() || undefined });
      toast({ title: `${connectItem.name} connected`, description: accountLabel ? `Account: ${accountLabel}` : undefined });
      setConnectItem(null);
    } catch {
      toast({ title: "Connection failed", variant: "destructive" });
    }
  };

  const handleDisconnect = async (item: CatalogItem) => {
    try {
      await disconnectMut.mutateAsync(item.key);
      toast({ title: `${item.name} disconnected` });
    } catch {
      toast({ title: "Disconnect failed", variant: "destructive" });
    }
  };

  const handleTest = async (item: CatalogItem) => {
    setTesting(true);
    try {
      const result = await testMut.mutateAsync(item.key);
      toast({ title: `${item.name}: ${result.message}`, description: result.ok ? "Connection is working" : "Connection issue detected" });
    } catch {
      toast({ title: "Test failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
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
          No integrations match "{query}".
        </div>
      ) : (
        <div className="space-y-7">
          {grouped.map(({ cat: c, items }) => (
            <section key={c}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => {
                  const intRow = integrationMap.get(item.key);
                  const nativeEnabled = isNativeEnabled(item);
                  const connected = item.native ? nativeEnabled : !!intRow?.connected;
                  const showOrgToggle = !!item.orgToggleKey;
                  return (
                    <div key={item.key}
                      className={cn(
                        "flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors",
                        connected ? "border-primary/40" : "border-border",
                        item.native && !nativeEnabled && "opacity-70",
                      )}
                      data-testid={`integration-card-${item.key}`}>
                      <div className="flex items-start gap-3">
                        <div className={cn("grid size-10 shrink-0 place-items-center rounded-md bg-muted", item.tint)} data-testid={`integration-icon-${item.key}`}>
                          <item.Icon className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-display text-sm font-bold">{item.name}</h3>
                            {item.native && nativeEnabled && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">NATIVE</span>}
                            {item.native && !nativeEnabled && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">OFF</span>}
                            {connected && !item.native && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">CONNECTED</span>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                          {intRow?.accountLabel && connected && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{intRow.accountLabel}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} data-testid={`integration-status-${item.key}`}>
                          {connected ? <><Check className="size-3.5" /> {item.native ? "On" : "Connected"}</> : (item.native ? <>Turned off</> : <>Not connected</>)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {item.action === "export-csv" && (
                            <Button size="sm" variant="outline" onClick={() => exportCsv(item)} data-testid={`integration-export-${item.key}`}>
                              <Download className="size-3.5" /> Export
                            </Button>
                          )}
                          {showOrgToggle && (
                            canManageOrg ? (
                              <Button
                                size="sm"
                                variant={nativeEnabled ? "outline" : "default"}
                                onClick={() => toggleNativeIntegration(item)}
                                disabled={updateOrg.isPending}
                                data-testid={`integration-org-toggle-${item.key}`}
                              >
                                {updateOrg.isPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : nativeEnabled ? (
                                  <><Unplug className="size-3.5" /> Turn off</>
                                ) : (
                                  <><Plug className="size-3.5" /> Turn on</>
                                )}
                              </Button>
                            ) : (
                              <span className="text-[11px] italic text-muted-foreground" data-testid={`integration-org-toggle-readonly-${item.key}`}>
                                Owner-only
                              </span>
                            )
                          )}
                          {item.action === "link" && nativeEnabled ? (
                            <Button size="sm" onClick={() => navigate(item.href!)} data-testid={`integration-open-${item.key}`}>
                              Open <ArrowRight className="size-3.5" />
                            </Button>
                          ) : item.action === "link" ? null : connected && !item.native ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleTest(item)} disabled={testing} data-testid={`integration-test-${item.key}`}>
                                {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                                Test
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openConnect(item)} data-testid={`integration-manage-${item.key}`}>
                                Manage
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDisconnect(item)} disabled={disconnectMut.isPending} data-testid={`integration-disconnect-${item.key}`}>
                                <Unplug className="size-3.5" />
                              </Button>
                            </>
                          ) : !item.native ? (
                            <Button size="sm" onClick={() => openConnect(item)} data-testid={`integration-connect-${item.key}`}>
                              <Plug className="size-3.5" /> Connect
                            </Button>
                          ) : null}
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

      {/* Connect dialog */}
      <Dialog open={!!connectItem} onOpenChange={(o) => { if (!o) setConnectItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectItem && (
                <>
                  <span className={cn("grid size-8 place-items-center rounded-md bg-muted", connectItem.tint)}>
                    <connectItem.Icon className="size-4" />
                  </span>
                  Connect {connectItem.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          {connectItem && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{connectItem.description}</p>
              <div>
                <Label>Account Label</Label>
                <Input
                  value={accountLabel}
                  onChange={(e) => setAccountLabel(e.target.value)}
                  placeholder="e.g. My Company Workspace"
                  className="mt-1.5"
                  data-testid="input-integration-account-label"
                />
                <p className="mt-1 text-xs text-muted-foreground">A friendly name to identify this connection.</p>
              </div>
              {connectItem.setupUrl && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    You'll be redirected to {connectItem.name} to authorize access. After authorizing, return here to complete the connection.
                  </p>
                  <a href={connectItem.setupUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" data-testid="link-integration-setup">
                    Open {connectItem.name} <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectItem(null)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={connectMut.isPending} data-testid="button-integration-connect-confirm">
              {connectMut.isPending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footnote */}
      <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How connections work.</span>{" "}
            Google Calendar and the spreadsheet exports work out of the box today. Connecting a payroll, accounting or document
            service saves its status and account label so your team sees what's wired up. Click "Connect" to set up an integration,
            "Test" to verify the connection, and "Manage" to update settings.
          </p>
        </div>
      </div>
    </Layout>
  );
}
