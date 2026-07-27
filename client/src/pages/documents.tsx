import { useState } from "react";
import { Plus, FileText, FileSpreadsheet, FileCheck, FileSignature, Receipt, Download, Eye, Maximize2, Minimize2, UploadCloud, FileWarning } from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import { useDocuments, useTeamMap, useProjects, useTeam, useCreateDocument, useDeleteDocument } from "@/hooks/use-data";
import type { DocumentRow } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { apiUrl } from "@/lib/queryClient";
import { PdfViewer } from "@/components/pdf-viewer";
import { shortDate } from "@/lib/format";

const TYPE_META: Record<string, { icon: any; tint: string }> = {
  Drawing: { icon: FileText, tint: "text-sky-500 bg-sky-500/12" },
  Spec: { icon: FileSpreadsheet, tint: "text-violet-500 bg-violet-500/12" },
  Permit: { icon: FileCheck, tint: "text-emerald-500 bg-emerald-500/12" },
  Contract: { icon: FileSignature, tint: "text-amber-500 bg-amber-500/12" },
  Receipt: { icon: Receipt, tint: "text-teal-500 bg-teal-500/12" },
};

const TYPES = ["Drawing", "Spec", "Permit", "Contract", "Receipt"];

function isPdf(m?: string | null) { return m === "application/pdf"; }
function isImage(m?: string | null) { return !!m && m.startsWith("image/"); }
function fileUrl(id: number) { return apiUrl(`/api/documents/${id}/file`); }

/** Render the actual uploaded file, or a fallback when none/not previewable. */
function Preview({ doc, className }: { doc: DocumentRow; className?: string }) {
  if (isPdf(doc.mimeType)) {
    return <PdfViewer url={fileUrl(doc.id)} className={className} />;
  }
  if (isImage(doc.mimeType)) {
    return <img src={fileUrl(doc.id)} alt={doc.name} className={`${className} object-contain`} />;
  }
  const M = TYPE_META[doc.type] ?? TYPE_META.Drawing;
  const I = M.icon;
  return (
    <div className={`${className} flex flex-col items-center justify-center gap-2 bg-muted/40 text-center`}>
      {doc.storedFileName ? <I className="size-10 text-muted-foreground" /> : <FileWarning className="size-10 text-muted-foreground" />}
      <p className="px-6 text-sm text-muted-foreground">
        {doc.storedFileName ? "Preview not available for this file type." : "No source file uploaded yet — metadata only."}
      </p>
    </div>
  );
}

