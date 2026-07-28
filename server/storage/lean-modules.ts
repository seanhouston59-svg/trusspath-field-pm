/**
 * Storage repo for the 19 lean Executive OS lifecycle modules (4-22).
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
import { and, eq } from "drizzle-orm";
import { leanModuleItems, leanModuleState } from "@shared/schema";
import type {
  InsertLeanModuleItem,
  InsertLeanModuleState,
  LeanModuleItem,
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

  async deleteItem(id: number, projectId: number, moduleId: string): Promise<boolean> {
    this.assertSlug(moduleId);
    await ensureReady();
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
}
