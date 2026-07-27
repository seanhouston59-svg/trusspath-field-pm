// Dashboard customization core — types, sensible defaults per role, and the
// react-query hook that reads/writes the per-user layout from the server.
//
// Model:
//   - A widget is identified by a stable string id (registered in
//     dashboard.tsx as WIDGET_REGISTRY).
//   - A layout is an ordered array of { id, size, hidden }. The order is the
//     render order. Hidden items still take a slot so users can toggle them
//     back on quickly without losing their position.
//   - The server column `accounts.dashboard_layout` stores the user's
//     personal layout. When null (fresh signup, or reset), the client uses
//     defaultLayoutForRole(role) so new users see a curated setup.
//   - Unknown ids (dropped in a future release) are filtered out on render
//     so old prefs never crash the dashboard.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type WidgetSize = "sm" | "md" | "lg" | "xl";

export type WidgetPref = {
  id: string;
  size: WidgetSize;
  hidden?: boolean;
};

export type DashboardLayout = {
  widgets: WidgetPref[];
};

// The full menu of dashboard widgets, in the order they SHOULD appear by
// default for a new user. Each entry has a preferred size (sm/md/lg/xl maps
// to a column span in the client grid). See dashboard.tsx for the renderer.
export const DEFAULT_LAYOUT_ALL: WidgetPref[] = [
  { id: "weather",        size: "xl" }, // full-width strip
  { id: "hero",           size: "xl" }, // full-width branded hero
  { id: "kpi-projects",   size: "sm" },
  { id: "kpi-rfis",       size: "sm" },
  { id: "kpi-due",        size: "sm" },
  { id: "kpi-punch",      size: "sm" },
  { id: "notifications",  size: "lg" }, // 2 cols
  { id: "notepad",        size: "sm" }, // 1 col
  { id: "note-wall",      size: "md" }, // sliding tab through the sticky-board notes
  { id: "projects",       size: "lg" }, // 2 cols
  { id: "ops-feed",       size: "sm" }, // 1 col
  { id: "financials",     size: "lg" }, // 2 cols (owner/PM only via roleGate)
  { id: "rfis-list",      size: "sm" }, // 1 col
];

// Role-based defaults. Non-owners get a slimmer view without the financials
// chart (they'd be role-gated out anyway, but skipping it keeps the layout
// clean without dead spots).
export function defaultLayoutForRole(role?: string | null): DashboardLayout {
  const seesMoney = role === "owner" || role === "project-executive" || role === "project-manager";
  const base = DEFAULT_LAYOUT_ALL.filter((w) => {
    if (w.id === "financials") return seesMoney;
    return true;
  });
  return { widgets: base };
}

// New widgets that should be VISIBLE on existing users' dashboards the moment
// they ship, instead of being appended hidden. Reserve for widgets the user
// explicitly asked for so we don't shove random things onto their layouts.
const FORCE_VISIBLE_NEW_IDS = new Set<string>(["note-wall", "fleet-service"]);

// Merge a persisted layout with the current widget catalog so newly-shipped
// widgets show up (appended, hidden) instead of being invisible until the
// user resets. Unknown ids are dropped.
export function mergeWithCatalog(
  persisted: DashboardLayout | null,
  catalogIds: string[],
  fallback: DashboardLayout,
): DashboardLayout {
  if (!persisted || !Array.isArray(persisted.widgets) || persisted.widgets.length === 0) {
    return fallback;
  }
  const known = new Set(catalogIds);
  const seen = new Set<string>();
  const kept: WidgetPref[] = [];
  for (const w of persisted.widgets) {
    if (!known.has(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    kept.push({ id: w.id, size: w.size ?? "md", hidden: !!w.hidden });
  }
  // Append any brand-new widgets the user hasn't seen yet. Force-visible ids
  // are appended visible; everything else defaults to hidden so shipping a
  // new widget doesn't shove itself into every user's dashboard.
  for (const id of catalogIds) {
    if (seen.has(id)) continue;
    const hidden = !FORCE_VISIBLE_NEW_IDS.has(id);
    const size = id === "note-wall" ? "md" : "md";
    kept.push({ id, size, hidden });
  }
  return { widgets: kept };
}

// ------------------------------- Hook -----------------------------------

const LAYOUT_KEY = ["/api/me/dashboard-layout"] as const;

async function fetchLayout(): Promise<DashboardLayout | null> {
  const res = await apiRequest("GET", "/api/me/dashboard-layout");
  if (!res.ok) throw new Error(`layout ${res.status}`);
  const j = await res.json();
  return (j?.layout as DashboardLayout | null) ?? null;
}

async function saveLayout(next: DashboardLayout | null): Promise<DashboardLayout | null> {
  const res = await apiRequest("PUT", "/api/me/dashboard-layout", { layout: next });
  if (!res.ok) throw new Error(`layout save ${res.status}`);
  const j = await res.json();
  return (j?.layout as DashboardLayout | null) ?? null;
}

export function useDashboardLayout() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: LAYOUT_KEY,
    queryFn: fetchLayout,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const save = useMutation({
    mutationFn: (next: DashboardLayout | null) => saveLayout(next),
    // Optimistic — the customize UI feels instant even on slow links.
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: LAYOUT_KEY });
      const prev = qc.getQueryData<DashboardLayout | null>(LAYOUT_KEY);
      qc.setQueryData(LAYOUT_KEY, next);
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(LAYOUT_KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: LAYOUT_KEY });
    },
  });

  return {
    layout: query.data ?? null,
    isLoading: query.isLoading,
    save: save.mutate,
    saveAsync: save.mutateAsync,
    isSaving: save.isPending,
    reset: () => save.mutate(null),
  };
}
