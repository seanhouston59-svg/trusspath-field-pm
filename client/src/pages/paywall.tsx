import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { HardHat, Lock, ShieldCheck, LogOut, Loader2, Mail, RefreshCw, CreditCard } from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isSubscriptionActive } from "@shared/schema";
import { useEffect } from "react";

type BillingStatus = {
  plan: string | null;
  status: string | null;
  billing: string | null;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
};

const PLANS: Array<{ id: "starter" | "pro" | "enterprise"; name: string; price: string; blurb: string }> = [
  { id: "starter", name: "Starter", price: "$49/user/mo", blurb: "Small crews. Core project + field tools." },
  { id: "pro", name: "Pro", price: "$99/user/mo", blurb: "Full field PM suite with Jarvis + integrations." },
  { id: "enterprise", name: "Enterprise", price: "Custom", blurb: "SSO, custom limits, and dedicated support." },
];

export default function Paywall() {
  const { account, logout, isAuthenticated } = useAuth();
  const { toast } = useToast();

  // Fresh billing status — the /api/auth/me cache may be stale after a checkout.
  const billing = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: async () => (await apiRequest("GET", "/api/billing/status")).json(),
    refetchInterval: 15_000,
    enabled: isAuthenticated,
  });

  // If somehow a good-standing user landed here, bounce to the app. Key off
  // the *org* subscription status (multi-tenant model), and give platform
  // owners — who bypass billing entirely — the same escape hatch. Legacy
  // per-account isAccountInGoodStanding() would strand demo users here since
  // their account.subscription_status is null even though the demo org is
  // trialing. See TrussPath bug 2026-07 (demo).
  useEffect(() => {
    if (account?.role === "owner") {
      window.location.hash = "/app";
      return;
    }
    if (isSubscriptionActive(billing.data?.status)) {
      window.location.hash = "/app";
    }
  }, [account, billing.data?.status]);

  const checkoutMut = useMutation({
    mutationFn: async (plan: "starter" | "pro" | "enterprise") => {
      if (plan === "enterprise") {
        window.location.href = "mailto:hello@trusspath.com?subject=TrussPath%20Enterprise";
        return { url: null } as any;
      }
      const res = await apiRequest("POST", "/api/billing/checkout", {
        plan,
        billing: "monthly",
        email: account?.email,
        company: account?.company || "",
      });
      return (await res.json()) as { url?: string; captured?: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
      else if (data?.captured) {
        toast({
          title: "You're on the list",
          description: "Billing isn't fully live yet, but your interest has been saved.",
        });
      }
    },
    onError: (e: any) => {
      toast({ title: "Checkout failed", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const portalMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return (await res.json()) as { url?: string };
    },
    onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
    onError: (e: any) => {
      toast({ title: "Couldn't open billing portal", description: e?.message || "Please try again.", variant: "destructive" });
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
  };

  const approvalStatus = (account as any)?.approvalStatus || "pending";
  const subStatus = billing.data?.status ?? (account as any)?.subscriptionStatus ?? null;
  const approved = approvalStatus === "approved";
  const subscribed = isSubscriptionActive(subStatus);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <Logo />
            <span className="font-display font-bold text-base">TrussPath</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} data-testid="button-refresh">
              <RefreshCw className="mr-1.5 size-4" /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout().then(() => (window.location.hash = "/login"))} data-testid="button-logout">
              <LogOut className="mr-1.5 size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 p-6 md:p-10" data-testid="page-paywall">
        <section className="space-y-3 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Lock className="size-7" />
          </div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {approved && subscribed
              ? "You're all set"
              : approved
              ? "Choose a plan to unlock TrussPath"
              : approvalStatus === "denied"
              ? "Access denied"
              : "Your account is pending approval"}
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            {approvalStatus === "denied"
              ? "An admin has declined access for this account. Reach out to your TrussPath contact if you think this is a mistake."
              : "Every TrussPath account needs admin approval and an active subscription. Once both are in place, your workspace is ready to go."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <Badge variant={approved ? "default" : "secondary"} data-testid="badge-approval">
              <ShieldCheck className="mr-1 size-3.5" />
              Admin approval: {approvalStatus}
            </Badge>
            <Badge variant={subscribed ? "default" : "secondary"} data-testid="badge-subscription">
              <CreditCard className="mr-1 size-3.5" />
              Subscription: {subStatus || "none"}
            </Badge>
          </div>
        </section>

        {/* Approval step */}
        <Card data-testid="card-approval-step">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${approved ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1</span>
              Admin approval
            </CardTitle>
            <Badge variant={approved ? "default" : "secondary"}>{approvalStatus}</Badge>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {approved ? (
              <p>Your admin has approved this account. You're good on this step.</p>
            ) : approvalStatus === "denied" ? (
              <p>
                This account was denied. Contact your TrussPath admin at{" "}
                <a href="mailto:houston.sean90@gmail.com" className="text-primary hover:underline">
                  houston.sean90@gmail.com
                </a>
                .
              </p>
            ) : (
              <div className="space-y-3">
                <p>
                  Your account was created and the admin has been notified. You'll be able to sign in once
                  they approve you — usually within a business day.
                </p>
                <p>
                  Need it faster? Email{" "}
                  <a href="mailto:houston.sean90@gmail.com" className="text-primary hover:underline">
                    houston.sean90@gmail.com
                  </a>{" "}
                  from your work address.
                </p>
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:houston.sean90@gmail.com?subject=TrussPath%20approval%20request%20—%20${encodeURIComponent(account?.email || "")}&body=${encodeURIComponent(`Hi — I signed up for TrussPath as ${account?.displayName || ""} (${account?.email || ""})${account?.company ? ` at ${account.company}` : ""} and I'd like to be approved.`)}`}>
                    <Mail className="mr-1.5 size-4" /> Request approval
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription step */}
        <Card data-testid="card-subscription-step">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${subscribed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</span>
              Active subscription
            </CardTitle>
            <Badge variant={subscribed ? "default" : "secondary"}>{subStatus || "none"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscribed ? (
              <div className="text-sm text-muted-foreground">
                <p>Your subscription is active. Manage billing anytime from the customer portal.</p>
                <Button
                  className="mt-3"
                  variant="outline"
                  size="sm"
                  disabled={portalMut.isPending}
                  onClick={() => portalMut.mutate()}
                  data-testid="button-portal"
                >
                  {portalMut.isPending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CreditCard className="mr-1.5 size-4" />}
                  Manage billing
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Pick a plan to activate your workspace. You'll be redirected to Stripe checkout.
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  {PLANS.map((p) => (
                    <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-baseline justify-between">
                        <div className="font-display font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.price}</div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => checkoutMut.mutate(p.id)}
                        disabled={checkoutMut.isPending}
                        data-testid={`button-checkout-${p.id}`}
                      >
                        {checkoutMut.isPending && checkoutMut.variables === p.id ? (
                          <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : null}
                        {p.id === "enterprise" ? "Contact sales" : `Subscribe`}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <HardHat className="size-3.5" /> TrussPath — field-first construction PM
        </div>
      </main>
    </div>
  );
}
