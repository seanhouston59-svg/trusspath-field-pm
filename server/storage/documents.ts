import { documents, companyDocuments } from '@shared/schema';
import type { DocumentRow, CompanyDocument, InsertDocument, InsertCompanyDocument } from '@shared/schema';
import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class DocumentsRepo {
  async getDocuments(projectId?: number): Promise<DocumentRow[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(documents).where(eq(documents.projectId, projectId));
    return await db.select().from(documents);
  }

  async getDocument(id: number): Promise<DocumentRow | undefined> {
    await ensureReady();
    const rows = await db.select().from(documents).where(eq(documents.id, id));
    return rows[0];
  }

  async createDocument(data: InsertDocument): Promise<DocumentRow> {
    await ensureReady();
    const [row] = await db.insert(documents).values(data).returning();
    return row;
  }

  async deleteDocument(id: number): Promise<void> {
    await ensureReady();
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getCompanyDocuments(organizationId?: number | null): Promise<CompanyDocument[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    if (organizationId !== undefined) {
      return await db.select().from(companyDocuments).where(eq(companyDocuments.organizationId, organizationId)).orderBy(desc(companyDocuments.date));
    }
    return await db.select().from(companyDocuments).orderBy(desc(companyDocuments.date));
  }

  async getCompanyDocument(id: number): Promise<CompanyDocument | undefined> {
    await ensureReady();
    const rows = await db.select().from(companyDocuments).where(eq(companyDocuments.id, id));
    return rows[0];
  }

  async createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument> {
    await ensureReady();
    const [row] = await db.insert(companyDocuments).values(data).returning();
    return row;
  }

  async updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined> {
    await ensureReady();
    const [row] = await db.update(companyDocuments).set(data).where(eq(companyDocuments.id, id)).returning();
    return row;
  }

  async deleteCompanyDocument(id: number): Promise<void> {
    await ensureReady();
    await db.delete(companyDocuments).where(eq(companyDocuments.id, id));
  }
  // ---- Deleted Items Bin ----
}
