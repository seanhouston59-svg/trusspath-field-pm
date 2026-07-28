// Play a soft "ding" chime whenever a new sticky note or sticker is added
// to the org's board by someone other than the current user. Wired to the
// same `/api/notes` query as the Sticky Board so we don't fetch twice.
//
// Design notes:
// - Browsers block audio playback until a user gesture. We init the
//   AudioContext lazily on the first pointer/keyboard event so playback is
//   armed silently before the first ding is due.
// - Users can mute the ding via localStorage key STICKY_DING_MUTED. The
//   Sticky Board page exposes a toggle; other pages inherit the setting.
// - We track a set of "seen" note ids ONLY after the first fetch loads,
//   otherwise every note in the initial load would ding. New ids relative
//   to that baseline get a ding (skipped if the note's createdById matches
//   the current user).

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotes } from "./use-data";
import { useAuth } from "@/lib/auth";

const MUTED_STORAGE_KEY = "sticky-ding-muted";

export function isStickyDingMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTED_STORAGE_KEY) === "1";
}
export function setStickyDingMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  if (muted) window.localStorage.setItem(MUTED_STORAGE_KEY, "1");
  else window.localStorage.removeItem(MUTED_STORAGE_KEY);
}

// Two-tone bell chime using WebAudio oscillators. Cheap, no assets, works
// offline. Uses a short exponential decay so it reads as a friendly ping,
// not a klaxon.
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  master.connect(ctx.destination);

  // Two overlapping sine tones for a bell-like harmonic.
  const tones = [880, 1320];
  tones.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    // Second tone starts a hair later for a chime-y two-note feel.
    const start = now + i * 0.05;
    const stop = start + 0.5;
    osc.connect(master);
    osc.start(start);
    osc.stop(stop);
  });
}

export function useStickyDing() {
  const { data: notes } = useNotes();
  const { account } = useAuth();
  const qc = useQueryClient();

  // Seen-ids baseline. Initialized to null so the first fetch (however
  // many notes are already on the board) populates it silently. Any note
  // whose id shows up after this point counts as new.
  const seenRef = useRef<Set<number> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const armedRef = useRef(false);

  // Arm the AudioContext on the first user gesture. Browsers require this
  // before audio can play; without it playChime() is a silent no-op.
  useEffect(() => {
    if (armedRef.current) return;
    const arm = () => {
      if (armedRef.current) return;
      armedRef.current = true;
      try {
        const Ctx: typeof AudioContext | undefined =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      } catch {
        // AudioContext unavailable (e.g. very old browser) — silently skip.
      }
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    window.addEventListener("pointerdown", arm, { once: true, passive: true });
    window.addEventListener("keydown", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, []);

  // Diff each fetch against the seen set. First fetch just populates the
  // baseline; subsequent fetches ding once per never-before-seen id that
  // wasn't authored by the current user.
  useEffect(() => {
    if (!Array.isArray(notes)) return;
    if (seenRef.current === null) {
      seenRef.current = new Set(notes.map((n: any) => n.id));
      return;
    }
    const seen = seenRef.current;
    let didDing = false;
    for (const n of notes as any[]) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      // Skip our own additions — no self-dings.
      if (account?.id && n.createdById === account.id) continue;
      didDing = true;
    }
    if (didDing && !isStickyDingMuted() && audioCtxRef.current) {
      try {
        playChime(audioCtxRef.current);
      } catch {
        // ignore playback errors
      }
    }
  }, [notes, account?.id]);

  // Kick a manual refetch when the page comes back into focus so the
  // ding fires promptly after switching tabs (React Query has its own
  // window-focus refetch but this makes it explicit).
  useEffect(() => {
    const onFocus = () => qc.invalidateQueries({ queryKey: ["/api/notes"] });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [qc]);
}
