import type { Express } from "express";
import type { Server } from "node:http";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { storage } from "./storage";
import { jarvisChat, jarvisBrief } from "./jarvis";
import { runHealthScan } from "./health";
import { sendSignupNotification } from "./mailer";
import { blobPersistMiddleware } from "./blob-persistence";
import {
  insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema,
  insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema,
  insertPunchItemSchema, insertContactSchema, insertEquipmentSchema,
  insertPhotoSchema, insertDocumentSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertMessageSchema, insertNoteSchema, insertMilestoneSchema,
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

// Public paths that do not require auth. Everything else under /api/* requires a session.
const PUBLIC_API = new Set<string>([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  // marketing / landing page endpoints — safe to leave public
  "/api/subscribe",
  "/api/demo-request",
]);

function authMiddleware(req: any, res: any, next: any) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (PUBLIC_API.has(p)) return next();
  const cookies = parseCookies(req.headers?.cookie);
  // Accept token via cookie, Authorization: Bearer header, or ?token= query param
  // (query is used for <img src> / <a href> where headers aren't possible).
  const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = cookies[SESSION_COOKIE] || bearer || queryToken;
  const s = token ? storage.getSession(token) : null;
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

  // Persist SQLite writes to Vercel Blob on every mutation. No-op when
  // BLOB_READ_WRITE_TOKEN is not set (i.e., local dev), so behaviour is
  // identical there.
  app.use(blobPersistMiddleware);

  // Gate all /api/* routes behind auth (except the PUBLIC_API allowlist).
  app.use(authMiddleware);

  /* ------------------------- Auth ------------------------- */
  app.post("/api/auth/signup", (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password, displayName, company } = parsed.data;
    try {
      const account = storage.createAccount(email, password, displayName, company);
      const session = storage.createSession(account.id);
      setSessionCookie(res, session.id);
      // Also return token in body for cross-origin clients that can't rely on cookies.
      res.status(201).json({ account, token: session.id });
    } catch (e: any) {
      const msg = e?.message || "Signup failed";
      const status = /already/i.test(msg) ? 409 : 500;
      res.status(status).json({ message: msg });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password } = parsed.data;
    const account = storage.verifyPassword(email, password);
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    const session = storage.createSession(account.id);
    setSessionCookie(res, session.id);
    res.json({ account, token: session.id });
  });

  app.post("/api/auth/logout", (req: any, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) storage.destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req: any, res) => {
    // Prefer bearer header (cross-origin clients), fall back to cookie.
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? storage.getSession(token) : null;
    if (!s) return res.status(401).json({ account: null });
    res.json({ account: s.account });
  });

  // Team
  app.get("/api/team", (_req, res) => res.json(storage.getTeam()));
  app.post("/api/team", (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createTeamMember(parsed.data));
  });
  app.patch("/api/team/:id", (req, res) => {
    const parsed = insertTeamSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateTeamMember(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Team member not found" });
    res.json(updated);
  });
  app.delete("/api/team/:id", (req, res) => {
    storage.deleteTeamMember(parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Projects
  app.get("/api/projects", (_req, res) => res.json(storage.getProjects()));
  app.get("/api/projects/:id", (req, res) => {
    const project = storage.getProject(parseInt(req.params.id, 10));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });
  app.post("/api/projects", (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createProject(parsed.data));
  });

  // Tasks
  app.get("/api/tasks", (req, res) => res.json(storage.getTasks(pid(req))));
  app.post("/api/tasks", (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createTask(parsed.data));
  });
  app.patch("/api/tasks/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateTaskStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });

  // RFIs
  app.get("/api/rfis", (req, res) => res.json(storage.getRfis(pid(req))));
  app.post("/api/rfis", (req, res) => {
    const parsed = insertRfiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createRfi(parsed.data));
  });
  app.patch("/api/rfis/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateRfiStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "RFI not found" });
    res.json(updated);
  });


  // Submittals
  app.get("/api/submittals", (req, res) => res.json(storage.getSubmittals(pid(req))));
  app.post("/api/submittals", (req, res) => {
    const parsed = insertSubmittalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createSubmittal(parsed.data));
  });
  app.patch("/api/submittals/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateSubmittalStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Submittal not found" });
    res.json(updated);
  });


  // Change orders
  app.get("/api/change-orders", (req, res) => res.json(storage.getChangeOrders(pid(req))));
  app.post("/api/change-orders", (req, res) => {
    const parsed = insertChangeOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createChangeOrder(parsed.data));
  });
  app.patch("/api/change-orders/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateChangeOrderStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Change order not found" });
    res.json(updated);
  });


  // Action items
  app.get("/api/action-items", (req, res) => res.json(storage.getActionItems(pid(req))));
  app.post("/api/action-items", (req, res) => {
    const parsed = insertActionItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createActionItem(parsed.data));
  });
  app.patch("/api/action-items/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateActionItemStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Action item not found" });
    res.json(updated);
  });


  // Daily logs
  app.get("/api/daily-logs", (req, res) => res.json(storage.getDailyLogs(pid(req))));
  app.post("/api/daily-logs", (req, res) => {
    const parsed = insertDailyLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDailyLog(parsed.data));
  });
  app.patch("/api/daily-logs/:id", (req, res) => {
    const parsed = insertDailyLogSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateDailyLog(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Daily log not found" });
    res.json(updated);
  });
  app.delete("/api/daily-logs/:id", (req, res) => {
    storage.deleteDailyLog(parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Punch
  app.get("/api/punch", (req, res) => res.json(storage.getPunchItems(pid(req))));
  app.post("/api/punch", (req, res) => {
    const parsed = insertPunchItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createPunchItem(parsed.data));
  });
  app.patch("/api/punch/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updatePunchStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Punch item not found" });
    res.json(updated);
  });


  // Contacts
  app.get("/api/contacts", (_req, res) => res.json(storage.getContacts()));
  app.post("/api/contacts", (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createContact(parsed.data));
  });
  app.patch("/api/contacts/:id", (req, res) => {
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateContact(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Contact not found" });
    res.json(updated);
  });
  app.delete("/api/contacts/:id", (req, res) => {
    storage.deleteContact(parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Equipment
  app.get("/api/equipment", (req, res) => res.json(storage.getEquipment(pid(req))));
  app.post("/api/equipment", (req, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createEquipment(parsed.data));
  });

  // Photos
  app.get("/api/photos", (req, res) => res.json(storage.getPhotos(pid(req))));
  app.post("/api/photos", (req, res) => {
    const parsed = insertPhotoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createPhoto(parsed.data));
  });

  // Photo file upload (multipart: metadata + image in one request)
  app.post("/api/photos/upload", photoUpload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const takenById = req.body.takenById ? parseInt(req.body.takenById, 10) : undefined;
    const caption = req.body.caption ? String(req.body.caption) : file.originalname;
    const location = req.body.location ? String(req.body.location) : "";
    const date = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = storage.createPhoto({
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
  app.get("/api/photos/:id/file", (req, res) => {
    hydrateSeedPhotos();
    const photo = storage.getPhoto(parseInt(req.params.id, 10));
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
  app.delete("/api/photos/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const photo = storage.getPhoto(id);
    if (photo?.storedFileName) {
      const abs = path.resolve(PHOTO_DIR, photo.storedFileName);
      if (abs.startsWith(PHOTO_DIR + path.sep)) { try { fs.unlinkSync(abs); } catch {} }
    }
    storage.deletePhoto(id);
    res.status(204).end();
  });

  // Documents
  app.get("/api/documents", (req, res) => res.json(storage.getDocuments(pid(req))));
  app.post("/api/documents", (req, res) => {
    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDocument(parsed.data));
  });

  // Document file upload (multipart: metadata + file in one request)
  app.post("/api/documents/upload", upload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : undefined;
    const name = req.body.name ? String(req.body.name) : file.originalname;
    const type = req.body.type ? String(req.body.type) : "Drawing";
    const date = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
    const created = storage.createDocument({
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
  app.get("/api/documents/:id/file", (req, res) => {
    const doc = storage.getDocument(parseInt(req.params.id, 10));
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
  app.delete("/api/documents/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const doc = storage.getDocument(id);
    if (doc?.storedFileName) {
      const abs = path.resolve(UPLOAD_DIR, doc.storedFileName);
      if (abs.startsWith(UPLOAD_DIR + path.sep)) { try { fs.unlinkSync(abs); } catch {} }
    }
    storage.deleteDocument(id);
    res.status(204).end();
  });

  // Blueprints
  app.get("/api/blueprints", (req, res) => res.json(storage.getBlueprints(pid(req))));
  app.post("/api/blueprints", (req, res) => {
    const parsed = insertBlueprintSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createBlueprint(parsed.data));
  });

  // Drone captures
  app.get("/api/drone-captures", (req, res) => res.json(storage.getDroneCaptures(pid(req))));
  app.post("/api/drone-captures", (req, res) => {
    const parsed = insertDroneCaptureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDroneCapture(parsed.data));
  });

  // Milestones
  app.get("/api/milestones", (req, res) => res.json(storage.getMilestones(pid(req))));
  app.post("/api/milestones", (req, res) => {
    const parsed = insertMilestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createMilestone(parsed.data));
  });
  app.patch("/api/milestones/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = storage.updateMilestone(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "not found" });
    res.json(updated);
  });
  app.delete("/api/milestones/:id", (req, res) => {
    storage.deleteMilestone(parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // Drone capture file upload (multipart: metadata + image in one request)
  app.post("/api/drone-captures/upload", droneUpload.single("file"), (req, res) => {
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
    const created = storage.createDroneCapture({
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
  app.get("/api/drone-captures/:id/file", (req, res) => {
    const cap = storage.getDroneCapture(parseInt(req.params.id, 10));
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
  app.delete("/api/drone-captures/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cap = storage.getDroneCapture(id);
    if (cap?.storedFileName) {
      const abs = path.resolve(DRONE_DIR, cap.storedFileName);
      if (abs.startsWith(DRONE_DIR + path.sep)) { try { fs.unlinkSync(abs); } catch {} }
    }
    storage.deleteDroneCapture(id);
    res.status(204).end();
  });

  // Messages
  app.get("/api/messages/:projectId", (req, res) => {
    res.json(storage.getMessages(parseInt(req.params.projectId, 10)));
  });
  app.post("/api/messages", (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createMessage(parsed.data));
  });

  // Notes (sticky)
  app.get("/api/notes", (req, res) => res.json(storage.getNotes(pid(req))));
  app.post("/api/notes", (req, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createNote(parsed.data));
  });
  app.patch("/api/notes/:id", (req, res) => {
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return res.status(400).json({ message: "x,y required" });
    const updated = storage.updateNotePosition(parseInt(req.params.id, 10), x, y);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  });
  app.delete("/api/notes/:id", (req, res) => {
    storage.deleteNote(parseInt(req.params.id, 10));
    res.status(204).end();
  });

  // INTEGRATIONS — connect/disconnect third-party services
  app.get("/api/integrations", (_req, res) => {
    res.json(storage.getIntegrations());
  });
  app.patch("/api/integrations/:key", (req, res) => {
    const key = req.params.key;
    const connected = req.body?.connected === true;
    const config = typeof req.body?.config === "string" ? req.body.config : undefined;
    res.json(storage.setIntegration(key, connected, config));
  });

  // SUBSCRIBE — capture email + plan, notify owner by email
  app.post("/api/subscribe", async (req, res) => {
    const parsed = insertSubscriberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = storage.createSubscriber(parsed.data);
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
    const saved = storage.createDemoRequest(parsed.data);
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
  app.get("/api/admin/signups", (_req, res) => {
    res.json({
      subscribers: storage.listSubscribers(),
      demoRequests: storage.listDemoRequests(),
    });
  });

  // JARVIS — AI assistant
  app.get("/api/jarvis/brief", async (req, res) => {
    try {
      const result = await jarvisBrief(pid(req));
      res.json(result);
    } catch (err) {
      console.error("[jarvis] brief error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app.post("/api/jarvis/chat", async (req, res) => {
    try {
      const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const result = await jarvisChat(pid(req), history);
      res.json(result);
    } catch (err) {
      console.error("[jarvis] chat error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });

  // SETTINGS — app preferences (persisted server-side; localStorage is blocked)
  app.get("/api/settings", (_req, res) => {
    res.json(storage.getSettings());
  });
  app.patch("/api/settings", (req, res) => {
    const patch = req.body && typeof req.body === "object" ? req.body : {};
    res.json(storage.updateSettings(patch));
  });

  // APP HEALTH SCAN — link + module integrity (deterministic, no AI)
  app.get("/api/jarvis/health-scan", (_req, res) => {
    try { res.json(runHealthScan()); }
    catch (err) { console.error("[health] scan error:", err); res.status(500).json({ message: "Health scan failed." }); }
  });

  // RESEED — gated destructive reset; requires { confirm: "RESET" }
  app.post("/api/reseed", (req, res) => {
    if (req.body?.confirm !== "RESET") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'RESET' } to wipe and reseed demo data." });
    }
    storage.resetAllData();
    res.json({ ok: true, reseededAt: new Date().toISOString() });
  });

  return _httpServer;
}
