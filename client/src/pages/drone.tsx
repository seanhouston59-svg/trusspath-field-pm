import { useState } from "react";
import { Plus, Plane, MapPin, Ruler, User, Download, Maximize2, Minimize2, Trash2, UploadCloud, FileWarning } from "lucide-react";
import { Layout } from "@/components/layout";
import { useDroneCaptures, useProjects, useCreateDroneCapture, useDeleteDroneCapture } from "@/hooks/use-data";
import type { DroneCapture } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { apiUrl } from "@/lib/queryClient";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CAPTURE_META: Record<string, { glyph: string; tint: string }> = {
  Orthomosaic: { glyph: "🗺", tint: "text-sky-300 bg-sky-400/10" },
  "Progress Photo": { glyph: "📸", tint: "text-amber-300 bg-amber-400/10" },
  "Topo Survey": { glyph: "⛰", tint: "text-emerald-300 bg-emerald-400/10" },
  "3D Model": { glyph: "🧊", tint: "text-violet-300 bg-violet-400/10" },
  Thermal: { glyph: "🌡", tint: "text-rose-300 bg-rose-400/10" },
};

const STATUS_TINT: Record<string, string> = {
  Processed: "text-emerald-400 bg-emerald-400/10",
  "In Review": "text-amber-400 bg-amber-400/10",
  Scheduled: "text-sky-400 bg-sky-400/10",
};

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
const isImage = (m?: string | null) => !!m && IMAGE_TYPES.has(m);
const droneFileUrl = (id: number) => apiUrl(`/api/drone-captures/${id}/file`);

function gradientStyle(hue: number) {
  return {
    background: `linear-gradient(160deg, hsl(${hue} 45% 30%), hsl(${(hue + 60) % 360} 50% 22%))`,
    backgroundImage: `radial-gradient(circle at 30% 20%, hsl(${hue} 55% 45% / 0.5), transparent 60%), radial-gradient(circle at 75% 80%, hsl(${(hue + 60) % 360} 60% 40% / 0.45), transparent 55%), linear-gradient(160deg, hsl(${hue} 45% 30%), hsl(${(hue + 60) % 360} 50% 22%))`,
  };
}

