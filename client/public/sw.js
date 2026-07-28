/* TrussPath service worker.
 *
 * Two responsibilities:
 * 1) App-shell cache-first for the SPA entry so foremen can open the app
 *    with zero bars. When online, we revalidate in the background.
 * 2) Background sync trigger — the queued API requests live in IndexedDB
 *    (see client/src/lib/offline-queue.ts). This worker listens for a
 *    'sync' event with tag "trusspath-queue" and posts a message to any
 *    open client so it drains the queue. Falls back to a periodic ping
 *    every 5 minutes when 'sync' isn't supported (iOS).
 *
 * The service worker is deliberately conservative — we do NOT precache
 * every hashed asset because Vite ships them under versioned names and
 * we'd rather let the browser cache them naturally than risk stale bundles.
 */

const CACHE_VERSION = "trusspath-v51";
const APP_SHELL = "/";
const OFFLINE_FALLBACK = "/";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Warm the app shell so the first offline hit still renders the SPA.
    try { await cache.add(new Request(APP_SHELL, { cache: "reload" })); } catch (_) {}
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Purge caches from older versions.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache API calls — those go through the offline queue.
  if (url.pathname.startsWith("/api/")) return;

  // For same-origin navigation requests, serve the app shell offline.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const network = await fetch(req);
        // Update the shell in the background.
        const cache = await caches.open(CACHE_VERSION);
        try { await cache.put(APP_SHELL, network.clone()); } catch (_) {}
        return network;
      } catch (_) {
        const cache = await caches.open(CACHE_VERSION);
        const cached = await cache.match(APP_SHELL) || await cache.match(OFFLINE_FALLBACK);
        return cached || new Response("Offline. Reconnect to load TrussPath.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }
    })());
    return;
  }

  // Same-origin static assets — stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);
      const network = fetch(req).then((resp) => {
        if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
        return resp;
      }).catch(() => null);
      return cached || (await network) || new Response("", { status: 504 });
    })());
  }
});

// Background sync — supported on Chrome/Android. Post a message to
// open clients so they know to drain the offline queue.
self.addEventListener("sync", (event) => {
  if (event.tag === "trusspath-queue") {
    event.waitUntil(broadcastDrain());
  }
});

// iOS Safari doesn't support 'sync'. We fall back to a periodic ping
// via message-passing when the SW starts.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PING_DRAIN") {
    broadcastDrain();
  }
});

async function broadcastDrain() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of clients) {
    c.postMessage({ type: "DRAIN_QUEUE" });
  }
}
