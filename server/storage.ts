import {
  projects, tasks, rfis, submittals, changeOrders, actionItems,
  dailyLogs, punchItems, teamMembers, contacts, equipment, maintenanceLogs, photos,
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
  projectEvents,
  mobilizationPlans, mobilizationItems, mobilizationPermits, mobilizationEquipment,
  mobilizationUtilities, mobilizationStaff, mobilizationSubs, mobilizationRisks,
  mobilizationSignatures, mobilizationSectionNotes,
  projectSetup, projectSetupStakeholders, projectSetupContractDocs,
  projectSetupDeliverables, projectSetupSignatures,
  DEFAULT_SETTINGS,
} from '@shared/schema';
import type {
  Project, Task, Rfi, Submittal, ChangeOrder, ActionItem,
  DailyLog, PunchItem, TeamMember, Contact, Equipment, MaintenanceLog, InsertMaintenanceLog, Photo,
  DocumentRow, CompanyDocument, DeletedItem, Blueprint, DroneCapture, Message, Note,
  Integration,
  InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder,
  InsertActionItem, InsertDailyLog, InsertPunchItem, InsertContact, InsertEquipment,
  // MaintenanceLog is imported above already
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
  ProjectEvent, InsertProjectEvent,
  MobilizationPlan, InsertMobilizationPlan,
  MobilizationItem, InsertMobilizationItem,
  MobilizationPermit, InsertMobilizationPermit,
  MobilizationEquipment, InsertMobilizationEquipment,
  MobilizationUtility, InsertMobilizationUtility,
  MobilizationStaff, InsertMobilizationStaff,
  MobilizationSub, InsertMobilizationSub,
  MobilizationRisk, InsertMobilizationRisk,
  MobilizationSignature, InsertMobilizationSignature,
  MobilizationSectionNote, InsertMobilizationSectionNote,
  ProjectSetup, InsertProjectSetup,
  ProjectSetupStakeholder, InsertProjectSetupStakeholder,
  ProjectSetupContractDoc, InsertProjectSetupContractDoc,
  ProjectSetupDeliverable, InsertProjectSetupDeliverable,
  ProjectSetupSignature, InsertProjectSetupSignature,
} from '@shared/schema';
import {
  MOBILIZATION_SECTIONS, DEFAULT_MOBILIZATION_ITEMS, DEFAULT_PERMITS,
  DEFAULT_MILESTONE_OFFSETS, MOBILIZATION_MILESTONE_KIND, addDays,
  DEFAULT_SIGNER_ROLES, SIGNER_ROLE_ALIASES,
} from '@shared/mobilization-catalog';
import {
  PROJECT_SETUP_DELIVERABLES, PROJECT_SETUP_SIGNERS, PROJECT_SETUP_SIGNER_ALIASES,
} from '@shared/project-setup-catalog';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, isNotNull, gte, lt } from "drizzle-orm";
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

/** Best-effort roster lookup for a sign-off role. Substring match in both
 *  directions so a team member listed as "PM" or "Senior Project Manager"
 *  both resolve. Returns null when nothing matches — the row still gets
 *  created, just without a pre-filled name. */
