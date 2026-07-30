import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight, Check, HardHat, ClipboardList, CalendarRange, Bot, ShieldCheck,
  Quote, Layers, Smartphone, WifiOff, Truck, Plug, BarChart3, Upload, PencilRuler,
} from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import heroImg from "@/assets/landing/hero.webp";
import fieldKitImg from "@/assets/landing/field_kit.webp";
import execOsImg from "@/assets/landing/exec_os.webp";
import subDropImg from "@/assets/landing/sub_drop.webp";

/* ============================ Pricing config ============================ */
// Kept in sync with client/src/pages/signup.tsx PLAN_INFO. Any price change
// here must also change there.
type Plan = {
  key: "starter" | "pro" | "enterprise";
  name: string;
  tagline: string;
  baseMonthly: number;    // $/mo flat when billed monthly
  baseAnnual: number;     // $/yr flat when billed annually
  overageMonthly: number; // $/seat over the included count, billed monthly
  overageAnnual: number;  // $/seat/year over the included count, billed annually
  includedSeats: number;
  featured?: boolean;
  bullets: string[];
  cta: string;
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For a lean crew getting started.",
    baseMonthly: 79,
    baseAnnual: 790,
    overageMonthly: 19,
    overageAnnual: 190,
    includedSeats: 3,
    bullets: [
      "3 seats included",
      "Up to 5 active projects",
      "Daily logs, RFIs, submittals, punch lists",
      "Mobile field kit (PWA, offline)",
      "Photo & document library",
      "Email support",
    ],
    cta: "Start with Starter",
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "Best for growing crews.",
    baseMonthly: 149,
    baseAnnual: 1490,
    overageMonthly: 29,
    overageAnnual: 290,
    includedSeats: 5,
    featured: true,
    bullets: [
      "5 seats included",
      "Unlimited projects",
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
    tagline: "For established general contractors.",
    baseMonthly: 299,
    baseAnnual: 2990,
    overageMonthly: 39,
    overageAnnual: 390,
    includedSeats: 10,
    bullets: [
      "10 seats included",
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

/** Price of the Executive OS per-seat add-on, in dollars/user/month.
 *  Mirrors EXECUTIVE_OS_ADDON_AMOUNT_CENTS in server/lib/plans.ts. */
const EXEC_OS_MONTHLY = 5;

/* ============================ Subscribe CTA ============================ */
// The landing subscribe CTA hands off to /signup which is the single source
// of truth for pricing + Stripe checkout (see server/lib/plans.ts).
// Do NOT call /api/billing/checkout here — that path uses stale STRIPE_PRICE_*
// env vars from an older pricing generation.
function signupHref(plan: Plan["key"], billing: "monthly" | "annual") {
  return `/signup#/signup?plan=${plan}&billing=${billing}`;
}

// Existing-user entry point. Same path#hash shape as signupHref: the path half
// survives a cold load (Vercel rewrites it to index.html and main.tsx seeds the
// hash from it), the hash half drives the client router.
const LOGIN_HREF = "/login#/login";

function SubscribeForm({ defaultPlan, billing }: { defaultPlan: Plan["key"]; billing: "monthly" | "annual" }) {
  const isEnterprise = defaultPlan === "enterprise";
  if (isEnterprise) {
    return (
      <a
        href="mailto:hello@trusspath.com?subject=Enterprise%20Demo%20Request"
        className="lp-rule inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
        data-testid="button-enterprise-contact"
      >
        Talk to sales <ArrowRight className="size-3.5" />
      </a>
    );
  }
  return (
    <div className="space-y-3" data-testid="form-subscribe">
      <a
        href={signupHref(defaultPlan, billing)}
        className="lp-accent-bg inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        data-testid="button-subscribe-submit"
      >
        Continue to signup <ArrowRight className="size-4" />
      </a>
      <p className="lp-muted text-center text-[11px]">
        14-day free trial. Secure payment via Stripe. Cancel anytime.
      </p>
    </div>
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
        <p className="lp-muted mt-1 text-sm">Expect a call or email within one business day.</p>
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

/* ============================ Featured capabilities ============================ */
const FEATURED = [
  {
    id: "featured-field-kit",
    kicker: "Mobile field kit",
    title: "Runs on one bar of signal",
    body: "Installs to the home screen from any phone browser. Daily logs, timecards, punch, and GPS-stamped photos queue on the device and drain when you're back on data.",
    img: fieldKitImg,
    w: 1200,
    h: 896,
    alt: "Superintendent filling out a daily log on a phone at a jobsite",
    anchor: "field-kit",
  },
  {
    id: "featured-exec-os",
    kicker: "Executive OS",
    title: "The whole book of work, one screen",
    body: "Portfolio roll-ups across every job — setup, pre-con, mobilization, financials, contracts, inspections. Board packets generated from live project data.",
    img: execOsImg,
    w: 1200,
    h: 800,
    alt: "Executive reviewing portfolio dashboards for multiple construction projects",
    anchor: "exec-os-addon",
    chip: `$${EXEC_OS_MONTHLY}/user/mo add-on`,
  },
  {
    id: "featured-sub-drop",
    kicker: "Sub Drop",
    title: "Subs upload without a seat",
    body: "Post a QR code in the trailer. Subs scan, register once, and drop insurance certs, submittals, and closeout docs straight into your review inbox. No license, no chasing email.",
    img: subDropImg,
    w: 1200,
    h: 800,
    alt: "Subcontractor scanning a QR code to upload documents from the field",
    anchor: "sub-drop",
  },
];

/* ============================ Feature buckets ============================ */
const BUCKETS = [
  {
    id: "field-kit",
    icon: Smartphone,
    title: "Mobile field kit",
    body: "PWA install, offline queue, GPS photos, timecards, voice notes, walk-and-punch. Built for the truck cab.",
    items: ["Offline daily log", "Timecard", "Photo + observation", "Voice note", "Punch walk"],
  },
  {
    id: "field-ops",
    icon: HardHat,
    title: "Field ops & reporting",
    body: "Weather-tagged daily logs, a searchable photo log, punch lists with photo proof, and aerial progress captures.",
    items: ["Daily logs", "Photo log", "Punch lists", "Drone captures"],
  },
  {
    id: "paperwork",
    icon: ClipboardList,
    title: "Requests & paperwork",
    body: "Route it, track it, close it out. Due dates, assignees, and a full audit trail on every record.",
    items: ["RFIs", "Submittals", "Change orders", "Tasks + action items"],
  },
  {
    id: "schedule",
    icon: CalendarRange,
    title: "Schedule & sequencing",
    body: "Month view, Gantt bars, and a CPM diagram off the same task set. Two-way sync with Google Calendar.",
    items: ["Schedule", "Gantt", "CPM diagram", "Calendar sync"],
  },
  {
    id: "drawings",
    icon: PencilRuler,
    title: "Drawings & documents",
    body: "Sheet-level drawing management with cloud markups and version compare, plus project and company doc libraries.",
    items: ["Blueprints", "Markups", "Version history", "Company docs"],
  },
  {
    id: "people",
    icon: Truck,
    title: "People, time & fleet",
    body: "Roster, contacts, timesheets, and an equipment register with hours and maintenance across every jobsite.",
    items: ["Project team", "Contacts", "Timesheets", "Fleet & equipment"],
  },
  {
    id: "sub-drop",
    icon: Upload,
    title: "Subcontractor portal",
    body: "Sub Drop gives every sub a QR-code upload lane into your review inbox — no seat, no login sprawl, no lost attachments.",
    items: ["QR onboarding", "Upload inbox", "PM review + categorize", "Zero seat cost"],
  },
  {
    id: "exec-os",
    icon: BarChart3,
    title: "Executive OS",
    body: "The portfolio layer above your projects: cross-job roll-ups, stage-gate readiness, contracts, inspections, and board packets.",
    items: ["Portfolio roll-ups", "Financials", "Contracts register", "Board packets"],
    chip: `$${EXEC_OS_MONTHLY}/user/mo`,
  },
];

/* ============================ Testimonials ============================ */
// PLACEHOLDER COPY — these three quotes and the names/companies attached to
// them are samples written in-house, not real customer statements. Swap them
// for approved, attributable quotes before launch. See the PR description.
const TESTIMONIALS = [
  {
    quote: "Daily logs went from a 45-minute end-of-day chore to something the supers finish in the truck before they pull off site.",
    name: "Alex M.",
    role: "Project Manager at ExampleCo",
  },
  {
    quote: "The field kit is the whole thing. My foreman punches a wall from his phone, GPS on the photo, and it's in the list before he walks back.",
    name: "Dana R.",
    role: "VP Operations at Sample Builders",
  },
  {
    quote: "Sub Drop killed the certificate-of-insurance email chase. The subs scan the sign in the trailer and the doc lands in our inbox.",
    name: "Chris T.",
    role: "General Superintendent at Placeholder GC",
  },
];

/* ============================ FAQ ============================ */
const FAQS: { q: string; a: string }[] = [
  {
    q: "How does seat pricing work?",
    a: "Every plan is a flat monthly rate with seats included — 3 on Starter, 5 on Pro, 10 on Enterprise. Extra people are billed at the plan's overage rate ($19, $29, or $39 per seat per month). No per-project fees. Starter caps at 5 active projects; Pro and Enterprise are unlimited.",
  },
  {
    q: "What is the Executive OS add-on?",
    a: `Executive OS is the portfolio layer above your projects — cross-job roll-ups, stage-gate readiness, financial summaries, contracts, inspections, and board packets. It is $${EXEC_OS_MONTHLY} per user per month, granted seat by seat by an owner or admin under Settings → Team, and prorated onto your existing subscription immediately. Turn it off any time and the charge drops at the next invoice.`,
  },
  {
    q: "Do subcontractors need a paid seat?",
    a: "No. Subs use the Sub Drop portal: you post a QR code, they scan it, register once, and upload documents into your review inbox. They never consume a seat on your subscription. Only your own staff — PMs, supers, foremen, execs — count against seats.",
  },
  {
    q: "Does it really work offline?",
    a: "Yes. Install TrussPath to your home screen from any modern phone browser. The field kit — daily log, timecard, punch, photo, observation, voice note — caches locally and queues everything while you're out of signal. The queue drains automatically when you're back on data or wifi.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is scoped per organization and per role, and every record carries an audit trail. SOC 2 Type II is in progress. Enterprise plans add SSO/SAML and custom role definitions.",
  },
  {
    q: "Who owns the data, and can we export it?",
    a: "You do. Your projects, logs, photos, and documents are yours — export to CSV or Excel from any list view, pull documents and photos in bulk, or use the REST API on Pro and Enterprise. We never train AI models on your project data.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — 14 days on any plan, no credit card required. Load a real project and run it with your crew before you decide. Paid plans also include a guided migration from your existing PM tool or spreadsheets, typically 3–5 business days.",
  },
  {
    q: "Can I cancel or downgrade anytime?",
    a: "Yes. Monthly plans cancel at the end of the current billing cycle; annual plans downgrade at renewal. You keep read-only access to your data for 90 days after cancellation so you can export everything you need.",
  },
];

/* ============================ Landing page ============================ */
export default function Landing() {
  // Monthly is the default view: it's the price most crews are comparing
  // against, and the annual discount reads better as a saving off it.
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [activePlan, setActivePlan] = useState<Plan["key"]>("pro");

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="lp-theme lp-paper min-h-screen">
      {/* ------------------------------ 1. Sticky header ------------------------------ */}
      <header className="lp-rule sticky top-0 z-30 border-b bg-[hsl(var(--lp-paper)/0.88)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Logo className="size-8" />
            <div className="lp-display text-lg">TrussPath</div>
          </div>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            <button onClick={() => scrollTo("product")} className="lp-link" data-testid="nav-features">Product</button>
            <button onClick={() => scrollTo("pricing")} className="lp-link" data-testid="nav-pricing">Pricing</button>
            <button onClick={() => scrollTo("faq")} className="lp-link" data-testid="nav-faq">FAQ</button>
            <button onClick={() => scrollTo("demo")} className="lp-link" data-testid="nav-demo">Book demo</button>
          </nav>
          <div className="flex items-center gap-2">
            {/* asChild so this renders a single <a>. Wrapping a <Button> in a
                wouter <Link> nests a <button> inside the <a>, which is invalid
                HTML — iOS Safari then swallows the tap instead of following the
                link, leaving the neighbouring "Get started" as the only control
                that responds. */}
            <Button asChild variant="ghost" size="sm" data-testid="button-nav-signin">
              <a href={LOGIN_HREF}>Sign in</a>
            </Button>
            <a
              href={signupHref(activePlan, billing)}
              className="lp-accent-bg inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              data-testid="button-nav-app"
            >
              Get started <ArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ------------------------------ 2. Hero ------------------------------ */}
      <section className="lp-rule lp-grit border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <div>
              <div className="lp-accent-soft ff-kicker inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[10px]">
                <HardHat className="size-3" /> Built by field people
              </div>
              <h1 className="lp-display mt-5 text-[2.75rem] sm:text-6xl lg:text-[4.25rem]">
                The jobsite doesn't wait for<br className="hidden sm:block" /> the <span className="lp-accent-text">office to catch up</span>.
              </h1>
              <p className="lp-muted mt-6 max-w-xl text-lg leading-relaxed">
                One platform for the paperwork and the dirt. Daily logs, RFIs, submittals, change
                orders, punch, drawings, schedule, and fleet — reachable from a phone with one bar
                of signal, and from a desk when you get back.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href={signupHref(activePlan, billing)}
                  className="lp-accent-bg inline-flex items-center gap-2 rounded-md px-6 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
                  data-testid="button-hero-subscribe"
                >
                  Start free trial <ArrowRight className="size-4" />
                </a>
                <button
                  onClick={() => scrollTo("product")}
                  className="lp-rule inline-flex items-center gap-2 rounded-md border px-6 py-3.5 text-base font-semibold transition-colors hover:border-primary hover:text-primary"
                  data-testid="button-hero-how"
                >
                  See how it works
                </button>
              </div>
              <dl className="lp-rule mt-9 grid max-w-lg grid-cols-2 gap-x-6 gap-y-3 border-t pt-6 text-sm sm:grid-cols-4">
                {[
                  { icon: Smartphone, l: "Installs to phone" },
                  { icon: WifiOff, l: "Works offline" },
                  { icon: ShieldCheck, l: "SOC 2 in progress" },
                  { icon: Check, l: "14-day trial" },
                ].map(({ icon: Icon, l }) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <Icon className="lp-accent-text size-4 shrink-0" />
                    <dt className="lp-muted text-xs">{l}</dt>
                  </div>
                ))}
              </dl>
            </div>
            <div className="lp-rule relative overflow-hidden rounded-lg border shadow-xl">
              <img
                src={heroImg}
                width={1536}
                height={1024}
                alt="Construction crew working on a steel-framed building at sunrise"
                className="block h-auto w-full object-cover"
              />
              <div className="lp-slab absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 py-3">
                <div className="lp-accent-bg grid size-8 shrink-0 place-items-center rounded-full">
                  <Bot className="size-4" />
                </div>
                <div className="text-xs">
                  <div className="font-display font-bold">Jarvis</div>
                  <div className="text-white/70">"Three items need you today, boss."</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ 3. Featured capabilities ------------------------------ */}
      <section id="product" className="lp-rule lp-paper-2 border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <div className="ff-kicker lp-accent-text">Three ways in</div>
            <h2 className="lp-display mt-2 text-3xl md:text-4xl">
              The field, the portfolio, and everyone outside your company.
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {FEATURED.map((f) => (
              <article
                key={f.id}
                id={f.id}
                className="lp-card flex flex-col overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-lg"
                data-testid={f.id}
              >
                <img
                  src={f.img}
                  width={f.w}
                  height={f.h}
                  alt={f.alt}
                  loading="lazy"
                  className="block aspect-[3/2] w-full object-cover"
                />
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-2">
                    <span className="ff-kicker lp-accent-text text-[10px]">{f.kicker}</span>
                    {f.chip && (
                      <span className="lp-accent-soft rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold" data-testid="chip-exec-os-addon">
                        {f.chip}
                      </span>
                    )}
                  </div>
                  <h3 className="lp-display mt-2 text-xl">{f.title}</h3>
                  <p className="lp-muted mt-2 flex-1 text-sm leading-relaxed">{f.body}</p>
                  <button
                    onClick={() => scrollTo(f.anchor)}
                    className="lp-accent-text mt-5 inline-flex items-center gap-1.5 self-start text-sm font-bold transition-transform hover:translate-x-0.5"
                  >
                    Learn more <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ 4. Full feature grid ------------------------------ */}
      <section id="features" className="lp-rule border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <div className="ff-kicker lp-accent-text">Everything in the box</div>
            <h2 className="lp-display mt-2 text-3xl md:text-4xl">
              Enterprise scope. None of the enterprise ceremony.
            </h2>
            <p className="lp-muted mt-3">
              Eight areas, one login, one source of truth. Nothing here is a separate purchase
              except Executive OS.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {BUCKETS.map((b) => (
              <div
                key={b.id}
                id={b.id}
                className="lp-card flex flex-col rounded-lg p-5 transition-colors hover:border-primary/50"
                data-testid={`bucket-${b.id}`}
              >
                <div className="lp-accent-soft grid size-9 place-items-center rounded-md">
                  <b.icon className="size-4" />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <h3 className="font-display font-bold">{b.title}</h3>
                  {b.chip && (
                    <span className="lp-accent-soft rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold">{b.chip}</span>
                  )}
                </div>
                <p className="lp-muted mt-1.5 flex-1 text-sm leading-relaxed">{b.body}</p>
                <ul className="lp-rule mt-4 space-y-1.5 border-t pt-3 text-xs">
                  {b.items.map((i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="lp-accent-text mt-px size-3 shrink-0" />
                      <span className="lp-muted">{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Integrations strip */}
          <div className="lp-card mt-8 flex flex-col items-start gap-5 rounded-lg p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="lp-accent-soft grid size-9 shrink-0 place-items-center rounded-md"><Plug className="size-4" /></div>
              <div>
                <div className="font-display font-bold">Connects to what your back office already runs</div>
                <p className="lp-muted text-sm">Payroll, accounting, documents, and calendars on one source of truth.</p>
              </div>
            </div>
            <div className="lp-muted flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs font-semibold uppercase tracking-wider">
              <span>ADP</span><span>TriNet</span><span>QuickBooks</span><span>Sheets</span><span>Calendar</span><span>DocuSign</span><span>Dropbox</span>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ 5. Testimonials ------------------------------ */}
      <section id="testimonials" className="lp-rule lp-slab border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <div className="ff-kicker lp-accent-text">From the trailer</div>
            <h2 className="lp-display mt-2 text-3xl md:text-4xl">What crews say once it's on the phone.</h2>
            <p className="mt-3 text-sm text-white/60">
              Sample quotes — representative of feedback, not yet attributed to named customers.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <figure
                key={t.name}
                className="flex h-full flex-col rounded-lg border border-white/12 bg-white/[0.04] p-6"
                data-testid={`testimonial-${i}`}
              >
                <Quote className="lp-accent-text size-5" />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-white/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 border-t border-white/12 pt-4">
                  <div className="text-sm font-bold">{t.name}</div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-white/50">{t.role}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">Sample quote</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ 6. Pricing ------------------------------ */}
      <section id="pricing" className="lp-rule lp-paper-2 border-b">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="max-w-2xl">
            <div className="ff-kicker lp-accent-text">Pricing</div>
            <h2 className="lp-display mt-2 text-3xl md:text-4xl">Published rates. No "call for a quote."</h2>
            <p className="lp-muted mt-3">Flat monthly rate, seats included, extra seats priced up front. Annual billing saves about 17%.</p>
          </div>

          {/* Billing toggle — monthly first and selected by default. */}
          <div className="mt-8">
            <div className="lp-rule inline-flex items-center gap-1 rounded-md border bg-[hsl(var(--card))] p-1" data-testid="billing-toggle">
              <button
                onClick={() => setBilling("monthly")}
                className={cn(
                  "rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  billing === "monthly" ? "lp-accent-bg" : "lp-muted hover:text-foreground",
                )}
                data-testid="billing-monthly"
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={cn(
                  "rounded px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors",
                  billing === "annual" ? "lp-accent-bg" : "lp-muted hover:text-foreground",
                )}
                data-testid="billing-annual"
              >
                Annual
                <span className={cn("ml-1.5 font-mono text-[9px]", billing === "annual" ? "text-white/80" : "lp-accent-text")}>
                  SAVE ~17%
                </span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PLANS.map((p) => {
              const price = billing === "monthly" ? p.baseMonthly : p.baseAnnual;
              const overage = billing === "monthly" ? p.overageMonthly : p.overageAnnual;
              const period = billing === "monthly" ? "/mo" : "/yr";
              const selected = activePlan === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => { setActivePlan(p.key); scrollTo("subscribe"); }}
                  className={cn(
                    "lp-card relative flex flex-col rounded-lg p-6 text-left transition-all",
                    p.featured && "shadow-lg",
                    selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50",
                  )}
                  data-testid={`plan-${p.key}`}
                >
                  {p.featured && (
                    <div className="lp-accent-bg absolute -top-2.5 left-6 rounded-sm px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider">
                      Most popular
                    </div>
                  )}
                  <div className="ff-kicker text-[10px]">{p.name}</div>
                  <div className="lp-muted mt-1 text-sm">{p.tagline}</div>
                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="lp-display text-5xl">${price.toLocaleString()}</span>
                    <span className="lp-muted text-sm">{period}</span>
                  </div>
                  <div className="lp-muted mt-1 text-xs">
                    {p.includedSeats} seats included · <span className="font-semibold text-foreground">Extra seats ${overage}{period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Check className="lp-accent-text mt-0.5 size-4 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className={cn(
                    "mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-bold transition-colors",
                    p.featured ? "lp-accent-bg" : "lp-rule border hover:border-primary hover:text-primary",
                  )}>
                    {p.cta} <ArrowRight className="size-3.5" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Executive OS add-on callout */}
          <div
            id="exec-os-addon"
            className="lp-card mt-6 flex flex-col items-start gap-5 rounded-lg p-6 md:flex-row md:items-center md:justify-between"
            data-testid="exec-os-addon-callout"
          >
            <div className="flex items-start gap-3">
              <div className="lp-accent-soft grid size-10 shrink-0 place-items-center rounded-md"><Layers className="size-5" /></div>
              <div>
                <div className="font-display text-lg font-bold">
                  + ${EXEC_OS_MONTHLY}/user/month — Executive OS add-on
                </div>
                <p className="lp-muted mt-1 max-w-2xl text-sm leading-relaxed">
                  Portfolio roll-ups, stage-gate readiness, financial summaries, contracts,
                  inspections, and board packets across every job. Granted seat by seat by an owner
                  or admin, prorated onto your subscription, off any time.
                </p>
              </div>
            </div>
            <button
              onClick={() => scrollTo("featured-exec-os")}
              className="lp-rule inline-flex shrink-0 items-center gap-1.5 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
              data-testid="button-exec-os-learn-more"
            >
              What's inside <ArrowRight className="size-3.5" />
            </button>
          </div>

          {/* Subscribe handoff */}
          <div id="subscribe" className="lp-card mx-auto mt-10 max-w-md rounded-lg p-6 shadow-sm">
            <div className="ff-kicker lp-accent-text text-[10px]">Subscribe</div>
            {(() => {
              const activeP = PLANS.find((p) => p.key === activePlan)!;
              const activePrice = billing === "monthly" ? activeP.baseMonthly : activeP.baseAnnual;
              const activePeriod = billing === "monthly" ? "/mo" : "/yr";
              return (
                <>
                  <div className="mt-1 font-display text-xl font-bold">
                    Start with {activeP.name} — <span className="lp-accent-text">${activePrice.toLocaleString()}{activePeriod}</span>
                  </div>
                  <p className="lp-muted mt-1 text-xs">Includes {activeP.includedSeats} seats. Billed {billing}. Change plan or cancel anytime.</p>
                </>
              );
            })()}
            <div className="mt-5">
              <SubscribeForm defaultPlan={activePlan} billing={billing} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------ 7. FAQ ------------------------------ */}
      <section id="faq" className="lp-rule border-b">
        <div className="mx-auto max-w-4xl px-4 py-16 md:py-20">
          <div className="ff-kicker lp-accent-text">FAQ</div>
          <h2 className="lp-display mt-2 text-3xl md:text-4xl">Straight answers.</h2>
          <Accordion type="single" collapsible defaultValue="faq-0" className="mt-8" data-testid="faq-list">
            {FAQS.map((f, i) => (
              <AccordionItem key={f.q} value={`faq-${i}`} className="lp-rule" data-testid={`faq-item-${i}`}>
                <AccordionTrigger className="text-left font-display text-base font-bold" data-testid={`faq-question-${i}`}>
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="lp-muted text-sm leading-relaxed" data-testid={`faq-answer-${i}`}>
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="lp-card mt-8 rounded-lg p-5 text-center text-sm">
            <span className="lp-muted">Didn't find it? </span>
            <a href="mailto:hello@trusspath.com" className="lp-accent-text font-semibold hover:underline">Email us</a>
            <span className="lp-muted"> or </span>
            <button onClick={() => scrollTo("demo")} className="lp-accent-text font-semibold hover:underline" data-testid="faq-cta-demo">book a demo</button>
            <span className="lp-muted">.</span>
          </div>
        </div>
      </section>

      {/* ------------------------------ Demo ------------------------------ */}
      <section id="demo" className="lp-rule lp-paper-2 border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-2 md:py-20">
          <div>
            <div className="ff-kicker lp-accent-text">Book a demo</div>
            <h2 className="lp-display mt-2 text-3xl md:text-4xl">See it on your jobsite.</h2>
            <p className="lp-muted mt-3">
              Thirty minutes with a construction ops specialist. Bring one project — we'll show you
              exactly what TrussPath replaces.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Live walkthrough on your workflows",
                "Field kit demo on a real phone (bring yours)",
                "Migration plan off your current tool or spreadsheets",
                "Q&A with an ex-superintendent, not a sales rep",
                "Custom pricing for teams of 50+",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Check className="lp-accent-text mt-0.5 size-4 shrink-0" /> <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-card rounded-lg p-6 shadow-sm">
            <DemoForm />
          </div>
        </div>
      </section>

      {/* ------------------------------ Closing CTA ------------------------------ */}
      <section className="lp-slab lp-rule border-b">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="lp-display text-3xl md:text-4xl">Get out of the truck. Get into TrussPath.</h2>
            <p className="mt-2 max-w-xl text-white/60">
              Fourteen days free, no card. Installs to the home screen in one tap.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={signupHref(activePlan, billing)}
              className="lp-accent-bg inline-flex items-center gap-2 rounded-md px-6 py-3.5 text-base font-bold transition-opacity hover:opacity-90"
              data-testid="button-cta-signup"
            >
              Start free trial <ArrowRight className="size-4" />
            </a>
            <button
              onClick={() => scrollTo("demo")}
              className="inline-flex items-center rounded-md border border-white/25 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              data-testid="button-cta-demo"
            >
              Book a demo
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------ 8. Footer ------------------------------ */}
      <footer className="lp-paper">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <Logo className="size-7" />
                <span className="lp-display text-base">TrussPath</span>
              </div>
              <p className="lp-muted mt-3 max-w-xs text-sm leading-relaxed">
                Field-first construction project management. Built for crews who make decisions
                standing up.
              </p>
            </div>
            <div>
              <div className="ff-kicker text-[10px]">Product</div>
              <ul className="lp-muted mt-3 space-y-2 text-sm">
                <li><button onClick={() => scrollTo("product")} className="lp-link">Overview</button></li>
                <li><button onClick={() => scrollTo("field-kit")} className="lp-link">Field kit</button></li>
                <li><button onClick={() => scrollTo("exec-os-addon")} className="lp-link">Executive OS</button></li>
                <li><Link href="/subs" className="lp-link">Sub Drop</Link></li>
                <li><button onClick={() => scrollTo("pricing")} className="lp-link">Pricing</button></li>
              </ul>
            </div>
            <div>
              <div className="ff-kicker text-[10px]">Company</div>
              <ul className="lp-muted mt-3 space-y-2 text-sm">
                <li><button onClick={() => scrollTo("demo")} className="lp-link">Book a demo</button></li>
                <li><button onClick={() => scrollTo("faq")} className="lp-link">FAQ</button></li>
                <li><Link href="/login" className="lp-link">Sign in</Link></li>
                <li><a href={signupHref("pro", "monthly")} className="lp-link">Get started</a></li>
              </ul>
            </div>
            <div>
              <div className="ff-kicker text-[10px]">Legal & contact</div>
              <ul className="lp-muted mt-3 space-y-2 text-sm">
                <li><Link href="/terms" className="lp-link">Terms of service</Link></li>
                <li><Link href="/privacy" className="lp-link">Privacy policy</Link></li>
                <li><a href="mailto:hello@trusspath.com" className="lp-link">hello@trusspath.com</a></li>
                <li><a href="mailto:support@trusspath.com" className="lp-link">support@trusspath.com</a></li>
              </ul>
            </div>
          </div>
          <div className="lp-rule lp-muted mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>© {new Date().getFullYear()} TrussPath. All rights reserved.</span>
            <span className="font-mono uppercase tracking-wider">Encrypted in transit and at rest · SOC 2 Type II in progress</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
