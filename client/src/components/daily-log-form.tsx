import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X, Save, ImagePlus } from "lucide-react";
import { useProjects, useTeam, useCreateDailyLog, useUpdateDailyLog } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DailyLog } from "@shared/schema";

const WEATHERS = ["Sunny", "Partly cloudy", "Cloudy", "Rain", "Snow", "Wind", "Fog"];

function parsePhotos(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; }
  catch { return []; }
}

/** Read an image file, downscale via canvas, return a JPEG data URL. */
async function fileToDataUrl(file: File, maxSize = 1280, quality = 0.72): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = raw;
  });
  let { width, height } = img;
  if (!width || !height) return raw;
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function DailyLogForm({ editing, onDone }: { editing: DailyLog | null; onDone: () => void }) {
  const { data: projects = [] } = useProjects();
  const { data: team = [] } = useTeam();
  const create = useCreateDailyLog();
  const update = useUpdateDailyLog();
  const { toast } = useToast();

  const today = new Date().toISOString().slice(0, 10);
  const [projectId, setProjectId] = useState<number | "">(projects[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [authorId, setAuthorId] = useState<number | "">(team[0]?.id ?? "");
  const [weather, setWeather] = useState("Sunny");
  const [temp, setTemp] = useState(72);
  const [crewCount, setCrewCount] = useState(1);
  const [summary, setSummary] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // load values when editing changes
  useEffect(() => {
    if (editing) {
      setProjectId(editing.projectId);
      setDate(editing.date);
      setAuthorId(editing.authorId ?? "");
      setWeather(editing.weather);
      setTemp(editing.temp);
      setCrewCount(editing.crewCount);
      setSummary(editing.summary);
      setPhotos(parsePhotos(editing.photos));
    }
  }, [editing]);

  // ensure defaults once data loads (only for new logs)
  useEffect(() => {
    if (!editing && projectId === "" && projects[0]) setProjectId(projects[0].id);
    if (!editing && authorId === "" && team[0]) setAuthorId(team[0].id);
  }, [editing, projects, team, projectId, authorId]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const next = [...photos];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        next.push(await fileToDataUrl(f));
      }
      setPhotos(next);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const removePhoto = (i: number) => setPhotos(photos.filter((_, idx) => idx !== i));

  const canSave = !!projectId && !!date && !!summary.trim() && !busy;

  const save = () => {
    if (!canSave) return;
    const payload = {
      projectId: Number(projectId),
      date,
      authorId: authorId === "" ? null : Number(authorId),
      weather,
      temp: Number(temp),
      crewCount: Number(crewCount),
      summary: summary.trim(),
      photos: JSON.stringify(photos),
    };
    const done = () => {
      toast({ title: editing ? "Daily log updated" : "Daily log saved" });
      onDone();
    };
    if (editing) update.mutate({ id: editing.id, data: payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  };

  const field = "h-9 w-full rounded-md border border-border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="daily-log-form">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">{editing ? "Edit daily log" : "New daily log"}</h3>
        <button onClick={onDone} className="text-muted-foreground hover:text-foreground" data-testid="button-cancel-log" aria-label="Cancel">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Project</span>
          <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value === "" ? "" : Number(e.target.value))} data-testid="input-log-project">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Date</span>
          <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-log-date" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Author</span>
          <select className={field} value={authorId} onChange={(e) => setAuthorId(e.target.value === "" ? "" : Number(e.target.value))} data-testid="input-log-author">
            <option value="">—</option>
            {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Weather</span>
          <select className={field} value={weather} onChange={(e) => setWeather(e.target.value)} data-testid="input-log-weather">
            {WEATHERS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Temp (°F)</span>
          <input type="number" className={field} value={temp} onChange={(e) => setTemp(Number(e.target.value))} data-testid="input-log-temp" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Crew on site</span>
          <input type="number" min={0} className={field} value={crewCount} onChange={(e) => setCrewCount(Number(e.target.value))} data-testid="input-log-crew" />
        </label>
        <div className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">On-site photos</span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => cameraRef.current?.click()} disabled={busy} data-testid="button-take-photo"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
              <Camera className="size-4" /> Take Photo
            </button>
            <button type="button" onClick={() => uploadRef.current?.click()} disabled={busy} data-testid="button-upload-photo"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">
              <Upload className="size-4" /> Upload
            </button>
            {busy && <span className="text-xs text-muted-foreground">Processing…</span>}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addFiles(e.target.files)} data-testid="input-camera" />
            <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} data-testid="input-upload" />
          </div>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Work summary</span>
        <textarea rows={3} className="w-full resize-none rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={summary}
          onChange={(e) => setSummary(e.target.value)} placeholder="What got done today, delays, deliveries, visitors…" data-testid="input-log-summary" />
      </label>

      {/* photo thumbnails */}
      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="log-photo-thumbs">
          {photos.map((src, i) => (
            <div key={i} className="group relative size-20 overflow-hidden rounded-md border border-border" data-testid={`log-photo-${i}`}>
              <img src={src} alt={`Site photo ${i + 1}`} className="size-full object-cover" />
              <button type="button" onClick={() => removePhoto(i)} data-testid={`button-remove-photo-${i}`}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100" aria-label="Remove photo">
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          <ImagePlus className="size-4" /> No photos attached. Use the camera to capture site conditions.
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone} data-testid="button-cancel-log-2">Cancel</Button>
        <Button size="sm" onClick={save} disabled={!canSave || create.isPending || update.isPending} data-testid="button-save-log">
          <Save className="size-4" /> {editing ? "Update" : "Save Log"}
        </Button>
      </div>
    </div>
  );
}
