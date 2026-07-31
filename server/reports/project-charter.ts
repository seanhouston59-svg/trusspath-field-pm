/**
 * Project Charter — the CEO-facing output of the Project Setup module.
 *
 * Eleven sections covering identity, money, narrative, directory, the contract
 * document register, standards, and a data-driven sign-off block. Section 5
 * reaches across into the mobilization plan: the charter is upstream of
 * mobilization but references the same scope language, and duplicating those
 * four narratives into project_setup would guarantee they drift.
 */
import type { Response } from "express";
import { storage } from "../storage";
import { ReportBuilder, formatDate, formatMoney, type ReportMeta } from "./engine";
import { loadCoreProject } from "./data-loaders";
import {
  CONTRACT_TYPES, DELIVERY_METHODS, BILLING_CYCLES, CONTRACT_DOC_KINDS,
  PROJECT_SETUP_SIGNERS, PROJECT_SETUP_SIGNER_ALIASES,
  PROJECT_SETUP_DELIVERABLE_STATUS_LABELS,
} from "@shared/project-setup-catalog";
import type {
  ProjectSetup, ProjectSetupContractDoc, ProjectSetupStakeholder, TeamMember,
} from "@shared/schema";

const CONTRACT_TYPE_LABELS = labelMap(CONTRACT_TYPES);
const DELIVERY_METHOD_LABELS = labelMap(DELIVERY_METHODS);
const BILLING_CYCLE_LABELS = labelMap(BILLING_CYCLES);
const DOC_KIND_LABELS = labelMap(CONTRACT_DOC_KINDS);
const DELIVERABLE_STATUS_LABELS: Record<string, string> = PROJECT_SETUP_DELIVERABLE_STATUS_LABELS;

function labelMap(defs: ReadonlyArray<{ value: string; label: string }>): Record<string, string> {
  return Object.fromEntries(defs.map((d) => [d.value, d.label]));
}

/** Stored values are free text on legacy rows, so an unknown value prints as-is. */
function labelFor(map: Record<string, string>, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return v ? (map[v] ?? v) : "";
}

function blank(v: string | null | undefined): boolean {
  return !(v ?? "").trim();
}

/** Roster lookup for the sign-off fallback, matching the mobilization aliases. */
function findSigner(team: TeamMember[], role: string): string {
  const aliases = PROJECT_SETUP_SIGNER_ALIASES[role] ?? [role.toLowerCase()];
  const hit = team.find((m) => {
    const r = (m.role ?? "").trim().toLowerCase();
    return aliases.some((a) => r === a || r.includes(a));
  });
  return hit?.name ?? "";
}

function stakeholderRows(rows: ProjectSetupStakeholder[]): string[][] {
  return rows.map((s) => [
    s.role,
    [s.name, s.title].filter((x) => (x ?? "").trim()).join(" — ") || "—",
    s.organization ?? "—",
    s.email ?? "—",
    s.phone ?? "—",
  ]);
}

function docRows(rows: ProjectSetupContractDoc[]): string[][] {
  return rows.map((d) => [
    d.label,
    d.revision ?? "—",
    formatDate(d.issuedDate),
    formatDate(d.receivedDate),
    d.location ?? "—",
    d.notes ?? "—",
  ]);
}

