import { equipment, maintenanceLogs } from '@shared/schema';
import type { Equipment, MaintenanceLog, InsertMaintenanceLog, InsertEquipment } from '@shared/schema';
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class EquipmentRepo {
  async getEquipment(projectId?: number, organizationId?: number | null): Promise<Equipment[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    const conds: any[] = [];
    if (projectId !== undefined) conds.push(eq(equipment.projectId, projectId));
    if (organizationId !== undefined) conds.push(eq(equipment.organizationId, organizationId));
    if (conds.length === 0) return await db.select().from(equipment);
    if (conds.length === 1) return await db.select().from(equipment).where(conds[0]);
    return await db.select().from(equipment).where(and(...conds));
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    await ensureReady();
    const rows = await db.select().from(equipment).where(eq(equipment.id, id));
    return rows[0];
  }

  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    await ensureReady();
    const [row] = await db.insert(equipment).values(data).returning();
    return row;
  }

  async updateEquipment(id: number, patch: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    await ensureReady();
    const [row] = await db.update(equipment).set(patch as any).where(eq(equipment.id, id)).returning();
    return row;
  }

  async deleteEquipment(id: number): Promise<void> {
    await ensureReady();
    await db.delete(equipment).where(eq(equipment.id, id));
    await db.delete(maintenanceLogs).where(eq(maintenanceLogs.equipmentId, id));
  }

  async getMaintenanceLogs(equipmentId: number): Promise<MaintenanceLog[]> {
    await ensureReady();
    return await db.select().from(maintenanceLogs).where(eq(maintenanceLogs.equipmentId, equipmentId)).orderBy(desc(maintenanceLogs.date));
  }

  async addMaintenanceLog(data: InsertMaintenanceLog): Promise<MaintenanceLog> {
    await ensureReady();
    const [row] = await db.insert(maintenanceLogs).values({ ...data, createdAt: new Date().toISOString() } as any).returning();
    return row;
  }

  async deleteMaintenanceLog(id: number): Promise<void> {
    await ensureReady();
    await db.delete(maintenanceLogs).where(eq(maintenanceLogs.id, id));
  }
}
