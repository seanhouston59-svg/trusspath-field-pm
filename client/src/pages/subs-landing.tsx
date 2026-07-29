/**
 * subs.trusspath.com \u2014 sub-facing marketing landing page.
 *
 * Deliberately separate from the main TrussPath app:
 *   \u2022 Standalone URL (subs.trusspath.com \u2192 /subs)
 *   \u2022 No auth, no PM chrome, no /login link visible
 *   \u2022 QR-only workflow: this page explains what Sub Drop is; subs can
 *     only actually use it by scanning a project QR from their PM.
 *
 * Sections (locked with the user):
 *   1. Hero \u2014 what this is + primary CTA back to the GC marketing site.
 *   2. \"How it works\" \u2014 3-step visual (scan / register / drop).
 *
 * No FAQ, no pricing, no login form. If we need those later, they slot in
 * cleanly under the how-it-works block.
 */
import { QrCode, UserPlus, Upload, Shield, ArrowRight, HardHat } from "lucide-react";

// Where the GC-facing marketing site lives. Currently the same domain; if
// the user later moves marketing to trusspath.com, changing this in one
// place is enough.
const GC_MARKETING_URL = "https://trusspath.com";

export default function SubsLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-50">
      <TopBar />
      <Hero />
      <HowItWorks />
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="h-4 w-4" />
          </div>
          <div className="text-lg font-semibold tracking-tight">TrussPath <span className="text-primary">Sub Drop</span></div>
        </div>
        <a
          href={GC_MARKETING_URL}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          For GCs \u2192
        </a>
      </div>
    </header>
  );
}

function Hero() {
  // Compute the current page's own absolute URL so the QR self-references.
  // Falls back to the production URL for SSR / hydration safety. Encoding is
  // handled at the img src level.
  const landingUrl = typeof window !== "undefined"
    ? `${window.location.origin}/#/subs`
    : "https://www.trusspath.com/#/subs";
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <QrCode className="h-3.5 w-3.5" /> QR-based document drop
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Drop docs to your GC in seconds.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            COIs, safety docs, shop drawings, photos, invoices \u2014 scan the QR
            code your GC posted at the jobsite and drop files. TrussPath sorts
            them into the right folder automatically.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Free for subcontractors. Always.</li>
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Only your PM sees your uploads.</li>
            <li className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> No app to install \u2014 works in any browser.</li>
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={GC_MARKETING_URL}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              Learn about TrussPath for GCs <ArrowRight className="h-4 w-4" />
            </a>
            <span className="text-sm text-slate-500">Are you a subcontractor? Ask your PM for the QR code.</span>
          </div>
        </div>

        {/*
         * Real, scannable QR pointing back to this landing page. Two purposes:
         *   1. Prints/marketing flyers with this URL as a QR keep working —
         *      anyone who scans lands here.
         *   2. Removes the confusing "placeholder that says scan me" bug.
         *
         * We generate it via api.qrserver.com (same service the PM-side QR
         * dialog uses) so we don't have to bundle a QR library into this
         * marketing chunk. The URL is computed at render time so it works
         * on both www.trusspath.com and any preview host.
         */}
        <div className="relative mx-auto w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
              <QrCode className="h-3.5 w-3.5" /> Sub Drop
            </div>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-white p-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&data=${encodeURIComponent(landingUrl)}`}
                alt="QR code linking to the TrussPath Sub Drop landing page"
                className="h-full w-full"
                width={400}
                height={400}
                loading="lazy"
              />
            </div>
            <div className="mt-4 rounded-md bg-slate-50 p-3 text-center text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Scan to share this page. Your job's real QR comes from your PM.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: QrCode,
      title: "1. Scan the QR",
      body: "Your GC prints a QR poster for each jobsite \u2014 usually on the trailer wall or gate. Point your phone camera at it and tap the link.",
    },
    {
      icon: UserPlus,
      title: "2. Register once",
      body: "Enter your company name, trade, email, and pick a password. One time, ~30 seconds. Same login works on every project you're invited to.",
    },
    {
      icon: Upload,
      title: "3. Drop your docs",
      body: "COIs, safety docs, shop drawings, photos, invoices \u2014 drag and drop or tap Choose Files. TrussPath auto-sorts them for your PM.",
    },
  ];
  return (
    <section className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950 sm:py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Three steps. Nothing to install.</p>
        </div>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={i} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="text-lg font-semibold">{s.title}</div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="text-sm font-medium text-primary">Don't have a QR yet?</div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            Ask your project manager to send you the Sub Drop QR for your jobsite. Every project has its own.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500">
      <div className="mx-auto max-w-5xl px-6">
        \u00a9 {new Date().getFullYear()} TrussPath \u2014
        {" "}<a href={GC_MARKETING_URL} className="underline hover:text-slate-800 dark:hover:text-slate-200">For general contractors</a>
      </div>
    </footer>
  );
}
