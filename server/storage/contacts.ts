import { contacts } from '@shared/schema';
import type { Contact, InsertContact } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class ContactsRepo {
  async getContacts(organizationId?: number | null): Promise<Contact[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    if (organizationId !== undefined) return await db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
    return await db.select().from(contacts);
  }

  async createContact(data: InsertContact): Promise<Contact> {
    await ensureReady();
    const [row] = await db.insert(contacts).values(data).returning();
    return row;
  }

  async updateContact(id: number, data: Partial<InsertContact>): Promise<Contact | undefined> {
    await ensureReady();
    const [row] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return row;
  }

  async deleteContact(id: number): Promise<void> {
    await ensureReady();
    await db.delete(contacts).where(eq(contacts.id, id));
  }
}
