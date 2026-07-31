/**
 * Shared page for the 19 lean Command Deck lifecycle modules (4-22).
 *
 * The same component renders both the portfolio (list of projects, each with a
 * row-count summary) and the detail (single project, editable state + item
 * list) depending on which prop is passed. App.tsx wires 38 route entries at
 * `/command-deck/:slug` and `/command-deck/:slug/:id` to this component.
 *
 * When any module graduates to a purpose-built schema (like Pre-Con did), swap
 * that module's route mapping over to its own portfolio/detail pages and
 * remove its slug from LEAN_MODULES in shared/lean-modules-catalog.ts.
 */
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeanItemPasteDialog } from "@/components/command-deck/lean-item-paste-dialog";
import { LeanItemAttachmentsButton } from "@/components/command-deck/lean-item-attachments-button";
import { cn } from "@/lib/utils";
import type { LeanModuleItem, Project, TeamMember } from "@shared/schema";
import { useTeam } from "@/hooks/use-data";
import {
  LEAN_MODULE_ITEM_STATUSES,
  LEAN_MODULE_STATE_STATUSES,
  getLeanModuleDef,
  getLeanModulePlaceholders,
} from "@shared/lean-modules-catalog";
import {
  useCreateLeanModuleItem,
  useDeleteLeanModuleItem,
  useLeanModule,
  useUpdateLeanModuleItem,
  useUpdateLeanModuleState,
} from "@/hooks/use-lean-modules";

const STATE_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  approved: "Approved",
  complete: "Complete",
  on_hold: "On hold",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  on_hold: "On hold",
  at_risk: "At risk",
  n_a: "N/A",
};

const STATE_STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  ready_for_review: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  approved: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
  on_hold: "bg-slate-500/12 text-slate-600 dark:text-slate-400 ring-slate-500/25",
};

const ITEM_STATUS_STYLES: Record<string, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-blue-600 dark:text-blue-400",
  complete: "text-emerald-600 dark:text-emerald-400",
  on_hold: "text-slate-600 dark:text-slate-400",
  at_risk: "text-red-600 dark:text-red-400",
  n_a: "text-muted-foreground",
};

/* -------------------------------- Portfolio ------------------------------- */

function StatePill({ status }: { status: string | null | undefined }) {
  const key = status || "not_started";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATE_STATUS_STYLES[key] ?? STATE_STATUS_STYLES.not_started,
      )}
    >
      {STATE_STATUS_LABELS[key] ?? key}
    </span>
  );
}

