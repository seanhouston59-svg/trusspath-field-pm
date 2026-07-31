import type { Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { storage, db } from "./storage";
import { getDailyLogWeather, placesAutocomplete, placeDetails, hasPlacesApi } from "./apis";
import { jarvisChat, jarvisBrief } from "./jarvis";
import { localJarvisChat, buildRichLocalBrief, buildSafetyBrief } from "./jarvis-local";
import { buildContext } from "./jarvis";
import { runHealthScan } from "./health";
import { sendSignupNotification, sendPasswordResetEmail, sendInviteEmail, sendSubDraftNotification, sendSubTaskCompleteNotification } from "./mailer";
import { weekStartMonday, ensureTimesheetForWeek, rollupPunchToTimesheet, runWeeklyRolloverIfDue, findManagerForProject } from "./timesheet-auto";
import {
  insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema,
  insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema,
  insertPunchItemSchema, insertContactSchema, insertEquipmentSchema, insertMaintenanceLogSchema,
  insertPhotoSchema, insertDocumentSchema, insertCompanyDocumentSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertMessageSchema, insertNoteSchema, insertMilestoneSchema,

  insertTeamSchema,
  insertMobilizationItemSchema, insertMobilizationPermitSchema, insertMobilizationEquipmentSchema,
  insertMobilizationUtilitySchema, insertMobilizationStaffSchema, insertMobilizationSubSchema,
  insertMobilizationRiskSchema, insertMobilizationSignatureSchema, insertMobilizationPlanSchema,
  insertProjectSetupSchema, insertProjectSetupStakeholderSchema, insertProjectSetupContractDocSchema,
  insertProjectSetupDeliverableSchema, insertProjectSetupSignatureSchema,
  insertPreConstructionSchema, insertPreConstructionDesignDocSchema, insertPreConstructionDesignRfiSchema,
  insertPreConstructionVeItemSchema, insertPreConstructionPermitSchema, insertPreConstructionPrequalSubSchema,
  insertPreConstructionBidPackageSchema, insertPreConstructionLongLeadItemSchema,
  insertPreConstructionSignatureSchema,
  insertLeanModuleStateSchema, insertLeanModuleItemSchema,
  insertContractSchema, insertInspectionSchema,
  insertSubscriberSchema, insertDemoRequestSchema,
  signupSchema, loginSchema,
  isAccountInGoodStanding, isSubscriptionActive, isDemoExpired,
  processedStripeEvents,
  ORG_ROLES, type OrgRole,
  type Project, type MobilizationSectionNote,
} from "@shared/schema";
import { EVENT_KINDS } from "@shared/project-event-kinds";
import { MOBILIZATION_SECTIONS } from "@shared/mobilization-catalog";
import { LIFECYCLE_MILESTONES, buildLifecycleMilestoneRows } from "@shared/lifecycle-milestones-catalog";
import { buildDashboardAlerts } from "./dashboard-alerts";
import { mobilizationRollup } from "./mobilization-rollup";
import { projectSetupRollup } from "./project-setup-rollup";
import { preConstructionRollup } from "./pre-construction-rollup";
import { computeMobilizationGate } from "@shared/lifecycle-gates";
import { isLeanModuleSlug } from "@shared/lean-modules-catalog";
import { generateMobilizationPlan } from "./reports/mobilization-plan";
import { generateProjectCharter } from "./reports/project-charter";
import { generateKickoffAgenda } from "./reports/kickoff-agenda";
import { ReportBuilder } from "./reports/engine";
import { buildFinancialsRollup } from "./financials-rollup";
import { generateBoardPacket } from "./reports/board-packet";
import {
  loadPreConstructionReportContext, PreConstructionNotInitializedError,
} from "./reports/data-loaders";
import { reportFilename, type PreConstructionReportContext } from "./reports/pre-construction-shared";
import { renderPreConstructionPlan, preConstructionPlanMeta } from "./reports/pre-construction-plan";
import { renderDesignReviewReport, designReviewReportMeta } from "./reports/design-review-report";
import { renderBuyoutPlan, buyoutPlanMeta } from "./reports/buyout-plan";
import {
  PLANS, TRIAL_DAYS, COMMAND_DECK_ADDON_AMOUNT_CENTS,
  type PlanTier, type Billing,
} from "./lib/plans";
import {
  bootstrapOrganizationForAccount, bootstrapDemoOrgForAccount,
  createInvite, getInviteByToken, listPendingInvites, markInviteAccepted, revokeInvite, isInviteRedeemable,
  createMembership, getMembership, getMembershipForAccount, listMembershipsForOrg, updateMembershipRole, removeMembership,
  syncSeatsForOrg,
  getOrganization, updateOrgBilling, getOrgByStripeCustomerId,
  updateOrgTimezone, isValidTimezone, updateOrgDisabledIntegrations, isIntegrationKey,
  countActiveSeats,
  countCommandDeckSeats, setMembershipCommandDeck, syncCommandDeckSeatsForOrg, revokeAllCommandDeckForOrg,
} from "./lib/orgs";
import { resolveMembership, requireCap, requireRole, requireCommandDeck } from "./lib/mt-middleware";
import { classifyUpload } from "./sub-drop-classifier";
import { SUB_TRADES, type SubTrade } from "@shared/schema";
import { randomBytes as randomBytesForToken } from "node:crypto";

function pid(req: any): number | undefined {
  return req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
}

// Postgres unique_violation (SQLSTATE 23505). Drizzle wraps driver errors, so
// the neon error carrying `code` can sit one level down in `cause`.
function isPgUniqueViolation(err: any): boolean {
  return err?.code === "23505" || err?.cause?.code === "23505";
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

// Section narratives are lazily created, so the read path returns the full
// canonical section list with empty placeholders for the ones never written.
// The client can then render every section without special-casing absence.
function fillSectionNotes(rows: MobilizationSectionNote[]) {
  const bySection = new Map(rows.map((r) => [r.section, r]));
  return MOBILIZATION_SECTIONS.map((section) => {
    const row = bySection.get(section);
    return row
      ? { section, narrative: row.narrative, updatedAt: row.updatedAt, updatedById: row.updatedById }
      : { section, narrative: "", updatedAt: null, updatedById: null };
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
// Public path prefixes for ANY method — used by the Sub Drop Portal, which has
// its own session token space (see resolveSubSession) and never touches GC
// state. Every /api/sub/* handler enforces its own auth internally.
const PUBLIC_API_ANY_METHOD_PREFIXES = [
  "/api/sub/",
  "/api/drop/",
];
function isPublicApi(path: string, method: string): boolean {
  if (PUBLIC_API.has(path)) return true;
  if (method === "GET" && PUBLIC_API_PREFIXES.some(p => path.startsWith(p))) return true;
  if (PUBLIC_API_ANY_METHOD_PREFIXES.some(p => path.startsWith(p))) return true;
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

// Attachments uploaded against a specific lean-module item row.
//
// Caveat: on Vercel `/tmp` is ephemeral per invocation, so attachments are
// scoped to that runtime lifetime. This matches the behavior of every other
// upload path in this codebase; the DB row persists but the file may be gone
// on the next cold start. Wiring a proper object store (S3, Vercel Blob)
// is a follow-up outside the scope of this feature.
const LEAN_ATTACHMENT_DIR = process.env.VERCEL
  ? "/tmp/uploads/lean-attachments"
  : path.resolve(process.cwd(), "uploads/lean-attachments");
try { fs.mkdirSync(LEAN_ATTACHMENT_DIR, { recursive: true }); } catch {}

const leanAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: LEAN_ATTACHMENT_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB, matches other uploads
  // Broad allow-list — PDFs, images, common office formats. Rejecting exotic
  // types up-front prevents storing executables.
  fileFilter: (_req, file, cb) => {
    const ok =
      ALLOWED_MIME.has(file.mimetype) ||
      file.mimetype.startsWith("application/vnd.openxmlformats-officedocument.") ||
      file.mimetype === "application/msword" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/vnd.ms-powerpoint" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "text/csv";
    if (ok) cb(null, true);
    else cb(new Error("Unsupported file type."));
  },
});

const DRONE_DIR = process.env.VERCEL
  ? "/tmp/uploads/drone"
  : path.resolve(process.cwd(), "uploads/drone");
try { fs.mkdirSync(DRONE_DIR, { recursive: true }); } catch {}

// Sub Drop Portal uploads — wider MIME allowlist than the GC document upload
// because subs commonly send construction docs (DWG, XLSX, DOCX, CSV) that
// PMs never upload directly. Same 25MB cap, same disk-storage pattern. On
// Vercel this lands in /tmp which is ephemeral — called out in the PR.
const SUB_DROP_DIR = process.env.VERCEL
  ? "/tmp/uploads/sub-drops"
  : path.resolve(process.cwd(), "uploads/sub-drops");
try { fs.mkdirSync(SUB_DROP_DIR, { recursive: true }); } catch {}

const SUB_DROP_MIME = new Set<string>([
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  // CAD (best-effort — browsers vary on what they report for .dwg)
  "application/acad",
  "application/x-dwg",
  "image/vnd.dwg",
  "application/octet-stream", // fallback for CAD; we still gate by extension below
]);
// Extension allowlist for octet-stream fallbacks so we don't accept truly
// arbitrary binary blobs when the browser sends application/octet-stream.
const SUB_DROP_OCTET_EXTS = new Set([".dwg", ".rvt", ".dxf", ".ifc"]);

const subDropUpload = multer({
  storage: multer.diskStorage({
    destination: SUB_DROP_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || "";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (SUB_DROP_MIME.has(file.mimetype)) {
      if (file.mimetype === "application/octet-stream") {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!SUB_DROP_OCTET_EXTS.has(ext)) {
          return cb(new Error("Unsupported file type."));
        }
      }
      return cb(null, true);
    }
    return cb(new Error("Unsupported file type. Try PDF, image, DWG, DOCX, or XLSX."));
  },
});

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

  // ========================================================================
  //  SUB DROP PORTAL — public / sub-authenticated routes.
  //  These MUST be declared BEFORE app.use(authMiddleware) so the GC auth
  //  cookie is not required. Each handler enforces its own auth via
  //  resolveSubSession where a signed-in sub is required.
  // ========================================================================

  // Cookie name for sub sessions. Deliberately distinct from SESSION_COOKIE
  // so the GC and sub cookies never collide and their scopes stay isolated.
  const SUB_SESSION_COOKIE = "tp_sub_session";

  // Helper: read the sub session token from cookie, Bearer, or ?token= just
  // like the GC pattern. The QR flow uses the cookie; the mobile PWA can use
  // Bearer if it prefers header-based auth.
  function readSubToken(req: any): string {
    const cookies = parseCookies(req.headers?.cookie);
    const bearer = (req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    const q = typeof req.query?.token === "string" ? req.query.token : "";
    return cookies[SUB_SESSION_COOKIE] || bearer || q || "";
  }

  // Middleware: resolve a sub session and put the sub company on req.subCompany.
  // Returns 401 if the cookie/token is absent or invalid. Used only on the
  // signed-in sub endpoints below — the /drop/:token/info lookup is truly
  // anonymous by design.
  async function resolveSubSession(req: any, res: any, next: any) {
    const token = readSubToken(req);
    const sub = await storage.resolveSubSession(token);
    if (!sub) return res.status(401).json({ message: "Sub session required." });
    req.subCompany = sub;
    next();
  }

  // Set the sub cookie on login/register. Same SameSite/Secure semantics as
  // the GC cookie helper; kept as a small local helper to avoid coupling the
  // sub flow to the GC session-cookie code.
  function setSubSessionCookie(res: any, token: string, expiresAt: string) {
    const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
    // 30-day sub session, mirroring the token TTL in SubCompaniesRepo.
    const expiresAttr = new Date(expiresAt).toUTCString();
    res.setHeader(
      "Set-Cookie",
      `${SUB_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; ${secure}HttpOnly; SameSite=None; Expires=${expiresAttr}`,
    );
  }
  function clearSubSessionCookie(res: any) {
    const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
    res.setHeader(
      "Set-Cookie",
      `${SUB_SESSION_COOKIE}=; Path=/; ${secure}HttpOnly; SameSite=None; Max-Age=0`,
    );
  }

  // ---- Anonymous drop-token preview -------------------------------------
  // Called from the /drop/:token client page BEFORE the sub logs in — gives
  // them the project name so they can confirm they scanned the right QR.
  // Never returns anything sensitive: just project name + org name.
  app.get("/api/drop/:token/info", async (req, res) => {
    const token = String(req.params.token || "");
    const dropToken = await storage.getDropTokenByToken(token);
    if (!dropToken) return res.status(404).json({ message: "Invalid or revoked link." });
    const project = await storage.getProject(dropToken.projectId);
    if (!project) return res.status(404).json({ message: "Project not found." });
    const org = await getOrganization(dropToken.organizationId);
    // We still return the info envelope on a closed job — the client uses it
    // to render a friendly "<project> is complete" page (which is much better
    // UX than a bare 404 or 410 on a QR scan).
    res.json({
      projectId: project.id,
      projectName: project.name,
      organizationName: org?.name || "TrussPath",
      closed: isProjectClosedToSubs(project),
    });
  });

  // ---- Sub-side project gate ---------------------------------------------
  // A project's Sub Drop portal is a first-class artifact of the job, so its
  // lifecycle tracks the project's own lifecycle:
  //
  //   • `planning` / `in_progress` — subs can register, log in, and upload.
  //   • `complete`                 — the job is done. Sub access is one-way
  //                                   revoked. This is enforced at request
  //                                   time (below) AND proactively at the
  //                                   moment of completion (see the PATCH
  //                                   /api/projects/:id handler, which
  //                                   revokes all outstanding drop tokens).
  //
  // The 410 Gone status is deliberate: it tells clients "the resource used
  // to exist and is intentionally gone", which is exactly this semantics.
  // Client code branches on this to render the friendly "Job is closed" page.
  function isProjectClosedToSubs(project: { status?: string | null } | null | undefined): boolean {
    if (!project) return true;
    return String(project.status || "").toLowerCase() === "complete";
  }
  function respondJobClosed(res: any, projectName?: string) {
    return res.status(410).json({
      code: "job_closed",
      message: projectName
        ? `${projectName} is complete. This drop portal is closed.`
        : "This job is complete. The drop portal is closed.",
    });
  }

  // ---- Sub registration --------------------------------------------------
  // Called from the /drop/:token page when a first-time sub picks "Register".
  // Creates a sub_companies row, attaches the sub to the token's project, and
  // issues a session cookie so the very next request can drop a file.
  app.post("/api/sub/register", async (req, res) => {
    try {
      const b = req.body || {};
      const token = String(b.dropToken || "").trim();
      const dropToken = token ? await storage.getDropTokenByToken(token) : null;
      if (!dropToken) return res.status(400).json({ message: "Invalid or revoked link." });

      // Refuse new registrations for completed jobs. Catches the edge case
      // where a sub scrapes a QR from a poster left up past completion.
      const gateProject = await storage.getProject(dropToken.projectId);
      if (isProjectClosedToSubs(gateProject)) return respondJobClosed(res, gateProject?.name);

      // Server-side validation. Kept strict here so the client can be relaxed.
      const companyName = String(b.companyName || "").trim();
      const trade = String(b.trade || "").trim() as SubTrade;
      const contactName = String(b.contactName || "").trim();
      const contactEmail = String(b.contactEmail || "").trim().toLowerCase();
      const contactPhone = b.contactPhone ? String(b.contactPhone).trim() : undefined;
      const password = String(b.password || "");
      if (!companyName) return res.status(400).json({ message: "Company name is required." });
      if (!SUB_TRADES.includes(trade as any)) {
        return res.status(400).json({ message: "Pick a trade from the list." });
      }
      if (!contactName) return res.status(400).json({ message: "Contact name is required." });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
        return res.status(400).json({ message: "A valid email is required." });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters." });
      }

      const sub = await storage.registerSubCompany({
        companyName, trade, contactName, contactEmail, contactPhone, password,
      });
      // Attach to the project immediately — the QR scan is what got them here.
      await storage.attachSubToProject({
        subCompanyId: sub.id,
        organizationId: dropToken.organizationId,
        projectId: dropToken.projectId,
        joinedViaDropTokenId: dropToken.id,
      });
      // Log them in.
      const session = await storage.loginSubCompany(contactEmail, password);
      if (!session) return res.status(500).json({ message: "Registration succeeded but session failed." });
      setSubSessionCookie(res, session.token, session.expiresAt);
      res.status(201).json({ subCompany: session.subCompany, token: session.token, projectId: dropToken.projectId });
    } catch (err: any) {
      const msg = err?.message || "Registration failed.";
      // 409 for the duplicate-email path so the client can pivot to "sign in instead".
      if (/already registered/i.test(msg)) return res.status(409).json({ message: msg });
      res.status(400).json({ message: msg });
    }
  });

  // ---- Sub login ---------------------------------------------------------
  // Called from the /drop/:token page when a returning sub picks "Sign in".
  // If a drop token is provided, also (idempotently) attach the sub to that
  // project so subsequent uploads are authorized on this jobsite too.
  app.post("/api/sub/login", async (req, res) => {
    const b = req.body || {};
    const email = String(b.contactEmail || "").trim().toLowerCase();
    const password = String(b.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    // Peek at the token's project BEFORE authenticating: if a sub scanned a
    // QR from a completed job, deny with the friendly "job closed" response
    // regardless of credentials (401 would just make them think they typed
    // the wrong password).
    const dropToken = b.dropToken ? await storage.getDropTokenByToken(String(b.dropToken)) : null;
    if (dropToken) {
      const gateProject = await storage.getProject(dropToken.projectId);
      if (isProjectClosedToSubs(gateProject)) return respondJobClosed(res, gateProject?.name);
    }
    const session = await storage.loginSubCompany(email, password);
    if (!session) return res.status(401).json({ message: "Wrong email or password." });
    // If they came in via a QR scan, attach to that project on this login.
    if (dropToken) {
      await storage.attachSubToProject({
        subCompanyId: session.subCompany.id,
        organizationId: dropToken.organizationId,
        projectId: dropToken.projectId,
        joinedViaDropTokenId: dropToken.id,
      });
    }
    setSubSessionCookie(res, session.token, session.expiresAt);
    res.json({
      subCompany: session.subCompany,
      token: session.token,
      projectId: dropToken?.projectId ?? null,
    });
  });

  app.post("/api/sub/logout", (_req, res) => {
    clearSubSessionCookie(res);
    res.status(204).end();
  });

  // ---- Sub forgot-password ----------------------------------------------
  // Kicks off a password reset for the sub identified by `contactEmail`.
  // ALWAYS responds 200 with the same body regardless of whether the email
  // maps to a real sub \u2014 no user enumeration. When Resend is configured,
  // fires an email with a 1-hour reset link. When it isn't, the reset URL is
  // logged to stdout so the flow is still testable in dev/preview.
  app.post("/api/sub/forgot-password", async (req, res) => {
    try {
      const email = String(req.body?.contactEmail || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        // Even for malformed emails we return the opaque success shape so a
        // scraper can't distinguish "invalid syntax" from "unknown email".
        return res.json({ ok: true });
      }
      const sub = await storage.getSubCompanyByEmail(email);
      if (sub) {
        const token = await storage.createSubPasswordResetToken(sub.id);
        // Origin resolution mirrors the GC forgot-password flow: prefer the
        // request's own origin so preview deployments send preview links.
        const origin = req.headers.origin
          || (req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : null)
          || `${req.protocol}://${req.get("host")}`;
        const resetUrl = `${origin}/#/sub-reset/${token}`;
        // Fire-and-forget: don't block the response on Resend latency and
        // don't leak send failures to the caller.
        sendPasswordResetEmail(sub.contactEmail, resetUrl).catch((e) =>
          console.error("[sub-forgot-password] mail send failed", e),
        );
      }
      res.json({ ok: true });
    } catch (err) {
      console.error("[sub-forgot-password]", err);
      // Same opaque success on failure so a database blip doesn't leak
      // "this email exists" via a 500. The user retrying is a no-op.
      res.json({ ok: true });
    }
  });

  // ---- Sub reset-password -----------------------------------------------
  // Consumes a one-time reset token and rewrites the sub's password hash.
  // Deliberately does NOT auto-sign-in \u2014 the sub returns to /drop or
  // /#/subs and logs in fresh with their new password (matches the GC flow
  // and keeps this route stateless).
  app.post("/api/sub/reset-password", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.password || "");
    if (!token) return res.status(400).json({ message: "Reset token is required." });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    const consumed = await storage.useSubPasswordResetToken(token);
    if (!consumed) return res.status(400).json({ message: "This reset link is invalid or has expired. Request a new one." });
    await storage.updateSubPassword(consumed.subCompanyId, newPassword);
    res.json({ ok: true });
  });

  // Return the current sub session (or 401) so the client can decide whether
  // to show the register/login form or jump straight to the upload UI.
  app.get("/api/sub/me", async (req: any, res) => {
    const token = readSubToken(req);
    const sub = await storage.resolveSubSession(token);
    if (!sub) return res.status(401).json({ message: "Not signed in." });
    res.json({ subCompany: sub });
  });

  // List projects the signed-in sub is attached to. Powers the mobile PWA's
  // "pick which jobsite you're on" screen for subs who work multiple jobs.
  app.get("/api/sub/projects", resolveSubSession, async (req: any, res) => {
    const joins = await storage.listProjectsForSub(req.subCompany.id);
    // Fan out to project + org names so the client renders a friendly list.
    // We EXCLUDE completed projects from this list — subs shouldn't see closed
    // jobs on their project picker. Historical uploads remain in the PM's
    // inbox regardless.
    const items = [] as Array<{ projectId: number; projectName: string; organizationName: string; joinedAt: string }>;
    for (const j of joins) {
      const project = await storage.getProject(j.projectId);
      if (!project) continue;
      if (isProjectClosedToSubs(project)) continue;
      const org = await getOrganization(j.organizationId);
      items.push({
        projectId: j.projectId,
        projectName: project.name,
        organizationName: org?.name || "TrussPath",
        joinedAt: j.joinedAt,
      });
    }
    res.json(items);
  });

  // List a sub's own recent uploads on a given project — shows them what
  // they've submitted so they don't upload the same COI five times.
  app.get("/api/sub/projects/:projectId/uploads", resolveSubSession, async (req: any, res) => {
    const projectId = parseInt(req.params.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id." });
    const attached = await storage.isSubAttached(req.subCompany.id, projectId);
    if (!attached) return res.status(403).json({ message: "Not attached to this project." });
    // Fetch the project so we can pass organizationId to the tenant-scoped
    // list query. Sub's own scope check is via isSubAttached above.
    const project = await storage.getProject(projectId);
    if (!project) return res.status(404).json({ message: "Project not found." });
    if (isProjectClosedToSubs(project)) return respondJobClosed(res, project.name);
    const uploads = await storage.listSubUploads(project.organizationId!, projectId, { limit: 100 });
    // Return only THIS sub's uploads (defense in depth: they shouldn't see
    // other subs' files even though they're attached to the same project).
    const mine = uploads.filter(u => u.subCompanyId === req.subCompany.id);
    res.json(mine);
  });

  // ==== Sub-side RFI / Change Order / Task endpoints =====================
  // All of these:
  //   1. Require a valid sub session (resolveSubSession middleware)
  //   2. Verify the sub is attached to the project (isSubAttached)
  //   3. Check the project isn't closed (isProjectClosedToSubs) — returns 410
  //      "job_closed" so the client can show the friendly closed-portal UI
  //   4. Land RFI/CO submissions as `sub_draft` status — they only enter the
  //      real workflow after a PM accepts. This keeps quality high and lets
  //      the PM edit fields (assignee, spec ref, etc.) during review.
  //
  // Nothing here writes to sub_uploads. If we want to persist the RFI/CO
  // attachment for the PM inbox as well, we'll wire that in a follow-up.

  // Helper: shared preflight for every sub-side RFI/CO/Task endpoint.
  async function subProjectGate(req: any, res: any): Promise<Project | null> {
    const projectId = parseInt(req.params.projectId, 10);
    if (!Number.isFinite(projectId)) { res.status(400).json({ message: "Invalid project id." }); return null; }
    const attached = await storage.isSubAttached(req.subCompany.id, projectId);
    if (!attached) { res.status(403).json({ message: "Not attached to this project." }); return null; }
    const project = await storage.getProject(projectId);
    if (!project) { res.status(404).json({ message: "Project not found." }); return null; }
    if (isProjectClosedToSubs(project)) { respondJobClosed(res, project.name); return null; }
    return project;
  }

  // Synthetic req-shape used to funnel sub-authored events through logEvent().
  // logEvent reads req.account for actor name/id — for sub actions we surface
  // the sub company as the actor name, and leave actorAccountId null so the
  // event JOINs don't try to look up a phantom user row.
  function subActorReq(sub: any, organizationId: number | null): any {
    return {
      organizationId,
      account: { id: null, name: `${sub.companyName} (sub)`, email: sub.contactEmail },
    };
  }

  // ---- Sub submits an RFI (lands as sub_draft) ---------------------------
  // Returns email addresses for every team member on the project's org who
  // has an access level of PM or PE. Empty when no PMs are set up yet (the
  // send is then no-oped by the mailer). Kept inline so we can share the
  // exact filter between the RFI and CO endpoints below.
  async function pmEmailsForProjectOrg(organizationId: number | null | undefined): Promise<string[]> {
    if (!organizationId) return [];
    try {
      const roster = await storage.getTeam(organizationId);
      // 'project_manager' is default on new members \u2014 include
      // 'project_executive' too since they own escalations in the field.
      return roster
        .filter(m => m.email && (m.accessLevel === "project_manager" || m.accessLevel === "project_executive"))
        .map(m => m.email as string);
    } catch (err) {
      console.error("[sub-notify] Failed to load PM roster:", err);
      return [];
    }
  }

  app.post("/api/sub/projects/:projectId/rfis", resolveSubSession, async (req: any, res) => {
    const project = await subProjectGate(req, res);
    if (!project) return;
    const b = req.body || {};
    const subject = String(b.subject || "").trim();
    const body = b.body ? String(b.body).trim() : "";
    const trade = b.trade ? String(b.trade).trim() : (req.subCompany.trade || null);
    const priority = b.priority ? String(b.priority).trim() : "Medium";
    const dueDate = b.dueDate ? String(b.dueDate).trim() : new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const specSection = b.specSection ? String(b.specSection).trim() : null;
    const drawingRef = b.drawingRef ? String(b.drawingRef).trim() : null;
    if (!subject) return res.status(400).json({ message: "Subject is required." });
    if (!body) return res.status(400).json({ message: "Question detail is required." });
    const number = await storage.nextRfiNumber(project.id);
    const created = await storage.createRfi({
      projectId: project.id,
      number,
      subject,
      status: "sub_draft",
      assigneeId: null,
      dateCreated: new Date().toISOString().slice(0, 10),
      dueDate,
      trade,
      body,
      specSection,
      drawingRef,
      priority,
      submittedBySubCompanyId: req.subCompany.id,
    });
    logEvent(subActorReq(req.subCompany, project.organizationId!), {
      projectId: project.id,
      kind: "rfi.sub_draft",
      title: `${number} draft from ${req.subCompany.companyName} \u2014 ${subject}`,
      sourceType: "rfi",
      sourceId: created.id,
      meta: { number, status: "sub_draft", submittedBySubCompanyId: req.subCompany.id },
    });
    // Fire-and-forget PM notification. We don't await so a slow SMTP path
    // never blocks the sub's confirmation \u2014 the mailer already logs
    // successes and failures.
    void (async () => {
      const toEmails = await pmEmailsForProjectOrg(project.organizationId);
      const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";
      await sendSubDraftNotification({
        kind: "rfi",
        toEmails,
        projectName: project.name,
        subCompanyName: req.subCompany.companyName,
        number,
        title: subject,
        url: `${APP_URL}/#/rfis`,
      });
    })();
    res.status(201).json(created);
  });

  // ---- Sub lists their own RFIs on a project -----------------------------
  app.get("/api/sub/projects/:projectId/rfis", resolveSubSession, async (req: any, res) => {
    const project = await subProjectGate(req, res);
    if (!project) return;
    const rows = await storage.listRfisSubmittedBySub(project.id, req.subCompany.id);
    res.json(rows);
  });

  // ---- Sub submits a Change Order (lands as sub_draft) -------------------
  app.post("/api/sub/projects/:projectId/change-orders", resolveSubSession, async (req: any, res) => {
    const project = await subProjectGate(req, res);
    if (!project) return;
    const b = req.body || {};
    const title = String(b.title || "").trim();
    const description = b.description ? String(b.description).trim() : "";
    const trade = b.trade ? String(b.trade).trim() : (req.subCompany.trade || null);
    const category = b.category ? String(b.category).trim() : null;
    const amount = Number.isFinite(Number(b.amount)) ? Number(b.amount) : 0;
    const scheduleImpact = Number.isFinite(Number(b.scheduleImpact)) ? Number(b.scheduleImpact) : 0;
    if (!title) return res.status(400).json({ message: "Title is required." });
    if (!description) return res.status(400).json({ message: "Description is required." });
    const number = await storage.nextChangeOrderNumber(project.id);
    const created = await storage.createChangeOrder({
      projectId: project.id,
      number,
      title,
      status: "sub_draft",
      amount,
      scheduleImpact,
      dateIssued: new Date().toISOString().slice(0, 10),
      trade,
      description,
      category,
      submittedBySubCompanyId: req.subCompany.id,
    });
    logEvent(subActorReq(req.subCompany, project.organizationId!), {
      projectId: project.id,
      kind: "change_order.sub_draft",
      title: `${number} draft from ${req.subCompany.companyName} \u2014 ${title}`,
      sourceType: "change_order",
      sourceId: created.id,
      meta: { number, status: "sub_draft", amount, scheduleImpact, submittedBySubCompanyId: req.subCompany.id },
    });
    void (async () => {
      const toEmails = await pmEmailsForProjectOrg(project.organizationId);
      const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";
      await sendSubDraftNotification({
        kind: "change_order",
        toEmails,
        projectName: project.name,
        subCompanyName: req.subCompany.companyName,
        number,
        title,
        amount,
        scheduleImpact,
        url: `${APP_URL}/#/change-orders`,
      });
    })();
    res.status(201).json(created);
  });

  // ---- Sub lists their own COs on a project (with PM decision) -----------
  app.get("/api/sub/projects/:projectId/change-orders", resolveSubSession, async (req: any, res) => {
    const project = await subProjectGate(req, res);
    if (!project) return;
    const rows = await storage.listChangeOrdersSubmittedBySub(project.id, req.subCompany.id);
    res.json(rows);
  });

  // ---- Sub lists tasks assigned to their company -------------------------
  app.get("/api/sub/projects/:projectId/tasks", resolveSubSession, async (req: any, res) => {
    const project = await subProjectGate(req, res);
    if (!project) return;
    const rows = await storage.listTasksForSub(project.id, req.subCompany.id);
    res.json(rows);
  });

  // ---- Sub marks an assigned task complete -------------------------------
  // Attachment is optional — sent multipart when the sub adds a photo/receipt.
  // If none is sent, the request goes through as plain JSON.
  app.post(
    "/api/sub/tasks/:taskId/complete",
    resolveSubSession,
    subDropUpload.single("attachment"),
    async (req: any, res) => {
      const taskId = parseInt(req.params.taskId, 10);
      if (!Number.isFinite(taskId)) return res.status(400).json({ message: "Invalid task id." });
      const task = await storage.getTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found." });
      if (task.assignedSubCompanyId !== req.subCompany.id) {
        return res.status(403).json({ message: "This task isn't assigned to your company." });
      }
      const project = await storage.getProject(task.projectId);
      if (!project) return res.status(404).json({ message: "Project not found." });
      if (isProjectClosedToSubs(project)) return respondJobClosed(res, project.name);
      const attached = await storage.isSubAttached(req.subCompany.id, project.id);
      if (!attached) return res.status(403).json({ message: "Not attached to this project." });

      const note = req.body?.note ? String(req.body.note).trim() : null;
      const file: Express.Multer.File | undefined = req.file;

      const { task: updated, completion } = await storage.markTaskCompleteBySub({
        taskId,
        projectId: project.id,
        organizationId: project.organizationId!,
        subCompanyId: req.subCompany.id,
        note,
        attachmentOriginalName: file?.originalname ?? null,
        attachmentStoredName: file?.filename ?? null,
      });

      // Also index the attachment in the PM's Sub Uploads inbox so it lives
      // alongside the sub's other files. Classified as "Photos" when the mime
      // is an image, otherwise let the classifier decide.
      if (file) {
        const { category, confidence } = classifyUpload(file.originalname, file.mimetype);
        await storage.createSubUpload({
          organizationId: project.organizationId!,
          projectId: project.id,
          dropTokenId: 0, // task-attached, not from a drop QR
          subCompanyId: req.subCompany.id,
          subName: req.subCompany.contactName,
          subCompany: req.subCompany.companyName,
          subTrade: req.subCompany.trade,
          subPhone: req.subCompany.contactPhone,
          originalFileName: file.originalname,
          storedFileName: file.filename,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          category,
          categoryConfidence: confidence,
          categoryOverriddenById: null,
          status: "new",
          reviewedByAccountId: null,
          reviewedAt: null,
          notes: `Attached to task \u201C${task.title}\u201D (task #${task.id})`,
          createdAt: new Date().toISOString(),
        });
      }

      logEvent(subActorReq(req.subCompany, project.organizationId!), {
        projectId: project.id,
        kind: "task.completed",
        title: `Task completed by ${req.subCompany.companyName} \u2014 ${task.title}`,
        sourceType: "task",
        sourceId: task.id,
        meta: { subCompanyId: req.subCompany.id, hasAttachment: Boolean(file), completionId: completion.id },
      });

      // Fire-and-forget PM email. Same shape as the RFI/CO draft notifier:
      // don't block the sub's response on Resend.
      void (async () => {
        const toEmails = await pmEmailsForProjectOrg(project.organizationId);
        const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";
        await sendSubTaskCompleteNotification({
          toEmails,
          projectName: project.name,
          subCompanyName: req.subCompany.companyName,
          taskTitle: task.title,
          note,
          hasAttachment: Boolean(file),
          url: `${APP_URL}/#/tasks`,
        });
      })();

      res.status(201).json({ task: updated, completion });
    },
  );

  // ---- Sub drop: the actual file upload ---------------------------------
  // Signed-in subs only. The drop-token in the URL is validated for project
  // authorization but the sub's identity comes from their session, not from
  // client-supplied fields.
  app.post(
    "/api/drop/:token/upload",
    resolveSubSession,
    subDropUpload.array("files", 10),
    async (req: any, res) => {
      const token = String(req.params.token || "");
      const dropToken = await storage.getDropTokenByToken(token);
      if (!dropToken) return res.status(400).json({ message: "Invalid or revoked link." });

      // Reject the upload if the job is complete. Do this BEFORE any file
      // parsing so a sub with a stale session on a closed job doesn't waste
      // their bandwidth uploading a doc that will be rejected.
      const gateProject = await storage.getProject(dropToken.projectId);
      if (isProjectClosedToSubs(gateProject)) return respondJobClosed(res, gateProject?.name);

      // Ensure the signed-in sub is attached to the project this token points
      // to. If not (they scanned a new QR while signed in from another site),
      // auto-attach so the next scan is silent.
      const isAttached = await storage.isSubAttached(req.subCompany.id, dropToken.projectId);
      if (!isAttached) {
        await storage.attachSubToProject({
          subCompanyId: req.subCompany.id,
          organizationId: dropToken.organizationId,
          projectId: dropToken.projectId,
          joinedViaDropTokenId: dropToken.id,
        });
      }

      const files: Express.Multer.File[] = (req.files || []) as any;
      if (!files.length) return res.status(400).json({ message: "No files uploaded." });

      const created = [] as Array<any>;
      for (const f of files) {
        const { category, confidence } = classifyUpload(f.originalname, f.mimetype);
        const row = await storage.createSubUpload({
          organizationId: dropToken.organizationId,
          projectId: dropToken.projectId,
          dropTokenId: dropToken.id,
          subCompanyId: req.subCompany.id,
          // Snapshot the sub's identity fields onto the row so future PM views
          // don't need to join sub_companies just to render a filename cell.
          subName: req.subCompany.contactName,
          subCompany: req.subCompany.companyName,
          subTrade: req.subCompany.trade,
          subPhone: req.subCompany.contactPhone,
          originalFileName: f.originalname,
          storedFileName: f.filename,
          mimeType: f.mimetype,
          fileSizeBytes: f.size,
          category,
          categoryConfidence: confidence,
          categoryOverriddenById: null,
          status: "new",
          reviewedByAccountId: null,
          reviewedAt: null,
          notes: null,
          createdAt: new Date().toISOString(),
        });
        created.push(row);
      }
      // Fire-and-forget: don't block the response on the touch.
      storage.touchDropToken(dropToken.id).catch(() => {});
      res.status(201).json({ uploads: created });
    },
  );

  // Gate all /api/* routes behind auth (except the PUBLIC_API allowlist).
  app.use(authMiddleware);
  // Resolve req.membership/req.organization for every authenticated request.
  app.use(resolveMembership);
  // Enforce the Command Deck add-on entitlement across that API surface.
  // Runs after resolveMembership so req.membership is populated.
  app.use(requireCommandDeck);

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
      // Org-scoped: a missing org must reject, not wave the project through.
      // resolveMembership already 403s a non-owner with no membership, so this
      // is defense in depth — and it matches requireProjectAccess's guard.
      if (!project || !req.organizationId || project.organizationId !== req.organizationId) {
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
      // Org-scoped: prevents an account with no organization from reading every
      // tenant's observations. `?? null` (not `?? undefined`) keeps it
      // fail-closed — undefined drops the filter entirely.
      organizationId: req.organizationId ?? null,
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

  /* ----------------------------- Voice notes -----------------------------
   * Hands-free field capture. POST accepts a base64-encoded audio blob
   * (audio/webm, audio/mp4, audio/mpeg, or audio/wav) plus optional
   * transcript + GPS. Audio is stashed on PHOTO_DIR (same on-disk store
   * we use for images) so playback goes through /api/field/voice-notes/:id/file.
   *
   * Every read is org-scoped via req._orgProjectIds, seeded by the
   * scopeProjectQuery middleware for the account.
   */
  const AUDIO_MIME = new Set([
    "audio/webm", "audio/webm;codecs=opus", "audio/ogg", "audio/ogg;codecs=opus",
    "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/aac",
  ]);

  app.get("/api/field/voice-notes", scopeProjectQuery, async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    if (!req.organizationId) return res.json({ voiceNotes: [] });
    const projectId = req.query?.projectId ? Number(req.query.projectId) : undefined;
    const orgProjectIds = req._orgProjectIds ? Array.from(req._orgProjectIds) as number[]
      // UNSCOPED: fallback resolves org project set when middleware didn't populate it
      : (await storage.getProjects(req.organizationId)).map((p) => p.id);
    const rows = await storage.voiceNotes.list(req.organizationId, {
      projectId: Number.isFinite(projectId as number) ? (projectId as number) : undefined,
      orgProjectIds,
    });
    res.json({ voiceNotes: rows });
  });

  app.post("/api/field/voice-notes", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    if (!req.organizationId) return res.status(400).json({ error: "organization required" });
    const projectId = Number(req.body?.projectId);
    if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ error: "projectId required" });

    // Confirm the caller's org actually owns this project before letting bytes land on disk.
    const orgProjects = await storage.getProjects(req.organizationId);
    if (!orgProjects.some((p) => p.id === projectId)) {
      return res.status(403).json({ error: "project not in caller's organization" });
    }

    const dataUrl = String(req.body?.audio || "");
    const m = /^data:([-\w.+;=]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) return res.status(400).json({ error: "audio must be a data URL (data:audio/*;base64,...)" });
    const mime = m[1].toLowerCase();
    // MediaRecorder often reports "audio/webm;codecs=opus" — accept the base form too.
    const baseMime = mime.split(";")[0];
    if (!AUDIO_MIME.has(mime) && !AUDIO_MIME.has(baseMime)) {
      return res.status(400).json({ error: `unsupported audio type: ${mime}` });
    }
    let buf: Buffer;
    try { buf = Buffer.from(m[2], "base64"); } catch { return res.status(400).json({ error: "invalid base64" }); }
    if (buf.length === 0) return res.status(400).json({ error: "empty audio" });
    if (buf.length > 25 * 1024 * 1024) return res.status(413).json({ error: "audio too large (25mb cap)" });

    // Extension mapping keeps the on-disk file playable by name in dev.
    const extMap: Record<string, string> = {
      "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a",
      "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/aac": "aac",
    };
    const ext = extMap[baseMime] || "bin";
    const filename = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    try { fs.mkdirSync(PHOTO_DIR, { recursive: true }); } catch {}
    const abs = path.resolve(PHOTO_DIR, filename);
    fs.writeFileSync(abs, buf);

    const title = req.body?.title ? String(req.body.title).slice(0, 200).trim() : null;
    const transcript = req.body?.transcript ? String(req.body.transcript).slice(0, 8000) : null;
    const durationMs = Number.isFinite(Number(req.body?.durationMs)) ? Number(req.body.durationMs) : null;
    const lat = req.body?.lat != null && Number.isFinite(Number(req.body.lat)) ? Number(req.body.lat) : null;
    const lng = req.body?.lng != null && Number.isFinite(Number(req.body.lng)) ? Number(req.body.lng) : null;
    const accuracyM = req.body?.accuracyM != null && Number.isFinite(Number(req.body.accuracyM)) ? Number(req.body.accuracyM) : null;
    const occurredAt = req.body?.occurredAt ? String(req.body.occurredAt) : new Date().toISOString();
    const clientId = req.body?.clientId ? String(req.body.clientId).slice(0, 64) : null;

    const row = await storage.voiceNotes.create({
      accountId: req.account.id,
      organizationId: req.organizationId,
      projectId,
      title,
      transcript,
      durationMs,
      storedFileName: filename,
      mimeType: baseMime,
      fileSizeBytes: buf.length,
      lat,
      lng,
      accuracyM,
      occurredAt,
      clientId,
    });

    logEvent(req, {
      projectId,
      kind: EVENT_KINDS.VOICE_NOTE_CAPTURED,
      title: title ? `Voice note \u2014 ${title}` : "Voice note captured",
      subtitle: transcript ? transcript.slice(0, 120) : undefined,
      sourceType: "voice_note",
      sourceId: row.id,
      meta: { durationMs, mime: baseMime, hasTranscript: !!transcript },
      occurredAt,
    });

    res.status(201).json({ voiceNote: row });
  });

  app.get("/api/field/voice-notes/:id/file", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    if (!req.organizationId) return res.status(403).json({ error: "organization required" });
    const id = parseInt(req.params.id, 10);
    const row = await storage.voiceNotes.get(req.organizationId, id);
    if (!row || !row.storedFileName) return res.status(404).json({ error: "not found" });
    try { fs.mkdirSync(PHOTO_DIR, { recursive: true }); } catch {}
    const abs = path.resolve(PHOTO_DIR, row.storedFileName);
    if (!abs.startsWith(PHOTO_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ error: "file missing" });
    }
    res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(fs.statSync(abs).size));
    fs.createReadStream(abs).pipe(res);
  });

  app.delete("/api/field/voice-notes/:id", async (req: any, res) => {
    if (!req.account?.id) return res.status(401).json({ error: "Unauthenticated" });
    if (!req.organizationId) return res.status(403).json({ error: "organization required" });
    const id = parseInt(req.params.id, 10);
    const row = await storage.voiceNotes.delete(req.organizationId, id);
    if (!row) return res.status(404).json({ error: "not found" });
    // Best-effort: remove the on-disk file too.
    if (row.storedFileName) {
      try { fs.unlinkSync(path.resolve(PHOTO_DIR, row.storedFileName)); } catch {}
    }
    res.status(204).end();
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
    // Project Setup is the pre-mobilization intake, so it seeds on the same
    // create. Separate try/catch: a signer auto-fill failure shouldn't cost the
    // project its mobilization checklist, or vice versa.
    try {
      await storage.seedProjectSetup(created.id, created.organizationId ?? null);
    } catch (e) {
      console.error("[project-setup] seed failed for project", created.id, e);
    }
    // Pre-Construction sits between the two, so it seeds on the same create.
    // Its own try/catch for the same reason as above.
    try {
      await storage.seedPreConstruction(created.id, created.organizationId ?? null);
    } catch (e) {
      console.error("[pre-construction] seed failed for project", created.id, e);
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

    // Auto-close the Sub Drop portal when a project transitions to complete.
    // Detecting the transition (not just the current state) means we only run
    // the revoke sweep once, on the actual flip, and repeated PATCHes with
    // status=complete stay idempotent. We do NOT re-open the portal if a PM
    // later flips status back off complete — the QR is dead, they'd need to
    // mint a new one. Sub session cookies are HMAC-stateless (30-day TTL),
    // so they can't be centrally invalidated; the request-time gate on
    // /api/drop/:token/upload catches them instead.
    const wasComplete = String(existing.status || "").toLowerCase() === "complete";
    const nowComplete = String(updated.status || "").toLowerCase() === "complete";
    if (!wasComplete && nowComplete && updated.organizationId) {
      try {
        const n = await storage.revokeAllDropTokensForProject(updated.organizationId, updated.id);
        if (n > 0) console.log(`[sub-drop] project ${updated.id} completed — revoked ${n} drop token(s)`);
      } catch (err) {
        // Non-fatal: request-time gate still enforces access. Log so we notice.
        console.error(`[sub-drop] revoke sweep failed for project ${updated.id}:`, err);
      }
    }

    res.json(updated);
  });
  // Permanent delete — no recycle bin. requireCap("manageProjects") limits this
  // to owner/admin/pm, and requireProjectAccess enforces the tenant boundary.
  app.delete("/api/projects/:id", requireCap("manageProjects"), async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id." });
    if (!(await requireProjectAccess(req, res, id))) return;
    const deleted = await storage.deleteProject(id);
    if (!deleted) return res.status(404).json({ message: "Project not found" });
    res.status(204).end();
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

  // General PATCH for tasks — currently accepts assigneeId,
  // assignedSubCompanyId, priority, title, description, dueDate. Used by the
  // PM UI to reassign a task to a sub company (or unassign by sending null).
  app.patch("/api/tasks/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid task id." });
    const b = req.body || {};
    const patch: any = {};
    if ("assigneeId" in b) patch.assigneeId = b.assigneeId == null ? null : Number(b.assigneeId) || null;
    if ("assignedSubCompanyId" in b) patch.assignedSubCompanyId = b.assignedSubCompanyId == null ? null : Number(b.assignedSubCompanyId) || null;
    if ("priority" in b && b.priority != null) patch.priority = String(b.priority);
    if ("title" in b && b.title != null) patch.title = String(b.title);
    if ("trade" in b) patch.trade = b.trade == null ? null : String(b.trade);
    if ("dueDate" in b) patch.dueDate = b.dueDate == null ? null : String(b.dueDate);
    const updated = await storage.patchTask(id, patch);
    if (!updated) return res.status(404).json({ message: "Task not found." });
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

  // ---- PM accepts a sub-submitted draft RFI ----------------------------
  // Body may include an optional patch of fields the PM tweaked during review
  // (assignee, spec ref, drawing ref, etc.). Status flips sub_draft → Open.
  // 404 if the RFI is not in sub_draft state (guards against double-accepts).
  app.post("/api/rfis/:id/accept-sub-draft", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid RFI id." });
    const rfi = await storage.getRfi(id);
    if (!rfi) return res.status(404).json({ message: "RFI not found." });
    const project = await requireProjectAccess(req, res, rfi.projectId);
    if (!project) return;
    if (rfi.status !== "sub_draft") return res.status(409).json({ message: "This RFI is not in draft state." });
    const b = req.body || {};
    const patch: any = {};
    if (b.subject != null) patch.subject = String(b.subject);
    if (b.trade != null) patch.trade = String(b.trade);
    if (b.assigneeId != null) patch.assigneeId = Number(b.assigneeId) || null;
    if (b.dueDate != null) patch.dueDate = String(b.dueDate);
    if (b.specSection != null) patch.specSection = String(b.specSection);
    if (b.drawingRef != null) patch.drawingRef = String(b.drawingRef);
    if (b.priority != null) patch.priority = String(b.priority);
    if (b.body != null) patch.body = String(b.body);
    const updated = await storage.acceptSubDraftRfi(id, req.account.id, patch);
    if (!updated) return res.status(409).json({ message: "This RFI could not be accepted (already processed?)." });
    logEvent(req, {
      projectId: updated.projectId,
      kind: EVENT_KINDS.RFI_CREATED,
      title: `${updated.number} accepted \u2014 ${updated.subject}`,
      sourceType: "rfi",
      sourceId: updated.id,
      meta: { number: updated.number, status: updated.status, acceptedFromSubCompanyId: updated.submittedBySubCompanyId },
    });
    res.json(updated);
  });

  // ---- PM accepts a sub-submitted draft Change Order --------------------
  app.post("/api/change-orders/:id/accept-sub-draft", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid CO id." });
    const co = await storage.getChangeOrder(id);
    if (!co) return res.status(404).json({ message: "Change order not found." });
    const project = await requireProjectAccess(req, res, co.projectId);
    if (!project) return;
    if (co.status !== "sub_draft") return res.status(409).json({ message: "This change order is not in draft state." });
    const b = req.body || {};
    const patch: any = {};
    if (b.title != null) patch.title = String(b.title);
    if (b.trade != null) patch.trade = String(b.trade);
    if (b.amount != null) patch.amount = Number(b.amount) || 0;
    if (b.scheduleImpact != null) patch.scheduleImpact = Number(b.scheduleImpact) || 0;
    if (b.description != null) patch.description = String(b.description);
    if (b.category != null) patch.category = String(b.category);
    const updated = await storage.acceptSubDraftChangeOrder(id, req.account.id, patch);
    if (!updated) return res.status(409).json({ message: "This CO could not be accepted (already processed?)." });
    logEvent(req, {
      projectId: updated.projectId,
      kind: EVENT_KINDS.CHANGE_ORDER_CREATED,
      title: `${updated.number} accepted \u2014 ${updated.title}`,
      sourceType: "change_order",
      sourceId: updated.id,
      meta: { number: updated.number, amount: updated.amount, status: updated.status, acceptedFromSubCompanyId: updated.submittedBySubCompanyId },
    });
    res.json(updated);
  });

  // ---- PM records a decision the sub will see on their /drop portal -----
  // Decision is independent of the base status column — a CO can be flagged
  // "approved" for the sub while its internal status is still "Executing".
  app.post("/api/change-orders/:id/sub-decision", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid CO id." });
    const co = await storage.getChangeOrder(id);
    if (!co) return res.status(404).json({ message: "Change order not found." });
    const project = await requireProjectAccess(req, res, co.projectId);
    if (!project) return;
    if (!co.submittedBySubCompanyId) {
      return res.status(400).json({ message: "This CO was not submitted by a sub \u2014 nothing to notify." });
    }
    const decision = String(req.body?.decision || "").trim();
    if (!/^(approved|rejected|needs_changes)$/.test(decision)) {
      return res.status(400).json({ message: "decision must be approved, rejected, or needs_changes." });
    }
    const comment = req.body?.comment ? String(req.body.comment).trim() : null;
    const updated = await storage.recordSubDecisionOnChangeOrder(
      id, decision as any, comment, req.account.id,
    );
    if (!updated) return res.status(404).json({ message: "Change order not found." });
    logEvent(req, {
      projectId: updated.projectId,
      kind: "change_order.sub_decision",
      title: `${updated.number} decision: ${decision.replace("_", " ")}`,
      sourceType: "change_order",
      sourceId: updated.id,
      meta: { number: updated.number, decision, comment, submittedBySubCompanyId: updated.submittedBySubCompanyId },
    });
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

  // ========================================================================
  //  SUB DROP PORTAL — PM-side (GC-authenticated) routes.
  //  These sit after resolveMembership so req.organizationId is populated.
  //  Every read enforces (project.organizationId === req.organizationId) via
  //  requireProjectAccess. No cross-tenant access is possible.
  // ========================================================================

  // --- Drop tokens (create QR / list / revoke) ---------------------------
  app.get("/api/projects/:id/drop-tokens", async (req: any, res) => {
    const project = await requireProjectAccess(req, res, parseInt(req.params.id, 10));
    if (!project) return;
    const tokens = await storage.listDropTokens(project.organizationId!, project.id);
    res.json(tokens);
  });

  // Create a new QR/drop token. Token is 22 URL-safe chars from crypto RNG —
  // 128 bits of entropy, indistinguishable from opaque so URL brute-force
  // is not a threat. PMs can generate multiple (e.g. "Site Trailer", "Gate
  // House") and revoke individually.
  app.post("/api/projects/:id/drop-tokens", async (req: any, res) => {
    const project = await requireProjectAccess(req, res, parseInt(req.params.id, 10));
    if (!project) return;
    // A completed project has a dead Sub Drop portal by design — refuse to
    // mint fresh QRs against it so PMs don't accidentally hand a sub a link
    // that will immediately fail after registration.
    if (isProjectClosedToSubs(project)) {
      return res.status(409).json({ message: "This project is complete. Sub Drop is closed for this job." });
    }
    const label = req.body?.label ? String(req.body.label).trim().slice(0, 80) : null;
    const token = randomBytesForToken(16).toString("base64url");
    const row = await storage.createDropToken({
      organizationId: project.organizationId!,
      projectId: project.id,
      token,
      label,
      createdByAccountId: req.account?.id ?? null,
      createdAt: new Date().toISOString(),
      revokedAt: null,
      lastUsedAt: null,
    });
    res.status(201).json(row);
  });

  app.post("/api/drop-tokens/:id/revoke", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid token id." });
    // Scope is enforced inside the repo via organizationId in the WHERE clause.
    await storage.revokeDropToken(req.organizationId!, id);
    res.status(204).end();
  });

  // --- Sub uploads inbox --------------------------------------------------
  // List sub uploads for the PM's org. If ?projectId= is provided the list is
  // narrowed to that project (with a scope check). ?category=... filters to a
  // single classifier bucket. Both filters are optional so the same endpoint
  // powers the per-project inbox and a future org-wide view.
  app.get("/api/sub-uploads", async (req: any, res) => {
    const projectIdRaw = req.query.projectId;
    let projectIdNum: number | undefined = undefined;
    if (projectIdRaw !== undefined && projectIdRaw !== "") {
      const pidNum = parseInt(String(projectIdRaw), 10);
      if (!Number.isFinite(pidNum)) return res.status(400).json({ message: "Invalid projectId" });
      const project = await requireProjectAccess(req, res, pidNum);
      if (!project) return;
      projectIdNum = pidNum;
    }
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await storage.listSubUploads(req.organizationId!, projectIdNum, { category, status });
    res.json(rows);
  });

  // Category counts — renders the folder header badges ("COIs (12)  Photos
  // (147)") in the PM inbox. Same scope rules as the list.
  app.get("/api/sub-uploads/counts", async (req: any, res) => {
    const projectIdRaw = req.query.projectId;
    let projectIdNum: number | undefined = undefined;
    if (projectIdRaw !== undefined && projectIdRaw !== "") {
      const pidNum = parseInt(String(projectIdRaw), 10);
      if (!Number.isFinite(pidNum)) return res.status(400).json({ message: "Invalid projectId" });
      const project = await requireProjectAccess(req, res, pidNum);
      if (!project) return;
      projectIdNum = pidNum;
    }
    const counts = await storage.countSubUploadsByCategory(req.organizationId!, projectIdNum);
    res.json(counts);
  });

  // PATCH: PM re-categorizes or marks reviewed. Every field is optional.
  app.patch("/api/sub-uploads/:id", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid upload id." });
    const existing = await storage.getSubUpload(req.organizationId!, id);
    if (!existing) return res.status(404).json({ message: "Upload not found." });
    const b = req.body || {};
    const patch: Record<string, unknown> = {};
    if (typeof b.category === "string") {
      patch.category = b.category;
      // Track who overrode the classifier so we can measure how often it's wrong.
      patch.categoryOverriddenById = req.account?.id ?? null;
    }
    if (b.status === "new" || b.status === "reviewed" || b.status === "archived") {
      patch.status = b.status;
      if (b.status === "reviewed") {
        patch.reviewedByAccountId = req.account?.id ?? null;
        patch.reviewedAt = new Date().toISOString();
      }
    }
    if (typeof b.notes === "string") patch.notes = b.notes;
    const row = await storage.updateSubUpload(req.organizationId!, id, patch);
    res.json(row);
  });

  // Stream the actual file back to the PM. Mirrors /api/documents/:id/file
  // exactly — same path-safety check, same content-disposition.
  app.get("/api/sub-uploads/:id/file", async (req: any, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid upload id." });
    const upload = await storage.getSubUpload(req.organizationId!, id);
    if (!upload) return res.status(404).json({ message: "Upload not found." });
    const abs = path.resolve(SUB_DROP_DIR, upload.storedFileName);
    if (!abs.startsWith(SUB_DROP_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", upload.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${upload.originalFileName}"`);
    fs.createReadStream(abs).pipe(res);
  });

  // --- Sub companies (PM directory) --------------------------------------
  // List sub companies attached to a specific project. Enriches the joins
  // with the sub_companies row so the PM sees company name / trade / contact.
  app.get("/api/projects/:id/sub-companies", async (req: any, res) => {
    const project = await requireProjectAccess(req, res, parseInt(req.params.id, 10));
    if (!project) return;
    const joins = await storage.listSubsForProject(project.organizationId!, project.id);
    const items = [] as Array<any>;
    for (const j of joins) {
      const sub = await storage.getSubCompanyById(j.subCompanyId);
      if (!sub) continue;
      items.push({
        joinId: j.id,
        subCompanyId: sub.id,
        companyName: sub.companyName,
        trade: sub.trade,
        contactName: sub.contactName,
        contactEmail: sub.contactEmail,
        contactPhone: sub.contactPhone,
        joinedAt: j.joinedAt,
        suspendedAt: sub.suspendedAt,
      });
    }
    res.json(items);
  });

  // Suspend a sub company (org-scoped: only PMs whose project the sub is
  // attached to can suspend). Prevents them from logging in and dropping.
  app.post("/api/sub-companies/:id/suspend", async (req: any, res) => {
    const subCompanyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(subCompanyId)) return res.status(400).json({ message: "Invalid id." });
    // Authorization: the caller's org must have this sub on at least one of
    // its projects. Otherwise a rando could suspend anyone's sub.
    const joins = await storage.listSubsForOrg(req.organizationId!);
    if (!joins.some(j => j.subCompanyId === subCompanyId)) {
      return res.status(404).json({ message: "Sub company not on your projects." });
    }
    await storage.suspendSubCompany(subCompanyId, req.account!.id);
    res.status(204).end();
  });

  app.post("/api/sub-companies/:id/unsuspend", async (req: any, res) => {
    const subCompanyId = parseInt(req.params.id, 10);
    if (!Number.isFinite(subCompanyId)) return res.status(400).json({ message: "Invalid id." });
    const joins = await storage.listSubsForOrg(req.organizationId!);
    if (!joins.some(j => j.subCompanyId === subCompanyId)) {
      return res.status(404).json({ message: "Sub company not on your projects." });
    }
    await storage.unsuspendSubCompany(subCompanyId);
    res.status(204).end();
  });

  // Detach a sub company from a specific project (softer than suspend — the
  // sub keeps their account but loses access to this jobsite's uploads).
  app.post("/api/projects/:id/sub-companies/:subId/detach", async (req: any, res) => {
    const project = await requireProjectAccess(req, res, parseInt(req.params.id, 10));
    if (!project) return;
    const subId = parseInt(req.params.subId, 10);
    if (!Number.isFinite(subId)) return res.status(400).json({ message: "Invalid sub id." });
    await storage.detachSubFromProject(subId, project.id);
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

  /**
   * Seed the standard lifecycle milestone set (NTP through Final Closeout)
   * on every project in the caller's organization. Idempotent per-project:
   * for each project, only titles that do not already exist are inserted,
   * so calling this repeatedly won't create duplicates. Existing custom or
   * mobilization milestones are untouched.
   */
  app.post("/api/command-deck/milestones/seed-all", async (req: any, res) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ message: "organization required" });
    const projects = await storage.getProjects(orgId);
    let projectCount = 0;
    let inserted = 0;
    let skipped = 0;
    for (const project of projects) {
      const existing = await storage.getMilestones(project.id);
      const existingTitles = new Set(existing.map((m) => m.title.toLowerCase()));
      const rows = buildLifecycleMilestoneRows(project.id, project.startDate ?? null)
        .filter((r) => !existingTitles.has(r.title.toLowerCase()));
      for (const row of rows) {
        await storage.createMilestone(row);
        inserted++;
      }
      skipped += LIFECYCLE_MILESTONES.length - rows.length;
      projectCount++;
    }
    res.json({ projectCount, inserted, skipped });
  });

  /**
   * Dashboard alerts aggregator. Consolidates the "PM needs to know" signals
   * across milestones (due-soon + overdue), tasks (overdue + due-soon), RFIs
   * (overdue + due-soon on open items), submittals (under review, due-soon),
   * change orders (pending), inspections (upcoming + failed follow-ups),
   * contracts (expired + expiring COIs), and mobilization (Planning without
   * a plan). Everything is org-scoped via req.organizationId.
   */
  app.get("/api/dashboard/alerts", async (req: any, res) => {
    const orgId = req.organizationId;
    if (!orgId) return res.status(400).json({ message: "organization required" });
    const alerts = await buildDashboardAlerts(storage, orgId);
    res.json({ alerts, generatedAt: new Date().toISOString() });
  });

  /* ========================= Mobilization (Command Deck) =========================
   * Every route is nested under /api/projects/:id/mobilization so access is
   * gated by requireProjectAccess — there is no org-wide mobilization list
   * except the portfolio rollup at the bottom, which derives its project set
   * from the caller's org.
   */


  // Full plan bundle for the detail page — one request feeds all eight tabs.
  app.get("/api/projects/:id/mobilization", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    // Signatures and narratives are read here rather than inside
    // mobilizationRollup so the portfolio endpoint, which calls the rollup once
    // per project, doesn't pay for two queries it never renders.
    const [r, signatures, sectionNotes] = await Promise.all([
      mobilizationRollup(projectId),
      storage.getMobilizationSignatures(projectId),
      storage.getMobilizationSectionNotes(projectId),
    ]);
    res.json({
      plan: r.plan ?? null, items: r.items, permits: r.permits, equipment: r.equipment,
      utilities: r.utilities, staff: r.staff, subs: r.subs, risks: r.risks,
      milestones: r.milestones, seeded: r.seeded,
      signatures, sectionNotes: fillSectionNotes(sectionNotes),
    });
  });

  // The plan row carries the expanded header / logistics / safety fields. Every
  // column is optional so the Overview tab can autosave one field at a time.
  const mobilizationPlanPatchSchema = insertMobilizationPlanSchema
    .omit({ projectId: true })
    .partial();

  app.patch("/api/projects/:id/mobilization/plan", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const { id: _id, projectId: _pid, ...body } = req.body ?? {};
    const parsed = mobilizationPlanPatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const row = await storage.upsertMobilizationPlan(projectId, parsed.data);
    res.json(row);
  });

  app.get("/api/projects/:id/mobilization/section-notes", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    res.json(fillSectionNotes(await storage.getMobilizationSectionNotes(projectId)));
  });

  app.put("/api/projects/:id/mobilization/section-notes/:section", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const section = decodeURIComponent(req.params.section);
    if (!MOBILIZATION_SECTIONS.includes(section as any)) {
      return res.status(404).json({ message: "Unknown section" });
    }
    const narrative = req.body?.narrative;
    if (typeof narrative !== "string") {
      return res.status(400).json({ message: "narrative must be a string" });
    }
    const row = await storage.upsertMobilizationSectionNote(projectId, section, {
      narrative,
      updatedById: req.account?.id ?? null,
    });
    res.json(row);
  });

  app.get("/api/projects/:id/mobilization/signatures", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    res.json(await storage.getMobilizationSignatures(projectId));
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

  // Soft gate: what Project Setup and Pre-Construction still owe Mobilization.
  // Warnings only — the PM can always proceed, the banner just makes the cost
  // visible.
  app.get("/api/projects/:id/mobilization/gate", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const [setup, precon] = await Promise.all([
      projectSetupRollup(projectId),
      preConstructionRollup(projectId),
    ]);
    // A project that predates the pre-con module has no row to judge, so pass
    // null and let the gate stay silent rather than warn about unasked work.
    res.json(computeMobilizationGate(setup, precon.seeded ? precon : null));
  });

  // Mobilization Plan PDF. Streams straight into the response, so once
  // generateMobilizationPlan has written a byte we can no longer switch to a
  // JSON error body — hence the try/catch that only responds when headers are
  // still unsent.
  app.get("/api/projects/:id/mobilization/report", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;

    const revision = (req.query.revision as string)?.trim() || "Rev 0";
    const preparedBy =
      (req.query.preparedBy as string)?.trim() || req.account?.displayName || "Project Team";

    try {
      await generateMobilizationPlan(projectId, { preparedBy, revision, res });
    } catch (err) {
      console.error("[mobilization/report] generation failed", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to generate report" });
      else res.end();
      return;
    }

    logEvent(req, {
      projectId,
      kind: EVENT_KINDS.MOBILIZATION_REPORT_GENERATED,
      title: "Mobilization Plan generated",
      subtitle: `${revision} — prepared by ${preparedBy}`,
      meta: { revision, preparedBy },
      sourceType: "mobilization_plan",
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
    byId: (id: number) => Promise<{ projectId: number } | null>;
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    remove: (id: number) => Promise<void>;
    onUpdate?: (req: any, row: any, patch: any) => void;
  }[] = [
    {
      path: "items", schema: insertMobilizationItemSchema,
      create: storage.createMobilizationItem.bind(storage),
      byId: storage.getMobilizationItemById.bind(storage),
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
      byId: storage.getMobilizationPermitById.bind(storage),
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
      byId: storage.getMobilizationEquipmentById.bind(storage),
      update: storage.updateMobilizationEquipment.bind(storage),
      remove: storage.deleteMobilizationEquipment.bind(storage),
    },
    {
      path: "utilities", schema: insertMobilizationUtilitySchema,
      create: storage.createMobilizationUtility.bind(storage),
      byId: storage.getMobilizationUtilityById.bind(storage),
      update: storage.updateMobilizationUtility.bind(storage),
      remove: storage.deleteMobilizationUtility.bind(storage),
    },
    {
      path: "staff", schema: insertMobilizationStaffSchema,
      create: storage.createMobilizationStaff.bind(storage),
      byId: storage.getMobilizationStaffById.bind(storage),
      update: storage.updateMobilizationStaff.bind(storage),
      remove: storage.deleteMobilizationStaff.bind(storage),
    },
    {
      path: "subs", schema: insertMobilizationSubSchema,
      create: storage.createMobilizationSub.bind(storage),
      byId: storage.getMobilizationSubById.bind(storage),
      update: storage.updateMobilizationSub.bind(storage),
      remove: storage.deleteMobilizationSub.bind(storage),
    },
    {
      path: "risks", schema: insertMobilizationRiskSchema,
      create: storage.createMobilizationRisk.bind(storage),
      byId: storage.getMobilizationRiskById.bind(storage),
      update: storage.updateMobilizationRisk.bind(storage),
      remove: storage.deleteMobilizationRisk.bind(storage),
    },
    {
      path: "signatures", schema: insertMobilizationSignatureSchema,
      create: storage.createMobilizationSignature.bind(storage),
      byId: storage.getMobilizationSignatureById.bind(storage),
      update: storage.updateMobilizationSignature.bind(storage),
      remove: storage.deleteMobilizationSignature.bind(storage),
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
      // requireProjectAccess only vouches for the URL's project. Without this
      // the row id is unscoped, so a caller with access to one project could
      // delete another tenant's row by guessing its id. 404 (not 403) so the
      // response doesn't reveal that the row exists.
      const row = await resource.byId(rowId);
      if (!row || row.projectId !== projectId) return res.status(404).json({ message: "Not found" });
      await resource.remove(rowId);
      res.status(204).end();
    });
  }

  // Portfolio rollup across every project the caller can see.
  app.get("/api/command-deck/mobilization", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass, same rule as requireProjectAccess —
      // the single OWNER_EMAIL admin account sees every tenant by design.
      ? await storage.getProjects()
      // Org-scoped: prevents a null-org account from reading every tenant's
      // portfolio. `?? null` (not `?? undefined`) keeps this fail-closed.
      : await storage.getProjects(req.organizationId ?? null);
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

  /* ======================= Project Setup (Command Deck) =======================
   * Pre-mobilization intake — the source for the Project Charter and Kickoff
   * Agenda. Same shape as the mobilization block above: everything nested under
   * /api/projects/:id so requireProjectAccess is the only authorization check,
   * plus one org-derived portfolio route at the bottom.
   */

  app.get("/api/projects/:id/project-setup", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const bundle = await storage.getProjectSetupBundle(projectId);
    res.json({ ...bundle, seeded: bundle.setup != null });
  });

  // Every column optional so the intake form can autosave a field at a time.
  const projectSetupPatchSchema = insertProjectSetupSchema.omit({ projectId: true }).partial();

  app.patch("/api/projects/:id/project-setup", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const { id: _id, projectId: _pid, ...body } = req.body ?? {};
    const parsed = projectSetupPatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });

    // Read before write so the two lifecycle events fire on the transition
    // rather than on every autosave that happens to include the same value.
    const before = await storage.getProjectSetup(projectId);
    if (!before) return res.status(404).json({ message: "Project setup not initialized" });
    const updated = await storage.updateProjectSetup(projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Project setup not initialized" });

    if (!before.charterApprovedAt && updated.charterApprovedAt) {
      logEvent(req, {
        projectId,
        kind: EVENT_KINDS.PROJECT_SETUP_CHARTER_APPROVED,
        title: "Project Charter approved",
        subtitle: updated.charterApprovedAt,
        sourceType: "project_setup",
        sourceId: updated.id,
        meta: { approvedById: updated.charterApprovedById },
      });
    }
    if (!before.kickoffScheduledAt && updated.kickoffScheduledAt) {
      logEvent(req, {
        projectId,
        kind: EVENT_KINDS.PROJECT_SETUP_KICKOFF_SCHEDULED,
        title: "Kickoff meeting scheduled",
        subtitle: updated.kickoffLocation ?? updated.kickoffScheduledAt,
        sourceType: "project_setup",
        sourceId: updated.id,
        meta: { scheduledAt: updated.kickoffScheduledAt, location: updated.kickoffLocation },
      });
    }
    res.json(updated);
  });

  // Opt-in seed for projects that predate this module. Idempotent — the seeder
  // no-ops when a setup row already exists, so a double-click is harmless.
  app.post("/api/projects/:id/project-setup/seed", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return;
    await storage.seedProjectSetup(projectId, project.organizationId ?? null);
    res.status(201).json(await storage.getProjectSetupBundle(projectId));
  });

  app.get("/api/projects/:id/project-setup/health", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    res.json(await projectSetupRollup(projectId));
  });

  /**
   * The two Project Setup PDFs. Both stream straight to the response, so once
   * the generator has written a byte we can no longer switch to a JSON error —
   * hence the headersSent check. The timeline event fires after the stream is
   * handed off and is deliberately not awaited.
   */
  const PROJECT_SETUP_REPORTS: {
    path: string;
    generate: (projectId: number, opts: any) => Promise<void>;
    kind: string;
    title: string;
    sourceType: string;
  }[] = [
    {
      path: "charter",
      generate: generateProjectCharter,
      kind: EVENT_KINDS.PROJECT_SETUP_CHARTER_REPORT_GENERATED,
      title: "Project Charter generated",
      sourceType: "project_charter",
    },
    {
      path: "kickoff-agenda",
      generate: generateKickoffAgenda,
      kind: EVENT_KINDS.PROJECT_SETUP_KICKOFF_AGENDA_GENERATED,
      title: "Kickoff Agenda generated",
      sourceType: "kickoff_agenda",
    },
  ];

  for (const report of PROJECT_SETUP_REPORTS) {
    app.get(`/api/projects/:id/project-setup/report/${report.path}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;

      // `rev` is the Project Setup query name; `revision` is accepted so a link
      // copied from the Mobilization report still works.
      const revision =
        (req.query.rev as string)?.trim() || (req.query.revision as string)?.trim() || "Rev 0";
      const preparedBy =
        (req.query.preparedBy as string)?.trim() || req.account?.displayName || "Project Team";

      try {
        await report.generate(projectId, { preparedBy, revision, res });
      } catch (err) {
        console.error(`[project-setup/report/${report.path}] generation failed`, err);
        if (!res.headersSent) res.status(500).json({ message: "Failed to generate report" });
        else res.end();
        return;
      }

      logEvent(req, {
        projectId,
        kind: report.kind,
        title: report.title,
        subtitle: `${revision} — prepared by ${preparedBy}`,
        meta: { revision, preparedBy },
        sourceType: report.sourceType,
      });
    });
  }

  const PROJECT_SETUP_RESOURCES: {
    path: string;
    schema: { safeParse: (v: unknown) => any };
    byId: (id: number) => Promise<{ projectId: number } | null>;
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    remove: (id: number) => Promise<void>;
    onUpdate?: (req: any, row: any, patch: any) => void;
  }[] = [
    {
      path: "stakeholders", schema: insertProjectSetupStakeholderSchema,
      create: storage.createStakeholder.bind(storage),
      byId: storage.getStakeholderById.bind(storage),
      update: storage.updateStakeholder.bind(storage),
      remove: storage.deleteStakeholder.bind(storage),
    },
    {
      path: "contract-docs", schema: insertProjectSetupContractDocSchema,
      create: storage.createContractDoc.bind(storage),
      byId: storage.getContractDocById.bind(storage),
      update: storage.updateContractDoc.bind(storage),
      remove: storage.deleteContractDoc.bind(storage),
    },
    {
      path: "deliverables", schema: insertProjectSetupDeliverableSchema,
      create: storage.createDeliverable.bind(storage),
      byId: storage.getDeliverableById.bind(storage),
      update: storage.updateDeliverable.bind(storage),
      remove: storage.deleteDeliverable.bind(storage),
      onUpdate: (req, row, patch) => {
        if (patch.status !== "complete") return;
        logEvent(req, {
          projectId: row.projectId,
          kind: EVENT_KINDS.PROJECT_SETUP_DELIVERABLE_COMPLETED,
          title: `Setup deliverable — ${row.label}`,
          subtitle: row.dueDate ? `Due ${row.dueDate}` : null,
          sourceType: "project_setup_deliverable",
          sourceId: row.id,
          meta: { label: row.label, dueDate: row.dueDate },
        });
      },
    },
    {
      path: "signatures", schema: insertProjectSetupSignatureSchema,
      create: storage.createSetupSignature.bind(storage),
      byId: storage.getSetupSignatureById.bind(storage),
      update: storage.updateSetupSignature.bind(storage),
      remove: storage.deleteSetupSignature.bind(storage),
    },
  ];

  for (const resource of PROJECT_SETUP_RESOURCES) {
    app.post(`/api/projects/:id/project-setup/${resource.path}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const parsed = resource.schema.safeParse({ ...(req.body ?? {}), projectId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
      const created = await resource.create(parsed.data as any);
      res.status(201).json(created);
    });

    app.patch(`/api/projects/:id/project-setup/${resource.path}/:rowId`, async (req: any, res) => {
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

    app.delete(`/api/projects/:id/project-setup/${resource.path}/:rowId`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const rowId = parseInt(req.params.rowId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(rowId)) return res.status(400).json({ message: "Invalid id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      // See the mobilization DELETE above: the row id is unscoped on its own.
      const row = await resource.byId(rowId);
      if (!row || row.projectId !== projectId) return res.status(404).json({ message: "Not found" });
      await resource.remove(rowId);
      res.status(204).end();
    });
  }

  app.get("/api/command-deck/project-setup", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass, same rule as requireProjectAccess —
      // the single OWNER_EMAIL admin account sees every tenant by design.
      ? await storage.getProjects()
      // Org-scoped: prevents a null-org account from reading every tenant's
      // portfolio. `?? null` (not `?? undefined`) keeps this fail-closed.
      : await storage.getProjects(req.organizationId ?? null);
    const rows = await Promise.all(orgProjects.map(async (p: Project) => {
      const h = await projectSetupRollup(p.id);
      return { projectId: p.id, projectName: p.name, ...h };
    }));
    res.json(rows);
  });

  /* ----------------------- Pre-Construction (Command Deck) ------------------
   * Same shape as the two blocks above: everything nested under
   * /api/projects/:id so requireProjectAccess is the only authorization check,
   * plus one org-derived portfolio route at the bottom.
   * ------------------------------------------------------------------------ */

  app.get("/api/projects/:id/pre-construction", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const bundle = await storage.getPreConstructionBundle(projectId);
    res.json({ ...bundle, seeded: bundle.preCon != null });
  });

  // Every column optional so the intake form can autosave a field at a time.
  // Legacy columns: bidPackagesCount/bidPackagesBoughtOutCount are derived from bidPackages rows; ignore inbound writes.
  const preConstructionPatchSchema = insertPreConstructionSchema
    .omit({ projectId: true, bidPackagesCount: true, bidPackagesBoughtOutCount: true })
    .partial();

  app.patch("/api/projects/:id/pre-construction", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const { id: _id, projectId: _pid, ...body } = req.body ?? {};
    const parsed = preConstructionPatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const patch: Record<string, any> = { ...parsed.data };

    // Read before write so the approval event fires on the transition rather
    // than on every autosave that happens to include the same timestamp.
    const before = await storage.getPreConstruction(projectId);
    if (!before) return res.status(404).json({ message: "Pre-Construction not initialized" });

    // Whoever sent the approving PATCH is the approver unless the client named
    // someone else — an approval with no attributed approver is not auditable.
    if (patch.preconPlanApprovedAt && !before.preconPlanApprovedAt && patch.preconPlanApprovedById == null) {
      patch.preconPlanApprovedById = req.account?.id ?? null;
    }

    const updated = await storage.updatePreConstruction(projectId, patch);
    if (!updated) return res.status(404).json({ message: "Pre-Construction not initialized" });
    if (!before.preconPlanApprovedAt && updated.preconPlanApprovedAt) {
      logEvent(req, {
        projectId, kind: EVENT_KINDS.PRECON_PLAN_APPROVED,
        title: "Pre-Construction Plan approved",
        subtitle: updated.preconPlanApprovedAt,
        sourceType: "pre_construction", sourceId: updated.id,
        meta: { approvedById: updated.preconPlanApprovedById, designPhase: updated.designPhase },
      });
    }
    res.json(updated);
  });

  // Opt-in seed for projects that predate this module. Idempotent — a second
  // call reports the existing row instead of creating a duplicate.
  app.post("/api/projects/:id/pre-construction/seed", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const project = await requireProjectAccess(req, res, projectId);
    if (!project) return;
    const existing = await storage.getPreConstruction(projectId);
    if (existing) return res.json({ alreadySeeded: true, preCon: existing });
    await storage.seedPreConstruction(projectId, project.organizationId ?? null);
    res.json({ seeded: true, preCon: await storage.getPreConstruction(projectId) });
  });

  app.get("/api/projects/:id/pre-construction/health", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    if (!(await requireProjectAccess(req, res, projectId))) return;
    res.json(await preConstructionRollup(projectId));
  });

  // The three Pre-Construction PDFs read the same context and differ only in
  // which renderer runs and which event they log, so they are registered from a
  // table rather than as three copies of the handler.
  const PRE_CONSTRUCTION_REPORTS = [
    {
      path: "plan.pdf",
      slug: "pre-construction-plan",
      title: "Pre-Construction Plan",
      sourceType: "pre_construction_plan",
      kind: EVENT_KINDS.PRECON_PLAN_REPORT_GENERATED,
      meta: preConstructionPlanMeta,
      render: renderPreConstructionPlan,
    },
    {
      path: "design-review.pdf",
      slug: "design-review",
      title: "Design Review Report",
      sourceType: "pre_construction_design_review",
      kind: EVENT_KINDS.PRECON_DESIGN_REVIEW_REPORT_GENERATED,
      meta: designReviewReportMeta,
      render: renderDesignReviewReport,
    },
    {
      path: "buyout.pdf",
      slug: "buyout-plan",
      title: "Buyout Plan",
      sourceType: "pre_construction_buyout",
      kind: EVENT_KINDS.PRECON_BUYOUT_REPORT_GENERATED,
      meta: buyoutPlanMeta,
      render: renderBuyoutPlan,
    },
  ];

  // Unlike the Mobilization and Project Setup generators, these load their data
  // before opening the stream, so a project with no pre-con row gets a JSON 404
  // instead of a truncated PDF. After the builder writes its first byte only the
  // headersSent check is left.
  for (const report of PRE_CONSTRUCTION_REPORTS) {
    app.get(`/api/projects/:id/pre-construction/reports/${report.path}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;

      const revision = (req.query.revision as string)?.trim() || "Rev 0";
      const preparedBy =
        (req.query.preparedBy as string)?.trim() || req.account?.displayName || "Project Team";
      const preparedByRole = (req.query.preparedByRole as string)?.trim() || undefined;

      let ctx: PreConstructionReportContext;
      try {
        ctx = await loadPreConstructionReportContext(projectId);
      } catch (err) {
        if (err instanceof PreConstructionNotInitializedError) {
          return res.status(404).json({
            error: "Pre-Construction not initialized. POST /api/projects/:id/pre-construction/seed first.",
          });
        }
        console.error(`[pre-construction/reports/${report.path}] load failed`, err);
        return res.status(500).json({ message: "Failed to generate report" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${reportFilename(report.slug, ctx.project)}"`,
      );

      const builder = new ReportBuilder(
        report.meta(ctx, { preparedBy, preparedByRole, revision }),
      );
      builder.pipe(res);
      try {
        report.render(builder, ctx);
        builder.end();
      } catch (err) {
        console.error(`[pre-construction/reports/${report.path}] render failed`, err);
        if (!res.headersSent) res.status(500).json({ message: "Failed to generate report" });
        else res.end();
        return;
      }

      logEvent(req, {
        projectId,
        kind: report.kind,
        title: `${report.title} generated`,
        subtitle: `${revision} — prepared by ${preparedBy}`,
        meta: { revision, preparedBy },
        sourceType: report.sourceType,
      });
    });
  }

  const today = () => new Date().toISOString().slice(0, 10);

  const PRE_CONSTRUCTION_RESOURCES: {
    path: string;
    param: string;
    byId: (id: number) => Promise<any | null>;
    schema: any;
    create: (data: any) => Promise<any>;
    update: (id: number, data: any) => Promise<any>;
    remove: (id: number) => Promise<void>;
    // Patch keys whose transition emits an event. Presence of any of them is
    // what makes the handler read the row before updating it.
    watch?: string[];
    stamp?: (before: any, patch: any) => void;
    onTransition?: (req: any, before: any, after: any) => void;
  }[] = [
    { path: "design-docs", param: "docId",
      byId: storage.getDesignDocById.bind(storage),
      schema: insertPreConstructionDesignDocSchema,
      create: storage.createDesignDoc.bind(storage),
      update: storage.updateDesignDoc.bind(storage),
      remove: storage.deleteDesignDoc.bind(storage) },
    { path: "design-rfis", param: "rfiId",
      byId: storage.getDesignRfiById.bind(storage),
      schema: insertPreConstructionDesignRfiSchema,
      create: storage.createDesignRfi.bind(storage),
      update: storage.updateDesignRfi.bind(storage),
      remove: storage.deleteDesignRfi.bind(storage) },
    { path: "ve-items", param: "veId",
      byId: storage.getVeItemById.bind(storage),
      schema: insertPreConstructionVeItemSchema,
      create: storage.createVeItem.bind(storage),
      update: storage.updateVeItem.bind(storage),
      remove: storage.deleteVeItem.bind(storage) },
    { path: "permits", param: "permitId",
      byId: storage.getPermitById.bind(storage),
      schema: insertPreConstructionPermitSchema,
      create: storage.createPermit.bind(storage),
      update: storage.updatePermit.bind(storage),
      remove: storage.deletePermit.bind(storage),
      watch: ["status"],
      stamp: (before, patch) => {
        // A permit that is issued but carries no issue date can't be checked
        // against its expiration, so fill it rather than accept the gap.
        if (patch.status === "issued" && before.status !== "issued" && !patch.issuedDate && !before.issuedDate) {
          patch.issuedDate = today();
        }
      },
      onTransition: (req, before, after) => {
        if (before.status === "issued" || after.status !== "issued") return;
        logEvent(req, {
          projectId: after.projectId, kind: EVENT_KINDS.PRECON_PERMIT_ISSUED,
          title: `Permit issued: ${after.permitType ?? "permit"}${after.permitNumber ? ` #${after.permitNumber}` : ""}`,
          subtitle: after.jurisdiction ?? after.issuedDate,
          sourceType: "pre_construction_permit", sourceId: after.id,
          meta: {
            permitId: after.id, permitType: after.permitType, permitNumber: after.permitNumber,
            jurisdiction: after.jurisdiction, issuedDate: after.issuedDate,
          },
        });
      } },
    { path: "prequal-subs", param: "subId",
      byId: storage.getPrequalSubById.bind(storage),
      schema: insertPreConstructionPrequalSubSchema,
      create: storage.createPrequalSub.bind(storage),
      update: storage.updatePrequalSub.bind(storage),
      remove: storage.deletePrequalSub.bind(storage) },
    { path: "bid-packages", param: "bpId",
      byId: storage.getBidPackageById.bind(storage),
      schema: insertPreConstructionBidPackageSchema,
      create: storage.createBidPackage.bind(storage),
      update: storage.updateBidPackage.bind(storage),
      remove: storage.deleteBidPackage.bind(storage),
      watch: ["status"],
      stamp: (before, patch) => {
        if (patch.status === "awarded" && before.status !== "awarded" && !patch.awardedDate && !before.awardedDate) {
          patch.awardedDate = today();
        }
      },
      onTransition: (req, before, after) => {
        if (before.status === "awarded" || after.status !== "awarded") return;
        logEvent(req, {
          projectId: after.projectId, kind: EVENT_KINDS.PRECON_BID_PACKAGE_AWARDED,
          title: `Bid package awarded: ${after.label}`,
          subtitle: after.awardedTo ?? after.awardedDate,
          sourceType: "pre_construction_bid_package", sourceId: after.id,
          meta: {
            bidPackageId: after.id, packageNumber: after.packageNumber, label: after.label,
            awardedTo: after.awardedTo, awardedValueUsd: after.awardedValueUsd, awardedDate: after.awardedDate,
          },
        });
      } },
    { path: "long-lead-items", param: "llId",
      byId: storage.getLongLeadItemById.bind(storage),
      schema: insertPreConstructionLongLeadItemSchema,
      create: storage.createLongLeadItem.bind(storage),
      update: storage.updateLongLeadItem.bind(storage),
      remove: storage.deleteLongLeadItem.bind(storage),
      watch: ["orderedDate", "actualDeliveryDate"],
      onTransition: (req, before, after) => {
        if (!before.orderedDate && after.orderedDate) {
          logEvent(req, {
            projectId: after.projectId, kind: EVENT_KINDS.PRECON_LONG_LEAD_ORDERED,
            title: `Long-lead item ordered: ${after.description}`,
            subtitle: after.supplier ?? after.orderedDate,
            sourceType: "pre_construction_long_lead_item", sourceId: after.id,
            meta: {
              longLeadItemId: after.id, itemNumber: after.itemNumber, description: after.description,
              supplier: after.supplier, poNumber: after.poNumber, orderedDate: after.orderedDate,
              expectedDeliveryDate: after.expectedDeliveryDate,
            },
          });
        }
        if (!before.actualDeliveryDate && after.actualDeliveryDate) {
          logEvent(req, {
            projectId: after.projectId, kind: EVENT_KINDS.PRECON_LONG_LEAD_DELIVERED,
            title: `Long-lead item delivered: ${after.description}`,
            subtitle: after.actualDeliveryDate,
            sourceType: "pre_construction_long_lead_item", sourceId: after.id,
            meta: {
              longLeadItemId: after.id, itemNumber: after.itemNumber, description: after.description,
              supplier: after.supplier, expectedDeliveryDate: after.expectedDeliveryDate,
              actualDeliveryDate: after.actualDeliveryDate,
            },
          });
        }
      } },
    { path: "signatures", param: "sigId",
      byId: storage.getPreconSignatureById.bind(storage),
      schema: insertPreConstructionSignatureSchema,
      create: storage.createPreconSignature.bind(storage),
      update: storage.updatePreconSignature.bind(storage),
      remove: storage.deletePreconSignature.bind(storage) },
  ];

  for (const resource of PRE_CONSTRUCTION_RESOURCES) {
    const patchSchema = resource.schema.omit({ projectId: true }).partial();

    app.post(`/api/projects/:id/pre-construction/${resource.path}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const parsed = resource.schema.safeParse({ ...(req.body ?? {}), projectId });
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
      res.status(201).json(await resource.create(parsed.data));
    });

    app.patch(`/api/projects/:id/pre-construction/${resource.path}/:${resource.param}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const rowId = parseInt(req.params[resource.param], 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(rowId)) return res.status(400).json({ message: "Invalid id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const { id: _id, projectId: _pid, ...body } = req.body ?? {};
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
      const patch: Record<string, any> = { ...parsed.data };

      const needsBefore = !!resource.watch?.some((k) => k in patch);
      const before = needsBefore ? await resource.byId(rowId) : null;
      if (needsBefore && (!before || before.projectId !== projectId)) {
        return res.status(404).json({ message: "Not found" });
      }
      if (before) resource.stamp?.(before, patch);

      const updated = await resource.update(rowId, patch);
      if (!updated || updated.projectId !== projectId) return res.status(404).json({ message: "Not found" });
      if (before) resource.onTransition?.(req, before, updated);
      res.json(updated);
    });

    app.delete(`/api/projects/:id/pre-construction/${resource.path}/:${resource.param}`, async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const rowId = parseInt(req.params[resource.param], 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(rowId)) return res.status(400).json({ message: "Invalid id" });
      if (!(await requireProjectAccess(req, res, projectId))) return;
      // See the mobilization DELETE above: the row id is unscoped on its own.
      const row = await resource.byId(rowId);
      if (!row || row.projectId !== projectId) return res.status(404).json({ message: "Not found" });
      await resource.remove(rowId);
      res.json({ deleted: true });
    });
  }

  // ---------------------------------------------------------------------
  // Lean Command Deck modules (4-22). Every lifecycle module beyond Pre-Con
  // shares one route surface, keyed by module slug. Cheaper to grow than 19
  // hand-rolled route sets and doesn't lock the URL shape when a module
  // graduates to its own schema — the eventual purpose-built routes can
  // co-exist and take over on the same paths.
  // ---------------------------------------------------------------------
  const leanModuleStatePatchSchema = insertLeanModuleStateSchema
    .omit({ projectId: true, moduleId: true })
    .partial();
  const leanModuleItemCreateSchema = insertLeanModuleItemSchema.omit({ moduleId: true, projectId: true });
  const leanModuleItemPatchSchema = insertLeanModuleItemSchema
    .omit({ projectId: true, moduleId: true })
    .partial();

  function validateModuleSlug(res: any, moduleId: string): boolean {
    if (!isLeanModuleSlug(moduleId)) {
      res.status(404).json({ message: `Unknown module: ${moduleId}` });
      return false;
    }
    return true;
  }

  app.get("/api/projects/:id/modules/:moduleId", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    // Lazy-create the parent state row so the client always gets a shape it
    // can render — matches the seed behaviour of the shipped modules.
    await storage.ensureLeanModuleState(projectId, moduleId);
    const bundle = await storage.getLeanModuleBundle(projectId, moduleId);
    res.json(bundle);
  });

  app.patch("/api/projects/:id/modules/:moduleId", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const { id: _id, projectId: _pid, moduleId: _mid, ...body } = req.body ?? {};
    const parsed = leanModuleStatePatchSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const patch: Record<string, any> = { ...parsed.data };

    const before = await storage.ensureLeanModuleState(projectId, moduleId);
    // Attribute the approver on the transition — same pattern as Pre-Con.
    if (patch.planApprovedAt && !before.planApprovedAt && patch.planApprovedById == null) {
      patch.planApprovedById = req.account?.id ?? null;
    }

    const updated = await storage.updateLeanModuleState(projectId, moduleId, patch);
    if (!updated) return res.status(404).json({ message: "Module state not found" });
    res.json(updated);
  });

  app.post("/api/projects/:id/modules/:moduleId/items", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const parsed = leanModuleItemCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createLeanModuleItem({ ...parsed.data, projectId, moduleId });
    res.status(201).json(created);
  });

  /**
   * Bulk import items. Body: { items: [ { title, category?, ownerName?, ... }, ... ] }.
   *
   * Powers the paste-import dialog on any lean module page: a user drops a TSV
   * block from a spreadsheet and every row is validated with the same zod
   * schema as single-item creation. If any row fails, the whole request is
   * rejected (with the offending index in the error) rather than partially
   * inserted, so the client can highlight the bad row and let the user fix it.
   */
  app.post("/api/projects/:id/modules/:moduleId/items/bulk", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "Invalid project id" });
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return res.status(400).json({ message: "Expected { items: [...] }" });
    // Hard cap prevents a runaway paste from wedging the DB. 500 is well past
    // any realistic paste; if we ever hit it we'll raise it explicitly.
    if (items.length > 500) {
      return res.status(400).json({ message: "Max 500 items per bulk import" });
    }
    const parsedRows: Array<Omit<typeof items[number], "projectId" | "moduleId">> = [];
    for (let i = 0; i < items.length; i += 1) {
      const parsed = leanModuleItemCreateSchema.safeParse(items[i] ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          message: `Row ${i + 1} invalid`,
          issues: parsed.error.issues,
          rowIndex: i,
        });
      }
      parsedRows.push(parsed.data);
    }
    const created = await storage.bulkCreateLeanModuleItems(projectId, moduleId, parsedRows);
    res.status(201).json({ created, count: created.length });
  });

  /**
   * Attachments for a lean-module item row. Uploads land on local disk
   * (`LEAN_ATTACHMENT_DIR`); metadata + relative URL are persisted in
   * `lean_module_item_attachments`. The file stream endpoint below verifies
   * project access before serving bytes so private attachments stay private.
   */
  app.get("/api/projects/:id/modules/:moduleId/items/:itemId/attachments", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(projectId) || !Number.isFinite(itemId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const rows = await storage.listLeanModuleItemAttachments(projectId, moduleId, itemId);
    res.json(rows);
  });

  app.post(
    "/api/projects/:id/modules/:moduleId/items/:itemId/attachments",
    leanAttachmentUpload.single("file"),
    async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(itemId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const moduleId = String(req.params.moduleId);
      if (!validateModuleSlug(res, moduleId)) return;
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file provided." });
      const kind = file.mimetype.startsWith("image/") ? "photo" : "file";
      // Encode the multer-generated stored filename into a `?f=` query on the
      // stream URL so we don't need a dedicated `stored_file` DB column. The
      // stream endpoint parses it back out and path-guards before serving.
      // Row id is a placeholder in the URL until after insert; we patch the
      // final URL in a second update once we know the id.
      const created = await storage.createLeanModuleItemAttachment({
        itemId,
        projectId,
        moduleId,
        url: `pending?f=${encodeURIComponent(file.filename)}`,
        filename: file.originalname,
        kind,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedByAccountId: req.account?.id ?? null,
        uploadedByName: req.account?.name ?? req.account?.email ?? null,
        uploadedAt: new Date().toISOString(),
      } as any);
      const finalUrl =
        `/api/projects/${projectId}/modules/${moduleId}/items/${itemId}` +
        `/attachments/${created.id}/file?f=${encodeURIComponent(file.filename)}`;
      await storage.updateLeanModuleItemAttachmentUrl(created.id, finalUrl);
      res.status(201).json({ ...created, url: finalUrl });
    },
  );

  // Stream a single attachment's bytes. The multer-generated storedFile lives
  // in the URL's ?f= query so we don't need an extra DB column.
  app.get(
    "/api/projects/:id/modules/:moduleId/items/:itemId/attachments/:attachmentId/file",
    async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      const attachmentId = parseInt(req.params.attachmentId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(itemId) || !Number.isFinite(attachmentId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const moduleId = String(req.params.moduleId);
      if (!validateModuleSlug(res, moduleId)) return;
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const rows = await storage.listLeanModuleItemAttachments(projectId, moduleId, itemId);
      const row = rows.find((r) => r.id === attachmentId);
      if (!row) return res.status(404).json({ message: "Attachment not found." });
      // Pull the stored filename out of the url column's ?f= param.
      const match = /[?&]f=([^&]+)/.exec(row.url);
      const storedFile = match ? decodeURIComponent(match[1]) : null;
      if (!storedFile) return res.status(404).json({ message: "File missing from storage." });
      const abs = path.resolve(LEAN_ATTACHMENT_DIR, storedFile);
      // Path-traversal guard: reject anything that escapes the upload dir.
      if (!abs.startsWith(LEAN_ATTACHMENT_DIR + path.sep) || !fs.existsSync(abs)) {
        return res.status(404).json({ message: "File missing from storage." });
      }
      res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
      const disposition = row.kind === "photo" ? "inline" : "attachment";
      res.setHeader(
        "Content-Disposition",
        `${disposition}; filename="${row.filename.replace(/"/g, "")}"`,
      );
      fs.createReadStream(abs).pipe(res);
    },
  );

  app.delete(
    "/api/projects/:id/modules/:moduleId/items/:itemId/attachments/:attachmentId",
    async (req: any, res) => {
      const projectId = parseInt(req.params.id, 10);
      const itemId = parseInt(req.params.itemId, 10);
      const attachmentId = parseInt(req.params.attachmentId, 10);
      if (!Number.isFinite(projectId) || !Number.isFinite(itemId) || !Number.isFinite(attachmentId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const moduleId = String(req.params.moduleId);
      if (!validateModuleSlug(res, moduleId)) return;
      if (!(await requireProjectAccess(req, res, projectId))) return;
      const ok = await storage.deleteLeanModuleItemAttachment(attachmentId, projectId, moduleId);
      if (!ok) return res.status(404).json({ message: "Not found" });
      res.json({ deleted: true });
    },
  );

  app.patch("/api/projects/:id/modules/:moduleId/items/:itemId", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(projectId) || !Number.isFinite(itemId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const parsed = leanModuleItemPatchSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateLeanModuleItem(itemId, projectId, moduleId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Not found" });
    res.json(updated);
  });

  app.delete("/api/projects/:id/modules/:moduleId/items/:itemId", async (req: any, res) => {
    const projectId = parseInt(req.params.id, 10);
    const itemId = parseInt(req.params.itemId, 10);
    if (!Number.isFinite(projectId) || !Number.isFinite(itemId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const moduleId = String(req.params.moduleId);
    if (!validateModuleSlug(res, moduleId)) return;
    if (!(await requireProjectAccess(req, res, projectId))) return;
    const ok = await storage.deleteLeanModuleItem(itemId, projectId, moduleId);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ deleted: true });
  });

  /**
   * Portfolio rollup across every project + every lean module for the caller's
   * org. Powers the Command Deck landing page's per-project health strip.
   *
   * Returns { projects, rollups } separately so the client can iterate every
   * project even when it has zero lean-module activity yet (empty projects
   * still deserve a card, they just render as "not started" across the strip).
   */
  app.get("/api/command-deck/lean-rollup", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass, same rule as requireProjectAccess —
      // the single OWNER_EMAIL admin account sees every tenant by design.
      ? await storage.getProjects()
      // Org-scoped: prevents a null-org account from reading every tenant's
      // portfolio. `?? null` (not `?? undefined`) keeps this fail-closed.
      : await storage.getProjects(req.organizationId ?? null);
    const projectIds = orgProjects.map((p: Project) => p.id);
    const rollups = await storage.getLeanModuleRollup(projectIds);
    res.json({ projects: orgProjects, rollups });
  });

  /**
   * Org-wide board packet export history. Returns the last N `board_packet`
   * events across every project the caller can see, newest first.
   *
   * Uses raw SQL because storage.getProjectEvents() is per-project and this
   * page needs a cross-project feed. Keeps everything org-scoped by filtering
   * on organization_id (or bypassing for the platform-owner account).
   */
  app.get("/api/command-deck/board-packet-history", async (req: any, res) => {
    const isOwner = req.account?.role === "owner";
    const orgId = req.organizationId ?? null;
    if (!isOwner && orgId === null) {
      // Fail-closed: an authenticated but org-less account (e.g. mid-invite)
      // must never see cross-tenant events.
      return res.json([]);
    }
    const { sql: pgSql } = await import("./storage/db");
    const kind = "board_packet";
    const limit = 20;
    const rows: any[] = isOwner
      // UNSCOPED: owner sees every tenant. Same rule as other Command Deck endpoints.
      ? await pgSql`
          SELECT id, organization_id, project_id, actor_account_id, actor_name,
                 kind, title, subtitle, meta, source_type, source_id,
                 occurred_at, created_at
          FROM project_events
          WHERE kind = ${kind}
          ORDER BY occurred_at DESC
          LIMIT ${limit}
        `
      // Org-scoped: only this tenant's events.
      : await pgSql`
          SELECT id, organization_id, project_id, actor_account_id, actor_name,
                 kind, title, subtitle, meta, source_type, source_id,
                 occurred_at, created_at
          FROM project_events
          WHERE kind = ${kind} AND organization_id = ${orgId}
          ORDER BY occurred_at DESC
          LIMIT ${limit}
        `;
    res.json(rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      actorAccountId: r.actor_account_id,
      actorName: r.actor_name,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      meta: r.meta ?? {},
      sourceType: r.source_type,
      sourceId: r.source_id,
      occurredAt: typeof r.occurred_at === "string" ? r.occurred_at : new Date(r.occurred_at).toISOString(),
      createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
    })));
  });

  /**
   * Org-wide financials rollup. Aggregates budget, contract value, approved
   * and pending change orders, committed sub/PO cost, VE savings, and design-
   * RFI cost exposure into a single portfolio snapshot.
   *
   * Returns { orgTotals, projects: [...] } so the client can show both the
   * headline chips and a per-project drill-down table in one paint.
   */
  app.get("/api/command-deck/financials-rollup", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass, same rule as requireProjectAccess.
      ? await storage.getProjects()
      : await storage.getProjects(req.organizationId ?? null);
    const rollup = await buildFinancialsRollup(storage, orgProjects);
    res.json(rollup);
  });

  /**
   * Board packet PDF export. Assembles the org's portfolio health strip, top
   * risks, and the financial rollup into a single board-ready document. The
   * PDF is streamed directly — no persistence — so history is derived from
   * project events (kind='board_packet') logged after each successful render.
   */
  app.get("/api/command-deck/board-packet.pdf", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass.
      ? await storage.getProjects()
      : await storage.getProjects(req.organizationId ?? null);

    const preparedBy = (req.query.preparedBy as string)?.trim()
      || req.account?.displayName
      || "Executive Team";
    const preparedByRole = (req.query.preparedByRole as string)?.trim() || undefined;
    const period = (req.query.period as string)?.trim() || undefined;

    // Load all inputs BEFORE opening the PDF stream so an aggregation error
    // returns a clean JSON 500 instead of a half-written PDF.
    let rollup;
    try {
      rollup = await buildFinancialsRollup(storage, orgProjects);
    } catch (err) {
      console.error("[board-packet] rollup failed", err);
      return res.status(500).json({ message: "Failed to load portfolio data" });
    }

    // Assemble the org name for the cover page. Owner sees "All organizations";
    // regular users see their own org name.
    let orgName = "All organizations";
    if (req.organizationId) {
      const org = await getOrganization(req.organizationId);
      if (org?.name) orgName = org.name;
    }

    res.setHeader("Content-Type", "application/pdf");
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Board_Packet_${stamp}.pdf"`,
    );

    try {
      await generateBoardPacket(res, {
        orgName,
        projects: orgProjects,
        rollup,
        preparedBy,
        preparedByRole,
        period,
      });
    } catch (err) {
      console.error("[board-packet] render failed", err);
      if (!res.headersSent) res.status(500).json({ message: "Failed to generate board packet" });
      else res.end();
      return;
    }

    // Log a single portfolio-scoped event. projectId is a required column on
    // projectEvents, so pin it to the first project the caller can see; the
    // event serves as a "board packet exported" audit line the client's
    // history endpoint can filter on.
    if (orgProjects.length > 0) {
      logEvent(req, {
        projectId: orgProjects[0].id,
        kind: EVENT_KINDS.BOARD_PACKET_GENERATED,
        title: "Board packet exported",
        subtitle: `${orgProjects.length} project(s) · prepared by ${preparedBy}`,
        meta: { period, projectCount: orgProjects.length, preparedBy },
        sourceType: "command_deck",
      });
    }
  });

  /* ----------------------- Command Deck: Contracts ----------------------- */
  // Purpose-built contracts register. Org-scoped everywhere; projectId is
  // optional so org-level MSAs and umbrella agreements can live here too.
  app.get("/api/command-deck/contracts", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const rows = await storage.contracts.list(req.organizationId, Number.isFinite(projectId) ? projectId : undefined);
    res.json(rows);
  });

  app.get("/api/command-deck/contracts/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const row = await storage.contracts.get(req.organizationId, id);
    if (!row) return res.status(404).json({ message: "not found" });
    res.json(row);
  });

  app.post("/api/command-deck/contracts", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const parsed = insertContractSchema.safeParse({ ...req.body, organizationId: req.organizationId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.contracts.create(req.organizationId, parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/command-deck/contracts/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const row = await storage.contracts.update(req.organizationId, id, req.body ?? {});
    if (!row) return res.status(404).json({ message: "not found" });
    res.json(row);
  });

  app.delete("/api/command-deck/contracts/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const ok = await storage.contracts.remove(req.organizationId, id);
    if (!ok) return res.status(404).json({ message: "not found" });
    res.json({ ok: true });
  });

  /* ---------------------- Command Deck: Inspections ---------------------- */
  app.get("/api/command-deck/inspections", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const rows = await storage.inspections.list(req.organizationId, Number.isFinite(projectId) ? projectId : undefined);
    res.json(rows);
  });

  app.get("/api/command-deck/inspections/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const row = await storage.inspections.get(req.organizationId, id);
    if (!row) return res.status(404).json({ message: "not found" });
    res.json(row);
  });

  app.post("/api/command-deck/inspections", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const parsed = insertInspectionSchema.safeParse({ ...req.body, organizationId: req.organizationId });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.inspections.create(req.organizationId, parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/command-deck/inspections/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const row = await storage.inspections.update(req.organizationId, id, req.body ?? {});
    if (!row) return res.status(404).json({ message: "not found" });
    res.json(row);
  });

  app.delete("/api/command-deck/inspections/:id", async (req: any, res) => {
    if (typeof req.organizationId !== "number") return res.status(400).json({ message: "organization required" });
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "invalid id" });
    const ok = await storage.inspections.remove(req.organizationId, id);
    if (!ok) return res.status(404).json({ message: "not found" });
    res.json({ ok: true });
  });

  app.get("/api/command-deck/pre-construction", async (req: any, res) => {
    const orgProjects = req.account?.role === "owner"
      // UNSCOPED: platform-owner bypass, same rule as requireProjectAccess —
      // the single OWNER_EMAIL admin account sees every tenant by design.
      ? await storage.getProjects()
      // Org-scoped: prevents a null-org account from reading every tenant's
      // portfolio. `?? null` (not `?? undefined`) keeps this fail-closed.
      : await storage.getProjects(req.organizationId ?? null);
    const rows = await Promise.all(orgProjects.map(async (p: Project) => ({
      project: p,
      preCon: await storage.getPreConstruction(p.id),
      health: await preConstructionRollup(p.id),
    })));
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
  // Sticky Board is org-wide: every user in an org sees the same corkboard.
  // We list by organization_id, not by project. Legacy rows without an
  // organization_id are backfilled at migration; new rows always carry one.
  app.get("/api/notes", async (req: any, res) => {
    if (req.account?.role === "owner") {
      res.json(await storage.getNotesForOrg(undefined));
      return;
    }
    if (!req.organizationId) return res.json([]);
    res.json(await storage.getNotesForOrg(req.organizationId));
  });
  app.post("/api/notes", async (req: any, res) => {
    // Ignore any client-supplied organizationId/createdById; always stamp
    // from the authenticated session. Body/color/x/y/type come through the
    // insert schema. projectId is accepted for optional tagging but not
    // required.
    const parsed = insertNoteSchema.safeParse({
      ...req.body,
      organizationId: req.organizationId ?? null,
      createdById: req.account?.id ?? null,
    });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const created = await storage.createNote(parsed.data);
    logEvent(req, {
      projectId: created.projectId,
      kind: EVENT_KINDS.NOTE_ADDED,
      title: (created as any).type === "sticker" ? `Sticker added` : `Note added`,
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
    // UNSCOPED: integrations.key is globally unique so there is one row per
    // service for the whole deployment — see storage.getIntegrations().
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

    // Idempotency: claim this event.id before dispatching. Stripe retries on
    // any non-2xx and can redeliver out of order, so without this ledger every
    // handler below runs again on each retry.
    //
    // Trade-off: the claim is NOT rolled back if a handler throws, so a genuine
    // failure below marks the event as processed and the next retry skips it.
    // Accepted deliberately — every handler here is a pure reconcile today:
    // updateOrgBilling writes values read straight off the event, and
    // syncCommandDeckSeatsForOrg re-derives Stripe quantities from the current DB
    // state rather than incrementing. So a dropped retry costs at most a stale
    // column that the next real Stripe event corrects. Rolling the row back on
    // failure would reopen the double-process window this guard exists to close.
    // If a non-idempotent handler is ever added here, revisit this.
    try {
      await db.insert(processedStripeEvents).values({
        eventId: event.id,
        eventType: event.type,
      });
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        // Already processed — ack with 200 so Stripe stops retrying.
        return res.status(200).json({ received: true, duplicate: true });
      }
      throw err;
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
            // Stripe deletes subscription items along with a canceled
            // subscription, so an org that lapsed and came back has no add-on
            // item even though grants may still exist. Without this re-sync
            // those grants would silently stop billing.
            await syncCommandDeckSeatsForOrg(stripe, orgId).catch(e =>
              console.error("[stripe webhook] command-deck re-sync failed:", e));
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
            // Defensive re-sync: plan changes and portal-driven edits can drop
            // or reshape items behind our back.
            await syncCommandDeckSeatsForOrg(stripe, orgId).catch(e =>
              console.error("[stripe webhook] command-deck re-sync failed:", e));
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
            // Immediate revoke on lapse. Stripe has already dropped the add-on
            // item, so keeping grants would hand out Command Deck for free.
            // Deliberately not restored on resubscribe — an admin re-grants.
            await revokeAllCommandDeckForOrg(orgId);
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
    // Legacy platform-owners bypass the add-on the same way requireCommandDeck
    // does, so the client gate agrees with what the API will actually serve.
    const isPlatformOwner = req.account.role === "owner";
    if (!req.organizationId) {
      return res.json({
        plan: null, status: null, billing: null, currentPeriodEnd: null, hasCustomer: false,
        entitlements: { commandDeck: isPlatformOwner, commandDeckSeatCount: 0 },
      });
    }
    const org = await getOrganization(req.organizationId);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    const seats = await countActiveSeats(org.id);
    const commandDeckSeatCount = await countCommandDeckSeats(org.id);
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
      entitlements: {
        commandDeck: isPlatformOwner || !!req.membership?.hasCommandDeck,
        commandDeckSeatCount: commandDeckSeatCount,
      },
    });
  });

  // DELETED ITEMS BIN
  //
  // Org-scoped: `deleted_items` has no organization_id column, so scope is
  // recovered from the JSON snapshot of the deleted row — its organizationId
  // when present, otherwise its projectId matched against the caller's
  // projects. A snapshot carrying neither is withheld from non-owners rather
  // than shown to every tenant. Without this, one org could list, restore, and
  // permanently delete another org's rows.
  async function scopedDeletedItems(req: any): Promise<any[]> {
    // UNSCOPED: the table has no org column, so the read cannot be. The filter
    // below is what scopes it; nothing outside this helper reads the bin.
    const rows = await storage.getDeletedItems();
    if (req.account?.role === "owner") return rows; // platform-owner bypass
    const orgId = req.organizationId;
    if (!orgId) return [];
    const projectIds = new Set((await storage.getProjects(orgId)).map((p: Project) => p.id));
    return rows.filter((r: any) => {
      let snap: any;
      try { snap = JSON.parse(r.data); } catch { return false; }
      if (snap?.organizationId != null) return snap.organizationId === orgId;
      if (snap?.projectId != null) return projectIds.has(snap.projectId);
      return false;
    });
  }
  // Confirm a specific bin entry belongs to the caller before mutating it.
  async function ownsDeletedItem(req: any, type: string, entityId: number): Promise<boolean> {
    const rows = await scopedDeletedItems(req);
    return rows.some((r: any) => r.entityType === type && r.entityId === entityId);
  }

  app.get("/api/deleted-items", async (req: any, res) => {
    res.json(await scopedDeletedItems(req));
  });
  app.post("/api/deleted-items/:type/:id/restore", async (req: any, res) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);
    if (!Number.isFinite(entityId)) return res.status(400).json({ message: "Invalid id" });
    // 404 (not 403) so the bin never reveals another tenant's entries exist.
    if (!(await ownsDeletedItem(req, type, entityId))) {
      return res.status(404).json({ message: "Item not found in bin" });
    }
    try {
      const restored = await storage.restoreEntity(type, entityId);
      res.json(restored);
    } catch (e: any) {
      res.status(404).json({ message: e?.message ?? "Item not found in bin" });
    }
  });
  app.delete("/api/deleted-items/:type/:id/permanent", async (req: any, res) => {
    const { type, id } = req.params;
    const entityId = parseInt(id, 10);
    if (!Number.isFinite(entityId)) return res.status(400).json({ message: "Invalid id" });
    if (!(await ownsDeletedItem(req, type, entityId))) {
      return res.status(404).json({ message: "Item not found in bin" });
    }
    await storage.permanentDeleteEntity(type, entityId);
    res.status(204).end();
  });
  app.delete("/api/deleted-items", async (req: any, res) => {
    if (req.account?.role === "owner") {
      await storage.emptyDeletedItems(); // platform-owner bypass — clears every bin
    } else {
      // Empty only the caller's own entries; a blanket delete would wipe every
      // tenant's recycle bin.
      for (const r of await scopedDeletedItems(req)) {
        await storage.permanentDeleteEntity(r.entityType, r.entityId);
      }
    }
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
    // UNSCOPED: platform-level marketing tables, requireOwner above.
    res.json({
      subscribers: await storage.listSubscribers(),
      demoRequests: await storage.listDemoRequests(),
    });
  });

  // ADMIN — list all accounts with approval + subscription state. Owner only.
  app.get("/api/admin/accounts", requireOwner, async (_req, res) => {
    // UNSCOPED: platform-admin account list, requireOwner above.
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
    // UNSCOPED: platform-admin demo account list, requireOwner above.
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
  app.get("/api/timesheets", scopeProjectQuery, async (req: any, res) => {
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
      // Org-scoped: prevents an unfiltered list from returning every tenant's
      // payroll rows. scopeProjectQuery has already validated ?projectId=; this
      // filters the no-projectId case down to the caller's own projects.
      // Filtering by project rather than timesheets.organizationId is
      // deliberate — that column is null on legacy hand-created rows, which
      // an org-column filter would silently drop from the list.
      res.json(filterByOrgProjects(req, rows));
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
        //
        // Org-scoped: prevents stamping the caller's timesheet with another
        // tenant's projectId. An account with no organization scopes to null,
        // which yields no projects and therefore the projectId=0 sentinel.
        const projects = await storage.getProjects(req.organizationId ?? null);
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

      // The document is matched by title alone, so the candidate set must be
      // scoped before matching — see the guard below.
      const project = await storage.getProject(ts.projectId);
      if (project?.organizationId == null) {
        return res.status(400).json({
          message: "Project has no organization scope, so the document cannot be filed.",
          code: "PROJECT_NOT_SCOPED",
        });
      }

      // Check if a company doc already exists for this timesheet.
      // Org-scoped: prevents overwriting another tenant's document when two
      // orgs have an employee of the same name in the same week.
      const existingDocs = await storage.getCompanyDocuments(project.organizationId);
      const existing = existingDocs.find((d) => d.title === `Timesheet — ${ts.employeeName} — Week of ${ts.weekStart}`);

      const docData = {
        organizationId: project.organizationId,
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

      const ts = await storage.getTimesheet(id);
      if (!ts) return res.status(404).json({ message: "Timesheet not found" });

      // The roster must be read through the timesheet's project, so the
      // timesheet is loaded before the recipient is validated.
      const project = await storage.getProject(ts.projectId);
      if (project?.organizationId == null) {
        return res.status(400).json({
          message: "Project has no organization scope, so the recipient cannot be verified.",
          code: "PROJECT_NOT_SCOPED",
        });
      }

      // Validate recipient is a Project Executive on this team.
      // Org-scoped: prevents cross-tenant timesheet delivery to same-email execs in other orgs.
      const team = await storage.getTeam(project.organizationId);
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
    // Removal is a soft delete, so a Command Deck grant left on the row would
    // keep billing a seat nobody can use. Clear it before either sync.
    if (target.hasCommandDeck) await setMembershipCommandDeck(id, false, String(req.account.id));
    // Fire-and-forget seat sync so the next invoice reflects the removed seat.
    if (stripe) syncSeatsForOrg(stripe, req.organizationId).catch(e => console.error("[members:delete] seat sync failed:", e));
    if (stripe && target.hasCommandDeck) {
      syncCommandDeckSeatsForOrg(stripe, req.organizationId).catch(e => console.error("[members:delete] command-deck sync failed:", e));
    }
    res.json({ ok: true });
  });

  /* ---------------------- Command Deck add-on grants ---------------------- */
  // Granting spends money (a prorated $5/seat/mo charge). manageMembers is
  // owners+admins, which is the audience that already adds billable seats by
  // inviting members, so the same capability guards this.

  // GET /api/org/members/command-deck — members plus their add-on flag.
  app.get("/api/org/members/command-deck", requireCap("manageMembers"), async (req: any, res) => {
    const rows = await listMembershipsForOrg(req.organizationId);
    res.json({
      members: rows.map(m => ({
        id: m.id,
        accountId: m.accountId,
        role: m.role,
        status: m.status,
        email: m.email,
        displayName: m.displayName,
        hasCommandDeck: !!m.hasCommandDeck,
        commandDeckGrantedAt: m.commandDeckGrantedAt ?? null,
        commandDeckGrantedBy: m.commandDeckGrantedBy ?? null,
        commandDeckRevokedAt: m.commandDeckRevokedAt ?? null,
        commandDeckRevokedBy: m.commandDeckRevokedBy ?? null,
      })),
      seatCount: await countCommandDeckSeats(req.organizationId),
      unitAmountCents: COMMAND_DECK_ADDON_AMOUNT_CENTS,
    });
  });

  // Shared guard: the target membership must be in the caller's own org, so an
  // admin can't grant a paid seat inside someone else's tenant.
  async function commandDeckTarget(req: any, res: any) {
    const id = parseInt(req.params.membershipId, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ message: "Invalid membership id" }); return null; }
    const target = await getMembership(id);
    if (!target || target.organizationId !== req.organizationId) {
      res.status(404).json({ message: "Member not found in this org" });
      return null;
    }
    if (target.status !== "active") {
      res.status(400).json({ message: "Cannot change Command Deck for an inactive member" });
      return null;
    }
    return target;
  }

  // POST /api/org/members/:membershipId/command-deck — grant the add-on.
  app.post("/api/org/members/:membershipId/command-deck", requireCap("manageMembers"), async (req: any, res) => {
    const target = await commandDeckTarget(req, res);
    if (!target) return;
    const updated = target.hasCommandDeck
      ? target
      : await setMembershipCommandDeck(target.id, true, String(req.account.id));
    // Awaited, not fire-and-forget: the client invalidates billing status right
    // after this resolves, so the seat count it refetches must already be real.
    if (stripe) {
      try {
        await syncCommandDeckSeatsForOrg(stripe, req.organizationId);
      } catch (e) {
        console.error("[command-deck:grant] seat sync failed:", e);
      }
    }
    res.json({ member: updated, seatCount: await countCommandDeckSeats(req.organizationId) });
  });

  // DELETE /api/org/members/:membershipId/command-deck — revoke the add-on.
  app.delete("/api/org/members/:membershipId/command-deck", requireCap("manageMembers"), async (req: any, res) => {
    const target = await commandDeckTarget(req, res);
    if (!target) return;
    const updated = target.hasCommandDeck
      ? await setMembershipCommandDeck(target.id, false, String(req.account.id))
      : target;
    if (stripe) {
      try {
        await syncCommandDeckSeatsForOrg(stripe, req.organizationId);
      } catch (e) {
        console.error("[command-deck:revoke] seat sync failed:", e);
      }
    }
    res.json({ member: updated, seatCount: await countCommandDeckSeats(req.organizationId) });
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
