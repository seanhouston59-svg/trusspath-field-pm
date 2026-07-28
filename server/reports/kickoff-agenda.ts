/**
 * Kickoff Meeting Agenda — the second Project Setup deliverable.
 *
 * Renders as an agenda before the meeting and as minutes after it: the
 * "Decisions & Action Items" section only appears once kickoffDecisions or
 * kickoffActionItems has been filled in, so the same endpoint produces both
 * documents without a mode flag.
 */
import type { Response } from "express";
import { storage } from "../storage";
import { ReportBuilder, formatDate, type ReportMeta } from "./engine";
import { loadCoreProject } from "./data-loaders";
import {
  PROJECT_SETUP_DELIVERABLE_STATUS_LABELS, PROJECT_SETUP_SIGNER_ALIASES,
} from "@shared/project-setup-catalog";
import type { ProjectSetupStakeholder, TeamMember } from "@shared/schema";

const DELIVERABLE_STATUS_LABELS: Record<string, string> = PROJECT_SETUP_DELIVERABLE_STATUS_LABELS;

/** The kickoff sign-off is the three people who own the outcome of the meeting;
 *  the full five-role charter block is overkill for a meeting record. */
const KICKOFF_SIGNERS = ["Project Manager", "Owner Representative", "Architect of Record"];

function blank(v: string | null | undefined): boolean {
  return !(v ?? "").trim();
}