export async function generateProjectCharter(
  projectId: number,
  opts: { preparedBy: string; preparedByRole?: string; revision?: string; res: Response },
): Promise<void> {
  const { res } = opts;

  const [core, bundle] = await Promise.all([
    loadCoreProject(projectId),
    storage.getProjectSetupBundle(projectId),
  ]);
  const { project, gcName } = core;
  const setup: ProjectSetup | null = bundle.setup;

  const [team, mobPlan] = await Promise.all([
    // Unscoped roster reads would pull other tenants' names onto this sign-off
    // block, so a project with no organization gets an empty roster instead.
    project.organizationId != null ? storage.getTeam(project.organizationId) : Promise.resolve([]),
    storage.getMobilizationPlan(projectId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const meta: ReportMeta = {
    title: "Project Charter",
    projectName: project.name,
    projectNumber: setup?.projectNumber?.trim() || project.number,
    owner: project.client,
    gcName,
    address: project.address,
    reportingPeriod: `As of ${formatDate(today)}`,
    preparedBy: opts.preparedBy,
    preparedByRole: opts.preparedByRole,
    distribution: ["CEO", "Owner", "Project Executive", "Project Manager", "Architect of Record"],
    revision: opts.revision ?? "Rev 0",
    phase: "Project Setup",
    jurisdiction: mobPlan?.jurisdiction,
    architect: mobPlan?.architect,
    engineerOfRecord: mobPlan?.engineerOfRecord,
    ownerRep: mobPlan?.ownerRep,
  };

  const filename = `Project Charter — ${project.name} — ${today}.pdf`;
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
      "This project has no Project Setup record. Open Command Deck → Project Setup and " +
      "run the opt-in seed to populate the charter.",
    );
    r.end();
    return;
  }

  // ------------------------------------------- 2. Project Information grid
  const info: Array<[string, string]> = [];
  const addRow = (label: string, value: string | number | null | undefined) => {
    const v = value === null || value === undefined ? "" : String(value).trim();
    if (v) info.push([label, v]);
  };
  addRow("Project Name", project.name);
  addRow("Project Number", setup.projectNumber);
  addRow("Contract Number", setup.contractNumber);
  addRow("Owner / Client", project.client);
  addRow("General Contractor", gcName);
  addRow("Address", project.address);
  addRow("Award Date", setup.awardDate ? formatDate(setup.awardDate) : null);
  addRow("Notice to Proceed", setup.noticeToProceedDate ? formatDate(setup.noticeToProceedDate) : null);
  addRow("Substantial Completion", setup.substantialCompletionDate ? formatDate(setup.substantialCompletionDate) : null);
  addRow("Final Completion", setup.finalCompletionDate ? formatDate(setup.finalCompletionDate) : null);
  addRow("Contract Type", labelFor(CONTRACT_TYPE_LABELS, setup.contractType));
  addRow("Delivery Method", labelFor(DELIVERY_METHOD_LABELS, setup.deliveryMethod));
  addRow("Original Contract Value", setup.originalContractValue);
  addRow("Contingency", setup.contingencyPercent ? `${setup.contingencyPercent}%` : null);
  addRow("Retainage", setup.retainagePercent ? `${setup.retainagePercent}%` : null);
  addRow("Billing Cycle", labelFor(BILLING_CYCLE_LABELS, setup.billingCycle));
  addRow("Insurance Carrier", setup.insuranceCarrier);
  addRow("Insurance Policy #", setup.insurancePolicyNumber);
  addRow("Bond Carrier", setup.bondCarrier);
  addRow("Bond Policy #", setup.bondPolicyNumber);
  addRow("Bond Amount", setup.bondAmount);
  addRow("Baseline Budget", formatMoney(project.budget));
  addRow("Charter Approved", setup.charterApprovedAt
    ? formatDate(setup.charterApprovedAt.slice(0, 10))
    : "Not yet approved");

  r.sectionBreak();
  r.h1("1. Project Information");
  r.keyValueGrid(info, 2);
  r.narrativeBlock("Payment Terms", setup.paymentTerms);

  // ---------------------------------------------------- 3. Executive Summary
  r.sectionBreak();
  r.h1("2. Executive Summary");
  if (blank(setup.projectDescription) && blank(setup.businessCase)) {
    r.unavailable("Project description and business case have not been authored yet.");
  } else {
    r.narrativeBlock("Project Description", setup.projectDescription);
    r.narrativeBlock("Business Case", setup.businessCase);
  }

  // ------------------------------- 4. Strategic Goals & Success Criteria
  r.h1("3. Strategic Goals & Success Criteria");
  if (blank(setup.strategicGoals) && blank(setup.successCriteria)) {
    r.unavailable("Strategic goals and success criteria have not been authored yet.");
  } else {
    r.narrativeBlock("Strategic Goals", setup.strategicGoals);
    r.narrativeBlock("Success Criteria", setup.successCriteria);
  }

  // ------------------------------------------------------ 5. Scope Narrative
  r.sectionBreak();
  r.h1("4. Scope Narrative");
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
      r.p("Scope language is authored once on the Mobilization plan and mirrored here.", { muted: true });
      for (const [title, body] of scope) r.narrativeBlock(title, body);
    }
  }

  // ------------------------------- 6. Risks, Assumptions & Constraints
  r.h1("5. Risks, Assumptions & Constraints");
  if (blank(setup.keyRisks) && blank(setup.keyAssumptions) && blank(setup.keyConstraints)) {
    r.unavailable("No risks, assumptions, or constraints recorded yet.");
  } else {
    r.narrativeBlock("Key Risks", setup.keyRisks);
    r.narrativeBlock("Key Assumptions", setup.keyAssumptions);
    r.narrativeBlock("Key Constraints", setup.keyConstraints);
  }

  // --------------------------------------------------- 7. Project Directory
  r.sectionBreak();
  r.h1("6. Project Directory");
  if (!bundle.stakeholders.length) {
    r.unavailable("No stakeholders added yet");
  } else {
    r.table(
      [
        { header: "Role", width: 86 }, { header: "Name / Title", width: 108 },
        { header: "Organization", width: 90 }, { header: "Email" }, { header: "Phone", width: 74 },
      ],
      stakeholderRows(bundle.stakeholders),
    );
  }

  // ------------------------------------------- 8. Contract Document Register
  r.sectionBreak();
  r.h1("7. Contract Documents Register");
  if (!bundle.contractDocs.length) {
    r.unavailable("No contract documents registered yet.");
  } else {
    for (const kind of CONTRACT_DOC_KINDS) {
      const rows = bundle.contractDocs.filter((d) => d.kind === kind.value);
      if (!rows.length) continue;
      r.h2(DOC_KIND_LABELS[kind.value] ?? kind.value);
      r.table(
        [
          { header: "Document" }, { header: "Rev", width: 42 },
          { header: "Issued", width: 70 }, { header: "Received", width: 70 },
          { header: "Location", width: 96 }, { header: "Notes", width: 96 },
        ],
        docRows(rows),
      );
    }
    // Anything on a legacy kind still prints rather than vanishing.
    const known = new Set<string>(CONTRACT_DOC_KINDS.map((k) => k.value));
    const orphans = bundle.contractDocs.filter((d) => !known.has(d.kind));
    if (orphans.length) {
      r.h2("Other");
      r.table(
        [
          { header: "Document" }, { header: "Rev", width: 42 },
          { header: "Issued", width: 70 }, { header: "Received", width: 70 },
          { header: "Location", width: 96 }, { header: "Notes", width: 96 },
        ],
        docRows(orphans),
      );
    }
  }

  // -------------------------------------------- 9. Communications & Workflows
  r.sectionBreak();
  r.h1("8. Communications & Workflows");
  const standards: Array<[string, string | null | undefined]> = [
    ["Communication Plan", setup.communicationPlan],
    ["Change Control Process", setup.changeControlProcess],
    ["Documentation Standards", setup.documentationStandards],
    ["Quality Standards", setup.qualityStandards],
    ["Safety Standards", setup.safetyStandards],
    ["Submittal Workflow", setup.submittalWorkflow],
    ["RFI Workflow", setup.rfiWorkflow],
    ["Pay Application Workflow", setup.payAppWorkflow],
  ];
  if (standards.every(([, body]) => blank(body))) {
    r.unavailable("No communication plan or workflow standards authored yet.");
  } else {
    for (const [title, body] of standards) r.narrativeBlock(title, body);
  }

  // --------------------------------------------------- 10. Closeout & Warranty
  r.sectionBreak();
  r.h1("9. Closeout & Warranty");
  if (blank(setup.closeoutRequirements) && blank(setup.warrantyRequirements)) {
    r.unavailable("Closeout and warranty requirements have not been authored yet.");
  } else {
    r.narrativeBlock("Closeout Requirements", setup.closeoutRequirements);
    r.narrativeBlock("Warranty Requirements", setup.warrantyRequirements);
  }

  // ------------------------------------------------- 11. Setup Deliverables
  r.h1("10. Setup Deliverables");
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

  // ---------------------------------------------------------- 12. Approvals
  // signOffBlock draws its own "Approvals & Sign-Off" heading, so this section
  // has no numbered h1 of its own — same as the Mobilization Plan.
  r.sectionBreak();
  r.signOffBlock({
    // Rows arrive sortOrder-ordered. Projects that never filled in the block
    // fall back to the five canonical roles, name-matched off the roster.
    signers: bundle.signatures.length
      ? bundle.signatures.map((s) => ({
          role: s.role,
          name: s.name ?? "",
          date: s.signedDate ?? undefined,
        }))
      : PROJECT_SETUP_SIGNERS.map((role) => ({ role, name: findSigner(team, role) })),
  });
  r.p(
    setup.charterApprovedAt
      ? `Charter approved ${formatDate(setup.charterApprovedAt.slice(0, 10))}.`
      : "This charter is not yet approved. The signatures above constitute approval once executed.",
    { muted: true },
  );

  r.end();
}
