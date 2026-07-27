import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Layout } from "@/components/layout";
import { useNotes, useCreateNote, useUpdateNotePosition, useDeleteNote, useProjects } from "@/hooks/use-data";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const NOTE_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  amber: { bg: "#fef3c7", bar: "#e07412", text: "#5c2e07" },
  blue: { bg: "#dbeafe", bar: "#2f7fd4", text: "#0c3a66" },
  emerald: { bg: "#d1fae5", bar: "#1f9d6b", text: "#064e3b" },
  rose: { bg: "#ffe4e6", bar: "#e0457b", text: "#6b0f2a" },
  violet: { bg: "#ede9fe", bar: "#7c5cff", text: "#2e1065" },
};
const COLOR_KEYS = Object.keys(NOTE_COLORS);

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
  const { toast } = useToast();

  const [color, setColor] = useState("amber");
  const [draft, setDraft] = useState("");
  const [drag, setDrag] = useState<{ id: number; x: number; y: number; offX: number; offY: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(rect.width - 180, e.clientX - rect.left - drag.offX));
      const y = Math.max(0, Math.min(rect.height - 150, e.clientY - rect.top - drag.offY));
      setDrag({ ...drag, x, y });
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
  }, [drag, updatePos]);

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

      {/* board */}
      <div
        ref={boardRef}
        className="relative h-[calc(100vh-19rem)] min-h-[420px] overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm"
        data-testid="sticky-board"
      >
        {notes.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No notes yet. Add your first sticky above.</div>
        )}
        {notes.map((n) => {
          const c = NOTE_COLORS[n.color] ?? NOTE_COLORS.amber;
          const isDragging = drag?.id === n.id;
          const x = isDragging ? drag!.x : n.x;
          const y = isDragging ? drag!.y : n.y;
          return (
            <div
              key={n.id}
              onPointerDown={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setDrag({ id: n.id, x: n.x, y: n.y, offX: e.clientX - rect.left, offY: e.clientY - rect.top });
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              className="absolute w-[180px] cursor-grab touch-none select-none shadow-md transition-shadow hover:shadow-lg active:cursor-grabbing"
              style={{ left: x, top: y, background: c.bg, color: c.text, opacity: isDragging ? 0.9 : 1, zIndex: isDragging ? 20 : 1 }}
              data-testid={`sticky-note-${n.id}`}
            >
              <div className="flex items-center justify-between px-3 py-1" style={{ background: c.bar }}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white">Note</span>
                <button
                  onClick={(e) => { e.stopPropagation(); del.mutate(n.id); toast({ title: "Note deleted" }); }}
                  aria-label="Delete note"
                  data-testid={`button-delete-note-${n.id}`}
                  className="text-white/80 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="p-3 text-sm font-medium leading-snug">{n.body}</p>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
