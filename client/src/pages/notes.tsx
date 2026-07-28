import { useEffect, useRef, useState } from "react";
import { Plus, X, CornerDownRight } from "lucide-react";
import { Layout } from "@/components/layout";
import { useNotes, useCreateNote, useUpdateNotePosition, useDeleteNote, useAddNoteReply, useProjects } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Shape of a parsed reply. Persisted on the server as a JSON string in
// notes.replies. Missing/invalid JSON → empty list (see parseReplies).
type NoteReply = { author: string; initials: string; body: string; at: string };

function parseReplies(raw: unknown): NoteReply[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r): r is NoteReply => !!r && typeof r === "object" && typeof (r as any).body === "string");
  } catch {
    return [];
  }
}

const NOTE_COLORS: Record<string, { bg: string; bar: string; text: string; pin: string }> = {
  amber:   { bg: "#fef3c7", bar: "#e07412", text: "#5c2e07", pin: "#c0392b" },
  blue:    { bg: "#dbeafe", bar: "#2f7fd4", text: "#0c3a66", pin: "#1e3a8a" },
  emerald: { bg: "#d1fae5", bar: "#1f9d6b", text: "#064e3b", pin: "#065f46" },
  rose:    { bg: "#ffe4e6", bar: "#e0457b", text: "#6b0f2a", pin: "#9d174d" },
  violet:  { bg: "#ede9fe", bar: "#7c5cff", text: "#2e1065", pin: "#5b21b6" },
};
const COLOR_KEYS = Object.keys(NOTE_COLORS);

// Sticky note dimensions. 260px reads like a real paper sticky on tablet+
// but overflows the corkboard on iPhone-sized viewports (~370px inner width
// after the frame). Below MOBILE_BOARD_PX we compact the note width so a
// sticky always fits inside the frame with a comfortable side margin.
const NOTE_W_DESKTOP = 260;
// 160px wide notes let us fit 2 columns side-by-side on iPhone widths
// (369px inner corkboard → 2×160 + 12 gutter + 2×12 outer = 356px) with a
// comfortable margin. Height compresses too so a full row is readable
// without the reply composer being pushed off-screen.
const NOTE_W_MOBILE = 160;
const NOTE_H_DESKTOP = 260;
const NOTE_H_MOBILE = 210;
const MOBILE_BOARD_PX = 480;
const MOBILE_COLS = 2;
const MOBILE_GUTTER = 12;
const MOBILE_MARGIN = 12;
// Bottom reservation so notes can't be dragged under the floating JARVIS FAB
// (~64px tall + 16px offset). On desktop we still leave a small margin so the
// contact-shadow of a bottom-row note doesn't clip against the frame.
const FAB_RESERVE_MOBILE = 96;
const FAB_RESERVE_DESKTOP = 24;

// Corkboard background: layered radial gradients approximate cork grain
// without an image asset. Two size-varied dot patterns give the surface a
// non-uniform speckle; the base color is the warm tan of natural cork.
// The wooden frame is drawn with a thick inset ring using CSS gradients.
const CORK_BG =
  "radial-gradient(circle at 20% 30%, rgba(120,72,32,0.18) 0 1.5px, transparent 2px)," +
  "radial-gradient(circle at 70% 65%, rgba(90,50,20,0.22) 0 1.2px, transparent 1.8px)," +
  "radial-gradient(circle at 45% 80%, rgba(140,90,45,0.14) 0 2px, transparent 2.6px)," +
  "radial-gradient(circle at 85% 20%, rgba(100,55,20,0.20) 0 1.4px, transparent 2px)," +
  "radial-gradient(ellipse at 30% 50%, rgba(160,110,60,0.12) 0%, transparent 55%)," +
  "linear-gradient(135deg, #c89768 0%, #b8875a 35%, #a97b4d 65%, #b8875a 100%)";
const CORK_BG_SIZE = "14px 14px, 18px 18px, 22px 22px, 16px 16px, 100% 100%, 100% 100%";

