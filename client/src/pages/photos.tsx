import { useState } from "react";
import { Plus, MapPin, Camera, Eye, Maximize2, Minimize2, Download, Trash2, UploadCloud, FileWarning } from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import { usePhotos, useTeamMap, useProjects, useTeam, useCreatePhoto, useDeletePhoto } from "@/hooks/use-data";
import type { Photo } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { apiUrl } from "@/lib/queryClient";
import { shortDate } from "@/lib/format";
import { googleMapsUrlForLocation } from "@/lib/maps";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);
const isImage = (m?: string | null) => !!m && IMAGE_TYPES.has(m);
const photoUrl = (id: number) => apiUrl(`/api/photos/${id}/file`);

/** Show the actual uploaded image, or a styled fallback placeholder when none. */
function PhotoImage({ photo, className }: { photo: Photo; className?: string }) {
  if (isImage(photo.mimeType)) {
    return <img src={photoUrl(photo.id)} alt={photo.caption} className={`${className ?? ""} h-full w-full object-cover`} />;
  }
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{
        backgroundImage: `linear-gradient(hsl(${photo.hue} 60% 90% / 0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(${photo.hue} 60% 90% / 0.08) 1px, transparent 1px), linear-gradient(135deg, hsl(${photo.hue} 55% 28%), hsl(${(photo.hue + 40) % 360} 60% 45%))`,
        backgroundSize: "24px 24px, 24px 24px, 100% 100%",
      }}
    >
      <div className="flex flex-col items-center gap-1 text-white/80">
        <FileWarning className="size-6" />
        <span className="text-[10px] font-medium">No source image uploaded</span>
      </div>
    </div>
  );
}

