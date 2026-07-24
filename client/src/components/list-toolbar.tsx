import { LayoutGrid, Rows3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Shared list toolbar — project filter + optional assignee/owner filter,
 * running count, and a Board/Table view toggle.
 *
 * Kept intentionally simple: filters are string keys managed by the parent
 * page (so URL persistence or extra filters can be added without touching
 * this component).
 */

export type View = "table" | "board";

export type SelectOption = { value: string; label: string };

export function ListToolbar({
  projects,
  projectFilter,
  onProjectFilter,
  peopleLabel,
  peopleOptions,
  peopleFilter,
  onPeopleFilter,
  count,
  total,
  view,
  onView,
  countTestId,
}: {
  projects: { id: number; name: string }[];
  projectFilter: string;
  onProjectFilter: (v: string) => void;
  peopleLabel?: string;
  peopleOptions?: SelectOption[];
  peopleFilter?: string;
  onPeopleFilter?: (v: string) => void;
  count: number;
  total: number;
  view: View;
  onView: (v: View) => void;
  countTestId?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select value={projectFilter} onValueChange={onProjectFilter}>
        <SelectTrigger className="h-9 w-[200px]" data-testid="filter-project">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {peopleOptions && onPeopleFilter && (
        <Select value={peopleFilter ?? "all"} onValueChange={onPeopleFilter}>
          <SelectTrigger className="h-9 w-[180px]" data-testid="filter-people">
            <SelectValue placeholder={`All ${peopleLabel ?? "people"}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {peopleLabel ?? "people"}</SelectItem>
            {peopleOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <span className="ml-1 text-xs text-muted-foreground" data-testid={countTestId}>
        {count} of {total}
      </span>

      <div className="ml-auto inline-flex rounded-md border border-border bg-muted/40 p-0.5">
        <button
          type="button"
          onClick={() => onView("board")}
          data-testid="view-board"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
            view === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" /> Board
        </button>
        <button
          type="button"
          onClick={() => onView("table")}
          data-testid="view-table"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
            view === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Rows3 className="size-3.5" /> Table
        </button>
      </div>
    </div>
  );
}
