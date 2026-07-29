import { changeOrders } from '@shared/schema';
import type { ChangeOrder, InsertChangeOrder } from '@shared/schema';
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class ChangeOrdersRepo {
  async getChangeOrders(projectId?: number): Promise<ChangeOrder[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
    return await db.select().from(changeOrders);
  }

  async getChangeOrder(id: number): Promise<ChangeOrder | undefined> {
    await ensureReady();
    const rows = await db.select().from(changeOrders).where(eq(changeOrders.id, id));
    return rows[0];
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

  /** Accept a sub-submitted draft CO: flips status "sub_draft" → "Pending",
   *  stamps the accepting PM + timestamp. Concurrent double-accepts collapse
   *  safely via the status guard in the WHERE clause. */
  async acceptSubDraftChangeOrder(
    id: number,
    acceptedByAccountId: number,
    patch: Partial<Pick<ChangeOrder, "title" | "trade" | "amount" | "scheduleImpact" | "description" | "category">> = {},
  ): Promise<ChangeOrder | undefined> {
    await ensureReady();
    const [row] = await db.update(changeOrders)
      .set({
        ...patch,
        status: "Pending",
        subAcceptedAt: new Date().toISOString(),
        subAcceptedByAccountId: acceptedByAccountId,
      })
      .where(and(eq(changeOrders.id, id), eq(changeOrders.status, "sub_draft")))
      .returning();
    return row;
  }

  /** Record the PM's decision on a sub-submitted CO. Decision is one of
   *  "approved" | "rejected" | "needs_changes" and shows on the sub's /drop
   *  portal. Does NOT touch the base status column — that stays under PM
   *  control via updateChangeOrderStatus. */
  async recordSubDecisionOnChangeOrder(
    id: number,
    decision: "approved" | "rejected" | "needs_changes",
    comment: string | null,
    decidedByAccountId: number,
  ): Promise<ChangeOrder | undefined> {
    await ensureReady();
    const [row] = await db.update(changeOrders)
      .set({
        subDecision: decision,
        subDecisionComment: comment,
        subDecisionAt: new Date().toISOString(),
        subDecisionByAccountId: decidedByAccountId,
      })
      .where(eq(changeOrders.id, id))
      .returning();
    return row;
  }

  /** List COs a specific sub submitted on a project — powers the "my COs" tab
   *  on /drop with the PM's decision + comment inline. */
  async listChangeOrdersSubmittedBySub(projectId: number, subCompanyId: number): Promise<ChangeOrder[]> {
    await ensureReady();
    return await db.select().from(changeOrders)
      .where(and(
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.submittedBySubCompanyId, subCompanyId),
      ))
      .orderBy(desc(changeOrders.dateIssued));
  }

  /** Next CO number for a project (CO-###). Same shape as nextRfiNumber. */
  async nextChangeOrderNumber(projectId: number): Promise<string> {
    await ensureReady();
    const rows = await db.select({ number: changeOrders.number }).from(changeOrders).where(eq(changeOrders.projectId, projectId));
    let max = 0;
    for (const r of rows) {
      const m = /CO-(\d+)/i.exec(r.number || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `CO-${String(max + 1).padStart(3, "0")}`;
  }
}
