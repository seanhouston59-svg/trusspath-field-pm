import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type InviteLookup = {
  email: string;
  role: string;
  orgName: string;
  organizationId: number;
  expiresAt: string;
};

export default function InviteAcceptPage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token || "";
  const { isAuthenticated, account, refresh } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Look up the invite details.
  useEffect(() => {
    if (!token) { setError("Missing invite token."); setLoading(false); return; }
    fetch(`/api/invites/${token}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "This invite link is invalid or expired.");
      })
      .then((j) => { setInvite(j); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [token]);

  // If they're logged in with the wrong email, warn them.
  const emailMismatch = invite && account && account.email.toLowerCase() !== invite.email.toLowerCase();

  async function handleAccept() {
    if (!token) return;
    setAccepting(true);
    try {
      await apiRequest("POST", `/api/invites/${token}/accept`);
      await refresh();
      toast({ title: "Welcome aboard", description: `You've joined ${invite?.orgName}.` });
      window.location.hash = "/app";
    } catch (err: any) {
      const msg = err?.message || "Could not accept invite";
      toast({ title: "Accept failed", description: msg, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  }

  const bg = (
    <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-background border-r border-border">
      <Link href="/" className="inline-flex items-center gap-2">
        <Logo />
        <span className="font-display font-bold text-base">TrussPath</span>
      </Link>
      <div className="max-w-md space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" />
          Invitation
        </div>
        {invite ? (
          <>
            <h1 className="font-display text-3xl font-bold leading-tight">
              You've been invited to {invite.orgName}.
            </h1>
            <p className="text-sm text-muted-foreground">
              Accept to start collaborating on projects, RFIs, submittals, and daily logs.
            </p>
          </>
        ) : (
          <h1 className="font-display text-3xl font-bold leading-tight">Team invitation</h1>
        )}
      </div>
      <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} TrussPath, Inc.</div>
    </div>
  );

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {bg}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <Logo />
            <span className="font-display font-bold text-base">TrussPath</span>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading invite…
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 text-destructive" />
                <div>
                  <div className="font-semibold">Invite unavailable</div>
                  <div className="text-muted-foreground">{error}</div>
                </div>
              </div>
              <Link href="/login" className="text-sm text-primary hover:underline">Go to sign in</Link>
            </div>
          )}

          {!loading && !error && invite && (
            <>
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-bold">
                  Join {invite.orgName}
                </h2>
                <p className="text-sm text-muted-foreground">
                  You've been invited to <span className="font-mono text-foreground">{invite.email}</span> as{" "}
                  <span className="font-semibold text-foreground capitalize">{invite.role}</span>.
                </p>
              </div>

              {/* Case A — logged in with matching email → one-click accept */}
              {isAuthenticated && !emailMismatch && (
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full"
                  data-testid="button-accept-invite"
                >
                  {accepting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Accepting…</> : <>Accept invite <ArrowRight className="ml-2 size-4" /></>}
                </Button>
              )}

              {/* Case B — logged in with a different email → warn */}
              {isAuthenticated && emailMismatch && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 text-amber-500" />
                    <div>
                      <div className="font-semibold">Wrong account</div>
                      <div className="text-muted-foreground">
                        You're signed in as <span className="font-mono">{account?.email}</span>, but this invite is for{" "}
                        <span className="font-mono">{invite.email}</span>. Sign out and sign in with the invited email.
                      </div>
                    </div>
                  </div>
                  <Link href="/login">
                    <Button variant="outline" className="w-full">Switch account</Button>
                  </Link>
                </div>
              )}

              {/* Case C — not logged in → choose sign in or create account */}
              {!isAuthenticated && (
                <div className="space-y-2">
                  <Link href={`/signup?invite=${token}`}>
                    <Button className="w-full" data-testid="button-create-account">
                      Create your account <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                  <Link href={`/login?invite=${token}`}>
                    <Button variant="outline" className="w-full">I already have an account</Button>
                  </Link>
                  <p className="text-[11px] text-muted-foreground text-center pt-1">
                    You won't be charged — you're joining {invite.orgName}'s existing subscription.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
