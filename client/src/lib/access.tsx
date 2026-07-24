import { createContext, useContext, useState, type ReactNode } from "react";
import {
  ACCESS_LEVELS, ACCESS_BY_SLUG, DEFAULT_ACCESS_LEVEL, isRouteAllowed,
  type AccessLevel, type AccessLevelDef, type AccessCapabilities,
} from "@shared/access-levels";

type CapKey =
  | "canManageTeam" | "canManageSettings" | "canManageIntegrations"
  | "canViewFinancials" | "canDelete" | "canCreateEdit" | "canResetData";

interface AccessCtxValue {
  level: AccessLevel;
  def: AccessLevelDef;
  setLevel: (l: AccessLevel) => void;
  can: (k: CapKey) => boolean;
  isAllowed: (path: string) => boolean;
}

const AccessCtx = createContext<AccessCtxValue | null>(null);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<AccessLevel>(DEFAULT_ACCESS_LEVEL);
  const def = ACCESS_BY_SLUG[level];
  const can = (k: CapKey) => Boolean((def as AccessCapabilities)[k]);
  const isAllowed = (path: string) => isRouteAllowed(level, path);
  return (
    <AccessCtx.Provider value={{ level, def, setLevel, can, isAllowed }}>
      {children}
    </AccessCtx.Provider>
  );
}

export function useAccess() {
  const ctx = useContext(AccessCtx);
  if (!ctx) throw new Error("useAccess must be used within AccessProvider");
  return ctx;
}

export { ACCESS_LEVELS };
