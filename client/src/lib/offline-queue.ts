/* Offline-first request queue for the mobile foreman flow.
 *
 * Foremen work in dead zones. When they submit a daily log or clock in from
 * a basement, we don't want to lose that write — we persist the request to
 * IndexedDB, show optimistic UI, and drain the queue as soon as we're back
 * online. If the tab is closed, the service worker's 'sync' event (or the
 * next page load) picks up where we left off.
 *
 * This module is deliberately dependency-free — no idb, no dexie. Raw
 * IndexedDB with a tiny promise wrapper. Each queued request is a plain
 * JSON row with the URL, method, headers, and body (base64-encoded if it's
 * a Blob so photos survive serialization).
 *
 * Public API:
 *   queueRequest({ url, method, body, headers, kind, meta })  -> id
 *   drainQueue()  -> processes all pending items
 *   subscribeQueue(cb) -> notified whenever the queue length changes
 *   getQueueSize() -> number of pending items
 */

const DB_NAME = "trusspath-offline";
const DB_VERSION = 1;
const STORE_NAME = "queue";

export type QueuedKind = "daily-log" | "timecard" | "photo" | "observation" | "punch-item" | "punch-status" | "generic";

export type QueuedRequest = {
  id?: number;
  createdAt: string;
  kind: QueuedKind;
  url: string;
  method: string;
  headers?: Record<string, string>;
  // Serialized JSON body OR base64 blob envelope { __blob: base64, type: mime }
  body?: unknown;
  // Free-form metadata (e.g. projectId, tempId for optimistic reconciliation).
  meta?: Record<string, unknown>;
  attempts: number;
  lastError?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<(size: number) => void>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB not available")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("kind", "kind", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => T | Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    Promise.resolve(fn(store)).then(resolve, reject);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function notifyListeners() {
  const size = await getQueueSize();
  listeners.forEach((cb) => { try { cb(size); } catch (_) {} });
}

export async function queueRequest(row: Omit<QueuedRequest, "id" | "attempts" | "createdAt">): Promise<number> {
  const payload: Omit<QueuedRequest, "id"> = {
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...row,
  };
  const id = await withStore("readwrite", (store) => req(store.add(payload) as IDBRequest<number>));
  await notifyListeners();
  // Ask the service worker (if any) to schedule a background sync.
  requestBackgroundSync().catch(() => {});
  return id;
}

export async function getQueueSize(): Promise<number> {
  try {
    return await withStore("readonly", (store) => req(store.count()));
  } catch { return 0; }
}

export async function listQueued(): Promise<QueuedRequest[]> {
  try {
    return await withStore("readonly", (store) => req(store.getAll() as IDBRequest<QueuedRequest[]>));
  } catch { return []; }
}

export async function removeQueued(id: number): Promise<void> {
  await withStore("readwrite", (store) => req(store.delete(id)));
  await notifyListeners();
}

async function updateQueued(row: QueuedRequest): Promise<void> {
  await withStore("readwrite", (store) => req(store.put(row) as IDBRequest<IDBValidKey>));
}

// Drain: iterate all queued items, POST them, remove on success, bump attempts
// on failure. Retries with exponential backoff are handled by the caller
// (drainQueue is idempotent — call again later).
let draining = false;
export async function drainQueue(): Promise<{ succeeded: number; failed: number; remaining: number }> {
  if (draining) return { succeeded: 0, failed: 0, remaining: await getQueueSize() };
  draining = true;
  let succeeded = 0;
  let failed = 0;
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { succeeded: 0, failed: 0, remaining: await getQueueSize() };
    }
    const items = await listQueued();
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of items) {
      try {
        const body = await materializeBody(item.body);
        const resp = await fetch(item.url, {
          method: item.method,
          headers: { "Content-Type": "application/json", ...(item.headers || {}) },
          body,
          credentials: "include",
        });
        if (resp.ok) {
          if (item.id !== undefined) await removeQueued(item.id);
          succeeded++;
        } else if (resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
          // Permanent client error — drop it so we don't loop forever.
          if (item.id !== undefined) await removeQueued(item.id);
          failed++;
        } else {
          item.attempts = (item.attempts || 0) + 1;
          item.lastError = `HTTP ${resp.status}`;
          await updateQueued(item);
          failed++;
        }
      } catch (err: any) {
        item.attempts = (item.attempts || 0) + 1;
        item.lastError = String(err?.message || err);
        await updateQueued(item);
        failed++;
      }
    }
  } finally {
    draining = false;
    await notifyListeners();
  }
  return { succeeded, failed, remaining: await getQueueSize() };
}

// Body can be plain JSON-serializable or a Blob envelope { __blob, type }.
// We serialize to string for storage; on drain, rehydrate to whichever form
// fetch() expects.
async function materializeBody(body: unknown): Promise<string | undefined> {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  return JSON.stringify(body);
}

// Encode a Blob as base64 for storage in the queue.
export async function blobToEnvelope(blob: Blob): Promise<{ __blob: string; type: string; size: number }> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return { __blob: btoa(binary), type: blob.type || "application/octet-stream", size: blob.size };
}

// Ask the browser to schedule a background sync. No-op if unsupported.
async function requestBackgroundSync() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.ready) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    // @ts-ignore - sync isn't in TS lib.dom by default
    if (reg.sync) await reg.sync.register("trusspath-queue");
  } catch (_) { /* not supported */ }
}

export function subscribeQueue(cb: (size: number) => void): () => void {
  listeners.add(cb);
  getQueueSize().then(cb).catch(() => {});
  return () => { listeners.delete(cb); };
}

// Install listeners so we drain when we come back online or when the SW says so.
export function initOfflineQueue() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => { drainQueue().catch(() => {}); });
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data && event.data.type === "DRAIN_QUEUE") {
        drainQueue().catch(() => {});
      }
    });
  }
  // Attempt one drain on load in case we just came back to the tab.
  if (typeof navigator !== "undefined" && navigator.onLine !== false) {
    drainQueue().catch(() => {});
  }
}
