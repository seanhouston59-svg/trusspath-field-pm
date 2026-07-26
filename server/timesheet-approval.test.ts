import { describe, it, expect, vi, beforeEach } from "vitest";
import { TIMESHEET_STATUS } from "@shared/schema";
import type { Timesheet, TeamMember, TimeEntry, CompanyDocument, InsertCompanyDocument, InsertTimesheet } from "@shared/schema";
import {
  signAsEmployee,
  sendToManager,
  signAsManager,
  applyEnvelopeStatus,
  WorkflowError,
  type ApprovalDeps,
} from "./timesheet-approval";

/* ------------------------------- fake world ------------------------------- */

function makeTimesheet(over: Partial<Timesheet> = {}): Timesheet {
  return {
    id: 1,
    employeeName: "Dana Reyes",
    weekStart: "2026-07-19",
    weekEnd: "2026-07-25",
    totalHours: "40.00",
    status: TIMESHEET_STATUS.draft,
    employeeSignature: null,
    managerSignature: null,
    notes: null,
    projectId: null,
    employeeSignedAt: null,
    sentToManagerAt: null,
    managerSignedAt: null,
    managerUserId: null,
    docusignEnvelopeId: null,
    docusignStatus: null,
    signedPdfUrl: null,
    companyDocId: null,
    createdAt: null,
    updatedAt: null,
  } as Timesheet;
}

function makeMember(over: Partial<TeamMember>): TeamMember {
  return {
    id: 1,
    name: "Dana Reyes",
    role: "Electrician",
    trade: "Electrical",
    company: "TrussPath",
    email: "dana@trusspath.test",
    phone: null,
    initials: "DR",
    color: "blue",
    companyPhoto: null,
    accessLevel: "foreman",
    designatedManagerId: null,
    ...over,
  } as TeamMember;
}

type World = {
  deps: ApprovalDeps;
  timesheet: Timesheet;
  createdDocs: InsertCompanyDocument[];
  notifications: unknown[];
  createEnvelope: ReturnType<typeof vi.fn>;
};

function makeWorld(opts: {
  timesheet?: Partial<Timesheet>;
  team?: TeamMember[];
  docusignConfigured?: boolean;
} = {}): World {
  let timesheet = makeTimesheet(opts.timesheet);
  Object.assign(timesheet, opts.timesheet ?? {});

  const team = opts.team ?? [
    makeMember({ id: 1, name: "Dana Reyes", designatedManagerId: 2 }),
    makeMember({ id: 2, name: "Sam Okafor", role: "Superintendent", email: "sam@trusspath.test", initials: "SO" }),
  ];

  const createdDocs: InsertCompanyDocument[] = [];
  const notifications: unknown[] = [];
  const entries: TimeEntry[] = [
    { id: 10, timesheetId: 1, entryDate: "2026-07-20", dayOfWeek: "Monday", clientName: "Meridian", projectName: "Tower", hoursWorked: "8.00", activities: "Rough-in" } as TimeEntry,
  ];

  const createEnvelope = vi.fn(async () => ({ envelopeId: "env-abc", status: "sent" }));

  const deps: ApprovalDeps = {
    storage: {
      getTimesheet: async (id) => (id === timesheet.id ? timesheet : undefined),
      updateTimesheet: async (id, data: Partial<InsertTimesheet>) => {
        if (id !== timesheet.id) return undefined;
        timesheet = { ...timesheet, ...(data as Partial<Timesheet>) };
        return timesheet;
      },
      getTimeEntries: async () => entries,
      getTimesheetByEnvelopeId: async (envelopeId) =>
        timesheet.docusignEnvelopeId === envelopeId ? timesheet : undefined,
      getTeam: async () => team,
      getTeamMember: async (id) => team.find((m) => m.id === id),
      createCompanyDocument: async (data) => {
        createdDocs.push(data);
        return { ...data, id: 900 + createdDocs.length } as CompanyDocument;
      },
    },
    docusign: {
      isConfigured: () => opts.docusignConfigured ?? false,
      createEnvelope,
      downloadCombinedPdf: async () => Buffer.from("%PDF-1.4 signed"),
      envelopeViewUrl: (id) => `https://demo.docusign.net/envelopes/${id}`,
    },
    notifyManager: async (n) => { notifications.push(n); },
    storeSignedPdf: async () => ({ storedFileName: "timesheet-env-abc.pdf", fileSizeBytes: 15 }),
    now: () => "2026-07-26T12:00:00.000Z",
    appBaseUrl: "https://trusspath.test",
  };

  return {
    deps,
    createdDocs,
    notifications,
    createEnvelope,
    get timesheet() { return timesheet; },
  } as World;
}

