// Multi-tenant helpers: organizations, memberships, invites, role checks, Stripe seat sync.
// Everything in the server should route through these helpers so we have exactly one
// place that decides "who is this user, which org, what role, what can they do".

import { randomBytes } from "node:crypto";
import { db } from "../storage";
import {
  organizations, memberships, invites, projectMembers,
  ROLE_CAPS, type OrgRole,
  type Organization, type Membership, type Invite,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  PLANS, buildSubscriptionItems, TRIAL_DAYS, EXECUTIVE_OS_ADDON_PRICE_ID,
  type PlanTier, type Billing,
} from "./plans";

/* ============================ Organizations ============================ */

export interface CreateOrganizationInput {
  name: string;
  ownerAccountId: number;
  slug?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: PlanTier;
  subscriptionBilling?: Billing;
  trialEndsAt?: string;
  timezone?: string;
}

/**
 * Validate that a candidate string is a real IANA timezone name.
 * Uses `Intl.DateTimeFormat` under the hood — invalid names throw.
 * Returns the input on success, or null on failure.
 */
export function isValidTimezone(tz: string | undefined | null): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    // Constructing a formatter with an invalid tz throws a RangeError.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const now = new Date().toISOString();
  const slug = input.slug || makeSlug(input.name);
  // Trust caller-supplied timezone only if valid; otherwise fall back to the DB
  // default (America/Denver) by omitting the column from the insert.
  const tz = isValidTimezone(input.timezone) ? input.timezone : undefined;
  const values: any = {
    name: input.name,
    slug,
    ownerAccountId: input.ownerAccountId,
    createdAt: now,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    subscriptionStatus: input.subscriptionStatus ?? null,
    subscriptionPlan: input.subscriptionPlan ?? null,
    subscriptionBilling: input.subscriptionBilling ?? null,
    trialEndsAt: input.trialEndsAt ?? null,
  };
  if (tz) values.timezone = tz;
  const [row] = await db.insert(organizations).values(values).returning();
  return row;
}

/**
 * Update the timezone for an organization. Silently ignored if the timezone is
 * not a valid IANA name — returns the current row unchanged.
 */
export async function updateOrgTimezone(orgId: number, tz: string): Promise<Organization | undefined> {
  if (!isValidTimezone(tz)) return getOrganization(orgId);
  const [row] = await db.update(organizations).set({ timezone: tz }).where(eq(organizations.id, orgId)).returning();
  return row;
}

/**
 * Whitelist of integration keys the UI can toggle. Keeps arbitrary keys from
 * being written into the JSONB column by a naughty client.
 */
export const INTEGRATION_KEYS = [
  "googleCalendar",
] as const;
export type IntegrationKey = typeof INTEGRATION_KEYS[number];

export function isIntegrationKey(k: unknown): k is IntegrationKey {
  return typeof k === "string" && (INTEGRATION_KEYS as readonly string[]).includes(k);
}

/**
 * Merge a partial patch of {integrationKey: boolean} into the org's
 * disabledIntegrations JSONB. `true` means the integration is turned OFF.
 * Only whitelisted keys are accepted; unknown keys are silently dropped.
 */
export async function updateOrgDisabledIntegrations(
  orgId: number,
  patch: Record<string, boolean>,
): Promise<Organization | undefined> {
  const current = await getOrganization(orgId);
  if (!current) return undefined;
  const existing = (current.disabledIntegrations ?? {}) as Record<string, boolean>;
  const next: Record<string, boolean> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (!isIntegrationKey(k)) continue;
    if (v === true) next[k] = true;
    else delete next[k]; // false / undefined clears the flag (enabled = default)
  }
  const [row] = await db
    .update(organizations)
    .set({ disabledIntegrations: next })
    .where(eq(organizations.id, orgId))
    .returning();
  return row;
}

export async function getOrganization(id: number): Promise<Organization | undefined> {
  const rows = await db.select().from(organizations).where(eq(organizations.id, id));
  return rows[0];
}

// Resolve the caller's org timezone — falls back to America/Denver whenever
// the org can't be looked up or its stored timezone is invalid. Used by Jarvis
// (both LLM and local paths) so greetings, "today", and other user-facing
// dates stay in local time on Vercel serverless (which runs in UTC).
export async function resolveOrgTimezone(organizationId?: number): Promise<string> {
  const FALLBACK = "America/Denver";
  if (!organizationId) return FALLBACK;
  try {
    const org = await getOrganization(organizationId);
    const tz = org?.timezone;
    return isValidTimezone(tz) ? (tz as string) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

// Local YYYY-MM-DD in a specific IANA timezone — so "today" doesn't roll over
// at 6pm Denver just because it's midnight UTC. Safe: falls back to UTC on
// invalid tz rather than throwing.
export function todayInTz(timezone: string): string {
  try {
    // en-CA formats as YYYY-MM-DD natively.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function updateOrgBilling(orgId: number, patch: Partial<{
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionBilling: string;
  subscriptionCurrentPeriodEnd: string;
  trialEndsAt: string;
  cancelAtPeriodEnd: boolean;
}>): Promise<Organization | undefined> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) data[k] = v;
  if (Object.keys(data).length === 0) return getOrganization(orgId);
  const [row] = await db.update(organizations).set(data).where(eq(organizations.id, orgId)).returning();
  return row;
}

