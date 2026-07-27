import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Camera, Loader2, MapPin, WifiOff, CheckCircle2, RotateCcw, X as XIcon } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-data";
import { queueRequest, subscribeQueue } from "@/lib/offline-queue";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Mobile photo capture with geo + timestamp burn-in.
 *
 * Flow:
 *  1. User taps "Open camera" (or "Choose photo" as fallback). We use the
 *     native <input type="file" accept="image/*" capture="environment">
 *     pattern which pops the rear camera on iOS/Android and gives us a
 *     File back \u2014 no getUserMedia complexity, no permission stalls.
 *  2. On selection, we downscale to max 1600px on the long edge (keeps
 *     under 2mb JPEG in practice) and paint a translucent bottom strip
 *     with the local timestamp and, if available, GPS coordinates.
 *  3. Preview shows the burned-in image. User adds a caption + confirms.
 *  4. Submit sends the data URL to /api/photos/upload-base64 or queues
 *     for later. Same offline pattern as daily-log/timecard.
 */

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

async function getCoords(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { lat: number; lng: number; accuracyM: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timeout = setTimeout(() => finish(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timeout); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); },
      () => { clearTimeout(timeout); finish(null); },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 30_000 },
    );
  });
}

// Downscale the source File to a Canvas and burn in a bottom info strip.
// Returns a data URL (image/jpeg) suitable for base64 upload.
async function processImage(file: File, opts: { lat: number | null; lng: number | null; projectName: string }): Promise<{ dataUrl: string; width: number; height: number; sizeBytes: number } | null> {
  const bitmap = await loadBitmap(file);
  if (!bitmap) return null;

  // Compute target dimensions preserving aspect ratio.
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const scale = longEdge > MAX_EDGE_PX ? MAX_EDGE_PX / longEdge : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Burn-in strip \u2014 semi-transparent black band at the bottom with
  // white text. Height scales with the image so it stays readable.
  const stripH = Math.max(48, Math.round(h * 0.06));
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, h - stripH, w, stripH);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.max(14, Math.round(stripH * 0.32))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textBaseline = "middle";

  const stamp = new Date().toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const geo = opts.lat != null && opts.lng != null ? `${opts.lat.toFixed(4)}, ${opts.lng.toFixed(4)}` : "GPS unavailable";
  const projectLine = opts.projectName;

  const padX = Math.max(12, Math.round(stripH * 0.28));
  const line1 = `${stamp}  \u00b7  ${geo}`;
  ctx.fillText(line1, padX, h - stripH + stripH * 0.32);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `500 ${Math.max(12, Math.round(stripH * 0.24))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText(projectLine, padX, h - stripH + stripH * 0.72);

  // Small TrussPath watermark on the right for provenance.
  const wm = "TrussPath";
  ctx.fillStyle = "rgba(245, 158, 11, 0.95)"; // amber
  ctx.font = `700 ${Math.max(12, Math.round(stripH * 0.28))}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const wmMetrics = ctx.measureText(wm);
  ctx.fillText(wm, w - padX - wmMetrics.width, h - stripH + stripH * 0.5);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  // rough sizing: base64 => ~4/3 of raw bytes
  const sizeBytes = Math.round((dataUrl.length - "data:image/jpeg;base64,".length) * 3 / 4);
  return { dataUrl, width: w, height: h, sizeBytes };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch { /* fall through to <img> loader */ }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export default function FieldPhoto() {
  const [, navigate] = useLocation();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();

  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [caption, setCaption] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [preview, setPreview] = useState<{ dataUrl: string; sizeBytes: number; lat: number | null; lng: number | null } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

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

  const projectName = projects.find((p) => p.id === projectId)?.name || "";

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "That doesn't look like an image", variant: "destructive" });
      return;
    }
    setProcessing(true);
    try {
      // Kick off geo in parallel with the image decode.
      const [coords, processed] = await Promise.all([
        getCoords(),
        // We don't have the coords yet, but processImage needs them for the
        // burn-in strip. So we do a two-pass: first without coords for a
        // fast preview, then re-render once coords resolve. Simpler: just
        // block on both.
        (async () => file)(),
      ]);
      // Now that we have coords, actually process the image.
      const result = await processImage(processed, { lat: coords?.lat ?? null, lng: coords?.lng ?? null, projectName });
      if (!result) {
        toast({ title: "Couldn't process image", variant: "destructive" });
        return;
      }
      setPreview({ dataUrl: result.dataUrl, sizeBytes: result.sizeBytes, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    } finally {
      setProcessing(false);
    }
  };

  const submit = async () => {
    if (!preview || projectId == null || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        projectId,
        image: preview.dataUrl,
        lat: preview.lat,
        lng: preview.lng,
        locationLabel: locationLabel.trim() || undefined,
        caption: caption.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      };
      localStorage.setItem("trusspath.field.lastProjectId", String(projectId));

      if (online) {
        try {
          const resp = await fetch("/api/photos/upload-base64", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          toast({ title: "Photo uploaded", description: caption || "Saved to project" });
          resetAll();
          return;
        } catch { /* fall through */ }
      }

      await queueRequest({
        kind: "photo",
        url: "/api/photos/upload-base64",
        method: "POST",
        body: payload,
        meta: { projectId, sizeBytes: preview.sizeBytes },
      });
      toast({ title: "Photo saved offline", description: "We'll upload when you're back online." });
      resetAll();
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setPreview(null);
    setCaption("");
    setLocationLabel("");
    if (fileRef.current) fileRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  };

  return (
    <Layout title="Take photo">
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
          <div className="grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Camera className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Take photo</h1>
            <p className="text-xs text-muted-foreground">Timestamp and GPS are burned into the image</p>
          </div>
        </div>

        {/* Project picker */}
        <div className="mt-6">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
          <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
            <SelectTrigger data-testid="field-photo-project" className="h-12 text-base">
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Preview or capture buttons */}
        <div className="mt-6">
          {preview ? (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-black">
                <img src={preview.dataUrl} alt="Preview" className="mx-auto block max-h-[70vh] w-auto max-w-full" data-testid="field-photo-preview" />
                <button
                  type="button"
                  onClick={resetAll}
                  className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
                  data-testid="field-photo-clear"
                  aria-label="Clear photo"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {preview.lat != null && preview.lng != null
                    ? `${preview.lat.toFixed(4)}, ${preview.lng.toFixed(4)}`
                    : "GPS unavailable"}
                </span>
                <span>·</span>
                <span>{(preview.sizeBytes / 1024).toFixed(0)} KB</span>
              </div>

              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Caption (optional)</Label>
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="North wall progress, day 12" className="h-11 text-base" data-testid="field-photo-caption" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Location label (optional)</Label>
                <Input value={locationLabel} onChange={(e) => setLocationLabel(e.target.value)} placeholder="2nd floor, east side" className="h-11 text-base" data-testid="field-photo-location" />
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
                data-testid="field-photo-file-camera"
              />
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
                data-testid="field-photo-file-gallery"
              />
              <Button
                size="lg"
                className="h-24 flex-col gap-1 text-lg font-bold"
                onClick={() => fileRef.current?.click()}
                disabled={processing || projectId == null}
                data-testid="field-photo-open-camera"
              >
                {processing ? <Loader2 className="size-7 animate-spin" /> : <Camera className="size-7" />}
                {processing ? "Processing…" : "Open camera"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 gap-2 text-base font-semibold"
                onClick={() => galleryRef.current?.click()}
                disabled={processing || projectId == null}
                data-testid="field-photo-open-gallery"
              >
                <RotateCcw className="size-5" /> Choose from photos
              </Button>
              {projectId == null && (
                <p className="text-center text-xs text-muted-foreground">Pick a project first.</p>
              )}
            </div>
          )}
        </div>

        {/* Sticky submit */}
        {preview && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <Button type="button" variant="outline" onClick={resetAll} className="h-12" data-testid="field-photo-cancel">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={submitting || projectId == null}
                className="h-12 flex-1 text-base font-bold"
                data-testid="field-photo-save"
              >
                {submitting ? (
                  <><Loader2 className="size-5 animate-spin" /> Uploading…</>
                ) : online ? (
                  <><CheckCircle2 className="size-5" /> Upload photo</>
                ) : (
                  <><WifiOff className="size-5" /> Save offline</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
