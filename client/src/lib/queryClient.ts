import { QueryClient, QueryFunction } from "@tanstack/react-query";

// API base URL. Resolution order:
//   1. VITE_API_BASE env at build time (used for the pplx.app preview -> Vercel).
//   2. __PORT_5000__ token replaced by deploy_website (sandbox proxy).
//   3. Empty string -> same-origin relative fetch (local dev + Vercel prod).
const BUILD_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";
const PROXY_API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
const API_BASE = BUILD_API_BASE || PROXY_API_BASE;

// When we're calling a different origin (pplx preview -> Vercel), cookies get
// blocked by Safari ITP even with SameSite=None. Fall back to a bearer token
// in memory + Authorization header. Cookies still work fine same-origin.
const IS_CROSS_ORIGIN = (() => {
  try {
    if (!API_BASE) return false;
    if (typeof window === "undefined") return false;
    const base = new URL(API_BASE, window.location.href);
    return base.origin !== window.location.origin;
  } catch {
    return false;
  }
})();

// In-memory bearer token. Only used when we can't rely on cookies (see above).
// Not persisted across page reloads by design — the sandboxed iframe blocks
// localStorage/sessionStorage anyway.
let bearerToken: string | null = null;
export function setBearerToken(t: string | null): void {
  bearerToken = t;
}
export function getBearerToken(): string | null {
  return bearerToken;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...(extra || {}) };
  if (IS_CROSS_ORIGIN && bearerToken) {
    h["Authorization"] = `Bearer ${bearerToken}`;
  }
  return h;
}
const FETCH_CREDS: RequestCredentials = IS_CROSS_ORIGIN ? "omit" : "include";

/** Public paths that should NOT redirect to /login on 401. */
const PUBLIC_HASH_PATHS = new Set<string>(["", "/", "/login", "/signup"]);
/** Hash paths that shouldn't be redirected on 402 (they are the paywall itself or auth flows). */
const PAYWALL_HASH_PATHS = new Set<string>(["", "/", "/login", "/signup", "/paywall"]);

/** Where to send the user after they sign in. Set by handleUnauthorized(). */
let pendingRedirect: string | null = null;
export function consumePendingRedirect(): string {
  const r = pendingRedirect || "/app";
  pendingRedirect = null;
  return r;
}
export function setPendingRedirect(path: string): void {
  pendingRedirect = path;
}

function currentHashPath(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hash || "";
  const raw = h.startsWith("#") ? h.slice(1) : h;
  const q = raw.indexOf("?");
  return q >= 0 ? raw.slice(0, q) : raw;
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  const p = currentHashPath();
  if (PUBLIC_HASH_PATHS.has(p)) return;
  // Remember where they were trying to go so we can bounce back after login.
  pendingRedirect = p || "/app";
  window.location.hash = `/login`;
}

function handlePaywall() {
  if (typeof window === "undefined") return;
  const p = currentHashPath();
  if (PAYWALL_HASH_PATHS.has(p)) return;
  window.location.hash = `/paywall`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    else if (res.status === 402) handlePaywall();
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: buildHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: FETCH_CREDS,
  });

  await throwIfResNotOk(res);
  return res;
}

/** Build a URL that works in dev (relative) and after deploy (proxied). */
export function apiUrl(path: string): string {
  const base = `${API_BASE}${path}`;
  // For cross-origin GETs used directly in <img src>/<a href> we can't set an
  // Authorization header, so append the token as a query param instead.
  if (IS_CROSS_ORIGIN && bearerToken) {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}token=${encodeURIComponent(bearerToken)}`;
  }
  return base;
}

/** POST multipart/form-data. Returns the parsed JSON response. */
export async function apiUpload<T = unknown>(url: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    body: form,
    headers: buildHeaders(),
    credentials: FETCH_CREDS,
  });
  await throwIfResNotOk(res);
  return (await res.json()) as T;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: buildHeaders(),
      credentials: FETCH_CREDS,
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") return null;
      handleUnauthorized();
    }
    if (res.status === 402) handlePaywall();

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
      // Surface failed writes in the console AND as a browser toast so silent
      // 4xx/5xx responses (schema mismatch, missing org, etc.) never disappear.
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error("[trusspath] mutation failed:", msg, err);
        try {
          const ev = new CustomEvent("trusspath:mutation-error", { detail: { message: msg } });
          window.dispatchEvent(ev);
        } catch {}
      },
    },
  },
});
