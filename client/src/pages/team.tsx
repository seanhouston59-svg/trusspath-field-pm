import { useMemo, useState } from "react";
import { Mail, Phone, Building2, Plus, Pencil, Trash2, ShieldCheck, UserPlus, CheckCircle2, Clock } from "lucide-react";
import { Layout } from "@/components/layout";
import { Avatar } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import {
  useTeam, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  useCurrentOrg, useOrgMembers, useOrgInvites, useCreateInvite,
} from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAccess } from "@/lib/access";
import { ACCESS_LEVELS, ACCESS_BY_SLUG, ACCESS_LEVEL_TO_ORG_ROLE } from "@shared/access-levels";
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

/**
 * Common construction trades. Ordered roughly by build sequence — sitework first,
 * structure/envelope next, MEP + finishes after. "Management" and "Quality" stay
 * at the top so PMs / QC leads have obvious picks; "Other" at the end for anything
 * uncommon (owners can type a free-form value via the legacy-value fallback).
 */
const TRADES: string[] = [
  "Management",
  "Quality",
  "Safety",
  "Sitework / Earthwork",
  "Demolition",
  "Concrete",
  "Masonry",
  "Structural Steel",
  "Rough Carpentry",
  "Finish Carpentry / Millwork",
  "Roofing",
  "Waterproofing",
  "Insulation",
  "Doors & Windows / Glazing",
  "Drywall",
  "Painting",
  "Flooring",
  "Tile",
  "Ceilings",
  "Electrical",
  "Low Voltage / Data",
  "Fire Alarm",
  "Plumbing",
  "HVAC / Mechanical",
  "Fire Sprinkler",
  "Elevator / Conveyance",
  "Landscaping",
  "Paving / Asphalt",
  "Utilities",
  "Environmental / Abatement",
  "Surveying",
  "Other",
];

