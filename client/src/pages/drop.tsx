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
import { Loader2, Upload, LogOut, CheckCircle2, AlertTriangle, FileText, Info, X, ShieldCheck, FolderTree, ScanLine, PackageCheck } from "lucide-react";
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
          <UploadPanel
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
      <div className="text-center text-xs text-slate-500">
        New here? <button type="button" onClick={props.onSwitchToRegister} className="underline">Register instead</button>
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
