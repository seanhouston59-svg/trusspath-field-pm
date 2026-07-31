import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { apiRequest, apiUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Project, Task, Rfi, Submittal, ChangeOrder, ActionItem, DailyLog, InsertDailyLog, InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder, InsertActionItem, InsertTeamMember, InsertContact, InsertPunchItem, InsertEquipment, InsertPhoto, InsertDocument, InsertCompanyDocument, InsertBlueprint, InsertDroneCapture, PunchItem, TeamMember, Contact, Equipment, MaintenanceLog, InsertMaintenanceLog, Photo, DocumentRow, CompanyDocument, Blueprint, DroneCapture, Message, Note, Integration, AppSettings, Milestone, InsertMilestone, DeletedItem } from "@shared/schema";
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
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertMilestone) => { const res = await apiRequest("POST", `/api/milestones`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/milestones"] }); },
  });
}

export function useUpdateMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertMilestone> }) => {
      const res = await apiRequest("PATCH", `/api/milestones/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/milestones"] }); },
  });
}

export function useDeleteMilestone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/milestones/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/milestones"] }); },
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

/**
 * Shape returned by `GET /api/weather/for-project/:id?date=YYYY-MM-DD` — mirrors
 * the `DailyLogWeather` interface in server/apis.ts. Kept as a plain type here
 * so the client can consume it without pulling in server-only imports.
 */
export interface DailyLogWeatherResponse {
  weather: "Sunny" | "Partly cloudy" | "Cloudy" | "Rain" | "Snow" | "Wind" | "Fog";
  temp: number;
  meta: {
    locationName: string;
    source: "today" | "historical" | "forecast";
    description: string;
    windMph: number;
  };
}

/**
 * Fetch daily-log-ready weather for a project on a given date. Used by the
 * daily-log form to auto-fill the Weather + Temp fields. Uses `useQuery` so
 * React Query dedupes/caches (server also emits Cache-Control: max-age=900),
 * but the query is `enabled` only when a projectId + date are provided so it
 * won't fire until the form has both selected.
 */
export function useProjectWeather(projectId: number | "" | null | undefined, date: string | undefined, opts?: { enabled?: boolean }) {
  const enabled = !!projectId && !!date && (opts?.enabled ?? true);
  return useQuery<DailyLogWeatherResponse>({
    queryKey: ["/api/weather/for-project", projectId, date],
    enabled,
    // Don't retry on 404 — that's the intended "no address / lookup failed"
    // signal. Any other error retries once (network blips, etc).
    retry: (failureCount, err: any) => {
      const msg = String(err?.message || "");
      if (msg.includes("404")) return false;
      return failureCount < 1;
    },
    staleTime: 10 * 60 * 1000,  // 10 min — forms re-mount often; avoid duplicate hits
    refetchOnWindowFocus: false, // form auto-fill; user doesn't expect focus-driven refetches
    queryFn: async () => {
      const url = `/api/weather/for-project/${projectId}?date=${encodeURIComponent(date!)}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });
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

