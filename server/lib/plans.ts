// Option B plans: monthly/annual base + per-seat overage.
// Products are seat-based. First N seats are included in base; each additional seat billed at seat price.

export type PlanTier = "starter" | "pro" | "enterprise";
export type Billing = "monthly" | "annual";

export interface PlanConfig {
  tier: PlanTier;
  productId: string;
  includedSeats: number;
  displayName: string;
  monthly: { basePriceId: string; seatPriceId: string; baseAmount: number; seatAmount: number };
  annual: { basePriceId: string; seatPriceId: string; baseAmount: number; seatAmount: number };
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  starter: {
    tier: "starter",
    productId: "prod_UxUDQoBfRA7HlE",
    includedSeats: 3,
    displayName: "Starter",
    monthly: {
      basePriceId: "price_1TxciGCL31xFtol411RaRcIk",
      seatPriceId: "price_1TxciHCL31xFtol44WMoUekv",
      baseAmount: 7900,
      seatAmount: 1900,
    },
    annual: {
      basePriceId: "price_1TxciGCL31xFtol4VA0BpWuy",
      seatPriceId: "price_1TxciHCL31xFtol42LWB9tXV",
      baseAmount: 79000,
      seatAmount: 19000,
    },
  },
  pro: {
    tier: "pro",
    productId: "prod_UxUDve9SUR7Yxc",
    includedSeats: 5,
    displayName: "Pro",
    monthly: {
      basePriceId: "price_1TxciHCL31xFtol444GXaJ0T",
      seatPriceId: "price_1TxciHCL31xFtol4EX5ncqEY",
      baseAmount: 14900,
      seatAmount: 2900,
    },
    annual: {
      basePriceId: "price_1TxciHCL31xFtol4emF0X6T7",
      seatPriceId: "price_1TxciHCL31xFtol4hkuk8X2s",
      baseAmount: 149000,
      seatAmount: 29000,
    },
  },
  enterprise: {
    tier: "enterprise",
    productId: "prod_UxUDrAi0ogQoOB",
    includedSeats: 10,
    displayName: "Enterprise",
    monthly: {
      basePriceId: "price_1TxciICL31xFtol4Mz6ijLVy",
      seatPriceId: "price_1TxciICL31xFtol4x5JQB8ul",
      baseAmount: 29900,
      seatAmount: 3900,
    },
    annual: {
      basePriceId: "price_1TxciICL31xFtol4Vdnlg35b",
      seatPriceId: "price_1TxciICL31xFtol4r63MpGMW",
      baseAmount: 299000,
      seatAmount: 39000,
    },
  },
};

export const TRIAL_DAYS = 14;

/* ------------------------------ Add-ons ------------------------------ */
// Executive OS: a per-seat add-on billed alongside the org's base subscription
// as a third subscription item. Price ids are hardcoded here to match how base
// plans work — the STRIPE_PRICE_* env-var generation was abandoned and its
// endpoint now returns 410.
//
// The price MUST be tagged metadata.kind = 'addon_exec_os' in Stripe. The
// webhook derives the org's plan by scanning items for metadata.kind === 'base'
// and breaking on the first match, so tagging this price 'base' would silently
// clobber organizations.subscription_plan.
//
// One price id covers both billing intervals, which only works while every
// subscription carrying the add-on is monthly. Stripe rejects items whose
// recurring interval differs from the subscription's, so the first annual org to
// be granted a seat will fail syncExecOsSeatsForOrg with an interval error.
// Adding annual support means a second price id here plus selecting on
// org.subscriptionBilling, the way PLANS already does.
// TODO(sean): replace with real Stripe price id from dashboard
export const EXECUTIVE_OS_ADDON_PRICE_ID = "price_TODO_EXEC_OS_ADDON";

/** Per-seat price of the Executive OS add-on, in cents. */
export const EXECUTIVE_OS_ADDON_AMOUNT_CENTS = 500;

/** Compute how many overage seats above the plan's included count. */
export function overageSeats(tier: PlanTier, activeSeatCount: number): number {
  return Math.max(0, activeSeatCount - PLANS[tier].includedSeats);
}

/** Given a subscription-line-item structure needed for Stripe: base (qty=1) + overage (qty=n). */
export function buildSubscriptionItems(tier: PlanTier, billing: Billing, activeSeatCount: number) {
  const p = PLANS[tier][billing === "annual" ? "annual" : "monthly"];
  const overage = overageSeats(tier, activeSeatCount);
  const items: Array<{ price: string; quantity: number }> = [{ price: p.basePriceId, quantity: 1 }];
  if (overage > 0) items.push({ price: p.seatPriceId, quantity: overage });
  return items;
}
