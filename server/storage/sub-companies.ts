/**
 * Sub Company identity + session repo.
 *
 * Sub companies are a separate identity primitive from GC `accounts`; they
 * live in their own table (`sub_companies`), have their own login flow, and
 * carry their own session tokens. No sub session can ever hit a GC endpoint
 * or vice versa \u2014 the middleware enforces that split.
 *
 * Password hashing and session tokens use the same primitives as `accounts.ts`
 * (scrypt for hashes, HMAC-signed stateless tokens for sessions). This keeps
 * the security surface uniform: one bug fix in one place applies to both.
 *
 * `sub_company_projects` is the join table \u2014 every QR-scan attaches a sub
 * company to a project. We use "attach" (create-if-missing) semantics so
 * repeat scans are idempotent, and a soft-detach column so a PM can remove a
 * sub without losing the paper trail of their historical uploads.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { subCompanies, subCompanyProjects } from "@shared/schema";
import type {
  SubCompany, SubCompanyPublic, SubCompanyProject, InsertSubCompany,
} from "@shared/schema";
import { db } from "./db";
import { ensureReady } from "./ready";

// Sub sessions expire 30 days after issue \u2014 same window as GC sessions so
// the UX (auto-logout timing) matches.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Distinct HMAC secret prefix so a leaked GC session token can't validate as
// a sub session and vice versa \u2014 the prefix folds into the HMAC input.
const SUB_SESSION_HMAC_NAMESPACE = "trusspath-sub-session-v1:";

export type SubSessionInfo = {
  token: string;
  subCompany: SubCompanyPublic;
  expiresAt: string;
};

export class SubCompaniesRepo {
  // --- Password + session primitives -------------------------------------

  /** scrypt(salt, password). Matches accounts.ts \u2014 same cost, same format. */
  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  /** Constant-time compare against a stored `salt:hash` string. */
  private verifyHash(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const target = Buffer.from(hash, "hex");
    if (derived.length !== target.length) return false;
    return timingSafeEqual(derived, target);
  }

  /** Strip the password hash before crossing any response boundary. */
  private toPublic(s: SubCompany): SubCompanyPublic {
    const { passwordHash: _pw, ...rest } = s;
    return rest;
  }

  /** Sign a `{subCompanyId, expiresAtMs}` payload with the server secret.
   *  Returns `base64url(payload).hex(sig)` \u2014 same shape as GC sessions but
   *  namespaced so tokens don't cross domains. */
  private mintSessionToken(subCompanyId: number): { token: string; expiresAt: Date } {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const payload = `${subCompanyId}.${expiresAt.getTime()}`;
    const b64 = (s: string) =>
      Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const secret = process.env.SESSION_SECRET || "trusspath-dev-secret-change-me";
    const sig = scryptSync(SUB_SESSION_HMAC_NAMESPACE + payload, secret, 32).toString("hex");
    return { token: `${b64(payload)}.${sig}`, expiresAt };
  }

  // --- Sub company CRUD ---------------------------------------------------

  /** Register a new sub company. Email is lower-cased and treated as the
   *  primary key for login. Throws if the email is already taken so the
   *  registration UI can show a "sign in instead?" prompt. */
  async register(input: {
    companyName: string; trade: string; contactName: string;
    contactEmail: string; contactPhone?: string; password: string;
  }): Promise<SubCompanyPublic> {
    await ensureReady();
    const email = input.contactEmail.trim().toLowerCase();
    const existing = await db.select().from(subCompanies).where(eq(subCompanies.contactEmail, email));
    if (existing[0]) throw new Error("Email already registered");
    const [row] = await db.insert(subCompanies).values({
      companyName: input.companyName.trim(),
      trade: input.trade,
      contactName: input.contactName.trim(),
      contactEmail: email,
      contactPhone: input.contactPhone?.trim() || null,
      passwordHash: this.hashPassword(input.password),
      createdAt: new Date().toISOString(),
    } satisfies InsertSubCompany).returning();
    return this.toPublic(row);
  }

  /** Verify credentials and, on success, mint a session token. Returns null
   *  on any failure (wrong email, wrong password, suspended) so callers can
   *  respond with a single opaque 401 \u2014 no user enumeration. */
  async login(email: string, password: string): Promise<SubSessionInfo | null> {
    await ensureReady();
    const normEmail = email.trim().toLowerCase();
    const rows = await db.select().from(subCompanies).where(eq(subCompanies.contactEmail, normEmail));
    const sub = rows[0];
    if (!sub) return null;
    if (sub.suspendedAt) return null;
    if (!this.verifyHash(password, sub.passwordHash)) return null;
    const { token, expiresAt } = this.mintSessionToken(sub.id);
    return { token, subCompany: this.toPublic(sub), expiresAt: expiresAt.toISOString() };
  }

  /** Validate a token and resolve to the sub company row. Called by the
   *  `resolveSubSession` middleware on every request to a sub endpoint. */
  async resolveSession(token: string | undefined | null): Promise<SubCompanyPublic | null> {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    let payload: string;
    try {
      payload = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    } catch { return null; }
    const [idStr, expStr] = payload.split(".");
    const subCompanyId = Number(idStr);
    const expMs = Number(expStr);
    if (!Number.isFinite(subCompanyId) || !Number.isFinite(expMs)) return null;
    if (expMs < Date.now()) return null;
    const secret = process.env.SESSION_SECRET || "trusspath-dev-secret-change-me";
    const expected = scryptSync(SUB_SESSION_HMAC_NAMESPACE + payload, secret, 32).toString("hex");
    const a = Buffer.from(parts[1], "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    await ensureReady();
    const rows = await db.select().from(subCompanies).where(eq(subCompanies.id, subCompanyId));
    const sub = rows[0];
    if (!sub) return null;
    if (sub.suspendedAt) return null;
    return this.toPublic(sub);
  }

  async getById(id: number): Promise<SubCompanyPublic | undefined> {
    await ensureReady();
    const rows = await db.select().from(subCompanies).where(eq(subCompanies.id, id));
    return rows[0] ? this.toPublic(rows[0]) : undefined;
  }

  async getByEmail(email: string): Promise<SubCompanyPublic | undefined> {
    await ensureReady();
    const rows = await db.select().from(subCompanies)
      .where(eq(subCompanies.contactEmail, email.trim().toLowerCase()));
    return rows[0] ? this.toPublic(rows[0]) : undefined;
  }

  /** PM (or a future org-admin) suspends a sub company. Suspended companies
   *  can't sign in and can't drop, but their historical uploads and joins
   *  stay intact. Callers should scope-check first. */
  async suspend(subCompanyId: number, byAccountId: number): Promise<void> {
    await ensureReady();
    await db.update(subCompanies)
      .set({ suspendedAt: new Date().toISOString(), suspendedByAccountId: byAccountId })
      .where(eq(subCompanies.id, subCompanyId));
  }

  async unsuspend(subCompanyId: number): Promise<void> {
    await ensureReady();
    await db.update(subCompanies)
      .set({ suspendedAt: null, suspendedByAccountId: null })
      .where(eq(subCompanies.id, subCompanyId));
  }

  // --- sub_company_projects (attach / list) -------------------------------

  /** Idempotent attach. If (subCompanyId, projectId) already exists and is
   *  not detached, does nothing; otherwise inserts (or un-detaches) a row.
   *  Called by both the registration flow and every subsequent QR scan. */
  async attachToProject(input: {
    subCompanyId: number; organizationId: number; projectId: number;
    joinedViaDropTokenId?: number;
  }): Promise<SubCompanyProject> {
    await ensureReady();
    const existing = await db.select().from(subCompanyProjects)
      .where(and(
        eq(subCompanyProjects.subCompanyId, input.subCompanyId),
        eq(subCompanyProjects.projectId, input.projectId),
      ));
    // Prefer to reuse an existing row \u2014 un-detach if it was previously removed
    // so the PM's history stays continuous.
    if (existing[0]) {
      if (existing[0].detachedAt) {
        const [updated] = await db.update(subCompanyProjects)
          .set({ detachedAt: null, joinedAt: new Date().toISOString() })
          .where(eq(subCompanyProjects.id, existing[0].id)).returning();
        return updated;
      }
      return existing[0];
    }
    const [row] = await db.insert(subCompanyProjects).values({
      subCompanyId: input.subCompanyId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      joinedAt: new Date().toISOString(),
      joinedViaDropTokenId: input.joinedViaDropTokenId ?? null,
    }).returning();
    return row;
  }

  /** Soft-detach: PM removes a sub from a project. Sub can be re-attached
   *  on the next scan without a schema mutation. */
  async detachFromProject(subCompanyId: number, projectId: number): Promise<void> {
    await ensureReady();
    await db.update(subCompanyProjects)
      .set({ detachedAt: new Date().toISOString() })
      .where(and(
        eq(subCompanyProjects.subCompanyId, subCompanyId),
        eq(subCompanyProjects.projectId, projectId),
        isNull(subCompanyProjects.detachedAt),
      ));
  }

  /** Confirm a sub company is currently attached to a project. Used by the
   *  drop endpoint to ensure the token's project matches the sub's set of
   *  authorized projects \u2014 even if the token is real, a sub who was
   *  detached shouldn't be able to keep dropping via a stale QR scan. */
  async isAttached(subCompanyId: number, projectId: number): Promise<boolean> {
    await ensureReady();
    const rows = await db.select().from(subCompanyProjects)
      .where(and(
        eq(subCompanyProjects.subCompanyId, subCompanyId),
        eq(subCompanyProjects.projectId, projectId),
        isNull(subCompanyProjects.detachedAt),
      ));
    return rows.length > 0;
  }

  /** Projects a signed-in sub can see \u2014 powers their post-login project
   *  picker on the /drop page. Excludes soft-detached joins. */
  async listProjectsForSub(subCompanyId: number): Promise<SubCompanyProject[]> {
    await ensureReady();
    return await db.select().from(subCompanyProjects)
      .where(and(
        eq(subCompanyProjects.subCompanyId, subCompanyId),
        isNull(subCompanyProjects.detachedAt),
      ))
      .orderBy(desc(subCompanyProjects.joinedAt));
  }

  /** Sub companies on a given GC project \u2014 powers the PM's "Sub Companies"
   *  inbox tab. Returns join rows; caller fans out to load sub company
   *  details as needed (kept as two queries to avoid a heavy join). */
  async listSubsForProject(
    organizationId: number, projectId: number,
  ): Promise<SubCompanyProject[]> {
    await ensureReady();
    return await db.select().from(subCompanyProjects)
      .where(and(
        eq(subCompanyProjects.organizationId, organizationId),
        eq(subCompanyProjects.projectId, projectId),
        isNull(subCompanyProjects.detachedAt),
      ))
      .orderBy(desc(subCompanyProjects.joinedAt));
  }

  /** All sub companies across every project of an org \u2014 for a future
   *  org-wide "Sub Directory" view. Not used at MVP but the shape matches
   *  the per-project variant so the UI can reuse rendering code. */
  async listSubsForOrg(organizationId: number): Promise<SubCompanyProject[]> {
    await ensureReady();
    return await db.select().from(subCompanyProjects)
      .where(and(
        eq(subCompanyProjects.organizationId, organizationId),
        isNull(subCompanyProjects.detachedAt),
      ))
      .orderBy(desc(subCompanyProjects.joinedAt));
  }
}