export async function getOrgByStripeCustomerId(customerId: string): Promise<Organization | undefined> {
  const rows = await db.select().from(organizations).where(eq(organizations.stripeCustomerId, customerId));
  return rows[0];
}

/* ============================ Memberships ============================ */

export async function createMembership(
  accountId: number,
  organizationId: number,
  role: OrgRole,
): Promise<Membership> {
  const now = new Date().toISOString();
  const [row] = await db.insert(memberships).values({
    accountId, organizationId, role, status: "active", createdAt: now,
  }).returning();
  return row;
}

export async function getMembership(id: number): Promise<Membership | undefined> {
  const rows = await db.select().from(memberships).where(eq(memberships.id, id));
  return rows[0];
}

export async function getMembershipForAccount(accountId: number, organizationId: number): Promise<Membership | undefined> {
  const rows = await db.select().from(memberships).where(and(
    eq(memberships.accountId, accountId),
    eq(memberships.organizationId, organizationId),
  ));
  return rows[0];
}

// The primary membership is what we auto-select when the user logs in and hasn't
// picked an org. Today: the first active membership by id. When we add an org
// switcher later, users can override this via a session-scoped preference.
export async function getPrimaryMembership(accountId: number): Promise<Membership | undefined> {
  const rows = await db.select().from(memberships)
    .where(and(eq(memberships.accountId, accountId), eq(memberships.status, "active")))
    .orderBy(memberships.id);
  return rows[0];
}

export async function listMembershipsForOrg(organizationId: number): Promise<Array<Membership & { email?: string; displayName?: string }>> {
  // Join accounts to hydrate email + displayName.
  // Drizzle doesn't have relations wired here, so we do it manually.
  const rows = await db.select().from(memberships).where(eq(memberships.organizationId, organizationId));
  if (rows.length === 0) return [];
  // Fetch accounts individually to keep this simple (org sizes are small — dozens, not thousands).
  const { accounts } = await import("@shared/schema");
  const out: Array<Membership & { email?: string; displayName?: string }> = [];
  for (const m of rows) {
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, m.accountId));
    out.push({ ...m, email: acc?.email, displayName: acc?.displayName });
  }
  return out;
}

export async function updateMembershipRole(id: number, role: OrgRole): Promise<Membership | undefined> {
  const [row] = await db.update(memberships).set({ role }).where(eq(memberships.id, id)).returning();
  return row;
}

export async function removeMembership(id: number): Promise<void> {
  await db.update(memberships).set({ status: "removed" }).where(eq(memberships.id, id));
}

// Active seat count = memberships with status='active'. Used to compute overage on subscription updates.
export async function countActiveSeats(organizationId: number): Promise<number> {
  const rows = await db.select().from(memberships).where(and(
    eq(memberships.organizationId, organizationId),
    eq(memberships.status, "active"),
  ));
  return rows.length;
}

// Executive OS add-on seat count = active memberships with the add-on granted.
// This is the authoritative quantity for the Stripe add-on subscription item.
export async function countExecOsSeats(organizationId: number): Promise<number> {
  const rows = await db.select().from(memberships).where(and(
    eq(memberships.organizationId, organizationId),
    eq(memberships.status, "active"),
    eq(memberships.hasExecutiveOs, true),
  ));
  return rows.length;
}

export async function setMembershipExecutiveOs(id: number, hasExecutiveOs: boolean): Promise<Membership | undefined> {
  const [row] = await db.update(memberships).set({ hasExecutiveOs }).where(eq(memberships.id, id)).returning();
  return row;
}

// Revoke the add-on from every membership in an org. Used when the org's
// subscription is canceled — Stripe drops the add-on subscription item along
// with the subscription, so leaving grants in place would hand out free access.
export async function revokeAllExecOsForOrg(organizationId: number): Promise<void> {
  await db.update(memberships)
    .set({ hasExecutiveOs: false })
    .where(eq(memberships.organizationId, organizationId));
}

/* ============================ Invites ============================ */

export async function createInvite(input: {
  organizationId: number;
  email: string;
  role: OrgRole;
  invitedByAccountId: number;
}): Promise<Invite> {
  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day expiry
  const [row] = await db.insert(invites).values({
    token,
    organizationId: input.organizationId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    invitedByAccountId: input.invitedByAccountId,
    createdAt: now.toISOString(),
    expiresAt,
    acceptedAt: null,
  }).returning();
  return row;
}

