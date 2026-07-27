import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPwa } from "./lib/pwa";
import { initOfflineQueue } from "./lib/offline-queue";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Register the PWA service worker + wire the offline queue drain listeners
// before the first render so we don't miss the 'online' or SW 'message' events.
initPwa();
initOfflineQueue();

createRoot(document.getElementById("root")!).render(<App />);
