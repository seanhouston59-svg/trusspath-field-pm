// Multi-tenant request middleware.
//
// Resolves the caller's active membership + organization and attaches them to req.
// Also provides role-gated route helpers (requireRole, requireCap).
//
// Every /api/* endpoint that isn't PUBLIC or auth-related runs through
// resolveMembership, so downstream code can trust req.membership + req.organizationId.

import { ROLE_CAPS, type OrgRole, isOrgInGoodStanding } from "@shared/schema";
import {
  getPrimaryMembership,
  getMembership,
  getOrganization,
  can,
} from "./orgs";

// Endpoints that are membership-optional (billing, admin platform tools, marketing).
const NO_MEMBERSHIP_REQUIRED = new Set<string>([
  "/api/auth/me",
  "/api/auth/profile",
  "/api/billing/checkout",
  "/api/billing/portal",
  "/api/billing/status",
  "/api/stripe/webhook",
  "/api/subscribe",
  "/api/demo-request",
  "/api/orgs", // POST creates first org for the current user
]);

const NO_MEMBERSHIP_PREFIXES = ["/api/admin/", "/api/auth/"];

function isMembershipOptional(path: string): boolean {
  if (NO_MEMBERSHIP_REQUIRED.has(path)) return true;
  return NO_MEMBERSHIP_PREFIXES.some(p => path.startsWith(p));
}

export async function resolveMembership(req: any, res: any, next: any) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (!req.account) return next(); // authMiddleware handles anonymous callers separately

  // Client can hint which org they want via header (org switcher). Otherwise use primary.
  const requestedOrgHeader = req.headers?.["x-organization-id"];
  const requestedOrgId = requestedOrgHeader ? parseInt(String(requestedOrgHeader), 10) : NaN;

  let membership = null;
  if (Number.isFinite(requestedOrgId)) {
    // Verify the account has a membership in the requested org.
    const { getMembershipForAccount } = await import("./orgs");
    membership = await getMembershipForAccount(req.account.id, requestedOrgId) ?? null;
  } else {
    membership = await getPrimaryMembership(req.account.id) ?? null;
  }

  if (membership) {
    req.membership = membership;
    req.organizationId = membership.organizationId;
    req.organization = await getOrganization(membership.organizationId);
  }

  // If path requires a membership and we have none, block. Owners of the platform
  // (legacy account.role='owner') get a bypass — they can access any org via header.
  if (!isMembershipOptional(p) && !membership) {
    if (req.account.role !== "owner") {
      return res.status(403).json({
        message: "You are not a member of any organization. Ask your admin to invite you.",
      });
    }
  }

  // Paywall enforcement — the org's subscription must be active/trialing to use
  // paid-feature endpoints. Legacy platform-owner role and membership-optional
  // paths bypass.
  if (
    !isMembershipOptional(p) &&
    req.organization &&
    req.account.role !== "owner" &&
    !isOrgInGoodStanding(req.organization)
  ) {
    return res.status(402).json({
      message: "This organization's subscription is inactive. Please renew billing to continue.",
      reason: "org_subscription_inactive",
      subscriptionStatus: req.organization.subscriptionStatus,
    });
  }

  next();
}

export function requireRole(...allowed: OrgRole[]) {
  return function (req: any, res: any, next: any) {
    const m = req.membership;
    if (!m) return res.status(403).json({ message: "No active membership" });
    if (!allowed.includes(m.role)) {
      return res.status(403).json({
        message: `Requires role: ${allowed.join(" or ")}. Your role: ${m.role}.`,
      });
    }
    next();
  };
}

// Command Deck is a paid per-seat add-on. Until this existed the whole
// surface was gated only by a client-side dropdown, so the data was readable
// by anyone who called the API directly.
//
// Matched by path rather than bolted onto each handler on purpose: the
// mobilization sub-resource routes are registered from a table in a loop, and
// the surface is ~40 endpoints, so per-route decoration would silently miss
// some and would not cover routes added later.
//
// Both API prefixes are matched: the endpoints still live under
// /api/executive-os (renamed separately from the UI URLs), and matching
// /api/command-deck too means a renamed endpoint arrives already gated rather
// than briefly open.
const EXEC_OS_PATH_PATTERNS: RegExp[] = [
  /^\/api\/executive-os\//,
  /^\/api\/command-deck\//,
  /^\/api\/projects\/[^/]+\/(mobilization|project-setup|pre-construction)(\/|$)/,
  /^\/api\/projects\/[^/]+\/modules(\/|$)/,
];

export function isExecutiveOsPath(path: string): boolean {
  return EXEC_OS_PATH_PATTERNS.some(re => re.test(path));
}

export function requireExecutiveOs(req: any, res: any, next: any) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!isExecutiveOsPath(p)) return next();
  // Legacy platform-owners bypass, matching resolveMembership's membership and
  // paywall checks. They frequently have no membership row at all, so without
  // this they would lose the surface entirely.
  if (req.account?.role === "owner") return next();
  if (req.membership?.hasExecutiveOs !== true) {
    return res.status(403).json({
      message: "Command Deck is a paid add-on. Ask an owner or admin to enable it for your seat.",
      reason: "exec_os_not_entitled",
    });
  }
  next();
}

export function requireCap(capability: keyof typeof ROLE_CAPS["owner"]) {
  return function (req: any, res: any, next: any) {
    const m = req.membership;
    if (!m) return res.status(403).json({ message: "No active membership" });
    if (!can(m.role as OrgRole, capability)) {
      return res.status(403).json({
        message: `Your role (${m.role}) does not have permission for ${capability}.`,
      });
    }
    next();
  };
}
