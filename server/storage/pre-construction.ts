import { preConstruction, preConstructionDesignDocs, preConstructionDesignRfis, preConstructionVeItems, preConstructionPermits, preConstructionPrequalSubs, preConstructionBidPackages, preConstructionLongLeadItems, preConstructionSignatures } from '@shared/schema';
import type { PreConstruction, InsertPreConstruction, PreConstructionDesignDoc, InsertPreConstructionDesignDoc, PreConstructionDesignRfi, InsertPreConstructionDesignRfi, PreConstructionVeItem, InsertPreConstructionVeItem, PreConstructionPermit, InsertPreConstructionPermit, PreConstructionPrequalSub, InsertPreConstructionPrequalSub, PreConstructionBidPackage, InsertPreConstructionBidPackage, PreConstructionLongLeadItem, InsertPreConstructionLongLeadItem, PreConstructionSignature, InsertPreConstructionSignature } from '@shared/schema';
import { PRE_CONSTRUCTION_SIGNERS } from '@shared/pre-construction-catalog';
import { eq } from "drizzle-orm";
import type { IStorage } from "./types";
import { db } from "./db";
import { ensureReady } from "./ready";
import { matchSignerName } from "./helpers";

/** No alias table for Pre-Construction roles, so matchSignerName falls back to
 *  a case-insensitive substring match on the role itself in both directions.
 *  Passing this explicitly rather than defaulting keeps the mobilization alias
 *  table from silently reinterpreting a role name the two modules share. */
const NO_ALIASES: Record<string, string[]> = {};

export class PreConstructionRepo {
  /** Back-reference for the roster read in seedPreConstruction — see the
   *  `this.root.getTeam` call site below. */
  constructor(private root: IStorage) {}

  async seedPreConstruction(projectId: number, organizationId: number | null): Promise<void> {
    await ensureReady();
    const existing = await this.getPreConstruction(projectId);
    if (existing) return;

    // Reading the roster unscoped would pull names from other tenants onto this
    // plan, so a project with no organization gets no auto-fill at all. An
    // unmatched role still gets a row so the plan renders a blank to sign.
    const roster = organizationId != null ? await this.root.getTeam(organizationId) : [];
    const now = new Date().toISOString();
    await db.insert(preConstruction).values({
      projectId,
      status: "in_progress",
      preconLeadName: matchSignerName(roster, "Preconstruction Lead", NO_ALIASES),
      estimatorName: matchSignerName(roster, "Estimator", NO_ALIASES),
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(preConstructionSignatures).values(
      PRE_CONSTRUCTION_SIGNERS.map((role, i) => ({
        projectId,
        role,
        name: matchSignerName(roster, role, NO_ALIASES),
        sortOrder: i,
      })),
    );
  }

  async getPreConstruction(projectId: number): Promise<PreConstruction | null> {
    await ensureReady();
    const rows = await db.select().from(preConstruction).where(eq(preConstruction.projectId, projectId));
    return rows[0] ?? null;
  }

  async getPreConstructionBundle(projectId: number): Promise<{
    preCon: PreConstruction | null;
    designDocs: PreConstructionDesignDoc[];
    designRfis: PreConstructionDesignRfi[];
    veItems: PreConstructionVeItem[];
    permits: PreConstructionPermit[];
    prequalSubs: PreConstructionPrequalSub[];
    bidPackages: PreConstructionBidPackage[];
    longLeadItems: PreConstructionLongLeadItem[];
    signatures: PreConstructionSignature[];
  }> {
    await ensureReady();
    const [preCon, designDocs, designRfis, veItems, permits, prequalSubs, bidPackages, longLeadItems, signatures] = await Promise.all([
      this.getPreConstruction(projectId),
      db.select().from(preConstructionDesignDocs)
        .where(eq(preConstructionDesignDocs.projectId, projectId))
        .orderBy(preConstructionDesignDocs.sortOrder, preConstructionDesignDocs.id),
      db.select().from(preConstructionDesignRfis)
        .where(eq(preConstructionDesignRfis.projectId, projectId))
        .orderBy(preConstructionDesignRfis.sortOrder, preConstructionDesignRfis.id),
      db.select().from(preConstructionVeItems)
        .where(eq(preConstructionVeItems.projectId, projectId))
        .orderBy(preConstructionVeItems.sortOrder, preConstructionVeItems.id),
      db.select().from(preConstructionPermits)
        .where(eq(preConstructionPermits.projectId, projectId))
        .orderBy(preConstructionPermits.sortOrder, preConstructionPermits.id),
      db.select().from(preConstructionPrequalSubs)
        .where(eq(preConstructionPrequalSubs.projectId, projectId))
        .orderBy(preConstructionPrequalSubs.sortOrder, preConstructionPrequalSubs.id),
      db.select().from(preConstructionBidPackages)
        .where(eq(preConstructionBidPackages.projectId, projectId))
        .orderBy(preConstructionBidPackages.sortOrder, preConstructionBidPackages.id),
      db.select().from(preConstructionLongLeadItems)
        .where(eq(preConstructionLongLeadItems.projectId, projectId))
        .orderBy(preConstructionLongLeadItems.sortOrder, preConstructionLongLeadItems.id),
      db.select().from(preConstructionSignatures)
        .where(eq(preConstructionSignatures.projectId, projectId))
        .orderBy(preConstructionSignatures.sortOrder, preConstructionSignatures.id),
    ]);
    return { preCon, designDocs, designRfis, veItems, permits, prequalSubs, bidPackages, longLeadItems, signatures };
  }

  // Returns null when the project has no pre-construction row — callers surface
  // that as "not set up yet" rather than lazily creating one, so seeding stays
  // the only path that brings a project into the module.

  async updatePreConstruction(
    projectId: number,
    patch: Partial<InsertPreConstruction>,
  ): Promise<PreConstruction | null> {
    await ensureReady();
    const { id: _id, projectId: _pid, ...rest } = patch;
    if (Object.keys(rest).length === 0) return await this.getPreConstruction(projectId);
    const [row] = await db.update(preConstruction)
      .set({ ...rest, updatedAt: new Date().toISOString() })
      .where(eq(preConstruction.projectId, projectId))
      .returning();
    return row ?? null;
  }

  async createDesignDoc(data: InsertPreConstructionDesignDoc): Promise<PreConstructionDesignDoc> {
    await ensureReady();
    const [row] = await db.insert(preConstructionDesignDocs).values(data).returning();
    return row;
  }

  async updateDesignDoc(
    id: number,
    data: Partial<InsertPreConstructionDesignDoc>,
  ): Promise<PreConstructionDesignDoc | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionDesignDocs).set(data)
      .where(eq(preConstructionDesignDocs.id, id)).returning();
    return row;
  }

