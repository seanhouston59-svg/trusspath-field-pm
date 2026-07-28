import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  InsertLeanModuleItem,
  InsertLeanModuleState,
  LeanModuleItem,
  LeanModuleItemAttachment,
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

/**
 * Bulk-create items from a paste block. Send an array of partial items and
 * the server materializes them all in one go. Invalidates the same bundle key
 * as single-item creation so the list refreshes.
 */
export function useBulkCreateLeanModuleItems(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      items: Array<Omit<InsertLeanModuleItem, "projectId" | "moduleId">>,
    ) => {
      const res = await apiRequest(
        "POST",
        `/api/projects/${projectId}/modules/${moduleId}/items/bulk`,
        { items },
      );
      return res.json() as Promise<{ created: LeanModuleItem[]; count: number }>;
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

// ---- Attachments ---------------------------------------------------------

function attachmentKey(projectId: number | undefined, moduleId: string, itemId: number | undefined) {
  return ["/api/projects", projectId, "modules", moduleId, "items", itemId, "attachments"] as const;
}

/**
 * Attachments for a single item row. Enabled only when both ids are known so
 * the popover can safely mount before the parent row is available.
 */
export function useLeanModuleItemAttachments(
  projectId: number | undefined,
  moduleId: string,
  itemId: number | undefined,
) {
  return useQuery<LeanModuleItemAttachment[]>({
    queryKey: attachmentKey(projectId, moduleId, itemId),
    queryFn: async () => {
      const res = await fetch(
        `/api/projects/${projectId}/modules/${moduleId}/items/${itemId}/attachments`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to load attachments: ${res.status}`);
      return res.json();
    },
    enabled: projectId !== undefined && itemId !== undefined,
  });
}

/**
 * Upload a single file to a lean-module item. Uses FormData so multer can
 * receive the multipart body. Invalidates both the per-item attachment list
 * and the module bundle (in case the count strip is derived from bundle).
 */
export function useUploadLeanModuleItemAttachment(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, file }: { itemId: number; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(
        `/api/projects/${projectId}/modules/${moduleId}/items/${itemId}/attachments`,
        { method: "POST", credentials: "include", body: form },
      );
      if (!res.ok) {
        const msg = await res.text().catch(() => `Upload failed (${res.status})`);
        throw new Error(msg || `Upload failed (${res.status})`);
      }
      return res.json() as Promise<LeanModuleItemAttachment>;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attachmentKey(projectId, moduleId, vars.itemId) });
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}

export function useDeleteLeanModuleItemAttachment(projectId: number, moduleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, attachmentId }: { itemId: number; attachmentId: number }) => {
      await apiRequest(
        "DELETE",
        `/api/projects/${projectId}/modules/${moduleId}/items/${itemId}/attachments/${attachmentId}`,
      );
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: attachmentKey(projectId, moduleId, vars.itemId) });
      qc.invalidateQueries({ queryKey: keys(projectId, moduleId).bundle });
    },
  });
}
