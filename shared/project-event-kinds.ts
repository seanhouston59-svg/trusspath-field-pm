// Stable identifiers for Project Timeline events. Server routes emit these
// strings via storage.recordEvent(); the client resolves them to icon + colour
// via EVENT_KIND_META below. Adding a new kind: append here, add matching
// EVENT_KIND_META entry, then have the mutation route call recordEvent().
//
// Kinds use dotted "<entity>.<verb>" for grepability. Never rename \u2014 the
// string is persisted in the DB. If a category needs to change, add a new
// kind and leave the old rows alone.

export const EVENT_KINDS = {
  // Time & attendance
  TIMESHEET_CLOCKIN: "timesheet.clockin",
  TIMESHEET_CLOCKOUT: "timesheet.clockout",
  TIMESHEET_SUBMITTED: "timesheet.submitted",
  TIMESHEET_APPROVED: "timesheet.approved",

  // Field capture
  PHOTO_UPLOADED: "photo.uploaded",
  OBSERVATION_LOGGED: "observation.logged",

  // Coordination items
  RFI_CREATED: "rfi.created",
  RFI_RESOLVED: "rfi.resolved",
  CHANGE_ORDER_CREATED: "change_order.created",
  CHANGE_ORDER_APPROVED: "change_order.approved",
  PUNCH_CREATED: "punch.created",
  PUNCH_CLOSED: "punch.closed",

  // Reporting & docs
  DAILY_LOG_SUBMITTED: "daily_log.submitted",
  DOC_UPLOADED: "doc.uploaded",
  BLUEPRINT_UPLOADED: "blueprint.uploaded",
  DRONE_CAPTURED: "drone.captured",

  // Task tracking
  TASK_CREATED: "task.created",
  TASK_COMPLETED: "task.completed",

  // Project lifecycle
  PROJECT_CREATED: "project.created",
  MEMBER_ADDED: "member.added",
  MILESTONE_REACHED: "milestone.reached",
  EQUIPMENT_ADDED: "equipment.added",
  MESSAGE_POSTED: "message.posted",
  NOTE_ADDED: "note.added",

  // Mobilization (Executive OS)
  MOBILIZATION_ITEM_COMPLETED: "mobilization.item_completed",
  MOBILIZATION_PERMIT_APPROVED: "mobilization.permit_approved",
  MOBILIZATION_REPORT_GENERATED: "mobilization.report_generated",

  // Project Setup (Executive OS)
  PROJECT_SETUP_CHARTER_APPROVED: "project_setup.charter_approved",
  PROJECT_SETUP_DELIVERABLE_COMPLETED: "project_setup.deliverable_completed",
  PROJECT_SETUP_KICKOFF_SCHEDULED: "project_setup.kickoff_scheduled",
  PROJECT_SETUP_CHARTER_REPORT_GENERATED: "project_setup.charter_report_generated",
  PROJECT_SETUP_KICKOFF_AGENDA_GENERATED: "project_setup.kickoff_agenda_generated",

  // Pre-Construction (Executive OS)
  PRECON_PLAN_APPROVED: "pre_construction.plan_approved",
  PRECON_PERMIT_ISSUED: "pre_construction.permit_issued",
  PRECON_BID_PACKAGE_AWARDED: "pre_construction.bid_package_awarded",
  PRECON_LONG_LEAD_ORDERED: "pre_construction.long_lead_ordered",
  PRECON_LONG_LEAD_DELIVERED: "pre_construction.long_lead_delivered",
  PRECON_PLAN_REPORT_GENERATED: "pre_construction.plan_report_generated",
  PRECON_DESIGN_REVIEW_REPORT_GENERATED: "pre_construction.design_review_report_generated",
  PRECON_BUYOUT_REPORT_GENERATED: "pre_construction.buyout_report_generated",
} as const;

export type EventKind = typeof EVENT_KINDS[keyof typeof EVENT_KINDS];

// Display metadata. Category groups related kinds into one filter chip so the
// UI stays scannable. `label` is the singular human name shown in tooltips /
// row titles when the server hasn't provided one.
export type EventKindMeta = {
  label: string;
  category: EventCategory;
};

export type EventCategory =
  | "timesheet"
  | "photo"
  | "rfi"
  | "change_order"
  | "punch"
  | "daily_log"
  | "task"
  | "doc"
  | "field"
  | "project";

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  timesheet: "Timesheet",
  photo: "Photos",
  rfi: "RFIs",
  change_order: "Change Orders",
  punch: "Punch",
  daily_log: "Daily Logs",
  task: "Tasks",
  doc: "Documents",
  field: "Field",
  project: "Project",
};

