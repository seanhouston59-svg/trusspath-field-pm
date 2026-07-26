import { useState, useMemo } from "react";
import { Plus, Clock, Trash2, Pencil, Check, X, ChevronLeft, FileText, GripVertical } from "lucide-react";
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
import { Logo } from "@/components/bits";
import type { Timesheet, TimeEntry, Project } from "@shared/schema";

/* ---------- helpers ---------- */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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
    case "submitted": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "approved": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "rejected": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
    default: return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
  }
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
          description="Create a weekly timesheet to start tracking time. The grid mirrors your paper timesheet — day by day, with client, project, hours, and activities."
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
                    <Badge className={cn("text-xs", statusColor(ts.status))} variant="secondary">
                      {ts.status}
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
  const weekEnd = weekInfo.end.toISOString().slice(0, 10);

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

/* ---------- timesheet editor (matches paper layout) ---------- */

type EntryDraft = {
  id?: number;
  entryDate: string;
  dayOfWeek: string;
  clientName: string;
  projectName: string;
  hoursWorked: string;
  activities: string;
  isExtra: boolean;
};

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
  const { toast } = useToast();
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signing, setSigning] = useState<"employee" | "manager" | null>(null);

  const companyName = settings?.companyName?.trim() || "TrussPath";

  // Initialize entries from loaded data — 7 day rows + extra rows from existing entries
  if (ts && !loaded) {
    const weekInfo = getWeekRange(ts.weekStart);
    const drafts: EntryDraft[] = [];

    // First 7 rows: one per day of the week
    for (let i = 0; i < 7; i++) {
      const date = weekInfo.dates[i];
      const dateStr = date.toISOString().slice(0, 10);
      const existing = ts.entries?.find((e) => e.entryDate === dateStr);
      drafts.push({
        id: existing?.id,
        entryDate: dateStr,
        dayOfWeek: DAYS[i],
        clientName: existing?.clientName ?? "",
        projectName: existing?.projectName ?? "",
        hoursWorked: existing?.hoursWorked ?? "",
        activities: existing?.activities ?? "",
        isExtra: false,
      });
    }

    // Add extra rows for any entries that didn't match the 7 days
    for (const entry of ts.entries ?? []) {
      const matched = drafts.some((d) => d.id === entry.id);
      if (!matched) {
        drafts.push({
          id: entry.id,
          entryDate: entry.entryDate,
          dayOfWeek: entry.dayOfWeek || "",
          clientName: entry.clientName ?? "",
          projectName: entry.projectName ?? "",
          hoursWorked: entry.hoursWorked ?? "",
          activities: entry.activities ?? "",
          isExtra: true,
        });
      }
    }

    // Add 5 blank extra rows for new entries
    for (let i = 0; i < 5; i++) {
      drafts.push({
        entryDate: "",
        dayOfWeek: "",
        clientName: "",
        projectName: "",
        hoursWorked: "",
        activities: "",
        isExtra: true,
      });
    }

    setEntries(drafts);
    setLoaded(true);
  }

  const totalHours = useMemo(() => {
    return entries.reduce((sum, e) => sum + (parseFloat(e.hoursWorked) || 0), 0).toFixed(2);
  }, [entries]);

  const updateEntry = (idx: number, field: keyof EntryDraft, value: string) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const addRow = () => {
    setEntries((prev) => [...prev, {
      entryDate: "",
      dayOfWeek: "",
      clientName: "",
      projectName: "",
      hoursWorked: "",
      activities: "",
      isExtra: true,
    }]);
  };

  const removeRow = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
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

  if (isLoading || !ts) {
    return (
      <Layout title="Time Tracking">
        <div className="text-muted-foreground">Loading timesheet...</div>
      </Layout>
    );
  }

  const weekInfo = getWeekRange(ts.weekStart);
  const isDraft = ts.status === "draft";
  const isSubmitted = ts.status === "submitted";
  const isApproved = ts.status === "approved";
  const isRejected = ts.status === "rejected";

  return (
    <Layout
      title="Time Tracking"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="size-4" /> Back
          </Button>
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !isDraft}
            data-testid="button-save-timesheet"
          >
            {saveMut.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      {/* ===== Timesheet Card — matches paper layout ===== */}
      <div className="rounded-xl border-2 border-border bg-card shadow-sm overflow-hidden" data-testid="timesheet-card">

        {/* --- Header band: logo + company name --- */}
        <div className="flex items-center gap-3 border-b-2 border-border bg-muted/40 px-6 py-4">
          <Logo className="size-10 shrink-0" />
          <div className="font-display text-lg font-bold tracking-tight">{companyName}</div>
          <div className="ml-auto">
            <Badge className={cn("text-xs capitalize", statusColor(ts.status))} variant="secondary">
              {ts.status}
            </Badge>
          </div>
        </div>

        {/* --- Employee + Week info --- */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-border px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Name:</span>
            {isDraft ? (
              <Input
                value={ts.employeeName}
                onChange={(e) => {
                  // Update employee name inline via status mutation
                  statusMut.mutate({ employeeName: e.target.value });
                }}
                className="h-8 w-48 border-b-1 border-input px-1 font-medium"
                data-testid="input-employee-header"
              />
            ) : (
              <span className="font-medium">{ts.employeeName}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">Weeks of:</span>
            <span className="font-medium text-primary">{fmtWeekRange(weekInfo.start, weekInfo.end)}</span>
          </div>
        </div>

        {/* --- Main table --- */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-timesheet-grid">
            <thead>
              <tr className="border-b-2 border-border bg-muted/60">
                <th className="text-left px-3 py-2.5 font-semibold w-28">Day of the Week</th>
                <th className="text-left px-3 py-2.5 font-semibold w-32">Date</th>
                <th className="text-left px-3 py-2.5 font-semibold w-32">Client</th>
                <th className="text-left px-3 py-2.5 font-semibold w-40">Project</th>
                <th className="text-right px-3 py-2.5 font-semibold w-20">Hour worked</th>
                <th className="text-left px-3 py-2.5 font-semibold">Activities</th>
                {isDraft && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => {
                const isWeekend = !entry.isExtra && (idx === 0 || idx === 6);
                return (
                  <tr
                    key={idx}
                    className={cn(
                      "border-b border-border/40",
                      isWeekend && "bg-muted/20",
                      !isWeekend && idx % 2 === 1 && "bg-muted/10",
                      entry.isExtra && "bg-transparent",
                    )}
                  >
                    <td className="px-3 py-1.5">
                      {entry.isExtra && isDraft ? (
                        <Input
                          value={entry.dayOfWeek}
                          onChange={(e) => updateEntry(idx, "dayOfWeek", e.target.value)}
                          placeholder="—"
                          className="border-0 bg-transparent px-1 h-8 focus-visible:ring-1"
                          data-testid={`input-day-${idx}`}
                        />
                      ) : (
                        <span className={cn("font-medium", !entry.dayOfWeek && "text-transparent")}>
                          {entry.dayOfWeek}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {entry.isExtra && isDraft ? (
                        <Input
                          type="date"
                          value={entry.entryDate}
                          onChange={(e) => updateEntry(idx, "entryDate", e.target.value)}
                          className="border-0 bg-transparent px-1 h-8 focus-visible:ring-1"
                          data-testid={`input-date-${idx}`}
                        />
                      ) : (
                        <span className={cn("text-muted-foreground", !entry.entryDate && "text-transparent")}>
                          {entry.entryDate ? fmtDateShort(new Date(entry.entryDate + "T00:00:00")) : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={entry.clientName}
                        onChange={(e) => updateEntry(idx, "clientName", e.target.value)}
                        placeholder="—"
                        disabled={!isDraft}
                        className="border-0 bg-transparent px-1 h-8 focus-visible:ring-1"
                        data-testid={`input-client-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        value={entry.projectName}
                        onChange={(e) => updateEntry(idx, "projectName", e.target.value)}
                        placeholder="—"
                        disabled={!isDraft}
                        className="border-0 bg-transparent px-1 h-8 focus-visible:ring-1"
                        data-testid={`input-project-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        value={entry.hoursWorked}
                        onChange={(e) => updateEntry(idx, "hoursWorked", e.target.value)}
                        placeholder="0"
                        disabled={!isDraft}
                        className="border-0 bg-transparent px-1 h-8 text-right font-mono focus-visible:ring-1 w-16"
                        data-testid={`input-hours-${idx}`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Textarea
                        value={entry.activities}
                        onChange={(e) => updateEntry(idx, "activities", e.target.value)}
                        placeholder="—"
                        disabled={!isDraft}
                        className="border-0 bg-transparent px-1 py-1 h-8 min-h-0 resize-none focus-visible:ring-1"
                        data-testid={`input-activities-${idx}`}
                      />
                    </td>
                    {isDraft && (
                      <td className="px-1 py-1.5">
                        {entry.isExtra && (
                          <button
                            onClick={() => removeRow(idx)}
                            className="text-muted-foreground/40 hover:text-destructive transition"
                            data-testid={`button-remove-row-${idx}`}
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/50">
                <td colSpan={3} className="px-3 py-2.5" />
                <td className="px-3 py-2.5 text-right font-bold uppercase tracking-wide" data-testid="text-total-label">
                  Total
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-base" data-testid="text-total-hours">
                  {totalHours}
                </td>
                <td colSpan={isDraft ? 2 : 1} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* --- Add row button (draft only) --- */}
        {isDraft && (
          <div className="px-6 py-2 border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={addRow} data-testid="button-add-row">
              <Plus className="size-4" /> Add Row
            </Button>
          </div>
        )}

        {/* --- Signature section --- */}
        <div className="border-t-2 border-border bg-muted/20 px-6 py-5">
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
                          if (val.trim()) {
                            statusMut.mutate({
                              employeeSignature: val.trim(),
                              status: "submitted",
                            });
                          }
                        }
                      }}
                      data-testid="input-employee-signature"
                      className="border-0 bg-transparent px-0 h-7 text-lg"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("emp-sig") as HTMLInputElement;
                      if (input?.value.trim()) {
                        statusMut.mutate({
                          employeeSignature: input.value.trim(),
                          status: "submitted",
                        });
                      }
                    }}
                    data-testid="button-sign-submit"
                  >
                    Sign & Submit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSigning(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!isDraft}
                  onClick={() => setSigning("employee")}
                  data-testid="button-sign-employee"
                >
                  <FileText className="size-4" /> Sign
                </Button>
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
                          if (val.trim()) {
                            statusMut.mutate({
                              managerSignature: val.trim(),
                              status: "approved",
                            });
                          }
                        }
                      }}
                      data-testid="input-manager-signature"
                      className="border-0 bg-transparent px-0 h-7 text-lg"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      const input = document.getElementById("mgr-sig") as HTMLInputElement;
                      if (input?.value.trim()) {
                        statusMut.mutate({
                          managerSignature: input.value.trim(),
                          status: "approved",
                        });
                      }
                    }}
                    data-testid="button-approve"
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      statusMut.mutate({ status: "rejected" });
                    }}
                  >
                    <X className="size-4" /> Reject
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSigning(null)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ) : isSubmitted ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSigning("manager")}
                  data-testid="button-sign-manager"
                >
                  <FileText className="size-4" /> Sign to Approve
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground border-b border-border/40 pb-1">
                  {isApproved ? "Approved" : isRejected ? "Rejected" : "Awaiting employee submission"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Notes --- */}
        {ts.notes && (
          <div className="border-t border-border px-6 py-3 bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</div>
            <div className="text-sm">{ts.notes}</div>
          </div>
        )}

        {/* --- Delete (draft only) --- */}
        {isDraft && (
          <div className="flex justify-end px-6 py-3 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive"
              data-testid="button-delete-timesheet"
            >
              <Trash2 className="size-4" /> Delete Timesheet
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
