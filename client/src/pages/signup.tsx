import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HardHat, UserPlus, Check } from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const schema = z.object({
  displayName: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  company: z.string().optional(),
  password: z.string().min(6, "At least 6 characters"),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }),
  }),
});

type FormValues = z.infer<typeof schema>;
type Plan = "starter" | "pro" | "enterprise";
type Billing = "monthly" | "annual";

// Client-side mirror of server plans (keep in sync with server/lib/plans.ts PLANS)
const PLAN_INFO: Record<Plan, { name: string; baseMonthly: number; baseAnnual: number; overageMonthly: number; overageAnnual: number; includedSeats: number; blurb: string }> = {
  starter:    { name: "Starter",    baseMonthly: 79,  baseAnnual: 790,  overageMonthly: 19, overageAnnual: 190, includedSeats: 3,  blurb: "3 seats included. Great for a lean crew getting started." },
  pro:        { name: "Pro",        baseMonthly: 149, baseAnnual: 1490, overageMonthly: 29, overageAnnual: 290, includedSeats: 5,  blurb: "5 seats included. Best for growing crews." },
  enterprise: { name: "Enterprise", baseMonthly: 299, baseAnnual: 2990, overageMonthly: 39, overageAnnual: 390, includedSeats: 10, blurb: "10 seats included. For established general contractors." },
};

/** Parse hash query params from #/signup?plan=pro&billing=monthly&invite=abc */
function readHashParams(): { plan?: Plan; billing?: Billing; invite?: string } {
  if (typeof window === "undefined") return {};
  const h = window.location.hash;
  const qIndex = h.indexOf("?");
  if (qIndex < 0) return {};
  const params = new URLSearchParams(h.slice(qIndex + 1));
  const plan = params.get("plan") as Plan | null;
  const billing = params.get("billing") as Billing | null;
  const invite = params.get("invite") || undefined;
  return {
    plan: plan && plan in PLAN_INFO ? plan : undefined,
    billing: billing === "monthly" || billing === "annual" ? billing : undefined,
    invite,
  };
}

export default function Signup() {
  const { signup, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Read plan/billing/invite from URL on mount.
  const hashParams = useMemo(readHashParams, []);
  const [plan, setPlan] = useState<Plan>(hashParams.plan || "pro");
  const [billing, setBilling] = useState<Billing>(hashParams.billing || "monthly");
  const inviteToken = hashParams.invite;
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string; orgName: string } | null>(null);

  // If an invite token was provided in the URL, look it up so we can pre-fill the email
  // and show the inviter's org name — and hide the plan selector (invitee doesn't pay).
  useEffect(() => {
    if (!inviteToken) return;
    fetch(`/api/invites/${inviteToken}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j) setInviteInfo(j); })
      .catch(() => {});
  }, [inviteToken]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", email: "", company: "", password: "", agreeTerms: false as any },
  });

  // When invite loads, pre-fill the email field (and lock it).
  useEffect(() => {
    if (inviteInfo?.email) form.setValue("email", inviteInfo.email);
  }, [inviteInfo, form]);

  useEffect(() => {
    if (isAuthenticated) window.location.hash = "/app";
  }, [isAuthenticated]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const response = await signup({
        ...values,
        // Only include plan/billing when this is a solo signup (no invite).
        ...(inviteToken ? { inviteToken } : { plan, billing }),
      });
      // If server returned a Stripe checkout URL, redirect there to complete billing.
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
        return;
      }
      // Otherwise send them into the app.
      window.location.hash = "/app";
    } catch (err: any) {
      const msg = /409/.test(err?.message) ? "That email is already registered" : err?.message || "Signup failed";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const info = PLAN_INFO[plan];
  const price = billing === "monthly" ? info.baseMonthly : info.baseAnnual;
  const perSeat = billing === "monthly" ? info.overageMonthly : info.overageAnnual;
  const period = billing === "monthly" ? "/mo" : "/yr";

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-primary/10 via-background to-background border-r border-border">
        <Link href="/" className="inline-flex items-center gap-2" data-testid="link-home">
          <Logo />
          <span className="font-display font-bold text-base">TrussPath</span>
        </Link>
        <div className="max-w-md space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <HardHat className="size-3.5 text-primary" />
            Field-first construction PM
          </div>
          {inviteInfo ? (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Join {inviteInfo.orgName} on TrussPath.
              </h1>
              <p className="text-sm text-muted-foreground">
                You've been invited as <span className="font-semibold text-foreground">{inviteInfo.role}</span>.
                Finish creating your account below to accept.
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Start your TrussPath workspace.
              </h1>
              <p className="text-sm text-muted-foreground">
                Pick a plan, start a 14-day trial, and get your crew coordinated. Cancel anytime.
              </p>
            </>
          )}
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} TrussPath, Inc.</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <Logo />
            <span className="font-display font-bold text-base">TrussPath</span>
          </div>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> Create your account
            </h2>
            <p className="text-sm text-muted-foreground">
              {inviteInfo ? "Accept your invite and create your login." : "14-day free trial. Cancel anytime."}
            </p>
          </div>

          {/* Plan picker — hidden for invite signups (they don't pay) */}
          {!inviteToken && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Choose your plan</div>
                <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setBilling("monthly")}
                    className={cn("rounded-sm px-2.5 py-1 transition-colors", billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                  >Monthly</button>
                  <button
                    type="button"
                    onClick={() => setBilling("annual")}
                    className={cn("rounded-sm px-2.5 py-1 transition-colors", billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                  >Annual <span className="ml-1 text-[10px] opacity-70">(save ~17%)</span></button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PLAN_INFO) as Plan[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={cn(
                      "rounded-md border p-2.5 text-left text-xs transition-colors",
                      plan === p ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{PLAN_INFO[p].name}</div>
                      {plan === p && <Check className="size-3.5 text-primary" />}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">{PLAN_INFO[p].includedSeats} seats</div>
                  </button>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <div className="text-2xl font-display font-bold">${price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">{period}</span></div>
                <div className="mt-1 text-xs text-muted-foreground">{info.blurb}</div>
                <div className="mt-1 text-xs text-muted-foreground">Extra seats: ${perSeat}{period}</div>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-signup">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jamie Rivera" data-testid="input-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="jamie@company.com"
                        data-testid="input-email"
                        disabled={!!inviteInfo}
                        {...field}
                      />
                    </FormControl>
                    {inviteInfo && <p className="text-[11px] text-muted-foreground">Locked to the invited email address.</p>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!inviteToken && (
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company name</FormLabel>
                      <FormControl>
                        <Input placeholder="Meridian Builders" data-testid="input-company" {...field} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">This becomes your organization's name in TrussPath.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="At least 6 characters" data-testid="input-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agreeTerms"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-terms"
                      />
                    </FormControl>
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      I agree to the{" "}
                      <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit">
                {submitting ? "Creating…" : inviteToken ? "Accept invite & create account" : "Start 14-day trial"}
              </Button>
              {!inviteToken && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Card required. You won't be charged until your trial ends.
                </p>
              )}
            </form>
          </Form>

          <div className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline" data-testid="link-login">
              Sign in
            </Link>
            .{" "}
            <Link href="/" className="text-muted-foreground hover:underline">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
