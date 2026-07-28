import { voiceNotes } from "@shared/schema";
import type { VoiceNote, InsertVoiceNote } from "@shared/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

/**
 * Field kit voice notes repo. Every read is org-scoped: the caller passes
 * `organizationId`, and any project-level filter is intersected with the
 * caller's `orgProjectIds` before hitting the DB so a foreman on org A
 * never sees rows keyed to a project number that happens to belong to org B.
 */
export class VoiceNotesRepo {
  async list(organizationId: number, opts: { projectId?: number; orgProjectIds: number[] } = { orgProjectIds: [] }): Promise<VoiceNote[]> {
    await ensureReady();
    const projectIds = opts.projectId ? [opts.projectId].filter((id) => opts.orgProjectIds.includes(id)) : opts.orgProjectIds;
    if (projectIds.length === 0) return [];
    return await db
      .select()
      .from(voiceNotes)
      .where(and(eq(voiceNotes.organizationId, organizationId), inArray(voiceNotes.projectId, projectIds)))
      .orderBy(desc(voiceNotes.occurredAt));
  }

  async get(organizationId: number, id: number): Promise<VoiceNote | undefined> {
    await ensureReady();
    const [row] = await db
      .select()
      .from(voiceNotes)
      .where(and(eq(voiceNotes.organizationId, organizationId), eq(voiceNotes.id, id)));
    return row;
  }

  async create(data: InsertVoiceNote): Promise<VoiceNote> {
    await ensureReady();
    const [row] = await db.insert(voiceNotes).values(data).returning();
    return row;
  }

  async delete(organizationId: number, id: number): Promise<VoiceNote | undefined> {
    await ensureReady();
    const [row] = await db
      .delete(voiceNotes)
      .where(and(eq(voiceNotes.organizationId, organizationId), eq(voiceNotes.id, id)))
      .returning();
    return row;
  }
}
