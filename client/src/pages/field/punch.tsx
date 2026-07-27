import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ClipboardList, Loader2, CheckCircle2, WifiOff, Circle, CheckCircle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-data";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PunchItem } from "@shared/schema";

/**
 * Field punch item flow. Two things in one page:
 *   1. Add a new punch item (title + location + trade)
 *   2. Close nearby open items on this project (tap a row to toggle Complete)
 *
 * Adds go to /api/field/punch-items (with clientId dedupe). Closes go to
 * /api/punch/:id/status. Both are queued when offline.
 *
 * Design leans on the pattern we've been using: chunky trade tiles, big save
 * bar, keeps the last picked project in localStorage.
 */

const TRADES = [
  "General", "Concrete", "Framing", "Drywall", "Electrical",
  "Plumbing", "HVAC", "Paint", "Flooring", "Roofing",
];

export default function FieldPunch() {
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();

  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [closingIds, setClosingIds] = useState<Set<number>>(new Set());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => subscribeQueue(setQueueSize), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    if (projectId == null && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  useEffect(() => {
    if (projectId == null) return;
    void loadItems(projectId);
  }, [projectId]);

  const loadItems = async (pid: number) => {
    setLoadingItems(true);
    try {
      const resp = await fetch(`/api/punch?projectId=${pid}`, { credentials: "include" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: PunchItem[] = await resp.json();
      // Open items first, then most recent
      const sorted = [...data].sort((a, b) => {
        const aOpen = a.status !== "Complete" && a.status !== "complete" && a.status !== "closed" ? 1 : 0;
        const bOpen = b.status !== "Complete" && b.status !== "complete" && b.status !== "closed" ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return b.id - a.id;
      });
      setItems(sorted);
    } catch {
      // If offline or 401 during a bg refresh, just leave existing items.
    } finally {
      setLoadingItems(false);
    }
  };

  const add = async () => {
    if (submitting) return;
    const t = title.trim();
    if (!t) {
      toast({ title: "Add a title", variant: "destructive" });
      return;
    }
    if (projectId == null) return;
    setSubmitting(true);
    try {
      const clientId = `pi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = {
        projectId,
        title: t,
        location: location.trim(),
        trade,
        status: "Open",
        clientId,
      };
      localStorage.setItem("trusspath.field.lastProjectId", String(projectId));

      if (online) {
        try {
          const resp = await fetch("/api/field/punch-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data?.punchItem) setItems((prev) => [data.punchItem, ...prev]);
          toast({ title: "Punch item added", description: t });
          resetForm();
          return;
        } catch { /* fall through */ }
      }

      await queueRequest({
        kind: "punch-item",
        url: "/api/field/punch-items",
        method: "POST",
        body: payload,
        meta: { projectId, title: t },
      });
      // Optimistic UI \u2014 push a placeholder so the field crew sees it right away.
      setItems((prev) => [
        {
          id: -Date.now(), // negative id so it can't collide with a server id
          projectId,
          title: t,
          location: location.trim(),
          trade,
          status: "Open",
          assigneeId: null,
        } as PunchItem,
        ...prev,
      ]);
      toast({ title: "Saved offline", description: "We'll create the punch item when you're back online." });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleClose = async (item: PunchItem) => {
    if (closingIds.has(item.id) || item.id < 0) return; // ignore optimistic offline rows
    const isOpen = item.status !== "Complete" && item.status !== "complete" && item.status !== "closed";
    const nextStatus = isOpen ? "Complete" : "Open";
    setClosingIds((s) => new Set(s).add(item.id));
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: nextStatus } : p)));
    try {
      if (online) {
        try {
          const resp = await fetch(`/api/punch/${item.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: nextStatus }),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          return;
        } catch { /* fall through */ }
      }
      await queueRequest({
        kind: "punch-status",
        url: `/api/punch/${item.id}/status`,
        method: "PATCH",
        body: { status: nextStatus },
        meta: { punchItemId: item.id, nextStatus },
      });
      toast({ title: "Status change queued", description: "Will sync when back online." });
    } finally {
      setClosingIds((s) => {
        const n = new Set(s);
        n.delete(item.id);
        return n;
      });
    }
  };

  const resetForm = () => {
    setTitle("");
    setLocation("");
    setTrade("General");
  };

  const isItemOpen = (item: PunchItem) => item.status !== "Complete" && item.status !== "complete" && item.status !== "closed";

  return (
    <Layout title="Punch">
      <div className="mx-auto max-w-2xl pb-32">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/field" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Field
          </Link>
          <div className="flex items-center gap-2">
            {!online && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <WifiOff className="size-3.5" /> Offline
              </span>
            )}
            {queueSize > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                {queueSize} pending
              </span>
            )}
          </div>
        </div>

        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Punch</h1>
            <p className="text-xs text-muted-foreground">Add an item or close what's done</p>
          </div>
        </div>

        {/* Project */}
        <div className="mt-6">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
          <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
            <SelectTrigger data-testid="field-punch-project" className="h-12 text-base">
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Add new */}
        <div className="mt-6 rounded-2xl border-2 border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Add item</h2>
          <div>
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Paint touch-up on north wall"
              className="h-12 text-base"
              maxLength={200}
              data-testid="field-punch-title"
            />
          </div>
          <div className="mt-3">
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Level 2, corridor A"
              className="h-11 text-base"
              maxLength={200}
              data-testid="field-punch-location"
            />
          </div>
          <div className="mt-3">
            <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Trade</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {TRADES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTrade(t)}
                  className={cn(
                    "h-11 rounded-lg border-2 px-2 text-sm font-semibold transition",
                    trade === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent",
                  )}
                  data-testid={`field-punch-trade-${t.toLowerCase()}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={add}
            disabled={submitting || projectId == null || !title.trim()}
            className="mt-4 h-12 w-full text-base font-bold"
            data-testid="field-punch-add"
          >
            {submitting ? (
              <><Loader2 className="size-5 animate-spin" /> Adding…</>
            ) : online ? (
              <><CheckCircle2 className="size-5" /> Add punch item</>
            ) : (
              <><WifiOff className="size-5" /> Save offline</>
            )}
          </Button>
        </div>

        {/* Existing items */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">On this project</h2>
            <span className="text-xs text-muted-foreground">
              {items.filter(isItemOpen).length} open · {items.length} total
            </span>
          </div>
          {loadingItems && items.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No punch items yet. Add one above.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {items.slice(0, 30).map((item) => {
                const open = isItemOpen(item);
                const isClosing = closingIds.has(item.id);
                const isOptimistic = item.id < 0;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleClose(item)}
                      disabled={isClosing || isOptimistic}
                      className={cn(
                        "flex w-full items-start gap-3 p-3 text-left transition",
                        open ? "hover:bg-accent" : "opacity-60 hover:opacity-100 hover:bg-accent",
                      )}
                      data-testid={`field-punch-item-${item.id}`}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-current">
                        {isClosing ? (
                          <Loader2 className="size-5 animate-spin" />
                        ) : open ? (
                          <Circle className="size-5 text-muted-foreground" />
                        ) : (
                          <CheckCircle className="size-5 text-emerald-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("font-semibold leading-tight", !open && "line-through")}>
                          {item.title}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>{item.trade}</span>
                          {item.location && <><span>·</span><span>{item.location}</span></>}
                          {isOptimistic && <><span>·</span><span className="text-amber-600 dark:text-amber-400">Pending sync</span></>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
