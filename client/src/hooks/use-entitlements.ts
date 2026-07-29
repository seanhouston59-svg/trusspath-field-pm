// Server-derived feature entitlements.
//
// These read /api/billing/status rather than /api/org/current because that
// endpoint is membership-optional, so it still answers while an org's
// subscription is lapsed, and it already blocks first paint in RequireAuth —
// no extra request is added to the cold load.

import { useBillingStatus } from "./use-data";

export function useExecutiveOsEntitlement(): {
  hasAccess: boolean;
  seatCount: number;
  isLoading: boolean;
} {
  const { data, isLoading } = useBillingStatus();
  return {
    // Loading and errored both read as "no access" so the caller never leaks a
    // gated view; callers must check isLoading before rendering an upsell, or
    // it will flash on every cold load.
    hasAccess: data?.entitlements?.executiveOs === true,
    seatCount: data?.entitlements?.execOsSeatCount ?? 0,
    isLoading,
  };
}
