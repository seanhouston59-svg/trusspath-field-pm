// BillingBanner
//
// Thin, dismissable-per-session banner that lives above the app shell and
// warns the user when their org's billing needs attention. It intentionally
// only handles the "still-in-good-standing but heads-up" and "sub scheduled
// to cancel" cases here - hard-cutoff states (past_due, unpaid, canceled)
// already trigger a redirect to /paywall via RequireAuth, so those are
// handled there instead of shown twice.
//
// Priority order (only the highest-priority banner shows):
//   1. cancelAtPeriodEnd  - amber, "Sub ends on <date>. [Reactivate]"
//   2. trial ending soon  - amber, "Trial ends in N days. [Add card]"
// If none match, the banner renders nothing.

import { useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBillingStatus, useManageBilling } from "@/hooks/use-data";

const TRIAL_WARN_DAYS = 5; // start warning this many days before trial end.

// Days between now and an ISO date, floor(). Returns null on bad input.
function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export function BillingBanner() {
  const billing = useBillingStatus();
  const manage = useManageBilling();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const banner = useMemo(() => {
    const b = billing.data;
    if (!b || !b.status) return null;

    // 1) Cancellation scheduled - highest priority so the user always knows.
    if (b.cancelAtPeriodEnd && b.currentPeriodEnd) {
      return {
        key: `cancel-${b.currentPeriodEnd}`,
        tone: "amber" as const,
        title: `Your TrussPath subscription ends on ${fmtDate(b.currentPeriodEnd)}.`,
        body: "You'll keep full access until then. Change your mind? Reopen billing to resume.",
        cta: "Manage billing",
      };
    }

    // 2) Trial ending soon.
    if (b.status === "trialing") {
      const days = daysUntil(b.trialEndsAt);
      if (days !== null && days >= 0 && days <= TRIAL_WARN_DAYS) {
        const label = days === 0
          ? "Trial ends today."
          : days === 1
            ? "Trial ends in 1 day."
            : `Trial ends in ${days} days.`;
        return {
          key: `trial-${b.trialEndsAt}`,
          tone: "amber" as const,
          title: label,
          body: b.hasCustomer
            ? "Payment info is on file - you'll be charged automatically when the trial ends."
            : "Add a payment method now so your team keeps access when the trial ends.",
          cta: b.hasCustomer ? "Review billing" : "Add payment method",
        };
      }
    }

    return null;
  }, [billing.data]);

  if (!banner) return null;
  if (dismissedKey === banner.key) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/10 text-amber-100"
      data-testid="billing-banner"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-amber-400" aria-hidden />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{banner.title}</span>
          <span className="ml-1 text-amber-100/80">{banner.body}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-400/60 bg-amber-500/20 hover:bg-amber-500/30"
          onClick={() => manage.mutate()}
          disabled={manage.isPending}
          data-testid="billing-banner-cta"
        >
          {manage.isPending ? "Opening\u2026" : banner.cta}
        </Button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setDismissedKey(banner.key)}
          className="grid size-7 place-items-center rounded-md text-amber-100/70 hover:bg-amber-500/20 hover:text-amber-100"
          data-testid="billing-banner-dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
