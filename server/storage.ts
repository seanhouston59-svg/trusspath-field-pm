import {
  projects, tasks, rfis, submittals, changeOrders, actionItems,
  dailyLogs, punchItems, teamMembers, contacts, equipment, photos,
  documents, companyDocuments, deletedItems, blueprints, droneCaptures, messages, notes,
  integrations,
  subscribers, demoRequests,
  appSettings,
  milestones,
  accounts, sessions, passwordResetTokens,
  jarvisMemory,
  timesheets, timeEntries,
  fieldPunches,
  fieldObservations,
  DEFAULT_SETTINGS,
} from '@shared/schema';
import type {
  Project, Task, Rfi, Submittal, ChangeOrder, ActionItem,
  DailyLog, PunchItem, TeamMember, Contact, Equipment, Photo,
  DocumentRow, CompanyDocument, DeletedItem, Blueprint, DroneCapture, Message, Note,
  Integration,
  InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder,
  InsertActionItem, InsertDailyLog, InsertPunchItem, InsertContact, InsertEquipment,
  InsertPhoto, InsertDocument, InsertCompanyDocument, InsertDeletedItem, InsertBlueprint, InsertDroneCapture, InsertMessage, InsertNote, InsertTeamMember,
  InsertIntegration,
  Milestone, InsertMilestone,
  Account, AccountPublic, Session, PasswordResetToken,
  Subscriber, DemoRequest, InsertSubscriber, InsertDemoRequest,
  JarvisMemory, InsertJarvisMemory,
  Timesheet, InsertTimesheet,
  TimeEntry, InsertTimeEntry,
  FieldPunch, InsertFieldPunch,
  FieldObservation, InsertFieldObservation,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, isNotNull } from "drizzle-orm";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const RAW_CONN = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!RAW_CONN || !/^postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/.+/.test(RAW_CONN)) {
  const msg = !RAW_CONN
    ? "[storage] DATABASE_URL is not set. Set it in Vercel → Project → Settings → Environment Variables to the Neon connection string (postgresql://user:password@host/dbname?sslmode=require)."
    : "[storage] DATABASE_URL is malformed. Expected postgresql://user:password@host/dbname?sslmode=require. Check for empty strings, extra quotes, or missing credentials in the Vercel env var.";
  console.error(msg);
}
// The @neondatabase/serverless HTTP driver needs the non-pooled endpoint.
// The "-pooler" host is for TCP/PgBouncer connections and can cause
// intermittent fetch failures when used with the HTTP driver.
// Prefer POSTGRES_URL_NON_POOLING (set by Vercel Neon integration).
// Otherwise strip "-pooler" from the hostname and remove TCP-only params.
const CONN = RAW_CONN
  ? RAW_CONN
      .replace(/-pooler\./, ".")
      .replace(/[?&]channel_binding=[^&]*/g, "")
      .replace(/[?&]sslmode=[^&]*/g, "")
      .replace(/\?$/, "")
  : "postgresql://user:pass@localhost/placeholder";
const sql = neon(CONN);
export const db = drizzle(sql);