// Sticky Board is org-wide: server returns every note/sticker in the caller's
// organization regardless of project. We keep the projectId parameter as an
// optional tag (unused by the current UI) so callers that still pass it stay
// compatible; the fetch itself is unfiltered.
export function useNotes(_projectId?: number) {
  return useQuery<Note[]>({
    queryKey: ["/api/notes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/notes`);
      return res.json();
    },
    // Poll the board so multiple users in the org see each other's notes
    // (and stickers) appear within ~10s of being created. The ding-on-new
    // hook (see useStickyDing) relies on this cadence.
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

// Notes are org-wide; projectId is an optional tag the caller can attach
// but the server no longer requires it for scoping.
export function useCreateNote(projectId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, color, type, x, y }: { body: string; color: string; type?: "note" | "sticker"; x?: number; y?: number }) => {
      const res = await apiRequest("POST", `/api/notes`, {
        projectId: projectId ?? null,
        body,
        color,
        type: type ?? "note",
        x: x ?? 300 + Math.round(Math.random() * 380),
        y: y ?? 30 + Math.round(Math.random() * 220),
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

export function useAddNoteReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: string }) => {
      const res = await apiRequest("POST", `/api/notes/${id}/replies`, { body });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });
}

/* ----------------------- Generic create hooks ----------------------- */
export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertProject) => { const res = await apiRequest("POST", `/api/projects`, data); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/projects"] }); },
  });
}
export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/projects"] }); },
  });
}
export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/projects/${id}`); },
    // A project delete cascades into every project-scoped list (tasks, RFIs,
    // photos, timesheets, exec-os modules…), so blanket-invalidate rather than
    // try to enumerate them.
    onSuccess: () => { qc.invalidateQueries(); },
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
export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<InsertEquipment> }) => {
      const res = await apiRequest("PATCH", `/api/equipment/${id}`, patch);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/equipment"] }); },
  });
}
export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/equipment/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/equipment"] }); },
  });
}
export function useMaintenanceLogs(equipmentId: number | null | undefined) {
  return useQuery<MaintenanceLog[]>({
    queryKey: ["/api/equipment", equipmentId, "maintenance"],
    queryFn: async () => {
      if (!equipmentId) return [];
      const res = await apiRequest("GET", `/api/equipment/${equipmentId}/maintenance`);
      return res.json();
    },
    enabled: !!equipmentId,
  });
}
export function useAddMaintenanceLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ equipmentId, data }: { equipmentId: number; data: Omit<InsertMaintenanceLog, "equipmentId"> }) => {
      const res = await apiRequest("POST", `/api/equipment/${equipmentId}/maintenance`, data);
      return res.json();
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/equipment", vars.equipmentId, "maintenance"] });
      qc.invalidateQueries({ queryKey: ["/api/equipment"] });
    },
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

// Jarvis response mode: 'llm' when a real OpenAI answer was produced, 'local'
// when we fell back to the deterministic in-process engine. Useful for showing
// a badge in the UI so users know when they're getting canned replies.
export type JarvisMode = "llm" | "local";

export function useJarvisBrief(projectId?: number) {
  return useMutation({
    mutationFn: async () => {
      const qs = projectId ? `?projectId=${projectId}` : "";
      const res = await apiRequest("GET", `/api/jarvis/brief${qs}`);
      return res.json() as Promise<{ brief: string; mode?: JarvisMode }>;
    },
  });
}

export function useJarvisChat(projectId?: number) {
  return useMutation({
    mutationFn: async (messages: JarvisMsg[]) => {
      const qs = projectId ? `?projectId=${projectId}` : "";
      const res = await apiRequest("POST", `/api/jarvis/chat${qs}`, { messages });
      return res.json() as Promise<{ reply: string; mode?: JarvisMode }>;
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
export type BillingStatus = {
  plan: string | null;
  status: string | null;
  billing: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt?: string | null;
  // True when the user asked Stripe to cancel at period end. Subscription is
  // still active until currentPeriodEnd, then Stripe deletes it.
  cancelAtPeriodEnd?: boolean;
  hasCustomer: boolean;
  seats?: { active: number; included: number | null; overage: number | null };
  // Server-derived feature entitlements. `commandDeck` is the caller's own seat;
  // `commandDeckSeatCount` is the org-wide granted count that drives the add-on line.
  entitlements?: { commandDeck: boolean; commandDeckSeatCount: number };
};
export function useBillingStatus() {
  return useQuery<BillingStatus>({
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

export type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};
export function useInvoices() {
  return useQuery<{ invoices: Invoice[] }>({ queryKey: ["/api/billing/invoices"] });
}

export type UpcomingInvoice = {
  amountDue: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  nextPaymentAttempt: string | null;
  lineCount: number;
};
export function useUpcomingInvoice() {
  return useQuery<{ upcoming: UpcomingInvoice | null }>({ queryKey: ["/api/billing/upcoming"] });
}

/* ----------------------- Organization / Team ----------------------- */
// The executiveOs* fields are the add-on audit trail. All nullable: grants made
// before those columns existed carry no attribution.
export type Membership = { id: number; accountId: number; organizationId: number; role: "owner"|"admin"|"pm"|"foreman"|"viewer"; status: string; createdAt: string; hasExecutiveOs?: boolean; executiveOsGrantedAt?: string | null; executiveOsGrantedBy?: string | null; executiveOsRevokedAt?: string | null; executiveOsRevokedBy?: string | null };
export type Invite = { id: number; token: string; organizationId: number; email: string; role: string; createdAt: string; expiresAt: string; acceptedAt: string | null };
export type OrgSummary = { id: number; name: string; slug: string; ownerAccountId: number; subscriptionStatus: string | null; subscriptionPlan: string | null; subscriptionBilling: string | null; trialEndsAt: string | null; timezone: string; disabledIntegrations?: Record<string, boolean> | null; };

// Integration keys the client understands. Must stay in sync with
// INTEGRATION_KEYS in server/lib/orgs.ts.
export type IntegrationKey = "googleCalendar";

/**
 * Read: is an integration enabled for the current org?
 * Defaults to true (enabled) when the org row hasn't loaded yet or the
 * key hasn't been explicitly turned off. Callers should treat a missing
 * org (during initial load) as enabled to avoid a flash of hidden UI.
 */
export function useIntegrationEnabled(key: IntegrationKey): boolean {
  const { data } = useCurrentOrg();
  const disabled = data?.organization?.disabledIntegrations ?? null;
  if (!disabled) return true;
  return disabled[key] !== true;
}

// Extended payload from /api/org/current — the server now includes plan pricing
// so seat-charge previews ("adding this member costs $X/mo") can render inline.
// `pendingInvites` counts still-redeemable invites, which will convert to seats.
export type CurrentOrgResponse = {
  organization: OrgSummary;
  membership: Membership;
  seats: { active: number; included: number | null; overage: number | null; pendingInvites?: number };
  pricing: {
    tier: "starter" | "pro" | "enterprise";
    displayName: string;
    billing: "monthly" | "annual";
    includedSeats: number;
    seatAmountCents: number;
    baseAmountCents: number;
  } | null;
};
export function useCurrentOrg() {
  return useQuery<CurrentOrgResponse>({
    queryKey: ["/api/org/current"],
    retry: false,
  });
}
// Update org-level settings. Owners + admins only.
export function useUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { timezone?: string; disabledIntegrations?: Partial<Record<IntegrationKey, boolean>> }) => {
      const res = await apiRequest("PATCH", "/api/org/current", patch);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org/current"] });
    },
  });
}

export function useOrgMembers() {
  return useQuery<{ members: (Membership & { email: string; displayName: string })[] }>({
    queryKey: ["/api/org/members"],
  });
}
export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const res = await apiRequest("POST", `/api/org/members/${id}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org/members"] });
      qc.invalidateQueries({ queryKey: ["/api/org/current"] });
    },
  });
}
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/org/members/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/org/members"] });
      qc.invalidateQueries({ queryKey: ["/api/org/current"] });
      qc.invalidateQueries({ queryKey: ["/api/billing/status"] });
    },
  });
}
/* ------------------- Command Deck add-on (per-seat) ------------------- */
// Grant/revoke both move money, so they invalidate billing status alongside the
// member lists — with staleTime: Infinity an omitted key shows a stale seat
// count indefinitely.
function invalidateCommandDeck(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["/api/org/members/exec-os"] });
  qc.invalidateQueries({ queryKey: ["/api/org/members"] });
  qc.invalidateQueries({ queryKey: ["/api/org/current"] });
  qc.invalidateQueries({ queryKey: ["/api/billing/status"] });
}

export function useSetMemberCommandDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest(
        enabled ? "POST" : "DELETE",
        `/api/org/members/${id}/exec-os`,
      );
      return res.json();
    },
    onSuccess: () => invalidateCommandDeck(qc),
  });
}

export function useOrgInvites() {
  return useQuery<{ invites: Invite[] }>({ queryKey: ["/api/org/invites"] });
}
export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const res = await apiRequest("POST", "/api/org/invites", { email, role });
      return res.json() as Promise<{ invite: Invite; inviteUrl: string }>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/org/invites"] }); },
  });
}
export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/org/invites/${id}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/org/invites"] }); },
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

export function useWipeData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/wipe-data`, { confirm: "WIPE" });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries(); },
  });
}
