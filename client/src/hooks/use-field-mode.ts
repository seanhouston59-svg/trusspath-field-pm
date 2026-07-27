import { useEffect, useState } from "react";

/**
 * Field mode — a chromeless, sidebar-less presentation of the app targeted
 * at foremen and superintendents working on-site. Toggled by:
 *   1) The URL query flag ?field=1 (works from a link or popup window)
 *   2) A sessionStorage flag so we survive Wouter's hash-only routes,
 *      which strip the query on client-side navigation.
 *   3) The PWA display-mode being "standalone" AND the launch URL
 *      containing /field (so an installed homescreen app opens directly
 *      into field mode without needing the query flag).
 *
 * The exit button clears the flag and drops back to the normal chrome.
 *
 * NB: wouter's useHashLocation returns only the pathname and drops the
 * query. That's why we read window.location.hash / search directly and
 * subscribe to hashchange for updates.
 */

const SS_KEY = "trusspath:field-mode";

function readFromUrl(): boolean {
  if (typeof window === "undefined") return false;
  // ?field=1 can live in either search (top-level) or hash (after #).
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("field") === "1") return true;
    // The hash usually looks like "#/field?field=1" — split off the query.
    const hash = window.location.hash || "";
    const qIdx = hash.indexOf("?");
    if (qIdx >= 0) {
      const hq = new URLSearchParams(hash.slice(qIdx + 1));
      if (hq.get("field") === "1") return true;
    }
  } catch { /* URLSearchParams is stable but be defensive */ }
  return false;
}

function readFromSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSession(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(SS_KEY, "1");
    else window.sessionStorage.removeItem(SS_KEY);
  } catch { /* private-mode Safari can throw */ }
}

function readFromInstalledLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;
    if (!standalone) return false;
    // Only auto-enter field mode when the installed app landed on a /field route.
    const hashPath = (window.location.hash || "").split("?")[0];
    return hashPath.startsWith("#/field");
  } catch {
    return false;
  }
}

export function useFieldMode(): { enabled: boolean; exit: () => void; enter: () => void } {
  const [enabled, setEnabled] = useState<boolean>(() => {
    return readFromUrl() || readFromSession() || readFromInstalledLaunch();
  });

  // Re-evaluate on hash changes (in-app navigation between field pages) so
  // the URL flag stays honored even after wouter strips query params.
  useEffect(() => {
    const recompute = () => {
      const fromUrl = readFromUrl();
      const fromSession = readFromSession();
      const fromLaunch = readFromInstalledLaunch();
      const next = fromUrl || fromSession || fromLaunch;
      if (fromUrl) writeSession(true); // sticky: once the URL asks for it, keep it
      setEnabled(next);
    };
    window.addEventListener("hashchange", recompute);
    window.addEventListener("popstate", recompute);
    return () => {
      window.removeEventListener("hashchange", recompute);
      window.removeEventListener("popstate", recompute);
    };
  }, []);

  const enter = () => {
    writeSession(true);
    setEnabled(true);
  };
  const exit = () => {
    writeSession(false);
    setEnabled(false);
  };

  return { enabled, exit, enter };
}
