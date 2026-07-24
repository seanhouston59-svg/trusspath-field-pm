import { useState } from "react";
import { Plus, Maximize2, Download, Eye, Minimize2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBlueprints, useTeamMap, useProjects, useTeam, useCreateBlueprint } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Blueprint } from "@shared/schema";

const DISCIPLINE_TINT: Record<string, string> = {
  Architectural: "text-sky-300 border-sky-400/40 bg-sky-400/10",
  Structural: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  Mechanical: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  Electrical: "text-violet-300 border-violet-400/40 bg-violet-400/10",
  Civil: "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
};

const STATUS_TINT: Record<string, string> = {
  Current: "text-emerald-400 bg-emerald-400/10",
  "Under Review": "text-amber-400 bg-amber-400/10",
  Superseded: "text-muted-foreground bg-muted",
};

export default function BlueprintsPage() {
  const { data: sheets = [], isLoading } = useBlueprints();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projName = (id: number) => projects.find((p) => p.id === id)?.name ?? "";
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateBlueprint();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Blueprint | null>(null);
  const [fs, setFs] = useState(false);

  const fields: FieldDef[] = [
    { name: "projectId", label: "Project", type: "select", options: projectOptions, required: true, half: true },
    { name: "sheetNumber", label: "Sheet number", type: "text", required: true, half: true, placeholder: "A-101" },
    { name: "title", label: "Sheet title", type: "text", required: true, placeholder: "Floor Plans — Level 1" },
    { name: "discipline", label: "Discipline", type: "select", options: ["Architectural", "Structural", "Mechanical", "Electrical", "Civil"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "revision", label: "Revision", type: "text", required: true, half: true, placeholder: "Rev C" },
    { name: "status", label: "Status", type: "select", options: ["Current", "Under Review", "Superseded"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "uploadedById", label: "Uploaded by", type: "select", options: teamOptions, half: true },
    { name: "date", label: "Date", type: "date", required: true, half: true },
  ];

  return (
    <Layout title="Blueprints" actions={
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-blueprint"><Plus className="size-4" /> Upload Sheet</Button>
    }>
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title="Upload Blueprint"
        fields={fields}
        defaults={{ discipline: "Architectural", status: "Current", uploadedById: "0" }}
        submitLabel="Upload Sheet"
        isPending={create.isPending}
        onSubmit={(v) => create.mutateAsync({
          projectId: Number(v.projectId),
          sheetNumber: String(v.sheetNumber),
          title: String(v.title),
          discipline: String(v.discipline),
          revision: String(v.revision),
          status: String(v.status),
          uploadedById: v.uploadedById === "0" ? undefined : Number(v.uploadedById),
          date: String(v.date),
          hue: Math.floor(Math.random() * 360),
        })}
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sheets.map((s) => {
            const up = s.uploadedById ? team.get(s.uploadedById) : undefined;
            return (
              <div key={s.id} onClick={() => { setFs(false); setViewing(s); }} className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md" data-testid={`card-blueprint-${s.id}`}>
                {/* blueprint thumbnail */}
                <div
                  className="relative flex h-44 items-center justify-center overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, hsl(${s.hue} 48% 20%), hsl(${s.hue} 55% 12%))`,
                    backgroundImage: `linear-gradient(hsl(${s.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(90deg, hsl(${s.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(135deg, hsl(${s.hue} 48% 20%), hsl(${s.hue} 55% 12%))`,
                    backgroundSize: "22px 22px, 22px 22px, 100% 100%",
                  }}
                >
                  <div className="text-center">
                    <div className="font-mono text-3xl font-bold tracking-tight text-white/90">{s.sheetNumber}</div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/50">{s.discipline}</div>
                  </div>
                  <Maximize2 className="absolute right-2 top-2 size-4 text-white/0 transition group-hover:text-white/70" />
                  <span className={cn("absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold", STATUS_TINT[s.status] ?? "text-muted-foreground bg-muted")}>{s.status}</span>
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", DISCIPLINE_TINT[s.discipline] ?? "text-muted-foreground border-border bg-muted")}>{s.discipline}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.revision}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-snug">{s.title}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{projName(s.projectId)}</span>
                    <span className="tabular">{shortDate(s.date)}</span>
                  </div>
                  {up && <div className="mt-1 truncate text-[11px] text-muted-foreground">by {up.name}</div>}
                  <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => { setFs(false); setViewing(s); }} data-testid={`button-blueprint-view-${s.id}`}>
                    <Eye className="size-3.5" /> View now
                  </Button>
                </div>
              </div>
            );
          })}
          {sheets.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No sheets uploaded yet.</div>}
        </div>
      )}

      <Dialog open={!!viewing && !fs} onOpenChange={(o) => { if (!o) { setViewing(null); setFs(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{viewing?.sheetNumber}</span>
              <span className="font-normal text-muted-foreground">· {viewing?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div
                className="relative flex h-72 items-center justify-center overflow-hidden rounded-lg"
                style={{
                  backgroundImage: `linear-gradient(hsl(${viewing.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(90deg, hsl(${viewing.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(135deg, hsl(${viewing.hue} 48% 20%), hsl(${viewing.hue} 55% 12%))`,
                  backgroundSize: "24px 24px, 24px 24px, 100% 100%",
                }}
              >
                <div className="text-center">
                  <div className="font-mono text-5xl font-bold tracking-tight text-white/90">{viewing.sheetNumber}</div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-widest text-white/50">{viewing.discipline}</div>
                </div>
                <span className={cn("absolute left-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold", STATUS_TINT[viewing.status] ?? "text-muted-foreground bg-muted")}>{viewing.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  { l: "Discipline", v: viewing.discipline },
                  { l: "Revision", v: viewing.revision },
                  { l: "Status", v: viewing.status },
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Date", v: shortDate(viewing.date) },
                  { l: "Uploaded by", v: viewing.uploadedById ? (team.get(viewing.uploadedById)?.name ?? "—") : "—" },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="ff-kicker text-[9px] text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setFs(true)} data-testid="button-blueprint-fullscreen">
                  <Maximize2 className="size-4" /> Full screen
                </Button>
                <Button variant="outline" size="sm" onClick={() => toast({ title: "Preparing download…", description: `${viewing.sheetNumber} ${viewing.title}` })} data-testid="button-blueprint-download">
                  <Download className="size-4" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {fs && viewing && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" data-testid="blueprint-fullscreen">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-semibold">{viewing.sheetNumber}</span>
              <span className="truncate text-sm text-muted-foreground">· {viewing.title}</span>
              <span className={cn("ml-1 rounded px-2 py-0.5 text-[10px] font-semibold", STATUS_TINT[viewing.status] ?? "text-muted-foreground bg-muted")}>{viewing.status}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast({ title: "Preparing download…", description: `${viewing.sheetNumber} ${viewing.title}` })}>
                <Download className="size-4" /> Download
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFs(false)} data-testid="button-blueprint-exit-fullscreen">
                <Minimize2 className="size-4" /> Exit full screen
              </Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div
              className="relative flex flex-1 items-center justify-center overflow-hidden"
              style={{
                backgroundImage: `linear-gradient(hsl(${viewing.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(90deg, hsl(${viewing.hue} 60% 90% / 0.10) 1px, transparent 1px), linear-gradient(135deg, hsl(${viewing.hue} 48% 20%), hsl(${viewing.hue} 55% 12%))`,
                backgroundSize: "32px 32px, 32px 32px, 100% 100%",
              }}
            >
              <div className="text-center">
                <div className="font-mono text-7xl font-bold tracking-tight text-white/90">{viewing.sheetNumber}</div>
                <div className="mt-3 font-mono text-sm uppercase tracking-widest text-white/50">{viewing.discipline}</div>
                <div className="mt-1 text-xs text-white/30">{viewing.title}</div>
              </div>
            </div>
            <div className="hidden w-64 shrink-0 border-l border-border p-4 sm:block">
              <div className="grid grid-cols-1 gap-3 text-sm">
                {[
                  { l: "Discipline", v: viewing.discipline },
                  { l: "Revision", v: viewing.revision },
                  { l: "Status", v: viewing.status },
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Date", v: shortDate(viewing.date) },
                  { l: "Uploaded by", v: viewing.uploadedById ? (team.get(viewing.uploadedById)?.name ?? "—") : "—" },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="ff-kicker text-[9px] text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
