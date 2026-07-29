/**
 * Per-project Sub Uploads inbox (PM-side).
 *
 * URL: /projects/:id/sub-uploads
 *
 * Two views inside a single Layout:
 *   \u2022 "Inbox" tab \u2014 auto-sorted files grouped by category. Left rail lists
 *     categories with counts; right pane shows the rows for the selected
 *     category. PM can re-categorize, mark reviewed, and download files.
 *   \u2022 "Sub Companies" tab \u2014 directory of subs attached to this project.
 *     PMs can detach a sub from the project or suspend the whole company.
 *
 * Everything here uses apiRequest so we get the same auth/redirect story as
 * every other PM page \u2014 no bespoke fetch code.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Loader2, Download, Search, Check, UserX, RotateCcw, FolderOpen } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/hooks/use-data";
import { SUB_UPLOAD_CATEGORIES, type SubUploadCategory } from "@shared/schema";
import { cn } from "@/lib/utils";

// ---- Types (kept local; server ships plain JSON) --------------------------
type SubUpload = {
  id: number;
  projectId: number;
  subCompanyId: number | null;
  subName: string;
  subCompany: string;
  subTrade: string;
  subPhone: string | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  category: SubUploadCategory;
  categoryConfidence: number;
  status: "new" | "reviewed" | "archived";
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
};

type SubDirectoryRow = {
  joinId: number;
  subCompanyId: number;
  companyName: string;
  trade: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  joinedAt: string;
  suspendedAt: string | null;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubUploadsPage() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id, 10);
  const { data: project } = useProject(projectId);
  const { toast } = useToast();

  const [tab, setTab] = useState<"inbox" | "companies">("inbox");
  const [uploads, setUploads] = useState<SubUpload[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [subs, setSubs] = useState<SubDirectoryRow[] | null>(null);
  const [cat, setCat] = useState<SubUploadCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  async function loadUploads() {
    try {
      const [rowsRes, countsRes] = await Promise.all([
        apiRequest("GET", `/api/sub-uploads?projectId=${projectId}`),
        apiRequest("GET", `/api/sub-uploads/counts?projectId=${projectId}`),
      ]);
      const rows = (await rowsRes.json()) as SubUpload[];
      const c = (await countsRes.json()) as Record<string, number>;
      setUploads(rows);
      setCounts(c);
    } catch (e: any) {
      toast({ title: "Failed to load uploads", description: e.message, variant: "destructive" });
    }
  }
  async function loadSubs() {
    try {
      const res = await apiRequest("GET", `/api/projects/${projectId}/sub-companies`);
      const rows = (await res.json()) as SubDirectoryRow[];
      setSubs(rows);
    } catch (e: any) {
      toast({ title: "Failed to load sub companies", description: e.message, variant: "destructive" });
    }
  }

  useEffect(() => {
    if (!Number.isFinite(projectId)) return;
    loadUploads();
    loadSubs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const visible = useMemo(() => {
    if (!uploads) return [];
    return uploads.filter(u => {
      if (!showArchived && u.status === "archived") return false;
      if (cat !== "all" && u.category !== cat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!u.originalFileName.toLowerCase().includes(q) &&
            !u.subCompany.toLowerCase().includes(q) &&
            !u.subName.toLowerCase().includes(q) &&
            !u.subTrade.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [uploads, cat, search, showArchived]);

  async function patchUpload(id: number, patch: Partial<SubUpload>) {
    try {
      const res = await apiRequest("PATCH", `/api/sub-uploads/${id}`, patch);
      const updated = (await res.json()) as SubUpload;
      setUploads(prev => (prev || []).map(u => u.id === id ? updated : u));
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  }

  if (!project) {
    return <Layout title="Sub Uploads"><div className="flex h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading\u2026</div></Layout>;
  }

  return (
    <Layout title={`${project.name} \u2014 Sub Uploads`}>
      <div className="mb-4 flex items-center gap-1 border-b border-border">
        {(["inbox", "companies"] as const).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors",
              tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "inbox" ? "Inbox" : "Sub Companies"}
          </button>
        ))}
      </div>

      {tab === "inbox" ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          {/* Category rail */}
          <aside className="space-y-1">
            <CategoryRow label="All" count={uploads?.length ?? 0} active={cat === "all"} onClick={() => setCat("all")} />
            {SUB_UPLOAD_CATEGORIES.map(c => (
              <CategoryRow
                key={c}
                label={c}
                count={counts[c] ?? 0}
                active={cat === c}
                onClick={() => setCat(c)}
              />
            ))}
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
          </aside>

          {/* Right pane */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search filename, sub, trade\u2026"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadUploads}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Refresh
              </Button>
            </div>

            {uploads === null ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading uploads\u2026
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                <FolderOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
                {cat === "all" ? "No sub uploads yet. Post a QR code at the jobsite to invite subs." : `Nothing in ${cat} yet.`}
              </div>
            ) : (
              <ul className="divide-y rounded-md border">
                {visible.map(u => (
                  <UploadRow key={u.id} u={u} onPatch={patchUpload} />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <SubCompaniesTab
          projectId={projectId}
          subs={subs}
          reload={loadSubs}
        />
      )}
    </Layout>
  );
}

function CategoryRow(props: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-sm",
        props.active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <span className="truncate">{props.label}</span>
      <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">{props.count}</span>
    </button>
  );
}

