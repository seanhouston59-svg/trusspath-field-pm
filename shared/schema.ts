import { pgTable, text, integer, serial, doublePrecision, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ------------------------------ Organizations ---------------------------- */
// A business (tenant) that pays for TrussPath. Every account belongs to at
// least one organization via `memberships`. Data (projects, contacts, etc.) is
// scoped to organization_id so orgs never see each other's data.
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerAccountId: integer("owner_account_id").notNull(), // primary owner — the account that created the org
  createdAt: text("created_at").notNull(),
  // Stripe billing (org-level, not account-level)
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // trialing, active, canceled, past_due, etc.
  subscriptionPlan: text("subscription_plan"), // starter | pro | enterprise
  subscriptionBilling: text("subscription_billing"), // monthly | annual
  subscriptionCurrentPeriodEnd: text("subscription_current_period_end"),
  trialEndsAt: text("trial_ends_at"),
  // True once the user schedules a cancel from the Stripe portal; the sub is
  // still active until subscriptionCurrentPeriodEnd, then Stripe fires
  // customer.subscription.deleted and we flip subscriptionStatus to 'canceled'.
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  // IANA timezone name for this org. Used for greetings, "today" calculations,
  // and any user-facing date formatting. Defaults to America/Denver in the DB.
  timezone: text("timezone").notNull().default("America/Denver"),
  // JSONB of integration keys the org has explicitly turned OFF.
  // Shape: { "googleCalendar": true, "sheets": true, ... }. Missing key or
  // false = integration is enabled (default-on). This lets the owner hide
  // an integration's UI everywhere in the app for the whole org.
  disabledIntegrations: jsonb("disabled_integrations").$type<Record<string, boolean>>().default({}).notNull(),
});

/* ------------------------------- Memberships ----------------------------- */
// Bridge between accounts and organizations. Carries the role, which controls
// what the user can do inside the org.
export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  role: text("role").notNull(), // owner | admin | pm | foreman | viewer
  status: text("status").notNull().default("active"), // active | removed
  createdAt: text("created_at").notNull(),
});

/* -------------------------------- Invites -------------------------------- */
// Pending email invites to join an organization. Consumed when the invitee
// signs up (or logs in with a matching email) and clicks the invite link.
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  organizationId: integer("organization_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  invitedByAccountId: integer("invited_by_account_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
});

/* ------------------------------ Roles / helpers -------------------------- */
export type OrgRole = "owner" | "admin" | "pm" | "foreman" | "viewer";
export const ORG_ROLES: OrgRole[] = ["owner", "admin", "pm", "foreman", "viewer"];

// Capability matrix. Every UI action / server endpoint should route through this.
export const ROLE_CAPS: Record<OrgRole, {
  billing: boolean;             // manage subscription + payment methods
  manageMembers: boolean;       // invite/remove/change role of other members
  manageProjects: boolean;      // create/edit/delete projects
  editProjectData: boolean;     // edit tasks, RFIs, daily logs, etc. within assigned projects
  viewProjectData: boolean;     // read project data
  restrictedToAssignedProjects: boolean; // if true, only sees projects they're explicitly on
}> = {
  owner:   { billing: true,  manageMembers: true,  manageProjects: true,  editProjectData: true,  viewProjectData: true,  restrictedToAssignedProjects: false },
  admin:   { billing: false, manageMembers: true,  manageProjects: true,  editProjectData: true,  viewProjectData: true,  restrictedToAssignedProjects: false },
  pm:      { billing: false, manageMembers: false, manageProjects: true,  editProjectData: true,  viewProjectData: true,  restrictedToAssignedProjects: false },
  foreman: { billing: false, manageMembers: false, manageProjects: false, editProjectData: true,  viewProjectData: true,  restrictedToAssignedProjects: true },
  viewer:  { billing: false, manageMembers: false, manageProjects: false, editProjectData: false, viewProjectData: true,  restrictedToAssignedProjects: true },
};

/* ----------------------------- Team members ----------------------------- */
// Legacy per-project rolodex — not app logins. Scoped to org for isolation.
export const teamMembers = pgTable("team_members", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"), // nullable during migration; enforced by server after backfill
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
  organizationId: integer("organization_id"), // nullable during migration; enforced after backfill
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

/* --------------------- Project member assignments ------------------------ */
// Which accounts (memberships) are on which projects. Used for foreman/viewer
// scope restriction. Empty rows = restricted role sees nothing.
export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  membershipId: integer("membership_id").notNull(),
  createdAt: text("created_at").notNull(),
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
  // Optional trade tag — auto-filled from the RFI subject catalog when the
  // user picks a known subject, editable freely otherwise.
  trade: text("trade"),
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
  // Optional trade tag — auto-filled from the submittal subject catalog
  // when the user picks a known subject, editable freely otherwise.
  trade: text("trade"),
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
  // Optional trade tag — auto-filled from the CO title catalog when the
  // user picks a known title, editable freely otherwise.
  trade: text("trade"),
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
  // Optional — defaults to "Medium" so legacy rows and older API callers
  // stay valid. Kept as free text so we can extend the picklist without a
  // schema change.
  priority: text("priority").default("Medium"),
  // Optional free-text work notes / description. Populated by the Field kit's
  // work-notes templates plus the desktop create dialog.
  notes: text("notes"),
  assigneeId: integer("assignee_id"),
});

/* ------------------------------ Contacts ------------------------------- */
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"),
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
  organizationId: integer("organization_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  projectId: integer("project_id"),
  operator: text("operator"),
  location: text("location"),
  // Discriminator so one table backs Equipment, Vehicle, and Tech assets.
  // Values: "Equipment" | "Vehicle" | "Tech"
  assetClass: text("asset_class").notNull().default("Equipment"),
  // Vehicle fields
  make: text("make"),
  model: text("model"),
  year: text("year"),
  vin: text("vin"),
  plate: text("plate"),
  currentMileage: integer("current_mileage"),
  // Service reminder (used by Equipment + Vehicle)
  nextServiceDate: text("next_service_date"),
  nextServiceMileage: integer("next_service_mileage"),
  // Tech / issued-asset fields
  assignedToId: integer("assigned_to_id"),
  issueDate: text("issue_date"),
  returnedDate: text("returned_date"),
  returnSignature: text("return_signature"),
  condition: text("condition"),
  serialNumber: text("serial_number"),
  purchaseDate: text("purchase_date"),
  purchaseCost: text("purchase_cost"),
  notes: text("notes"),
});

/* ------------------------- Maintenance Logs -------------------------- */
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull(),
  date: text("date").notNull(),
  mileage: integer("mileage"),
  cost: text("cost"),
  serviceType: text("service_type"),
  notes: text("notes"),
  performedBy: text("performed_by"),
  receiptDocumentId: integer("receipt_document_id"),
  loggedById: integer("logged_by_id"),
  createdAt: text("created_at").notNull(),
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
  organizationId: integer("organization_id"),
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
  // Notes are org-wide: everyone in an org sees the same corkboard. projectId
  // is kept for backward compatibility with older rows and for future
  // project-tagging, but is no longer required or used for filtering.
  organizationId: integer("organization_id"),
  projectId: integer("project_id"),
  // Account that created the note. Used to skip "ding on new note" for the
  // author's own notes and to display who posted a sticker.
  createdById: integer("created_by_id"),
  body: text("body").notNull(),
  color: text("color").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  // JSON-encoded array of { author: string, initials: string, body: string, at: ISO }.
  // Null / empty = no replies. Written to inline on the sticky itself so the note
  // becomes a mini conversation. See POST /api/notes/:id/replies.
  replies: text("replies"),
  // 'note' (default) = regular sticky with header bar, replies, delete X.
  // 'sticker' = decorative-only emoji pinned to the board. Body holds the
  // emoji character; color/replies are ignored for stickers. Nullable so
  // existing rows without the column read as 'note'.
  type: text("type").default("note"),
});

