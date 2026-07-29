import {
  projects, projectMembers, tasks, milestones, rfis, submittals, changeOrders, actionItems,
  dailyLogs, punchItems, equipment, photos, documents, blueprints, droneCaptures, messages,
  fieldPunches, fieldObservations, voiceNotes, projectEvents, jarvisMemory, timesheets, timeEntries,
  deletedItems,
  mobilizationPlans, mobilizationItems, mobilizationPermits, mobilizationEquipment,
  mobilizationUtilities, mobilizationStaff, mobilizationSubs, mobilizationRisks,
  mobilizationSignatures, mobilizationSectionNotes,
  projectSetup, projectSetupStakeholders, projectSetupContractDocs, projectSetupDeliverables,
  projectSetupSignatures,
  preConstruction, preConstructionDesignDocs, preConstructionDesignRfis, preConstructionVeItems,
  preConstructionPermits, preConstructionPrequalSubs, preConstructionBidPackages,
  preConstructionLongLeadItems, preConstructionSignatures,
  leanModuleState, leanModuleItems, leanModuleItemAttachments,
  contracts, inspections,
} from '@shared/schema';
import type { Project, InsertProject } from '@shared/schema';
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

// Every table that hangs off project_id and dies with the project. The schema
// declares no FK constraints, so there are no DB cascades to lean on — these
// have to be swept explicitly. Deliberately excluded:
//   equipment — an org fleet asset merely *assigned* to a project; released below.
//   notes     — the org-wide corkboard; its project_id is legacy and unfiltered.
//   contacts  — org-scoped rolodex with no project_id at all.
const PROJECT_CHILD_TABLES = [
  projectMembers, tasks, milestones, rfis, submittals, changeOrders, actionItems,
  dailyLogs, punchItems, photos, documents, blueprints, droneCaptures, messages,
  fieldPunches, fieldObservations, voiceNotes, projectEvents, jarvisMemory, timesheets,
  mobilizationPlans, mobilizationItems, mobilizationPermits, mobilizationEquipment,
  mobilizationUtilities, mobilizationStaff, mobilizationSubs, mobilizationRisks,
  mobilizationSignatures, mobilizationSectionNotes,
  projectSetup, projectSetupStakeholders, projectSetupContractDocs, projectSetupDeliverables,
  projectSetupSignatures,
  preConstruction, preConstructionDesignDocs, preConstructionDesignRfis, preConstructionVeItems,
  preConstructionPermits, preConstructionPrequalSubs, preConstructionBidPackages,
  preConstructionLongLeadItems, preConstructionSignatures,
  leanModuleState, leanModuleItems, leanModuleItemAttachments,
  contracts, inspections,
];

export class ProjectsRepo {
  async getProjects(organizationId?: number | null): Promise<Project[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    if (organizationId !== undefined) return await db.select().from(projects).where(eq(projects.organizationId, organizationId));
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    await ensureReady();
    const rows = await db.select().from(projects).where(eq(projects.id, id));
    return rows[0];
  }

  async createProject(data: InsertProject): Promise<Project> {
    await ensureReady();
    // Auto-generate project number: PRJ-001, PRJ-002, ...
    const existing = await db.select().from(projects);
    const nextNum = existing.length + 1;
    const projectNumber = `PRJ-${String(nextNum).padStart(3, "0")}`;
    const [row] = await db.insert(projects).values({ ...data, number: projectNumber }).returning();
    return row;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    await ensureReady();
    const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return row;
  }

  /**
   * Permanently delete a project and everything hanging off it. Callers must
   * have already verified org ownership of `id` — this method does not scope.
   *
   * neon-http has no transaction support (same constraint SystemRepo.resetAllData
   * works around), so this is a sequential sweep. Children go first and the
   * project row last, which keeps the project itself as the retry handle if a
   * sweep fails partway.
   */
  async deleteProject(id: number): Promise<boolean> {
    await ensureReady();

    // Time entries reach the project only through their timesheet.
    const sheets = await db.select({ id: timesheets.id }).from(timesheets).where(eq(timesheets.projectId, id));
    if (sheets.length) {
      await db.delete(timeEntries).where(inArray(timeEntries.timesheetId, sheets.map((s) => s.id)));
    }

    for (const table of PROJECT_CHILD_TABLES) {
      await db.delete(table).where(eq(table.projectId, id));
    }

    // Recycle-bin rows keep the project id inside their JSON snapshot, so purge
    // them too — otherwise a restore would resurrect a task into a dead project.
    const bin = await db.select().from(deletedItems);
    const orphaned = bin
      .filter((r) => {
        try { return JSON.parse(r.data)?.projectId === id; } catch { return false; }
      })
      .map((r) => r.id);
    if (orphaned.length) await db.delete(deletedItems).where(inArray(deletedItems.id, orphaned));

    // Fleet assets outlive the job they were parked on.
    await db.update(equipment).set({ projectId: null }).where(eq(equipment.projectId, id));

    const [row] = await db.delete(projects).where(eq(projects.id, id)).returning();
    return Boolean(row);
  }
}
