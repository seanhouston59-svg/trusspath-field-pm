import { notes, milestones, mobilizationPlans, mobilizationItems, mobilizationPermits, mobilizationEquipment, mobilizationUtilities, mobilizationStaff, mobilizationSubs, mobilizationRisks, mobilizationSignatures, mobilizationSectionNotes } from '@shared/schema';
import type { Project, MobilizationPlan, InsertMobilizationPlan, MobilizationItem, InsertMobilizationItem, MobilizationPermit, InsertMobilizationPermit, MobilizationEquipment, InsertMobilizationEquipment, MobilizationUtility, InsertMobilizationUtility, MobilizationStaff, InsertMobilizationStaff, MobilizationSub, InsertMobilizationSub, MobilizationRisk, InsertMobilizationRisk, MobilizationSignature, InsertMobilizationSignature, MobilizationSectionNote } from '@shared/schema';
import { MOBILIZATION_SECTIONS, DEFAULT_MOBILIZATION_ITEMS, DEFAULT_PERMITS, DEFAULT_MILESTONE_OFFSETS, MOBILIZATION_MILESTONE_KIND, addDays, DEFAULT_SIGNER_ROLES } from '@shared/mobilization-catalog';
import { eq } from "drizzle-orm";
import type { IStorage } from "./types";
import { db } from "./db";
import { ensureReady } from "./ready";
import { matchSignerName } from "./helpers";

export class MobilizationRepo {
  /** Back-reference for the handful of reads that legitimately cross a
   *  domain boundary — see the `this.root.` call sites below. */
  constructor(private root: IStorage) {}

  async seedMobilization(projectId: number, startDate?: string | null): Promise<void> {
    await ensureReady();
    const existing = await this.getMobilizationPlan(projectId);
    if (existing) return;

    const target = addDays(startDate, 0);
    await db.insert(mobilizationPlans).values({
      projectId,
      status: "planning",
      targetStartDate: target,
    });

    const items: InsertMobilizationItem[] = [];
    MOBILIZATION_SECTIONS.forEach((section) => {
      DEFAULT_MOBILIZATION_ITEMS[section].forEach((item, i) => {
        items.push({
          projectId,
          section,
          title: item.title,
          description: item.description ?? null,
          status: "not_started",
          sortOrder: i,
        });
      });
    });
    if (items.length > 0) await db.insert(mobilizationItems).values(items);

    await db.insert(mobilizationPermits).values(
      DEFAULT_PERMITS.map((p) => ({
        projectId,
        name: p.name,
        agency: p.agency,
        status: "Not Started" as const,
      })),
    );

    await db.insert(milestones).values(
      DEFAULT_MILESTONE_OFFSETS.map((m) => ({
        projectId,
        title: m.title,
        date: addDays(startDate, m.dayOffset),
        kind: MOBILIZATION_MILESTONE_KIND,
        status: "pending",
      })),
    );

    // Sign-off block. Names are a best-effort match against the org roster —
    // an unmatched role still gets a row so the PDF renders a blank to sign.
    // Scoped to the project's organization; an unscoped roster read would pull
    // names from other tenants.
    const project = await this.root.getProject(projectId);
    const roster = project?.organizationId != null
      ? await this.root.getTeam(project.organizationId)
      : [];
    await db.insert(mobilizationSignatures).values(
      DEFAULT_SIGNER_ROLES.map((role, i) => ({
        projectId,
        role,
        name: matchSignerName(roster, role),
        sortOrder: i,
      })),
    );
  }

  async getMobilizationPlan(projectId: number): Promise<MobilizationPlan | undefined> {
    await ensureReady();
    const rows = await db.select().from(mobilizationPlans).where(eq(mobilizationPlans.projectId, projectId));
    return rows[0];
  }