export default function DocumentsPage() {
  const { data: docs = [], isLoading } = useDocuments();
  const team = useTeamMap();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const projName = (id: number) => projects.find((p) => p.id === id)?.name ?? "";
  const projectOptions = projects.map((p) => ({ value: String(p.id), label: p.name }));
  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];
  const create = useCreateDocument();
  const remove = useDeleteDocument();
  const { toast } = useToast();
  const { can } = useAccess();
  const canUpload = can("canCreateEdit");
  const canDelete = can("canDelete");

  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<DocumentRow | null>(null);
  const [fs, setFs] = useState(false);

  // upload form state
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [docType, setDocType] = useState("Drawing");
  const [uploadedById, setUploadedById] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const resetForm = () => {
    setFile(null); setProjectId(""); setDocType("Drawing"); setUploadedById("0");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const submitUpload = async () => {
    if (!file) { toast({ title: "Choose a file to upload", variant: "destructive" }); return; }
    if (!projectId) { toast({ title: "Select a project", variant: "destructive" }); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", projectId);
    form.append("type", docType);
    form.append("uploadedById", uploadedById === "0" ? "" : uploadedById);
    form.append("date", date);
    form.append("name", file.name);
    try {
      await create.mutateAsync({ form });
      toast({ title: "Document uploaded", description: file.name });
      setOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Try again", variant: "destructive" });
    }
  };

  const openFile = (d: DocumentRow) => {
    if (d.storedFileName) window.open(fileUrl(d.id), "_blank");
    else toast({ title: "No source file attached", description: d.name });
  };

  return (
    <Layout title="Documents" actions={
      canUpload ? <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-doc"><Plus className="size-4" /> Upload</Button> : undefined
    }>
      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>File (PDF or image, max 25 MB)</Label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-muted/50" data-testid="dropzone-doc">
                <UploadCloud className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
                {file && <span className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>}
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  data-testid="input-doc-file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1.5" data-testid="select-doc-project"><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="mt-1.5" data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uploaded by</Label>
                <Select value={uploadedById} onValueChange={setUploadedById}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{teamOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitUpload} disabled={create.isPending} data-testid="button-doc-upload-submit">
              {create.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Uploaded by</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium text-right">Size</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {docs.map((d) => {
                const meta = TYPE_META[d.type] ?? TYPE_META.Drawing;
                const Icon = meta.icon;
                const up = d.uploadedById ? team.get(d.uploadedById) : undefined;
                return (
                  <tr key={d.id} onClick={() => { setFs(false); setViewing(d); }} className="cursor-pointer hover:bg-muted/30" data-testid={`row-doc-${d.id}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex size-9 items-center justify-center rounded-md ${meta.tint}`}><Icon className="size-4" /></span>
                        <div>
                          <div className="font-medium leading-tight">{d.name}</div>
                          <div className="text-xs text-muted-foreground">{d.type}{d.storedFileName ? " · file attached" : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{projName(d.projectId)}</td>
                    <td className="px-4 py-2.5">
                      {up ? <span className="flex items-center gap-2"><Avatar initials={up.initials} color={up.color} size={24} /><span className="hidden sm:inline">{up.name.split(" ")[0]}</span></span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular">{shortDate(d.date)}</td>
                    <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{d.size}</td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => { setFs(false); setViewing(d); }} data-testid={`button-doc-view-${d.id}`}>
                          <Eye className="size-3.5" /> View now
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { remove.mutate(d.id); toast({ title: "Document deleted" }); }} data-testid={`button-doc-delete-${d.id}`}>
                            <FileWarning className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {docs.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No documents.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Document viewer dialog */}
      <Dialog open={!!viewing && !fs} onOpenChange={(o) => { if (!o) { setViewing(null); setFs(false); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewing && (() => {
                const M = TYPE_META[viewing.type] ?? TYPE_META.Drawing;
                const I = M.icon;
                return <span className={`inline-flex size-8 items-center justify-center rounded-md ${M.tint}`}><I className="size-4" /></span>;
              })()}
              <span className="truncate">{viewing?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <Preview doc={viewing} className="h-72 w-full rounded-lg border border-border bg-card" />
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Uploaded by", v: viewing.uploadedById ? (team.get(viewing.uploadedById)?.name ?? "—") : "—" },
                  { l: "Date", v: shortDate(viewing.date) },
                  { l: "Size", v: viewing.size },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="ff-kicker text-[9px] text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setFs(true)} data-testid="button-doc-fullscreen">
                  <Maximize2 className="size-4" /> Full screen
                </Button>
                <Button variant="outline" size="sm" onClick={() => openFile(viewing)} data-testid="button-doc-download">
                  <Download className="size-4" /> {viewing.storedFileName ? "Open / Download" : "Download"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Full screen viewer */}
      {fs && viewing && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background" data-testid="doc-fullscreen">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate font-medium">{viewing.name}</span>
              <span className="ml-1 rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{viewing.type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openFile(viewing)}>
                <Download className="size-4" /> Open / Download
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFs(false)} data-testid="button-doc-exit-fullscreen">
                <Minimize2 className="size-4" /> Exit full screen
              </Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-hidden bg-muted/40 p-4">
              <Preview doc={viewing} className="h-full w-full rounded-lg border border-border bg-card" />
            </div>
            <div className="hidden w-64 shrink-0 border-l border-border p-4 sm:block">
              <div className="grid grid-cols-1 gap-3 text-sm">
                {[
                  { l: "Type", v: viewing.type },
                  { l: "Size", v: viewing.size },
                  { l: "Project", v: projName(viewing.projectId) || "—" },
                  { l: "Uploaded by", v: viewing.uploadedById ? (team.get(viewing.uploadedById)?.name ?? "—") : "—" },
                  { l: "Date", v: shortDate(viewing.date) },
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
