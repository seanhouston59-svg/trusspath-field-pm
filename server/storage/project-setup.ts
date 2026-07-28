import { projectSetup, projectSetupStakeholders, projectSetupContractDocs, projectSetupDeliverables, projectSetupSignatures } from '@shared/schema';
import type { ProjectSetup, InsertProjectSetup, ProjectSetupStakeholder, InsertProjectSetupStakeholder, ProjectSetupContractDoc, InsertProjectSetupContractDoc, ProjectSetupDeliverable, InsertProjectSetupDeliverable, ProjectSetupSignature, InsertProjectSetupSignature } from '@shared/schema';
import { PROJECT_SETUP_DELIVERABLES, PROJECT_SETUP_SIGNERS, PROJECT_SETUP_SIGNER_ALIASES } from '@shared/project-setup-catalog';
import { eq } from "drizzle-orm";
import type { IStorage } from "./types";
import { db } from "./db";
import { ensureReady } from "./ready";
import { matchSignerName } from "./helpers";

export class ProjectSetupRepo {
  /** Back-reference for the handful of reads that legitimately cross a
   *  domain boundary — see the `this.root.` call sites below. */
  constructor(private root: IStorage) {}

  async seedProjectSetup(projectId: number, organizationId: number | null): Promise<void> {
    await ensureReady();
    const existing = await this.getProjectSetup(projectId);
    if (existing) return;

    const now = new Date().toISOString();
    await db.insert(projectSetup).values({
      projectId,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(projectSetupDeliverables).values(
      PROJECT_SETUP_DELIVERABLES.map((d) => ({
        projectId,
        label: d.label,
        status: "pending",
        sortOrder: d.sortOrder,
      })),
    );

    // Names are a best-effort match against the org roster — an unmatched role
    // still gets a row so the charter renders a blank to sign. Reading the
    // roster unscoped would pull names from other tenants onto this charter,
    // so a project with no organization gets no auto-fill at all.
    const roster = organizationId != null ? await this.root.getTeam(organizationId) : [];
    await db.insert(projectSetupSignatures).values(
      PROJECT_SETUP_SIGNERS.map((role, i) => ({
        projectId,
        role,
        name: matchSignerName(roster, role, PROJECT_SETUP_SIGNER_ALIASES),
        sortOrder: i,
      })),
    );
  }

  async getProjectSetup(projectId: number): Promise<ProjectSetup | null> {
    await ensureReady();
    const rows = await db.select().from(projectSetup).where(eq(projectSetup.projectId, projectId));
    return rows[0] ?? null;
  }

  async getProjectSetupBundle(projectId: number): Promise<{
    setup: ProjectSetup | null;
    stakeholders: ProjectSetupStakeholder[];
    contractDocs: ProjectSetupContractDoc[];
    deliverables: ProjectSetupDeliverable[];
    signatures: ProjectSetupSignature[];
  }> {
    await ensureReady();
    const [setup, stakeholders, contractDocs, deliverables, signatures] = await Promise.all([
      this.getProjectSetup(projectId),
      db.select().from(projectSetupStakeholders)
        .where(eq(projectSetupStakeholders.projectId, projectId))
        .orderBy(projectSetupStakeholders.sortOrder, projectSetupStakeholders.id),
      db.select().from(projectSetupContractDocs)
        .where(eq(projectSetupContractDocs.projectId, projectId))
        .orderBy(projectSetupContractDocs.sortOrder, projectSetupContractDocs.id),
      db.select().from(projectSetupDeliverables)
        .where(eq(projectSetupDeliverables.projectId, projectId))
        .orderBy(projectSetupDeliverables.sortOrder, projectSetupDeliverables.id),
      db.select().from(projectSetupSignatures)
        .where(eq(projectSetupSignatures.projectId, projectId))
        .orderBy(projectSetupSignatures.sortOrder, projectSetupSignatures.id),
    ]);
    return { setup, stakeholders, contractDocs, deliverables, signatures };
  }

  // Returns null when the project has no setup row — callers surface that as
  // "not set up yet" rather than lazily creating one, so the opt-in seed
  // endpoint stays the only path that brings a legacy project into the module.

  async updateProjectSetup(
    projectId: number,
    patch: Partial<InsertProjectSetup>,
  ): Promise<ProjectSetup | null> {
    await ensureReady();
    const { id: _id, projectId: _pid, ...rest } = patch;
    if (Object.keys(rest).length === 0) return await this.getProjectSetup(projectId);
    const [row] = await db.update(projectSetup)
      .set({ ...rest, updatedAt: new Date().toISOString() })
      .where(eq(projectSetup.projectId, projectId))
      .returning();
    return row ?? null;
  }

  async createStakeholder(data: InsertProjectSetupStakeholder): Promise<ProjectSetupStakeholder> {
    await ensureReady();
    const [row] = await db.insert(projectSetupStakeholders).values(data).returning();
    return row;
  }

  async updateStakeholder(
    id: number,
    data: Partial<InsertProjectSetupStakeholder>,
  ): Promise<ProjectSetupStakeholder | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupStakeholders).set(data)
      .where(eq(projectSetupStakeholders.id, id)).returning();
    return row;
  }

