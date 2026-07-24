import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock } from "lucide-react";
import type { Task, TeamMember } from "@shared/schema";
import { Avatar, PriorityBadge } from "@/components/bits";
import { shortDate, isOverdue } from "@/lib/format";
import { useUpdateTaskStatus } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Task Board — a kanban view of tasks grouped by status.
 * Drag a card between columns to change its status.
 */

type Status = "Not Started" | "In Progress" | "Blocked" | "Complete";

const COLUMNS: { status: Status; label: string; icon: typeof Circle; accent: string }[] = [
  { status: "Not Started", label: "Not Started", icon: Circle, accent: "text-muted-foreground" },
  { status: "In Progress", label: "In Progress", icon: Clock, accent: "text-primary" },
  { status: "Blocked", label: "Blocked", icon: AlertTriangle, accent: "text-red-500" },
  { status: "Complete", label: "Complete", icon: CheckCircle2, accent: "text-emerald-500" },
];

export function TaskBoard({
  tasks,
  team,
  projects,
  onCardClick,
}: {
  tasks: Task[];
  team: Map<number, TeamMember>;
  projects?: { id: number; name: string }[];
  onCardClick?: (t: Task) => void;
}) {
  const update = useUpdateTaskStatus();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const projectName = (id: number) => projects?.find((p) => p.id === id)?.name;

  function onDrop(status: Status) {
    if (draggedId == null) return;
    const task = tasks.find((t) => t.id === draggedId);
    setDragOver(null);
    setDraggedId(null);
    if (!task || task.status === status) return;
    update.mutate({ id: task.id, status });
    toast({ title: "Task moved", description: `${task.title} → ${status}` });
  }

  const grouped = new Map<Status, Task[]>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const t of tasks) {
    // Fall back to Not Started for any unknown status so nothing is dropped from the board.
    const bucket = (COLUMNS.find((c) => c.status === t.status)?.status ?? "Not Started") as Status;
    grouped.get(bucket)!.push(t);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = grouped.get(col.status)!;
        const Icon = col.icon;
        const isOver = dragOver === col.status;
        return (
          <div
            key={col.status}
            data-testid={`board-col-${col.status.toLowerCase().replace(/\s+/g, "-")}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOver !== col.status) setDragOver(col.status);
            }}
            onDragLeave={() => {
              if (dragOver === col.status) setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(col.status);
            }}
            className={cn(
              "flex min-h-[400px] flex-col rounded-lg border border-border bg-muted/20 p-3 transition-colors",
              isOver && "border-primary bg-primary/5",
            )}
          >
            <div className="mb-3 flex items-center gap-2 px-1">
              <Icon className={cn("size-4", col.accent)} />
              <h3 className="text-sm font-semibold">{col.label}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {items.map((t) => {
                const a = t.assigneeId ? team.get(t.assigneeId) : undefined;
                const overdue = isOverdue(t.dueDate) && t.status !== "Complete";
                return (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOver(null);
                    }}
                    onClick={(e) => {
                      if (draggedId != null) return;
                      const target = e.target as HTMLElement;
                      if (target.closest("button, a, [role='button'], [role='combobox']")) return;
                      onCardClick?.(t);
                    }}
                    data-testid={`board-card-${t.id}`}
                    className={cn(
                      "select-none rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
                      onCardClick ? "cursor-pointer" : "cursor-grab",
                      draggedId === t.id && "opacity-40",
                    )}
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium leading-snug">{t.title}</h4>
                        {projects && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {projectName(t.projectId) ?? "—"}
                          </p>
                        )}
                      </div>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{t.trade}</span>
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          overdue && "font-medium text-red-500",
                        )}
                      >
                        {shortDate(t.dueDate)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {a ? (
                        <>
                          <Avatar initials={a.initials} color={a.color} size={20} />
                          <span className="truncate text-xs text-muted-foreground">
                            {a.name.split(" ")[0]}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                  </article>
                );
              })}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border/50 px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
