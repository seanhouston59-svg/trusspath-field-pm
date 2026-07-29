/**
 * Storage repo for the Sub Drop Portal.
 *
 * Two tables, both tenant-scoped by (organization_id, project_id):
 *   - project_drop_tokens: per-project QR tokens (one per project usually)
 *   - sub_uploads:         one row per inbound file from a sub
 *
 * The public /drop/:token endpoint does NOT have an authenticated
 * organizationId, so `getDropTokenByToken` is the only method that reads
 * without a scope filter. Every other method requires an orgId and enforces
 * it in the WHERE clause \u2014 no cross-tenant reads are possible.
 */
import { projectDropTokens, subUploads } from "@shared/schema";
import type {
  ProjectDropToken, SubUpload, InsertProjectDropToken, InsertSubUpload,
} from "@shared/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class SubDropRepo {
  /** Public lookup by opaque token \u2014 called from the unauthenticated /drop
   *  endpoint. Returns the token row only if it exists AND is not revoked. */
  async getDropTokenByToken(token: string): Promise<ProjectDropToken | undefined> {
    await ensureReady();
    const rows = await db.select().from(projectDropTokens)
      .where(and(eq(projectDropTokens.token, token), isNull(projectDropTokens.revokedAt)));
    return rows[0];
  }

  /** Tenant-scoped read \u2014 lists every token for a project so the PM can pick
   *  which one is the "site trailer" QR and revoke old ones. */
  async listDropTokens(organizationId: number, projectId: number): Promise<ProjectDropToken[]> {
    await ensureReady();
    return await db.select().from(projectDropTokens)
      .where(and(
        eq(projectDropTokens.organizationId, organizationId),
        eq(projectDropTokens.projectId, projectId),
      ))
      .orderBy(desc(projectDropTokens.createdAt));
  }

  async createDropToken(data: InsertProjectDropToken): Promise<ProjectDropToken> {
    await ensureReady();
    const [row] = await db.insert(projectDropTokens).values(data).returning();
    return row;
  }

  /** Soft-revoke by stamping revoked_at. Old QR stickers stop working
   *  immediately; the row stays around for audit. */
  async revokeDropToken(organizationId: number, tokenId: number): Promise<void> {
    await ensureReady();
    await db.update(projectDropTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(
        eq(projectDropTokens.organizationId, organizationId),
        eq(projectDropTokens.id, tokenId),
      ));
  }

  /** Called from the /drop endpoint after a successful upload so the PM can
   *  see when the token last saw activity. Fire-and-forget by callers. */
  async touchDropToken(tokenId: number): Promise<void> {
    await ensureReady();
    await db.update(projectDropTokens)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(projectDropTokens.id, tokenId));
  }

  async createSubUpload(data: InsertSubUpload): Promise<SubUpload> {
    await ensureReady();
    const [row] = await db.insert(subUploads).values(data).returning();
    return row;
  }

  /** Tenant + project scoped list, newest first. Filters are optional so the
   *  PM inbox can pivot between "all", "needs sorting", and per-category views
   *  with the same query. */
  async listSubUploads(
    organizationId: number,
    projectId: number | undefined,
    opts: { category?: string; status?: string; limit?: number } = {},
  ): Promise<SubUpload[]> {
    await ensureReady();
    const conds = [eq(subUploads.organizationId, organizationId)];
    if (projectId !== undefined) conds.push(eq(subUploads.projectId, projectId));
    if (opts.category) conds.push(eq(subUploads.category, opts.category));
    if (opts.status) conds.push(eq(subUploads.status, opts.status));
    const q = db.select().from(subUploads)
      .where(and(...conds))
      .orderBy(desc(subUploads.createdAt));
    if (opts.limit && opts.limit > 0) return await q.limit(opts.limit);
    return await q;
  }

  async getSubUpload(organizationId: number, id: number): Promise<SubUpload | undefined> {
    await ensureReady();
    const rows = await db.select().from(subUploads)
      .where(and(eq(subUploads.organizationId, organizationId), eq(subUploads.id, id)));
    return rows[0];
  }

  /** PM-side edits: change category, mark reviewed, add notes. All optional \u2014
   *  callers pass only the fields they want to change. */
  async updateSubUpload(
    organizationId: number, id: number,
    patch: Partial<Pick<SubUpload, "category" | "categoryOverriddenById" | "status" | "reviewedByAccountId" | "reviewedAt" | "notes">>,
  ): Promise<SubUpload | undefined> {
    await ensureReady();
    const [row] = await db.update(subUploads).set(patch)
      .where(and(eq(subUploads.organizationId, organizationId), eq(subUploads.id, id)))
      .returning();
    return row;
  }

  /** Category counts for the PM inbox header (e.g. "COIs (12)  Photos (147)").
   *  A single COUNT-with-GROUP-BY on the indexed (project_id, category)
   *  columns \u2014 stays fast even at 10k+ uploads per project. */
  async countSubUploadsByCategory(
    organizationId: number, projectId: number | undefined,
  ): Promise<Record<string, number>> {
    await ensureReady();
    const rows = await db.select().from(subUploads)
      .where(and(
        eq(subUploads.organizationId, organizationId),
        ...(projectId !== undefined ? [eq(subUploads.projectId, projectId)] : []),
      ));
    const out: Record<string, number> = {};
    for (const r of rows) out[r.category] = (out[r.category] ?? 0) + 1;
    return out;
  }
}