const TRADE_SET = new Set(TRADES);

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

  // Org / seat context — used to gate the "Invite as user" button and render the
  // seat-usage indicator. `useCurrentOrg` may be null while loading or if the
  // account isn't in an org yet; treat missing data as "can't invite".
  const { data: orgData } = useCurrentOrg();
  const { data: membersData } = useOrgMembers();
  const { data: invitesData } = useOrgInvites();
  const createInvite = useCreateInvite();

  const myMembershipRole = orgData?.membership?.role;
  const canInviteMembers = myMembershipRole === "owner" || myMembershipRole === "admin";

  // Fast lookups: email → already a member?  email → pending invite?
  // Both are lower-cased so we can compare against team-member emails safely.
  const activeMemberEmails = useMemo(() => {
    const s = new Set<string>();
    (membersData?.members ?? []).forEach((m) => {
      if (m.status === "active" && m.email) s.add(m.email.toLowerCase());
    });
    return s;
  }, [membersData]);
  const pendingInviteEmails = useMemo(() => {
    const s = new Set<string>();
    (invitesData?.invites ?? []).forEach((i) => {
      if (!i.acceptedAt && new Date(i.expiresAt) > new Date()) s.add(i.email.toLowerCase());
    });
    return s;
  }, [invitesData]);

  // Seat state for the header + confirmation preview.
  const seats = orgData?.seats;
  const pricing = orgData?.pricing;
  const activeSeats = seats?.active ?? 0;
  const includedSeats = seats?.included ?? null;
  const pendingCount = seats?.pendingInvites ?? 0;
  // Effective seat count after all pending invites are accepted — this is the
  // number that will drive Stripe's next sync, so use it in "will you go over?"
  // math and warnings.
  const projectedSeats = activeSeats + pendingCount;

  // Confirmation dialog state for the invite flow.
  const [inviteTarget, setInviteTarget] = useState<TeamMember | null>(null);

  const levelLabel = (slug: string) => (ACCESS_BY_SLUG as Record<string, { label: string }>)[slug]?.label ?? slug;
  // If we're editing an existing member whose legacy free-text role isn't in POSITIONS,
  // surface it as an extra option so the Select still renders their current value.
  const legacyRole = editing?.role && !POSITION_BY_VALUE[editing.role] ? editing.role : null;
  const POSITION_OPTIONS = [
    ...POSITIONS.map((p) => ({ value: p.value, label: p.label })),
    ...(legacyRole ? [{ value: legacyRole, label: `${legacyRole} (custom)` }] : []),
  ];
  // Access-level options are the canonical roles from @shared/access-levels, ordered
  // by their `order` field (Executive → Viewer). Label doubles as the human-friendly
  // name so the Select surfaces "Project Executive" etc.
  const ACCESS_OPTIONS = [...ACCESS_LEVELS]
    .sort((a, b) => a.order - b.order)
    .map((l) => ({ value: l.slug, label: l.label }));
  // Same legacy-fallback pattern for Trade: preserve any old free-text value on edit.
  const legacyTrade = editing?.trade && !TRADE_SET.has(editing.trade) ? editing.trade : null;
  const TRADE_OPTIONS = [
    ...TRADES.map((t) => ({ value: t, label: t })),
    ...(legacyTrade ? [{ value: legacyTrade, label: `${legacyTrade} (custom)` }] : []),
  ];

  // Blurb for the currently selected access level — surfaced beneath the Select via
  // the "info" field, updated live through onFieldChange below. Defaults to the level
  // the form starts on (editing.accessLevel or project_manager for new members).
  const initialAccessLevel: AccessLevel = (editing?.accessLevel ?? "project_manager") as AccessLevel;
  const [accessBlurb, setAccessBlurb] = useState<string>(
    ACCESS_BY_SLUG[initialAccessLevel]?.blurb ?? "",
  );

  const fields: FieldDef[] = [
    { name: "name", label: "Full Name", type: "text", required: true, half: true },
    { name: "role", label: "Position", type: "select", options: POSITION_OPTIONS, placeholder: "Select a position…", required: true, half: true },
    { name: "trade", label: "Trade", type: "select", options: TRADE_OPTIONS, placeholder: "Select a trade…", required: true, half: true },
    { name: "company", label: "Company", type: "text", required: true, half: true },
    { name: "email", label: "Email", type: "text", placeholder: "name@company.com", half: true },
    { name: "phone", label: "Phone", type: "text", placeholder: "(303) 555-0000", half: true },
    { name: "accessLevel", label: "Access Level", type: "select", options: ACCESS_OPTIONS, required: true, half: true },
    { name: "color", label: "Avatar Color", type: "select", options: COLOR_OPTIONS.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) })), required: true, half: true },
    { name: "accessBlurb", label: "", type: "info", info: accessBlurb },
    { name: "companyPhoto", label: "Company Photo", type: "photo" },
  ];

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (m: TeamMember) => { setEditing(m); setOpen(true); };

  const defaults: Record<string, string | number> = editing
    ? { name: editing.name, role: editing.role, trade: editing.trade, company: editing.company, email: editing.email ?? "", phone: editing.phone ?? "", accessLevel: editing.accessLevel ?? "project_manager", color: editing.color, companyPhoto: editing.companyPhoto ?? "" }
    : { color: "blue", email: "", phone: "", accessLevel: "project_manager", companyPhoto: "" };

  // Keep the inline blurb in sync as the user picks a level.
  const handleFieldChange = (name: string, value: string | number) => {
    if (name === "accessLevel") {
      const slug = String(value) as AccessLevel;
      setAccessBlurb(ACCESS_BY_SLUG[slug]?.blurb ?? "");
    }
  };

  const handleSubmit = (v: Record<string, string | number>) => {
    // Access level is now user-editable in the form (owners / managers with
    // canManageTeam). Server storage.updateTeamMember enforces persistence and the
    // /timesheets/:id/send route reads accessLevel to gate approval routing.
    const payload = {
      name: String(v.name),
      role: String(v.role),
      accessLevel: String(v.accessLevel ?? "project_manager") as AccessLevel,
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

  /**
   * Compute the org role we'll use when inviting this team member as a user.
   * Uses ACCESS_LEVEL_TO_ORG_ROLE, with one safety step-down: only owners can
   * invite other owners, so admins inviting a Project Executive quietly land
   * on "admin" instead of tripping the server's 403.
   */
  const mappedOrgRole = (m: TeamMember): "owner" | "admin" | "pm" | "foreman" | "viewer" => {
    const raw = ACCESS_LEVEL_TO_ORG_ROLE[(m.accessLevel ?? "project_manager") as AccessLevel];
    if (raw === "owner" && myMembershipRole !== "owner") return "admin";
    return raw;
  };

  /** Human-friendly label for the org roles (matches Settings → Team & Access). */
  const ORG_ROLE_LABEL: Record<string, string> = {
    owner: "Owner", admin: "Admin", pm: "Project Manager",
    foreman: "Foreman", viewer: "Viewer",
  };

  /**
   * Given the current active seat count, decide whether adding one more will
   * bump us into overage territory. Returns the incremental $/mo (in cents) or
   * 0 if the new seat is still inside the included allotment. Assumes we're
   * committing +1 seat on top of `projectedSeats` (which already counts pending).
   */
  const overageChargeCents = (): number => {
    if (!pricing || includedSeats === null) return 0;
    const nextSeats = projectedSeats + 1;
    if (nextSeats <= includedSeats) return 0;
    return pricing.seatAmountCents;
  };

  /** Format cents as "$29" or "$29.50". */
  const fmtCents = (cents: number): string => {
    const dollars = cents / 100;
    return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
  };

  const doInvite = async () => {
    if (!inviteTarget) return;
    const email = (inviteTarget.email || "").trim().toLowerCase();
    const role = mappedOrgRole(inviteTarget);
    try {
      await createInvite.mutateAsync({ email, role });
      toast({
        title: `Invite sent to ${inviteTarget.name}`,
        description: `${email} will get an email to set their password and join as ${ORG_ROLE_LABEL[role]}.`,
      });
      setInviteTarget(null);
    } catch (err: any) {
      toast({
        title: "Invite failed",
        description: err?.message || "Could not send invite. See console for details.",
        variant: "destructive",
      });
    }
  };

  /**
   * Compute the current invite-status chip for a team member.
   * - null email       → "no email" (can't invite)
   * - active member    → "active user" chip
   * - pending invite   → "invite pending" chip
   * - otherwise         → null (button will show)
   */
  const inviteStatus = (m: TeamMember): "active" | "pending" | "noEmail" | "invitable" => {
    const email = (m.email || "").trim().toLowerCase();
    if (!email) return "noEmail";
    if (activeMemberEmails.has(email)) return "active";
    if (pendingInviteEmails.has(email)) return "pending";
    return "invitable";
  };

  return (
    <Layout title="Project Team" actions={
      canManage ? <Button size="sm" onClick={openNew} data-testid="button-new-member"><Plus className="size-4" /> Add Member</Button> : undefined
    }>
      {/* Seat-usage header — visible to anyone who can see the Team page, but
          only when the org is on a paid plan (pricing != null). Keeps seat
          state visible in the place where you're most likely to want to add
          users. Same numbers you'd see in Settings → Team & Access. */}
      {orgData && pricing && includedSeats !== null && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-sm" data-testid="seat-usage-header">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-bold text-foreground">{activeSeats}</span>
            <span className="text-muted-foreground">of {includedSeats} included seat{includedSeats === 1 ? "" : "s"}</span>
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{pricing.displayName} · {pricing.billing}</span>
          </div>
          {pendingCount > 0 && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">+{pendingCount} pending invite{pendingCount === 1 ? "" : "s"}</span>
          )}
          {activeSeats > includedSeats && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">+{activeSeats - includedSeats} overage · {fmtCents(pricing.seatAmountCents)}/seat/{pricing.billing === "annual" ? "yr" : "mo"}</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Each additional seat · <span className="font-medium text-foreground">{fmtCents(pricing.seatAmountCents)}/{pricing.billing === "annual" ? "yr" : "mo"}</span></span>
        </div>
      )}
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
        onFieldChange={handleFieldChange}
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
              {/* Invite-as-user row — either a status chip (already invited /
                  active user / no email on file) or the invite button. Only
                  members with billing.manageMembers capability (owner/admin)
                  see the button; everyone still sees the informational chip. */}
              {(() => {
                const st = inviteStatus(m);
                if (st === "active") return (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400" data-testid={`chip-active-user-${m.id}`}>
                    <CheckCircle2 className="size-3.5" /> Active user
                  </div>
                );
                if (st === "pending") return (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400" data-testid={`chip-invite-pending-${m.id}`}>
                    <Clock className="size-3.5" /> Invite pending
                  </div>
                );
                if (st === "noEmail") return (
                  <div className="mt-3 text-xs italic text-muted-foreground/70" data-testid={`chip-no-email-${m.id}`}>
                    Add an email to invite this member as a user
                  </div>
                );
                if (!canInviteMembers) return null;
                return (
                  <button
                    onClick={() => setInviteTarget(m)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                    data-testid={`button-invite-user-${m.id}`}
                  >
                    <UserPlus className="size-3.5" /> Invite as user
                  </button>
                );
              })()}
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

      {/* Invite confirmation dialog — shows mapped org role, seat impact, and any
          overage charge before we actually POST /api/org/invites. Only rendered
          when we have a target; the AlertDialog controls its own trigger via
          the `open` prop instead of AlertDialogTrigger so we can drive it from
          the per-card button. */}
      <AlertDialog open={inviteTarget !== null} onOpenChange={(v) => !v && setInviteTarget(null)}>
        <AlertDialogContent data-testid="dialog-invite-confirm">
          {inviteTarget && (() => {
            const role = mappedOrgRole(inviteTarget);
            const extraCents = overageChargeCents();
            const willOverage = extraCents > 0;
            const seatsAfter = projectedSeats + 1;
            const period = pricing?.billing === "annual" ? "yr" : "mo";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Invite {inviteTarget.name} as a user?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 pt-2">
                      <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
                        <div>An invite email will be sent to <span className="font-medium">{inviteTarget.email}</span>. They'll create their own password and join with the login role:</div>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"><ShieldCheck className="size-3" /> {ORG_ROLE_LABEL[role]}</div>
                        <div className="mt-2 text-xs text-muted-foreground">Mapped from their access level: <span className="font-medium">{ACCESS_BY_SLUG[(inviteTarget.accessLevel ?? "project_manager") as AccessLevel].label}</span></div>
                      </div>

                      {pricing && includedSeats !== null ? (
                        willOverage ? (
                          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                            <div className="font-medium">Seat overage · +{fmtCents(extraCents)}/{period}</div>
                            <div className="mt-1 text-xs">This will bring you to {seatsAfter} seat{seatsAfter === 1 ? "" : "s"} (plan includes {includedSeats}). Your next invoice will add {fmtCents(extraCents)} for this seat.</div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-200">
                            <div className="font-medium">No extra charge</div>
                            <div className="mt-1 text-xs">This will use {seatsAfter} of {includedSeats} included seat{includedSeats === 1 ? "" : "s"} on your {pricing.displayName} plan.</div>
                          </div>
                        )
                      ) : (
                        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">Seat pricing unavailable — your org may not be on a paid plan yet.</div>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={createInvite.isPending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); doInvite(); }}
                    disabled={createInvite.isPending}
                    data-testid="button-confirm-invite"
                  >
                    {createInvite.isPending ? "Sending…" : willOverage ? `Send invite · +${fmtCents(extraCents)}/${period}` : "Send invite"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
