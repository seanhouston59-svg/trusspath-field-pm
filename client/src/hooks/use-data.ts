import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Project, Task, Rfi, Submittal, ChangeOrder, ActionItem, DailyLog, InsertDailyLog, InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder, InsertActionItem, InsertTeamMember, InsertContact, InsertPunchItem, InsertEquipment, InsertPhoto, InsertDocument, InsertCompanyDocument, InsertBlueprint, InsertDroneCapture, PunchItem, TeamMember, Contact, Equipment, Photo, DocumentRow, CompanyDocument, Blueprint, DroneCapture, Message, Note, Integration, AppSettings, Milestone, InsertMilestone, DeletedItem } from "@shared/schema";
import { DEFAULT_SETTINGS } from "@shared/schema";

function useDeleteWithUndo(entityType: string, queryKey: string, apiPath: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `${apiPath}/${id}`); },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [queryKey] });
      qc.invalidateQueries({ queryKey: ["/api/deleted-items"] });
      toast({
        title: "Moved to Deleted Items",
        description: "Item can be restored from the recycle bin.",
        action: createElement(ToastAction, {
          altText: "Undo",
          onClick: async () => {
            try {
              await apiRequest("POST", `/api/deleted-items/${entityType}/${id}/restore`);
              qc.invalidateQueries();
              toast({ title: "Item restored" });
            } catch {
              toast({ title: "Restore failed", variant: "destructive" });
            }
          },
        }, "Undo") as any,
      });
    },
  });
}

export function useTeam() {
  return useQuery<TeamMember[]>({ queryKey: ["/api/team"] });
}

export function useTeamMap() {
  const { data } = useTeam();
  const map = new Map<number, TeamMember>();
  data?.forEach((m) => map.set(m.id, m));
  return map;
}

export function useProjects() {
  return useQuery<Project[]>({ queryKey: ["/api/projects"] });
}

export function useProject(id: number | undefined) {
  return useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: id !== undefined,
  });
}

export function useTasks(projectId?: number) {
  return useQuery<Task[]>({
    queryKey: ["/api/tasks", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/tasks${qs}`);
      return res.json();
    },
  });
}

export function useMilestones(projectId?: number) {
  return useQuery<Milestone[]>({
    queryKey: ["/api/milestones", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/milestones${qs}`);
      return res.json();
    },
    enabled: projectId !== undefined,
  });
}

export function useRfis(projectId?: number) {
  return useQuery<Rfi[]>({
    queryKey: ["/api/rfis", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/rfis${qs}`);
      return res.json();
    },
  });
}

export function useDailyLogs(projectId?: number) {
  return useQuery<DailyLog[]>({
    queryKey: ["/api/daily-logs", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/daily-logs${qs}`);
      return res.json();
    },
  });
}

export function useCreateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDailyLog) => {
      const res = await apiRequest("POST", `/api/daily-logs`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/daily-logs"] }); },
  });
}

export function useUpdateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDailyLog> }) => {
      const res = await apiRequest("PATCH", `/api/daily-logs/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/daily-logs"] }); },
  });
}

export function useDeleteDailyLog() {
  return useDeleteWithUndo("daily-logs", "/api/daily-logs", "/api/daily-logs");
}

export function usePunchItems(projectId?: number) {
  return useQuery<PunchItem[]>({
    queryKey: ["/api/punch", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/punch${qs}`);
      return res.json();
    },
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
}

export function useUpdatePunchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/punch/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/punch"] });
    },
  });
}

export function useUpdateRfiStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/rfis/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/rfis"] }),
  });
}

export function useUpdateSubmittalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/submittals/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/submittals"] }),
  });
}

export function useUpdateChangeOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/change-orders/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/change-orders"] }),
  });
}

export function useSubmittals(projectId?: number) {
  return useQuery<Submittal[]>({
    queryKey: ["/api/submittals", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/submittals${qs}`);
      return res.json();
    },
  });
}

export function useChangeOrders(projectId?: number) {
  return useQuery<ChangeOrder[]>({
    queryKey: ["/api/change-orders", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/change-orders${qs}`);
      return res.json();
    },
  });
}

export function useActionItems(projectId?: number) {
  return useQuery<ActionItem[]>({
    queryKey: ["/api/action-items", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/action-items${qs}`);
      return res.json();
    },
  });
}

export function useUpdateActionItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/action-items/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/action-items"] });
    },
  });
}

export function useContacts() {
  return useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
}

export function useEquipment(projectId?: number) {
  return useQuery<Equipment[]>({
    queryKey: ["/api/equipment", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/equipment${qs}`);
      return res.json();
    },
  });
}

