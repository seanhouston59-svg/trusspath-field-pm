"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// shared/schema.ts
var import_sqlite_core, import_drizzle_orm, import_drizzle_zod, import_zod, teamMembers, projects, tasks, milestones, rfis, submittals, changeOrders, actionItems, dailyLogs, punchItems, contacts, equipment, photos, documents, blueprints, droneCaptures, messages, notes, integrations, subscribers, demoRequests, appSettings, accounts, sessions, insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema, insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema, insertPunchItemSchema, insertTeamSchema, insertContactSchema, insertEquipmentSchema, insertPhotoSchema, insertDocumentSchema, insertMessageSchema, insertNoteSchema, insertIntegrationSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertMilestoneSchema, insertSettingsSchema, signupSchema, loginSchema, DEFAULT_SETTINGS, insertSubscriberSchema, insertDemoRequestSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    import_sqlite_core = require("drizzle-orm/sqlite-core");
    import_drizzle_orm = require("drizzle-orm");
    import_drizzle_zod = require("drizzle-zod");
    import_zod = require("zod");
    teamMembers = (0, import_sqlite_core.sqliteTable)("team_members", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      name: (0, import_sqlite_core.text)("name").notNull(),
      role: (0, import_sqlite_core.text)("role").notNull(),
      trade: (0, import_sqlite_core.text)("trade").notNull(),
      company: (0, import_sqlite_core.text)("company").notNull(),
      initials: (0, import_sqlite_core.text)("initials").notNull(),
      color: (0, import_sqlite_core.text)("color").notNull(),
      email: (0, import_sqlite_core.text)("email"),
      phone: (0, import_sqlite_core.text)("phone"),
      companyPhoto: (0, import_sqlite_core.text)("company_photo"),
      accessLevel: (0, import_sqlite_core.text)("access_level").notNull().default("project_manager")
    });
    projects = (0, import_sqlite_core.sqliteTable)("projects", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      name: (0, import_sqlite_core.text)("name").notNull(),
      number: (0, import_sqlite_core.text)("number").notNull(),
      client: (0, import_sqlite_core.text)("client").notNull(),
      type: (0, import_sqlite_core.text)("type").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      address: (0, import_sqlite_core.text)("address").notNull(),
      startDate: (0, import_sqlite_core.text)("start_date").notNull(),
      endDate: (0, import_sqlite_core.text)("end_date").notNull(),
      budget: (0, import_sqlite_core.real)("budget").notNull(),
      spent: (0, import_sqlite_core.real)("spent").notNull(),
      progress: (0, import_sqlite_core.integer)("progress").notNull(),
      superintendentId: (0, import_sqlite_core.integer)("superintendent_id")
    });
    tasks = (0, import_sqlite_core.sqliteTable)("tasks", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      trade: (0, import_sqlite_core.text)("trade").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      priority: (0, import_sqlite_core.text)("priority").notNull(),
      assigneeId: (0, import_sqlite_core.integer)("assignee_id"),
      dueDate: (0, import_sqlite_core.text)("due_date").notNull(),
      // schedule positioning
      startDate: (0, import_sqlite_core.text)("start_date"),
      endDate: (0, import_sqlite_core.text)("end_date"),
      seq: (0, import_sqlite_core.integer)("seq"),
      // comma-separated list of predecessor task ids (finish-to-start)
      dependsOn: (0, import_sqlite_core.text)("depends_on").default(import_drizzle_orm.sql`NULL`)
    });
    milestones = (0, import_sqlite_core.sqliteTable)("milestones", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      date: (0, import_sqlite_core.text)("date").notNull(),
      kind: (0, import_sqlite_core.text)("kind").notNull(),
      // e.g. Permit, Foundation, TCO, Closeout, Inspection
      status: (0, import_sqlite_core.text)("status").notNull(),
      // Upcoming, Complete, At Risk, Missed
      notes: (0, import_sqlite_core.text)("notes")
    });
    rfis = (0, import_sqlite_core.sqliteTable)("rfis", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      number: (0, import_sqlite_core.text)("number").notNull(),
      subject: (0, import_sqlite_core.text)("subject").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      assigneeId: (0, import_sqlite_core.integer)("assignee_id"),
      dateCreated: (0, import_sqlite_core.text)("date_created").notNull(),
      dueDate: (0, import_sqlite_core.text)("due_date").notNull()
    });
    submittals = (0, import_sqlite_core.sqliteTable)("submittals", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      number: (0, import_sqlite_core.text)("number").notNull(),
      subject: (0, import_sqlite_core.text)("subject").notNull(),
      type: (0, import_sqlite_core.text)("type").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      assigneeId: (0, import_sqlite_core.integer)("assignee_id"),
      dateSubmitted: (0, import_sqlite_core.text)("date_submitted").notNull(),
      dueDate: (0, import_sqlite_core.text)("due_date").notNull()
    });
    changeOrders = (0, import_sqlite_core.sqliteTable)("change_orders", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      number: (0, import_sqlite_core.text)("number").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      amount: (0, import_sqlite_core.real)("amount").notNull(),
      scheduleImpact: (0, import_sqlite_core.integer)("schedule_impact").notNull(),
      dateIssued: (0, import_sqlite_core.text)("date_issued").notNull()
    });
    actionItems = (0, import_sqlite_core.sqliteTable)("action_items", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      owner: (0, import_sqlite_core.text)("owner").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      priority: (0, import_sqlite_core.text)("priority").notNull(),
      dueDate: (0, import_sqlite_core.text)("due_date").notNull(),
      source: (0, import_sqlite_core.text)("source").notNull()
    });
    dailyLogs = (0, import_sqlite_core.sqliteTable)("daily_logs", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      date: (0, import_sqlite_core.text)("date").notNull(),
      authorId: (0, import_sqlite_core.integer)("author_id"),
      weather: (0, import_sqlite_core.text)("weather").notNull(),
      temp: (0, import_sqlite_core.integer)("temp").notNull(),
      crewCount: (0, import_sqlite_core.integer)("crew_count").notNull(),
      summary: (0, import_sqlite_core.text)("summary").notNull(),
      photos: (0, import_sqlite_core.text)("photos")
    });
    punchItems = (0, import_sqlite_core.sqliteTable)("punch_items", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      location: (0, import_sqlite_core.text)("location").notNull(),
      trade: (0, import_sqlite_core.text)("trade").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      assigneeId: (0, import_sqlite_core.integer)("assignee_id")
    });
    contacts = (0, import_sqlite_core.sqliteTable)("contacts", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      name: (0, import_sqlite_core.text)("name").notNull(),
      company: (0, import_sqlite_core.text)("company").notNull(),
      role: (0, import_sqlite_core.text)("role").notNull(),
      trade: (0, import_sqlite_core.text)("trade").notNull(),
      type: (0, import_sqlite_core.text)("type").notNull(),
      phone: (0, import_sqlite_core.text)("phone").notNull(),
      email: (0, import_sqlite_core.text)("email").notNull()
    });
    equipment = (0, import_sqlite_core.sqliteTable)("equipment", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      name: (0, import_sqlite_core.text)("name").notNull(),
      type: (0, import_sqlite_core.text)("type").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      projectId: (0, import_sqlite_core.integer)("project_id"),
      operator: (0, import_sqlite_core.text)("operator"),
      location: (0, import_sqlite_core.text)("location")
    });
    photos = (0, import_sqlite_core.sqliteTable)("photos", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      caption: (0, import_sqlite_core.text)("caption").notNull(),
      location: (0, import_sqlite_core.text)("location").notNull(),
      takenById: (0, import_sqlite_core.integer)("taken_by_id"),
      date: (0, import_sqlite_core.text)("date").notNull(),
      hue: (0, import_sqlite_core.integer)("hue").notNull(),
      storedFileName: (0, import_sqlite_core.text)("stored_file_name"),
      originalFileName: (0, import_sqlite_core.text)("original_file_name"),
      mimeType: (0, import_sqlite_core.text)("mime_type"),
      fileSizeBytes: (0, import_sqlite_core.integer)("file_size_bytes")
    });
    documents = (0, import_sqlite_core.sqliteTable)("documents", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      name: (0, import_sqlite_core.text)("name").notNull(),
      type: (0, import_sqlite_core.text)("type").notNull(),
      size: (0, import_sqlite_core.text)("size").notNull(),
      uploadedById: (0, import_sqlite_core.integer)("uploaded_by_id"),
      date: (0, import_sqlite_core.text)("date").notNull(),
      storedFileName: (0, import_sqlite_core.text)("stored_file_name"),
      originalFileName: (0, import_sqlite_core.text)("original_file_name"),
      mimeType: (0, import_sqlite_core.text)("mime_type"),
      fileSizeBytes: (0, import_sqlite_core.integer)("file_size_bytes")
    });
    blueprints = (0, import_sqlite_core.sqliteTable)("blueprints", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      sheetNumber: (0, import_sqlite_core.text)("sheet_number").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      discipline: (0, import_sqlite_core.text)("discipline").notNull(),
      revision: (0, import_sqlite_core.text)("revision").notNull(),
      status: (0, import_sqlite_core.text)("status").notNull(),
      uploadedById: (0, import_sqlite_core.integer)("uploaded_by_id"),
      date: (0, import_sqlite_core.text)("date").notNull(),
      hue: (0, import_sqlite_core.integer)("hue").notNull()
    });
    droneCaptures = (0, import_sqlite_core.sqliteTable)("drone_captures", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      title: (0, import_sqlite_core.text)("title").notNull(),
      captureType: (0, import_sqlite_core.text)("capture_type").notNull(),
      pilot: (0, import_sqlite_core.text)("pilot"),
      flightDate: (0, import_sqlite_core.text)("flight_date").notNull(),
      altitude: (0, import_sqlite_core.text)("altitude"),
      area: (0, import_sqlite_core.text)("area"),
      status: (0, import_sqlite_core.text)("status").notNull(),
      hue: (0, import_sqlite_core.integer)("hue").notNull(),
      storedFileName: (0, import_sqlite_core.text)("stored_file_name"),
      originalFileName: (0, import_sqlite_core.text)("original_file_name"),
      mimeType: (0, import_sqlite_core.text)("mime_type"),
      fileSizeBytes: (0, import_sqlite_core.integer)("file_size_bytes")
    });
    messages = (0, import_sqlite_core.sqliteTable)("messages", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id").notNull(),
      authorId: (0, import_sqlite_core.integer)("author_id"),
      body: (0, import_sqlite_core.text)("body").notNull(),
      createdAt: (0, import_sqlite_core.text)("created_at").notNull()
    });
    notes = (0, import_sqlite_core.sqliteTable)("notes", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      projectId: (0, import_sqlite_core.integer)("project_id"),
      body: (0, import_sqlite_core.text)("body").notNull(),
      color: (0, import_sqlite_core.text)("color").notNull(),
      x: (0, import_sqlite_core.integer)("x").notNull(),
      y: (0, import_sqlite_core.integer)("y").notNull()
    });
    integrations = (0, import_sqlite_core.sqliteTable)("integrations", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      key: (0, import_sqlite_core.text)("key").notNull().unique(),
      connected: (0, import_sqlite_core.integer)("connected", { mode: "boolean" }).notNull().default(false),
      connectedAt: (0, import_sqlite_core.text)("connected_at"),
      config: (0, import_sqlite_core.text)("config")
    });
    subscribers = (0, import_sqlite_core.sqliteTable)("subscribers", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      email: (0, import_sqlite_core.text)("email").notNull().unique(),
      plan: (0, import_sqlite_core.text)("plan").notNull(),
      billing: (0, import_sqlite_core.text)("billing").notNull(),
      company: (0, import_sqlite_core.text)("company"),
      createdAt: (0, import_sqlite_core.text)("created_at").notNull()
    });
    demoRequests = (0, import_sqlite_core.sqliteTable)("demo_requests", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      name: (0, import_sqlite_core.text)("name").notNull(),
      email: (0, import_sqlite_core.text)("email").notNull(),
      company: (0, import_sqlite_core.text)("company").notNull(),
      phone: (0, import_sqlite_core.text)("phone"),
      teamSize: (0, import_sqlite_core.text)("team_size"),
      notes: (0, import_sqlite_core.text)("notes"),
      createdAt: (0, import_sqlite_core.text)("created_at").notNull()
    });
    appSettings = (0, import_sqlite_core.sqliteTable)("app_settings", {
      id: (0, import_sqlite_core.integer)("id").primaryKey(),
      config: (0, import_sqlite_core.text)("config").notNull().default("{}"),
      updatedAt: (0, import_sqlite_core.text)("updated_at").notNull()
    });
    accounts = (0, import_sqlite_core.sqliteTable)("accounts", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      email: (0, import_sqlite_core.text)("email").notNull().unique(),
      passwordHash: (0, import_sqlite_core.text)("password_hash").notNull(),
      displayName: (0, import_sqlite_core.text)("display_name").notNull(),
      role: (0, import_sqlite_core.text)("role").notNull().default("member"),
      // owner | admin | member
      company: (0, import_sqlite_core.text)("company"),
      createdAt: (0, import_sqlite_core.text)("created_at").notNull()
    });
    sessions = (0, import_sqlite_core.sqliteTable)("sessions", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      // random token
      accountId: (0, import_sqlite_core.integer)("account_id").notNull(),
      createdAt: (0, import_sqlite_core.text)("created_at").notNull(),
      expiresAt: (0, import_sqlite_core.text)("expires_at").notNull()
    });
    insertProjectSchema = (0, import_drizzle_zod.createInsertSchema)(projects).omit({ id: true });
    insertTaskSchema = (0, import_drizzle_zod.createInsertSchema)(tasks).omit({ id: true });
    insertRfiSchema = (0, import_drizzle_zod.createInsertSchema)(rfis).omit({ id: true });
    insertSubmittalSchema = (0, import_drizzle_zod.createInsertSchema)(submittals).omit({ id: true });
    insertChangeOrderSchema = (0, import_drizzle_zod.createInsertSchema)(changeOrders).omit({ id: true });
    insertActionItemSchema = (0, import_drizzle_zod.createInsertSchema)(actionItems).omit({ id: true });
    insertDailyLogSchema = (0, import_drizzle_zod.createInsertSchema)(dailyLogs).omit({ id: true });
    insertPunchItemSchema = (0, import_drizzle_zod.createInsertSchema)(punchItems).omit({ id: true });
    insertTeamSchema = (0, import_drizzle_zod.createInsertSchema)(teamMembers).omit({ id: true });
    insertContactSchema = (0, import_drizzle_zod.createInsertSchema)(contacts).omit({ id: true });
    insertEquipmentSchema = (0, import_drizzle_zod.createInsertSchema)(equipment).omit({ id: true });
    insertPhotoSchema = (0, import_drizzle_zod.createInsertSchema)(photos).omit({ id: true });
    insertDocumentSchema = (0, import_drizzle_zod.createInsertSchema)(documents).omit({ id: true });
    insertMessageSchema = (0, import_drizzle_zod.createInsertSchema)(messages).omit({ id: true });
    insertNoteSchema = (0, import_drizzle_zod.createInsertSchema)(notes).omit({ id: true });
    insertIntegrationSchema = (0, import_drizzle_zod.createInsertSchema)(integrations).omit({ id: true });
    insertBlueprintSchema = (0, import_drizzle_zod.createInsertSchema)(blueprints).omit({ id: true });
    insertDroneCaptureSchema = (0, import_drizzle_zod.createInsertSchema)(droneCaptures).omit({ id: true });
    insertMilestoneSchema = (0, import_drizzle_zod.createInsertSchema)(milestones).omit({ id: true });
    insertSettingsSchema = (0, import_drizzle_zod.createInsertSchema)(appSettings).omit({ id: true, updatedAt: true });
    signupSchema = import_zod.z.object({
      email: import_zod.z.string().email(),
      password: import_zod.z.string().min(6, "Password must be at least 6 characters"),
      displayName: import_zod.z.string().min(1),
      company: import_zod.z.string().optional()
    });
    loginSchema = import_zod.z.object({
      email: import_zod.z.string().email(),
      password: import_zod.z.string().min(1)
    });
    DEFAULT_SETTINGS = {
      voiceEnabled: true,
      voiceRate: 0.97,
      voicePitch: 0.9,
      autoSpeak: true,
      addressTerm: "sir",
      tone: "concise",
      companyName: "TrussPath",
      defaultProjectId: 0
    };
    insertSubscriberSchema = (0, import_drizzle_zod.createInsertSchema)(subscribers).omit({ id: true, createdAt: true }).extend({
      email: import_zod.z.string().email(),
      plan: import_zod.z.enum(["starter", "pro", "enterprise"]),
      billing: import_zod.z.enum(["monthly", "annual"]),
      company: import_zod.z.string().optional()
    });
    insertDemoRequestSchema = (0, import_drizzle_zod.createInsertSchema)(demoRequests).omit({ id: true, createdAt: true }).extend({
      name: import_zod.z.string().min(1),
      email: import_zod.z.string().email(),
      company: import_zod.z.string().min(1),
      phone: import_zod.z.string().optional(),
      teamSize: import_zod.z.string().optional(),
      notes: import_zod.z.string().optional()
    });
  }
});

