import { useEffect, useRef, useState } from "react";
import { Bot, X, Send, Volume2, VolumeX, Sparkles, Radio, Mic, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisBrief, useJarvisChat, useSettings, useUpdateSettings, useHealthScan, type JarvisMsg, type JarvisMode } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";

/* ---------- minimal markdown render (bold, bullets, paragraphs) ---------- */
function renderMd(text: string) {
  return text.split(/\n+/).map((line, i) => {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const content = bullet ? bullet[1] : line;
    const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    const rendered = parts.map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={j} className="font-semibold text-primary">{p.slice(2, -2)}</strong>
      ) : <span key={j}>{p}</span>
    );
    if (bullet) return <div key={i} className="flex gap-2"><span className="text-primary">•</span><span>{rendered}</span></div>;
    if (!line.trim()) return null;
    return <p key={i} className="leading-relaxed">{rendered}</p>;
  });
}

/* ---------- voice (browser SpeechSynthesis, Jarvis-like British male) ---------- */
let cachedVoices: SpeechSynthesisVoice[] = [];
function loadVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}
function pickVoice(): SpeechSynthesisVoice | undefined {
  const vs = cachedVoices.length ? cachedVoices : loadVoices();
  const gb = vs.filter((v) => /en-GB/i.test(v.lang));
  // prefer a male-sounding British voice
  const male = gb.find((v) => /daniel|arthur|george|oliver|james/i.test(v.name)) || gb[0];
  return male || vs.find((v) => /^en/i.test(v.lang));
}

// Voices load asynchronously in most browsers; wait for them (or give up after 1.2s)
// so we never call speak() before a voice is available.
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  if (voicesPromise) return voicesPromise;
  voicesPromise = new Promise((resolve) => {
    const immediate = window.speechSynthesis.getVoices();
    if (immediate && immediate.length) { cachedVoices = immediate; return resolve(immediate); }
    let settled = false;
    const finish = () => { if (settled) return; settled = true; cachedVoices = window.speechSynthesis.getVoices(); window.speechSynthesis.removeEventListener("voiceschanged", handler); clearTimeout(timer); resolve(cachedVoices); };
    const handler = () => { const v = window.speechSynthesis.getVoices(); if (v.length) { cachedVoices = v; finish(); } };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    const timer = setTimeout(finish, 1200);
  });
  return voicesPromise;
}
/* ---------- speech normalization: make numbers, codes & dates sound natural ---------- */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function dateToWords(y: string, mo: string, d: string): string {
  const day = parseInt(d, 10);
  const mon = MONTHS[parseInt(mo, 10) - 1];
  return `${mon} ${day}, ${y}`;
}

