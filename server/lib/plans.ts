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
// Command Deck: a per-seat add-on billed alongside the org's base subscription
// as a third subscription item. Price ids are hardcoded here to match how base
// plans work — the STRIPE_PRICE_* env-var generation was abandoned and its
// endpoint now returns 410.
//
// Both prices MUST be tagged metadata.kind = 'addon_exec_os' in Stripe. That
// literal predates the Command Deck rename and is deliberately left alone: it
// lives in the Stripe account, not this repo, and renaming it here without
// re-tagging every existing price would be a silent mismatch. The
// webhook derives the org's plan by scanning items for metadata.kind === 'base'
// and breaking on the first match, so tagging either price 'base' would silently
// clobber organizations.subscription_plan.
//
// There is one price per interval because Stripe rejects a subscription item
// whose recurring interval differs from the subscription's — an annual org can
// only carry the annual add-on price.
// TODO(sean): monthly price is the SANDBOX id (livemode:false).
// Before production launch: create the same product/price in the LIVE Stripe
// account (metadata.kind = "addon_exec_os") and swap this value.
// Annual price is still a TODO — create when annual billing goes live.
export const COMMAND_DECK_ADDON_PRICE_IDS = {
  monthly: "price_1TyhFwCL31xFtol4GQDNjiN0",
  annual: "price_TODO_COMMAND_DECK_ADDON_ANNUAL",
} as const;

/** Per-seat price of the Command Deck add-on, in cents. */
export const COMMAND_DECK_ADDON_AMOUNT_CENTS = 500;

// Pick the add-on price whose interval matches the subscription's. Mirrors how the
// webhook derives the org's billing interval (server/routes.ts): find the item tagged
// metadata.kind='base' and read its recurring interval. Stripe requires every item on
// a subscription to share one interval, so the first item is a safe fallback when the
// base tag is missing.
export function getCommandDeckPriceIdForSubscription(subscription: any): string {
  const items = subscription?.items?.data || [];
  const base = items.find((i: any) => i.price?.metadata?.kind === "base") || items[0];
  const billing: Billing = base?.price?.recurring?.interval === "year" ? "annual" : "monthly";
  return COMMAND_DECK_ADDON_PRICE_IDS[billing];
}

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
