import { tasks, actionItems, milestones } from '@shared/schema';
import type { Task, ActionItem, Equipment, InsertTask, InsertActionItem, Milestone, InsertMilestone } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class TasksRepo {
  async getTasks(projectId?: number): Promise<Task[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return await db.select().from(tasks);
  }

  async createTask(data: InsertTask): Promise<Task> {
    await ensureReady();
    const [row] = await db.insert(tasks).values(data).returning();
    return row;
  }

  async updateTaskStatus(id: number, status: string): Promise<Task | undefined> {
    await ensureReady();
    const [row] = await db.update(tasks).set({ status }).where(eq(tasks.id, id)).returning();
    return row;
  }

  async getActionItems(projectId?: number): Promise<ActionItem[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(actionItems).where(eq(actionItems.projectId, projectId));
    return await db.select().from(actionItems);
  }

  async createActionItem(data: InsertActionItem): Promise<ActionItem> {
    await ensureReady();
    const [row] = await db.insert(actionItems).values(data).returning();
    return row;
  }

  async updateActionItemStatus(id: number, status: string): Promise<ActionItem | undefined> {
    await ensureReady();
    const [row] = await db.update(actionItems).set({ status }).where(eq(actionItems.id, id)).returning();
    return row;
  }

  async getMilestones(projectId?: number): Promise<Milestone[]> {
    await ensureReady();
    if (projectId) {
      return await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    }
    return await db.select().from(milestones);
  }

  async getMilestone(id: number): Promise<Milestone | undefined> {
    await ensureReady();
    const rows = await db.select().from(milestones).where(eq(milestones.id, id));
    return rows[0];
  }

  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    await ensureReady();
    const [row] = await db.insert(milestones).values(data).returning();
    return row;
  }

  async updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    await ensureReady();
    const [row] = await db.update(milestones).set(data).where(eq(milestones.id, id)).returning();
    return row;
  }

  async deleteMilestone(id: number): Promise<void> {
    await ensureReady();
    await db.delete(milestones).where(eq(milestones.id, id));
  }

  /* --------------------------- Mobilization --------------------------- */
  // Seeds a fresh project's mobilization plan: the plan row, the full
  // 15-section checklist, the 7 standard permits, and the milestone timeline.
  // Equipment/utilities/subs/risks are intentionally NOT seeded — those are
  // project-specific and get added by hand. Idempotent: bails if a plan
  // already exists, so a retried project create can't double-seed.
}