export function normalizeForSpeech(text: string): string {
  let s = text;
  // strip markdown
  s = s.replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^\s*[-*•]\s+/gm, "").replace(/`/g, "");
  // ISO dates YYYY-MM-DD -> "July 23, 2026"
  s = s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_m, y, mo, d) => dateToWords(y, mo, d));
  // codes: RFI-014, CO-011, SUB-051 -> "R F I 14"
  s = s.replace(/\b([A-Z]{2,4})[-\s]?(\d{1,4})\b/g, (_m, letters, num) => `${letters.split("").join(" ")} ${parseInt(num, 10)}`);
  // level ranges L1-L3 -> "levels 1 through 3"
  s = s.replace(/\bL(\d+)\s*[\u2013-]\s*L(\d+)\b/g, (_m, a, b) => `levels ${a} through ${b}`);
  // currency $1,234.56 -> "1234 dollars"
  s = s.replace(/\$\s?([\d,]+(?:\.\d+)?)/g, (_m, n) => `${n.replace(/,/g, "")} dollars`);
  // comma-grouped numbers 1,234 -> 1234 (avoids "comma")
  s = s.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (m) => m.replace(/,/g, ""));
  // symbols
  s = s.replace(/°/g, " degrees").replace(/%/g, " percent").replace(/&/g, " and ").replace(/\bvs\.?/gi, "versus");
  // dashes & bullets -> pauses; newlines -> sentence breaks so list items don't run together
  s = s.replace(/[\u2014\u2013]/g, ",").replace(/•/g, "");
  s = s.replace(/\n+/g, ". ").replace(/\s*\.\s*\.\s*/g, ". ").replace(/\.{2,}/g, ".");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function speak(text: string, opts?: { rate?: number; pitch?: number }) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  await ensureVoices();
  const v = pickVoice();
  const chunks = normalizeForSpeech(text)
    .split(/(?<=[.!?])\s+|\n+/).map((c) => c.trim()).filter(Boolean);
  if (!chunks.length) return;
  const keepAlive = window.setInterval(() => {
    if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
  }, 10000);
  const stopKeepAlive = () => window.clearInterval(keepAlive);
  chunks.forEach((chunk, i) => {
    const u = new SpeechSynthesisUtterance(chunk);
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-GB"; }
    u.rate = opts?.rate ?? 0.97; u.pitch = opts?.pitch ?? 0.9; u.volume = 1;
    if (i === chunks.length - 1) { u.onend = stopKeepAlive; u.onerror = stopKeepAlive; }
    window.speechSynthesis.speak(u);
  });
  window.setTimeout(stopKeepAlive, Math.max(60000, chunks.length * 9000));
}
function stopSpeak() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ---------- hearing (browser SpeechRecognition) ---------- */
const SpeechRecognitionCtor: any =
  (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
const micSupported = !!SpeechRecognitionCtor;

export function JarvisPanel() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const scanMut = useHealthScan();
  const voice = settings?.voiceEnabled ?? true;
  const rate = settings?.voiceRate ?? 0.97;
  const pitch = settings?.voicePitch ?? 0.9;
  const autoSpeak = settings?.autoSpeak ?? true;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<JarvisMsg[]>([]);
  const [brief, setBrief] = useState<string | null>(null);
  // Track the most recent response mode so we can show a subtle "Local mode"
  // pill — users know when Jarvis is running on the offline rules engine vs a
  // real LLM. Server sets this from routes.ts.
  const [lastMode, setLastMode] = useState<JarvisMode | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const briefMut = useJarvisBrief();
  const chatMut = useJarvisChat();
  const busy = briefMut.isPending || chatMut.isPending || scanMut.isPending;
  const recRef = useRef<any>(null);

  useEffect(() => {
    loadVoices();
    if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => stopSpeak();
  }, []);
  // Scroll-to-bottom effect. IMPORTANT: block body with no implicit return — an
  // arrow-with-implicit-return here caused React to interpret scrollTo()'s return
  // value as an effect cleanup, which crashed rendering in some browsers with
  // "x is not a function" during unmount/re-run. See TrussPath bug 2026-07.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && typeof el.scrollTo === "function") {
      try { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); } catch { /* noop */ }
    }
  }, [messages, brief, busy, listening]);
  useEffect(() => {
    return () => { stopListening(); stopSpeak(); };
  }, []);

  const stopListening = () => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  const startListening = () => {
    if (!micSupported) return;
    stopSpeak(); // stop Jarvis from talking over the user
    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (interim) setInput(interim);
      if (final) { const text = final.trim(); setInput(text); setListening(false); send(text); }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  };

  const runBrief = () => {
    briefMut.mutate(undefined, {
      onSuccess: (r) => {
        setBrief(r.brief);
        if (r.mode) setLastMode(r.mode);
        if (voice) speak(r.brief, { rate, pitch });
      },
      onError: () => setBrief("My apologies, sir — I couldn't retrieve the morning brief just now. Please try again shortly."),
    });
  };

  const runScan = () => {
    scanMut.mutate(undefined, {
      onSuccess: (r) => {
        const lines: string[] = [r.summary];
        if (r.brokenLinks.length) {
          lines.push("**Broken links:**");
          r.brokenLinks.forEach((l) => lines.push(`- ${l.label} → ${l.href} (${l.source})`));
        }
        const failing = r.moduleChecks.filter((c) => c.status === "fail");
        if (failing.length) {
          lines.push("**Failing modules:**");
          failing.forEach((c) => lines.push(`- ${c.name}: ${c.detail}`));
        }
        if (r.ok) lines.push("All modules reporting healthy.");
        setMessages((m) => [...m, { role: "assistant", content: lines.join("\n") }]);
        if (voice) speak(r.summary, { rate, pitch });
      },
      onError: () => setMessages((m) => [...m, { role: "assistant", content: "My apologies, sir — the health scan failed to run. Please try again shortly." }]),
    });
  };

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    chatMut.mutate(next, {
      onSuccess: (r) => {
        setMessages((m) => [...m, { role: "assistant", content: r.reply }]);
        if (r.mode) setLastMode(r.mode);
        if (voice && autoSpeak) speak(r.reply, { rate, pitch });
      },
      onError: () => setMessages((m) => [...m, { role: "assistant", content: "My apologies, sir — I'm having trouble connecting. Please try again." }]),
    });
  };

  const toggleVoice = () => {
    if (voice) stopSpeak();
    updateSettings.mutate({ voiceEnabled: !voice });
  };

  return (
    <>
      {/* floating launcher — hidden while panel is open */}
      {!open && (
      <button
        onClick={() => setOpen(true)}
        data-testid="jarvis-launcher"
        aria-label="Open JARVIS assistant"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        className={cn(
          "fixed right-3 md:right-5 md:bottom-5 z-50 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 backdrop-blur pl-2.5 pr-3 py-2 md:pl-3 md:pr-4 md:py-2.5 shadow-lg transition hover:border-primary",
          open && "ring-2 ring-primary/40"
        )}
      >
        <span className="relative grid size-6 md:size-7 place-items-center rounded-full bg-primary/15 text-primary">
          <Radio className="size-3.5 md:size-4" />
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        </span>
        <span className="font-display text-xs md:text-sm font-extrabold tracking-wide text-foreground">JARVIS</span>
      </button>
      )}

      {/* slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} data-testid="jarvis-overlay" />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl" data-testid="jarvis-panel">
            {/* header */}
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary"><Bot className="size-5" /></div>
                <div>
                  <div className="font-display text-sm font-extrabold tracking-wide">JARVIS</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Site Assistant</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={toggleVoice} data-testid="jarvis-voice-toggle" className={cn("grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted", voice && "text-primary")} title={voice ? "Voice on" : "Voice muted"}>
                  {voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                </button>
                <button onClick={runScan} disabled={scanMut.isPending} data-testid="jarvis-scan-btn" title="Scan app for issues" className={cn("grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary", scanMut.isPending && "opacity-50")}>
                  <Stethoscope className="size-4" />
                </button>
                <button onClick={() => setOpen(false)} data-testid="jarvis-close" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
              </div>
            </div>

            {/* body */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {/* morning brief */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Sparkles className="size-3.5" /> Morning Brief
                    {lastMode === "local" && (
                      <span
                        title="Jarvis is running in local mode — no OpenAI API key configured. Replies come from the built-in rules engine. Add OPENAI_API_KEY in Vercel to enable the LLM."
                        data-testid="jarvis-local-mode-badge"
                        className="ml-1 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-600 dark:text-amber-400"
                      >
                        Local mode
                      </span>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={runBrief} disabled={briefMut.isPending} data-testid="jarvis-brief-btn" className="h-7 px-2 text-xs">
                    {briefMut.isPending ? "Generating…" : brief ? "Regenerate" : "Generate"}
                  </Button>
                </div>
                {brief ? (
                  <div className="space-y-1.5 text-sm text-foreground/90">{renderMd(brief)}</div>
                ) : (
                  <p className="text-xs text-muted-foreground">Ask Jarvis for a snapshot of today's priorities, overdue items, and a proactive recommendation — read aloud in a British voice.</p>
                )}
              </div>

              {/* chat */}
              {messages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <p className="text-sm font-medium">At your service, sir.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Ask about overdue items, draft an RFI, or request a status summary.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {["What's overdue today?", "Draft an RFI for the curtainwall anchors", "Are there broken links?"].map((q) => (
                      <button key={q} onClick={() => { setInput(q); }} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary">{q}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                        <div className="space-y-1">{renderMd(m.content)}</div>
                        {m.role === "assistant" && voice && (
                          <button onClick={() => speak(m.content, { rate, pitch })} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"><Volume2 className="size-3" /> replay</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatMut.isPending && (
                    <div className="flex justify-start"><div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">…</div></div>
                  )}
                </div>
              )}
            </div>

            {/* input */}
            <div className="border-t border-border p-3">
              {listening && (
                <div className="mb-2 flex items-center gap-2 text-xs text-primary" data-testid="jarvis-listening">
                  <span className="relative flex size-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" /><span className="relative inline-flex size-2.5 rounded-full bg-primary" /></span>
                  Listening, sir…
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder={listening ? "Listening…" : "Message or speak to Jarvis…"}
                  data-testid="jarvis-input"
                  className="max-h-32 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                {micSupported && (
                  <button
                    onClick={listening ? stopListening : startListening}
                    data-testid="jarvis-mic"
                    title={listening ? "Stop listening" : "Speak to Jarvis"}
                    className={cn("grid size-9 shrink-0 place-items-center rounded-md border transition-colors", listening ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary hover:text-primary")}
                  >
                    <Mic className="size-4" />
                  </button>
                )}
                <Button size="icon" onClick={() => send()} disabled={busy || !input.trim()} data-testid="jarvis-send"><Send className="size-4" /></Button>
              </div>
              {!micSupported && <p className="mt-1.5 text-[10px] text-muted-foreground">Voice input isn't supported in this browser.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
