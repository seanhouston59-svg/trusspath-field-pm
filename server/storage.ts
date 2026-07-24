import {
  projects, tasks, rfis, submittals, changeOrders, actionItems,
  dailyLogs, punchItems, teamMembers, contacts, equipment, photos,
  documents, blueprints, droneCaptures, messages, notes,
  integrations,
  subscribers, demoRequests,
  appSettings,
  milestones,
  accounts, sessions,
  DEFAULT_SETTINGS,
} from '@shared/schema';
import type {
  Project, Task, Rfi, Submittal, ChangeOrder, ActionItem,
  DailyLog, PunchItem, TeamMember, Contact, Equipment, Photo,
  DocumentRow, Blueprint, DroneCapture, Message, Note,
  Integration,
  InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder,
  InsertActionItem, InsertDailyLog, InsertPunchItem, InsertContact, InsertEquipment,
  InsertPhoto, InsertDocument, InsertBlueprint, InsertDroneCapture, InsertMessage, InsertNote, InsertTeamMember,
  InsertIntegration,
  Milestone, InsertMilestone,
  Account, AccountPublic, Session,
  Subscriber, DemoRequest, InsertSubscriber, InsertDemoRequest,
} from '@shared/schema';
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gt } from "drizzle-orm";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// On Vercel (or any read-only FS) the bundled data.db is next to the function code.
// Copy it into /tmp on cold start so writes work (ephemeral per instance).
function resolveDbPath(): string {
  if (process.env.VERCEL) {
    const tmp = "/tmp/data.db";
    if (!existsSync(tmp)) {
      const candidates = [resolve(process.cwd(), "data.db"), resolve(__dirname, "..", "data.db"), resolve(__dirname, "data.db")];
      for (const c of candidates) {
        if (existsSync(c)) { copyFileSync(c, tmp); break; }
      }
    }
    return tmp;
  }
  return "data.db";
}

const sqlite = new Database(resolveDbPath());
sqlite.pragma(process.env.VERCEL ? "journal_mode = MEMORY" : "journal_mode = WAL");
export const db = drizzle(sqlite);

