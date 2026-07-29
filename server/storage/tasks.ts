import { tasks, actionItems, milestones, subTaskCompletions } from '@shared/schema';
import type {
  Task, ActionItem, Equipment, InsertTask, InsertActionItem, Milestone, InsertMilestone,
  SubTaskCompletion, InsertSubTaskCompletion,
} from '@shared/schema';
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class TasksRepo {
  async getTasks(projectId?: number): Promise<Task[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return await db.select().from(tasks);
  }

  async getTask(id: number): Promise<Task | undefined> {
    await ensureReady();
    const rows = await db.select().from(tasks).where(eq(tasks.id, id));
    return rows[0];
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

  /** Partial update from the PM side. Currently used to (re)assign a task
   *  to a sub company or an internal user, and to nudge priority. Any field
   *  not present in `patch` is left untouched. Passing null explicitly clears
   *  a nullable column (e.g. unassign). */
  async patchTask(id: number, patch: Partial<Pick<Task,
    "assigneeId" | "assignedSubCompanyId" | "priority" | "title" | "dueDate" | "status" | "trade"
  >>): Promise<Task | undefined> {
    await ensureReady();
    if (Object.keys(patch).length === 0) return this.getTask(id);
    const [row] = await db.update(tasks).set(patch).where(eq(tasks.id, id)).returning();
    return row;
  }

  /** List tasks assigned to a specific sub company on a project. Powers the
   *  sub's "Tasks" tab. Newest-first by seq DESC then id DESC. */
  async listTasksForSub(projectId: number, subCompanyId: number): Promise<Task[]> {
    await ensureReady();
    return await db.select().from(tasks)
      .where(and(
        eq(tasks.projectId, projectId),
        eq(tasks.assignedSubCompanyId, subCompanyId),
      ))
      .orderBy(desc(tasks.id));
  }

  /** Sub marks their assigned task complete. Records the completion audit
   *  row AND stamps sub_completed_at on the base task row (which the PM UI
   *  reads to show a "✓ done by sub" badge). Task.status is NOT auto-flipped
   *  — PMs may want a review step before closing. If they want auto-close,
   *  it's a one-liner in the route handler. */
  async markTaskCompleteBySub(params: {
    taskId: number;
    projectId: number;
    organizationId: number;
    subCompanyId: number;
    note?: string | null;
    attachmentOriginalName?: string | null;
    attachmentStoredName?: string | null;
  }): Promise<{ task: Task | undefined; completion: SubTaskCompletion }> {
    await ensureReady();
    const now = new Date().toISOString();
    const [completion] = await db.insert(subTaskCompletions).values({
      organizationId: params.organizationId,
      projectId: params.projectId,
      taskId: params.taskId,
      subCompanyId: params.subCompanyId,
      completedAt: now,
      note: params.note ?? null,
      attachmentOriginalName: params.attachmentOriginalName ?? null,
      attachmentStoredName: params.attachmentStoredName ?? null,
    } satisfies InsertSubTaskCompletion).returning();
    const [task] = await db.update(tasks)
      .set({ subCompletedAt: now, subCompletionNote: params.note ?? null })
      .where(and(
        eq(tasks.id, params.taskId),
        eq(tasks.assignedSubCompanyId, params.subCompanyId),
      ))
      .returning();
    return { task, completion };
  }

  /** Full audit history for a task — useful when a task has been marked
   *  complete multiple times (e.g. rejected + re-submitted). */
  async listSubTaskCompletions(taskId: number): Promise<SubTaskCompletion[]> {
    await ensureReady();
    return await db.select().from(subTaskCompletions)
      .where(eq(subTaskCompletions.taskId, taskId))
      .orderBy(desc(subTaskCompletions.completedAt));
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
