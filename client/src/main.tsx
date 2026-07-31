import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPwa } from "./lib/pwa";
import { initOfflineQueue } from "./lib/offline-queue";
import { toCommandDeckUrl } from "@shared/app-manifest";

// Vercel rewrites every non-asset path to index.html, so we seed the hash from
// the pathname before wouter mounts. Named aliases (e.g. /sign-in -> /login)
// live in PUBLIC_PATH_ALIASES; every other pathname passes through as-is so
// direct-navs to /admin, /admin/accounts, /admin/demo-accounts, etc. match
// their hash routes instead of collapsing to "#/" and rendering the landing.
const PUBLIC_PATH_ALIASES: Record<string, string> = {
  "/sign-in": "/login",
  "/signin": "/login",
  "/sign-up": "/signup",
};

if (!window.location.hash) {
  const path = window.location.pathname.replace(/\/+$/, "");
  const aliased = PUBLIC_PATH_ALIASES[path] ?? (path || "/");
  // Collapse the pre-rename /executive-os/* pathnames here rather than letting
  // them seed a legacy hash — one rewrite at boot beats a redirect render.
  const target = toCommandDeckUrl(aliased) ?? aliased;
  window.location.hash = `#${target}`;
}

// Register the PWA service worker + wire the offline queue drain listeners
// before the first render so we don't miss the 'online' or SW 'message' events.
initPwa();
initOfflineQueue();

createRoot(document.getElementById("root")!).render(<App />);
