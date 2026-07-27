import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MapPin, Calendar, Building2, Plus, ExternalLink, FolderKanban } from "lucide-react";
import { Layout } from "@/components/layout";
import { GhostState, GhostProjectCards } from "@/components/ghost-state";
import { ProjectStatusBadge, Progress } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useProjects, useTeamMap, useTeam, useCreateProject } from "@/hooks/use-data";
import { formatCurrency, shortDate } from "@/lib/format";
import { googleMapsUrl } from "@/lib/maps";
import { Button } from "@/components/ui/button";

const TYPE_TINT: Record<string, string> = {
  Healthcare: "bg-sky-500/10", Commercial: "bg-violet-500/10", Education: "bg-emerald-500/10", Residential: "bg-amber-500/10",
};

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const team = useTeamMap();
  const { data: teamList = [] } = useTeam();
  const create = useCreateProject();
  const [open, setOpen] = useState(false);

  // Auto-open create dialog when navigated with ?new=1.
  //
  // The app uses wouter's useHashLocation, which strips the query string —
  // e.g. for URL "/#/projects?new=1", useLocation() returns just "/projects".
  // So we can't rely on the wouter location; we read the raw hash and parse
  // it ourselves. We also listen for hashchange so navigating back to
  // "/#/projects?new=1" from within the app re-opens the dialog.
  useEffect(() => {
    const checkAndOpen = () => {
      const hash = window.location.hash || "";
      const qIdx = hash.indexOf("?");
      if (qIdx === -1) return;
      const params = new URLSearchParams(hash.slice(qIdx + 1));
      if (params.get("new") === "1") {
        setOpen(true);
        // Clean up the URL so a manual reload doesn't reopen the dialog
        // and so closing the dialog leaves a clean history entry.
        const cleanHash = hash.slice(0, qIdx);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${cleanHash}`);
      }
    };
    checkAndOpen();
    window.addEventListener("hashchange", checkAndOpen);
    return () => window.removeEventListener("hashchange", checkAndOpen);
  }, []);

  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];

  const fields: FieldDef[] = [
    { name: "number", label: "Project #", type: "info", info: "Auto-generated as PRJ-001, PRJ-002, ...", half: true },
    { name: "name", label: "Project Name", type: "text", required: true, half: true },
    { name: "client", label: "Client", type: "text", required: true, half: true },
    { name: "type", label: "Type", type: "select", options: ["Commercial", "Residential", "Healthcare", "Education", "Industrial", "Civic"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["Planning", "Active", "On Hold", "Complete"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "address", label: "Address", type: "textarea", required: true },
    { name: "startDate", label: "Start Date", type: "date", required: true, half: true },
    { name: "endDate", label: "End Date", type: "date", required: true, half: true },
    { name: "budget", label: "Budget ($)", type: "number", required: true, half: true },
    { name: "progress", label: "Progress (%)", type: "number", required: true, half: true },
    { name: "superintendentId", label: "Superintendent", type: "select", options: teamOptions, half: true },
  ];

  return (
    <Layout title="Projects" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-project"><Plus className="size-4" /> New Project</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="New Project"
        fields={fields}
        defaults={{ status: "Planning", type: "Commercial", budget: 0, spent: 0, progress: 0, superintendentId: "0" }}
        submitLabel="Create Project"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          name: String(v.name),
          number: "auto",
          client: String(v.client),
          type: String(v.type),
          status: String(v.status),
          address: String(v.address),
          startDate: String(v.startDate),
          endDate: String(v.endDate),
          budget: Number(v.budget),
          spent: 0,
          progress: Number(v.progress),
          superintendentId: v.superintendentId === "0" ? undefined : Number(v.superintendentId),
        })}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : projects.length === 0 ? (
        <div>
          <GhostProjectCards />
          <div className="mt-4">
            <GhostState
              title="No projects yet"
              description="The sample cards above show what your projects will look like. Create your first project to get started."
              icon={FolderKanban}
              ctaLabel="Create project"
              ctaHref="/projects?new=1"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const sup = p.superintendentId ? team.get(p.superintendentId) : undefined;
            const pct = Math.round((p.spent / p.budget) * 100);
            const overBudget = pct > 95;
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                data-testid={`project-card-${p.id}`}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover-elevate"
              >
                <div className={`relative h-20 border-b border-border ${TYPE_TINT[p.type] ?? "bg-primary/5"}`}>
                  <div className="absolute inset-0 flex items-end justify-between p-3">
                    <span className="font-mono text-xs font-semibold text-foreground/70">{p.number}</span>
                    <ProjectStatusBadge status={p.status} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-base font-bold leading-tight tracking-tight">{p.name}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="size-3.5" /> {p.client}
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    {(() => {
                      const maps = googleMapsUrl(p.address);
                      if (!maps) return (
                        <span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {p.address}</span>
                      );
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(maps, "_blank", "noopener,noreferrer");
                          }}
                          title="Open in Google Maps"
                          aria-label={`Open ${p.address} in Google Maps`}
                          data-testid={`link-address-${p.id}`}
                          className="group -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 text-left text-muted-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MapPin className="size-3.5 shrink-0" />
                          <span className="truncate underline-offset-2 group-hover:underline">{p.address}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                        </button>
                      );
                    })()}
                    <span className="flex items-center gap-1.5"><Calendar className="size-3.5" /> {shortDate(p.startDate)} – {shortDate(p.endDate)}</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Budget used</span>
                      <span className={`font-semibold tabular ${overBudget ? "text-amber-500" : "text-foreground"}`}>
                        {formatCurrency(p.spent, { compact: true })} / {formatCurrency(p.budget, { compact: true })}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <Progress value={p.progress} tone={overBudget ? "warning" : "primary"} />
                      <span className="w-9 shrink-0 text-right text-xs font-medium tabular text-muted-foreground">{p.progress}%</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">{p.type}</span>
                    {sup && (
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Supt.</span>
                        <span className="size-6 rounded-full bg-primary/15 text-[10px] font-semibold leading-6 text-primary">{sup.initials}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
