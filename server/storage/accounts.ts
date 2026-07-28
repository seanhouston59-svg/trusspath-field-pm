import { projects, tasks, rfis, submittals, teamMembers, contacts, equipment, photos, documents, blueprints, messages, notes, integrations, milestones, accounts, sessions, passwordResetTokens, timesheets } from '@shared/schema';
import type { Project, TeamMember, InsertTeamMember, Account, AccountPublic, Session, PasswordResetToken } from '@shared/schema';
import { eq, isNotNull } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { sql } from "./db";
import { ensureReady } from "./ready";

export class AccountsRepo {
  async getTeam(organizationId?: number | null): Promise<TeamMember[]> {
    await ensureReady();
    // A null scope means "no organization" and must not widen to every tenant.
    if (organizationId === null) return [];
    if (organizationId !== undefined) return await db.select().from(teamMembers).where(eq(teamMembers.organizationId, organizationId));
    return await db.select().from(teamMembers);
  }

  async getTeamMember(id: number): Promise<TeamMember | undefined> {
    await ensureReady();
    const rows = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return rows[0];
  }

  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    await ensureReady();
    const [row] = await db.insert(teamMembers).values(data).returning();
    return row;
  }

  async updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    await ensureReady();
    const [row] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
    return row;
  }

  async deleteTeamMember(id: number): Promise<void> {
    await ensureReady();
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const derived = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${derived}`;
  }

  private verifyHash(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const target = Buffer.from(hash, "hex");
    if (derived.length !== target.length) return false;
    return timingSafeEqual(derived, target);
  }

  private toPublic(a: Account): AccountPublic {
    const { passwordHash: _pw, ...rest } = a;
    return rest;
  }

  async createAccount(email: string, password: string, displayName: string, company?: string, role: string = "member"): Promise<AccountPublic> {
    await ensureReady();
    const normEmail = email.trim().toLowerCase();
    const existingRows = await db.select().from(accounts).where(eq(accounts.email, normEmail));
    if (existingRows[0]) throw new Error("Email already registered");
    const now = new Date().toISOString();
    const [row] = await db.insert(accounts).values({
      email: normEmail,
      passwordHash: this.hashPassword(password),
      displayName,
      role,
      company: company ?? null,
      createdAt: now,
    }).returning();
    return this.toPublic(row);
  }

  async getAccountByEmail(email: string): Promise<Account | undefined> {
    await ensureReady();
    const rows = await db.select().from(accounts).where(eq(accounts.email, email.trim().toLowerCase()));
    return rows[0];
  }

  async getAccount(id: number): Promise<AccountPublic | undefined> {
    await ensureReady();
    const rows = await db.select().from(accounts).where(eq(accounts.id, id));
    const a = rows[0];
    return a ? this.toPublic(a) : undefined;
  }

  async updateAccountProfile(id: number, data: { displayName?: string; position?: string }): Promise<AccountPublic | undefined> {
    await ensureReady();
    const updateData: Record<string, unknown> = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.position !== undefined) updateData.position = data.position;
    if (Object.keys(updateData).length === 0) return this.getAccount(id);
    const [row] = await db.update(accounts).set(updateData).where(eq(accounts.id, id)).returning();
    return row ? this.toPublic(row) : undefined;
  }
  // Persist a user's per-account dashboard customization. Passing `null`
  // clears the row so the client falls back to role-based defaults.

  async updateDashboardLayout(
    id: number,
    layout: { widgets: Array<{ id: string; size: "sm" | "md" | "lg" | "xl"; hidden?: boolean }> } | null,
  ): Promise<AccountPublic | undefined> {
    await ensureReady();
    const [row] = await db.update(accounts).set({ dashboardLayout: layout as any }).where(eq(accounts.id, id)).returning();
    return row ? this.toPublic(row) : undefined;
  }

  async updateAccountBilling(id: number, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    subscriptionBilling?: string;
    subscriptionCurrentPeriodEnd?: string;
  }): Promise<AccountPublic | undefined> {
    await ensureReady();
    const updateData: Record<string, unknown> = {};
    if (data.stripeCustomerId !== undefined) updateData.stripeCustomerId = data.stripeCustomerId;
    if (data.stripeSubscriptionId !== undefined) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
    if (data.subscriptionStatus !== undefined) updateData.subscriptionStatus = data.subscriptionStatus;
    if (data.subscriptionPlan !== undefined) updateData.subscriptionPlan = data.subscriptionPlan;
    if (data.subscriptionBilling !== undefined) updateData.subscriptionBilling = data.subscriptionBilling;
    if (data.subscriptionCurrentPeriodEnd !== undefined) updateData.subscriptionCurrentPeriodEnd = data.subscriptionCurrentPeriodEnd;
    if (Object.keys(updateData).length === 0) return this.getAccount(id);
    const [row] = await db.update(accounts).set(updateData).where(eq(accounts.id, id)).returning();
    return row ? this.toPublic(row) : undefined;
  }
  // Field punches (mobile clock in/out). Kept dead simple: append-only stream
  // of events. Rollup into weekly timesheets is a separate concern.

  async getAccountByStripeCustomerId(customerId: string): Promise<Account | undefined> {
    await ensureReady();
    const rows = await db.select().from(accounts).where(eq(accounts.stripeCustomerId, customerId));
    return rows[0];
  }

  async verifyPassword(email: string, password: string): Promise<AccountPublic | null> {
    const acc = await this.getAccountByEmail(email);
    if (!acc) return null;
    if (!this.verifyHash(password, acc.passwordHash)) return null;
    return this.toPublic(acc);
  }
  // Demo login — like createAccount but stamps demoExpiresAt and auto-approves so
  // there's no admin approval step in the way of a prospect logging in.

  async createDemoAccount(email: string, password: string, displayName: string, expiresAt: string): Promise<AccountPublic> {
    await ensureReady();
    const normEmail = email.trim().toLowerCase();
    const existingRows = await db.select().from(accounts).where(eq(accounts.email, normEmail));
    if (existingRows[0]) throw new Error("Email already registered");
    const now = new Date().toISOString();
    const [row] = await db.insert(accounts).values({
      email: normEmail,
      passwordHash: this.hashPassword(password),
      displayName,
      role: "member",
      company: "TrussPath Demo",
      createdAt: now,
      approvalStatus: "approved",
      approvedAt: now,
      demoExpiresAt: expiresAt,
    }).returning();
    return this.toPublic(row);
  }

  async listDemoAccounts(): Promise<AccountPublic[]> {
    await ensureReady();
    const rows = await db.select().from(accounts).where(isNotNull(accounts.demoExpiresAt));
    return rows.map((r) => this.toPublic(r));
  }
  // Force a demo to expire now (so login + existing sessions stop working immediately).

  async expireDemoAccount(id: number): Promise<AccountPublic | undefined> {
    await ensureReady();
    const acc = (await db.select().from(accounts).where(eq(accounts.id, id)))[0];
    if (!acc || !acc.demoExpiresAt) return undefined; // only touches demo accounts
    const [row] = await db.update(accounts)
      .set({ demoExpiresAt: new Date(0).toISOString() })
      .where(eq(accounts.id, id))
      .returning();
    return row ? this.toPublic(row) : undefined;
  }

  // Hard-delete demo accounts whose expiry is more than `graceDays` in the past,
  // along with the isolated demo orgs they own and every child row that lived
  // inside them. Safety rails:
  //   - only touches accounts with a non-null demo_expires_at
  //   - only touches orgs that (a) the demo account is a member of AND
  //     (b) contain no non-demo members
  // This keeps the function safe to run on a cron / at startup without any
  // chance of nuking a real customer org that happened to briefly host a demo
  // seat.

  async purgeExpiredDemos(graceDays: number): Promise<{ purgedAccountIds: number[]; purgedOrgIds: number[] }> {
    await ensureReady();
    const cutoff = new Date(Date.now() - graceDays * 86400 * 1000).toISOString();

    // Step 1 - find candidate demo accounts.
    const expiredAccounts = await sql`
      SELECT id FROM accounts
      WHERE demo_expires_at IS NOT NULL
        AND demo_expires_at < ${cutoff}
    ` as Array<{ id: number }>;
    if (!expiredAccounts.length) return { purgedAccountIds: [], purgedOrgIds: [] };
    const accountIds = expiredAccounts.map((r) => r.id);

    // Step 2 - find orgs to purge. An org is only purged when every member of
    // it is one of the expired demo accounts. Otherwise we leave it alone even
    // if a demo account was ever attached, so a real paying org is never at
    // risk. Using ANY(array) is safe because accountIds is numeric only.
    const orgsToPurge = await sql`
      SELECT o.id FROM organizations o
      WHERE EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.organization_id = o.id AND m.account_id = ANY(${accountIds}::int[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM memberships m2
        WHERE m2.organization_id = o.id AND NOT (m2.account_id = ANY(${accountIds}::int[]))
      )
    ` as Array<{ id: number }>;
    const orgIds = orgsToPurge.map((r) => r.id);

    if (orgIds.length) {
      // Step 3 - gather every project inside these orgs so we can wipe their
      // project-scoped children too. Only projects belonging to purged orgs.
      const projectRows = await sql`
        SELECT id FROM projects WHERE organization_id = ANY(${orgIds}::int[])
      ` as Array<{ id: number }>;
      const projectIds = projectRows.map((r) => r.id);

      // Order matters: children first, then org-scoped, then the orgs.
      // Project-scoped children (safe no-op when projectIds is empty).
      if (projectIds.length) {
        // Timesheet_entries cascades via timesheet_id already (see DDL). Others
        // are deleted here explicitly.
        await sql`DELETE FROM action_items WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM blueprints WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM change_orders WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM daily_logs WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM documents WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM drone_captures WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM jarvis_memory WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM messages WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM milestones WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM notes WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM photos WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM project_members WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM punch_items WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM rfis WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM submittals WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM tasks WHERE project_id = ANY(${projectIds}::int[])`;
        await sql`DELETE FROM timesheets WHERE project_id = ANY(${projectIds}::int[])`;
      }

      // Org-scoped rows.
      await sql`DELETE FROM invites WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM team_members WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM contacts WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM equipment WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM company_documents WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM integrations WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM app_settings WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM projects WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM memberships WHERE organization_id = ANY(${orgIds}::int[])`;
      await sql`DELETE FROM organizations WHERE id = ANY(${orgIds}::int[])`;
    }

    // Step 4 - kill sessions + password reset tokens + memberships on any org
    // that survived, then delete the accounts themselves.
    await sql`DELETE FROM sessions WHERE account_id = ANY(${accountIds}::int[])`;
    await sql`DELETE FROM password_reset_tokens WHERE account_id = ANY(${accountIds}::int[])`;
    await sql`DELETE FROM memberships WHERE account_id = ANY(${accountIds}::int[])`;
    await sql`DELETE FROM accounts WHERE id = ANY(${accountIds}::int[])`;

    return { purgedAccountIds: accountIds, purgedOrgIds: orgIds };
  }

  async createPasswordResetToken(accountId: number): Promise<string> {
    await ensureReady();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await db.insert(passwordResetTokens).values({ token, accountId, expiresAt });
    return token;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    await ensureReady();
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return rows[0];
  }

  async usePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    await ensureReady();
    const row = await this.getPasswordResetToken(token);
    if (!row) return null;
    if (row.usedAt) return null;
    if (new Date(row.expiresAt) < new Date()) return null;
    const [updated] = await db.update(passwordResetTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordResetTokens.id, row.id))
      .returning();
    return updated ?? null;
  }

  async updatePassword(accountId: number, newPassword: string): Promise<void> {
    await ensureReady();
    await db.update(accounts)
      .set({ passwordHash: this.hashPassword(newPassword) })
      .where(eq(accounts.id, accountId));
  }

  createSession(accountId: number): Session {
    // Stateless HMAC token — no DB required.
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const payload = `${accountId}.${expires.getTime()}`;
    const b64 = (s: string | Buffer) =>
      Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const secret = process.env.SESSION_SECRET || "trusspath-dev-secret-change-me";
    const sig = scryptSync(payload, secret, 32).toString("hex");
    const token = `${b64(payload)}.${sig}`;
    return { id: token, accountId, createdAt: now.toISOString(), expiresAt: expires.toISOString() };
  }

  async getSession(token: string): Promise<{ session: Session; account: AccountPublic } | null> {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    let payload: string;
    try {
      payload = Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    } catch {
      return null;
    }
    const [accIdStr, expStr] = payload.split(".");
    const accountId = Number(accIdStr);
    const expMs = Number(expStr);
    if (!Number.isFinite(accountId) || !Number.isFinite(expMs)) return null;
    if (expMs < Date.now()) return null;
    const secret = process.env.SESSION_SECRET || "trusspath-dev-secret-change-me";
    const expected = scryptSync(payload, secret, 32).toString("hex");
    const a = Buffer.from(parts[1], "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const account = await this.getAccount(accountId);
    if (!account) return null;
    const session: Session = {
      id: token,
      accountId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(expMs).toISOString(),
    };
    return { session, account };
  }

  destroySession(_token: string): void {
    // Stateless tokens: client discards the cookie/token; nothing to revoke server-side.
  }

  async countAccounts(): Promise<number> {
    await ensureReady();
    const rows = await db.select().from(accounts);
    return rows.length;
  }

  async listAccountsForAdmin(): Promise<AccountPublic[]> {
    await ensureReady();
    const rows = await db.select().from(accounts);
    return rows
      .map((a) => this.toPublic(a))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async setAccountApproval(
    id: number,
    status: "pending" | "approved" | "denied",
    approverId: number,
  ): Promise<AccountPublic | undefined> {
    await ensureReady();
    const patch: Record<string, unknown> = {
      approvalStatus: status,
    };
    if (status === "approved") {
      patch.approvedAt = new Date().toISOString();
      patch.approvedBy = approverId;
    } else {
      patch.approvedAt = null;
      patch.approvedBy = null;
    }
    const [row] = await db.update(accounts).set(patch).where(eq(accounts.id, id)).returning();
    return row ? this.toPublic(row) : undefined;
  }

  /* --------------------------- Jarvis memory --------------------------- */
}