/** `2026-07-28T14:30` / ISO → `Jul 28, 2026 at 2:30 PM`. */
function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "Not yet scheduled";
  const date = formatDate(iso.slice(0, 10));
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return date;
  const h24 = parseInt(m[1], 10);
  if (!Number.isFinite(h24)) return date;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${date} at ${h12}:${m[2]} ${suffix}`;
}

function findSigner(team: TeamMember[], role: string): string {
  const aliases = PROJECT_SETUP_SIGNER_ALIASES[role] ?? [role.toLowerCase()];
  const hit = team.find((m) => {
    const r = (m.role ?? "").trim().toLowerCase();
    return aliases.some((a) => r === a || r.includes(a));
  });
  return hit?.name ?? "";
}

function attendeeRows(rows: ProjectSetupStakeholder[]): string[][] {
  return rows.map((s) => [
    s.role,
    [s.name, s.title].filter((x) => (x ?? "").trim()).join(" — ") || "—",
    s.organization ?? "—",
    s.email ?? "—",
    s.phone ?? "—",
  ]);
}

export async function generateKickoffAgenda(
  projectId: number,
  opts: { preparedBy: string; preparedByRole?: string; revision?: string; res: Response },
): Promise<void> {
  const { res } = opts;

  const [core, bundle] = await Promise.all([
    loadCoreProject(projectId),
    storage.getProjectSetupBundle(projectId),
  ]);
  const { project, gcName } = core;
  const setup = bundle.setup;

  const [team, mobPlan] = await Promise.all([
    // Scoped read — an unscoped roster would surface other tenants' names in
    // the fallback signature block.
    project.organizationId != null ? storage.getTeam(project.organizationId) : Promise.resolve([]),
    storage.getMobilizationPlan(projectId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const meta: ReportMeta = {
    title: "Kickoff Meeting Agenda",
    projectName: project.name,
    projectNumber: setup?.projectNumber?.trim() || project.number,
    owner: project.client,
    gcName,
    address: project.address,
    reportingPeriod: setup?.kickoffScheduledAt
      ? `Kickoff ${formatDateTime(setup.kickoffScheduledAt)}`
      : `As of ${formatDate(today)}`,
    preparedBy: opts.preparedBy,
    preparedByRole: opts.preparedByRole,
    distribution: ["Owner", "Project Executive", "Project Manager", "Superintendent", "Architect of Record"],
    revision: opts.revision ?? "Rev 0",
    phase: "Project Setup",
    jurisdiction: mobPlan?.jurisdiction,
    architect: mobPlan?.architect,
    ownerRep: mobPlan?.ownerRep,
  };

  const filename = `Kickoff Agenda — ${project.name} — ${today}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/[^\x20-\x7E]/g, "-").replace(/"/g, "")}"; ` +
    `filename*=UTF-8''${encodeURIComponent(filename)}`,
  );

  const r = new ReportBuilder(meta);
  r.pipe(res);

  // ------------------------------------------------------------- 1. Cover
  r.coverPage(`${project.name} · ${meta.projectNumber}`);

  if (!setup) {
    r.sectionBreak();
    r.h1("Project Setup Not Initialized");
    r.unavailable(
      "This project has no Project Setup record, so there is no kickoff to agenda. " +
      "Open Executive OS → Project Setup and run the opt-in seed.",
    );
    r.end();
    return;
  }

  r.sectionBreak();
  r.h1("Meeting Details");
  r.keyValueGrid(
    [
      ["Project", project.name],
      ["Project Number", meta.projectNumber],
      ["Date & Time", formatDateTime(setup.kickoffScheduledAt)],
      ["Location", setup.kickoffLocation?.trim() || "To be determined"],
      ["Prepared By", opts.preparedBy],
      ["Revision", meta.revision ?? "Rev 0"],
    ],
    2,
  );

  // ---------------------------------------------------------- 2. Attendees
  r.h1("Attendees");
  r.narrativeBlock("Expected Attendance", setup.kickoffAttendeesNarrative);
  if (!bundle.stakeholders.length) {
    r.unavailable("No stakeholders added yet — populate the Project Directory to build the attendee list.");
  } else {
    r.table(
      [
        { header: "Role", width: 86 }, { header: "Name / Title", width: 108 },
        { header: "Organization", width: 90 }, { header: "Email" }, { header: "Phone", width: 74 },
      ],
      attendeeRows(bundle.stakeholders),
    );
  }

  // ------------------------------------------------------------- 3. Agenda
  r.sectionBreak();
  r.h1("Agenda");

  let n = 0;
  const item = (title: string) => { n += 1; r.h2(`${n}. ${title}`); };

  item("Welcome & Introductions");
  r.p("Round-the-room introductions. Confirm the directory above is complete and correct.");
  // Free-text agenda additions ride right behind item 1 so the canonical
  // numbering below stays stable meeting to meeting.
  r.narrativeBlock("Additional Agenda Notes", setup.kickoffAgendaNotes);

  item("Project Overview");
  if (blank(setup.projectDescription)) r.unavailable("No project description authored yet.");
  else r.p(setup.projectDescription!);

  item("Contract & Delivery");
  r.p("Review contract type, delivery method, key dates, and the billing/retainage terms recorded on the Charter.");
  r.narrativeBlock("Payment Terms", setup.paymentTerms);

  item("Strategic Goals & Success Criteria");
  if (blank(setup.strategicGoals) && blank(setup.successCriteria)) {
    r.unavailable("Goals and success criteria have not been authored yet.");
  } else {
    r.narrativeBlock("Strategic Goals", setup.strategicGoals);
    r.narrativeBlock("Success Criteria", setup.successCriteria);
  }

  item("Scope Walkthrough");
  if (!mobPlan) {
    r.unavailable("Mobilization plan not yet initialized");
  } else {
    const scope: Array<[string, string | null | undefined]> = [
      ["Scope Summary", mobPlan.scopeSummary],
      ["Exclusions", mobPlan.exclusions],
      ["Key Assumptions", mobPlan.assumptions],
      ["Work Not Included", mobPlan.workNotIncluded],
    ];
    if (scope.every(([, body]) => blank(body))) {
      r.unavailable("The mobilization plan exists but its scope narratives are empty.");
    } else {
      for (const [title, body] of scope) r.narrativeBlock(title, body);
    }
  }

  item("Risks, Assumptions & Constraints");
  if (blank(setup.keyRisks) && blank(setup.keyAssumptions) && blank(setup.keyConstraints)) {
    r.unavailable("No risks, assumptions, or constraints recorded yet.");
  } else {
    r.narrativeBlock("Key Risks", setup.keyRisks);
    r.narrativeBlock("Key Assumptions", setup.keyAssumptions);
    r.narrativeBlock("Key Constraints", setup.keyConstraints);
  }

  r.sectionBreak();
  item("Communications Plan");
  if (blank(setup.communicationPlan)) r.unavailable("No communication plan authored yet.");
  else r.p(setup.communicationPlan!);

  item("Submittal, RFI & Pay Application Workflows");
  const workflows: Array<[string, string | null | undefined]> = [
    ["Submittal Workflow", setup.submittalWorkflow],
    ["RFI Workflow", setup.rfiWorkflow],
    ["Pay Application Workflow", setup.payAppWorkflow],
  ];
  if (workflows.every(([, body]) => blank(body))) r.unavailable("No workflows authored yet.");
  else for (const [title, body] of workflows) r.narrativeBlock(title, body);

  item("Change Control");
  if (blank(setup.changeControlProcess)) r.unavailable("No change control process authored yet.");
  else r.p(setup.changeControlProcess!);

  item("Quality, Safety & Documentation Standards");
  const stds: Array<[string, string | null | undefined]> = [
    ["Quality Standards", setup.qualityStandards],
    ["Safety Standards", setup.safetyStandards],
    ["Documentation Standards", setup.documentationStandards],
  ];
  if (stds.every(([, body]) => blank(body))) r.unavailable("No standards authored yet.");
  else for (const [title, body] of stds) r.narrativeBlock(title, body);

  item("Mobilization Plan Review");
  if (!mobPlan) {
    r.unavailable("Mobilization plan not yet initialized");
  } else {
    r.p("Walk the Mobilization Plan PDF: staffing, site setup, temporary utilities, equipment, permits, and the go/no-go checklist.");
    r.narrativeBlock("Mobilization Objectives", mobPlan.objectivesNarrative);
  }

  r.sectionBreak();
  item("Setup Deliverables Checklist");
  if (!bundle.deliverables.length) {
    r.unavailable("No setup deliverables tracked yet.");
  } else {
    r.table(
      [
        { header: "Deliverable" }, { header: "Status", width: 74 },
        { header: "Due", width: 76 }, { header: "Completed", width: 76 },
        { header: "Notes", width: 120 },
      ],
      bundle.deliverables.map((d) => [
        d.label,
        DELIVERABLE_STATUS_LABELS[d.status] ?? d.status,
        formatDate(d.dueDate),
        formatDate(d.completedAt),
        d.notes ?? "—",
      ]),
    );
  }

  item("Q&A / Open Items");
  r.p("Open floor. Anything unresolved becomes an action item below.");

  item("Action Items & Next Steps");
  r.p("Confirm owners and due dates before adjourning.");

  // --------------------------------- 4. Decisions & Action Items (minutes)
  // Absent before the meeting; filling either field in the UI regenerates this
  // same PDF as the meeting record.
  if (!blank(setup.kickoffDecisions) || !blank(setup.kickoffActionItems)) {
    r.sectionBreak();
    r.h1("Decisions & Action Items Captured");
    r.narrativeBlock("Decisions", setup.kickoffDecisions);
    r.narrativeBlock("Action Items", setup.kickoffActionItems);
  }

  // ---------------------------------------------------------- 5. Signatures
  // signOffBlock draws its own heading, so this section adds only the note that
  // narrows what a kickoff signature means.
  r.sectionBreak();
  const byRole = new Map(bundle.signatures.map((s) => [s.role.trim().toLowerCase(), s]));
  r.signOffBlock({
    signers: KICKOFF_SIGNERS.map((role) => {
      const hit = byRole.get(role.toLowerCase());
      return {
        role,
        name: hit?.name ?? findSigner(team, role),
        date: hit?.signedDate ?? undefined,
      };
    }),
  });
  r.p("Signing above confirms attendance and agreement with the decisions recorded in this document.", { muted: true });

  r.end();
}
