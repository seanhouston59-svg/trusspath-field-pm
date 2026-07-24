import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiUrl, queryClient, setBearerToken, getBearerToken } from "./queryClient";
import type { AccountPublic } from "@shared/schema";

type MeResponse = { account: AccountPublic | null };
type LoginResponse = { account: AccountPublic; token?: string };

type AuthContextValue = {
  account: AccountPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AccountPublic>;
  signup: (data: { email: string; password: string; displayName: string; company?: string }) => Promise<AccountPublic>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Bypass the global on401=throw behavior for this query — we want
  // an unauthenticated response, not a redirect, so we can render the landing/login pages.
  const meQuery = useQuery<MeResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      // If we have no bearer token and we're cross-origin, skip the network round-trip.
      // (Cookies can't reach the cross-origin API in strict browsers like Safari.)
      const bearer = getBearerToken();
      const headers: Record<string, string> = {};
      if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers,
        credentials: "include",
      });
      if (res.status === 401) return { account: null };
      if (!res.ok) throw new Error(`Auth check failed: ${res.status}`);
      return (await res.json()) as MeResponse;
    },
    staleTime: 60_000,
    retry: false,
  });

  const loginMut = useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", creds);
      const json = (await res.json()) as LoginResponse;
      if (json.token) setBearerToken(json.token);
      return json.account;
    },
    onSuccess: (account) => {
      queryClient.setQueryData<MeResponse>(["/api/auth/me"], { account });
      // Invalidate all protected data so authorized queries refetch with the new session.
      queryClient.invalidateQueries();
    },
  });

  const signupMut = useMutation({
    mutationFn: async (data: { email: string; password: string; displayName: string; company?: string }) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      const json = (await res.json()) as LoginResponse;
      if (json.token) setBearerToken(json.token);
      return json.account;
    },
    onSuccess: (account) => {
      queryClient.setQueryData<MeResponse>(["/api/auth/me"], { account });
      queryClient.invalidateQueries();
    },
  });

  const logoutMut = useMutation({
    mutationFn: async () => {
      try { await apiRequest("POST", "/api/auth/logout"); } catch {}
      setBearerToken(null);
    },
    onSuccess: () => {
      queryClient.setQueryData<MeResponse>(["/api/auth/me"], { account: null });
      queryClient.clear();
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      account: meQuery.data?.account ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: !!meQuery.data?.account,
      login: (email, password) => loginMut.mutateAsync({ email, password }),
      signup: (data) => signupMut.mutateAsync(data),
      logout: async () => {
        await logoutMut.mutateAsync();
      },
    }),
    [meQuery.data, meQuery.isLoading, loginMut, signupMut, logoutMut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