  async upsertMobilizationPlan(projectId: number, data: Partial<InsertMobilizationPlan>): Promise<MobilizationPlan> {
    await ensureReady();
    const existing = await this.getMobilizationPlan(projectId);
    if (!existing) {
      const [row] = await db.insert(mobilizationPlans).values({
        projectId,
        status: data.status ?? "planning",
        targetStartDate: data.targetStartDate ?? addDays(null, 0),
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
        notes: data.notes ?? null,
      }).returning();
      return row;
    }
    const { projectId: _ignored, ...patch } = data;
    if (Object.keys(patch).length === 0) return existing;
    const [row] = await db.update(mobilizationPlans).set(patch)
      .where(eq(mobilizationPlans.projectId, projectId)).returning();
    return row;
  }

  async getMobilizationItems(projectId: number): Promise<MobilizationItem[]> {
    await ensureReady();
    return await db.select().from(mobilizationItems).where(eq(mobilizationItems.projectId, projectId));
  }

  async createMobilizationItem(data: InsertMobilizationItem): Promise<MobilizationItem> {
    await ensureReady();
    const [row] = await db.insert(mobilizationItems).values(data).returning();
    return row;
  }

  async updateMobilizationItem(id: number, data: Partial<InsertMobilizationItem>): Promise<MobilizationItem | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationItems).set(data).where(eq(mobilizationItems.id, id)).returning();
    return row;
  }

  async deleteMobilizationItem(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationItems).where(eq(mobilizationItems.id, id));
  }

  async getMobilizationPermits(projectId: number): Promise<MobilizationPermit[]> {
    await ensureReady();
    return await db.select().from(mobilizationPermits).where(eq(mobilizationPermits.projectId, projectId));
  }

  async createMobilizationPermit(data: InsertMobilizationPermit): Promise<MobilizationPermit> {
    await ensureReady();
    const [row] = await db.insert(mobilizationPermits).values(data).returning();
    return row;
  }

  async updateMobilizationPermit(id: number, data: Partial<InsertMobilizationPermit>): Promise<MobilizationPermit | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationPermits).set(data).where(eq(mobilizationPermits.id, id)).returning();
    return row;
  }

  async deleteMobilizationPermit(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationPermits).where(eq(mobilizationPermits.id, id));
  }

  async getMobilizationEquipment(projectId: number): Promise<MobilizationEquipment[]> {
    await ensureReady();
    return await db.select().from(mobilizationEquipment).where(eq(mobilizationEquipment.projectId, projectId));
  }

  async createMobilizationEquipment(data: InsertMobilizationEquipment): Promise<MobilizationEquipment> {
    await ensureReady();
    const [row] = await db.insert(mobilizationEquipment).values(data).returning();
    return row;
  }

  async updateMobilizationEquipment(id: number, data: Partial<InsertMobilizationEquipment>): Promise<MobilizationEquipment | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationEquipment).set(data).where(eq(mobilizationEquipment.id, id)).returning();
    return row;
  }

  async deleteMobilizationEquipment(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationEquipment).where(eq(mobilizationEquipment.id, id));
  }

  async getMobilizationUtilities(projectId: number): Promise<MobilizationUtility[]> {
    await ensureReady();
    return await db.select().from(mobilizationUtilities).where(eq(mobilizationUtilities.projectId, projectId));
  }

  async createMobilizationUtility(data: InsertMobilizationUtility): Promise<MobilizationUtility> {
    await ensureReady();
    const [row] = await db.insert(mobilizationUtilities).values(data).returning();
    return row;
  }

  async updateMobilizationUtility(id: number, data: Partial<InsertMobilizationUtility>): Promise<MobilizationUtility | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationUtilities).set(data).where(eq(mobilizationUtilities.id, id)).returning();
    return row;
  }

  async deleteMobilizationUtility(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationUtilities).where(eq(mobilizationUtilities.id, id));
  }

  async getMobilizationStaff(projectId: number): Promise<MobilizationStaff[]> {
    await ensureReady();
    return await db.select().from(mobilizationStaff).where(eq(mobilizationStaff.projectId, projectId));
  }

  async createMobilizationStaff(data: InsertMobilizationStaff): Promise<MobilizationStaff> {
    await ensureReady();
    const [row] = await db.insert(mobilizationStaff).values(data).returning();
    return row;
  }

  async updateMobilizationStaff(id: number, data: Partial<InsertMobilizationStaff>): Promise<MobilizationStaff | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationStaff).set(data).where(eq(mobilizationStaff.id, id)).returning();
    return row;
  }

  async deleteMobilizationStaff(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationStaff).where(eq(mobilizationStaff.id, id));
  }

  async getMobilizationSubs(projectId: number): Promise<MobilizationSub[]> {
    await ensureReady();
    return await db.select().from(mobilizationSubs).where(eq(mobilizationSubs.projectId, projectId));
  }

  async createMobilizationSub(data: InsertMobilizationSub): Promise<MobilizationSub> {
    await ensureReady();
    const [row] = await db.insert(mobilizationSubs).values(data).returning();
    return row;
  }

  async updateMobilizationSub(id: number, data: Partial<InsertMobilizationSub>): Promise<MobilizationSub | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationSubs).set(data).where(eq(mobilizationSubs.id, id)).returning();
    return row;
  }

  async deleteMobilizationSub(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationSubs).where(eq(mobilizationSubs.id, id));
  }

  async getMobilizationRisks(projectId: number): Promise<MobilizationRisk[]> {
    await ensureReady();
    return await db.select().from(mobilizationRisks).where(eq(mobilizationRisks.projectId, projectId));
  }

  async createMobilizationRisk(data: InsertMobilizationRisk): Promise<MobilizationRisk> {
    await ensureReady();
    const [row] = await db.insert(mobilizationRisks).values(data).returning();
    return row;
  }

  async updateMobilizationRisk(id: number, data: Partial<InsertMobilizationRisk>): Promise<MobilizationRisk | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationRisks).set(data).where(eq(mobilizationRisks.id, id)).returning();
    return row;
  }

  async deleteMobilizationRisk(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationRisks).where(eq(mobilizationRisks.id, id));
  }

  async getMobilizationSignatures(projectId: number): Promise<MobilizationSignature[]> {
    await ensureReady();
    return await db.select().from(mobilizationSignatures)
      .where(eq(mobilizationSignatures.projectId, projectId))
      .orderBy(mobilizationSignatures.sortOrder, mobilizationSignatures.id);
  }

  async createMobilizationSignature(data: InsertMobilizationSignature): Promise<MobilizationSignature> {
    await ensureReady();
    const [row] = await db.insert(mobilizationSignatures).values(data).returning();
    return row;
  }

  async updateMobilizationSignature(id: number, data: Partial<InsertMobilizationSignature>): Promise<MobilizationSignature | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationSignatures).set(data).where(eq(mobilizationSignatures.id, id)).returning();
    return row;
  }

  async deleteMobilizationSignature(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationSignatures).where(eq(mobilizationSignatures.id, id));
  }

  async getMobilizationSectionNotes(projectId: number): Promise<MobilizationSectionNote[]> {
    await ensureReady();
    return await db.select().from(mobilizationSectionNotes)
      .where(eq(mobilizationSectionNotes.projectId, projectId));
  }
  // Rows are never pre-seeded, so the first save for a section inserts and
  // every later save updates — hence the upsert on (project_id, section).

  async upsertMobilizationSectionNote(
    projectId: number,
    section: string,
    data: { narrative: string; updatedById?: number | null },
  ): Promise<MobilizationSectionNote> {
    await ensureReady();
    const updatedAt = new Date().toISOString();
    const updatedById = data.updatedById ?? null;
    const [row] = await db.insert(mobilizationSectionNotes)
      .values({ projectId, section, narrative: data.narrative, updatedAt, updatedById })
      .onConflictDoUpdate({
        target: [mobilizationSectionNotes.projectId, mobilizationSectionNotes.section],
        set: { narrative: data.narrative, updatedAt, updatedById },
      })
      .returning();
    return row;
  }

  /* --------------------------- Project Setup --------------------------- */
  // Seeds a fresh project's setup record: the 1:1 setup row, the 13 default
  // deliverables, and the 5 charter signers. Stakeholders and contract docs
  // are NOT seeded — both directories are entirely project-specific.
  // Idempotent: bails when a setup row already exists, so a retried project
  // create can't double-seed.
}
