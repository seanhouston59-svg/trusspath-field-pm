import { rfis } from '@shared/schema';
import type { Rfi, InsertRfi } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class RfisRepo {
  async getRfis(projectId?: number): Promise<Rfi[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(rfis).where(eq(rfis.projectId, projectId));
    return await db.select().from(rfis);
  }

  async createRfi(data: InsertRfi): Promise<Rfi> {
    await ensureReady();
    const [row] = await db.insert(rfis).values(data).returning();
    return row;
  }

  async updateRfiStatus(id: number, status: string): Promise<Rfi | undefined> {
    await ensureReady();
    const [row] = await db.update(rfis).set({ status }).where(eq(rfis.id, id)).returning();
    return row;
  }
}
