import { projects } from '@shared/schema';
import type { Project, InsertProject } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class ProjectsRepo {
  async getProjects(organizationId?: number | null): Promise<Project[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    if (organizationId !== undefined) return await db.select().from(projects).where(eq(projects.organizationId, organizationId));
    return await db.select().from(projects);
  }

  async getProject(id: number): Promise<Project | undefined> {
    await ensureReady();
    const rows = await db.select().from(projects).where(eq(projects.id, id));
    return rows[0];
  }

  async createProject(data: InsertProject): Promise<Project> {
    await ensureReady();
    // Auto-generate project number: PRJ-001, PRJ-002, ...
    const existing = await db.select().from(projects);
    const nextNum = existing.length + 1;
    const projectNumber = `PRJ-${String(nextNum).padStart(3, "0")}`;
    const [row] = await db.insert(projects).values({ ...data, number: projectNumber }).returning();
    return row;
  }

  async updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined> {
    await ensureReady();
    const [row] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return row;
  }
}
