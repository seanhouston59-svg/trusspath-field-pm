import express from "express";
import { createServer } from "node:http";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false }));

let initError: Error | null = null;
let initPromise: Promise<void> | null = null;

async function init() {
  try {
    // Pull the latest SQLite snapshot from Vercel Blob before opening the DB.
    // No-op locally (no BLOB_READ_WRITE_TOKEN) or on the first-ever cold start
    // (no snapshot exists yet), in which case storage.ts falls back to the
    // bundled seed.
    const { initBlobSnapshot } = await import("../server/blob-persistence");
    await initBlobSnapshot();
    const { registerRoutes } = await import("../server/routes");
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
  } catch (e: any) {
    initError = e;
    console.error("[api/index] init failed:", e);
  }
}

initPromise = init();

app.use(async (_req, _res, next) => {
  await initPromise;
  next();
});

app.use((_req, res, next) => {
  if (initError) return res.status(500).json({ ok: false, error: String(initError?.message || initError) });
  next();
});

export default app;