  async deleteDesignDoc(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionDesignDocs).where(eq(preConstructionDesignDocs.id, id));
  }

  async createDesignRfi(data: InsertPreConstructionDesignRfi): Promise<PreConstructionDesignRfi> {
    await ensureReady();
    const [row] = await db.insert(preConstructionDesignRfis).values(data).returning();
    return row;
  }

  async updateDesignRfi(
    id: number,
    data: Partial<InsertPreConstructionDesignRfi>,
  ): Promise<PreConstructionDesignRfi | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionDesignRfis).set(data)
      .where(eq(preConstructionDesignRfis.id, id)).returning();
    return row;
  }

  async deleteDesignRfi(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionDesignRfis).where(eq(preConstructionDesignRfis.id, id));
  }

  async createVeItem(data: InsertPreConstructionVeItem): Promise<PreConstructionVeItem> {
    await ensureReady();
    const [row] = await db.insert(preConstructionVeItems).values(data).returning();
    return row;
  }

  async updateVeItem(
    id: number,
    data: Partial<InsertPreConstructionVeItem>,
  ): Promise<PreConstructionVeItem | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionVeItems).set(data)
      .where(eq(preConstructionVeItems.id, id)).returning();
    return row;
  }

  async deleteVeItem(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionVeItems).where(eq(preConstructionVeItems.id, id));
  }

  async createPermit(data: InsertPreConstructionPermit): Promise<PreConstructionPermit> {
    await ensureReady();
    const [row] = await db.insert(preConstructionPermits).values(data).returning();
    return row;
  }

  async updatePermit(
    id: number,
    data: Partial<InsertPreConstructionPermit>,
  ): Promise<PreConstructionPermit | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionPermits).set(data)
      .where(eq(preConstructionPermits.id, id)).returning();
    return row;
  }

  async deletePermit(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionPermits).where(eq(preConstructionPermits.id, id));
  }

  async createPrequalSub(data: InsertPreConstructionPrequalSub): Promise<PreConstructionPrequalSub> {
    await ensureReady();
    const [row] = await db.insert(preConstructionPrequalSubs).values(data).returning();
    return row;
  }

  async updatePrequalSub(
    id: number,
    data: Partial<InsertPreConstructionPrequalSub>,
  ): Promise<PreConstructionPrequalSub | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionPrequalSubs).set(data)
      .where(eq(preConstructionPrequalSubs.id, id)).returning();
    return row;
  }

  async deletePrequalSub(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionPrequalSubs).where(eq(preConstructionPrequalSubs.id, id));
  }

  async createBidPackage(data: InsertPreConstructionBidPackage): Promise<PreConstructionBidPackage> {
    await ensureReady();
    const [row] = await db.insert(preConstructionBidPackages).values(data).returning();
    return row;
  }

  async updateBidPackage(
    id: number,
    data: Partial<InsertPreConstructionBidPackage>,
  ): Promise<PreConstructionBidPackage | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionBidPackages).set(data)
      .where(eq(preConstructionBidPackages.id, id)).returning();
    return row;
  }

  async deleteBidPackage(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionBidPackages).where(eq(preConstructionBidPackages.id, id));
  }

  async createLongLeadItem(data: InsertPreConstructionLongLeadItem): Promise<PreConstructionLongLeadItem> {
    await ensureReady();
    const [row] = await db.insert(preConstructionLongLeadItems).values(data).returning();
    return row;
  }

  async updateLongLeadItem(
    id: number,
    data: Partial<InsertPreConstructionLongLeadItem>,
  ): Promise<PreConstructionLongLeadItem | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionLongLeadItems).set(data)
      .where(eq(preConstructionLongLeadItems.id, id)).returning();
    return row;
  }

  async deleteLongLeadItem(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionLongLeadItems).where(eq(preConstructionLongLeadItems.id, id));
  }

  async createPreconSignature(data: InsertPreConstructionSignature): Promise<PreConstructionSignature> {
    await ensureReady();
    const [row] = await db.insert(preConstructionSignatures).values(data).returning();
    return row;
  }

  async updatePreconSignature(
    id: number,
    data: Partial<InsertPreConstructionSignature>,
  ): Promise<PreConstructionSignature | undefined> {
    await ensureReady();
    const [row] = await db.update(preConstructionSignatures).set(data)
      .where(eq(preConstructionSignatures.id, id)).returning();
    return row;
  }

  async deletePreconSignature(id: number): Promise<void> {
    await ensureReady();
    await db.delete(preConstructionSignatures).where(eq(preConstructionSignatures.id, id));
  }

  /* --- By-id reads. Child rows carry no organizationId, so a route holding
     only a row id must load the row to learn which project owns it before it
     may mutate or delete it. --- */

  async getDesignDocById(id: number): Promise<PreConstructionDesignDoc | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionDesignDocs).where(eq(preConstructionDesignDocs.id, id)).limit(1);
    return row ?? null;
  }

  async getDesignRfiById(id: number): Promise<PreConstructionDesignRfi | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionDesignRfis).where(eq(preConstructionDesignRfis.id, id)).limit(1);
    return row ?? null;
  }

  async getVeItemById(id: number): Promise<PreConstructionVeItem | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionVeItems).where(eq(preConstructionVeItems.id, id)).limit(1);
    return row ?? null;
  }

  async getPermitById(id: number): Promise<PreConstructionPermit | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionPermits).where(eq(preConstructionPermits.id, id)).limit(1);
    return row ?? null;
  }

  async getPrequalSubById(id: number): Promise<PreConstructionPrequalSub | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionPrequalSubs).where(eq(preConstructionPrequalSubs.id, id)).limit(1);
    return row ?? null;
  }

  async getBidPackageById(id: number): Promise<PreConstructionBidPackage | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionBidPackages).where(eq(preConstructionBidPackages.id, id)).limit(1);
    return row ?? null;
  }

  async getLongLeadItemById(id: number): Promise<PreConstructionLongLeadItem | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionLongLeadItems).where(eq(preConstructionLongLeadItems.id, id)).limit(1);
    return row ?? null;
  }

  async getPreconSignatureById(id: number): Promise<PreConstructionSignature | null> {
    await ensureReady();
    const [row] = await db.select().from(preConstructionSignatures).where(eq(preConstructionSignatures.id, id)).limit(1);
    return row ?? null;
  }
}
