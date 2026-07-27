import { useState } from "react";
import { Mail, Phone, Building2, Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { useTeam, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { ACCESS_BY_SLUG } from "@shared/access-levels";
import type { AccessLevel } from "@shared/access-levels";
import type { TeamMember } from "@shared/schema";

/**
 * Position options for the project team roster.
 * This is a display-only label describing what someone does on this project.
 * Actual login access (Owner / Admin / PM / Foreman / Viewer) is granted
 * separately in Settings → Team & Access when an org member is invited.
 */
const POSITIONS: { value: string; label: string }[] = [
  { value: "Project Executive",         label: "Project Executive" },
  { value: "Project Manager",           label: "Project Manager" },
  { value: "Assistant Project Manager", label: "Assistant Project Manager" },
  { value: "Estimator",                 label: "Estimator" },
  { value: "Superintendent",            label: "Superintendent" },
  { value: "Site Lead",                 label: "Site Lead" },
  { value: "Assistant Superintendent",  label: "Assistant Superintendent" },
  { value: "Foreman",                   label: "Foreman" },
  { value: "Field Engineer",            label: "Field Engineer" },
  { value: "Safety Officer",            label: "Safety Officer" },
  { value: "Quality Control",           label: "Quality Control" },
  { value: "Subcontractor",             label: "Subcontractor" },
  { value: "Architect",                 label: "Architect" },
  { value: "Engineer",                  label: "Engineer" },
  { value: "Owner Representative",      label: "Owner Representative" },
  { value: "Inspector",                 label: "Inspector" },
  { value: "Other",                     label: "Other" },
];

const POSITION_BY_VALUE = Object.fromEntries(POSITIONS.map((p) => [p.value, p]));

const COLOR_OPTIONS = ["amber", "blue", "emerald", "violet", "rose", "cyan", "orange", "slate"];

const TRADE_TINT: Record<string, string> = {
  Management: "text-primary", Quality: "text-emerald-500",
};

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

export default function Team() {
  const { data: team = [], isLoading } = useTeam();
  const create = useCreateTeamMember();
  const update = useUpdateTeamMember();
  const del = useDeleteTeamMember();
  const { toast } = useToast();
  const { can } = useAccess();
  const canManage = can("canManageTeam");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const levelLabel = (slug: string) => (ACCESS_BY_SLUG as Record<string, { label: string }>)[slug]?.label ?? slug;
  // If we're editing an existing member whose legacy free-text role isn't in POSITIONS,
  // surface it as an extra option so the Select still renders their current value.
  const legacyRole = editing?.role && !POSITION_BY_VALUE[editing.role] ? editing.role : null;
  const POSITION_OPTIONS = [
    ...POSITIONS.map((p) => ({ value: p.value, label: p.label })),
    ...(legacyRole ? [{ value: legacyRole, label: `${legacyRole} (custom)` }] : []),
  ];

  const fields: FieldDef[] = [
    { name: "name", label: "Full Name", type: "text", required: true, half: true },
    { name: "role", label: "Position", type: "select", options: POSITION_OPTIONS, placeholder: "Select a position…", required: true, half: true },
    { name: "trade", label: "Trade", type: "text", placeholder: "Electrical", required: true, half: true },
    { name: "company", label: "Company", type: "text", required: true, half: true },
    { name: "email", label: "Email", type: "text", placeholder: "name@company.com", half: true },
    { name: "phone", label: "Phone", type: "text", placeholder: "(303) 555-0000", half: true },
    { name: "color", label: "Avatar Color", type: "select", options: COLOR_OPTIONS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })), required: true, half: true },
    { name: "companyPhoto", label: "Company Photo", type: "photo" },
  ];

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setOpen(true); };

  const defaults: Record<string, string | number> = editing
    ? { name: editing.name, role: editing.role, trade: editing.trade, company: editing.company, email: editing.email ?? "", phone: editing.phone ?? "", color: editing.color, companyPhoto: editing.companyPhoto ?? "" }
    : { color: "blue", email: "", phone: "", companyPhoto: "" };

  const handleSubmit = (v: Record<string, string | number>) => {
    // Access level is intentionally not in the form — it's granted at signup/invite
    // via Settings → Team & Access. On this project roster we preserve any existing
    // access tag (edit) or default to "project_manager" (new).
    const payload = {
      name: String(v.name),
      role: String(v.role),
      accessLevel: (editing?.accessLevel ?? "project_manager") as AccessLevel,
      trade: String(v.trade),
      company: String(v.company),
      email: String(v.email ?? ""),
      phone: String(v.phone ?? ""),
      companyPhoto: String(v.companyPhoto ?? ""),
      color: String(v.color),
      initials: deriveInitials(String(v.name)),
    };
    if (editing) return update.mutateAsync({ id: editing.id, data: payload });
    return create.mutateAsync(payload);
  };

  const handleDelete = (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.name} from the team?`)) return;
    del.mutate(m.id, { onSuccess: () => toast({ title: "Team member removed" }) });
  };

  return (
    <Layout title="Project Team" actions={
      canManage ? <Button size="sm" onClick={openNew} data-testid="button-new-member"><Plus className="size-4" /> Add Member</Button> : undefined
    }>
      {canManage && (
      <CreateEntityDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit Team Member" : "New Team Member"}
        fields={fields}
        defaults={defaults}
        submitLabel={editing ? "Save Changes" : "Add Member"}
        isPending={create.isPending || update.isPending}
        onSubmit={handleSubmit}
      />
      )}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-5 shadow-sm" data-testid={`card-team-${m.id}`}>
              <div className="flex items-center gap-3">
                <Avatar initials={m.initials} color={m.color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-base font-bold">{m.name}</div>
                  <div className={`text-xs font-medium ${TRADE_TINT[m.trade] ?? "text-muted-foreground"}`}>{m.role}</div>
                  <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary" data-testid={`badge-access-${m.id}`}><ShieldCheck className="size-3" /> {levelLabel(m.accessLevel ?? "project_manager")}</div>
                </div>
                {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => openEdit(m)} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary" data-testid={`button-edit-team-${m.id}`} aria-label="Edit"><Pencil className="size-4" /></button>
                  <button onClick={() => handleDelete(m)} className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500" data-testid={`button-delete-team-${m.id}`} aria-label="Delete"><Trash2 className="size-4" /></button>
                </div>
                )}
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  {m.companyPhoto ? (
                    <img src={m.companyPhoto} alt={m.company} className="size-5 rounded object-cover" data-testid={`img-company-${m.id}`} />
                  ) : (
                    <Building2 className="size-4" />
                  )}
                  {m.company}
                </div>
                <div className="flex items-center gap-2"><span className="size-4 text-center text-[10px]">🔧</span> {m.trade}</div>
                <div className="flex items-center gap-2"><Mail className="size-4" /> {m.email || <span className="italic text-muted-foreground/60">No email</span>}</div>
                <div className="flex items-center gap-2"><Phone className="size-4" /> {m.phone || <span className="italic text-muted-foreground/60">No phone</span>}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