export async function getInviteByToken(token: string): Promise<Invite | undefined> {
  const rows = await db.select().from(invites).where(eq(invites.token, token));
  return rows[0];
}

export async function listPendingInvites(organizationId: number): Promise<Invite[]> {
  const rows = await db.select().from(invites)
    .where(eq(invites.organizationId, organizationId))
    .orderBy(desc(invites.id));
  return rows.filter(r => !r.acceptedAt && new Date(r.expiresAt) > new Date());
}

export async function markInviteAccepted(id: number): Promise<void> {
  await db.update(invites).set({ acceptedAt: new Date().toISOString() }).where(eq(invites.id, id));
}

export async function revokeInvite(id: number): Promise<void> {
  // Expire it immediately so it can't be redeemed.
  await db.update(invites).set({ expiresAt: new Date(0).toISOString() }).where(eq(invites.id, id));
}

export function isInviteRedeemable(inv: Invite): boolean {
  if (inv.acceptedAt) return false;
  return new Date(inv.expiresAt) > new Date();
}

/* ============================ Role checks ============================ */

export function can(role: OrgRole, capability: keyof typeof ROLE_CAPS["owner"]): boolean {
  const caps = ROLE_CAPS[role];
  return !!caps && !!caps[capability];
}

export function requireCap(membership: Membership | undefined | null, capability: keyof typeof ROLE_CAPS["owner"]): { ok: true } | { ok: false; status: number; message: string } {
  if (!membership) return { ok: false, status: 401, message: "No active membership" };
  if (membership.status !== "active") return { ok: false, status: 403, message: "Membership inactive" };
  if (!can(membership.role as OrgRole, capability)) {
    return { ok: false, status: 403, message: `Your role (${membership.role}) does not have permission to ${capability}` };
  }
  return { ok: true };
}

/* ============================ Project assignments ============================ */

export async function assignProjectMember(projectId: number, membershipId: number): Promise<void> {
  const existing = await db.select().from(projectMembers).where(and(
    eq(projectMembers.projectId, projectId),
    eq(projectMembers.membershipId, membershipId),
  ));
  if (existing[0]) return;
  await db.insert(projectMembers).values({
    projectId, membershipId, createdAt: new Date().toISOString(),
  });
}

export async function listAssignedProjectIds(membershipId: number): Promise<number[]> {
  const rows = await db.select().from(projectMembers).where(eq(projectMembers.membershipId, membershipId));
  return rows.map(r => r.projectId);
}

/* ============================ Stripe seat sync ============================ */

// Given an org, look up its plan/billing and reconcile subscription items to match
// the current active seat count. Base is qty=1; overage price gets qty=(seats - included).
// If the org has no subscription (no stripe_subscription_id), no-op.
export async function syncSeatsForOrg(
  stripe: any,
  organizationId: number,
): Promise<{ synced: boolean; overageQty?: number; reason?: string }> {
  const org = await getOrganization(organizationId);
  if (!org) return { synced: false, reason: "org_not_found" };
  if (!org.stripeSubscriptionId) return { synced: false, reason: "no_subscription" };
  if (!org.subscriptionPlan || !org.subscriptionBilling) return { synced: false, reason: "no_plan_metadata" };

  const tier = org.subscriptionPlan as PlanTier;
  const billing = org.subscriptionBilling as Billing;
  const plan = PLANS[tier];
  if (!plan) return { synced: false, reason: "unknown_plan" };

  const seats = await countActiveSeats(organizationId);
  const overageQty = Math.max(0, seats - plan.includedSeats);
  const seatPriceId = plan[billing === "annual" ? "annual" : "monthly"].seatPriceId;

  // Load subscription and find the seat-price line item (if any).
  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const seatItem = sub.items?.data?.find((i: any) => i.price?.id === seatPriceId);

  if (overageQty === 0) {
    // Remove seat item if present.
    if (seatItem) {
      await stripe.subscriptionItems.del(seatItem.id, { proration_behavior: "always_invoice" });
    }
    return { synced: true, overageQty: 0 };
  }

  if (seatItem) {
    // Update quantity.
    if (seatItem.quantity !== overageQty) {
      await stripe.subscriptionItems.update(seatItem.id, {
        quantity: overageQty,
        proration_behavior: "always_invoice",
      });
    }
  } else {
    // Add seat line item.
    await stripe.subscriptionItems.create({
      subscription: org.stripeSubscriptionId,
      price: seatPriceId,
      quantity: overageQty,
      proration_behavior: "always_invoice",
    });
  }
  return { synced: true, overageQty };
}

