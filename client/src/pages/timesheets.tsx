import { useState, useMemo, useRef } from "react";
import { Plus, Clock, Trash2, Pencil, Check, X, ChevronLeft, FileText, Printer, Send, FolderCheck, Calendar, ChevronRight } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState } from "@/components/ghost-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TIMESHEET_STATUS } from "@shared/schema";
import type { Timesheet, TimeEntry, Project, TeamMember } from "@shared/schema";
import timesheetLogoUrl from "@/../public/timesheet-logo.jpeg";

/* ---------- helpers ---------- */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getWeekRange(dateStr: string): { start: Date; end: Date; dates: Date[] } {
  const d = new Date(dateStr + "T00:00:00");
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay()); // Sunday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Saturday
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    dates.push(dd);
  }
  return { start, end, dates };
}

function fmtDateShort(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}/${d.getFullYear()}`;
}

function fmtWeekRange(start: Date, end: Date): string {
  return `${start.getMonth() + 1}/${start.getDate()}/${start.getFullYear()}-${end.getMonth() + 1}/${end.getDate()}/${end.getFullYear()}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "draft": return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    case "employee_signed": return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
    case "submitted":
    case "sent_to_manager": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "approved": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "rejected": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default: return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function dayKey(dateStr: string): string {
  return dateStr || "";
}

function docusignLabel(status: string | null | undefined): string {
  switch (status) {
    case null:
    case undefined:
    case "": return "not sent";
    case "not_configured": return "not configured";
    case "error": return "unavailable — sign in app";
    default: return status.replace(/_/g, " ");
  }
}

type ApiError = { message: string; code?: string; profileHref?: string };

/** apiRequest throws `Error("<status>: <body>")`; recover the JSON body when there is one. */
function parseApiError(err: unknown): ApiError {
  const raw = err instanceof Error ? err.message : String(err);
  const body = raw.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed.message === "string") return parsed;
  } catch {
    // Not JSON — fall through to the raw text.
  }
  return { message: body || "Something went wrong" };
}

/* ---------- data hooks ---------- */

function useTimesheets() {
  return useQuery<Timesheet[]>({ queryKey: ["/api/timesheets"] });
}

function useTimesheet(id: number | null) {
  return useQuery<{ id: number; entries: TimeEntry[] } & Omit<Timesheet, "id">>({
    queryKey: ["/api/timesheets", id],
    enabled: !!id,
  });
}

function useProjects() {
  return useQuery<Project[]>({ queryKey: ["/api/projects"] });
}

function useSettings() {
  return useQuery<{ companyName?: string }>({ queryKey: ["/api/settings"] });
}

function useTeam() {
  return useQuery<TeamMember[]>({ queryKey: ["/api/team"] });
}

/* ---------- main page ---------- */