export const integrations = pgTable("integrations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"),
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
  organizationId: integer("organization_id"),
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
  role: text("role").notNull().default("member"), // member | owner
  company: text("company"),
  createdAt: text("created_at").notNull(),
  // Access control — admin must approve new accounts before they can use the app.
  approvalStatus: text("approval_status").notNull().default("pending"), // pending | approved | denied
  approvedAt: text("approved_at"),
  approvedBy: integer("approved_by"), // accountId of the approver
  // Stripe billing
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, trialing, canceled, past_due, etc.
  subscriptionPlan: text("subscription_plan"), // starter, pro, enterprise
  subscriptionBilling: text("subscription_billing"), // monthly, annual
  subscriptionCurrentPeriodEnd: text("subscription_current_period_end"),
  // Demo login — non-null on accounts created via /api/admin/demo-accounts. The
  // account (and any sessions) stop working once now > demoExpiresAt. Real
  // accounts leave this NULL and are unaffected.
  demoExpiresAt: text("demo_expires_at"),
  // Per-user dashboard customization. Null / missing keys → use role defaults
  // (see client/src/lib/dashboard-layout.ts). Structure:
  //   { widgets: [{ id: string, size: "sm"|"md"|"lg"|"xl", hidden?: boolean }] }
  // The order of the array is the render order. Unknown ids are ignored so
  // that removing a widget in a future release doesn't strand old prefs.
  dashboardLayout: jsonb("dashboard_layout").$type<{
    widgets: Array<{ id: string; size: "sm" | "md" | "lg" | "xl"; hidden?: boolean }>;
  }>(),
});

// Field punches - lightweight clock in/out records captured from the mobile
// foreman flow. Distinct from timesheets (which are week-based); this table
// is a stream of raw events. A later job can roll them into timesheet rows.
// client_id is used for offline-queue idempotency so retried submits from
// the offline queue don't create duplicates.
export const fieldPunches = pgTable("field_punches", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").notNull(),
  kind: text("kind").notNull(), // "in" | "out" | "break_start" | "break_end"
  occurredAt: text("occurred_at").notNull().default(sql`NOW()`),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyM: doublePrecision("accuracy_m"),
  note: text("note"),
  clientId: text("client_id"),
  createdAt: text("created_at").notNull().default(sql`NOW()`),
});

// Quick-capture field observations. kind = 'safety' | 'quality' | 'rfi' |
// 'issue'. These are the fast-entry equivalent of a formal RFI; a future
// promotion job can convert an observation into a numbered RFI. Same
// (accountId, clientId) uniqueness pattern as fieldPunches for offline
// dedupe.
export const fieldObservations = pgTable("field_observations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").notNull(),
  kind: text("kind").notNull(),
  severity: text("severity").notNull().default("normal"), // 'low' | 'normal' | 'high' | 'urgent'
  title: text("title").notNull(),
  body: text("body"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyM: doublePrecision("accuracy_m"),
  photoId: integer("photo_id"),
  occurredAt: text("occurred_at").notNull().default(sql`NOW()`),
  clientId: text("client_id"),
  createdAt: text("created_at").notNull().default(sql`NOW()`),
});

/* -------------------------- Field Voice Notes ---------------------------
 * Hands-free field capture: a foreman taps Record, speaks, and the audio
 * plus an optional live transcript get saved against a project. Stored
 * file lives on disk (same PHOTO_DIR pattern) and the row keeps the
 * transcript so the search + timeline can index the note without
 * transcoding every playback. GPS is optional — captured when available
 * so a note pinned to a specific location can be plotted on a map later.
 */
export const voiceNotes = pgTable("voice_notes", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").notNull(),
  title: text("title"),
  transcript: text("transcript"),
  durationMs: integer("duration_ms"),
  storedFileName: text("stored_file_name"),
  mimeType: text("mime_type"),
  fileSizeBytes: integer("file_size_bytes"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  accuracyM: doublePrecision("accuracy_m"),
  occurredAt: text("occurred_at").notNull().default(sql`NOW()`),
  clientId: text("client_id"),
  createdAt: text("created_at").notNull().default(sql`NOW()`),
});

// -----------------------------------------------------------------------------
// Project Timeline event log.
//
// One row per meaningful action across the whole app (RFI created, punch
// closed, photo uploaded, timesheet clock-in, daily log submitted, etc.).
// Append-only — nothing here is ever updated in place, only inserted. This is
// the audit trail users search when reconstructing what happened on a job
// months after the fact.
//
// The `meta` blob is intentionally loose (jsonb) so any route can drop in
// route-specific detail (e.g. RFI number, punch title, photo caption, weather
// slug) without needing a schema change. The client renders known keys and
// ignores the rest.
//
// Naming: `kind` is a stable machine identifier ("rfi.created", "punch.closed",
// "timesheet.clockin"). The UI resolves that to an icon + colour. See
// `client/src/lib/project-events.ts` for the display metadata.
// -----------------------------------------------------------------------------
export const projectEvents = pgTable("project_events", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id"),
  projectId: integer("project_id").notNull(),
  // Who caused the event. Nullable because system-generated events (Jarvis
  // auto-close, cron rollups) don't have a human actor.
  actorAccountId: integer("actor_account_id"),
  actorName: text("actor_name"), // denormalized snapshot — survives if member leaves
  // Stable dotted identifier: "<entity>.<verb>". Keep the list in
  // shared/project-event-kinds.ts (server + client).
  kind: text("kind").notNull(),
  // Short human-readable summary that renders as the timeline row title.
  // Server-generated at insert time so we don't need the actor's locale on
  // the read side. Example: "RFI #37 submitted — Beam sizing at grid B-4".
  title: text("title").notNull(),
  // Optional second line, e.g. "assigned to Marcus" or a truncated body.
  subtitle: text("subtitle"),
  // Route-specific detail. Common keys the UI understands:
  //   { number, status, category, count, weather, temp, sourceUrl }
  meta: jsonb("meta").notNull().default(sql`'{}'::jsonb`),
  // Optional link back to the source row — lets the UI deep-link to the
  // detail page for that entity.
  sourceType: text("source_type"), // 'rfi' | 'punch' | 'photo' | 'timesheet' | …
  sourceId: integer("source_id"),
  // When the underlying event actually happened. For most rows this equals
  // createdAt, but backfills and offline sync may set an earlier occurredAt.
  occurredAt: text("occurred_at").notNull().default(sql`NOW()`),
  createdAt: text("created_at").notNull().default(sql`NOW()`),
});

export const insertProjectEventSchema = createInsertSchema(projectEvents).omit({ id: true, createdAt: true });
export type InsertProjectEvent = typeof insertProjectEventSchema._type;
export type ProjectEvent = typeof projectEvents.$inferSelect;

// Access helpers — shared between server and client so both agree on what "in good standing" means.

// True if this account is a demo login whose 48h window has passed.
export function isDemoExpired(a: Pick<Account, "demoExpiresAt"> | null | undefined, nowIso: string = new Date().toISOString()): boolean {
  return !!a?.demoExpiresAt && a.demoExpiresAt <= nowIso;
}
export const ACTIVE_SUB_STATUSES = new Set(["active", "trialing"]);
export function isSubscriptionActive(status: string | null | undefined): boolean {
  return !!status && ACTIVE_SUB_STATUSES.has(status);
}

