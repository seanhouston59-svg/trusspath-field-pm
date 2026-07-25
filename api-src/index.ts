import express from "express";
import { createServer } from "node:http";

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: false }));

let initError: Error | null = null;
let initPromise: Promise<void> | null = null;
let initAttempts = 0;

async function init() {
  initError = null;
  initAttempts += 1;
  try {
    // Ensure the Neon Postgres schema exists and demo data is seeded before
    // handling any request. Idempotent — safe on every cold start.
    const { ensureReady } = await import("../server/storage");
    await ensureReady();
    const { registerRoutes } = await import("../server/routes");
    const httpServer = createServer(app);
    await registerRoutes(httpServer, app);
  } catch (e: any) {
    initError = e;
    console.error(`[api/index] init failed (attempt ${initAttempts}):`, e);
  }
}

initPromise = init();

app.use(async (_req, _res, next) => {
  await initPromise;
  // If the first boot failed (usually a transient fetch error to Neon on cold
  // start), retry up to 5 times with a small delay before serving the request.
  // This prevents a single network hiccup from poisoning the warm function.
  while (initError && initAttempts < 5) {
    await new Promise((r) => setTimeout(r, 500 * initAttempts));
    initPromise = init();
    await initPromise;
  }
  next();
});

app.use((_req, res, next) => {
  if (initError) {
    const raw = String(initError?.message || initError);
    const friendly = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(raw)
      ? "Temporary connection issue reaching the database. Please try again in a moment."
      : raw;
    return res.status(503).json({ ok: false, error: friendly });
  }
  next();
});

export default app;
