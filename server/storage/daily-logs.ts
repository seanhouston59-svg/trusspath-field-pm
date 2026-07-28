import { dailyLogs } from '@shared/schema';
import type { DailyLog, InsertDailyLog } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class DailyLogsRepo {
  async getDailyLogs(projectId?: number): Promise<DailyLog[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(dailyLogs).where(eq(dailyLogs.projectId, projectId));
    return await db.select().from(dailyLogs);
  }

  async createDailyLog(data: InsertDailyLog): Promise<DailyLog> {
    await ensureReady();
    const [row] = await db.insert(dailyLogs).values(data).returning();
    return row;
  }

  async updateDailyLog(id: number, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined> {
    await ensureReady();
    const [row] = await db.update(dailyLogs).set(data).where(eq(dailyLogs.id, id)).returning();
    return row;
  }

  async deleteDailyLog(id: number): Promise<void> {
    await ensureReady();
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  }
}
