import { type ReactNode, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

/**
 * Generic kanban board — one component for every workflow (RFIs, Submittals,
 * Change Orders, Action Items, etc.). Renders columns, handles drag-and-drop,
 * and calls a caller-supplied mutate/label mapping to update status.
 *
 * The caller provides:
 * - items: the full list to render
 * - columns: [{ status, label, icon, accent }]
 * - getStatus: read the status field off an item (varies by entity)
 * - getId: read the primary key off an item
 * - mutate: called on drop with (id, newStatus)
 * - renderCard: caller renders the card body for full flexibility
 * - entityLabel: for the toast ("RFI moved", etc.)
 * - entityTitle: how to describe the moved item in the toast body
 * - idPrefix: used in data-testid to keep tests independent per board
 */

export type BoardColumn<S extends string> = {
  status: S;
  label: string;
  icon: LucideIcon;
  accent: string;
};

export function GenericBoard<T, S extends string>({
  items,
  columns,
  getStatus,
  getId,
  mutate,
  renderCard,
  entityLabel,
  entityTitle,
  idPrefix,
  columnClassName,
  onCardClick,
}: {
  items: T[];
  columns: BoardColumn<S>[];
  getStatus: (item: T) => string;
  getId: (item: T) => number;
  mutate: (args: { id: number; status: S }) => void;
  renderCard: (item: T) => ReactNode;
  entityLabel: string;
  entityTitle: (item: T) => string;
  idPrefix: string;
  columnClassName?: string;
  onCardClick?: (item: T) => void;
}) {
  const { toast } = useToast();
  const [dragOver, setDragOver] = useState<S | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  function onDrop(status: S) {
    if (draggedId == null) return;
    const item = items.find((x) => getId(x) === draggedId);
    setDragOver(null);
    setDraggedId(null);
    if (!item || getStatus(item) === status) return;
    mutate({ id: getId(item), status });
    toast({ title: `${entityLabel} moved`, description: `${entityTitle(item)} → ${status}` });
  }

  // Group items by column status, falling back to the first column so nothing is dropped.
  const fallback = columns[0].status;
  const grouped = new Map<S, T[]>();
  for (const col of columns) grouped.set(col.status, []);
  for (const it of items) {
    const cur = getStatus(it) as S;
    const bucket = grouped.has(cur) ? cur : fallback;
    grouped.get(bucket)!.push(it);
  }

  return (
    <div className={cn("grid grid-cols-1 gap-4", columnClassName ?? "md:grid-cols-2 xl:grid-cols-4")}>
      {columns.map((col) => {
        const cards = grouped.get(col.status)!;
        const Icon = col.icon;
        const isOver = dragOver === col.status;
        const colKey = String(col.status).toLowerCase().replace(/\s+/g, "-");
        return (
          <div
            key={String(col.status)}
            data-testid={`${idPrefix}-col-${colKey}`}
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
                const id = getId(it);
                return (
                  <article
                    key={id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedId(id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOver(null);
                    }}
                    onClick={(e) => {
                      // Only fire click if we're not in the middle of a drag
                      if (draggedId != null) return;
                      // Don't fire if the click was inside an interactive child (button, select, link)
                      const target = e.target as HTMLElement;
                      if (target.closest("button, a, [role='button'], input, select, [role='combobox']")) return;
                      onCardClick?.(it);
                    }}
                    data-testid={`${idPrefix}-card-${id}`}
                    className={cn(
                      "select-none rounded-md border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
                      onCardClick ? "cursor-pointer" : "cursor-grab",
                      draggedId === id && "opacity-40",
                    )}
                  >
                    {renderCard(it)}
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
