import { useState } from "react";
import { CheckCircle2, Circle, Clock, MapPin } from "lucide-react";
import type { PunchItem, TeamMember } from "@shared/schema";
import { Avatar } from "@/components/bits";
import { useUpdatePunchStatus } from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Punch Board — kanban view of punch items grouped by status.
 * Drag a card between columns (Open / In Progress / Complete) to update status.
 */

type Status = "Open" | "In Progress" | "Complete";

const COLUMNS: { status: Status; label: string; icon: typeof Circle; accent: string }[] = [
  { status: "Open", label: "Open", icon: Circle, accent: "text-amber-500" },
  { status: "In Progress", label: "In Progress", icon: Clock, accent: "text-primary" },
  { status: "Complete", label: "Complete", icon: CheckCircle2, accent: "text-emerald-500" },
];

export function PunchBoard({
  items,
  team,
  projects,
}: {
  items: PunchItem[];
  team: Map<number, TeamMember>;
  projects?: { id: number; name: string }[];
}) {
  const update = useUpdatePunchStatus();
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const projectName = (id: number) => projects?.find((p) => p.id === id)?.name;

  function onDrop(status: Status) {
    if (draggedId == null) return;
    const item = items.find((t) => t.id === draggedId);
    setDragOver(null);
    setDraggedId(null);
    if (!item || item.status === status) return;
    update.mutate({ id: item.id, status });
    toast({ title: "Punch item moved", description: `${item.title} → ${status}` });
  }

  const grouped = new Map<Status, PunchItem[]>();
  for (const col of COLUMNS) grouped.set(col.status, []);
  for (const it of items) {
    const bucket = (COLUMNS.find((c) => c.status === it.status)?.status ?? "Open") as Status;
    grouped.get(bucket)!.push(it);
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {COLUMNS.map((col) => {
        const cards = grouped.get(col.status)!;
        const Icon = col.icon;
        const isOver = dragOver === col.status;
        return (
          <div
            key={col.status}
            data-testid={`punch-col-${col.status.toLowerCase().replace(/\s+/g, "-")}`}
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
                {cards.length}
              </span>
            </div>
            <div className="flex-1 space-y-2">
              {cards.map((it) => {
                const a = it.assigneeId ? team.get(it.assigneeId) : undefined;
                return (
                  <article
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(it.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOver(null);
                    }}
                    data-testid={`punch-card-${it.id}`}
                    className={cn(
                      "cursor-grab select-none rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
                      draggedId === it.id && "opacity-40",
                    )}
                  >
                    <h4 className="text-sm font-medium leading-snug">{it.title}</h4>
                    {projects && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {projectName(it.projectId) ?? "—"}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">{it.location}</span>
                      <span className="mx-1 shrink-0 opacity-50">·</span>
                      <span className="truncate">{it.trade}</span>
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
              {cards.length === 0 && (
                <div className="rounded-md border border-dashed border-border/50 px-3 py-6 text-center text-[11px] text-muted-foreground">
                  Drop items here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