// server/storage.ts
function resolveDbPath() {
  if (process.env.VERCEL) {
    const tmp = "/tmp/data.db";
    if (!(0, import_node_fs.existsSync)(tmp)) {
      const candidates = [(0, import_node_path.resolve)(process.cwd(), "data.db"), (0, import_node_path.resolve)(__dirname, "..", "data.db"), (0, import_node_path.resolve)(__dirname, "data.db")];
      for (const c of candidates) {
        if ((0, import_node_fs.existsSync)(c)) {
          (0, import_node_fs.copyFileSync)(c, tmp);
          break;
        }
      }
    }
    return tmp;
  }
  return "data.db";
}
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
  try {
    const cols = sqlite.prepare("PRAGMA table_info(tasks)").all();
    if (!cols.some((c) => c.name === "depends_on")) {
      sqlite.exec("ALTER TABLE tasks ADD COLUMN depends_on TEXT");
    }
  } catch {
  }
  for (const col of ["ADD COLUMN photos TEXT"]) {
    try {
      sqlite.exec(`ALTER TABLE daily_logs ${col};`);
    } catch {
    }
  }
  for (const col of ["email", "phone", "company_photo"]) {
    try {
      sqlite.exec(`ALTER TABLE team_members ADD COLUMN ${col} TEXT;`);
    } catch {
    }
  }
  try {
    sqlite.exec(`ALTER TABLE team_members ADD COLUMN access_level TEXT NOT NULL DEFAULT 'project_manager';`);
  } catch {
  }
  try {
    sqlite.exec(`UPDATE team_members SET access_level = CASE
      WHEN role LIKE '%Executive%' THEN 'project_executive'
      WHEN role LIKE '%Superintendent%' THEN 'superintendent'
      WHEN role LIKE '%Foreman%' THEN 'foreman'
      WHEN role LIKE '%QC%' OR role LIKE '%Quality%' THEN 'superintendent'
      WHEN role LIKE '%Manager%' THEN 'project_manager'
      ELSE access_level END
      WHERE access_level = 'project_manager';`);
  } catch {
  }
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try {
      sqlite.exec(`ALTER TABLE documents ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`);
    } catch {
    }
  }
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try {
      sqlite.exec(`ALTER TABLE photos ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`);
    } catch {
    }
  }
  for (const col of ["stored_file_name", "original_file_name", "mime_type", "file_size_bytes"]) {
    try {
      sqlite.exec(`ALTER TABLE drone_captures ADD COLUMN ${col} ${col === "file_size_bytes" ? "INTEGER" : "TEXT"};`);
    } catch {
    }
  }
  try {
    sqlite.exec(`UPDATE team_members SET
      email = CASE WHEN email IS NULL OR email = '' THEN lower(replace(name,' ','.')) || '@' || lower(replace(replace(company,' ',''),'.','')) || '.com' ELSE email END,
      phone = CASE WHEN phone IS NULL OR phone = '' THEN '(303) 555-' || substr('0000' || ((id * 137) % 9000 + 1000), -4) ELSE phone END;`);
  } catch {
  }
}
var import_better_sqlite3, import_better_sqlite32, import_drizzle_orm2, import_node_fs, import_node_path, import_node_crypto, sqlite, db, DatabaseStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    import_better_sqlite3 = require("drizzle-orm/better-sqlite3");
    import_better_sqlite32 = __toESM(require("better-sqlite3"), 1);
    import_drizzle_orm2 = require("drizzle-orm");
    import_node_fs = require("node:fs");
    import_node_path = require("node:path");
    import_node_crypto = require("node:crypto");
    sqlite = new import_better_sqlite32.default(resolveDbPath());
    sqlite.pragma(process.env.VERCEL ? "journal_mode = MEMORY" : "journal_mode = WAL");
    db = (0, import_better_sqlite3.drizzle)(sqlite);
    migrate();
    DatabaseStorage = class {
      constructor() {
        this.seed();
      }
      getTeam() {
        return db.select().from(teamMembers).all();
      }
      getTeamMember(id) {
        return db.select().from(teamMembers).where((0, import_drizzle_orm2.eq)(teamMembers.id, id)).get();
      }
      createTeamMember(data) {
        return db.insert(teamMembers).values(data).returning().get();
      }
      updateTeamMember(id, data) {
        return db.update(teamMembers).set(data).where((0, import_drizzle_orm2.eq)(teamMembers.id, id)).returning().get();
      }
      deleteTeamMember(id) {
        db.delete(teamMembers).where((0, import_drizzle_orm2.eq)(teamMembers.id, id)).run();
      }
      getProjects() {
        return db.select().from(projects).all();
      }
      getProject(id) {
        return db.select().from(projects).where((0, import_drizzle_orm2.eq)(projects.id, id)).get();
      }
      createProject(data) {
        return db.insert(projects).values(data).returning().get();
      }
      getTasks(projectId) {
        if (projectId !== void 0) return db.select().from(tasks).where((0, import_drizzle_orm2.eq)(tasks.projectId, projectId)).all();
        return db.select().from(tasks).all();
      }
      createTask(data) {
        return db.insert(tasks).values(data).returning().get();
      }
      updateTaskStatus(id, status) {
        return db.update(tasks).set({ status }).where((0, import_drizzle_orm2.eq)(tasks.id, id)).returning().get();
      }
      getRfis(projectId) {
        if (projectId !== void 0) return db.select().from(rfis).where((0, import_drizzle_orm2.eq)(rfis.projectId, projectId)).all();
        return db.select().from(rfis).all();
      }
      createRfi(data) {
        return db.insert(rfis).values(data).returning().get();
      }
      updateRfiStatus(id, status) {
        return db.update(rfis).set({ status }).where((0, import_drizzle_orm2.eq)(rfis.id, id)).returning().get();
      }
      getSubmittals(projectId) {
        if (projectId !== void 0) return db.select().from(submittals).where((0, import_drizzle_orm2.eq)(submittals.projectId, projectId)).all();
        return db.select().from(submittals).all();
      }
      createSubmittal(data) {
        return db.insert(submittals).values(data).returning().get();
      }
      updateSubmittalStatus(id, status) {
        return db.update(submittals).set({ status }).where((0, import_drizzle_orm2.eq)(submittals.id, id)).returning().get();
      }
      getChangeOrders(projectId) {
        if (projectId !== void 0) return db.select().from(changeOrders).where((0, import_drizzle_orm2.eq)(changeOrders.projectId, projectId)).all();
        return db.select().from(changeOrders).all();
      }
      createChangeOrder(data) {
        return db.insert(changeOrders).values(data).returning().get();
      }
      updateChangeOrderStatus(id, status) {
        return db.update(changeOrders).set({ status }).where((0, import_drizzle_orm2.eq)(changeOrders.id, id)).returning().get();
      }
      getActionItems(projectId) {
        if (projectId !== void 0) return db.select().from(actionItems).where((0, import_drizzle_orm2.eq)(actionItems.projectId, projectId)).all();
        return db.select().from(actionItems).all();
      }
      createActionItem(data) {
        return db.insert(actionItems).values(data).returning().get();
      }
      updateActionItemStatus(id, status) {
        return db.update(actionItems).set({ status }).where((0, import_drizzle_orm2.eq)(actionItems.id, id)).returning().get();
      }
      getDailyLogs(projectId) {
        if (projectId !== void 0) return db.select().from(dailyLogs).where((0, import_drizzle_orm2.eq)(dailyLogs.projectId, projectId)).all();
        return db.select().from(dailyLogs).all();
      }
      createDailyLog(data) {
        return db.insert(dailyLogs).values(data).returning().get();
      }
      updateDailyLog(id, data) {
        return db.update(dailyLogs).set(data).where((0, import_drizzle_orm2.eq)(dailyLogs.id, id)).returning().get();
      }
      deleteDailyLog(id) {
        db.delete(dailyLogs).where((0, import_drizzle_orm2.eq)(dailyLogs.id, id)).run();
      }
      getPunchItems(projectId) {
        if (projectId !== void 0) return db.select().from(punchItems).where((0, import_drizzle_orm2.eq)(punchItems.projectId, projectId)).all();
        return db.select().from(punchItems).all();
      }
      updatePunchStatus(id, status) {
        return db.update(punchItems).set({ status }).where((0, import_drizzle_orm2.eq)(punchItems.id, id)).returning().get();
      }
      createPunchItem(data) {
        return db.insert(punchItems).values(data).returning().get();
      }
      getContacts() {
        return db.select().from(contacts).all();
      }
      createContact(data) {
        return db.insert(contacts).values(data).returning().get();
      }
      updateContact(id, data) {
        return db.update(contacts).set(data).where((0, import_drizzle_orm2.eq)(contacts.id, id)).returning().get();
      }
      deleteContact(id) {
        db.delete(contacts).where((0, import_drizzle_orm2.eq)(contacts.id, id)).run();
      }
      getEquipment(projectId) {
        if (projectId !== void 0) return db.select().from(equipment).where((0, import_drizzle_orm2.eq)(equipment.projectId, projectId)).all();
        return db.select().from(equipment).all();
      }
      createEquipment(data) {
        return db.insert(equipment).values(data).returning().get();
      }
      getPhotos(projectId) {
        if (projectId !== void 0) return db.select().from(photos).where((0, import_drizzle_orm2.eq)(photos.projectId, projectId)).all();
        return db.select().from(photos).all();
      }
      getPhoto(id) {
        return db.select().from(photos).where((0, import_drizzle_orm2.eq)(photos.id, id)).get();
      }
      createPhoto(data) {
        return db.insert(photos).values(data).returning().get();
      }
      deletePhoto(id) {
        db.delete(photos).where((0, import_drizzle_orm2.eq)(photos.id, id)).run();
      }
      getDocuments(projectId) {
        if (projectId !== void 0) return db.select().from(documents).where((0, import_drizzle_orm2.eq)(documents.projectId, projectId)).all();
        return db.select().from(documents).all();
      }
      getDocument(id) {
        return db.select().from(documents).where((0, import_drizzle_orm2.eq)(documents.id, id)).get();
      }
      createDocument(data) {
        return db.insert(documents).values(data).returning().get();
      }
      deleteDocument(id) {
        db.delete(documents).where((0, import_drizzle_orm2.eq)(documents.id, id)).run();
      }
      getBlueprints(projectId) {
        if (projectId !== void 0) return db.select().from(blueprints).where((0, import_drizzle_orm2.eq)(blueprints.projectId, projectId)).all();
        return db.select().from(blueprints).all();
      }
      createBlueprint(data) {
        return db.insert(blueprints).values(data).returning().get();
      }
      getDroneCaptures(projectId) {
        if (projectId !== void 0) return db.select().from(droneCaptures).where((0, import_drizzle_orm2.eq)(droneCaptures.projectId, projectId)).all();
        return db.select().from(droneCaptures).all();
      }
      getDroneCapture(id) {
        return db.select().from(droneCaptures).where((0, import_drizzle_orm2.eq)(droneCaptures.id, id)).get();
      }
      createDroneCapture(data) {
        return db.insert(droneCaptures).values(data).returning().get();
      }
      deleteDroneCapture(id) {
        db.delete(droneCaptures).where((0, import_drizzle_orm2.eq)(droneCaptures.id, id)).run();
      }
      getMilestones(projectId) {
        if (projectId) {
          return db.select().from(milestones).where((0, import_drizzle_orm2.eq)(milestones.projectId, projectId)).all();
        }
        return db.select().from(milestones).all();
      }
      getMilestone(id) {
        return db.select().from(milestones).where((0, import_drizzle_orm2.eq)(milestones.id, id)).get();
      }
      createMilestone(data) {
        return db.insert(milestones).values(data).returning().get();
      }
      updateMilestone(id, data) {
        return db.update(milestones).set(data).where((0, import_drizzle_orm2.eq)(milestones.id, id)).returning().get();
      }
      deleteMilestone(id) {
        db.delete(milestones).where((0, import_drizzle_orm2.eq)(milestones.id, id)).run();
      }
      getMessages(projectId) {
        return db.select().from(messages).where((0, import_drizzle_orm2.eq)(messages.projectId, projectId)).all();
      }
      createMessage(data) {
        return db.insert(messages).values(data).returning().get();
      }
      getNotes(projectId) {
        if (projectId !== void 0) return db.select().from(notes).where((0, import_drizzle_orm2.eq)(notes.projectId, projectId)).all();
        return db.select().from(notes).all();
      }
      createNote(data) {
        return db.insert(notes).values(data).returning().get();
      }
      updateNotePosition(id, x, y) {
        return db.update(notes).set({ x, y }).where((0, import_drizzle_orm2.eq)(notes.id, id)).returning().get();
      }
      deleteNote(id) {
        db.delete(notes).where((0, import_drizzle_orm2.eq)(notes.id, id)).run();
      }
      getIntegrations() {
        return db.select().from(integrations).all();
      }
      setIntegration(key, connected, config) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existing = db.select().from(integrations).where((0, import_drizzle_orm2.eq)(integrations.key, key)).get();
        if (existing) {
          return db.update(integrations).set({ connected, connectedAt: connected ? now : null, config: config ?? existing.config }).where((0, import_drizzle_orm2.eq)(integrations.key, key)).returning().get();
        }
        return db.insert(integrations).values({ key, connected, connectedAt: connected ? now : null, config }).returning().get();
      }
      createSubscriber(data) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existing = db.select().from(subscribers).where((0, import_drizzle_orm2.eq)(subscribers.email, data.email)).get();
        if (existing) {
          return db.update(subscribers).set({ plan: data.plan, billing: data.billing, company: data.company ?? existing.company }).where((0, import_drizzle_orm2.eq)(subscribers.email, data.email)).returning().get();
        }
        return db.insert(subscribers).values({ ...data, createdAt: now }).returning().get();
      }
      listSubscribers() {
        return db.select().from(subscribers).all();
      }
      createDemoRequest(data) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        return db.insert(demoRequests).values({ ...data, createdAt: now }).returning().get();
      }
      listDemoRequests() {
        return db.select().from(demoRequests).all();
      }
      /* --------------------------- Settings ---------------------------- */
      getSettings() {
        const row = db.select().from(appSettings).where((0, import_drizzle_orm2.eq)(appSettings.id, 1)).get();
        let stored = {};
        if (row?.config) {
          try {
            stored = JSON.parse(row.config) || {};
          } catch {
            stored = {};
          }
        }
        return { ...DEFAULT_SETTINGS, ...stored };
      }
      updateSettings(patch) {
        const merged = { ...this.getSettings(), ...patch };
        const CLAMPS = {
          voiceRate: [0.5, 1.3],
          voicePitch: [0, 1.5],
          defaultProjectId: [0, 1e6]
        };
        const clean = {};
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
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existing = db.select().from(appSettings).where((0, import_drizzle_orm2.eq)(appSettings.id, 1)).get();
        if (existing) {
          db.update(appSettings).set({ config: JSON.stringify(clean), updatedAt: now }).where((0, import_drizzle_orm2.eq)(appSettings.id, 1)).run();
        } else {
          db.insert(appSettings).values({ id: 1, config: JSON.stringify(clean), updatedAt: now }).run();
        }
        return { ...DEFAULT_SETTINGS, ...clean };
      }
      resetAllData() {
        sqlite.transaction(() => {
          for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, projects, teamMembers, integrations, subscribers, demoRequests]) {
            db.delete(t).run();
          }
          this.seed();
        })();
      }
      /* ---------------------- Auth helpers ---------------------- */
      hashPassword(password) {
        const salt = (0, import_node_crypto.randomBytes)(16).toString("hex");
        const derived = (0, import_node_crypto.scryptSync)(password, salt, 64).toString("hex");
        return `${salt}:${derived}`;
      }
      verifyHash(password, stored) {
        const [salt, hash] = stored.split(":");
        if (!salt || !hash) return false;
        const derived = (0, import_node_crypto.scryptSync)(password, salt, 64);
        const target = Buffer.from(hash, "hex");
        if (derived.length !== target.length) return false;
        return (0, import_node_crypto.timingSafeEqual)(derived, target);
      }
      toPublic(a) {
        const { passwordHash: _pw, ...rest } = a;
        return rest;
      }
      createAccount(email, password, displayName, company, role = "member") {
        const normEmail = email.trim().toLowerCase();
        const existing = db.select().from(accounts).where((0, import_drizzle_orm2.eq)(accounts.email, normEmail)).get();
        if (existing) throw new Error("Email already registered");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const row = db.insert(accounts).values({
          email: normEmail,
          passwordHash: this.hashPassword(password),
          displayName,
          role,
          company: company ?? null,
          createdAt: now
        }).returning().get();
        return this.toPublic(row);
      }
      getAccountByEmail(email) {
        return db.select().from(accounts).where((0, import_drizzle_orm2.eq)(accounts.email, email.trim().toLowerCase())).get();
      }
      getAccount(id) {
        const a = db.select().from(accounts).where((0, import_drizzle_orm2.eq)(accounts.id, id)).get();
        return a ? this.toPublic(a) : void 0;
      }
      verifyPassword(email, password) {
        const acc = this.getAccountByEmail(email);
        if (!acc) return null;
        if (!this.verifyHash(password, acc.passwordHash)) return null;
        return this.toPublic(acc);
      }
      createSession(accountId) {
        const now = /* @__PURE__ */ new Date();
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
        const payload = `${accountId}.${expires.getTime()}`;
        const b64 = (s) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const secret = process.env.SESSION_SECRET || "trusspath-dev-secret-change-me";
        const sig = (0, import_node_crypto.scryptSync)(payload, secret, 32).toString("hex");
        const token = `${b64(payload)}.${sig}`;
        return { id: token, accountId, createdAt: now.toISOString(), expiresAt: expires.toISOString() };
      }
      getSession(token) {
        if (!token || typeof token !== "string") return null;
        const parts = token.split(".");
        if (parts.length !== 2) return null;
        let payload;
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
        const expected = (0, import_node_crypto.scryptSync)(payload, secret, 32).toString("hex");
        const a = Buffer.from(parts[1], "hex");
        const b = Buffer.from(expected, "hex");
        if (a.length !== b.length || !(0, import_node_crypto.timingSafeEqual)(a, b)) return null;
        const account = this.getAccount(accountId);
        if (!account) return null;
        const session = {
          id: token,
          accountId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          expiresAt: new Date(expMs).toISOString()
        };
        return { session, account };
      }
      destroySession(_token) {
      }
      countAccounts() {
        return db.select().from(accounts).all().length;
      }
      /* ----------------------------- Seed ------------------------------ */
      seed() {
        const existing = db.select().from(teamMembers).all();
        if (existing.length > 0) return;
        const team = [
          { name: "Marcus Reyes", role: "Project Executive", trade: "Management", company: "Meridian Builders", initials: "MR", color: "amber", email: "m.reyes@meridian.co", phone: "(303) 555-0142", companyPhoto: "", accessLevel: "project_executive" },
          { name: "Dana Whitfield", role: "Superintendent", trade: "Self-perform", company: "Meridian Builders", initials: "DW", color: "blue", email: "d.whitfield@meridian.co", phone: "(303) 555-0188", companyPhoto: "", accessLevel: "superintendent" },
          { name: "Priya Anand", role: "Project Manager", trade: "Management", company: "Meridian Builders", initials: "PA", color: "emerald", email: "p.anand@meridian.co", phone: "(303) 555-0173", companyPhoto: "", accessLevel: "project_manager" },
          { name: "Tom Bradshaw", role: "Foreman", trade: "Concrete", company: "Apex Concrete", initials: "TB", color: "violet", email: "tom@apexconcrete.com", phone: "(720) 555-0119", companyPhoto: "", accessLevel: "foreman" },
          { name: "Lucia Romano", role: "Foreman", trade: "Electrical", company: "Voltline Electric", initials: "LR", color: "rose", email: "lucia@voltline.com", phone: "(720) 555-0156", companyPhoto: "", accessLevel: "foreman" },
          { name: "Kenji Park", role: "Foreman", trade: "HVAC", company: "Summit Mechanical", initials: "KP", color: "cyan", email: "kenji@summitmech.com", phone: "(720) 555-0134", companyPhoto: "", accessLevel: "foreman" },
          { name: "Sara Okafor", role: "Foreman", trade: "Framing", company: "Northside Carpentry", initials: "SO", color: "orange", email: "sara@northsidecarp.com", phone: "(720) 555-0177", companyPhoto: "", accessLevel: "foreman" },
          { name: "Ben Caldwell", role: "QC Manager", trade: "Quality", company: "Meridian Builders", initials: "BC", color: "slate", email: "b.caldwell@meridian.co", phone: "(303) 555-0162", companyPhoto: "", accessLevel: "superintendent" }
        ];
        const t = team.map((x) => db.insert(teamMembers).values(x).returning().get());
        const projectsSeed = [
          { name: "Lakeside Medical Pavilion", number: "MB-2401", client: "Lakeside Health System", type: "Healthcare", status: "On Track", address: "1820 Healing Way, Denver, CO", startDate: "2025-09-02", endDate: "2026-12-18", budget: 485e5, spent: 213e5, progress: 44, superintendentId: t[1].id },
          { name: "Union Tower Office", number: "MB-2402", client: "Union Realty Partners", type: "Commercial", status: "At Risk", address: "440 Market St, Denver, CO", startDate: "2025-11-10", endDate: "2027-03-22", budget: 322e5, spent: 189e5, progress: 58, superintendentId: t[1].id },
          { name: "Riverside K-8 School", number: "MB-2403", client: "Denver Public Schools", type: "Education", status: "On Track", address: "705 River Bend Dr, Denver, CO", startDate: "2026-01-15", endDate: "2026-11-30", budget: 198e5, spent: 41e5, progress: 21, superintendentId: t[1].id },
          { name: "Highland Lofts", number: "MB-2404", client: "Highland Living LLC", type: "Residential", status: "Planning", address: "3200 Lowell Blvd, Denver, CO", startDate: "2026-08-01", endDate: "2027-09-14", budget: 124e5, spent: 32e4, progress: 4, superintendentId: t[1].id }
        ];
        const p = projectsSeed.map((x) => db.insert(projects).values(x).returning().get());
        const tasksSeed = [
          // Lakeside — 8 tasks, id sequence 1..8
          { projectId: p[0].id, title: "Site work & utilities", trade: "Civil", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2025-11-15", startDate: "2025-09-02", endDate: "2025-11-15", seq: 1, dependsOn: null },
          { projectId: p[0].id, title: "Foundations & slab", trade: "Concrete", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2026-01-20", startDate: "2025-11-20", endDate: "2026-01-30", seq: 2, dependsOn: "1" },
          { projectId: p[0].id, title: "Structural steel \u2014 L1-L3", trade: "Steel", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-04-15", startDate: "2026-02-02", endDate: "2026-04-30", seq: 3, dependsOn: "2" },
          { projectId: p[0].id, title: "Level 3 deck pour", trade: "Concrete", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-07-24", startDate: "2026-07-10", endDate: "2026-07-28", seq: 4, dependsOn: "3" },
          { projectId: p[0].id, title: "Electrical rough-in \u2014 ICU", trade: "Electrical", status: "Not Started", priority: "Medium", assigneeId: t[4].id, dueDate: "2026-08-02", startDate: "2026-07-25", endDate: "2026-08-20", seq: 5, dependsOn: "4" },
          { projectId: p[0].id, title: "HVAC duct install \u2014 L2", trade: "HVAC", status: "In Progress", priority: "Medium", assigneeId: t[5].id, dueDate: "2026-07-28", startDate: "2026-07-05", endDate: "2026-08-10", seq: 6, dependsOn: "3" },
          { projectId: p[0].id, title: "Curtainwall glazing", trade: "Glazing", status: "Blocked", priority: "High", assigneeId: null, dueDate: "2026-07-22", startDate: "2026-07-15", endDate: "2026-08-15", seq: 7, dependsOn: "3" },
          { projectId: p[0].id, title: "Framing \u2014 rooms 204-218", trade: "Framing", status: "In Progress", priority: "Low", assigneeId: t[6].id, dueDate: "2026-07-30", startDate: "2026-07-12", endDate: "2026-08-05", seq: 8, dependsOn: "4" }
        ];
        tasksSeed.forEach((x) => db.insert(tasks).values(x).run());
        const rfisSeed = [
          { projectId: p[0].id, number: "RFI-014", subject: "Clearance at med-gas panels \u2014 ICU", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-12", dueDate: "2026-07-23" },
          { projectId: p[0].id, number: "RFI-015", subject: "Curtainwall anchor detail revision", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-15", dueDate: "2026-07-21" },
          { projectId: p[0].id, number: "RFI-012", subject: "Slab opening for mechanical chase", status: "Answered", assigneeId: t[2].id, dateCreated: "2026-06-28", dueDate: "2026-07-10" },
          { projectId: p[1].id, number: "RFI-031", subject: "Cooling tower load path clarification", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-16", dueDate: "2026-07-22" },
          { projectId: p[1].id, number: "RFI-029", subject: "Fire-rated assembly at stair 2", status: "Draft", assigneeId: t[2].id, dateCreated: "2026-07-18", dueDate: "2026-07-25" },
          { projectId: p[2].id, number: "RFI-006", subject: "Storm detention vault location", status: "Open", assigneeId: t[2].id, dateCreated: "2026-07-14", dueDate: "2026-07-24" }
        ];
        rfisSeed.forEach((x) => db.insert(rfis).values(x).run());
        const subsSeed = [
          { projectId: p[0].id, number: "SUB-042", subject: "Curtainwall shop drawings", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-05-10", dueDate: "2026-05-24" },
          { projectId: p[0].id, number: "SUB-051", subject: "Med-gas piping \u2014 material certs", type: "Material", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-08", dueDate: "2026-07-22" },
          { projectId: p[0].id, number: "SUB-049", subject: "Structural steel connections", type: "Shop Drawing", status: "Revise", assigneeId: t[2].id, dateSubmitted: "2026-06-20", dueDate: "2026-07-05" },
          { projectId: p[1].id, number: "SUB-077", subject: "Cooling tower performance data", type: "Data", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-12", dueDate: "2026-07-26" },
          { projectId: p[2].id, number: "SUB-012", subject: "Storm detention vault precast", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-06-15", dueDate: "2026-06-29" }
        ];
        subsSeed.forEach((x) => db.insert(submittals).values(x).run());
        const coSeed = [
          { projectId: p[0].id, number: "CO-008", title: "Add 4th-floor terrace upgrade", status: "Approved", amount: 184e3, scheduleImpact: 5, dateIssued: "2026-06-12" },
          { projectId: p[0].id, number: "CO-011", title: "Med-gas manifold expansion", status: "Pending", amount: 96e3, scheduleImpact: 3, dateIssued: "2026-07-09" },
          { projectId: p[0].id, number: "CO-012", title: "Curtainwall IGU upgrade", status: "Pending", amount: 142e3, scheduleImpact: 0, dateIssued: "2026-07-15" },
          { projectId: p[1].id, number: "CO-021", title: "Cooling tower re-spec", status: "Pending", amount: 21e4, scheduleImpact: 7, dateIssued: "2026-07-17" },
          { projectId: p[1].id, number: "CO-019", title: "Lobby finish upgrade", status: "Approved", amount: 78e3, scheduleImpact: 0, dateIssued: "2026-06-28" }
        ];
        coSeed.forEach((x) => db.insert(changeOrders).values(x).run());
        const aiSeed = [
          { projectId: p[0].id, title: "Confirm med-gas inspector availability", owner: "Priya Anand", status: "Open", priority: "High", dueDate: "2026-07-24", source: "OAC Meeting" },
          { projectId: p[0].id, title: "Send updated framing plan to Northside", owner: "Dana Whitfield", status: "Open", priority: "Medium", dueDate: "2026-07-23", source: "OAC Meeting" },
          { projectId: p[0].id, title: "Owner signage approval", owner: "Marcus Reyes", status: "Open", priority: "Low", dueDate: "2026-07-30", source: "Owner Call" },
          { projectId: p[1].id, title: "Schedule rigging engineer site visit", owner: "Dana Whitfield", status: "Open", priority: "Critical", dueDate: "2026-07-25", source: "Safety Stand-down" },
          { projectId: p[2].id, title: "Coordinate utility tie-in with city", owner: "Priya Anand", status: "In Progress", priority: "High", dueDate: "2026-07-28", source: "Precon Meeting" }
        ];
        aiSeed.forEach((x) => db.insert(actionItems).values(x).run());
        const logsSeed = [
          { projectId: p[0].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 64, summary: "Level 3 deck formwork 80% set; electrical rough-in ongoing on Level 2; 3 concrete trucks delivered.", photos: null },
          { projectId: p[0].id, date: "2026-07-20", authorId: t[1].id, weather: "Sunny", temp: 91, crewCount: 58, summary: "Curtainwall framing on south elevation; HVAC duct install began on Level 2.", photos: null },
          { projectId: p[1].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 41, summary: "Drywall finishing Floor 9; crane lift delayed pending engineer sign-off on rigging plan.", photos: null },
          { projectId: p[2].id, date: "2026-07-21", authorId: t[1].id, weather: "Sunny", temp: 90, crewCount: 22, summary: "Site grading continued on east lot; storm line install 60% complete.", photos: null }
        ];
        logsSeed.forEach((l) => db.insert(dailyLogs).values(l).run());
        const punchSeed = [
          { projectId: p[0].id, title: "Touch up drywall at Room 112 corner", location: "Level 1, Rm 112", trade: "Drywall", status: "Open", assigneeId: t[6].id },
          { projectId: p[0].id, title: "Missing outlet cover plates \u2014 east corridor", location: "Level 1, Corridor E", trade: "Electrical", status: "Open", assigneeId: t[4].id },
          { projectId: p[0].id, title: "Caulk joint at storefront door", location: "Main lobby", trade: "Glazing", status: "In Progress", assigneeId: null },
          { projectId: p[1].id, title: "Paint touch-up stair 4 landings", location: "Stair 4", trade: "Painting", status: "Open", assigneeId: null },
          { projectId: p[1].id, title: "Replace scratched door \u2014 Fl. 7 unit 712", location: "Fl. 7, Unit 712", trade: "Doors", status: "Open", assigneeId: t[6].id },
          { projectId: p[2].id, title: "Re-grade swale at southeast corner", location: "Southeast lot", trade: "Civil", status: "In Progress", assigneeId: t[3].id }
        ];
        punchSeed.forEach((x) => db.insert(punchItems).values(x).run());
        const contactsSeed = [
          { name: "Dr. Helen Voss", company: "Lakeside Health System", role: "Owner Rep", trade: "Owner", type: "Owner", phone: "(303) 555-0142", email: "h.voss@lakesidehealth.org" },
          { name: "Raymond Soto", company: "Northwind Architects", role: "Lead Architect", trade: "Design", type: "Architect", phone: "(303) 555-0188", email: "rsoto@northwindarch.com" },
          { name: "Gloria Mendez", company: "Apex Concrete", trade: "Concrete", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0110", email: "gmendez@apexconcrete.com" },
          { name: "James Holloway", company: "Voltline Electric", trade: "Electrical", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0155", email: "jh@voltline.com" },
          { name: "Nadia Bauer", company: "Summit Mechanical", trade: "HVAC", role: "Subcontractor PM", type: "Subcontractor", phone: "(303) 555-0190", email: "nadia@summitmech.com" },
          { name: "Owen Castillo", company: "City of Denver", role: "Building Inspector", trade: "Permitting", type: "Authority", phone: "(720) 555-0177", email: "ocastillo@denvergov.org" },
          { name: "Union Realty Partners", company: "Union Realty Partners", role: "Owner", trade: "Owner", type: "Owner", phone: "(303) 555-0201", email: "pm@unionrealty.com" }
        ];
        contactsSeed.forEach((x) => db.insert(contacts).values(x).run());
        const eqSeed = [
          { name: "Link-Belt 80T Crane #1", type: "Crane", status: "On Site", projectId: p[0].id, operator: "T. Bradshaw", location: "North pad" },
          { name: "CAT 336 Excavator", type: "Excavator", status: "On Site", projectId: p[0].id, operator: "Rental", location: "East excavation" },
          { name: "Bobcat S650 Skid Steer", type: "Skid Steer", status: "On Site", projectId: p[2].id, operator: "Crew B", location: "East lot" },
          { name: "Genie S-105 Boom Lift", type: "Lift", status: "In Maintenance", projectId: p[0].id, operator: "\u2014", location: "Yard" },
          { name: "Tower Crane TC-60", type: "Crane", status: "On Site", projectId: p[1].id, operator: "Crane Co.", location: "Core" },
          { name: "Concrete Pump 52m", type: "Pump", status: "Off Site", projectId: null, operator: "Rental", location: "Return 7/24" }
        ];
        eqSeed.forEach((x) => db.insert(equipment).values(x).run());
        const PHOTO_DIR2 = process.env.VERCEL ? "/tmp/uploads/photos" : (0, import_node_path.resolve)(process.cwd(), "uploads/photos");
        try {
          (0, import_node_fs.mkdirSync)(PHOTO_DIR2, { recursive: true });
        } catch {
        }
        const seedPhotoCandidates = [
          (0, import_node_path.resolve)(process.cwd(), "server/seed-photos"),
          (0, import_node_path.resolve)(process.cwd(), "seed-photos"),
          (0, import_node_path.resolve)(__dirname, "seed-photos"),
          (0, import_node_path.resolve)(__dirname, "../server/seed-photos")
        ];
        let seedPhotoDir = null;
        for (const c of seedPhotoCandidates) {
          if ((0, import_node_fs.existsSync)(c)) {
            seedPhotoDir = c;
            break;
          }
        }
        const copySeedPhoto = (name) => {
          if (!seedPhotoDir) return null;
          const src = (0, import_node_path.join)(seedPhotoDir, name);
          if (!(0, import_node_fs.existsSync)(src)) return null;
          const dst = (0, import_node_path.join)(PHOTO_DIR2, name);
          try {
            if (!(0, import_node_fs.existsSync)(dst)) (0, import_node_fs.copyFileSync)(src, dst);
          } catch {
          }
          let size = 0;
          try {
            const fs2 = require("node:fs");
            size = fs2.statSync(dst).size;
          } catch {
          }
          return { storedFileName: name, mimeType: "image/jpeg", fileSizeBytes: size };
        };
        const photoFileMap = {
          "Level 3 deck formwork \u2014 looking north": "photo-deck-formwork.jpg",
          "Curtainwall frame at south elevation": "photo-curtainwall.jpg",
          "Electrical rough-in \u2014 ICU wing": "photo-electrical.jpg",
          "Drywall finish \u2014 Floor 9": "photo-drywall.jpg",
          "Storm line trench \u2014 east lot": "photo-stormline.jpg"
        };
        const photoSeed = [
          { projectId: p[0].id, caption: "Level 3 deck formwork \u2014 looking north", location: "L3, grid F", takenById: t[1].id, date: "2026-07-21", hue: 210, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
          { projectId: p[0].id, caption: "Curtainwall frame at south elevation", location: "South facade", takenById: t[1].id, date: "2026-07-20", hue: 28, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
          { projectId: p[0].id, caption: "Electrical rough-in \u2014 ICU wing", location: "L2, ICU", takenById: t[4].id, date: "2026-07-19", hue: 260, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
          { projectId: p[1].id, caption: "Drywall finish \u2014 Floor 9", location: "Fl. 9", takenById: t[6].id, date: "2026-07-21", hue: 140, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null },
          { projectId: p[2].id, caption: "Storm line trench \u2014 east lot", location: "East lot", takenById: t[3].id, date: "2026-07-21", hue: 190, storedFileName: null, originalFileName: null, mimeType: null, fileSizeBytes: null }
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
        const docSeed = [
          { projectId: p[0].id, name: "A-101 Floor Plans \u2014 Rev C.pdf", type: "Drawing", size: "8.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
          { projectId: p[0].id, name: "Structural Notes \u2014 S-001.pdf", type: "Drawing", size: "3.1 MB", uploadedById: t[2].id, date: "2026-07-01" },
          { projectId: p[0].id, name: "Owner-Architect Agreement.pdf", type: "Contract", size: "1.2 MB", uploadedById: t[0].id, date: "2025-08-20" },
          { projectId: p[0].id, name: "Building Permit \u2014 BLD-2026-0441.pdf", type: "Permit", size: "0.6 MB", uploadedById: t[2].id, date: "2025-08-28" },
          { projectId: p[1].id, name: "Cooling Tower Submittal Log.xlsx", type: "Spec", size: "0.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
          { projectId: p[2].id, name: "Site Civil \u2014 Demolition Plan.pdf", type: "Drawing", size: "5.7 MB", uploadedById: t[2].id, date: "2026-06-30" }
        ];
        docSeed.forEach((x) => db.insert(documents).values(x).run());
        const bpSeed = [
          { projectId: p[0].id, sheetNumber: "A-101", title: "Floor Plans \u2014 Level 1", discipline: "Architectural", revision: "Rev C", status: "Current", uploadedById: t[2].id, date: "2026-07-12", hue: 210 },
          { projectId: p[0].id, sheetNumber: "A-201", title: "Reflected Ceiling Plans", discipline: "Architectural", revision: "Rev B", status: "Current", uploadedById: t[2].id, date: "2026-07-10", hue: 200 },
          { projectId: p[0].id, sheetNumber: "S-100", title: "Structural Foundation Plan", discipline: "Structural", revision: "Rev C", status: "Current", uploadedById: t[2].id, date: "2026-06-28", hue: 28 },
          { projectId: p[0].id, sheetNumber: "S-301", title: "Level 3 Framing Plan", discipline: "Structural", revision: "Rev A", status: "Under Review", uploadedById: t[2].id, date: "2026-07-15", hue: 18 },
          { projectId: p[0].id, sheetNumber: "M-101", title: "Mechanical \u2014 Air Distribution", discipline: "Mechanical", revision: "Rev B", status: "Current", uploadedById: t[4].id, date: "2026-07-05", hue: 190 },
          { projectId: p[0].id, sheetNumber: "E-201", title: "Power & Lighting \u2014 L2", discipline: "Electrical", revision: "Rev A", status: "Superseded", uploadedById: t[4].id, date: "2026-06-20", hue: 260 },
          { projectId: p[0].id, sheetNumber: "C-100", title: "Site Demolition Plan", discipline: "Civil", revision: "Rev B", status: "Current", uploadedById: t[3].id, date: "2026-06-30", hue: 140 },
          { projectId: p[1].id, sheetNumber: "A-301", title: "Interior Elevations \u2014 Fl. 9", discipline: "Architectural", revision: "Rev C", status: "Current", uploadedById: t[6].id, date: "2026-07-18", hue: 330 }
        ];
        bpSeed.forEach((x) => db.insert(blueprints).values(x).run());
        const droneSeed = [
          { projectId: p[0].id, title: "Site orthomosaic \u2014 full parcel", captureType: "Orthomosaic", pilot: "AeroVision UAV", flightDate: "2026-07-21", altitude: "200 ft", area: "14.6 acres", status: "Processed", hue: 190 },
          { projectId: p[0].id, title: "Progress \u2014 south elevation curtainwall", captureType: "Progress Photo", pilot: "AeroVision UAV", flightDate: "2026-07-21", altitude: "120 ft", area: "0.8 acres", status: "Processed", hue: 28 },
          { projectId: p[0].id, title: "Stockpile volume survey \u2014 north yard", captureType: "Topo Survey", pilot: "In-house (T. Bradshaw)", flightDate: "2026-07-19", altitude: "150 ft", area: "2.1 acres", status: "Processed", hue: 140 },
          { projectId: p[0].id, title: "Thermal scan \u2014 roof membrane", captureType: "Thermal", pilot: "AeroVision UAV", flightDate: "2026-07-18", altitude: "100 ft", area: "0.9 acres", status: "In Review", hue: 8 },
          { projectId: p[0].id, title: "3D mesh \u2014 core + L1\u2013L3", captureType: "3D Model", pilot: "AeroVision UAV", flightDate: "2026-07-17", altitude: "180 ft", area: "3.4 acres", status: "Processed", hue: 260 },
          { projectId: p[0].id, title: "Weekly progress orbit \u2014 scheduled", captureType: "Progress Photo", pilot: "AeroVision UAV", flightDate: "2026-07-28", altitude: "150 ft", area: "14.6 acres", status: "Scheduled", hue: 210 },
          { projectId: p[1].id, title: "Roof progress \u2014 Fl. 9 topping", captureType: "Progress Photo", pilot: "In-house (M. Diaz)", flightDate: "2026-07-20", altitude: "120 ft", area: "0.5 acres", status: "Processed", hue: 330 },
          { projectId: p[2].id, title: "Civil topo \u2014 east lot grading", captureType: "Topo Survey", pilot: "AeroVision UAV", flightDate: "2026-07-16", altitude: "200 ft", area: "6.2 acres", status: "Processed", hue: 90 }
        ];
        droneSeed.forEach((x) => db.insert(droneCaptures).values(x).run());
        const msgSeed = [
          { projectId: p[0].id, authorId: t[1].id, body: "Deck pour for Level 3 is on for Friday \u2014 need 3 trucks at 7am. Confirm barricades are reset by Thursday EOD.", createdAt: "2026-07-21T08:12:00" },
          { projectId: p[0].id, authorId: t[4].id, body: "Understood. Voltline will be clear of the pour area by 6pm Thursday. Med-gas rough-in on L2 is separate and unaffected.", createdAt: "2026-07-21T08:24:00" },
          { projectId: p[0].id, authorId: t[2].id, body: "Owner asked for updated progress photos of the curtainwall \u2014 I'll pull from the photo log and send the deck by 3pm.", createdAt: "2026-07-21T09:02:00" },
          { projectId: p[0].id, authorId: t[0].id, body: "Good. Let's also flag the glazing RFI status in tomorrow's OAC. It's the one holding the south elevation.", createdAt: "2026-07-21T09:15:00" }
        ];
        msgSeed.forEach((x) => db.insert(messages).values(x).run());
        const noteSeed = [
          { projectId: p[0].id, body: "Concrete pour Friday 7am \u2014 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40 },
          { projectId: p[0].id, body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90 },
          { projectId: p[0].id, body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50 },
          { projectId: p[0].id, body: "Inspector confirmed for med-gas \u2014 keep L2 ICU clear.", color: "emerald", x: 120, y: 220 }
        ];
        noteSeed.forEach((x) => db.insert(notes).values(x).run());
        const milestoneSeed = [
          // Lakeside Medical Pavilion
          { projectId: p[0].id, title: "Building permit issued", date: "2025-08-20", kind: "Permit", status: "Complete", notes: "City of Denver \u2014 approved on first submission" },
          { projectId: p[0].id, title: "Foundation complete", date: "2026-02-05", kind: "Foundation", status: "Complete", notes: null },
          { projectId: p[0].id, title: "Structural topout \u2014 L3", date: "2026-05-08", kind: "Structure", status: "Complete", notes: null },
          { projectId: p[0].id, title: "Curtainwall dry-in", date: "2026-08-20", kind: "Envelope", status: "At Risk", notes: "RFI-015 blocking south elevation glazing" },
          { projectId: p[0].id, title: "MEP rough-in complete", date: "2026-10-15", kind: "MEP", status: "Upcoming", notes: null },
          { projectId: p[0].id, title: "TCO \u2014 Temporary Cert. of Occupancy", date: "2026-11-30", kind: "TCO", status: "Upcoming", notes: null },
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
          { projectId: p[2].id, title: "Substantial completion \u2014 ready for school year", date: "2026-11-30", kind: "Closeout", status: "Upcoming", notes: "Must be turned over before Aug 2027 school year" }
        ];
        milestoneSeed.forEach((x) => db.insert(milestones).values(x).run());
        try {
          const anyAccount = db.select().from(accounts).all();
          if (anyAccount.length === 0) {
            this.createAccount(
              "demo@trusspath.app",
              "trusspath",
              "Marcus Reyes",
              "Meridian Builders",
              "owner"
            );
          }
        } catch {
        }
      }
    };
    storage = new DatabaseStorage();
  }
});

// shared/app-manifest.ts
function hrefMatchesRoute(href, pattern) {
  if (pattern === href) return true;
  const seg = pattern.split("/");
  const h = href.split("/");
  if (seg.length !== h.length) return false;
  return seg.every((s, i) => s.startsWith(":") || s === h[i]);
}
function isKnownRoute(href) {
  return APP_ROUTES.some((p) => hrefMatchesRoute(href, p));
}
var APP_ROUTES, APP_NAV, LANDING_FEATURE_LINKS, APP_LINKS;
var init_app_manifest = __esm({
  "shared/app-manifest.ts"() {
    "use strict";
    APP_ROUTES = [
      "/",
      "/app",
      "/projects",
      "/projects/:id",
      "/schedule",
      "/gantt",
      "/integrations",
      "/tasks",
      "/action-items",
      "/rfis",
      "/submittals",
      "/change-orders",
      "/punch",
      "/daily-logs",
      "/photos",
      "/documents",
      "/blueprints",
      "/equipment",
      "/drone",
      "/team",
      "/contacts",
      "/messages",
      "/notes",
      "/settings"
    ];
    APP_NAV = [
      {
        title: "Overview",
        items: [
          { href: "/app", label: "Dashboard", icon: "LayoutDashboard" },
          { href: "/notes", label: "Sticky Board", icon: "StickyNote" }
        ]
      },
      {
        title: "Planning",
        items: [
          { href: "/projects", label: "Projects", icon: "FolderKanban" },
          { href: "/schedule", label: "Schedule", icon: "CalendarRange" },
          { href: "/gantt", label: "Gantt", icon: "GanttChartSquare" }
        ]
      },
      {
        title: "Workflows",
        items: [
          { href: "/tasks", label: "Tasks", icon: "ListChecks" },
          { href: "/action-items", label: "Action Items", icon: "CheckSquare" },
          { href: "/rfis", label: "RFIs", icon: "HelpCircle" },
          { href: "/submittals", label: "Submittals", icon: "FileStack" },
          { href: "/change-orders", label: "Change Orders", icon: "GitPullRequestArrow" },
          { href: "/punch", label: "Punch List", icon: "CheckSquare" }
        ]
      },
      {
        title: "Field",
        items: [
          { href: "/daily-logs", label: "Daily Logs", icon: "ClipboardList" },
          { href: "/photos", label: "Photo Log", icon: "Image" },
          { href: "/documents", label: "Documents", icon: "FileText" },
          { href: "/blueprints", label: "Blueprints", icon: "PencilRuler" },
          { href: "/equipment", label: "Fleet & Equipment", icon: "Wrench" }
        ]
      },
      {
        title: "Add-ons",
        items: [
          { href: "/drone", label: "Drone Captures", icon: "Plane" }
        ]
      },
      {
        title: "People",
        items: [
          { href: "/team", label: "Team", icon: "Users" },
          { href: "/contacts", label: "Contacts", icon: "Contact" },
          { href: "/messages", label: "Messages", icon: "MessageSquare" }
        ]
      },
      {
        title: "System",
        items: [
          { href: "/integrations", label: "Integrations", icon: "Plug" },
          { href: "/settings", label: "Settings", icon: "Settings" }
        ]
      }
    ];
    LANDING_FEATURE_LINKS = [
      { label: "Daily Logs", href: "/daily-logs" },
      { label: "RFIs & Submittals", href: "/rfis" },
      { label: "Change Orders", href: "/change-orders" },
      { label: "Punch Lists", href: "/punch" },
      { label: "Schedule + Gantt", href: "/schedule" },
      { label: "Photo Log", href: "/photos" },
      { label: "Blueprints", href: "/blueprints" },
      { label: "Drone Captures", href: "/drone" },
      { label: "Fleet & Equipment", href: "/equipment" },
      { label: "Documents", href: "/documents" },
      { label: "Messages & Notes", href: "/messages" },
      { label: "Jarvis AI", href: "/app" }
    ];
    APP_LINKS = [
      ...APP_NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, source: "nav" }))),
      ...LANDING_FEATURE_LINKS.map((f) => ({ href: f.href, label: f.label, source: "landing" }))
    ];
  }
});

// server/health.ts
function runHealthScan() {
  const brokenLinks = APP_LINKS.filter((l) => !isKnownRoute(l.href)).map((l) => ({ href: l.href, label: l.label, source: l.source }));
  const pid2 = storage.getProjects()[0]?.id;
  const mods = [
    ["Projects", () => storage.getProjects()],
    ["Tasks", () => storage.getTasks(pid2)],
    ["RFIs", () => storage.getRfis(pid2)],
    ["Submittals", () => storage.getSubmittals(pid2)],
    ["Change Orders", () => storage.getChangeOrders(pid2)],
    ["Action Items", () => storage.getActionItems(pid2)],
    ["Daily Logs", () => storage.getDailyLogs(pid2)],
    ["Punch Items", () => storage.getPunchItems(pid2)],
    ["Team", () => storage.getTeam()],
    ["Contacts", () => storage.getContacts()],
    ["Equipment", () => storage.getEquipment(pid2)],
    ["Photos", () => storage.getPhotos(pid2)],
    ["Documents", () => storage.getDocuments(pid2)],
    ["Blueprints", () => storage.getBlueprints(pid2)],
    ["Drone Captures", () => storage.getDroneCaptures(pid2)],
    ["Messages", () => pid2 ? storage.getMessages(pid2) : []],
    ["Notes", () => storage.getNotes(pid2)],
    ["Integrations", () => storage.getIntegrations()]
  ];
  const moduleChecks = mods.map(([name, fn]) => {
    try {
      const rows = fn();
      return { name, status: "ok", detail: `${rows.length} records` };
    } catch (e) {
      return { name, status: "fail", detail: e?.message ?? "error reading module" };
    }
  });
  const failedModules = moduleChecks.filter((c) => c.status === "fail");
  const ok = brokenLinks.length === 0 && failedModules.length === 0;
  const summary = ok ? `All clear, sir. ${moduleChecks.length} modules healthy, ${APP_LINKS.length} links resolve to ${APP_ROUTES.length} registered routes \u2014 no broken items detected.` : `Found ${brokenLinks.length} broken link(s) and ${failedModules.length} failing module(s). Details below.`;
  return {
    scannedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ok,
    brokenLinks,
    moduleChecks,
    routeCount: APP_ROUTES.length,
    linkCount: APP_LINKS.length,
    summary
  };
}
var init_health = __esm({
  "server/health.ts"() {
    "use strict";
    init_storage();
    init_app_manifest();
  }
});

// server/jarvis.ts
function buildPersona(s = {}) {
  const term = s.addressTerm?.trim() || "sir";
  const tone = s.tone === "detailed" ? "detailed" : "concise";
  const length = tone === "detailed" ? "You may go into more depth when it helps, but stay organized." : "Keep answers short unless asked for detail.";
  return `You are JARVIS, the AI site assistant for TrussPath, a field construction project management platform.
Adopt the persona of a poised, British AI steward: unfailingly polite, concise, proactive, and precise.
Address the user as "${term}". Never use filler words. Prefer crisp short bullet points for lists. Light British phrasing is welcome but keep it professional and construction-literate.
You have live read-only access to the project's data (tasks, RFIs, submittals, change orders, action items, team). Use it to give accurate, actionable answers.
You cannot write data yourself. When the user asks to create or change something, tell them exactly what to do and which tab to use, and offer to draft the wording.
You can run an APP HEALTH SCAN to find broken links or non-working modules. When the user asks about broken links, app health, what's broken, or what doesn't work, use the supplied scan results to answer concretely.
${length}`;
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function isOpen(status) {
  const s = (status || "").toLowerCase();
  return !["complete", "completed", "closed", "approved", "done"].includes(s);
}
function overdue(arr, field) {
  const t = today();
  return arr.filter((x) => x[field] && x[field] < t && isOpen(x.status));
}
function dueToday(arr, field) {
  const t = today();
  return arr.filter((x) => x[field] === t);
}
function buildContext(projectId) {
  const p = projectId ? storage.getProject(projectId) : storage.getProjects()[0];
  const pid2 = p?.id;
  const tasks2 = storage.getTasks(pid2);
  const rfis2 = storage.getRfis(pid2);
  const subs = storage.getSubmittals(pid2);
  const cos = storage.getChangeOrders(pid2);
  const actions = storage.getActionItems(pid2);
  const team = storage.getTeam();
  const L = (arr, label, field) => {
    const ov = overdue(arr, field).slice(0, 6);
    const dt = dueToday(arr, field).slice(0, 6);
    const open = arr.filter((x) => isOpen(x.status)).length;
    const lines = [];
    lines.push(`${label}: ${arr.length} total, ${open} open, ${overdue(arr, field).length} overdue, ${dueToday(arr, field).length} due today`);
    if (ov.length) lines.push("  OVERDUE: " + ov.map((x) => `${x.number || ""} ${x.title || x.subject || ""}`.trim()).join(" | "));
    if (dt.length) lines.push("  DUE TODAY: " + dt.map((x) => `${x.number || ""} ${x.title || x.subject || ""}`.trim()).join(" | "));
    return lines.join("\n");
  };
  const blocks = [
    `PROJECT: ${p?.name ?? "\u2014"} | status ${p?.status ?? "\u2014"} | ${p?.startDate ?? "?"} \u2192 ${p?.endDate ?? "?"}`,
    `TODAY: ${today()}`,
    L(tasks2, "TASKS", "dueDate"),
    L(rfis2, "RFIS", "dueDate"),
    L(subs, "SUBMITTALS", "dueDate"),
    L(cos, "CHANGE ORDERS", "dateIssued"),
    L(actions, "ACTION ITEMS", "dueDate"),
    `TEAM: ${team.length} members (${team.slice(0, 8).map((m) => `${m.name} (${m.role})`).join(", ")})`
  ];
  return { compact: blocks.join("\n"), projectName: p?.name };
}
function formatScan(r) {
  const lines = [
    `APP HEALTH SCAN \u2014 ${r.ok ? "PASS" : "ISSUES FOUND"}`,
    `${r.linkCount} links checked against ${r.routeCount} registered routes; ${r.brokenLinks.length} broken.`,
    `${r.moduleChecks.length} modules scanned; ${r.moduleChecks.filter((c) => c.status === "fail").length} failing.`
  ];
  if (r.brokenLinks.length) lines.push("BROKEN LINKS: " + r.brokenLinks.map((l) => `${l.label} -> ${l.href} (${l.source})`).join(" | "));
  const failing = r.moduleChecks.filter((c) => c.status === "fail");
  if (failing.length) lines.push("FAILING MODULES: " + failing.map((c) => `${c.name} (${c.detail})`).join(" | "));
  return lines.join("\n");
}
async function jarvisChat(projectId, history) {
  const { compact } = buildContext(projectId);
  const settings = storage.getSettings();
  const persona = buildPersona(settings);
  const client = new import_openai.default();
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const scanBlock = HEALTH_INTENT.test(lastUser) ? `

--- APP HEALTH SCAN (live) ---
${formatScan(runHealthScan())}` : "";
  const resp = await client.responses.create({
    model: MODEL,
    instructions: `${persona}

--- LIVE PROJECT DATA ---
${compact}${scanBlock}`,
    input: history.map((m) => ({ role: m.role, content: m.content }))
  });
  return { reply: resp.output_text ?? "" };
}
async function jarvisBrief(projectId) {
  const context = buildContext(projectId);
  const settings = storage.getSettings();
  const persona = buildPersona(settings);
  const client = new import_openai.default();
  const resp = await client.responses.create({
    model: MODEL,
    instructions: persona,
    input: `Produce a crisp MORNING BRIEFING for today using the live project data below.
Structure: (1) a one-line greeting, (2) "Priorities" \u2014 the 2-3 most urgent items today, (3) "Overdue" \u2014 what slipped, (4) one proactive recommendation.
Keep it under ~160 words. Use short bullets. Do not invent items not in the data.

--- LIVE PROJECT DATA ---
${context.compact}`
  });
  return { brief: resp.output_text ?? "", context };
}
var import_openai, MODEL, HEALTH_INTENT;
var init_jarvis = __esm({
  "server/jarvis.ts"() {
    "use strict";
    import_openai = __toESM(require("openai"), 1);
    init_storage();
    init_health();
    MODEL = "gpt_5_1";
    HEALTH_INTENT = /\b(broken|health|scan|not work|doesn'?t work|don'?t work|broken link|issues? in the app|what'?s broken|integrity)\b/i;
  }
});

// server/mailer.ts
function renderHtml(n) {
  const rows = Object.entries(n.fields).filter(([, v]) => v !== void 0 && v !== null && String(v).trim() !== "").map(
    ([k, v]) => `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(
      k
    )}</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(String(v))}</td></tr>`
  ).join("");
  const kindLabel = n.kind === "subscriber" ? "New TrussPath subscriber" : "New TrussPath demo request";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(kindLabel)}</div>
    <table style="width:100%;border-collapse:collapse;margin:12px 0;">${rows}</table>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">Sent by trusspath-field-pm.vercel.app</div>
  </div>
</body></html>`;
}
function renderText(n) {
  const rows = Object.entries(n.fields).filter(([, v]) => v !== void 0 && v !== null && String(v).trim() !== "").map(([k, v]) => `${k}: ${v}`).join("\n");
  return `${n.subject}

${rows}
`;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
async function sendSignupNotification(n) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.SIGNUP_NOTIFY_TO || DEFAULT_TO;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;
  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set \u2014 skipping email for ${n.kind}. Would send to ${to}.`);
    return { ok: true, skipped: true };
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: n.subject,
        html: renderHtml(n),
        text: renderText(n)
      })
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[mailer] Resend ${resp.status}: ${body}`);
      return { ok: false, error: `Resend ${resp.status}` };
    }
    const data = await resp.json().catch(() => ({}));
    console.log(`[mailer] Sent ${n.kind} notification to ${to} (id=${data.id ?? "?"})`);
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("[mailer] Send failed:", err);
    return { ok: false, error: String(err) };
  }
}
var DEFAULT_TO, DEFAULT_FROM;
var init_mailer = __esm({
  "server/mailer.ts"() {
    "use strict";
    DEFAULT_TO = "houston.sean90@gmail.com";
    DEFAULT_FROM = "TrussPath <onboarding@resend.dev>";
  }
});

// server/routes.ts
var routes_exports = {};
__export(routes_exports, {
  registerRoutes: () => registerRoutes
});
function pid(req) {
  return req.query.projectId ? parseInt(req.query.projectId, 10) : void 0;
}
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(/;\s*/)) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    if (k) out[k] = v;
  }
  return out;
}
function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = isProd ? "None" : "Lax";
  const secure = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${SESSION_MAX_AGE_SEC}${secure}`
  );
}
function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = isProd ? "None" : "Lax";
  const secure = isProd ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secure}`
  );
}
function authMiddleware(req, res, next) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (PUBLIC_API.has(p)) return next();
  const cookies = parseCookies(req.headers?.cookie);
  const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = cookies[SESSION_COOKIE] || bearer || queryToken;
  const s = token ? storage.getSession(token) : null;
  if (!s) return res.status(401).json({ message: "Unauthorized" });
  req.account = s.account;
  req.sessionToken = token;
  next();
}
function hydrateSeedPhotos() {
  if (photoHydrated) return;
  const candidates = [
    import_node_path2.default.resolve(process.cwd(), "seed-photos"),
    import_node_path2.default.resolve(process.cwd(), "server/seed-photos"),
    import_node_path2.default.resolve(__dirname, "seed-photos"),
    import_node_path2.default.resolve(__dirname, "../seed-photos"),
    import_node_path2.default.resolve(__dirname, "../server/seed-photos")
  ];
  let src = null;
  for (const c of candidates) {
    if (import_node_fs2.default.existsSync(c)) {
      src = c;
      break;
    }
  }
  if (!src) {
    photoHydrated = true;
    return;
  }
  try {
    const files = import_node_fs2.default.readdirSync(src);
    for (const f of files) {
      const dst = import_node_path2.default.join(PHOTO_DIR, f);
      if (!import_node_fs2.default.existsSync(dst)) {
        try {
          import_node_fs2.default.copyFileSync(import_node_path2.default.join(src, f), dst);
        } catch {
        }
      }
    }
  } catch {
  }
  photoHydrated = true;
}
async function registerRoutes(_httpServer, app2) {
  const ALLOWED_ORIGIN_SUFFIXES = [
    ".pplx.app",
    ".vercel.app",
    ".perplexity.ai"
  ];
  app2.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      let allowed = false;
      try {
        const host = new URL(origin).hostname;
        allowed = host === "localhost" || host === "127.0.0.1" || ALLOWED_ORIGIN_SUFFIXES.some((suf) => host === suf.slice(1) || host.endsWith(suf));
      } catch {
      }
      if (allowed) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader(
          "Access-Control-Allow-Methods",
          "GET,POST,PATCH,PUT,DELETE,OPTIONS"
        );
        res.setHeader(
          "Access-Control-Allow-Headers",
          req.headers["access-control-request-headers"] || "Content-Type, Authorization"
        );
        res.setHeader("Access-Control-Max-Age", "600");
      }
    }
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
  app2.use(authMiddleware);
  app2.post("/api/auth/signup", (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password, displayName, company } = parsed.data;
    try {
      const account = storage.createAccount(email, password, displayName, company);
      const session = storage.createSession(account.id);
      setSessionCookie(res, session.id);
      res.status(201).json({ account, token: session.id });
    } catch (e) {
      const msg = e?.message || "Signup failed";
      const status = /already/i.test(msg) ? 409 : 500;
      res.status(status).json({ message: msg });
    }
  });
  app2.post("/api/auth/login", (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password } = parsed.data;
    const account = storage.verifyPassword(email, password);
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    const session = storage.createSession(account.id);
    setSessionCookie(res, session.id);
    res.json({ account, token: session.id });
  });
  app2.post("/api/auth/logout", (req, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) storage.destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app2.get("/api/auth/me", (req, res) => {
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? storage.getSession(token) : null;
    if (!s) return res.status(401).json({ account: null });
    res.json({ account: s.account });
  });
  app2.get("/api/team", (_req, res) => res.json(storage.getTeam()));
  app2.post("/api/team", (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createTeamMember(parsed.data));
  });
  app2.patch("/api/team/:id", (req, res) => {
    const parsed = insertTeamSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateTeamMember(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Team member not found" });
    res.json(updated);
  });
  app2.delete("/api/team/:id", (req, res) => {
    storage.deleteTeamMember(parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/projects", (_req, res) => res.json(storage.getProjects()));
  app2.get("/api/projects/:id", (req, res) => {
    const project = storage.getProject(parseInt(req.params.id, 10));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });
  app2.post("/api/projects", (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createProject(parsed.data));
  });
  app2.get("/api/tasks", (req, res) => res.json(storage.getTasks(pid(req))));
  app2.post("/api/tasks", (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createTask(parsed.data));
  });
  app2.patch("/api/tasks/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateTaskStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });
  app2.get("/api/rfis", (req, res) => res.json(storage.getRfis(pid(req))));
  app2.post("/api/rfis", (req, res) => {
    const parsed = insertRfiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createRfi(parsed.data));
  });
  app2.patch("/api/rfis/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateRfiStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "RFI not found" });
    res.json(updated);
  });
  app2.get("/api/submittals", (req, res) => res.json(storage.getSubmittals(pid(req))));
  app2.post("/api/submittals", (req, res) => {
    const parsed = insertSubmittalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createSubmittal(parsed.data));
  });
  app2.patch("/api/submittals/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateSubmittalStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Submittal not found" });
    res.json(updated);
  });
  app2.get("/api/change-orders", (req, res) => res.json(storage.getChangeOrders(pid(req))));
  app2.post("/api/change-orders", (req, res) => {
    const parsed = insertChangeOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createChangeOrder(parsed.data));
  });
  app2.patch("/api/change-orders/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateChangeOrderStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Change order not found" });
    res.json(updated);
  });
  app2.get("/api/action-items", (req, res) => res.json(storage.getActionItems(pid(req))));
  app2.post("/api/action-items", (req, res) => {
    const parsed = insertActionItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createActionItem(parsed.data));
  });
  app2.patch("/api/action-items/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updateActionItemStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Action item not found" });
    res.json(updated);
  });
  app2.get("/api/daily-logs", (req, res) => res.json(storage.getDailyLogs(pid(req))));
  app2.post("/api/daily-logs", (req, res) => {
    const parsed = insertDailyLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDailyLog(parsed.data));
  });
  app2.patch("/api/daily-logs/:id", (req, res) => {
    const parsed = insertDailyLogSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateDailyLog(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Daily log not found" });
    res.json(updated);
  });
  app2.delete("/api/daily-logs/:id", (req, res) => {
    storage.deleteDailyLog(parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/punch", (req, res) => res.json(storage.getPunchItems(pid(req))));
  app2.post("/api/punch", (req, res) => {
    const parsed = insertPunchItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createPunchItem(parsed.data));
  });
  app2.patch("/api/punch/:id/status", (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = storage.updatePunchStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Punch item not found" });
    res.json(updated);
  });
  app2.get("/api/contacts", (_req, res) => res.json(storage.getContacts()));
  app2.post("/api/contacts", (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createContact(parsed.data));
  });
  app2.patch("/api/contacts/:id", (req, res) => {
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = storage.updateContact(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Contact not found" });
    res.json(updated);
  });
  app2.delete("/api/contacts/:id", (req, res) => {
    storage.deleteContact(parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/equipment", (req, res) => res.json(storage.getEquipment(pid(req))));
  app2.post("/api/equipment", (req, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createEquipment(parsed.data));
  });
  app2.get("/api/photos", (req, res) => res.json(storage.getPhotos(pid(req))));
  app2.post("/api/photos", (req, res) => {
    const parsed = insertPhotoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createPhoto(parsed.data));
  });
  app2.post("/api/photos/upload", photoUpload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const takenById = req.body.takenById ? parseInt(req.body.takenById, 10) : void 0;
    const caption = req.body.caption ? String(req.body.caption) : file.originalname;
    const location = req.body.location ? String(req.body.location) : "";
    const date = req.body.date ? String(req.body.date) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = storage.createPhoto({
      projectId,
      caption,
      location,
      takenById: Number.isFinite(takenById) ? takenById : void 0,
      date,
      hue,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size
    });
    res.status(201).json(created);
  });
  app2.get("/api/photos/:id/file", (req, res) => {
    hydrateSeedPhotos();
    const photo = storage.getPhoto(parseInt(req.params.id, 10));
    if (!photo) return res.status(404).json({ message: "Photo not found." });
    if (!photo.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = import_node_path2.default.resolve(PHOTO_DIR, photo.storedFileName);
    if (!abs.startsWith(PHOTO_DIR + import_node_path2.default.sep) || !import_node_fs2.default.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", photo.mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${photo.originalFileName || photo.storedFileName}"`);
    import_node_fs2.default.createReadStream(abs).pipe(res);
  });
  app2.delete("/api/photos/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const photo = storage.getPhoto(id);
    if (photo?.storedFileName) {
      const abs = import_node_path2.default.resolve(PHOTO_DIR, photo.storedFileName);
      if (abs.startsWith(PHOTO_DIR + import_node_path2.default.sep)) {
        try {
          import_node_fs2.default.unlinkSync(abs);
        } catch {
        }
      }
    }
    storage.deletePhoto(id);
    res.status(204).end();
  });
  app2.get("/api/documents", (req, res) => res.json(storage.getDocuments(pid(req))));
  app2.post("/api/documents", (req, res) => {
    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDocument(parsed.data));
  });
  app2.post("/api/documents/upload", upload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : void 0;
    const name = req.body.name ? String(req.body.name) : file.originalname;
    const type = req.body.type ? String(req.body.type) : "Drawing";
    const date = req.body.date ? String(req.body.date) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const created = storage.createDocument({
      projectId,
      name,
      type,
      size: req.body.size ? String(req.body.size) : file.size < 1024 * 1024 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      uploadedById,
      date,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size
    });
    res.status(201).json(created);
  });
  app2.get("/api/documents/:id/file", (req, res) => {
    const doc = storage.getDocument(parseInt(req.params.id, 10));
    if (!doc) return res.status(404).json({ message: "Document not found." });
    if (!doc.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = import_node_path2.default.resolve(UPLOAD_DIR, doc.storedFileName);
    if (!abs.startsWith(UPLOAD_DIR + import_node_path2.default.sep) || !import_node_fs2.default.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalFileName || doc.storedFileName}"`);
    import_node_fs2.default.createReadStream(abs).pipe(res);
  });
  app2.delete("/api/documents/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const doc = storage.getDocument(id);
    if (doc?.storedFileName) {
      const abs = import_node_path2.default.resolve(UPLOAD_DIR, doc.storedFileName);
      if (abs.startsWith(UPLOAD_DIR + import_node_path2.default.sep)) {
        try {
          import_node_fs2.default.unlinkSync(abs);
        } catch {
        }
      }
    }
    storage.deleteDocument(id);
    res.status(204).end();
  });
  app2.get("/api/blueprints", (req, res) => res.json(storage.getBlueprints(pid(req))));
  app2.post("/api/blueprints", (req, res) => {
    const parsed = insertBlueprintSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createBlueprint(parsed.data));
  });
  app2.get("/api/drone-captures", (req, res) => res.json(storage.getDroneCaptures(pid(req))));
  app2.post("/api/drone-captures", (req, res) => {
    const parsed = insertDroneCaptureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createDroneCapture(parsed.data));
  });
  app2.get("/api/milestones", (req, res) => res.json(storage.getMilestones(pid(req))));
  app2.post("/api/milestones", (req, res) => {
    const parsed = insertMilestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createMilestone(parsed.data));
  });
  app2.patch("/api/milestones/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = storage.updateMilestone(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "not found" });
    res.json(updated);
  });
  app2.delete("/api/milestones/:id", (req, res) => {
    storage.deleteMilestone(parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.post("/api/drone-captures/upload", droneUpload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const title = req.body.title ? String(req.body.title) : file.originalname;
    const captureType = req.body.captureType ? String(req.body.captureType) : "Orthomosaic";
    const status = req.body.status ? String(req.body.status) : "Processed";
    const pilot = req.body.pilot ? String(req.body.pilot) : null;
    const flightDate = req.body.flightDate ? String(req.body.flightDate) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const altitude = req.body.altitude ? String(req.body.altitude) : null;
    const area = req.body.area ? String(req.body.area) : null;
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = storage.createDroneCapture({
      projectId,
      title,
      captureType,
      status,
      pilot,
      flightDate,
      altitude,
      area,
      hue,
      storedFileName: file.filename,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSizeBytes: file.size
    });
    res.status(201).json(created);
  });
  app2.get("/api/drone-captures/:id/file", (req, res) => {
    const cap = storage.getDroneCapture(parseInt(req.params.id, 10));
    if (!cap) return res.status(404).json({ message: "Capture not found." });
    if (!cap.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = import_node_path2.default.resolve(DRONE_DIR, cap.storedFileName);
    if (!abs.startsWith(DRONE_DIR + import_node_path2.default.sep) || !import_node_fs2.default.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", cap.mimeType || "image/jpeg");
    res.setHeader("Content-Disposition", `inline; filename="${cap.originalFileName || cap.storedFileName}"`);
    import_node_fs2.default.createReadStream(abs).pipe(res);
  });
  app2.delete("/api/drone-captures/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const cap = storage.getDroneCapture(id);
    if (cap?.storedFileName) {
      const abs = import_node_path2.default.resolve(DRONE_DIR, cap.storedFileName);
      if (abs.startsWith(DRONE_DIR + import_node_path2.default.sep)) {
        try {
          import_node_fs2.default.unlinkSync(abs);
        } catch {
        }
      }
    }
    storage.deleteDroneCapture(id);
    res.status(204).end();
  });
  app2.get("/api/messages/:projectId", (req, res) => {
    res.json(storage.getMessages(parseInt(req.params.projectId, 10)));
  });
  app2.post("/api/messages", (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createMessage(parsed.data));
  });
  app2.get("/api/notes", (req, res) => res.json(storage.getNotes(pid(req))));
  app2.post("/api/notes", (req, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(storage.createNote(parsed.data));
  });
  app2.patch("/api/notes/:id", (req, res) => {
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return res.status(400).json({ message: "x,y required" });
    const updated = storage.updateNotePosition(parseInt(req.params.id, 10), x, y);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  });
  app2.delete("/api/notes/:id", (req, res) => {
    storage.deleteNote(parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/integrations", (_req, res) => {
    res.json(storage.getIntegrations());
  });
  app2.patch("/api/integrations/:key", (req, res) => {
    const key = req.params.key;
    const connected = req.body?.connected === true;
    const config = typeof req.body?.config === "string" ? req.body.config : void 0;
    res.json(storage.setIntegration(key, connected, config));
  });
  app2.post("/api/subscribe", async (req, res) => {
    const parsed = insertSubscriberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = storage.createSubscriber(parsed.data);
    void sendSignupNotification({
      kind: "subscriber",
      subject: `New TrussPath subscriber \u2014 ${parsed.data.email}`,
      fields: {
        Email: parsed.data.email,
        Plan: parsed.data.plan,
        Source: parsed.data.source,
        "Signed up": (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    res.json(saved);
  });
  app2.post("/api/demo-request", async (req, res) => {
    const parsed = insertDemoRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = storage.createDemoRequest(parsed.data);
    const d = parsed.data;
    void sendSignupNotification({
      kind: "demo-request",
      subject: `New TrussPath demo request \u2014 ${d.name ?? d.email}`,
      fields: {
        Name: d.name,
        Email: d.email,
        Company: d.company,
        Role: d.role,
        Phone: d.phone,
        "Project count": d.projectCount,
        Message: d.message,
        Source: d.source,
        "Requested": (/* @__PURE__ */ new Date()).toISOString()
      }
    });
    res.json(saved);
  });
  app2.get("/api/admin/signups", (_req, res) => {
    res.json({
      subscribers: storage.listSubscribers(),
      demoRequests: storage.listDemoRequests()
    });
  });
  app2.get("/api/jarvis/brief", async (req, res) => {
    try {
      const result = await jarvisBrief(pid(req));
      res.json(result);
    } catch (err) {
      console.error("[jarvis] brief error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app2.post("/api/jarvis/chat", async (req, res) => {
    try {
      const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const result = await jarvisChat(pid(req), history);
      res.json(result);
    } catch (err) {
      console.error("[jarvis] chat error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app2.get("/api/settings", (_req, res) => {
    res.json(storage.getSettings());
  });
  app2.patch("/api/settings", (req, res) => {
    const patch = req.body && typeof req.body === "object" ? req.body : {};
    res.json(storage.updateSettings(patch));
  });
  app2.get("/api/jarvis/health-scan", (_req, res) => {
    try {
      res.json(runHealthScan());
    } catch (err) {
      console.error("[health] scan error:", err);
      res.status(500).json({ message: "Health scan failed." });
    }
  });
  app2.post("/api/reseed", (req, res) => {
    if (req.body?.confirm !== "RESET") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'RESET' } to wipe and reseed demo data." });
    }
    storage.resetAllData();
    res.json({ ok: true, reseededAt: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return _httpServer;
}
var import_node_path2, import_node_fs2, import_multer, SESSION_COOKIE, SESSION_MAX_AGE_SEC, PUBLIC_API, UPLOAD_DIR, ALLOWED_MIME, upload, PHOTO_DIR, photoHydrated, IMAGE_MIME, photoUpload, DRONE_DIR, droneUpload;
var init_routes = __esm({
  "server/routes.ts"() {
    "use strict";
    import_node_path2 = __toESM(require("node:path"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_multer = __toESM(require("multer"), 1);
    init_storage();
    init_jarvis();
    init_health();
    init_mailer();
    init_schema();
    SESSION_COOKIE = "tp_session";
    SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
    PUBLIC_API = /* @__PURE__ */ new Set([
      "/api/auth/signup",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/me",
      // marketing / landing page endpoints — safe to leave public
      "/api/subscribe",
      "/api/demo-request"
    ]);
    UPLOAD_DIR = process.env.VERCEL ? "/tmp/uploads/documents" : import_node_path2.default.resolve(process.cwd(), "uploads/documents");
    try {
      import_node_fs2.default.mkdirSync(UPLOAD_DIR, { recursive: true });
    } catch {
    }
    ALLOWED_MIME = /* @__PURE__ */ new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml"
    ]);
    upload = (0, import_multer.default)({
      storage: import_multer.default.diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = import_node_path2.default.extname(file.originalname).toLowerCase() || "";
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      // 25 MB
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
        else cb(new Error("Unsupported file type. Upload a PDF or image."));
      }
    });
    PHOTO_DIR = process.env.VERCEL ? "/tmp/uploads/photos" : import_node_path2.default.resolve(process.cwd(), "uploads/photos");
    try {
      import_node_fs2.default.mkdirSync(PHOTO_DIR, { recursive: true });
    } catch {
    }
    photoHydrated = false;
    IMAGE_MIME = /* @__PURE__ */ new Set([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml"
    ]);
    photoUpload = (0, import_multer.default)({
      storage: import_multer.default.diskStorage({
        destination: PHOTO_DIR,
        filename: (_req, file, cb) => {
          const ext = import_node_path2.default.extname(file.originalname).toLowerCase() || "";
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      // 25 MB
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME.has(file.mimetype)) cb(null, true);
        else cb(new Error("Unsupported file type. Upload a JPG, PNG, GIF, WEBP, or SVG image."));
      }
    });
    DRONE_DIR = process.env.VERCEL ? "/tmp/uploads/drone" : import_node_path2.default.resolve(process.cwd(), "uploads/drone");
    try {
      import_node_fs2.default.mkdirSync(DRONE_DIR, { recursive: true });
    } catch {
    }
    droneUpload = (0, import_multer.default)({
      storage: import_multer.default.diskStorage({
        destination: DRONE_DIR,
        filename: (_req, file, cb) => {
          const ext = import_node_path2.default.extname(file.originalname).toLowerCase() || "";
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
      }),
      limits: { fileSize: 25 * 1024 * 1024 },
      // 25 MB
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME.has(file.mimetype)) cb(null, true);
        else cb(new Error("Unsupported file type. Upload a JPG, PNG, GIF, WEBP, or SVG image."));
      }
    });
  }
});

// api-src/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_express = __toESM(require("express"), 1);
var import_node_http = require("node:http");
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "25mb" }));
app.use(import_express.default.urlencoded({ extended: false }));
var initError = null;
var initPromise = null;
async function init() {
  try {
    const { registerRoutes: registerRoutes2 } = await Promise.resolve().then(() => (init_routes(), routes_exports));
    const httpServer = (0, import_node_http.createServer)(app);
    await registerRoutes2(httpServer, app);
  } catch (e) {
    initError = e;
    console.error("[api/index] init failed:", e);
  }
}
initPromise = init();
app.use(async (_req, _res, next) => {
  await initPromise;
  next();
});
app.use((_req, res, next) => {
  if (initError) return res.status(500).json({ ok: false, error: String(initError?.message || initError) });
  next();
});
var index_default = app;
