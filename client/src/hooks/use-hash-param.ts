import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function read(key: string): string | null {
  const hash = window.location.hash || "";
  const qIdx = hash.indexOf("?");
  if (qIdx >= 0) {
    const fromHash = new URLSearchParams(hash.slice(qIdx + 1)).get(key);
    if (fromHash != null) return fromHash;
  }
  // Externally-generated links (approval emails, bookmarks) can still put the
  // param on the top-level search instead of inside the hash.
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Reads a query param out of the hash route (e.g. "#/rfis?project=3").
 * wouter's location hook strips the query string before route matching, so
 * pages that accept a deep-link filter have to parse the raw hash themselves.
 */
export function useHashParam(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
}
