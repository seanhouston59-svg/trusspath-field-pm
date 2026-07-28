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
  projectId: integer("project_id"),
  body: text("body").notNull(),
  color: text("color").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  // JSON-encoded array of { author: string, initials: string, body: string, at: ISO }.
  // Null / empty = no replies. Written to inline on the sticky itself so the note
  // becomes a mini conversation. See POST /api/notes/:id/replies.
  replies: text("replies"),
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
export const insertNoteSchema = createInsertSchema(notes).omit({ id: true });
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
