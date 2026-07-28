import type { Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { storage } from "./storage";
import { getDailyLogWeather, placesAutocomplete, placeDetails, hasPlacesApi } from "./apis";
import { jarvisChat, jarvisBrief } from "./jarvis";
import { localJarvisChat, buildRichLocalBrief, buildSafetyBrief } from "./jarvis-local";
import { buildContext } from "./jarvis";
import { runHealthScan } from "./health";
import { sendSignupNotification, sendPasswordResetEmail, sendInviteEmail } from "./mailer";
import { weekStartMonday, ensureTimesheetForWeek, rollupPunchToTimesheet, runWeeklyRolloverIfDue, findManagerForProject } from "./timesheet-auto";
import {
  insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema,
  insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema,
  insertPunchItemSchema, insertContactSchema, insertEquipmentSchema, insertMaintenanceLogSchema,
  insertPhotoSchema, insertDocumentSchema, insertCompanyDocumentSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertMessageSchema, insertNoteSchema, insertMilestoneSchema,
  insertTeamSchema,
  insertMobilizationItemSchema, insertMobilizationPermitSchema, insertMobilizationEquipmentSchema,
  insertMobilizationUtilitySchema, insertMobilizationStaffSchema, insertMobilizationSubSchema,
  insertMobilizationRiskSchema,
  insertSubscriberSchema, insertDemoRequestSchema,
  signupSchema, loginSchema,
  isAccountInGoodStanding, isSubscriptionActive, isDemoExpired,
  ORG_ROLES, type OrgRole,
  type Project,
} from "@shared/schema";
import { EVENT_KINDS } from "@shared/project-event-kinds";
import {
  MOBILIZATION_SECTIONS, MOBILIZATION_MILESTONE_KIND, EARTHWORK_MILESTONE_TITLE,
  computeHealth, daysUntil, pct,
} from "@shared/mobilization-catalog";
import { PLANS, TRIAL_DAYS, type PlanTier, type Billing } from "./lib/plans";
import {
  bootstrapOrganizationForAccount, bootstrapDemoOrgForAccount,
  createInvite, getInviteByToken, listPendingInvites, markInviteAccepted, revokeInvite, isInviteRedeemable,
  createMembership, getMembership, getMembershipForAccount, listMembershipsForOrg, updateMembershipRole, removeMembership,
  syncSeatsForOrg,
  getOrganization, updateOrgBilling, getOrgByStripeCustomerId,
  updateOrgTimezone, isValidTimezone, updateOrgDisabledIntegrations, isIntegrationKey,
  countActiveSeats,
} from "./lib/orgs";
import { resolveMembership, requireCap, requireRole } from "./lib/mt-middleware";

function pid(req: any): number | undefined {
  return req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
}

// Fire-and-forget Project Timeline event logger. Every mutation route calls
// this after the underlying save succeeds. Never awaited on the critical
// path — storage.recordEvent already swallows errors, but we double-guard so
// even a throw here can't kill a response.
//
// Callers pass just the interesting bits (projectId, kind, title, optional
// subtitle/meta/source). Actor + org are pulled from `req` automatically.
function logEvent(req: any, args: {
  projectId: number | null | undefined;
  kind: string;
  title: string;
  subtitle?: string | null;
  meta?: Record<string, any>;
  sourceType?: string;
  sourceId?: number | null;
  occurredAt?: string;
}): void {
  if (!args.projectId) return; // Some entities aren't project-scoped.
  const actor = req?.account;
  Promise.resolve(storage.recordEvent({
    projectId: args.projectId,
    organizationId: req?.organizationId ?? null,
    actorAccountId: actor?.id ?? null,
    actorName: actor?.name ?? actor?.email ?? null,
    kind: args.kind,
    title: args.title,
    subtitle: args.subtitle ?? null,
    meta: args.meta ?? {},
    sourceType: args.sourceType,
    sourceId: args.sourceId ?? null,
    occurredAt: args.occurredAt,
  })).catch(() => {
    // Storage already logged. Nothing else to do — the user's mutation
    // succeeded even if their audit trail row didn't land.
  });
}

// Human-readable random password for demo logins (owner reads it aloud/copies it).
// Alphabet excludes similar-looking characters (0/O, 1/l/I). Not for real accounts.
function generateReadablePassword(len: number = 16): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/* -------------------- Auth middleware -------------------- */
const SESSION_COOKIE = "tp_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}

function setSessionCookie(res: any, token: string) {
  const isProd = process.env.NODE_ENV === "production";
  // In prod we may be embedded cross-origin (pplx.app preview -> vercel.app API),
  // so we need SameSite=None; Secure for the browser to send the cookie back.
  const sameSite = isProd ? "None" : "Lax";
  const secure = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`
  );
}
function clearSessionCookie(res: any) {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = isProd ? "None" : "Lax";
  const secure = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`
  );
}

// Simple in-memory rate limiter for auth endpoints (brute-force protection)
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const AUTH_RATE_LIMIT = 10;
const AUTH_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

function authRateLimit(req: any, res: any, next: any) {
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown") as string;
  const now = Date.now();
  const entry = authAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_RATE_LIMIT) {
      const mins = Math.ceil((entry.resetAt - now) / 60000);
      return res.status(429).json({ message: `Too many attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.` });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
  }

  // Clean expired entries periodically
  if (authAttempts.size > 500) {
    authAttempts.forEach((val, key) => {
      if (now >= val.resetAt) authAttempts.delete(key);
    });
  }
  next();
}

// Public paths that do not require auth. Everything else under /api/* requires a session.
const PUBLIC_API = new Set<string>([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/stripe/webhook",
  "/api/billing/checkout",
  // marketing / landing page endpoints — safe to leave public
  "/api/subscribe",
  "/api/demo-request",
]);
// Public path prefixes — invite lookup (GET /api/invites/:token) is public so an
// invitee can preview their invite before creating an account.
const PUBLIC_API_PREFIXES = [
  "/api/invites/", // GET only — accept requires auth so it runs through normal middleware
];
function isPublicApi(path: string, method: string): boolean {
  if (PUBLIC_API.has(path)) return true;
  if (method === "GET" && PUBLIC_API_PREFIXES.some(p => path.startsWith(p))) return true;
  return false;
}

// Paths that require a session but bypass the paywall (approval + subscription) check.
// These are the paths a not-yet-in-good-standing user needs to reach: their own account,
// billing checkout/portal, and billing status. Everything else under /api/* is paywalled.
const PAYWALL_EXEMPT_API_PREFIXES = [
  "/api/auth/",
  "/api/billing/",
  "/api/stripe/",
];
function isPaywallExempt(p: string): boolean {
  return PAYWALL_EXEMPT_API_PREFIXES.some((prefix) => p.startsWith(prefix));
}

async function authMiddleware(req: any, res: any, next: any) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (isPublicApi(p, req.method || "GET")) return next();
  const cookies = parseCookies(req.headers?.cookie);
  // Accept token via cookie, Authorization: Bearer header, or ?token= query param
  // (query is used for <img src> / <a href> where headers aren't possible).
  const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = cookies[SESSION_COOKIE] || bearer || queryToken;
  const s = token ? await storage.getSession(token) : null;
  if (!s) return res.status(401).json({ message: "Unauthorized" });

  // Demo login expiry: refuse any request whose account's 48h window has passed.
  // We also destroy the session so a fresh login attempt is required (and will
  // also be blocked by verifyPassword). Clears the cookie so the client stops sending it.
  if (isDemoExpired(s.account as any)) {
    try { await storage.destroySession(token); } catch {}
    clearSessionCookie(res);
    return res.status(401).json({ message: "This demo login has expired.", reason: "demo_expired" });
  }

  req.account = s.account;
  req.sessionToken = token;

  // Legacy per-account paywall removed — the org-level paywall now runs in resolveMembership
  // (multi-tenant subscriptions live on the organization, not the account).
  next();
}

// Owner-only gate for /api/admin/* endpoints. Must run after authMiddleware.
function requireOwner(req: any, res: any, next: any) {
  const acc = req.account;
  if (!acc) return res.status(401).json({ message: "Unauthorized" });
  if (acc.role !== "owner") return res.status(403).json({ message: "Owner access required" });
  next();
}

// Primary owner is the founder account — protected from being modified by any other owner.
// Set PRIMARY_OWNER_ID env to enforce; defaults to id=1 for local/dev.
function getPrimaryOwnerId(): number {
  const raw = process.env.PRIMARY_OWNER_ID;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : 0; // 0 = disabled
}

const UPLOAD_DIR = process.env.VERCEL
  ? "/tmp/uploads/documents"
  : path.resolve(process.cwd(), "uploads/documents");
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Upload a PDF or image."));
  },
});

const PHOTO_DIR = process.env.VERCEL
  ? "/tmp/uploads/photos"
  : path.resolve(process.cwd(), "uploads/photos");
try { fs.mkdirSync(PHOTO_DIR, { recursive: true }); } catch {}

