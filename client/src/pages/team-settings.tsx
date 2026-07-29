import { useState } from "react";
import { Users, UserPlus, Trash2, Copy, Check, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useCurrentOrg, useOrgMembers, useOrgInvites, useCreateInvite, useRevokeInvite, useUpdateMemberRole, useRemoveMember,
  useSetMemberExecutiveOs,
  type Membership,
} from "@/hooks/use-data";
import { useExecutiveOsEntitlement } from "@/hooks/use-entitlements";
import { BillingSection } from "@/components/billing-section";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ROLES = ["owner", "admin", "pm", "foreman", "viewer"] as const;
type Role = typeof ROLES[number];

const ROLE_DESC: Record<Role, string> = {
  owner: "Full access — billing, members, projects, all data.",
  admin: "Manages members and projects. Cannot access billing.",
  pm: "Creates and manages projects. Cannot manage members.",
  foreman: "Field lead. Only sees projects they're assigned to.",
  viewer: "Read-only. Only sees projects they're assigned to.",
};

const ROLE_BADGE_COLOR: Record<Role, string> = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  admin: "bg-primary/15 text-primary",
  pm: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  foreman: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
};

export default function TeamSettingsPage() {
  const { account } = useAuth();
  const { data: orgData } = useCurrentOrg();
  const { data: membersData } = useOrgMembers();
  const { data: invitesData } = useOrgInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const setExecOs = useSetMemberExecutiveOs();
  const { seatCount: execOsSeatCount } = useExecutiveOsEntitlement();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("pm");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  // Optimistic overrides for the Executive OS switches, keyed by membership id.
  // Cleared once the mutation settles so the server row takes over again.
  const [execOsPending, setExecOsPending] = useState<Record<number, boolean>>({});

  const members = membersData?.members || [];
  const invites = invitesData?.invites || [];
  const org = orgData?.organization;
  const seats = orgData?.seats;
  const myMembership = orgData?.membership;
  const canManage = myMembership?.role === "owner" || myMembership?.role === "admin";
  const isOwner = myMembership?.role === "owner";
  const ownerAccountId = org?.ownerAccountId;

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { toast({ title: "Enter an email address", variant: "destructive" }); return; }
    try {
      const result = await createInvite.mutateAsync({ email, role: inviteRole });
      setInviteEmail("");
      setLastInviteUrl(result.inviteUrl);
      toast({ title: "Invite sent", description: `${email} was invited as ${inviteRole}. They'll receive an email shortly.` });
    } catch (err: any) {
      toast({ title: "Invite failed", description: err?.message || "Could not send invite", variant: "destructive" });
    }
  }

  async function handleChangeRole(m: Membership & { email: string }, newRole: string) {
    try {
      await updateRole.mutateAsync({ id: m.id, role: newRole });
      toast({ title: "Role updated", description: `${m.email} is now ${newRole}.` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Could not update role", variant: "destructive" });
    }
  }

  async function handleRemove(m: Membership & { email: string }) {
    try {
      await removeMember.mutateAsync(m.id);
      toast({ title: "Member removed", description: `${m.email} no longer has access.` });
    } catch (err: any) {
      toast({ title: "Remove failed", description: err?.message || "Could not remove member", variant: "destructive" });
    }
  }

  async function handleToggleExecOs(m: Membership & { email: string; displayName?: string }, enabled: boolean) {
    setExecOsPending(prev => ({ ...prev, [m.id]: enabled }));
    try {
      await setExecOs.mutateAsync({ id: m.id, enabled });
      toast({
        title: enabled ? "Executive OS enabled" : "Executive OS removed",
        description: enabled
          ? `${m.displayName || m.email} now has Executive OS. $5/mo was added to your subscription, prorated.`
          : `${m.displayName || m.email} no longer has Executive OS. Your subscription drops $5/mo.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not update Executive OS",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExecOsPending(prev => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
    }
  }

  async function handleRevoke(id: number) {
    try {
      await revokeInvite.mutateAsync(id);
      toast({ title: "Invite revoked" });
    } catch (err: any) {
      toast({ title: "Revoke failed", description: err?.message || "Could not revoke invite", variant: "destructive" });
    }
  }

  function copyLink(url: string, token: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    });
  }

  return (
    <Layout title="Team">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Header + seat usage */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <Users className="size-6 text-primary" /> Team
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage who has access to <span className="font-semibold text-foreground">{org?.name || "your org"}</span>.
            </p>
          </div>
          {seats && (
            <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <div className="text-xs text-muted-foreground">Seats used</div>
              <div className="mt-0.5 font-display text-xl font-bold">
                {seats.active}
                {seats.included !== null && <span className="text-sm font-normal text-muted-foreground"> / {seats.included} included</span>}
              </div>
              {seats.overage !== null && seats.overage > 0 && (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">+{seats.overage} overage seat{seats.overage === 1 ? "" : "s"}</div>
              )}
            </div>
          )}
        </div>

        {/* Invite form */}
        {canManage && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-sm font-bold">Invite a teammate</h2>
                <p className="text-xs text-muted-foreground">They'll get an email with a link to join.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <div>
                <Label className="text-xs">Work email</Label>
                <Input
                  type="email"
                  placeholder="teammate@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                  <SelectTrigger data-testid="select-invite-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.filter(r => r !== "owner" || isOwner).map(r => (
                      <SelectItem key={r} value={r}>
                        <span className="capitalize">{r}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleInvite}
                  disabled={createInvite.isPending || !inviteEmail}
                  className="w-full"
                  data-testid="button-send-invite"
                >
                  {createInvite.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{ROLE_DESC[inviteRole]}</p>
            {lastInviteUrl && (
              <div className="mt-3 rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <Check className="size-3.5 text-emerald-500" /> Invite created
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 font-mono text-[11px]">{lastInviteUrl}</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyLink(lastInviteUrl, lastInviteUrl)}
                  >
                    {copiedToken === lastInviteUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
                <p className="mt-1 text-muted-foreground">You can also share this link directly.</p>
              </div>
            )}
          </section>
        )}

        {/* Active members */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold">Active members</h2>
              <p className="text-xs text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {members.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No members yet.</p>
            )}
            {members.map((m) => {
              const isPrimaryOwner = m.accountId === ownerAccountId;
              const isMe = m.accountId === account?.id;
              const canModify = canManage && !isMe && !(isPrimaryOwner && !isOwner);
              const canModifyOwner = isOwner; // only owners can touch other owners
              const canModifyThisMember = canModify && (m.role !== "owner" || canModifyOwner);
              return (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{m.displayName || m.email}</div>
                      {isMe && <Badge variant="secondary" className="text-[10px]">you</Badge>}
                      {isPrimaryOwner && <Badge variant="outline" className="text-[10px]">primary owner</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Executive OS add-on. Gated on canManage rather than
                        canModifyThisMember because owners and admins may grant
                        the add-on to themselves — unlike a role change. */}
                    {canManage && m.status === "active" && (
                      <label className="flex cursor-pointer items-center gap-2 pr-1 text-xs text-muted-foreground">
                        <Switch
                          checked={execOsPending[m.id] ?? !!m.hasExecutiveOs}
                          onCheckedChange={(v) => handleToggleExecOs(m, v)}
                          disabled={execOsPending[m.id] !== undefined}
                          data-testid={`switch-exec-os-${m.id}`}
                        />
                        <span className="hidden sm:inline">Executive OS ($5/mo)</span>
                        <span className="sm:hidden">Exec OS</span>
                      </label>
                    )}
                    {canModifyThisMember ? (
                      <Select value={m.role} onValueChange={(v) => handleChangeRole(m, v)}>
                        <SelectTrigger className="h-8 w-[120px] text-xs" data-testid={`select-role-${m.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.filter(r => r !== "owner" || isOwner).map(r => (
                            <SelectItem key={r} value={r}>
                              <span className="capitalize">{r}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn("capitalize", ROLE_BADGE_COLOR[m.role as Role])}>{m.role}</Badge>
                    )}
                    {canModifyThisMember && !isPrimaryOwner && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" data-testid={`button-remove-${m.id}`}>
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.displayName || m.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They will lose access to {org?.name || "your organization"}. Your Stripe subscription seat count will update on the next invoice cycle.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemove(m)} className="bg-destructive text-destructive-foreground">Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {canManage && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Executive OS seats: <span className="font-semibold text-foreground">{execOsSeatCount}</span>
              {" · "}
              <span className="font-semibold text-foreground">${execOsSeatCount * 5}/mo</span> added to your subscription
            </p>
          )}
        </section>

        {/* Pending invites */}
        {canManage && invites.length > 0 && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="font-display text-sm font-bold">Pending invites</h2>
              <p className="text-xs text-muted-foreground">{invites.length} awaiting acceptance</p>
            </div>
            <div className="divide-y divide-border">
              {invites.map((inv) => {
                const inviteUrl = `${window.location.origin}/#/invite/${inv.token}`;
                return (
                  <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Invited as <span className="capitalize">{inv.role}</span> · expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyLink(inviteUrl, inv.token)}>
                        {copiedToken === inv.token ? <><Check className="size-3.5 mr-1" /> Copied</> : <><Copy className="size-3.5 mr-1" /> Copy link</>}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">Revoke</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke invite for {inv.email}?</AlertDialogTitle>
                            <AlertDialogDescription>The invite link will stop working.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRevoke(inv.id)} className="bg-destructive text-destructive-foreground">Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Billing (owner-only) */}
        {isOwner && <BillingSection />}

        {/* Role legend */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display text-sm font-bold">Role permissions</h3>
          <div className="mt-3 grid gap-2 text-xs">
            {ROLES.map(r => (
              <div key={r} className="flex items-start gap-3">
                <Badge className={cn("mt-0.5 shrink-0 capitalize w-16 justify-center", ROLE_BADGE_COLOR[r])}>{r}</Badge>
                <span className="text-muted-foreground">{ROLE_DESC[r]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
