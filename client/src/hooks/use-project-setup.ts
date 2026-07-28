import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  ProjectSetup, ProjectSetupStakeholder, ProjectSetupContractDoc,
  ProjectSetupDeliverable, ProjectSetupSignature,
} from "@shared/schema";
import { PROJECT_SETUP_SIGNERS } from "@shared/project-setup-catalog";
import type { LifecycleGate } from "@shared/lifecycle-gates";

export type ProjectSetupBundle = {
  setup: ProjectSetup | null;
  stakeholders: ProjectSetupStakeholder[];
  contractDocs: ProjectSetupContractDoc[];
  deliverables: ProjectSetupDeliverable[];
  signatures: ProjectSetupSignature[];
  seeded: boolean;
};

export type ProjectSetupHealth = {
  seeded: boolean;
  status: string;
  completePct: number;
  deliverablesComplete: number;
  deliverablesTotal: number;
  missingCritical: string[];
  kickoffScheduled: boolean;
  charterApproved: boolean;
};

export type ProjectSetupPortfolioRow = ProjectSetupHealth & {
  projectId: number;
  projectName: string;
};

/** Every query a mutation can invalidate. The gate is included because
 *  approving the charter has to clear the warning banner on Mobilization
 *  without a reload. */
function keysFor(projectId: number | undefined) {
  return {
    bundle: ["/api/projects", projectId, "project-setup"] as const,
    health: ["/api/projects", projectId, "project-setup", "health"] as const,
    gate: ["/api/projects", projectId, "mobilization", "gate"] as const,
    portfolio: ["/api/executive-os/project-setup"] as const,
  };
}

export function useProjectSetup(projectId: number | undefined) {
  return useQuery<ProjectSetupBundle>({
    queryKey: keysFor(projectId).bundle,
    enabled: projectId !== undefined,
  });
}

export function useProjectSetupHealth(projectId: number | undefined) {
  return useQuery<ProjectSetupHealth>({
    queryKey: keysFor(projectId).health,
    enabled: projectId !== undefined,
  });
}

export function useProjectSetupPortfolio() {
  return useQuery<ProjectSetupPortfolioRow[]>({ queryKey: ["/api/executive-os/project-setup"] });
}

/** Soft gate for the Mobilization page — warnings only, never blocks. */
export function useMobilizationGate(projectId: number | undefined) {
  return useQuery<LifecycleGate>({
    queryKey: keysFor(projectId).gate,
    enabled: projectId !== undefined,
  });
}

function useInvalidateProjectSetup(projectId: number | undefined) {
  const qc = useQueryClient();
  const keys = keysFor(projectId);
  return () => {
    qc.invalidateQueries({ queryKey: keys.bundle });
    qc.invalidateQueries({ queryKey: keys.health });
    qc.invalidateQueries({ queryKey: keys.gate });
    qc.invalidateQueries({ queryKey: keys.portfolio });
  };
}

/** Partial update of the setup row. Every column is optional server-side, so
 *  the intake form can send one field per keystroke-debounce. */
export function useUpdateProjectSetup(projectId: number | undefined) {
  const invalidate = useInvalidateProjectSetup(projectId);
  return useMutation({
    mutationFn: async (data: Partial<ProjectSetup>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/project-setup`, data);
      return (await res.json()) as ProjectSetup;
    },
    onSuccess: invalidate,
  });
}

/** Opt-in seed for projects created before this module shipped. Idempotent. */
export function useSeedProjectSetup(projectId: number | undefined) {
  const invalidate = useInvalidateProjectSetup(projectId);
  return useMutation({
    mutationFn: async (override?: number) => {
      const id = override ?? projectId;
      await apiRequest("POST", `/api/projects/${id}/project-setup/seed`);
    },
    onSuccess: invalidate,
  });
}

type Resource = "stakeholders" | "contract-docs" | "deliverables" | "signatures";

export function useCreateSetupRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateProjectSetup(projectId);
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/project-setup/${resource}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateSetupRow<T>(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateProjectSetup(projectId);
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/project-setup/${resource}/${id}`, data);
      return (await res.json()) as T;
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSetupRow(projectId: number | undefined, resource: Resource) {
  const invalidate = useInvalidateProjectSetup(projectId);
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/project-setup/${resource}/${id}`);
    },
    onSuccess: invalidate,
  });
}

export const useCreateStakeholder = (projectId: number | undefined) =>
  useCreateSetupRow<ProjectSetupStakeholder>(projectId, "stakeholders");
export const useUpdateStakeholder = (projectId: number | undefined) =>
  useUpdateSetupRow<ProjectSetupStakeholder>(projectId, "stakeholders");
export const useDeleteStakeholder = (projectId: number | undefined) =>
  useDeleteSetupRow(projectId, "stakeholders");

export const useCreateContractDoc = (projectId: number | undefined) =>
  useCreateSetupRow<ProjectSetupContractDoc>(projectId, "contract-docs");
export const useUpdateContractDoc = (projectId: number | undefined) =>
  useUpdateSetupRow<ProjectSetupContractDoc>(projectId, "contract-docs");
export const useDeleteContractDoc = (projectId: number | undefined) =>
  useDeleteSetupRow(projectId, "contract-docs");

export const useCreateDeliverable = (projectId: number | undefined) =>
  useCreateSetupRow<ProjectSetupDeliverable>(projectId, "deliverables");
export const useUpdateDeliverable = (projectId: number | undefined) =>
  useUpdateSetupRow<ProjectSetupDeliverable>(projectId, "deliverables");
export const useDeleteDeliverable = (projectId: number | undefined) =>
  useDeleteSetupRow(projectId, "deliverables");

export const useCreateSetupSignature = (projectId: number | undefined) =>
  useCreateSetupRow<ProjectSetupSignature>(projectId, "signatures");
export const useUpdateSetupSignature = (projectId: number | undefined) =>
  useUpdateSetupRow<ProjectSetupSignature>(projectId, "signatures");
export const useDeleteSetupSignature = (projectId: number | undefined) =>
  useDeleteSetupRow(projectId, "signatures");

/** Backfill for a setup row whose sign-off block was cleared. Posts the five
 *  default roles one at a time so sortOrder matches the catalog order. */
export function useSeedDefaultSetupSignatures(projectId: number | undefined) {
  const create = useCreateSetupSignature(projectId);
  return useMutation({
    mutationFn: async () => {
      for (let i = 0; i < PROJECT_SETUP_SIGNERS.length; i++) {
        await create.mutateAsync({ role: PROJECT_SETUP_SIGNERS[i], sortOrder: i });
      }
    },
  });
}
