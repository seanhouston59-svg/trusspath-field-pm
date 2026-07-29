/**
 * Fetch helpers for the Sub Drop Portal (public / sub-authenticated).
 *
 * Kept deliberately separate from `queryClient.ts` because:
 *   - The sub endpoints use their own cookie (`tp_sub_session`), not the GC
 *     session cookie. We don't want the GC bearer/redirect logic to leak in.
 *   - A 401 from `/api/sub/me` is expected on first visit and MUST NOT bounce
 *     the user to `/login` \u2014 they're on the public /drop page.
 *   - The bundle stays lean: the sub PWA doesn't need react-query yet.
 */

// Same resolution rules as the GC API base so preview and prod both work.
const BUILD_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";
const PROXY_API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
export const SUB_API_BASE = BUILD_API_BASE || PROXY_API_BASE;

// Cross-origin: same rule as queryClient.ts \u2014 skip cookies and use a bearer
// token instead (Safari ITP kills third-party cookies).
const IS_CROSS_ORIGIN = (() => {
  try {
    if (!SUB_API_BASE) return false;
    if (typeof window === "undefined") return false;
    const base = new URL(SUB_API_BASE, window.location.href);
    return base.origin !== window.location.origin;
  } catch { return false; }
})();

// In-memory bearer token specific to the sub session. Distinct from the GC
// bearerToken so the two identity spaces never bleed into one another.
let subBearer: string | null = null;
export function setSubBearer(t: string | null): void { subBearer = t; }
export function getSubBearer(): string | null { return subBearer; }

const FETCH_CREDS: RequestCredentials = IS_CROSS_ORIGIN ? "omit" : "include";

function headers(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (IS_CROSS_ORIGIN && subBearer) h["Authorization"] = `Bearer ${subBearer}`;
  return h;
}

/** Low-level: never redirects on 401. Throws with the response body on !ok. */
export async function subFetch(
  method: string, url: string, data?: unknown,
): Promise<Response> {
  const res = await fetch(`${SUB_API_BASE}${url}`, {
    method,
    headers: headers(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: FETCH_CREDS,
  });
  return res;
}

/** JSON convenience wrapper. Returns `null` on 401 so callers can branch. */
export async function subJson<T>(
  method: string, url: string, data?: unknown,
): Promise<T | null> {
  const res = await subFetch(method, url, data);
  if (res.status === 401) return null;
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Multipart upload. Same auth semantics as subFetch. */
export async function subUpload<T = unknown>(url: string, form: FormData): Promise<T> {
  const res = await fetch(`${SUB_API_BASE}${url}`, {
    method: "POST",
    body: form,
    headers: headers(),
    credentials: FETCH_CREDS,
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `Upload failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
