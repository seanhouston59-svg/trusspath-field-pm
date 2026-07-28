import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  Project, PreConstruction, PreConstructionDesignDoc, PreConstructionDesignRfi,
  PreConstructionVeItem, PreConstructionPermit, PreConstructionPrequalSub,
  PreConstructionBidPackage, PreConstructionLongLeadItem, PreConstructionSignature,
} from "@shared/schema";
import { PRE_CONSTRUCTION_SIGNERS } from "@shared/pre-construction-catalog";

export type PreConstructionBundle = {
  preCon: PreConstruction | null;
  designDocs: PreConstructionDesignDoc[];
  designRfis: PreConstructionDesignRfi[];
  veItems: PreConstructionVeItem[];
  permits: PreConstructionPermit[];
  prequalSubs: PreConstructionPrequalSub[];
  bidPackages: PreConstructionBidPackage[];
  longLeadItems: PreConstructionLongLeadItem[];
  signatures: PreConstructionSignature[];
  seeded: boolean;
};

export type PreConstructionHealth = {
  seeded: boolean;
  status: string;
  designPhase: string | null;
  designCompletionPercent: number | null;
  permitsIssued: number;
  permitsTotal: number;
  criticalPermitsIssued: number;
  criticalPermitsTotal: number;
  missingCriticalPermits: string[];
  prequalApproved: number;
  prequalTotal: number;
  bidPackagesBoughtOut: number;
  bidPackagesTotal: number;
  longLeadItemsAtRisk: number;
  longLeadItemsTotal: number;
  planApproved: boolean;
  completePct: number;
};

/** The portfolio endpoint nests the project rather than flattening name/id onto
 *  the health row the way /executive-os/project-setup does. Kept as-is so the
 *  card can show the plan row's own fields (target dates, lead) without a
 *  second fetch per project. */
export type PreConstructionPortfolioRow = {
  project: Project;
  preCon: PreConstruction | null;
  health: PreConstructionHealth;
};

/** Every query a mutation can invalidate. The gate is included because
 *  approving the plan or issuing a critical permit has to clear the warning
 *  banner on Mobilization without a reload. */
function keysFor(projectId: number | undefined) {
  return {
    bundle: ["/api/projects", projectId, "pre-construction"] as const,
    health: ["/api/projects", projectId, "pre-construction", "health"] as const,
    gate: ["/api/projects", projectId, "mobilization", "gate"] as const,
    portfolio: ["/api/executive-os/pre-construction"] as const,
  };
}

export function usePreConstruction(projectId: number | undefined) {
  return useQuery<PreConstructionBundle>({
    queryKey: keysFor(projectId).bundle,
    enabled: projectId !== undefined,
  });
}

export function usePreConstructionHealth(projectId: number | undefined) {
  return useQuery<PreConstructionHealth>({
    queryKey: keysFor(projectId).health,
    enabled: projectId !== undefined,
  });
}

export function usePreConstructionPortfolio() {
  return useQuery<PreConstructionPortfolioRow[]>({
    queryKey: ["/api/executive-os/pre-construction"],
  });
}

function useInvalidatePreConstruction(projectId: number | undefined) {
  const qc = useQueryClient();
  const keys = keysFor(projectId);
  return () => {
    qc.invalidateQueries({ queryKey: keys.bundle });
    qc.invalidateQueries({ queryKey: keys.health });
    qc.invalidateQueries({ queryKey: keys.gate });
    qc.invalidateQueries({ queryKey: keys.portfolio });
  };
}

/** Partial update of the main row. Every column is optional server-side, so the
 *  intake form can send one field per keystroke-debounce. */
export function useUpdatePreConstruction(projectId: number | undefined) {
  const invalidate = useInvalidatePreConstruction(projectId);
  return useMutation({
    mutationFn: async (data: Partial<PreConstruction>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/pre-construction`, data);
      return (await res.json()) as PreConstruction;
    },
    onSuccess: invalidate,
  });
}

/** Opt-in seed for projects created before this module shipped. Idempotent. */
export function useSeedPreConstruction(projectId: number | undefined) {
  const invalidate = useInvalidatePreConstruction(projectId);
  return useMutation({
    mutationFn: async (override?: number) => {
      const id = override ?? projectId;
      await apiRequest("POST", `/api/projects/${id}/pre-construction/seed`);
    },
    onSuccess: invalidate,
  });
}

type Resource =
  | "design-docs" | "design-rfis" | "ve-items" | "permits"
  | "prequal-subs" | "bid-packages" | "long-lead-items" | "signatures";

export function useCreatePreconRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidatePreConstruction(projectId);
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/pre-construction/${resource}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useUpdatePreconRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidatePreConstruction(projectId);
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/pre-construction/${resource}/${id}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useDeletePreconRow(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidatePreConstruction(projectId);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/pre-construction/${resource}/${id}`);
    },
    onSuccess: invalidate,
  });
}

export const useCreateDesignDoc = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionDesignDoc>(projectId, "design-docs");
export const useUpdateDesignDoc = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionDesignDoc>(projectId, "design-docs");
export const useDeleteDesignDoc = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "design-docs");

export const useCreateDesignRfi = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionDesignRfi>(projectId, "design-rfis");
export const useUpdateDesignRfi = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionDesignRfi>(projectId, "design-rfis");
export const useDeleteDesignRfi = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "design-rfis");

export const useCreateVeItem = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionVeItem>(projectId, "ve-items");
export const useUpdateVeItem = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionVeItem>(projectId, "ve-items");
export const useDeleteVeItem = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "ve-items");

export const useCreatePermit = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionPermit>(projectId, "permits");
export const useUpdatePermit = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionPermit>(projectId, "permits");
export const useDeletePermit = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "permits");

export const useCreatePrequalSub = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionPrequalSub>(projectId, "prequal-subs");
export const useUpdatePrequalSub = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionPrequalSub>(projectId, "prequal-subs");
export const useDeletePrequalSub = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "prequal-subs");

export const useCreateBidPackage = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionBidPackage>(projectId, "bid-packages");
export const useUpdateBidPackage = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionBidPackage>(projectId, "bid-packages");
export const useDeleteBidPackage = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "bid-packages");

export const useCreateLongLeadItem = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionLongLeadItem>(projectId, "long-lead-items");
export const useUpdateLongLeadItem = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionLongLeadItem>(projectId, "long-lead-items");
export const useDeleteLongLeadItem = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "long-lead-items");

export const useCreatePreconSignature = (projectId: number | undefined) =>
  useCreatePreconRow<PreConstructionSignature>(projectId, "signatures");
export const useUpdatePreconSignature = (projectId: number | undefined) =>
  useUpdatePreconRow<PreConstructionSignature>(projectId, "signatures");
export const useDeletePreconSignature = (projectId: number | undefined) =>
  useDeletePreconRow(projectId, "signatures");

/** Backfill for a plan whose sign-off block was cleared, or a project that
 *  predates the module. Posts the eight default roles one at a time so
 *  sortOrder matches the catalog order. */
export function useSeedDefaultPreconSignatures(projectId: number | undefined) {
  const create = useCreatePreconSignature(projectId);
  return useMutation({
    mutationFn: async () => {
      for (let i = 0; i < PRE_CONSTRUCTION_SIGNERS.length; i++) {
        await create.mutateAsync({ role: PRE_CONSTRUCTION_SIGNERS[i], sortOrder: i });
      }
    },
  });
}
