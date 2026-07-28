import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  InsertLeanModuleItem,
  InsertLeanModuleState,
  LeanModuleItem,
  LeanModuleState,
} from "@shared/schema";

/** Bundle payload returned by GET /api/projects/:id/modules/:moduleId. */
export type LeanModuleBundle = {
  state: LeanModuleState | null;
  items: LeanModuleItem[];
};

function keys(projectId: number | undefined, moduleId: string) {
  return {
    bundle: ["/api/projects", projectId, "modules", moduleId] as const,
  };
}

export function useLeanModule(projectId: number | undefined, moduleId: string) {
  return useQuery<LeanModuleBundle>({
    queryKey: keys(projectId, moduleId).bundle,
    enabled: projectId !== undefined,
  });
}

export function useUpdateLeanModuleState(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<InsertLeanModuleState>) => {
      const res = await apiRequest(
        "PATCH",
        `/api/projects/${projectId}/modules/${moduleId}`,
        patch,
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}

export function useCreateLeanModuleItem(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<InsertLeanModuleItem, "projectId" | "moduleId">) => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/modules/${moduleId}/items`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}

export function useUpdateLeanModuleItem(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<InsertLeanModuleItem> }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/projects/${projectId}/modules/${moduleId}/items/${id}`,
        patch,
      );
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}

export function useDeleteLeanModuleItem(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/modules/${moduleId}/items/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}