// Reconcile the Executive OS add-on subscription item against the number of
// memberships holding the grant. Mirrors syncSeatsForOrg, with two differences:
// every entitled seat is billable (there is no included-seat allowance), and the
// item is matched by the add-on price id so it stays independent of the base and
// seat-overage items.
//
// The quantity is always read from the DB and set absolutely, never incremented,
// so concurrent grants and retried Stripe webhooks both converge on the truth.
export async function syncExecOsSeatsForOrg(
  stripe: any,
  organizationId: number,
): Promise<{ synced: boolean; quantity?: number; reason?: string }> {
  if (!stripe) return { synced: false, reason: "no_stripe" };
  const org = await getOrganization(organizationId);
  if (!org) return { synced: false, reason: "org_not_found" };
  // Demo orgs are "trialing" with no Stripe objects at all — entitlement still
  // works locally, there is just nothing to bill.
  if (!org.stripeSubscriptionId) return { synced: false, reason: "no_subscription" };

  const quantity = await countExecOsSeats(organizationId);

  const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const addonItem = sub.items?.data?.find((i: any) => i.price?.id === EXECUTIVE_OS_ADDON_PRICE_ID);

  if (quantity === 0) {
    if (addonItem) {
      await stripe.subscriptionItems.del(addonItem.id, { proration_behavior: "always_invoice" });
    }
    return { synced: true, quantity: 0 };
  }

  if (addonItem) {
    if (addonItem.quantity !== quantity) {
      await stripe.subscriptionItems.update(addonItem.id, {
        quantity,
        proration_behavior: "always_invoice",
      });
    }
  } else {
    await stripe.subscriptionItems.create({
      subscription: org.stripeSubscriptionId,
      price: EXECUTIVE_OS_ADDON_PRICE_ID,
      quantity,
      proration_behavior: "always_invoice",
    });
  }
  return { synced: true, quantity };
}

/* ============================ Signup + Stripe checkout ============================ */

// After a new account is created, spin up its organization + Stripe customer + subscription
// (with 14-day trial, card required at checkout for real signups). Returns the new org.
//
// This is the "primary owner path" — the account creating the org becomes its owner.
export async function bootstrapOrganizationForAccount(input: {
  accountId: number;
  accountEmail: string;
  orgName: string;
  tier: PlanTier;
  billing: Billing;
  stripe?: any; // pass the initialized Stripe client, or omit for a no-Stripe test path
  returnUrl?: string; // if provided, will create a checkout session and return url
  cancelUrl?: string;
  timezone?: string;
}): Promise<{ organizationId: number; checkoutUrl?: string }> {
  const org = await createOrganization({
    name: input.orgName,
    ownerAccountId: input.accountId,
    subscriptionStatus: input.stripe ? undefined : "trialing", // pre-checkout state
    subscriptionPlan: input.tier,
    subscriptionBilling: input.billing,
    timezone: input.timezone,
  });
  await createMembership(input.accountId, org.id, "owner");

  if (!input.stripe) {
    return { organizationId: org.id };
  }

  // Create customer + checkout session with base + trial. Overage seats are added by webhook once seats > included.
  const customer = await input.stripe.customers.create({
    email: input.accountEmail,
    metadata: { organizationId: String(org.id), plan: input.tier, billing: input.billing },
  });
  await updateOrgBilling(org.id, { stripeCustomerId: customer.id });

  const items = buildSubscriptionItems(input.tier, input.billing, 1); // 1 seat = the founding owner
  const checkoutSession = await input.stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    line_items: items.map(i => ({ price: i.price, quantity: i.quantity })),
    success_url: input.returnUrl || "https://trusspath.com/#/settings?checkout=success",
    cancel_url: input.cancelUrl || "https://trusspath.com/#/paywall?checkout=cancelled",
    payment_method_collection: "always", // card required even for trial
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: {
        organizationId: String(org.id),
        plan: input.tier,
        billing: input.billing,
      },
    },
    metadata: { organizationId: String(org.id), plan: input.tier, billing: input.billing },
  });

  return { organizationId: org.id, checkoutUrl: checkoutSession.url || undefined };
}

/* ============================ Demo login (48h) ============================ */

// Spin up an isolated demo org for a prospect, with the account as owner. No
// Stripe involved — subscriptionStatus is set to "trialing" so it satisfies
// isOrgInGoodStanding() naturally. The 48h expiry lives on the account itself.
export async function bootstrapDemoOrgForAccount(input: {
  accountId: number;
  orgName: string;
}): Promise<{ organizationId: number }> {
  const org = await createOrganization({
    name: input.orgName,
    ownerAccountId: input.accountId,
    subscriptionStatus: "trialing", // demo orgs bypass paywall via this status
    subscriptionPlan: "starter",
    subscriptionBilling: "monthly",
  });
  await createMembership(input.accountId, org.id, "owner");
  return { organizationId: org.id };
}

/* ============================ Utilities ============================ */

function makeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = randomBytes(3).toString("hex");
  return `${base || "org"}-${suffix}`;
}
