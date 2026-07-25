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
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
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
var import_pg_core, import_drizzle_zod, import_zod, teamMembers, projects, tasks, milestones, rfis, submittals, changeOrders, actionItems, dailyLogs, punchItems, contacts, equipment, photos, documents, companyDocuments, deletedItems, blueprints, droneCaptures, messages, notes, integrations, subscribers, demoRequests, appSettings, accounts, sessions, passwordResetTokens, jarvisMemory, insertProjectSchema, insertTaskSchema, insertRfiSchema, insertSubmittalSchema, insertChangeOrderSchema, insertActionItemSchema, insertDailyLogSchema, insertPunchItemSchema, insertTeamSchema, insertContactSchema, insertEquipmentSchema, insertPhotoSchema, insertDocumentSchema, insertCompanyDocumentSchema, insertDeletedItemSchema, insertMessageSchema, insertNoteSchema, insertIntegrationSchema, insertBlueprintSchema, insertDroneCaptureSchema, insertJarvisMemorySchema, insertMilestoneSchema, insertSettingsSchema, signupSchema, loginSchema, DEFAULT_SETTINGS, insertSubscriberSchema, insertDemoRequestSchema;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    import_pg_core = require("drizzle-orm/pg-core");
    import_drizzle_zod = require("drizzle-zod");
    import_zod = require("zod");
    teamMembers = (0, import_pg_core.pgTable)("team_members", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      name: (0, import_pg_core.text)("name").notNull(),
      role: (0, import_pg_core.text)("role").notNull(),
      trade: (0, import_pg_core.text)("trade").notNull(),
      company: (0, import_pg_core.text)("company").notNull(),
      initials: (0, import_pg_core.text)("initials").notNull(),
      color: (0, import_pg_core.text)("color").notNull(),
      email: (0, import_pg_core.text)("email"),
      phone: (0, import_pg_core.text)("phone"),
      companyPhoto: (0, import_pg_core.text)("company_photo"),
      accessLevel: (0, import_pg_core.text)("access_level").notNull().default("project_manager")
    });
    projects = (0, import_pg_core.pgTable)("projects", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      name: (0, import_pg_core.text)("name").notNull(),
      number: (0, import_pg_core.text)("number").notNull(),
      client: (0, import_pg_core.text)("client").notNull(),
      type: (0, import_pg_core.text)("type").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      address: (0, import_pg_core.text)("address").notNull(),
      startDate: (0, import_pg_core.text)("start_date").notNull(),
      endDate: (0, import_pg_core.text)("end_date").notNull(),
      budget: (0, import_pg_core.doublePrecision)("budget").notNull(),
      spent: (0, import_pg_core.doublePrecision)("spent").notNull(),
      progress: (0, import_pg_core.integer)("progress").notNull(),
      superintendentId: (0, import_pg_core.integer)("superintendent_id")
    });
    tasks = (0, import_pg_core.pgTable)("tasks", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      trade: (0, import_pg_core.text)("trade").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      priority: (0, import_pg_core.text)("priority").notNull(),
      assigneeId: (0, import_pg_core.integer)("assignee_id"),
      dueDate: (0, import_pg_core.text)("due_date").notNull(),
      // schedule positioning
      startDate: (0, import_pg_core.text)("start_date"),
      endDate: (0, import_pg_core.text)("end_date"),
      seq: (0, import_pg_core.integer)("seq"),
      // comma-separated list of predecessor task ids (finish-to-start)
      dependsOn: (0, import_pg_core.text)("depends_on")
    });
    milestones = (0, import_pg_core.pgTable)("milestones", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      date: (0, import_pg_core.text)("date").notNull(),
      kind: (0, import_pg_core.text)("kind").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      notes: (0, import_pg_core.text)("notes")
    });
    rfis = (0, import_pg_core.pgTable)("rfis", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      number: (0, import_pg_core.text)("number").notNull(),
      subject: (0, import_pg_core.text)("subject").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      assigneeId: (0, import_pg_core.integer)("assignee_id"),
      dateCreated: (0, import_pg_core.text)("date_created").notNull(),
      dueDate: (0, import_pg_core.text)("due_date").notNull()
    });
    submittals = (0, import_pg_core.pgTable)("submittals", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      number: (0, import_pg_core.text)("number").notNull(),
      subject: (0, import_pg_core.text)("subject").notNull(),
      type: (0, import_pg_core.text)("type").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      assigneeId: (0, import_pg_core.integer)("assignee_id"),
      dateSubmitted: (0, import_pg_core.text)("date_submitted").notNull(),
      dueDate: (0, import_pg_core.text)("due_date").notNull()
    });
    changeOrders = (0, import_pg_core.pgTable)("change_orders", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      number: (0, import_pg_core.text)("number").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      amount: (0, import_pg_core.doublePrecision)("amount").notNull(),
      scheduleImpact: (0, import_pg_core.integer)("schedule_impact").notNull(),
      dateIssued: (0, import_pg_core.text)("date_issued").notNull()
    });
    actionItems = (0, import_pg_core.pgTable)("action_items", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      owner: (0, import_pg_core.text)("owner").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      priority: (0, import_pg_core.text)("priority").notNull(),
      dueDate: (0, import_pg_core.text)("due_date").notNull(),
      source: (0, import_pg_core.text)("source").notNull()
    });
    dailyLogs = (0, import_pg_core.pgTable)("daily_logs", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      date: (0, import_pg_core.text)("date").notNull(),
      authorId: (0, import_pg_core.integer)("author_id"),
      weather: (0, import_pg_core.text)("weather").notNull(),
      temp: (0, import_pg_core.integer)("temp").notNull(),
      crewCount: (0, import_pg_core.integer)("crew_count").notNull(),
      summary: (0, import_pg_core.text)("summary").notNull(),
      photos: (0, import_pg_core.text)("photos")
    });
    punchItems = (0, import_pg_core.pgTable)("punch_items", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      location: (0, import_pg_core.text)("location").notNull(),
      trade: (0, import_pg_core.text)("trade").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      assigneeId: (0, import_pg_core.integer)("assignee_id")
    });
    contacts = (0, import_pg_core.pgTable)("contacts", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      name: (0, import_pg_core.text)("name").notNull(),
      company: (0, import_pg_core.text)("company").notNull(),
      role: (0, import_pg_core.text)("role").notNull(),
      trade: (0, import_pg_core.text)("trade").notNull(),
      type: (0, import_pg_core.text)("type").notNull(),
      phone: (0, import_pg_core.text)("phone").notNull(),
      email: (0, import_pg_core.text)("email").notNull()
    });
    equipment = (0, import_pg_core.pgTable)("equipment", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      name: (0, import_pg_core.text)("name").notNull(),
      type: (0, import_pg_core.text)("type").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      projectId: (0, import_pg_core.integer)("project_id"),
      operator: (0, import_pg_core.text)("operator"),
      location: (0, import_pg_core.text)("location")
    });
    photos = (0, import_pg_core.pgTable)("photos", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      caption: (0, import_pg_core.text)("caption").notNull(),
      location: (0, import_pg_core.text)("location").notNull(),
      takenById: (0, import_pg_core.integer)("taken_by_id"),
      date: (0, import_pg_core.text)("date").notNull(),
      hue: (0, import_pg_core.integer)("hue").notNull(),
      storedFileName: (0, import_pg_core.text)("stored_file_name"),
      originalFileName: (0, import_pg_core.text)("original_file_name"),
      mimeType: (0, import_pg_core.text)("mime_type"),
      fileSizeBytes: (0, import_pg_core.integer)("file_size_bytes")
    });
    documents = (0, import_pg_core.pgTable)("documents", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      name: (0, import_pg_core.text)("name").notNull(),
      type: (0, import_pg_core.text)("type").notNull(),
      size: (0, import_pg_core.text)("size").notNull(),
      uploadedById: (0, import_pg_core.integer)("uploaded_by_id"),
      date: (0, import_pg_core.text)("date").notNull(),
      storedFileName: (0, import_pg_core.text)("stored_file_name"),
      originalFileName: (0, import_pg_core.text)("original_file_name"),
      mimeType: (0, import_pg_core.text)("mime_type"),
      fileSizeBytes: (0, import_pg_core.integer)("file_size_bytes")
    });
    companyDocuments = (0, import_pg_core.pgTable)("company_documents", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      title: (0, import_pg_core.text)("title").notNull(),
      category: (0, import_pg_core.text)("category").notNull(),
      // New Hire, Contract, HR, Safety, Vendor, Legal, Insurance, Other
      status: (0, import_pg_core.text)("status").notNull().default("Draft"),
      // Draft, Active, Archived
      signatureRequired: (0, import_pg_core.boolean)("signature_required").notNull().default(false),
      signatureStatus: (0, import_pg_core.text)("signature_status").notNull().default("Not Required"),
      // Not Required, Needs Signature, Sent, Signed, Expired
      signerName: (0, import_pg_core.text)("signer_name"),
      signerEmail: (0, import_pg_core.text)("signer_email"),
      docusignUrl: (0, import_pg_core.text)("docusign_url"),
      dueDate: (0, import_pg_core.text)("due_date"),
      notes: (0, import_pg_core.text)("notes"),
      uploadedById: (0, import_pg_core.integer)("uploaded_by_id"),
      date: (0, import_pg_core.text)("date").notNull(),
      storedFileName: (0, import_pg_core.text)("stored_file_name"),
      originalFileName: (0, import_pg_core.text)("original_file_name"),
      mimeType: (0, import_pg_core.text)("mime_type"),
      fileSizeBytes: (0, import_pg_core.integer)("file_size_bytes")
    });
    deletedItems = (0, import_pg_core.pgTable)("deleted_items", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      entityType: (0, import_pg_core.text)("entity_type").notNull(),
      entityId: (0, import_pg_core.integer)("entity_id").notNull(),
      data: (0, import_pg_core.text)("data").notNull(),
      // JSON-serialized row
      projectName: (0, import_pg_core.text)("project_name"),
      deletedAt: (0, import_pg_core.text)("deleted_at").notNull(),
      deletedById: (0, import_pg_core.integer)("deleted_by_id")
    });
    blueprints = (0, import_pg_core.pgTable)("blueprints", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      sheetNumber: (0, import_pg_core.text)("sheet_number").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      discipline: (0, import_pg_core.text)("discipline").notNull(),
      revision: (0, import_pg_core.text)("revision").notNull(),
      status: (0, import_pg_core.text)("status").notNull(),
      uploadedById: (0, import_pg_core.integer)("uploaded_by_id"),
      date: (0, import_pg_core.text)("date").notNull(),
      hue: (0, import_pg_core.integer)("hue").notNull()
    });
    droneCaptures = (0, import_pg_core.pgTable)("drone_captures", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      title: (0, import_pg_core.text)("title").notNull(),
      captureType: (0, import_pg_core.text)("capture_type").notNull(),
      pilot: (0, import_pg_core.text)("pilot"),
      flightDate: (0, import_pg_core.text)("flight_date").notNull(),
      altitude: (0, import_pg_core.text)("altitude"),
      area: (0, import_pg_core.text)("area"),
      status: (0, import_pg_core.text)("status").notNull(),
      hue: (0, import_pg_core.integer)("hue").notNull(),
      storedFileName: (0, import_pg_core.text)("stored_file_name"),
      originalFileName: (0, import_pg_core.text)("original_file_name"),
      mimeType: (0, import_pg_core.text)("mime_type"),
      fileSizeBytes: (0, import_pg_core.integer)("file_size_bytes")
    });
    messages = (0, import_pg_core.pgTable)("messages", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id").notNull(),
      authorId: (0, import_pg_core.integer)("author_id"),
      body: (0, import_pg_core.text)("body").notNull(),
      createdAt: (0, import_pg_core.text)("created_at").notNull()
    });
    notes = (0, import_pg_core.pgTable)("notes", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id"),
      body: (0, import_pg_core.text)("body").notNull(),
      color: (0, import_pg_core.text)("color").notNull(),
      x: (0, import_pg_core.integer)("x").notNull(),
      y: (0, import_pg_core.integer)("y").notNull()
    });
    integrations = (0, import_pg_core.pgTable)("integrations", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      key: (0, import_pg_core.text)("key").notNull().unique(),
      connected: (0, import_pg_core.boolean)("connected").notNull().default(false),
      status: (0, import_pg_core.text)("status").notNull().default("available"),
      // available, connected, needs_config, error
      accountLabel: (0, import_pg_core.text)("account_label"),
      connectedAt: (0, import_pg_core.text)("connected_at"),
      config: (0, import_pg_core.text)("config")
    });
    subscribers = (0, import_pg_core.pgTable)("subscribers", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      email: (0, import_pg_core.text)("email").notNull().unique(),
      plan: (0, import_pg_core.text)("plan").notNull(),
      billing: (0, import_pg_core.text)("billing").notNull(),
      company: (0, import_pg_core.text)("company"),
      createdAt: (0, import_pg_core.text)("created_at").notNull()
    });
    demoRequests = (0, import_pg_core.pgTable)("demo_requests", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      name: (0, import_pg_core.text)("name").notNull(),
      email: (0, import_pg_core.text)("email").notNull(),
      company: (0, import_pg_core.text)("company").notNull(),
      phone: (0, import_pg_core.text)("phone"),
      teamSize: (0, import_pg_core.text)("team_size"),
      notes: (0, import_pg_core.text)("notes"),
      createdAt: (0, import_pg_core.text)("created_at").notNull()
    });
    appSettings = (0, import_pg_core.pgTable)("app_settings", {
      id: (0, import_pg_core.integer)("id").primaryKey(),
      config: (0, import_pg_core.text)("config").notNull().default("{}"),
      updatedAt: (0, import_pg_core.text)("updated_at").notNull()
    });
    accounts = (0, import_pg_core.pgTable)("accounts", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      email: (0, import_pg_core.text)("email").notNull().unique(),
      passwordHash: (0, import_pg_core.text)("password_hash").notNull(),
      displayName: (0, import_pg_core.text)("display_name").notNull(),
      position: (0, import_pg_core.text)("position"),
      role: (0, import_pg_core.text)("role").notNull().default("member"),
      company: (0, import_pg_core.text)("company"),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      // Stripe billing
      stripeCustomerId: (0, import_pg_core.text)("stripe_customer_id"),
      stripeSubscriptionId: (0, import_pg_core.text)("stripe_subscription_id"),
      subscriptionStatus: (0, import_pg_core.text)("subscription_status"),
      // active, trialing, canceled, past_due, etc.
      subscriptionPlan: (0, import_pg_core.text)("subscription_plan"),
      // starter, pro, enterprise
      subscriptionBilling: (0, import_pg_core.text)("subscription_billing"),
      // monthly, annual
      subscriptionCurrentPeriodEnd: (0, import_pg_core.text)("subscription_current_period_end")
    });
    sessions = (0, import_pg_core.pgTable)("sessions", {
      id: (0, import_pg_core.text)("id").primaryKey(),
      accountId: (0, import_pg_core.integer)("account_id").notNull(),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      expiresAt: (0, import_pg_core.text)("expires_at").notNull()
    });
    passwordResetTokens = (0, import_pg_core.pgTable)("password_reset_tokens", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      token: (0, import_pg_core.text)("token").notNull().unique(),
      accountId: (0, import_pg_core.integer)("account_id").notNull(),
      expiresAt: (0, import_pg_core.text)("expires_at").notNull(),
      usedAt: (0, import_pg_core.text)("used_at")
    });
    jarvisMemory = (0, import_pg_core.pgTable)("jarvis_memory", {
      id: (0, import_pg_core.serial)("id").primaryKey(),
      projectId: (0, import_pg_core.integer)("project_id"),
      question: (0, import_pg_core.text)("question").notNull(),
      normalizedQuestion: (0, import_pg_core.text)("normalized_question").notNull(),
      topic: (0, import_pg_core.text)("topic"),
      answer: (0, import_pg_core.text)("answer"),
      status: (0, import_pg_core.text)("status").notNull().default("pending"),
      source: (0, import_pg_core.text)("source").notNull().default("user_taught"),
      hitCount: (0, import_pg_core.integer)("hit_count").notNull().default(0),
      createdAt: (0, import_pg_core.text)("created_at").notNull(),
      updatedAt: (0, import_pg_core.text)("updated_at")
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
    insertCompanyDocumentSchema = (0, import_drizzle_zod.createInsertSchema)(companyDocuments).omit({ id: true });
    insertDeletedItemSchema = (0, import_drizzle_zod.createInsertSchema)(deletedItems).omit({ id: true });
    insertMessageSchema = (0, import_drizzle_zod.createInsertSchema)(messages).omit({ id: true });
    insertNoteSchema = (0, import_drizzle_zod.createInsertSchema)(notes).omit({ id: true });
    insertIntegrationSchema = (0, import_drizzle_zod.createInsertSchema)(integrations).omit({ id: true });
    insertBlueprintSchema = (0, import_drizzle_zod.createInsertSchema)(blueprints).omit({ id: true });
    insertDroneCaptureSchema = (0, import_drizzle_zod.createInsertSchema)(droneCaptures).omit({ id: true });
    insertJarvisMemorySchema = (0, import_drizzle_zod.createInsertSchema)(jarvisMemory).omit({ id: true, createdAt: true, updatedAt: true, hitCount: true });
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
var storage_exports = {};
__export(storage_exports, {
  db: () => db,
  ensureReady: () => ensureReady,
  inferTopic: () => inferTopic,
  normalizeQuestion: () => normalizeQuestion,
  storage: () => storage,
  tokenSimilarity: () => tokenSimilarity
});
async function migrate() {
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
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`;
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
  await sql`UPDATE team_members SET access_level = CASE
    WHEN role LIKE '%Executive%' THEN 'project_executive'
    WHEN role LIKE '%Superintendent%' THEN 'superintendent'
    WHEN role LIKE '%Foreman%' THEN 'foreman'
    WHEN role LIKE '%QC%' OR role LIKE '%Quality%' THEN 'superintendent'
    WHEN role LIKE '%Manager%' THEN 'project_manager'
    ELSE access_level END
    WHERE access_level = 'project_manager'`;
  await sql`UPDATE team_members SET
    email = CASE WHEN email IS NULL OR email = '' THEN lower(replace(name,' ','.')) || '@' || lower(replace(replace(company,' ',''),'.','')) || '.com' ELSE email END,
    phone = CASE WHEN phone IS NULL OR phone = '' THEN '(303) 555-' || substr('0000' || ((id * 137) % 9000 + 1000)::text, -4) ELSE phone END`;
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
}
function ensureReady() {
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
function normalizeQuestion(q) {
  const stopWords = /* @__PURE__ */ new Set([
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "what",
    "whats",
    "what's",
    "where",
    "wheres",
    "where's",
    "how",
    "do",
    "does",
    "can",
    "could",
    "would",
    "should",
    "i",
    "you",
    "me",
    "we",
    "they",
    "it",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "and",
    "or",
    "but",
    "so",
    "if",
    "then",
    "tell",
    "about",
    "give",
    "some",
    "good",
    "best",
    "near",
    "by",
    "my",
    "our",
    "this",
    "that",
    "there",
    "here",
    "with",
    "from",
    "as",
    "be",
    "been",
    "have",
    "has"
  ]);
  return q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !stopWords.has(w)).join(" ").trim();
}
function tokenSimilarity(a, b) {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  ta.forEach((t) => {
    if (tb.has(t)) overlap++;
  });
  return overlap / Math.max(ta.size, tb.size);
}
function inferTopic(q) {
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
var import_neon_http, import_serverless, import_drizzle_orm, import_node_fs, import_node_path, import_node_crypto, RAW_CONN, CONN, sql, db, initPromise, DatabaseStorage, seedDone, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_schema();
    import_neon_http = require("drizzle-orm/neon-http");
    import_serverless = require("@neondatabase/serverless");
    import_drizzle_orm = require("drizzle-orm");
    import_node_fs = require("node:fs");
    import_node_path = require("node:path");
    import_node_crypto = require("node:crypto");
    RAW_CONN = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
    if (!RAW_CONN || !/^postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/.+/.test(RAW_CONN)) {
      const msg = !RAW_CONN ? "[storage] DATABASE_URL is not set. Set it in Vercel \u2192 Project \u2192 Settings \u2192 Environment Variables to the Neon connection string (postgresql://user:password@host/dbname?sslmode=require)." : "[storage] DATABASE_URL is malformed. Expected postgresql://user:password@host/dbname?sslmode=require. Check for empty strings, extra quotes, or missing credentials in the Vercel env var.";
      console.error(msg);
    }
    CONN = RAW_CONN ? RAW_CONN.replace(/-pooler\./, ".").replace(/[?&]channel_binding=[^&]*/g, "").replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "") : "postgresql://user:pass@localhost/placeholder";
    sql = (0, import_serverless.neon)(CONN);
    db = (0, import_neon_http.drizzle)(sql);
    initPromise = null;
    DatabaseStorage = class {
      async getTeam() {
        await ensureReady();
        return await db.select().from(teamMembers);
      }
      async getTeamMember(id) {
        await ensureReady();
        const rows = await db.select().from(teamMembers).where((0, import_drizzle_orm.eq)(teamMembers.id, id));
        return rows[0];
      }
      async createTeamMember(data) {
        await ensureReady();
        const [row] = await db.insert(teamMembers).values(data).returning();
        return row;
      }
      async updateTeamMember(id, data) {
        await ensureReady();
        const [row] = await db.update(teamMembers).set(data).where((0, import_drizzle_orm.eq)(teamMembers.id, id)).returning();
        return row;
      }
      async deleteTeamMember(id) {
        await ensureReady();
        await db.delete(teamMembers).where((0, import_drizzle_orm.eq)(teamMembers.id, id));
      }
      async getProjects() {
        await ensureReady();
        return await db.select().from(projects);
      }
      async getProject(id) {
        await ensureReady();
        const rows = await db.select().from(projects).where((0, import_drizzle_orm.eq)(projects.id, id));
        return rows[0];
      }
      async createProject(data) {
        await ensureReady();
        const existing = await db.select().from(projects);
        const nextNum = existing.length + 1;
        const projectNumber = `PRJ-${String(nextNum).padStart(3, "0")}`;
        const [row] = await db.insert(projects).values({ ...data, number: projectNumber }).returning();
        return row;
      }
      async updateProject(id, data) {
        await ensureReady();
        const [row] = await db.update(projects).set(data).where((0, import_drizzle_orm.eq)(projects.id, id)).returning();
        return row;
      }
      async getTasks(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(tasks).where((0, import_drizzle_orm.eq)(tasks.projectId, projectId));
        return await db.select().from(tasks);
      }
      async createTask(data) {
        await ensureReady();
        const [row] = await db.insert(tasks).values(data).returning();
        return row;
      }
      async updateTaskStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(tasks).set({ status }).where((0, import_drizzle_orm.eq)(tasks.id, id)).returning();
        return row;
      }
      async getRfis(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(rfis).where((0, import_drizzle_orm.eq)(rfis.projectId, projectId));
        return await db.select().from(rfis);
      }
      async createRfi(data) {
        await ensureReady();
        const [row] = await db.insert(rfis).values(data).returning();
        return row;
      }
      async updateRfiStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(rfis).set({ status }).where((0, import_drizzle_orm.eq)(rfis.id, id)).returning();
        return row;
      }
      async getSubmittals(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(submittals).where((0, import_drizzle_orm.eq)(submittals.projectId, projectId));
        return await db.select().from(submittals);
      }
      async createSubmittal(data) {
        await ensureReady();
        const [row] = await db.insert(submittals).values(data).returning();
        return row;
      }
      async updateSubmittalStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(submittals).set({ status }).where((0, import_drizzle_orm.eq)(submittals.id, id)).returning();
        return row;
      }
      async getChangeOrders(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(changeOrders).where((0, import_drizzle_orm.eq)(changeOrders.projectId, projectId));
        return await db.select().from(changeOrders);
      }
      async createChangeOrder(data) {
        await ensureReady();
        const [row] = await db.insert(changeOrders).values(data).returning();
        return row;
      }
      async updateChangeOrderStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(changeOrders).set({ status }).where((0, import_drizzle_orm.eq)(changeOrders.id, id)).returning();
        return row;
      }
      async getActionItems(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(actionItems).where((0, import_drizzle_orm.eq)(actionItems.projectId, projectId));
        return await db.select().from(actionItems);
      }
      async createActionItem(data) {
        await ensureReady();
        const [row] = await db.insert(actionItems).values(data).returning();
        return row;
      }
      async updateActionItemStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(actionItems).set({ status }).where((0, import_drizzle_orm.eq)(actionItems.id, id)).returning();
        return row;
      }
      async getDailyLogs(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(dailyLogs).where((0, import_drizzle_orm.eq)(dailyLogs.projectId, projectId));
        return await db.select().from(dailyLogs);
      }
      async createDailyLog(data) {
        await ensureReady();
        const [row] = await db.insert(dailyLogs).values(data).returning();
        return row;
      }
      async updateDailyLog(id, data) {
        await ensureReady();
        const [row] = await db.update(dailyLogs).set(data).where((0, import_drizzle_orm.eq)(dailyLogs.id, id)).returning();
        return row;
      }
      async deleteDailyLog(id) {
        await ensureReady();
        await db.delete(dailyLogs).where((0, import_drizzle_orm.eq)(dailyLogs.id, id));
      }
      async getPunchItems(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(punchItems).where((0, import_drizzle_orm.eq)(punchItems.projectId, projectId));
        return await db.select().from(punchItems);
      }
      async updatePunchStatus(id, status) {
        await ensureReady();
        const [row] = await db.update(punchItems).set({ status }).where((0, import_drizzle_orm.eq)(punchItems.id, id)).returning();
        return row;
      }
      async createPunchItem(data) {
        await ensureReady();
        const [row] = await db.insert(punchItems).values(data).returning();
        return row;
      }
      async getContacts() {
        await ensureReady();
        return await db.select().from(contacts);
      }
      async createContact(data) {
        await ensureReady();
        const [row] = await db.insert(contacts).values(data).returning();
        return row;
      }
      async updateContact(id, data) {
        await ensureReady();
        const [row] = await db.update(contacts).set(data).where((0, import_drizzle_orm.eq)(contacts.id, id)).returning();
        return row;
      }
      async deleteContact(id) {
        await ensureReady();
        await db.delete(contacts).where((0, import_drizzle_orm.eq)(contacts.id, id));
      }
      async getEquipment(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(equipment).where((0, import_drizzle_orm.eq)(equipment.projectId, projectId));
        return await db.select().from(equipment);
      }
      async createEquipment(data) {
        await ensureReady();
        const [row] = await db.insert(equipment).values(data).returning();
        return row;
      }
      async getPhotos(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(photos).where((0, import_drizzle_orm.eq)(photos.projectId, projectId));
        return await db.select().from(photos);
      }
      async getPhoto(id) {
        await ensureReady();
        const rows = await db.select().from(photos).where((0, import_drizzle_orm.eq)(photos.id, id));
        return rows[0];
      }
      async createPhoto(data) {
        await ensureReady();
        const [row] = await db.insert(photos).values(data).returning();
        return row;
      }
      async deletePhoto(id) {
        await ensureReady();
        await db.delete(photos).where((0, import_drizzle_orm.eq)(photos.id, id));
      }
      async getDocuments(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(documents).where((0, import_drizzle_orm.eq)(documents.projectId, projectId));
        return await db.select().from(documents);
      }
      async getDocument(id) {
        await ensureReady();
        const rows = await db.select().from(documents).where((0, import_drizzle_orm.eq)(documents.id, id));
        return rows[0];
      }
      async createDocument(data) {
        await ensureReady();
        const [row] = await db.insert(documents).values(data).returning();
        return row;
      }
      async deleteDocument(id) {
        await ensureReady();
        await db.delete(documents).where((0, import_drizzle_orm.eq)(documents.id, id));
      }
      async getCompanyDocuments() {
        await ensureReady();
        return await db.select().from(companyDocuments).orderBy((0, import_drizzle_orm.desc)(companyDocuments.date));
      }
      async getCompanyDocument(id) {
        await ensureReady();
        const rows = await db.select().from(companyDocuments).where((0, import_drizzle_orm.eq)(companyDocuments.id, id));
        return rows[0];
      }
      async createCompanyDocument(data) {
        await ensureReady();
        const [row] = await db.insert(companyDocuments).values(data).returning();
        return row;
      }
      async updateCompanyDocument(id, data) {
        await ensureReady();
        const [row] = await db.update(companyDocuments).set(data).where((0, import_drizzle_orm.eq)(companyDocuments.id, id)).returning();
        return row;
      }
      async deleteCompanyDocument(id) {
        await ensureReady();
        await db.delete(companyDocuments).where((0, import_drizzle_orm.eq)(companyDocuments.id, id));
      }
      // ---- Deleted Items Bin ----
      ENTITY_CONFIG = {
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
        "drone-captures": { table: droneCaptures, nameCol: "label", projectCol: "projectId" }
      };
      async getDeletedItems() {
        await ensureReady();
        return await db.select().from(deletedItems).orderBy((0, import_drizzle_orm.desc)(deletedItems.deletedAt));
      }
      async softDeleteEntity(entityType, entityId, deletedById) {
        await ensureReady();
        const cfg = this.ENTITY_CONFIG[entityType];
        if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
        const rows = await db.select().from(cfg.table).where((0, import_drizzle_orm.eq)(cfg.table.id, entityId));
        const row = rows[0];
        if (!row) throw new Error(`${entityType} #${entityId} not found`);
        let projectName = null;
        if (cfg.projectCol && row[cfg.projectCol]) {
          const projRows = await db.select().from(projects).where((0, import_drizzle_orm.eq)(projects.id, row[cfg.projectCol]));
          projectName = projRows[0]?.name ?? null;
        }
        const [deleted] = await db.insert(deletedItems).values({
          entityType,
          entityId,
          data: JSON.stringify(row),
          projectName,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          deletedById: deletedById ?? null
        }).returning();
        await db.delete(cfg.table).where((0, import_drizzle_orm.eq)(cfg.table.id, entityId));
        return deleted;
      }
      async restoreEntity(entityType, entityId) {
        await ensureReady();
        const cfg = this.ENTITY_CONFIG[entityType];
        if (!cfg) throw new Error(`Unknown entity type: ${entityType}`);
        const binRows = await db.select().from(deletedItems).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(deletedItems.entityType, entityType), (0, import_drizzle_orm.eq)(deletedItems.entityId, entityId)));
        const binRow = binRows[0];
        if (!binRow) throw new Error(`Deleted ${entityType} #${entityId} not found in bin`);
        const rowData = JSON.parse(binRow.data);
        const { id, ...rest } = rowData;
        const restored = (await db.insert(cfg.table).values(rest).returning())[0];
        await db.delete(deletedItems).where((0, import_drizzle_orm.eq)(deletedItems.id, binRow.id));
        return restored;
      }
      async permanentDeleteEntity(entityType, entityId) {
        await ensureReady();
        await db.delete(deletedItems).where((0, import_drizzle_orm.and)((0, import_drizzle_orm.eq)(deletedItems.entityType, entityType), (0, import_drizzle_orm.eq)(deletedItems.entityId, entityId)));
      }
      async emptyDeletedItems() {
        await ensureReady();
        await db.delete(deletedItems);
      }
      async getBlueprints(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(blueprints).where((0, import_drizzle_orm.eq)(blueprints.projectId, projectId));
        return await db.select().from(blueprints);
      }
      async createBlueprint(data) {
        await ensureReady();
        const [row] = await db.insert(blueprints).values(data).returning();
        return row;
      }
      async getDroneCaptures(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(droneCaptures).where((0, import_drizzle_orm.eq)(droneCaptures.projectId, projectId));
        return await db.select().from(droneCaptures);
      }
      async getDroneCapture(id) {
        await ensureReady();
        const rows = await db.select().from(droneCaptures).where((0, import_drizzle_orm.eq)(droneCaptures.id, id));
        return rows[0];
      }
      async createDroneCapture(data) {
        await ensureReady();
        const [row] = await db.insert(droneCaptures).values(data).returning();
        return row;
      }
      async deleteDroneCapture(id) {
        await ensureReady();
        await db.delete(droneCaptures).where((0, import_drizzle_orm.eq)(droneCaptures.id, id));
      }
      async getMilestones(projectId) {
        await ensureReady();
        if (projectId) {
          return await db.select().from(milestones).where((0, import_drizzle_orm.eq)(milestones.projectId, projectId));
        }
        return await db.select().from(milestones);
      }
      async getMilestone(id) {
        await ensureReady();
        const rows = await db.select().from(milestones).where((0, import_drizzle_orm.eq)(milestones.id, id));
        return rows[0];
      }
      async createMilestone(data) {
        await ensureReady();
        const [row] = await db.insert(milestones).values(data).returning();
        return row;
      }
      async updateMilestone(id, data) {
        await ensureReady();
        const [row] = await db.update(milestones).set(data).where((0, import_drizzle_orm.eq)(milestones.id, id)).returning();
        return row;
      }
      async deleteMilestone(id) {
        await ensureReady();
        await db.delete(milestones).where((0, import_drizzle_orm.eq)(milestones.id, id));
      }
      async getMessages(projectId) {
        await ensureReady();
        return await db.select().from(messages).where((0, import_drizzle_orm.eq)(messages.projectId, projectId));
      }
      async createMessage(data) {
        await ensureReady();
        const [row] = await db.insert(messages).values(data).returning();
        return row;
      }
      async getNotes(projectId) {
        await ensureReady();
        if (projectId !== void 0) return await db.select().from(notes).where((0, import_drizzle_orm.eq)(notes.projectId, projectId));
        return await db.select().from(notes);
      }
      async createNote(data) {
        await ensureReady();
        const [row] = await db.insert(notes).values(data).returning();
        return row;
      }
      async updateNotePosition(id, x, y) {
        await ensureReady();
        const [row] = await db.update(notes).set({ x, y }).where((0, import_drizzle_orm.eq)(notes.id, id)).returning();
        return row;
      }
      async deleteNote(id) {
        await ensureReady();
        await db.delete(notes).where((0, import_drizzle_orm.eq)(notes.id, id));
      }
      async getIntegrations() {
        await ensureReady();
        return await db.select().from(integrations);
      }
      async setIntegration(key, connected, config) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existingRows = await db.select().from(integrations).where((0, import_drizzle_orm.eq)(integrations.key, key));
        const existing = existingRows[0];
        if (existing) {
          const [row2] = await db.update(integrations).set({ connected, connectedAt: connected ? now : null, config: config ?? existing.config }).where((0, import_drizzle_orm.eq)(integrations.key, key)).returning();
          return row2;
        }
        const [row] = await db.insert(integrations).values({ key, connected, connectedAt: connected ? now : null, config }).returning();
        return row;
      }
      async connectIntegration(key, data) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existingRows = await db.select().from(integrations).where((0, import_drizzle_orm.eq)(integrations.key, key));
        const existing = existingRows[0];
        const values = {
          connected: true,
          status: "connected",
          connectedAt: now,
          accountLabel: data.accountLabel ?? null,
          config: data.config ?? existing?.config ?? null
        };
        if (existing) {
          const [row2] = await db.update(integrations).set(values).where((0, import_drizzle_orm.eq)(integrations.key, key)).returning();
          return row2;
        }
        const [row] = await db.insert(integrations).values({ key, ...values }).returning();
        return row;
      }
      async disconnectIntegration(key) {
        await ensureReady();
        const existingRows = await db.select().from(integrations).where((0, import_drizzle_orm.eq)(integrations.key, key));
        const existing = existingRows[0];
        const values = {
          connected: false,
          status: "available",
          connectedAt: null,
          accountLabel: null
        };
        if (existing) {
          const [row2] = await db.update(integrations).set(values).where((0, import_drizzle_orm.eq)(integrations.key, key)).returning();
          return row2;
        }
        const [row] = await db.insert(integrations).values({ key, ...values }).returning();
        return row;
      }
      async createSubscriber(data) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const existingRows = await db.select().from(subscribers).where((0, import_drizzle_orm.eq)(subscribers.email, data.email));
        const existing = existingRows[0];
        if (existing) {
          const [row2] = await db.update(subscribers).set({ plan: data.plan, billing: data.billing, company: data.company ?? existing.company }).where((0, import_drizzle_orm.eq)(subscribers.email, data.email)).returning();
          return row2;
        }
        const [row] = await db.insert(subscribers).values({ ...data, createdAt: now }).returning();
        return row;
      }
      async listSubscribers() {
        await ensureReady();
        return await db.select().from(subscribers);
      }
      async createDemoRequest(data) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [row] = await db.insert(demoRequests).values({ ...data, createdAt: now }).returning();
        return row;
      }
      async listDemoRequests() {
        await ensureReady();
        return await db.select().from(demoRequests);
      }
      /* --------------------------- Settings ---------------------------- */
      async getSettings() {
        await ensureReady();
        const rows = await db.select().from(appSettings).where((0, import_drizzle_orm.eq)(appSettings.id, 1));
        const row = rows[0];
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
      async updateSettings(patch) {
        await ensureReady();
        const merged = { ...await this.getSettings(), ...patch };
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
        const existingRows = await db.select().from(appSettings).where((0, import_drizzle_orm.eq)(appSettings.id, 1));
        if (existingRows[0]) {
          await db.update(appSettings).set({ config: JSON.stringify(clean), updatedAt: now }).where((0, import_drizzle_orm.eq)(appSettings.id, 1));
        } else {
          await db.insert(appSettings).values({ id: 1, config: JSON.stringify(clean), updatedAt: now });
        }
        return { ...DEFAULT_SETTINGS, ...clean };
      }
      async resetAllData() {
        await ensureReady();
        for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, subscribers, demoRequests]) {
          await db.delete(t);
        }
        seedDone = false;
        await this.seed();
      }
      async wipeAllData() {
        await ensureReady();
        for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, companyDocuments, deletedItems, subscribers, demoRequests]) {
          await db.delete(t);
        }
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
      async createAccount(email, password, displayName, company, role = "member") {
        await ensureReady();
        const normEmail = email.trim().toLowerCase();
        const existingRows = await db.select().from(accounts).where((0, import_drizzle_orm.eq)(accounts.email, normEmail));
        if (existingRows[0]) throw new Error("Email already registered");
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [row] = await db.insert(accounts).values({
          email: normEmail,
          passwordHash: this.hashPassword(password),
          displayName,
          role,
          company: company ?? null,
          createdAt: now
        }).returning();
        return this.toPublic(row);
      }
      async getAccountByEmail(email) {
        await ensureReady();
        const rows = await db.select().from(accounts).where((0, import_drizzle_orm.eq)(accounts.email, email.trim().toLowerCase()));
        return rows[0];
      }
      async getAccount(id) {
        await ensureReady();
        const rows = await db.select().from(accounts).where((0, import_drizzle_orm.eq)(accounts.id, id));
        const a = rows[0];
        return a ? this.toPublic(a) : void 0;
      }
      async updateAccountProfile(id, data) {
        await ensureReady();
        const updateData = {};
        if (data.displayName !== void 0) updateData.displayName = data.displayName;
        if (data.position !== void 0) updateData.position = data.position;
        if (Object.keys(updateData).length === 0) return this.getAccount(id);
        const [row] = await db.update(accounts).set(updateData).where((0, import_drizzle_orm.eq)(accounts.id, id)).returning();
        return row ? this.toPublic(row) : void 0;
      }
      async updateAccountBilling(id, data) {
        await ensureReady();
        const updateData = {};
        if (data.stripeCustomerId !== void 0) updateData.stripeCustomerId = data.stripeCustomerId;
        if (data.stripeSubscriptionId !== void 0) updateData.stripeSubscriptionId = data.stripeSubscriptionId;
        if (data.subscriptionStatus !== void 0) updateData.subscriptionStatus = data.subscriptionStatus;
        if (data.subscriptionPlan !== void 0) updateData.subscriptionPlan = data.subscriptionPlan;
        if (data.subscriptionBilling !== void 0) updateData.subscriptionBilling = data.subscriptionBilling;
        if (data.subscriptionCurrentPeriodEnd !== void 0) updateData.subscriptionCurrentPeriodEnd = data.subscriptionCurrentPeriodEnd;
        if (Object.keys(updateData).length === 0) return this.getAccount(id);
        const [row] = await db.update(accounts).set(updateData).where((0, import_drizzle_orm.eq)(accounts.id, id)).returning();
        return row ? this.toPublic(row) : void 0;
      }
      async getAccountByStripeCustomerId(customerId) {
        await ensureReady();
        const rows = await db.select().from(accounts).where((0, import_drizzle_orm.eq)(accounts.stripeCustomerId, customerId));
        return rows[0];
      }
      async verifyPassword(email, password) {
        const acc = await this.getAccountByEmail(email);
        if (!acc) return null;
        if (!this.verifyHash(password, acc.passwordHash)) return null;
        return this.toPublic(acc);
      }
      async createPasswordResetToken(accountId) {
        await ensureReady();
        const token = (0, import_node_crypto.randomBytes)(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
        await db.insert(passwordResetTokens).values({ token, accountId, expiresAt });
        return token;
      }
      async getPasswordResetToken(token) {
        await ensureReady();
        const rows = await db.select().from(passwordResetTokens).where((0, import_drizzle_orm.eq)(passwordResetTokens.token, token));
        return rows[0];
      }
      async usePasswordResetToken(token) {
        await ensureReady();
        const row = await this.getPasswordResetToken(token);
        if (!row) return null;
        if (row.usedAt) return null;
        if (new Date(row.expiresAt) < /* @__PURE__ */ new Date()) return null;
        const [updated] = await db.update(passwordResetTokens).set({ usedAt: (/* @__PURE__ */ new Date()).toISOString() }).where((0, import_drizzle_orm.eq)(passwordResetTokens.id, row.id)).returning();
        return updated ?? null;
      }
      async updatePassword(accountId, newPassword) {
        await ensureReady();
        await db.update(accounts).set({ passwordHash: this.hashPassword(newPassword) }).where((0, import_drizzle_orm.eq)(accounts.id, accountId));
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
      async getSession(token) {
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
        const account = await this.getAccount(accountId);
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
      async countAccounts() {
        await ensureReady();
        const rows = await db.select().from(accounts);
        return rows.length;
      }
      /* --------------------------- Jarvis memory --------------------------- */
      async getJarvisMemories(projectId) {
        await ensureReady();
        if (projectId != null) {
          return await db.select().from(jarvisMemory).where((0, import_drizzle_orm.eq)(jarvisMemory.projectId, projectId));
        }
        return await db.select().from(jarvisMemory);
      }
      async searchJarvisMemory(query, projectId) {
        await ensureReady();
        const normalized = normalizeQuestion(query);
        const all = await db.select().from(jarvisMemory);
        const learned = all.filter((m) => m.status === "learned" && m.answer);
        if (!learned.length) return void 0;
        const scoped = projectId != null ? learned.filter((m) => m.projectId === projectId || m.projectId === null) : learned;
        let best = null;
        for (const m of scoped) {
          const score = tokenSimilarity(normalized, m.normalizedQuestion);
          if (!best || score > best.score) best = { memory: m, score };
        }
        if (best && best.score > 0.2) {
          await this.incrementJarvisMemoryHit(best.memory.id);
          return best.memory;
        }
        return void 0;
      }
      async createJarvisMemory(data) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [row] = await db.insert(jarvisMemory).values({
          ...data,
          normalizedQuestion: data.normalizedQuestion || normalizeQuestion(data.question),
          createdAt: now,
          updatedAt: now
        }).returning();
        return row;
      }
      async updateJarvisMemory(id, data) {
        await ensureReady();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const [row] = await db.update(jarvisMemory).set({
          ...data,
          updatedAt: now
        }).where((0, import_drizzle_orm.eq)(jarvisMemory.id, id)).returning();
        return row;
      }
      async incrementJarvisMemoryHit(id) {
        await ensureReady();
        const rows = await db.select().from(jarvisMemory).where((0, import_drizzle_orm.eq)(jarvisMemory.id, id));
        if (rows[0]) {
          await db.update(jarvisMemory).set({
            hitCount: (rows[0].hitCount || 0) + 1,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }).where((0, import_drizzle_orm.eq)(jarvisMemory.id, id));
        }
      }
      async deleteJarvisMemory(id) {
        await ensureReady();
        await db.delete(jarvisMemory).where((0, import_drizzle_orm.eq)(jarvisMemory.id, id));
      }
      /* ----------------------------- Seed ------------------------------ */
      async seed() {
        if (seedDone) return;
        const existing = await db.select().from(teamMembers);
        if (existing.length > 0) {
          seedDone = true;
          return;
        }
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
        const t = [];
        for (const x of team) {
          const [row] = await db.insert(teamMembers).values(x).returning();
          t.push(row);
        }
        const projectsSeed = [
          { name: "Lakeside Medical Pavilion", number: "MB-2401", client: "Lakeside Health System", type: "Healthcare", status: "On Track", address: "1820 Healing Way, Denver, CO", startDate: "2025-09-02", endDate: "2026-12-18", budget: 485e5, spent: 213e5, progress: 44, superintendentId: t[1].id },
          { name: "Union Tower Office", number: "MB-2402", client: "Union Realty Partners", type: "Commercial", status: "At Risk", address: "440 Market St, Denver, CO", startDate: "2025-11-10", endDate: "2027-03-22", budget: 322e5, spent: 189e5, progress: 58, superintendentId: t[1].id },
          { name: "Riverside K-8 School", number: "MB-2403", client: "Denver Public Schools", type: "Education", status: "On Track", address: "705 River Bend Dr, Denver, CO", startDate: "2026-01-15", endDate: "2026-11-30", budget: 198e5, spent: 41e5, progress: 21, superintendentId: t[1].id },
          { name: "Highland Lofts", number: "MB-2404", client: "Highland Living LLC", type: "Residential", status: "Planning", address: "3200 Lowell Blvd, Denver, CO", startDate: "2026-08-01", endDate: "2027-09-14", budget: 124e5, spent: 32e4, progress: 4, superintendentId: t[1].id }
        ];
        const p = [];
        for (const x of projectsSeed) {
          const [row] = await db.insert(projects).values(x).returning();
          p.push(row);
        }
        const tasksSeed = [
          { projectId: p[0].id, title: "Site work & utilities", trade: "Civil", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2025-11-15", startDate: "2025-09-02", endDate: "2025-11-15", seq: 1, dependsOn: null },
          { projectId: p[0].id, title: "Foundations & slab", trade: "Concrete", status: "Complete", priority: "High", assigneeId: t[3].id, dueDate: "2026-01-20", startDate: "2025-11-20", endDate: "2026-01-30", seq: 2, dependsOn: "1" },
          { projectId: p[0].id, title: "Structural steel \u2014 L1-L3", trade: "Steel", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-04-15", startDate: "2026-02-02", endDate: "2026-04-30", seq: 3, dependsOn: "2" },
          { projectId: p[0].id, title: "Level 3 deck pour", trade: "Concrete", status: "In Progress", priority: "High", assigneeId: t[3].id, dueDate: "2026-07-24", startDate: "2026-07-10", endDate: "2026-07-28", seq: 4, dependsOn: "3" },
          { projectId: p[0].id, title: "Electrical rough-in \u2014 ICU", trade: "Electrical", status: "Not Started", priority: "Medium", assigneeId: t[4].id, dueDate: "2026-08-02", startDate: "2026-07-25", endDate: "2026-08-20", seq: 5, dependsOn: "4" },
          { projectId: p[0].id, title: "HVAC duct install \u2014 L2", trade: "HVAC", status: "In Progress", priority: "Medium", assigneeId: t[5].id, dueDate: "2026-07-28", startDate: "2026-07-05", endDate: "2026-08-10", seq: 6, dependsOn: "3" },
          { projectId: p[0].id, title: "Curtainwall glazing", trade: "Glazing", status: "Blocked", priority: "High", assigneeId: null, dueDate: "2026-07-22", startDate: "2026-07-15", endDate: "2026-08-15", seq: 7, dependsOn: "3" },
          { projectId: p[0].id, title: "Framing \u2014 rooms 204-218", trade: "Framing", status: "In Progress", priority: "Low", assigneeId: t[6].id, dueDate: "2026-07-30", startDate: "2026-07-12", endDate: "2026-08-05", seq: 8, dependsOn: "4" }
        ];
        for (const x of tasksSeed) await db.insert(tasks).values(x);
        const rfisSeed = [
          { projectId: p[0].id, number: "RFI-014", subject: "Clearance at med-gas panels \u2014 ICU", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-12", dueDate: "2026-07-23" },
          { projectId: p[0].id, number: "RFI-015", subject: "Curtainwall anchor detail revision", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-15", dueDate: "2026-07-21" },
          { projectId: p[0].id, number: "RFI-012", subject: "Slab opening for mechanical chase", status: "Answered", assigneeId: t[2].id, dateCreated: "2026-06-28", dueDate: "2026-07-10" },
          { projectId: p[1].id, number: "RFI-031", subject: "Cooling tower load path clarification", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-16", dueDate: "2026-07-22" },
          { projectId: p[1].id, number: "RFI-029", subject: "Fire-rated assembly at stair 2", status: "Draft", assigneeId: t[2].id, dateCreated: "2026-07-18", dueDate: "2026-07-25" },
          { projectId: p[2].id, number: "RFI-006", subject: "Storm detention vault location", status: "Open", assigneeId: t[2].id, dateCreated: "2026-07-14", dueDate: "2026-07-24" }
        ];
        for (const x of rfisSeed) await db.insert(rfis).values(x);
        const subsSeed = [
          { projectId: p[0].id, number: "SUB-042", subject: "Curtainwall shop drawings", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-05-10", dueDate: "2026-05-24" },
          { projectId: p[0].id, number: "SUB-051", subject: "Med-gas piping \u2014 material certs", type: "Material", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-08", dueDate: "2026-07-22" },
          { projectId: p[0].id, number: "SUB-049", subject: "Structural steel connections", type: "Shop Drawing", status: "Revise", assigneeId: t[2].id, dateSubmitted: "2026-06-20", dueDate: "2026-07-05" },
          { projectId: p[1].id, number: "SUB-077", subject: "Cooling tower performance data", type: "Data", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-12", dueDate: "2026-07-26" },
          { projectId: p[2].id, number: "SUB-012", subject: "Storm detention vault precast", type: "Shop Drawing", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-06-15", dueDate: "2026-06-29" }
        ];
        for (const x of subsSeed) await db.insert(submittals).values(x);
        const coSeed = [
          { projectId: p[0].id, number: "CO-008", title: "Add 4th-floor terrace upgrade", status: "Approved", amount: 184e3, scheduleImpact: 5, dateIssued: "2026-06-12" },
          { projectId: p[0].id, number: "CO-011", title: "Med-gas manifold expansion", status: "Pending", amount: 96e3, scheduleImpact: 3, dateIssued: "2026-07-09" },
          { projectId: p[0].id, number: "CO-012", title: "Curtainwall IGU upgrade", status: "Pending", amount: 142e3, scheduleImpact: 0, dateIssued: "2026-07-15" },
          { projectId: p[1].id, number: "CO-021", title: "Cooling tower re-spec", status: "Pending", amount: 21e4, scheduleImpact: 7, dateIssued: "2026-07-17" },
          { projectId: p[1].id, number: "CO-019", title: "Lobby finish upgrade", status: "Approved", amount: 78e3, scheduleImpact: 0, dateIssued: "2026-06-28" }
        ];
        for (const x of coSeed) await db.insert(changeOrders).values(x);
        const aiSeed = [
          { projectId: p[0].id, title: "Confirm med-gas inspector availability", owner: "Priya Anand", status: "Open", priority: "High", dueDate: "2026-07-24", source: "OAC Meeting" },
          { projectId: p[0].id, title: "Send updated framing plan to Northside", owner: "Dana Whitfield", status: "Open", priority: "Medium", dueDate: "2026-07-23", source: "OAC Meeting" },
          { projectId: p[0].id, title: "Owner signage approval", owner: "Marcus Reyes", status: "Open", priority: "Low", dueDate: "2026-07-30", source: "Owner Call" },
          { projectId: p[1].id, title: "Schedule rigging engineer site visit", owner: "Dana Whitfield", status: "Open", priority: "Critical", dueDate: "2026-07-25", source: "Safety Stand-down" },
          { projectId: p[2].id, title: "Coordinate utility tie-in with city", owner: "Priya Anand", status: "In Progress", priority: "High", dueDate: "2026-07-28", source: "Precon Meeting" }
        ];
        for (const x of aiSeed) await db.insert(actionItems).values(x);
        const logsSeed = [
          { projectId: p[0].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 64, summary: "Level 3 deck formwork 80% set; electrical rough-in ongoing on Level 2; 3 concrete trucks delivered.", photos: null },
          { projectId: p[0].id, date: "2026-07-20", authorId: t[1].id, weather: "Sunny", temp: 91, crewCount: 58, summary: "Curtainwall framing on south elevation; HVAC duct install began on Level 2.", photos: null },
          { projectId: p[1].id, date: "2026-07-21", authorId: t[1].id, weather: "Partly cloudy", temp: 88, crewCount: 41, summary: "Drywall finishing Floor 9; crane lift delayed pending engineer sign-off on rigging plan.", photos: null },
          { projectId: p[2].id, date: "2026-07-21", authorId: t[1].id, weather: "Sunny", temp: 90, crewCount: 22, summary: "Site grading continued on east lot; storm line install 60% complete.", photos: null }
        ];
        for (const l of logsSeed) await db.insert(dailyLogs).values(l);
        const punchSeed = [
          { projectId: p[0].id, title: "Touch up drywall at Room 112 corner", location: "Level 1, Rm 112", trade: "Drywall", status: "Open", assigneeId: t[6].id },
          { projectId: p[0].id, title: "Missing outlet cover plates \u2014 east corridor", location: "Level 1, Corridor E", trade: "Electrical", status: "Open", assigneeId: t[4].id },
          { projectId: p[0].id, title: "Caulk joint at storefront door", location: "Main lobby", trade: "Glazing", status: "In Progress", assigneeId: null },
          { projectId: p[1].id, title: "Paint touch-up stair 4 landings", location: "Stair 4", trade: "Painting", status: "Open", assigneeId: null },
          { projectId: p[1].id, title: "Replace scratched door \u2014 Fl. 7 unit 712", location: "Fl. 7, Unit 712", trade: "Doors", status: "Open", assigneeId: t[6].id },
          { projectId: p[2].id, title: "Re-grade swale at southeast corner", location: "Southeast lot", trade: "Civil", status: "In Progress", assigneeId: t[3].id }
        ];
        for (const x of punchSeed) await db.insert(punchItems).values(x);
        const contactsSeed = [
          { name: "Dr. Helen Voss", company: "Lakeside Health System", role: "Owner Rep", trade: "Owner", type: "Owner", phone: "(303) 555-0142", email: "h.voss@lakesidehealth.org" },
          { name: "Raymond Soto", company: "Northwind Architects", role: "Lead Architect", trade: "Design", type: "Architect", phone: "(303) 555-0188", email: "rsoto@northwindarch.com" },
          { name: "Gloria Mendez", company: "Apex Concrete", trade: "Concrete", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0110", email: "gmendez@apexconcrete.com" },
          { name: "James Holloway", company: "Voltline Electric", trade: "Electrical", role: "Subcontractor PM", type: "Subcontractor", phone: "(720) 555-0155", email: "jh@voltline.com" },
          { name: "Nadia Bauer", company: "Summit Mechanical", trade: "HVAC", role: "Subcontractor PM", type: "Subcontractor", phone: "(303) 555-0190", email: "nadia@summitmech.com" },
          { name: "Owen Castillo", company: "City of Denver", role: "Building Inspector", trade: "Permitting", type: "Authority", phone: "(720) 555-0177", email: "ocastillo@denvergov.org" },
          { name: "Union Realty Partners", company: "Union Realty Partners", role: "Owner", trade: "Owner", type: "Owner", phone: "(303) 555-0201", email: "pm@unionrealty.com" }
        ];
        for (const x of contactsSeed) await db.insert(contacts).values(x);
        const eqSeed = [
          { name: "Link-Belt 80T Crane #1", type: "Crane", status: "On Site", projectId: p[0].id, operator: "T. Bradshaw", location: "North pad" },
          { name: "CAT 336 Excavator", type: "Excavator", status: "On Site", projectId: p[0].id, operator: "Rental", location: "East excavation" },
          { name: "Bobcat S650 Skid Steer", type: "Skid Steer", status: "On Site", projectId: p[2].id, operator: "Crew B", location: "East lot" },
          { name: "Genie S-105 Boom Lift", type: "Lift", status: "In Maintenance", projectId: p[0].id, operator: "\u2014", location: "Yard" },
          { name: "Tower Crane TC-60", type: "Crane", status: "On Site", projectId: p[1].id, operator: "Crane Co.", location: "Core" },
          { name: "Concrete Pump 52m", type: "Pump", status: "Off Site", projectId: null, operator: "Rental", location: "Return 7/24" }
        ];
        for (const x of eqSeed) await db.insert(equipment).values(x);
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
        for (const x of photoSeed) await db.insert(photos).values(x);
        const docSeed = [
          { projectId: p[0].id, name: "A-101 Floor Plans \u2014 Rev C.pdf", type: "Drawing", size: "8.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
          { projectId: p[0].id, name: "Structural Notes \u2014 S-001.pdf", type: "Drawing", size: "3.1 MB", uploadedById: t[2].id, date: "2026-07-01" },
          { projectId: p[0].id, name: "Owner-Architect Agreement.pdf", type: "Contract", size: "1.2 MB", uploadedById: t[0].id, date: "2025-08-20" },
          { projectId: p[0].id, name: "Building Permit \u2014 BLD-2026-0441.pdf", type: "Permit", size: "0.6 MB", uploadedById: t[2].id, date: "2025-08-28" },
          { projectId: p[1].id, name: "Cooling Tower Submittal Log.xlsx", type: "Spec", size: "0.4 MB", uploadedById: t[2].id, date: "2026-07-12" },
          { projectId: p[2].id, name: "Site Civil \u2014 Demolition Plan.pdf", type: "Drawing", size: "5.7 MB", uploadedById: t[2].id, date: "2026-06-30" }
        ];
        for (const x of docSeed) await db.insert(documents).values(x);
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
        for (const x of bpSeed) await db.insert(blueprints).values(x);
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
        for (const x of droneSeed) await db.insert(droneCaptures).values(x);
        const msgSeed = [
          { projectId: p[0].id, authorId: t[1].id, body: "Deck pour for Level 3 is on for Friday \u2014 need 3 trucks at 7am. Confirm barricades are reset by Thursday EOD.", createdAt: "2026-07-21T08:12:00" },
          { projectId: p[0].id, authorId: t[4].id, body: "Understood. Voltline will be clear of the pour area by 6pm Thursday. Med-gas rough-in on L2 is separate and unaffected.", createdAt: "2026-07-21T08:24:00" },
          { projectId: p[0].id, authorId: t[2].id, body: "Owner asked for updated progress photos of the curtainwall \u2014 I'll pull from the photo log and send the deck by 3pm.", createdAt: "2026-07-21T09:02:00" },
          { projectId: p[0].id, authorId: t[0].id, body: "Good. Let's also flag the glazing RFI status in tomorrow's OAC. It's the one holding the south elevation.", createdAt: "2026-07-21T09:15:00" }
        ];
        for (const x of msgSeed) await db.insert(messages).values(x);
        const noteSeed = [
          { projectId: p[0].id, body: "Concrete pour Friday 7am \u2014 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40 },
          { projectId: p[0].id, body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90 },
          { projectId: p[0].id, body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50 },
          { projectId: p[0].id, body: "Inspector confirmed for med-gas \u2014 keep L2 ICU clear.", color: "emerald", x: 120, y: 220 }
        ];
        for (const x of noteSeed) await db.insert(notes).values(x);
        const milestoneSeed = [
          { projectId: p[0].id, title: "Building permit issued", date: "2025-08-20", kind: "Permit", status: "Complete", notes: "City of Denver \u2014 approved on first submission" },
          { projectId: p[0].id, title: "Foundation complete", date: "2026-02-05", kind: "Foundation", status: "Complete", notes: null },
          { projectId: p[0].id, title: "Structural topout \u2014 L3", date: "2026-05-08", kind: "Structure", status: "Complete", notes: null },
          { projectId: p[0].id, title: "Curtainwall dry-in", date: "2026-08-20", kind: "Envelope", status: "At Risk", notes: "RFI-015 blocking south elevation glazing" },
          { projectId: p[0].id, title: "MEP rough-in complete", date: "2026-10-15", kind: "MEP", status: "Upcoming", notes: null },
          { projectId: p[0].id, title: "TCO \u2014 Temporary Cert. of Occupancy", date: "2026-11-30", kind: "TCO", status: "Upcoming", notes: null },
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
          { projectId: p[2].id, title: "Substantial completion \u2014 ready for school year", date: "2026-11-30", kind: "Closeout", status: "Upcoming", notes: "Must be turned over before Aug 2027 school year" }
        ];
        for (const x of milestoneSeed) await db.insert(milestones).values(x);
        try {
          const existingAcc = await db.select().from(accounts);
          if (existingAcc.length === 0) {
            await this.createAccount(
              "demo@trusspath.app",
              "trusspath",
              "Marcus Reyes",
              "Meridian Builders",
              "owner"
            );
          }
        } catch {
        }
        seedDone = true;
      }
    };
    seedDone = false;
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
      "/cpm",
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
      "/company-documents",
      "/blueprints",
      "/equipment",
      "/drone",
      "/team",
      "/contacts",
      "/messages",
      "/notes",
      "/deleted-items",
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
          { href: "/gantt", label: "Gantt", icon: "GanttChartSquare" },
          { href: "/cpm", label: "CPM Diagram", icon: "Network" }
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
          { href: "/company-documents", label: "Company Documents", icon: "Building2" },
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
          { href: "/deleted-items", label: "Deleted Items", icon: "Trash2" },
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
async function runHealthScan() {
  const brokenLinks = APP_LINKS.filter((l) => !isKnownRoute(l.href)).map((l) => ({ href: l.href, label: l.label, source: l.source }));
  const projects2 = await storage.getProjects();
  const pid2 = projects2[0]?.id;
  const mods = [
    ["Projects", async () => storage.getProjects()],
    ["Tasks", async () => storage.getTasks(pid2)],
    ["RFIs", async () => storage.getRfis(pid2)],
    ["Submittals", async () => storage.getSubmittals(pid2)],
    ["Change Orders", async () => storage.getChangeOrders(pid2)],
    ["Action Items", async () => storage.getActionItems(pid2)],
    ["Daily Logs", async () => storage.getDailyLogs(pid2)],
    ["Punch Items", async () => storage.getPunchItems(pid2)],
    ["Team", async () => storage.getTeam()],
    ["Contacts", async () => storage.getContacts()],
    ["Equipment", async () => storage.getEquipment(pid2)],
    ["Photos", async () => storage.getPhotos(pid2)],
    ["Documents", async () => storage.getDocuments(pid2)],
    ["Blueprints", async () => storage.getBlueprints(pid2)],
    ["Drone Captures", async () => storage.getDroneCaptures(pid2)],
    ["Messages", async () => pid2 ? storage.getMessages(pid2) : []],
    ["Notes", async () => storage.getNotes(pid2)],
    ["Integrations", async () => storage.getIntegrations()]
  ];
  const moduleChecks = [];
  for (const [name, fn] of mods) {
    try {
      const rows = await fn();
      moduleChecks.push({ name, status: "ok", detail: `${rows.length} records` });
    } catch (e) {
      moduleChecks.push({ name, status: "fail", detail: e?.message ?? "error reading module" });
    }
  }
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

// server/apis.ts
var apis_exports = {};
__export(apis_exports, {
  getNearbyPlaces: () => getNearbyPlaces,
  getWeather: () => getWeather,
  hasPlacesApi: () => hasPlacesApi,
  hasWeatherApi: () => hasWeatherApi
});
async function geocodeOpenMeteo(address) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return { lat: hit.latitude, lon: hit.longitude, name: hit.name };
  } catch {
    return null;
  }
}
async function geocodeGoogle(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.results?.[0];
    if (!hit) return null;
    return {
      lat: hit.geometry.location.lat,
      lon: hit.geometry.location.lng,
      name: hit.formatted_address || address
    };
  } catch {
    return null;
  }
}
async function geocode(address) {
  return await geocodeGoogle(address) || await geocodeOpenMeteo(address);
}
async function getWeather(address) {
  const geo = await geocode(address);
  if (!geo) return null;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=3`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data?.current;
    const daily = data?.daily;
    if (!cur) return null;
    const temp = Math.round(cur.temperature_2m);
    const feelsLike = Math.round(cur.apparent_temperature);
    const wind = Math.round(cur.wind_speed_10m);
    const precip = cur.precipitation;
    const humidity = Math.round(cur.relative_humidity_2m);
    const desc2 = WEATHER_CODES[cur.weather_code] || "current conditions";
    const locationName = geo.name;
    let response = `Here's the weather at ${locationName} right now:

`;
    response += `It's ${temp} degrees and ${desc2}, feels like ${feelsLike} degrees. `;
    response += `Wind's at ${wind} miles per hour`;
    if (precip > 0) response += `, with ${precip} inches of precipitation`;
    response += `. Humidity is at ${humidity} percent.

`;
    const safetyNotes = [];
    if (temp >= 90) {
      safetyNotes.push("That's hot \u2014 make sure everyone's hydrating, taking shade breaks, and watching for signs of heat illness. Schedule the heavy work for early morning if you can.");
    } else if (temp >= 80) {
      safetyNotes.push("It's warm out there \u2014 keep water on site and remind the crew to stay hydrated.");
    }
    if (wind >= 20) {
      safetyNotes.push("Wind's picking up \u2014 be careful with crane operations and anything at height. Most manufacturers say to stop lifts at twenty miles per hour sustained, some lower.");
    }
    if (cur.weather_code >= 95) {
      safetyNotes.push("Thunderstorms in the area \u2014 use the thirty/thirty rule. If you hear thunder within thirty seconds of lightning, get to shelter, and wait thirty minutes after the last thunder before going back out.");
    }
    if (precip > 0.1) {
      safetyNotes.push("There's active precipitation \u2014 watch for slippery surfaces, mud, and trench stability issues.");
    }
    if (safetyNotes.length) {
      response += "Heads up for the crew:\n";
      response += safetyNotes.map((n) => `- ${n}`).join("\n");
      response += "\n\n";
    }
    if (daily && daily.time && daily.time.length > 1) {
      response += "Next couple of days:\n";
      for (let i = 1; i < Math.min(3, daily.time.length); i++) {
        const dayName = new Date(daily.time[i]).toLocaleDateString("en-US", { weekday: "short" });
        const hi = Math.round(daily.temperature_2m_max[i]);
        const lo = Math.round(daily.temperature_2m_min[i]);
        const rainChance = daily.precipitation_probability_max?.[i] ?? 0;
        const dayDesc = WEATHER_CODES[daily.weather_code?.[i] ?? 0] || "variable";
        response += `- ${dayName}: ${lo} to ${hi} degrees, ${dayDesc}, ${rainChance}% chance of rain
`;
      }
    }
    return response;
  } catch {
    return null;
  }
}
async function getNearbyPlaces(address, query) {
  if (!GOOGLE_MAPS_KEY) return null;
  const lower = query.toLowerCase();
  let placeType = "restaurant";
  for (const [keyword, type] of Object.entries(PLACE_TYPES)) {
    if (lower.includes(keyword)) {
      placeType = type;
      break;
    }
  }
  const geo = await geocodeGoogle(address);
  if (!geo) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${geo.lat},${geo.lon}&radius=5000&type=${placeType}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results;
    if (!results || results.length === 0) return null;
    const top = results.slice(0, 5);
    const typeLabel = placeType === "restaurant" ? "lunch spots" : placeType.replace(/_/g, " ");
    let response = `Here are some ${typeLabel} near ${geo.name}:

`;
    for (let i = 0; i < top.length; i++) {
      const place = top[i];
      const name = place.name;
      const rating = place.rating ? `${place.rating} stars` : "no rating";
      const vicinity = place.vicinity || "";
      const open = place.opening_hours?.open_now === true ? "open now" : place.opening_hours?.open_now === false ? "closed" : "";
      const priceStr = place.price_level ? "$".repeat(place.price_level) : "";
      response += `${i + 1}. ${name} \u2014 ${rating}${priceStr ? `, ${priceStr}` : ""}${open ? `, ${open}` : ""}
   ${vicinity}
`;
    }
    response += "\nThese are within about three miles of your site. For directions, maps.google.com has you covered.";
    return response;
  } catch {
    return null;
  }
}
function hasWeatherApi() {
  return true;
}
function hasPlacesApi() {
  return !!GOOGLE_MAPS_KEY;
}
var GOOGLE_MAPS_KEY, WEATHER_CODES, PLACE_TYPES;
var init_apis = __esm({
  "server/apis.ts"() {
    "use strict";
    GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY || "";
    WEATHER_CODES = {
      0: "clear skies",
      1: "mostly clear",
      2: "partly cloudy",
      3: "overcast",
      45: "foggy",
      48: "freezing fog",
      51: "light drizzle",
      53: "drizzle",
      55: "heavy drizzle",
      61: "light rain",
      63: "rain",
      65: "heavy rain",
      66: "freezing rain",
      67: "heavy freezing rain",
      71: "light snow",
      73: "snow",
      75: "heavy snow",
      77: "snow grains",
      80: "light rain showers",
      81: "rain showers",
      82: "heavy rain showers",
      85: "snow showers",
      86: "heavy snow showers",
      95: "thunderstorms",
      96: "thunderstorms with hail",
      99: "severe thunderstorms with hail"
    };
    PLACE_TYPES = {
      lunch: "restaurant",
      food: "restaurant",
      eat: "restaurant",
      restaurant: "restaurant",
      hungry: "restaurant",
      dinner: "restaurant",
      breakfast: "restaurant",
      coffee: "cafe",
      hardware: "hardware_store",
      supplies: "hardware_store",
      material: "hardware_store",
      hotel: "lodging",
      motel: "lodging",
      lodging: "lodging",
      gas: "gas_station",
      fuel: "gas_station"
    };
  }
});

// server/jarvis.ts
function buildPersona(s = {}) {
  const term = s.addressTerm?.trim() || "sir";
  const tone = s.tone === "detailed" ? "detailed" : "concise";
  const length = tone === "detailed" ? "You may go into more depth when it helps, but stay organized." : "Keep answers short unless asked for detail.";
  return `You are Jarvis, the AI assistant inside TrussPath, a field construction project management platform.
You speak like a knowledgeable, friendly colleague \u2014 not a robot. Use contractions (I'm, can't, here's, that's). Be warm but professional. Be concise \u2014 don't over-explain or pad answers with filler.
Address the user as "${term}". Write numbers the way a person would say them out loud \u2014 "five thousand pounds" not "5,000 lbs", "six feet" not "6ft", "eighty-five decibels" not "85dB". Read dollar amounts naturally \u2014 "fifty grand" or "fifty thousand dollars" depending on context. Percentages should sound conversational \u2014 "around ten percent" not "10%".
Avoid ALL CAPS headers, robotic phrasing, or overly formatted lists. Use natural transitions instead of section headers. Bullet points are fine when there's a real list, but keep them short and conversational.
You have live read-only access to the project's data (tasks, RFIs, submittals, change orders, action items, team). Use it to give accurate, actionable answers.
You cannot write data yourself. When the user asks to create or change something, tell them what to do and which tab to use, and offer to help draft the wording.
You can run an APP HEALTH SCAN to find broken links or non-working modules. When the user asks about broken links, app health, what's broken, or what doesn't work, use the supplied scan results to answer concretely.
You're also a knowledgeable general assistant. Answer everyday questions helpfully:
- Weather \u2014 you have LIVE weather data when the project has an address set. Give current temperature, conditions, wind, humidity, and a 3-day forecast. Include construction-relevant safety notes for heat, wind, storms, or precipitation when applicable. If no weather data is available, suggest weather.gov or the OSHA-NIOSH Heat Safety app.
- Lunch/restaurants \u2014 when Google Maps is connected, you can find real nearby restaurants, coffee shops, and other places. When it's not connected, suggest checking Google Maps or Yelp near the site, mention food trucks and meal prep tips. Be practical.
- Construction safety \u2014 provide thorough OSHA-compliant guidance on PPE, fall protection, excavation, electrical safety, heat stress, toolbox talks, etc.
- General knowledge \u2014 answer questions on any topic. Be helpful, concise, and accurate.
You can LEARN from the user. When you don't know something, ask the user to tell you the answer and say you'll remember it. If the user says "remember that...", acknowledge that you've saved it.
When you don't know something, just say so \u2014 don't guess.
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
async function buildContext(projectId) {
  const p = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const pid2 = p?.id;
  const tasks2 = await storage.getTasks(pid2);
  const rfis2 = await storage.getRfis(pid2);
  const subs = await storage.getSubmittals(pid2);
  const cos = await storage.getChangeOrders(pid2);
  const actions = await storage.getActionItems(pid2);
  const team = await storage.getTeam();
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
  const { compact } = await buildContext(projectId);
  const settings = await storage.getSettings();
  const persona = buildPersona(settings);
  const client = new import_openai.default();
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lowerUser = lastUser.toLowerCase();
  const scanBlock = HEALTH_INTENT.test(lastUser) ? `

--- APP HEALTH SCAN (live) ---
${formatScan(await runHealthScan())}` : "";
  const safetyBriefIntent = SAFETY_BRIEF_INTENT.test(lowerUser);
  let liveApiBlock = "";
  const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const address = project?.address;
  if (address) {
    if (safetyBriefIntent || /\b(weather|forecast|temperature|how hot|how cold|raining|rain|snow|wind|storm)\b/i.test(lowerUser)) {
      const { getWeather: getWeather2 } = await Promise.resolve().then(() => (init_apis(), apis_exports));
      const weather = await getWeather2(address);
      if (weather) liveApiBlock += `

--- LIVE WEATHER DATA ---
${weather}`;
    }
    if (/\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee|hardware|supplies|hotel|gas)\b/i.test(lowerUser)) {
      const { getNearbyPlaces: getNearbyPlaces2, hasPlacesApi: hasPlacesApi2 } = await Promise.resolve().then(() => (init_apis(), apis_exports));
      if (hasPlacesApi2()) {
        const places = await getNearbyPlaces2(address, lowerUser);
        if (places) liveApiBlock += `

--- LIVE NEARBY PLACES ---
${places}`;
      }
    }
  }
  const safetyBriefBlock = safetyBriefIntent ? `

The user is asking for a TEAM SAFETY BRIEF. Generate a comprehensive safety briefing suitable for a superintendent to read aloud to the crew at the start of the day. Include:
1. Date and project name
2. Current weather conditions (use the live weather data if available) and weather-related safety warnings
3. Seasonal hazards relevant to the current time of year
4. Two rotating safety topics from this list: fall protection, PPE, trenching/excavation, electrical safety/lockout-tagout, material handling/crane ops, housekeeping/trip hazards, hand/power tools, hot work/fire prevention
5. Any project-specific safety concerns (overdue work, due-today items that could create pressure to rush)
6. A strong closing reminder about everyone going home safe

Keep it conversational \u2014 like a real superintendent talking, not a textbook. Write numbers out naturally. Use contractions.
` : "";
  const resp = await client.responses.create({
    model: MODEL,
    instructions: `${persona}${safetyBriefBlock}

--- LIVE PROJECT DATA ---
${compact}${scanBlock}${liveApiBlock}`,
    input: history.map((m) => ({ role: m.role, content: m.content }))
  });
  return { reply: resp.output_text ?? "" };
}
async function jarvisBrief(projectId) {
  const context = await buildContext(projectId);
  const settings = await storage.getSettings();
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
var import_openai, MODEL, HEALTH_INTENT, SAFETY_BRIEF_INTENT;
var init_jarvis = __esm({
  "server/jarvis.ts"() {
    "use strict";
    import_openai = __toESM(require("openai"), 1);
    init_storage();
    init_health();
    MODEL = "gpt_5_1";
    HEALTH_INTENT = /\b(broken|health|scan|not work|doesn'?t work|don'?t work|broken link|issues? in the app|what'?s broken|integrity)\b/i;
    SAFETY_BRIEF_INTENT = /\b(safety brief|safety briefing|toolbox talk|safety meeting|team safety|give me a safety|generate a safety|safety stand)\b/i;
  }
});

// server/jarvis-local.ts
function matchPatterns(input, patterns) {
  const lower = input.toLowerCase().trim();
  for (const p of patterns) {
    if (p.keywords.some((k) => lower.includes(k))) {
      return p.answer;
    }
  }
  return null;
}
function buildLocalBrief(ctx) {
  const lines = ctx.compact.split("\n");
  const projectLine = lines[0] ?? "No active project found.";
  const today2 = lines[1] ?? "";
  const overdueLines = lines.filter((l) => l.includes("OVERDUE"));
  const dueTodayLines = lines.filter((l) => l.includes("DUE TODAY"));
  const priorities = [];
  if (overdueLines.length) priorities.push(`You've got overdue items \u2014 ${overdueLines.length} ${overdueLines.length === 1 ? "category has" : "categories have"} work that's slipped past the due date`);
  if (dueTodayLines.length) priorities.push("Some items are due today, so make sure the right people are on them");
  if (!priorities.length) priorities.push("Nothing urgent \u2014 everything's on track");
  const overdue2 = overdueLines.length ? overdueLines.join("\n") : "Nothing overdue, which is great.";
  return `Here's your morning briefing.

${projectLine}
${today2}

Priorities:
${priorities.map((p) => `- ${p}`).join("\n")}

Overdue:
${overdue2}

One thing to stay on top of \u2014 check the Schedule tab for any milestones coming up, and make sure everyone on the team has their tasks assigned.`;
}
function seasonalHazards() {
  const month = (/* @__PURE__ */ new Date()).getMonth();
  const hazards = [];
  if (month >= 5 && month <= 7) {
    hazards.push(
      "Heat stress is the top concern right now. Provide shade and at least a quart of cool water per person per hour. Schedule heavy work for early morning. Watch for signs of heat exhaustion \u2014 heavy sweating, dizziness, nausea. If someone stops sweating or gets confused, that's heat stroke \u2014 call nine-one-one immediately."
    );
    hazards.push(
      "Afternoon thunderstorms are common this time of year, especially in Colorado. Keep an eye on the sky. If you hear thunder within thirty seconds of lightning, get everyone to shelter and wait thirty minutes after the last thunder before going back out."
    );
  } else if (month >= 8 && month <= 10) {
    hazards.push(
      "Mornings are getting cold and frosty. Watch for slippery surfaces, especially scaffolding, ladders, and metal decking. Give surfaces time to dry or de-ice before starting work."
    );
    hazards.push(
      "Shorter days mean less daylight. Make sure all work areas have adequate temporary lighting, and plan to wrap up exterior work before dusk. High-visibility vests are a must for everyone on site."
    );
  } else if (month === 11 || month <= 1) {
    hazards.push(
      "Winter conditions \u2014 ice and snow accumulation on scaffolds, ladders, roofs, and walkways. Clear snow and ice before work begins. Salt or sand walkways. No one works on an icy roof, period."
    );
    hazards.push(
      "Cold stress is real. Dress in layers, take warm-up breaks, and watch for frostbite and hypothermia. Fingers, toes, ears, and nose go first. If someone gets sluggish or confused in the cold, get them warm and inside immediately."
    );
  } else {
    hazards.push(
      "Spring weather is unpredictable \u2014 watch for sudden rain, wind, and temperature swings. Rain makes surfaces slippery and can destabilize trenches. Inspect excavations after any rain before sending anyone in."
    );
    hazards.push(
      "Mud and soft ground conditions \u2014 make sure equipment has stable footing and access roads are maintained. Watch for rutting that could cause equipment to tip."
    );
  }
  return hazards;
}
async function buildSafetyBrief(projectId) {
  const ctx = await buildContext(projectId);
  const lines = ctx.compact.split("\n");
  const projectLine = lines[0] ?? "No active project found.";
  const todayLine = lines[1] ?? "";
  const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
  const address = project?.address;
  let weatherBlock = "";
  if (address) {
    try {
      const weather = await getWeather(address);
      if (weather) {
        weatherBlock = weather;
      }
    } catch {
    }
  }
  const dayOfYear = Math.floor((Date.now() - new Date((/* @__PURE__ */ new Date()).getFullYear(), 0, 0).getTime()) / 864e5);
  const topic1 = DAILY_SAFETY_TOPICS[dayOfYear % DAILY_SAFETY_TOPICS.length];
  const topic2 = DAILY_SAFETY_TOPICS[(dayOfYear + 3) % DAILY_SAFETY_TOPICS.length];
  const seasonal = seasonalHazards();
  const overdueLines = lines.filter((l) => l.includes("OVERDUE"));
  const dueTodayLines = lines.filter((l) => l.includes("DUE TODAY"));
  let brief = `TEAM SAFETY BRIEF \u2014 ${dateStr}
`;
  brief += `${projectLine}
`;
  brief += `${todayLine}

`;
  if (weatherBlock) {
    brief += `WEATHER CONDITIONS
`;
    brief += `${weatherBlock}

`;
  } else {
    brief += `WEATHER CONDITIONS
`;
    brief += `Check local conditions before starting. weather.gov and the OSHA-NIOSH Heat Safety app are your best bet for real-time info.

`;
  }
  brief += `SEASONAL HAZARDS
`;
  for (const h of seasonal) {
    brief += `- ${h}
`;
  }
  brief += `
`;
  brief += `TODAY'S SAFETY TOPICS
`;
  brief += `${topic1.title}
${topic1.body}

`;
  brief += `${topic2.title}
${topic2.body}

`;
  if (overdueLines.length || dueTodayLines.length) {
    brief += `PROJECT-SPECIFIC ITEMS
`;
    if (overdueLines.length) {
      brief += `- You've got overdue work across ${overdueLines.length} ${overdueLines.length === 1 ? "category" : "categories"}. Rushed work leads to mistakes and injuries. Make sure the crew has the time and resources to do it right.
`;
    }
    if (dueTodayLines.length) {
      brief += `- Items due today \u2014 confirm the right people are assigned and have what they need. Don't let deadlines push safety shortcuts.
`;
    }
    brief += `
`;
  }
  brief += `REMEMBER
`;
  brief += `Everyone goes home the way they came in. If you see something unsafe, stop work and fix it. No deadline is worth a injury. Speak up \u2014 your crew is counting on you.

`;
  brief += `Questions? Ask your superintendent or site safety officer. Stay sharp out there.`;
  return brief;
}
async function localJarvisChat(projectId, history) {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase().trim();
  const teachMatch = lower.match(/^(?:remember|note|store|save|for this site|jarvis[,\s]+remember|jarvis[,\s]+note|jarvis[,\s]+save)[\s:,]+(.+)/i);
  if (teachMatch) {
    const fact = teachMatch[1].trim();
    const topic2 = inferTopic(fact);
    try {
      await storage.createJarvisMemory({
        projectId: projectId ?? null,
        question: fact,
        normalizedQuestion: normalizeQuestion(fact),
        topic: topic2 || void 0,
        answer: fact,
        status: "learned",
        source: "user_taught"
      });
      return { reply: `Got it \u2014 I'll remember that for next time${topic2 ? ` (filed under ${topic2})` : ""}. Anything else you want me to keep track of?` };
    } catch {
      return { reply: "I tried to save that but ran into an issue. Try again in a moment." };
    }
  }
  const prevAssistant = [...history].reverse().find((m, i, arr) => m.role === "assistant" && i > 0);
  if (prevAssistant && /teach me|i don'?t have that|if you tell me|note that as|save that|i'?ll remember/i.test(prevAssistant.content)) {
    const prevUserMsg = [...history].reverse().find((m, i, arr) => m.role === "user" && i > 0);
    if (prevUserMsg) {
      const pendingQuestion = prevUserMsg.content;
      const topic2 = inferTopic(pendingQuestion) || inferTopic(lastUser);
      try {
        const memories = await storage.getJarvisMemories(projectId);
        const existing = memories.find((m) => m.status === "pending" && m.normalizedQuestion === normalizeQuestion(pendingQuestion));
        if (existing) {
          await storage.updateJarvisMemory(existing.id, {
            answer: lastUser,
            status: "learned"
          });
        } else {
          await storage.createJarvisMemory({
            projectId: projectId ?? null,
            question: pendingQuestion,
            normalizedQuestion: normalizeQuestion(pendingQuestion),
            topic: topic2 || void 0,
            answer: lastUser,
            status: "learned",
            source: "user_taught"
          });
        }
        return { reply: `Perfect, I've got that saved now${topic2 ? ` under ${topic2}` : ""}. Next time you ask, I'll have it ready. Anything else?` };
      } catch {
      }
    }
  }
  try {
    const learned = await storage.searchJarvisMemory(lastUser, projectId);
    if (learned && learned.answer) {
      return { reply: learned.answer };
    }
  } catch {
  }
  if (/\b(weather|forecast|temperature|how hot|how cold|raining|rain|snow|wind|storm)\b/i.test(lower)) {
    try {
      const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
      const address = project?.address;
      if (address) {
        const weather = await getWeather(address);
        if (weather) return { reply: weather };
      }
      return {
        reply: `I couldn't pull live weather for your project. Make sure the project has an address set, and I'll fetch conditions automatically. In the meantime, check weather.gov or the OSHA-NIOSH Heat Safety app for real-time conditions on site.

If you've got a weather tip specific to your area, just say "remember that..." and I'll save it for next time.`
      };
    } catch {
    }
  }
  if (hasPlacesApi() && /\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee|hardware|supplies|hotel|motel|gas|fuel)\b/i.test(lower)) {
    try {
      const project = projectId ? await storage.getProject(projectId) : (await storage.getProjects())[0];
      const address = project?.address;
      if (address) {
        const places = await getNearbyPlaces(address, lower);
        if (places) return { reply: places };
      }
    } catch {
    }
  }
  if (/\b(broken|health|scan|not work|doesn'?t work|what'?s broken|integrity)\b/i.test(lower)) {
    try {
      const scan = await runHealthScan();
      const failing = scan.moduleChecks.filter((c) => c.status === "fail");
      const lines = [
        `Ran a health scan \u2014 ${scan.ok ? "everything looks good." : "found some issues."}`,
        `Checked ${scan.linkCount} links and ${scan.brokenLinks.length} ${scan.brokenLinks.length === 1 ? "is" : "are"} broken.`,
        `Scanned ${scan.moduleChecks.length} modules and ${failing.length} ${failing.length === 1 ? "is" : "are"} failing.`
      ];
      if (scan.brokenLinks.length) lines.push("Broken links: " + scan.brokenLinks.map((l) => `${l.label} -> ${l.href}`).join(" | "));
      if (failing.length) lines.push("Failing: " + failing.map((c) => `${c.name} (${c.detail})`).join(" | "));
      return { reply: lines.join("\n") };
    } catch {
      return { reply: "I tried running a health scan but ran into an error. It might not be available in this environment." };
    }
  }
  if (/\b(safety brief|safety briefing|toolbox talk|safety meeting|team safety|give me a safety|generate a safety|safety stand)\b/i.test(lower)) {
    try {
      const brief = await buildSafetyBrief(projectId);
      return { reply: brief };
    } catch {
      return { reply: "I tried generating a safety brief but ran into an issue. Make sure you have a project selected with an address set, and I'll pull live weather data into it too." };
    }
  }
  if (/\b(brief|briefing|status|update|summary|overview|morning|standup|what'?s happening|what'?s the status|overdue|what.?s due)\b/i.test(lower)) {
    const ctx = await buildContext(projectId);
    return { reply: buildLocalBrief(ctx) };
  }
  if (/\bhow many\b/i.test(lower)) {
    const ctx = await buildContext(projectId);
    const tasksLine = ctx.compact.split("\n").find((l) => l.startsWith("TASKS:"));
    const rfiLine = ctx.compact.split("\n").find((l) => l.startsWith("RFIS:"));
    const subLine = ctx.compact.split("\n").find((l) => l.startsWith("SUBMITTALS:"));
    const coLine = ctx.compact.split("\n").find((l) => l.startsWith("CHANGE ORDERS:"));
    return { reply: `Here's where things stand right now:
${tasksLine}
${rfiLine}
${subLine}
${coLine}` };
  }
  const greeting = matchPatterns(lastUser, GREETING_PATTERNS);
  if (greeting) return { reply: greeting };
  const qa = matchPatterns(lastUser, CONSTRUCTION_QA);
  if (qa) return { reply: qa };
  if (/\b(what is|what's|tell me about|explain|how do|how does|what are)\b/i.test(lower)) {
    if (/\b(safety|osha|safe)\b/i.test(lower)) {
      return { reply: "Construction safety covers a lot of ground. You can ask me specifically about:\n- PPE (personal protective equipment)\n- Fall protection\n- Excavation and trenching safety\n- Electrical safety and lockout/tagout\n- Heat stress prevention\n- Toolbox talks\n- General site safety protocols\n\nWhat area are you most interested in?" };
    }
    if (/\b(weather|rain|snow|wind|storm|temperature)\b/i.test(lower)) {
      return { reply: "I can't pull live weather yet, but for site planning I'd recommend:\n- weather.gov for forecasts and severe weather alerts\n- The OSHA-NIOSH Heat Safety app for the heat index\n- Lightning thirty/thirty rule \u2014 if thunder follows lightning by less than thirty seconds, get to shelter, and wait thirty minutes after the last thunder\n- Crane ops should stop at twenty-plus mile-per-hour sustained winds (check your manufacturer specs though)\n\nIf we connect a weather API, I can pull live conditions for you right here." };
    }
    if (/\b(lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee)\b/i.test(lower)) {
      return { reply: "I can't browse restaurants yet, but for site lunch planning:\n- Check Google Maps or Yelp for spots within ten or fifteen minutes of your site\n- Look for quick service \u2014 delis, food trucks, fast-casual\n- A lot of sites bring a food truck on-site for lunch\n- Meal prep with a cooler saves time and money\n- Stay hydrated, especially in summer" };
    }
    return { reply: `That's a good one. I've got solid knowledge on construction topics \u2014 RFIs, change orders, submittals, safety protocols, PPE, OSHA standards, fall protection, heat stress, you name it. I also have your live project data, so I can tell you what's overdue or give you a status update.

For general questions like weather or lunch spots, I can point you in the right direction. And if I'm connected to the full AI model, I can answer just about anything.

What else would you like to know?` };
  }
  if (/\b(where|how|which tab|navigate|find|go to)\b/i.test(lower)) {
    const navMap = [
      { keywords: ["task", "to do", "todo", "work item"], answer: "Tasks are under the Tasks tab. Hit 'New Task' to create one, and you can switch between list and board views." },
      { keywords: ["rfi", "question", "clarification"], answer: "RFIs are under the RFIs tab. Just click 'New RFI' to submit one." },
      { keywords: ["submittal", "shop drawing", "product data"], answer: "Submittals are under the Submittals tab. That's where you track shop drawings, product data, and samples." },
      { keywords: ["change order", "co ", "variation"], answer: "Change Orders are under the Change Orders tab. You can document scope changes with amounts and schedule impact there." },
      { keywords: ["punch", "deficiency", "correction", "punch list"], answer: "Punch List items are under the Punch List tab. That's where you track anything needing correction before closeout." },
      { keywords: ["daily log", "daily report", "site report"], answer: "Daily Logs are under the Daily Logs tab. Record the weather, crew, and what got done each day." },
      { keywords: ["calendar", "schedule", "event", "meeting"], answer: "The Schedule tab shows a calendar with all your project dates. You can add events, meetings, and milestones there." },
      { keywords: ["gantt", "chart", "timeline", "bar chart"], answer: "The Gantt chart is under the Schedule tab \u2014 just click the Gantt button. It lays out your tasks as bars across a timeline." },
      { keywords: ["team", "member", "people", "crew", "assignee"], answer: "Team members are under the Team tab. Add people, assign roles, keep everyone organized." },
      { keywords: ["setting", "config", "preferences"], answer: "Settings are under the Settings tab. You can configure your name, tone, and manage data from there." },
      { keywords: ["project", "new project", "create project"], answer: "Projects are on the Projects page. Click 'New Project' to create one, or click a project card to view details and edit." }
    ];
    const nav = matchPatterns(lastUser, navMap);
    if (nav) return { reply: nav };
  }
  const topic = inferTopic(lastUser);
  try {
    const memories = await storage.getJarvisMemories(projectId);
    const alreadyPending = memories.find(
      (m) => m.status === "pending" && m.normalizedQuestion === normalizeQuestion(lastUser)
    );
    if (!alreadyPending) {
      await storage.createJarvisMemory({
        projectId: projectId ?? null,
        question: lastUser,
        normalizedQuestion: normalizeQuestion(lastUser),
        topic: topic || void 0,
        answer: null,
        status: "pending",
        source: "user_taught"
      });
    }
  } catch {
  }
  if (topic) {
    return {
      reply: `I don't have an answer for that one yet${topic === "lunch" ? " \u2014 I can't browse restaurants from here" : ""}. But here's the thing \u2014 if you tell me the answer, I'll remember it for next time.

Just say something like "remember that the best lunch spot near this site is Jimmy's Deli" and I'll file it away. Next time you ask, I'll have it ready.

What would you like to know?`
    };
  }
  return {
    reply: `I'm not quite sure I caught that. Here's what I can help with:

- Construction questions \u2014 RFIs, change orders, submittals, safety protocols, PPE, OSHA standards
- General stuff \u2014 weather guidance, lunch spots, the time, jokes
- Project data \u2014 "what's overdue?", "give me a briefing", "how many tasks are open?"
- Navigation \u2014 "where do I create a task?", "how do I find the Gantt chart?"
- App health \u2014 "is anything broken?"

And if there's something I don't know, just tell me the answer and I'll remember it for next time. What would you like to know?`
  };
}
var CONSTRUCTION_QA, GREETING_PATTERNS, DAILY_SAFETY_TOPICS;
var init_jarvis_local = __esm({
  "server/jarvis-local.ts"() {
    "use strict";
    init_storage();
    init_jarvis();
    init_health();
    init_apis();
    CONSTRUCTION_QA = [
      {
        keywords: ["what is rfi", "what's an rfi", "what is a rfi", "rfi mean", "define rfi"],
        answer: "An RFI, or Request for Information, is basically a formal question you send to the architect, engineer, or owner when something in the plans or specs isn't clear. It's a paper trail \u2014 you ask, they answer, and everyone's on the same page. Helps avoid costly mistakes down the road. You can create and track RFIs right here in TrussPath under the RFIs tab."
      },
      {
        keywords: ["what is change order", "what's a change order", "change order mean", "define change order"],
        answer: "A change order is a formal change to the original contract \u2014 could be scope, schedule, or budget. Maybe the owner wants to add a room, or swap out a material. Whatever it is, it gets documented with a price and a schedule impact, and the owner has to sign off before the work happens. You can track all of that under the Change Orders tab in TrussPath."
      },
      {
        keywords: ["what is submittal", "what's a submittal", "submittal mean", "define submittal"],
        answer: "A submittal is when you send shop drawings, product data, or material samples to the architect or engineer for approval before you actually buy or install anything. Think of it as a double-check \u2014 making sure what you're planning to use matches what the design calls for. TrussPath tracks all your submittals under the Submittals tab."
      },
      {
        keywords: ["what is punch list", "what's a punch list", "punch list mean", "define punch list", "punch out"],
        answer: "A punch list is that final to-do list you put together near the end of a project \u2014 all the little things that need fixing before you hand over the keys. Could be a scratched wall, a missing cover plate, a door that doesn't close right. You walk through with the owner, make the list, and knock it out. TrussPath manages all of that under the Punch List tab."
      },
      {
        keywords: ["what is daily log", "what's a daily log", "daily log mean", "daily report"],
        answer: "A daily log is your record of what happened on site each day \u2014 weather, how many guys were out there, what work got done, what got delivered, who visited, any incidents. It's one of those things that feels tedious until you need it for a claim or a dispute, and then it's worth its weight in gold. TrussPath has daily logs under the Daily Logs tab."
      },
      {
        keywords: ["what is milestone", "milestone mean", "define milestone"],
        answer: "A milestone is just a key date in your schedule \u2014 it marks a big moment, like breaking ground, or hitting substantial completion. It doesn't have a duration, it's just a point in time. TrussPath tracks your milestones on the Schedule page so you can see them coming."
      },
      {
        keywords: ["what is gantt", "gantt chart", "define gantt"],
        answer: "A Gantt chart is one of those horizontal bar charts that shows your tasks laid out over time \u2014 each bar is a task, and you can see when it starts, how long it runs, and when it wraps up. It's the easiest way to visualize a schedule at a glance. TrussPath has a Gantt view right under the Schedule tab."
      },
      {
        keywords: ["substantial completion", "what is substantial completion"],
        answer: "Substantial completion is the moment the project is far enough along that the owner can actually use it for what it was built for \u2014 they can move in, start operating, that kind of thing. It's a big deal because it usually kicks off the warranty period, triggers final payment, and shifts responsibility over to the owner."
      },
      {
        keywords: ["notice to proceed", "ntp", "what is ntp"],
        answer: "Notice to Proceed, or NTP, is the green light from the owner to start work. That's day one of your project \u2014 the clock starts ticking on your contract duration from that point. Usually recorded as a milestone on the schedule."
      },
      {
        keywords: ["what is cpm", "critical path method", "define cpm"],
        answer: "The Critical Path Method is a way of scheduling where you figure out the longest chain of dependent tasks \u2014 the ones that have to happen in order and can't be delayed without pushing back the whole project. That chain is your critical path. If anything on it slips, your finish date slips. TrussPath includes a CPM view so you can see it visually."
      },
      {
        keywords: ["what is rfi vs submittal", "difference rfi submittal", "rfi versus submittal"],
        answer: "Good question \u2014 they're easy to mix up. An RFI is when you're asking a question because the plans aren't clear. A submittal is when you're showing the architect what you plan to use or build, and you need their thumbs-up before you proceed. RFIs resolve confusion; submittals confirm materials and methods. Both get tracked separately in TrussPath."
      },
      {
        keywords: ["retainage", "what is retainage", "retention"],
        answer: "Retainage is a chunk of money the owner holds back from each payment \u2014 usually five to ten percent \u2014 until the whole project is done. It's basically their insurance policy to make sure you finish the job. You get it released at substantial completion and then again at final completion."
      },
      {
        keywords: ["what is lien waiver", "lien waiver"],
        answer: "A lien waiver is a document where you give up your right to file a mechanic's lien on the property, usually in exchange for getting paid. There are two main flavors \u2014 conditional, which kicks in when the check actually clears, and unconditional, which is a straight release. You'll sign these on pretty much every payment."
      },
      {
        keywords: ["what is o&m", "o&m manual", "operation maintenance manual"],
        answer: "O&M manuals are the binders of documentation you hand over at closeout \u2014 operating instructions, maintenance schedules, warranties, equipment info, all of it. The owner needs these to keep the building running after you're gone. They're not the most exciting part of the job, but they're essential for facility management."
      },
      {
        keywords: ["construction safety", "safety protocols", "site safety", "safety on site", "safety procedures", "safety rules", "osha"],
        answer: "Here's a rundown of the main safety protocols on a construction site:\n\nPPE is your baseline \u2014 hard hats in active work zones, safety glasses when you're cutting or drilling, steel-toe boots, high-vis vests around equipment and traffic, gloves and hearing protection as needed.\n\nFall protection kicks in at six feet or higher. That means guardrails, safety nets, or a personal fall arrest system \u2014 harness, lanyard, and an anchor point. Ladders need three points of contact and should extend three feet above the landing. Cover and mark any floor openings.\n\nExcavation and trenching \u2014 trenches deeper than five feet need sloping, shoring, or shielding. A competent person has to inspect them daily. Keep spoil piles at least two feet back from the edge.\n\nElectrical \u2014 lockout and tagout before you service anything. GFCI on all temporary power. Maintain clearance from overhead lines.\n\nGeneral stuff \u2014 hold a toolbox talk every morning, keep walkways clear, have fire extinguishers within a hundred feet of travel, and report any incidents or near-misses right away.\n\nWant me to go deeper on any of those?"
      },
      {
        keywords: ["fall protection", "harness", "fall arrest"],
        answer: "OSHA requires fall protection at six feet or higher in construction. Your main options are guardrail systems (top rail at forty-two inches, give or take three), safety nets underneath the work area, or a personal fall arrest system \u2014 that's a full-body harness, lanyard, and an anchor point rated for five thousand pounds per worker.\n\nA few key things \u2014 inspect your harness before every use, the D-ring goes in the center of your back, and never tie a knot in a lanyard. For low-slope roofs, you can use a warning line plus a safety monitor."
      },
      {
        keywords: ["toolbox talk", "safety meeting", "safety briefing", "pre-job briefing"],
        answer: "A toolbox talk is just a quick safety huddle \u2014 five, maybe fifteen minutes \u2014 before the crew starts work. You cover what everyone's doing that day, what hazards to watch for, what PPE they need, where the emergency exits are, what the weather's doing, and any recent incidents or near-misses worth learning from.\n\nBest practice is to hold one every morning, keep a sign-in sheet, and rotate the topics so it doesn't get stale. The best ones are interactive \u2014 ask the crew what they think the hazards are, don't just lecture them."
      },
      {
        keywords: ["heat stress", "heat exhaustion", "heat stroke", "hot weather safety"],
        answer: "Heat illness is a real risk on site. Here's what to watch for:\n\nPrevention \u2014 provide shade and cool water, at least a quart an hour per person. Schedule the heavy stuff for early morning when it's cooler. Break in new workers gradually \u2014 start them at twenty percent of a normal day and ramp up over a week or two. Take frequent shade breaks.\n\nHeat exhaustion looks like heavy sweating, weakness, dizziness, nausea, headache. Get that person to shade, give them water, let them cool down.\n\nHeat stroke is a medical emergency \u2014 confusion, passing out, skin that's hot to the touch, body temp over a hundred and three. Call nine-one-one immediately. Don't wait.\n\nOSHA uses the General Duty Clause for heat right now. Some states like California, Washington, and Minnesota have their own specific heat rules."
      },
      {
        keywords: ["ppe", "personal protective equipment", "safety gear"],
        answer: "Here's the PPE you need on a construction site, per OSHA:\n\nHard hats \u2014 ANSI Z eighty-nine point one\nEye and face protection \u2014 ANSI Z eighty-seven point one\nSteel-toe boots \u2014 ASTM F twenty-four thirteen\nGloves \u2014 matched to whatever task you're doing\nHearing protection \u2014 needed at eighty-five decibels or higher over an eight-hour shift\nRespiratory protection \u2014 when airborne hazards exceed permissible exposure limits\nHigh-visibility apparel \u2014 ANSI/ISEA one-oh-seven\n\nThe employer has to provide all of this at no cost to the worker, with a few exceptions. And workers need to be trained on how to use it, maintain it, and know its limits."
      },
      {
        keywords: ["weather"],
        answer: `I'm trying to pull live weather for your project, but it looks like I couldn't get it. Here's what I'd suggest for checking conditions on site:

The OSHA-NIOSH Heat Safety app gives you the real-time heat index and precautions. For forecasts and severe weather, weather.gov or a NOAA weather radio is your best bet.

A couple of rules of thumb \u2014 crane operations need to stop when sustained winds hit twenty miles per hour or more, though check the manufacturer specs because some are lower. And for lightning, use the thirty/thirty rule: if thunder follows lightning by less than thirty seconds, get to shelter, and wait thirty minutes after the last thunder before going back out.

Make sure your project has an address set and I can fetch live conditions for you. Or if you've got a weather tip specific to your area, just say "remember that..." and I'll save it for next time.`
      },
      {
        keywords: ["lunch", "food", "eat", "restaurant", "lunch spots", "where to eat", "hungry"],
        answer: `I'd love to pull up nearby lunch spots for you, but I need a Google Maps API key set up first. Once that's connected, I can find restaurants, coffee shops, hardware stores, gas stations \u2014 anything near your project site automatically.

In the meantime, check Google Maps or Yelp for spots within ten or fifteen minutes of your site address. Look for places with quick service \u2014 delis, food trucks, fast-casual spots. A lot of sites actually bring a food truck on-site for lunch, which saves everyone a trip.

If you know some good spots near your site, just tell me \u2014 say something like "remember that the best lunch spot near here is Tony's Deli" and I'll save it. Next time you ask, I'll have it ready.`
      },
      {
        keywords: ["joke", "funny", "tell me something"],
        answer: "Why did the construction worker bring a pencil to the job site?\n\nTo draw up plans, of course.\n\nAlright, bad joke aside \u2014 what can I actually help you with?"
      },
      {
        keywords: ["time", "what time", "date", "what day", "today's date"],
        answer: `Right now it's ${(/* @__PURE__ */ new Date()).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
      },
      {
        keywords: ["who made you", "who created you", "who built you"],
        answer: "I'm Jarvis, built into TrussPath. I'm here to help with your project, answer construction questions, or just be a sounding board. Think of me as your right-hand guy on the site."
      }
    ];
    GREETING_PATTERNS = [
      { keywords: ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"], answer: "Hey, good to see you. What can I help with today?" },
      { keywords: ["how are you", "how's it going", "you good"], answer: "Doing great, thanks! What's on your mind?" },
      { keywords: ["thank you", "thanks", "cheers"], answer: "Anytime! Let me know if you need anything else." },
      { keywords: ["who are you", "what are you", "your name"], answer: "I'm Jarvis \u2014 your AI assistant inside TrussPath. I can answer construction questions, pull up your project status, help you navigate the app, or just chat. What do you need?" },
      { keywords: ["what can you do", "help", "capabilities", "features"], answer: `Here's what I can help with:
\u2022 Construction questions \u2014 RFIs, change orders, submittals, safety protocols, PPE, fall protection, OSHA standards
\u2022 General stuff \u2014 weather guidance, lunch spots near your site, jokes, the time and date
\u2022 Project status \u2014 just ask "what's overdue?" or "give me a briefing"
\u2022 Navigation \u2014 "where do I create a task?" or "how do I find the Gantt chart?"
\u2022 App health \u2014 "is anything broken?"

What would you like to know?` }
    ];
    DAILY_SAFETY_TOPICS = [
      {
        title: "Fall protection",
        body: "Anyone working at six feet or higher needs fall protection \u2014 guardrails, safety nets, or personal fall arrest systems. Inspect your harness, lanyard, and anchor point before every use. A harness that's been through a fall gets tagged out and replaced, no exceptions. Tie off to something rated for five thousand pounds, not just whatever's handy."
      },
      {
        title: "PPE check",
        body: "Hard hats, safety glasses, steel-toe boots, and high-visibility vests for everyone on site. If you're grinding, drilling, or welding, add face shields and the right respiratory protection. Hearing protection above eighty-five decibels. If your PPE is damaged or worn out, replace it before you start working \u2014 not after."
      },
      {
        title: "Trenching and excavation",
        body: "Trenches deeper than five feet need a protective system \u2014 sloping, shoring, or shielding. Never enter a trench without it. Keep spoil piles at least two feet back from the edge. Daily inspections by a competent person before anyone goes in, and after any rain or vibration event. Ladders every twenty-five feet of lateral travel in trench excavations over four feet deep."
      },
      {
        title: "Electrical safety and lockout/tagout",
        body: "All temporary wiring needs GFCI protection. Inspect cords and tools before use \u2014 no frayed cables, no missing ground prongs. When working on electrical systems, follow lockout/tagout: isolate, lock, tag, verify dead, then work. Test before you touch. Only qualified electricians open panels or work on energized circuits."
      },
      {
        title: "Material handling and crane ops",
        body: "Rigging inspections before every lift \u2014 check slings, hooks, and shackles for wear. Never walk under a suspended load. Wind limits are twenty miles per hour sustained for most cranes, but check manufacturer specs because some are lower. Have a dedicated signal person for any lift where the operator can't see the load clearly."
      },
      {
        title: "Housekeeping and trip hazards",
        body: "Keep walkways clear of debris, tools, and materials. Clean up spills immediately \u2014 especially oil and grease. Stack materials neatly and away from edges. Extension cords should be routed overhead or protected, not running across walkways where people trip over them. A clean site is a safe site."
      },
      {
        title: "Hand and power tools",
        body: "Inspect tools before each use \u2014 guards in place, cords intact, blades sharp. Use the right tool for the job, not a make-do. Disconnect power before changing blades or bits. Never carry a tool by the cord or yank it to unplug. Tool handles should be tight and crack-free."
      },
      {
        title: "Hot work and fire prevention",
        body: "If you're welding, cutting, or grinding, clear the area of combustibles for at least thirty-five feet. Have a fire extinguisher within arm's reach. Assign a fire watch for at least thirty minutes after hot work ends \u2014 smoldering fires can start after everyone leaves. Check above and below the work area, not just at ground level."
      }
    ];
  }
});

// server/mailer.ts
function renderHtml(n) {
  const rows = Object.entries(n.fields).filter(([, v]) => v !== void 0 && v !== null && String(v).trim() !== "").map(
    ([k, v]) => `<tr><td style="padding:6px 12px;color:#666;font-size:13px;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(
      k
    )}</td><td style="padding:6px 12px;font-size:15px;color:#111;">${escapeHtml(String(v))}</td></tr>`
  ).join("");
  const kindLabel = n.kind === "subscriber" ? "New TrussPath subscriber" : n.kind === "signup" ? "New TrussPath account signup" : "New TrussPath demo request";
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
async function sendPasswordResetEmail(toEmail, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SIGNUP_NOTIFY_FROM || DEFAULT_FROM;
  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set \u2014 skipping password reset email to ${toEmail}. Reset URL: ${resetUrl}`);
    return { ok: true, skipped: true };
  }
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#f7f6f4;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;">
    <div style="padding:16px 20px;background:#111;color:#fff;font-weight:600;font-size:14px;letter-spacing:0.04em;text-transform:uppercase;">TrussPath \u2014 Password Reset</div>
    <div style="padding:24px 20px;">
      <p style="font-size:15px;color:#111;margin:0 0 16px;">We received a request to reset your TrussPath password.</p>
      <p style="font-size:14px;color:#666;margin:0 0 24px;">Click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Reset Password</a>
      <p style="font-size:13px;color:#999;margin:24px 0 0;">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div style="padding:12px 20px;color:#888;font-size:12px;border-top:1px solid #eee;">TrussPath \u2014 Field Project Management</div>
  </div>
</body></html>`;
  const text2 = `TrussPath \u2014 Password Reset

We received a request to reset your TrussPath password.

Click the link below to set a new password. This link expires in 1 hour.

${resetUrl}

If you didn't request this, you can safely ignore this email.`;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "TrussPath \u2014 Reset your password",
        html,
        text: text2
      })
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[mailer] Resend ${resp.status}: ${body}`);
      return { ok: false, error: `Resend ${resp.status}` };
    }
    console.log(`[mailer] Sent password reset email to ${toEmail}`);
    return { ok: true };
  } catch (err) {
    console.error("[mailer] Password reset send failed:", err);
    return { ok: false, error: String(err) };
  }
}
var DEFAULT_TO, DEFAULT_FROM;
var init_mailer = __esm({
  "server/mailer.ts"() {
    "use strict";
    DEFAULT_TO = "houston.sean509@gmail.com";
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
function authRateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= AUTH_RATE_LIMIT) {
      const mins = Math.ceil((entry.resetAt - now) / 6e4);
      return res.status(429).json({ message: `Too many attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.` });
    }
    entry.count++;
  } else {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_RATE_WINDOW });
  }
  if (authAttempts.size > 500) {
    authAttempts.forEach((val, key) => {
      if (now >= val.resetAt) authAttempts.delete(key);
    });
  }
  next();
}
async function authMiddleware(req, res, next) {
  const p = req.path || req.url?.split("?")[0] || "";
  if (!p.startsWith("/api")) return next();
  if (PUBLIC_API.has(p)) return next();
  const cookies = parseCookies(req.headers?.cookie);
  const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const queryToken = typeof req.query?.token === "string" ? req.query.token : "";
  const token = cookies[SESSION_COOKIE] || bearer || queryToken;
  const s = token ? await storage.getSession(token) : null;
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
    ".perplexity.ai",
    "trusspath.com"
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
  app2.post("/api/auth/signup", authRateLimit, async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password, displayName, company } = parsed.data;
    try {
      const account = await storage.createAccount(email, password, displayName, company);
      const session = await storage.createSession(account.id);
      setSessionCookie(res, session.id);
      void sendSignupNotification({
        kind: "signup",
        subject: `New TrussPath account \u2014 ${displayName} (${email})`,
        fields: {
          Name: displayName,
          Email: email,
          Company: company,
          "Signed up": (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      res.status(201).json({ account, token: session.id });
    } catch (e) {
      const msg = e?.message || "Signup failed";
      const status = /already/i.test(msg) ? 409 : 500;
      res.status(status).json({ message: msg });
    }
  });
  app2.post("/api/auth/login", authRateLimit, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const { email, password } = parsed.data;
    const account = await storage.verifyPassword(email, password);
    if (!account) return res.status(401).json({ message: "Invalid email or password" });
    const session = await storage.createSession(account.id);
    setSessionCookie(res, session.id);
    res.json({ account, token: session.id });
  });
  app2.post("/api/auth/logout", async (req, res) => {
    const cookies = parseCookies(req.headers?.cookie);
    const token = cookies[SESSION_COOKIE];
    if (token) await storage.destroySession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app2.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (email) {
      const account = await storage.getAccountByEmail(email);
      if (account) {
        const token = await storage.createPasswordResetToken(account.id);
        const APP_URL2 = process.env.VITE_API_BASE || "https://trusspath.com";
        const resetUrl = `${APP_URL2}/#/reset-password?token=${token}`;
        sendPasswordResetEmail(email, resetUrl).catch(
          (e) => console.error("[forgot-password] email send failed:", e)
        );
      }
    }
    res.json({ ok: true, message: "If an account exists with that email, a reset link has been sent." });
  });
  app2.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!token || !password) return res.status(400).json({ message: "Token and new password are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const resetToken = await storage.usePasswordResetToken(token);
    if (!resetToken) return res.status(400).json({ message: "Invalid or expired reset token" });
    await storage.updatePassword(resetToken.accountId, password);
    res.json({ ok: true, message: "Password updated successfully" });
  });
  app2.get("/api/auth/me", async (req, res) => {
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? await storage.getSession(token) : null;
    if (!s) return res.status(401).json({ account: null });
    res.json({ account: s.account });
  });
  app2.patch("/api/auth/profile", async (req, res) => {
    const bearer = req.headers?.authorization?.replace(/^Bearer\s+/i, "") || "";
    const cookies = parseCookies(req.headers?.cookie);
    const token = bearer || cookies[SESSION_COOKIE];
    const s = token ? await storage.getSession(token) : null;
    if (!s) return res.status(401).json({ message: "Not authenticated" });
    const body = req.body || {};
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : void 0;
    const position = typeof body.position === "string" ? body.position.trim() : void 0;
    if (displayName === "") return res.status(400).json({ message: "Display name cannot be empty" });
    const updated = await storage.updateAccountProfile(s.account.id, { displayName, position });
    if (!updated) return res.status(404).json({ message: "Account not found" });
    res.json({ account: updated });
  });
  app2.get("/api/team", async (_req, res) => res.json(await storage.getTeam()));
  app2.post("/api/team", async (req, res) => {
    const parsed = insertTeamSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createTeamMember(parsed.data));
  });
  app2.patch("/api/team/:id", async (req, res) => {
    const parsed = insertTeamSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateTeamMember(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Team member not found" });
    res.json(updated);
  });
  app2.delete("/api/team/:id", async (req, res) => {
    await storage.softDeleteEntity("team-members", parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/projects", async (_req, res) => res.json(await storage.getProjects()));
  app2.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(parseInt(req.params.id, 10));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });
  app2.post("/api/projects", async (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createProject(parsed.data));
  });
  app2.patch("/api/projects/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await storage.updateProject(id, req.body);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  });
  app2.get("/api/tasks", async (req, res) => res.json(await storage.getTasks(pid(req))));
  app2.post("/api/tasks", async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createTask(parsed.data));
  });
  app2.patch("/api/tasks/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateTaskStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Task not found" });
    res.json(updated);
  });
  app2.get("/api/rfis", async (req, res) => res.json(await storage.getRfis(pid(req))));
  app2.post("/api/rfis", async (req, res) => {
    const parsed = insertRfiSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createRfi(parsed.data));
  });
  app2.patch("/api/rfis/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateRfiStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "RFI not found" });
    res.json(updated);
  });
  app2.get("/api/submittals", async (req, res) => res.json(await storage.getSubmittals(pid(req))));
  app2.post("/api/submittals", async (req, res) => {
    const parsed = insertSubmittalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createSubmittal(parsed.data));
  });
  app2.patch("/api/submittals/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateSubmittalStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Submittal not found" });
    res.json(updated);
  });
  app2.get("/api/change-orders", async (req, res) => res.json(await storage.getChangeOrders(pid(req))));
  app2.post("/api/change-orders", async (req, res) => {
    const parsed = insertChangeOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createChangeOrder(parsed.data));
  });
  app2.patch("/api/change-orders/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateChangeOrderStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Change order not found" });
    res.json(updated);
  });
  app2.get("/api/action-items", async (req, res) => res.json(await storage.getActionItems(pid(req))));
  app2.post("/api/action-items", async (req, res) => {
    const parsed = insertActionItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createActionItem(parsed.data));
  });
  app2.patch("/api/action-items/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updateActionItemStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Action item not found" });
    res.json(updated);
  });
  app2.get("/api/daily-logs", async (req, res) => res.json(await storage.getDailyLogs(pid(req))));
  app2.post("/api/daily-logs", async (req, res) => {
    const parsed = insertDailyLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDailyLog(parsed.data));
  });
  app2.patch("/api/daily-logs/:id", async (req, res) => {
    const parsed = insertDailyLogSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateDailyLog(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Daily log not found" });
    res.json(updated);
  });
  app2.delete("/api/daily-logs/:id", async (req, res) => {
    await storage.softDeleteEntity("daily-logs", parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/punch", async (req, res) => res.json(await storage.getPunchItems(pid(req))));
  app2.post("/api/punch", async (req, res) => {
    const parsed = insertPunchItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createPunchItem(parsed.data));
  });
  app2.patch("/api/punch/:id/status", async (req, res) => {
    const status = String(req.body?.status ?? "");
    if (!status) return res.status(400).json({ message: "status required" });
    const updated = await storage.updatePunchStatus(parseInt(req.params.id, 10), status);
    if (!updated) return res.status(404).json({ message: "Punch item not found" });
    res.json(updated);
  });
  app2.get("/api/contacts", async (_req, res) => res.json(await storage.getContacts()));
  app2.post("/api/contacts", async (req, res) => {
    const parsed = insertContactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createContact(parsed.data));
  });
  app2.patch("/api/contacts/:id", async (req, res) => {
    const parsed = insertContactSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateContact(parseInt(req.params.id, 10), parsed.data);
    if (!updated) return res.status(404).json({ message: "Contact not found" });
    res.json(updated);
  });
  app2.delete("/api/contacts/:id", async (req, res) => {
    await storage.softDeleteEntity("contacts", parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/equipment", async (req, res) => res.json(await storage.getEquipment(pid(req))));
  app2.post("/api/equipment", async (req, res) => {
    const parsed = insertEquipmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createEquipment(parsed.data));
  });
  app2.get("/api/photos", async (req, res) => res.json(await storage.getPhotos(pid(req))));
  app2.post("/api/photos", async (req, res) => {
    const parsed = insertPhotoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createPhoto(parsed.data));
  });
  app2.post("/api/photos/upload", photoUpload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No image provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const takenById = req.body.takenById ? parseInt(req.body.takenById, 10) : void 0;
    const caption = req.body.caption ? String(req.body.caption) : file.originalname;
    const location = req.body.location ? String(req.body.location) : "";
    const date = req.body.date ? String(req.body.date) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const hue = req.body.hue ? parseInt(req.body.hue, 10) : Math.floor(Math.random() * 360);
    const created = await storage.createPhoto({
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
  app2.get("/api/photos/:id/file", async (req, res) => {
    hydrateSeedPhotos();
    const photo = await storage.getPhoto(parseInt(req.params.id, 10));
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
  app2.delete("/api/photos/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("photos", id);
    res.status(204).end();
  });
  app2.get("/api/documents", async (req, res) => res.json(await storage.getDocuments(pid(req))));
  app2.post("/api/documents", async (req, res) => {
    const parsed = insertDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDocument(parsed.data));
  });
  app2.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file provided." });
    const projectId = parseInt(req.body.projectId, 10);
    if (!Number.isFinite(projectId)) return res.status(400).json({ message: "projectId is required." });
    const uploadedById = req.body.uploadedById ? parseInt(req.body.uploadedById, 10) : void 0;
    const name = req.body.name ? String(req.body.name) : file.originalname;
    const type = req.body.type ? String(req.body.type) : "Drawing";
    const date = req.body.date ? String(req.body.date) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const created = await storage.createDocument({
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
  app2.get("/api/documents/:id/file", async (req, res) => {
    const doc = await storage.getDocument(parseInt(req.params.id, 10));
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
  app2.delete("/api/documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("documents", id);
    res.status(204).end();
  });
  const companyUploadDir = process.env.NODE_ENV === "production" ? "/tmp/uploads/company-documents" : import_node_path2.default.resolve(process.cwd(), "uploads/company-documents");
  const companyUpload = (0, import_multer.default)({ storage: import_multer.default.diskStorage({
    destination: (req, _file, cb) => {
      import_node_fs2.default.mkdirSync(companyUploadDir, { recursive: true });
      cb(null, companyUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = import_node_path2.default.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }) });
  app2.get("/api/company-documents", async (_req, res) => res.json(await storage.getCompanyDocuments()));
  app2.post("/api/company-documents", async (req, res) => {
    const parsed = insertCompanyDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createCompanyDocument(parsed.data));
  });
  app2.post("/api/company-documents/upload", companyUpload.single("file"), async (req, res) => {
    const file = req.file;
    const body = req.body;
    const title = body.title ? String(body.title) : file ? file.originalname : "Untitled";
    const category = body.category ? String(body.category) : "Other";
    const signatureRequired = body.signatureRequired === "true" || body.signatureRequired === true;
    const signerName = body.signerName ? String(body.signerName) : null;
    const signerEmail = body.signerEmail ? String(body.signerEmail) : null;
    const dueDate = body.dueDate ? String(body.dueDate) : null;
    const notes2 = body.notes ? String(body.notes) : null;
    const uploadedById = body.uploadedById ? parseInt(body.uploadedById, 10) : void 0;
    const signatureStatus = signatureRequired ? "Needs Signature" : "Not Required";
    const created = await storage.createCompanyDocument({
      title,
      category,
      status: "Active",
      signatureRequired,
      signatureStatus,
      signerName,
      signerEmail,
      dueDate,
      notes: notes2,
      uploadedById,
      date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      storedFileName: file?.filename ?? null,
      originalFileName: file?.originalname ?? null,
      mimeType: file?.mimetype ?? null,
      fileSizeBytes: file?.size ?? null
    });
    res.status(201).json(created);
  });
  app2.patch("/api/company-documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const parsed = insertCompanyDocumentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    const updated = await storage.updateCompanyDocument(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Company document not found." });
    res.json(updated);
  });
  app2.get("/api/company-documents/:id/file", async (req, res) => {
    const doc = await storage.getCompanyDocument(parseInt(req.params.id, 10));
    if (!doc) return res.status(404).json({ message: "Company document not found." });
    if (!doc.storedFileName) return res.status(404).json({ message: "No source file attached." });
    const abs = import_node_path2.default.resolve(companyUploadDir, doc.storedFileName);
    if (!abs.startsWith(companyUploadDir + import_node_path2.default.sep) || !import_node_fs2.default.existsSync(abs)) {
      return res.status(404).json({ message: "File missing from storage." });
    }
    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalFileName || doc.storedFileName}"`);
    import_node_fs2.default.createReadStream(abs).pipe(res);
  });
  app2.delete("/api/company-documents/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("company-documents", id);
    res.status(204).end();
  });
  app2.get("/api/blueprints", async (req, res) => res.json(await storage.getBlueprints(pid(req))));
  app2.post("/api/blueprints", async (req, res) => {
    const parsed = insertBlueprintSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createBlueprint(parsed.data));
  });
  app2.get("/api/drone-captures", async (req, res) => res.json(await storage.getDroneCaptures(pid(req))));
  app2.post("/api/drone-captures", async (req, res) => {
    const parsed = insertDroneCaptureSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createDroneCapture(parsed.data));
  });
  app2.get("/api/milestones", async (req, res) => res.json(await storage.getMilestones(pid(req))));
  app2.post("/api/milestones", async (req, res) => {
    const parsed = insertMilestoneSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createMilestone(parsed.data));
  });
  app2.patch("/api/milestones/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const updated = await storage.updateMilestone(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "not found" });
    res.json(updated);
  });
  app2.delete("/api/milestones/:id", async (req, res) => {
    await storage.softDeleteEntity("milestones", parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.post("/api/drone-captures/upload", droneUpload.single("file"), async (req, res) => {
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
    const created = await storage.createDroneCapture({
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
  app2.get("/api/drone-captures/:id/file", async (req, res) => {
    const cap = await storage.getDroneCapture(parseInt(req.params.id, 10));
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
  app2.delete("/api/drone-captures/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    await storage.softDeleteEntity("drone-captures", id);
    res.status(204).end();
  });
  app2.get("/api/messages/:projectId", async (req, res) => {
    res.json(await storage.getMessages(parseInt(req.params.projectId, 10)));
  });
  app2.post("/api/messages", async (req, res) => {
    const parsed = insertMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createMessage(parsed.data));
  });
  app2.get("/api/notes", async (req, res) => res.json(await storage.getNotes(pid(req))));
  app2.post("/api/notes", async (req, res) => {
    const parsed = insertNoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues });
    res.status(201).json(await storage.createNote(parsed.data));
  });
  app2.patch("/api/notes/:id", async (req, res) => {
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return res.status(400).json({ message: "x,y required" });
    const updated = await storage.updateNotePosition(parseInt(req.params.id, 10), x, y);
    if (!updated) return res.status(404).json({ message: "Note not found" });
    res.json(updated);
  });
  app2.delete("/api/notes/:id", async (req, res) => {
    await storage.softDeleteEntity("notes", parseInt(req.params.id, 10));
    res.status(204).end();
  });
  app2.get("/api/integrations", async (_req, res) => {
    res.json(await storage.getIntegrations());
  });
  app2.patch("/api/integrations/:key", async (req, res) => {
    const key = req.params.key;
    const connected = req.body?.connected === true;
    const config = typeof req.body?.config === "string" ? req.body.config : void 0;
    res.json(await storage.setIntegration(key, connected, config));
  });
  app2.post("/api/integrations/:key/connect", async (req, res) => {
    const key = req.params.key;
    const accountLabel = typeof req.body?.accountLabel === "string" ? req.body.accountLabel.trim() : void 0;
    const config = typeof req.body?.config === "string" ? req.body.config : void 0;
    res.json(await storage.connectIntegration(key, { accountLabel, config }));
  });
  app2.post("/api/integrations/:key/disconnect", async (req, res) => {
    const key = req.params.key;
    res.json(await storage.disconnectIntegration(key));
  });
  app2.post("/api/integrations/:key/test", async (_req, res) => {
    res.json({ ok: true, message: "Connection verified" });
  });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeKey ? new (require("stripe")(stripeKey))() : null;
  const PRICE_MAP = {
    starter: { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY, annual: process.env.STRIPE_PRICE_STARTER_ANNUAL },
    pro: { monthly: process.env.STRIPE_PRICE_PRO_MONTHLY, annual: process.env.STRIPE_PRICE_PRO_ANNUAL },
    enterprise: { monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY, annual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL }
  };
  const APP_URL = process.env.VITE_API_BASE || "https://trusspath.com";
  app2.post("/api/stripe/webhook", async (req, res) => {
    if (!stripe || !webhookSecret) return res.status(503).json({ error: "Stripe not configured" });
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (e) {
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const customerId = session.customer;
          const subscriptionId = session.subscription;
          if (customerId) {
            const account = await storage.getAccountByStripeCustomerId(customerId);
            if (account) {
              await storage.updateAccountBilling(account.id, {
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
                subscriptionStatus: "active"
              });
            }
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.created": {
          const sub = event.data.object;
          const customerId = sub.customer;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            const planKey = sub.items?.data?.[0]?.price?.lookup_key || "";
            const planMatch = planKey.match(/^(starter|pro|enterprise)/);
            await storage.updateAccountBilling(account.id, {
              stripeCustomerId: customerId,
              stripeSubscriptionId: sub.id,
              subscriptionStatus: sub.status,
              subscriptionCurrentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1e3).toISOString() : void 0,
              subscriptionPlan: planMatch ? planMatch[1] : void 0
            });
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const customerId = sub.customer;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            await storage.updateAccountBilling(account.id, {
              subscriptionStatus: "canceled",
              stripeSubscriptionId: null
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const customerId = invoice.customer;
          const account = await storage.getAccountByStripeCustomerId(customerId);
          if (account) {
            await storage.updateAccountBilling(account.id, { subscriptionStatus: "past_due" });
          }
          break;
        }
      }
      res.json({ received: true });
    } catch (e) {
      console.error("[stripe webhook] error:", e);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });
  app2.post("/api/billing/checkout", async (req, res) => {
    const { plan, billing, email, company } = req.body;
    if (!plan || !billing || !email) return res.status(400).json({ error: "Missing plan, billing, or email" });
    if (!stripe) {
      try {
        await storage.createSubscriber({ email, plan, billing, company });
      } catch {
      }
      void sendSignupNotification({
        kind: "subscriber",
        subject: `New TrussPath subscriber \u2014 ${email}`,
        fields: {
          Email: email,
          Company: company,
          Plan: plan,
          Billing: billing,
          "Note": "Stripe not yet configured \u2014 captured as lead",
          "Signed up": (/* @__PURE__ */ new Date()).toISOString()
        }
      });
      return res.status(202).json({
        message: "Billing isn't configured yet, but we've saved your spot. We'll be in touch soon!",
        captured: true
      });
    }
    const priceId = PRICE_MAP[plan]?.[billing];
    if (!priceId) return res.status(400).json({ error: `No price configured for ${plan} (${billing}). Set STRIPE_PRICE_* env vars.` });
    try {
      const existingAccount = await storage.getAccountByEmail(email);
      let customerId = existingAccount?.stripeCustomerId || void 0;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email,
          metadata: { plan, billing, company: company || "" }
        });
        customerId = customer.id;
        if (existingAccount) {
          await storage.updateAccountBilling(existingAccount.id, { stripeCustomerId: customerId });
        }
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${APP_URL}/#/signup?checkout=success`,
        cancel_url: `${APP_URL}/?checkout=cancelled`,
        metadata: { plan, billing, email },
        subscription_data: { metadata: { plan, billing } }
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error("[stripe checkout] error:", e);
      res.status(500).json({ error: e?.message || "Failed to create checkout session" });
    }
  });
  app2.post("/api/billing/portal", async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Billing is not configured" });
    const account = req.account;
    if (!account) return res.status(401).json({ error: "Not authenticated" });
    if (!account.stripeCustomerId) return res.status(400).json({ error: "No billing account found" });
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: account.stripeCustomerId,
        return_url: `${APP_URL}/#/settings`
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error("[stripe portal] error:", e);
      res.status(500).json({ error: e?.message || "Failed to create portal session" });
    }
  });
  app2.get("/api/billing/status", async (req, res) => {
    const account = req.account;
    if (!account) return res.status(401).json({ error: "Not authenticated" });
    res.json({
      plan: account.subscriptionPlan || null,
      status: account.subscriptionStatus || null,
      billing: account.subscriptionBilling || null,
      currentPeriodEnd: account.subscriptionCurrentPeriodEnd || null,
      hasCustomer: !!account.stripeCustomerId
    });
  });
  app2.get("/api/deleted-items", async (_req, res) => {
    res.json(await storage.getDeletedItems());
  });
  app2.post("/api/deleted-items/:type/:id/restore", async (req, res) => {
    const { type, id } = req.params;
    try {
      const restored = await storage.restoreEntity(type, parseInt(id, 10));
      res.json(restored);
    } catch (e) {
      res.status(404).json({ message: e?.message ?? "Item not found in bin" });
    }
  });
  app2.delete("/api/deleted-items/:type/:id/permanent", async (req, res) => {
    const { type, id } = req.params;
    await storage.permanentDeleteEntity(type, parseInt(id, 10));
    res.status(204).end();
  });
  app2.delete("/api/deleted-items", async (_req, res) => {
    await storage.emptyDeletedItems();
    res.status(204).end();
  });
  app2.post("/api/subscribe", async (req, res) => {
    const parsed = insertSubscriberSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const saved = await storage.createSubscriber(parsed.data);
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
    const saved = await storage.createDemoRequest(parsed.data);
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
  app2.get("/api/admin/signups", async (_req, res) => {
    res.json({
      subscribers: await storage.listSubscribers(),
      demoRequests: await storage.listDemoRequests()
    });
  });
  app2.get("/api/jarvis/brief", async (req, res) => {
    try {
      try {
        const result = await jarvisBrief(pid(req));
        res.json(result);
      } catch (llmErr) {
        console.log("[jarvis] LLM brief failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        const ctx = await buildContext(pid(req));
        res.json({ brief: buildLocalBrief(ctx), context: ctx });
      }
    } catch (err) {
      console.error("[jarvis] brief error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app2.post("/api/jarvis/chat", async (req, res) => {
    try {
      const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
      try {
        const result = await jarvisChat(pid(req), history);
        res.json(result);
      } catch (llmErr) {
        console.log("[jarvis] LLM chat failed, using local engine:", llmErr instanceof Error ? llmErr.message : String(llmErr));
        const result = await localJarvisChat(pid(req), history);
        res.json(result);
      }
    } catch (err) {
      console.error("[jarvis] chat error:", err);
      res.status(502).json({ message: "Jarvis is unavailable right now." });
    }
  });
  app2.get("/api/jarvis/safety-brief", async (req, res) => {
    try {
      const brief = await buildSafetyBrief(pid(req));
      res.json({ brief });
    } catch (err) {
      console.error("[jarvis] safety brief error:", err);
      res.status(502).json({ message: "Could not generate safety brief." });
    }
  });
  app2.get("/api/settings", async (_req, res) => {
    res.json(await storage.getSettings());
  });
  app2.patch("/api/settings", async (req, res) => {
    const patch = req.body && typeof req.body === "object" ? req.body : {};
    res.json(await storage.updateSettings(patch));
  });
  app2.get("/api/jarvis/health-scan", async (_req, res) => {
    try {
      res.json(await runHealthScan());
    } catch (err) {
      console.error("[health] scan error:", err);
      res.status(500).json({ message: "Health scan failed." });
    }
  });
  app2.post("/api/reseed", async (req, res) => {
    if (req.body?.confirm !== "RESET") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'RESET' } to wipe and reseed demo data." });
    }
    await storage.resetAllData();
    res.json({ ok: true, reseededAt: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.post("/api/wipe-data", async (req, res) => {
    if (req.body?.confirm !== "WIPE") {
      return res.status(400).json({ message: "Confirmation required. Send { confirm: 'WIPE' } to permanently delete all project data." });
    }
    await storage.wipeAllData();
    res.json({ ok: true, wipedAt: (/* @__PURE__ */ new Date()).toISOString() });
  });
  return _httpServer;
}
var import_node_path2, import_node_fs2, import_multer, SESSION_COOKIE, SESSION_MAX_AGE_SEC, authAttempts, AUTH_RATE_LIMIT, AUTH_RATE_WINDOW, PUBLIC_API, UPLOAD_DIR, ALLOWED_MIME, upload, PHOTO_DIR, photoHydrated, IMAGE_MIME, photoUpload, DRONE_DIR, droneUpload;
var init_routes = __esm({
  "server/routes.ts"() {
    "use strict";
    import_node_path2 = __toESM(require("node:path"), 1);
    import_node_fs2 = __toESM(require("node:fs"), 1);
    import_multer = __toESM(require("multer"), 1);
    init_storage();
    init_jarvis();
    init_jarvis_local();
    init_jarvis();
    init_health();
    init_mailer();
    init_schema();
    SESSION_COOKIE = "tp_session";
    SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
    authAttempts = /* @__PURE__ */ new Map();
    AUTH_RATE_LIMIT = 10;
    AUTH_RATE_WINDOW = 15 * 60 * 1e3;
    PUBLIC_API = /* @__PURE__ */ new Set([
      "/api/auth/signup",
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/me",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/stripe/webhook",
      "/api/billing/checkout",
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
app.use(import_express.default.json({ limit: "25mb", verify: (req, _res, buf) => {
  req.rawBody = buf;
} }));
app.use(import_express.default.urlencoded({ extended: false }));
var initError = null;
var initPromise2 = null;
var initAttempts = 0;
async function init() {
  initError = null;
  initAttempts += 1;
  try {
    const { ensureReady: ensureReady2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    await ensureReady2();
    const { registerRoutes: registerRoutes2 } = await Promise.resolve().then(() => (init_routes(), routes_exports));
    const httpServer = (0, import_node_http.createServer)(app);
    await registerRoutes2(httpServer, app);
  } catch (e) {
    initError = e;
    console.error(`[api/index] init failed (attempt ${initAttempts}):`, e);
  }
}
initPromise2 = init();
app.use(async (_req, _res, next) => {
  await initPromise2;
  while (initError && initAttempts < 5) {
    await new Promise((r) => setTimeout(r, 500 * initAttempts));
    initPromise2 = init();
    await initPromise2;
  }
  next();
});
app.use((_req, res, next) => {
  if (initError) {
    const raw = String(initError?.message || initError);
    const friendly = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND/i.test(raw) ? "Temporary connection issue reaching the database. Please try again in a moment." : raw;
    return res.status(503).json({ ok: false, error: friendly });
  }
  next();
});
var index_default = app;
