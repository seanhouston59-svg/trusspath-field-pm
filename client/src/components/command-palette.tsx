import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { APP_NAV } from "@shared/app-manifest";
import {
  useProjects,
  useTasks,
  useRfis,
  useSubmittals,
  useChangeOrders,
  usePunchItems,
  useDailyLogs,
  usePhotos,
  useDocuments,
  useTeam,
  useContacts,
} from "@/hooks/use-data";
import {
  LayoutDashboard, StickyNote, FolderKanban, CalendarRange, GanttChartSquare,
  ListChecks, CheckSquare, HelpCircle, FileStack, GitPullRequestArrow,
  ClipboardList, Image as ImageIcon, FileText, PencilRuler, Wrench, Camera,
  Users, Contact, MessagesSquare, Plug, Settings, ArrowRight,
} from "lucide-react";

// Match nav icon keys to actual components
const NAV_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, StickyNote, FolderKanban, CalendarRange, GanttChartSquare,
  ListChecks, CheckSquare, HelpCircle, FileStack, GitPullRequestArrow,
  ClipboardList, Image: ImageIcon, FileText, PencilRuler, Wrench, Camera,
  Users, Contact, MessagesSquare, Plug, Settings,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  // React Query dedupes with the pages that already fetched these lists,
  // so the palette shares cache and doesn't refire requests.
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: rfis = [] } = useRfis();
  const { data: submittals = [] } = useSubmittals();
  const { data: changeOrders = [] } = useChangeOrders();
  const { data: punch = [] } = usePunchItems();
  const { data: logs = [] } = useDailyLogs();
  const { data: photos = [] } = usePhotos();
  const { data: documents = [] } = useDocuments();
  const { data: team = [] } = useTeam();
  const { data: contacts = [] } = useContacts();

  // reset query when opened
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const projectName = (id?: number | null) => projects.find((p) => p.id === id)?.name ?? "";

  function go(href: string) {
    setLocation(href);
    onOpenChange(false);
  }

  // Flatten all nav items
  const navItems = useMemo(() => {
    const out: { href: string; label: string; group: string; icon?: string }[] = [];
    for (const g of APP_NAV) {
      for (const it of g.items) out.push({ href: it.href, label: it.label, group: g.title, icon: it.icon });
    }
    return out;
  }, []);

  const hasQuery = query.trim().length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search projects, tasks, RFIs, submittals, docs, people…"
        value={query}
        onValueChange={setQuery}
        data-testid="input-command-palette"
      />
      <CommandList className="max-h-[65vh]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Navigation always shown */}
        <CommandGroup heading="Jump to">
          {navItems.map((n) => {
            const Icon = n.icon && NAV_ICONS[n.icon] ? NAV_ICONS[n.icon] : ArrowRight;
            return (
              <CommandItem
                key={`nav-${n.href}`}
                value={`${n.label} ${n.group}`}
                onSelect={() => go(n.href)}
                data-testid={`cmd-nav-${n.href.replace(/\W+/g, "-")}`}
              >
                <Icon className="mr-2 size-4 text-muted-foreground" />
                <span>{n.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{n.group}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {hasQuery && (
          <>
            <CommandSeparator />
            {projects.length > 0 && (
              <CommandGroup heading="Projects">
                {projects.map((p) => (
                  <CommandItem
                    key={`proj-${p.id}`}
                    value={`${p.name} ${p.number ?? ""} ${p.client ?? ""} project`}
                    onSelect={() => go(`/projects/${p.id}`)}
                  >
                    <FolderKanban className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.number ? `${p.number} · ` : ""}{p.client ?? ""}
                      </div>
                    </div>
                    {p.status && (
                      <span className="ml-2 shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.status}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {tasks.map((t) => (
                  <CommandItem
                    key={`task-${t.id}`}
                    value={`${t.title} ${t.trade ?? ""} ${projectName(t.projectId)} task`}
                    onSelect={() => go(`/tasks`)}
                  >
                    <ListChecks className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{t.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {projectName(t.projectId)}{t.trade ? ` · ${t.trade}` : ""}
                      </div>
                    </div>
                    {t.status && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{t.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {rfis.length > 0 && (
              <CommandGroup heading="RFIs">
                {rfis.map((r) => (
                  <CommandItem
                    key={`rfi-${r.id}`}
                    value={`${r.number ?? ""} ${r.subject ?? ""} ${projectName(r.projectId)} rfi`}
                    onSelect={() => go(`/rfis`)}
                  >
                    <HelpCircle className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{r.number ? `${r.number} — ` : ""}{r.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">{projectName(r.projectId)}</div>
                    </div>
                    {r.status && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{r.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {submittals.length > 0 && (
              <CommandGroup heading="Submittals">
                {submittals.map((s) => (
                  <CommandItem
                    key={`sub-${s.id}`}
                    value={`${s.number ?? ""} ${s.subject ?? ""} ${s.type ?? ""} ${projectName(s.projectId)} submittal`}
                    onSelect={() => go(`/submittals`)}
                  >
                    <FileStack className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{s.number ? `${s.number} — ` : ""}{s.subject}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {projectName(s.projectId)}{s.type ? ` · ${s.type}` : ""}
                      </div>
                    </div>
                    {s.status && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{s.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {changeOrders.length > 0 && (
              <CommandGroup heading="Change Orders">
                {changeOrders.map((c) => (
                  <CommandItem
                    key={`co-${c.id}`}
                    value={`${c.number ?? ""} ${c.title ?? ""} ${projectName(c.projectId)} change order`}
                    onSelect={() => go(`/change-orders`)}
                  >
                    <GitPullRequestArrow className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.number ? `${c.number} — ` : ""}{c.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{projectName(c.projectId)}</div>
                    </div>
                    {c.status && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{c.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {punch.length > 0 && (
              <CommandGroup heading="Punch List">
                {punch.map((p) => (
                  <CommandItem
                    key={`punch-${p.id}`}
                    value={`${p.title ?? ""} ${p.trade ?? ""} ${projectName(p.projectId)} punch`}
                    onSelect={() => go(`/punch`)}
                  >
                    <CheckSquare className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{p.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {projectName(p.projectId)}{p.location ? ` · ${p.location}` : ""}
                      </div>
                    </div>
                    {p.status && (
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.status}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {logs.length > 0 && (
              <CommandGroup heading="Daily Logs">
                {logs.slice(0, 20).map((l) => (
                  <CommandItem
                    key={`log-${l.id}`}
                    value={`${l.summary ?? ""} ${l.date ?? ""} ${projectName(l.projectId)} log`}
                    onSelect={() => go(`/daily-logs`)}
                  >
                    <ClipboardList className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{l.summary || `Log ${l.date ?? ""}`}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {l.date ?? ""}{l.date ? " · " : ""}{projectName(l.projectId)}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {photos.length > 0 && (
              <CommandGroup heading="Photos">
                {photos.slice(0, 20).map((p) => (
                  <CommandItem
                    key={`photo-${p.id}`}
                    value={`${p.caption ?? ""} ${p.location ?? ""} ${projectName(p.projectId)} photo`}
                    onSelect={() => go(`/photos`)}
                  >
                    <ImageIcon className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{p.caption || "Untitled photo"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {projectName(p.projectId)}{p.location ? ` · ${p.location}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {documents.length > 0 && (
              <CommandGroup heading="Documents">
                {documents.slice(0, 20).map((d) => (
                  <CommandItem
                    key={`doc-${d.id}`}
                    value={`${d.name ?? ""} ${d.type ?? ""} ${projectName(d.projectId)} document`}
                    onSelect={() => go(`/documents`)}
                  >
                    <FileText className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{d.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {projectName(d.projectId)}{d.type ? ` · ${d.type}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {team.length > 0 && (
              <CommandGroup heading="Team">
                {team.map((m) => (
                  <CommandItem
                    key={`team-${m.id}`}
                    value={`${m.name ?? ""} ${m.email ?? ""} ${m.role ?? ""} ${m.trade ?? ""} team`}
                    onSelect={() => go(`/team`)}
                  >
                    <Users className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{m.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.role ?? ""}{m.company ? ` · ${m.company}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {contacts.length > 0 && (
              <CommandGroup heading="Contacts">
                {contacts.map((c) => (
                  <CommandItem
                    key={`contact-${c.id}`}
                    value={`${c.name ?? ""} ${c.email ?? ""} ${c.company ?? ""} ${c.role ?? ""} contact`}
                    onSelect={() => go(`/contacts`)}
                  >
                    <Contact className="mr-2 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.role ?? ""}{c.company ? ` · ${c.company}` : ""}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}

        {!hasQuery && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Tips">
              <CommandItem value="tip" disabled>
                <span className="text-xs text-muted-foreground">
                  Type to search across projects, tasks, RFIs, submittals, change orders, punch, logs, photos, docs, people.
                </span>
                <CommandShortcut>⌘K</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
