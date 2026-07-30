import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPwa } from "./lib/pwa";
import { initOfflineQueue } from "./lib/offline-queue";

// Public paths that may be typed, shared, or linked as a real URL. Vercel
// rewrites them all to index.html, so without this the empty hash collapsed to
// "#/" and every one of them rendered the landing page.
const PUBLIC_PATH_ROUTES: Record<string, string> = {
  "/login": "/login",
  "/sign-in": "/login",
  "/signin": "/login",
  "/signup": "/signup",
  "/sign-up": "/signup",
};

if (!window.location.hash) {
  const path = window.location.pathname.replace(/\/+$/, "");
  window.location.hash = `#${PUBLIC_PATH_ROUTES[path] ?? "/"}`;
}

// Register the PWA service worker + wire the offline queue drain listeners
// before the first render so we don't miss the 'online' or SW 'message' events.
initPwa();
initOfflineQueue();

createRoot(document.getElementById("root")!).render(<App />);
