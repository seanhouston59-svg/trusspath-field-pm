import { migrate } from "./migrations";

// Ensure schema is ready before any query. Idempotent + memoized.
// Seeding is NOT automatic — only happens via explicit resetAllData() call.
// On failure the cached promise is cleared so the next request retries — a
// transient fetch error to Neon during cold-start init must not poison the
// warm function instance forever.
let initPromise: Promise<void> | null = null;
export function ensureReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}
