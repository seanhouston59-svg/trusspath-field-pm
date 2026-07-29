import { projects, tasks, rfis, submittals, changeOrders, actionItems, dailyLogs, punchItems, teamMembers, contacts, equipment, maintenanceLogs, photos, documents, companyDocuments, deletedItems, blueprints, droneCaptures, messages, notes, integrations, subscribers, demoRequests, appSettings, milestones, accounts, DEFAULT_SETTINGS } from '@shared/schema';
import type { Project, Task, Rfi, Submittal, ChangeOrder, ActionItem, DailyLog, PunchItem, TeamMember, Contact, Equipment, Photo, DocumentRow, Blueprint, DroneCapture, Message, Note, Milestone } from '@shared/schema';
import { eq } from "drizzle-orm";
import { existsSync, copyFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { IStorage } from "./types";
import { db } from "./db";
import { ensureReady } from "./ready";

let seedDone = false;

export class SystemRepo {
  /** Back-reference for the handful of reads that legitimately cross a
   *  domain boundary — see the `this.root.` call sites below. */
  constructor(private root: IStorage) {}

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

    const tasksSeed: (typeof tasks.$inferInsert)[] = [
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

    const rfisSeed: (typeof rfis.$inferInsert)[] = [
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

    const coSeed: (typeof changeOrders.$inferInsert)[] = [
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

    // Seed notes for the demo project. Stamped with the org id so the
    // universal (org-wide) corkboard shows them; type='note' distinguishes
    // them from decorative stickers. createdById is null because these are
    // system-seeded, not authored by any specific team member.
    const seedOrgId = p[0].organizationId;
    const noteSeed: Omit<Note, "id">[] = [
      { organizationId: seedOrgId, projectId: p[0].id, createdById: null, type: "note", body: "Concrete pour Friday 7am — 3 trucks. Barricades reset Thu EOD.", color: "amber", x: 40, y: 40, replies: null },
      { organizationId: seedOrgId, projectId: p[0].id, createdById: null, type: "note", body: "Glazing RFI-015 is blocking south elevation. Escalate to architect today.", color: "rose", x: 300, y: 90, replies: null },
      { organizationId: seedOrgId, projectId: p[0].id, createdById: null, type: "note", body: "Owner wants progress photos of curtainwall by 3pm Thu.", color: "blue", x: 560, y: 50, replies: null },
      { organizationId: seedOrgId, projectId: p[0].id, createdById: null, type: "note", body: "Inspector confirmed for med-gas — keep L2 ICU clear.", color: "emerald", x: 120, y: 220, replies: null },
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
        await this.root.createAccount(
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
