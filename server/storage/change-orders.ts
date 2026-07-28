import { changeOrders } from '@shared/schema';
import type { ChangeOrder, InsertChangeOrder } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class ChangeOrdersRepo {
  async getChangeOrders(projectId?: number): Promise<ChangeOrder[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
    return await db.select().from(changeOrders);
  }

  async createChangeOrder(data: InsertChangeOrder): Promise<ChangeOrder> {
    await ensureReady();
    const [row] = await db.insert(changeOrders).values(data).returning();
    return row;
  }

  async updateChangeOrderStatus(id: number, status: string): Promise<ChangeOrder | undefined> {
    await ensureReady();
    const [row] = await db.update(changeOrders).set({ status }).where(eq(changeOrders.id, id)).returning();
    return row;
  }
}
