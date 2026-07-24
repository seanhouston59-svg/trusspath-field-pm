import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import { useMessages, useCreateMessage, useProjects, useTeamMap } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { data: projects = [] } = useProjects();
  const active = projects.filter((p) => p.status !== "Planning");
  const [projectId, setProjectId] = useState<number | undefined>(undefined);
  const pid = projectId ?? active[0]?.id;
  const team = useTeamMap();
  const { data: messages = [] } = useMessages(pid);
  const create = useCreateMessage(pid ?? 0);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    if (!text.trim() || pid === undefined) return;
    create.mutate(text.trim());
    setText("");
  };

  return (
    <Layout title="Messages">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project:</span>
        {active.map((p) => (
          <button
            key={p.id}
            onClick={() => setProjectId(p.id)}
            data-testid={`msg-project-${p.id}`}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", pid === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100vh-12rem)] flex-col rounded-lg border border-border bg-card shadow-sm">
        {/* thread */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Start the conversation.</p>}
          {messages.map((m, i) => {
            const author = m.authorId ? team.get(m.authorId) : undefined;
            const mine = m.authorId === 1;
            const prev = messages[i - 1];
            const grouped = prev && prev.authorId === m.authorId;
            return (
              <div key={m.id} className={cn("flex gap-3", mine && "flex-row-reverse")} data-testid={`msg-${m.id}`}>
                <div className="shrink-0">
                  {!grouped && author ? <Avatar initials={author.initials} color={author.color} size={32} /> : <span className="block size-8" />}
                </div>
                <div className={cn("max-w-[75%]", mine && "text-right")}>
                  {!grouped && (
                    <div className={cn("mb-0.5 text-xs text-muted-foreground", mine && "text-primary")}>
                      {author?.name ?? "Unknown"} · {timeAgo(m.createdAt)}
                    </div>
                  )}
                  <div className={cn("inline-block rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted text-foreground")}>
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* composer */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={1}
              placeholder="Write a message… (Enter to send)"
              data-testid="input-message"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={submit}
              disabled={!text.trim() || create.isPending}
              data-testid="button-send-message"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Send className="size-4" /> Send
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
