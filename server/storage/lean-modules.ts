/**
 * Storage repo for the 19 lean Command Deck lifecycle modules (4-22).
 *
 * All 19 share two tables (`lean_module_state` + `lean_module_items`) keyed by
 * (projectId, moduleId). Every method takes moduleId as an argument so this
 * single repo serves Site Logistics, Sitework, Foundations, ... all the way
 * through Risk & Insurance.
 *
 * When any module graduates to a purpose-built schema (like Pre-Con did), its
 * rows can be migrated out of these two tables into the new schema and its
 * slug removed from LEAN_MODULES.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { leanModuleItems, leanModuleItemAttachments, leanModuleState } from "@shared/schema";
import type {
  InsertLeanModuleItem,
  InsertLeanModuleItemAttachment,
  InsertLeanModuleState,
  LeanModuleItem,
  LeanModuleItemAttachment,
  LeanModuleState,
} from "@shared/schema";
import { isLeanModuleSlug } from "@shared/lean-modules-catalog";
import { db } from "./db";
import { ensureReady } from "./ready";

export class LeanModulesRepo {
  constructor() {}

  private assertSlug(moduleId: string): void {
    if (!isLeanModuleSlug(moduleId)) {
      throw new Error(`unknown lean module slug: ${moduleId}`);
    }
  }

  async getBundle(
    projectId: number,
    moduleId: string,
  ): Promise<{ state: LeanModuleState | null; items: LeanModuleItem[] }> {
    this.assertSlug(moduleId);
    await ensureReady();
    const [stateRows, items] = await Promise.all([
      db
        .select()
        .from(leanModuleState)
        .where(and(eq(leanModuleState.projectId, projectId), eq(leanModuleState.moduleId, moduleId))),
      db
        .select()
        .from(leanModuleItems)
        .where(and(eq(leanModuleItems.projectId, projectId), eq(leanModuleItems.moduleId, moduleId)))
        .orderBy(leanModuleItems.sortOrder, leanModuleItems.id),
    ]);
    return { state: stateRows[0] ?? null, items };
  }

  /**
   * Ensure a state row exists for (projectId, moduleId). Idempotent — a
   * concurrent call race is contained by the unique index on the pair.
   */
  async ensureState(projectId: number, moduleId: string): Promise<LeanModuleState> {
    this.assertSlug(moduleId);
    await ensureReady();
    const existing = await db
      .select()
      .from(leanModuleState)
      .where(and(eq(leanModuleState.projectId, projectId), eq(leanModuleState.moduleId, moduleId)));
    if (existing[0]) return existing[0];
    const now = new Date().toISOString();
    const inserted = await db
      .insert(leanModuleState)
      .values({
        projectId,
        moduleId,
        status: "not_started",
        createdAt: now,
        updatedAt: now,
      })
      // Unique index prevents dupes if two callers race.
      .onConflictDoNothing({ target: [leanModuleState.projectId, leanModuleState.moduleId] })
      .returning();
    if (inserted[0]) return inserted[0];
    const reread = await db
      .select()
      .from(leanModuleState)
      .where(and(eq(leanModuleState.projectId, projectId), eq(leanModuleState.moduleId, moduleId)));
    return reread[0];
  }

  async updateState(
    projectId: number,
    moduleId: string,
    patch: Partial<InsertLeanModuleState>,
  ): Promise<LeanModuleState | null> {
    this.assertSlug(moduleId);
    await ensureReady();
    await this.ensureState(projectId, moduleId);
    // Guard: never let the client repoint (projectId, moduleId) or the id — those
    // are the identity of the row and this endpoint is for content edits only.
    const { id: _dropId, projectId: _dropProj, moduleId: _dropMod, ...rest } = patch as Record<string, unknown>;
    const now = new Date().toISOString();
    const rows = await db
      .update(leanModuleState)
      .set({ ...(rest as Partial<InsertLeanModuleState>), updatedAt: now })
      .where(and(eq(leanModuleState.projectId, projectId), eq(leanModuleState.moduleId, moduleId)))
      .returning();
    return rows[0] ?? null;
  }

  async createItem(row: InsertLeanModuleItem): Promise<LeanModuleItem> {
    this.assertSlug(row.moduleId);
    await ensureReady();
    // Ensure parent state exists so the module always has a state row to
    // hang narrative fields off of, even if the user creates rows first.
    await this.ensureState(row.projectId, row.moduleId);
    const inserted = await db.insert(leanModuleItems).values(row).returning();
    return inserted[0];
  }

  /**
   * Bulk-create items in a single transaction. Used by the paste-import
   * flow so a user can dump a TSV block from a spreadsheet and materialize
   * dozens of rows in one shot. Returns the created rows in the same order.
   *
   * Notes:
   * - The parent state row is ensured once, not per-item.
   * - We insert as a single VALUES tuple list so this is fast even for a few
   *   hundred rows (well below the plausible paste size).
   * - Duplicate detection is intentionally NOT here: pasting the same block
   *   twice legitimately creates dupes. Callers can dedupe upstream if they
   *   want.
   */
  async bulkCreateItems(
    projectId: number,
    moduleId: string,
    rows: Array<Omit<InsertLeanModuleItem, "projectId" | "moduleId">>,
  ): Promise<LeanModuleItem[]> {
    this.assertSlug(moduleId);
    if (rows.length === 0) return [];
    await ensureReady();
    await this.ensureState(projectId, moduleId);
    // Find the current max sortOrder so appended rows land after existing ones.
    const existing = await db
      .select({ sortOrder: leanModuleItems.sortOrder })
      .from(leanModuleItems)
      .where(and(eq(leanModuleItems.projectId, projectId), eq(leanModuleItems.moduleId, moduleId)));
    const startSort = existing.reduce((max, r) => Math.max(max, r.sortOrder ?? 0), -1) + 1;
    const values = rows.map((r, i) => ({
      ...r,
      projectId,
      moduleId,
      // Only default sortOrder when the caller didn't provide one; preserve
      // any explicit ordering the client wants (e.g. clipboard row order).
      sortOrder: r.sortOrder ?? startSort + i,
    }));
    return db.insert(leanModuleItems).values(values).returning();
  }

  async updateItem(
    id: number,
    projectId: number,
    moduleId: string,
    patch: Partial<InsertLeanModuleItem>,
  ): Promise<LeanModuleItem | null> {
    this.assertSlug(moduleId);
    await ensureReady();
    // Same guard: ownership fields on this row are set at create time only.
    const { id: _dropId, projectId: _dropProj, moduleId: _dropMod, ...rest } = patch as Record<string, unknown>;
    const rows = await db
      .update(leanModuleItems)
      .set(rest as Partial<InsertLeanModuleItem>)
      .where(
        and(
          eq(leanModuleItems.id, id),
          eq(leanModuleItems.projectId, projectId),
          eq(leanModuleItems.moduleId, moduleId),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Portfolio rollup across every lean module for a set of projects.
   *
   * Returns one entry per (projectId, moduleId) that has *any* activity —
   * either a state row or one or more items. This is intentional: an empty
   * (project, module) pair does not consume a row here, so a 30-project org
   * with only Safety filled in returns 30 rows, not 30 \u00d7 19 = 570.
   *
   * The client fills the missing pairs with a synthetic `not_started` shape.
   * All shape decisions live on the client to keep the payload small; the DB
   * only reports what actually exists.
   */
  async getRollupForProjects(projectIds: number[]): Promise<Array<{
    projectId: number;
    moduleId: string;
    status: string;
    ownerName: string | null;
    targetCompleteDate: string | null;
    updatedAt: string | null;
    itemsTotal: number;
    itemsOpen: number;
    itemsOverdue: number;
    itemsAtRisk: number;
  }>> {
    if (projectIds.length === 0) return [];
    await ensureReady();

    // 1) Every state row for these projects.
    const stateRows = await db
      .select()
      .from(leanModuleState)
      .where(inArray(leanModuleState.projectId, projectIds));

    // 2) Every item row for these projects. We aggregate in JS rather than SQL
    //    because we're already loading a small set (dozens \u00d7 dozens at worst)
    //    and it keeps the query portable across the ORM without a raw \`sql\`
    //    fragment for GROUP BY / COUNT / FILTER.
    const itemRows = await db
      .select({
        projectId: leanModuleItems.projectId,
        moduleId: leanModuleItems.moduleId,
        status: leanModuleItems.status,
        dueDate: leanModuleItems.dueDate,
      })
      .from(leanModuleItems)
      .where(inArray(leanModuleItems.projectId, projectIds));

    // Key each (project, module) pair.
    type Bucket = {
      projectId: number;
      moduleId: string;
      status: string;
      ownerName: string | null;
      targetCompleteDate: string | null;
      updatedAt: string | null;
      itemsTotal: number;
      itemsOpen: number;
      itemsOverdue: number;
      itemsAtRisk: number;
    };
    const key = (p: number, m: string) => `${p}\u0000${m}`;
    const buckets = new Map<string, Bucket>();

    for (const s of stateRows) {
      buckets.set(key(s.projectId, s.moduleId), {
        projectId: s.projectId,
        moduleId: s.moduleId,
        status: s.status,
        ownerName: s.ownerName,
        targetCompleteDate: s.targetCompleteDate,
        updatedAt: s.updatedAt ?? null,
        itemsTotal: 0,
        itemsOpen: 0,
        itemsOverdue: 0,
        itemsAtRisk: 0,
      });
    }

    // ISO date compare works lexicographically for YYYY-MM-DD strings.
    const today = new Date().toISOString().slice(0, 10);

    for (const it of itemRows) {
      const k = key(it.projectId, it.moduleId);
      let b = buckets.get(k);
      if (!b) {
        // Items exist without a state row \u2014 shouldn't happen because
        // createItem calls ensureState, but be robust for legacy data.
        b = {
          projectId: it.projectId,
          moduleId: it.moduleId,
          status: "not_started",
          ownerName: null,
          targetCompleteDate: null,
          updatedAt: null,
          itemsTotal: 0,
          itemsOpen: 0,
          itemsOverdue: 0,
          itemsAtRisk: 0,
        };
        buckets.set(k, b);
      }
      b.itemsTotal += 1;
      const isDone = it.status === "complete" || it.status === "n_a";
      if (!isDone) b.itemsOpen += 1;
      if (it.status === "at_risk") b.itemsAtRisk += 1;
      if (!isDone && it.dueDate && it.dueDate < today) b.itemsOverdue += 1;
    }

    return Array.from(buckets.values());
  }

  async deleteItem(id: number, projectId: number, moduleId: string): Promise<boolean> {
    this.assertSlug(moduleId);
    await ensureReady();
    // Drop any attachments for this item first so we don't leave orphan rows.
    // The upload files themselves are left on disk — same policy as every
    // other upload path in this codebase; a nightly sweeper is a separate
    // problem to solve.
    await db.delete(leanModuleItemAttachments).where(eq(leanModuleItemAttachments.itemId, id));
    const rows = await db
      .delete(leanModuleItems)
      .where(
        and(
          eq(leanModuleItems.id, id),
          eq(leanModuleItems.projectId, projectId),
          eq(leanModuleItems.moduleId, moduleId),
        ),
      )
      .returning({ id: leanModuleItems.id });
    return rows.length > 0;
  }

  // ---- Attachments ------------------------------------------------------

  async listAttachments(
    projectId: number,
    moduleId: string,
    itemId?: number,
  ): Promise<LeanModuleItemAttachment[]> {
    this.assertSlug(moduleId);
    await ensureReady();
    const conditions = [
      eq(leanModuleItemAttachments.projectId, projectId),
      eq(leanModuleItemAttachments.moduleId, moduleId),
    ];
    if (itemId !== undefined) {
      conditions.push(eq(leanModuleItemAttachments.itemId, itemId));
    }
    return db
      .select()
      .from(leanModuleItemAttachments)
      .where(and(...conditions))
      .orderBy(desc(leanModuleItemAttachments.uploadedAt));
  }

  async createAttachment(
    row: InsertLeanModuleItemAttachment,
  ): Promise<LeanModuleItemAttachment> {
    this.assertSlug(row.moduleId);
    await ensureReady();
    const inserted = await db.insert(leanModuleItemAttachments).values(row).returning();
    return inserted[0];
  }

  /**
   * The stream URL for an attachment includes its DB id, which is only known
   * after insert. Routes call this to patch the URL once the row exists so
   * clients receive a stable link they can hit directly.
   */
  async updateAttachmentUrl(id: number, url: string): Promise<void> {
    await ensureReady();
    await db
      .update(leanModuleItemAttachments)
      .set({ url })
      .where(eq(leanModuleItemAttachments.id, id));
  }

  async deleteAttachment(
    id: number,
    projectId: number,
    moduleId: string,
  ): Promise<boolean> {
    this.assertSlug(moduleId);
    await ensureReady();
    const rows = await db
      .delete(leanModuleItemAttachments)
      .where(
        and(
          eq(leanModuleItemAttachments.id, id),
          eq(leanModuleItemAttachments.projectId, projectId),
          eq(leanModuleItemAttachments.moduleId, moduleId),
        ),
      )
      .returning({ id: leanModuleItemAttachments.id });
    return rows.length > 0;
  }

}