export function usePhotos(projectId?: number) {
  return useQuery<Photo[]>({
    queryKey: ["/api/photos", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/photos${qs}`);
      return res.json();
    },
  });
}

export function useDocuments(projectId?: number) {
  return useQuery<DocumentRow[]>({
    queryKey: ["/api/documents", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/documents${qs}`);
      return res.json();
    },
  });
}

export function useBlueprints(projectId?: number) {
  return useQuery<Blueprint[]>({
    queryKey: ["/api/blueprints", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/blueprints${qs}`);
      return res.json();
    },
  });
}

export function useDroneCaptures(projectId?: number) {
  return useQuery<DroneCapture[]>({
    queryKey: ["/api/drone-captures", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/drone-captures${qs}`);
      return res.json();
    },
  });
}

export function useMessages(projectId: number | undefined) {
  return useQuery<Message[]>({
    queryKey: ["/api/messages", projectId],
    enabled: projectId !== undefined,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/messages/${projectId}`);
      return res.json();
    },
  });
}

export function useCreateMessage(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/messages`, {
        projectId,
        authorId: 1,
        body,
        createdAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/messages", projectId] });
    },
  });
}

export function useNotes(projectId?: number) {
  return useQuery<Note[]>({
    queryKey: ["/api/notes", { projectId }],
    queryFn: async () => {
      const qs = projectId !== undefined ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/notes${qs}`);
      return res.json();
    },
  });
}

export function useCreateNote(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, color }: { body: string; color: string }) => {
      const res = await apiRequest("POST", `/api/notes`, {
        projectId,
        body,
        color,
        x: 300 + Math.round(Math.random() * 380),
        y: 30 + Math.round(Math.random() * 220),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });
}

export function useUpdateNotePosition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, x, y }: { id: number; x: number; y: number }) => {
      const res = await apiRequest("PATCH", `/api/notes/${id}`, { x, y });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });
}

export function useDeleteNote() {
  return useDeleteWithUndo("notes", "/api/notes", "/api/notes");
}

/* ----------------------- Generic create hooks ----------------------- */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertProject) => { const res = await apiRequest("POST", `/api/projects`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/projects"] }); },
  });
}
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTask) => { const res = await apiRequest("POST", `/api/tasks`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tasks"] }); },
  });
}
export function useCreateRfi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertRfi) => { const res = await apiRequest("POST", `/api/rfis`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfis"] }); },
  });
}
export function useCreateSubmittal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertSubmittal) => { const res = await apiRequest("POST", `/api/submittals`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/submittals"] }); },
  });
}
export function useCreateChangeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertChangeOrder) => { const res = await apiRequest("POST", `/api/change-orders`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/change-orders"] }); },
  });
}
export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertActionItem) => { const res = await apiRequest("POST", `/api/action-items`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/action-items"] }); },
  });
}
export function useCreatePunchItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPunchItem) => { const res = await apiRequest("POST", `/api/punch`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/punch"] }); },
  });
}
export function useCreateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertEquipment) => { const res = await apiRequest("POST", `/api/equipment`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/equipment"] }); },
  });
}
export function useCreatePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { form: FormData }) => apiUpload<Photo>(`/api/photos/upload`, input.form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/photos"] }); },
  });
}
export function useDeletePhoto() {
  return useDeleteWithUndo("photos", "/api/photos", "/api/photos");
}
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { form: FormData }) => apiUpload<DocumentRow>(`/api/documents/upload`, input.form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/documents"] }); },
  });
}
export function useDeleteDocument() {
  return useDeleteWithUndo("documents", "/api/documents", "/api/documents");
}
export function useCompanyDocuments() {
  return useQuery<CompanyDocument[]>({ queryKey: ["/api/company-documents"] });
}
export function useCreateCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { form: FormData }) => apiUpload<CompanyDocument>(`/api/company-documents/upload`, input.form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company-documents"] }); },
  });
}
export function useUpdateCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertCompanyDocument> }) => {
      const res = await apiRequest("PATCH", `/api/company-documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/company-documents"] }); },
  });
}
export function useDeleteCompanyDocument() {
  return useDeleteWithUndo("company-documents", "/api/company-documents", "/api/company-documents");
}
export function useCreateBlueprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertBlueprint) => { const res = await apiRequest("POST", `/api/blueprints`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/blueprints"] }); },
  });
}
export function useCreateDroneCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { form: FormData }) => apiUpload<DroneCapture>(`/api/drone-captures/upload`, input.form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/drone-captures"] }); },
  });
}
export function useDeleteDroneCapture() {
  return useDeleteWithUndo("drone-captures", "/api/drone-captures", "/api/drone-captures");
}

