import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight, Check, HardHat, ClipboardList, FileText, GitPullRequestArrow,
  MessagesSquare, CalendarRange, Camera, Bot, ShieldCheck, Sparkles,
  Quote, Star, ChevronDown, ListChecks, Layers, Radar, Truck, Plug,
} from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ============================ Pricing config ============================ */
type Plan = {
  key: "starter" | "pro" | "enterprise";
  name: string;
  tagline: string;
  monthly: number;
  annual: number; // per month when billed annually
  featured?: boolean;
  bullets: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For small crews getting off spreadsheets.",
    monthly: 49,
    annual: 39,
    bullets: [
      "Up to 5 active projects",
      "10 team members",
      "Daily logs, RFIs, submittals, punch lists",
      "Photo & document library",
      "Blueprints & drone add-ons available",
      "Mobile field app",
      "Email support",
    ],
    cta: "Start with Starter",
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "Everything a GC needs to run the job.",
    monthly: 129,
    annual: 99,
    featured: true,
    bullets: [
      "Unlimited projects",
      "Unlimited team members",
      "Change orders + cost tracking",
      "Gantt + schedule + Google Calendar",
      "Blueprints + drone-capture add-ons",
      "Jarvis AI assistant (voice)",
      "Integrations: ADP, TriNet, Sheets",
      "Priority support",
    ],
    cta: "Start with Pro",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    tagline: "Multi-office GCs and owner reps.",
    monthly: 299,
    annual: 249,
    bullets: [
      "Everything in Pro",
      "SSO / SAML + custom roles",
      "Dedicated success manager",
      "Custom integrations & API",
      "Advanced audit + reporting",
      "99.9% uptime SLA",
    ],
    cta: "Talk to sales",
  },
];

/* ============================ Subscribe form ============================ */
const subscribeSchema = z.object({
  email: z.string().email("Enter a valid email"),
  company: z.string().optional(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  billing: z.enum(["monthly", "annual"]),
});
type SubscribeValues = z.infer<typeof subscribeSchema>;

function SubscribeForm({ defaultPlan, billing }: { defaultPlan: Plan["key"]; billing: "monthly" | "annual" }) {
  const { toast } = useToast();
  const form = useForm<SubscribeValues>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: { email: "", company: "", plan: defaultPlan, billing },
  });
  // sync default when user toggles billing/plan
  if (form.getValues("billing") !== billing) form.setValue("billing", billing);
  if (form.getValues("plan") !== defaultPlan) form.setValue("plan", defaultPlan);

  const isEnterprise = form.watch("plan") === "enterprise";

  const checkoutMut = useMutation({
    mutationFn: async (v: SubscribeValues) => {
      const res = await apiRequest("POST", "/api/billing/checkout", v);
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (e: any) => {
      const msg = e?.message || "Couldn't start checkout. Please try again.";
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
    },
  });

  if (isEnterprise) {
    return (
      <a
        href="mailto:hello@trusspath.com?subject=Enterprise%20Demo%20Request"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
        data-testid="button-enterprise-contact"
      >
        Talk to sales <ArrowRight className="size-3.5" />
      </a>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => checkoutMut.mutate(v))} className="space-y-3" data-testid="form-subscribe">
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Work email</FormLabel>
            <FormControl>
              <Input placeholder="you@yourcompany.com" data-testid="input-subscribe-email" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="company" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Company (optional)</FormLabel>
            <FormControl>
              <Input placeholder="Acme Construction" data-testid="input-subscribe-company" {...field} />
            </FormControl>
          </FormItem>
        )} />
        <Button
          type="submit"
          disabled={checkoutMut.isPending}
          className="w-full"
          data-testid="button-subscribe-submit"
        >
          {checkoutMut.isPending ? "Redirecting to checkout…" : "Start subscription"}
          <ArrowRight className="ml-1 size-4" />
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">
          Secure payment via Stripe. Cancel anytime.
        </p>
      </form>
    </Form>
  );
}