  async deleteStakeholder(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupStakeholders).where(eq(projectSetupStakeholders.id, id));
  }

  async createContractDoc(data: InsertProjectSetupContractDoc): Promise<ProjectSetupContractDoc> {
    await ensureReady();
    const [row] = await db.insert(projectSetupContractDocs).values(data).returning();
    return row;
  }

  async updateContractDoc(
    id: number,
    data: Partial<InsertProjectSetupContractDoc>,
  ): Promise<ProjectSetupContractDoc | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupContractDocs).set(data)
      .where(eq(projectSetupContractDocs.id, id)).returning();
    return row;
  }

  async deleteContractDoc(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupContractDocs).where(eq(projectSetupContractDocs.id, id));
  }

  async createDeliverable(data: InsertProjectSetupDeliverable): Promise<ProjectSetupDeliverable> {
    await ensureReady();
    const [row] = await db.insert(projectSetupDeliverables).values(data).returning();
    return row;
  }

  async updateDeliverable(
    id: number,
    data: Partial<InsertProjectSetupDeliverable>,
  ): Promise<ProjectSetupDeliverable | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupDeliverables).set(data)
      .where(eq(projectSetupDeliverables.id, id)).returning();
    return row;
  }

  async deleteDeliverable(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupDeliverables).where(eq(projectSetupDeliverables.id, id));
  }

  async createSetupSignature(data: InsertProjectSetupSignature): Promise<ProjectSetupSignature> {
    await ensureReady();
    const [row] = await db.insert(projectSetupSignatures).values(data).returning();
    return row;
  }

  async updateSetupSignature(
    id: number,
    data: Partial<InsertProjectSetupSignature>,
  ): Promise<ProjectSetupSignature | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupSignatures).set(data)
      .where(eq(projectSetupSignatures.id, id)).returning();
    return row;
  }

  async deleteSetupSignature(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupSignatures).where(eq(projectSetupSignatures.id, id));
  }

  /* --- By-id reads. Child rows carry no organizationId, so a route holding
     only a row id must load the row to learn which project owns it before it
     may mutate or delete it. --- */

  async getStakeholderById(id: number): Promise<ProjectSetupStakeholder | null> {
    await ensureReady();
    const [row] = await db.select().from(projectSetupStakeholders).where(eq(projectSetupStakeholders.id, id)).limit(1);
    return row ?? null;
  }

  async getContractDocById(id: number): Promise<ProjectSetupContractDoc | null> {
    await ensureReady();
    const [row] = await db.select().from(projectSetupContractDocs).where(eq(projectSetupContractDocs.id, id)).limit(1);
    return row ?? null;
  }

  async getDeliverableById(id: number): Promise<ProjectSetupDeliverable | null> {
    await ensureReady();
    const [row] = await db.select().from(projectSetupDeliverables).where(eq(projectSetupDeliverables.id, id)).limit(1);
    return row ?? null;
  }

  async getSetupSignatureById(id: number): Promise<ProjectSetupSignature | null> {
    await ensureReady();
    const [row] = await db.select().from(projectSetupSignatures).where(eq(projectSetupSignatures.id, id)).limit(1);
    return row ?? null;
  }
}