// On serverless (Vercel), /tmp is ephemeral per invocation. The DB seed rows
// reference stored file names, so we lazily hydrate PHOTO_DIR from the bundled
// seed-photos directory on demand. First checks the standard candidates, then
// copies any missing files into PHOTO_DIR. Safe to call repeatedly.
let photoHydrated = false;
function hydrateSeedPhotos(): void {
  if (photoHydrated) return;
  const candidates = [
    path.resolve(process.cwd(), "seed-photos"),
    path.resolve(process.cwd(), "server/seed-photos"),
    path.resolve(__dirname, "seed-photos"),
    path.resolve(__dirname, "../seed-photos"),
    path.resolve(__dirname, "../server/seed-photos"),
  ];
  let src: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { src = c; break; }
  }
  if (!src) { photoHydrated = true; return; }
  try {
    const files = fs.readdirSync(src);
    for (const f of files) {
      const dst = path.join(PHOTO_DIR, f);
      if (!fs.existsSync(dst)) {
        try { fs.copyFileSync(path.join(src, f), dst); } catch {}
      }
    }
  } catch {}
  photoHydrated = true;
}

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const photoUpload = multer({
  storage: multer.diskStorage({
    destination: PHOTO_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Upload a JPG, PNG, GIF, WEBP, or SVG image."));
  },
});

const DRONE_DIR = process.env.VERCEL
  ? "/tmp/uploads/drone"
  : path.resolve(process.cwd(), "uploads/drone");
try { fs.mkdirSync(DRONE_DIR, { recursive: true }); } catch {}

const droneUpload = multer({
  storage: multer.diskStorage({
    destination: DRONE_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Upload a JPG, PNG, GIF, WEBP, or SVG image."));
  },
});

export async function registerRoutes(_httpServer: Server, app: Express): Promise<Server> {
  // CORS: allow the pplx.app preview (and same-origin) to call this API with credentials.
  // Cookies with SameSite=None require CORS + Access-Control-Allow-Credentials.
  const ALLOWED_ORIGIN_SUFFIXES = [
    ".pplx.app",
    ".vercel.app",
    ".perplexity.ai",
    "trusspath.com",
  ];
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (origin) {
      let allowed = false;
      try {
        const host = new URL(origin).hostname;
        allowed =
          host === "localhost" ||
          host === "127.0.0.1" ||
          ALLOWED_ORIGIN_SUFFIXES.some((suf) => host === suf.slice(1) || host.endsWith(suf));
      } catch {}
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET,POST,PATCH,PUT,DELETE,OPTIONS"
        );
        res.setHeader(
          "Access-Control-Allow-Headers",
          req.headers["access-control-request-headers"] as string ||
            "Content-Type, Authorization"
        );
        res.setHeader("Access-Control-Max-Age", "600");
      }
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  // Gate all /api/* routes behind auth (except the PUBLIC_API allowlist).
  app.use(authMiddleware);
  // Resolve req.membership/req.organization for every authenticated request.
  app.use(resolveMembership);

  // ==== Multi-tenant helpers ====
  // Verify the given project belongs to the caller's org; returns 404 otherwise.
  // Legacy platform-owners (req.account.role === 'owner') bypass — they can see any project.
  async function requireProjectAccess(req: any, res: any, projectId: number): Promise<Project | null> {
    const project = await storage.getProject(projectId);
    if (!project) { res.status(404).json({ message: "Project not found" }); return null; }
    if (req.account?.role === "owner") return project; // platform-owner bypass
    if (!req.organizationId || project.organizationId !== req.organizationId) {
      res.status(404).json({ message: "Project not found" }); // 404 (not 403) — don't reveal existence
      return null;
    }
    return project;
  }
  // Inject org id into an insert payload so newly-created rows are correctly scoped.
  function withOrg<T extends Record<string, any>>(req: any, data: T): T & { organizationId: number | null } {
    return { ...data, organizationId: req.organizationId ?? null };
  }

  // Middleware for project-scoped child endpoints (/api/tasks, /api/rfis, etc.).
  // If ?projectId= is set, verifies caller has access to that project.
  // If unset, restricts callers to their own org's projects by filling req._orgProjectIds.
  // Platform-owners bypass entirely.
  async function scopeProjectQuery(req: any, res: any, next: any) {
    if (req.account?.role === "owner") return next(); // platform owner — no filter
    const q = req.query?.projectId;
    if (q !== undefined && q !== "") {
      const pid = parseInt(String(q), 10);
      if (!Number.isFinite(pid)) return res.status(400).json({ message: "Invalid projectId" });
      const project = await storage.getProject(pid);
      if (!project || (req.organizationId && project.organizationId !== req.organizationId)) {
        return res.status(404).json({ message: "Project not found" });
      }
      return next();
    }
    // No projectId supplied — we'll filter results client-side after fetching.
    // Fetch the set of project IDs in this org so downstream can filter.
    if (req.organizationId) {
      const orgProjects = await storage.getProjects(req.organizationId);
      req._orgProjectIds = new Set(orgProjects.map((p: Project) => p.id));
    }
    next();
  }
  // Filter an array of project-scoped rows to only those in the caller's org.
  function filterByOrgProjects(req: any, rows: any[]): any[] {
    if (req.account?.role === "owner") return rows;
    if (!req._orgProjectIds) return rows; // e.g. projectId was supplied — already validated
    return rows.filter(r => r.projectId == null || req._orgProjectIds.has(r.projectId));
  }

  // ============================ STRIPE BILLING (hoisted) ============================
  // Initialized here (before auth routes) so signup + invite flows can reference `stripe`.
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const StripeCtor = stripeKey ? require("stripe") : null;
  const stripe = stripeKey ? new StripeCtor(stripeKey, { apiVersion: "2025-03-31.basil" }) : null;
  const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";

  /* ------------------------- Auth ------------------------- */
  app.post("/api/auth/signup", authRateLimit, async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password, displayName, company, plan, billing, inviteToken, timezone } = parsed.data;
    const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";

    try {
      // Invite path: caller signs up via an invite link. Skip org creation + Stripe;
      // join the inviter's org with the invite's role.
      if (inviteToken) {
        const invite = await getInviteByToken(inviteToken);
        if (!invite || !isInviteRedeemable(invite)) {
          return res.status(400).json({ message: "Invite is invalid or expired" });
        }
        if (invite.email.toLowerCase() !== email.trim().toLowerCase()) {
          return res.status(400).json({ message: "Signup email must match the invite email" });
        }
        const account = await storage.createAccount(email, password, displayName, company);
        await createMembership(account.id, invite.organizationId, invite.role as OrgRole);
        await markInviteAccepted(invite.id);

        // Re-sync Stripe seat count for the org (may add an overage seat).
        try {
          if (stripe) await syncSeatsForOrg(stripe, invite.organizationId);
        } catch (e) {
          console.error("[signup:invite] seat sync failed:", e);
        }

        const session = await storage.createSession(account.id);
        setSessionCookie(res, session.id);
        return res.status(201).json({ account, token: session.id, joinedOrganizationId: invite.organizationId });
      }

      // New-org path: creator becomes the org owner. If Stripe is configured and
      // plan/billing are provided, we bootstrap a Stripe subscription (with trial + card).
      const account = await storage.createAccount(email, password, displayName, company);

      let checkoutUrl: string | undefined;
      const chosenPlan = (plan || "starter") as PlanTier;
      const chosenBilling = (billing || "monthly") as Billing;
      const bootstrap = await bootstrapOrganizationForAccount({
        accountId: account.id,
        accountEmail: email,
        orgName: company || `${displayName}'s Org`,
        tier: chosenPlan,
        billing: chosenBilling,
        stripe: stripe || undefined,
        returnUrl: `${APP_URL}/#/settings?checkout=success`,
        cancelUrl: `${APP_URL}/#/paywall?checkout=cancelled`,
        timezone,
      });
      checkoutUrl = bootstrap.checkoutUrl;

      const session = await storage.createSession(account.id);
      setSessionCookie(res, session.id);

      // Notify platform-owner about the new account (does NOT gate access — orgs
      // are self-serve; approval is legacy behavior).
      void sendSignupNotification({
        kind: "signup",
        subject: `New TrussPath signup — ${displayName} (${email})`,
        fields: {
          Name: displayName,
          Email: email,
          Company: company,
          Plan: chosenPlan,
          Billing: chosenBilling,
          Organization: `id=${bootstrap.organizationId}`,
          "Signed up": new Date().toISOString(),
        },
        cta: { label: "Review in admin console", url: `${APP_URL}/#/admin/signups` },
      });

      res.status(201).json({
        account,
        token: session.id,
        organizationId: bootstrap.organizationId,
        checkoutUrl,
      });
    } catch (e: any) {
      const msg = e?.message || "Signup failed";
      const status = /already/i.test(msg) ? 409 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password } = parsed.data;
    const account = await storage.verifyPassword(email, password);
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    // Demo login expiry — refuse if this demo account's 48h window has elapsed.
    if (isDemoExpired(account as any)) {
      return res.status(401).json({ message: "This demo login has expired.", reason: "demo_expired" });
    }
    const session = await storage.createSession(account.id);
    setSessionCookie(res, session.id);
    res.json({ account, token: session.id });
  });

  app.post("/api/auth/logout", async (req: any, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) await storage.destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Forgot password — generate reset token and email it
  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    // Always return success — don't leak whether email exists
    if (email) {
      const account = await storage.getAccountByEmail(email);
      if (account) {
        const token = await storage.createPasswordResetToken(account.id);
        const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";
        const resetUrl = `${APP_URL}/#/reset-password?token=${token}`;
        // Fire-and-forget so email outages don't block the request
        sendPasswordResetEmail(email, resetUrl).catch((e) =>
          console.error("[forgot-password] email send failed:", e)
        );
      }
    }
    res.json({ ok: true, message: "If an account exists with that email, a reset link has been sent." });
  });

  // Reset password — validate token and set new password
  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) return res.status(400).json({ message: "Token and new password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const resetToken = await storage.usePasswordResetToken(token);
    if (!resetToken) return res.status(400).json({ message: "Invalid or expired reset token" });

    await storage.updatePassword(resetToken.accountId, password);
    res.json({ ok: true, message: "Password updated successfully" });
  });

  app.get("/api/auth/me", async (req: any, res) => {
    // Prefer bearer header (cross-origin clients), fall back to cookie.
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? await storage.getSession(token) : null;
    if (!s) return res.status(401).json({ account: null });
    res.json({ account: s.account });
  });

  app.patch("/api/auth/profile", async (req: any, res) => {
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? await storage.getSession(token) : null;
    if (!s) return res.status(401).json({ message: "Not authenticated" });
    const body = req.body || {};
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
    const position = typeof body.position === "string" ? body.position.trim() : undefined;
    if (displayName === "") return res.status(400).json({ message: "Display name cannot be empty" });
    const updated = await storage.updateAccountProfile(s.account.id, { displayName, position });
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json({ account: updated });
  });

  // ============================ DASHBOARD LAYOUT ============================
  // Per-user drag/drop + show/hide customization. Null layout = fall back to
  // role-based defaults on the client (see client/src/lib/dashboard-layout.ts).
  app.get("/api/me/dashboard-layout", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const acc: any = req.account;
    res.json({ layout: acc.dashboardLayout ?? null });
  });

  app.put("/api/me/dashboard-layout", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const body = req.body || {};
    // Explicit reset → clear the column so defaults kick back in.
    if (body.layout === null) {
      await storage.updateDashboardLayout(req.account.id, null);
      return res.json({ layout: null });
    }
    const raw = body.layout;
    if (!raw || !Array.isArray(raw.widgets)) {
      return res.status(400).json({ error: "layout.widgets[] required" });
    }
    const validSizes = new Set(["sm", "md", "lg", "xl"]);
    const seen = new Set<string>();
    const widgets = [] as Array<{ id: string; size: "sm" | "md" | "lg" | "xl"; hidden?: boolean }>;
    for (const w of raw.widgets) {
      if (!w || typeof w.id !== "string" || w.id.length === 0) continue;
      if (seen.has(w.id)) continue; // dedupe
      seen.add(w.id);
      const size = validSizes.has(w.size) ? (w.size as "sm" | "md" | "lg" | "xl") : "md";
      widgets.push({ id: w.id, size, hidden: !!w.hidden });
    }
    // Cap to a sane size to prevent runaway blobs.
    const capped = { widgets: widgets.slice(0, 64) };
    await storage.updateDashboardLayout(req.account.id, capped);
    res.json({ layout: capped });
  });

  // ============================ FIELD PUNCHES ============================
  // Mobile foreman clock in/out. Append-only stream, one row per event.
  // client_id makes offline-queue submits idempotent so a retried offline
  // request never creates a duplicate row.
  app.get("/api/field/punches", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit) || 20));
    const rows = await storage.getRecentFieldPunches(req.account.id, limit);
    const open = await storage.getOpenFieldPunch(req.account.id);
    res.json({ punches: rows, open: open ?? null });
  });

  app.post("/api/field/punches", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const kind = String(req.body?.kind || "");
    if (!/^(in|out|break_start|break_end)$/.test(kind)) {
      return res.status(400).json({ error: "kind must be one of in | out | break_start | break_end" });
    }
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ error: "projectId required" });
    const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 64) : null;
    // Idempotency: if we've seen this clientId before for this account, return
    // the existing row instead of creating a duplicate. Offline queue retries
    // depend on this to keep the timeline clean.
    if (clientId) {
      const existing = await storage.getFieldPunchByClientId(req.account.id, clientId);
      if (existing) return res.status(200).json({ punch: existing, deduped: true });
    }
    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const accuracyM = req.body?.accuracyM != null ? Number(req.body.accuracyM) : null;
    const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;
    const occurredAt = req.body?.occurredAt ? String(req.body.occurredAt) : new Date().toISOString();
    const punch = await storage.createFieldPunch({
      accountId: req.account.id,
      organizationId: req.organizationId ?? null,
      projectId,
      kind,
      occurredAt,
      lat: Number.isFinite(lat as number) ? (lat as number) : null,
      lng: Number.isFinite(lng as number) ? (lng as number) : null,
      accuracyM: Number.isFinite(accuracyM as number) ? (accuracyM as number) : null,
      note,
      clientId,
    });

    // Auto-timesheet linkage. We never block the punch response on this — if
    // the rollup fails we still recorded the punch, and the next successful
    // clock event will catch up. But under normal conditions we synchronously
    // ensure a draft timesheet for the current week and roll the day's total
    // in so the client can navigate straight to it.
    let timesheetId: number | null = null;
    let hoursToday: number | null = null;
    let totalHours: number | null = null;
    try {
      const weekStart = weekStartMonday(occurredAt);
      const project = await storage.getProject(projectId);
      const ts = await ensureTimesheetForWeek({
        accountId: req.account.id,
        organizationId: req.organizationId ?? null,
        projectId,
        employeeName: req.account.name || req.account.email || `Account ${req.account.id}`,
        weekStart,
      });
      timesheetId = ts.id;
      // Only roll up on "out" and "break_end" — those close a work interval so
      // there's real hours to sum. "in" just seeds the timesheet, and
      // "break_start" pauses accumulation (recomputed next time).
      if (kind === "out" || kind === "break_end" || kind === "break_start") {
        const rolled = await rollupPunchToTimesheet({
          accountId: req.account.id,
          timesheetId: ts.id,
          occurredAt,
          projectName: project?.name ?? null,
        });
        hoursToday = rolled.hoursToday;
        totalHours = rolled.totalHours;
      }
    } catch (err) {
      console.warn("[field/punches] auto-timesheet failed:", (err as Error)?.message ?? err);
    }
    // Timeline: emit clock-in / clock-out. Skip break_start / break_end —
    // those are secondary events that would spam the log without adding much.
    if (kind === "in" || kind === "out") {
      logEvent(req, {
        projectId,
        kind: kind === "in" ? EVENT_KINDS.TIMESHEET_CLOCKIN : EVENT_KINDS.TIMESHEET_CLOCKOUT,
        title: kind === "in" ? `Clocked in\u00a0on site` : `Clocked out`,
        subtitle: (Number.isFinite(lat as number) && Number.isFinite(lng as number))
          ? `${(lat as number).toFixed(4)}, ${(lng as number).toFixed(4)}`
          : undefined,
        sourceType: "field_punch",
        sourceId: punch.id,
        meta: {
          hoursToday,
          totalHours,
          note: note || undefined,
          accuracyM,
        },
        occurredAt,
      });
    }
    res.status(201).json({ punch, timesheetId, hoursToday, totalHours });
  });

  // Field observations — fast-capture safety/quality/rfi/issue entries from
  // the mobile foreman flow. Scoped to the org so anyone in the org can see
  // observations logged by teammates.
  app.get("/api/field/observations", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 25));
    const projectId = req.query?.projectId ? Number(req.query.projectId) : undefined;
    const rows = await storage.getRecentFieldObservations({
      organizationId: req.organizationId ?? undefined,
      projectId: Number.isFinite(projectId as number) ? (projectId as number) : undefined,
      limit,
    });
    res.json({ observations: rows });
  });

  app.post("/api/field/observations", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const kind = String(req.body?.kind || "");
    if (!/^(safety|quality|rfi|issue)$/.test(kind)) {
      return res.status(400).json({ error: "kind must be one of safety | quality | rfi | issue" });
    }
    const severity = String(req.body?.severity || "normal");
    if (!/^(low|normal|high|urgent)$/.test(severity)) {
      return res.status(400).json({ error: "severity must be one of low | normal | high | urgent" });
    }
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ error: "projectId required" });
    const title = req.body?.title ? String(req.body.title).slice(0, 200).trim() : "";
    if (!title) return res.status(400).json({ error: "title required" });
    const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 64) : null;
    if (clientId) {
      const existing = await storage.getFieldObservationByClientId(req.account.id, clientId);
      if (existing) return res.status(200).json({ observation: existing, deduped: true });
    }
    const body = req.body?.body ? String(req.body.body).slice(0, 2000) : null;
    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const accuracyM = req.body?.accuracyM != null ? Number(req.body.accuracyM) : null;
    const photoId = req.body?.photoId != null ? Number(req.body.photoId) : null;
    const occurredAt = req.body?.occurredAt ? String(req.body.occurredAt) : new Date().toISOString();
    const observation = await storage.createFieldObservation({
      accountId: req.account.id,
      organizationId: req.organizationId ?? null,
      projectId,
      kind,
      severity,
      title,
      body,
      lat: Number.isFinite(lat as number) ? (lat as number) : null,
      lng: Number.isFinite(lng as number) ? (lng as number) : null,
      accuracyM: Number.isFinite(accuracyM as number) ? (accuracyM as number) : null,
      photoId: Number.isFinite(photoId as number) ? (photoId as number) : null,
      occurredAt,
      clientId,
    });
    logEvent(req, {
      projectId,
      kind: EVENT_KINDS.OBSERVATION_LOGGED,
      title: `${kind.charAt(0).toUpperCase() + kind.slice(1)} observation \u2014 ${title}`,
      subtitle: body ? body.slice(0, 120) : undefined,
      sourceType: "field_observation",
      sourceId: observation.id,
      meta: { obsKind: kind, severity, photoId: observation.photoId ?? null },
      occurredAt,
    });

    res.status(201).json({ observation });
  });

  // Team
  app.get("/api/team", async (req: any, res) => res.json(await storage.getTeam(req.organizationId)));
  app.post("/api/team", async (req: any, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createTeamMember(withOrg(req, parsed.data)));
  });
  app.patch("/api/team/:id", async (req, res) => {
    const parsed = insertTeamSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateTeamMember(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Team member not found" });
    res.json(updated);
  });
  app.delete("/api/team/:id", async (req, res) => {
    await storage.softDeleteEntity("team-members", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // GET /api/weather/for-project/:id?date=YYYY-MM-DD
  //
  // Auto-fill helper for the Daily Log form. Looks up the project's address,
  // geocodes it (Google if $GOOGLE_MAPS_API_KEY is set, else Open-Meteo), then
  // fetches Open-Meteo weather for the requested date and maps it to the app's
  // seven daily-log slugs. Returns { weather, temp, meta } on success, 404 on
  // any failure (bad address, geocode miss, upstream API down) — the client
  // silently falls back to whatever the user typed.
  app.get("/api/weather/for-project/:id", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Bad project id" });
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return; // requireProjectAccess already sent 403/404
    if (!project.address || !project.address.trim()) {
      return res.status(404).json({ message: "Project has no address to look up weather for." });
    }
    // Optional ?date=YYYY-MM-DD. Server validates format in getDailyLogWeather.
    const dateStr = typeof req.query.date === "string" ? req.query.date : undefined;
    const result = await getDailyLogWeather(project.address, dateStr);
    if (!result) {
      return res.status(404).json({ message: "Weather lookup failed. You can still enter conditions manually." });
    }
    // Cache-friendly — clients that fetch on every keystroke will hit the CDN.
    // 15 minutes is short enough that current-day conditions stay fresh, but
    // long enough to survive form re-renders / focus events.
    res.set("Cache-Control", "private, max-age=900");
    res.json(result);
  });

  // GET /api/places/autocomplete?q=...&session=UUID&country=US
  //
  // Server-side proxy for Google Places Autocomplete. Keeps GOOGLE_MAPS_API_KEY
  // off the client, and can be swapped out for OpenStreetMap/etc. later without
  // any UI changes. Returns [] when the key isn't configured so the client just
  // silently degrades to plain text input.
  app.get("/api/places/autocomplete", async (req: any, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const session = typeof req.query.session === "string" ? req.query.session : "";
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    if (!hasPlacesApi()) return res.json({ suggestions: [], available: false });
    if (!q.trim() || !session) return res.json({ suggestions: [], available: true });
    const suggestions = await placesAutocomplete(q, session, { countryBias: country });
    res.set("Cache-Control", "private, max-age=30"); // tiny cache smooths rapid typing
    res.json({ suggestions, available: true });
  });

  // GET /api/places/details?placeId=...&session=UUID
  //
  // Called when the user picks a suggestion; returns the canonical formatted
  // address. Server enforces that a sessionToken is supplied so we keep the
  // billing session-scoped instead of paying per keystroke.
  app.get("/api/places/details", async (req: any, res) => {
    const placeId = typeof req.query.placeId === "string" ? req.query.placeId : "";
    const session = typeof req.query.session === "string" ? req.query.session : "";
    if (!hasPlacesApi()) return res.status(404).json({ message: "Places API not configured" });
    if (!placeId || !session) return res.status(400).json({ message: "placeId and session required" });
    const details = await placeDetails(placeId, session);
    if (!details) return res.status(404).json({ message: "Place not found" });
    res.json(details);
  });

  // Projects
  app.get("/api/projects", async (req: any, res) => res.json(await storage.getProjects(req.organizationId)));
  app.get("/api/projects/:id", async (req: any, res) => {
    const project = await requireProjectAccess(req, res, parseInt(req.params.id, 10));
    if (!project) return; // response already sent
    res.json(project);
  });

  // -------------------------------------------------------------------------
  // Project Timeline — unified event log per project.
  //
  // GET /api/projects/:id/events
  //   ?q=<search text>          match against title / subtitle / actorName
  //   &kinds=rfi.created,punch.closed   comma-separated kind filter
  //   &limit=<n>                page size (max 500, default 100)
  //   &before=<ISO ts>          cursor for next page (older than this)
  //
  // The client uses this as its infinite-scroll source. Kind counts also
  // returned so the filter chips can badge unread counts without a second call.
  // -------------------------------------------------------------------------
  app.get("/api/projects/:id/events", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return;
    const rawKinds = typeof req.query.kinds === "string" ? req.query.kinds : "";
    const kinds = rawKinds ? rawKinds.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
    const events = await storage.getProjectEvents(projectId, {
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      kinds,
      limit: req.query.limit ? Math.min(parseInt(String(req.query.limit), 10) || 100, 500) : 100,
      before: typeof req.query.before === "string" ? req.query.before : undefined,
    });
    const counts = await storage.getProjectEventKindCounts(projectId);
    res.json({ events, counts });
  });
  app.post("/api/projects", async (req: any, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createProject(withOrg(req, parsed.data));
    // Every new project starts with a mobilization plan: 15-section checklist,
    // the standard permits, and the NTP-to-earthwork milestone timeline.
    // Best-effort — a seeding failure must not fail the project create.
    try {
      await storage.seedMobilization(created.id, created.startDate);
    } catch (e) {
      console.error("[mobilization] seed failed for project", created.id, e);
    }
    logEvent(req, {
      projectId: created.id,
      kind: EVENT_KINDS.PROJECT_CREATED,
      title: `Project created \u2014 ${created.name}`,
      sourceType: "project",
      sourceId: created.id,
      meta: { status: created.status, address: created.address ?? null },
    });
    res.status(201).json(created);
  });
  app.patch("/api/projects/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    const existing = await requireProjectAccess(req, res, id);
    if (!existing) return;
    const updated = await storage.updateProject(id, req.body);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  });

  // Tasks
  app.get("/api/tasks", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getTasks(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/tasks", async (req: any, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createTask(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.TASK_CREATED,
      title: `Task created \u2014 ${created.title}`,
      sourceType: "task",
      sourceId: created.id,
      meta: { status: created.status, priority: created.priority ?? null, assigneeId: created.assigneeId ?? null },
    });
    res.status(201).json(created);
  });
  app.patch("/api/tasks/:id/status", async (req: any, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateTaskStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    if (/^(done|complete|completed|closed)$/i.test(status)) {
      logEvent(req, {
        projectId: updated.projectId,
        kind: EVENT_KINDS.TASK_COMPLETED,
        title: `Task completed \u2014 ${updated.title}`,
        sourceType: "task",
        sourceId: updated.id,
        meta: { status },
      });
    }
    res.json(updated);
  });

  // RFIs
  app.get("/api/rfis", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getRfis(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/rfis", async (req: any, res) => {
    const parsed = insertRfiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createRfi(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.RFI_CREATED,
      title: `${created.number} submitted \u2014 ${created.subject}`,
      sourceType: "rfi",
      sourceId: created.id,
      meta: { number: created.number, status: created.status },
    });
    res.status(201).json(created);
  });
  app.patch("/api/rfis/:id/status", async (req: any, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateRfiStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "RFI not found" });
    // Only emit "resolved" on terminal states — Closed/Answered/Resolved.
    if (/^(closed|resolved|answered|complete|completed)$/i.test(status)) {
      logEvent(req, {
        projectId: updated.projectId,
        kind: EVENT_KINDS.RFI_RESOLVED,
        title: `${updated.number} resolved \u2014 ${updated.subject}`,
        sourceType: "rfi",
        sourceId: updated.id,
        meta: { number: updated.number, status },
      });
    }
    res.json(updated);
  });


  // Submittals
  app.get("/api/submittals", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getSubmittals(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/submittals", async (req, res) => {
    const parsed = insertSubmittalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createSubmittal(parsed.data));
  });
  app.patch("/api/submittals/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateSubmittalStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Submittal not found" });
    res.json(updated);
  });


  // Change orders
  app.get("/api/change-orders", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getChangeOrders(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/change-orders", async (req: any, res) => {
    const parsed = insertChangeOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createChangeOrder(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.CHANGE_ORDER_CREATED,
      title: `${created.number} requested \u2014 ${created.title}`,
      sourceType: "change_order",
      sourceId: created.id,
      meta: { number: created.number, amount: created.amount ?? null, status: created.status },
    });
    res.status(201).json(created);
  });
  app.patch("/api/change-orders/:id/status", async (req: any, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateChangeOrderStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Change order not found" });
    if (/^(approved|accepted|executed)$/i.test(status)) {
      logEvent(req, {
        projectId: updated.projectId,
        kind: EVENT_KINDS.CHANGE_ORDER_APPROVED,
        title: `${updated.number} approved`,
        sourceType: "change_order",
        sourceId: updated.id,
        meta: { number: updated.number, amount: updated.amount ?? null, status },
      });
    }
    res.json(updated);
  });


  // Action items
  app.get("/api/action-items", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getActionItems(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/action-items", async (req, res) => {
    const parsed = insertActionItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createActionItem(parsed.data));
  });
  app.patch("/api/action-items/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateActionItemStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Action item not found" });
    res.json(updated);
  });


  // Daily logs
  app.get("/api/daily-logs", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getDailyLogs(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/daily-logs", async (req: any, res) => {
    const parsed = insertDailyLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createDailyLog(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.DAILY_LOG_SUBMITTED,
      title: `Daily log submitted \u2014 ${created.date}`,
      sourceType: "daily_log",
      sourceId: created.id,
      meta: { date: created.date, weather: created.weather ?? null, temp: created.temp ?? null, crewCount: created.crewCount ?? null },
      occurredAt: created.date ? new Date(created.date).toISOString() : undefined,
    });
    res.status(201).json(created);
  });
  app.patch("/api/daily-logs/:id", async (req, res) => {
    const parsed = insertDailyLogSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateDailyLog(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Daily log not found" });
    res.json(updated);
  });
  app.delete("/api/daily-logs/:id", async (req, res) => {
    await storage.softDeleteEntity("daily-logs", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Punch
  app.get("/api/punch", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getPunchItems(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/punch", async (req: any, res) => {
    const parsed = insertPunchItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createPunchItem(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.PUNCH_CREATED,
      title: `Punch item added \u2014 ${created.title}`,
      subtitle: created.location ?? undefined,
      sourceType: "punch",
      sourceId: created.id,
      meta: { trade: created.trade, status: created.status },
    });
    res.status(201).json(created);
  });

  // Field-flow punch create — lighter contract with offline-queue idempotency.
  // Uses an in-memory clientId map keyed by (accountId, clientId) for simple
  // dedupe. Because punch_items don't have an org column, we also filter the
  // dedupe lookup by looking at the last N minutes of that account's punch
  // creates. Kept short-lived because punch items themselves are rare from
  // the field.
  const fieldPunchItemIdemp = new Map<string, { id: number; ts: number }>();
  const IDEMP_TTL_MS = 60 * 60 * 1000; // 1h
  app.post("/api/field/punch-items", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ error: "projectId required" });
    const title = req.body?.title ? String(req.body.title).slice(0, 200).trim() : "";
    if (!title) return res.status(400).json({ error: "title required" });
    const location = req.body?.location ? String(req.body.location).slice(0, 200) : "";
    const trade = req.body?.trade ? String(req.body.trade).slice(0, 80) : "General";
    const status = req.body?.status ? String(req.body.status).slice(0, 40) : "Open";
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 4000).trim() || undefined : undefined;
    const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 64) : null;

    // Dedupe: prune expired entries then check.
    const now = Date.now();
    fieldPunchItemIdemp.forEach((v, k) => {
      if (now - v.ts > IDEMP_TTL_MS) fieldPunchItemIdemp.delete(k);
    });
    const idempKey = clientId ? `${req.account.id}:${clientId}` : null;
    if (idempKey) {
      const existing = fieldPunchItemIdemp.get(idempKey);
      if (existing) {
        const rows = await storage.getPunchItems(projectId);
        const found = rows.find((r) => r.id === existing.id);
        if (found) return res.status(200).json({ punchItem: found, deduped: true });
      }
    }

    const created = await storage.createPunchItem({
      projectId,
      title,
      location,
      trade,
      status,
      notes,
      assigneeId: req.body?.assigneeId != null ? Number(req.body.assigneeId) : undefined,
    });
    if (idempKey) fieldPunchItemIdemp.set(idempKey, { id: created.id, ts: now });
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.PUNCH_CREATED,
      title: `Punch item added \u2014 ${created.title}`,
      subtitle: created.location ?? undefined,
      sourceType: "punch",
      sourceId: created.id,
      meta: { trade: created.trade, status: created.status, source: "field" },
    });
    res.status(201).json({ punchItem: created });
  });
  app.patch("/api/punch/:id/status", async (req: any, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updatePunchStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Punch item not found" });
    if (/^(closed|complete|completed|resolved|done)$/i.test(status)) {
      logEvent(req, {
        projectId: updated.projectId,
        kind: EVENT_KINDS.PUNCH_CLOSED,
        title: `Punch item closed \u2014 ${updated.title}`,
        subtitle: updated.location ?? undefined,
        sourceType: "punch",
        sourceId: updated.id,
        meta: { trade: updated.trade, status },
      });
    }
    res.json(updated);
  });


  // Contacts
  app.get("/api/contacts", async (req: any, res) => res.json(await storage.getContacts(req.organizationId)));
  app.post("/api/contacts", async (req: any, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createContact(withOrg(req, parsed.data)));
  });
  app.patch("/api/contacts/:id", async (req, res) => {
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateContact(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Contact not found" });
    res.json(updated);
  });
  app.delete("/api/contacts/:id", async (req, res) => {
    await storage.softDeleteEntity("contacts", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Equipment
  app.get("/api/equipment", async (req: any, res) => res.json(await storage.getEquipment(pid(req), req.organizationId)));
  app.post("/api/equipment", async (req: any, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createEquipment(withOrg(req, parsed.data));
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.EQUIPMENT_ADDED,
      title: `Equipment added \u2014 ${created.name}`,
      sourceType: "equipment",
      sourceId: created.id,
      meta: { type: created.type, status: created.status },
    });
    res.status(201).json(created);
  });
  app.patch("/api/equipment/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    const parsed = insertEquipmentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateEquipment(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Equipment not found." });
    res.json(updated);
  });
  app.delete("/api/equipment/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    await storage.deleteEquipment(id);
    res.status(204).end();
  });

  // Maintenance log endpoints
  app.get("/api/equipment/:id/maintenance", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    res.json(await storage.getMaintenanceLogs(id));
  });
  app.post("/api/equipment/:id/maintenance", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    const parsed = insertMaintenanceLogSchema.safeParse({ ...req.body, equipmentId: id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const loggedById = req.account?.id ?? null;
    const created = await storage.addMaintenanceLog({ ...parsed.data, loggedById });
    // If a mileage was recorded, roll the equipment's current mileage forward.
    if (parsed.data.mileage != null) {
      const existing = await storage.getEquipmentById(id);
      if (existing && (existing.currentMileage == null || parsed.data.mileage > existing.currentMileage)) {
        await storage.updateEquipment(id, { currentMileage: parsed.data.mileage });
      }
    }
    res.status(201).json(created);
  });
  app.delete("/api/maintenance/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    await storage.deleteMaintenanceLog(id);
    res.status(204).end();
  });

  // Photos
  app.get("/api/photos", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getPhotos(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/photos", async (req: any, res) => {
    const parsed = insertPhotoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createPhoto(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.PHOTO_UPLOADED,
      title: `Photo uploaded${created.caption ? " \u2014 " + created.caption : ""}`,
      subtitle: created.location ?? undefined,
      sourceType: "photo",
      sourceId: created.id,
      meta: { date: created.date ?? null },
    });
    res.status(201).json(created);
  });

  // JSON photo upload — used by the mobile foreman flow and the offline
  // queue. Accepts a base64-encoded image + metadata in a single JSON body so
  // the offline queue (which serializes JSON to IndexedDB) can persist and
  // replay it without needing FormData support. Same 25mb JSON limit applies.
  app.post("/api/photos/upload-base64", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ error: "projectId required" });
    const dataUrl = String(req.body?.image || "");
    // data:image/jpeg;base64,AAAA...
    const m = /^data:([-\w.+]+\/[-\w.+]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "image must be a data URL (data:image/*;base64,...)" });
    const mime = m[1].toLowerCase();
    if (!IMAGE_MIME.has(mime)) return res.status(400).json({ error: "unsupported image type" });
    let buf: Buffer;
    try { buf = Buffer.from(m[2], "base64"); } catch { return res.status(400).json({ error: "invalid base64" }); }
    if (buf.length === 0) return res.status(400).json({ error: "empty image" });
    if (buf.length > 20 * 1024 * 1024) return res.status(413).json({ error: "image too large (20mb cap)" });

    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "bin";
    const filename = `field-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    try { fs.mkdirSync(PHOTO_DIR, { recursive: true }); } catch {}
    const abs = path.resolve(PHOTO_DIR, filename);
    fs.writeFileSync(abs, buf);

    // Compose the location string from optional lat/lng + free-form label.
    // Kept short so it fits the existing photos list card.
    const lat = req.body?.lat != null ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null ? Number(req.body.lng) : null;
    const labelBits: string[] = [];
    if (req.body?.locationLabel) labelBits.push(String(req.body.locationLabel).slice(0, 80));
    if (Number.isFinite(lat as number) && Number.isFinite(lng as number)) {
      labelBits.push(`${(lat as number).toFixed(4)}, ${(lng as number).toFixed(4)}`);
    }
    const location = labelBits.join(" \u00b7 ");

    const caption = req.body?.caption ? String(req.body.caption).slice(0, 240) : `Field photo ${new Date().toLocaleString()}`;
    const date = req.body?.date ? String(req.body.date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const hue = Math.floor(Math.random() * 360);

    const created = await storage.createPhoto({
      projectId,
      caption,
      location,
      takenById: req.account?.id ?? undefined,
      date,
      hue,
      storedFileName: filename,
      originalFileName: filename,
      mimeType: mime,
      fileSizeBytes: buf.length,
    });
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.PHOTO_UPLOADED,
      title: `Photo uploaded${created.caption ? " \u2014 " + created.caption : ""}`,
      subtitle: created.location ?? undefined,
      sourceType: "photo",
      sourceId: created.id,
      meta: { date: created.date ?? null, source: "field", lat, lng },
    });
    res.status(201).json(created);
  });

  // Photo file upload (multipart: metadata + image in one request)
  app.post("/api/photos/upload", photoUpload.single("file"), async (req: any, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const takenById = req.body.takenById ? parseInt(req.body.takenById, 10) : undefined;
    const caption = req.body.caption ? String(req.body.caption) : file.originalname;
    const location = req.body.location ? String(req.body.location) : "";
    const date = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = await storage.createPhoto({
      projectId,
      caption,
      location,
      takenById: Number.isFinite(takenById) ? takenById : undefined,
      date,
      hue,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.PHOTO_UPLOADED,
      title: `Photo uploaded${created.caption ? " \u2014 " + created.caption : ""}`,
      subtitle: created.location ?? undefined,
      sourceType: "photo",
      sourceId: created.id,
      meta: { date: created.date ?? null, filename: file.originalname },
    });
    res.status(201).json(created);
  });

  // Stream a photo's source image (inline)
  app.get("/api/photos/:id/file", async (req, res) => {
    hydrateSeedPhotos();
    const photo = await storage.getPhoto(parseInt(req.params.id, 10));
    if (!photo) return res.status(404).json({ message: "Photo not found." });
    if (!photo.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = path.resolve(PHOTO_DIR, photo.storedFileName);
    if (!abs.startsWith(PHOTO_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", photo.mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${photo.originalFileName || photo.storedFileName}"`);
    fs.createReadStream(abs).pipe(res);
  });

  // Delete a photo and its uploaded file
  app.delete("/api/photos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("photos", id);
    res.status(204).end();
  });

  // Documents
  app.get("/api/documents", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getDocuments(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/documents", async (req: any, res) => {
    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createDocument(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.DOC_UPLOADED,
      title: `Document uploaded \u2014 ${created.name}`,
      sourceType: "document",
      sourceId: created.id,
      meta: { type: created.type, size: created.size },
    });
    res.status(201).json(created);
  });

  // Document file upload (multipart: metadata + file in one request)
  app.post("/api/documents/upload", upload.single("file"), async (req: any, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : undefined;
    const name = req.body.name ? String(req.body.name) : file.originalname;
    const type = req.body.type ? String(req.body.type) : "Drawing";
    const date = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
    const created = await storage.createDocument({
      projectId,
      name,
      type,
      size: req.body.size ? String(req.body.size) : (file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`),
      uploadedById,
      date,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.DOC_UPLOADED,
      title: `Document uploaded \u2014 ${created.name}`,
      sourceType: "document",
      sourceId: created.id,
      meta: { type: created.type, size: created.size, filename: file.originalname },
    });
    res.status(201).json(created);
  });

  // Stream a document's source file (inline so PDFs/images render in-browser)
  app.get("/api/documents/:id/file", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id, 10));
    if (!doc) return res.status(404).json({ message: "Document not found." });
    if (!doc.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = path.resolve(UPLOAD_DIR, doc.storedFileName);
    if (!abs.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalFileName || doc.storedFileName}"`);
    fs.createReadStream(abs).pipe(res);
  });

  // Delete a document and its uploaded file
  app.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("documents", id);
    res.status(204).end();
  });

  // ---- Company Documents (DocuSign workflow) ----
  const companyUploadDir = process.env.NODE_ENV === "production"
    ? "/tmp/uploads/company-documents"
    : path.resolve(process.cwd(), "uploads/company-documents");
  const companyUpload = multer({ storage: multer.diskStorage({
    destination: (req, _file, cb) => { fs.mkdirSync(companyUploadDir, { recursive: true }); cb(null, companyUploadDir); },
    filename: (_req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`); },
  }) });

  app.get("/api/company-documents", async (req: any, res) => res.json(await storage.getCompanyDocuments(req.organizationId)));

  app.post("/api/company-documents", async (req: any, res) => {
    const parsed = insertCompanyDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createCompanyDocument(withOrg(req, parsed.data)));
  });

  app.post("/api/company-documents/upload", companyUpload.single("file"), async (req, res) => {
    const file = req.file;
    const body = req.body;
    const title = body.title ? String(body.title) : file ? file.originalname : "Untitled";
    const category = body.category ? String(body.category) : "Other";
    const signatureRequired = body.signatureRequired === "true" || body.signatureRequired === true;
    const signerName = body.signerName ? String(body.signerName) : null;
    const signerEmail = body.signerEmail ? String(body.signerEmail) : null;
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    const notes = body.notes ? String(body.notes) : null;
    const uploadedById = body.uploadedById ? parseInt(body.uploadedById, 10) : undefined;
    const signatureStatus = signatureRequired ? "Needs Signature" : "Not Required";
    const created = await storage.createCompanyDocument({
      title, category, status: "Active", signatureRequired, signatureStatus,
      signerName, signerEmail, dueDate, notes, uploadedById,
      date: new Date().toISOString().slice(0, 10),
      storedFileName: file?.filename ?? null,
      originalFileName: file?.originalname ?? null,
      mimeType: file?.mimetype ?? null,
      fileSizeBytes: file?.size ?? null,
    });
    res.status(201).json(created);
  });

  app.patch("/api/company-documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const parsed = insertCompanyDocumentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateCompanyDocument(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Company document not found." });
    res.json(updated);
  });

  app.get("/api/company-documents/:id/file", async (req, res) => {
    const doc = await storage.getCompanyDocument(parseInt(req.params.id, 10));
    if (!doc) return res.status(404).json({ message: "Company document not found." });
    if (!doc.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = path.resolve(companyUploadDir, doc.storedFileName);
    if (!abs.startsWith(companyUploadDir + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalFileName || doc.storedFileName}"`);
    fs.createReadStream(abs).pipe(res);
  });

  app.delete("/api/company-documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("company-documents", id);
    res.status(204).end();
  });

  // Blueprints
  app.get("/api/blueprints", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getBlueprints(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/blueprints", async (req: any, res) => {
    const parsed = insertBlueprintSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createBlueprint(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.BLUEPRINT_UPLOADED,
      title: `Blueprint uploaded \u2014 ${created.title}`,
      sourceType: "blueprint",
      sourceId: created.id,
      meta: { discipline: created.discipline, revision: created.revision, sheetNumber: created.sheetNumber },
    });
    res.status(201).json(created);
  });

  // Drone captures
  app.get("/api/drone-captures", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getDroneCaptures(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/drone-captures", async (req: any, res) => {
    const parsed = insertDroneCaptureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createDroneCapture(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.DRONE_CAPTURED,
      title: `Drone capture \u2014 ${created.title}`,
      sourceType: "drone_capture",
      sourceId: created.id,
      meta: { captureType: created.captureType, status: created.status, area: created.area },
    });
    res.status(201).json(created);
  });

  // Milestones
  app.get("/api/milestones", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getMilestones(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/milestones", async (req: any, res) => {
    const parsed = insertMilestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createMilestone(parsed.data);
    if (/^complete/i.test(created.status ?? "")) {
      logEvent(req, {
        projectId: created.projectId,
        kind: EVENT_KINDS.MILESTONE_REACHED,
        title: `Milestone reached \u2014 ${created.title}`,
        sourceType: "milestone",
        sourceId: created.id,
        meta: { kind: created.kind, date: created.date, status: created.status },
      });
    }
    res.status(201).json(created);
  });
  app.patch("/api/milestones/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await storage.updateMilestone(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "not found" });
    if (/^complete/i.test(String(req.body?.status ?? ""))) {
      logEvent(req, {
        projectId: updated.projectId,
        kind: EVENT_KINDS.MILESTONE_REACHED,
        title: `Milestone reached \u2014 ${updated.title}`,
        sourceType: "milestone",
        sourceId: updated.id,
        meta: { kind: updated.kind, date: updated.date, status: updated.status },
      });
    }
    res.json(updated);
  });
  app.delete("/api/milestones/:id", async (req, res) => {
    await storage.softDeleteEntity("milestones", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  /* ========================= Mobilization (Executive OS) =========================
   * Every route is nested under /api/projects/:id/mobilization so access is
   * gated by requireProjectAccess — there is no org-wide mobilization list
   * except the portfolio rollup at the bottom, which derives its project set
   * from the caller's org.
   */

  // Rolls a project's mobilization state into the numbers both the health
  // endpoint and the portfolio cards render. Kept in one place so a project
  // can never show a different % or colour in two views.
  async function mobilizationRollup(projectId: number) {
    const [plan, items, permits, equipmentRows, utilities, staff, subs, risks, allMilestones] = await Promise.all([
      storage.getMobilizationPlan(projectId),
      storage.getMobilizationItems(projectId),
      storage.getMobilizationPermits(projectId),
      storage.getMobilizationEquipment(projectId),
      storage.getMobilizationUtilities(projectId),
      storage.getMobilizationStaff(projectId),
      storage.getMobilizationSubs(projectId),
      storage.getMobilizationRisks(projectId),
      storage.getMilestones(projectId),
    ]);
    const mobMilestones = allMilestones.filter((m) => m.kind === MOBILIZATION_MILESTONE_KIND);

    // "na" items drop out of the denominator — marking something not-applicable
    // should raise the percentage, not permanently cap it.
    const countable = items.filter((i) => i.status !== "na");
    const doneCount = countable.filter((i) => i.status === "done").length;
    const overallPct = pct(doneCount, countable.length);

    const sectionPct: Record<string, number> = {};
    for (const section of MOBILIZATION_SECTIONS) {
      const inSection = countable.filter((i) => i.section === section);
      sectionPct[section] = pct(inSection.filter((i) => i.status === "done").length, inSection.length);
    }

    const approved = permits.filter((p) => p.status === "Approved").length;
    const notStarted = permits.filter((p) => p.status === "Not Started").length;
    const blocked = permits.filter((p) => p.status === "Rejected" || p.status === "Expired").length;
    const permitStatus = { approved, pending: permits.length - approved - notStarted - blocked, notStarted, blocked, total: permits.length };

    const earthwork = mobMilestones.find((m) => m.title === EARTHWORK_MILESTONE_TITLE);
    const milestoneDaysToEarthwork = daysUntil(earthwork?.date);

    return {
      seeded: !!plan,
      plan, items, permits, equipment: equipmentRows, utilities, staff, subs, risks,
      milestones: mobMilestones,
      overallPct,
      sectionPct,
      permitStatus,
      equipmentOnSitePct: pct(equipmentRows.filter((e) => e.onSiteConfirmed).length, equipmentRows.length),
      utilitiesInstalledPct: pct(utilities.filter((u) => !!u.installedDate).length, utilities.length),
      staffOnboardedPct: pct(staff.filter((s) => s.orientationDone && s.drugTestDone && s.ppeIssued).length, staff.length),
      subsReadyPct: pct(subs.filter((s) => s.insuranceOnFile && s.w9OnFile && s.msaSigned).length, subs.length),
      risksOpen: risks.filter((r) => r.status === "open").length,
      milestoneDaysToEarthwork,
      health: computeHealth({ overallPct, hasBlockedPermit: blocked > 0, daysToEarthwork: milestoneDaysToEarthwork }),
    };
  }

  // Full plan bundle for the detail page — one request feeds all eight tabs.
  app.get("/api/projects/:id/mobilization", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const r = await mobilizationRollup(projectId);
    res.json({
      plan: r.plan ?? null, items: r.items, permits: r.permits, equipment: r.equipment,
      utilities: r.utilities, staff: r.staff, subs: r.subs, risks: r.risks,
      milestones: r.milestones, seeded: r.seeded,
    });
  });

  app.get("/api/projects/:id/mobilization/health", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const r = await mobilizationRollup(projectId);
    res.json({
      overallPct: r.overallPct, sectionPct: r.sectionPct, permitStatus: r.permitStatus,
      equipmentOnSitePct: r.equipmentOnSitePct, utilitiesInstalledPct: r.utilitiesInstalledPct,
      staffOnboardedPct: r.staffOnboardedPct, subsReadyPct: r.subsReadyPct,
      risksOpen: r.risksOpen, milestoneDaysToEarthwork: r.milestoneDaysToEarthwork,
      health: r.health, seeded: r.seeded,
    });
  });

  // Seed on demand — lets a project created before this module shipped get its
  // checklist without a backfill migration. No-ops when a plan already exists.
  app.post("/api/projects/:id/mobilization/seed", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return;
    await storage.seedMobilization(projectId, project.startDate);
    res.status(201).json({ ok: true });
  });

  /**
   * The six trackers (plus items) are structurally identical: list is served by
   * the bundle route above, and each supports create / patch / delete scoped to
   * the parent project. Registering them from one table keeps the six resources
   * from drifting apart as fields get added. `onUpdate` is the hook for the two
   * resources that emit Project Timeline events on a state transition.
   */
  const MOBILIZATION_RESOURCES: {
    path: string;
    schema: { safeParse: (v: unknown) => any };
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    remove: (id: number) => Promise<void>;
    onUpdate?: (req: any, row: any, patch: any) => void;
  }[] = [
    {
      path: "items", schema: insertMobilizationItemSchema,
      create: storage.createMobilizationItem.bind(storage),
      update: storage.updateMobilizationItem.bind(storage),
      remove: storage.deleteMobilizationItem.bind(storage),
      onUpdate: (req, row, patch) => {
        if (patch.status !== "done") return;
        logEvent(req, {
          projectId: row.projectId,
          kind: EVENT_KINDS.MOBILIZATION_ITEM_COMPLETED,
          title: `Mobilization — ${row.title}`,
          subtitle: row.section,
          sourceType: "mobilization_item",
          sourceId: row.id,
          meta: { section: row.section },
        });
      },
    },
    {
      path: "permits", schema: insertMobilizationPermitSchema,
      create: storage.createMobilizationPermit.bind(storage),
      update: storage.updateMobilizationPermit.bind(storage),
      remove: storage.deleteMobilizationPermit.bind(storage),
      onUpdate: (req, row, patch) => {
        if (patch.status !== "Approved") return;
        logEvent(req, {
          projectId: row.projectId,
          kind: EVENT_KINDS.MOBILIZATION_PERMIT_APPROVED,
          title: `Permit approved — ${row.name}`,
          subtitle: row.agency ?? null,
          sourceType: "mobilization_permit",
          sourceId: row.id,
          meta: { permitNumber: row.permitNumber, agency: row.agency },
        });
      },
    },
    {
      path: "equipment", schema: insertMobilizationEquipmentSchema,
      create: storage.createMobilizationEquipment.bind(storage),
      update: storage.updateMobilizationEquipment.bind(storage),
      remove: storage.deleteMobilizationEquipment.bind(storage),
    },
    {
      path: "utilities", schema: insertMobilizationUtilitySchema,
      create: storage.createMobilizationUtility.bind(storage),
      update: storage.updateMobilizationUtility.bind(storage),
      remove: storage.deleteMobilizationUtility.bind(storage),
    },
    {
      path: "staff", schema: insertMobilizationStaffSchema,
      create: storage.createMobilizationStaff.bind(storage),
      update: storage.updateMobilizationStaff.bind(storage),
      remove: storage.deleteMobilizationStaff.bind(storage),
    },
    {
      path: "subs", schema: insertMobilizationSubSchema,
      create: storage.createMobilizationSub.bind(storage),
      update: storage.updateMobilizationSub.bind(storage),
      remove: storage.deleteMobilizationSub.bind(storage),
    },
    {
      path: "risks", schema: insertMobilizationRiskSchema,
      create: storage.createMobilizationRisk.bind(storage),
      update: storage.updateMobilizationRisk.bind(storage),
      remove: storage.deleteMobilizationRisk.bind(storage),
    },
  ];

  for (const resource of MOBILIZATION_RESOURCES) {
    app.post(`/api/projects/:id/mobilization/${resource.path}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      // projectId always comes from the URL — a body value would let a caller
      // write into a project they can't see.
      const parsed = resource.schema.safeParse({ ...(req.body ?? {}), projectId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
      const created = await resource.create(parsed.data as any);
      res.status(201).json(created);
    });

    app.patch(`/api/projects/:id/mobilization/${resource.path}/:rowId`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const rowId = parseInt(req.params.rowId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(rowId)) return res.status(400).json({ message: "Invalid id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const { projectId: _ignored, id: _id, ...patch } = req.body ?? {};
      const updated = await resource.update(rowId, patch);
      if (!updated || updated.projectId !== projectId) return res.status(404).json({ message: "Not found" });
      resource.onUpdate?.(req, updated, patch);
      res.json(updated);
    });

    app.delete(`/api/projects/:id/mobilization/${resource.path}/:rowId`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const rowId = parseInt(req.params.rowId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(rowId)) return res.status(400).json({ message: "Invalid id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      await resource.remove(rowId);
      res.status(204).end();
    });
  }

  // Portfolio rollup across every project the caller can see.
  app.get("/api/executive-os/mobilization", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      ? await storage.getProjects()
      : await storage.getProjects(req.organizationId ?? undefined);
    const rows = await Promise.all(orgProjects.map(async (p: Project) => {
      const r = await mobilizationRollup(p.id);
      return {
        projectId: p.id,
        projectName: p.name,
        seeded: r.seeded,
        overallPct: r.overallPct,
        health: r.health,
        daysToEarthwork: r.milestoneDaysToEarthwork,
        permitStatus: r.permitStatus,
        risksOpen: r.risksOpen,
      };
    }));
    res.json(rows);
  });

  // Drone capture file upload (multipart: metadata + image in one request)
  app.post("/api/drone-captures/upload", droneUpload.single("file"), async (req: any, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const title = req.body.title ? String(req.body.title) : file.originalname;
    const captureType = req.body.captureType ? String(req.body.captureType) : "Orthomosaic";
    const status = req.body.status ? String(req.body.status) : "Processed";
    const pilot = req.body.pilot ? String(req.body.pilot) : null;
    const flightDate = req.body.flightDate ? String(req.body.flightDate) : new Date().toISOString().slice(0, 10);
    const altitude = req.body.altitude ? String(req.body.altitude) : null;
    const area = req.body.area ? String(req.body.area) : null;
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = await storage.createDroneCapture({
      projectId,
      title,
      captureType,
      status,
      pilot,
      flightDate,
      altitude,
      area,
      hue,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    });
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.DRONE_CAPTURED,
      title: `Drone capture \u2014 ${created.title}`,
      sourceType: "drone_capture",
      sourceId: created.id,
      meta: { captureType: created.captureType, area: created.area, filename: file.originalname },
    });
    res.status(201).json(created);
  });

  // Stream a drone capture's source image (inline)
  app.get("/api/drone-captures/:id/file", async (req, res) => {
    const cap = await storage.getDroneCapture(parseInt(req.params.id, 10));
    if (!cap) return res.status(404).json({ message: "Capture not found." });
    if (!cap.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = path.resolve(DRONE_DIR, cap.storedFileName);
    if (!abs.startsWith(DRONE_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", cap.mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${cap.originalFileName || cap.storedFileName}"`);
    fs.createReadStream(abs).pipe(res);
  });

  // Delete a drone capture and its uploaded file
  app.delete("/api/drone-captures/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("drone-captures", id);
    res.status(204).end();
  });

  // Messages
  app.get("/api/messages/:projectId", async (req, res) => {
    res.json(await storage.getMessages(parseInt(req.params.projectId, 10)));
  });
  app.post("/api/messages", async (req: any, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createMessage(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.MESSAGE_POSTED,
      title: `Message posted`,
      subtitle: created.body ? created.body.slice(0, 120) : undefined,
      sourceType: "message",
      sourceId: created.id,
    });
    res.status(201).json(created);
  });

  // Notes (sticky)
  app.get("/api/notes", scopeProjectQuery, async (req: any, res) => {
    const rows = await storage.getNotes(pid(req));
    res.json(filterByOrgProjects(req, rows));
  });
  app.post("/api/notes", async (req: any, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createNote(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.NOTE_ADDED,
      title: `Note added`,
      subtitle: created.body ? created.body.slice(0, 120) : undefined,
      sourceType: "note",
      sourceId: created.id,
    });
    res.status(201).json(created);
  });
  app.patch("/api/notes/:id", async (req, res) => {
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return res.status(400).json({ message: "x,y required" });
    const updated = await storage.updateNotePosition(parseInt(req.params.id, 10), x, y);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  });
  app.delete("/api/notes/:id", async (req, res) => {
    await storage.softDeleteEntity("notes", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Append a reply to a sticky note. Replies are stored inline on the note
  // itself (as a JSON array) so the note reads like a running mini-conversation.
  // Signature is derived from the current account so users can't spoof authors.
  app.post("/api/notes/:id/replies", async (req: any, res) => {
    try {
      if (!req.account?.id) return res.status(401).json({ message: "Unauthenticated" });
      const id = parseInt(req.params.id, 10);
      const body = String(req.body?.body ?? "").trim();
      if (!body) return res.status(400).json({ message: "Reply body required" });
      if (body.length > 500) return res.status(400).json({ message: "Reply too long (500 char max)" });
      const existing = await storage.getNoteById(id);
      if (!existing) return res.status(404).json({ message: "Note not found" });
      const displayName = String(req.account.displayName ?? req.account.email ?? "Someone");
      const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s: string) => s[0]?.toUpperCase() ?? "")
        .join("") || displayName.slice(0, 2).toUpperCase();
      let arr: any[] = [];
      try {
        arr = existing.replies ? JSON.parse(existing.replies) : [];
        if (!Array.isArray(arr)) arr = [];
      } catch {
        arr = [];
      }
      arr.push({
        author: displayName,
        initials,
        body,
        at: new Date().toISOString(),
      });
      const updated = await storage.updateNote(id, { replies: JSON.stringify(arr) });
      res.json(updated);
    } catch (err) {
      console.error("[notes] reply error:", err);
      res.status(500).json({ message: "Failed to add reply" });
    }
  });

  // INTEGRATIONS — connect/disconnect third-party services
  app.get("/api/integrations", async (_req, res) => {
    res.json(await storage.getIntegrations());
  });
  app.patch("/api/integrations/:key", async (req, res) => {
    const key = req.params.key;
    const connected = req.body?.connected === true;
    const config = typeof req.body?.config === "string" ? req.body.config : undefined;
    res.json(await storage.setIntegration(key, connected, config));
  });
  app.post("/api/integrations/:key/connect", async (req, res) => {
    const key = req.params.key;
    const accountLabel = typeof req.body?.accountLabel === "string" ? req.body.accountLabel.trim() : undefined;
    const config = typeof req.body?.config === "string" ? req.body.config : undefined;
    res.json(await storage.connectIntegration(key, { accountLabel, config }));
  });
  app.post("/api/integrations/:key/disconnect", async (req, res) => {
    const key = req.params.key;
    res.json(await storage.disconnectIntegration(key));
  });
  app.post("/api/integrations/:key/test", async (_req, res) => {
    // For now, all integrations return success on test.
    // Real provider-specific tests would check API credentials here.
    res.json({ ok: true, message: "Connection verified" });
  });

  // ============================ STRIPE ROUTES ============================
  // Stripe webhook — must come BEFORE auth middleware (raw body, no session)
  app.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe || !webhookSecret) return res.status(503).json({ error: "Stripe not configured" });
    const sig = req.headers["stripe-signature"] as string;
    let event;
    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
    } catch (e: any) {
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
    try {
      // Helper: resolve the org for this Stripe event. Prefers metadata.organizationId,
      // falls back to lookup by customer id. Also mirrors updates to any legacy
      // account.stripeCustomerId (best-effort) so old UI still shows correct status.
      const orgFromEvent = async (obj: any): Promise<{ orgId: number | null; customerId: string | null }> => {
        const customerId = (obj?.customer as string) || null;
        const metaOrg = obj?.metadata?.organizationId || obj?.subscription_details?.metadata?.organizationId;
        let orgId: number | null = metaOrg ? parseInt(String(metaOrg), 10) : null;
        if (!orgId && customerId) {
          const org = await getOrgByStripeCustomerId(customerId);
          if (org) orgId = org.id;
        }
        return { orgId: orgId ?? null, customerId };
      };

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const { orgId, customerId } = await orgFromEvent(session);
          if (orgId) {
            await updateOrgBilling(orgId, {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: (session.subscription as string) || undefined,
              subscriptionStatus: "trialing", // real status arrives on subscription.updated
            });
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const sub = event.data.object;
          const { orgId, customerId } = await orgFromEvent(sub);
          if (orgId) {
            // Derive plan/billing from the base price. Base prices have metadata.plan + metadata.kind='base'.
            let planTier: string | undefined;
            let billingKind: string | undefined;
            for (const it of sub.items?.data || []) {
              const md = it.price?.metadata || {};
              if (md.kind === "base") {
                planTier = md.plan;
                billingKind = md.interval || (it.price?.recurring?.interval === "year" ? "annual" : "monthly");
                break;
              }
            }
            await updateOrgBilling(orgId, {
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: sub.status,
              subscriptionCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : undefined,
              subscriptionPlan: planTier,
              subscriptionBilling: billingKind,
              trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : undefined,
              // True when the user scheduled a cancel from the portal. The sub
              // stays active until subscriptionCurrentPeriodEnd, then Stripe
              // fires subscription.deleted and we mark status=canceled.
              cancelAtPeriodEnd: !!sub.cancel_at_period_end,
            });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const { orgId } = await orgFromEvent(sub);
          if (orgId) {
            // Cancellation is final now - clear the pending flag so future
            // reactivations start from a clean slate.
            await updateOrgBilling(orgId, { subscriptionStatus: "canceled", cancelAtPeriodEnd: false });
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const { orgId } = await orgFromEvent(invoice);
          if (orgId) await updateOrgBilling(orgId, { subscriptionStatus: "past_due" });
          break;
        }
      }
      res.json({ received: true });
    } catch (e: any) {
      console.error("[stripe webhook] error:", e);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Create checkout session
  // DEPRECATED: this endpoint used stale STRIPE_PRICE_* env vars from an
  // earlier flat-price generation ($29/$49/$79) that no longer match the
  // current base+overage plans in server/lib/plans.ts ($79/$149/$299).
  // The only historical caller was the landing page's inline SubscribeForm,
  // which was rewritten to redirect to /signup#/signup?plan=X&billing=Y.
  // Kept as a hard-fail 410 so any cached client bookmark surfaces a real
  // error instead of silently charging the wrong amount.
  app.post("/api/billing/checkout", async (_req, res) => {
    res.status(410).json({
      error: "This checkout endpoint has been retired. Please sign up at /signup.",
      redirect: "/signup",
    });
  });

  // Customer portal — manage subscription (cancel, update payment, swap plan).
  // Only owners can access billing.
  app.post("/api/billing/portal", async (req: any, res) => {
    if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!req.organizationId) return res.status(400).json({ error: "No active organization" });
    // Only org owners can open the billing portal.
    if (req.membership?.role !== "owner" && req.account.role !== "owner") {
      return res.status(403).json({ error: "Only owners can manage billing" });
    }
    const org = await getOrganization(req.organizationId);
    if (!org?.stripeCustomerId) return res.status(400).json({ error: "No billing account found for this org" });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${APP_URL}/#/settings`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      console.error("[stripe portal] error:", e);
      res.status(500).json({ error: e?.message || "Failed to create portal session" });
    }
  });

  // Invoice history - returns the most recent Stripe invoices for the org.
  // Owner-only. Empty list is a valid response when the org has no invoices
  // yet (e.g. still in trial with no payment recorded).
  app.get("/api/billing/invoices", async (req: any, res) => {
    if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!req.organizationId) return res.status(400).json({ error: "No active organization" });
    if (req.membership?.role !== "owner" && req.account.role !== "owner") {
      return res.status(403).json({ error: "Only owners can view invoices" });
    }
    const org = await getOrganization(req.organizationId);
    if (!org?.stripeCustomerId) return res.json({ invoices: [] });
    try {
      const list = await stripe.invoices.list({ customer: org.stripeCustomerId, limit: 12 });
      const invoices = (list.data as any[]).map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status, // draft | open | paid | uncollectible | void
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
        periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        invoicePdf: inv.invoice_pdf ?? null,
      }));
      res.json({ invoices });
    } catch (e: any) {
      console.error("[stripe invoices] error:", e);
      res.status(500).json({ error: e?.message || "Failed to load invoices" });
    }
  });

  // Upcoming invoice preview - what Stripe will charge on the next cycle.
  // Uses Stripe's upcoming-invoice endpoint. Returns null when there is no
  // subscription (e.g. free trial that never converted).
  app.get("/api/billing/upcoming", async (req: any, res) => {
    if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!req.organizationId) return res.status(400).json({ error: "No active organization" });
    if (req.membership?.role !== "owner" && req.account.role !== "owner") {
      return res.status(403).json({ error: "Only owners can view upcoming charges" });
    }
    const org = await getOrganization(req.organizationId);
    if (!org?.stripeCustomerId || !org.stripeSubscriptionId) return res.json({ upcoming: null });
    try {
      // NOTE: stripe.invoices.retrieveUpcoming is deprecated in newer API
      // versions in favor of stripe.invoices.createPreview. We try the newer
      // API first and fall back to the legacy one so this works on both.
      let inv: any = null;
      try {
        inv = await stripe.invoices.createPreview({ customer: org.stripeCustomerId, subscription: org.stripeSubscriptionId });
      } catch {
        try {
          inv = await (stripe.invoices as any).retrieveUpcoming({ customer: org.stripeCustomerId, subscription: org.stripeSubscriptionId });
        } catch {
          inv = null;
        }
      }
      if (!inv) return res.json({ upcoming: null });
      res.json({
        upcoming: {
          amountDue: inv.amount_due,
          currency: inv.currency,
          periodStart: inv.period_start ? new Date(inv.period_start * 1000).toISOString() : null,
          periodEnd: inv.period_end ? new Date(inv.period_end * 1000).toISOString() : null,
          // Best-effort next-charge date. Stripe puts it on next_payment_attempt for
          // trialing subs; otherwise it's roughly period_end.
          nextPaymentAttempt: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000).toISOString() : null,
          lineCount: Array.isArray(inv.lines?.data) ? inv.lines.data.length : 0,
        },
      });
    } catch (e: any) {
      // A totally-fresh trial can 404 for upcoming - treat as "no preview yet".
      const msg = String(e?.message || "");
      if (msg.includes("upcoming")) return res.json({ upcoming: null });
      console.error("[stripe upcoming] error:", e);
      res.status(500).json({ error: msg || "Failed to load upcoming invoice" });
    }
  });

  // Billing status — now reports the caller's active organization's subscription
  // (multi-tenant billing lives on the org, not the account).
  app.get("/api/billing/status", async (req: any, res) => {
    if (!req.account) return res.status(401).json({ error: "Not authenticated" });
    if (!req.organizationId) {
      return res.json({ plan: null, status: null, billing: null, currentPeriodEnd: null, hasCustomer: false });
    }
    const org = await getOrganization(req.organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    const seats = await countActiveSeats(org.id);
    const plan = org.subscriptionPlan ? PLANS[org.subscriptionPlan as PlanTier] : null;
    res.json({
      plan: org.subscriptionPlan || null,
      status: org.subscriptionStatus || null,
      billing: org.subscriptionBilling || null,
      currentPeriodEnd: org.subscriptionCurrentPeriodEnd || null,
      trialEndsAt: org.trialEndsAt || null,
      cancelAtPeriodEnd: !!org.cancelAtPeriodEnd,
      hasCustomer: !!org.stripeCustomerId,
      seats: {
        active: seats,
        included: plan?.includedSeats ?? null,
        overage: plan ? Math.max(0, seats - plan.includedSeats) : null,
      },
    });
  });

  // DELETED ITEMS BIN
  app.get("/api/deleted-items", async (_req, res) => {
    res.json(await storage.getDeletedItems());
  });
  app.post("/api/deleted-items/:type/:id/restore", async (req, res) => {
    const { type, id } = req.params;
    try {
      const restored = await storage.restoreEntity(type, parseInt(id, 10));
      res.json(restored);
    } catch (e: any) {
      res.status(404).json({ message: e?.message ?? "Item not found in bin" });
    }
  });
  app.delete("/api/deleted-items/:type/:id/permanent", async (req, res) => {
    const { type, id } = req.params;
    await storage.permanentDeleteEntity(type, parseInt(id, 10));
    res.status(204).end();
  });
  app.delete("/api/deleted-items", async (_req, res) => {
    await storage.emptyDeletedItems();
    res.status(204).end();
  });

  // SUBSCRIBE — capture email + plan, notify owner by email
  app.post("/api/subscribe", async (req, res) => {
    const parsed = insertSubscriberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = await storage.createSubscriber(parsed.data);
    // Fire-and-forget email so a mailer outage never blocks a signup.
    void sendSignupNotification({
      kind: "subscriber",
      subject: `New TrussPath subscriber — ${parsed.data.email}`,
      fields: {
        Email: parsed.data.email,
        Plan: (parsed.data as any).plan,
        Source: (parsed.data as any).source,
        "Signed up": new Date().toISOString(),
      },
    });
    res.json(saved);
  });

  // DEMO REQUEST — capture demo request, notify owner by email
  app.post("/api/demo-request", async (req, res) => {
    const parsed = insertDemoRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = await storage.createDemoRequest(parsed.data);
    const d = parsed.data as any;
    void sendSignupNotification({
      kind: "demo-request",
      subject: `New TrussPath demo request — ${d.name ?? d.email}`,
      fields: {
        Name: d.name,
        Email: d.email,
        Company: d.company,
        Role: d.role,
        Phone: d.phone,
        "Project count": d.projectCount,
        Message: d.message,
        Source: d.source,
        "Requested": new Date().toISOString(),
      },
    });
    res.json(saved);
  });

  // ADMIN — list signups (used by /#/admin/signups). Owner only.
  app.get("/api/admin/signups", requireOwner, async (_req, res) => {
    res.json({
      subscribers: await storage.listSubscribers(),
      demoRequests: await storage.listDemoRequests(),
    });
  });

  // ADMIN — list all accounts with approval + subscription state. Owner only.
  app.get("/api/admin/accounts", requireOwner, async (_req, res) => {
    const rows = await storage.listAccountsForAdmin();
    res.json({ accounts: rows });
  });

  // ADMIN — approve / deny / reset an account. Owner only. Owners cannot demote themselves.
  app.post("/api/admin/accounts/:id/approval", requireOwner, async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid account id" });
    const status = String(req.body?.status || "").toLowerCase();
    if (status !== "pending" && status !== "approved" && status !== "denied") {
      return res.status(400).json({ message: "status must be pending, approved, or denied" });
    }
    if (id === req.account.id && status !== "approved") {
      return res.status(400).json({ message: "You can't remove your own access from here." });
    }
    const primaryOwnerId = getPrimaryOwnerId();
    if (primaryOwnerId && id === primaryOwnerId && req.account.id !== primaryOwnerId) {
      return res.status(403).json({ message: "You can't modify the primary owner account." });
    }
    const updated = await storage.setAccountApproval(id, status as any, req.account.id);
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json({ account: updated });
  });

  /* ------------------------- ADMIN: Demo logins (48h) ------------------------- */
  // Owner-only. Generates a fresh demo account + isolated demo org so a prospect
  // can log in and click around with full edit access. Auto-expires after 48h
  // (enforced in verifyPassword + authMiddleware; existing sessions are rejected).
  app.get("/api/admin/demo-accounts", requireOwner, async (_req, res) => {
    const rows = await storage.listDemoAccounts();
    res.json({ demoAccounts: rows });
  });

  app.post("/api/admin/demo-accounts", requireOwner, async (req: any, res) => {
    const label = (typeof req.body?.label === "string" && req.body.label.trim())
      ? String(req.body.label).trim().slice(0, 60)
      : "";

    // Human-friendly random email + password so the owner can hand them over verbally.
    // Not secret data — the account is time-boxed to 48h and isolated to its own org.
    const suffix = Math.random().toString(36).slice(2, 8);
    const email = `demo-${suffix}@trusspath.app`;
    const password = generateReadablePassword(16);
    const displayName = label || `Demo User ${suffix}`;
    const orgName = label ? `${label} (Demo)` : `TrussPath Demo ${suffix}`;
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    try {
      const account = await storage.createDemoAccount(email, password, displayName, expiresAt);
      const { organizationId } = await bootstrapDemoOrgForAccount({
        accountId: account.id,
        orgName,
      });

      // Seed a tiny demo project so the sandbox isn't empty on first login.
      // Kept minimal on purpose — the point is to click around, not audit real data.
      try {
        await storage.createProject({
          organizationId,
          name: "Demo: Warehouse Renovation",
          number: "DEMO-001",
          client: "Acme Distribution",
          type: "Renovation",
          status: "In Progress",
          address: "1234 Demo St, Denver, CO",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 90 * 86400 * 1000).toISOString().slice(0, 10),
          budget: 850000,
          spent: 275000,
          progress: 32,
        } as any);
      } catch (seedErr) {
        console.error("[demo] seed project failed (non-fatal):", seedErr);
      }

      res.status(201).json({
        account,
        organizationId,
        credentials: { email, password }, // shown once in the UI so owner can hand off
        expiresAt,
      });
    } catch (e: any) {
      const msg = e?.message || "Failed to create demo account";
      const status = /already/i.test(msg) ? 409 : 500;
      res.status(status).json({ message: msg });
    }
  });

  // Revoke a demo login immediately (sets expiry to the epoch). Owner-only.
  app.post("/api/admin/demo-accounts/:id/expire", requireOwner, async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid account id" });
    const updated = await storage.expireDemoAccount(id);
    if (!updated) return res.status(404).json({ message: "Demo account not found" });
    res.json({ account: updated });
  });

  // Purge demo accounts + their isolated demo orgs whose expiry is past the
  // grace period. Owner-only. Callable both manually from the admin panel and
  // opportunistically on server boot (see index.ts).
  app.post("/api/admin/demo-accounts/purge", requireOwner, async (req: any, res) => {
    const rawGrace = req.body?.graceDays;
    const graceDays = Number.isFinite(Number(rawGrace)) && Number(rawGrace) >= 0
      ? Math.min(365, Number(rawGrace))
      : 7;
    try {
      const result = await storage.purgeExpiredDemos(graceDays);
      res.json({ graceDays, ...result });
    } catch (err: any) {
      console.error("[demo-purge] failed:", err?.message ?? err);
      res.status(500).json({ message: "Purge failed", error: err?.message ?? String(err) });
    }
  });

  // JARVIS — AI assistant
  app.get("/api/jarvis/brief", async (req: any, res) => {
    try {
      // Try LLM-powered brief first; fall back to local if no API key or error.
      // Pass org id so the LLM path sees the same tz-aware "today" as the local path.
      try {
        const result = await jarvisBrief(pid(req), req.organizationId);
        res.json({ ...result, mode: "llm" });
      } catch (llmErr) {
        console.log("[jarvis] LLM brief failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        // Rich local brief — named items, real counts, weather, one specific rec.
        // Pass org id so greeting + "today" use the org's configured timezone.
        const brief = await buildRichLocalBrief(pid(req), req.organizationId);
        res.json({ brief, mode: "local" });
      }
    } catch (err) {
      console.error("[jarvis] brief error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app.post("/api/jarvis/chat", async (req: any, res) => {
    try {
      const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
      // Try LLM-powered chat first; fall back to local engine. Pass org id so
      // the LLM path sees the same tz-aware "today" as the local path.
      try {
        const result = await jarvisChat(pid(req), history, req.organizationId);
        res.json({ ...result, mode: "llm" });
      } catch (llmErr) {
        console.log("[jarvis] LLM chat failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        const result = await localJarvisChat(pid(req), history, req.organizationId);
        res.json({ ...result, mode: "local" });
      }
    } catch (err) {
      console.error("[jarvis] chat error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });

  // Jarvis safety brief — generates a team safety briefing with live weather + project data
  app.get("/api/jarvis/safety-brief", async (req, res) => {
    try {
      const brief = await buildSafetyBrief(pid(req));
      res.json({ brief });
    } catch (err) {
      console.error("[jarvis] safety brief error:", err);
      res.status(502).json({ message: "Could not generate safety brief." });
    }
  });

  /* ---------------------------- TIMESHEETS ---------------------------- */

  // List timesheets (optionally filtered by project, or scoped to the caller)
  app.get("/api/timesheets", async (req: any, res) => {
    try {
      // Fire the weekly rollover opportunistically — cheap early-exit inside.
      runWeeklyRolloverIfDue().catch(() => {});
      const scope = String(req.query?.scope || "");
      if (scope === "me") {
        if (!req.account?.id) return res.status(401).json({ message: "Unauthenticated" });
        const rows = await storage.getTimesheetsForAccount(req.account.id);
        return res.json(rows);
      }
      const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
      const rows = await storage.getTimesheets(projectId);
      res.json(rows);
    } catch (err) {
      console.error("[timesheets] list error:", err);
      res.status(500).json({ message: "Failed to list timesheets" });
    }
  });

  // Current-week timesheet for the caller. Auto-creates one on the fly if
  // the user has never clocked in this week — that way the /timesheets page
  // still has something to link to for salaried/manual entries.
  app.get("/api/timesheets/me/current", async (req: any, res) => {
    try {
      if (!req.account?.id) return res.status(401).json({ message: "Unauthenticated" });
      const weekStart = weekStartMonday(new Date().toISOString());
      let ts = await storage.getTimesheetByAccountWeek(req.account.id, weekStart);
      if (!ts) {
        // Find any project they belong to; fall back to 0 (org-wide) so the
        // row still exists. Downstream UI treats projectId=0 as "no project".
        const projects = await storage.getProjects();
        const project = projects[0];
        ts = await ensureTimesheetForWeek({
          accountId: req.account.id,
          organizationId: req.organizationId ?? null,
          projectId: project?.id ?? 0,
          employeeName: req.account.name || req.account.email || `Account ${req.account.id}`,
          weekStart,
        });
      }
      const entries = await storage.getTimeEntries(ts.id);
      res.json({ ...ts, entries });
    } catch (err) {
      console.error("[timesheets] me/current error:", err);
      res.status(500).json({ message: "Failed to load current timesheet" });
    }
  });

  // Employee signs & submits their weekly timesheet. Notifies the
  // project's superintendent (if one is set) via email so they can
  // countersign. Idempotent — re-submitting overwrites the signature.
  app.post("/api/timesheets/:id/submit-employee", async (req: any, res) => {
    try {
      if (!req.account?.id) return res.status(401).json({ message: "Unauthenticated" });
      const id = Number(req.params.id);
      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });
      if (ts.accountId && ts.accountId !== req.account.id) {
        return res.status(403).json({ message: "Not your timesheet" });
      }
      const signature = String(req.body?.signature || req.account.name || req.account.email || "Signed").slice(0, 200);
      const nowIso = new Date().toISOString();
      // Find manager linkage from the project so subsequent approval UI
      // knows who to route this to.
      const project = ts.projectId ? await storage.getProject(ts.projectId) : undefined;
      const manager = await findManagerForProject(project);
      const updated = await storage.updateTimesheet(id, {
        status: "pending-approval",
        employeeSignature: signature,
        employeeSubmittedAt: nowIso,
        managerName: manager?.name ?? null,
        managerEmail: manager?.email ?? null,
      });
      logEvent(req, {
        projectId: ts.projectId ?? undefined,
        kind: EVENT_KINDS.TIMESHEET_SUBMITTED,
        title: `Timesheet submitted \u2014 ${updated?.employeeName ?? "Employee"} (${updated?.weekStart} \u2192 ${updated?.weekEnd})`,
        sourceType: "timesheet",
        sourceId: id,
        meta: { weekStart: updated?.weekStart, weekEnd: updated?.weekEnd, totalHours: updated?.totalHours },
      });
      // Fire the manager notification email in the background; failure just
      // logs — the submit itself already succeeded and the manager can pick
      // it up from their /timesheets queue.
      if (manager?.email && process.env.RESEND_API_KEY) {
        (async () => {
          try {
            const linkBase = process.env.PUBLIC_BASE_URL || "https://www.trusspath.com";
            const resp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "TrussPath <noreply@trusspath.com>",
                to: manager.email,
                subject: `Timesheet awaiting your approval — ${updated?.employeeName ?? "Employee"} (${updated?.weekStart} → ${updated?.weekEnd})`,
                html: `<p>${updated?.employeeName ?? "An employee"} submitted their weekly timesheet for your countersignature.</p>
                       <p><strong>Week:</strong> ${updated?.weekStart} – ${updated?.weekEnd}<br/>
                          <strong>Hours:</strong> ${updated?.totalHours ?? 0}</p>
                       <p><a href="${linkBase}/timesheets?open=${id}">Review &amp; approve</a></p>`,
              }),
            });
            if (!resp.ok) console.warn("[timesheets] manager notify status", resp.status);
          } catch (e) {
            console.warn("[timesheets] manager notify failed:", (e as Error)?.message ?? e);
          }
        })();
      }
      res.json(updated);
    } catch (err) {
      console.error("[timesheets] submit-employee error:", err);
      res.status(500).json({ message: "Failed to submit timesheet" });
    }
  });

  // Manager countersigns — flips to "approved". Only the superintendent on
  // the linked project (or an org owner/admin) may approve.
  app.post("/api/timesheets/:id/approve-manager", async (req: any, res) => {
    try {
      if (!req.account?.id) return res.status(401).json({ message: "Unauthenticated" });
      const id = Number(req.params.id);
      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });
      // Access check: owners/admins always allowed; otherwise must match the
      // team member row referenced by projects.superintendentId.
      const isPrivileged = req.orgRole === "owner" || req.orgRole === "admin";
      if (!isPrivileged) {
        const project = ts.projectId ? await storage.getProject(ts.projectId) : undefined;
        const manager = await findManagerForProject(project);
        const matchByEmail = !!manager?.email && manager.email.toLowerCase() === (req.account.email ?? "").toLowerCase();
        if (!matchByEmail) return res.status(403).json({ message: "Only the assigned superintendent can approve" });
      }
      const signature = String(req.body?.signature || req.account.name || req.account.email || "Approved").slice(0, 200);
      const updated = await storage.updateTimesheet(id, {
        status: "approved",
        managerSignature: signature,
        managerApprovedAt: new Date().toISOString(),
      });
      logEvent(req, {
        projectId: ts.projectId ?? undefined,
        kind: EVENT_KINDS.TIMESHEET_APPROVED,
        title: `Timesheet approved \u2014 ${updated?.employeeName ?? "Employee"} (${updated?.weekStart} \u2192 ${updated?.weekEnd})`,
        sourceType: "timesheet",
        sourceId: id,
        meta: { weekStart: updated?.weekStart, weekEnd: updated?.weekEnd, totalHours: updated?.totalHours },
      });
      res.json(updated);
    } catch (err) {
      console.error("[timesheets] approve-manager error:", err);
      res.status(500).json({ message: "Failed to approve timesheet" });
    }
  });

  // Get single timesheet with its entries
  app.get("/api/timesheets/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });
      const entries = await storage.getTimeEntries(id);
      res.json({ ...ts, entries });
    } catch (err) {
      console.error("[timesheets] get error:", err);
      res.status(500).json({ message: "Failed to get timesheet" });
    }
  });

  // Create timesheet
  app.post("/api/timesheets", async (req, res) => {
    try {
      const ts = await storage.createTimesheet(req.body);
      res.status(201).json(ts);
    } catch (err) {
      console.error("[timesheets] create error:", err);
      res.status(500).json({ message: "Failed to create timesheet" });
    }
  });

  // Update timesheet (status, signatures, total, notes)
  app.patch("/api/timesheets/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);

      // Gate manager signature on the timesheet having been sent to a Project
      // Executive first. Without a sentAt timestamp, no manager approval can be
      // recorded — this prevents self-approval and enforces the review flow.
      if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "managerSignature") && req.body.managerSignature) {
        const existing = await storage.getTimesheet(id);
        if (!existing) return res.status(404).json({ message: "Timesheet not found" });
        if (!existing.sentAt) {
          return res.status(400).json({
            message: "Timesheet must be sent to a Project Executive before a manager signature can be recorded.",
            code: "MANAGER_SIGNATURE_REQUIRES_SEND",
          });
        }
      }

      const updated = await storage.updateTimesheet(id, req.body);
      if (!updated) return res.status(404).json({ message: "Timesheet not found" });
      res.json(updated);
    } catch (err) {
      console.error("[timesheets] update error:", err);
      res.status(500).json({ message: "Failed to update timesheet" });
    }
  });

  // Replace all time entries for a timesheet (bulk save)
  app.put("/api/timesheets/:id/entries", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const entries = Array.isArray(req.body) ? req.body : [];
      await storage.replaceTimeEntries(id, entries);
      // Recalculate total
      const total = entries.reduce((sum: number, e: any) => sum + (parseFloat(e.hoursWorked) || 0), 0);
      const updated = await storage.updateTimesheet(id, { totalHours: total.toFixed(2) });
      res.json({ ...updated, entries: await storage.getTimeEntries(id) });
    } catch (err) {
      console.error("[timesheets] entries replace error:", err);
      res.status(500).json({ message: "Failed to save time entries" });
    }
  });

  // Auto-save timesheet as a company document under employee name
  app.post("/api/timesheets/:id/save-to-docs", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });
      const entries = await storage.getTimeEntries(id);

      // Build a plain-text representation of the timesheet
      const weekInfo = `${ts.weekStart} to ${ts.weekEnd}`;
      const lines: string[] = [
        `TIMESHEET`,
        `Employee: ${ts.employeeName}`,
        `Week: ${weekInfo}`,
        `Total Hours: ${ts.totalHours}`,
        `Status: ${ts.status}`,
        ``,
        `Day | Date | Client | Project | Hours | Activities`,
        `--- | --- | --- | --- | --- | ---`,
      ];
      for (const e of entries) {
        lines.push(`${e.dayOfWeek} | ${e.entryDate} | ${e.clientName ?? ""} | ${e.projectName ?? ""} | ${e.hoursWorked} | ${e.activities ?? ""}`);
      }
      if (ts.employeeSignature) lines.push(``, `Employee Signature: ${ts.employeeSignature}`);
      if (ts.managerSignature) lines.push(`Manager Signature: ${ts.managerSignature}`);
      const content = lines.join("\n");

      // Check if a company doc already exists for this timesheet
      const existingDocs = await storage.getCompanyDocuments();
      const existing = existingDocs.find((d) => d.title === `Timesheet — ${ts.employeeName} — Week of ${ts.weekStart}`);

      const docData = {
        title: `Timesheet — ${ts.employeeName} — Week of ${ts.weekStart}`,
        category: "HR",
        status: "Active",
        signatureRequired: false,
        signatureStatus: ts.employeeSignature ? "Signed" : "Not Required",
        signerName: ts.employeeName,
        signerEmail: null,
        dueDate: null,
        notes: content,
        uploadedById: null,
        date: new Date().toISOString().slice(0, 10),
        storedFileName: null,
        originalFileName: null,
        mimeType: null,
        fileSizeBytes: null,
      };

      if (existing) {
        const updated = await storage.updateCompanyDocument(existing.id, { notes: content, date: new Date().toISOString().slice(0, 10) });
        res.json({ documentId: existing.id, updated: true, document: updated });
      } else {
        const created = await storage.createCompanyDocument(docData);
        res.status(201).json({ documentId: created.id, updated: false, document: created });
      }
    } catch (err) {
      console.error("[timesheets] save-to-docs error:", err);
      res.status(500).json({ message: "Failed to save timesheet to company documents" });
    }
  });

  // Send timesheet via email (saves to docs + sends email if RESEND_API_KEY is set)
  //
  // The recipient MUST be a team member whose access_level = "project_executive".
  // On success we stamp sentAt / sentTo on the timesheet, which unlocks the
  // manager-signature gate in PATCH above.
  app.post("/api/timesheets/:id/send", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "Email is required" });

      // Validate recipient is a Project Executive on this team.
      const team = await storage.getTeam();
      const recipient = team.find((t) => (t.email ?? "").toLowerCase() === String(email).toLowerCase());
      if (!recipient) {
        return res.status(400).json({
          message: "Recipient is not on your team. Timesheets can only be sent to a Project Executive listed in your team roster.",
          code: "RECIPIENT_NOT_FOUND",
        });
      }
      if (recipient.accessLevel !== "project_executive") {
        return res.status(400).json({
          message: `${recipient.name} is not a Project Executive. Only Project Executives can approve timesheets.`,
          code: "RECIPIENT_NOT_PROJECT_EXECUTIVE",
        });
      }

      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });
      const entries = await storage.getTimeEntries(id);

      // Build email body
      const weekInfo = `${ts.weekStart} to ${ts.weekEnd}`;
      const rows = entries.map((e: any) =>
        `${e.dayOfWeek} | ${e.entryDate} | ${e.clientName ?? "-"} | ${e.projectName ?? "-"} | ${e.hoursWorked}h | ${e.activities ?? "-"}`
      ).join("\n");
      const emailBody = [
        `TIMESHEET`,
        `Employee: ${ts.employeeName}`,
        `Week: ${weekInfo}`,
        `Total Hours: ${ts.totalHours}`,
        `Status: ${ts.status}`,
        ``,
        `Day | Date | Client | Project | Hours | Activities`,
        `${rows}`,
        ``,
        ts.employeeSignature ? `Employee Signature: ${ts.employeeSignature}` : ``,
        ts.managerSignature ? `Manager Signature: ${ts.managerSignature}` : ``,
      ].filter(Boolean).join("\n");

      // Send email if RESEND_API_KEY is available
      if (process.env.RESEND_API_KEY) {
        try {
          const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "TrussPath <noreply@trusspath.com>",
              to: email,
              subject: `Timesheet — ${ts.employeeName} — Week of ${ts.weekStart}`,
              text: emailBody,
            }),
          });
          if (!resp.ok) {
            console.error("[timesheets] email send failed:", await resp.text());
          }
        } catch (emailErr) {
          console.error("[timesheets] email error:", emailErr);
        }
      }

      // Stamp the timesheet so the manager-signature gate opens.
      const stamped = await storage.updateTimesheet(id, {
        sentAt: new Date().toISOString(),
        sentTo: recipient.email ?? email,
      });

      res.json({
        sent: true,
        email,
        recipientName: recipient.name,
        timesheet: stamped,
        message: `Timesheet saved to docs and sent to ${recipient.name}`,
      });
    } catch (err) {
      console.error("[timesheets] send error:", err);
      res.status(500).json({ message: "Failed to send timesheet" });
    }
  });

  // Delete timesheet
  app.delete("/api/timesheets/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteTimesheet(id);
      res.status(204).send();
    } catch (err) {
      console.error("[timesheets] delete error:", err);
      res.status(500).json({ message: "Failed to delete timesheet" });
    }
  });

  // SETTINGS — app preferences (persisted server-side; localStorage is blocked)
  app.get("/api/settings", async (_req, res) => {
    res.json(await storage.getSettings());
  });
  app.patch("/api/settings", async (req, res) => {
    const patch = req.body && typeof req.body === "object" ? req.body : {};
    res.json(await storage.updateSettings(patch));
  });

  // APP HEALTH SCAN — link + module integrity (deterministic, no AI)
  app.get("/api/jarvis/health-scan", async (_req, res) => {
    try { res.json(await runHealthScan()); }
    catch (err) { console.error("[health] scan error:", err); res.status(500).json({ message: "Health scan failed." }); }
  });

  // RESEED — gated destructive reset; requires { confirm: "RESET" }
  app.post("/api/reseed", async (req, res) => {
    if (req.body?.confirm !== "RESET") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'RESET' } to wipe and reseed demo data." });
    }
    await storage.resetAllData();
    res.json({ ok: true, reseededAt: new Date().toISOString() });
  });

  // WIPE — clears all project data WITHOUT re-seeding (clean slate)
  app.post("/api/wipe-data", async (req, res) => {
    if (req.body?.confirm !== "WIPE") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'WIPE' } to permanently delete all project data." });
    }
    await storage.wipeAllData();
    res.json({ ok: true, wipedAt: new Date().toISOString() });
  });

  /* ================================================================
   * MULTI-TENANT: ORG, MEMBERSHIP, INVITE ENDPOINTS
   *
   * All of these run after resolveMembership, so req.membership +
   * req.organizationId are already resolved for the current user.
   * ================================================================ */

  // GET /api/org/current — the caller's active org (with billing + seats).
  // Also returns the seat-price cents for the org's current plan + billing cycle so
  // clients can render "adding this member will cost $X/mo" warnings before invite.
  app.get("/api/org/current", async (req: any, res) => {
    if (!req.organizationId) return res.status(404).json({ message: "No active organization" });
    const org = await getOrganization(req.organizationId);
    if (!org) return res.status(404).json({ message: "Organization not found" });
    const seats = await countActiveSeats(org.id);
    const plan = org.subscriptionPlan ? PLANS[org.subscriptionPlan as PlanTier] : null;
    const billing = (org.subscriptionBilling === "annual" ? "annual" : "monthly") as Billing;
    // Also count pending, still-redeemable invites — they'll flip into active seats when
    // accepted, so clients should factor them into "how many seats after this action".
    const pending = await listPendingInvites(org.id);
    res.json({
      organization: org,
      membership: req.membership,
      seats: {
        active: seats,
        included: plan?.includedSeats ?? null,
        overage: plan ? Math.max(0, seats - plan.includedSeats) : null,
        pendingInvites: pending.length,
      },
      pricing: plan ? {
        tier: plan.tier,
        displayName: plan.displayName,
        billing,
        includedSeats: plan.includedSeats,
        seatAmountCents: plan[billing].seatAmount,
        baseAmountCents: plan[billing].baseAmount,
      } : null,
    });
  });

  // PATCH /api/org/current — update org-level settings (owners+admins).
  // Supported fields:
  //   - timezone: IANA tz string
  //   - disabledIntegrations: partial patch { key: boolean } merged into the
  //     org's JSONB; only keys in INTEGRATION_KEYS are accepted, unknown keys
  //     are silently dropped. `true` = turn OFF, `false` = clear (default-on).
  app.patch("/api/org/current", requireCap("manageMembers"), async (req: any, res) => {
    if (!req.organizationId) return res.status(404).json({ message: "No active organization" });
    const body = req.body || {};
    const patch: { timezone?: string; disabledIntegrations?: Record<string, boolean> } = {};
    if (typeof body.timezone === "string") {
      if (!isValidTimezone(body.timezone)) {
        return res.status(400).json({ message: "Invalid timezone. Use an IANA name like 'America/Denver'." });
      }
      patch.timezone = body.timezone;
    }
    if (body.disabledIntegrations && typeof body.disabledIntegrations === "object") {
      const clean: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(body.disabledIntegrations)) {
        if (isIntegrationKey(k) && typeof v === "boolean") clean[k] = v;
      }
      if (Object.keys(clean).length > 0) patch.disabledIntegrations = clean;
    }
    if (Object.keys(patch).length === 0) return res.status(400).json({ message: "No supported fields to update" });

    let updated = await getOrganization(req.organizationId);
    if (patch.timezone) updated = await updateOrgTimezone(req.organizationId, patch.timezone);
    if (patch.disabledIntegrations) updated = await updateOrgDisabledIntegrations(req.organizationId, patch.disabledIntegrations);
    if (!updated) return res.status(404).json({ message: "Organization not found" });
    res.json({ organization: updated });
  });

  // GET /api/org/members — list all members (owners+admins only).
  app.get("/api/org/members", requireCap("manageMembers"), async (req: any, res) => {
    const rows = await listMembershipsForOrg(req.organizationId);
    res.json({ members: rows });
  });

  // POST /api/org/members/:id/role — change a member's role (admins can't grant owner).
  app.post("/api/org/members/:id/role", requireCap("manageMembers"), async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    const newRole = req.body?.role as OrgRole;
    if (!newRole || !ORG_ROLES.includes(newRole)) return res.status(400).json({ message: "Invalid role" });

    const target = await getMembership(id);
    if (!target || target.organizationId !== req.organizationId) {
      return res.status(404).json({ message: "Member not found in this org" });
    }

    // Only owners can promote to owner or modify existing owners.
    if ((newRole === "owner" || target.role === "owner") && req.membership.role !== "owner") {
      return res.status(403).json({ message: "Only owners can change owner roles" });
    }
    // Prevent removing the primary owner (the account that created the org).
    if (target.role === "owner" && newRole !== "owner") {
      const org = await getOrganization(req.organizationId);
      if (org?.ownerAccountId === target.accountId) {
        return res.status(403).json({ message: "Cannot demote the primary owner" });
      }
    }

    const updated = await updateMembershipRole(id, newRole);
    res.json({ membership: updated });
  });

  // DELETE /api/org/members/:id — remove a member. Also decrements Stripe seat count.
  app.delete("/api/org/members/:id", requireCap("manageMembers"), async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    const target = await getMembership(id);
    if (!target || target.organizationId !== req.organizationId) {
      return res.status(404).json({ message: "Member not found in this org" });
    }
    if (target.role === "owner" && req.membership.role !== "owner") {
      return res.status(403).json({ message: "Only owners can remove other owners" });
    }
    const org = await getOrganization(req.organizationId);
    if (org?.ownerAccountId === target.accountId) {
      return res.status(403).json({ message: "Cannot remove the primary owner. Transfer ownership first." });
    }

    await removeMembership(id);
    // Fire-and-forget seat sync so the next invoice reflects the removed seat.
    if (stripe) syncSeatsForOrg(stripe, req.organizationId).catch(e => console.error("[members:delete] seat sync failed:", e));
    res.json({ ok: true });
  });

  // GET /api/org/invites — list pending invites.
  app.get("/api/org/invites", requireCap("manageMembers"), async (req: any, res) => {
    const rows = await listPendingInvites(req.organizationId);
    res.json({ invites: rows });
  });

  // POST /api/org/invites — create + email a new invite.
  app.post("/api/org/invites", requireCap("manageMembers"), async (req: any, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const role = String(req.body?.role || "pm") as OrgRole;
    if (!email || !/@/.test(email)) return res.status(400).json({ message: "Valid email required" });
    if (!ORG_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role" });
    // Non-owners cannot invite owners.
    if (role === "owner" && req.membership.role !== "owner") {
      return res.status(403).json({ message: "Only owners can invite other owners" });
    }
    // If this email already has a membership in this org, block.
    const existing = await storage.getAccountByEmail(email);
    if (existing) {
      const m = await getMembershipForAccount(existing.id, req.organizationId);
      if (m && m.status === "active") {
        return res.status(409).json({ message: "This user is already a member of your org" });
      }
    }

    const invite = await createInvite({
      organizationId: req.organizationId,
      email,
      role,
      invitedByAccountId: req.account.id,
    });

    // Fire-and-forget invite email.
    const org = await getOrganization(req.organizationId);
    const inviteUrl = `${APP_URL}/#/invite/${invite.token}`;
    void sendInviteEmail({
      toEmail: email,
      orgName: org?.name || "TrussPath",
      inviterName: req.account.displayName || req.account.email,
      role,
      inviteUrl,
    });

    res.status(201).json({ invite, inviteUrl });
  });

  // DELETE /api/org/invites/:id — revoke a pending invite.
  app.delete("/api/org/invites/:id", requireCap("manageMembers"), async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    // Only revoke invites in your org — look it up first.
    const rows = await listPendingInvites(req.organizationId);
    if (!rows.find(r => r.id === id)) {
      return res.status(404).json({ message: "Invite not found" });
    }
    await revokeInvite(id);
    res.json({ ok: true });
  });

  // GET /api/invites/:token — public: look up an invite for the acceptance page.
  // (This is auth-protected by the outer middleware; frontend fetches it after login
  // OR the user hits the signup page with the token pre-filled and skips this call.)
  app.get("/api/invites/:token", async (req: any, res) => {
    const invite = await getInviteByToken(req.params.token);
    if (!invite || !isInviteRedeemable(invite)) {
      return res.status(404).json({ message: "Invite not found or expired" });
    }
    const org = await getOrganization(invite.organizationId);
    res.json({
      email: invite.email,
      role: invite.role,
      orgName: org?.name || "TrussPath",
      expiresAt: invite.expiresAt,
    });
  });

  // POST /api/invites/:token/accept — already-logged-in user accepts an invite.
  // Their email must match. Adds a membership + syncs Stripe seats.
  app.post("/api/invites/:token/accept", async (req: any, res) => {
    if (!req.account) return res.status(401).json({ message: "Not authenticated" });
    const invite = await getInviteByToken(req.params.token);
    if (!invite || !isInviteRedeemable(invite)) {
      return res.status(400).json({ message: "Invite not found or expired" });
    }
    if (invite.email.toLowerCase() !== (req.account.email as string).toLowerCase()) {
      return res.status(403).json({ message: "Your email doesn't match the invite" });
    }
    const existing = await getMembershipForAccount(req.account.id, invite.organizationId);
    if (existing && existing.status === "active") {
      await markInviteAccepted(invite.id);
      return res.json({ ok: true, membership: existing });
    }
    const membership = await createMembership(req.account.id, invite.organizationId, invite.role as OrgRole);
    await markInviteAccepted(invite.id);
    if (stripe) syncSeatsForOrg(stripe, invite.organizationId).catch(e => console.error("[invite:accept] seat sync failed:", e));
    res.json({ ok: true, membership });
  });

  // Opportunistic demo-purge: at most once per hour per process. Kicked off
  // asynchronously so it never delays the first request. Grace is 7 days so
  // the admin panel still shows recently expired demos briefly. Failures are
  // swallowed - the manual endpoint above covers any real cleanup need.
  {
    let lastPurgeAt = 0;
    const runPurge = () => {
      const now = Date.now();
      if (now - lastPurgeAt < 60 * 60 * 1000) return;
      lastPurgeAt = now;
      storage.purgeExpiredDemos(7).then((r) => {
        if (r.purgedAccountIds.length) {
          console.log(`[demo-purge] auto-swept ${r.purgedAccountIds.length} account(s), ${r.purgedOrgIds.length} org(s)`);
        }
      }).catch((e) => {
        console.log("[demo-purge] auto-sweep skipped:", e?.message ?? e);
      });
    };
    // Kick off shortly after boot and then piggyback on demo-list requests.
    setTimeout(runPurge, 5_000).unref?.();
    app.use("/api/admin/demo-accounts", (_req, _res, next) => { runPurge(); next(); });
  }

  return _httpServer;
}