// Legacy: single-tenant per-account check. Preserved for backward compat during migration.
// New multi-tenant check is isOrgInGoodStanding() below — use that everywhere for new code.
export function isAccountInGoodStanding(a: Pick<Account, "role" | "approvalStatus" | "subscriptionStatus"> | null | undefined): boolean {
  if (!a) return false;
  if (a.role === "owner") return true; // Legacy platform-owner bypass.
  return a.approvalStatus === "approved" && isSubscriptionActive(a.subscriptionStatus);
}

// Multi-tenant: an org is in good standing if it has an active/trialing subscription.
export function isOrgInGoodStanding(org: { subscriptionStatus?: string | null } | null | undefined): boolean {
  return isSubscriptionActive(org?.subscriptionStatus);
}

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  accountId: integer("account_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/* --------------------------- Jarvis memory ---------------------------- */
export const jarvisMemory = pgTable("jarvis_memory", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  question: text("question").notNull(),
  normalizedQuestion: text("normalized_question").notNull(),
  topic: text("topic"),
  answer: text("answer"),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("user_taught"),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

/* ----------------------------- Timesheets ------------------------------ */
// Weekly timesheet. Auto-created on first clock-in of the week for a given
// (accountId, weekStart) pair. Time_entries roll up daily from field_punches.
// Lifecycle:
//   draft            — auto-created, still accepting punches for the week
//   needs-signature  — week rolled over, employee must sign & submit
//   pending-approval — employee signed, awaiting manager countersign
//   approved         — manager countersigned; locked from further edits
export const timesheets = pgTable("timesheets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // Account and org linkage. Nullable for legacy hand-created timesheets
  // from before the auto-create system — the server treats null accountId as
  // "generic" and never auto-populates from punches.
  accountId: integer("account_id"),
  organizationId: integer("organization_id"),
  employeeName: text("employee_name").notNull(),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  totalHours: text("total_hours").notNull().default("0"),
  status: text("status").notNull().default("draft"),
  employeeSignature: text("employee_signature"),
  employeeSubmittedAt: text("employee_submitted_at"),
  managerSignature: text("manager_signature"),
  managerApprovedAt: text("manager_approved_at"),
  managerName: text("manager_name"),
  managerEmail: text("manager_email"),
  // Tracks when/where the timesheet was sent to a Project Executive for approval.
  // Manager signature is gated on sentAt being non-null (see PATCH /api/timesheets/:id).
  sentAt: text("sent_at"),
  sentTo: text("sent_to"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  timesheetId: integer("timesheet_id").notNull(),
  entryDate: text("entry_date").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  clientName: text("client_name"),
  projectName: text("project_name"),
  hoursWorked: text("hours_worked").notNull().default("0"),
  activities: text("activities"),
  createdAt: text("created_at").notNull(),
});

/* ----------------------------- Mobilization ------------------------------ */
// Executive OS > Mobilization. One plan per project; every other table hangs
// off project_id directly so a tab can be queried without joining the plan.
// The mobilization milestone timeline reuses the shared `milestones` table
// with kind="mobilization" rather than duplicating a schedule table here.
// Section names and default rows come from shared/mobilization-catalog.ts.

export const mobilizationPlans = pgTable("mobilization_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  status: text("status").notNull().default("planning"), // planning | in_progress | complete
  targetStartDate: text("target_start_date").notNull(),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  notes: text("notes"),

  // Project header — the cast of characters and the building itself. These
  // live on the plan rather than on `projects` because they are only ever
  // captured during mobilization and would be dead weight on every project row.
  ownerRep: text("owner_rep"),
  ownerRepPhone: text("owner_rep_phone"),
  ownerRepEmail: text("owner_rep_email"),
  architect: text("architect"),
  architectFirm: text("architect_firm"),
  architectPhone: text("architect_phone"),
  architectEmail: text("architect_email"),
  engineerOfRecord: text("engineer_of_record"),
  engineerFirm: text("engineer_firm"),
  engineerPhone: text("engineer_phone"),
  engineerEmail: text("engineer_email"),
  jurisdiction: text("jurisdiction"),
  permitExpediter: text("permit_expediter"),
  permitExpediterPhone: text("permit_expediter_phone"),
  projectType: text("project_type"),
  squareFootage: integer("square_footage"),
  stories: integer("stories"),
  occupancyType: text("occupancy_type"),
  weatherStation: text("weather_station"),

  // Site logistics
  truckRoutes: text("truck_routes"),
  deliveryHours: text("delivery_hours"),
  cranePicks: text("crane_picks"),
  laydownAreas: text("laydown_areas"),
  gateSchedule: text("gate_schedule"),
  neighborCommsPlan: text("neighbor_comms_plan"),
  noiseOrdinanceHours: text("noise_ordinance_hours"),

  // Objectives and scope
  objectivesNarrative: text("objectives_narrative"),
  scopeSummary: text("scope_summary"),
  exclusions: text("exclusions"),
  assumptions: text("assumptions"),
  workNotIncluded: text("work_not_included"),

  // Safety and environmental
  siteSpecificHazards: text("site_specific_hazards"),
  eapDetails: text("eap_details"),
  hospitalName: text("hospital_name"),
  hospitalPhone: text("hospital_phone"),
  hospitalRoute: text("hospital_route"),
  musterPoint: text("muster_point"),
  secondaryMusterPoint: text("secondary_muster_point"),
  spillResponsePlan: text("spill_response_plan"),
  msdsLocation: text("msds_location"),
  environmentalNarrative: text("environmental_narrative"),

  // Staffing and emergency contacts
  superintendentPhone: text("superintendent_phone"),
  projectManagerPhone: text("project_manager_phone"),
  safetyOfficerName: text("safety_officer_name"),
  safetyOfficerPhone: text("safety_officer_phone"),
  emergencyContact24hName: text("emergency_contact_24h_name"),
  emergencyContact24hPhone: text("emergency_contact_24h_phone"),
  onCallRotation: text("on_call_rotation"),
  subcontractorForemen: text("subcontractor_foremen"),
});

export const mobilizationItems = pgTable("mobilization_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: integer("owner_id"), // team_members.id
  targetDate: text("target_date"),
  status: text("status").notNull().default("not_started"), // not_started | in_progress | done | na
  completedAt: text("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
});

export const mobilizationPermits = pgTable("mobilization_permits", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  agency: text("agency"),
  permitNumber: text("permit_number"),
  status: text("status").notNull().default("Not Started"), // Not Started | Applied | Approved | Rejected | Expired
  appliedDate: text("applied_date"),
  approvedDate: text("approved_date"),
  expirationDate: text("expiration_date"),
  notes: text("notes"),
});

export const mobilizationEquipment = pgTable("mobilization_equipment", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  vendor: text("vendor"),
  arrivalDate: text("arrival_date"),
  onSiteConfirmed: boolean("on_site_confirmed").notNull().default(false),
  departureDate: text("departure_date"),
  notes: text("notes"),
});

export const mobilizationUtilities = pgTable("mobilization_utilities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  kind: text("kind").notNull(), // power | water | internet | wifi | cameras | security | lighting | hvac | other
  provider: text("provider"),
  requestedDate: text("requested_date"),
  installedDate: text("installed_date"),
  accountNumber: text("account_number"),
  meterNumber: text("meter_number"),
  notes: text("notes"),
});

// Staff onboarding is a join onto team_members — the person already exists in
// the org roster, this row adds the per-project mobilization state.
export const mobilizationStaff = pgTable("mobilization_staff", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  teamMemberId: integer("team_member_id").notNull(), // team_members.id
  startDate: text("start_date"),
  orientationDone: boolean("orientation_done").notNull().default(false),
  drugTestDone: boolean("drug_test_done").notNull().default(false),
  ppeIssued: boolean("ppe_issued").notNull().default(false),
  notes: text("notes"),
});

