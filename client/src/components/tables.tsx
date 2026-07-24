import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Avatar, TaskStatusBadge, PriorityBadge, RfiStatusBadge, SubmittalStatusBadge, ChangeOrderStatusBadge } from "@/components/bits";
import type { Task, Rfi, PunchItem, DailyLog, TeamMember, Submittal, ChangeOrder, ActionItem } from "@shared/schema";
import { shortDate, relativeDays, isOverdue, formatDate, formatCurrency } from "@/lib/format";
import { useUpdateTaskStatus, useUpdatePunchStatus, useUpdateActionItemStatus } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUSES = ["Not Started", "In Progress", "Blocked", "Complete"];

function StatusSelect({ value, options, onChange, testId }: { value: string; options: string[]; onChange: (v: string) => void; testId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid={testId}
        className="inline-flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
      >
        {value}
        <ChevronDown className="size-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {options.map((o) => (
              <button
                key={o}
                onClick={() => { onChange(o); setOpen(false); }}
                className={cn("block w-full px-3 py-1.5 text-left text-xs hover:bg-muted", o === value && "font-semibold text-primary")}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------- Tasks -------------------------------- */
export function TaskTable({ tasks, team, projects }: { tasks: Task[]; team: Map<number, TeamMember>; projects?: { id: number; name: string }[] }) {
  const update = useUpdateTaskStatus();
  const { toast } = useToast();
  const [q, setQ] = useState("");

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(q.toLowerCase()) || t.trade.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter tasks…"
            data-testid="input-filter-tasks"
            className="h-8 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tasks</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Task</th>
              {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
              <th className="px-4 py-2.5 font-medium">Trade</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
              <th className="px-4 py-2.5 font-medium">Due</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => {
              const a = t.assigneeId ? team.get(t.assigneeId) : undefined;
              const proj = projects?.find((p) => p.id === t.projectId);
              return (
                <tr key={t.id} className="hover:bg-muted/30" data-testid={`row-task-${t.id}`}>
                  <td className="px-4 py-2.5 font-medium">{t.title}</td>
                  {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                  <td className="px-4 py-2.5 text-muted-foreground">{t.trade}</td>
                  <td className="px-4 py-2.5">
                    {a ? (
                      <span className="flex items-center gap-2">
                        <Avatar initials={a.initials} color={a.color} size={24} />
                        <span className="hidden sm:inline">{a.name.split(" ")[0]}</span>
                      </span>
                    ) : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className={cn("px-4 py-2.5 tabular", isOverdue(t.dueDate) && t.status !== "Complete" ? "text-red-500 font-medium" : "text-muted-foreground")}>
                    {shortDate(t.dueDate)}
                    <span className="block text-xs">{relativeDays(t.dueDate)}</span>
                  </td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-4 py-2.5">
                    <StatusSelect
                      value={t.status}
                      options={STATUSES}
                      testId={`select-task-status-${t.id}`}
                      onChange={(v) => {
                        update.mutate({ id: t.id, status: v });
                        toast({ title: "Task updated", description: `${t.title} → ${v}` });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={projects ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">No tasks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- RFIs -------------------------------- */
export function RfiTable({ rfis, team, projects }: { rfis: Rfi[]; team: Map<number, TeamMember>; projects?: { id: number; name: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">#</th>
            <th className="px-4 py-2.5 font-medium">Subject</th>
            {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
            <th className="px-4 py-2.5 font-medium">Assignee</th>
            <th className="px-4 py-2.5 font-medium">Created</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rfis.map((r) => {
            const a = r.assigneeId ? team.get(r.assigneeId) : undefined;
            const proj = projects?.find((p) => p.id === r.projectId);
            return (
              <tr key={r.id} className="hover:bg-muted/30" data-testid={`row-rfi-${r.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{r.number}</td>
                <td className="px-4 py-2.5 font-medium">{r.subject}</td>
                {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                <td className="px-4 py-2.5">
                  {a ? (
                    <span className="flex items-center gap-2">
                      <Avatar initials={a.initials} color={a.color} size={24} />
                      <span className="hidden sm:inline">{a.name.split(" ")[0]}</span>
                    </span>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground tabular">{shortDate(r.dateCreated)}</td>
                <td className={cn("px-4 py-2.5 tabular", isOverdue(r.dueDate) && r.status === "Open" ? "text-red-500 font-medium" : "text-muted-foreground")}>{shortDate(r.dueDate)}</td>
                <td className="px-4 py-2.5"><RfiStatusBadge status={r.status} /></td>
              </tr>
            );
          })}
          {rfis.length === 0 && <tr><td colSpan={projects ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">No RFIs.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- Punch list ----------------------------- */
export function PunchList({ items, team, projects }: { items: PunchItem[]; team: Map<number, TeamMember>; projects?: { id: number; name: string }[] }) {
  const update = useUpdatePunchStatus();
  const { toast } = useToast();
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Item</th>
            {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
            <th className="px-4 py-2.5 font-medium">Location</th>
            <th className="px-4 py-2.5 font-medium">Trade</th>
            <th className="px-4 py-2.5 font-medium">Assignee</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((p) => {
            const a = p.assigneeId ? team.get(p.assigneeId) : undefined;
            const proj = projects?.find((x) => x.id === p.projectId);
            return (
              <tr key={p.id} className="hover:bg-muted/30" data-testid={`row-punch-${p.id}`}>
                <td className="px-4 py-2.5 font-medium">{p.title}</td>
                {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                <td className="px-4 py-2.5 text-muted-foreground">{p.location}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.trade}</td>
                <td className="px-4 py-2.5">
                  {a ? (
                    <span className="flex items-center gap-2">
                      <Avatar initials={a.initials} color={a.color} size={24} />
                      <span className="hidden sm:inline">{a.name.split(" ")[0]}</span>
                    </span>
                  ) : <span className="text-muted-foreground">Unassigned</span>}
                </td>
                <td className="px-4 py-2.5">
                  <StatusSelect
                    value={p.status}
                    options={["Open", "In Progress", "Complete"]}
                    testId={`select-punch-status-${p.id}`}
                    onChange={(v) => {
                      update.mutate({ id: p.id, status: v });
                      toast({ title: "Punch item updated", description: `${p.title} → ${v}` });
                    }}
                  />
                </td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={projects ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">No punch items.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ----------------------------- Daily logs ----------------------------- */
function parseLogPhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function DailyLogList({ logs, team, projects, onEdit, onDelete }: { logs: DailyLog[]; team: Map<number, TeamMember>; projects?: { id: number; name: string }[]; onEdit?: (l: DailyLog) => void; onDelete?: (l: DailyLog) => void }) {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-3">
      {sorted.map((l) => {
        const author = l.authorId ? team.get(l.authorId) : undefined;
        const proj = projects?.find((p) => p.id === l.projectId);
        const photos = parseLogPhotos(l.photos);
        return (
          <div key={l.id} className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid={`row-log-${l.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {author && <Avatar initials={author.initials} color={author.color} size={32} />}
                <div>
                  <div className="text-sm font-semibold">{author?.name ?? "Unknown"} <span className="font-normal text-muted-foreground">· {author?.role}</span></div>
                  <div className="text-xs text-muted-foreground">{formatDate(l.date)}{proj ? ` · ${proj.name}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>🌤 {l.weather} {l.temp}°F</span>
                <span>👥 {l.crewCount} on site</span>
                {photos.length > 0 && <span className="inline-flex items-center gap-1">📷 {photos.length}</span>}
                {onEdit && <button onClick={() => onEdit(l)} className="rounded px-1.5 py-0.5 text-primary hover:bg-primary/10" data-testid={`button-edit-log-${l.id}`}>Edit</button>}
                {onDelete && <button onClick={() => onDelete(l)} className="rounded px-1.5 py-0.5 text-red-500 hover:bg-red-500/10" data-testid={`button-delete-log-${l.id}`}>Delete</button>}
              </div>
            </div>
            <p className="mt-3 text-sm text-foreground/90">{l.summary}</p>
            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded-md border border-border" data-testid={`log-thumb-${l.id}-${i}`}>
                    <img src={src} alt={`Site photo ${i + 1}`} className="size-full object-cover transition hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No daily logs recorded.</p>}
    </div>
  );
}

/* ---------------------------- Submittals ------------------------------ */
export function SubmittalTable({ items, team, projects }: { items: Submittal[]; team: Map<number, TeamMember>; projects?: { id: number; name: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">#</th>
            <th className="px-4 py-2.5 font-medium">Subject</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
            <th className="px-4 py-2.5 font-medium">Assignee</th>
            <th className="px-4 py-2.5 font-medium">Submitted</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((s) => {
            const a = s.assigneeId ? team.get(s.assigneeId) : undefined;
            const proj = projects?.find((p) => p.id === s.projectId);
            return (
              <tr key={s.id} className="hover:bg-muted/30" data-testid={`row-sub-${s.id}`}>
                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{s.number}</td>
                <td className="px-4 py-2.5 font-medium">{s.subject}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.type}</td>
                {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                <td className="px-4 py-2.5">{a ? <span className="flex items-center gap-2"><Avatar initials={a.initials} color={a.color} size={24} /><span className="hidden sm:inline">{a.name.split(" ")[0]}</span></span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-2.5 text-muted-foreground tabular">{shortDate(s.dateSubmitted)}</td>
                <td className={cn("px-4 py-2.5 tabular", isOverdue(s.dueDate) && s.status === "Open" ? "text-red-500 font-medium" : "text-muted-foreground")}>{shortDate(s.dueDate)}</td>
                <td className="px-4 py-2.5"><SubmittalStatusBadge status={s.status} /></td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={projects ? 8 : 7} className="px-4 py-8 text-center text-sm text-muted-foreground">No submittals.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Change orders ---------------------------- */
export function ChangeOrderTable({ items, projects }: { items: ChangeOrder[]; projects?: { id: number; name: string }[] }) {
  const total = items.filter((c) => c.status === "Approved").reduce((s, c) => s + c.amount, 0);
  return (
    <div>
      {projects && <div className="mb-3 text-xs text-muted-foreground">Approved value: <span className="font-semibold tabular text-foreground">{formatCurrency(total)}</span></div>}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">#</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
              <th className="px-4 py-2.5 font-medium text-right">Sched. Impact</th>
              <th className="px-4 py-2.5 font-medium">Issued</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => {
              const proj = projects?.find((p) => p.id === c.projectId);
              return (
                <tr key={c.id} className="hover:bg-muted/30" data-testid={`row-co-${c.id}`}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{c.number}</td>
                  <td className="px-4 py-2.5 font-medium">{c.title}</td>
                  {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                  <td className="px-4 py-2.5 text-right font-semibold tabular">{formatCurrency(c.amount)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{c.scheduleImpact > 0 ? `+${c.scheduleImpact}d` : "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular">{shortDate(c.dateIssued)}</td>
                  <td className="px-4 py-2.5"><ChangeOrderStatusBadge status={c.status} /></td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={projects ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">No change orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------- Action items ---------------------------- */
export function ActionItemTable({ items, projects }: { items: ActionItem[]; projects?: { id: number; name: string }[] }) {
  const update = useUpdateActionItemStatus();
  const { toast } = useToast();
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Action item</th>
            {projects && <th className="px-4 py-2.5 font-medium">Project</th>}
            <th className="px-4 py-2.5 font-medium">Owner</th>
            <th className="px-4 py-2.5 font-medium">Source</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
            <th className="px-4 py-2.5 font-medium">Priority</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((a) => {
            const proj = projects?.find((p) => p.id === a.projectId);
            return (
              <tr key={a.id} className="hover:bg-muted/30" data-testid={`row-ai-${a.id}`}>
                <td className="px-4 py-2.5 font-medium">{a.title}</td>
                {projects && <td className="px-4 py-2.5 text-muted-foreground">{proj?.name ?? "—"}</td>}
                <td className="px-4 py-2.5 text-muted-foreground">{a.owner}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{a.source}</td>
                <td className={cn("px-4 py-2.5 tabular", isOverdue(a.dueDate) && a.status !== "Complete" ? "text-red-500 font-medium" : "text-muted-foreground")}>{shortDate(a.dueDate)}<span className="block text-xs">{relativeDays(a.dueDate)}</span></td>
                <td className="px-4 py-2.5"><PriorityBadge priority={a.priority} /></td>
                <td className="px-4 py-2.5">
                  <StatusSelect value={a.status} options={["Open", "In Progress", "Complete"]} testId={`select-ai-status-${a.id}`} onChange={(v) => { update.mutate({ id: a.id, status: v }); toast({ title: "Action item updated", description: `${a.title} → ${v}` }); }} />
                </td>
              </tr>
            );
          })}
          {items.length === 0 && <tr><td colSpan={projects ? 7 : 6} className="px-4 py-8 text-center text-sm text-muted-foreground">No action items.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
