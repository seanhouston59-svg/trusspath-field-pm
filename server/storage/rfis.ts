import { rfis } from '@shared/schema';
import type { Rfi, InsertRfi } from '@shared/schema';
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class RfisRepo {
  async getRfis(projectId?: number): Promise<Rfi[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(rfis).where(eq(rfis.projectId, projectId));
    return await db.select().from(rfis);
  }

  async getRfi(id: number): Promise<Rfi | undefined> {
    await ensureReady();
    const rows = await db.select().from(rfis).where(eq(rfis.id, id));
    return rows[0];
  }

  async createRfi(data: InsertRfi): Promise<Rfi> {
    await ensureReady();
    const [row] = await db.insert(rfis).values(data).returning();
    return row;
  }

  async updateRfiStatus(id: number, status: string): Promise<Rfi | undefined> {
    await ensureReady();
    const [row] = await db.update(rfis).set({ status }).where(eq(rfis.id, id)).returning();
    return row;
  }

  /** Accept a sub-submitted draft RFI: flips status "sub_draft" → "Open",
   *  stamps the accepting PM + timestamp, and (optionally) applies any PM
   *  edits made during acceptance. All updates in a single UPDATE so
   *  concurrent double-accepts collapse safely. */
  async acceptSubDraftRfi(
    id: number,
    acceptedByAccountId: number,
    patch: Partial<Pick<Rfi, "subject" | "trade" | "assigneeId" | "dueDate" | "specSection" | "drawingRef" | "priority" | "body">> = {},
  ): Promise<Rfi | undefined> {
    await ensureReady();
    const [row] = await db.update(rfis)
      .set({
        ...patch,
        status: "Open",
        subAcceptedAt: new Date().toISOString(),
        subAcceptedByAccountId: acceptedByAccountId,
      })
      .where(and(eq(rfis.id, id), eq(rfis.status, "sub_draft")))
      .returning();
    return row;
  }

  /** List RFIs a specific sub company submitted on a project — powers the
   *  "my RFIs" tab on /drop so subs can see the status of what they sent in. */
  async listRfisSubmittedBySub(projectId: number, subCompanyId: number): Promise<Rfi[]> {
    await ensureReady();
    return await db.select().from(rfis)
      .where(and(
        eq(rfis.projectId, projectId),
        eq(rfis.submittedBySubCompanyId, subCompanyId),
      ))
      .orderBy(desc(rfis.dateCreated));
  }

  /** Next RFI number for a project (RFI-###). Scans existing rows and picks
   *  max+1, zero-padded to three digits. Simple and race-safe enough for the
   *  volumes we're dealing with (worst case: a race produces a dup number,
   *  which is a cosmetic issue the PM can rename). */
  async nextRfiNumber(projectId: number): Promise<string> {
    await ensureReady();
    const rows = await db.select({ number: rfis.number }).from(rfis).where(eq(rfis.projectId, projectId));
    let max = 0;
    for (const r of rows) {
      const m = /RFI-(\d+)/i.exec(r.number || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `RFI-${String(max + 1).padStart(3, "0")}`;
  }
}