// Subs are tracked standalone (not via contacts) because mobilization needs
// compliance flags that only matter for the duration of onboarding.
export const mobilizationSubs = pgTable("mobilization_subs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  trade: text("trade").notNull(),
  company: text("company").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  insuranceOnFile: boolean("insurance_on_file").notNull().default(false),
  w9OnFile: boolean("w9_on_file").notNull().default(false),
  msaSigned: boolean("msa_signed").notNull().default(false),
  onSiteDate: text("on_site_date"),
  notes: text("notes"),
});

export const mobilizationRisks = pgTable("mobilization_risks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  risk: text("risk").notNull(),
  likelihood: text("likelihood").notNull().default("med"), // low | med | high
  impact: text("impact").notNull().default("med"), // low | med | high
  mitigation: text("mitigation"),
  ownerId: integer("owner_id"), // team_members.id
  status: text("status").notNull().default("open"), // open | monitoring | mitigated | closed
  notes: text("notes"),
});

// The sign-off block on the Mobilization Plan PDF. Rows are seeded per project
// so the roles always render in a fixed order even before anyone signs; `name`
// is best-effort matched against team_members at seed time and stays editable.
export const mobilizationSignatures = pgTable("mobilization_signatures", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  role: text("role").notNull(),
  name: text("name"),
  title: text("title"),
  signedDate: text("signed_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Free-text narrative per checklist section. Lazily created on first write —
// a project with no narratives has no rows, and the read path fills the gaps.
export const mobilizationSectionNotes = pgTable("mobilization_section_notes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  section: text("section").notNull(),
  narrative: text("narrative").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
  updatedById: integer("updated_by_id"), // accounts.id
}, (t) => ({
  projectSectionIdx: uniqueIndex("mobilization_section_notes_project_section_idx")
    .on(t.projectId, t.section),
}));

/* ======================= Project Setup (Executive OS) ====================
 * Pre-mobilization intake. One setup row per project drives the Project
 * Charter and Kickoff Agenda documents; stakeholders, contract docs,
 * deliverables and signatures hang off project_id. Money and percentages are
 * stored as text so a numeric round-trip can't shift a contract value.
 */
export const projectSetup = pgTable("project_setup", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // in_progress | ready_for_kickoff | kicked_off | complete
  status: text("status").notNull().default("in_progress"),

  // Ownership / identity
  projectNumber: text("project_number"),
  contractNumber: text("contract_number"),
  awardDate: text("award_date"),
  noticeToProceedDate: text("notice_to_proceed_date"),
  substantialCompletionDate: text("substantial_completion_date"),
  finalCompletionDate: text("final_completion_date"),
  // lump_sum | gmp | cost_plus | t_and_m | unit_price | design_build | other
  contractType: text("contract_type"),
  // dbb | cmar | design_build | ipd | other
  deliveryMethod: text("delivery_method"),

  // Financial
  originalContractValue: text("original_contract_value"),
  contingencyPercent: text("contingency_percent"),
  retainagePercent: text("retainage_percent"),
  paymentTerms: text("payment_terms"),
  billingCycle: text("billing_cycle"), // monthly | bi_monthly | milestone

  // Insurance / bonding
  insuranceCarrier: text("insurance_carrier"),
  insurancePolicyNumber: text("insurance_policy_number"),
  bondCarrier: text("bond_carrier"),
  bondPolicyNumber: text("bond_policy_number"),
  bondAmount: text("bond_amount"),

  // Narratives — these are the body of the Project Charter.
  projectDescription: text("project_description"),
  businessCase: text("business_case"),
  strategicGoals: text("strategic_goals"),
  successCriteria: text("success_criteria"),
  keyRisks: text("key_risks"),
  keyAssumptions: text("key_assumptions"),
  keyConstraints: text("key_constraints"),
  communicationPlan: text("communication_plan"),
  changeControlProcess: text("change_control_process"),
  documentationStandards: text("documentation_standards"),
  qualityStandards: text("quality_standards"),
  safetyStandards: text("safety_standards"),
  submittalWorkflow: text("submittal_workflow"),
  rfiWorkflow: text("rfi_workflow"),
  payAppWorkflow: text("pay_app_workflow"),
  closeoutRequirements: text("closeout_requirements"),
  warrantyRequirements: text("warranty_requirements"),

  // Kickoff meeting
  kickoffScheduledAt: text("kickoff_scheduled_at"),
  kickoffLocation: text("kickoff_location"),
  kickoffAgendaNotes: text("kickoff_agenda_notes"),
  kickoffAttendeesNarrative: text("kickoff_attendees_narrative"),
  kickoffDecisions: text("kickoff_decisions"),
  kickoffActionItems: text("kickoff_action_items"),

  // Approvals
  charterApprovedAt: text("charter_approved_at"),
  charterApprovedById: integer("charter_approved_by_id"), // accounts.id
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (t) => ({
  projectIdx: uniqueIndex("project_setup_project_idx").on(t.projectId),
}));

export const projectSetupStakeholders = pgTable("project_setup_stakeholders", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  role: text("role").notNull(),
  organization: text("organization"),
  name: text("name"),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projectSetupContractDocs = pgTable("project_setup_contract_docs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // contract | exhibit | spec | drawing_set | addendum | insurance_cert | bond | permit | other
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  revision: text("revision"),
  issuedDate: text("issued_date"),
  receivedDate: text("received_date"),
  // Where the document lives: URL, folder path, or a physical location.
  location: text("location"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const projectSetupDeliverables = pgTable("project_setup_deliverables", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull().default("pending"), // pending | in_progress | complete | na
  dueDate: text("due_date"),
  completedAt: text("completed_at"),
  ownerId: integer("owner_id"), // accounts.id
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Sign-off block on the Project Charter. Same shape as mobilization_signatures.
export const projectSetupSignatures = pgTable("project_setup_signatures", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  role: text("role").notNull(),
  name: text("name"),
  title: text("title"),
  signedDate: text("signed_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ====================== Pre-Construction (Executive OS) ==================
 * Sits between Project Setup and Mobilization: design tracking, value
 * engineering, permitting, subcontractor prequal, bid buyout and long-lead
 * procurement. One pre_construction row per project drives the documents;
 * everything else hangs off project_id. Money is stored as text so a numeric
 * round-trip can't shift a bid or PO value.
 */
export const preConstruction = pgTable("pre_construction", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // in_progress | design_locked | bought_out | complete
  status: text("status").notNull().default("in_progress"),

  // Design progress
  // sd | dd | cd | permit_set | bid_set | for_construction
  designPhase: text("design_phase"),
  designCompletionPercent: integer("design_completion_percent"),

  // Milestone dates
  permitTargetDate: text("permit_target_date"),
  permitReceivedDate: text("permit_received_date"),
  buyoutTargetDate: text("buyout_target_date"),
  buyoutCompleteDate: text("buyout_complete_date"),

  // @deprecated derived from bidPackages count; do not read or write.
  bidPackagesCount: integer("bid_packages_count").notNull().default(0),
  // @deprecated derived from bidPackages count; do not read or write.
  bidPackagesBoughtOutCount: integer("bid_packages_bought_out_count").notNull().default(0),

  // Ownership
  preconLeadName: text("precon_lead_name"),
  preconLeadPhone: text("precon_lead_phone"),
  preconLeadEmail: text("precon_lead_email"),
  estimatorName: text("estimator_name"),
  estimatorPhone: text("estimator_phone"),
  estimatorEmail: text("estimator_email"),

  // Narratives — design
  designNarrative: text("design_narrative"),
  designAssumptions: text("design_assumptions"),
  designExclusions: text("design_exclusions"),
  veStrategy: text("ve_strategy"),

  // Narratives — constructability
  constructabilityFindings: text("constructability_findings"),
  constructabilitySummary: text("constructability_summary"),
  siteConditionsNotes: text("site_conditions_notes"),
  logisticsConsiderations: text("logistics_considerations"),

  // Narratives — permitting
  permitStrategy: text("permit_strategy"),
  jurisdictionalNarrative: text("jurisdictional_narrative"),
  openConditionsNarrative: text("open_conditions_narrative"),

  // Narratives — prequal / bidding
  prequalCriteria: text("prequal_criteria"),
  bidStrategy: text("bid_strategy"),
  bidderOutreachNarrative: text("bidder_outreach_narrative"),

  // Narratives — buyout / procurement
  buyoutStrategy: text("buyout_strategy"),
  longLeadStrategy: text("long_lead_strategy"),
  deliveryRiskNarrative: text("delivery_risk_narrative"),

  // Narratives — overall
  overallRisks: text("overall_risks"),
  overallAssumptions: text("overall_assumptions"),
  openIssues: text("open_issues"),
  nextSteps: text("next_steps"),

  // Approvals
  preconPlanApprovedAt: text("precon_plan_approved_at"),
  preconPlanApprovedById: integer("precon_plan_approved_by_id"), // accounts.id
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (t) => ({
  projectIdx: uniqueIndex("pre_construction_project_idx").on(t.projectId),
}));

export const preConstructionDesignDocs = pgTable("pre_construction_design_docs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // architectural | structural | mep | civil | landscape | interiors | other
  discipline: text("discipline"),
  // drawing_set | spec_section | addendum | bulletin | sketch | narrative | report | other
  docType: text("doc_type"),
  label: text("label").notNull(),
  revision: text("revision"),
  issuedDate: text("issued_date"),
  receivedDate: text("received_date"),
  status: text("status"), // current | superseded | pending
  // Where the document lives: URL, folder path, or a physical location.
  location: text("location"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Design-phase RFIs, tracked separately from the construction-phase `rfis`
// table: these are questions to the design team before the set is final.
export const preConstructionDesignRfis = pgTable("pre_construction_design_rfis", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  rfiNumber: text("rfi_number"),
  subject: text("subject").notNull(),
  discipline: text("discipline"),
  question: text("question"),
  response: text("response"),
  status: text("status"), // open | answered | closed | void
  askedById: integer("asked_by_id"), // accounts.id
  askedDate: text("asked_date"),
  respondedById: integer("responded_by_id"), // accounts.id
  respondedDate: text("responded_date"),
  impact: text("impact"), // none | cost | schedule | both
  costImpactUsd: text("cost_impact_usd"),
  scheduleImpactDays: integer("schedule_impact_days"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const preConstructionVeItems = pgTable("pre_construction_ve_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  veNumber: text("ve_number"),
  description: text("description").notNull(),
  discipline: text("discipline"),
  status: text("status"), // proposed | accepted | rejected | held
  estimatedSavingsUsd: text("estimated_savings_usd"),
  scheduleImpactDays: integer("schedule_impact_days"),
  proposedById: integer("proposed_by_id"), // accounts.id
  proposedDate: text("proposed_date"),
  decisionDate: text("decision_date"),
  decisionNotes: text("decision_notes"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Distinct from mobilization_permits: these are the pre-construction permit
// applications tracked through the jurisdiction, not the on-site postings.
export const preConstructionPermits = pgTable("pre_construction_permits", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  // building | demolition | earthwork | foundation | mep | electrical | plumbing
  // | mechanical | fire | zoning | right_of_way | environmental | other
  permitType: text("permit_type"),
  permitNumber: text("permit_number"),
  jurisdiction: text("jurisdiction"),
  applicationDate: text("application_date"),
  hearingDate: text("hearing_date"),
  issuedDate: text("issued_date"),
  expirationDate: text("expiration_date"),
  // not_started | application_in_progress | submitted | in_review
  // | conditions_pending | issued | expired | revoked
  status: text("status"),
  expediter: text("expediter"),
  expediterPhone: text("expediter_phone"),
  feePaid: text("fee_paid"),
  conditions: text("conditions"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const preConstructionPrequalSubs = pgTable("pre_construction_prequal_subs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  companyName: text("company_name").notNull(),
  trade: text("trade"),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  insuranceExpires: text("insurance_expires"),
  insuranceLimit: text("insurance_limit"),
  bondCapacity: text("bond_capacity"),
  emrRating: text("emr_rating"),
  // not_started | submitted | approved | conditionally_approved | declined | expired
  prequalStatus: text("prequal_status"),
  prequalDate: text("prequal_date"),
  prequalExpires: text("prequal_expires"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const preConstructionBidPackages = pgTable("pre_construction_bid_packages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  packageNumber: text("package_number"),
  label: text("label").notNull(),
  csiDivision: text("csi_division"),
  estimatedValueUsd: text("estimated_value_usd"),
  bidDueDate: text("bid_due_date"),
  bidsReceivedCount: integer("bids_received_count").notNull().default(0),
  awardedTo: text("awarded_to"),
  awardedDate: text("awarded_date"),
  awardedValueUsd: text("awarded_value_usd"),
  // not_ready | out_for_bid | bids_received | awarded | contract_executed | on_hold
  status: text("status"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const preConstructionLongLeadItems = pgTable("pre_construction_long_lead_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  itemNumber: text("item_number"),
  description: text("description").notNull(),
  discipline: text("discipline"),
  csiDivision: text("csi_division"),
  orderedDate: text("ordered_date"),
  submittedDate: text("submitted_date"),
  approvedDate: text("approved_date"),
  fabricationStartDate: text("fabrication_start_date"),
  expectedDeliveryDate: text("expected_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  leadTimeWeeks: integer("lead_time_weeks"),
  // identified | submittal_pending | submittal_approved | ordered | in_fabrication
  // | shipped | delivered | installed | at_risk
  status: text("status"),
  supplier: text("supplier"),
  supplierContact: text("supplier_contact"),
  supplierPhone: text("supplier_phone"),
  poNumber: text("po_number"),
  poValueUsd: text("po_value_usd"),
  alternatives: text("alternatives"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// Sign-off block on the Pre-Construction Plan. Same shape as
// mobilization_signatures and project_setup_signatures.
/* -------- Lean Executive OS modules (4-22) ------------------------------
 *
 * Lifecycle modules 4-22 (Site Logistics through Risk & Insurance) share two
 * tables: `lean_module_state` for the per-module parent record and
 * `lean_module_items` for the row list. Each module is identified by its
 * slug (e.g. "site-logistics") and a project can have at most one state row
 * per module.
 *
 * When any module graduates to its own dedicated tables (like Pre-Con did),
 * its data is migrated over and its slug is retired here.
 */
export const leanModuleState = pgTable("lean_module_state", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  moduleId: text("module_id").notNull(), // matches slug in LEAN_MODULES
  // not_started | in_progress | ready_for_review | approved | complete | on_hold
  status: text("status").notNull().default("not_started"),
  // Optional target start / target complete dates (ISO date strings)
  targetStartDate: text("target_start_date"),
  targetCompleteDate: text("target_complete_date"),
  // Ownership
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  // Freeform narrative fields — modules that need more structure graduate off
  // this table into their own dedicated schema.
  overview: text("overview"),
  risks: text("risks"),
  assumptions: text("assumptions"),
  nextSteps: text("next_steps"),
  notes: text("notes"),
  // Approvals
  planApprovedAt: text("plan_approved_at"),
  planApprovedById: integer("plan_approved_by_id"), // accounts.id
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
}, (t) => ({
  projectModuleIdx: uniqueIndex("lean_module_state_project_module_idx").on(t.projectId, t.moduleId),
}));

export const leanModuleItems = pgTable("lean_module_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  moduleId: text("module_id").notNull(), // matches slug in LEAN_MODULES
  // Freeform row fields. Modules that need more columns graduate off this
  // table into a purpose-built schema.
  title: text("title").notNull(),
  category: text("category"),
  ownerName: text("owner_name"),
  dueDate: text("due_date"),
  // not_started | in_progress | complete | on_hold | at_risk | n_a
  status: text("status"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/**
 * Photos and files attached to a specific lean-module item row.
 *
 * itemId is the FK; projectId + moduleId are denormalized so we can enforce
 * scoping without a join and drop attachments in bulk when an item is deleted.
 * `url` is a server-relative path served by the upload directory route.
 */
export const leanModuleItemAttachments = pgTable("lean_module_item_attachments", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  projectId: integer("project_id").notNull(),
  moduleId: text("module_id").notNull(),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  // "photo" for images, "file" for everything else. Client uses this to pick
  // between an image preview and a document icon.
  kind: text("kind").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedByAccountId: integer("uploaded_by_account_id"),
  uploadedByName: text("uploaded_by_name"),
  uploadedAt: text("uploaded_at").notNull(),
});

export const preConstructionSignatures = pgTable("pre_construction_signatures", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  role: text("role").notNull(),
  name: text("name"),
  title: text("title"),
  signedDate: text("signed_date"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
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
export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogs).omit({ id: true, createdAt: true });
export const insertPhotoSchema = createInsertSchema(photos).omit({ id: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export const insertCompanyDocumentSchema = createInsertSchema(companyDocuments).omit({ id: true });
export const insertDeletedItemSchema = createInsertSchema(deletedItems).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
// Note inserts: organizationId + createdById are stamped by the server from
// the authenticated session; projectId is an optional tag; type defaults to
// 'note'. All four are optional at the schema layer so seed helpers and
// migrations can create rows without knowing about them.
export const insertNoteSchema = createInsertSchema(notes)
  .omit({ id: true })
  .partial({ organizationId: true, projectId: true, createdById: true, type: true, replies: true });
export const insertIntegrationSchema = createInsertSchema(integrations).omit({ id: true });
export const insertBlueprintSchema = createInsertSchema(blueprints).omit({ id: true });
export const insertDroneCaptureSchema = createInsertSchema(droneCaptures).omit({ id: true });
export const insertJarvisMemorySchema = createInsertSchema(jarvisMemory).omit({ id: true, createdAt: true, updatedAt: true, hitCount: true });
export const insertTimesheetSchema = createInsertSchema(timesheets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true });
export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true });

/* -------- Mobilization insert schemas + types -------- */
export const insertMobilizationPlanSchema = createInsertSchema(mobilizationPlans).omit({ id: true });
export const insertMobilizationItemSchema = createInsertSchema(mobilizationItems).omit({ id: true });
export const insertMobilizationPermitSchema = createInsertSchema(mobilizationPermits).omit({ id: true });
export const insertMobilizationEquipmentSchema = createInsertSchema(mobilizationEquipment).omit({ id: true });
export const insertMobilizationUtilitySchema = createInsertSchema(mobilizationUtilities).omit({ id: true });
export const insertMobilizationStaffSchema = createInsertSchema(mobilizationStaff).omit({ id: true });
export const insertMobilizationSubSchema = createInsertSchema(mobilizationSubs).omit({ id: true });
export const insertMobilizationRiskSchema = createInsertSchema(mobilizationRisks).omit({ id: true });
export const insertMobilizationSignatureSchema = createInsertSchema(mobilizationSignatures).omit({ id: true });
export const insertMobilizationSectionNoteSchema = createInsertSchema(mobilizationSectionNotes).omit({ id: true });

export type MobilizationPlan = typeof mobilizationPlans.$inferSelect;
export type InsertMobilizationPlan = typeof mobilizationPlans.$inferInsert;
export type MobilizationItem = typeof mobilizationItems.$inferSelect;
export type InsertMobilizationItem = typeof mobilizationItems.$inferInsert;
export type MobilizationPermit = typeof mobilizationPermits.$inferSelect;
export type InsertMobilizationPermit = typeof mobilizationPermits.$inferInsert;
export type MobilizationEquipment = typeof mobilizationEquipment.$inferSelect;
export type InsertMobilizationEquipment = typeof mobilizationEquipment.$inferInsert;
export type MobilizationUtility = typeof mobilizationUtilities.$inferSelect;
export type InsertMobilizationUtility = typeof mobilizationUtilities.$inferInsert;
export type MobilizationStaff = typeof mobilizationStaff.$inferSelect;
export type InsertMobilizationStaff = typeof mobilizationStaff.$inferInsert;
export type MobilizationSub = typeof mobilizationSubs.$inferSelect;
export type InsertMobilizationSub = typeof mobilizationSubs.$inferInsert;
export type MobilizationRisk = typeof mobilizationRisks.$inferSelect;
export type InsertMobilizationRisk = typeof mobilizationRisks.$inferInsert;
export type MobilizationSignature = typeof mobilizationSignatures.$inferSelect;
export type InsertMobilizationSignature = typeof mobilizationSignatures.$inferInsert;
export type MobilizationSectionNote = typeof mobilizationSectionNotes.$inferSelect;
export type InsertMobilizationSectionNote = typeof mobilizationSectionNotes.$inferInsert;

/* -------- Project Setup insert schemas + types -------- */
export const insertProjectSetupSchema = createInsertSchema(projectSetup).omit({ id: true });
export const insertProjectSetupStakeholderSchema = createInsertSchema(projectSetupStakeholders).omit({ id: true });
export const insertProjectSetupContractDocSchema = createInsertSchema(projectSetupContractDocs).omit({ id: true });
export const insertProjectSetupDeliverableSchema = createInsertSchema(projectSetupDeliverables).omit({ id: true });
export const insertProjectSetupSignatureSchema = createInsertSchema(projectSetupSignatures).omit({ id: true });

export type ProjectSetup = typeof projectSetup.$inferSelect;
export type InsertProjectSetup = typeof projectSetup.$inferInsert;
export type ProjectSetupStakeholder = typeof projectSetupStakeholders.$inferSelect;
export type InsertProjectSetupStakeholder = typeof projectSetupStakeholders.$inferInsert;
export type ProjectSetupContractDoc = typeof projectSetupContractDocs.$inferSelect;
export type InsertProjectSetupContractDoc = typeof projectSetupContractDocs.$inferInsert;
export type ProjectSetupDeliverable = typeof projectSetupDeliverables.$inferSelect;
export type InsertProjectSetupDeliverable = typeof projectSetupDeliverables.$inferInsert;
export type ProjectSetupSignature = typeof projectSetupSignatures.$inferSelect;
export type InsertProjectSetupSignature = typeof projectSetupSignatures.$inferInsert;

/* -------- Pre-Construction insert schemas + types -------- */
export const insertPreConstructionSchema = createInsertSchema(preConstruction).omit({ id: true });
export const insertPreConstructionDesignDocSchema = createInsertSchema(preConstructionDesignDocs).omit({ id: true });
export const insertPreConstructionDesignRfiSchema = createInsertSchema(preConstructionDesignRfis).omit({ id: true });
export const insertPreConstructionVeItemSchema = createInsertSchema(preConstructionVeItems).omit({ id: true });
export const insertPreConstructionPermitSchema = createInsertSchema(preConstructionPermits).omit({ id: true });
export const insertPreConstructionPrequalSubSchema = createInsertSchema(preConstructionPrequalSubs).omit({ id: true });
export const insertPreConstructionBidPackageSchema = createInsertSchema(preConstructionBidPackages).omit({ id: true });
export const insertPreConstructionLongLeadItemSchema = createInsertSchema(preConstructionLongLeadItems).omit({ id: true });
export const insertPreConstructionSignatureSchema = createInsertSchema(preConstructionSignatures).omit({ id: true });

/* -------- Lean module insert schemas + types -------- */
export const insertLeanModuleStateSchema = createInsertSchema(leanModuleState).omit({ id: true });
export const insertLeanModuleItemSchema = createInsertSchema(leanModuleItems).omit({ id: true });
export const insertLeanModuleItemAttachmentSchema = createInsertSchema(leanModuleItemAttachments).omit({ id: true });
export type LeanModuleState = typeof leanModuleState.$inferSelect;
export type InsertLeanModuleState = typeof leanModuleState.$inferInsert;
export type LeanModuleItem = typeof leanModuleItems.$inferSelect;
export type InsertLeanModuleItem = typeof leanModuleItems.$inferInsert;
export type LeanModuleItemAttachment = typeof leanModuleItemAttachments.$inferSelect;
export type InsertLeanModuleItemAttachment = typeof leanModuleItemAttachments.$inferInsert;

export type PreConstruction = typeof preConstruction.$inferSelect;
export type InsertPreConstruction = typeof preConstruction.$inferInsert;
export type PreConstructionDesignDoc = typeof preConstructionDesignDocs.$inferSelect;
export type InsertPreConstructionDesignDoc = typeof preConstructionDesignDocs.$inferInsert;
export type PreConstructionDesignRfi = typeof preConstructionDesignRfis.$inferSelect;
export type InsertPreConstructionDesignRfi = typeof preConstructionDesignRfis.$inferInsert;
export type PreConstructionVeItem = typeof preConstructionVeItems.$inferSelect;
export type InsertPreConstructionVeItem = typeof preConstructionVeItems.$inferInsert;
export type PreConstructionPermit = typeof preConstructionPermits.$inferSelect;
export type InsertPreConstructionPermit = typeof preConstructionPermits.$inferInsert;
export type PreConstructionPrequalSub = typeof preConstructionPrequalSubs.$inferSelect;
export type InsertPreConstructionPrequalSub = typeof preConstructionPrequalSubs.$inferInsert;
export type PreConstructionBidPackage = typeof preConstructionBidPackages.$inferSelect;
export type InsertPreConstructionBidPackage = typeof preConstructionBidPackages.$inferInsert;
export type PreConstructionLongLeadItem = typeof preConstructionLongLeadItems.$inferSelect;
export type InsertPreConstructionLongLeadItem = typeof preConstructionLongLeadItems.$inferInsert;
export type PreConstructionSignature = typeof preConstructionSignatures.$inferSelect;
export type InsertPreConstructionSignature = typeof preConstructionSignatures.$inferInsert;

export const insertSettingsSchema = createInsertSchema(appSettings).omit({ id: true, updatedAt: true });
export type AppSettingsRow = typeof appSettings.$inferSelect;

/* -------- Auth insert schemas + types -------- */
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  displayName: z.string().min(1),
  company: z.string().optional(),
  // Multi-tenant: on signup the user picks a plan; we start a 14-day trial with card.
  plan: z.enum(["starter", "pro", "enterprise"]).optional(),
  billing: z.enum(["monthly", "annual"]).optional(),
  // Optional: signup via an invite token (skips org creation + billing; joins the inviter's org).
  inviteToken: z.string().optional(),
  // IANA timezone, e.g. "America/Denver". Captured from browser on signup.
  // Validated on the server; falls back to America/Denver when invalid/missing.
  timezone: z.string().max(100).optional(),
});

export const inviteCreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "pm", "foreman", "viewer"]),
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
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type JarvisMemory = typeof jarvisMemory.$inferSelect;
export type InsertJarvisMemory = z.infer<typeof insertJarvisMemorySchema>;
export type Timesheet = typeof timesheets.$inferSelect;
export type InsertTimesheet = z.infer<typeof insertTimesheetSchema>;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type FieldPunch = typeof fieldPunches.$inferSelect;
export type InsertFieldPunch = typeof fieldPunches.$inferInsert;
export type FieldObservation = typeof fieldObservations.$inferSelect;
export type InsertFieldObservation = typeof fieldObservations.$inferInsert;
export type VoiceNote = typeof voiceNotes.$inferSelect;
export type InsertVoiceNote = typeof voiceNotes.$inferInsert;

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

/* ----------------------------- Contracts -------------------------------- */
// Executive OS contracts register. One row per contract or subcontract on a
// project. Money as text (parsed defensively) matches the pattern used by
// financials / change-orders in the newer surfaces. Purpose-built (not lean)
// because contracts have structured fields the lean shell can't express:
// party, insurance certificate, bond, expiration dates.
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  projectId: integer("project_id"), // null = org-level / MSA
  counterpartyName: text("counterparty_name").notNull(),
  counterpartyType: text("counterparty_type").notNull(), // "subcontractor" | "vendor" | "owner" | "consultant" | "other"
  scopeSummary: text("scope_summary").notNull(),
  contractValue: text("contract_value"), // USD, text so we don't lose precision
  startDate: text("start_date"),
  endDate: text("end_date"),
  insuranceCertNumber: text("insurance_cert_number"),
  insuranceCertExpiration: text("insurance_cert_expiration"),
  bondNumber: text("bond_number"),
  status: text("status").notNull().default("draft"), // "draft" | "executed" | "expired" | "terminated"
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  counterpartyName: z.string().min(1),
  counterpartyType: z.enum(["subcontractor", "vendor", "owner", "consultant", "other"]),
  scopeSummary: z.string().min(1),
  status: z.enum(["draft", "executed", "expired", "terminated"]).default("draft"),
  contractValue: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  insuranceCertNumber: z.string().optional().nullable(),
  insuranceCertExpiration: z.string().optional().nullable(),
  bondNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectId: z.number().optional().nullable(),
});
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

/* ----------------------------- Inspections ------------------------------ */
// Executive OS inspections log. AHJ and third-party inspections across the
// portfolio: type, inspector, date, result, follow-up items.
export const inspections = pgTable("inspections", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  projectId: integer("project_id").notNull(),
  inspectionType: text("inspection_type").notNull(), // "foundation" | "framing" | "mep-rough" | "final" | ...
  inspector: text("inspector").notNull(),
  inspectorAgency: text("inspector_agency"), // AHJ, third-party lab, etc.
  inspectionDate: text("inspection_date").notNull(),
  result: text("result").notNull(), // "pass" | "fail" | "conditional" | "scheduled"
  followUpItems: text("follow_up_items"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertInspectionSchema = createInsertSchema(inspections).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  inspectionType: z.string().min(1),
  inspector: z.string().min(1),
  inspectionDate: z.string().min(1),
  result: z.enum(["pass", "fail", "conditional", "scheduled"]),
  inspectorAgency: z.string().optional().nullable(),
  followUpItems: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type Inspection = typeof inspections.$inferSelect;
export type InsertInspection = z.infer<typeof insertInspectionSchema>;

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
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;
export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type Photo = typeof photos.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type CompanyDocument = typeof companyDocuments.$inferSelect;
export type DeletedItem = typeof deletedItems.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Blueprint = typeof blueprints.$inferSelect;
export type DroneCapture = typeof droneCaptures.$inferSelect;

// Multi-tenant
export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;

/* --------------------------- Sub Drop Portal ----------------------------- */
// A single per-project QR token that subs scan at the site trailer to drop
// documents/photos into the project. No login required — the token IS the
// credential. Every upload made against the token is scoped to the token's
// project_id and organization_id server-side; there is no way for a sub to
// widen scope from the client.
//
// Tokens are revocable and rotatable: PM regenerates and the old QR stops
// working immediately. A single token is reusable across many subs on the
// same project — the QR sticker on the trailer is what identifies the
// project, and the sub identifies themselves (name/company) at drop time.
export const projectDropTokens = pgTable("project_drop_tokens", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  projectId: integer("project_id").notNull(),
  token: text("token").notNull().unique(), // opaque URL-safe id, printed into the QR
  label: text("label"),                    // optional PM-facing name, e.g. "Site Trailer"
  createdByAccountId: integer("created_by_account_id"),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),           // when set, drops with this token are rejected
  lastUsedAt: text("last_used_at"),
});

// One row per file dropped through a project_drop_token. Files live on disk
// (or /tmp on serverless) exactly like the existing documents/photos tables;
// this row holds the classification + attribution the PM needs to review.
export const subUploads = pgTable("sub_uploads", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull(),
  projectId: integer("project_id").notNull(),
  dropTokenId: integer("drop_token_id").notNull(),
  // Sub attribution — captured at drop time, no account required.
  subName: text("sub_name"),               // "Bob Miller"
  subCompany: text("sub_company"),         // "ABC Plumbing"
  subTrade: text("sub_trade"),             // "Plumbing"
  subPhone: text("sub_phone"),
  // File metadata.
  originalFileName: text("original_file_name").notNull(),
  storedFileName: text("stored_file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  // Auto-classification output. `category` is the folder the file lands in;
  // `categoryConfidence` is the classifier layer that decided it (1=metadata,
  // 2=filename, 3=file-type, 4=llm, 0=uncategorized). `categoryOverriddenById`
  // is set when a PM re-files it manually — the pair feeds future learning.
  category: text("category").notNull().default("Needs Sorting"),
  categoryConfidence: integer("category_confidence").notNull().default(0),
  categoryOverriddenById: integer("category_overridden_by_id"),
  // Workflow.
  status: text("status").notNull().default("new"), // new | reviewed | archived
  reviewedByAccountId: integer("reviewed_by_account_id"),
  reviewedAt: text("reviewed_at"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  // Verified uploader. From v2 of the portal onward every drop must come from
  // an authenticated sub_companies session; this column is the audit link back
  // to the account that produced the file. Nullable only for schema evolution
  // safety — fresh rows written by the current handler always set it.
  subCompanyId: integer("sub_company_id"),
});

/* ------------------- Sub Company accounts (identity) --------------------- */
// A sub company is a distinct identity primitive from `accounts` (which is
// the GC-side user). Kept in its own table so sub sessions can never leak
// GC-scoped data or route through GC middleware. One sub_companies row =
// one construction subcontractor business (e.g. "ABC Plumbing"). Multiple
// people at the same company share the login for MVP; per-user seats can
// come later without a data migration.
//
// Registration is triggered by scanning a project QR while unauthenticated.
// Login is triggered by scanning any project QR while already registered.
// In both cases the token identifies the destination project, and a row is
// written to sub_company_projects to record the attachment.
export const subCompanies = pgTable("sub_companies", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  trade: text("trade").notNull(),          // one of SUB_TRADES below
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull().unique(),
  contactPhone: text("contact_phone"),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  // PM (or platform admin) can suspend a sub company; suspended companies
  // can't sign in and their uploads are rejected. Stays around for audit.
  suspendedAt: text("suspended_at"),
  suspendedByAccountId: integer("suspended_by_account_id"),
});

// Join table: which GC projects a sub company is attached to. Every QR scan
// (registration or subsequent sign-in) inserts a row here if one doesn't
// already exist for (subCompanyId, projectId). This is the source of truth
// for "which projects does this sub see in their app?" and "which sub
// companies are on this project?" on the PM side.
export const subCompanyProjects = pgTable("sub_company_projects", {
  id: serial("id").primaryKey(),
  subCompanyId: integer("sub_company_id").notNull(),
  organizationId: integer("organization_id").notNull(),
  projectId: integer("project_id").notNull(),
  joinedAt: text("joined_at").notNull(),
  joinedViaDropTokenId: integer("joined_via_drop_token_id"),
  // Detachment is soft — PM can remove a sub company from a project without
  // losing the historical uploads that reference the join.
  detachedAt: text("detached_at"),
});

// Session tokens for sub company logins. Separate from GC `sessions` so a
// leaked sub cookie can't be replayed against GC endpoints and vice versa.
// Same shape and rotation semantics as GC sessions.
export const subSessions = pgTable("sub_sessions", {
  token: text("token").primaryKey(),
  subCompanyId: integer("sub_company_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

// Canonical trade list. Matches the classifier's expectations and keeps the
// registration dropdown and the PM filter dropdown in sync. "Other" is the
// escape hatch — anything picked as Other doesn't get a trade nudge from
// the classifier, which is fine.
export const SUB_TRADES = [
  "Concrete",
  "Framing",
  "Roofing",
  "Plumbing",
  "Electrical",
  "HVAC",
  "Drywall",
  "Painting",
  "Flooring",
  "Landscaping",
  "Masonry",
  "Steel / Structural",
  "Mechanical",
  "Fire Protection",
  "Low Voltage / Data",
  "Other",
] as const;
export type SubTrade = typeof SUB_TRADES[number];

export const insertProjectDropTokenSchema = createInsertSchema(projectDropTokens).omit({ id: true });
export const insertSubUploadSchema = createInsertSchema(subUploads).omit({ id: true });
export const insertSubCompanySchema = createInsertSchema(subCompanies).omit({ id: true });
export const insertSubCompanyProjectSchema = createInsertSchema(subCompanyProjects).omit({ id: true });

export type SubCompany = typeof subCompanies.$inferSelect;
export type SubCompanyProject = typeof subCompanyProjects.$inferSelect;
export type SubSession = typeof subSessions.$inferSelect;
export type InsertSubCompany = z.infer<typeof insertSubCompanySchema>;
export type InsertSubCompanyProject = z.infer<typeof insertSubCompanyProjectSchema>;

// The sub-facing view of a sub company — excludes passwordHash. Anywhere a
// SubCompany crosses the response boundary it should be `SubCompanyPublic`.
export type SubCompanyPublic = Omit<SubCompany, "passwordHash">;

export type ProjectDropToken = typeof projectDropTokens.$inferSelect;
export type SubUpload = typeof subUploads.$inferSelect;
export type InsertProjectDropToken = z.infer<typeof insertProjectDropTokenSchema>;
export type InsertSubUpload = z.infer<typeof insertSubUploadSchema>;

// The eight buckets the auto-classifier can produce. Kept as a shared const
// so the PM inbox UI, the classifier, and any future filters all reference
// the same list.
export const SUB_UPLOAD_CATEGORIES = [
  "Insurance / COIs",
  "Safety Certifications",
  "Safety Data Sheets",
  "Shop Drawings",
  "Site Photos",
  "Financials",
  "Tax / Compliance",
  "Needs Sorting",
] as const;
export type SubUploadCategory = typeof SUB_UPLOAD_CATEGORIES[number];