/* ============================ Demo form ============================ */
const demoSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email(),
  company: z.string().min(1, "Company required"),
  phone: z.string().optional(),
  teamSize: z.string().optional(),
  notes: z.string().optional(),
});
type DemoValues = z.infer<typeof demoSchema>;

function DemoForm() {
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const form = useForm<DemoValues>({
    resolver: zodResolver(demoSchema),
    defaultValues: { name: "", email: "", company: "", phone: "", teamSize: "", notes: "" },
  });
  const mut = useMutation({
    mutationFn: async (v: DemoValues) => apiRequest("POST", "/api/demo-request", v),
    onSuccess: () => {
      setDone(true);
      toast({ title: "Demo requested", description: "A specialist will reach out within one business day." });
      form.reset();
    },
    onError: () => toast({ title: "Couldn't submit request", description: "Please try again.", variant: "destructive" }),
  });

  if (done) {
    return (
      <div className="rounded-lg border border-primary/40 bg-primary/5 p-6 text-center" data-testid="demo-success">
        <div className="font-display text-lg font-bold text-primary">Thanks — we'll be in touch.</div>
        <p className="mt-1 text-sm text-muted-foreground">Expect a call or email within one business day.</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-3" data-testid="form-demo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Full name</FormLabel>
              <FormControl><Input data-testid="input-demo-name" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Work email</FormLabel>
              <FormControl><Input data-testid="input-demo-email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="company" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Company</FormLabel>
              <FormControl><Input data-testid="input-demo-company" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Phone (optional)</FormLabel>
              <FormControl><Input data-testid="input-demo-phone" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="teamSize" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Team size</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <FormControl>
                <SelectTrigger data-testid="select-demo-team-size"><SelectValue placeholder="Select team size" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="1-10">1–10</SelectItem>
                <SelectItem value="11-50">11–50</SelectItem>
                <SelectItem value="51-200">51–200</SelectItem>
                <SelectItem value="200+">200+</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )} />
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">What are you looking to solve? (optional)</FormLabel>
            <FormControl><Textarea rows={3} data-testid="input-demo-notes" {...field} /></FormControl>
          </FormItem>
        )} />
        <Button type="submit" disabled={mut.isPending} className="w-full" data-testid="button-demo-submit">
          {mut.isPending ? "Sending…" : "Request demo"}
          <ArrowRight className="ml-1 size-4" />
        </Button>
      </form>
    </Form>
  );
}

/* ============================ FAQ list ============================ */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How is TrussPath different from legacy construction PM platforms?",
    a: "Same core capabilities (RFIs, submittals, change orders, punch lists, daily logs, blueprints, drone captures, schedule, and fleet) at roughly a third of the cost, plus a voice AI assistant, faster mobile experience, and no per-project fees. We're built for the field first, office second.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — 14 days on any plan, no credit card required. Import a real project and use it with your crew before you decide.",
  },
  {
    q: "Can we migrate from another platform or spreadsheets?",
    a: "Yes. Every paid plan includes a guided migration. We import projects, RFIs, submittals, daily logs, photos, and documents from your existing tools. Typical migration takes 3\u20135 business days.",
  },
  {
    q: "Does it work offline?",
    a: "The mobile app caches your active project. You can capture photos, daily logs, and punch items on-site with no signal \u2014 everything syncs when you're back on data or wifi.",
  },
  {
    q: "How does the Jarvis AI assistant work?",
    a: "Jarvis is a voice-and-text copilot that reads your project data and takes action. Ask \u201Cwhat's overdue?\u201D, \u201Cdraft an RFI to the MEP sub about the coordination clash,\u201D or \u201Clog today's crew.\u201D It never trains on your data.",
  },
  {
    q: "What integrations are supported?",
    a: "Google Calendar, Google Sheets, ADP, TriNet, QuickBooks, DocuSign, and Dropbox out of the box. Pro and Enterprise plans include our REST API for custom integrations.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We're SOC 2 Type II in progress with an expected completion in Q3. Enterprise plans include SSO/SAML and per-role permissions.",
  },
  {
    q: "Can I cancel or downgrade anytime?",
    a: "Yes. Monthly plans cancel at the end of the current billing cycle. Annual plans can downgrade at renewal. You keep read-only access to your data for 90 days after cancellation.",
  },
  {
    q: "Do you charge per project?",
    a: "No. Pricing is strictly per user, per month. Run as many projects as you want on any plan (Starter is capped at 5 active projects; Pro and Enterprise are unlimited).",
  },
];