async function migrate() {
  // Idempotent CREATE TABLE statements — Postgres syntax.
  await sql`CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, role TEXT NOT NULL, trade TEXT NOT NULL,
    company TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL,
    email TEXT, phone TEXT, company_photo TEXT,
    access_level TEXT NOT NULL DEFAULT 'project_manager'
  )`;
  await sql`CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, number TEXT NOT NULL, client TEXT NOT NULL,
    type TEXT NOT NULL, status TEXT NOT NULL, address TEXT NOT NULL,
    start_date TEXT NOT NULL, end_date TEXT NOT NULL,
    budget DOUBLE PRECISION NOT NULL, spent DOUBLE PRECISION NOT NULL, progress INTEGER NOT NULL,
    superintendent_id INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, title TEXT NOT NULL, trade TEXT NOT NULL,
    status TEXT NOT NULL, priority TEXT NOT NULL, assignee_id INTEGER,
    due_date TEXT NOT NULL, start_date TEXT, end_date TEXT, seq INTEGER,
    depends_on TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS rfis (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, number TEXT NOT NULL, subject TEXT NOT NULL,
    status TEXT NOT NULL, assignee_id INTEGER,
    date_created TEXT NOT NULL, due_date TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS submittals (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, number TEXT NOT NULL, subject TEXT NOT NULL,
    type TEXT NOT NULL, status TEXT NOT NULL, assignee_id INTEGER,
    date_submitted TEXT NOT NULL, due_date TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS change_orders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL,
    status TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL, schedule_impact INTEGER NOT NULL,
    date_issued TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS action_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, title TEXT NOT NULL, owner TEXT NOT NULL,
    status TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT NOT NULL,
    source TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS daily_logs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, date TEXT NOT NULL, author_id INTEGER,
    weather TEXT NOT NULL, temp INTEGER NOT NULL, crew_count INTEGER NOT NULL,
    summary TEXT NOT NULL, photos TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS punch_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, title TEXT NOT NULL, location TEXT NOT NULL,
    trade TEXT NOT NULL, status TEXT NOT NULL, assignee_id INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL,
    trade TEXT NOT NULL, type TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS equipment (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
    project_id INTEGER, operator TEXT, location TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, caption TEXT NOT NULL, location TEXT NOT NULL,
    taken_by_id INTEGER, date TEXT NOT NULL, hue INTEGER NOT NULL,
    stored_file_name TEXT, original_file_name TEXT, mime_type TEXT, file_size_bytes INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
    size TEXT NOT NULL, uploaded_by_id INTEGER, date TEXT NOT NULL,
    stored_file_name TEXT, original_file_name TEXT, mime_type TEXT, file_size_bytes INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS company_documents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    signature_required BOOLEAN NOT NULL DEFAULT FALSE,
    signature_status TEXT NOT NULL DEFAULT 'Not Required',
    signer_name TEXT,
    signer_email TEXT,
    docusign_url TEXT,
    due_date TEXT,
    notes TEXT,
    uploaded_by_id INTEGER,
    date TEXT NOT NULL,
    stored_file_name TEXT,
    original_file_name TEXT,
    mime_type TEXT,
    file_size_bytes INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS deleted_items (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    project_name TEXT,
    deleted_at TEXT NOT NULL,
    deleted_by_id INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS blueprints (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, sheet_number TEXT NOT NULL, title TEXT NOT NULL,
    discipline TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL,
    uploaded_by_id INTEGER, date TEXT NOT NULL, hue INTEGER NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS drone_captures (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, title TEXT NOT NULL, capture_type TEXT NOT NULL,
    pilot TEXT, flight_date TEXT NOT NULL, altitude TEXT, area TEXT,
    status TEXT NOT NULL, hue INTEGER NOT NULL,
    stored_file_name TEXT, original_file_name TEXT, mime_type TEXT, file_size_bytes INTEGER
  )`;
  await sql`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL, author_id INTEGER,
    body TEXT NOT NULL, created_at TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER, body TEXT NOT NULL, color TEXT NOT NULL,
    x INTEGER NOT NULL, y INTEGER NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    connected BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'available',
    account_label TEXT,
    connected_at TEXT,
    config TEXT
  )`;
  await sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available'`;
  await sql`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS account_label TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL,
    billing TEXT NOT NULL,
    company TEXT,
    created_at TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS demo_requests (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT NOT NULL,
    phone TEXT,
    team_size TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    config TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    position TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    company TEXT,
    created_at TEXT NOT NULL
  )`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS position TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_status TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_plan TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_billing TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_current_period_end TEXT`;
  // Access-control columns (approval gate). Default new accounts to 'pending';
  // the owner-bootstrap block later in this file will flip the configured owner to 'approved'.
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approved_at TEXT`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS approved_by INTEGER`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`;

  // Additive migrations — Postgres supports IF NOT EXISTS on ADD COLUMN.
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on TEXT`;
  await sql`ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS photos TEXT`;
  await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS company_photo TEXT`;
  await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'project_manager'`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS stored_file_name TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_file_name TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type TEXT`;
  await sql`ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS stored_file_name TEXT`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS original_file_name TEXT`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS mime_type TEXT`;
  await sql`ALTER TABLE photos ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER`;
  await sql`ALTER TABLE drone_captures ADD COLUMN IF NOT EXISTS stored_file_name TEXT`;
  await sql`ALTER TABLE drone_captures ADD COLUMN IF NOT EXISTS original_file_name TEXT`;
  await sql`ALTER TABLE drone_captures ADD COLUMN IF NOT EXISTS mime_type TEXT`;
  await sql`ALTER TABLE drone_captures ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER`;

  // Heal access_level for seed rows still at the default 'project_manager'.
  await sql`UPDATE team_members SET access_level = CASE
    WHEN role LIKE '%Executive%' THEN 'project_executive'
    WHEN role LIKE '%Superintendent%' THEN 'superintendent'
    WHEN role LIKE '%Foreman%' THEN 'foreman'
    WHEN role LIKE '%QC%' OR role LIKE '%Quality%' THEN 'superintendent'
    WHEN role LIKE '%Manager%' THEN 'project_manager'
    ELSE access_level END
    WHERE access_level = 'project_manager'`;

  // Populate email/phone for rows seeded before these columns existed.
  await sql`UPDATE team_members SET
    email = CASE WHEN email IS NULL OR email = '' THEN lower(replace(name,' ','.')) || '@' || lower(replace(replace(company,' ',''),'.','')) || '.com' ELSE email END,
    phone = CASE WHEN phone IS NULL OR phone = '' THEN '(303) 555-' || substr('0000' || ((id * 137) % 9000 + 1000)::text, -4) ELSE phone END`;

  // Password reset tokens table
  await sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS jarvis_memory (
    id SERIAL PRIMARY KEY,
    project_id INTEGER,
    question TEXT NOT NULL,
    normalized_question TEXT NOT NULL,
    topic TEXT,
    answer TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'user_taught',
    hit_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS timesheets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    total_hours TEXT NOT NULL DEFAULT '0',
    status TEXT NOT NULL DEFAULT 'draft',
    employee_signature TEXT,
    manager_signature TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS time_entries (
    id SERIAL PRIMARY KEY,
    timesheet_id INTEGER NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    client_name TEXT,
    project_name TEXT,
    hours_worked TEXT NOT NULL DEFAULT '0',
    activities TEXT,
    created_at TEXT NOT NULL
  )`;

  // Owner bootstrap — configured owner email is always the app admin: role='owner',
  // approval_status='approved', and (best-effort) subscription_status='active' so they
  // aren't locked out of their own app. Everyone else stays in the state they were in.
  const ownerEmail = (process.env.OWNER_EMAIL || "houston.sean90@gmail.com").trim().toLowerCase();
  if (ownerEmail) {
    try {
      await sql`UPDATE accounts
        SET role = 'owner',
            approval_status = 'approved',
            approved_at = COALESCE(approved_at, ${new Date().toISOString()}),
            subscription_status = COALESCE(subscription_status, 'active')
        WHERE lower(email) = ${ownerEmail}`;
    } catch (e) {
      console.error("[migrate] owner bootstrap failed:", e);
    }
  }
}

export interface IStorage {
  getTeam(): Promise<TeamMember[]>;
  getTeamMember(id: number): Promise<TeamMember | undefined>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: number): Promise<void>;
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  getTasks(projectId?: number): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task | undefined>;
  updateRfiStatus(id: number, status: string): Promise<Rfi | undefined>;
  updateSubmittalStatus(id: number, status: string): Promise<Submittal | undefined>;
  updateChangeOrderStatus(id: number, status: string): Promise<ChangeOrder | undefined>;
  getRfis(projectId?: number): Promise<Rfi[]>;
  createRfi(data: InsertRfi): Promise<Rfi>;
  getSubmittals(projectId?: number): Promise<Submittal[]>;
  createSubmittal(data: InsertSubmittal): Promise<Submittal>;
  getChangeOrders(projectId?: number): Promise<ChangeOrder[]>;
  createChangeOrder(data: InsertChangeOrder): Promise<ChangeOrder>;
  createActionItem(data: InsertActionItem): Promise<ActionItem>;
  getActionItems(projectId?: number): Promise<ActionItem[]>;
  updateActionItemStatus(id: number, status: string): Promise<ActionItem | undefined>;
  getDailyLogs(projectId?: number): Promise<DailyLog[]>;
  createDailyLog(data: InsertDailyLog): Promise<DailyLog>;
  updateDailyLog(id: number, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined>;
  deleteDailyLog(id: number): Promise<void>;
  getPunchItems(projectId?: number): Promise<PunchItem[]>;
  createPunchItem(data: InsertPunchItem): Promise<PunchItem>;
  updatePunchStatus(id: number, status: string): Promise<PunchItem | undefined>;
  getContacts(): Promise<Contact[]>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  getEquipment(projectId?: number): Promise<Equipment[]>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  getPhotos(projectId?: number): Promise<Photo[]>;
  getPhoto(id: number): Promise<Photo | undefined>;
  createPhoto(data: InsertPhoto): Promise<Photo>;
  deletePhoto(id: number): Promise<void>;
  getDocuments(projectId?: number): Promise<DocumentRow[]>;
  getDocument(id: number): Promise<DocumentRow | undefined>;
  createDocument(data: InsertDocument): Promise<DocumentRow>;
  deleteDocument(id: number): Promise<void>;
  getCompanyDocuments(): Promise<CompanyDocument[]>;
  getCompanyDocument(id: number): Promise<CompanyDocument | undefined>;
  createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument>;
  updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined>;
  deleteCompanyDocument(id: number): Promise<void>;
  // Deleted Items Bin
  getDeletedItems(): Promise<DeletedItem[]>;
  softDeleteEntity(entityType: string, entityId: number, deletedById?: number): Promise<DeletedItem>;
  restoreEntity(entityType: string, entityId: number): Promise<any>;
  permanentDeleteEntity(entityType: string, entityId: number): Promise<void>;
  emptyDeletedItems(): Promise<void>;
  getBlueprints(projectId?: number): Promise<Blueprint[]>;
  createBlueprint(data: InsertBlueprint): Promise<Blueprint>;
  getDroneCaptures(projectId?: number): Promise<DroneCapture[]>;
  getDroneCapture(id: number): Promise<DroneCapture | undefined>;
  createDroneCapture(data: InsertDroneCapture): Promise<DroneCapture>;
  deleteDroneCapture(id: number): Promise<void>;
  getMilestones(projectId?: number): Promise<Milestone[]>;
  getMilestone(id: number): Promise<Milestone | undefined>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: number): Promise<void>;
  getMessages(projectId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  getNotes(projectId?: number): Promise<Note[]>;
  createNote(data: InsertNote): Promise<Note>;
  updateNotePosition(id: number, x: number, y: number): Promise<Note | undefined>;
  deleteNote(id: number): Promise<void>;
  getIntegrations(): Promise<Integration[]>;
  setIntegration(key: string, connected: boolean, config?: string): Promise<Integration>;
  connectIntegration(key: string, data: { accountLabel?: string; config?: string }): Promise<Integration>;
  disconnectIntegration(key: string): Promise<Integration>;
  createSubscriber(data: InsertSubscriber): Promise<Subscriber>;
  listSubscribers(): Promise<Subscriber[]>;
  createDemoRequest(data: InsertDemoRequest): Promise<DemoRequest>;
  listDemoRequests(): Promise<DemoRequest[]>;
  getSettings(): Promise<Record<string, any>>;
  updateSettings(patch: Record<string, any>): Promise<Record<string, any>>;
  resetAllData(): Promise<void>;
  wipeAllData(): Promise<void>;
  // ----- Auth -----
  createAccount(email: string, password: string, displayName: string, company?: string, role?: string): Promise<AccountPublic>;
  getAccountByEmail(email: string): Promise<Account | undefined>;
  getAccount(id: number): Promise<AccountPublic | undefined>;
  updateAccountProfile(id: number, data: { displayName?: string; position?: string }): Promise<AccountPublic | undefined>;
  updateAccountSmsState(id: number, data: {
    smsPhone?: string | null;
    smsVerifiedAt?: string | null;
    smsOptedOutAt?: string | null;
    smsVerificationCode?: string | null;
    smsVerificationExpiresAt?: string | null;
  }): Promise<AccountPublic | undefined>;
  // ----- Field punches (mobile clock in/out) -----
  createFieldPunch(data: InsertFieldPunch): Promise<FieldPunch>;
  getRecentFieldPunches(accountId: number, limit?: number): Promise<FieldPunch[]>;
  getOpenFieldPunch(accountId: number): Promise<FieldPunch | undefined>;
  getFieldPunchByClientId(accountId: number, clientId: string): Promise<FieldPunch | undefined>;
  createFieldObservation(data: InsertFieldObservation): Promise<FieldObservation>;
  getRecentFieldObservations(opts: { accountId?: number; organizationId?: number; projectId?: number; limit?: number }): Promise<FieldObservation[]>;
  getFieldObservationByClientId(accountId: number, clientId: string): Promise<FieldObservation | undefined>;
  updateAccountBilling(id: number, data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    subscriptionBilling?: string;
    subscriptionCurrentPeriodEnd?: string;
  }): Promise<AccountPublic | undefined>;
  getAccountByStripeCustomerId(customerId: string): Promise<Account | undefined>;
  verifyPassword(email: string, password: string): Promise<AccountPublic | null>;
  createPasswordResetToken(accountId: number): Promise<string>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  usePasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  updatePassword(accountId: number, newPassword: string): Promise<void>;
  createSession(accountId: number): Session;
  getSession(token: string): Promise<{ session: Session; account: AccountPublic } | null>;
  destroySession(token: string): void;
  countAccounts(): Promise<number>;
  // ----- Demo login (48h) -----
  createDemoAccount(email: string, password: string, displayName: string, expiresAt: string): Promise<AccountPublic>;
  listDemoAccounts(): Promise<AccountPublic[]>;
  expireDemoAccount(id: number): Promise<AccountPublic | undefined>;
  purgeExpiredDemos(graceDays: number): Promise<{ purgedAccountIds: number[]; purgedOrgIds: number[] }>;
  // ----- Admin / access control -----
  listAccountsForAdmin(): Promise<AccountPublic[]>;
  setAccountApproval(id: number, status: "pending" | "approved" | "denied", approverId: number): Promise<AccountPublic | undefined>;
  // Jarvis memory
  getJarvisMemories(projectId?: number): Promise<JarvisMemory[]>;
  searchJarvisMemory(query: string, projectId?: number): Promise<JarvisMemory | undefined>;
  createJarvisMemory(data: InsertJarvisMemory): Promise<JarvisMemory>;
  updateJarvisMemory(id: number, data: Partial<InsertJarvisMemory>): Promise<JarvisMemory | undefined>;
  incrementJarvisMemoryHit(id: number): Promise<void>;
  deleteJarvisMemory(id: number): Promise<void>;
  // Timesheets
  getTimesheets(projectId?: number): Promise<Timesheet[]>;
  getTimesheet(id: number): Promise<Timesheet | undefined>;
  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: number, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  deleteTimesheet(id: number): Promise<void>;
  // Time entries
  getTimeEntries(timesheetId: number): Promise<TimeEntry[]>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<void>;
  replaceTimeEntries(timesheetId: number, entries: InsertTimeEntry[]): Promise<void>;
}

// Ensure schema is ready before any query. Idempotent + memoized.
// Seeding is NOT automatic — only happens via explicit resetAllData() call.
// On failure the cached promise is cleared so the next request retries — a
// transient fetch error to Neon during cold-start init must not poison the
// warm function instance forever.
let initPromise: Promise<void> | null = null;
export function ensureReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await migrate();
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

class DatabaseStorage implements IStorage {
  async getTeam(organizationId?: number): Promise<TeamMember[]> {
    await ensureReady();
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

  async getProjects(organizationId?: number): Promise<Project[]> {
    await ensureReady();
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

  async getTasks(projectId?: number): Promise<Task[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(tasks).where(eq(tasks.projectId, projectId));
    return await db.select().from(tasks);
  }
  async createTask(data: InsertTask): Promise<Task> {
    await ensureReady();
    const [row] = await db.insert(tasks).values(data).returning();
    return row;
  }
  async updateTaskStatus(id: number, status: string): Promise<Task | undefined> {
    await ensureReady();
    const [row] = await db.update(tasks).set({ status }).where(eq(tasks.id, id)).returning();
    return row;
  }

  async getRfis(projectId?: number): Promise<Rfi[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(rfis).where(eq(rfis.projectId, projectId));
    return await db.select().from(rfis);
  }
  async createRfi(data: InsertRfi): Promise<Rfi> {
    await ensureReady();
    const [row] = await db.insert(rfis).values(data).returning();
    return row;
  }
  async updateRfiStatus(id: number, status: string): Promise<Rfi | undefined> {
    await ensureReady();
    const [row] = await db.update(rfis).set({ status }).where(eq(rfis.id, id)).returning();
    return row;
  }

  async getSubmittals(projectId?: number): Promise<Submittal[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(submittals).where(eq(submittals.projectId, projectId));
    return await db.select().from(submittals);
  }
  async createSubmittal(data: InsertSubmittal): Promise<Submittal> {
    await ensureReady();
    const [row] = await db.insert(submittals).values(data).returning();
    return row;
  }
  async updateSubmittalStatus(id: number, status: string): Promise<Submittal | undefined> {
    await ensureReady();
    const [row] = await db.update(submittals).set({ status }).where(eq(submittals.id, id)).returning();
    return row;
  }

  async getChangeOrders(projectId?: number): Promise<ChangeOrder[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId));
    return await db.select().from(changeOrders);
  }
  async createChangeOrder(data: InsertChangeOrder): Promise<ChangeOrder> {
    await ensureReady();
    const [row] = await db.insert(changeOrders).values(data).returning();
    return row;
  }
  async updateChangeOrderStatus(id: number, status: string): Promise<ChangeOrder | undefined> {
    await ensureReady();
    const [row] = await db.update(changeOrders).set({ status }).where(eq(changeOrders.id, id)).returning();
    return row;
  }

  async getActionItems(projectId?: number): Promise<ActionItem[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(actionItems).where(eq(actionItems.projectId, projectId));
    return await db.select().from(actionItems);
  }
  async createActionItem(data: InsertActionItem): Promise<ActionItem> {
    await ensureReady();
    const [row] = await db.insert(actionItems).values(data).returning();
    return row;
  }
  async updateActionItemStatus(id: number, status: string): Promise<ActionItem | undefined> {
    await ensureReady();
    const [row] = await db.update(actionItems).set({ status }).where(eq(actionItems.id, id)).returning();
    return row;
  }

  async getDailyLogs(projectId?: number): Promise<DailyLog[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(dailyLogs).where(eq(dailyLogs.projectId, projectId));
    return await db.select().from(dailyLogs);
  }
  async createDailyLog(data: InsertDailyLog): Promise<DailyLog> {
    await ensureReady();
    const [row] = await db.insert(dailyLogs).values(data).returning();
    return row;
  }
  async updateDailyLog(id: number, data: Partial<InsertDailyLog>): Promise<DailyLog | undefined> {
    await ensureReady();
    const [row] = await db.update(dailyLogs).set(data).where(eq(dailyLogs.id, id)).returning();
    return row;
  }
  async deleteDailyLog(id: number): Promise<void> {
    await ensureReady();
    await db.delete(dailyLogs).where(eq(dailyLogs.id, id));
  }

  async getPunchItems(projectId?: number): Promise<PunchItem[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(punchItems).where(eq(punchItems.projectId, projectId));
    return await db.select().from(punchItems);
  }
  async updatePunchStatus(id: number, status: string): Promise<PunchItem | undefined> {
    await ensureReady();
    const [row] = await db.update(punchItems).set({ status }).where(eq(punchItems.id, id)).returning();
    return row;
  }
  async createPunchItem(data: InsertPunchItem): Promise<PunchItem> {
    await ensureReady();
    const [row] = await db.insert(punchItems).values(data).returning();
    return row;
  }

  async getContacts(organizationId?: number): Promise<Contact[]> {
    await ensureReady();
    if (organizationId !== undefined) return await db.select().from(contacts).where(eq(contacts.organizationId, organizationId));
    return await db.select().from(contacts);
  }
  async createContact(data: InsertContact): Promise<Contact> {
    await ensureReady();
    const [row] = await db.insert(contacts).values(data).returning();
    return row;
  }
  async updateContact(id: number, data: Partial<InsertContact>): Promise<Contact | undefined> {
    await ensureReady();
    const [row] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return row;
  }
  async deleteContact(id: number): Promise<void> {
    await ensureReady();
    await db.delete(contacts).where(eq(contacts.id, id));
  }
  async getEquipment(projectId?: number, organizationId?: number): Promise<Equipment[]> {
    await ensureReady();
    const conds: any[] = [];
    if (projectId !== undefined) conds.push(eq(equipment.projectId, projectId));
    if (organizationId !== undefined) conds.push(eq(equipment.organizationId, organizationId));
    if (conds.length === 0) return await db.select().from(equipment);
    if (conds.length === 1) return await db.select().from(equipment).where(conds[0]);
    return await db.select().from(equipment).where(and(...conds));
  }
  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    await ensureReady();
    const [row] = await db.insert(equipment).values(data).returning();
    return row;
  }
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
  async getDocuments(projectId?: number): Promise<DocumentRow[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(documents).where(eq(documents.projectId, projectId));
    return await db.select().from(documents);
  }
  async getDocument(id: number): Promise<DocumentRow | undefined> {
    await ensureReady();
    const rows = await db.select().from(documents).where(eq(documents.id, id));
    return rows[0];
  }
  async createDocument(data: InsertDocument): Promise<DocumentRow> {
    await ensureReady();
    const [row] = await db.insert(documents).values(data).returning();
    return row;
  }
  async deleteDocument(id: number): Promise<void> {
    await ensureReady();
    await db.delete(documents).where(eq(documents.id, id));
  }
  async getCompanyDocuments(organizationId?: number): Promise<CompanyDocument[]> {
    await ensureReady();
    if (organizationId !== undefined) {
      return await db.select().from(companyDocuments).where(eq(companyDocuments.organizationId, organizationId)).orderBy(desc(companyDocuments.date));
    }
    return await db.select().from(companyDocuments).orderBy(desc(companyDocuments.date));
  }
  async getCompanyDocument(id: number): Promise<CompanyDocument | undefined> {
    await ensureReady();
    const rows = await db.select().from(companyDocuments).where(eq(companyDocuments.id, id));
    return rows[0];
  }
  async createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument> {
    await ensureReady();
    const [row] = await db.insert(companyDocuments).values(data).returning();
    return row;
  }
  async updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined> {
    await ensureReady();
    const [row] = await db.update(companyDocuments).set(data).where(eq(companyDocuments.id, id)).returning();
    return row;
  }
  async deleteCompanyDocument(id: number): Promise<void> {
    await ensureReady();
    await db.delete(companyDocuments).where(eq(companyDocuments.id, id));
  }
  // ---- Deleted Items Bin ----
  private ENTITY_CONFIG: Record<string, { table: any; nameCol: string; projectCol?: string }> = {
    tasks: { table: tasks, nameCol: "title", projectCol: "projectId" },
    rfis: { table: rfis, nameCol: "subject", projectCol: "projectId" },
    submittals: { table: submittals, nameCol: "subject", projectCol: "projectId" },
    "change-orders": { table: changeOrders, nameCol: "title", projectCol: "projectId" },
    "action-items": { table: actionItems, nameCol: "title", projectCol: "projectId" },
    "punch-items": { table: punchItems, nameCol: "title", projectCol: "projectId" },
    "daily-logs": { table: dailyLogs, nameCol: "date", projectCol: "projectId" },
    photos: { table: photos, nameCol: "caption", projectCol: "projectId" },
    documents: { table: documents, nameCol: "name", projectCol: "projectId" },
    "company-documents": { table: companyDocuments, nameCol: "title" },
    equipment: { table: equipment, nameCol: "name", projectCol: "projectId" },
    contacts: { table: contacts, nameCol: "name", projectCol: "projectId" },
    notes: { table: notes, nameCol: "content" },
    blueprints: { table: blueprints, nameCol: "title", projectCol: "projectId" },
    milestones: { table: milestones, nameCol: "name", projectCol: "projectId" },
    "team-members": { table: teamMembers, nameCol: "name" },
    "drone-captures": { table: droneCaptures, nameCol: "label", projectCol: "projectId" },
  };

  async getDeletedItems(): Promise<DeletedItem[]> {
    await ensureReady();
    return await db.select().from(deletedItems).orderBy(desc(deletedItems.deletedAt));
  }

  async softDeleteEntity(entityType: string, entityId: number, deletedById?: number): Promise<DeletedItem> {
    await ensureReady();
    const cfg = this.ENTITY_CONFIG[entityType];
    if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
    // Read the row
    const rows = await db.select().from(cfg.table).where(eq(cfg.table.id, entityId));
    const row = rows[0];
    if (!row) throw new Error(`${entityType} #${entityId} not found`);
    // Get project name if applicable
    let projectName: string | null = null;
    if (cfg.projectCol && row[cfg.projectCol]) {
      const projRows = await db.select().from(projects).where(eq(projects.id, row[cfg.projectCol]));
      projectName = projRows[0]?.name ?? null;
    }
    // Save to deleted_items
    const [deleted] = await db.insert(deletedItems).values({
      entityType,
      entityId,
      data: JSON.stringify(row),
      projectName,
      deletedAt: new Date().toISOString(),
      deletedById: deletedById ?? null,
    }).returning();
    // Hard delete from original table
    await db.delete(cfg.table).where(eq(cfg.table.id, entityId));
    return deleted;
  }

  async restoreEntity(entityType: string, entityId: number): Promise<any> {
    await ensureReady();
    const cfg = this.ENTITY_CONFIG[entityType];
    if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
    // Find in deleted_items
    const binRows = await db.select().from(deletedItems)
      .where(and(eq(deletedItems.entityType, entityType), eq(deletedItems.entityId, entityId))) as any[];
    const binRow = binRows[0] as any;
    if (!binRow) throw new Error(`Deleted ${entityType} #${entityId} not found in bin`);
    // Parse original row data
    const rowData = JSON.parse(binRow.data);
    // Re-insert into original table (let serial assign a new id)
    const { id, ...rest } = rowData;
    const restored = (await db.insert(cfg.table).values(rest).returning() as any[])[0];
    // Remove from deleted_items
    await db.delete(deletedItems).where(eq(deletedItems.id, binRow.id));
    return restored;
  }

  async permanentDeleteEntity(entityType: string, entityId: number): Promise<void> {
    await ensureReady();
    await db.delete(deletedItems)
      .where(and(eq(deletedItems.entityType, entityType), eq(deletedItems.entityId, entityId)));
  }

  async emptyDeletedItems(): Promise<void> {
    await ensureReady();
    await db.delete(deletedItems);
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
  async getMilestones(projectId?: number): Promise<Milestone[]> {
    await ensureReady();
    if (projectId) {
      return await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    }
    return await db.select().from(milestones);
  }
  async getMilestone(id: number): Promise<Milestone | undefined> {
    await ensureReady();
    const rows = await db.select().from(milestones).where(eq(milestones.id, id));
    return rows[0];
  }
  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    await ensureReady();
    const [row] = await db.insert(milestones).values(data).returning();
    return row;
  }
  async updateMilestone(id: number, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    await ensureReady();
    const [row] = await db.update(milestones).set(data).where(eq(milestones.id, id)).returning();
    return row;
  }
  async deleteMilestone(id: number): Promise<void> {
    await ensureReady();
    await db.delete(milestones).where(eq(milestones.id, id));
  }
  async getMessages(projectId: number): Promise<Message[]> {
    await ensureReady();
    return await db.select().from(messages).where(eq(messages.projectId, projectId));
  }
  async createMessage(data: InsertMessage): Promise<Message> {
    await ensureReady();
    const [row] = await db.insert(messages).values(data).returning();
    return row;
  }
  async getNotes(projectId?: number): Promise<Note[]> {
    await ensureReady();
    if (projectId !== undefined) return await db.select().from(notes).where(eq(notes.projectId, projectId));
    return await db.select().from(notes);
  }
  async createNote(data: InsertNote): Promise<Note> {
    await ensureReady();
    const [row] = await db.insert(notes).values(data).returning();
    return row;
  }
  async updateNotePosition(id: number, x: number, y: number): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.update(notes).set({ x, y }).where(eq(notes.id, id)).returning();
    return row;
  }
  async deleteNote(id: number): Promise<void> {
    await ensureReady();
    await db.delete(notes).where(eq(notes.id, id));
  }

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
  async getSettings(): Promise<Record<string, any>> {
    await ensureReady();
    const rows = await db.select().from(appSettings).where(eq(appSettings.id, 1));
    const row = rows[0];
    let stored: Record<string, any> = {};
    if (row?.config) {
      try { stored = JSON.parse(row.config) || {}; } catch { stored = {}; }
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  async updateSettings(patch: Record<string, any>): Promise<Record<string, any>> {
    await ensureReady();
    const merged = { ...(await this.getSettings()), ...patch };
    const CLAMPS: Record<string, [number, number]> = {
      voiceRate: [0.5, 1.3], voicePitch: [0, 1.5], defaultProjectId: [0, 1_000_000],
    };
    const clean: Record<string, any> = {};
    for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
      if (!(k in merged)) continue;
      const v = merged[k];
      if (typeof def === "number") {
        let num = typeof v === "number" ? v : parseFloat(v);
        if (isNaN(num)) num = def;
        const clamp = CLAMPS[k];
        if (clamp) num = Math.min(clamp[1], Math.max(clamp[0], num));
        clean[k] = num;
      } else if (typeof def === "boolean") {
        clean[k] = v === true || v === "true" || v === 1 || v === "1";
      } else {
        clean[k] = typeof v === "string" ? v.slice(0, 120) : def;
      }
    }
    const now = new Date().toISOString();
    const existingRows = await db.select().from(appSettings).where(eq(appSettings.id, 1));
    if (existingRows[0]) {
      await db.update(appSettings).set({ config: JSON.stringify(clean), updatedAt: now }).where(eq(appSettings.id, 1));
    } else {
      await db.insert(appSettings).values({ id: 1, config: JSON.stringify(clean), updatedAt: now });
    }
    return { ...DEFAULT_SETTINGS, ...clean };
  }
  async resetAllData(): Promise<void> {
    await ensureReady();
    // neon-http doesn't support drizzle transactions — do sequential deletes.
    for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, subscribers, demoRequests]) {
      await db.delete(t);
    }
    // Force re-seed on next request.
    seedDone = false;
    await this.seed();
  }

  async wipeAllData(): Promise<void> {
    await ensureReady();
    // Delete all project data — NO re-seed. Leaves a clean slate.
    for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, companyDocuments, deletedItems, subscribers, demoRequests]) {
      await db.delete(t);
    }
  }

  /* ---------------------- Auth helpers ---------------------- */
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
  // Patch any of the SMS/opt-in fields on an account. Fields left undefined
  // are preserved; explicit null clears them (used by opt-in-back which
  // resets smsOptedOutAt=null).
  async updateAccountSmsState(id: number, data: {
    smsPhone?: string | null;
    smsVerifiedAt?: string | null;
    smsOptedOutAt?: string | null;
    smsVerificationCode?: string | null;
    smsVerificationExpiresAt?: string | null;
  }): Promise<AccountPublic | undefined> {
    await ensureReady();
    const updateData: Record<string, unknown> = {};
    if (data.smsPhone !== undefined) updateData.smsPhone = data.smsPhone;
    if (data.smsVerifiedAt !== undefined) updateData.smsVerifiedAt = data.smsVerifiedAt;
    if (data.smsOptedOutAt !== undefined) updateData.smsOptedOutAt = data.smsOptedOutAt;
    if (data.smsVerificationCode !== undefined) updateData.smsVerificationCode = data.smsVerificationCode;
    if (data.smsVerificationExpiresAt !== undefined) updateData.smsVerificationExpiresAt = data.smsVerificationExpiresAt;
    if (Object.keys(updateData).length === 0) return this.getAccount(id);
    const [row] = await db.update(accounts).set(updateData).where(eq(accounts.id, id)).returning();
    return row ? this.toPublic(row) : undefined;
  }
  // Field punches (mobile clock in/out). Kept dead simple: append-only stream
  // of events. Rollup into weekly timesheets is a separate concern.
  async createFieldPunch(data: InsertFieldPunch): Promise<FieldPunch> {
    await ensureReady();
    const [row] = await db.insert(fieldPunches).values(data).returning();
    return row;
  }
  async getRecentFieldPunches(accountId: number, limit = 20): Promise<FieldPunch[]> {
    await ensureReady();
    const rows = await db.select().from(fieldPunches).where(eq(fieldPunches.accountId, accountId)).orderBy(desc(fieldPunches.createdAt)).limit(limit);
    return rows;
  }
  async getOpenFieldPunch(accountId: number): Promise<FieldPunch | undefined> {
    // "Open" means the most recent punch is a clock-in (or break_start). We
    // return it so the UI can show "You're clocked in since 7:14 AM".
    const rows = await this.getRecentFieldPunches(accountId, 1);
    if (rows.length === 0) return undefined;
    const latest = rows[0];
    if (latest.kind === "in" || latest.kind === "break_start") return latest;
    return undefined;
  }
  async getFieldPunchByClientId(accountId: number, clientId: string): Promise<FieldPunch | undefined> {
    await ensureReady();
    const rows = await db.select().from(fieldPunches).where(and(eq(fieldPunches.accountId, accountId), eq(fieldPunches.clientId, clientId))).limit(1);
    return rows[0];
  }
  // Field observations — quick-capture safety/quality/rfi/issue entries.
  async createFieldObservation(data: InsertFieldObservation): Promise<FieldObservation> {
    await ensureReady();
    const [row] = await db.insert(fieldObservations).values(data).returning();
    return row;
  }
  async getRecentFieldObservations(opts: { accountId?: number; organizationId?: number; projectId?: number; limit?: number }): Promise<FieldObservation[]> {
    await ensureReady();
    const limit = opts.limit ?? 25;
    const filters: any[] = [];
    if (opts.accountId != null) filters.push(eq(fieldObservations.accountId, opts.accountId));
    if (opts.organizationId != null) filters.push(eq(fieldObservations.organizationId, opts.organizationId));
    if (opts.projectId != null) filters.push(eq(fieldObservations.projectId, opts.projectId));
    const where = filters.length === 0 ? undefined : (filters.length === 1 ? filters[0] : and(...filters));
    let q = db.select().from(fieldObservations) as any;
    if (where) q = q.where(where);
    const rows = await q.orderBy(desc(fieldObservations.createdAt)).limit(limit);
    return rows;
  }
  async getFieldObservationByClientId(accountId: number, clientId: string): Promise<FieldObservation | undefined> {
    await ensureReady();
    const rows = await db.select().from(fieldObservations).where(and(eq(fieldObservations.accountId, accountId), eq(fieldObservations.clientId, clientId))).limit(1);
    return rows[0];
  }
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
  async getJarvisMemories(projectId?: number): Promise<JarvisMemory[]> {
    await ensureReady();
    if (projectId != null) {
      return await db.select().from(jarvisMemory).where(eq(jarvisMemory.projectId, projectId));
    }
    return await db.select().from(jarvisMemory);
  }

  async searchJarvisMemory(query: string, projectId?: number): Promise<JarvisMemory | undefined> {
    await ensureReady();
    const normalized = normalizeQuestion(query);
    const all = await db.select().from(jarvisMemory);
    // Filter to learned answers, prefer project-scoped then global
    const learned = all.filter((m) => m.status === "learned" && m.answer);
    if (!learned.length) return undefined;
    const scoped = projectId != null
      ? learned.filter((m) => m.projectId === projectId || m.projectId === null)
      : learned;
    // Score by token overlap
    let best: { memory: JarvisMemory; score: number } | null = null;
    for (const m of scoped) {
      const score = tokenSimilarity(normalized, m.normalizedQuestion);
      if (!best || score > best.score) best = { memory: m, score };
    }
    if (best && best.score > 0.2) {
      await this.incrementJarvisMemoryHit(best.memory.id);
      return best.memory;
    }
    return undefined;
  }

  async createJarvisMemory(data: InsertJarvisMemory): Promise<JarvisMemory> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.insert(jarvisMemory).values({
      ...data,
      normalizedQuestion: data.normalizedQuestion || normalizeQuestion(data.question),
      createdAt: now,
      updatedAt: now,
    }).returning();
    return row;
  }

  async updateJarvisMemory(id: number, data: Partial<InsertJarvisMemory>): Promise<JarvisMemory | undefined> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.update(jarvisMemory).set({
      ...data,
      updatedAt: now,
    }).where(eq(jarvisMemory.id, id)).returning();
    return row;
  }

  async incrementJarvisMemoryHit(id: number): Promise<void> {
    await ensureReady();
    const rows = await db.select().from(jarvisMemory).where(eq(jarvisMemory.id, id));
    if (rows[0]) {
      await db.update(jarvisMemory).set({
        hitCount: (rows[0].hitCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      }).where(eq(jarvisMemory.id, id));
    }
  }

  async deleteJarvisMemory(id: number): Promise<void> {
    await ensureReady();
    await db.delete(jarvisMemory).where(eq(jarvisMemory.id, id));
  }

  /* ----------------------------- Timesheets ---------------------------- */
  async getTimesheets(projectId?: number): Promise<Timesheet[]> {
    await ensureReady();
    if (projectId != null) {
      return await db.select().from(timesheets).where(eq(timesheets.projectId, projectId));
    }
    return await db.select().from(timesheets);
  }

  async getTimesheet(id: number): Promise<Timesheet | undefined> {
    await ensureReady();
    const rows = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return rows[0];
  }

  async createTimesheet(data: InsertTimesheet): Promise<Timesheet> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.insert(timesheets).values({ ...data, createdAt: now, updatedAt: now }).returning();
    return row;
  }

  async updateTimesheet(id: number, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined> {
    await ensureReady();
    const [row] = await db.update(timesheets).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(timesheets.id, id)).returning();
    return row;
  }

  async deleteTimesheet(id: number): Promise<void> {
    await ensureReady();
    await db.delete(timesheets).where(eq(timesheets.id, id));
  }

  /* --------------------------- Time entries ----------------------------- */
  async getTimeEntries(timesheetId: number): Promise<TimeEntry[]> {
    await ensureReady();
    return await db.select().from(timeEntries).where(eq(timeEntries.timesheetId, timesheetId));
  }

  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> {
    await ensureReady();
    const [row] = await db.insert(timeEntries).values({ ...data, createdAt: new Date().toISOString() }).returning();
    return row;
  }

  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
    await ensureReady();
    const [row] = await db.update(timeEntries).set(data).where(eq(timeEntries.id, id)).returning();
    return row;
  }

  async deleteTimeEntry(id: number): Promise<void> {
    await ensureReady();
    await db.delete(timeEntries).where(eq(timeEntries.id, id));
  }

  async replaceTimeEntries(timesheetId: number, entries: InsertTimeEntry[]): Promise<void> {
    await ensureReady();
    await db.delete(timeEntries).where(eq(timeEntries.timesheetId, timesheetId));
    if (entries.length > 0) {
      const now = new Date().toISOString();
      await db.insert(timeEntries).values(entries.map((e) => ({ ...e, timesheetId, createdAt: now })));
    }
  }

  /* ----------------------------- Seed ------------------------------ */
  async seed(): Promise<void> {
    if (seedDone) return;
    const existing = await db.select().from(teamMembers);
    if (existing.length > 0) { seedDone = true; return; }

    const team: Omit<TeamMember, "id" | "organizationId">[] = [
      { name: "Marcus Reyes", role: "Project Executive", trade: "Management", company: "Meridian Builders", initials: "MR", color: "amber", email: "m.reyes@meridian.co", phone: "(303) 555-0142", companyPhoto: "", accessLevel: "project_executive" },
      { name: "Dana Whitfield", role: "Superintendent", trade: "Self-perform", company: "Meridian Builders", initials: "DW", color: "blue", email: "d.whitfield@meridian.co", phone: "(303) 555-0188", companyPhoto: "", accessLevel: "superintendent" },
      { name: "Priya Anand", role: "Project Manager", trade: "Management", company: "Meridian Builders", initials: "PA", color: "emerald", email: "p.anand@meridian.co", phone: "(303) 555-0173", companyPhoto: "", accessLevel: "project_manager" },
      { name: "Tom Bradshaw", role: "Foreman", trade: "Concrete", company: "Apex Concrete", initials: "TB", color: "violet", email: "tom@apexconcrete.com", phone: "(720) 555-0119", companyPhoto: "", accessLevel: "foreman" },
      { name: "Lucia Romano", role: "Foreman", trade: "Electrical", company: "Voltline Electric", initials: "LR", color: "rose", email: "lucia@voltline.com", phone: "(720) 555-0156", companyPhoto: "", accessLevel: "foreman" },
      { name: "Kenji Park", role: "Foreman", trade: "HVAC", company: "Summit Mechanical", initials: "KP", color: "cyan", email: "kenji@summitmech.com", phone: "(720) 555-0134", companyPhoto: "", accessLevel: "foreman" },
      { name: "Sara Okafor", role: "Foreman", trade: "Framing", company: "Northside Carpentry", initials: "SO", color: "orange", email: "sara@northsidecarp.com", phone: "(720) 555-0177", companyPhoto: "", accessLevel: "foreman" },
      { name: "Ben Caldwell", role: "QC Manager", trade: "Quality", company: "Meridian Builders", initials: "BC", color: "slate", email: "b.caldwell@meridian.co", phone: "(303) 555-0162", companyPhoto: "", accessLevel: "superintendent" },
    ];
    const t: TeamMember[] = [];
    for (const x of team) {
      const [row] = await db.insert(teamMembers).values(x).returning();
      t.push(row);
    }

    const projectsSeed: Omit<Project, "id" | "organizationId">[] = [
      { name: "Lakeside Medical Pavilion", number: "MB-2401", client: "Lakeside Health System", type: "Healthcare", status: "On Track", address: "1820 Healing Way, Denver, CO", startDate: "2025-09-02", endDate: "2026-12-18", budget: 48500000, spent: 21300000, progress: 44, superintendentId: t[1].id },
      { name: "Union Tower Office", number: "MB-2402", client: "Union Realty Partners", type: "Commercial", status: "At Risk", address: "440 Market St, Denver, CO", startDate: "2025-11-10", endDate: "2027-03-22", budget: 32200000, spent: 18900000, progress: 58, superintendentId: t[1].id },
      { name: "Riverside K-8 School", number: "MB-2403", client: "Denver Public Schools", type: "Education", status: "On Track", address: "705 River Bend Dr, Denver, CO", startDate: "2026-01-15", endDate: "2026-11-30", budget: 19800000, spent: 4100000, progress: 21, superintendentId: t[1].id },
      { name: "Highland Lofts", number: "MB-2404", client: "Highland Living LLC", type: "Residential", status: "Planning", address: "3200 Lowell Blvd, Denver, CO", startDate: "2026-08-01", endDate: "2027-09-14", budget: 12400000, spent: 320000, progress: 4, superintendentId: t[1].id },
    ];
    const p: Project[] = [];
    for (const x of projectsSeed) {
      const [row] = await db.insert(projects).values(x).returning();
      p.push(row);
    }

    const tasksSeed: Omit<Task, "id">[] = [
      { projectId: p[0].id, title: "Site work & utilities", trade: "Civil", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2025-11-15", startDate: "2025-09-02", endDate: "2025-11-15", seq: 1, dependsOn: null },
      { projectId: p[0].id, title: "Foundations & slab", trade: "Concrete", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2026-01-20", startDate: "2025-11-20", endDate: "2026-01-30", seq: 2, dependsOn: "1" },
      { projectId: p[0].id, title: "Structural steel — L1-L3", trade: "Steel", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-04-15", startDate: "2026-02-02", endDate: "2026-04-30", seq: 3, dependsOn: "2" },
      { projectId: p[0].id, title: "Level 3 deck pour", trade: "Concrete", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-07-24", startDate: "2026-07-10", endDate: "2026-07-28", seq: 4, dependsOn: "3" },
      { projectId: p[0].id, title: "Electrical rough-in — ICU", trade: "Electrical", status: "Not Started", priority: "Medium", assigneeId: t[4].id, dueDate: "2026-08-02", startDate: "2026-07-25", endDate: "2026-08-20", seq: 5, dependsOn: "4" },
      { projectId: p[0].id, title: "HVAC duct install — L2", trade: "HVAC", status: "In Progress", priority: "Medium", assigneeId: t[5].id, dueDate: "2026-07-28", startDate: "2026-07-05", endDate: "2026-08-10", seq: 6, dependsOn: "3" },
      { projectId: p[0].id, title: "Curtainwall glazing", trade: "Glazing", status: "Blocked", priority: "High", assigneeId: null, dueDate: "2026-07-22", startDate: "2026-07-15", endDate: "2026-08-15", seq: 7, dependsOn: "3" },
      { projectId: p[0].id, title: "Framing — rooms 204-218", trade: "Framing", status: "In Progress", priority: "Low", assigneeId: t[6].id, dueDate: "2026-07-30", startDate: "2026-07-12", endDate: "2026-08-05", seq: 8, dependsOn: "4" },
    ];
    for (const x of tasksSeed) await db.insert(tasks).values(x);

    const rfisSeed: Omit<Rfi, "id">[] = [
      { projectId: p[0].id, number: "RFI-014", subject: "Clearance at med-gas panels — ICU", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-12", dueDate: "2026-07-23" },
      { projectId: p[0].id, number: "RFI-015", subject: "Curtainwall anchor detail revision", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-15", dueDate: "2026-07-21" },
      { projectId: p[0].id, number: "RFI-012", subject: "Slab opening for mechanical chase", status: "Answered", assigneeId: t[2].id, dateCreated: "2026-06-28", dueDate: "2026-07-10" },
      { projectId: p[1].id, number: "RFI-031", subject: "Cooling tower load path clarification", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-16", dueDate: "2026-07-22" },
      { projectId: p[1].id, number: "RFI-029", subject: "Fire-rated assembly at stair 2", status: "Draft", assigneeId: t[2].id, dateCreated: "2026-07-18", dueDate: "2026-07-25" },
      { projectId: p[2].id, number: "RFI-006", subject: "Storm detention vault location", status: "Open", assigneeId: t[2].id, dateCreated: "2026-07-14", dueDate: "2026-07-24" },
    ];
    for (const x of rfisSeed) await db.insert(rfis).values(x);

    const subsSeed: Omit<Submittal, "id">[] = [
      { projectId: p[0].id, number: "SUB-042", subject: "Curtainwall shop drawings", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-05-10", dueDate: "2026-05-24" },
      { projectId: p[0].id, number: "SUB-051", subject: "Med-gas piping — material certs", type: "Material", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-08", dueDate: "2026-07-22" },
      { projectId: p[0].id, number: "SUB-049", subject: "Structural steel connections", type: "Shop Drawing", status: "Revise", assigneeId: t[2].id, dateSubmitted: "2026-06-20", dueDate: "2026-07-05" },
      { projectId: p[1].id, number: "SUB-077", subject: "Cooling tower performance data", type: "Data", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-12", dueDate: "2026-07-26" },
      { projectId: p[2].id, number: "SUB-012", subject: "Storm detention vault precast", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-06-15", dueDate: "2026-06-29" },
    ];
    for (const x of subsSeed) await db.insert(submittals).values(x);

    const coSeed: Omit<ChangeOrder, "id">[] = [
      { projectId: p[0].id, number: "CO-008", title: "Add 4th-floor terrace upgrade", status: "Approved", amount: 184000, scheduleImpact: 5, dateIssued: "2026-06-12" },
      { projectId: p[0].id, number: "CO-011", title: "Med-gas manifold expansion", status: "Pending", amount: 96000, scheduleImpact: 3, dateIssued: "2026-07-09" },
      { projectId: p[0].id, number: "CO-012", title: "Curtainwall IGU upgrade", status: "Pending", amount: 142000, scheduleImpact: 0, dateIssued: "2026-07-15" },
      { projectId: p[1].id, number: "CO-021", title: "Cooling tower re-spec", status: "Pending", amount: 210000, scheduleImpact: 7, dateIssued: "2026-07-17" },
      { projectId: p[1].id, number: "CO-019", title: "Lobby finish upgrade", status: "Approved", amount: 78000, scheduleImpact: 0, dateIssued: "2026-06-28" },
    ];
    for (const x of coSeed) await db.insert(changeOrders).values(x);

    const aiSeed: Omit<ActionItem, "id">[] = [
      { projectId: p[0].id, title: "Confirm med-gas inspector availability", owner: "Priya Anand", status: "Open", priority: "High", dueDate: "2026-07-24", source: "OAC Meeting" },
      { projectId: p[0].id, title: "Send updated framing plan to Northside", owner: "Dana Whitfield", status: "Open", priority: "Medium", dueDate: "2026-07-23", source: "OAC Meeting" },
      { projectId: p[0].id, title: "Owner signage approval", owner: "Marcus Reyes", status: "Open", priority: "Low", dueDate: "2026-07-30", source: "Owner Call" },
      { projectId: p[1].id, title: "Schedule rigging engineer site visit", owner: "Dana Whitfield", status: "Open", priority: "Critical", dueDate: "2026-07-25", source: "Safety Stand-down" },
      { projectId: p[2].id, title: "Coordinate utility tie-in with city", owner: "Priya Anand", status: "In Progress", priority: "High", dueDate: "2026-07-28", source: "Precon Meeting" },
    ];
    for (const x of aiSeed) await db.insert(actionItems).values(x);

    const logsSeed: Omit<DailyLog, "id">[] = [
      { projectId: p[0].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 64, summary: "Level 3 deck formwork 80% set; electrical rough-in ongoing on Level 2; 3 concrete trucks delivered.", photos: null },
      { projectId: p[0].id, date: "2026-07-20", authorId: t[1].id, weather: "Sunny", temp: 91, crewCount: 58, summary: "Curtainwall framing on south elevation; HVAC duct install began on Level 2.", photos: null },
      { projectId: p[1].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 41, summary: "Drywall finishing Floor 9; crane lift delayed pending engineer sign-off on rigging plan.", photos: null },
      { projectId: p[2].id, date: "2026-07-21", authorId: t[1].id, weather: "Sunny", temp: 90, crewCount: 22, summary: "Site grading continued on east lot; storm line install 60% complete.", photos: null },
    ];
    for (const l of logsSeed) await db.insert(dailyLogs).values(l);

    const punchSeed: Omit<PunchItem, "id">[] = [
      { projectId: p[0].id, title: "Touch up drywall at Room 112 corner", location: "Level 1, Rm 112", trade: "Drywall", status: "Open", assigneeId: t[6].id },
      { projectId: p[0].id, title: "Missing outlet cover plates — east corridor", location: "Level 1, Corridor E", trade: "Electrical", status: "Open", assigneeId: t[4].id },
      { projectId: p[0].id, title: "Caulk joint at storefront door", location: "Main lobby", trade: "Glazing", status: "In Progress", assigneeId: null },
      { projectId: p[1].id, title: "Paint touch-up stair 4 landings", location: "Stair 4", trade: "Painting", status: "Open", assigneeId: null },
      { projectId: p[1].id, title: "Replace scratched door — Fl. 7 unit 712", location: "Fl. 7, Unit 712", trade: "Doors", status: "Open", assigneeId: t[6].id },
      { projectId: p[2].id, title: "Re-grade swale at southeast corner", location: "Southeast lot", trade: "Civil", status: "In Progress", assigneeId: t[3].id },
    ];
    for (const x of punchSeed) await db.insert(punchItems).values(x);

    const contactsSeed: Omit<Contact, "id" | "organizationId">[] = [
      { name: "Dr. Helen Voss", company: "Lakeside Health System", role: "Owner Rep", trade: "Owner", type: "Owner", phone: "(303) 555-0142", email: "h.voss@lakesidehealth.org" },
      { name: "Raymond Soto", company: "Northwind Architects", role: "Lead Architect", trade: "Design", type: "Architect", phone: "(303) 555-0188", email: "rsoto@northwindarch.com" },
      { name: "Gloria Mendez", company: "Apex Concrete", trade: "Concrete", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0110", email: "gmendez@apexconcrete.com" },
      { name: "James Holloway", company: "Voltline Electric", trade: "Electrical", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0155", email: "jh@voltline.com" },
      { name: "Nadia Bauer", company: "Summit Mechanical", trade: "HVAC", role: "Subcontractor PM", type: "Subcontractor", phone: "(303) 555-0190", email: "nadia@summitmech.com" },
      { name: "Owen Castillo", company: "City of Denver", role: "Building Inspector", trade: "Permitting", type: "Authority", phone: "(720) 555-0177", email: "ocastillo@denvergov.org" },
      { name: "Union Realty Partners", company: "Union Realty Partners", role: "Owner", trade: "Owner", type: "Owner", phone: "(303) 555-0201", email: "pm@unionrealty.com" },
    ];
    for (const x of contactsSeed) await db.insert(contacts).values(x);

    const eqSeed: Omit<Equipment, "id" | "organizationId">[] = [
      { name: "Link-Belt 80T Crane #1", type: "Crane", status: "On Site", projectId: p[0].id, operator: "T. Bradshaw", location: "North pad" },
      { name: "CAT 336 Excavator", type: "Excavator", status: "On Site", projectId: p[0].id, operator: "Rental", location: "East excavation" },
      { name: "Bobcat S650 Skid Steer", type: "Skid Steer", status: "On Site", projectId: p[2].id, operator: "Crew B", location: "East lot" },
      { name: "Genie S-105 Boom Lift", type: "Lift", status: "In Maintenance", projectId: p[0].id, operator: "—", location: "Yard" },
      { name: "Tower Crane TC-60", type: "Crane", status: "On Site", projectId: p[1].id, operator: "Crane Co.", location: "Core" },
      { name: "Concrete Pump 52m", type: "Pump", status: "Off Site", projectId: null, operator: "Rental", location: "Return 7/24" },
    ];
    for (const x of eqSeed) await db.insert(equipment).values(x);

    // Copy bundled seed photos into the runtime photo dir.
    const PHOTO_DIR = process.env.VERCEL
      ? "/tmp/uploads/photos"
      : resolve(process.cwd(), "uploads/photos");
    try { mkdirSync(PHOTO_DIR, { recursive: true }); } catch {}
    const seedPhotoCandidates = [
      resolve(process.cwd(), "server/seed-photos"),
      resolve(process.cwd(), "seed-photos"),
      resolve(__dirname, "seed-photos"),
      resolve(__dirname, "../server/seed-photos"),
    ];
    let seedPhotoDir: string | null = null;
    for (const c of seedPhotoCandidates) {
      if (existsSync(c)) { seedPhotoDir = c; break; }
    }
    const copySeedPhoto = (name: string): { storedFileName: string; mimeType: string; fileSizeBytes: number } | null => {
      if (!seedPhotoDir) return null;
      const src = join(seedPhotoDir, name);
      if (!existsSync(src)) return null;
      const dst = join(PHOTO_DIR, name);
      try { if (!existsSync(dst)) copyFileSync(src, dst); } catch {}
      let size = 0;
      try {
        const fs2 = require("node:fs") as typeof import("node:fs");
        size = fs2.statSync(dst).size;
      } catch {}
      return { storedFileName: name, mimeType: "image/jpeg", fileSizeBytes: size };
    };
    const photoFileMap: Record<string, string> = {
      "Level 3 deck formwork — looking north": "photo-deck-formwork.jpg",
      "Curtainwall frame at south elevation":  "photo-curtainwall.jpg",
      "Electrical rough-in — ICU wing":        "photo-electrical.jpg",
      "Drywall finish — Floor 9":              "photo-drywall.jpg",
      "Storm line trench — east lot":          "photo-stormline.jpg",
    };

    const photoSeed: Omit<Photo, "id">[] = [
      { projectId: p[0].id, caption: "Level 3 deck formwork — looking north", location: "L3, grid F", takenById: t[1].id, date: "2026-07-21", hue: 210, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
      { projectId: p[0].id, caption: "Curtainwall frame at south elevation", location: "South facade", takenById: t[1].id, date: "2026-07-20", hue: 28, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
      { projectId: p[0].id, caption: "Electrical rough-in — ICU wing", location: "L2, ICU", takenById: t[4].id, date: "2026-07-19", hue: 260, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
      { projectId: p[1].id, caption: "Drywall finish — Floor 9", location: "Fl. 9", takenById: t[6].id, date: "2026-07-21", hue: 140, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
      { projectId: p[2].id, caption: "Storm line trench — east lot", location: "East lot", takenById: t[3].id, date: "2026-07-21", hue: 190, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
    ];
    for (const rec of photoSeed) {
      const fname = photoFileMap[rec.caption];
      if (!fname) continue;
      const meta = copySeedPhoto(fname);
      if (meta) {
        rec.storedFileName = meta.storedFileName;
        rec.originalFileName = fname;
        rec.mimeType = meta.mimeType;
        rec.fileSizeBytes = meta.fileSizeBytes;
      }
    }
    for (const x of photoSeed) await db.insert(photos).values(x);

    const docSeed: Omit<DocumentRow, "id" | "storedFileName" | "originalFileName" | "mimeType" | "fileSizeBytes">[] = [
      { projectId: p[0].id, name: "A-101 Floor Plans — Rev C.pdf", type: "Drawing", size: "8.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
      { projectId: p[0].id, name: "Structural Notes — S-001.pdf", type: "Drawing", size: "3.1 MB", uploadedById: t[2].id, date: "2026-07-01" },
      { projectId: p[0].id, name: "Owner-Architect Agreement.pdf", type: "Contract", size: "1.2 MB", uploadedById: t[0].id, date: "2025-08-20" },
      { projectId: p[0].id, name: "Building Permit — BLD-2026-0441.pdf", type: "Permit", size: "0.6 MB", uploadedById: t[2].id, date: "2025-08-28" },
      { projectId: p[1].id, name: "Cooling Tower Submittal Log.xlsx", type: "Spec", size: "0.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
      { projectId: p[2].id, name: "Site Civil — Demolition Plan.pdf", type: "Drawing", size: "5.7 MB", uploadedById: t[2].id, date: "2026-06-30" },
    ];
    for (const x of docSeed) await db.insert(documents).values(x);

    const bpSeed: Omit<Blueprint, "id">[] = [
      { projectId: p[0].id, sheetNumber: "A-101", title: "Floor Plans — Level 1", discipline: "Architectural", revision: "Rev C", status: "Current", uploadedById: t[2].id, date: "2026-07-12", hue: 210 },
      { projectId: p[0].id, sheetNumber: "A-201", title: "Reflected Ceiling Plans", discipline: "Architectural", revision: "Rev B", status: "Current", uploadedById: t[2].id, date: "2026-07-10", hue: 200 },
      { projectId: p[0].id, sheetNumber: "S-100", title: "Structural Foundation Plan", discipline: "Structural", revision: "Rev C", status: "Current", uploadedById: t[2].id, date: "2026-06-28", hue: 28 },
      { projectId: p[0].id, sheetNumber: "S-301", title: "Level 3 Framing Plan", discipline: "Structural", revision: "Rev A", status: "Under Review", uploadedById: t[2].id, date: "2026-07-15", hue: 18 },
      { projectId: p[0].id, sheetNumber: "M-101", title: "Mechanical — Air Distribution", discipline: "Mechanical", revision: "Rev B", status: "Current", uploadedById: t[4].id, date: "2026-07-05", hue: 190 },
      { projectId: p[0].id, sheetNumber: "E-201", title: "Power & Lighting — L2", discipline: "Electrical", revision: "Rev A", status: "Superseded", uploadedById: t[4].id, date: "2026-06-20", hue: 260 },
      { projectId: p[0].id, sheetNumber: "C-100", title: "Site Demolition Plan", discipline: "Civil", revision: "Rev B", status: "Current", uploadedById: t[3].id, date: "2026-06-30", hue: 140 },
      { projectId: p[1].id, sheetNumber: "A-301", title: "Interior Elevations — Fl. 9", discipline: "Architectural", revision: "Rev C", status: "Current", uploadedById: t[6].id, date: "2026-07-18", hue: 330 },
    ];
    for (const x of bpSeed) await db.insert(blueprints).values(x);

    const droneSeed: Omit<DroneCapture, "id" | "storedFileName" | "originalFileName" | "mimeType" | "fileSizeBytes">[] = [
      { projectId: p[0].id, title: "Site orthomosaic — full parcel", captureType: "Orthomosaic", pilot: "AeroVision UAV", flightDate: "2026-07-21", altitude: "200 ft", area: "14.6 acres", status: "Processed", hue: 190 },
      { projectId: p[0].id, title: "Progress — south elevation curtainwall", captureType: "Progress Photo", pilot: "AeroVision UAV", flightDate: "2026-07-21", altitude: "120 ft", area: "0.8 acres", status: "Processed", hue: 28 },
      { projectId: p[0].id, title: "Stockpile volume survey — north yard", captureType: "Topo Survey", pilot: "In-house (T. Bradshaw)", flightDate: "2026-07-19", altitude: "150 ft", area: "2.1 acres", status: "Processed", hue: 140 },
      { projectId: p[0].id, title: "Thermal scan — roof membrane", captureType: "Thermal", pilot: "AeroVision UAV", flightDate: "2026-07-18", altitude: "100 ft", area: "0.9 acres", status: "In Review", hue: 8 },
      { projectId: p[0].id, title: "3D mesh — core + L1–L3", captureType: "3D Model", pilot: "AeroVision UAV", flightDate: "2026-07-17", altitude: "180 ft", area: "3.4 acres", status: "Processed", hue: 260 },
      { projectId: p[0].id, title: "Weekly progress orbit — scheduled", captureType: "Progress Photo", pilot: "AeroVision UAV", flightDate: "2026-07-28", altitude: "150 ft", area: "14.6 acres", status: "Scheduled", hue: 210 },
      { projectId: p[1].id, title: "Roof progress — Fl. 9 topping", captureType: "Progress Photo", pilot: "In-house (M. Diaz)", flightDate: "2026-07-20", altitude: "120 ft", area: "0.5 acres", status: "Processed", hue: 330 },
      { projectId: p[2].id, title: "Civil topo — east lot grading", captureType: "Topo Survey", pilot: "AeroVision UAV", flightDate: "2026-07-16", altitude: "200 ft", area: "6.2 acres", status: "Processed", hue: 90 },
    ];
    for (const x of droneSeed) await db.insert(droneCaptures).values(x);

    const msgSeed: Omit<Message, "id">[] = [
      { projectId: p[0].id, authorId: t[1].id, body: "Deck pour for Level 3 is on for Friday — need 3 trucks at 7am. Confirm barricades are reset by Thursday EOD.", createdAt: "2026-07-21T08:12:00" },
      { projectId: p[0].id, authorId: t[4].id, body: "Understood. Voltline will be clear of the pour area by 6pm Thursday. Med-gas rough-in on L2 is separate and unaffected.", createdAt: "2026-07-21T08:24:00" },
      { projectId: p[0].id, authorId: t[2].id, body: "Owner asked for updated progress photos of the curtainwall — I'll pull from the photo log and send the deck by 3pm.", createdAt: "2026-07-21T09:02:00" },
      { projectId: p[0].id, authorId: t[0].id, body: "Good. Let's also flag the glazing RFI status in tomorrow's OAC. It's the one holding the south elevation.", createdAt: "2026-07-21T09:15:00" },
    ];
    for (const x of msgSeed) await db.insert(messages).values(x);

    const noteSeed: Omit<Note, "id">[] = [
      { projectId: p[0].id, body: "Concrete pour Friday 7am — 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40 },
      { projectId: p[0].id, body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90 },
      { projectId: p[0].id, body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50 },
      { projectId: p[0].id, body: "Inspector confirmed for med-gas — keep L2 ICU clear.", color: "emerald", x: 120, y: 220 },
    ];
    for (const x of noteSeed) await db.insert(notes).values(x);

    const milestoneSeed: Omit<Milestone, "id">[] = [
      { projectId: p[0].id, title: "Building permit issued", date: "2025-08-20", kind: "Permit", status: "Complete", notes: "City of Denver — approved on first submission" },
      { projectId: p[0].id, title: "Foundation complete", date: "2026-02-05", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[0].id, title: "Structural topout — L3", date: "2026-05-08", kind: "Structure", status: "Complete", notes: null },
      { projectId: p[0].id, title: "Curtainwall dry-in", date: "2026-08-20", kind: "Envelope", status: "At Risk", notes: "RFI-015 blocking south elevation glazing" },
      { projectId: p[0].id, title: "MEP rough-in complete", date: "2026-10-15", kind: "MEP", status: "Upcoming", notes: null },
      { projectId: p[0].id, title: "TCO — Temporary Cert. of Occupancy", date: "2026-11-30", kind: "TCO", status: "Upcoming", notes: null },
      { projectId: p[0].id, title: "Substantial completion", date: "2026-12-18", kind: "Closeout", status: "Upcoming", notes: null },

      { projectId: p[1].id, title: "Building permit issued", date: "2026-01-14", kind: "Permit", status: "Complete", notes: null },
      { projectId: p[1].id, title: "Excavation & shoring complete", date: "2026-04-22", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[1].id, title: "Cooling tower delivery", date: "2026-08-12", kind: "Delivery", status: "At Risk", notes: "Re-spec via CO-021 pending" },
      { projectId: p[1].id, title: "Structural topout", date: "2026-11-05", kind: "Structure", status: "Upcoming", notes: null },
      { projectId: p[1].id, title: "Enclosure complete", date: "2027-03-30", kind: "Envelope", status: "Upcoming", notes: null },
      { projectId: p[1].id, title: "Final acceptance", date: "2027-08-24", kind: "Closeout", status: "Upcoming", notes: null },

      { projectId: p[2].id, title: "Building permit issued", date: "2026-01-08", kind: "Permit", status: "Complete", notes: null },
      { projectId: p[2].id, title: "Foundation complete", date: "2026-04-30", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[2].id, title: "Structural topout", date: "2026-07-20", kind: "Structure", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "Envelope dry-in", date: "2026-09-04", kind: "Envelope", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "MEP rough-in complete", date: "2026-09-30", kind: "MEP", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "Substantial completion — ready for school year", date: "2026-11-30", kind: "Closeout", status: "Upcoming", notes: "Must be turned over before Aug 2027 school year" },
    ];
    for (const x of milestoneSeed) await db.insert(milestones).values(x);

    // Seed a demo account so users can log in immediately.
    try {
      const existingAcc = await db.select().from(accounts);
      if (existingAcc.length === 0) {
        await this.createAccount(
          "demo@trusspath.app",
          "trusspath",
          "Marcus Reyes",
          "Meridian Builders",
          "owner",
        );
      }
    } catch {}

    seedDone = true;
  }
}

let seedDone = false;
export const storage: DatabaseStorage = new DatabaseStorage();

/* ----------------------- Jarvis memory helpers ------------------------ */

// Normalize a question for matching: lowercase, strip punctuation,
// remove filler words, collapse whitespace.
export function normalizeQuestion(q: string): string {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "what", "whats", "what's",
    "where", "wheres", "where's", "how", "do", "does", "can", "could", "would",
    "should", "i", "you", "me", "we", "they", "it", "to", "of", "in", "on",
    "at", "for", "and", "or", "but", "so", "if", "then", "tell", "about",
    "give", "some", "good", "best", "near", "by", "my", "our", "this", "that",
    "there", "here", "with", "from", "as", "be", "been", "have", "has",
  ]);
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w))
    .join(" ")
    .trim();
}

// Simple token overlap similarity (Jaccard). Returns 0-1.
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  ta.forEach((t) => { if (tb.has(t)) overlap++; });
  return overlap / Math.max(ta.size, tb.size);
}

// Infer a topic from a question for categorization.
export function inferTopic(q: string): string | null {
  const lower = q.toLowerCase();
  if (/lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee/.test(lower)) return "lunch";
  if (/weather|rain|snow|wind|storm|temperature|forecast/.test(lower)) return "weather";
  if (/safety|osha|safe|ppe|harness|fall|trench|excavat/.test(lower)) return "safety";
  if (/supplier|vendor|material|deliver/.test(lower)) return "suppliers";
  if (/subcontractor|sub|trade|electrician|plumber|hvac/.test(lower)) return "subcontractors";
  if (/hotel|motel|lodging|stay|accommodation/.test(lower)) return "lodging";
  if (/hardware|store|supply|home depot|lowes/.test(lower)) return "hardware";
  if (/dump|disposal|landfill|recycle/.test(lower)) return "disposal";
  if (/permit|inspection|city|county|jurisdiction/.test(lower)) return "permits";
  return null;
}
