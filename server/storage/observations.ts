import { fieldObservations } from '@shared/schema';
import type { FieldObservation, InsertFieldObservation } from '@shared/schema';
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class ObservationsRepo {
  async createFieldObservation(data: InsertFieldObservation): Promise<FieldObservation> {
    await ensureReady();
    const [row] = await db.insert(fieldObservations).values(data).returning();
    return row;
  }

  async getRecentFieldObservations(opts: { accountId?: number; organizationId?: number | null; projectId?: number; limit?: number }): Promise<FieldObservation[]> {
    await ensureReady();
    const limit = opts.limit ?? 25;
    // A null scope means "no organization" and must not widen to every tenant.
    if (opts.organizationId === null) return [];
    const filters: any[] = [];
    if (opts.accountId != null) filters.push(eq(fieldObservations.accountId, opts.accountId));
    if (opts.organizationId != null) filters.push(eq(fieldObservations.organizationId, opts.organizationId));
    if (opts.projectId != null) filters.push(eq(fieldObservations.projectId, opts.projectId));
    const where = filters.length === 0 ? undefined : (filters.length === 1 ? filters[0] : and(...filters));
    let q = db.select().from(fieldObservations) as any;
    if (where) q = q.where(where);
    const rows = await q.orderBy(desc(fieldObservations.createdAt)).limit(limit);
    return rows;
  }

  async getFieldObservationByClientId(accountId: number, clientId: string): Promise<FieldObservation | undefined> {
    await ensureReady();
    const rows = await db.select().from(fieldObservations).where(and(eq(fieldObservations.accountId, accountId), eq(fieldObservations.clientId, clientId))).limit(1);
    return rows[0];
  }
}