function matchSignerName(
  roster: TeamMember[],
  role: string,
  aliasTable: Record<string, string[]> = SIGNER_ROLE_ALIASES,
): string | null {
  const aliases = aliasTable[role] ?? [role.toLowerCase()];
  const hit = roster.find((m) => {
    const r = (m.role ?? "").trim().toLowerCase();
    if (!r) return false;
    return aliases.some((a) => r === a || r.includes(a) || a.includes(r));
  });
  return hit?.name ?? null;
}

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
  // Project Timeline audit log. Append-only. Every mutation route logs one row.
  // See shared/schema.ts → projectEvents for column docs.
  await sql`CREATE TABLE IF NOT EXISTS project_events (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER,
    project_id INTEGER NOT NULL,
    actor_account_id INTEGER,
    actor_name TEXT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_type TEXT,
    source_id INTEGER,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  // Read pattern: WHERE project_id = ? ORDER BY occurred_at DESC LIMIT ?
  // Composite index carries the sort so we don't need a sort step in Postgres.
  await sql`CREATE INDEX IF NOT EXISTS idx_project_events_project_time ON project_events(project_id, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_events_org_time ON project_events(organization_id, occurred_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_project_events_kind ON project_events(kind)`;
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
  await sql`ALTER TABLE punch_items ADD COLUMN IF NOT EXISTS priority TEXT`;
  await sql`ALTER TABLE rfis ADD COLUMN IF NOT EXISTS trade TEXT`;
  await sql`ALTER TABLE change_orders ADD COLUMN IF NOT EXISTS trade TEXT`;
  await sql`ALTER TABLE submittals ADD COLUMN IF NOT EXISTS trade TEXT`;
  await sql`ALTER TABLE punch_items ADD COLUMN IF NOT EXISTS notes TEXT`;

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

  // Mobilization (Executive OS). One plan per project; the rest hang off
  // project_id. Timeline rows live in `milestones` with kind='mobilization'.
  await sql`CREATE TABLE IF NOT EXISTS mobilization_plans (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'planning',
    target_start_date TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    owner_id INTEGER,
    target_date TEXT,
    status TEXT NOT NULL DEFAULT 'not_started',
    completed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_permits (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    agency TEXT,
    permit_number TEXT,
    status TEXT NOT NULL DEFAULT 'Not Started',
    applied_date TEXT,
    approved_date TEXT,
    expiration_date TEXT,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_equipment (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    vendor TEXT,
    arrival_date TEXT,
    on_site_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    departure_date TEXT,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_utilities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    provider TEXT,
    requested_date TEXT,
    installed_date TEXT,
    account_number TEXT,
    meter_number TEXT,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_staff (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    team_member_id INTEGER NOT NULL,
    start_date TEXT,
    orientation_done BOOLEAN NOT NULL DEFAULT FALSE,
    drug_test_done BOOLEAN NOT NULL DEFAULT FALSE,
    ppe_issued BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_subs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    trade TEXT NOT NULL,
    company TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    insurance_on_file BOOLEAN NOT NULL DEFAULT FALSE,
    w9_on_file BOOLEAN NOT NULL DEFAULT FALSE,
    msa_signed BOOLEAN NOT NULL DEFAULT FALSE,
    on_site_date TEXT,
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_risks (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    risk TEXT NOT NULL,
    likelihood TEXT NOT NULL DEFAULT 'med',
    impact TEXT NOT NULL DEFAULT 'med',
    mitigation TEXT,
    owner_id INTEGER,
    status TEXT NOT NULL DEFAULT 'open',
    notes TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_signatures (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    title TEXT,
    signed_date TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS mobilization_section_notes (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    section TEXT NOT NULL,
    narrative TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    updated_by_id INTEGER
  )`;
  // The upsert in updateMobilizationSectionNote targets this constraint.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS mobilization_section_notes_project_section_idx
    ON mobilization_section_notes (project_id, section)`;
  await sql`CREATE INDEX IF NOT EXISTS mobilization_items_project_idx ON mobilization_items (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS mobilization_permits_project_idx ON mobilization_permits (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS mobilization_signatures_project_idx ON mobilization_signatures (project_id)`;

  // Expanded mobilization plan fields. Additive only — every column is
  // nullable so existing plan rows stay valid without a backfill.
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS owner_rep TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS owner_rep_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS owner_rep_email TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS architect TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS architect_firm TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS architect_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS architect_email TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS engineer_of_record TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS engineer_firm TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS engineer_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS engineer_email TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS jurisdiction TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS permit_expediter TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS permit_expediter_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS project_type TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS square_footage INTEGER`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS stories INTEGER`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS occupancy_type TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS weather_station TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS truck_routes TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS delivery_hours TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS crane_picks TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS laydown_areas TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS gate_schedule TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS neighbor_comms_plan TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS noise_ordinance_hours TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS objectives_narrative TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS scope_summary TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS exclusions TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS assumptions TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS work_not_included TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS site_specific_hazards TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS eap_details TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS hospital_name TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS hospital_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS hospital_route TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS muster_point TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS secondary_muster_point TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS spill_response_plan TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS msds_location TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS environmental_narrative TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS superintendent_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS project_manager_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS safety_officer_name TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS safety_officer_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS emergency_contact_24h_name TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS emergency_contact_24h_phone TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS on_call_rotation TEXT`;
  await sql`ALTER TABLE mobilization_plans ADD COLUMN IF NOT EXISTS subcontractor_foremen TEXT`;

  // Project Setup (Executive OS). Pre-mobilization intake — one setup row per
  // project, everything else hangs off project_id. Money and percentages are
  // TEXT so a numeric round-trip can't shift a contract value.
  await sql`CREATE TABLE IF NOT EXISTS project_setup (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    project_number TEXT,
    contract_number TEXT,
    award_date TEXT,
    notice_to_proceed_date TEXT,
    substantial_completion_date TEXT,
    final_completion_date TEXT,
    contract_type TEXT,
    delivery_method TEXT,
    original_contract_value TEXT,
    contingency_percent TEXT,
    retainage_percent TEXT,
    payment_terms TEXT,
    billing_cycle TEXT,
    insurance_carrier TEXT,
    insurance_policy_number TEXT,
    bond_carrier TEXT,
    bond_policy_number TEXT,
    bond_amount TEXT,
    project_description TEXT,
    business_case TEXT,
    strategic_goals TEXT,
    success_criteria TEXT,
    key_risks TEXT,
    key_assumptions TEXT,
    key_constraints TEXT,
    communication_plan TEXT,
    change_control_process TEXT,
    documentation_standards TEXT,
    quality_standards TEXT,
    safety_standards TEXT,
    submittal_workflow TEXT,
    rfi_workflow TEXT,
    pay_app_workflow TEXT,
    closeout_requirements TEXT,
    warranty_requirements TEXT,
    kickoff_scheduled_at TEXT,
    kickoff_location TEXT,
    kickoff_agenda_notes TEXT,
    kickoff_attendees_narrative TEXT,
    kickoff_decisions TEXT,
    kickoff_action_items TEXT,
    charter_approved_at TEXT,
    charter_approved_by_id INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`;
  // 1:1 with project. seedProjectSetup relies on this to stay idempotent under
  // a concurrent retry, not just the read-then-write check.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS project_setup_project_idx
    ON project_setup (project_id)`;
  await sql`CREATE TABLE IF NOT EXISTS project_setup_stakeholders (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    organization TEXT,
    name TEXT,
    title TEXT,
    email TEXT,
    phone TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS project_setup_contract_docs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    revision TEXT,
    issued_date TEXT,
    received_date TEXT,
    location TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS project_setup_deliverables (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    due_date TEXT,
    completed_at TEXT,
    owner_id INTEGER,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS project_setup_signatures (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    title TEXT,
    signed_date TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS project_setup_stakeholders_project_idx
    ON project_setup_stakeholders (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS project_setup_contract_docs_project_idx
    ON project_setup_contract_docs (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS project_setup_deliverables_project_idx
    ON project_setup_deliverables (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS project_setup_signatures_project_idx
    ON project_setup_signatures (project_id)`;

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

  // One-time seed pass: turn every existing record (RFIs, punch items, photos,
  // etc.) into a project_events row so the Timeline tab has history from day
  // one instead of only tracking events created after this deploy. Guarded by
  // an app_settings.config.event_backfill_done flag so it never runs twice.
  try {
    const settingsRow = await sql`SELECT config FROM app_settings WHERE id = 1 LIMIT 1`;
    let cfg: Record<string, any> = {};
    if (settingsRow.length > 0) {
      try { cfg = JSON.parse(settingsRow[0].config || "{}"); } catch { cfg = {}; }
    }
    if (!cfg.event_backfill_done) {
      console.log("[migrate] running project_events backfill…");

      // RFIs -> rfi.created (+ rfi.resolved for terminal statuses)
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, r.project_id, NULL, r.submitted_by,
               'rfi.created',
               'RFI ' || r.number || ' submitted \u2014 ' || r.subject,
               NULL,
               jsonb_build_object('status', r.status, 'priority', r.priority),
               'rfi', r.id,
               COALESCE(r.date_submitted::timestamptz, NOW())
        FROM rfis r
        JOIN projects p ON p.id = r.project_id
        WHERE r.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='rfi' AND e.source_id=r.id AND e.kind='rfi.created')`;
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, r.project_id, NULL, r.submitted_by,
               'rfi.resolved',
               'RFI ' || r.number || ' resolved',
               NULL,
               jsonb_build_object('status', r.status),
               'rfi', r.id,
               COALESCE(r.date_submitted::timestamptz, NOW())
        FROM rfis r
        JOIN projects p ON p.id = r.project_id
        WHERE r.deleted_at IS NULL
          AND lower(r.status) IN ('closed','resolved','answered')
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='rfi' AND e.source_id=r.id AND e.kind='rfi.resolved')`;

      // Change orders -> change_order.created (+ approved)
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, c.project_id, NULL, NULL,
               'change_order.created',
               'CO ' || c.number || ' requested \u2014 ' || c.title,
               NULL,
               jsonb_build_object('status', c.status, 'amount', c.amount),
               'change_order', c.id,
               COALESCE(c.date_issued::timestamptz, NOW())
        FROM change_orders c
        JOIN projects p ON p.id = c.project_id
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='change_order' AND e.source_id=c.id AND e.kind='change_order.created')`;
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, c.project_id, NULL, NULL,
               'change_order.approved',
               'CO ' || c.number || ' approved',
               NULL,
               jsonb_build_object('status', c.status, 'amount', c.amount),
               'change_order', c.id,
               COALESCE(c.date_issued::timestamptz, NOW())
        FROM change_orders c
        JOIN projects p ON p.id = c.project_id
        WHERE c.deleted_at IS NULL
          AND lower(c.status) IN ('approved','accepted','executed')
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='change_order' AND e.source_id=c.id AND e.kind='change_order.approved')`;

      // Daily logs
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, d.project_id, NULL, d.superintendent,
               'daily_log.submitted',
               'Daily log submitted',
               d.summary,
               jsonb_build_object('weather', d.weather, 'temp', d.temp, 'crewCount', d.crew_count),
               'daily_log', d.id,
               COALESCE(d.date::timestamptz, NOW())
        FROM daily_logs d
        JOIN projects p ON p.id = d.project_id
        WHERE d.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='daily_log' AND e.source_id=d.id)`;

      // Punch items -> created (+ closed for terminal status)
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, pu.project_id, NULL, NULL,
               'punch.created',
               'Punch item added \u2014 ' || pu.title,
               pu.location,
               jsonb_build_object('status', pu.status, 'trade', pu.trade),
               'punch', pu.id,
               NOW()
        FROM punch_items pu
        JOIN projects p ON p.id = pu.project_id
        WHERE pu.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='punch' AND e.source_id=pu.id AND e.kind='punch.created')`;
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, pu.project_id, NULL, NULL,
               'punch.closed',
               'Punch item closed \u2014 ' || pu.title,
               NULL,
               jsonb_build_object('status', pu.status),
               'punch', pu.id,
               NOW()
        FROM punch_items pu
        JOIN projects p ON p.id = pu.project_id
        WHERE pu.deleted_at IS NULL
          AND lower(pu.status) IN ('closed','complete','completed','resolved','done')
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='punch' AND e.source_id=pu.id AND e.kind='punch.closed')`;

      // Photos
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, ph.project_id, NULL, NULL,
               'photo.uploaded',
               'Photo uploaded \u2014 ' || COALESCE(ph.title, 'Untitled'),
               ph.description,
               jsonb_build_object('location', ph.location, 'trade', ph.trade),
               'photo', ph.id,
               COALESCE(ph.date::timestamptz, NOW())
        FROM photos ph
        JOIN projects p ON p.id = ph.project_id
        WHERE ph.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='photo' AND e.source_id=ph.id)`;

      // Tasks -> created (+ completed)
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, t.project_id, NULL, NULL,
               'task.created',
               'Task created \u2014 ' || t.title,
               t.trade,
               jsonb_build_object('status', t.status, 'priority', t.priority),
               'task', t.id,
               COALESCE(t.start_date::timestamptz, NOW())
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='task' AND e.source_id=t.id AND e.kind='task.created')`;
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, t.project_id, NULL, NULL,
               'task.completed',
               'Task completed \u2014 ' || t.title,
               NULL,
               jsonb_build_object('status', t.status),
               'task', t.id,
               COALESCE(t.end_date::timestamptz, NOW())
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        WHERE t.deleted_at IS NULL
          AND lower(t.status) IN ('done','complete','completed','closed')
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='task' AND e.source_id=t.id AND e.kind='task.completed')`;

      // Documents
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, d.project_id, NULL, NULL,
               'doc.uploaded',
               'Document uploaded \u2014 ' || d.name,
               NULL,
               jsonb_build_object('type', d.type, 'size', d.size),
               'document', d.id,
               COALESCE(d.date::timestamptz, NOW())
        FROM documents d
        JOIN projects p ON p.id = d.project_id
        WHERE d.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='document' AND e.source_id=d.id)`;

      // Blueprints
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, b.project_id, NULL, NULL,
               'blueprint.uploaded',
               'Blueprint uploaded \u2014 ' || b.title,
               b.sheet_number,
               jsonb_build_object('discipline', b.discipline, 'revision', b.revision),
               'blueprint', b.id,
               COALESCE(b.date::timestamptz, NOW())
        FROM blueprints b
        JOIN projects p ON p.id = b.project_id
        WHERE b.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='blueprint' AND e.source_id=b.id)`;

      // Drone captures
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, dc.project_id, NULL, NULL,
               'drone.captured',
               'Drone capture \u2014 ' || COALESCE(dc.title, 'Untitled'),
               dc.notes,
               jsonb_build_object('altitude', dc.altitude, 'weather', dc.weather),
               'drone_capture', dc.id,
               COALESCE(dc.flight_date::timestamptz, NOW())
        FROM drone_captures dc
        JOIN projects p ON p.id = dc.project_id
        WHERE dc.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='drone_capture' AND e.source_id=dc.id)`;

      // Field punches (clock in/out) — only kind='in' or 'out'
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, fp.project_id, fp.account_id,
               COALESCE((SELECT display_name FROM accounts a WHERE a.id = fp.account_id), 'Field worker'),
               CASE WHEN lower(fp.kind) = 'in' THEN 'timesheet.clockin' ELSE 'timesheet.clockout' END,
               CASE WHEN lower(fp.kind) = 'in' THEN 'Clocked in' ELSE 'Clocked out' END,
               NULL,
               jsonb_build_object('source', 'field_punch'),
               'field_punch', fp.id,
               COALESCE(fp.punched_at::timestamptz, NOW())
        FROM field_punches fp
        JOIN projects p ON p.id = fp.project_id
        WHERE lower(fp.kind) IN ('in','out')
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='field_punch' AND e.source_id=fp.id)`;

      // Field observations
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, fo.project_id, fo.account_id,
               COALESCE((SELECT display_name FROM accounts a WHERE a.id = fo.account_id), 'Field worker'),
               'observation.logged',
               'Field observation \u2014 ' || COALESCE(fo.category, 'Note'),
               fo.note,
               jsonb_build_object('severity', fo.severity),
               'field_observation', fo.id,
               COALESCE(fo.observed_at::timestamptz, NOW())
        FROM field_observations fo
        JOIN projects p ON p.id = fo.project_id
        WHERE NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='field_observation' AND e.source_id=fo.id)`;

      // Milestones (only those flagged complete)
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, m.project_id, NULL, NULL,
               'milestone.reached',
               'Milestone reached \u2014 ' || m.title,
               m.notes,
               jsonb_build_object('status', m.status, 'kind', m.kind),
               'milestone', m.id,
               COALESCE(m.date::timestamptz, NOW())
        FROM milestones m
        JOIN projects p ON p.id = m.project_id
        WHERE lower(m.status) LIKE 'complete%'
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='milestone' AND e.source_id=m.id)`;

      // Notes
      await sql`INSERT INTO project_events
        (organization_id, project_id, actor_account_id, actor_name, kind, title, subtitle, meta, source_type, source_id, occurred_at)
        SELECT p.organization_id, n.project_id, NULL, NULL,
               'note.added',
               'Note added',
               LEFT(n.text, 200),
               '{}'::jsonb,
               'note', n.id,
               COALESCE(n.created_at::timestamptz, NOW())
        FROM notes n
        JOIN projects p ON p.id = n.project_id
        WHERE n.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM project_events e WHERE e.source_type='note' AND e.source_id=n.id)`;

      cfg.event_backfill_done = true;
      const nowIso = new Date().toISOString();
      if (settingsRow.length > 0) {
        await sql`UPDATE app_settings SET config = ${JSON.stringify(cfg)}, updated_at = ${nowIso} WHERE id = 1`;
      } else {
        await sql`INSERT INTO app_settings (id, config, updated_at) VALUES (1, ${JSON.stringify(cfg)}, ${nowIso})`;
      }
      console.log("[migrate] project_events backfill complete");
    }
  } catch (e) {
    // Backfill is best-effort. If a column name doesn't line up with an older
    // deploy, log and move on rather than blocking startup — new writes still
    // flow via recordEvent().
    console.warn("[migrate] project_events backfill skipped:", (e as Error)?.message ?? e);
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
  getEquipmentById(id: number): Promise<Equipment | undefined>;
  createEquipment(data: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: number, patch: Partial<InsertEquipment>): Promise<Equipment | undefined>;
  deleteEquipment(id: number): Promise<void>;
  getMaintenanceLogs(equipmentId: number): Promise<MaintenanceLog[]>;
  addMaintenanceLog(data: InsertMaintenanceLog): Promise<MaintenanceLog>;
  deleteMaintenanceLog(id: number): Promise<void>;
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

  // ----- Mobilization (Executive OS) -----
  seedMobilization(projectId: number, startDate?: string | null): Promise<void>;
  getMobilizationPlan(projectId: number): Promise<MobilizationPlan | undefined>;
  upsertMobilizationPlan(projectId: number, data: Partial<InsertMobilizationPlan>): Promise<MobilizationPlan>;
  getMobilizationItems(projectId: number): Promise<MobilizationItem[]>;
  createMobilizationItem(data: InsertMobilizationItem): Promise<MobilizationItem>;
  updateMobilizationItem(id: number, data: Partial<InsertMobilizationItem>): Promise<MobilizationItem | undefined>;
  deleteMobilizationItem(id: number): Promise<void>;
  getMobilizationPermits(projectId: number): Promise<MobilizationPermit[]>;
  createMobilizationPermit(data: InsertMobilizationPermit): Promise<MobilizationPermit>;
  updateMobilizationPermit(id: number, data: Partial<InsertMobilizationPermit>): Promise<MobilizationPermit | undefined>;
  deleteMobilizationPermit(id: number): Promise<void>;
  getMobilizationEquipment(projectId: number): Promise<MobilizationEquipment[]>;
  createMobilizationEquipment(data: InsertMobilizationEquipment): Promise<MobilizationEquipment>;
  updateMobilizationEquipment(id: number, data: Partial<InsertMobilizationEquipment>): Promise<MobilizationEquipment | undefined>;
  deleteMobilizationEquipment(id: number): Promise<void>;
  getMobilizationUtilities(projectId: number): Promise<MobilizationUtility[]>;
  createMobilizationUtility(data: InsertMobilizationUtility): Promise<MobilizationUtility>;
  updateMobilizationUtility(id: number, data: Partial<InsertMobilizationUtility>): Promise<MobilizationUtility | undefined>;
  deleteMobilizationUtility(id: number): Promise<void>;
  getMobilizationStaff(projectId: number): Promise<MobilizationStaff[]>;
  createMobilizationStaff(data: InsertMobilizationStaff): Promise<MobilizationStaff>;
  updateMobilizationStaff(id: number, data: Partial<InsertMobilizationStaff>): Promise<MobilizationStaff | undefined>;
  deleteMobilizationStaff(id: number): Promise<void>;
  getMobilizationSubs(projectId: number): Promise<MobilizationSub[]>;
  createMobilizationSub(data: InsertMobilizationSub): Promise<MobilizationSub>;
  updateMobilizationSub(id: number, data: Partial<InsertMobilizationSub>): Promise<MobilizationSub | undefined>;
  deleteMobilizationSub(id: number): Promise<void>;
  getMobilizationRisks(projectId: number): Promise<MobilizationRisk[]>;
  createMobilizationRisk(data: InsertMobilizationRisk): Promise<MobilizationRisk>;
  updateMobilizationRisk(id: number, data: Partial<InsertMobilizationRisk>): Promise<MobilizationRisk | undefined>;
  deleteMobilizationRisk(id: number): Promise<void>;
  getMobilizationSignatures(projectId: number): Promise<MobilizationSignature[]>;
  createMobilizationSignature(data: InsertMobilizationSignature): Promise<MobilizationSignature>;
  updateMobilizationSignature(id: number, data: Partial<InsertMobilizationSignature>): Promise<MobilizationSignature | undefined>;
  deleteMobilizationSignature(id: number): Promise<void>;
  getMobilizationSectionNotes(projectId: number): Promise<MobilizationSectionNote[]>;
  upsertMobilizationSectionNote(projectId: number, section: string, data: { narrative: string; updatedById?: number | null }): Promise<MobilizationSectionNote>;

  seedProjectSetup(projectId: number, organizationId: number | null): Promise<void>;
  getProjectSetup(projectId: number): Promise<ProjectSetup | null>;
  getProjectSetupBundle(projectId: number): Promise<{
    setup: ProjectSetup | null;
    stakeholders: ProjectSetupStakeholder[];
    contractDocs: ProjectSetupContractDoc[];
    deliverables: ProjectSetupDeliverable[];
    signatures: ProjectSetupSignature[];
  }>;
  updateProjectSetup(projectId: number, patch: Partial<InsertProjectSetup>): Promise<ProjectSetup | null>;
  createStakeholder(data: InsertProjectSetupStakeholder): Promise<ProjectSetupStakeholder>;
  updateStakeholder(id: number, data: Partial<InsertProjectSetupStakeholder>): Promise<ProjectSetupStakeholder | undefined>;
  deleteStakeholder(id: number): Promise<void>;
  createContractDoc(data: InsertProjectSetupContractDoc): Promise<ProjectSetupContractDoc>;
  updateContractDoc(id: number, data: Partial<InsertProjectSetupContractDoc>): Promise<ProjectSetupContractDoc | undefined>;
  deleteContractDoc(id: number): Promise<void>;
  createDeliverable(data: InsertProjectSetupDeliverable): Promise<ProjectSetupDeliverable>;
  updateDeliverable(id: number, data: Partial<InsertProjectSetupDeliverable>): Promise<ProjectSetupDeliverable | undefined>;
  deleteDeliverable(id: number): Promise<void>;
  createSetupSignature(data: InsertProjectSetupSignature): Promise<ProjectSetupSignature>;
  updateSetupSignature(id: number, data: Partial<InsertProjectSetupSignature>): Promise<ProjectSetupSignature | undefined>;
  deleteSetupSignature(id: number): Promise<void>;

  getMessages(projectId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  getNotes(projectId?: number): Promise<Note[]>;
  createNote(data: InsertNote): Promise<Note>;
  updateNotePosition(id: number, x: number, y: number): Promise<Note | undefined>;
  getNoteById(id: number): Promise<Note | undefined>;
  updateNote(id: number, patch: Partial<Note>): Promise<Note | undefined>;
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
  updateDashboardLayout(
    id: number,
    layout: { widgets: Array<{ id: string; size: "sm" | "md" | "lg" | "xl"; hidden?: boolean }> } | null,
  ): Promise<AccountPublic | undefined>;
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
  getTimesheetsForAccount(accountId: number): Promise<Timesheet[]>;
  getTimesheet(id: number): Promise<Timesheet | undefined>;
  getTimesheetByAccountWeek(accountId: number, weekStart: string): Promise<Timesheet | undefined>;
  createTimesheet(data: InsertTimesheet): Promise<Timesheet>;
  updateTimesheet(id: number, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  deleteTimesheet(id: number): Promise<void>;
  // Time entries
  getTimeEntries(timesheetId: number): Promise<TimeEntry[]>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: number): Promise<void>;
  replaceTimeEntries(timesheetId: number, entries: InsertTimeEntry[]): Promise<void>;
  upsertDailyTimeEntry(timesheetId: number, entryDate: string, patch: Partial<InsertTimeEntry>): Promise<TimeEntry>;
  // Field punches
  getFieldPunchesForDay(accountId: number, dayStartIso: string, dayEndIso: string): Promise<FieldPunch[]>;
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
  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    await ensureReady();
    const rows = await db.select().from(equipment).where(eq(equipment.id, id));
    return rows[0];
  }
  async createEquipment(data: InsertEquipment): Promise<Equipment> {
    await ensureReady();
    const [row] = await db.insert(equipment).values(data).returning();
    return row;
  }
  async updateEquipment(id: number, patch: Partial<InsertEquipment>): Promise<Equipment | undefined> {
    await ensureReady();
    const [row] = await db.update(equipment).set(patch as any).where(eq(equipment.id, id)).returning();
    return row;
  }
  async deleteEquipment(id: number): Promise<void> {
    await ensureReady();
    await db.delete(equipment).where(eq(equipment.id, id));
    await db.delete(maintenanceLogs).where(eq(maintenanceLogs.equipmentId, id));
  }
  async getMaintenanceLogs(equipmentId: number): Promise<MaintenanceLog[]> {
    await ensureReady();
    return await db.select().from(maintenanceLogs).where(eq(maintenanceLogs.equipmentId, equipmentId)).orderBy(desc(maintenanceLogs.date));
  }
  async addMaintenanceLog(data: InsertMaintenanceLog): Promise<MaintenanceLog> {
    await ensureReady();
    const [row] = await db.insert(maintenanceLogs).values({ ...data, createdAt: new Date().toISOString() } as any).returning();
    return row;
  }
  async deleteMaintenanceLog(id: number): Promise<void> {
    await ensureReady();
    await db.delete(maintenanceLogs).where(eq(maintenanceLogs.id, id));
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

  /* --------------------------- Mobilization --------------------------- */
  // Seeds a fresh project's mobilization plan: the plan row, the full
  // 15-section checklist, the 7 standard permits, and the milestone timeline.
  // Equipment/utilities/subs/risks are intentionally NOT seeded — those are
  // project-specific and get added by hand. Idempotent: bails if a plan
  // already exists, so a retried project create can't double-seed.
  async seedMobilization(projectId: number, startDate?: string | null): Promise<void> {
    await ensureReady();
    const existing = await this.getMobilizationPlan(projectId);
    if (existing) return;

    const target = addDays(startDate, 0);
    await db.insert(mobilizationPlans).values({
      projectId,
      status: "planning",
      targetStartDate: target,
    });

    const items: InsertMobilizationItem[] = [];
    MOBILIZATION_SECTIONS.forEach((section) => {
      DEFAULT_MOBILIZATION_ITEMS[section].forEach((item, i) => {
        items.push({
          projectId,
          section,
          title: item.title,
          description: item.description ?? null,
          status: "not_started",
          sortOrder: i,
        });
      });
    });
    if (items.length > 0) await db.insert(mobilizationItems).values(items);

    await db.insert(mobilizationPermits).values(
      DEFAULT_PERMITS.map((p) => ({
        projectId,
        name: p.name,
        agency: p.agency,
        status: "Not Started" as const,
      })),
    );

    await db.insert(milestones).values(
      DEFAULT_MILESTONE_OFFSETS.map((m) => ({
        projectId,
        title: m.title,
        date: addDays(startDate, m.dayOffset),
        kind: MOBILIZATION_MILESTONE_KIND,
        status: "pending",
      })),
    );

    // Sign-off block. Names are a best-effort match against the org roster —
    // an unmatched role still gets a row so the PDF renders a blank to sign.
    // Scoped to the project's organization; an unscoped roster read would pull
    // names from other tenants.
    const project = await this.getProject(projectId);
    const roster = project?.organizationId != null
      ? await this.getTeam(project.organizationId)
      : [];
    await db.insert(mobilizationSignatures).values(
      DEFAULT_SIGNER_ROLES.map((role, i) => ({
        projectId,
        role,
        name: matchSignerName(roster, role),
        sortOrder: i,
      })),
    );
  }

  async getMobilizationPlan(projectId: number): Promise<MobilizationPlan | undefined> {
    await ensureReady();
    const rows = await db.select().from(mobilizationPlans).where(eq(mobilizationPlans.projectId, projectId));
    return rows[0];
  }
  async upsertMobilizationPlan(projectId: number, data: Partial<InsertMobilizationPlan>): Promise<MobilizationPlan> {
    await ensureReady();
    const existing = await this.getMobilizationPlan(projectId);
    if (!existing) {
      const [row] = await db.insert(mobilizationPlans).values({
        projectId,
        status: data.status ?? "planning",
        targetStartDate: data.targetStartDate ?? addDays(null, 0),
        startedAt: data.startedAt ?? null,
        completedAt: data.completedAt ?? null,
        notes: data.notes ?? null,
      }).returning();
      return row;
    }
    const { projectId: _ignored, ...patch } = data;
    if (Object.keys(patch).length === 0) return existing;
    const [row] = await db.update(mobilizationPlans).set(patch)
      .where(eq(mobilizationPlans.projectId, projectId)).returning();
    return row;
  }

  async getMobilizationItems(projectId: number): Promise<MobilizationItem[]> {
    await ensureReady();
    return await db.select().from(mobilizationItems).where(eq(mobilizationItems.projectId, projectId));
  }
  async createMobilizationItem(data: InsertMobilizationItem): Promise<MobilizationItem> {
    await ensureReady();
    const [row] = await db.insert(mobilizationItems).values(data).returning();
    return row;
  }
  async updateMobilizationItem(id: number, data: Partial<InsertMobilizationItem>): Promise<MobilizationItem | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationItems).set(data).where(eq(mobilizationItems.id, id)).returning();
    return row;
  }
  async deleteMobilizationItem(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationItems).where(eq(mobilizationItems.id, id));
  }

  async getMobilizationPermits(projectId: number): Promise<MobilizationPermit[]> {
    await ensureReady();
    return await db.select().from(mobilizationPermits).where(eq(mobilizationPermits.projectId, projectId));
  }
  async createMobilizationPermit(data: InsertMobilizationPermit): Promise<MobilizationPermit> {
    await ensureReady();
    const [row] = await db.insert(mobilizationPermits).values(data).returning();
    return row;
  }
  async updateMobilizationPermit(id: number, data: Partial<InsertMobilizationPermit>): Promise<MobilizationPermit | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationPermits).set(data).where(eq(mobilizationPermits.id, id)).returning();
    return row;
  }
  async deleteMobilizationPermit(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationPermits).where(eq(mobilizationPermits.id, id));
  }

  async getMobilizationEquipment(projectId: number): Promise<MobilizationEquipment[]> {
    await ensureReady();
    return await db.select().from(mobilizationEquipment).where(eq(mobilizationEquipment.projectId, projectId));
  }
  async createMobilizationEquipment(data: InsertMobilizationEquipment): Promise<MobilizationEquipment> {
    await ensureReady();
    const [row] = await db.insert(mobilizationEquipment).values(data).returning();
    return row;
  }
  async updateMobilizationEquipment(id: number, data: Partial<InsertMobilizationEquipment>): Promise<MobilizationEquipment | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationEquipment).set(data).where(eq(mobilizationEquipment.id, id)).returning();
    return row;
  }
  async deleteMobilizationEquipment(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationEquipment).where(eq(mobilizationEquipment.id, id));
  }

  async getMobilizationUtilities(projectId: number): Promise<MobilizationUtility[]> {
    await ensureReady();
    return await db.select().from(mobilizationUtilities).where(eq(mobilizationUtilities.projectId, projectId));
  }
  async createMobilizationUtility(data: InsertMobilizationUtility): Promise<MobilizationUtility> {
    await ensureReady();
    const [row] = await db.insert(mobilizationUtilities).values(data).returning();
    return row;
  }
  async updateMobilizationUtility(id: number, data: Partial<InsertMobilizationUtility>): Promise<MobilizationUtility | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationUtilities).set(data).where(eq(mobilizationUtilities.id, id)).returning();
    return row;
  }
  async deleteMobilizationUtility(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationUtilities).where(eq(mobilizationUtilities.id, id));
  }

  async getMobilizationStaff(projectId: number): Promise<MobilizationStaff[]> {
    await ensureReady();
    return await db.select().from(mobilizationStaff).where(eq(mobilizationStaff.projectId, projectId));
  }
  async createMobilizationStaff(data: InsertMobilizationStaff): Promise<MobilizationStaff> {
    await ensureReady();
    const [row] = await db.insert(mobilizationStaff).values(data).returning();
    return row;
  }
  async updateMobilizationStaff(id: number, data: Partial<InsertMobilizationStaff>): Promise<MobilizationStaff | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationStaff).set(data).where(eq(mobilizationStaff.id, id)).returning();
    return row;
  }
  async deleteMobilizationStaff(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationStaff).where(eq(mobilizationStaff.id, id));
  }

  async getMobilizationSubs(projectId: number): Promise<MobilizationSub[]> {
    await ensureReady();
    return await db.select().from(mobilizationSubs).where(eq(mobilizationSubs.projectId, projectId));
  }
  async createMobilizationSub(data: InsertMobilizationSub): Promise<MobilizationSub> {
    await ensureReady();
    const [row] = await db.insert(mobilizationSubs).values(data).returning();
    return row;
  }
  async updateMobilizationSub(id: number, data: Partial<InsertMobilizationSub>): Promise<MobilizationSub | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationSubs).set(data).where(eq(mobilizationSubs.id, id)).returning();
    return row;
  }
  async deleteMobilizationSub(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationSubs).where(eq(mobilizationSubs.id, id));
  }

  async getMobilizationRisks(projectId: number): Promise<MobilizationRisk[]> {
    await ensureReady();
    return await db.select().from(mobilizationRisks).where(eq(mobilizationRisks.projectId, projectId));
  }
  async createMobilizationRisk(data: InsertMobilizationRisk): Promise<MobilizationRisk> {
    await ensureReady();
    const [row] = await db.insert(mobilizationRisks).values(data).returning();
    return row;
  }
  async updateMobilizationRisk(id: number, data: Partial<InsertMobilizationRisk>): Promise<MobilizationRisk | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationRisks).set(data).where(eq(mobilizationRisks.id, id)).returning();
    return row;
  }
  async deleteMobilizationRisk(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationRisks).where(eq(mobilizationRisks.id, id));
  }

  async getMobilizationSignatures(projectId: number): Promise<MobilizationSignature[]> {
    await ensureReady();
    return await db.select().from(mobilizationSignatures)
      .where(eq(mobilizationSignatures.projectId, projectId))
      .orderBy(mobilizationSignatures.sortOrder, mobilizationSignatures.id);
  }
  async createMobilizationSignature(data: InsertMobilizationSignature): Promise<MobilizationSignature> {
    await ensureReady();
    const [row] = await db.insert(mobilizationSignatures).values(data).returning();
    return row;
  }
  async updateMobilizationSignature(id: number, data: Partial<InsertMobilizationSignature>): Promise<MobilizationSignature | undefined> {
    await ensureReady();
    const [row] = await db.update(mobilizationSignatures).set(data).where(eq(mobilizationSignatures.id, id)).returning();
    return row;
  }
  async deleteMobilizationSignature(id: number): Promise<void> {
    await ensureReady();
    await db.delete(mobilizationSignatures).where(eq(mobilizationSignatures.id, id));
  }

  async getMobilizationSectionNotes(projectId: number): Promise<MobilizationSectionNote[]> {
    await ensureReady();
    return await db.select().from(mobilizationSectionNotes)
      .where(eq(mobilizationSectionNotes.projectId, projectId));
  }
  // Rows are never pre-seeded, so the first save for a section inserts and
  // every later save updates — hence the upsert on (project_id, section).
  async upsertMobilizationSectionNote(
    projectId: number,
    section: string,
    data: { narrative: string; updatedById?: number | null },
  ): Promise<MobilizationSectionNote> {
    await ensureReady();
    const updatedAt = new Date().toISOString();
    const updatedById = data.updatedById ?? null;
    const [row] = await db.insert(mobilizationSectionNotes)
      .values({ projectId, section, narrative: data.narrative, updatedAt, updatedById })
      .onConflictDoUpdate({
        target: [mobilizationSectionNotes.projectId, mobilizationSectionNotes.section],
        set: { narrative: data.narrative, updatedAt, updatedById },
      })
      .returning();
    return row;
  }

  /* --------------------------- Project Setup --------------------------- */
  // Seeds a fresh project's setup record: the 1:1 setup row, the 13 default
  // deliverables, and the 5 charter signers. Stakeholders and contract docs
  // are NOT seeded — both directories are entirely project-specific.
  // Idempotent: bails when a setup row already exists, so a retried project
  // create can't double-seed.
  async seedProjectSetup(projectId: number, organizationId: number | null): Promise<void> {
    await ensureReady();
    const existing = await this.getProjectSetup(projectId);
    if (existing) return;

    const now = new Date().toISOString();
    await db.insert(projectSetup).values({
      projectId,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(projectSetupDeliverables).values(
      PROJECT_SETUP_DELIVERABLES.map((d) => ({
        projectId,
        label: d.label,
        status: "pending",
        sortOrder: d.sortOrder,
      })),
    );

    // Names are a best-effort match against the org roster — an unmatched role
    // still gets a row so the charter renders a blank to sign. Reading the
    // roster unscoped would pull names from other tenants onto this charter,
    // so a project with no organization gets no auto-fill at all.
    const roster = organizationId != null ? await this.getTeam(organizationId) : [];
    await db.insert(projectSetupSignatures).values(
      PROJECT_SETUP_SIGNERS.map((role, i) => ({
        projectId,
        role,
        name: matchSignerName(roster, role, PROJECT_SETUP_SIGNER_ALIASES),
        sortOrder: i,
      })),
    );
  }

  async getProjectSetup(projectId: number): Promise<ProjectSetup | null> {
    await ensureReady();
    const rows = await db.select().from(projectSetup).where(eq(projectSetup.projectId, projectId));
    return rows[0] ?? null;
  }

  async getProjectSetupBundle(projectId: number): Promise<{
    setup: ProjectSetup | null;
    stakeholders: ProjectSetupStakeholder[];
    contractDocs: ProjectSetupContractDoc[];
    deliverables: ProjectSetupDeliverable[];
    signatures: ProjectSetupSignature[];
  }> {
    await ensureReady();
    const [setup, stakeholders, contractDocs, deliverables, signatures] = await Promise.all([
      this.getProjectSetup(projectId),
      db.select().from(projectSetupStakeholders)
        .where(eq(projectSetupStakeholders.projectId, projectId))
        .orderBy(projectSetupStakeholders.sortOrder, projectSetupStakeholders.id),
      db.select().from(projectSetupContractDocs)
        .where(eq(projectSetupContractDocs.projectId, projectId))
        .orderBy(projectSetupContractDocs.sortOrder, projectSetupContractDocs.id),
      db.select().from(projectSetupDeliverables)
        .where(eq(projectSetupDeliverables.projectId, projectId))
        .orderBy(projectSetupDeliverables.sortOrder, projectSetupDeliverables.id),
      db.select().from(projectSetupSignatures)
        .where(eq(projectSetupSignatures.projectId, projectId))
        .orderBy(projectSetupSignatures.sortOrder, projectSetupSignatures.id),
    ]);
    return { setup, stakeholders, contractDocs, deliverables, signatures };
  }

  // Returns null when the project has no setup row — callers surface that as
  // "not set up yet" rather than lazily creating one, so the opt-in seed
  // endpoint stays the only path that brings a legacy project into the module.
  async updateProjectSetup(
    projectId: number,
    patch: Partial<InsertProjectSetup>,
  ): Promise<ProjectSetup | null> {
    await ensureReady();
    const { id: _id, projectId: _pid, ...rest } = patch;
    if (Object.keys(rest).length === 0) return await this.getProjectSetup(projectId);
    const [row] = await db.update(projectSetup)
      .set({ ...rest, updatedAt: new Date().toISOString() })
      .where(eq(projectSetup.projectId, projectId))
      .returning();
    return row ?? null;
  }

  async createStakeholder(data: InsertProjectSetupStakeholder): Promise<ProjectSetupStakeholder> {
    await ensureReady();
    const [row] = await db.insert(projectSetupStakeholders).values(data).returning();
    return row;
  }
  async updateStakeholder(
    id: number,
    data: Partial<InsertProjectSetupStakeholder>,
  ): Promise<ProjectSetupStakeholder | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupStakeholders).set(data)
      .where(eq(projectSetupStakeholders.id, id)).returning();
    return row;
  }
  async deleteStakeholder(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupStakeholders).where(eq(projectSetupStakeholders.id, id));
  }

  async createContractDoc(data: InsertProjectSetupContractDoc): Promise<ProjectSetupContractDoc> {
    await ensureReady();
    const [row] = await db.insert(projectSetupContractDocs).values(data).returning();
    return row;
  }
  async updateContractDoc(
    id: number,
    data: Partial<InsertProjectSetupContractDoc>,
  ): Promise<ProjectSetupContractDoc | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupContractDocs).set(data)
      .where(eq(projectSetupContractDocs.id, id)).returning();
    return row;
  }
  async deleteContractDoc(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupContractDocs).where(eq(projectSetupContractDocs.id, id));
  }

  async createDeliverable(data: InsertProjectSetupDeliverable): Promise<ProjectSetupDeliverable> {
    await ensureReady();
    const [row] = await db.insert(projectSetupDeliverables).values(data).returning();
    return row;
  }
  async updateDeliverable(
    id: number,
    data: Partial<InsertProjectSetupDeliverable>,
  ): Promise<ProjectSetupDeliverable | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupDeliverables).set(data)
      .where(eq(projectSetupDeliverables.id, id)).returning();
    return row;
  }
  async deleteDeliverable(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupDeliverables).where(eq(projectSetupDeliverables.id, id));
  }

  async createSetupSignature(data: InsertProjectSetupSignature): Promise<ProjectSetupSignature> {
    await ensureReady();
    const [row] = await db.insert(projectSetupSignatures).values(data).returning();
    return row;
  }
  async updateSetupSignature(
    id: number,
    data: Partial<InsertProjectSetupSignature>,
  ): Promise<ProjectSetupSignature | undefined> {
    await ensureReady();
    const [row] = await db.update(projectSetupSignatures).set(data)
      .where(eq(projectSetupSignatures.id, id)).returning();
    return row;
  }
  async deleteSetupSignature(id: number): Promise<void> {
    await ensureReady();
    await db.delete(projectSetupSignatures).where(eq(projectSetupSignatures.id, id));
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
  async getNoteById(id: number): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.select().from(notes).where(eq(notes.id, id));
    return row;
  }
  async updateNote(id: number, patch: Partial<Note>): Promise<Note | undefined> {
    await ensureReady();
    const [row] = await db.update(notes).set(patch).where(eq(notes.id, id)).returning();
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
    for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, maintenanceLogs, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, subscribers, demoRequests]) {
      await db.delete(t);
    }
    // Force re-seed on next request.
    seedDone = false;
    await this.seed();
  }

  async wipeAllData(): Promise<void> {
    await ensureReady();
    // Delete all project data — NO re-seed. Leaves a clean slate.
    for (const t of [messages, notes, droneCaptures, blueprints, documents, photos, maintenanceLogs, equipment, contacts, punchItems, dailyLogs, actionItems, changeOrders, submittals, rfis, tasks, milestones, projects, teamMembers, integrations, companyDocuments, deletedItems, subscribers, demoRequests]) {
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

  /* ---------------------- Project Timeline / event log --------------------- */

  /**
   * Append one row to the project timeline. Called from mutation routes
   * (fire-and-forget — the caller doesn't await the result on the critical
   * path). Never throws — timeline logging failure should never break a real
   * mutation. Any DB error is swallowed and logged to console.
   *
   * Callers pass a minimal payload; we fill in defaults (occurredAt = now,
   * meta = {}).
   */
  async recordEvent(data: Partial<InsertProjectEvent> & {
    projectId: number;
    kind: string;
    title: string;
  }): Promise<void> {
    try {
      await ensureReady();
      await db.insert(projectEvents).values({
        projectId: data.projectId,
        organizationId: data.organizationId ?? null,
        actorAccountId: data.actorAccountId ?? null,
        actorName: data.actorName ?? null,
        kind: data.kind,
        title: data.title,
        subtitle: data.subtitle ?? null,
        meta: (data.meta ?? {}) as any,
        sourceType: data.sourceType ?? null,
        sourceId: data.sourceId ?? null,
        occurredAt: data.occurredAt ?? new Date().toISOString(),
      } as any);
    } catch (err) {
      // Non-fatal — timeline is a nice-to-have, not the source of truth.
      // eslint-disable-next-line no-console
      console.error("[recordEvent] failed:", err);
    }
  }

  /**
   * Read the timeline for one project with optional filters. Server-side
   * pagination + kind filter + full-text-ish search over title/subtitle so
   * large projects (thousands of events) stay quick.
   */
  async getProjectEvents(
    projectId: number,
    opts: {
      q?: string;
      kinds?: string[];  // filter to just these kinds
      limit?: number;
      before?: string;   // ISO — for pagination (return events older than this)
    } = {},
  ): Promise<ProjectEvent[]> {
    await ensureReady();
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    // Use tagged-template SQL directly so we can compose LIKE + IN cleanly.
    // Drizzle's builder gets awkward with dynamic IN lists over jsonb.
    const kindClause = opts.kinds && opts.kinds.length > 0
      ? sql`AND kind = ANY(${opts.kinds})`
      : sql``;
    const beforeClause = opts.before
      ? sql`AND occurred_at < ${opts.before}`
      : sql``;
    const searchClause = opts.q && opts.q.trim().length > 0
      ? (() => {
          const like = `%${opts.q!.trim().toLowerCase()}%`;
          return sql`AND (LOWER(title) LIKE ${like} OR LOWER(COALESCE(subtitle, '')) LIKE ${like} OR LOWER(COALESCE(actor_name, '')) LIKE ${like})`;
        })()
      : sql``;
    const rows: any[] = await sql`
      SELECT id, organization_id, project_id, actor_account_id, actor_name, kind,
             title, subtitle, meta, source_type, source_id, occurred_at, created_at
      FROM project_events
      WHERE project_id = ${projectId}
      ${kindClause}
      ${beforeClause}
      ${searchClause}
      ORDER BY occurred_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      projectId: r.project_id,
      actorAccountId: r.actor_account_id,
      actorName: r.actor_name,
      kind: r.kind,
      title: r.title,
      subtitle: r.subtitle,
      meta: r.meta ?? {},
      sourceType: r.source_type,
      sourceId: r.source_id,
      occurredAt: typeof r.occurred_at === "string" ? r.occurred_at : new Date(r.occurred_at).toISOString(),
      createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
    })) as ProjectEvent[];
  }

  /** Kind counts for one project — used by the filter chips to show badges. */
  async getProjectEventKindCounts(projectId: number): Promise<Record<string, number>> {
    await ensureReady();
    const rows: any[] = await sql`
      SELECT kind, COUNT(*)::int AS c
      FROM project_events
      WHERE project_id = ${projectId}
      GROUP BY kind
    `;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.kind] = r.c;
    return out;
  }

  /* ----------------------------- Timesheets ---------------------------- */
  async getTimesheets(projectId?: number): Promise<Timesheet[]> {
    await ensureReady();
    if (projectId != null) {
      return await db.select().from(timesheets).where(eq(timesheets.projectId, projectId));
    }
    return await db.select().from(timesheets);
  }

  async getTimesheetsForAccount(accountId: number): Promise<Timesheet[]> {
    await ensureReady();
    return await db.select().from(timesheets).where(eq(timesheets.accountId, accountId)).orderBy(desc(timesheets.weekStart));
  }

  async getTimesheet(id: number): Promise<Timesheet | undefined> {
    await ensureReady();
    const rows = await db.select().from(timesheets).where(eq(timesheets.id, id));
    return rows[0];
  }

  async getTimesheetByAccountWeek(accountId: number, weekStart: string): Promise<Timesheet | undefined> {
    await ensureReady();
    const rows = await db.select().from(timesheets)
      .where(and(eq(timesheets.accountId, accountId), eq(timesheets.weekStart, weekStart)))
      .limit(1);
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

  // Upsert a single day's row inside a timesheet. Used by the punch→timesheet
  // rollup so repeated clock-in/out cycles on the same day update one row.
  async upsertDailyTimeEntry(timesheetId: number, entryDate: string, patch: Partial<InsertTimeEntry>): Promise<TimeEntry> {
    await ensureReady();
    const existing = await db.select().from(timeEntries)
      .where(and(eq(timeEntries.timesheetId, timesheetId), eq(timeEntries.entryDate, entryDate)))
      .limit(1);
    if (existing[0]) {
      const [row] = await db.update(timeEntries).set(patch).where(eq(timeEntries.id, existing[0].id)).returning();
      return row;
    }
    const now = new Date().toISOString();
    const [row] = await db.insert(timeEntries).values({
      timesheetId,
      entryDate,
      dayOfWeek: patch.dayOfWeek ?? new Date(entryDate).toLocaleDateString("en-US", { weekday: "long" }),
      hoursWorked: patch.hoursWorked ?? "0",
      clientName: patch.clientName ?? null,
      projectName: patch.projectName ?? null,
      activities: patch.activities ?? null,
      createdAt: now,
    }).returning();
    return row;
  }

  async getFieldPunchesForDay(accountId: number, dayStartIso: string, dayEndIso: string): Promise<FieldPunch[]> {
    await ensureReady();
    return await db.select().from(fieldPunches)
      .where(and(
        eq(fieldPunches.accountId, accountId),
        gte(fieldPunches.occurredAt, dayStartIso),
        lt(fieldPunches.occurredAt, dayEndIso),
      ))
      .orderBy(fieldPunches.occurredAt);
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
      { projectId: p[0].id, number: "RFI-014", subject: "Clearance at med-gas panels — ICU", trade: "Plumbing", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-12", dueDate: "2026-07-23" },
      { projectId: p[0].id, number: "RFI-015", subject: "Curtainwall anchor detail revision", trade: "Curtain Wall", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-15", dueDate: "2026-07-21" },
      { projectId: p[0].id, number: "RFI-012", subject: "Slab opening for mechanical chase", trade: "Concrete", status: "Answered", assigneeId: t[2].id, dateCreated: "2026-06-28", dueDate: "2026-07-10" },
      { projectId: p[1].id, number: "RFI-031", subject: "Cooling tower load path clarification", trade: "Steel — Structural", status: "Open", assigneeId: t[1].id, dateCreated: "2026-07-16", dueDate: "2026-07-22" },
      { projectId: p[1].id, number: "RFI-029", subject: "Fire-rated assembly at stair 2", trade: "Fireproofing", status: "Draft", assigneeId: t[2].id, dateCreated: "2026-07-18", dueDate: "2026-07-25" },
      { projectId: p[2].id, number: "RFI-006", subject: "Storm detention vault location", trade: "Site Utilities", status: "Open", assigneeId: t[2].id, dateCreated: "2026-07-14", dueDate: "2026-07-24" },
    ];
    for (const x of rfisSeed) await db.insert(rfis).values(x);

    const subsSeed: Omit<Submittal, "id">[] = [
      { projectId: p[0].id, number: "SUB-042", subject: "Curtainwall shop drawings", type: "Shop Drawing", trade: "Curtain Wall", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-05-10", dueDate: "2026-05-24" },
      { projectId: p[0].id, number: "SUB-051", subject: "Med-gas piping — material certs", type: "Material", trade: "Plumbing", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-08", dueDate: "2026-07-22" },
      { projectId: p[0].id, number: "SUB-049", subject: "Structural steel connections", type: "Shop Drawing", trade: "Steel — Structural", status: "Revise", assigneeId: t[2].id, dateSubmitted: "2026-06-20", dueDate: "2026-07-05" },
      { projectId: p[1].id, number: "SUB-077", subject: "Cooling tower performance data", type: "Data", trade: "HVAC", status: "Open", assigneeId: t[2].id, dateSubmitted: "2026-07-12", dueDate: "2026-07-26" },
      { projectId: p[2].id, number: "SUB-012", subject: "Storm detention vault precast", type: "Shop Drawing", trade: "Site Utilities", status: "Approved", assigneeId: t[2].id, dateSubmitted: "2026-06-15", dueDate: "2026-06-29" },
    ];
    for (const x of subsSeed) await db.insert(submittals).values(x);

    const coSeed: Omit<ChangeOrder, "id">[] = [
      { projectId: p[0].id, number: "CO-008", title: "Add 4th-floor terrace upgrade", trade: "General Conditions", status: "Approved", amount: 184000, scheduleImpact: 5, dateIssued: "2026-06-12" },
      { projectId: p[0].id, number: "CO-011", title: "Med-gas manifold expansion", trade: "Plumbing", status: "Pending", amount: 96000, scheduleImpact: 3, dateIssued: "2026-07-09" },
      { projectId: p[0].id, number: "CO-012", title: "Curtainwall IGU upgrade", trade: "Curtain Wall", status: "Pending", amount: 142000, scheduleImpact: 0, dateIssued: "2026-07-15" },
      { projectId: p[1].id, number: "CO-021", title: "Cooling tower re-spec", trade: "HVAC", status: "Pending", amount: 210000, scheduleImpact: 7, dateIssued: "2026-07-17" },
      { projectId: p[1].id, number: "CO-019", title: "Lobby finish upgrade", trade: "Painting", status: "Approved", amount: 78000, scheduleImpact: 0, dateIssued: "2026-06-28" },
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
      { projectId: p[0].id, title: "Touch up drywall at Room 112 corner", location: "Level 1, Rm 112", trade: "Drywall", status: "Open", priority: "Medium", notes: null, assigneeId: t[6].id },
      { projectId: p[0].id, title: "Missing outlet cover plates — east corridor", location: "Level 1, Corridor E", trade: "Electrical", status: "Open", priority: "Medium", notes: null, assigneeId: t[4].id },
      { projectId: p[0].id, title: "Caulk joint at storefront door", location: "Main lobby", trade: "Glazing", status: "In Progress", priority: "Low", notes: null, assigneeId: null },
      { projectId: p[1].id, title: "Paint touch-up stair 4 landings", location: "Stair 4", trade: "Painting", status: "Open", priority: "Medium", notes: null, assigneeId: null },
      { projectId: p[1].id, title: "Replace scratched door — Fl. 7 unit 712", location: "Fl. 7, Unit 712", trade: "Doors", status: "Open", priority: "High", notes: null, assigneeId: t[6].id },
      { projectId: p[2].id, title: "Re-grade swale at southeast corner", location: "Southeast lot", trade: "Civil", status: "In Progress", priority: "Medium", notes: null, assigneeId: t[3].id },
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

    // Seed rows rely on DB column defaults for the newer asset_class + fleet
    // fields — no need to enumerate every nullable column.
    const eqSeed: Array<Partial<Equipment> & Pick<Equipment, "name" | "type" | "status">> = [
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
      { projectId: p[0].id, body: "Concrete pour Friday 7am — 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40, replies: null },
      { projectId: p[0].id, body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90, replies: null },
      { projectId: p[0].id, body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50, replies: null },
      { projectId: p[0].id, body: "Inspector confirmed for med-gas — keep L2 ICU clear.", color: "emerald", x: 120, y: 220, replies: null },
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