function FAQList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-10 space-y-3" data-testid="faq-list">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              isOpen ? "border-primary/40" : "border-border hover:border-primary/30",
            )}
            data-testid={`faq-item-${i}`}
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-expanded={isOpen}
              data-testid={`faq-question-${i}`}
            >
              <span className="font-display text-sm font-bold md:text-base">{f.q}</span>
              <ChevronDown
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180 text-primary",
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-all duration-200 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground" data-testid={`faq-answer-${i}`}>
                  {f.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Landing page ============================ */
export default function Landing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [activePlan, setActivePlan] = useState<Plan["key"]>("pro");

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------ Nav ------------------------------ */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Logo className="size-8" />
            <div className="font-display text-base font-bold tracking-tight">TrussPath</div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground" data-testid="nav-features">Features</button>
            <button onClick={() => scrollTo("testimonials")} className="hover:text-foreground" data-testid="nav-testimonials">Testimonials</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground" data-testid="nav-pricing">Pricing</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-foreground" data-testid="nav-faq">FAQ</button>
            <button onClick={() => scrollTo("demo")} className="hover:text-foreground" data-testid="nav-demo">Demo</button>
            <button onClick={() => scrollTo("subscribe")} className="hover:text-foreground" data-testid="nav-subscribe">Subscribe</button>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => scrollTo("demo")} data-testid="button-nav-demo">Book demo</Button>
            <Link href="/login">
              <Button variant="outline" size="sm" data-testid="button-nav-signin">
                Sign in
              </Button>
            </Link>
            <Link href="/app">
              <Button size="sm" data-testid="button-nav-app">
                Open app <ArrowRight className="ml-1 size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------ Hero ------------------------------ */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <div className="ff-kicker mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px]">
              <Sparkles className="size-3 text-primary" /> Field project management, rebuilt
            </div>
            <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight md:text-5xl">
              The project management platform your <span className="text-primary">jobsite actually uses</span>.
            </h1>
            <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
              RFIs, submittals, change orders, punch lists, daily logs, blueprints, drone captures, Gantt schedules, fleet tracking, and a voice AI foreman — one system replacing legacy PM software, spreadsheets, and text threads.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => scrollTo("pricing")} data-testid="button-hero-subscribe">
                Subscribe <ArrowRight className="ml-1.5 size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => scrollTo("demo")} data-testid="button-hero-demo">
                Book a demo
              </Button>
              <Link href="/app">
                <Button size="lg" variant="ghost" data-testid="button-hero-app">Try live app →</Button>
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-primary" /> SOC 2 in progress</div>
              <div className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" /> 14-day free trial</div>
              <div className="hidden items-center gap-1.5 sm:flex"><Check className="size-3.5 text-primary" /> No card required</div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-400" />
                  <div className="size-2 rounded-full bg-amber-400" />
                  <div className="size-2 rounded-full bg-emerald-400" />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">trusspath.com / dashboard</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l: "Active Projects", v: "12", t: "text-primary" },
                    { l: "Open RFIs", v: "8", t: "text-amber-500" },
                    { l: "Due This Week", v: "23", t: "text-sky-500" },
                    { l: "Open Punch", v: "17", t: "text-violet-500" },
                  ].map((k) => (
                    <div key={k.l} className="rounded-md border border-border bg-background/60 p-2">
                      <div className="ff-kicker text-[9px]">{k.l}</div>
                      <div className={cn("font-display text-lg font-bold", k.t)}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border border-border bg-background/60 p-3">
                  <div className="ff-kicker mb-2 text-[9px]">Budget vs Actual</div>
                  <div className="flex h-16 items-end gap-1">
                    {[42, 55, 48, 63, 71, 68, 82, 75, 88].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t bg-primary/70" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border bg-background/60 p-2 text-xs">
                    <div className="ff-kicker text-[9px]">RFI-247</div>
                    <div className="mt-0.5 font-medium">MEP coordination clash</div>
                    <div className="text-[10px] text-amber-500">Due in 2d</div>
                  </div>
                  <div className="rounded-md border border-border bg-background/60 p-2 text-xs">
                    <div className="ff-kicker text-[9px]">CO-103</div>
                    <div className="mt-0.5 font-medium">Slab reinforcement upgrade</div>
                    <div className="text-[10px] text-sky-500">$24,800 pending</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-border bg-card p-3 shadow-lg md:block">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="text-xs">
                  <div className="font-display font-bold">Jarvis</div>
                  <div className="text-muted-foreground">"3 items need you today, boss."</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ Logos band ------------------------------ */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="ff-kicker text-center text-[10px] text-muted-foreground">Built for GCs, developers, and owner reps</div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-muted-foreground/70">
            <span>KIEWIT</span><span>SUFFOLK</span><span>DPR</span><span>TURNER</span><span>BALFOUR BEATTY</span><span>HENSEL PHELPS</span>
          </div>
        </div>
      </section>

      {/* ------------------------------ Features ------------------------------ */}
      <section id="features" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="ff-kicker text-primary">Features</div>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">Everything you'd expect from enterprise PM. None of the bloat.</h2>
            <p className="mt-3 text-muted-foreground">Purpose-built for the field. Fast on 4G. Works from a truck cab.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: HardHat, title: "Daily Logs", href: "/daily-logs", desc: "Weather-tagged logs with crew, deliveries, and on-site photos captured in seconds." },
              { icon: ClipboardList, title: "RFIs & Submittals", href: "/rfis", desc: "Route, track, and close out with due dates, assignees, and full audit history." },
              { icon: GitPullRequestArrow, title: "Change Orders", href: "/change-orders", desc: "Cost + schedule impact tracked from proposal to executed. No more spreadsheet drift." },
              { icon: ListChecks, title: "Punch Lists", href: "/punch", desc: "Walk-and-punch with assignees, due dates, and photo proof of closeout — synced to the schedule." },
              { icon: CalendarRange, title: "Schedule + Gantt", href: "/schedule", desc: "Classic month view, Gantt bars, and two-way sync with Google Calendar." },
              { icon: Camera, title: "Photo Log", href: "/photos", desc: "Geo-stamped, project-tagged, searchable. Every image annotated in one tap." },
              { icon: Layers, title: "Blueprints", href: "/blueprints", desc: "Sheet-level drawing management with cloud markups, version compare, and instant field access." },
              { icon: Radar, title: "Drone Captures", href: "/drone", desc: "Aerial progress flights, orthomosaic overlays, and site-to-plan comparison over time." },
              { icon: Truck, title: "Fleet & Equipment", href: "/equipment", desc: "Track fleet, hours, maintenance, and assignments across every jobsite from one register." },
              { icon: FileText, title: "Documents", href: "/documents", desc: "Drawings, submittals, and contracts with version history and role-based access." },
              { icon: MessagesSquare, title: "Messages & Notes", href: "/messages", desc: "Threaded jobsite chat plus a shared sticky board — no more lost group texts." },
              { icon: Bot, title: "Jarvis AI", href: "/app", desc: "Voice-driven copilot. 'Log today's crew,' 'draft an RFI,' 'what's overdue?'" },
            ].map((f) => (
              <Link key={f.title} href={f.href} className="group block cursor-pointer rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <f.icon className="size-4" />
                </div>
                <div className="mt-4 font-display font-bold">{f.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Integrations band ------------------------------ */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary"><Plug className="size-4" /></div>
              <div>
                <div className="font-display font-bold">Connects to the tools your back office already runs</div>
                <p className="text-sm text-muted-foreground">Payroll, accounting, documents, and calendars — synced to one source of truth.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground/70">
              <span>ADP</span><span>TriNet</span><span>QuickBooks</span><span>Google Sheets</span><span>Google Calendar</span><span>DocuSign</span><span>Dropbox</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ Testimonials ------------------------------ */}
      <section id="testimonials" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="ff-kicker text-primary">Testimonials</div>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">Trusted from the trailer to the tower crane.</h2>
            <p className="mt-3 text-muted-foreground">1,200+ jobsites run on TrussPath. Here's what supers, PMs, and owners say.</p>
          </div>

          {/* Metric strip */}
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { v: "1,200+", l: "Active jobsites" },
              { v: "92%", l: "Faster daily log time" },
              { v: "4.9", l: "Avg. G2 rating" },
              { v: "$18M", l: "Change orders tracked/yr" },
            ].map((s) => (
              <div key={s.l} className="rounded-xl border border-border bg-card p-5 text-center">
                <div className="font-display text-3xl font-black tracking-tight text-primary">{s.v}</div>
                <div className="ff-kicker mt-1 text-[10px]">{s.l}</div>
              </div>
            ))}
          </div>

          {/* Quote cards */}
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              {
                quote: "We cut daily-log time from 45 minutes to under 5. Our supers now log from the truck before they hit the office.",
                name: "Marco Delgado",
                role: "Sr. Project Manager",
                company: "Delgado Commercial",
                initials: "MD",
                color: "bg-amber-500",
              },
              {
                quote: "Change orders used to live in three spreadsheets and two group texts. Now it's one thread with a real audit trail.",
                name: "Sara Whitfield",
                role: "VP of Operations",
                company: "Ridgeline Builders",
                initials: "SW",
                color: "bg-sky-500",
              },
              {
                quote: "Jarvis is the killer feature. My superintendent literally talks to it from the cab. It drafts RFIs while he drives.",
                name: "James Okafor",
                role: "General Superintendent",
                company: "Okafor & Sons GC",
                initials: "JO",
                color: "bg-emerald-500",
              },
            ].map((t, i) => (
              <figure
                key={i}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                data-testid={`testimonial-${i}`}
              >
                <Quote className="size-5 text-primary/60" />
                <div className="mt-3 flex items-center gap-1 text-primary" aria-label="5 stars">
                  {[0, 1, 2, 3, 4].map((n) => (
                    <Star key={n} className="size-3.5 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-foreground">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                  <div className={cn("grid size-9 place-items-center rounded-full text-xs font-bold text-white", t.color)}>
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.role} · {t.company}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ Pricing ------------------------------ */}
      <section id="pricing" className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="ff-kicker text-primary">Pricing</div>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">Straight pricing. No "call for quote."</h2>
            <p className="mt-3 text-muted-foreground">Per user, per month. Cancel anytime. Save 20% annually.</p>
          </div>

          {/* Billing toggle */}
          <div className="mt-8 flex items-center justify-center">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1" data-testid="billing-toggle">
              <button
                onClick={() => setBilling("monthly")}
                className={cn("rounded-full px-4 py-1.5 text-xs font-semibold transition-colors", billing === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                data-testid="billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={cn("relative rounded-full px-4 py-1.5 text-xs font-semibold transition-colors", billing === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                data-testid="billing-annual"
              >
                Annual
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">SAVE 20%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PLANS.map((p) => {
              const price = billing === "monthly" ? p.monthly : p.annual;
              const yearly = billing === "monthly" ? p.monthly * 12 : p.annual * 12;
              const selected = activePlan === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => { setActivePlan(p.key); scrollTo("subscribe"); }}
                  className={cn(
                    "group relative flex flex-col rounded-2xl border bg-card p-6 text-left transition-all",
                    p.featured ? "border-primary shadow-lg" : "border-border hover:border-primary/40",
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  data-testid={`plan-${p.key}`}
                >
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Most popular
                    </div>
                  )}
                  <div className="ff-kicker text-[10px]">{p.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{p.tagline}</div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-black tracking-tight">${price}</span>
                    <span className="text-sm text-muted-foreground">/user/mo</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Billed {billing} · <span className="font-semibold text-foreground">${yearly.toLocaleString()}/user/year</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={cn(
                    "mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-colors",
                    p.featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border hover:border-primary hover:text-primary",
                  )}>
                    {p.cta} <ArrowRight className="size-3.5" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subscribe form beneath pricing */}
          <div id="subscribe" className="mx-auto mt-12 max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="ff-kicker text-[10px] text-primary">Subscribe</div>
            <div className="mt-1 font-display text-xl font-bold">
              Start with {PLANS.find((p) => p.key === activePlan)?.name} — <span className="text-primary">${billing === "monthly" ? PLANS.find((p) => p.key === activePlan)?.monthly : PLANS.find((p) => p.key === activePlan)?.annual}/user/mo</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Billed {billing}. Change plan or cancel anytime.</p>
            <div className="mt-5">
              <SubscribeForm defaultPlan={activePlan} billing={billing} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ FAQ ------------------------------ */}
      <section id="faq" className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="ff-kicker text-primary">FAQ</div>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">Common questions.</h2>
            <p className="mt-3 text-muted-foreground">Short answers. If we missed one, <button onClick={() => scrollTo("demo")} className="font-semibold text-primary underline-offset-2 hover:underline">book a demo</button> and ask.</p>
          </div>
          <FAQList />
          <div className="mt-10 rounded-xl border border-border bg-muted/40 p-5 text-center text-sm text-muted-foreground">
            Still have questions?{" "}
            <a href="mailto:hello@trusspath.com" className="font-semibold text-primary hover:underline">Email us</a>{" "}
            or{" "}
            <button onClick={() => scrollTo("demo")} className="font-semibold text-primary hover:underline" data-testid="faq-cta-demo">book a demo</button>.
          </div>
        </div>
      </section>

      {/* ------------------------------ Demo ------------------------------ */}
      <section id="demo" className="border-b border-border">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <div className="ff-kicker text-primary">Book a demo</div>
            <h2 className="mt-2 font-display text-3xl font-black tracking-tight md:text-4xl">See TrussPath on your jobsite.</h2>
            <p className="mt-3 text-muted-foreground">
              30 minutes with a construction ops specialist. Bring one project — we'll show you exactly how TrussPath replaces your current stack.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Live walkthrough tailored to your workflows",
                "Migration plan from your existing PM tool or spreadsheets",
                "Q&A with an ex-superintendent, not a sales rep",
                "Custom pricing for teams of 50+",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <DemoForm />
          </div>
        </div>
      </section>

      {/* ------------------------------ CTA ------------------------------ */}
      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-14 text-center">
          <h2 className="font-display text-3xl font-black tracking-tight md:text-4xl">Get out of the truck. Get into TrussPath.</h2>
          <p className="max-w-xl text-primary-foreground/80">Live app is one click away — try it with realistic seed data before you subscribe.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/app">
              <Button size="lg" variant="secondary" data-testid="button-cta-app">Open the live app <ArrowRight className="ml-1.5 size-4" /></Button>
            </Link>
            <Button size="lg" variant="outline" onClick={() => scrollTo("demo")} className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" data-testid="button-cta-demo">
              Book a demo
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------ Footer ------------------------------ */}
      <footer className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Logo className="size-5" />
            <span className="font-display text-sm font-bold text-foreground">TrussPath</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button onClick={() => scrollTo("features")} className="hover:text-foreground">Features</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground">Pricing</button>
            <button onClick={() => scrollTo("demo")} className="hover:text-foreground">Demo</button>
            <Link href="/app" className="hover:text-foreground">Live app</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <a href="mailto:hello@trusspath.com" className="hover:text-foreground">hello@trusspath.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