function PortfolioProjectRow({ moduleId, project }: { moduleId: string; project: Project }) {
  const { data, isLoading } = useLeanModule(project.id, moduleId);
  const state = data?.state;
  const items = data?.items ?? [];
  const openItems = items.filter((i) => i.status !== "complete" && i.status !== "n_a").length;
  return (
    <Link
      href={`/command-deck/${moduleId}/${project.id}`}
      className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
      data-testid={`lean-${moduleId}-card-${project.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-sm font-bold">{project.name}</span>
          {isLoading ? (
            <Skeleton className="h-5 w-24 rounded-full" />
          ) : (
            <StatePill status={state?.status} />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {items.length > 0 && (
            <span>
              {openItems} open · {items.length - openItems} done
            </span>
          )}
          {state?.ownerName && <span>Owner: {state.ownerName}</span>}
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function LeanModulePortfolio({ moduleId }: { moduleId: string }) {
  const def = getLeanModuleDef(moduleId);
  const { data: projects, isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  if (!def) return null;
  return (
    <Layout title={def.title}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">{def.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{def.blurb}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No projects yet. Create a project and this module will be available on it automatically.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <PortfolioProjectRow key={p.id} moduleId={moduleId} project={p} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

/* ---------------------------------- Detail -------------------------------- */

function LeanModuleDetail({ moduleId, projectId }: { moduleId: string; projectId: number }) {
  const def = getLeanModuleDef(moduleId);
  const ghost = getLeanModulePlaceholders(moduleId);
  const { data, isLoading } = useLeanModule(projectId, moduleId);
  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: Number.isFinite(projectId),
  });
  const updateState = useUpdateLeanModuleState(projectId, moduleId);
  const createItem = useCreateLeanModuleItem(projectId, moduleId);
  const updateItem = useUpdateLeanModuleItem(projectId, moduleId);
  const deleteItem = useDeleteLeanModuleItem(projectId, moduleId);
  // Team members feed the per-row assignment picker. Also used by the
  // module-level owner input at the top of the page.
  const { data: team = [] } = useTeam();

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");

  const items = useMemo(() => data?.items ?? [], [data]);
  const state = data?.state ?? null;

  // --- Filter / sort / search state -------------------------------------
  //
  // All client-side: the item list for a single module is bounded (dozens,
  // occasionally low hundreds), so filtering / sorting in the browser is
  // instant and avoids a round-trip on every keystroke.
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [sortKey, setSortKey] = useState<"title" | "category" | "ownerName" | "dueDate" | "status" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: typeof sortKey) => {
    if (!key) return;
    if (sortKey === key) {
      // Same column clicked twice — flip direction. Third click clears sort
      // so users can get back to the default insertion order.
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((row) => {
      if (categoryFilter !== "__all__" && (row.category ?? "") !== categoryFilter) return false;
      if (statusFilter !== "__all__" && (row.status ?? "not_started") !== statusFilter) return false;
      if (!q) return true;
      const hay = `${row.title} ${row.ownerName ?? ""} ${row.notes ?? ""} ${row.category ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    if (!sortKey) return filtered;
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? "") as string;
      const bv = (b[sortKey] ?? "") as string;
      // Blanks sort last regardless of direction — empty owner/due/etc
      // shouldn't hijack the top of the list.
      if (av === "" && bv !== "") return 1;
      if (bv === "" && av !== "") return -1;
      return av.localeCompare(bv) * sign;
    });
  }, [items, search, categoryFilter, statusFilter, sortKey, sortDir]);

  const hasActiveFilter = search.trim() !== "" || categoryFilter !== "__all__" || statusFilter !== "__all__";
  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("__all__");
    setStatusFilter("__all__");
  };

  const SortHeader = ({
    label,
    keyName,
  }: {
    label: string;
    keyName: Exclude<typeof sortKey, null>;
  }) => {
    const active = sortKey === keyName;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(keyName)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 text-left font-semibold hover:bg-muted",
          active && "text-foreground",
        )}
        data-testid={`lean-${moduleId}-sort-${keyName}`}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-primary" : "text-muted-foreground/70")} />
      </button>
    );
  };

  if (!def) return null;

  return (
    <Layout title={def.title}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href={`/command-deck/${moduleId}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to {def.title}
        </Link>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold">
              {def.title}
              {project && <span className="ml-2 text-muted-foreground">· {project.name}</span>}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{def.blurb}</p>
          </div>
        </div>

        {/* Parent state card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>Module Overview</span>
              {state && <StatePill status={state.status} />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <FieldSelect
                    label="Status"
                    value={state?.status ?? "not_started"}
                    onChange={(v) => updateState.mutate({ status: v })}
                    options={LEAN_MODULE_STATE_STATUSES.map((s) => ({
                      value: s,
                      label: STATE_STATUS_LABELS[s] ?? s,
                    }))}
                  />
                  <FieldDate
                    label="Target Start"
                    value={state?.targetStartDate ?? ""}
                    onCommit={(v) => updateState.mutate({ targetStartDate: v || null })}
                  />
                  <FieldDate
                    label="Target Complete"
                    value={state?.targetCompleteDate ?? ""}
                    onCommit={(v) => updateState.mutate({ targetCompleteDate: v || null })}
                  />
                  <FieldText
                    label="Owner"
                    value={state?.ownerName ?? ""}
                    onCommit={(v) => updateState.mutate({ ownerName: v || null })}
                    placeholder={ghost.ownerName}
                  />
                </div>
                <FieldTextarea
                  label="Overview"
                  value={state?.overview ?? ""}
                  onCommit={(v) => updateState.mutate({ overview: v || null })}
                  placeholder={ghost.overview}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FieldTextarea
                    label="Risks"
                    value={state?.risks ?? ""}
                    onCommit={(v) => updateState.mutate({ risks: v || null })}
                    placeholder={ghost.risks}
                  />
                  <FieldTextarea
                    label="Next Steps"
                    value={state?.nextSteps ?? ""}
                    onCommit={(v) => updateState.mutate({ nextSteps: v || null })}
                    placeholder={ghost.nextSteps}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Item list */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>{def.itemNounPlural}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-normal text-muted-foreground">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                <LeanItemPasteDialog
                  projectId={projectId}
                  moduleId={moduleId}
                  itemNounPlural={def.itemNounPlural}
                  currentItemCount={items.length}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Add row */}
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  New {def.itemNoun}
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={ghost.itemTitle}
                  data-testid={`lean-${moduleId}-new-title`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newTitle.trim()) {
                      createItem.mutate({
                        title: newTitle.trim(),
                        category: newCategory || undefined,
                        status: "not_started",
                        sortOrder: items.length,
                      });
                      setNewTitle("");
                      setNewCategory("");
                    }
                  }}
                />
              </div>
              <div className="w-[220px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Category</label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger data-testid={`lean-${moduleId}-new-category`}>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {def.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!newTitle.trim() || createItem.isPending}
                onClick={() => {
                  createItem.mutate({
                    title: newTitle.trim(),
                    category: newCategory || undefined,
                    status: "not_started",
                    sortOrder: items.length,
                  });
                  setNewTitle("");
                  setNewCategory("");
                }}
                data-testid={`lean-${moduleId}-add-btn`}
              >
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>

            {items.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${def.itemNounPlural.toLowerCase()}…`}
                    className="h-9 pl-8 text-sm"
                    data-testid={`lean-${moduleId}-search`}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 w-[170px] text-xs" data-testid={`lean-${moduleId}-filter-category`}>
                    <Filter className="mr-1 size-3" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All categories</SelectItem>
                    {def.categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px] text-xs" data-testid={`lean-${moduleId}-filter-status`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All statuses</SelectItem>
                    {LEAN_MODULE_ITEM_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ITEM_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-9 px-2 text-xs"
                    data-testid={`lean-${moduleId}-clear-filters`}
                  >
                    <X className="mr-1 size-3" />
                    Clear
                  </Button>
                )}
                <span className="text-xs text-muted-foreground">
                  {filteredItems.length}
                  {filteredItems.length !== items.length && ` of ${items.length}`}
                </span>
              </div>
            )}

            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No {def.itemNounPlural.toLowerCase()} yet. Add your first one above.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No {def.itemNounPlural.toLowerCase()} match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 text-left"><SortHeader label="Title" keyName="title" /></th>
                      <th className="px-2 py-2 text-left"><SortHeader label="Category" keyName="category" /></th>
                      <th className="px-2 py-2 text-left"><SortHeader label="Owner" keyName="ownerName" /></th>
                      <th className="px-2 py-2 text-left"><SortHeader label="Due" keyName="dueDate" /></th>
                      <th className="px-2 py-2 text-left"><SortHeader label="Status" keyName="status" /></th>
                      <th className="px-2 py-2 text-left font-semibold">Notes</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-b-0">
                        <td className="px-2 py-2">
                          <CellText
                            value={row.title}
                            onCommit={(v) => updateItem.mutate({ id: row.id, patch: { title: v } })}
                            placeholder={ghost.itemTitle}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={row.category ?? ""}
                            onValueChange={(v) =>
                              updateItem.mutate({ id: row.id, patch: { category: v || null } })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {def.categories.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <OwnerPicker
                            value={row.ownerName ?? ""}
                            team={team}
                            placeholder={ghost.itemOwner}
                            onChange={(v) =>
                              updateItem.mutate({ id: row.id, patch: { ownerName: v || null } })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="date"
                              className={cn(
                                "h-8 text-xs",
                                isRowOverdue(row) &&
                                  "border-red-500/50 text-red-600 dark:text-red-400",
                              )}
                              value={row.dueDate ?? ""}
                              onChange={(e) =>
                                updateItem.mutate({
                                  id: row.id,
                                  patch: { dueDate: e.target.value || null },
                                })
                              }
                            />
                            {isRowOverdue(row) && (
                              <span
                                title="Overdue"
                                className="inline-flex items-center rounded-full bg-red-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400"
                                data-testid={`lean-${moduleId}-overdue-${row.id}`}
                              >
                                <AlertTriangle className="mr-0.5 size-3" />
                                Late
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Select
                            value={row.status ?? "not_started"}
                            onValueChange={(v) =>
                              updateItem.mutate({ id: row.id, patch: { status: v } })
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-8 text-xs font-semibold",
                                ITEM_STATUS_STYLES[row.status ?? "not_started"],
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEAN_MODULE_ITEM_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {ITEM_STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <CellText
                            value={row.notes ?? ""}
                            onCommit={(v) =>
                              updateItem.mutate({ id: row.id, patch: { notes: v || null } })
                            }
                            placeholder={ghost.itemNotes}
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <LeanItemAttachmentsButton
                              projectId={projectId}
                              moduleId={moduleId}
                              itemId={row.id}
                              itemTitle={row.title}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => {
                                if (confirm(`Delete "${row.title}"?`)) {
                                  deleteItem.mutate(row.id);
                                }
                              }}
                              data-testid={`lean-${moduleId}-delete-${row.id}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

/* ---------------------------- Small field widgets ------------------------- */

function FieldText({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  // Sync when parent value changes (e.g. after refetch)
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    setCommitted(value);
    setLocal(value);
  }
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onCommit(local)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldDate({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Input type="date" value={value} onChange={(e) => onCommit(e.target.value)} />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldTextarea({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    setCommitted(value);
    setLocal(value);
  }
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</label>
      <Textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => local !== value && onCommit(local)}
        placeholder={placeholder}
        rows={3}
      />
    </div>
  );
}

/**
 * Owner assignment picker for a lean item row.
 *
 * Behavior:
 * - Shows a Select populated with the org's team members plus a "Custom…"
 *   escape hatch and a "Clear" option.
 * - When the current value matches a team member's name exactly, it renders as
 *   the selected option. Otherwise it renders as `Custom (…)` so the user
 *   can still see and edit the freeform string.
 * - Choosing "Custom…" flips the cell into a plain text input so the user can
 *   type any name (external subs, unlisted people). Blurring the input
 *   commits.
 *
 * Backward-compatible: `ownerName` remains a plain text field in the DB.
 */
function OwnerPicker({
  value,
  team,
  placeholder,
  onChange,
}: {
  value: string;
  team: TeamMember[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  // If the current value doesn't match any team member, default to freeform
  // mode so the user isn't surprised by data disappearing behind a picker.
  const matchesTeam = team.some((m) => m.name === value);
  const [freeform, setFreeform] = useState(!matchesTeam && !!value);
  const [local, setLocal] = useState(value);
  // Keep local input in sync when the row's value changes from elsewhere.
  if (value !== local && !document.activeElement?.classList.contains("owner-picker-input")) {
    // Reset only when not currently typing; avoids clobbering user keystrokes.
  }

  if (freeform) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="owner-picker-input h-8 text-xs"
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => local !== value && onChange(local)}
          autoFocus
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title="Switch back to team picker"
          onClick={() => {
            // Commit any pending edit, then flip back to picker mode.
            if (local !== value) onChange(local);
            setFreeform(false);
          }}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  // Sentinel values — real names can't start with `__`, so these are safe.
  const CLEAR = "__clear__";
  const CUSTOM = "__custom__";

  return (
    <Select
      value={matchesTeam ? value : ""}
      onValueChange={(v) => {
        if (v === CLEAR) {
          onChange("");
          return;
        }
        if (v === CUSTOM) {
          setLocal(value);
          setFreeform(true);
          return;
        }
        onChange(v);
      }}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder={placeholder || "Assign…"}>
          {value || undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {team.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No team members yet.
          </div>
        )}
        {team.map((m) => (
          <SelectItem key={m.id} value={m.name}>
            <span className="flex items-center gap-2">
              <span
                className="inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: m.color }}
              >
                {m.initials}
              </span>
              <span>{m.name}</span>
              <span className="text-muted-foreground">· {m.role}</span>
            </span>
          </SelectItem>
        ))}
        {value && !matchesTeam && (
          // Show the current freeform value so the picker doesn't look empty.
          <SelectItem value={value} disabled>
            Custom: {value}
          </SelectItem>
        )}
        <div className="my-1 border-t" />
        <SelectItem value={CUSTOM}>Custom… (type a name)</SelectItem>
        {value && <SelectItem value={CLEAR}>Clear</SelectItem>}
      </SelectContent>
    </Select>
  );
}

/**
 * A lean item is "overdue" if it has a due date in the past AND it hasn't
 * been closed out. `complete` and `n_a` are terminal states; anything else
 * (including empty status) is treated as still open.
 */
function isRowOverdue(row: LeanModuleItem): boolean {
  if (!row.dueDate) return false;
  if (row.status === "complete" || row.status === "n_a") return false;
  // Compare on YYYY-MM-DD strings — avoids TZ drift from Date parsing.
  const today = new Date().toISOString().slice(0, 10);
  return row.dueDate < today;
}

function CellText({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    setCommitted(value);
    setLocal(value);
  }
  return (
    <Input
      className="h-8 text-xs"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => local !== value && onCommit(local)}
      placeholder={placeholder}
    />
  );
}

/* -------------------------- Route-facing components ----------------------- */

export function LeanModulePortfolioPage({ moduleId }: { moduleId: string }) {
  return <LeanModulePortfolio moduleId={moduleId} />;
}

export function LeanModuleDetailPage({ moduleId }: { moduleId: string }) {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id ?? "", 10);
  if (!Number.isFinite(projectId)) {
    return (
      <Layout title="Not found">
        <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted-foreground">
          Invalid project id.
        </div>
      </Layout>
    );
  }
  return <LeanModuleDetail moduleId={moduleId} projectId={projectId} />;
}
