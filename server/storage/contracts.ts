import { contracts } from "@shared/schema";
import type { Contract, InsertContract } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

/**
 * Executive OS contracts register — one row per contract or subcontract.
 * Always org-scoped. Optional projectId (null = org-level / MSA).
 */
export class ContractsRepo {
  async list(organizationId: number, projectId?: number): Promise<Contract[]> {
    await ensureReady();
    if (typeof projectId === "number") {
      return await db
        .select()
        .from(contracts)
        .where(and(eq(contracts.organizationId, organizationId), eq(contracts.projectId, projectId)))
        .orderBy(desc(contracts.updatedAt));
    }
    return await db
      .select()
      .from(contracts)
      .where(eq(contracts.organizationId, organizationId))
      .orderBy(desc(contracts.updatedAt));
  }

  async get(organizationId: number, id: number): Promise<Contract | undefined> {
    await ensureReady();
    const [row] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.organizationId, organizationId), eq(contracts.id, id)));
    return row;
  }

  async create(organizationId: number, data: InsertContract): Promise<Contract> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db
      .insert(contracts)
      .values({ ...data, organizationId, createdAt: now, updatedAt: now })
      .returning();
    return row;
  }

  async update(
    organizationId: number,
    id: number,
    patch: Partial<InsertContract>,
  ): Promise<Contract | undefined> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db
      .update(contracts)
      .set({ ...patch, updatedAt: now })
      .where(and(eq(contracts.organizationId, organizationId), eq(contracts.id, id)))
      .returning();
    return row;
  }

  async remove(organizationId: number, id: number): Promise<boolean> {
    await ensureReady();
    const rows = await db
      .delete(contracts)
      .where(and(eq(contracts.organizationId, organizationId), eq(contracts.id, id)))
      .returning();
    return rows.length > 0;
  }
}
