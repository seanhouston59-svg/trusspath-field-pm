// Timesheet approval workflow.
//
//   draft ──employee signs──▶ employee_signed ──send to manager──▶ sent_to_manager
//                                                                        │
//                        manager signs in-app, or DocuSign envelope      │
//                        reaches "completed"                             ▼
//                                                                    approved
//                                                                        │
//                                          filed into Company Documents ─┘
//
// The Company Documents record is created ONLY on envelope completion — never on
// send, and never on an employee-only signature. `companyDocId` is the idempotency
// guard: once set, filing is skipped.
//
// Every external dependency is injected via ApprovalDeps so the state machine can
// be tested without a database, DocuSign account, or mail provider.

import { TIMESHEET_STATUS } from "@shared/schema";
import type { Timesheet, InsertTimesheet, TimeEntry, TeamMember, CompanyDocument, InsertCompanyDocument } from "@shared/schema";

/** Anchor text the DocuSign signature tab attaches to in the generated document. */
export const MANAGER_SIGNATURE_ANCHOR = "/mgr_sig/";

export type ApprovalStorage = {
  getTimesheet(id: number): Promise<Timesheet | undefined>;
  updateTimesheet(id: number, data: Partial<InsertTimesheet>): Promise<Timesheet | undefined>;
  getTimeEntries(timesheetId: number): Promise<TimeEntry[]>;
  getTimesheetByEnvelopeId(envelopeId: string): Promise<Timesheet | undefined>;
  getTeam(): Promise<TeamMember[]>;
  getTeamMember(id: number): Promise<TeamMember | undefined>;
  createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument>;
};

export type ApprovalDocusign = {
  isConfigured(): boolean;
  createEnvelope(opts: {
    emailSubject: string;
    emailBlurb?: string;
    document: { content: string | Buffer; name: string; fileExtension: string };
    signer: { name: string; email: string; anchorString?: string };
    metadata?: Record<string, string>;
  }): Promise<{ envelopeId: string; status: string }>;
  downloadCombinedPdf(envelopeId: string): Promise<Buffer>;
  envelopeViewUrl(envelopeId: string): string;
};

export type ManagerNotification = {
  to: string;
  managerName: string;
  employeeName: string;
  weekStart: string;
  weekEnd: string;
  totalHours: string;
  timesheetUrl: string;
  docusignUrl: string | null;
};

export type ApprovalDeps = {
  storage: ApprovalStorage;
  docusign: ApprovalDocusign;
  /** Sends the manager notification. Should resolve even when mail is unconfigured. */
  notifyManager(n: ManagerNotification): Promise<void>;
  /** Persists the signed PDF where the Company Documents file route can serve it. */
  storeSignedPdf?(envelopeId: string, pdf: Buffer): Promise<{ storedFileName: string; fileSizeBytes: number }>;
  now(): string;
  /** Absolute app origin used to build deep links in emails. */
  appBaseUrl: string;
};

export class WorkflowError extends Error {
  code: string;
  httpStatus: number;
  details: Record<string, unknown>;

