/**
 * Public Sub Drop Portal page.
 *
 * URL: /drop/:token \u2014 the token is the per-project QR code sub scans at the
 * jobsite. This single component drives four screens via local state:
 *
 *   loading       \u2014 spin while we fetch /api/drop/:token/info
 *   invalid       \u2014 token missing/revoked; show a friendly error
 *   auth          \u2014 not signed in yet; show register + login tabs
 *   upload        \u2014 signed in; show the drag-drop upload UI + recent uploads
 *
 * Everything below the header is intentionally simple \u2014 subs use this on a
 * phone at a jobsite with gloves on. Big buttons, minimal chrome, no
 * marketing copy. We reuse the existing shadcn UI kit so it matches the
 * rest of the app, but everything runs behind the RootRouter (no GC auth
 * required, no Jarvis, no chrome).
 */
import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Loader2, Upload, LogOut, CheckCircle2, AlertTriangle, FileText, Info, X, ShieldCheck, FolderTree, ScanLine, PackageCheck, Inbox, DollarSign, ClipboardList, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { subFetch, subJson, subUpload, setSubBearer, SUB_API_BASE, JobClosedError } from "@/lib/sub-api";

const TRADES = [
  "Concrete","Framing","Roofing","Plumbing","Electrical","HVAC","Drywall",
  "Painting","Flooring","Landscaping","Masonry","Steel / Structural",
  "Mechanical","Fire Protection","Low Voltage / Data","Other",
] as const;

type TokenInfo = {
  projectId: number;
  projectName: string;
  organizationName: string;
  // Set true when the PM has flipped the project to "Complete". Client uses
  // this to render a friendly closed-portal page instead of the auth or
  // upload UI. The server also enforces this on every subsequent call — the
  // flag is only a hint for the initial render.
  closed?: boolean;
};
type SubCompany = {
  id: number; companyName: string; trade: string; contactName: string;
  contactEmail: string; contactPhone: string | null;
};
type UploadRow = {
  id: number; originalFileName: string; category: string; createdAt: string;
  fileSizeBytes: number;
};

/**
 * Compact byte formatter for the recent-uploads list. Not internationalized
 * because this UI is english-only for MVP.
 */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SubDropPage() {
  const [, params] = useRoute("/drop/:token");
  const token = params?.token || "";

  // ------- global page state ------------------------------------------------
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [me, setMe] = useState<SubCompany | null>(null);
  const [checkingMe, setCheckingMe] = useState(true);
  // Separately tracked because a token may still be valid while its parent
  // job has been completed. We render a distinct "Job closed" screen for that
  // — different UX from a bare invalid-token 404.
  const [jobClosed, setJobClosed] = useState<{ projectName: string } | null>(null);

  // Load the token preview (project name) and whether the user is signed in.
  // Both run in parallel: if they already have a sub cookie we jump straight
  // to the upload UI without them having to re-authenticate.
  useEffect(() => {
    if (!token) { setTokenError("Missing link."); return; }
    (async () => {
      try {
        const info = await subJson<TokenInfo>("GET", `/api/drop/${token}/info`);
        if (!info) throw new Error("Invalid or revoked link.");
        setTokenInfo(info);
        if (info.closed) setJobClosed({ projectName: info.projectName });
      } catch (e: any) {
        setTokenError(e?.message || "Invalid link.");
      }
    })();
    (async () => {
      try {
        const res = await subJson<{ subCompany: SubCompany }>("GET", `/api/sub/me`);
        if (res) setMe(res.subCompany);
      } catch {
        // Anonymous is fine \u2014 just means we show the auth screen.
      } finally {
        setCheckingMe(false);
      }
    })();
  }, [token]);

  // ------- screen selection -------------------------------------------------
  if (tokenError) return <FullPageMessage icon={<AlertTriangle className="h-10 w-10 text-red-500" />} title="This link isn't valid" body={tokenError} />;
  if (!tokenInfo || checkingMe) return <FullPageMessage icon={<Loader2 className="h-8 w-8 animate-spin" />} title="Loading\u2026" body="" />;
  if (jobClosed) return <JobClosedPage projectName={jobClosed.projectName} orgName={tokenInfo.organizationName} />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <Header
        projectName={tokenInfo.projectName}
        orgName={tokenInfo.organizationName}
        signedInAs={me?.companyName ?? null}
        onSignOut={async () => {
          await subFetch("POST", "/api/sub/logout");
          setSubBearer(null);
          setMe(null);
        }}
      />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {me ? (
          <SubHomeTabs
            me={me}
            token={token}
            projectId={tokenInfo.projectId}
            onJobClosed={() => setJobClosed({ projectName: tokenInfo.projectName })}
          />
        ) : (
          <AuthPanel
            token={token}
            projectName={tokenInfo.projectName}
            onSignedIn={(sub) => setMe(sub)}
            onJobClosed={() => setJobClosed({ projectName: tokenInfo.projectName })}
          />
        )}
      </main>
    </div>
  );
}