export default function NotesPage() {
  const { data: projects = [] } = useProjects();
  // Sticky notes are attached to a project. Previously we filtered to non-Planning
  // projects only, which meant a brand-new org (all projects in Planning) had no
  // selectable projects and 'Add Note' silently no-op'd. Show every project.
  const selectable = projects;
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const pid = projectId ?? selectable[0]?.id;
  const { data: notes = [] } = useNotes(pid);
  const create = useCreateNote(pid ?? 0);
  const updatePos = useUpdateNotePosition();
  const del = useDeleteNote();
  const addReply = useAddNoteReply();
  const { toast } = useToast();

  const [color, setColor] = useState("amber");
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; offX: number; offY: number } | null>(null);
  // Track the corkboard's current inner width so note sizing + clamping stay
  // responsive to viewport changes (rotation, split-screen, resize).
  const [boardW, setBoardW] = useState<number>(0);
  // Per-note reply drafts, keyed by note id. We keep this in the parent so the
  // input stays in sync across re-renders (useNotes will refetch after each
  // reply is posted) without dropping keystrokes.
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);

  const submitReply = (noteId: number) => {
    const body = (replyDrafts[noteId] ?? "").trim();
    if (!body) return;
    addReply.mutate(
      { id: noteId, body },
      {
        onSuccess: () => {
          setReplyDrafts((d) => ({ ...d, [noteId]: "" }));
        },
        onError: (err: any) => {
          toast({ title: "Couldn't add reply", description: err?.message ?? "Unknown error" });
        },
      },
    );
  };

  // Keep boardW in sync with the actual rendered corkboard width so all the
  // responsive sizing/clamping math below reacts to rotation and resize.
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const measure = () => setBoardW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isMobileBoard = boardW > 0 && boardW < MOBILE_BOARD_PX;
  const NOTE_W = isMobileBoard ? NOTE_W_MOBILE : NOTE_W_DESKTOP;
  const NOTE_H = isMobileBoard ? NOTE_H_MOBILE : NOTE_H_DESKTOP;
  const FAB_RESERVE = isMobileBoard ? FAB_RESERVE_MOBILE : FAB_RESERVE_DESKTOP;

  // On phone-sized boards, ignore stored x/y and lay notes out in a 2-column
  // grid that wraps onto rows below. Stored positions from a wide desktop
  // board would otherwise all clamp to similar mobile x-coords and stack
  // unreadably on top of each other. Column count is fixed at MOBILE_COLS
  // so the layout is predictable across notes; the whole grid is centered
  // horizontally inside the corkboard.
  const mobileLayoutFor = (index: number): { x: number; y: number } => {
    const col = index % MOBILE_COLS;
    const row = Math.floor(index / MOBILE_COLS);
    const gridW = MOBILE_COLS * NOTE_W + (MOBILE_COLS - 1) * MOBILE_GUTTER;
    const leftOffset = Math.max(MOBILE_MARGIN, (boardW - gridW) / 2);
    const x = leftOffset + col * (NOTE_W + MOBILE_GUTTER);
    const y = MOBILE_MARGIN + row * (NOTE_H + MOBILE_GUTTER);
    return { x, y };
  };

  // Clamp any (x, y) note position into the visible board rectangle, minus
  // the note's own footprint and the reserved bottom-right area for the
  // JARVIS FAB. Used both for live-drag and for correcting stored positions
  // that were saved on a wider viewport.
  const clampPos = (x: number, y: number, rect?: { width: number; height: number } | null) => {
    const w = rect?.width ?? boardRef.current?.clientWidth ?? boardW;
    const h = rect?.height ?? boardRef.current?.clientHeight ?? 0;
    if (!w || !h) return { x, y };
    const maxX = Math.max(0, w - NOTE_W);
    const maxY = Math.max(0, h - NOTE_H - FAB_RESERVE);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const raw = { x: e.clientX - rect.left - drag.offX, y: e.clientY - rect.top - drag.offY };
      const clamped = clampPos(raw.x, raw.y, rect);
      setDrag({ ...drag, x: clamped.x, y: clamped.y });
    };
    const onUp = () => {
      if (drag) updatePos.mutate({ id: drag.id, x: Math.round(drag.x), y: Math.round(drag.y) });
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // clampPos closes over boardW / NOTE_W / FAB_RESERVE — safe to re-create
    // whenever those change since the drag state itself doesn't outlive them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, updatePos, boardW]);

  const addNote = () => {
    if (!draft.trim()) return;
    if (pid === undefined) {
      toast({ title: "Pick a project first", description: "Sticky notes attach to a project. Create one under Projects to start jotting." });
      return;
    }
    create.mutate(
      { body: draft.trim(), color },
      {
        onError: (err: any) => {
          toast({ title: "Couldn't add note", description: err?.message ?? "Unknown error" });
        },
      },
    );
    setDraft("");
  };

  return (
    <Layout title="Sticky Board">
      {/* project selector + composer */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project:</span>
        {selectable.length === 0 && (
          <span className="text-xs text-muted-foreground">No projects yet — create one first to attach notes.</span>
        )}
        {selectable.map((p) => (
          <button
            key={p.id}
            onClick={() => setProjectId(p.id)}
            data-testid={`note-project-${p.id}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", pid === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-1.5">
          {COLOR_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => setColor(k)}
              aria-label={`Color ${k}`}
              data-testid={`note-color-${k}`}
              className={cn("size-6 rounded-full ring-2 ring-offset-2 ring-offset-background transition", color === k ? "ring-foreground" : "ring-transparent")}
              style={{ background: NOTE_COLORS[k].bg, boxShadow: `inset 0 0 0 2px ${NOTE_COLORS[k].bar}` }}
            />
          ))}
        </div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          placeholder="Jot a note…"
          data-testid="input-note-body"
          className="h-9 flex-1 rounded-md border border-border bg-muted/40 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          onClick={addNote}
          disabled={!draft.trim() || create.isPending}
          data-testid="button-add-note"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-4" /> {create.isPending ? "Adding…" : "Add Note"}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">Drag notes to reposition · {notes.length} notes</span>
      </div>

      {/* corkboard */}
      <div
        ref={boardRef}
        // On mobile we switch overflow to auto so the vertical stack of
        // notes can scroll instead of colliding with the JARVIS FAB. On
        // desktop we keep overflow hidden so drag-and-drop is bounded by
        // the visible board.
        className={cn(
          "relative h-[calc(100vh-19rem)] min-h-[520px] rounded-xl shadow-inner",
          isMobileBoard ? "overflow-y-auto overflow-x-hidden" : "overflow-hidden",
        )}
        style={{
          backgroundImage: CORK_BG,
          backgroundSize: CORK_BG_SIZE,
          // Wooden frame around the cork — chunky, warm, and slightly darker
          // on the inside so the cork looks recessed into the frame.
          border: "10px solid",
          borderImage: "linear-gradient(135deg, #8b5a2b 0%, #6b3f1a 45%, #8b5a2b 55%, #5a3210 100%) 1",
          boxShadow: "inset 0 0 40px rgba(60, 30, 10, 0.35), 0 6px 18px rgba(0,0,0,0.25)",
        }}
        data-testid="sticky-board"
      >
        {notes.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm font-medium text-white/80 drop-shadow">
            Empty corkboard. Add your first sticky above.
          </div>
        )}
        {notes.map((n, i) => {
          const c = NOTE_COLORS[n.color] ?? NOTE_COLORS.amber;
          const isDragging = drag?.id === n.id;
          // On mobile-sized boards, reflow every note into a single centered
          // column instead of honoring stored x/y (which were set on a wide
          // desktop board and would all clamp to the same spot on a phone,
          // stacking notes on top of each other). On desktop we clamp stored
          // coordinates so a note saved past the current viewport edge still
          // renders inside the frame. Live drags always win.
          const stored = isMobileBoard ? mobileLayoutFor(i) : clampPos(n.x, n.y);
          const x = isDragging ? drag!.x : stored.x;
          const y = isDragging ? drag!.y : stored.y;
          // Give each note a tiny stable rotation so the board looks like
          // real paper stickies, not a rigid grid. Rotation is deterministic
          // per note id so the same sticky doesn't jitter between renders.
          const rot = ((n.id * 37) % 9) - 4; // -4deg .. +4deg
          return (
            <div
              key={n.id}
              onPointerDown={(e) => {
                // Compute the pointer offset relative to the note's clamped
                // render top-left (stored.x/y), NOT the note's current
                // getBoundingClientRect() — that rect reflects the rotated
                // element and would cause a small jump on drop when the note
                // straightens for dragging. Using the clamped position also
                // means picking up a note that was previously off-screen
                // (from an older wider layout) grabs it at its visible spot.
                const boardRect = boardRef.current?.getBoundingClientRect();
                if (!boardRect) return;
                const pointerBoardX = e.clientX - boardRect.left;
                const pointerBoardY = e.clientY - boardRect.top;
                setDrag({
                  id: n.id,
                  x: stored.x, y: stored.y,
                  offX: pointerBoardX - stored.x,
                  offY: pointerBoardY - stored.y,
                });
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              className="absolute cursor-grab touch-none select-none transition-shadow hover:shadow-2xl active:cursor-grabbing"
              style={{
                left: x,
                top: y,
                width: NOTE_W,
                minHeight: NOTE_H,
                background: c.bg,
                color: c.text,
                opacity: isDragging ? 0.95 : 1,
                zIndex: isDragging ? 20 : 1 + (i % 5),
                transform: `rotate(${isDragging ? 0 : rot}deg)`,
                // Layered shadow — a soft ambient drop plus a warmer contact
                // shadow just below the note to sell the "pinned to cork"
                // effect. Slight lift on hover is handled by hover:shadow-2xl.
                boxShadow:
                  "0 1px 2px rgba(0,0,0,0.15), 0 8px 18px rgba(40,20,5,0.35), 0 20px 30px -12px rgba(0,0,0,0.35)",
              }}
              data-testid={`sticky-note-${n.id}`}
            >
              {/* Pushpin */}
              <div
                aria-hidden
                className="absolute left-1/2 top-[-8px] size-4 -translate-x-1/2 rounded-full"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #fff 0 2px, ${c.pin} 3px 100%)`,
                  boxShadow: "0 2px 3px rgba(0,0,0,0.4), inset 0 -2px 3px rgba(0,0,0,0.25)",
                }}
              />
              {/* Colored header bar */}
              <div className="flex items-center justify-between px-3 py-1.5" style={{ background: c.bar }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-white">Note</span>
                <button
                  // Stop the pointerdown on the note itself — otherwise the
                  // parent captures the pointer for dragging and the button's
                  // click never fires.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); del.mutate(n.id); toast({ title: "Note deleted" }); }}
                  aria-label="Delete note"
                  data-testid={`button-delete-note-${n.id}`}
                  className="rounded p-0.5 text-white/80 hover:bg-white/20 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
              <p className="whitespace-pre-wrap break-words px-4 pt-3 text-base font-medium leading-snug">{n.body}</p>
              {/* Replies — each shown with a small signature. Clicks/pointer
                  events here stop propagation so the drag handler on the note
                  doesn't hijack them (otherwise you can't select text or type). */}
              {(() => {
                const replies = parseReplies((n as any).replies);
                if (replies.length === 0) return null;
                return (
                  <div className="mx-4 mt-2 space-y-1.5 border-t border-black/10 pt-2" onPointerDown={(e) => e.stopPropagation()}>
                    {replies.map((r, ri) => (
                      <div key={ri} className="text-sm leading-snug">
                        <div className="flex items-start gap-1.5">
                          <CornerDownRight className="mt-0.5 size-3 shrink-0 opacity-60" />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap break-words">{r.body}</p>
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-60">
                              — {r.initials || r.author}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Reply composer */}
              <div
                className="m-3 mt-2 flex items-center gap-1 rounded border border-black/10 bg-white/40 p-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  value={replyDrafts[n.id] ?? ""}
                  onChange={(e) => setReplyDrafts((d) => ({ ...d, [n.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitReply(n.id);
                    }
                  }}
                  placeholder="Reply…"
                  data-testid={`input-note-reply-${n.id}`}
                  className="h-6 min-w-0 flex-1 bg-transparent px-1 text-xs outline-none placeholder:opacity-60"
                  style={{ color: c.text }}
                  maxLength={500}
                />
                <button
                  onClick={() => submitReply(n.id)}
                  disabled={!(replyDrafts[n.id] ?? "").trim() || addReply.isPending}
                  data-testid={`button-note-reply-${n.id}`}
                  className="inline-flex h-6 items-center rounded px-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-40"
                  style={{ background: c.bar }}
                >
                  Post
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