function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, role TEXT NOT NULL, trade TEXT NOT NULL,
      company TEXT NOT NULL, initials TEXT NOT NULL, color TEXT NOT NULL,
      email TEXT, phone TEXT, company_photo TEXT,
      access_level TEXT NOT NULL DEFAULT 'project_manager'
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, number TEXT NOT NULL, client TEXT NOT NULL,
      type TEXT NOT NULL, status TEXT NOT NULL, address TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      budget REAL NOT NULL, spent REAL NOT NULL, progress INTEGER NOT NULL,
      superintendent_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, title TEXT NOT NULL, trade TEXT NOT NULL,
      status TEXT NOT NULL, priority TEXT NOT NULL, assignee_id INTEGER,
      due_date TEXT NOT NULL, start_date TEXT, end_date TEXT, seq INTEGER
    );
    CREATE TABLE IF NOT EXISTS rfis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, number TEXT NOT NULL, subject TEXT NOT NULL,
      status TEXT NOT NULL, assignee_id INTEGER,
      date_created TEXT NOT NULL, due_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submittals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, number TEXT NOT NULL, subject TEXT NOT NULL,
      type TEXT NOT NULL, status TEXT NOT NULL, assignee_id INTEGER,
      date_submitted TEXT NOT NULL, due_date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS change_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, number TEXT NOT NULL, title TEXT NOT NULL,
      status TEXT NOT NULL, amount REAL NOT NULL, schedule_impact INTEGER NOT NULL,
      date_issued TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, title TEXT NOT NULL, owner TEXT NOT NULL,
      status TEXT NOT NULL, priority TEXT NOT NULL, due_date TEXT NOT NULL,
      source TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, date TEXT NOT NULL, author_id INTEGER,
      weather TEXT NOT NULL, temp INTEGER NOT NULL, crew_count INTEGER NOT NULL,
      summary TEXT NOT NULL, photos TEXT
    );
    CREATE TABLE IF NOT EXISTS punch_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, title TEXT NOT NULL, location TEXT NOT NULL,
      trade TEXT NOT NULL, status TEXT NOT NULL, assignee_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL,
      trade TEXT NOT NULL, type TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL,
      project_id INTEGER, operator TEXT, location TEXT
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, caption TEXT NOT NULL, location TEXT NOT NULL,
      taken_by_id INTEGER, date TEXT NOT NULL, hue INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL,
      size TEXT NOT NULL, uploaded_by_id INTEGER, date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blueprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, sheet_number TEXT NOT NULL, title TEXT NOT NULL,
      discipline TEXT NOT NULL, revision TEXT NOT NULL, status TEXT NOT NULL,
      uploaded_by_id INTEGER, date TEXT NOT NULL, hue INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drone_captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, title TEXT NOT NULL, capture_type TEXT NOT NULL,
      pilot TEXT, flight_date TEXT NOT NULL, altitude TEXT, area TEXT,
      status TEXT NOT NULL, hue INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL, author_id INTEGER,
      body TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER, body TEXT NOT NULL, color TEXT NOT NULL,
      x INTEGER NOT NULL, y INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      connected INTEGER NOT NULL DEFAULT 0,
      connected_at TEXT,
      config TEXT
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      plan TEXT NOT NULL,
      billing TEXT NOT NULL,
      company TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS demo_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT,
      team_size TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY,
      config TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      company TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      account_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);

  // Additive migration: add depends_on to tasks if missing (SQLite ALTER TABLE)
  try {
    const cols = sqlite.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "depends_on")) {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT");
    }
  } catch {}
  // backfill columns added after initial schema (idempotent)
  for (const col of ["ADD COLUMN photos TEXT"]) {
    try { sqlite.exec(`ALTER TABLE daily_logs ${col};`); } catch {}
  }
  for (const col of ["email", "phone", "company_photo"]) {
    try { sqlite.exec(`ALTER TABLE team_members ADD COLUMN ${col} TEXT;`); } catch {}
  }
  try { sqlite.exec(`ALTER TABLE team_members ADD COLUMN access_level TEXT NOT NULL DEFAULT 'project_manager';`); } catch {}
  // one-time heal: existing seed rows picked up the default 'project_manager' when the column
  // was added; map them to the right level by job title. Only touches rows still at the default
  // (explicit user-set levels like foreman/superintendent/executive are left alone).
  try {
    sqlite.exec(`UPDATE team_members SET access_level = CASE
      WHEN role LIKE '%Executive%' THEN 'project_executive'
      WHEN role LIKE '%Superintendent%' THEN 'superintendent'
      WHEN role LIKE '%Foreman%' THEN 'foreman'
      WHEN role LIKE '%QC%' OR role LIKE '%Quality%' THEN 'superintendent'
      WHEN role LIKE '%Manager%' THEN 'project_manager'
      ELSE access_level END
      WHERE access_level = 'project_manager';`);
  } catch {}
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try { sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`); } catch {}
  }
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try { sqlite.exec(`ALTER TABLE photos ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`); } catch {}
  }
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try { sqlite.exec(`ALTER TABLE drone_captures ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`); } catch {}
  }
  // populate email/phone for rows seeded before these columns existed (idempotent)
  try {
    sqlite.exec(`UPDATE team_members SET
      email = CASE WHEN email IS NULL OR email = '' THEN lower(replace(name,' ','.')) || '@' || lower(replace(replace(company,' ',''),'.','')) || '.com' ELSE email END,
      phone = CASE WHEN phone IS NULL OR phone = '' THEN '(303) 555-' || substr('0000' || ((id * 137) % 9000 + 1000), -4) ELSE phone END;`);
  } catch {}
}

migrate();

export interface IStorage {
  getTeam(): TeamMember[];
  getTeamMember(id: number): TeamMember | undefined;
  createTeamMember(data: InsertTeamMember): TeamMember;
  updateTeamMember(id: number, data: Partial<InsertTeamMember>): TeamMember | undefined;
  deleteTeamMember(id: number): void;
  getProjects(): Project[];
  getProject(id: number): Project | undefined;
  createProject(data: InsertProject): Project;
  getTasks(projectId?: number): Task[];
  createTask(data: InsertTask): Task;
  updateTaskStatus(id: number, status: string): Task | undefined;
  getRfis(projectId?: number): Rfi[];
  createRfi(data: InsertRfi): Rfi;
  getSubmittals(projectId?: number): Submittal[];
  createSubmittal(data: InsertSubmittal): Submittal;
  getChangeOrders(projectId?: number): ChangeOrder[];
  createChangeOrder(data: InsertChangeOrder): ChangeOrder;
  createActionItem(data: InsertActionItem): ActionItem;
  getActionItems(projectId?: number): ActionItem[];
  updateActionItemStatus(id: number, status: string): ActionItem | undefined;
  getDailyLogs(projectId?: number): DailyLog[];
  createDailyLog(data: InsertDailyLog): DailyLog;
  updateDailyLog(id: number, data: Partial<InsertDailyLog>): DailyLog | undefined;
  deleteDailyLog(id: number): void;
  getPunchItems(projectId?: number): PunchItem[];
  createPunchItem(data: InsertPunchItem): PunchItem;
  updatePunchStatus(id: number, status: string): PunchItem | undefined;
  getContacts(): Contact[];
  createContact(data: InsertContact): Contact;
  updateContact(id: number, data: Partial<InsertContact>): Contact | undefined;
  deleteContact(id: number): void;
  getEquipment(projectId?: number): Equipment[];
  createEquipment(data: InsertEquipment): Equipment;
  getPhotos(projectId?: number): Photo[];
  getPhoto(id: number): Photo | undefined;
  createPhoto(data: InsertPhoto): Photo;
  deletePhoto(id: number): void;
  getDocuments(projectId?: number): DocumentRow[];
  getDocument(id: number): DocumentRow | undefined;
  createDocument(data: InsertDocument): DocumentRow;
  deleteDocument(id: number): void;
  getBlueprints(projectId?: number): Blueprint[];
  createBlueprint(data: InsertBlueprint): Blueprint;
  getDroneCaptures(projectId?: number): DroneCapture[];
  getDroneCapture(id: number): DroneCapture | undefined;
  createDroneCapture(data: InsertDroneCapture): DroneCapture;
  deleteDroneCapture(id: number): void;
  getMilestones(projectId?: number): Milestone[];
  getMilestone(id: number): Milestone | undefined;
  createMilestone(data: InsertMilestone): Milestone;
  updateMilestone(id: number, data: Partial<InsertMilestone>): Milestone | undefined;
  deleteMilestone(id: number): void;
  getMessages(projectId: number): Message[];
  createMessage(data: InsertMessage): Message;
  getNotes(projectId?: number): Note[];
  createNote(data: InsertNote): Note;
  updateNotePosition(id: number, x: number, y: number): Note | undefined;
  deleteNote(id: number): void;
  getIntegrations(): Integration[];
  setIntegration(key: string, connected: boolean, config?: string): Integration;
  createSubscriber(data: InsertSubscriber): Subscriber;
  listSubscribers(): Subscriber[];
  createDemoRequest(data: InsertDemoRequest): DemoRequest;
  listDemoRequests(): DemoRequest[];
  getSettings(): Record<string, any>;
  updateSettings(patch: Record<string, any>): Record<string, any>;
  resetAllData(): void;
  // ----- Auth -----
  createAccount(email: string, password: string, displayName: string, company?: string, role?: string): AccountPublic;
  getAccountByEmail(email: string): Account | undefined;
  getAccount(id: number): AccountPublic | undefined;
  verifyPassword(email: string, password: string): AccountPublic | null;
  createSession(accountId: number): Session;
  getSession(token: string): { session: Session; account: AccountPublic } | null;
  destroySession(token: string): void;
  countAccounts(): number;
}

class DatabaseStorage implements IStorage {
  constructor() { this.seed(); }

  getTeam(): TeamMember[] { return db.select().from(teamMembers).all(); }
  getTeamMember(id: number): TeamMember | undefined {
    return db.select().from(teamMembers).where(eq(teamMembers.id, id)).get();
  }
  createTeamMember(data: InsertTeamMember): TeamMember {
    return db.insert(teamMembers).values(data).returning().get();
  }
  updateTeamMember(id: number, data: Partial<InsertTeamMember>): TeamMember | undefined {
    return db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning().get();
  }
  deleteTeamMember(id: number): void {
    db.delete(teamMembers).where(eq(teamMembers.id, id)).run();
  }

  getProjects(): Project[] { return db.select().from(projects).all(); }
  getProject(id: number): Project | undefined {
    return db.select().from(projects).where(eq(projects.id, id)).get();
  }
  createProject(data: InsertProject): Project {
    return db.insert(projects).values(data).returning().get();
  }

  getTasks(projectId?: number): Task[] {
    if (projectId !== undefined) return db.select().from(tasks).where(eq(tasks.projectId, projectId)).all();
    return db.select().from(tasks).all();
  }
  createTask(data: InsertTask): Task { return db.insert(tasks).values(data).returning().get(); }
  updateTaskStatus(id: number, status: string): Task | undefined {
    return db.update(tasks).set({ status }).where(eq(tasks.id, id)).returning().get();
  }

  getRfis(projectId?: number): Rfi[] {
    if (projectId !== undefined) return db.select().from(rfis).where(eq(rfis.projectId, projectId)).all();
    return db.select().from(rfis).all();
  }
  createRfi(data: InsertRfi): Rfi { return db.insert(rfis).values(data).returning().get(); }

  getSubmittals(projectId?: number): Submittal[] {
    if (projectId !== undefined) return db.select().from(submittals).where(eq(submittals.projectId, projectId)).all();
    return db.select().from(submittals).all();
  }
  createSubmittal(data: InsertSubmittal): Submittal {
    return db.insert(submittals).values(data).returning().get();
  }

  getChangeOrders(projectId?: number): ChangeOrder[] {
    if (projectId !== undefined) return db.select().from(changeOrders).where(eq(changeOrders.projectId, projectId)).all();
    return db.select().from(changeOrders).all();
  }
  createChangeOrder(data: InsertChangeOrder): ChangeOrder {
    return db.insert(changeOrders).values(data).returning().get();
  }

  getActionItems(projectId?: number): ActionItem[] {
    if (projectId !== undefined) return db.select().from(actionItems).where(eq(actionItems.projectId, projectId)).all();
    return db.select().from(actionItems).all();
  }
  createActionItem(data: InsertActionItem): ActionItem {
    return db.insert(actionItems).values(data).returning().get();
  }
  updateActionItemStatus(id: number, status: string): ActionItem | undefined {
    return db.update(actionItems).set({ status }).where(eq(actionItems.id, id)).returning().get();
  }

  getDailyLogs(projectId?: number): DailyLog[] {
    if (projectId !== undefined) return db.select().from(dailyLogs).where(eq(dailyLogs.projectId, projectId)).all();
    return db.select().from(dailyLogs).all();
  }
  createDailyLog(data: InsertDailyLog): DailyLog {
    return db.insert(dailyLogs).values(data).returning().get();
  }
  updateDailyLog(id: number, data: Partial<InsertDailyLog>): DailyLog | undefined {
    return db.update(dailyLogs).set(data).where(eq(dailyLogs.id, id)).returning().get();
  }
  deleteDailyLog(id: number): void {
    db.delete(dailyLogs).where(eq(dailyLogs.id, id)).run();
  }

  getPunchItems(projectId?: number): PunchItem[] {
    if (projectId !== undefined) return db.select().from(punchItems).where(eq(punchItems.projectId, projectId)).all();
    return db.select().from(punchItems).all();
  }
  updatePunchStatus(id: number, status: string): PunchItem | undefined {
    return db.update(punchItems).set({ status }).where(eq(punchItems.id, id)).returning().get();
  }
  createPunchItem(data: InsertPunchItem): PunchItem {
    return db.insert(punchItems).values(data).returning().get();
  }

  getContacts(): Contact[] { return db.select().from(contacts).all(); }
  createContact(data: InsertContact): Contact {
    return db.insert(contacts).values(data).returning().get();
  }
  updateContact(id: number, data: Partial<InsertContact>): Contact | undefined {
    return db.update(contacts).set(data).where(eq(contacts.id, id)).returning().get();
  }
  deleteContact(id: number): void {
    db.delete(contacts).where(eq(contacts.id, id)).run();
  }
  getEquipment(projectId?: number): Equipment[] {
    if (projectId !== undefined) return db.select().from(equipment).where(eq(equipment.projectId, projectId)).all();
    return db.select().from(equipment).all();
  }
  createEquipment(data: InsertEquipment): Equipment {
    return db.insert(equipment).values(data).returning().get();
  }
  getPhotos(projectId?: number): Photo[] {
    if (projectId !== undefined) return db.select().from(photos).where(eq(photos.projectId, projectId)).all();
    return db.select().from(photos).all();
  }
  getPhoto(id: number): Photo | undefined {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  }
  createPhoto(data: InsertPhoto): Photo {
    return db.insert(photos).values(data).returning().get();
  }
  deletePhoto(id: number): void {
    db.delete(photos).where(eq(photos.id, id)).run();
  }
  getDocuments(projectId?: number): DocumentRow[] {
    if (projectId !== undefined) return db.select().from(documents).where(eq(documents.projectId, projectId)).all();
    return db.select().from(documents).all();
  }
  getDocument(id: number): DocumentRow | undefined {
    return db.select().from(documents).where(eq(documents.id, id)).get();
  }
  createDocument(data: InsertDocument): DocumentRow {
    return db.insert(documents).values(data).returning().get();
  }
  deleteDocument(id: number): void {
    db.delete(documents).where(eq(documents.id, id)).run();
  }
  getBlueprints(projectId?: number): Blueprint[] {
    if (projectId !== undefined) return db.select().from(blueprints).where(eq(blueprints.projectId, projectId)).all();
    return db.select().from(blueprints).all();
  }
  createBlueprint(data: InsertBlueprint): Blueprint {
    return db.insert(blueprints).values(data).returning().get();
  }
  getDroneCaptures(projectId?: number): DroneCapture[] {
    if (projectId !== undefined) return db.select().from(droneCaptures).where(eq(droneCaptures.projectId, projectId)).all();
    return db.select().from(droneCaptures).all();
  }
  getDroneCapture(id: number): DroneCapture | undefined {
    return db.select().from(droneCaptures).where(eq(droneCaptures.id, id)).get();
  }
  createDroneCapture(data: InsertDroneCapture): DroneCapture {
    return db.insert(droneCaptures).values(data).returning().get();
  }
  deleteDroneCapture(id: number): void {
    db.delete(droneCaptures).where(eq(droneCaptures.id, id)).run();
  }
  getMilestones(projectId?: number): Milestone[] {
    if (projectId) {
      return db.select().from(milestones).where(eq(milestones.projectId, projectId)).all();
    }
    return db.select().from(milestones).all();
  }
  getMilestone(id: number): Milestone | undefined {
    return db.select().from(milestones).where(eq(milestones.id, id)).get();
  }
  createMilestone(data: InsertMilestone): Milestone {
    return db.insert(milestones).values(data).returning().get();
  }
  updateMilestone(id: number, data: Partial<InsertMilestone>): Milestone | undefined {
    return db.update(milestones).set(data).where(eq(milestones.id, id)).returning().get();
  }
  deleteMilestone(id: number): void {
    db.delete(milestones).where(eq(milestones.id, id)).run();
  }
  getMessages(projectId: number): Message[] {
    return db.select().from(messages).where(eq(messages.projectId, projectId)).all();
  }
  createMessage(data: InsertMessage): Message {
    return db.insert(messages).values(data).returning().get();
  }
  getNotes(projectId?: number): Note[] {
    if (projectId !== undefined) return db.select().from(notes).where(eq(notes.projectId, projectId)).all();
    return db.select().from(notes).all();
  }
  createNote(data: InsertNote): Note {
    return db.insert(notes).values(data).returning().get();
  }
  updateNotePosition(id: number, x: number, y: number): Note | undefined {
    return db.update(notes).set({ x, y }).where(eq(notes.id, id)).returning().get();
  }
  deleteNote(id: number): void {
    db.delete(notes).where(eq(notes.id, id)).run();
  }

  getIntegrations(): Integration[] {
    return db.select().from(integrations).all();
  }
  setIntegration(key: string, connected: boolean, config?: string): Integration {
    const now = new Date().toISOString();
    const existing = db.select().from(integrations).where(eq(integrations.key, key)).get();
    if (existing) {
      return db.update(integrations)
        .set({ connected, connectedAt: connected ? now : null, config: config ?? existing.config })
        .where(eq(integrations.key, key)).returning().get();
    }
    return db.insert(integrations)
      .values({ key, connected, connectedAt: connected ? now : null, config })
      .returning().get();
  }

  createSubscriber(data: InsertSubscriber): Subscriber {
    const now = new Date().toISOString();
    const existing = db.select().from(subscribers).where(eq(subscribers.email, data.email)).get();
    if (existing) {
      return db.update(subscribers)
        .set({ plan: data.plan, billing: data.billing, company: data.company ?? existing.company })
        .where(eq(subscribers.email, data.email)).returning().get();
    }
    return db.insert(subscribers).values({ ...data, createdAt: now }).returning().get();
  }
  listSubscribers(): Subscriber[] { return db.select().from(subscribers).all(); }

  createDemoRequest(data: InsertDemoRequest): DemoRequest {
    const now = new Date().toISOString();
    return db.insert(demoRequests).values({ ...data, createdAt: now }).returning().get();
  }
  listDemoRequests(): DemoRequest[] { return db.select().from(demoRequests).all(); }

  /* --------------------------- Settings ---------------------------- */
  getSettings(): Record<string, any> {
    const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
    let stored: Record<string, any> = {};
    if (row?.config) {
      try { stored = JSON.parse(row.config) || {}; } catch { stored = {}; }
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  }
  updateSettings(patch: Record<string, any>): Record<string, any> {
    const merged = { ...this.getSettings(), ...patch };
    // keep only known keys; parse + range-clamp numerics, coerce booleans
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
    const existing = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
    if (existing) {
      db.update(appSettings).set({ config: JSON.stringify(clean), updatedAt: now }).where(eq(appSettings.id, 1)).run();
    } else {
      db.insert(appSettings).values({ id: 1, config: JSON.stringify(clean), updatedAt: now }).run();
    }
    return { ...DEFAULT_SETTINGS, ...clean };
  }
  resetAllData(): void {
    // wipe + re-seed atomically; any failure rolls back and throws (route returns 500)
    sqlite.transaction(() => {
      for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, projects, teamMembers, integrations, subscribers, demoRequests]) {
        db.delete(t).run();
      }
      this.seed();
    })();
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

  createAccount(email: string, password: string, displayName: string, company?: string, role: string = "member"): AccountPublic {
    const normEmail = email.trim().toLowerCase();
    const existing = db.select().from(accounts).where(eq(accounts.email, normEmail)).get();
    if (existing) throw new Error("Email already registered");
    const now = new Date().toISOString();
    const row = db.insert(accounts).values({
      email: normEmail,
      passwordHash: this.hashPassword(password),
      displayName,
      role,
      company: company ?? null,
      createdAt: now,
    }).returning().get();
    return this.toPublic(row);
  }

  getAccountByEmail(email: string): Account | undefined {
    return db.select().from(accounts).where(eq(accounts.email, email.trim().toLowerCase())).get();
  }
  getAccount(id: number): AccountPublic | undefined {
    const a = db.select().from(accounts).where(eq(accounts.id, id)).get();
    return a ? this.toPublic(a) : undefined;
  }
  verifyPassword(email: string, password: string): AccountPublic | null {
    const acc = this.getAccountByEmail(email);
    if (!acc) return null;
    if (!this.verifyHash(password, acc.passwordHash)) return null;
    return this.toPublic(acc);
  }
  createSession(accountId: number): Session {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30d
    const token = randomBytes(32).toString("hex");
    // best-effort cleanup of expired sessions
    try { sqlite.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now.toISOString()); } catch {}
    return db.insert(sessions).values({
      id: token,
      accountId,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    }).returning().get();
  }
  getSession(token: string): { session: Session; account: AccountPublic } | null {
    if (!token) return null;
    const s = db.select().from(sessions).where(eq(sessions.id, token)).get();
    if (!s) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      db.delete(sessions).where(eq(sessions.id, token)).run();
      return null;
    }
    const a = this.getAccount(s.accountId);
    if (!a) return null;
    return { session: s, account: a };
  }
  destroySession(token: string): void {
    if (!token) return;
    db.delete(sessions).where(eq(sessions.id, token)).run();
  }
  countAccounts(): number {
    return db.select().from(accounts).all().length;
  }

  /* ----------------------------- Seed ------------------------------ */
  private seed() {
    const existing = db.select().from(teamMembers).all();
    if (existing.length > 0) return;

    const team: Omit<TeamMember, "id">[] = [
      { name: "Marcus Reyes", role: "Project Executive", trade: "Management", company: "Meridian Builders", initials: "MR", color: "amber", email: "m.reyes@meridian.co", phone: "(303) 555-0142", companyPhoto: "", accessLevel: "project_executive" },
      { name: "Dana Whitfield", role: "Superintendent", trade: "Self-perform", company: "Meridian Builders", initials: "DW", color: "blue", email: "d.whitfield@meridian.co", phone: "(303) 555-0188", companyPhoto: "", accessLevel: "superintendent" },
      { name: "Priya Anand", role: "Project Manager", trade: "Management", company: "Meridian Builders", initials: "PA", color: "emerald", email: "p.anand@meridian.co", phone: "(303) 555-0173", companyPhoto: "", accessLevel: "project_manager" },
      { name: "Tom Bradshaw", role: "Foreman", trade: "Concrete", company: "Apex Concrete", initials: "TB", color: "violet", email: "tom@apexconcrete.com", phone: "(720) 555-0119", companyPhoto: "", accessLevel: "foreman" },
      { name: "Lucia Romano", role: "Foreman", trade: "Electrical", company: "Voltline Electric", initials: "LR", color: "rose", email: "lucia@voltline.com", phone: "(720) 555-0156", companyPhoto: "", accessLevel: "foreman" },
      { name: "Kenji Park", role: "Foreman", trade: "HVAC", company: "Summit Mechanical", initials: "KP", color: "cyan", email: "kenji@summitmech.com", phone: "(720) 555-0134", companyPhoto: "", accessLevel: "foreman" },
      { name: "Sara Okafor", role: "Foreman", trade: "Framing", company: "Northside Carpentry", initials: "SO", color: "orange", email: "sara@northsidecarp.com", phone: "(720) 555-0177", companyPhoto: "", accessLevel: "foreman" },
      { name: "Ben Caldwell", role: "QC Manager", trade: "Quality", company: "Meridian Builders", initials: "BC", color: "slate", email: "b.caldwell@meridian.co", phone: "(303) 555-0162", companyPhoto: "", accessLevel: "superintendent" },
    ];
    const t = team.map((x) => db.insert(teamMembers).values(x).returning().get());

    const projectsSeed: Omit<Project, "id">[] = [
      { name: "Lakeside Medical Pavilion", number: "MB-2401", client: "Lakeside Health System", type: "Healthcare", status: "On Track", address: "1820 Healing Way, Denver, CO", startDate: "2025-09-02", endDate: "2026-12-18", budget: 48500000, spent: 21300000, progress: 44, superintendentId: t[1].id },
      { name: "Union Tower Office", number: "MB-2402", client: "Union Realty Partners", type: "Commercial", status: "At Risk", address: "440 Market St, Denver, CO", startDate: "2025-11-10", endDate: "2027-03-22", budget: 32200000, spent: 18900000, progress: 58, superintendentId: t[1].id },
      { name: "Riverside K-8 School", number: "MB-2403", client: "Denver Public Schools", type: "Education", status: "On Track", address: "705 River Bend Dr, Denver, CO", startDate: "2026-01-15", endDate: "2026-11-30", budget: 19800000, spent: 4100000, progress: 21, superintendentId: t[1].id },
      { name: "Highland Lofts", number: "MB-2404", client: "Highland Living LLC", type: "Residential", status: "Planning", address: "3200 Lowell Blvd, Denver, CO", startDate: "2026-08-01", endDate: "2027-09-14", budget: 12400000, spent: 320000, progress: 4, superintendentId: t[1].id },
    ];
    const p = projectsSeed.map((x) => db.insert(projects).values(x).returning().get());

    // tasks with schedule bars (seq = row order on gantt) + finish-to-start dependencies
    const tasksSeed: Omit<Task, "id">[] = [
      // Lakeside — 8 tasks, id sequence 1..8
      { projectId: p[0].id, title: "Site work & utilities", trade: "Civil", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2025-11-15", startDate: "2025-09-02", endDate: "2025-11-15", seq: 1, dependsOn: null },
      { projectId: p[0].id, title: "Foundations & slab", trade: "Concrete", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2026-01-20", startDate: "2025-11-20", endDate: "2026-01-30", seq: 2, dependsOn: "1" },
      { projectId: p[0].id, title: "Structural steel — L1-L3", trade: "Steel", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-04-15", startDate: "2026-02-02", endDate: "2026-04-30", seq: 3, dependsOn: "2" },
      { projectId: p[0].id, title: "Level 3 deck pour", trade: "Concrete", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-07-24", startDate: "2026-07-10", endDate: "2026-07-28", seq: 4, dependsOn: "3" },
      { projectId: p[0].id, title: "Electrical rough-in — ICU", trade: "Electrical", status: "Not Started", priority: "Medium", assigneeId: t[4].id, dueDate: "2026-08-02", startDate: "2026-07-25", endDate: "2026-08-20", seq: 5, dependsOn: "4" },
      { projectId: p[0].id, title: "HVAC duct install — L2", trade: "HVAC", status: "In Progress", priority: "Medium", assigneeId: t[5].id, dueDate: "2026-07-28", startDate: "2026-07-05", endDate: "2026-08-10", seq: 6, dependsOn: "3" },
      { projectId: p[0].id, title: "Curtainwall glazing", trade: "Glazing", status: "Blocked", priority: "High", assigneeId: null, dueDate: "2026-07-22", startDate: "2026-07-15", endDate: "2026-08-15", seq: 7, dependsOn: "3" },
      { projectId: p[0].id, title: "Framing — rooms 204-218", trade: "Framing", status: "In Progress", priority: "Low", assigneeId: t[6].id, dueDate: "2026-07-30", startDate: "2026-07-12", endDate: "2026-08-05", seq: 8, dependsOn: "4" },
    ];
    tasksSeed.forEach((x) => db.insert(tasks).values(x).run());

    const rfisSeed: Omit<Rfi, "id">[] = [
      { projectId: p[0].id, number: "RFI-014", subject: "Clearance at med-gas panels — ICU", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-12", dueDate: "2026-07-23" },
      { projectId: p[0].id, number: "RFI-015", subject: "Curtainwall anchor detail revision", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-15", dueDate: "2026-07-21" },
      { projectId: p[0].id, number: "RFI-012", subject: "Slab opening for mechanical chase", status: "Answered", assigneeId: t[2].id, dateCreated: "2026-06-28", dueDate: "2026-07-10" },
      { projectId: p[1].id, number: "RFI-031", subject: "Cooling tower load path clarification", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-16", dueDate: "2026-07-22" },
      { projectId: p[1].id, number: "RFI-029", subject: "Fire-rated assembly at stair 2", status: "Draft", assigneeId: t[2].id, dateCreated: "2026-07-18", dueDate: "2026-07-25" },
      { projectId: p[2].id, number: "RFI-006", subject: "Storm detention vault location", status: "Open", assigneeId: t[2].id, dateCreated: "2026-07-14", dueDate: "2026-07-24" },
    ];
    rfisSeed.forEach((x) => db.insert(rfis).values(x).run());

    const subsSeed: Omit<Submittal, "id">[] = [
      { projectId: p[0].id, number: "SUB-042", subject: "Curtainwall shop drawings", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-05-10", dueDate: "2026-05-24" },
      { projectId: p[0].id, number: "SUB-051", subject: "Med-gas piping — material certs", type: "Material", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-08", dueDate: "2026-07-22" },
      { projectId: p[0].id, number: "SUB-049", subject: "Structural steel connections", type: "Shop Drawing", status: "Revise", assigneeId: t[2].id, dateSubmitted: "2026-06-20", dueDate: "2026-07-05" },
      { projectId: p[1].id, number: "SUB-077", subject: "Cooling tower performance data", type: "Data", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-12", dueDate: "2026-07-26" },
      { projectId: p[2].id, number: "SUB-012", subject: "Storm detention vault precast", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-06-15", dueDate: "2026-06-29" },
    ];
    subsSeed.forEach((x) => db.insert(submittals).values(x).run());

    const coSeed: Omit<ChangeOrder, "id">[] = [
      { projectId: p[0].id, number: "CO-008", title: "Add 4th-floor terrace upgrade", status: "Approved", amount: 184000, scheduleImpact: 5, dateIssued: "2026-06-12" },
      { projectId: p[0].id, number: "CO-011", title: "Med-gas manifold expansion", status: "Pending", amount: 96000, scheduleImpact: 3, dateIssued: "2026-07-09" },
      { projectId: p[0].id, number: "CO-012", title: "Curtainwall IGU upgrade", status: "Pending", amount: 142000, scheduleImpact: 0, dateIssued: "2026-07-15" },
      { projectId: p[1].id, number: "CO-021", title: "Cooling tower re-spec", status: "Pending", amount: 210000, scheduleImpact: 7, dateIssued: "2026-07-17" },
      { projectId: p[1].id, number: "CO-019", title: "Lobby finish upgrade", status: "Approved", amount: 78000, scheduleImpact: 0, dateIssued: "2026-06-28" },
    ];
    coSeed.forEach((x) => db.insert(changeOrders).values(x).run());

    const aiSeed: Omit<ActionItem, "id">[] = [
      { projectId: p[0].id, title: "Confirm med-gas inspector availability", owner: "Priya Anand", status: "Open", priority: "High", dueDate: "2026-07-24", source: "OAC Meeting" },
      { projectId: p[0].id, title: "Send updated framing plan to Northside", owner: "Dana Whitfield", status: "Open", priority: "Medium", dueDate: "2026-07-23", source: "OAC Meeting" },
      { projectId: p[0].id, title: "Owner signage approval", owner: "Marcus Reyes", status: "Open", priority: "Low", dueDate: "2026-07-30", source: "Owner Call" },
      { projectId: p[1].id, title: "Schedule rigging engineer site visit", owner: "Dana Whitfield", status: "Open", priority: "Critical", dueDate: "2026-07-25", source: "Safety Stand-down" },
      { projectId: p[2].id, title: "Coordinate utility tie-in with city", owner: "Priya Anand", status: "In Progress", priority: "High", dueDate: "2026-07-28", source: "Precon Meeting" },
    ];
    aiSeed.forEach((x) => db.insert(actionItems).values(x).run());

    const logsSeed: Omit<DailyLog, "id">[] = [
      { projectId: p[0].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 64, summary: "Level 3 deck formwork 80% set; electrical rough-in ongoing on Level 2; 3 concrete trucks delivered.", photos: null },
      { projectId: p[0].id, date: "2026-07-20", authorId: t[1].id, weather: "Sunny", temp: 91, crewCount: 58, summary: "Curtainwall framing on south elevation; HVAC duct install began on Level 2.", photos: null },
      { projectId: p[1].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 41, summary: "Drywall finishing Floor 9; crane lift delayed pending engineer sign-off on rigging plan.", photos: null },
      { projectId: p[2].id, date: "2026-07-21", authorId: t[1].id, weather: "Sunny", temp: 90, crewCount: 22, summary: "Site grading continued on east lot; storm line install 60% complete.", photos: null },
    ];
    logsSeed.forEach((l) => db.insert(dailyLogs).values(l).run());

    const punchSeed: Omit<PunchItem, "id">[] = [
      { projectId: p[0].id, title: "Touch up drywall at Room 112 corner", location: "Level 1, Rm 112", trade: "Drywall", status: "Open", assigneeId: t[6].id },
      { projectId: p[0].id, title: "Missing outlet cover plates — east corridor", location: "Level 1, Corridor E", trade: "Electrical", status: "Open", assigneeId: t[4].id },
      { projectId: p[0].id, title: "Caulk joint at storefront door", location: "Main lobby", trade: "Glazing", status: "In Progress", assigneeId: null },
      { projectId: p[1].id, title: "Paint touch-up stair 4 landings", location: "Stair 4", trade: "Painting", status: "Open", assigneeId: null },
      { projectId: p[1].id, title: "Replace scratched door — Fl. 7 unit 712", location: "Fl. 7, Unit 712", trade: "Doors", status: "Open", assigneeId: t[6].id },
      { projectId: p[2].id, title: "Re-grade swale at southeast corner", location: "Southeast lot", trade: "Civil", status: "In Progress", assigneeId: t[3].id },
    ];
    punchSeed.forEach((x) => db.insert(punchItems).values(x).run());

    const contactsSeed: Omit<Contact, "id">[] = [
      { name: "Dr. Helen Voss", company: "Lakeside Health System", role: "Owner Rep", trade: "Owner", type: "Owner", phone: "(303) 555-0142", email: "h.voss@lakesidehealth.org" },
      { name: "Raymond Soto", company: "Northwind Architects", role: "Lead Architect", trade: "Design", type: "Architect", phone: "(303) 555-0188", email: "rsoto@northwindarch.com" },
      { name: "Gloria Mendez", company: "Apex Concrete", trade: "Concrete", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0110", email: "gmendez@apexconcrete.com" },
      { name: "James Holloway", company: "Voltline Electric", trade: "Electrical", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0155", email: "jh@voltline.com" },
      { name: "Nadia Bauer", company: "Summit Mechanical", trade: "HVAC", role: "Subcontractor PM", type: "Subcontractor", phone: "(303) 555-0190", email: "nadia@summitmech.com" },
      { name: "Owen Castillo", company: "City of Denver", role: "Building Inspector", trade: "Permitting", type: "Authority", phone: "(720) 555-0177", email: "ocastillo@denvergov.org" },
      { name: "Union Realty Partners", company: "Union Realty Partners", role: "Owner", trade: "Owner", type: "Owner", phone: "(303) 555-0201", email: "pm@unionrealty.com" },
    ];
    contactsSeed.forEach((x) => db.insert(contacts).values(x).run());

    const eqSeed: Omit<Equipment, "id">[] = [
      { name: "Link-Belt 80T Crane #1", type: "Crane", status: "On Site", projectId: p[0].id, operator: "T. Bradshaw", location: "North pad" },
      { name: "CAT 336 Excavator", type: "Excavator", status: "On Site", projectId: p[0].id, operator: "Rental", location: "East excavation" },
      { name: "Bobcat S650 Skid Steer", type: "Skid Steer", status: "On Site", projectId: p[2].id, operator: "Crew B", location: "East lot" },
      { name: "Genie S-105 Boom Lift", type: "Lift", status: "In Maintenance", projectId: p[0].id, operator: "—", location: "Yard" },
      { name: "Tower Crane TC-60", type: "Crane", status: "On Site", projectId: p[1].id, operator: "Crane Co.", location: "Core" },
      { name: "Concrete Pump 52m", type: "Pump", status: "Off Site", projectId: null, operator: "Rental", location: "Return 7/24" },
    ];
    eqSeed.forEach((x) => db.insert(equipment).values(x).run());

    // Copy bundled seed photos into the runtime photo dir (both local dev and Vercel /tmp).
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
    photoSeed.forEach((x) => db.insert(photos).values(x).run());

    const docSeed: Omit<DocumentRow, "id" | "storedFileName" | "originalFileName" | "mimeType" | "fileSizeBytes">[] = [
      { projectId: p[0].id, name: "A-101 Floor Plans — Rev C.pdf", type: "Drawing", size: "8.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
      { projectId: p[0].id, name: "Structural Notes — S-001.pdf", type: "Drawing", size: "3.1 MB", uploadedById: t[2].id, date: "2026-07-01" },
      { projectId: p[0].id, name: "Owner-Architect Agreement.pdf", type: "Contract", size: "1.2 MB", uploadedById: t[0].id, date: "2025-08-20" },
      { projectId: p[0].id, name: "Building Permit — BLD-2026-0441.pdf", type: "Permit", size: "0.6 MB", uploadedById: t[2].id, date: "2025-08-28" },
      { projectId: p[1].id, name: "Cooling Tower Submittal Log.xlsx", type: "Spec", size: "0.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
      { projectId: p[2].id, name: "Site Civil — Demolition Plan.pdf", type: "Drawing", size: "5.7 MB", uploadedById: t[2].id, date: "2026-06-30" },
    ];
    docSeed.forEach((x) => db.insert(documents).values(x).run());

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
    bpSeed.forEach((x) => db.insert(blueprints).values(x).run());

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
    droneSeed.forEach((x) => db.insert(droneCaptures).values(x).run());

    const msgSeed: Omit<Message, "id">[] = [
      { projectId: p[0].id, authorId: t[1].id, body: "Deck pour for Level 3 is on for Friday — need 3 trucks at 7am. Confirm barricades are reset by Thursday EOD.", createdAt: "2026-07-21T08:12:00" },
      { projectId: p[0].id, authorId: t[4].id, body: "Understood. Voltline will be clear of the pour area by 6pm Thursday. Med-gas rough-in on L2 is separate and unaffected.", createdAt: "2026-07-21T08:24:00" },
      { projectId: p[0].id, authorId: t[2].id, body: "Owner asked for updated progress photos of the curtainwall — I'll pull from the photo log and send the deck by 3pm.", createdAt: "2026-07-21T09:02:00" },
      { projectId: p[0].id, authorId: t[0].id, body: "Good. Let's also flag the glazing RFI status in tomorrow's OAC. It's the one holding the south elevation.", createdAt: "2026-07-21T09:15:00" },
    ];
    msgSeed.forEach((x) => db.insert(messages).values(x).run());

    const noteSeed: Omit<Note, "id">[] = [
      { projectId: p[0].id, body: "Concrete pour Friday 7am — 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40 },
      { projectId: p[0].id, body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90 },
      { projectId: p[0].id, body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50 },
      { projectId: p[0].id, body: "Inspector confirmed for med-gas — keep L2 ICU clear.", color: "emerald", x: 120, y: 220 },
    ];
    noteSeed.forEach((x) => db.insert(notes).values(x).run());

    // Milestones — key dates per project
    const milestoneSeed: Omit<Milestone, "id">[] = [
      // Lakeside Medical Pavilion
      { projectId: p[0].id, title: "Building permit issued", date: "2025-08-20", kind: "Permit", status: "Complete", notes: "City of Denver — approved on first submission" },
      { projectId: p[0].id, title: "Foundation complete", date: "2026-02-05", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[0].id, title: "Structural topout — L3", date: "2026-05-08", kind: "Structure", status: "Complete", notes: null },
      { projectId: p[0].id, title: "Curtainwall dry-in", date: "2026-08-20", kind: "Envelope", status: "At Risk", notes: "RFI-015 blocking south elevation glazing" },
      { projectId: p[0].id, title: "MEP rough-in complete", date: "2026-10-15", kind: "MEP", status: "Upcoming", notes: null },
      { projectId: p[0].id, title: "TCO — Temporary Cert. of Occupancy", date: "2026-11-30", kind: "TCO", status: "Upcoming", notes: null },
      { projectId: p[0].id, title: "Substantial completion", date: "2026-12-18", kind: "Closeout", status: "Upcoming", notes: null },

      // Union Tower Office
      { projectId: p[1].id, title: "Building permit issued", date: "2026-01-14", kind: "Permit", status: "Complete", notes: null },
      { projectId: p[1].id, title: "Excavation & shoring complete", date: "2026-04-22", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[1].id, title: "Cooling tower delivery", date: "2026-08-12", kind: "Delivery", status: "At Risk", notes: "Re-spec via CO-021 pending" },
      { projectId: p[1].id, title: "Structural topout", date: "2026-11-05", kind: "Structure", status: "Upcoming", notes: null },
      { projectId: p[1].id, title: "Enclosure complete", date: "2027-03-30", kind: "Envelope", status: "Upcoming", notes: null },
      { projectId: p[1].id, title: "Final acceptance", date: "2027-08-24", kind: "Closeout", status: "Upcoming", notes: null },

      // Riverside K-8 School
      { projectId: p[2].id, title: "Building permit issued", date: "2026-01-08", kind: "Permit", status: "Complete", notes: null },
      { projectId: p[2].id, title: "Foundation complete", date: "2026-04-30", kind: "Foundation", status: "Complete", notes: null },
      { projectId: p[2].id, title: "Structural topout", date: "2026-07-20", kind: "Structure", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "Envelope dry-in", date: "2026-09-04", kind: "Envelope", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "MEP rough-in complete", date: "2026-09-30", kind: "MEP", status: "Upcoming", notes: null },
      { projectId: p[2].id, title: "Substantial completion — ready for school year", date: "2026-11-30", kind: "Closeout", status: "Upcoming", notes: "Must be turned over before Aug 2027 school year" },
    ];
    milestoneSeed.forEach((x) => db.insert(milestones).values(x).run());

    // Seed a demo account so users can log in immediately.
    // These credentials are advertised on the login screen.
    try {
      const anyAccount = db.select().from(accounts).all();
      if (anyAccount.length === 0) {
        this.createAccount(
          "demo@trusspath.app",
          "trusspath",
          "Marcus Reyes",
          "Meridian Builders",
          "owner",
        );
      }
    } catch {}
  }
}

export const storage = new DatabaseStorage();