export const EVENT_KIND_META: Record<string, EventKindMeta> = {
  [EVENT_KINDS.TIMESHEET_CLOCKIN]: { label: "Clock in", category: "timesheet" },
  [EVENT_KINDS.TIMESHEET_CLOCKOUT]: { label: "Clock out", category: "timesheet" },
  [EVENT_KINDS.TIMESHEET_SUBMITTED]: { label: "Timesheet submitted", category: "timesheet" },
  [EVENT_KINDS.TIMESHEET_APPROVED]: { label: "Timesheet approved", category: "timesheet" },
  [EVENT_KINDS.PHOTO_UPLOADED]: { label: "Photo uploaded", category: "photo" },
  [EVENT_KINDS.OBSERVATION_LOGGED]: { label: "Field observation", category: "field" },
  [EVENT_KINDS.RFI_CREATED]: { label: "RFI submitted", category: "rfi" },
  [EVENT_KINDS.RFI_RESOLVED]: { label: "RFI resolved", category: "rfi" },
  [EVENT_KINDS.CHANGE_ORDER_CREATED]: { label: "Change Order created", category: "change_order" },
  [EVENT_KINDS.CHANGE_ORDER_APPROVED]: { label: "Change Order approved", category: "change_order" },
  [EVENT_KINDS.PUNCH_CREATED]: { label: "Punch item added", category: "punch" },
  [EVENT_KINDS.PUNCH_CLOSED]: { label: "Punch item closed", category: "punch" },
  [EVENT_KINDS.DAILY_LOG_SUBMITTED]: { label: "Daily log", category: "daily_log" },
  [EVENT_KINDS.DOC_UPLOADED]: { label: "Document uploaded", category: "doc" },
  [EVENT_KINDS.BLUEPRINT_UPLOADED]: { label: "Blueprint uploaded", category: "doc" },
  [EVENT_KINDS.DRONE_CAPTURED]: { label: "Drone capture", category: "field" },
  [EVENT_KINDS.TASK_CREATED]: { label: "Task created", category: "task" },
  [EVENT_KINDS.TASK_COMPLETED]: { label: "Task completed", category: "task" },
  [EVENT_KINDS.PROJECT_CREATED]: { label: "Project created", category: "project" },
  [EVENT_KINDS.MEMBER_ADDED]: { label: "Team member added", category: "project" },
  [EVENT_KINDS.MILESTONE_REACHED]: { label: "Milestone reached", category: "project" },
  [EVENT_KINDS.EQUIPMENT_ADDED]: { label: "Equipment added", category: "project" },
  [EVENT_KINDS.MESSAGE_POSTED]: { label: "Message posted", category: "project" },
  [EVENT_KINDS.NOTE_ADDED]: { label: "Note added", category: "project" },
  [EVENT_KINDS.MOBILIZATION_ITEM_COMPLETED]: { label: "Mobilization item completed", category: "project" },
  [EVENT_KINDS.MOBILIZATION_PERMIT_APPROVED]: { label: "Permit approved", category: "project" },
  [EVENT_KINDS.MOBILIZATION_REPORT_GENERATED]: { label: "Mobilization Plan generated", category: "doc" },
  [EVENT_KINDS.PROJECT_SETUP_CHARTER_APPROVED]: { label: "Project Charter approved", category: "project" },
  [EVENT_KINDS.PROJECT_SETUP_DELIVERABLE_COMPLETED]: { label: "Setup deliverable completed", category: "project" },
  [EVENT_KINDS.PROJECT_SETUP_KICKOFF_SCHEDULED]: { label: "Kickoff meeting scheduled", category: "project" },
  [EVENT_KINDS.PROJECT_SETUP_CHARTER_REPORT_GENERATED]: { label: "Project Charter generated", category: "doc" },
  [EVENT_KINDS.PROJECT_SETUP_KICKOFF_AGENDA_GENERATED]: { label: "Kickoff Agenda generated", category: "doc" },
  [EVENT_KINDS.PRECON_PLAN_APPROVED]: { label: "Pre-Construction Plan approved", category: "project" },
  [EVENT_KINDS.PRECON_PERMIT_ISSUED]: { label: "Permit issued", category: "project" },
  [EVENT_KINDS.PRECON_BID_PACKAGE_AWARDED]: { label: "Bid package awarded", category: "project" },
  [EVENT_KINDS.PRECON_LONG_LEAD_ORDERED]: { label: "Long-lead item ordered", category: "project" },
  [EVENT_KINDS.PRECON_LONG_LEAD_DELIVERED]: { label: "Long-lead item delivered", category: "project" },
  [EVENT_KINDS.PRECON_PLAN_REPORT_GENERATED]: { label: "Pre-Construction Plan generated", category: "doc" },
  [EVENT_KINDS.PRECON_DESIGN_REVIEW_REPORT_GENERATED]: { label: "Design Review Report generated", category: "doc" },
  [EVENT_KINDS.PRECON_BUYOUT_REPORT_GENERATED]: { label: "Buyout Plan generated", category: "doc" },
};

// Kinds grouped by category \u2014 used by the client to render filter chips and
// their expanded kind lists.
export function eventKindsForCategory(cat: EventCategory): string[] {
  return Object.entries(EVENT_KIND_META)
    .filter(([, meta]) => meta.category === cat)
    .map(([kind]) => kind);
}

export const EVENT_CATEGORIES_ORDER: EventCategory[] = [
  "timesheet",
  "photo",
  "rfi",
  "change_order",
  "punch",
  "daily_log",
  "task",
  "doc",
  "field",
  "project",
];