  constructor(code: string, message: string, httpStatus = 400, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "WorkflowError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

/* ------------------------------- rendering -------------------------------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function timesheetTitle(ts: Pick<Timesheet, "employeeName" | "weekStart">): string {
  return `Timesheet — ${ts.employeeName} — Week of ${ts.weekStart}`;
}

/** Plain-text rendering, stored in the Company Documents record's notes. */
export function renderTimesheetText(ts: Timesheet, entries: TimeEntry[]): string {
  const lines: string[] = [
    "TIMESHEET",
    `Employee: ${ts.employeeName}`,
    `Week: ${ts.weekStart} to ${ts.weekEnd}`,
    `Total Hours: ${ts.totalHours}`,
    `Status: ${ts.status}`,
    "",
    "Day | Date | Client | Project | Hours | Activities",
    "--- | --- | --- | --- | --- | ---",
  ];
  for (const e of entries) {
    lines.push(`${e.dayOfWeek} | ${e.entryDate} | ${e.clientName ?? ""} | ${e.projectName ?? ""} | ${e.hoursWorked} | ${e.activities ?? ""}`);
  }
  if (ts.employeeSignature) lines.push("", `Employee Signature: ${ts.employeeSignature} (${ts.employeeSignedAt ?? ""})`);
  if (ts.managerSignature) lines.push(`Manager Signature: ${ts.managerSignature} (${ts.managerSignedAt ?? ""})`);
  if (ts.docusignEnvelopeId) lines.push(`DocuSign Envelope: ${ts.docusignEnvelopeId} (${ts.docusignStatus ?? "unknown"})`);
  return lines.join("\n");
}

/** HTML document sent to DocuSign for the manager to sign. */
export function renderTimesheetHtml(ts: Timesheet, entries: TimeEntry[]): string {
  const rows = entries
    .map(
      (e) => `<tr>
      <td>${escapeHtml(e.dayOfWeek)}</td>
      <td>${escapeHtml(e.entryDate)}</td>
      <td>${escapeHtml(e.clientName ?? "—")}</td>
      <td>${escapeHtml(e.projectName ?? "—")}</td>
      <td style="text-align:right">${escapeHtml(e.hoursWorked)}</td>
      <td>${escapeHtml(e.activities ?? "—")}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; text-align: left; }
  th { background: #f3f3f3; }
  .meta { font-size: 13px; margin: 4px 0; }
  .total { margin-top: 12px; font-weight: bold; text-align: right; }
  .sigs { margin-top: 40px; display: flex; gap: 48px; }
  .sig { flex: 1; }
  .sig-label { font-size: 11px; color: #666; }
  .sig-line { border-bottom: 1px solid #333; min-height: 28px; font-style: italic; }
</style></head><body>
  <h1>Timesheet — ${escapeHtml(ts.employeeName)}</h1>
  <div class="meta"><b>Week:</b> ${escapeHtml(ts.weekStart)} to ${escapeHtml(ts.weekEnd)}</div>
  <div class="meta"><b>Total hours:</b> ${escapeHtml(ts.totalHours)}</div>
  <table>
    <thead><tr><th>Day</th><th>Date</th><th>Client</th><th>Project</th><th>Hours</th><th>Activities</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6">No hours logged</td></tr>`}</tbody>
  </table>
  <div class="total">Total Hours: ${escapeHtml(ts.totalHours)}</div>
  <div class="sigs">
    <div class="sig">
      <div class="sig-label">Employee Signature</div>
      <div class="sig-line">${escapeHtml(ts.employeeSignature ?? "")}</div>
      <div class="sig-label">${escapeHtml(ts.employeeSignedAt ?? "")}</div>
    </div>
    <div class="sig">
      <div class="sig-label">Manager Signature</div>
      <div class="sig-line">${MANAGER_SIGNATURE_ANCHOR}</div>
    </div>
  </div>
</body></html>`;
}

/* ------------------------------ state changes ----------------------------- */

async function loadTimesheet(deps: ApprovalDeps, id: number): Promise<Timesheet> {
  const ts = await deps.storage.getTimesheet(id);
  if (!ts) throw new WorkflowError("NOT_FOUND", "Timesheet not found", 404);
  return ts;
}

/**
 * Record the employee signature. Always permitted — the employee is never gated on
 * having a manager, a complete week, or anything else.
 */
export async function signAsEmployee(deps: ApprovalDeps, timesheetId: number, signature: string): Promise<Timesheet> {
  const trimmed = signature.trim();
  if (!trimmed) throw new WorkflowError("EMPTY_SIGNATURE", "A signature is required");
  await loadTimesheet(deps, timesheetId);
  const updated = await deps.storage.updateTimesheet(timesheetId, {
    employeeSignature: trimmed,
    employeeSignedAt: deps.now(),
    status: TIMESHEET_STATUS.employeeSigned,
  });
  return updated!;
}

/** Resolve the team profile whose name matches the timesheet's employee name. */
export function findEmployeeProfile(team: TeamMember[], employeeName: string): TeamMember | undefined {
  const target = employeeName.trim().toLowerCase();
  return team.find((m) => m.name.trim().toLowerCase() === target);
}

export type SendToManagerResult = {
  timesheet: Timesheet;
  manager: TeamMember;
  docusignEnvelopeId: string | null;
  docusignStatus: string;
  emailAttempted: boolean;
};

/**
 * Route a signed timesheet to the employee's designated manager: opens the DocuSign
 * envelope (when configured), emails the manager, and moves the row into the
 * manager's in-app pending queue. No Company Documents record is created here.
 */
export async function sendToManager(deps: ApprovalDeps, timesheetId: number): Promise<SendToManagerResult> {
  const ts = await loadTimesheet(deps, timesheetId);

  if (!ts.employeeSignature) {
    throw new WorkflowError("NOT_SIGNED", "Sign the timesheet before sending it to your manager");
  }

  const team = await deps.storage.getTeam();
  const employee = findEmployeeProfile(team, ts.employeeName);
  if (!employee) {
    throw new WorkflowError(
      "NO_EMPLOYEE_PROFILE",
      `No team profile found for "${ts.employeeName}". Add them to the Team page so a manager can be assigned.`,
      400,
      { profileHref: "/team" },
    );
  }
  if (!employee.designatedManagerId) {
    throw new WorkflowError(
      "NO_DESIGNATED_MANAGER",
      `${employee.name} has no designated manager. Set one on their profile before sending.`,
      400,
      { profileHref: "/team", employeeMemberId: employee.id },
    );
  }

  const manager = await deps.storage.getTeamMember(employee.designatedManagerId);
  if (!manager) {
    throw new WorkflowError(
      "MANAGER_NOT_FOUND",
      "The designated manager on this profile no longer exists. Pick a different manager.",
      400,
      { profileHref: "/team", employeeMemberId: employee.id },
    );
  }

  const entries = await deps.storage.getTimeEntries(timesheetId);

  let envelopeId: string | null = null;
  let docusignStatus = "not_configured";

  if (deps.docusign.isConfigured()) {
    if (!manager.email) {
      throw new WorkflowError(
        "MANAGER_NO_EMAIL",
        `${manager.name} has no email address, which DocuSign requires. Add one on their profile.`,
        400,
        { profileHref: "/team", employeeMemberId: manager.id },
      );
    }
    try {
      const envelope = await deps.docusign.createEnvelope({
        emailSubject: timesheetTitle(ts),
        emailBlurb: `${ts.employeeName} submitted a timesheet for the week of ${ts.weekStart}. Please review and sign.`,
        document: {
          content: renderTimesheetHtml(ts, entries),
          name: `${timesheetTitle(ts)}.html`,
          fileExtension: "html",
        },
        signer: { name: manager.name, email: manager.email, anchorString: MANAGER_SIGNATURE_ANCHOR },
        metadata: { timesheetId: String(ts.id) },
      });
      envelopeId = envelope.envelopeId;
      docusignStatus = envelope.status;
    } catch (err) {
      // A DocuSign outage shouldn't strand the employee — the manager can still
      // sign in-app from their pending queue.
      console.error("[timesheet-approval] DocuSign envelope creation failed:", err);
      docusignStatus = "error";
    }
  }

  const updated = await deps.storage.updateTimesheet(timesheetId, {
    status: TIMESHEET_STATUS.sentToManager,
    sentToManagerAt: deps.now(),
    managerUserId: manager.id,
    docusignEnvelopeId: envelopeId,
    docusignStatus,
  });

  let emailAttempted = false;
  if (manager.email) {
    emailAttempted = true;
    await deps.notifyManager({
      to: manager.email,
      managerName: manager.name,
      employeeName: ts.employeeName,
      weekStart: ts.weekStart,
      weekEnd: ts.weekEnd,
      totalHours: ts.totalHours,
      timesheetUrl: `${deps.appBaseUrl}/#/timesheets/pending`,
      docusignUrl: envelopeId ? deps.docusign.envelopeViewUrl(envelopeId) : null,
    });
  }

  return { timesheet: updated!, manager, docusignEnvelopeId: envelopeId, docusignStatus, emailAttempted };
}

