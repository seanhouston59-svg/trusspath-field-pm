import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Mic, Square, Play, Pause, Trash2, Send, Loader2, CheckCircle2,
  WifiOff, MapPin, AlertCircle,
} from "lucide-react";
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
 * Field Voice Note capture.
 *
 * Tap Record. MediaRecorder streams the mic into a webm/opus blob (or
 * mp4/aac on iOS Safari — we pick the first supported mime). If the
 * browser exposes SpeechRecognition, we also stream a live transcript
 * alongside the audio so the timeline gets a searchable line even before
 * anyone plays back the file.
 *
 * On stop, the user can play the take back, retake, or Save. Save serializes
 * to a base64 data URL and POSTs to /api/field/voice-notes; if the network
 * is down (or the request fails) the payload lands in the offline queue and
 * syncs on the next successful heartbeat, same pattern as the other field
 * pages.
 *
 * GPS is best-effort: we ask once at Save time. If the user denies or the
 * request times out we still submit the note.
 */

const TIME_LIMIT_MS = 5 * 60 * 1000; // 5 minutes \u2014 a hard cap so we don't accidentally upload a 25MB file

type Stage = "idle" | "recording" | "review" | "saving";

// Pick the first mime the current browser can encode. Safari on iOS
// historically only supported mp4/aac; every other modern browser handles
// webm/opus. If neither is supported we fall back to the browser default
// by passing an empty string.
function pickMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "webm" };
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const m of candidates) {
    // isTypeSupported may be undefined on old browsers.
    if ((MediaRecorder as any).isTypeSupported?.(m)) return { mime: m, ext: m.includes("mp4") ? "m4a" : m.includes("ogg") ? "ogg" : "webm" };
  }
  return { mime: "", ext: "webm" };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getCoords(): Promise<{ lat: number; lng: number; accuracyM: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: { lat: number; lng: number; accuracyM: number } | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const t = setTimeout(() => finish(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }); },
      () => { clearTimeout(t); finish(null); },
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 30_000 },
    );
  });
}

function fmtDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const ss = (totalSec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function FieldVoiceNote() {
  const [, navigate] = useLocation();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();

  const initialProjectId = useMemo(() => {
    if (typeof localStorage === "undefined") return null;
    const stored = localStorage.getItem("trusspath.field.lastProjectId");
    return stored ? Number(stored) : null;
  }, []);
  const [projectId, setProjectId] = useState<number | null>(initialProjectId);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [autoTranscript, setAutoTranscript] = useState("");
  const [playing, setPlaying] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<any>(null);

  useEffect(() => subscribeQueue(setQueueSize), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Clean up mic + audio URL on unmount so we don't leak a stream when the
  // user backs out mid-recording.
  useEffect(() => () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    try { speechRef.current?.stop(); } catch {}
  }, [audioUrl]);

  const startRecording = async () => {
    setError(null);
    if (!projectId) {
      setError("Pick a project first.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Mic access isn't available on this device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const { mime } = pickMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStage("review");
      };
      startedAtRef.current = Date.now();
      setDurationMs(0);
      recorder.start(1000);
      setStage("recording");

      // Timer tick + hard time-limit safeguard.
      tickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setDurationMs(elapsed);
        if (elapsed >= TIME_LIMIT_MS) stopRecording();
      }, 200);

      // Try live transcription if the browser supports it. Chrome + Edge do;
      // Safari does not. Failure is silent; the audio still gets recorded.
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const sr = new SpeechRecognition();
          sr.continuous = true;
          sr.interimResults = true;
          sr.lang = navigator.language || "en-US";
          let finalText = "";
          sr.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const chunk = event.results[i][0].transcript;
              if (event.results[i].isFinal) finalText += chunk + " ";
              else interim += chunk;
            }
            setAutoTranscript((finalText + interim).trim());
          };
          sr.onerror = () => {}; // silent \u2014 audio still recording
          sr.start();
          speechRef.current = sr;
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      setError(err?.message || "Couldn't start the mic. Check permissions.");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    try { recorderRef.current?.stop(); } catch {}
    try { speechRef.current?.stop(); } catch {}
    if (autoTranscript && !transcript) setTranscript(autoTranscript);
  };

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDurationMs(0);
    setTitle("");
    setTranscript("");
    setAutoTranscript("");
    setPlaying(false);
    setStage("idle");
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  };

  const save = async () => {
    if (!audioBlob || !projectId) return;
    setStage("saving");
    try {
      const dataUrl = await blobToDataUrl(audioBlob);
      const coords = await getCoords();
      // clientId keeps the offline queue idempotent \u2014 replays with the same
      // id return the existing row instead of double-inserting.
      const clientId = `vn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = {
        projectId,
        audio: dataUrl,
        title: title.trim() || null,
        transcript: (transcript || autoTranscript || "").trim() || null,
        durationMs,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        accuracyM: coords?.accuracyM ?? null,
        occurredAt: new Date().toISOString(),
        clientId,
      };
      localStorage.setItem("trusspath.field.lastProjectId", String(projectId));

      if (online) {
        try {
          const resp = await fetch("/api/field/voice-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            credentials: "include",
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          toast({ title: "Voice note saved", description: fmtDuration(durationMs) });
          discard();
          navigate("/field");
          return;
        } catch { /* fall through to queue */ }
      }
      await queueRequest({
        kind: "voice-note",
        url: "/api/field/voice-notes",
        method: "POST",
        body: payload,
        meta: { projectId, durationMs },
      });
      toast({ title: "Saved offline", description: "We'll sync when you're back online." });
      discard();
      navigate("/field");
    } catch (err: any) {
      setError(err?.message || "Couldn't save this take.");
      setStage("review");
    }
  };

  const project = projects.find((p) => p.id === projectId);

  return (
    <Layout title="Voice note">
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

        <div className="mb-4 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Mic className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold leading-none">Voice note</h1>
            <p className="text-xs text-muted-foreground">Speak up to 5 minutes. We&apos;ll transcribe on the fly when the browser supports it.</p>
          </div>
        </div>

        <div className="mb-4">
          <Label className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Project</Label>
          <Select value={projectId ? String(projectId) : ""} onValueChange={(v) => setProjectId(Number(v))}>
            <SelectTrigger data-testid="field-voice-project" className="h-12 text-base">
              <SelectValue placeholder="Pick a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400" data-testid="field-voice-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Recorder capsule */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center gap-4">
            {/* Big timer */}
            <div
              className={cn(
                "font-mono text-5xl font-bold tabular-nums transition-colors",
                stage === "recording" ? "text-red-500" : "text-foreground",
              )}
              data-testid="field-voice-timer"
            >
              {fmtDuration(durationMs)}
            </div>
            {/* Waveform pulse (indicative, not analyzer-based \u2014 keeps the UI honest without extra dependencies) */}
            <div className="flex h-10 items-end gap-1" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-1.5 rounded-full transition-all",
                    stage === "recording"
                      ? "bg-red-500 animate-pulse"
                      : "bg-muted-foreground/30",
                  )}
                  style={{
                    height: stage === "recording" ? `${18 + Math.round(Math.sin((Date.now() / 120) + i) * 12 + 12)}px` : "6px",
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>

            {/* Primary action */}
            {stage === "idle" && (
              <Button
                size="lg"
                onClick={startRecording}
                disabled={!projectId}
                className="h-16 min-w-56 gap-2 text-base"
                data-testid="field-voice-start"
              >
                <Mic className="size-5" /> Start recording
              </Button>
            )}
            {stage === "recording" && (
              <Button
                size="lg"
                variant="destructive"
                onClick={stopRecording}
                className="h-16 min-w-56 gap-2 text-base"
                data-testid="field-voice-stop"
              >
                <Square className="size-5" /> Stop
              </Button>
            )}
            {stage === "review" && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" size="lg" onClick={togglePlay} className="gap-2" data-testid="field-voice-play">
                  {playing ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> Play</>}
                </Button>
                <Button variant="ghost" size="lg" onClick={discard} className="gap-2" data-testid="field-voice-discard">
                  <Trash2 className="size-4" /> Retake
                </Button>
                <Button size="lg" onClick={save} className="gap-2" data-testid="field-voice-save">
                  <Send className="size-4" /> Save
                </Button>
              </div>
            )}
            {stage === "saving" && (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Saving…
              </div>
            )}
          </div>

          {audioUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              ref={audioElRef}
              src={audioUrl}
              onEnded={() => setPlaying(false)}
              className="mt-4 hidden"
              controls={false}
            />
          )}
        </div>

        {/* Metadata (only after a take is recorded) */}
        {stage === "review" && (
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="voice-title" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Title (optional)</Label>
              <Input
                id="voice-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Column A2 rebar mismatch"
                className="h-12 text-base"
                data-testid="field-voice-title"
              />
            </div>
            <div>
              <Label htmlFor="voice-transcript" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Transcript {autoTranscript ? "(auto)" : "(optional)"}
              </Label>
              <Textarea
                id="voice-transcript"
                value={transcript || autoTranscript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type or edit the transcript"
                rows={4}
                className="text-base"
                data-testid="field-voice-transcript"
              />
              {autoTranscript && !transcript && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Auto-captured from the browser — edit before saving if anything sounds off.
                </p>
              )}
            </div>
            {project && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" /> GPS captured on Save when the device allows it.
              </div>
            )}
          </div>
        )}

        {/* Success shim: never reached because navigate() runs on success, but keeps the layout stable if we ever decide to stay on-page */}
        {stage === "review" && audioBlob && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            <span>Take captured &mdash; review and Save, or Retake.</span>
          </div>
        )}
      </div>
    </Layout>
  );
}
