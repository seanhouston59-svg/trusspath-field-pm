import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ShieldAlert, Wrench, HelpCircle, AlertOctagon, MapPin, Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-data";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Field observation quick-capture. Four kinds:
 *   - safety: near miss, unsafe condition
 *   - quality: workmanship issue, spec deviation
 *   - rfi:     "why is this drawing showing X when the field shows Y?"
 *   - issue:   generic problem log
 *
 * Severity: low / normal / high / urgent.
 *
 * Same offline pattern as timecard: try POST first, queue on failure, stable
 * clientId for idempotency.
 */

type Kind = "safety" | "quality" | "rfi" | "issue";
type Severity = "low" | "normal" | "high" | "urgent";

const KINDS: { value: Kind; label: string; Icon: typeof ShieldAlert; tone: string }[] = [
  { value: "safety", label: "Safety", Icon: ShieldAlert, tone: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
  { value: "quality", label: "Quality", Icon: Wrench, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { value: "rfi", label: "RFI", Icon: HelpCircle, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" },
  { value: "issue", label: "Issue", Icon: AlertOctagon, tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
];

const SEVERITIES: { value: Severity; label: string; tone: string }[] = [
  { value: "low", label: "Low", tone: "border-border" },
  { value: "normal", label: "Normal", tone: "border-border" },
  { value: "high", label: "High", tone: "border-amber-500/40 bg-amber-500/5" },
  { value: "urgent", label: "Urgent", tone: "border-red-500/50 bg-red-500/5" },
];

async function getCoords(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { lat: number; lng: number; accuracyM: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const t = setTimeout(() => finish(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); },
      () => { clearTimeout(t); finish(null); },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 30_000 },
    );
  });
}

export default function FieldObservation() {
  const [, navigate] = useLocation();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();

  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [kind, setKind] = useState<Kind>("safety");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const submit = async () => {
    if (submitting) return;
    const t = title.trim();
    if (!t) {
      toast({ title: "Add a short title", variant: "destructive" });
      return;
    }
    if (projectId == null) {
      toast({ title: "Pick a project", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const coords = await getCoords();
      const clientId = `obs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = {
        projectId,
        kind,
        severity,
        title: t,
        body: body.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accuracyM: coords?.accuracyM ?? null,
        occurredAt: new Date().toISOString(),
        clientId,
      };
      localStorage.setItem("trusspath.field.lastProjectId", String(projectId));

      if (online) {
        try {
          const resp = await fetch("/api/field/observations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          toast({ title: "Observation logged", description: t });
          resetAll();
          return;
        } catch { /* fall through to queue */ }
      }

      await queueRequest({
        kind: "observation",
        url: "/api/field/observations",
        method: "POST",
        body: payload,
        meta: { projectId, obsKind: kind, severity },
      });
      toast({ title: "Saved offline", description: "We'll sync when you're back online." });
      resetAll();
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setTitle("");
    setBody("");
    setSeverity("normal");
  };

  return (
    <Layout title="Observation">
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
          <div className="grid size-10 place-items-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <ShieldAlert className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Observation</h1>
            <p className="text-xs text-muted-foreground">Log a safety, quality, RFI, or issue in seconds</p>
          </div>
        </div>

        <div className="mt-6">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
          <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
            <SelectTrigger data-testid="field-obs-project" className="h-12 text-base">
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kind picker */}
        <div className="mt-5">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Kind</Label>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map(({ value, label, Icon, tone }) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  "flex h-16 items-center gap-3 rounded-xl border-2 px-3 text-left font-semibold transition",
                  kind === value ? `${tone} border-current` : "border-border bg-card hover:bg-accent",
                )}
                data-testid={`field-obs-kind-${value}`}
              >
                <Icon className="size-6 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Severity picker */}
        <div className="mt-5">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Severity</Label>
          <div className="grid grid-cols-4 gap-2">
            {SEVERITIES.map(({ value, label, tone }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg border-2 text-sm font-bold transition",
                  severity === value ? `${tone} ring-2 ring-primary` : `${tone} bg-card hover:bg-accent`,
                )}
                data-testid={`field-obs-severity-${value}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="mt-5">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Missing handrail on scaffold, level 3"
            className="h-12 text-base"
            maxLength={200}
            data-testid="field-obs-title"
          />
        </div>

        {/* Details */}
        <div className="mt-5">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Details (optional)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Anything else worth noting?"
            className="min-h-[120px] text-base"
            maxLength={2000}
            data-testid="field-obs-body"
          />
        </div>

        {/* Sticky submit */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || projectId == null || !title.trim()}
              className="h-14 w-full text-base font-bold"
              data-testid="field-obs-save"
            >
              {submitting ? (
                <><Loader2 className="size-5 animate-spin" /> Saving…</>
              ) : online ? (
                <><CheckCircle2 className="size-5" /> Log observation</>
              ) : (
                <><WifiOff className="size-5" /> Save offline</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