/**
 * Manager signs in the app rather than through DocuSign. Completing the signature
 * completes the workflow, so this files the Company Documents record too.
 */
export async function signAsManager(deps: ApprovalDeps, timesheetId: number, signature: string): Promise<Timesheet> {
  const trimmed = signature.trim();
  if (!trimmed) throw new WorkflowError("EMPTY_SIGNATURE", "A signature is required");
  const ts = await loadTimesheet(deps, timesheetId);
  if (!ts.employeeSignature) {
    throw new WorkflowError("NOT_SIGNED", "The employee has not signed this timesheet yet");
  }

  const updated = await deps.storage.updateTimesheet(timesheetId, {
    managerSignature: trimmed,
    managerSignedAt: deps.now(),
    status: TIMESHEET_STATUS.approved,
    docusignStatus: "completed",
  });

  return await fileToCompanyDocuments(deps, updated!);
}

export async function rejectAsManager(deps: ApprovalDeps, timesheetId: number, reason?: string): Promise<Timesheet> {
  const ts = await loadTimesheet(deps, timesheetId);
  const notes = reason?.trim() ? `${ts.notes ? `${ts.notes}\n\n` : ""}Rejected: ${reason.trim()}` : ts.notes;
  const updated = await deps.storage.updateTimesheet(timesheetId, {
    status: TIMESHEET_STATUS.rejected,
    docusignStatus: "declined",
    notes,
  });
  return updated!;
}