function UploadRow(props: {
  u: SubUpload;
  onPatch: (id: number, patch: Partial<SubUpload>) => void;
}) {
  const { u, onPatch } = props;
  const when = new Date(u.createdAt).toLocaleString();
  const [editingCat, setEditingCat] = useState(false);
  return (
    <li className="px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <a
              href={apiUrl(`/api/sub-uploads/${u.id}/file`)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-slate-900 hover:underline dark:text-slate-100"
            >
              {u.originalFileName}
            </a>
            {u.status === "reviewed" ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Reviewed</span>
            ) : null}
            {u.status === "archived" ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Archived</span>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {u.subCompany} \u2014 {u.subTrade} \u2014 {u.subName} \u2022 {formatBytes(u.fileSizeBytes)} \u2022 {when}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <a
            href={apiUrl(`/api/sub-uploads/${u.id}/file`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
          {u.status !== "reviewed" ? (
            <button
              onClick={() => onPatch(u.id, { status: "reviewed" } as any)}
              className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
              title="Mark reviewed"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onPatch(u.id, { status: "new" } as any)}
              className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-muted"
              title="Unmark reviewed"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {/* Category chip / picker */}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sorted as</span>
        {editingCat ? (
          <select
            autoFocus
            value={u.category}
            onChange={(e) => { onPatch(u.id, { category: e.target.value as SubUploadCategory } as any); setEditingCat(false); }}
            onBlur={() => setEditingCat(false)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {SUB_UPLOAD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <button
            onClick={() => setEditingCat(true)}
            className="rounded-full bg-slate-100 px-2 py-0.5 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            {u.category}
          </button>
        )}
        {u.categoryConfidence > 0 ? (
          <span className="text-muted-foreground">({Math.round(u.categoryConfidence * 100)}% confident)</span>
        ) : null}
      </div>
    </li>
  );
}

function SubCompaniesTab(props: {
  projectId: number;
  subs: SubDirectoryRow[] | null;
  reload: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  async function detach(subId: number) {
    if (!confirm("Remove this sub company from this project?")) return;
    setBusy(subId);
    try {
      await apiRequest("POST", `/api/projects/${props.projectId}/sub-companies/${subId}/detach`);
      props.reload();
    } catch (e: any) {
      toast({ title: "Detach failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function suspend(subId: number, suspended: boolean) {
    setBusy(subId);
    try {
      await apiRequest("POST", `/api/sub-companies/${subId}/${suspended ? "unsuspend" : "suspend"}`);
      props.reload();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  if (!props.subs) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading\u2026</div>;
  }
  if (props.subs.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        <UserX className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No sub companies yet. Post the QR code at the jobsite and subs will show up here after their first upload.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {props.subs.map(s => (
        <li key={s.joinId} className="flex items-start justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{s.companyName}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">{s.trade}</span>
              {s.suspendedAt ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">Suspended</span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {s.contactName} \u2014 <a href={`mailto:${s.contactEmail}`} className="hover:underline">{s.contactEmail}</a>
              {s.contactPhone ? <> \u2014 <a href={`tel:${s.contactPhone}`} className="hover:underline">{s.contactPhone}</a></> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => suspend(s.subCompanyId, !!s.suspendedAt)}
              disabled={busy === s.subCompanyId}
            >
              {s.suspendedAt ? "Unsuspend" : "Suspend"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => detach(s.subCompanyId)}
              disabled={busy === s.subCompanyId}
            >
              Remove from project
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
