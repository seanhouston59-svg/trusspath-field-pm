import { useState } from "react";
import { Link } from "wouter";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Logo } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function ForgotPassword() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      toast({ title: "Request failed", description: err?.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left: brand panel */}
      <div className="hidden md:flex md:flex-col md:justify-between bg-primary p-10 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-primary-foreground" />
          <span className="font-display text-lg font-bold">TrussPath</span>
        </Link>
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight">
            Reset your password
          </h2>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Enter your email and we'll send you a link to set a new one.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">© {new Date().getFullYear()} TrussPath</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <Logo className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">TrussPath</span>
          </div>

          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                <CheckCircle className="size-6" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">Check your email</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>,
                  you'll receive a password reset link within a few minutes.
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setSent(false); setEmail(""); }}>
                Try another email
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-xl font-bold">Forgot password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your account email and we'll send a reset link.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      data-testid="input-email"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit">
                  {submitting ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </>
          )}

          <div className="text-sm text-muted-foreground">
            <Link href="/login" className="inline-flex items-center gap-1 hover:text-foreground" data-testid="link-back-login">
              <ArrowLeft className="size-3.5" /> Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Read token from URL query param
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const token = params.get("token") || "";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast({ title: "Invalid link", description: "No reset token found in the URL.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", description: "Please confirm your new password.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message || "Invalid or expired token", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <CheckCircle className="size-6" />
          </div>
          <h1 className="font-display text-xl font-bold">Password updated</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <Button className="w-full" onClick={() => (window.location.hash = "/login")} data-testid="button-login">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left: brand panel */}
      <div className="hidden md:flex md:flex-col md:justify-between bg-primary p-10 text-primary-foreground">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-6 w-6 text-primary-foreground" />
          <span className="font-display text-lg font-bold">TrussPath</span>
        </Link>
        <div>
          <h2 className="font-display text-3xl font-extrabold leading-tight">
            Set a new password
          </h2>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Choose a strong password you haven't used before.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/50">© {new Date().getFullYear()} TrussPath</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <Logo className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">TrussPath</span>
          </div>

          {!token ? (
            <div className="space-y-4 text-center">
              <h1 className="font-display text-xl font-bold">Invalid reset link</h1>
              <p className="text-sm text-muted-foreground">
                This link doesn't contain a valid reset token. Please request a new password reset link.
              </p>
              <Button className="w-full" onClick={() => (window.location.hash = "/forgot-password")}>
                Request new link
              </Button>
            </div>
          ) : (
            <>
              <div>
                <h1 className="font-display text-xl font-bold">New password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your new password below.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New password</label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm password</label>
                  <Input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    data-testid="input-confirm"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting} data-testid="button-submit">
                  {submitting ? "Updating..." : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
