import { photos, blueprints, droneCaptures } from '@shared/schema';
import type { Photo, Blueprint, DroneCapture, InsertPhoto, InsertBlueprint, InsertDroneCapture } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class PhotosRepo {
  async getPhotos(projectId?: number): Promise<Photo[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(photos).where(eq(photos.projectId, projectId));
    return await db.select().from(photos);
  }

  async getPhoto(id: number): Promise<Photo | undefined> {
    await ensureReady();
    const rows = await db.select().from(photos).where(eq(photos.id, id));
    return rows[0];
  }

  async createPhoto(data: InsertPhoto): Promise<Photo> {
    await ensureReady();
    const [row] = await db.insert(photos).values(data).returning();
    return row;
  }

  async deletePhoto(id: number): Promise<void> {
    await ensureReady();
    await db.delete(photos).where(eq(photos.id, id));
  }

  async getBlueprints(projectId?: number): Promise<Blueprint[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(blueprints).where(eq(blueprints.projectId, projectId));
    return await db.select().from(blueprints);
  }

  async createBlueprint(data: InsertBlueprint): Promise<Blueprint> {
    await ensureReady();
    const [row] = await db.insert(blueprints).values(data).returning();
    return row;
  }

  async getDroneCaptures(projectId?: number): Promise<DroneCapture[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(droneCaptures).where(eq(droneCaptures.projectId, projectId));
    return await db.select().from(droneCaptures);
  }

  async getDroneCapture(id: number): Promise<DroneCapture | undefined> {
    await ensureReady();
    const rows = await db.select().from(droneCaptures).where(eq(droneCaptures.id, id));
    return rows[0];
  }

  async createDroneCapture(data: InsertDroneCapture): Promise<DroneCapture> {
    await ensureReady();
    const [row] = await db.insert(droneCaptures).values(data).returning();
    return row;
  }

  async deleteDroneCapture(id: number): Promise<void> {
    await ensureReady();
    await db.delete(droneCaptures).where(eq(droneCaptures.id, id));
  }
}
