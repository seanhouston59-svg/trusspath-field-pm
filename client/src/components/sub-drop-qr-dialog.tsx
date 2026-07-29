/**
 * PM-facing QR poster dialog. Opens from the project detail page.
 *
 * Renders a printable QR code that subs scan to reach `/drop/:token`. The QR
 * image is served from api.qrserver.com so we don't need `qrcode` as a new
 * runtime dep \u2014 keeps the bundle small and there's nothing sensitive in a
 * drop token URL (revocable, project-scoped, requires sub sign-in to upload).
 *
 * Also lets the PM manage tokens for the project: mint new ones, list
 * existing, and revoke.
 */
import { useEffect, useState } from "react";
import { Loader2, QrCode, Copy, Trash2, Printer, ExternalLink, Info, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DropTokenRow = {
  id: number;
  token: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

function dropUrlFor(token: string): string {
  // Hash-based route so it survives static hosting + wouter's hash locator.
  return `${window.location.origin}/#/drop/${token}`;
}

function qrImageFor(url: string, size = 400): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(url)}`;
}

// Key used to remember that the PM has already seen the "how it works" panel.
// Bumped if we change the copy meaningfully so returning users see the update.
const PM_HOW_IT_WORKS_SEEN_KEY = "tp.subDropQr.howItWorksSeen.v1";

/**
 * First-open explainer. Auto-expanded the first time a PM opens the QR
 * dialog on this device; collapses into a small "How it works" bar after
 * dismissal. Nothing about this is enforced server-side — it's a UX crutch,
 * not a permission gate, so localStorage is the right storage layer.
 */
function HowItWorksPanel() {
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return typeof window !== "undefined" && !window.localStorage.getItem(PM_HOW_IT_WORKS_SEEN_KEY); }
    catch { return true; }
  });
  function dismiss() {
    try { window.localStorage.setItem(PM_HOW_IT_WORKS_SEEN_KEY, new Date().toISOString()); } catch { /* private mode */ }
    setExpanded(false);
  }
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 text-sm">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 font-medium text-primary">
          <Info className="h-4 w-4" /> How Sub Drop works
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
      </button>
      {expanded ? (
        <div className="space-y-3 border-t border-primary/20 px-3 py-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-slate-700 dark:text-slate-200">
            <li><span className="font-medium">Print the QR</span> — tape it to the trailer wall, gate, or safety board.</li>
            <li><span className="font-medium">Subs scan and register once</span> — company name, trade, email, password. Free for them.</li>
            <li><span className="font-medium">They drop files</span> — COIs, safety docs, shop drawings, photos, invoices. Up to 25 MB each.</li>
            <li><span className="font-medium">TrussPath auto-sorts</span> into folders like Insurance / COIs, Site Photos, Shop Drawings, Financials.</li>
            <li><span className="font-medium">You review</span> in <span className="font-mono text-xs">Sub Uploads</span> — recategorize if needed, mark reviewed, download.</li>
          </ol>
          <div className="rounded-md bg-white/60 p-2 text-xs text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            <span className="font-medium">Tips:</span> mint separate QRs per gate ("Trailer wall", "East entry") to see where subs are dropping from. Revoke a QR if a poster walks off — existing signed-in subs keep access.
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"
            >
              <X className="h-3 w-3" /> Got it
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SubDropQrDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
}) {
  const { toast } = useToast();
  const [tokens, setTokens] = useState<DropTokenRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");

  async function refresh() {
    const res = await apiRequest("GET", `/api/projects/${props.projectId}/drop-tokens`);
    const rows = (await res.json()) as DropTokenRow[];
    setTokens(rows);
  }

  useEffect(() => {
    if (props.open) refresh().catch((e) => toast({ title: "Failed to load tokens", description: e.message, variant: "destructive" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open, props.projectId]);

  async function mint() {
    setBusy(true);
    try {
      await apiRequest("POST", `/api/projects/${props.projectId}/drop-tokens`, { label: label.trim() || null });
      setLabel("");
      await refresh();
    } catch (e: any) {
      toast({ title: "Couldn't create QR", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Revoke this QR code? Anyone who already scanned it can still upload once until they sign out.")) return;
    try {
      await apiRequest("POST", `/api/drop-tokens/${id}/revoke`);
      await refresh();
    } catch (e: any) {
      toast({ title: "Revoke failed", description: e.message, variant: "destructive" });
    }
  }

  const active = (tokens || []).filter(t => !t.revokedAt);
  const featured = active[0]; // Show the most-recently-minted active token big.

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> Sub Drop QR \u2014 {props.projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <HowItWorksPanel />
          <p className="text-sm text-muted-foreground">
            Post this at the jobsite. Subs scan it, register (once), and drop docs and photos.
            Files land in your Sub Uploads inbox, auto-sorted.
          </p>

          {tokens === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading\u2026
            </div>
          ) : featured ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-4">
                <img
                  src={qrImageFor(dropUrlFor(featured.token))}
                  alt="Sub Drop QR Code"
                  className="h-40 w-40 flex-shrink-0 rounded-md border bg-white p-2"
                />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium">{featured.label || "Default QR"}</div>
                  <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                    {dropUrlFor(featured.token)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(dropUrlFor(featured.token));
                        toast({ title: "Link copied" });
                      }}
                    >
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(qrImageFor(dropUrlFor(featured.token), 800), "_blank", "noopener")}
                    >
                      <Printer className="mr-1 h-3.5 w-3.5" /> Print poster
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(dropUrlFor(featured.token), "_blank", "noopener")}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Preview page
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No active QR yet. Create one below.
            </div>
          )}

          {/* Mint a new token */}
          <div className="flex items-end gap-2 border-t pt-4">
            <div className="flex-1">
              <label className="text-xs font-medium uppercase text-muted-foreground">Label (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Trailer wall, East gate"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={mint} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create new QR
            </Button>
          </div>

          {/* Other active + revoked tokens */}
          {tokens && tokens.length > 1 ? (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">All QR codes</h4>
              <ul className="divide-y rounded-md border text-sm">
                {tokens.map(t => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate">
                        {t.label || `QR #${t.id}`}
                        {t.revokedAt ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">Revoked</span> : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {t.lastUsedAt ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}` : "Never used"}
                      </div>
                    </div>
                    {!t.revokedAt ? (
                      <button
                        type="button"
                        onClick={() => revoke(t.id)}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Revoke
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
