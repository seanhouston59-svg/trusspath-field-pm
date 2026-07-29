/**
 * Public Sub Password Reset page.
 *
 * URL: /sub-reset/:token \u2014 the token comes from the reset link the mailer
 * sent after a POST /api/sub/forgot-password. Route is unauthenticated (no
 * GC login, no sub session) and lives outside the /drop/:token flow because
 * the sub may be resetting from a device that never scanned a QR.
 *
 * On success the sub is sent to /#/subs (the marketing/landing page for the
 * sub portal) with a success flag so they can sign in fresh \u2014 we
 * deliberately don't auto-sign-in to keep this route stateless and to make
 * the flow identical to the GC-side reset.
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SUB_API_BASE } from "@/lib/sub-api";

export default function SubResetPage() {
  const [, params] = useRoute("/sub-reset/:token");
  const token = params?.token || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`${SUB_API_BASE}/api/sub/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        try { setError(JSON.parse(t).message || t); } catch { setError(t); }
        return;
      }
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Wrap>
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          This reset link is missing a token. Request a new link from the sign-in page.
        </div>
      </Wrap>
    );
  }

  if (done) {
    return (
      <Wrap>
        <div className="space-y-4">
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">
            Your password has been updated. Sign in from the QR code your GC shared, or the Sub Portal landing page.
          </div>
          <Button asChild className="w-full">
            <a href="/#/subs">Go to Sub Portal</a>
          </Button>
        </div>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Choose a new password for your sub account. This link expires 1 hour after it was requested.
        </p>
        <div className="space-y-1.5">
          <Label className="text-sm">New password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" minLength={8} />
        </div>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</div> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Update password
        </Button>
      </form>
    </Wrap>
  );
}

function Wrap(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <ShieldCheck className="h-5 w-5 text-amber-500" />
          <h1 className="text-lg font-semibold">Reset your password</h1>
        </div>
        {props.children}
      </Card>
    </div>
  );
}