/** Render the uploaded aerial image, or a styled fallback when none. */
function DroneImage({ cap, className }: { cap: DroneCapture; className?: string }) {
  if (isImage(cap.mimeType)) {
    return <img src={droneFileUrl(cap.id)} alt={cap.title} className={`${className ?? ""} h-full w-full object-cover`} />;
  }
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className ?? ""}`} style={gradientStyle(cap.hue)}>
      <div className="flex flex-col items-center gap-1 text-white/70">
        <FileWarning className="size-6" />
        <span className="text-[10px] font-medium">No source image uploaded</span>
      </div>
    </div>
  );
}

export default function DronePage() {
  const { data: captures = [], isLoading } = useDroneCaptures();
  const { data: projects = [] } = useProjects();
  const projName = (id: number) => projects.find((p) => p.id === id)?.name ?? "";
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const create = useCreateDroneCapture();
  const del = useDeleteDroneCapture();
  const { toast } = useToast();
  const { can } = useAccess();
  const canAdd = can("canCreateEdit");
  const canDelete = can("canDelete");

  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<DroneCapture | null>(null);
  const [fs, setFs] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  // upload form state
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [captureType, setCaptureType] = useState("Orthomosaic");
  const [status, setStatus] = useState("Processed");
  const [pilot, setPilot] = useState("");
  const [flightDate, setFlightDate] = useState(new Date().toISOString().slice(0, 10));
  const [altitude, setAltitude] = useState("");
  const [area, setArea] = useState("");

  const resetForm = () => {
    setFile(null); setProjectId(""); setTitle(""); setCaptureType("Orthomosaic"); setStatus("Processed");
    setPilot(""); setFlightDate(new Date().toISOString().slice(0, 10)); setAltitude(""); setArea("");
  };

  const types = ["all", ...Array.from(new Set(captures.map((c) => c.captureType)))];
  const shown = filter === "all" ? captures : captures.filter((c) => c.captureType === filter);

  const submitUpload = async () => {
    if (!file) { toast({ title: "Choose an image first", variant: "destructive" }); return; }
    if (!projectId) { toast({ title: "Select a project", variant: "destructive" }); return; }
    if (!title.trim()) { toast({ title: "Add a title", variant: "destructive" }); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);
    form.append("title", title.trim());
    form.append("captureType", captureType);
    form.append("status", status);
    form.append("pilot", pilot.trim());
    form.append("flightDate", flightDate);
    form.append("altitude", altitude.trim());
    form.append("area", area.trim());
    form.append("hue", String(Math.floor(Math.random() * 360)));
    try {
      await create.mutateAsync({ form });
      toast({ title: "Capture uploaded" });
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const openViewer = (c: DroneCapture) => { setFs(false); setViewing(c); };

  const metaOf = (c: DroneCapture | null) => (c ? CAPTURE_META[c.captureType] ?? CAPTURE_META.Orthomosaic : CAPTURE_META.Orthomosaic);
  const statusTint = (s: string) => STATUS_TINT[s] ?? "text-muted-foreground bg-muted";

  return (
    <Layout title="Drone Captures" actions={
      canAdd ? <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-drone"><Plus className="size-4" /> New Capture</Button> : undefined
    }>
      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Drone Capture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Aerial image</Label>
              <button
                type="button"
                onClick={() => document.getElementById("drone-file-input")?.click()}
                className="mt-1 flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50"
                data-testid="button-drone-choose"
              >
                {file ? (
                  <>
                    <Plane className="size-5 rotate-45 text-primary" />
                    <span className="text-sm font-medium truncate max-w-full">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to choose an image (JPG, PNG, GIF, WEBP, SVG)</span>
                  </>
                )}
              </button>
              <input id="drone-file-input" type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-drone-file" />
            </div>
            <div>
              <Label htmlFor="dr-title">Capture title</Label>
              <input id="dr-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Site orthomosaic — full parcel" data-testid="input-drone-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1 w-full" data-testid="select-drone-project"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Flight date</Label>
                <input type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-drone-flightdate" />
              </div>
              <div>
                <Label>Capture type</Label>
                <Select value={captureType} onValueChange={setCaptureType}>
                  <SelectTrigger className="mt-1 w-full" data-testid="select-drone-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Orthomosaic", "Progress Photo", "Topo Survey", "3D Model", "Thermal"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1 w-full" data-testid="select-drone-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{["Processed", "In Review", "Scheduled"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dr-pilot">Pilot</Label>
                <input id="dr-pilot" value={pilot} onChange={(e) => setPilot(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="AeroVision UAV" data-testid="input-drone-pilot" />
              </div>
              <div>
                <Label htmlFor="dr-alt">Altitude</Label>
                <input id="dr-alt" value={altitude} onChange={(e) => setAltitude(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="200 ft" data-testid="input-drone-altitude" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="dr-area">Area</Label>
                <input id="dr-area" value={area} onChange={(e) => setArea(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="14.6 acres" data-testid="input-drone-area" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button size="sm" onClick={submitUpload} disabled={create.isPending} data-testid="button-drone-upload-submit">
                {create.isPending ? "Uploading…" : "Upload Capture"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="drone-filter-tabs">
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                data-testid={`tab-${t.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => {
              const meta = metaOf(c);
              return (
                <div key={c.id} onClick={() => openViewer(c)} className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md" data-testid={`card-drone-${c.id}`}>
                  <div className="relative h-40">
                    <DroneImage cap={c} />
                    <span className={cn("absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold", meta.tint)}>{meta.glyph} {c.captureType}</span>
                    <span className={cn("absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold", statusTint(c.status))}>{c.status}</span>
                    {c.storedFileName && <span className="absolute bottom-2 right-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">image</span>}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium leading-snug">{c.title}</p>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><MapPin className="size-3.5" /> {projName(c.projectId) || "—"}</div>
                      <div className="flex items-center gap-2"><User className="size-3.5" /> {c.pilot ?? "—"}</div>
                      <div className="flex items-center gap-2"><Ruler className="size-3.5" /> {c.altitude ?? "—"} · {c.area ?? "—"}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
                      <span className="text-[11px] text-muted-foreground tabular">Flown {shortDate(c.flightDate)}</span>
                      {canDelete && c.storedFileName && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); del.mutate(c.id); }} data-testid={`button-drone-delete-${c.id}`}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No drone captures{filter !== "all" ? ` of type “${filter}”` : ""} yet.</div>}
          </div>
        </>
      )}

      {/* Viewer dialog */}
      <Dialog open={!!viewing && !fs} onOpenChange={(o) => { if (!o) { setViewing(null); setFs(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="size-4 rotate-45 text-primary" />
              <span className="font-normal text-muted-foreground">{viewing?.captureType} ·</span> {viewing?.title}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="relative h-72 overflow-hidden rounded-lg">
                <DroneImage cap={viewing} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Pilot", v: viewing.pilot ?? "—" },
                  { l: "Status", v: viewing.status },
                  { l: "Flight date", v: shortDate(viewing.flightDate) },
                  { l: "Altitude", v: viewing.altitude ?? "—" },
                  { l: "Area", v: viewing.area ?? "—" },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setFs(true)} data-testid="button-drone-fullscreen">
                  <Maximize2 className="size-4" /> Full screen
                </Button>
                {viewing.storedFileName ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={droneFileUrl(viewing.id)} target="_blank" rel="noreferrer"><Download className="size-4" /> Open / Download</a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "No source image to download" })} data-testid="button-drone-download">
                    <Download className="size-4" /> Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full screen viewer */}
      {fs && viewing && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" data-testid="drone-fullscreen">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 truncate font-medium">
                <Plane className="size-4 shrink-0 rotate-45 text-primary" />
                {viewing.title}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{viewing.captureType}</span>
                <span>· {projName(viewing.projectId) || "—"}</span>
                <span>· {viewing.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewing.storedFileName ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={droneFileUrl(viewing.id)} target="_blank" rel="noreferrer"><Download className="size-4" /> Open / Download</a>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setFs(false)} data-testid="button-drone-exit-fullscreen">
                <Minimize2 className="size-4" /> Exit full screen
              </Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/40 p-6">
              <div className="w-full max-w-3xl overflow-hidden rounded-lg shadow-lg" style={{ aspectRatio: "4 / 3" }}>
                <DroneImage cap={viewing} />
              </div>
            </div>
            <div className="hidden w-64 shrink-0 border-l border-border p-4 sm:block">
              <div className="grid grid-cols-1 gap-3 text-sm">
                {[
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Pilot", v: viewing.pilot ?? "—" },
                  { l: "Status", v: viewing.status },
                  { l: "Flight date", v: shortDate(viewing.flightDate) },
                  { l: "Altitude", v: viewing.altitude ?? "—" },
                  { l: "Area", v: viewing.area ?? "—" },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
