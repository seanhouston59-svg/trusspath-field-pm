import { integrations, subscribers, demoRequests } from '@shared/schema';
import type { Integration, Subscriber, DemoRequest, InsertSubscriber, InsertDemoRequest } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class IntegrationsRepo {
  async getIntegrations(): Promise<Integration[]> {
    await ensureReady();
    return await db.select().from(integrations);
  }

  async setIntegration(key: string, connected: boolean, config?: string): Promise<Integration> {
    await ensureReady();
    const now = new Date().toISOString();
    const existingRows = await db.select().from(integrations).where(eq(integrations.key, key));
    const existing = existingRows[0];
    if (existing) {
      const [row] = await db.update(integrations)
        .set({ connected, connectedAt: connected ? now : null, config: config ?? existing.config })
        .where(eq(integrations.key, key)).returning();
      return row;
    }
    const [row] = await db.insert(integrations)
      .values({ key, connected, connectedAt: connected ? now : null, config })
      .returning();
    return row;
  }

  async connectIntegration(key: string, data: { accountLabel?: string; config?: string }): Promise<Integration> {
    await ensureReady();
    const now = new Date().toISOString();
    const existingRows = await db.select().from(integrations).where(eq(integrations.key, key));
    const existing = existingRows[0];
    const values = {
      connected: true,
      status: "connected" as const,
      connectedAt: now,
      accountLabel: data.accountLabel ?? null,
      config: data.config ?? existing?.config ?? null,
    };
    if (existing) {
      const [row] = await db.update(integrations).set(values).where(eq(integrations.key, key)).returning();
      return row;
    }
    const [row] = await db.insert(integrations).values({ key, ...values }).returning();
    return row;
  }

  async disconnectIntegration(key: string): Promise<Integration> {
    await ensureReady();
    const existingRows = await db.select().from(integrations).where(eq(integrations.key, key));
    const existing = existingRows[0];
    const values = {
      connected: false,
      status: "available" as const,
      connectedAt: null,
      accountLabel: null,
    };
    if (existing) {
      const [row] = await db.update(integrations).set(values).where(eq(integrations.key, key)).returning();
      return row;
    }
    const [row] = await db.insert(integrations).values({ key, ...values }).returning();
    return row;
  }

  async createSubscriber(data: InsertSubscriber): Promise<Subscriber> {
    await ensureReady();
    const now = new Date().toISOString();
    const existingRows = await db.select().from(subscribers).where(eq(subscribers.email, data.email));
    const existing = existingRows[0];
    if (existing) {
      const [row] = await db.update(subscribers)
        .set({ plan: data.plan, billing: data.billing, company: data.company ?? existing.company })
        .where(eq(subscribers.email, data.email)).returning();
      return row;
    }
    const [row] = await db.insert(subscribers).values({ ...data, createdAt: now }).returning();
    return row;
  }

  async listSubscribers(): Promise<Subscriber[]> {
    await ensureReady();
    return await db.select().from(subscribers);
  }

  async createDemoRequest(data: InsertDemoRequest): Promise<DemoRequest> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.insert(demoRequests).values({ ...data, createdAt: now }).returning();
    return row;
  }

  async listDemoRequests(): Promise<DemoRequest[]> {
    await ensureReady();
    return await db.select().from(demoRequests);
  }

  /* --------------------------- Settings ---------------------------- */
  // UNSCOPED: app_settings is a single global row (id=1) holding Jarvis persona
  // prefs. The table has an organization_id column but no code writes it, so
  // there is no per-org row to read. No tenant records are exposed, but the
  // prefs themselves are shared across tenants. Making them per-org requires a
  // write-path and primary-key change, so it is out of scope here.
}