/** Header strip \u2014 project name + optional sign-out. */
function Header(props: { projectName: string; orgName: string; signedInAs: string | null; onSignOut: () => void }) {
  return (
    <header className="border-b bg-white/70 backdrop-blur dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{props.orgName}</div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">{props.projectName}</div>
        </div>
        {props.signedInAs ? (
          <div className="text-right">
            <div className="text-xs text-slate-500">Signed in as</div>
            <div className="text-sm font-medium">{props.signedInAs}</div>
            <button
              type="button"
              onClick={props.onSignOut}
              className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Full-page "this job is complete" screen. Rendered when either the initial
 * /info call returns `closed: true` OR any subsequent sub API call responds
 * with 410 Gone (both signals are wired into the parent component). The tone
 * is deliberately warm rather than alarming — job completion is normal, and
 * the sub often had nothing to do with why the portal closed.
 */
function JobClosedPage(props: { projectName: string; orgName: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-6 text-center dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <PackageCheck className="h-7 w-7" />
        </div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{props.orgName}</div>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{props.projectName} is complete</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          This job wrapped up, so the document drop portal for {props.projectName} is closed.
          Everything you already submitted is with the PM.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          If you have another active job with the same GC, ask them for that project's QR code.
        </p>
      </div>
    </div>
  );
}

/** Reused full-page splash for loading / error states. */
function FullPageMessage(props: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center dark:bg-slate-950">
      <div className="mb-4">{props.icon}</div>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{props.title}</h1>
      {props.body ? <p className="mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{props.body}</p> : null}
    </div>
  );
}

/* -------------------------- Auth (register / login) --------------------- */

// Sub-side dismissal key. Bump the suffix if we materially change the copy so
// returning subs see the new version.
const SUB_WELCOME_KEY = "tp.subDrop.welcomeSeen.v1";

/**
 * First-visit welcome strip shown above the register / sign-in card. Explains
 * what this page is ("drop docs for your PM"), sets expectations for what
 * they'll be asked (email + password + company + trade), and reassures on
 * cost (free) and scope (they never see other subs' files).
 */
function SubWelcome(props: { projectName: string }) {
  const [visible, setVisible] = useState<boolean>(() => {
    try { return typeof window !== "undefined" && !window.localStorage.getItem(SUB_WELCOME_KEY); }
    catch { return true; }
  });
  if (!visible) return null;
  function dismiss() {
    try { window.localStorage.setItem(SUB_WELCOME_KEY, new Date().toISOString()); } catch { /* private mode */ }
    setVisible(false);
  }
  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-medium text-primary">
          <Info className="h-4 w-4" /> Welcome — here's how this works
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-primary/80 hover:bg-primary/10"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="mt-3 space-y-2 text-slate-700 dark:text-slate-200">
        <li className="flex gap-2"><ScanLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> This is <span className="font-medium">{props.projectName}</span>'s document drop. Anything you upload goes straight to the PM.</li>
        <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> First time? Register your company below — one-time thing, takes 30 seconds. Free.</li>
        <li className="flex gap-2"><FolderTree className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> Files are auto-sorted — COIs, safety docs, shop drawings, invoices, photos. Just drop, no naming rules.</li>
        <li className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /> Only your uploads are visible to you. Other subs on this job don't see them.</li>
      </ul>
    </div>
  );
}

function AuthPanel(props: {
  token: string;
  onSignedIn: (sub: SubCompany) => void;
  projectName: string;
  // Bubble up when the server tells us this job is complete. Parent swaps in
  // JobClosedPage — we don't want the auth form re-rendering with an error
  // string because "try again" won't help.
  onJobClosed: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("register");
  return (
    <>
      <SubWelcome projectName={props.projectName} />
      <Card className="overflow-hidden">
      <div className="grid grid-cols-2 border-b bg-slate-50 dark:bg-slate-900">
        <button
          className={`px-4 py-3 text-sm font-medium ${mode === "register" ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-white" : "text-slate-500"}`}
          onClick={() => setMode("register")}
        >
          New sub \u2014 register
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium ${mode === "login" ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-white" : "text-slate-500"}`}
          onClick={() => setMode("login")}
        >
          Returning sub \u2014 sign in
        </button>
      </div>
      <div className="p-4 sm:p-6">
        {mode === "register" ? (
          <RegisterForm token={props.token} onSignedIn={props.onSignedIn} onJobClosed={props.onJobClosed} onSwitchToLogin={() => setMode("login")} />
        ) : (
          <LoginForm token={props.token} onSignedIn={props.onSignedIn} onJobClosed={props.onJobClosed} onSwitchToRegister={() => setMode("register")} />
        )}
      </div>
    </Card>
    </>
  );
}

function RegisterForm(props: { token: string; onSignedIn: (sub: SubCompany) => void; onJobClosed: () => void; onSwitchToLogin: () => void }) {
  const [companyName, setCompanyName] = useState("");
  const [trade, setTrade] = useState<string>("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { dropToken: props.token, companyName, trade, contactName, contactEmail, contactPhone, password };
      const resp = await fetch(`${SUB_API_BASE}/api/sub/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (resp.status === 409) {
        setError("That email is already registered. Try signing in instead.");
        return;
      }
      // 410 Gone — the PM completed the job between the QR scan and the form
      // submission. Hand control back to the parent so it can render the
      // "Job closed" screen instead of showing an error under the form.
      if (resp.status === 410) {
        props.onJobClosed();
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        try { setError(JSON.parse(t).message || t); } catch { setError(t); }
        return;
      }
      const body = await resp.json();
      if (body.token) setSubBearer(body.token);
      props.onSignedIn(body.subCompany);
    } catch (err: any) {
      setError(err?.message || "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        First time here? Register your company. It's free and takes 30 seconds. You'll only do this once.
      </p>
      <FormRow label="Company name">
        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoComplete="organization" />
      </FormRow>
      <FormRow label="Trade">
        <select
          value={trade}
          onChange={(e) => setTrade(e.target.value)}
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Pick a trade\u2026</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormRow>
      <FormRow label="Your name">
        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} required autoComplete="name" />
      </FormRow>
      <FormRow label="Email">
        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required autoComplete="email" />
      </FormRow>
      <FormRow label="Phone (optional)">
        <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} autoComplete="tel" />
      </FormRow>
      <FormRow label="Password (8+ characters)">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </FormRow>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Create account
      </Button>
      <div className="text-center text-xs text-slate-500">
        Already registered? <button type="button" onClick={props.onSwitchToLogin} className="underline">Sign in</button>
      </div>
    </form>
  );
}

function LoginForm(props: { token: string; onSignedIn: (sub: SubCompany) => void; onJobClosed: () => void; onSwitchToRegister: () => void }) {
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "forgot" is the inline sub-view for the forgot-password request. It sits
  // inside LoginForm rather than being a separate route so the sub never
  // loses the drop-token context they scanned in with \u2014 if they cancel,
  // they land right back on the login form.
  const [showForgot, setShowForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${SUB_API_BASE}/api/sub/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dropToken: props.token, contactEmail, password }),
        credentials: "include",
      });
      // Same "job completed while I was typing my password" case as register.
      if (resp.status === 410) {
        props.onJobClosed();
        return;
      }
      if (!resp.ok) {
        const t = await resp.text();
        try { setError(JSON.parse(t).message || t); } catch { setError(t); }
        return;
      }
      const body = await resp.json();
      if (body.token) setSubBearer(body.token);
      props.onSignedIn(body.subCompany);
    } catch (err: any) {
      setError(err?.message || "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (showForgot) {
    return <ForgotPasswordForm defaultEmail={contactEmail} onBack={() => setShowForgot(false)} />;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Signing in attaches your company to this jobsite so uploads are tracked in your name.
      </p>
      <FormRow label="Email">
        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required autoComplete="email" />
      </FormRow>
      <FormRow label="Password">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </FormRow>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Sign in
      </Button>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <button type="button" onClick={() => setShowForgot(true)} className="underline">Forgot password?</button>
        <button type="button" onClick={props.onSwitchToRegister} className="underline">Register instead</button>
      </div>
    </form>
  );
}

/**
 * Inline forgot-password form. Always renders success \u2014 the server responds
 * the same way whether or not the email matches a real sub, so we don't
 * confirm or deny existence in the UI either. Copy nudges the sub to check
 * their inbox and to search spam if needed.
 */
function ForgotPasswordForm(props: { defaultEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(props.defaultEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${SUB_API_BASE}/api/sub/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail: email }),
      });
      // The server always 200s, but guard the surprise-500 case too.
      if (!resp.ok) {
        setError("Something went wrong. Try again.");
        return;
      }
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">
          If an account exists for that email, we sent a reset link. Check your inbox (and spam). The link expires in 1 hour.
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={props.onBack}>Back to sign in</Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Enter the email you registered with. We'll send you a link to set a new password.
      </p>
      <FormRow label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </FormRow>
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Send reset link
      </Button>
      <div className="text-center text-xs text-slate-500">
        <button type="button" onClick={props.onBack} className="underline">Back to sign in</button>
      </div>
    </form>
  );
}

function FormRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{props.label}</Label>
      {props.children}
    </div>
  );
}

/* --------------------------- Upload UI ---------------------------------- */

function UploadPanel(props: {
  me: SubCompany;
  token: string;
  projectId: number;
  // Signaled up when a 410 lands on either the history fetch or an upload.
  // Parent pivots to JobClosedPage so the sub doesn't stare at a rejected
  // upload and wonder if it's a bug.
  onJobClosed: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [lastToast, setLastToast] = useState<string | null>(null);

  // Load the sub's own upload history for this project so they see what they've
  // already sent (and don't send the same COI five times in a row).
  useEffect(() => {
    (async () => {
      try {
        const res = await subJson<UploadRow[]>("GET", `/api/sub/projects/${props.projectId}/uploads`);
        if (res) setUploads(res);
      } catch (err) {
        // Silent for empty state, BUT surface a job-closed 410 up to the
        // parent so we don't render the upload UI on a dead job.
        if (err instanceof JobClosedError) props.onJobClosed();
      }
    })();
  }, [props.projectId, props.onJobClosed]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("files", f);
      const res = await subUpload<{ uploads: UploadRow[] }>(`/api/drop/${props.token}/upload`, fd);
      setUploads(prev => [...res.uploads, ...prev]);
      setLastToast(`Sent ${res.uploads.length} file${res.uploads.length === 1 ? "" : "s"}. Auto-sorted by TrussPath.`);
      // Auto-hide the toast so the UI stays clean.
      setTimeout(() => setLastToast(null), 4000);
    } catch (err: any) {
      // 410 from subUpload means the PM just marked the job complete. Bubble
      // up so the whole screen swaps to the closed-portal message rather than
      // an inline red error banner.
      if (err instanceof JobClosedError) {
        props.onJobClosed();
        return;
      }
      setError(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const hasEverUploaded = uploads.length > 0;

  return (
    <div className="space-y-6">
      {!hasEverUploaded ? (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-slate-700 dark:text-slate-200">
          <div className="mb-1 flex items-center gap-2 font-medium text-primary">
            <Info className="h-4 w-4" /> Ready when you are
          </div>
          <p>
            Drag files onto the box below, or tap <span className="font-medium">Choose files</span>.
            Multiple files at once are fine — they'll all get sorted into the right folder for your PM.
          </p>
        </div>
      ) : null}
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed p-8 text-center transition ${dragging ? "border-primary bg-primary/5" : "border-slate-300 dark:border-slate-700"}`}
      >
        <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
        <div className="mb-1 text-lg font-medium">Drop files here</div>
        <div className="mb-4 text-sm text-slate-500">
          Photos, PDFs, DWG, DOCX, XLSX \u2014 up to 25MB each
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Choose files
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => { if (e.target.files) upload(e.target.files); e.currentTarget.value = ""; }}
          />
        </label>
        <p className="mt-4 text-xs text-slate-500">
          Everything you upload lands in your PM's inbox for {props.me.companyName}.
        </p>
      </Card>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      ) : null}
      {lastToast ? (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          {lastToast}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Your recent uploads</h2>
          <span className="text-xs text-slate-500">{uploads.length}</span>
        </div>
        {uploads.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
            Nothing yet. Files you drop above will show here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
            {uploads.map(u => <UploadRowItem key={u.id} u={u} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function UploadRowItem({ u }: { u: UploadRow }) {
  const when = useMemo(() => {
    try { return new Date(u.createdAt).toLocaleString(); } catch { return u.createdAt; }
  }, [u.createdAt]);
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800 dark:text-slate-100">{u.originalFileName}</div>
          <div className="text-xs text-slate-500">{when} \u2022 {formatBytes(u.fileSizeBytes)}</div>
        </div>
      </div>
      <span className="ml-3 flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {u.category}
      </span>
    </li>
  );
}

/* ------------------- Sub Home: tabbed shell over Upload + RFIs + COs + Tasks ------------------- */

type SubTabKey = "upload" | "rfis" | "cos" | "tasks";

type SubTab = { key: SubTabKey; label: string; icon: React.ComponentType<{ className?: string }> };
const SUB_TABS: SubTab[] = [
  { key: "upload", label: "Upload", icon: Upload },
  { key: "rfis", label: "RFIs", icon: Inbox },
  { key: "cos", label: "COs", icon: DollarSign },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
];

function SubHomeTabs(props: {
  me: SubCompany;
  token: string;
  projectId: number;
  onJobClosed: () => void;
}) {
  const [tab, setTab] = useState<SubTabKey>("upload");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 text-xs dark:border-slate-800 dark:bg-slate-900">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center justify-center gap-1.5 rounded-sm px-2 py-2 font-medium transition ${active ? "bg-white text-primary shadow-sm dark:bg-slate-950" : "text-slate-600 hover:text-slate-900 dark:text-slate-400"}`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === "upload" && (
        <UploadPanel me={props.me} token={props.token} projectId={props.projectId} onJobClosed={props.onJobClosed} />
      )}
      {tab === "rfis" && (
        <RfisPanel projectId={props.projectId} me={props.me} onJobClosed={props.onJobClosed} />
      )}
      {tab === "cos" && (
        <ChangeOrdersPanel projectId={props.projectId} me={props.me} onJobClosed={props.onJobClosed} />
      )}
      {tab === "tasks" && (
        <TasksPanel projectId={props.projectId} me={props.me} onJobClosed={props.onJobClosed} />
      )}
    </div>
  );
}

/* ---------- Types for sub-side RFI/CO/Task rows (loose — server sends more fields we ignore) ---------- */
type SubRfiRow = {
  id: number; number: string; subject: string; status: string; dueDate: string;
  trade?: string | null; priority?: string | null; subAcceptedAt?: string | null;
};
type SubCoRow = {
  id: number; number: string; title: string; status: string; amount: number;
  scheduleImpact: number; subDecision?: string | null; subDecisionComment?: string | null;
  subDecisionAt?: string | null; subAcceptedAt?: string | null;
};
type SubTaskRow = {
  id: number; title: string; status: string; trade?: string | null;
  dueDate?: string | null; priority?: string | null;
  subCompletedAt?: string | null; subCompletionNote?: string | null;
};

/* ---------------------------- RFIs panel ---------------------------- */

function RfisPanel(props: { projectId: number; me: SubCompany; onJobClosed: () => void }) {
  const [rows, setRows] = useState<SubRfiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [specSection, setSpecSection] = useState("");
  const [drawingRef, setDrawingRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await subJson<SubRfiRow[]>("GET", `/api/sub/projects/${props.projectId}/rfis`);
      if (res) setRows(res);
    } catch (err) {
      if (err instanceof JobClosedError) props.onJobClosed();
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [props.projectId]);

  async function submit() {
    if (!subject.trim() || !body.trim()) { setError("Subject and question are required."); return; }
    setSaving(true); setError(null);
    try {
      await subJson<SubRfiRow>("POST", `/api/sub/projects/${props.projectId}/rfis`, {
        subject, body, priority, dueDate,
        specSection: specSection || null, drawingRef: drawingRef || null,
      });
      setSubject(""); setBody(""); setPriority("Medium"); setDueDate(defaultDueDate());
      setSpecSection(""); setDrawingRef(""); setShowForm(false);
      await load();
    } catch (err: any) {
      if (err instanceof JobClosedError) { props.onJobClosed(); return; }
      setError(err?.message || "Could not submit RFI.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Your RFIs on this job</h2>
        {!showForm && <Button size="sm" onClick={() => setShowForm(true)}>New RFI</Button>}
      </div>
      {showForm && (
        <Card className="space-y-3 p-4">
          <FormRow label="Subject"><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Missing dimensions on grid line C-4" /></FormRow>
          <FormRow label="Question detail">
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Describe the issue and what you need clarified." />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Priority">
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950">
                {["Low","Medium","High","Urgent"].map(p => <option key={p}>{p}</option>)}
              </select>
            </FormRow>
            <FormRow label="Due date">
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </FormRow>
            <FormRow label="Spec section (optional)">
              <Input value={specSection} onChange={e => setSpecSection(e.target.value)} placeholder="03 30 00" />
            </FormRow>
            <FormRow label="Drawing ref (optional)">
              <Input value={drawingRef} onChange={e => setDrawingRef(e.target.value)} placeholder="A-201" />
            </FormRow>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setError(null); }}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Sending</> : "Submit RFI"}</Button>
          </div>
          <p className="text-xs text-slate-500">RFI lands as a draft in your PM's queue for review.</p>
        </Card>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyRow icon={Inbox} label="No RFIs submitted yet." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          {rows.map(r => (
            <li key={r.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.number} · {r.subject}</div>
                  <div className="mt-0.5 text-xs text-slate-500">Due {r.dueDate}{r.trade ? ` · ${r.trade}` : ""}{r.priority ? ` · ${r.priority}` : ""}</div>
                </div>
                <StatusPill status={r.status} accepted={!!r.subAcceptedAt} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- Change Orders panel ---------------------------- */

function ChangeOrdersPanel(props: { projectId: number; me: SubCompany; onJobClosed: () => void }) {
  const [rows, setRows] = useState<SubCoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduleImpact, setScheduleImpact] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decisionForId, setDecisionForId] = useState<number | null>(null);
  const [decisionComment, setDecisionComment] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await subJson<SubCoRow[]>("GET", `/api/sub/projects/${props.projectId}/change-orders`);
      if (res) setRows(res);
    } catch (err) {
      if (err instanceof JobClosedError) props.onJobClosed();
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [props.projectId]);

  async function submit() {
    if (!title.trim() || !description.trim()) { setError("Title and description are required."); return; }
    setSaving(true); setError(null);
    try {
      await subJson<SubCoRow>("POST", `/api/sub/projects/${props.projectId}/change-orders`, {
        title, description, category: category || null,
        amount: Number(amount) || 0, scheduleImpact: Number(scheduleImpact) || 0,
      });
      setTitle(""); setDescription(""); setCategory(""); setAmount(""); setScheduleImpact("");
      setShowForm(false); await load();
    } catch (err: any) {
      if (err instanceof JobClosedError) { props.onJobClosed(); return; }
      setError(err?.message || "Could not submit change order.");
    } finally { setSaving(false); }
  }

  async function decide(id: number, decision: "approved" | "rejected" | "needs_changes") {
    try {
      await subJson(`POST`, `/api/sub/change-orders/${id}/decision`, {
        decision, comment: decisionComment.trim() || null,
      });
      setDecisionForId(null); setDecisionComment("");
      await load();
    } catch (err: any) {
      if (err instanceof JobClosedError) { props.onJobClosed(); return; }
      setError(err?.message || "Could not record decision.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Your change orders</h2>
        {!showForm && <Button size="sm" onClick={() => setShowForm(true)}>New CO</Button>}
      </div>
      {showForm && (
        <Card className="space-y-3 p-4">
          <FormRow label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Added waterproofing at footings" /></FormRow>
          <FormRow label="Description">
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="What changed and why? Include a short scope + backup if you have it." />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Category (optional)">
              <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Scope change" />
            </FormRow>
            <FormRow label="Amount ($)">
              <Input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </FormRow>
            <FormRow label="Schedule impact (days)">
              <Input inputMode="decimal" value={scheduleImpact} onChange={e => setScheduleImpact(e.target.value)} placeholder="0" />
            </FormRow>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setError(null); }}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Sending</> : "Submit CO"}</Button>
          </div>
          <p className="text-xs text-slate-500">Change order lands as a draft in your PM's queue.</p>
        </Card>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyRow icon={DollarSign} label="No change orders submitted yet." />
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
          {rows.map(r => (
            <li key={r.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.number} · {r.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    ${Number(r.amount || 0).toLocaleString()} · {Number(r.scheduleImpact || 0)}d
                    {r.subDecision ? ` · You: ${r.subDecision}` : ""}
                  </div>
                </div>
                <StatusPill status={r.status} accepted={!!r.subAcceptedAt} />
              </div>
              {/* Once the PM has issued the CO (status past sub_draft/pending), let sub weigh in. */}
              {["approved","pending","issued","in_review"].includes(r.status) && !r.subDecision && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                  {decisionForId === r.id ? (
                    <div className="space-y-2">
                      <textarea rows={2} value={decisionComment} onChange={e => setDecisionComment(e.target.value)}
                        placeholder="Optional comment"
                        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => decide(r.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "needs_changes")}>Needs changes</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, "rejected")}>Reject</Button>
                        <Button size="sm" variant="ghost" onClick={() => { setDecisionForId(null); setDecisionComment(""); }}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>PM issued this CO. Approve or push back?</span>
                      <Button size="sm" variant="outline" onClick={() => setDecisionForId(r.id)}>Respond</Button>
                    </div>
                  )}
                </div>
              )}
              {r.subDecisionComment && (
                <p className="text-xs italic text-slate-500">Your note: {r.subDecisionComment}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------- Tasks panel ---------------------------- */

function TasksPanel(props: { projectId: number; me: SubCompany; onJobClosed: () => void }) {
  const [rows, setRows] = useState<SubTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await subJson<SubTaskRow[]>("GET", `/api/sub/projects/${props.projectId}/tasks`);
      if (res) setRows(res);
    } catch (err) {
      if (err instanceof JobClosedError) props.onJobClosed();
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [props.projectId]);

  async function complete(taskId: number) {
    setBusyId(taskId); setError(null);
    try {
      const fd = new FormData();
      if (note.trim()) fd.append("note", note.trim());
      if (file) fd.append("attachment", file);
      await subUpload(`/api/sub/tasks/${taskId}/complete`, fd);
      setNoteFor(null); setNote(""); setFile(null);
      await load();
    } catch (err: any) {
      if (err instanceof JobClosedError) { props.onJobClosed(); return; }
      setError(err?.message || "Could not mark complete.");
    } finally { setBusyId(null); }
  }

  const open = rows.filter(r => !r.subCompletedAt && r.status !== "completed");
  const done = rows.filter(r => r.subCompletedAt || r.status === "completed");

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Tasks assigned to {props.me.companyName}</h2>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyRow icon={ClipboardList} label="No tasks assigned yet." />
      ) : (
        <>
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
            {open.map(t => (
              <li key={t.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {t.dueDate ? `Due ${t.dueDate}` : "No due date"}
                      {t.trade ? ` · ${t.trade}` : ""}
                      {t.priority ? ` · ${t.priority}` : ""}
                    </div>
                  </div>
                  <StatusPill status={t.status} />
                </div>
                {noteFor === t.id ? (
                  <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
                    <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Optional note for your PM"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950" />
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Paperclip className="h-4 w-4" />
                      <span>{file ? file.name : "Attach photo/receipt (optional)"}</span>
                      <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setNoteFor(null); setNote(""); setFile(null); }}>Cancel</Button>
                      <Button size="sm" onClick={() => complete(t.id)} disabled={busyId === t.id}>
                        {busyId === t.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Sending</> : "Confirm complete"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setNoteFor(t.id)}>Mark complete</Button>
                  </div>
                )}
              </li>
            ))}
            {open.length === 0 && (
              <li className="p-3 text-sm text-slate-500">All caught up — no open tasks.</li>
            )}
          </ul>
          {done.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Completed</h3>
              <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950">
                {done.map(t => (
                  <li key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {t.subCompletedAt ? `You marked complete ${new Date(t.subCompletedAt).toLocaleDateString()}` : "Marked complete"}
                        </div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    {t.subCompletionNote && (
                      <p className="mt-1 text-xs italic text-slate-500">Note: {t.subCompletionNote}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/* ---------------------------- Shared bits ---------------------------- */

function EmptyRow(props: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800">
      <Icon className="h-4 w-4" /> {props.label}
    </div>
  );
}

function StatusPill(props: { status: string; accepted?: boolean }) {
  const isDraft = props.status === "sub_draft" && !props.accepted;
  const isDone = props.status === "completed" || props.status === "approved" || props.status === "closed";
  const cls = isDraft
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    : isDone
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {isDraft ? "Draft" : props.status.replaceAll("_", " ")}
    </span>
  );
}

function defaultDueDate(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
