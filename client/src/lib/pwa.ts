/* PWA registration + install prompt helper.
 *
 * Registers the service worker at /sw.js on first load. Captures the
 * beforeinstallprompt event so the app can trigger install from inside
 * the UI (Chrome/Edge/Android). iOS Safari has to be walked through
 * "Add to Home Screen" manually — we detect standalone mode so we
 * only nag when they're still in-browser.
 */

let installPromptEvent: any = null;
const installListeners = new Set<(available: boolean) => void>();

export function initPwa() {
  if (typeof window === "undefined") return;

  // Register the service worker (only in production — dev serves HMR that
  // conflicts with SW caching).
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });
    });
  }

  // Capture the install prompt so the app can trigger it later.
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    installPromptEvent = e;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    installPromptEvent = null;
    notifyListeners();
  });
}

function notifyListeners() {
  const available = !!installPromptEvent;
  installListeners.forEach((cb) => { try { cb(available); } catch (_) {} });
}

export function subscribeInstallPrompt(cb: (available: boolean) => void): () => void {
  installListeners.add(cb);
  cb(!!installPromptEvent);
  return () => { installListeners.delete(cb); };
}

// Trigger the browser install dialog. Returns true if the user accepted.
export async function triggerInstall(): Promise<boolean> {
  if (!installPromptEvent) return false;
  try {
    installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    installPromptEvent = null;
    notifyListeners();
    return choice.outcome === "accepted";
  } catch (_) {
    return false;
  }
}

// Are we running as an installed PWA (standalone mode)?
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari sets navigator.standalone
    (navigator as any).standalone === true
  );
}

// iOS detection so we can show a text-based install hint on Safari.
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(navigator as any).MSStream;
}
