import { pgTable, text, integer, serial, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ----------------------------- Team members ----------------------------- */
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  trade: text("trade").notNull(),
  company: text("company").notNull(),
  initials: text("initials").notNull(),
  color: text("color").notNull(),
  email: text("email"),
  phone: text("phone"),
  companyPhoto: text("company_photo"),
  accessLevel: text("access_level").notNull().default("project_manager"),
});

/* ------------------------------- Projects ------------------------------- */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  client: text("client").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  address: text("address").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  budget: doublePrecision("budget").notNull(),
  spent: doublePrecision("spent").notNull(),
  progress: integer("progress").notNull(),
  superintendentId: integer("superintendent_id"),
});

/* -------------------------------- Tasks --------------------------------- */
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  trade: text("trade").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  assigneeId: integer("assignee_id"),
  dueDate: text("due_date").notNull(),
  // schedule positioning
  startDate: text("start_date"),
  endDate: text("end_date"),
  seq: integer("seq"),
  // comma-separated list of predecessor task ids (finish-to-start)
  dependsOn: text("depends_on"),
});

/* ------------------------------ Milestones ------------------------------ */
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
});

/* --------------------------------- RFIs --------------------------------- */
export const rfis = pgTable("rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  number: text("number").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  assigneeId: integer("assignee_id"),
  dateCreated: text("date_created").notNull(),
  dueDate: text("due_date").notNull(),
});

/* ----------------------------- Submittals ------------------------------ */
export const submittals = pgTable("submittals", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  number: text("number").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  assigneeId: integer("assignee_id"),
  dateSubmitted: text("date_submitted").notNull(),
  dueDate: text("due_date").notNull(),
});

/* --------------------------- Change orders ----------------------------- */
export const changeOrders = pgTable("change_orders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  number: text("number").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  amount: doublePrecision("amount").notNull(),
  scheduleImpact: integer("schedule_impact").notNull(),
  dateIssued: text("date_issued").notNull(),
});

/* ---------------------------- Action items ----------------------------- */
export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  owner: text("owner").notNull(),
  status: text("status").notNull(),
  priority: text("priority").notNull(),
  dueDate: text("due_date").notNull(),
  source: text("source").notNull(),
});

/* ------------------------------ Daily logs ------------------------------ */
export const dailyLogs = pgTable("daily_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  date: text("date").notNull(),
  authorId: integer("author_id"),
  weather: text("weather").notNull(),
  temp: integer("temp").notNull(),
  crewCount: integer("crew_count").notNull(),
  summary: text("summary").notNull(),
  photos: text("photos"),
});

/* ----------------------------- Punch items ----------------------------- */
export const punchItems = pgTable("punch_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  trade: text("trade").notNull(),
  status: text("status").notNull(),
  assigneeId: integer("assignee_id"),
});

/* ------------------------------ Contacts ------------------------------- */
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  trade: text("trade").notNull(),
  type: text("type").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
});

/* ------------------------------ Equipment ------------------------------- */
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  projectId: integer("project_id"),
  operator: text("operator"),
  location: text("location"),
});

/* ------------------------------- Photos -------------------------------- */
export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  caption: text("caption").notNull(),
  location: text("location").notNull(),
  takenById: integer("taken_by_id"),
  date: text("date").notNull(),
  hue: integer("hue").notNull(),
  storedFileName: text("stored_file_name"),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
});

/* ----------------------------- Documents ------------------------------- */
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: text("size").notNull(),
  uploadedById: integer("uploaded_by_id"),
  date: text("date").notNull(),
  storedFileName: text("stored_file_name"),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
});

/* ------------------------- Company Documents --------------------------- */
export const companyDocuments = pgTable("company_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // New Hire, Contract, HR, Safety, Vendor, Legal, Insurance, Other
  status: text("status").notNull().default("Draft"), // Draft, Active, Archived
  signatureRequired: boolean("signature_required").notNull().default(false),
  signatureStatus: text("signature_status").notNull().default("Not Required"), // Not Required, Needs Signature, Sent, Signed, Expired
  signerName: text("signer_name"),
  signerEmail: text("signer_email"),
  docusignUrl: text("docusign_url"),
  dueDate: text("due_date"),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id"),
  date: text("date").notNull(),
  storedFileName: text("stored_file_name"),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
});

/* --------------------------- Deleted Items ----------------------------- */
export const deletedItems = pgTable("deleted_items", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  data: text("data").notNull(), // JSON-serialized row
  projectName: text("project_name"),
  deletedAt: text("deleted_at").notNull(),
  deletedById: integer("deleted_by_id"),
});

/* ----------------------------- Blueprints ------------------------------ */
export const blueprints = pgTable("blueprints", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sheetNumber: text("sheet_number").notNull(),
  title: text("title").notNull(),
  discipline: text("discipline").notNull(),
  revision: text("revision").notNull(),
  status: text("status").notNull(),
  uploadedById: integer("uploaded_by_id"),
  date: text("date").notNull(),
  hue: integer("hue").notNull(),
});

