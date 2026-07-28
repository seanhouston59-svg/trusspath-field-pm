import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  MobilizationPlan, MobilizationItem, MobilizationPermit, MobilizationEquipment,
  MobilizationUtility, MobilizationStaff, MobilizationSub, MobilizationRisk, Milestone,
} from "@shared/schema";
import type { HealthTone } from "@shared/mobilization-catalog";

export type MobilizationBundle = {
  plan: MobilizationPlan | null;
  items: MobilizationItem[];
  permits: MobilizationPermit[];
  equipment: MobilizationEquipment[];
  utilities: MobilizationUtility[];
  staff: MobilizationStaff[];
  subs: MobilizationSub[];
  risks: MobilizationRisk[];
  milestones: Milestone[];
  seeded: boolean;
};

export type PermitStatusCounts = {
  approved: number; pending: number; notStarted: number; blocked: number; total: number;
};

export type MobilizationHealth = {
  overallPct: number;
  sectionPct: Record<string, number>;
  permitStatus: PermitStatusCounts;
  equipmentOnSitePct: number;
  utilitiesInstalledPct: number;
  staffOnboardedPct: number;
  subsReadyPct: number;
  risksOpen: number;
  milestoneDaysToEarthwork: number | null;
  health: HealthTone;
  seeded: boolean;
};

export type MobilizationPortfolioRow = {
  projectId: number;
  projectName: string;
  seeded: boolean;
  overallPct: number;
  health: HealthTone;
  daysToEarthwork: number | null;
  permitStatus: PermitStatusCounts;
  risksOpen: number;
};

/** The two queries a project's detail page depends on. Mutations invalidate
 *  both so the header ring and the tab contents can never disagree. */
function keysFor(projectId: number | undefined) {
  return {
    bundle: ["/api/projects", projectId, "mobilization"] as const,
    health: ["/api/projects", projectId, "mobilization", "health"] as const,
  };
}

export function useMobilization(projectId: number | undefined) {
  return useQuery<MobilizationBundle>({
    queryKey: keysFor(projectId).bundle,
    enabled: projectId !== undefined,
  });
}

export function useMobilizationHealth(projectId: number | undefined) {
  return useQuery<MobilizationHealth>({
    queryKey: keysFor(projectId).health,
    enabled: projectId !== undefined,
  });
}

export function useMobilizationPortfolio() {
  return useQuery<MobilizationPortfolioRow[]>({ queryKey: ["/api/executive-os/mobilization"] });
}

type Resource = "items" | "permits" | "equipment" | "utilities" | "staff" | "subs" | "risks";

function useInvalidateMobilization(projectId: number | undefined) {
  const qc = useQueryClient();
  const keys = keysFor(projectId);
  return () => {
    qc.invalidateQueries({ queryKey: keys.bundle });
    qc.invalidateQueries({ queryKey: keys.health });
    qc.invalidateQueries({ queryKey: ["/api/executive-os/mobilization"] });
  };
}

/** Create a row in one of the seven mobilization tables. projectId is taken
 *  from the URL server-side, so callers never send it in the body. */
export function useCreateMobilizationRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateMobilization(projectId);
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/mobilization/${resource}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateMobilizationRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateMobilization(projectId);
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/mobilization/${resource}/${id}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteMobilizationRow(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateMobilization(projectId);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/mobilization/${resource}/${id}`);
    },
    onSuccess: invalidate,
  });
}

/** Named wrappers for the resources with dedicated tabs — thin, but they keep
 *  the resource string in one place instead of scattered through the pages. */
export const useUpdateItem = (projectId: number | undefined) =>
  useUpdateMobilizationRow<MobilizationItem>(projectId, "items");
export const useCreateItem = (projectId: number | undefined) =>
  useCreateMobilizationRow<MobilizationItem>(projectId, "items");
export const useCreatePermit = (projectId: number | undefined) =>
  useCreateMobilizationRow<MobilizationPermit>(projectId, "permits");
export const useUpdatePermit = (projectId: number | undefined) =>
  useUpdateMobilizationRow<MobilizationPermit>(projectId, "permits");

/** Seeds a plan for a project created before the Mobilization module shipped. */
export function useSeedMobilization(projectId: number | undefined) {
  const invalidate = useInvalidateMobilization(projectId);
  return useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/projects/${projectId}/mobilization/seed`); },
    onSuccess: invalidate,
  });
}