/**
 * Apply a DocuSign envelope status change. Only a "completed" envelope files the
 * Company Documents record; every other status just updates the tracked status.
 */
export async function applyEnvelopeStatus(deps: ApprovalDeps, envelopeId: string, rawStatus: string): Promise<Timesheet | null> {
  const ts = await deps.storage.getTimesheetByEnvelopeId(envelopeId);
  if (!ts) return null;

  const status = rawStatus.toLowerCase();
  if (status !== "completed") {
    return (await deps.storage.updateTimesheet(ts.id, { docusignStatus: status })) ?? null;
  }

  let storedPdf: { storedFileName: string; fileSizeBytes: number } | null = null;
  try {
    const pdf = await deps.docusign.downloadCombinedPdf(envelopeId);
    if (deps.storeSignedPdf) storedPdf = await deps.storeSignedPdf(envelopeId, pdf);
  } catch (err) {
    console.error("[timesheet-approval] signed PDF download failed:", err);
  }

  const updated = await deps.storage.updateTimesheet(ts.id, {
    status: TIMESHEET_STATUS.approved,
    docusignStatus: "completed",
    managerSignedAt: ts.managerSignedAt ?? deps.now(),
    managerSignature: ts.managerSignature ?? (await managerNameFor(deps, ts)),
  });

  return await fileToCompanyDocuments(deps, updated!, storedPdf);
}

async function managerNameFor(deps: ApprovalDeps, ts: Timesheet): Promise<string | null> {
  if (!ts.managerUserId) return null;
  const manager = await deps.storage.getTeamMember(ts.managerUserId);
  return manager?.name ?? null;
}

/**
 * Create the Company Documents record for a fully-signed timesheet. Idempotent:
 * a timesheet that already carries a companyDocId is returned untouched.
 */
export async function fileToCompanyDocuments(
  deps: ApprovalDeps,
  ts: Timesheet,
  storedPdf?: { storedFileName: string; fileSizeBytes: number } | null,
): Promise<Timesheet> {
  if (ts.companyDocId) return ts;
  if (!ts.employeeSignature || !(ts.managerSignature || ts.managerSignedAt)) {
    throw new WorkflowError("NOT_FULLY_SIGNED", "Both signatures are required before filing to Company Documents");
  }

  const entries = await deps.storage.getTimeEntries(ts.id);
  const title = timesheetTitle(ts);
  const doc = await deps.storage.createCompanyDocument({
    title,
    category: "HR",
    // Tag so Company Documents can filter timesheets out of the general HR pile.
    type: "timesheet",
    status: "Active",
    signatureRequired: true,
    signatureStatus: "Signed",
    signerName: ts.managerSignature ?? null,
    signerEmail: null,
    docusignUrl: ts.docusignEnvelopeId ? deps.docusign.envelopeViewUrl(ts.docusignEnvelopeId) : null,
    dueDate: null,
    notes: renderTimesheetText(ts, entries),
    uploadedById: null,
    date: deps.now().slice(0, 10),
    storedFileName: storedPdf?.storedFileName ?? null,
    originalFileName: storedPdf ? `${title}.pdf` : null,
    mimeType: storedPdf ? "application/pdf" : null,
    fileSizeBytes: storedPdf?.fileSizeBytes ?? null,
  });

  const updated = await deps.storage.updateTimesheet(ts.id, {
    companyDocId: doc.id,
    // The filed record is where the signed artifact lives, so point at its file route.
    signedPdfUrl: storedPdf ? `/api/company-documents/${doc.id}/file` : ts.signedPdfUrl,
  });
  return updated!;
}
