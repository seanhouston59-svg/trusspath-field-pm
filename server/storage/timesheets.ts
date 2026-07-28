import { timesheets, timeEntries } from '@shared/schema';
import type { Timesheet, InsertTimesheet, TimeEntry, InsertTimeEntry } from '@shared/schema';
import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class TimesheetsRepo {
  async getTimesheets(projectId?: number): Promise<Timesheet[]> {
    await ensureReady();
    if (projectId != null) {
      return await db.select().from(timesheets).where(eq(timesheets.projectId, projectId));
    }
    return await db.select().from(timesheets);
  }

  async getTimesheetsForAccount(accountId: number): Promise<Timesheet[]> {
    await ensureReady();
    return await db.select().from(timesheets).where(eq(timesheets.accountId, accountId)).orderBy(desc(timesheets.weekStart));
  }

  async getTimesheet(id: number): Promise<Timesheet | undefined> {
    await ensureReady();
    const rows = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return rows[0];
  }

  async getTimesheetByAccountWeek(accountId: number, weekStart: string): Promise<Timesheet | undefined> {
    await ensureReady();
    const rows = await db.select().from(timesheets)
      .where(and(eq(timesheets.accountId, accountId), eq(timesheets.weekStart, weekStart)))
      .limit(1);
    return rows[0];
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.insert(timesheets).values({ ...data, createdAt: now, updatedAt: now }).returning();
    return row;
  }

  async updateTimesheet(id: number, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    await ensureReady();
    const [row] = await db.update(timesheets).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(timesheets.id, id)).returning();
    return row;
  }

  async deleteTimesheet(id: number): Promise<void> {
    await ensureReady();
    await db.delete(timesheets).where(eq(timesheets.id, id));
  }

  /* --------------------------- Time entries ----------------------------- */

  async getTimeEntries(timesheetId: number): Promise<TimeEntry[]> {
    await ensureReady();
    return await db.select().from(timeEntries).where(eq(timeEntries.timesheetId, timesheetId));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    await ensureReady();
    const [row] = await db.insert(timeEntries).values({ ...data, createdAt: new Date().toISOString() }).returning();
    return row;
  }

  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    await ensureReady();
    const [row] = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return row;
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await ensureReady();
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async replaceTimeEntries(timesheetId: number, entries: InsertTimeEntry[]): Promise<void> {
    await ensureReady();
    await db.delete(timeEntries).where(eq(timeEntries.timesheetId, timesheetId));
    if (entries.length > 0) {
      const now = new Date().toISOString();
      await db.insert(timeEntries).values(entries.map((e) => ({ ...e, timesheetId, createdAt: now })));
    }
  }

  // Upsert a single day's row inside a timesheet. Used by the punch→timesheet
  // rollup so repeated clock-in/out cycles on the same day update one row.

  async upsertDailyTimeEntry(timesheetId: number, entryDate: string, patch: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    await ensureReady();
    const existing = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.timesheetId, timesheetId), eq(timeEntries.entryDate, entryDate)))
      .limit(1);
    if (existing[0]) {
      const [row] = await db.update(timeEntries).set(patch).where(eq(timeEntries.id, existing[0].id)).returning();
      return row;
    }
    const now = new Date().toISOString();
    const [row] = await db.insert(timeEntries).values({
      timesheetId,
      entryDate,
      dayOfWeek: patch.dayOfWeek ?? new Date(entryDate).toLocaleDateString("en-US", { weekday: "long" }),
      hoursWorked: patch.hoursWorked ?? "0",
      clientName: patch.clientName ?? null,
      projectName: patch.projectName ?? null,
      activities: patch.activities ?? null,
      createdAt: now,
    }).returning();
    return row;
  }
}