export default function Timesheets() {
  const { data: timesheets = [], isLoading } = useTimesheets();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/timesheets", data);
      return res.json();
    },
    onSuccess: (ts) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      setShowCreate(false);
      setSelectedId(ts.id);
      toast({ title: "Timesheet created" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/timesheets/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      setSelectedId(null);
      toast({ title: "Timesheet deleted" });
    },
  });

  if (selectedId) {
    return (
      <TimesheetEditor
        id={selectedId}
        projects={projects}
        onBack={() => setSelectedId(null)}
        onDelete={() => deleteMut.mutate(selectedId)}
      />
    );
  }

  return (
    <Layout
      title="Time Tracking"
      actions={
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-new-timesheet">
          <Plus className="size-4" /> New Timesheet
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-muted-foreground">Loading timesheets...</div>
      ) : timesheets.length === 0 ? (
        <GhostState
          title="No timesheets yet"
          description="Create a weekly timesheet to start tracking time. Log hours daily, and the week builds up automatically."
          icon={Clock}
        />
      ) : (
        <div className="space-y-3">
          {timesheets.map((ts) => {
            const proj = projects.find((p) => p.id === ts.projectId);
            const weekInfo = getWeekRange(ts.weekStart);
            return (
              <div
                key={ts.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-foreground/20 transition cursor-pointer"
                onClick={() => setSelectedId(ts.id)}
                data-testid={`card-timesheet-${ts.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium truncate">{ts.employeeName}</span>
                    <Badge className={cn("text-xs capitalize", statusColor(ts.status))} variant="secondary">
                      {statusLabel(ts.status)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {proj?.name ?? "Unknown project"} · Week of {fmtWeekRange(weekInfo.start, weekInfo.end)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{ts.totalHours}h</div>
                  <div className="text-xs text-muted-foreground">total</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setSelectedId(ts.id); }}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Delete this timesheet? This cannot be undone.")) {
                      deleteMut.mutate(ts.id);
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <CreateTimesheetDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        projects={projects}
        onCreate={(data) => createMut.mutate(data)}
        loading={createMut.isPending}
      />
    </Layout>
  );
}

/* ---------- create dialog ---------- */

function CreateTimesheetDialog({
  open, onClose, projects, onCreate, loading,
}: {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  onCreate: (data: any) => void;
  loading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const weekInfo = getWeekRange(today);
  const weekStart = weekInfo.start.toISOString().slice(0, 10);

  const [employeeName, setEmployeeName] = useState("");
  const [projectId, setProjectId] = useState<string>(projects[0]?.id?.toString() ?? "");
  const [weekStartVal, setWeekStartVal] = useState(weekStart);

  const computedWeekEnd = useMemo(() => {
    const d = new Date(weekStartVal + "T00:00:00");
    const end = new Date(d);
    end.setDate(d.getDate() + 6);
    return end.toISOString().slice(0, 10);
  }, [weekStartVal]);

  const handleCreate = () => {
    if (!employeeName.trim() || !projectId) return;
    onCreate({
      employeeName: employeeName.trim(),
      projectId: Number(projectId),
      weekStart: weekStartVal,
      weekEnd: computedWeekEnd,
      totalHours: "0",
      status: "draft",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Weekly Timesheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee Name</label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="e.g. John Smith"
              data-testid="input-employee-name"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Week Starting (Sunday)</label>
            <Input
              type="date"
              value={weekStartVal}
              onChange={(e) => setWeekStartVal(e.target.value)}
              data-testid="input-week-start"
            />
            <p className="text-xs text-muted-foreground">
              Week ending: {computedWeekEnd}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!employeeName.trim() || !projectId || loading}
            data-testid="button-create-timesheet"
          >
            {loading ? "Creating..." : "Create Timesheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- entry draft type ---------- */

type EntryDraft = {
  id?: number;
  entryDate: string;
  dayOfWeek: string;
  clientName: string;
  projectName: string;
  hoursWorked: string;
  activities: string;
};

/* ---------- timesheet editor with daily + weekly views ---------- */

function TimesheetEditor({
  id, projects, onBack, onDelete,
}: {
  id: number;
  projects: Project[];
  onBack: () => void;
  onDelete: () => void;
}) {
  const { data: ts, isLoading } = useTimesheet(id);
  const { data: settings } = useSettings();
  const { data: team = [] } = useTeam();
  const { toast } = useToast();
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signing, setSigning] = useState<"employee" | "manager" | null>(null);
  const [sendError, setSendError] = useState<ApiError | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [selectedDay, setSelectedDay] = useState(0); // 0=Sun ... 6=Sat
  const [newEntry, setNewEntry] = useState({ clientName: "", projectName: "", hoursWorked: "", activities: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<EntryDraft | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const companyName = settings?.companyName?.trim() || "TrussPath";

  // Initialize entries from loaded data
  if (ts && !loaded) {
    const weekInfo = getWeekRange(ts.weekStart);
    const drafts: EntryDraft[] = [];

    for (const entry of ts.entries ?? []) {
      const dayIdx = weekInfo.dates.findIndex(
        (d) => d.toISOString().slice(0, 10) === entry.entryDate
      );
      drafts.push({
        id: entry.id,
        entryDate: entry.entryDate,
        dayOfWeek: dayIdx >= 0 ? DAYS[dayIdx] : entry.dayOfWeek || "",
        clientName: entry.clientName ?? "",
        projectName: entry.projectName ?? "",
        hoursWorked: entry.hoursWorked ?? "",
        activities: entry.activities ?? "",
      });
    }

    // Default selected day to today if in this week, else Monday
    const today = new Date().toISOString().slice(0, 10);
    const todayIdx = weekInfo.dates.findIndex((d) => d.toISOString().slice(0, 10) === today);
    setSelectedDay(todayIdx >= 0 ? todayIdx : 1);

    setEntries(drafts);
    setEmployeeName(ts.employeeName);
    setLoaded(true);
  }

  // Reset when switching timesheets
  if (ts && loaded && ts.id !== id) {
    setLoaded(false);
  }

  const weekInfo = ts ? getWeekRange(ts.weekStart) : null;
  const weekDates = weekInfo?.dates ?? [];

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const groups: EntryDraft[][] = [[], [], [], [], [], [], []];
    for (const entry of entries) {
      if (!weekInfo) continue;
      const idx = weekInfo.dates.findIndex(
        (d) => d.toISOString().slice(0, 10) === entry.entryDate
      );
      if (idx >= 0) groups[idx].push(entry);
      else groups[1].push(entry); // fallback to Monday
    }
    return groups;
  }, [entries, weekInfo]);

  const dayTotals = useMemo(() => {
    return entriesByDay.map((dayEntries) =>
      dayEntries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0).toFixed(2)
    );
  }, [entriesByDay]);

  const totalHours = useMemo(() => {
    return entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0).toFixed(2);
  }, [entries]);

  // Add entry for selected day
  const addEntryForDay = () => {
    if (!newEntry.hoursWorked && !newEntry.clientName && !newEntry.activities) return;
    const dateStr = weekDates[selectedDay]?.toISOString().slice(0, 10) ?? ts!.weekStart;
    const draft: EntryDraft = {
      entryDate: dateStr,
      dayOfWeek: DAYS[selectedDay],
      clientName: newEntry.clientName,
      projectName: newEntry.projectName,
      hoursWorked: newEntry.hoursWorked || "0",
      activities: newEntry.activities,
    };
    setEntries((prev) => [...prev, draft]);
    setNewEntry({ clientName: "", projectName: "", hoursWorked: "", activities: "" });
    toast({ title: `Added entry for ${DAYS[selectedDay]}` });
  };

  const updateEntryInline = (idx: number, field: keyof EntryDraft, value: string) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const startEdit = (entry: EntryDraft, globalIdx: number) => {
    setEditingId(globalIdx);
    setEditEntry({ ...entry });
  };

  const commitEdit = () => {
    if (editingId !== null && editEntry) {
      setEntries((prev) => prev.map((e, i) => i === editingId ? { ...editEntry } : e));
      setEditingId(null);
      setEditEntry(null);
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = entries
        .filter((e) => e.hoursWorked || e.clientName || e.activities || e.projectName)
        .map((e) => ({
          entryDate: e.entryDate || ts!.weekStart,
          dayOfWeek: e.dayOfWeek || "",
          clientName: e.clientName || null,
          projectName: e.projectName || null,
          hoursWorked: e.hoursWorked || "0",
          activities: e.activities || null,
        }));
      const res = await apiRequest("PUT", `/api/timesheets/${id}/entries`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", id] });
      toast({ title: "Timesheet saved" });
    },
  });

  const statusMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/timesheets/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets", id] });
      setSigning(null);
      toast({ title: "Timesheet updated" });
    },
  });

  const invalidateTimesheet = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/timesheets", id] });
    queryClient.invalidateQueries({ queryKey: ["/api/timesheets/pending"] });
  };

  const employeeSignMut = useMutation({
    mutationFn: async (signature: string) => {
      const res = await apiRequest("POST", `/api/timesheets/${id}/employee-sign`, { signature });
      return res.json();
    },
    onSuccess: () => {
      invalidateTimesheet();
      setSigning(null);
      toast({ title: "Signed", description: "Next: send it to your manager for approval." });
    },
    onError: (err) => toast({ title: "Could not sign", description: parseApiError(err).message, variant: "destructive" }),
  });

  const sendToManagerMut = useMutation({
    mutationFn: async () => {
      // Persist the grid first so the manager reviews what's on screen.
      await saveMut.mutateAsync();
      const res = await apiRequest("POST", `/api/timesheets/${id}/send-to-manager`);
      return res.json();
    },
    onSuccess: (data: { managerName?: string; emailAttempted?: boolean }) => {
      setSendError(null);
      invalidateTimesheet();
      toast({
        title: `Sent to ${data.managerName ?? "your manager"}`,
        description: data.emailAttempted ? "They've been emailed a request to sign." : "Awaiting their signature.",
      });
    },
    onError: (err) => setSendError(parseApiError(err)),
  });

  const managerSignMut = useMutation({
    mutationFn: async (signature: string) => {
      const res = await apiRequest("POST", `/api/timesheets/${id}/manager-sign`, { signature });
      return res.json();
    },
    onSuccess: () => {
      invalidateTimesheet();
      queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
      setSigning(null);
      toast({ title: "Approved", description: "Filed into Company Documents." });
    },
    onError: (err) => toast({ title: "Could not approve", description: parseApiError(err).message, variant: "destructive" }),
  });

  const refreshEnvelopeMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/timesheets/${id}/refresh-envelope`);
      return res.json();
    },
    onSuccess: (data: { docusignStatus?: string }) => {
      invalidateTimesheet();
      queryClient.invalidateQueries({ queryKey: ["/api/company-documents"] });
      toast({ title: `DocuSign status: ${docusignLabel(data.docusignStatus)}` });
    },
    onError: (err) => toast({ title: "Could not check status", description: parseApiError(err).message, variant: "destructive" }),
  });

  const managerRejectMut = useMutation({
    mutationFn: async (reason?: string) => {
      const res = await apiRequest("POST", `/api/timesheets/${id}/manager-reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      invalidateTimesheet();
      setSigning(null);
      toast({ title: "Timesheet rejected" });
    },
  });

  // Save as PDF (print to PDF)
  const handleSavePDF = () => {
    const printContent = printRef.current;
    if (!printContent || !ts) return;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;

    // Build a clean PDF-friendly layout
    const weekDatesHtml = weekDates.map((d, i) => {
      const dayEntries = entriesByDay[i] || [];
      const rows = dayEntries.length > 0
        ? dayEntries.map((e: EntryDraft) => `<tr>
            <td>${e.clientName || "&mdash;"}</td>
            <td>${e.projectName || "&mdash;"}</td>
            <td style="text-align:right">${e.hoursWorked || "0"}</td>
            <td>${e.activities || "&mdash;"}</td>
          </tr>`).join("")
        : `<tr><td colspan="4" style="color:#999;text-align:center">No hours logged</td></tr>`;
      return `
        <div style="margin-bottom:12px">
          <div style="font-weight:bold;border-bottom:1px solid #ccc;padding:4px 0;margin-bottom:4px">
            ${DAYS[i]}, ${fmtDateShort(d)}
            <span style="float:right">${dayTotals[i]}h</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="text-align:left;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Client</th>
              <th style="text-align:left;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Project</th>
              <th style="text-align:right;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Hours</th>
              <th style="text-align:left;padding:4px 8px;border:1px solid #ddd;background:#f5f5f5">Activities</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }).join("");

    win.document.write(`
      <html><head><title>Timesheet — ${ts.employeeName}</title>
      <style>
        @page { margin: 0.5in; }
        body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a1a; }
        .ts-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
        .ts-header img { width: 50px; height: 50px; }
        .ts-header h1 { font-size: 20px; margin: 0; }
        .ts-info { display: flex; gap: 32px; margin-bottom: 16px; }
        .ts-info b { color: #555; }
        .ts-total { font-size: 16px; font-weight: bold; margin: 12px 0; padding: 8px; background: #f0f0f0; border-radius: 4px; text-align: right; }
        .ts-sig { margin-top: 32px; display: flex; gap: 64px; }
        .ts-sig div { flex: 1; }
        .ts-sig-label { font-size: 12px; color: #666; margin-bottom: 4px; }
        .ts-sig-line { border-bottom: 1px solid #333; min-height: 24px; font-style: italic; font-size: 16px; }
      </style></head><body>
      <div class="ts-header">
        <img src="${timesheetLogoUrl}" alt="Logo" />
        <h1>${companyName}</h1>
        <span style="margin-left:auto;text-transform:capitalize;background:#e0e0e0;padding:2px 8px;border-radius:4px;font-size:12px">${statusLabel(ts.status)}</span>
      </div>
      <div class="ts-info">
        <div><b>Name:</b> ${ts.employeeName}</div>
        <div><b>Week of:</b> ${weekInfo ? fmtWeekRange(weekInfo.start, weekInfo.end) : ""}</div>
      </div>
      ${weekDatesHtml}
      <div class="ts-total">Total Hours: ${totalHours}</div>
      <div class="ts-sig">
        <div>
          <div class="ts-sig-label">Employee Signature</div>
          <div class="ts-sig-line">${ts.employeeSignature || "&nbsp;"}</div>
        </div>
        <div>
          <div class="ts-sig-label">Manager Signature</div>
          <div class="ts-sig-line">${ts.managerSignature || "&nbsp;"}</div>
        </div>
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  if (isLoading || !ts || !weekInfo) {
    return (
      <Layout title="Time Tracking">
        <div className="text-muted-foreground">Loading timesheet...</div>
      </Layout>
    );
  }

  const isApproved = ts.status === TIMESHEET_STATUS.approved;
  const isRejected = ts.status === TIMESHEET_STATUS.rejected;
  const isSentToManager = ts.status === TIMESHEET_STATUS.sentToManager;
  // `submitted` is the pre-workflow status still present on older rows.
  const canSendToManager = !!ts.employeeSignature && !isSentToManager && !isApproved;
  const managerName = team.find((m) => m.id === ts.managerUserId)?.name ?? null;

  const commitNameChange = () => {
    if (employeeName.trim() && employeeName !== ts.employeeName) {
      statusMut.mutate({ employeeName: employeeName.trim() });
    }
  };

  return (
    <Layout
      title="Time Tracking"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="size-4" /> Back
          </Button>
          <Button variant="outline" size="sm" onClick={handleSavePDF} data-testid="button-save-pdf">
            <FileText className="size-4" /> Save PDF
          </Button>
          {canSendToManager && (
            <Button variant="outline" size="sm" onClick={() => sendToManagerMut.mutate()} disabled={sendToManagerMut.isPending} data-testid="button-send-to-manager">
              <Send className="size-4" /> {sendToManagerMut.isPending ? "Sending..." : "Save & Send to Manager"}
            </Button>
          )}
          {ts.companyDocId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <FolderCheck className="size-3" /> Filed in Docs
            </Badge>
          )}
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="button-save-timesheet">
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      {/* ===== Print-only container (hidden on screen) ===== */}
      <div ref={printRef} className="hidden print:block" />

      {/* ===== Header card ===== */}
      <div className="rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden">
        {/* Header band */}
        <div className="flex items-center gap-2 border-b-2 border-border bg-muted/40 px-3 py-3 md:px-6 md:py-4">
          <img src={timesheetLogoUrl} alt="Company Logo" className="size-10 shrink-0 rounded-lg object-contain md:size-12" />
          <div className="font-display text-base font-bold tracking-tight md:text-lg">{companyName}</div>
          <div className="ml-auto">
            <Badge className={cn("text-xs capitalize", statusColor(ts.status))} variant="secondary">{statusLabel(ts.status)}</Badge>
          </div>
        </div>

        {/* Employee + Week info */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 md:px-6 md:py-3 md:gap-x-8 md:gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground md:text-sm">Name:</span>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              onBlur={commitNameChange}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              className="h-8 w-32 border-b-1 border-input px-1 text-sm font-medium md:w-48"
              data-testid="input-employee-header"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground md:text-sm">Week of:</span>
            <span className="text-sm font-medium text-primary">{fmtWeekRange(weekInfo.start, weekInfo.end)}</span>
          </div>
        </div>

        {/* ===== Day selector tabs ===== */}
        <div className="flex overflow-x-auto border-b border-border bg-muted/20">
          {DAYS_SHORT.map((day, i) => {
            const hasEntries = entriesByDay[i].length > 0;
            const dayTotal = parseFloat(dayTotals[i]) > 0;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(i)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2.5 text-xs font-medium transition shrink-0 relative",
                  i === selectedDay
                    ? "bg-card text-foreground border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                data-testid={`tab-day-${i}`}
              >
                <span>{day}</span>
                <span className="text-[10px] text-muted-foreground">{weekDates[i]?.getDate() ?? ""}</span>
                {hasEntries && dayTotal && (
                  <span className="absolute right-1 top-1 size-1.5 rounded-full bg-green-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* ===== Daily entry form ===== */}
        <div className="border-b border-border p-3 md:p-4">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{DAYS[selectedDay]}, {fmtDateShort(weekDates[selectedDay])}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {entriesByDay[selectedDay].length} {entriesByDay[selectedDay].length === 1 ? "entry" : "entries"} · {dayTotals[selectedDay]}h
            </span>
          </div>

          {/* New entry form */}
          <div className="space-y-2 rounded-lg border border-border/60 p-2.5 md:p-3 bg-muted/10">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Input
                value={newEntry.clientName}
                onChange={(e) => setNewEntry({ ...newEntry, clientName: e.target.value })}
                placeholder="Client"
                className="h-9 text-sm"
                data-testid="input-new-client"
              />
              <Input
                value={newEntry.projectName}
                onChange={(e) => setNewEntry({ ...newEntry, projectName: e.target.value })}
                placeholder="Project / Task"
                className="h-9 text-sm"
                data-testid="input-new-project"
              />
              <Input
                type="number"
                step="0.25"
                min="0"
                value={newEntry.hoursWorked}
                onChange={(e) => setNewEntry({ ...newEntry, hoursWorked: e.target.value })}
                placeholder="Hours"
                className="h-9 text-sm font-mono"
                data-testid="input-new-hours"
              />
              <Button size="sm" onClick={addEntryForDay} className="h-9" data-testid="button-add-entry">
                <Plus className="size-4" /> Add
              </Button>
            </div>
            <Textarea
              value={newEntry.activities}
              onChange={(e) => setNewEntry({ ...newEntry, activities: e.target.value })}
              placeholder="Activities — what did you work on?"
              className="min-h-[40px] text-sm resize-y"
              data-testid="input-new-activities"
            />
          </div>

          {/* Entries for selected day */}
          {entriesByDay[selectedDay].length > 0 ? (
            <div className="mt-3 space-y-2">
              {entriesByDay[selectedDay].map((entry) => {
                const globalIdx = entries.indexOf(entry);
                const isEditing = editingId === globalIdx;
                return (
                  <div key={globalIdx} className="rounded-lg border border-border/60 p-2.5 bg-card">
                    {isEditing && editEntry ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            value={editEntry.clientName}
                            onChange={(e) => setEditEntry({ ...editEntry, clientName: e.target.value })}
                            placeholder="Client"
                            className="h-9 text-sm"
                          />
                          <Input
                            value={editEntry.projectName}
                            onChange={(e) => setEditEntry({ ...editEntry, projectName: e.target.value })}
                            placeholder="Project"
                            className="h-9 text-sm"
                          />
                          <Input
                            type="number"
                            step="0.25"
                            value={editEntry.hoursWorked}
                            onChange={(e) => setEditEntry({ ...editEntry, hoursWorked: e.target.value })}
                            placeholder="Hours"
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                        <Textarea
                          value={editEntry.activities}
                          onChange={(e) => setEditEntry({ ...editEntry, activities: e.target.value })}
                          placeholder="Activities"
                          className="min-h-[36px] text-sm resize-y"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={commitEdit} data-testid="button-commit-edit">
                            <Check className="size-4" /> Done
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditEntry(null); }}>
                            <X className="size-4" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{entry.clientName || "—"}</span>
                          <span className="text-xs text-muted-foreground">{entry.projectName}</span>
                          <span className="ml-auto font-mono font-bold text-sm px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {entry.hoursWorked || "0"}h
                          </span>
                          <button
                            onClick={() => startEdit(entry, globalIdx)}
                            className="text-muted-foreground/50 hover:text-foreground p-1"
                            aria-label="Edit entry"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => removeEntry(globalIdx)}
                            className="text-muted-foreground/50 hover:text-destructive p-1"
                            aria-label="Delete entry"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                        {entry.activities && (
                          <p className="mt-1 text-xs text-muted-foreground">{entry.activities}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 text-center text-sm text-muted-foreground py-4">
              No entries for {DAYS[selectedDay]} yet. Add one above.
            </div>
          )}
        </div>

        {/* ===== Weekly calendar overview ===== */}
        <div className="p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">Weekly Summary</span>
            <span className="text-sm font-mono font-bold">Total: {totalHours}h</span>
          </div>
          {/* Desktop: 7-column grid */}
          <div className="hidden md:grid md:grid-cols-7 gap-2">
            {DAYS_SHORT.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-2 text-center cursor-pointer transition",
                  i === selectedDay ? "border-primary bg-primary/5" : "border-border/60 hover:border-foreground/20",
                )}
                onClick={() => setSelectedDay(i)}
              >
                <div className="text-xs font-semibold text-muted-foreground">{day}</div>
                <div className="text-lg font-bold mt-1">{weekDates[i]?.getDate() ?? ""}</div>
                <div className="text-xs font-mono mt-1">{dayTotals[i]}h</div>
                <div className="mt-1 space-y-0.5">
                  {entriesByDay[i].slice(0, 2).map((e, j) => (
                    <div key={j} className="text-[10px] text-muted-foreground truncate">
                      {e.clientName || e.projectName || "—"}
                    </div>
                  ))}
                  {entriesByDay[i].length > 2 && (
                    <div className="text-[10px] text-muted-foreground">+{entriesByDay[i].length - 2} more</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Mobile: horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto md:hidden pb-1">
            {DAYS_SHORT.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border p-2 text-center cursor-pointer transition shrink-0 w-16",
                  i === selectedDay ? "border-primary bg-primary/5" : "border-border/60",
                )}
                onClick={() => setSelectedDay(i)}
              >
                <div className="text-xs font-semibold text-muted-foreground">{day}</div>
                <div className="text-base font-bold mt-0.5">{weekDates[i]?.getDate() ?? ""}</div>
                <div className="text-xs font-mono mt-0.5">{dayTotals[i]}h</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== Signature section ===== */}
        <div className="border-t-2 border-border bg-muted/20 px-3 py-4 md:px-6 md:py-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Employee signature */}
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Employee Signature</div>
              {ts.employeeSignature ? (
                <div className="flex items-center gap-2 border-b border-border pb-1">
                  <span className="font-medium italic text-lg">{ts.employeeSignature}</span>
                  <Check className="size-4 text-green-600" />
                </div>
              ) : signing === "employee" ? (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 border-b border-border pb-1">
                    <Input
                      id="emp-sig"
                      placeholder="Type your full name to sign"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          if (val.trim()) employeeSignMut.mutate(val.trim());
                        }
                      }}
                      data-testid="input-employee-signature"
                      className="border-0 bg-transparent px-0 h-7 text-lg"
                    />
                  </div>
                  <Button size="sm" onClick={() => {
                    const input = document.getElementById("emp-sig") as HTMLInputElement;
                    if (input?.value.trim()) employeeSignMut.mutate(input.value.trim());
                  }} disabled={employeeSignMut.isPending} data-testid="button-sign-submit">
                    Sign
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSigning(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSigning("employee")} data-testid="button-sign-employee">
                  <FileText className="size-4" /> Sign
                </Button>
              )}
              {canSendToManager && (
                <div className="mt-3">
                  <Button size="sm" onClick={() => sendToManagerMut.mutate()} disabled={sendToManagerMut.isPending} data-testid="button-send-to-manager-inline">
                    <Send className="size-4" /> {sendToManagerMut.isPending ? "Sending..." : "Save & Send to Manager"}
                  </Button>
                  {sendError && (
                    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" data-testid="text-send-error">
                      {sendError.message}
                      {sendError.profileHref && (
                        <a href={`#${sendError.profileHref}`} className="ml-1 font-semibold underline">
                          Open Team page
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Manager signature */}
            <div>
              <div className="text-sm font-semibold text-muted-foreground mb-2">Manager Signature</div>
              {ts.managerSignature ? (
                <div className="flex items-center gap-2 border-b border-border pb-1">
                  <span className="font-medium italic text-lg">{ts.managerSignature}</span>
                  <Check className="size-4 text-green-600" />
                </div>
              ) : signing === "manager" ? (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 border-b border-border pb-1">
                    <Input
                      id="mgr-sig"
                      placeholder="Type name to approve"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          if (val.trim()) managerSignMut.mutate(val.trim());
                        }
                      }}
                      data-testid="input-manager-signature"
                      className="border-0 bg-transparent px-0 h-7 text-lg"
                    />
                  </div>
                  <Button size="sm" onClick={() => {
                    const input = document.getElementById("mgr-sig") as HTMLInputElement;
                    if (input?.value.trim()) managerSignMut.mutate(input.value.trim());
                  }} disabled={managerSignMut.isPending} data-testid="button-approve">
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => managerRejectMut.mutate(undefined)} disabled={managerRejectMut.isPending}>
                    <X className="size-4" /> Reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSigning(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : isSentToManager ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground border-b border-border/40 pb-1" data-testid="text-manager-pending">
                    Sent to {managerName ?? "manager"} — awaiting signature
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      DocuSign: {docusignLabel(ts.docusignStatus)}
                    </Badge>
                    {ts.docusignEnvelopeId && (
                      <Button variant="ghost" size="sm" onClick={() => refreshEnvelopeMut.mutate()} disabled={refreshEnvelopeMut.isPending}>
                        {refreshEnvelopeMut.isPending ? "Checking..." : "Check status"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setSigning("manager")} data-testid="button-sign-manager">
                      <FileText className="size-4" /> Sign in app
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground border-b border-border/40 pb-1">
                  {isApproved ? "Approved" : isRejected ? "Rejected" : "Awaiting employee signature"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete timesheet */}
        <div className="flex justify-end px-3 py-3 border-t border-border/40 md:px-6">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive" data-testid="button-delete-timesheet">
            <Trash2 className="size-4" /> Delete Timesheet
          </Button>
        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div className="sticky bottom-0 z-10 mt-2 flex items-center gap-2 rounded-lg border border-border bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <Button variant="outline" size="sm" onClick={handleSavePDF} className="flex-1" data-testid="m-sticky-pdf">
          <FileText className="size-4" /> Save PDF
        </Button>
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1" data-testid="m-sticky-save">
          {saveMut.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </Layout>
  );
}
