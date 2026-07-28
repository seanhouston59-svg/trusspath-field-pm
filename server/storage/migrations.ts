import { sql } from "./db";

export async function migrate() {
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

  // Pre-Construction (Executive OS). Sits between Project Setup and
  // Mobilization — design tracking, VE, permitting, prequal, buyout and
  // long-lead procurement. One row per project, everything else on project_id.
  // Money is TEXT so a numeric round-trip can't shift a bid or PO value.
  await sql`CREATE TABLE IF NOT EXISTS pre_construction (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    design_phase TEXT,
    design_completion_percent INTEGER,
    permit_target_date TEXT,
    permit_received_date TEXT,
    buyout_target_date TEXT,
    buyout_complete_date TEXT,
    bid_packages_count INTEGER NOT NULL DEFAULT 0,
    bid_packages_bought_out_count INTEGER NOT NULL DEFAULT 0,
    precon_lead_name TEXT,
    precon_lead_phone TEXT,
    precon_lead_email TEXT,
    estimator_name TEXT,
    estimator_phone TEXT,
    estimator_email TEXT,
    design_narrative TEXT,
    design_assumptions TEXT,
    design_exclusions TEXT,
    ve_strategy TEXT,
    constructability_findings TEXT,
    constructability_summary TEXT,
    site_conditions_notes TEXT,
    logistics_considerations TEXT,
    permit_strategy TEXT,
    jurisdictional_narrative TEXT,
    open_conditions_narrative TEXT,
    prequal_criteria TEXT,
    bid_strategy TEXT,
    bidder_outreach_narrative TEXT,
    buyout_strategy TEXT,
    long_lead_strategy TEXT,
    delivery_risk_narrative TEXT,
    overall_risks TEXT,
    overall_assumptions TEXT,
    open_issues TEXT,
    next_steps TEXT,
    precon_plan_approved_at TEXT,
    precon_plan_approved_by_id INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`;
  // 1:1 with project. seedPreConstruction relies on this to stay idempotent
  // under a concurrent retry, not just the read-then-write check.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS pre_construction_project_idx
    ON pre_construction (project_id)`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_design_docs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    discipline TEXT,
    doc_type TEXT,
    label TEXT NOT NULL,
    revision TEXT,
    issued_date TEXT,
    received_date TEXT,
    status TEXT,
    location TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_design_rfis (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    rfi_number TEXT,
    subject TEXT NOT NULL,
    discipline TEXT,
    question TEXT,
    response TEXT,
    status TEXT,
    asked_by_id INTEGER,
    asked_date TEXT,
    responded_by_id INTEGER,
    responded_date TEXT,
    impact TEXT,
    cost_impact_usd TEXT,
    schedule_impact_days INTEGER,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_ve_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    ve_number TEXT,
    description TEXT NOT NULL,
    discipline TEXT,
    status TEXT,
    estimated_savings_usd TEXT,
    schedule_impact_days INTEGER,
    proposed_by_id INTEGER,
    proposed_date TEXT,
    decision_date TEXT,
    decision_notes TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_permits (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    permit_type TEXT,
    permit_number TEXT,
    jurisdiction TEXT,
    application_date TEXT,
    hearing_date TEXT,
    issued_date TEXT,
    expiration_date TEXT,
    status TEXT,
    expediter TEXT,
    expediter_phone TEXT,
    fee_paid TEXT,
    conditions TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_prequal_subs (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    company_name TEXT NOT NULL,
    trade TEXT,
    contact TEXT,
    phone TEXT,
    email TEXT,
    insurance_expires TEXT,
    insurance_limit TEXT,
    bond_capacity TEXT,
    emr_rating TEXT,
    prequal_status TEXT,
    prequal_date TEXT,
    prequal_expires TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_bid_packages (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    package_number TEXT,
    label TEXT NOT NULL,
    csi_division TEXT,
    estimated_value_usd TEXT,
    bid_due_date TEXT,
    bids_received_count INTEGER NOT NULL DEFAULT 0,
    awarded_to TEXT,
    awarded_date TEXT,
    awarded_value_usd TEXT,
    status TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_long_lead_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    item_number TEXT,
    description TEXT NOT NULL,
    discipline TEXT,
    csi_division TEXT,
    ordered_date TEXT,
    submitted_date TEXT,
    approved_date TEXT,
    fabrication_start_date TEXT,
    expected_delivery_date TEXT,
    actual_delivery_date TEXT,
    lead_time_weeks INTEGER,
    status TEXT,
    supplier TEXT,
    supplier_contact TEXT,
    supplier_phone TEXT,
    po_number TEXT,
    po_value_usd TEXT,
    alternatives TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS pre_construction_signatures (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    name TEXT,
    title TEXT,
    signed_date TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_design_docs_project_idx
    ON pre_construction_design_docs (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_design_rfis_project_idx
    ON pre_construction_design_rfis (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_ve_items_project_idx
    ON pre_construction_ve_items (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_permits_project_idx
    ON pre_construction_permits (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_prequal_subs_project_idx
    ON pre_construction_prequal_subs (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_bid_packages_project_idx
    ON pre_construction_bid_packages (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_long_lead_items_project_idx
    ON pre_construction_long_lead_items (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS pre_construction_signatures_project_idx
    ON pre_construction_signatures (project_id)`;

  // Lean Executive OS modules (4-22). Shared parent + item tables keyed by
  // (project_id, module_id). See shared/schema.ts leanModuleState + leanModuleItems.
  await sql`CREATE TABLE IF NOT EXISTS lean_module_state (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    target_start_date TEXT,
    target_complete_date TEXT,
    owner_name TEXT,
    owner_phone TEXT,
    owner_email TEXT,
    overview TEXT,
    risks TEXT,
    assumptions TEXT,
    next_steps TEXT,
    notes TEXT,
    plan_approved_at TEXT,
    plan_approved_by_id INTEGER,
    created_at TEXT,
    updated_at TEXT
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS lean_module_state_project_module_idx
    ON lean_module_state (project_id, module_id)`;
  await sql`CREATE TABLE IF NOT EXISTS lean_module_items (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    module_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    owner_name TEXT,
    due_date TEXT,
    status TEXT,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE INDEX IF NOT EXISTS lean_module_items_project_module_idx
    ON lean_module_items (project_id, module_id)`;

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
