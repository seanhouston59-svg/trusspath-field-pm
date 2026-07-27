import { useState } from "react";
import { MessageSquare, ShieldCheck, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useSmsOptIn,
  useSmsOptOut,
  useSmsRemove,
  useSmsState,
  useStartSmsVerification,
  useVerifySms,
} from "@/hooks/use-data";
import { useToast } from "@/hooks/use-toast";

// SMS opt-in card for /settings. Per-account (not org) because the account
// travels across orgs. Full state machine:
//   no phone   -> "add a number" form
//   pending    -> "enter the 6-digit code" form + resend link
//   verified   -> "you're set up" pill + Opt-out / Remove
//   opted_out  -> "You're not receiving SMS" + Opt-back-in
export function SmsAlertsCard() {
  const { data: state, isLoading } = useSmsState();
  const startVerify = useStartSmsVerification();
  const verify = useVerifySms();
  const optOut = useSmsOptOut();
  const optIn = useSmsOptIn();
  const remove = useSmsRemove();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  async function handleStartVerify() {
    const value = phone.trim();
    if (!value) { toast({ title: "Enter your phone number.", variant: "destructive" }); return; }
    try {
      const r = await startVerify.mutateAsync(value);
      setPhone("");
      toast({
        title: r.dryRun ? "Verification queued (dry run)" : "Verification code sent",
        description: r.dryRun ? "Twilio isn't set up yet; check the server log for the code." : "We texted a 6-digit code to your phone. It expires in 10 minutes.",
      });
    } catch (err: any) {
      toast({ title: "Couldn't send code", description: String(err?.message || err), variant: "destructive" });
    }
  }

  async function handleVerify() {
    if (!/^[0-9]{6}$/.test(code.trim())) { toast({ title: "Enter the 6-digit code.", variant: "destructive" }); return; }
    try {
      await verify.mutateAsync(code.trim());
      setCode("");
      toast({ title: "Phone verified", description: "You'll now receive urgent field alerts by SMS." });
    } catch (err: any) {
      toast({ title: "Verification failed", description: String(err?.message || err), variant: "destructive" });
    }
  }

  async function handleOptOut() {
    try {
      await optOut.mutateAsync();
      toast({ title: "Opted out", description: "You won't get any more SMS alerts. Opt back in any time." });
    } catch (err: any) {
      toast({ title: "Couldn't opt out", description: String(err?.message || err), variant: "destructive" });
    }
  }

  async function handleOptIn() {
    try {
      await optIn.mutateAsync();
      toast({ title: "Opted back in", description: "You'll receive urgent field alerts by SMS." });
    } catch (err: any) {
      toast({ title: "Couldn't opt in", description: String(err?.message || err), variant: "destructive" });
    }
  }

  async function handleRemove() {
    try {
      await remove.mutateAsync();
      toast({ title: "Phone removed" });
    } catch (err: any) {
      toast({ title: "Couldn't remove", description: String(err?.message || err), variant: "destructive" });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <MessageSquare className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-sm font-bold">Urgent field alerts (SMS)</h2>
          <p className="text-xs text-muted-foreground">Get texted when a critical safety issue, blocking RFI, or weather alert lands on one of your projects.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : !state?.phone ? (
        /* No phone on file - start verification */
        <div className="space-y-3">
          <div>
            <Label htmlFor="sms-phone" className="text-xs">Phone number</Label>
            <Input
              id="sms-phone"
              placeholder="+14155551234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-sms-phone"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Enter international format with country code, e.g. +1 for US.</p>
          </div>
          <Button
            size="sm"
            onClick={handleStartVerify}
            disabled={startVerify.isPending}
            data-testid="button-sms-start-verify"
          >
            {startVerify.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Send verification code
          </Button>
        </div>
      ) : !state.verified && state.pendingVerification ? (
        /* Verification in progress */
        <div className="space-y-3">
          <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs">
            We texted a 6-digit code to <span className="font-mono">{state.phone}</span>. Enter it below to finish verification.
          </div>
          <div>
            <Label htmlFor="sms-code" className="text-xs">Code</Label>
            <Input
              id="sms-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              data-testid="input-sms-code"
              className="mt-1 font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleVerify} disabled={verify.isPending} data-testid="button-sms-verify">
              {verify.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Verify
            </Button>
            <Button size="sm" variant="outline" onClick={handleStartVerify} disabled={startVerify.isPending}>
              Resend code
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={remove.isPending} data-testid="button-sms-cancel-verify">
              Cancel
            </Button>
          </div>
        </div>
      ) : state.verified && !state.optedOut ? (
        /* Verified + opted in */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="mr-1 size-3" /> Verified
            </Badge>
            <span className="font-mono text-sm">{state.phone}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            You'll get texted for critical safety incidents, RFIs blocking work, and severe weather. Reply STOP to any message to unsubscribe.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleOptOut} disabled={optOut.isPending}>
              Opt out
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={remove.isPending}>
              Remove phone
            </Button>
          </div>
        </div>
      ) : state.optedOut ? (
        /* Opted out */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-muted text-muted-foreground">
              <XCircle className="mr-1 size-3" /> Opted out
            </Badge>
            <span className="font-mono text-sm">{state.phone}</span>
          </div>
          <p className="text-xs text-muted-foreground">You're not receiving SMS alerts right now.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleOptIn} disabled={optIn.isPending}>
              Opt back in
            </Button>
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={remove.isPending}>
              Remove phone
            </Button>
          </div>
        </div>
      ) : (
        /* Has phone but not verified and no pending verification (edge case) */
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Phone on file (<span className="font-mono">{state.phone}</span>) but not verified yet.
          </div>
          <Button size="sm" onClick={handleStartVerify} disabled={startVerify.isPending}>
            {startVerify.isPending && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            Send verification code
          </Button>
        </div>
      )}
    </section>
  );
}
