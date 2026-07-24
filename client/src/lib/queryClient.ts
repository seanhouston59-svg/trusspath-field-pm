import { QueryClient, QueryFunction } from "@tanstack/react-query";

// API base URL. Resolution order:
//   1. VITE_API_BASE env at build time (used for the pplx.app preview -> Vercel).
//   2. __PORT_5000__ token replaced by deploy_website (sandbox proxy).
//   3. Empty string -> same-origin relative fetch (local dev + Vercel prod).
const BUILD_API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || "";
const PROXY_API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
const API_BASE = BUILD_API_BASE || PROXY_API_BASE;

/** Public paths that should NOT redirect to /login on 401. */
const PUBLIC_HASH_PATHS = new Set<string>(["", "/", "/login", "/signup"]);

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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
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
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

/** Build a URL that works in dev (relative) and after deploy (proxied). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

/** POST multipart/form-data. Returns the parsed JSON response. */
export async function apiUpload<T = unknown>(url: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: "POST",
    body: form,
    credentials: "include",
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
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, { credentials: "include" });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") return null;
      handleUnauthorized();
    }

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
    },
  },
});