/* ---------------------------------- tests --------------------------------- */

describe("employee signature", () => {
  it("is never gated — signing works with no manager, no email, no DocuSign", async () => {
    const w = makeWorld({ team: [makeMember({ id: 1, designatedManagerId: null, email: null })] });
    const ts = await signAsEmployee(w.deps, 1, "  Dana Reyes  ");
    expect(ts.employeeSignature).toBe("Dana Reyes");
    expect(ts.status).toBe(TIMESHEET_STATUS.employeeSigned);
  });

  it("does NOT create a Company Documents record", async () => {
    const w = makeWorld();
    await signAsEmployee(w.deps, 1, "Dana Reyes");
    expect(w.createdDocs).toHaveLength(0);
    expect(w.timesheet.companyDocId).toBeNull();
  });
});

describe("send to manager", () => {
  it("is blocked when the employee profile has no designated manager", async () => {
    const w = makeWorld({
      timesheet: { employeeSignature: "Dana Reyes", status: TIMESHEET_STATUS.employeeSigned },
      team: [makeMember({ id: 1, name: "Dana Reyes", designatedManagerId: null })],
    });

    await expect(sendToManager(w.deps, 1)).rejects.toThrow(WorkflowError);
    await expect(sendToManager(w.deps, 1)).rejects.toMatchObject({
      code: "NO_DESIGNATED_MANAGER",
      details: { profileHref: "/team" },
    });
    expect(w.timesheet.status).toBe(TIMESHEET_STATUS.employeeSigned);
    expect(w.notifications).toHaveLength(0);
  });

  it("is blocked when the employee has no team profile at all", async () => {
    const w = makeWorld({
      timesheet: { employeeSignature: "Dana Reyes" },
      team: [makeMember({ id: 5, name: "Someone Else" })],
    });
    await expect(sendToManager(w.deps, 1)).rejects.toMatchObject({ code: "NO_EMPLOYEE_PROFILE" });
  });

  it("is blocked before the employee has signed", async () => {
    const w = makeWorld();
    await expect(sendToManager(w.deps, 1)).rejects.toMatchObject({ code: "NOT_SIGNED" });
  });

  it("routes to the designated manager and notifies them, without filing to Company Documents", async () => {
    const w = makeWorld({
      timesheet: { employeeSignature: "Dana Reyes", status: TIMESHEET_STATUS.employeeSigned },
      docusignConfigured: true,
    });

    const result = await sendToManager(w.deps, 1);

    expect(result.manager.name).toBe("Sam Okafor");
    expect(result.docusignEnvelopeId).toBe("env-abc");
    expect(w.timesheet.status).toBe(TIMESHEET_STATUS.sentToManager);
    expect(w.timesheet.managerUserId).toBe(2);
    expect(w.notifications).toHaveLength(1);
    // The whole point of the workflow: no filing until both signatures exist.
    expect(w.createdDocs).toHaveLength(0);
    expect(w.timesheet.companyDocId).toBeNull();
  });

  it("still moves to sent_to_manager when DocuSign envelope creation fails", async () => {
    const w = makeWorld({
      timesheet: { employeeSignature: "Dana Reyes" },
      docusignConfigured: true,
    });
    w.createEnvelope.mockRejectedValueOnce(new Error("DocuSign 503"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendToManager(w.deps, 1);

    expect(result.docusignEnvelopeId).toBeNull();
    expect(result.docusignStatus).toBe("error");
    expect(w.timesheet.status).toBe(TIMESHEET_STATUS.sentToManager);
  });
});

describe("envelope completion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("files the record into Company Documents when the envelope completes", async () => {
    const w = makeWorld({
      timesheet: {
        employeeSignature: "Dana Reyes",
        status: TIMESHEET_STATUS.sentToManager,
        managerUserId: 2,
        docusignEnvelopeId: "env-abc",
        docusignStatus: "sent",
      },
      docusignConfigured: true,
    });

    const ts = await applyEnvelopeStatus(w.deps, "env-abc", "Completed");

    expect(ts?.status).toBe(TIMESHEET_STATUS.approved);
    expect(ts?.managerSignature).toBe("Sam Okafor");
    expect(w.createdDocs).toHaveLength(1);
    expect(w.createdDocs[0]).toMatchObject({
      type: "timesheet",
      category: "HR",
      signatureStatus: "Signed",
      title: "Timesheet — Dana Reyes — Week of 2026-07-19",
      storedFileName: "timesheet-env-abc.pdf",
    });
    expect(ts?.companyDocId).toBe(901);
    expect(ts?.signedPdfUrl).toBe("/api/company-documents/901/file");
  });

  it("does NOT file on any non-completed envelope status", async () => {
    const w = makeWorld({
      timesheet: {
        employeeSignature: "Dana Reyes",
        status: TIMESHEET_STATUS.sentToManager,
        docusignEnvelopeId: "env-abc",
      },
      docusignConfigured: true,
    });

    for (const status of ["sent", "delivered", "declined", "voided"]) {
      const ts = await applyEnvelopeStatus(w.deps, "env-abc", status);
      expect(ts?.docusignStatus).toBe(status);
      expect(ts?.status).toBe(TIMESHEET_STATUS.sentToManager);
    }
    expect(w.createdDocs).toHaveLength(0);
  });

  it("is idempotent — a replayed completion event does not double-file", async () => {
    const w = makeWorld({
      timesheet: {
        employeeSignature: "Dana Reyes",
        status: TIMESHEET_STATUS.sentToManager,
        managerUserId: 2,
        docusignEnvelopeId: "env-abc",
      },
      docusignConfigured: true,
    });

    await applyEnvelopeStatus(w.deps, "env-abc", "completed");
    await applyEnvelopeStatus(w.deps, "env-abc", "completed");

    expect(w.createdDocs).toHaveLength(1);
  });

  it("ignores envelopes that belong to no timesheet", async () => {
    const w = makeWorld();
    expect(await applyEnvelopeStatus(w.deps, "env-unknown", "completed")).toBeNull();
    expect(w.createdDocs).toHaveLength(0);
  });
});

describe("in-app manager signature", () => {
  it("files into Company Documents, matching the DocuSign-completed path", async () => {
    const w = makeWorld({
      timesheet: { employeeSignature: "Dana Reyes", status: TIMESHEET_STATUS.sentToManager, managerUserId: 2 },
    });

    const ts = await signAsManager(w.deps, 1, "Sam Okafor");

    expect(ts.status).toBe(TIMESHEET_STATUS.approved);
    expect(w.createdDocs).toHaveLength(1);
    expect(w.createdDocs[0].type).toBe("timesheet");
    // No envelope, so no signed artifact to attach.
    expect(w.createdDocs[0].storedFileName).toBeNull();
  });

  it("refuses to approve a timesheet the employee never signed", async () => {
    const w = makeWorld();
    await expect(signAsManager(w.deps, 1, "Sam Okafor")).rejects.toMatchObject({ code: "NOT_SIGNED" });
    expect(w.createdDocs).toHaveLength(0);
  });
});

// TODO(manual E2E): with real DOCUSIGN_* env vars set, sign the envelope in the
// DocuSign sandbox and confirm the Connect webhook at POST /api/docusign/webhook
// files the timesheet into Company Documents with the combined PDF attached.
// There is no HTTP-level test harness in this repo to automate that leg.
