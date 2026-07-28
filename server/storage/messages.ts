import { messages, notes, integrations } from '@shared/schema';
import type { Message, Note, InsertMessage, InsertNote } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class MessagesRepo {
  async getMessages(projectId: number): Promise<Message[]> {
    await ensureReady();
    return await db.select().from(messages).where(eq(messages.projectId, projectId));
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    await ensureReady();
    const [row] = await db.insert(messages).values(data).returning();
    return row;
  }

  async getNotes(projectId?: number): Promise<Note[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(notes).where(eq(notes.projectId, projectId));
    return await db.select().from(notes);
  }

  async createNote(data: InsertNote): Promise<Note> {
    await ensureReady();
    const [row] = await db.insert(notes).values(data).returning();
    return row;
  }

  async updateNotePosition(id: number, x: number, y: number): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.update(notes).set({ x, y }).where(eq(notes.id, id)).returning();
    return row;
  }

  async getNoteById(id: number): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.select().from(notes).where(eq(notes.id, id));
    return row;
  }

  async updateNote(id: number, patch: Partial<Note>): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.update(notes).set(patch).where(eq(notes.id, id)).returning();
    return row;
  }

  async deleteNote(id: number): Promise<void> {
    await ensureReady();
    await db.delete(notes).where(eq(notes.id, id));
  }

  // UNSCOPED: integrations.key carries a global UNIQUE constraint, so there is
  // exactly one row per third-party service for the whole deployment and
  // per-org rows cannot exist. setIntegration keys off `key` alone for the same
  // reason. The rows hold connection state (and a config blob), not tenant
  // records. Making integrations per-org requires dropping the unique
  // constraint for a composite key, so it is out of scope here.
}
