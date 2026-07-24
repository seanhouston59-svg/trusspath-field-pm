/**
 * Blob-backed durable persistence for the SQLite file on Vercel.
 *
 * Vercel serverless functions can only write to /tmp, and /tmp is ephemeral —
 * writes are lost on cold start and are not shared across concurrent instances.
 * This module fixes that by treating Vercel Blob as the source of truth:
 *
 *   1. On cold start we PULL the latest data.db from blob into /tmp before the
 *      first request touches the DB. Falls back to the bundled seed if no blob
 *      exists yet (first run).
 *   2. After every successful mutation (non-GET response) we schedule a
 *      debounced PUSH: the SQLite file is uploaded back to blob. Bursts of
 *      writes coalesce into a single upload.
 *   3. Uploads are best-effort — a failure just leaves the local /tmp copy
 *      intact; subsequent writes will retry.
 *
 * All behaviour is gated on BLOB_READ_WRITE_TOKEN being set. In local dev the
 * module is a no-op and writes go directly to ./data.db as before.
 */
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { put, head } from "@vercel/blob";
import type { RequestHandler } from "express";

const BLOB_KEY = "trusspath/data.db";
const TMP_DB = "/tmp/data.db";
const DEBOUNCE_MS = 500;

function hasToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Pull the latest snapshot from Vercel Blob into /tmp/data.db.
 * Called synchronously by storage.ts before opening the SQLite handle, so this
 * uses a sync XHR-style workaround via node's fetch + Atomics.wait? No — we
 * can't do sync fetch. Instead the caller invokes `initBlobSnapshotSync()`
 * which blocks the event loop briefly using a child_process trick, OR we
 * expose an async init that must be awaited before the server starts.
 *
 * Simplest and correct: expose `initBlobSnapshot()` as async. The Vercel
 * handler (api/index.js) awaits it before delegating to Express. In local dev
 * it's a no-op.
 *
 * Returns true if a snapshot was restored; false if none exists yet (first
 * boot) or the token is not configured.
 */
export async function initBlobSnapshot(): Promise<boolean> {
  if (!hasToken()) return false;
  if (existsSync(TMP_DB)) {
    // A warm invocation — /tmp already has our DB. Nothing to do.
    return true;
  }
  try {
    // `head` throws if the blob doesn't exist. We need the download URL.
    const meta = await head(BLOB_KEY, { token: process.env.BLOB_READ_WRITE_TOKEN });
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(TMP_DB, buf);
    console.log(`[blob] restored data.db from blob (${buf.length} bytes)`);
    return true;
  } catch (err: any) {
    // First-ever run — no blob yet, so we let storage.ts seed from the bundled
    // data.db as normal. Subsequent writes will create the blob.
    console.log(`[blob] no existing snapshot (${err?.message ?? "unknown"}); using bundled seed`);
    return false;
  }
}

let pending: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;
let dirtyDuringFlight = false;

/**
 * Mark the SQLite file as needing an upload. Coalesces bursts into a single
 * upload via debounce; if an upload is in flight we remember to re-upload
 * once it completes.
 */
export function markDirty(): void {
  if (!hasToken()) return;
  if (inFlight) {
    dirtyDuringFlight = true;
    return;
  }
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    void flush();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (!hasToken()) return;
  if (!existsSync(TMP_DB)) return;
  inFlight = (async () => {
    try {
      const buf = readFileSync(TMP_DB);
      await put(BLOB_KEY, buf, {
        access: "public", // Blob API requires this; the token gates writes.
        addRandomSuffix: false, // Overwrite in place at the same key.
        allowOverwrite: true,
        contentType: "application/x-sqlite3",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const { size } = statSync(TMP_DB);
      console.log(`[blob] uploaded data.db (${size} bytes)`);
    } catch (err: any) {
      console.error(`[blob] upload failed: ${err?.message ?? err}`);
    } finally {
      inFlight = null;
      if (dirtyDuringFlight) {
        dirtyDuringFlight = false;
        markDirty();
      }
    }
  })();
  await inFlight;
}

/**
 * Express middleware: after any non-GET/HEAD request completes successfully,
 * mark the DB dirty so a background upload runs.
 *
 * We hook `res.on("finish")` so the response is already sent to the client —
 * the user never waits on the blob upload.
 */
export const blobPersistMiddleware: RequestHandler = (req, res, next) => {
  if (!hasToken()) return next();
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  res.on("finish", () => {
    // Only sync on 2xx; failed requests don't necessarily change the DB, but
    // being safe is cheap.
    if (res.statusCode >= 200 && res.statusCode < 400) markDirty();
  });
  next();
};

/**
 * Force a synchronous-ish flush before the process exits (best effort — Vercel
 * serverless doesn't give us a real shutdown hook, but this helps in long-lived
 * dev and staging deploys).
 */
export async function forceFlush(): Promise<void> {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  await flush();
  if (inFlight) await inFlight;
}
