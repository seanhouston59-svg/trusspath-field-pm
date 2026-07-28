import { useEffect, useRef, useState } from "react";
import { Plus, X, CornerDownRight, Sparkles } from "lucide-react";
import { Layout } from "@/components/layout";
import { useNotes, useCreateNote, useUpdateNotePosition, useDeleteNote, useAddNoteReply } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// Sticker library — decorative-only emoji you pin to the corkboard.
// Grouped into three tabs the picker cycles through. Each sticker's `emoji`
// is stored as the note's `body` when created (with `type='sticker'`), so
// no separate table or endpoint is needed. Labels are picker-only tooltips;
// they are NOT persisted on the sticker itself so the emoji stays large
// and decorative on the board.
type StickerCategory = { key: string; label: string; stickers: { emoji: string; label: string }[] };
const STICKER_CATEGORIES: StickerCategory[] = [
  {
    key: "birthdays",
    label: "Birthdays",
    stickers: [
      { emoji: "🎂", label: "Birthday cake" },
      { emoji: "🎈", label: "Balloon" },
      { emoji: "🎉", label: "Party popper" },
      { emoji: "🎊", label: "Confetti" },
      { emoji: "🥳", label: "Party face" },
      { emoji: "🎁", label: "Gift" },
      { emoji: "🍰", label: "Cake slice" },
      { emoji: "🧁", label: "Cupcake" },
      { emoji: "🍾", label: "Champagne" },
      { emoji: "⭐", label: "Star" },
    ],
  },
  {
    key: "events",
    label: "Events",
    stickers: [
      { emoji: "🏗️", label: "Groundbreaking" },
      { emoji: "🔨", label: "Milestone" },
      { emoji: "🏆", label: "Trophy" },
      { emoji: "🍽️", label: "Team dinner" },
      { emoji: "🍻", label: "Beers" },
      { emoji: "🚀", label: "Launch" },
      { emoji: "📅", label: "Meeting" },
      { emoji: "🔥", label: "Fire" },
      { emoji: "💡", label: "Idea" },
      { emoji: "👏", label: "Kudos" },
    ],
  },
  {
    key: "holidays",
    label: "Holidays",
    stickers: [
      { emoji: "🎅", label: "Santa" },
      { emoji: "🎄", label: "Christmas tree" },
      { emoji: "🎃", label: "Jack-o-lantern" },
      { emoji: "👻", label: "Ghost" },
      { emoji: "🦃", label: "Turkey" },
      { emoji: "🍂", label: "Fall leaf" },
      { emoji: "🇺🇸", label: "USA" },
      { emoji: "🎇", label: "Fireworks" },
      { emoji: "❄️", label: "Snowflake" },
      { emoji: "💝", label: "Valentine" },
      { emoji: "☘️", label: "Shamrock" },
      { emoji: "🐣", label: "Easter" },
    ],
  },
];

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
  // Sticky Board is org-wide: one universal corkboard shared by every user
  // in the organization. No project selector; the server scopes notes by the
  // caller's org (see /api/notes handler + storage.getNotesForOrg).
  const { data: notes = [] } = useNotes();
  const create = useCreateNote();
  const updatePos = useUpdateNotePosition();
  const del = useDeleteNote();
  const addReply = useAddNoteReply();
  const { toast } = useToast();

  const [color, setColor] = useState("amber");
  const [draft, setDraft] = useState("");
  // Sticker picker is a small popover next to the composer. When open, users
  // click any emoji tile to instantly pin it on a random spot on the board.
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerCategory, setStickerCategory] = useState<string>(STICKER_CATEGORIES[0].key);
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
    create.mutate(
      { body: draft.trim(), color, type: "note" },
      {
        onError: (err: any) => {
          toast({ title: "Couldn't add note", description: err?.message ?? "Unknown error" });
        },
      },
    );
    setDraft("");
  };

  // Pin a decorative sticker on the corkboard. Position is a random spot
  // inside the current board bounds (respecting the JARVIS reserve) so
  // stickers don't all pile up in the same corner. `color` is unused for
  // stickers but the schema still requires it — send a harmless default.
  const addSticker = (emoji: string) => {
    const w = boardRef.current?.clientWidth ?? 800;
    const h = boardRef.current?.clientHeight ?? 500;
    const stickerSize = 96;
    const randX = Math.round(Math.random() * Math.max(0, w - stickerSize));
    const randY = Math.round(Math.random() * Math.max(0, h - stickerSize - 60));
    create.mutate(
      { body: emoji, color: "amber", type: "sticker", x: randX, y: randY },
      {
        onError: (err: any) => {
          toast({ title: "Couldn't add sticker", description: err?.message ?? "Unknown error" });
        },
      },
    );
    setStickerPickerOpen(false);
  };

  // Split notes vs stickers up front. Notes get the 2-column mobile grid;
  // stickers keep their stored x/y so a Halloween pumpkin someone placed in
  // the top-right stays roughly there (clamped to the visible frame).
  const stickyNotes = notes.filter((n: any) => (n.type ?? "note") !== "sticker");
  const stickers = notes.filter((n: any) => (n.type ?? "note") === "sticker");
  const activeCategory = STICKER_CATEGORIES.find((c) => c.key === stickerCategory) ?? STICKER_CATEGORIES[0];

  return (
    <Layout title="Sticky Board">
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
        {/* Sticker picker: a popover with 3 categories — Birthdays, Events,
            Holidays. Clicking any emoji pins it as a decorative sticker on
            the corkboard at a random position. */}
        <div className="relative">
          <button
            onClick={() => setStickerPickerOpen((v) => !v)}
            data-testid="button-open-stickers"
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
              stickerPickerOpen ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-foreground hover:bg-muted",
            )}
            aria-label="Add sticker"
            aria-expanded={stickerPickerOpen}
          >
            <Sparkles className="size-4" /> Stickers
          </button>
          {stickerPickerOpen && (
            <>
              {/* Click-outside guard so the popover closes when you tap the
                  page. Sits BELOW the popover in the z-order. */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setStickerPickerOpen(false)}
                data-testid="sticker-picker-scrim"
              />
              <div
                className="absolute right-0 top-11 z-40 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg"
                data-testid="sticker-picker"
              >
                <div className="mb-2 flex gap-1">
                  {STICKER_CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setStickerCategory(cat.key)}
                      data-testid={`sticker-cat-${cat.key}`}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                        stickerCategory === cat.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {activeCategory.stickers.map((s) => (
                    <button
                      key={s.emoji}
                      onClick={() => addSticker(s.emoji)}
                      title={s.label}
                      aria-label={s.label}
                      data-testid={`sticker-${s.emoji}`}
                      className="flex aspect-square items-center justify-center rounded-md text-2xl transition-colors hover:bg-muted"
                    >
                      {s.emoji}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Everyone in your org sees the board.</p>
              </div>
            </>
          )}
        </div>
        <span className="ml-auto text-xs text-muted-foreground">Drag to reposition · {stickyNotes.length} notes · {stickers.length} stickers</span>
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
        {stickyNotes.map((n, i) => {
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

        {/* Stickers — decorative emoji pinned to the board. Draggable, tap
            to remove. Sized larger than a favicon so they read as real party
            stickers. Uses their own drag closure that shares `drag` state
            with the notes above (same setter, same clamp). */}
        {stickers.map((n) => {
          const isDragging = drag?.id === n.id;
          const STICKER_SIZE = isMobileBoard ? 72 : 88;
          // Stickers keep their stored (x, y). We still clamp so a sticker
          // pinned at x=1000 on a wide screen doesn't hang off a phone.
          const w = boardRef.current?.clientWidth ?? boardW;
          const h = boardRef.current?.clientHeight ?? 0;
          const maxX = Math.max(0, w - STICKER_SIZE);
          const maxY = Math.max(0, h - STICKER_SIZE - FAB_RESERVE);
          const clampedX = Math.max(0, Math.min(maxX, n.x));
          const clampedY = Math.max(0, Math.min(maxY, n.y));
          const x = isDragging ? drag!.x : clampedX;
          const y = isDragging ? drag!.y : clampedY;
          const rot = ((n.id * 41) % 15) - 7; // -7°..+7° for playful tilt
          return (
            <div
              key={`s-${n.id}`}
              onPointerDown={(e) => {
                const boardRect = boardRef.current?.getBoundingClientRect();
                if (!boardRect) return;
                const pointerBoardX = e.clientX - boardRect.left;
                const pointerBoardY = e.clientY - boardRect.top;
                setDrag({
                  id: n.id,
                  x: clampedX, y: clampedY,
                  offX: pointerBoardX - clampedX,
                  offY: pointerBoardY - clampedY,
                });
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                del.mutate(n.id);
                toast({ title: "Sticker removed" });
              }}
              className="group absolute flex cursor-grab select-none items-center justify-center touch-none text-4xl leading-none active:cursor-grabbing"
              style={{
                left: x,
                top: y,
                width: STICKER_SIZE,
                height: STICKER_SIZE,
                fontSize: isMobileBoard ? "48px" : "60px",
                opacity: isDragging ? 0.9 : 1,
                zIndex: isDragging ? 25 : 10,
                transform: `rotate(${isDragging ? 0 : rot}deg)`,
                filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.35))",
              }}
              title="Double-click to remove"
              data-testid={`sticker-instance-${n.id}`}
            >
              <span aria-hidden>{n.body}</span>
              {/* Delete button appears on hover (or always on touch). */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); del.mutate(n.id); toast({ title: "Sticker removed" }); }}
                aria-label="Remove sticker"
                data-testid={`button-delete-sticker-${n.id}`}
                className="absolute -right-1 -top-1 hidden size-5 items-center justify-center rounded-full bg-black/60 text-white transition-opacity group-hover:flex"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
