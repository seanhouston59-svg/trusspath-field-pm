import { submittals } from '@shared/schema';
import type { Submittal, InsertSubmittal } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class SubmittalsRepo {
  async getSubmittals(projectId?: number): Promise<Submittal[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(submittals).where(eq(submittals.projectId, projectId));
    return await db.select().from(submittals);
  }

  async createSubmittal(data: InsertSubmittal): Promise<Submittal> {
    await ensureReady();
    const [row] = await db.insert(submittals).values(data).returning();
    return row;
  }

  async updateSubmittalStatus(id: number, status: string): Promise<Submittal | undefined> {
    await ensureReady();
    const [row] = await db.update(submittals).set({ status }).where(eq(submittals.id, id)).returning();
    return row;
  }
}
