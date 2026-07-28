import { useState } from "react";
import {
  Plus, FileText, UploadCloud, Download, Eye, PenTool, Clock, CheckCircle2,
  AlertCircle, FileSignature, Building2, ExternalLink, Trash2,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import {
  useCompanyDocuments, useCreateCompanyDocument, useUpdateCompanyDocument,
  useDeleteCompanyDocument, useTeamMap, useTeam,
} from "@/hooks/use-data";
import type { CompanyDocument } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { apiUrl } from "@/lib/queryClient";
import { shortDate } from "@/lib/format";

const CATEGORIES = ["New Hire", "Contract", "HR", "Safety", "Vendor", "Legal", "Insurance", "Other"];

/**
 * Common company-document title presets, grouped by category. Picking one
 * writes the title verbatim into the title input; users can still tweak it
 * (append a name, project code, revision, etc.) before uploading. Grouped so
 * the dropdown stays scannable at ~30 entries.
 *
 * When adding new presets keep them generic — anything project- or client-
 * specific belongs in the free text field, not this list.
 */
const TITLE_PRESETS: { group: string; titles: string[] }[] = [
  {
    group: "HR & New Hire",
    titles: [
      "Offer Letter",
      "Employment Agreement",
      "I-9 Employment Eligibility Verification",
      "W-4 Tax Withholding",
      "Direct Deposit Authorization",
      "Employee Handbook Acknowledgment",
      "Non-Disclosure Agreement (NDA)",
      "Non-Compete Agreement",
      "New Hire Onboarding Packet",
    ],
  },
  {
    group: "Contracts",
    titles: [
      "Master Services Agreement (MSA)",
      "Subcontractor Agreement",
      "Independent Contractor Agreement",
      "Vendor Purchase Order Terms",
      "Change Order",
      "Statement of Work (SOW)",
      "Consulting Agreement",
    ],
  },
  {
    group: "Safety & Compliance",
    titles: [
      "Safety Orientation Acknowledgment",
      "OSHA 10 Certification",
      "OSHA 30 Certification",
      "Toolbox Talk Sign-Off",
      "Incident Report",
      "Site Access Agreement",
      "Drug & Alcohol Testing Consent",
    ],
  },
  {
    group: "Insurance & Legal",
    titles: [
      "Certificate of Insurance (COI)",
      "General Liability Policy",
      "Workers' Compensation Certificate",
      "Lien Waiver — Conditional",
      "Lien Waiver — Unconditional",
      "Indemnification Agreement",
    ],
  },
  {
    group: "Vendor & Procurement",
    titles: [
      "W-9 Request for Taxpayer Identification",
      "Vendor Setup Form",
      "Credit Application",
      "Purchase Order",
    ],
  },
];

const CAT_META: Record<string, { icon: any; tint: string }> = {
  "New Hire": { icon: Building2, tint: "text-sky-500 bg-sky-500/12" },
  Contract: { icon: FileSignature, tint: "text-amber-500 bg-amber-500/12" },
  HR: { icon: FileText, tint: "text-violet-500 bg-violet-500/12" },
  Safety: { icon: AlertCircle, tint: "text-red-500 bg-red-500/12" },
  Vendor: { icon: FileText, tint: "text-emerald-500 bg-emerald-500/12" },
  Legal: { icon: FileSignature, tint: "text-indigo-500 bg-indigo-500/12" },
  Insurance: { icon: FileText, tint: "text-teal-500 bg-teal-500/12" },
  Other: { icon: FileText, tint: "text-muted-foreground bg-muted" },
};

const SIG_STATUS_META: Record<string, { icon: any; tint: string; label: string }> = {
  "Not Required": { icon: CheckCircle2, tint: "text-muted-foreground", label: "No signature needed" },
  "Needs Signature": { icon: PenTool, tint: "text-amber-500", label: "Needs signature" },
  Sent: { icon: Clock, tint: "text-sky-500", label: "Sent for signature" },
  Signed: { icon: CheckCircle2, tint: "text-emerald-500", label: "Signed" },
  Expired: { icon: AlertCircle, tint: "text-red-500", label: "Expired" },
};

function fileUrl(id: number) { return apiUrl(`/api/company-documents/${id}/file`); }
function isPdf(m?: string | null) { return m === "application/pdf"; }
function isImage(m?: string | null) { return !!m && m.startsWith("image/"); }

export default function CompanyDocumentsPage() {
  const { data: docs = [], isLoading } = useCompanyDocuments();
  const team = useTeamMap();
  const { data: teamList = [] } = useTeam();
  const create = useCreateCompanyDocument();
  const update = useUpdateCompanyDocument();
  const remove = useDeleteCompanyDocument();
  const { toast } = useToast();
  const { can } = useAccess();
  const canEdit = can("canCreateEdit");
  const canDelete = can("canDelete");

  const [open, setOpen] = useState(false);
  const [filterCat, setFilterCat] = useState("All");
  const [filterSig, setFilterSig] = useState("All");
  const [viewing, setViewing] = useState<CompanyDocument | null>(null);

  // upload form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("New Hire");
  const [sigRequired, setSigRequired] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadedById, setUploadedById] = useState("0");

  const teamOptions = [{ value: "0", label: "Unassigned" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];

  const resetForm = () => {
    setFile(null); setTitle(""); setCategory("New Hire"); setSigRequired(false);
    setSignerName(""); setSignerEmail(""); setDueDate(""); setNotes(""); setUploadedById("0");
  };

  const submitUpload = async () => {
    if (!title.trim()) { toast({ title: "Enter a document title", variant: "destructive" }); return; }
    if (!file) { toast({ title: "Choose a file to upload", variant: "destructive" }); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("category", category);
    form.append("signatureRequired", String(sigRequired));
    if (signerName) form.append("signerName", signerName);
    if (signerEmail) form.append("signerEmail", signerEmail);
    if (dueDate) form.append("dueDate", dueDate);
    if (notes) form.append("notes", notes);
    if (uploadedById !== "0") form.append("uploadedById", uploadedById);
    try {
      await create.mutateAsync({ form });
      toast({ title: "Document uploaded", description: title });
      setOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message ?? "Try again", variant: "destructive" });
    }
  };

  const openFile = (d: CompanyDocument) => {
    if (d.storedFileName) window.open(fileUrl(d.id), "_blank");
    else toast({ title: "No source file attached", description: d.title });
  };

  const updateSigStatus = async (doc: CompanyDocument, status: string) => {
    try {
      await update.mutateAsync({ id: doc.id, data: { signatureStatus: status } });
      toast({ title: "Signature status updated", description: status });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const addDocusignUrl = async (doc: CompanyDocument) => {
    const url = window.prompt("Paste the DocuSign envelope URL:", doc.docusignUrl ?? "");
    if (url === null) return;
    try {
      await update.mutateAsync({ id: doc.id, data: { docusignUrl: url || null, signatureStatus: url ? "Sent" : doc.signatureStatus } });
      toast({ title: url ? "DocuSign link saved" : "DocuSign link removed" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  // KPIs
  const needsSig = docs.filter((d) => d.signatureStatus === "Needs Signature");
  const sent = docs.filter((d) => d.signatureStatus === "Sent");
  const signed = docs.filter((d) => d.signatureStatus === "Signed");
  const dueSoon = docs.filter((d) => {
    if (!d.dueDate || d.signatureStatus === "Signed") return false;
    const days = (new Date(d.dueDate).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  });

  const filtered = docs.filter((d) => {
    if (filterCat !== "All" && d.category !== filterCat) return false;
    if (filterSig !== "All" && d.signatureStatus !== filterSig) return false;
    return true;
  });

  return (
    <Layout title="Company Documents" actions={
      canEdit ? <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-co-doc"><Plus className="size-4" /> Upload</Button> : undefined
    }>
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
        {[
          { label: "Needs Signature", value: needsSig.length, icon: PenTool, tint: "text-amber-500 bg-amber-500/10" },
          { label: "Sent", value: sent.length, icon: Clock, tint: "text-sky-500 bg-sky-500/10" },
          { label: "Signed", value: signed.length, icon: CheckCircle2, tint: "text-emerald-500 bg-emerald-500/10" },
          { label: "Due Soon", value: dueSoon.length, icon: AlertCircle, tint: "text-red-500 bg-red-500/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border border-border bg-card p-3" data-testid={`kpi-co-doc-${kpi.label.replace(/\s/g, "-")}`}>
              <div className="flex items-center gap-2">
                <span className={`inline-flex size-8 items-center justify-center rounded-md ${kpi.tint}`}><Icon className="size-4" /></span>
                <div>
                  <div className="text-2xl font-bold leading-none">{kpi.value}</div>
                  <div className="ff-kicker text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-40">
          <Label className="text-xs">Category</Label>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="mt-1" data-testid="filter-co-doc-cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-44">
          <Label className="text-xs">Signature Status</Label>
          <Select value={filterSig} onValueChange={setFilterSig}>
            <SelectTrigger className="mt-1" data-testid="filter-co-doc-sig"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {Object.keys(SIG_STATUS_META).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Company Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              {/* Two-part input: a preset dropdown that fills the text field,
                  and a free-text override so users can tweak the name (append
                  a subcontractor name, revision number, etc.) before upload.
                  We DON'T store the preset key — only the final title text —
                  because titles are already a plain text column. */}
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. New Hire Onboarding Packet"
                  data-testid="input-co-doc-title"
                />
                <Select value="" onValueChange={(v) => { if (v) setTitle(v); }}>
                  <SelectTrigger data-testid="select-co-doc-title-preset"><SelectValue placeholder="Pick a preset…" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {TITLE_PRESETS.map((grp) => (
                      <div key={grp.group}>
                        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{grp.group}</div>
                        {grp.titles.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>File (PDF or image, max 25 MB)</Label>
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:border-primary/50 hover:bg-muted/50" data-testid="dropzone-co-doc">
                <UploadCloud className="size-6 text-muted-foreground" />
                <span className="text-sm font-medium">{file ? file.name : "Click to choose a file"}</span>
                {file && <span className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(1)} MB</span>}
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  data-testid="input-co-doc-file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5" data-testid="select-co-doc-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uploaded by</Label>
                <Select value={uploadedById} onValueChange={setUploadedById}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>{teamOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Switch checked={sigRequired} onCheckedChange={setSigRequired} data-testid="switch-co-doc-sig" />
              <div>
                <div className="text-sm font-medium">Signature required (DocuSign)</div>
                <div className="text-xs text-muted-foreground">Enable for documents that need e-signatures</div>
              </div>
            </div>
            {sigRequired && (
              <div className="space-y-3">
                {/* Team-member picker — auto-fills signer name + email from the
                    team roster. Faster than typing, and it keeps names/emails
                    consistent across documents. Choosing "Someone else" clears
                    both fields so the user can type freely. */}
                <div>
                  <Label>Signer</Label>
                  <Select
                    value={(() => {
                      const match = teamList.find((m) => (m.email || "").toLowerCase() === signerEmail.toLowerCase() && signerEmail);
                      return match ? String(match.id) : (signerName || signerEmail) ? "__manual" : "";
                    })()}
                    onValueChange={(v) => {
                      if (v === "__manual") {
                        // Keep whatever is typed; do nothing.
                        return;
                      }
                      if (v === "__clear") {
                        setSignerName(""); setSignerEmail(""); return;
                      }
                      const m = teamList.find((tm) => String(tm.id) === v);
                      if (m) {
                        setSignerName(m.name || "");
                        setSignerEmail(m.email || "");
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1.5" data-testid="select-co-doc-signer-team"><SelectValue placeholder="Pick a team member…" /></SelectTrigger>
                    <SelectContent>
                      {teamList.length > 0 && (
                        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Team members</div>
                      )}
                      {teamList.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)} disabled={!m.email}>
                          <div className="flex flex-col">
                            <span className="font-medium">{m.name}</span>
                            <span className="text-[11px] text-muted-foreground">{m.email || "no email on file"}{m.role ? ` · ${m.role}` : ""}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <div className="my-1 border-t border-border" />
                      <SelectItem value="__manual">Someone else — type manually</SelectItem>
                      <SelectItem value="__clear">— Clear signer —</SelectItem>
                    </SelectContent>
                  </Select>
                  {signerName || signerEmail ? (
                    <p className="mt-1 text-[11px] text-muted-foreground" data-testid="co-doc-signer-preview">
                      Signing as <span className="font-medium text-foreground">{signerName || "—"}</span>{signerEmail && <> · {signerEmail}</>}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] italic text-muted-foreground">No signer picked yet</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Signer name</Label>
                    <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="John Doe" className="mt-1.5" data-testid="input-co-doc-signer-name" />
                  </div>
                  <div>
                    <Label>Signer email</Label>
                    <Input value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="john@company.com" className="mt-1.5" data-testid="input-co-doc-signer-email" />
                  </div>
                </div>
                <div>
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5" data-testid="input-co-doc-due" />
                </div>
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" className="mt-1.5" data-testid="input-co-doc-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitUpload} disabled={create.isPending} data-testid="button-co-doc-upload-submit">
              {create.isPending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document table */}
      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Signature</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => {
                const catMeta = CAT_META[d.category] ?? CAT_META.Other;
                const CatIcon = catMeta.icon;
                const sigMeta = SIG_STATUS_META[d.signatureStatus] ?? SIG_STATUS_META["Not Required"];
                const SigIcon = sigMeta.icon;
                const up = d.uploadedById ? team.get(d.uploadedById) : undefined;
                const overdue = d.dueDate && d.signatureStatus !== "Signed" && new Date(d.dueDate) < new Date();
                return (
                  <tr key={d.id} onClick={() => setViewing(d)} className="cursor-pointer hover:bg-muted/30" data-testid={`row-co-doc-${d.id}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex size-9 items-center justify-center rounded-md ${catMeta.tint}`}><CatIcon className="size-4" /></span>
                        <div>
                          <div className="font-medium leading-tight">{d.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {up ? `Uploaded by ${up.name.split(" ")[0]}` : "Uploaded"} · {shortDate(d.date)}
                            {d.storedFileName ? " · file attached" : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{d.category}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${sigMeta.tint}`}>
                        <SigIcon className="size-3.5" />
                        {d.signatureStatus}
                      </span>
                      {d.docusignUrl && (
                        <a href={d.docusignUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-0.5 flex items-center gap-1 text-xs text-sky-500 hover:underline" data-testid={`link-co-doc-docusign-${d.id}`}>
                          <ExternalLink className="size-3" /> DocuSign
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {d.dueDate ? (
                        <span className={`text-xs ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {shortDate(d.dueDate)}{overdue ? " · overdue" : ""}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setViewing(d)} data-testid={`button-co-doc-view-${d.id}`}>
                          <Eye className="size-3.5" /> View
                        </Button>
                        {canEdit && d.signatureRequired && (
                          <Button variant="ghost" size="sm" onClick={() => addDocusignUrl(d)} title="Manage DocuSign link" data-testid={`button-co-doc-docusign-${d.id}`}>
                            <PenTool className="size-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { remove.mutate(d.id); toast({ title: "Document deleted" }); }} data-testid={`button-co-doc-delete-${d.id}`}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No company documents.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Document detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewing && (() => {
                const M = CAT_META[viewing.category] ?? CAT_META.Other;
                const I = M.icon;
                return <span className={`inline-flex size-8 items-center justify-center rounded-md ${M.tint}`}><I className="size-4" /></span>;
              })()}
              <span className="truncate">{viewing?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { l: "Category", v: viewing.category },
                  { l: "Status", v: viewing.status },
                  { l: "Signature", v: viewing.signatureStatus },
                  { l: "Signer", v: viewing.signerName ?? "—" },
                  { l: "Signer email", v: viewing.signerEmail ?? "—" },
                  { l: "Due date", v: viewing.dueDate ? shortDate(viewing.dueDate) : "—" },
                  { l: "Uploaded by", v: viewing.uploadedById ? (team.get(viewing.uploadedById)?.name ?? "—") : "—" },
                  { l: "Date", v: shortDate(viewing.date) },
                ].map((m) => (
                  <div key={m.l} className="rounded-md border border-border bg-muted/30 p-2">
                    <div className="ff-kicker text-[9px] text-muted-foreground">{m.l}</div>
                    <div className="mt-0.5 truncate font-medium">{m.v}</div>
                  </div>
                ))}
              </div>
              {viewing.notes && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <div className="ff-kicker text-[9px] text-muted-foreground">Notes</div>
                  <div className="mt-1 text-sm">{viewing.notes}</div>
                </div>
              )}
              {viewing.signatureRequired && canEdit && (
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <span className="text-sm font-medium">Update signature status:</span>
                  <Select value={viewing.signatureStatus} onValueChange={(v) => updateSigStatus(viewing, v)}>
                    <SelectTrigger className="w-40" data-testid="select-co-doc-sig-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(SIG_STATUS_META).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {viewing.docusignUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(viewing.docusignUrl!, "_blank")} data-testid="button-co-doc-open-docusign">
                    <ExternalLink className="size-3.5" /> Open DocuSign
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openFile(viewing)} data-testid="button-co-doc-download">
                  <Download className="size-3.5" /> {viewing.storedFileName ? "Open / Download" : "No file"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