/* ----------------------- Team member CRUD ----------------------- */
export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertTeamMember) => { const res = await apiRequest("POST", `/api/team`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/team"] }); },
  });
}
export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTeamMember> }) => { const res = await apiRequest("PATCH", `/api/team/${id}`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/team"] }); },
  });
}
export function useDeleteTeamMember() {
  return useDeleteWithUndo("team-members", "/api/team", "/api/team");
}

/* ----------------------- Contact CRUD ----------------------- */
export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertContact) => { const res = await apiRequest("POST", `/api/contacts`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/contacts"] }); },
  });
}
export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertContact> }) => { const res = await apiRequest("PATCH", `/api/contacts/${id}`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/contacts"] }); },
  });
}
export function useDeleteContact() {
  return useDeleteWithUndo("contacts", "/api/contacts", "/api/contacts");
}

// ---- JARVIS AI assistant ----
export type JarvisMsg = { role: "user" | "assistant"; content: string };

export function useJarvisBrief(projectId?: number) {
  return useMutation({
    mutationFn: async () => {
      const qs = projectId ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/jarvis/brief${qs}`);
      return res.json() as Promise<{ brief: string }>;
    },
  });
}

export function useJarvisChat(projectId?: number) {
  return useMutation({
    mutationFn: async (messages: JarvisMsg[]) => {
      const qs = projectId ? `?projectId=${projectId}` : "";
      const res = await apiRequest("POST", `/api/jarvis/chat${qs}`, { messages });
      return res.json() as Promise<{ reply: string }>;
    },
  });
}

/* ----------------------- Integrations ----------------------- */
export function useIntegrations() {
  return useQuery<Integration[]>({ queryKey: ["/api/integrations"] });
}
export function useToggleIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, connected }: { key: string; connected: boolean }) => {
      const res = await apiRequest("PATCH", `/api/integrations/${key}`, { connected });
      return res.json() as Promise<Integration>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/integrations"] }); },
  });
}
export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, accountLabel, config }: { key: string; accountLabel?: string; config?: string }) => {
      const res = await apiRequest("POST", `/api/integrations/${key}/connect`, { accountLabel, config });
      return res.json() as Promise<Integration>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/integrations"] }); },
  });
}
export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/integrations/${key}/disconnect`);
      return res.json() as Promise<Integration>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/integrations"] }); },
  });
}
export function useTestIntegration() {
  return useMutation({
    mutationFn: async (key: string) => {
      const res = await apiRequest("POST", `/api/integrations/${key}/test`);
      return res.json() as Promise<{ ok: boolean; message: string }>;
    },
  });
}

/* ----------------------- Deleted Items Bin ----------------------- */
export function useDeletedItems() {
  return useQuery<DeletedItem[]>({ queryKey: ["/api/deleted-items"] });
}
export function useRestoreItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      const res = await apiRequest("POST", `/api/deleted-items/${type}/${id}/restore`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/deleted-items"] }); qc.invalidateQueries(); },
  });
}
export function usePermanentDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, id }: { type: string; id: number }) => {
      await apiRequest("DELETE", `/api/deleted-items/${type}/${id}/permanent`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/deleted-items"] }); },
  });
}
export function useEmptyDeletedItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { await apiRequest("DELETE", "/api/deleted-items"); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/deleted-items"] }); },
  });
}

/* ----------------------- Billing ----------------------- */
export function useBillingStatus() {
  return useQuery<{ plan: string | null; status: string | null; billing: string | null; currentPeriodEnd: string | null; hasCustomer: boolean }>({
    queryKey: ["/api/billing/status"],
  });
}
export function useManageBilling() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => { window.location.href = data.url; },
  });
}

/* ----------------------- Settings ----------------------- */
export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/settings`);
      return { ...DEFAULT_SETTINGS, ...((await res.json()) as object) } as AppSettings;
    },
    staleTime: 30_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const res = await apiRequest("PATCH", `/api/settings`, patch);
      return { ...DEFAULT_SETTINGS, ...((await res.json()) as object) } as AppSettings;
    },
    onSuccess: (data) => {
      qc.setQueryData(["/api/settings"], data);
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
    },
  });
}

/* ----------------------- App health scan ----------------------- */
export type HealthCheck = { name: string; status: "ok" | "fail"; detail: string };
export type BrokenLink = { href: string; label: string; source: "nav" | "landing" };
export type HealthReport = {
  scannedAt: string; ok: boolean;
  brokenLinks: BrokenLink[]; moduleChecks: HealthCheck[];
  routeCount: number; linkCount: number; summary: string;
};
export function useHealthScan() {
  return useMutation<HealthReport, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("GET", `/api/jarvis/health-scan`);
      return res.json();
    },
  });
}

export function useReseed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/reseed`, { confirm: "RESET" });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries(); },
  });
}
