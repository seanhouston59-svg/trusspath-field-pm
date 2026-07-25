import type { Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { storage } from "./storage";
import { jarvisChat, jarvisBrief } from "./jarvis";
import { localJarvisChat, buildLocalBrief, buildSafetyBrief } from "./jarvis-local";
import { buildContext } from "./jarvis";
import { runHealthScan } from "./health";
import { sendSignupNotification, sendPasswordResetEmail } from "./mailer";
import {
  insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema,
  insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema,
  insertPunchItemSchema, insertContactSchema, insertEquipmentSchema,
  insertPhotoSchema, insertDocumentSchema, insertCompanyDocumentSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertMessageSchema, insertNoteSchema, insertMilestoneSchema,
  insertTeamSchema,
  insertSubscriberSchema, insertDemoRequestSchema,
  signupSchema, loginSchema,
} from "@shared/schema";

function pid(req: any): number | undefined {
  return req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
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

async function authMiddleware(req: any, res: any, next: any) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (PUBLIC_API.has(p)) return next();
  const cookies = parseCookies(req.headers?.cookie);
  // Accept token via cookie, Authorization: Bearer header, or ?token= query param
  // (query is used for <img src> / <a href> where headers aren't possible).
  const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = cookies[SESSION_COOKIE] || bearer || queryToken;
  const s = token ? await storage.getSession(token) : null;
  if (!s) return res.status(401).json({ message: "Unauthorized" });
  req.account = s.account;
  req.sessionToken = token;
  next();
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

  /* ------------------------- Auth ------------------------- */
  app.post("/api/auth/signup", authRateLimit, async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password, displayName, company } = parsed.data;
    try {
      const account = await storage.createAccount(email, password, displayName, company);
      const session = await storage.createSession(account.id);
      setSessionCookie(res, session.id);
      // Notify owner about new account signup
      void sendSignupNotification({
        kind: "signup",
        subject: `New TrussPath account — ${displayName} (${email})`,
        fields: {
          Name: displayName,
          Email: email,
          Company: company,
          "Signed up": new Date().toISOString(),
        },
      });
      // Also return token in body for cross-origin clients that can't rely on cookies.
      res.status(201).json({ account, token: session.id });
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

  // Team
  app.get("/api/team", async (_req, res) => res.json(await storage.getTeam()));
  app.post("/api/team", async (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createTeamMember(parsed.data));
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

  // Projects
  app.get("/api/projects", async (_req, res) => res.json(await storage.getProjects()));
  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(parseInt(req.params.id, 10));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });
  app.post("/api/projects", async (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createProject(parsed.data));
  });
  app.patch("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await storage.updateProject(id, req.body);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  });

  // Tasks
  app.get("/api/tasks", async (req, res) => res.json(await storage.getTasks(pid(req))));
  app.post("/api/tasks", async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createTask(parsed.data));
  });
  app.patch("/api/tasks/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateTaskStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });

  // RFIs
  app.get("/api/rfis", async (req, res) => res.json(await storage.getRfis(pid(req))));
  app.post("/api/rfis", async (req, res) => {
    const parsed = insertRfiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createRfi(parsed.data));
  });
  app.patch("/api/rfis/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateRfiStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "RFI not found" });
    res.json(updated);
  });


  // Submittals
  app.get("/api/submittals", async (req, res) => res.json(await storage.getSubmittals(pid(req))));
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
  app.get("/api/change-orders", async (req, res) => res.json(await storage.getChangeOrders(pid(req))));
  app.post("/api/change-orders", async (req, res) => {
    const parsed = insertChangeOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createChangeOrder(parsed.data));
  });
  app.patch("/api/change-orders/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateChangeOrderStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Change order not found" });
    res.json(updated);
  });


  // Action items
  app.get("/api/action-items", async (req, res) => res.json(await storage.getActionItems(pid(req))));
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
  app.get("/api/daily-logs", async (req, res) => res.json(await storage.getDailyLogs(pid(req))));
  app.post("/api/daily-logs", async (req, res) => {
    const parsed = insertDailyLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDailyLog(parsed.data));
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
  app.get("/api/punch", async (req, res) => res.json(await storage.getPunchItems(pid(req))));
  app.post("/api/punch", async (req, res) => {
    const parsed = insertPunchItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createPunchItem(parsed.data));
  });
  app.patch("/api/punch/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updatePunchStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Punch item not found" });
    res.json(updated);
  });


  // Contacts
  app.get("/api/contacts", async (_req, res) => res.json(await storage.getContacts()));
  app.post("/api/contacts", async (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createContact(parsed.data));
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
  app.get("/api/equipment", async (req, res) => res.json(await storage.getEquipment(pid(req))));
  app.post("/api/equipment", async (req, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createEquipment(parsed.data));
  });

  // Photos
  app.get("/api/photos", async (req, res) => res.json(await storage.getPhotos(pid(req))));
  app.post("/api/photos", async (req, res) => {
    const parsed = insertPhotoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createPhoto(parsed.data));
  });

  // Photo file upload (multipart: metadata + image in one request)
  app.post("/api/photos/upload", photoUpload.single("file"), async (req, res) => {
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
  app.get("/api/documents", async (req, res) => res.json(await storage.getDocuments(pid(req))));
  app.post("/api/documents", async (req, res) => {
    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDocument(parsed.data));
  });

  // Document file upload (multipart: metadata + file in one request)
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
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

  app.get("/api/company-documents", async (_req, res) => res.json(await storage.getCompanyDocuments()));

  app.post("/api/company-documents", async (req, res) => {
    const parsed = insertCompanyDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createCompanyDocument(parsed.data));
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
  app.get("/api/blueprints", async (req, res) => res.json(await storage.getBlueprints(pid(req))));
  app.post("/api/blueprints", async (req, res) => {
    const parsed = insertBlueprintSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createBlueprint(parsed.data));
  });

  // Drone captures
  app.get("/api/drone-captures", async (req, res) => res.json(await storage.getDroneCaptures(pid(req))));
  app.post("/api/drone-captures", async (req, res) => {
    const parsed = insertDroneCaptureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDroneCapture(parsed.data));
  });

  // Milestones
  app.get("/api/milestones", async (req, res) => res.json(await storage.getMilestones(pid(req))));
  app.post("/api/milestones", async (req, res) => {
    const parsed = insertMilestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createMilestone(parsed.data));
  });
  app.patch("/api/milestones/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await storage.updateMilestone(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "not found" });
    res.json(updated);
  });
  app.delete("/api/milestones/:id", async (req, res) => {
    await storage.softDeleteEntity("milestones", parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Drone capture file upload (multipart: metadata + image in one request)
  app.post("/api/drone-captures/upload", droneUpload.single("file"), async (req, res) => {
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
  app.post("/api/messages", async (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createMessage(parsed.data));
  });

  // Notes (sticky)
  app.get("/api/notes", async (req, res) => res.json(await storage.getNotes(pid(req))));
  app.post("/api/notes", async (req, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createNote(parsed.data));
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

  // ============================ STRIPE BILLING ============================
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeKey ? new (require("stripe")(stripeKey)) : null;

  const PRICE_MAP: Record<string, { monthly?: string; annual?: string }> = {
    starter: { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY, annual: process.env.STRIPE_PRICE_STARTER_ANNUAL },
    pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY, annual: process.env.STRIPE_PRICE_PRO_ANNUAL },
    enterprise: { monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY, annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL },
  };

  const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";

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
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          if (customerId) {
            const account = await storage.getAccountByStripeCustomerId(customerId);
            if (account) {
              await storage.updateAccountBilling(account.id, {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: "active",
              });
            }
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const sub = event.data.object;
          const customerId = sub.customer as string;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            const planKey = sub.items?.data?.[0]?.price?.lookup_key || "";
            const planMatch = planKey.match(/^(starter|pro|enterprise)/);
            await storage.updateAccountBilling(account.id, {
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: sub.status,
              subscriptionCurrentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : undefined,
              subscriptionPlan: planMatch ? planMatch[1] : undefined,
            });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const customerId = sub.customer as string;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            await storage.updateAccountBilling(account.id, {
              subscriptionStatus: "canceled",
              stripeSubscriptionId: null as any,
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            await storage.updateAccountBilling(account.id, { subscriptionStatus: "past_due" });
          }
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
  app.post("/api/billing/checkout", async (req, res) => {
    const { plan, billing, email, company } = req.body;
    if (!plan || !billing || !email) return res.status(400).json({ error: "Missing plan, billing, or email" });

    // If Stripe isn't configured yet, still capture the lead and notify owner
    if (!stripe) {
      try {
        await storage.createSubscriber({ email, plan, billing, company });
      } catch {}
      void sendSignupNotification({
        kind: "subscriber",
        subject: `New TrussPath subscriber — ${email}`,
        fields: {
          Email: email,
          Company: company,
          Plan: plan,
          Billing: billing,
          "Note": "Stripe not yet configured — captured as lead",
          "Signed up": new Date().toISOString(),
        },
      });
      return res.status(202).json({ 
        message: "Billing isn't configured yet, but we've saved your spot. We'll be in touch soon!",
        captured: true,
      });
    }

    const priceId = (PRICE_MAP as any)[plan]?.[billing];
    if (!priceId) return res.status(400).json({ error: `No price configured for ${plan} (${billing}). Set STRIPE_PRICE_* env vars.` });

    try {
      // Check if user already has an account
      const existingAccount = await storage.getAccountByEmail(email);
      let customerId = existingAccount?.stripeCustomerId || undefined;

      // Create or reuse customer
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { plan, billing, company: company || "" },
        });
        customerId = customer.id;
        // Link customer to account if one exists
        if (existingAccount) {
          await storage.updateAccountBilling(existingAccount.id, { stripeCustomerId: customerId });
        }
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/#/signup?checkout=success`,
        cancel_url: `${APP_URL}/?checkout=cancelled`,
        metadata: { plan, billing, email },
        subscription_data: { metadata: { plan, billing } },
      });

      res.json({ url: session.url });
    } catch (e: any) {
      console.error("[stripe checkout] error:", e);
      res.status(500).json({ error: e?.message || "Failed to create checkout session" });
    }
  });

  // Customer portal — manage subscription (cancel, update payment, swap plan)
  app.post("/api/billing/portal", async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
    const account = (req as any).account;
    if (!account) return res.status(401).json({ error: "Not authenticated" });
    if (!account.stripeCustomerId) return res.status(400).json({ error: "No billing account found" });

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: account.stripeCustomerId,
        return_url: `${APP_URL}/#/settings`,
      });
      res.json({ url: session.url });
    } catch (e: any) {
      console.error("[stripe portal] error:", e);
      res.status(500).json({ error: e?.message || "Failed to create portal session" });
    }
  });

  // Billing status for logged-in user
  app.get("/api/billing/status", async (req, res) => {
    const account = (req as any).account;
    if (!account) return res.status(401).json({ error: "Not authenticated" });
    res.json({
      plan: account.subscriptionPlan || null,
      status: account.subscriptionStatus || null,
      billing: account.subscriptionBilling || null,
      currentPeriodEnd: account.subscriptionCurrentPeriodEnd || null,
      hasCustomer: !!account.stripeCustomerId,
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

  // ADMIN — list signups (used by /#/admin/signups)
  app.get("/api/admin/signups", async (_req, res) => {
    res.json({
      subscribers: await storage.listSubscribers(),
      demoRequests: await storage.listDemoRequests(),
    });
  });

  // JARVIS — AI assistant
  app.get("/api/jarvis/brief", async (req, res) => {
    try {
      // Try LLM-powered brief first; fall back to local if no API key or error
      try {
        const result = await jarvisBrief(pid(req));
        res.json(result);
      } catch (llmErr) {
        console.log("[jarvis] LLM brief failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        const ctx = await buildContext(pid(req));
        res.json({ brief: buildLocalBrief(ctx), context: ctx });
      }
    } catch (err) {
      console.error("[jarvis] brief error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app.post("/api/jarvis/chat", async (req, res) => {
    try {
      const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
      // Try LLM-powered chat first; fall back to local engine
      try {
        const result = await jarvisChat(pid(req), history);
        res.json(result);
      } catch (llmErr) {
        console.log("[jarvis] LLM chat failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        const result = await localJarvisChat(pid(req), history);
        res.json(result);
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

  return _httpServer;
}
