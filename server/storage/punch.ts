import { punchItems, fieldPunches } from '@shared/schema';
import type { PunchItem, InsertPunchItem, FieldPunch, InsertFieldPunch } from '@shared/schema';
import { eq, desc, and, gte, lt } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class PunchRepo {
  async getPunchItems(projectId?: number): Promise<PunchItem[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(punchItems).where(eq(punchItems.projectId, projectId));
    return await db.select().from(punchItems);
  }

  async updatePunchStatus(id: number, status: string): Promise<PunchItem | undefined> {
    await ensureReady();
    const [row] = await db.update(punchItems).set({ status }).where(eq(punchItems.id, id)).returning();
    return row;
  }

  async createPunchItem(data: InsertPunchItem): Promise<PunchItem> {
    await ensureReady();
    const [row] = await db.insert(punchItems).values(data).returning();
    return row;
  }

  async createFieldPunch(data: InsertFieldPunch): Promise<FieldPunch> {
    await ensureReady();
    const [row] = await db.insert(fieldPunches).values(data).returning();
    return row;
  }

  async getRecentFieldPunches(accountId: number, limit = 20): Promise<FieldPunch[]> {
    await ensureReady();
    const rows = await db.select().from(fieldPunches).where(eq(fieldPunches.accountId, accountId)).orderBy(desc(fieldPunches.createdAt)).limit(limit);
    return rows;
  }

  async getOpenFieldPunch(accountId: number): Promise<FieldPunch | undefined> {
    // "Open" means the most recent punch is a clock-in (or break_start). We
    // return it so the UI can show "You're clocked in since 7:14 AM".
    const rows = await this.getRecentFieldPunches(accountId, 1);
    if (rows.length === 0) return undefined;
    const latest = rows[0];
    if (latest.kind === "in" || latest.kind === "break_start") return latest;
    return undefined;
  }

  async getFieldPunchByClientId(accountId: number, clientId: string): Promise<FieldPunch | undefined> {
    await ensureReady();
    const rows = await db.select().from(fieldPunches).where(and(eq(fieldPunches.accountId, accountId), eq(fieldPunches.clientId, clientId))).limit(1);
    return rows[0];
  }
  // Field observations — quick-capture safety/quality/rfi/issue entries.

  async getFieldPunchesForDay(accountId: number, dayStartIso: string, dayEndIso: string): Promise<FieldPunch[]> {
    await ensureReady();
    return await db.select().from(fieldPunches)
      .where(and(
        eq(fieldPunches.accountId, accountId),
        gte(fieldPunches.occurredAt, dayStartIso),
        lt(fieldPunches.occurredAt, dayEndIso),
      ))
      .orderBy(fieldPunches.occurredAt);
  }

  /* ----------------------------- Seed ------------------------------ */
}