/* ---------------------------- Drone captures ---------------------------- */
export const droneCaptures = pgTable("drone_captures", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  captureType: text("capture_type").notNull(),
  pilot: text("pilot"),
  flightDate: text("flight_date").notNull(),
  altitude: text("altitude"),
  area: text("area"),
  status: text("status").notNull(),
  hue: integer("hue").notNull(),
  storedFileName: text("stored_file_name"),
  originalFileName: text("original_file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
});

/* ------------------------------ Messages ------------------------------- */
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  authorId: integer("author_id"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

/* ----------------------------- Sticky notes --------------------------- */
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  body: text("body").notNull(),
  color: text("color").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
});

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  connected: boolean("connected").notNull().default(false),
  status: text("status").notNull().default("available"), // available, connected, needs_config, error
  accountLabel: text("account_label"),
  connectedAt: text("connected_at"),
  config: text("config"),
});

/* --------------------------- Subscribers ------------------------------- */
export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  plan: text("plan").notNull(),
  billing: text("billing").notNull(),
  company: text("company"),
  createdAt: text("created_at").notNull(),
});

/* -------------------------- Demo requests ------------------------------ */
export const demoRequests = pgTable("demo_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  phone: text("phone"),
  teamSize: text("team_size"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

/* ------------------------------ Settings ------------------------------- */
export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey(),
  config: text("config").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

/* ------------------------------ Accounts (Auth) ----------------------- */
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  position: text("position"),
  role: text("role").notNull().default("member"),
  company: text("company"),
  createdAt: text("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

/* ------------------------------ Insert schemas -------------------------- */
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export const insertRfiSchema = createInsertSchema(rfis).omit({ id: true });
export const insertSubmittalSchema = createInsertSchema(submittals).omit({ id: true });
export const insertChangeOrderSchema = createInsertSchema(changeOrders).omit({ id: true });
export const insertActionItemSchema = createInsertSchema(actionItems).omit({ id: true });
export const insertDailyLogSchema = createInsertSchema(dailyLogs).omit({ id: true });
export const insertPunchItemSchema = createInsertSchema(punchItems).omit({ id: true });
export const insertTeamSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments).omit({ id: true });
export const insertDeletedItemSchema = createInsertSchema(deletedItems).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true });
export const insertIntegrationSchema = createInsertSchema(integrations).omit({ id: true });
export const insertBlueprintSchema = createInsertSchema(blueprints).omit({ id: true });
export const insertDroneCaptureSchema = createInsertSchema(droneCaptures).omit({ id: true });
export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true });
export const insertSettingsSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export type AppSettingsRow = typeof appSettings.$inferSelect;

/* -------- Auth insert schemas + types -------- */
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1),
  company: z.string().optional(),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type Signup = z.infer<typeof signupSchema>;
export type Login = z.infer<typeof loginSchema>;
export type Account = typeof accounts.$inferSelect;
export type AccountPublic = Omit<Account, "passwordHash">;
export type Session = typeof sessions.$inferSelect;

/** Default app settings (single source for server + client). */
export const DEFAULT_SETTINGS = {
  voiceEnabled: true,
  voiceRate: 0.97,
  voicePitch: 0.9,
  autoSpeak: true,
  addressTerm: "sir",
  tone: "concise" as "concise" | "detailed",
  companyName: "TrussPath",
  defaultProjectId: 0,
};
export type AppSettings = typeof DEFAULT_SETTINGS;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;

export const insertSubscriberSchema = createInsertSchema(subscribers).omit({ id: true, createdAt: true }).extend({
  email: z.string().email(),
  plan: z.enum(["starter", "pro", "enterprise"]),
  billing: z.enum(["monthly", "annual"]),
  company: z.string().optional(),
});
export type Subscriber = typeof subscribers.$inferSelect;
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({ id: true, createdAt: true }).extend({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  phone: z.string().optional(),
  teamSize: z.string().optional(),
  notes: z.string().optional(),
});
export type DemoRequest = typeof demoRequests.$inferSelect;
export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;

/* ------------------------------- Types ---------------------------------- */
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertRfi = z.infer<typeof insertRfiSchema>;
export type InsertSubmittal = z.infer<typeof insertSubmittalSchema>;
export type InsertChangeOrder = z.infer<typeof insertChangeOrderSchema>;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type InsertDailyLog = z.infer<typeof insertDailyLogSchema>;
export type InsertPunchItem = z.infer<typeof insertPunchItemSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type InsertTeamMember = z.infer<typeof insertTeamSchema>;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertCompanyDocument = z.infer<typeof insertCompanyDocumentSchema>;
export type InsertDeletedItem = z.infer<typeof insertDeletedItemSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type InsertBlueprint = z.infer<typeof insertBlueprintSchema>;
export type InsertDroneCapture = z.infer<typeof insertDroneCaptureSchema>;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;

export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Rfi = typeof rfis.$inferSelect;
export type Submittal = typeof submittals.$inferSelect;
export type ChangeOrder = typeof changeOrders.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type PunchItem = typeof punchItems.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type DeletedItem = typeof deletedItems.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Blueprint = typeof blueprints.$inferSelect;
export type DroneCapture = typeof droneCaptures.$inferSelect;
