import { inspections } from "@shared/schema";
import type { Inspection, InsertInspection } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

/**
 * Command Deck inspections register — one row per AHJ / third-party inspection.
 * Always org-scoped and project-scoped.
 */
export class InspectionsRepo {
  async list(organizationId: number, projectId?: number): Promise<Inspection[]> {
    await ensureReady();
    if (typeof projectId === "number") {
      return await db
        .select()
        .from(inspections)
        .where(and(eq(inspections.organizationId, organizationId), eq(inspections.projectId, projectId)))
        .orderBy(desc(inspections.inspectionDate));
    }
    return await db
      .select()
      .from(inspections)
      .where(eq(inspections.organizationId, organizationId))
      .orderBy(desc(inspections.inspectionDate));
  }

  async get(organizationId: number, id: number): Promise<Inspection | undefined> {
    await ensureReady();
    const [row] = await db
      .select()
      .from(inspections)
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, id)));
    return row;
  }

  async create(organizationId: number, data: InsertInspection): Promise<Inspection> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db
      .insert(inspections)
      .values({ ...data, organizationId, createdAt: now, updatedAt: now })
      .returning();
    return row;
  }

  async update(
    organizationId: number,
    id: number,
    patch: Partial<InsertInspection>,
  ): Promise<Inspection | undefined> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db
      .update(inspections)
      .set({ ...patch, updatedAt: now })
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, id)))
      .returning();
    return row;
  }

  async remove(organizationId: number, id: number): Promise<boolean> {
    await ensureReady();
    const rows = await db
      .delete(inspections)
      .where(and(eq(inspections.organizationId, organizationId), eq(inspections.id, id)))
      .returning();
    return rows.length > 0;
  }
}
