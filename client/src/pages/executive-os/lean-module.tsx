/**
 * Shared page for the 19 lean Executive OS lifecycle modules (4-22).
 *
 * The same component renders both the portfolio (list of projects, each with a
 * row-count summary) and the detail (single project, editable state + item
 * list) depending on which prop is passed. App.tsx wires 38 route entries at
 * `/executive-os/:slug` and `/executive-os/:slug/:id` to this component.
 *
 * When any module graduates to a purpose-built schema (like Pre-Con did), swap
 * that module's route mapping over to its own portfolio/detail pages and
 * remove its slug from LEAN_MODULES in shared/lean-modules-catalog.ts.
 */
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Trash2,
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
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";
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
      href={`/executive-os/${moduleId}/${project.id}`}
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

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");

  const items = useMemo(() => data?.items ?? [], [data]);
  const state = data?.state ?? null;

  if (!def) return null;

  return (
    <Layout title={def.title}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href={`/executive-os/${moduleId}`}
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
            <CardTitle className="flex items-center justify-between text-base">
              <span>{def.itemNounPlural}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
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

            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : items.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No {def.itemNounPlural.toLowerCase()} yet. Add your first one above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 text-left font-semibold">Title</th>
                      <th className="px-2 py-2 text-left font-semibold">Category</th>
                      <th className="px-2 py-2 text-left font-semibold">Owner</th>
                      <th className="px-2 py-2 text-left font-semibold">Due</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                      <th className="px-2 py-2 text-left font-semibold">Notes</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
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
                          <CellText
                            value={row.ownerName ?? ""}
                            onCommit={(v) =>
                              updateItem.mutate({ id: row.id, patch: { ownerName: v || null } })
                            }
                            placeholder={ghost.itemOwner}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={row.dueDate ?? ""}
                            onChange={(e) =>
                              updateItem.mutate({
                                id: row.id,
                                patch: { dueDate: e.target.value || null },
                              })
                            }
                          />
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
