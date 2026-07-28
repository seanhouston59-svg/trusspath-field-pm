import { projects, tasks, rfis, submittals, changeOrders, actionItems, dailyLogs, punchItems, teamMembers, contacts, equipment, photos, documents, companyDocuments, deletedItems, blueprints, droneCaptures, notes, milestones } from '@shared/schema';
import type { DeletedItem } from '@shared/schema';
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class DeletedItemsRepo {
  private ENTITY_CONFIG: Record<string, { table: any; nameCol: string; projectCol?: string }> = {
    tasks: { table: tasks, nameCol: "title", projectCol: "projectId" },
    rfis: { table: rfis, nameCol: "subject", projectCol: "projectId" },
    submittals: { table: submittals, nameCol: "subject", projectCol: "projectId" },
    "change-orders": { table: changeOrders, nameCol: "title", projectCol: "projectId" },
    "action-items": { table: actionItems, nameCol: "title", projectCol: "projectId" },
    "punch-items": { table: punchItems, nameCol: "title", projectCol: "projectId" },
    "daily-logs": { table: dailyLogs, nameCol: "date", projectCol: "projectId" },
    photos: { table: photos, nameCol: "caption", projectCol: "projectId" },
    documents: { table: documents, nameCol: "name", projectCol: "projectId" },
    "company-documents": { table: companyDocuments, nameCol: "title" },
    equipment: { table: equipment, nameCol: "name", projectCol: "projectId" },
    contacts: { table: contacts, nameCol: "name", projectCol: "projectId" },
    notes: { table: notes, nameCol: "content" },
    blueprints: { table: blueprints, nameCol: "title", projectCol: "projectId" },
    milestones: { table: milestones, nameCol: "name", projectCol: "projectId" },
    "team-members": { table: teamMembers, nameCol: "name" },
    "drone-captures": { table: droneCaptures, nameCol: "label", projectCol: "projectId" },
  };

  async getDeletedItems(): Promise<DeletedItem[]> {
    await ensureReady();
    return await db.select().from(deletedItems).orderBy(desc(deletedItems.deletedAt));
  }

  async softDeleteEntity(entityType: string, entityId: number, deletedById?: number): Promise<DeletedItem> {
    await ensureReady();
    const cfg = this.ENTITY_CONFIG[entityType];
    if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
    // Read the row
    const rows = await db.select().from(cfg.table).where(eq(cfg.table.id, entityId));
    const row = rows[0];
    if (!row) throw new Error(`${entityType} #${entityId} not found`);
    // Get project name if applicable
    let projectName: string | null = null;
    if (cfg.projectCol && row[cfg.projectCol]) {
      const projRows = await db.select().from(projects).where(eq(projects.id, row[cfg.projectCol]));
      projectName = projRows[0]?.name ?? null;
    }
    // Save to deleted_items
    const [deleted] = await db.insert(deletedItems).values({
      entityType,
      entityId,
      data: JSON.stringify(row),
      projectName,
      deletedAt: new Date().toISOString(),
      deletedById: deletedById ?? null,
    }).returning();
    // Hard delete from original table
    await db.delete(cfg.table).where(eq(cfg.table.id, entityId));
    return deleted;
  }

  async restoreEntity(entityType: string, entityId: number): Promise<any> {
    await ensureReady();
    const cfg = this.ENTITY_CONFIG[entityType];
    if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
    // Find in deleted_items
    const binRows = await db.select().from(deletedItems)
      .where(and(eq(deletedItems.entityType, entityType), eq(deletedItems.entityId, entityId))) as any[];
    const binRow = binRows[0] as any;
    if (!binRow) throw new Error(`Deleted ${entityType} #${entityId} not found in bin`);
    // Parse original row data
    const rowData = JSON.parse(binRow.data);
    // Re-insert into original table (let serial assign a new id)
    const { id, ...rest } = rowData;
    const restored = (await db.insert(cfg.table).values(rest).returning() as any[])[0];
    // Remove from deleted_items
    await db.delete(deletedItems).where(eq(deletedItems.id, binRow.id));
    return restored;
  }

  async permanentDeleteEntity(entityType: string, entityId: number): Promise<void> {
    await ensureReady();
    await db.delete(deletedItems)
      .where(and(eq(deletedItems.entityType, entityType), eq(deletedItems.entityId, entityId)));
  }

  async emptyDeletedItems(): Promise<void> {
    await ensureReady();
    await db.delete(deletedItems);
  }
}