export default function PhotosPage() {
  const { data: photos = [], isLoading } = usePhotos();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projName = (id: number) => projects.find((p) => p.id === id)?.name ?? "";
  const projAddress = (id: number) => projects.find((p) => p.id === id)?.address ?? "";
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreatePhoto();
  const del = useDeletePhoto();
  const { toast } = useToast();
  const { can } = useAccess();
  const canAdd = can("canCreateEdit");
  const canDelete = can("canDelete");

  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [fs, setFs] = useState(false);

  // upload form state
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [takenById, setTakenById] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const resetForm = () => {
    setFile(null);
    setProjectId("");
    setCaption("");
    setLocation("");
    setTakenById("0");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const authorOf = (p: Photo | null) => (p?.takenById ? team.get(p.takenById) : undefined);

  const submitUpload = async () => {
    if (!file) { toast({ title: "Choose an image first", variant: "destructive" }); return; }
    if (!projectId) { toast({ title: "Select a project", variant: "destructive" }); return; }
    if (!caption.trim()) { toast({ title: "Add a caption", variant: "destructive" }); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);
    form.append("caption", caption.trim());
    form.append("location", location.trim());
    form.append("takenById", takenById);
    form.append("date", date);
    form.append("hue", String(Math.floor(Math.random() * 360)));
    try {
      await create.mutateAsync({ form });
      toast({ title: "Photo uploaded" });
      setOpen(false);
      resetForm();
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
  };

  const openViewer = (p: Photo) => { setFs(false); setViewing(p); };

  return (
    <Layout title="Photo Log" actions={
      canAdd ? <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-photo"><Plus className="size-4" /> Add Photo</Button> : undefined
    }>
      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Image file</Label>
              <button
                type="button"
                onClick={() => document.getElementById("photo-file-input")?.click()}
                className="mt-1 flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50"
                data-testid="button-photo-choose"
              >
                {file ? (
                  <>
                    <Camera className="size-5 text-primary" />
                    <span className="text-sm font-medium truncate max-w-full">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="size-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to choose an image (JPG, PNG, GIF, WEBP, SVG)</span>
                  </>
                )}
              </button>
              <input id="photo-file-input" type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="input-photo-file" />
            </div>
            <div>
              <Label htmlFor="ph-caption">Caption</Label>
              <textarea id="ph-caption" value={caption} onChange={(e) => setCaption(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Level 3 deck formwork — looking north" data-testid="input-photo-caption" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ph-loc">Location</Label>
                <input id="ph-loc" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="L3, grid F" data-testid="input-photo-location" />
              </div>
              <div>
                <Label htmlFor="ph-date">Date</Label>
                <input id="ph-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="input-photo-date" />
              </div>
              <div>
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1 w-full" data-testid="select-photo-project"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Taken by</Label>
                <Select value={takenById} onValueChange={setTakenById}>
                  <SelectTrigger className="mt-1 w-full" data-testid="select-photo-takenby"><SelectValue /></SelectTrigger>
                  <SelectContent>{teamOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button size="sm" onClick={submitUpload} disabled={create.isPending} data-testid="button-photo-upload-submit">
                {create.isPending ? "Uploading…" : "Upload Photo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {photos.map((ph) => {
            const author = authorOf(ph);
            return (
              <figure key={ph.id} onClick={() => openViewer(ph)} className="group cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-primary/40 hover:shadow-md" data-testid={`card-photo-${ph.id}`}>
                <div className="relative h-40">
                  <PhotoImage photo={ph} />
                  <span className="absolute right-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{shortDate(ph.date)}</span>
                  {ph.storedFileName && <span className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm">image</span>}
                </div>
                <figcaption className="p-3">
                  <p className="text-sm font-medium leading-snug">{ph.caption}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    {(() => {
                      const href = googleMapsUrlForLocation(ph.location, projAddress(ph.projectId));
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer noopener"
                          onClick={(e) => e.stopPropagation()}
                          className="flex min-w-0 items-center gap-1 truncate text-primary hover:underline"
                          data-testid={`link-map-photo-${ph.id}`}
                        >
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{ph.location || "—"}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 truncate"><MapPin className="size-3" /> {ph.location || "—"}</span>
                      );
                    })()}
                    {author && <Avatar initials={author.initials} color={author.color} size={22} />}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">{projName(ph.projectId)}</div>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); openViewer(ph); }} data-testid={`button-photo-view-${ph.id}`}>
                      <Eye className="size-3.5" /> View now
                    </Button>
                    {canDelete && ph.storedFileName && (
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); del.mutate(ph.id); }} data-testid={`button-photo-delete-${ph.id}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </figcaption>
              </figure>
            );
          })}
          {photos.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No photos logged yet.</div>}
        </div>
      )}

      {/* Photo viewer dialog */}
      <Dialog open={!!viewing && !fs} onOpenChange={(o) => { if (!o) { setViewing(null); setFs(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="truncate">{viewing?.caption}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="h-64 overflow-hidden rounded-lg bg-muted/40">
                <PhotoImage photo={viewing} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {(() => {
                  const locHref = googleMapsUrlForLocation(viewing.location, projAddress(viewing.projectId));
                  const cells: { l: string; v: React.ReactNode }[] = [
                    {
                      l: "Location",
                      v: locHref ? (
                        <a
                          href={locHref}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                          data-testid="link-map-photo-viewer"
                        >
                          <MapPin className="size-3 shrink-0" />
                          <span>{viewing.location || "—"}</span>
                        </a>
                      ) : (viewing.location || "—"),
                    },
                    { l: "Project", v: projName(viewing.projectId) || "—" },
                    { l: "Date", v: shortDate(viewing.date) },
                    { l: "Taken by", v: authorOf(viewing)?.name ?? "—" },
                  ];
                  return cells.map((m) => (
                    <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
                      <div className="mt-0.5 truncate font-medium">{m.v}</div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setFs(true)} data-testid="button-photo-fullscreen">
                  <Maximize2 className="size-4" /> Full screen
                </Button>
                {viewing.storedFileName ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={photoUrl(viewing.id)} target="_blank" rel="noreferrer"><Download className="size-4" /> Open / Download</a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "No source image to download" })} data-testid="button-photo-download">
                    <Download className="size-4" /> Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full screen viewer */}
      {fs && viewing && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" data-testid="photo-fullscreen">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{viewing.caption}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {(() => {
                  const href = googleMapsUrlForLocation(viewing.location, projAddress(viewing.projectId));
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-primary hover:underline"
                      data-testid="link-map-photo-fullscreen"
                    >
                      <MapPin className="size-3" /> {viewing.location || "—"}
                    </a>
                  ) : (
                    <span className="flex items-center gap-1"><MapPin className="size-3" /> {viewing.location || "—"}</span>
                  );
                })()}
                <span>· {projName(viewing.projectId) || "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {viewing.storedFileName ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={photoUrl(viewing.id)} target="_blank" rel="noreferrer"><Download className="size-4" /> Open / Download</a>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => setFs(false)} data-testid="button-photo-exit-fullscreen">
                <Minimize2 className="size-4" /> Exit full screen
              </Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/40 p-6">
              <div className="w-full max-w-3xl overflow-hidden rounded-lg shadow-lg" style={{ aspectRatio: "4 / 3" }}>
                <PhotoImage photo={viewing} />
              </div>
            </div>
            <div className="hidden w-64 shrink-0 border-l border-border p-4 sm:block">
              <div className="grid grid-cols-1 gap-3 text-sm">
                {[
                  { l: "Location", v: viewing.location || "—" },
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Date", v: shortDate(viewing.date) },
                  { l: "Taken by", v: authorOf(viewing)?.name ?? "—" },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{m.l}</div>
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
