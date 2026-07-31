import { integrations, accounts } from '@shared/schema';
import type { Project, Task, Rfi, Submittal, ChangeOrder, ActionItem, SubTaskCompletion, DailyLog, PunchItem, TeamMember, Contact, Equipment, MaintenanceLog, InsertMaintenanceLog, Photo, DocumentRow, CompanyDocument, DeletedItem, Blueprint, DroneCapture, Message, Note, Integration, InsertProject, InsertTask, InsertRfi, InsertSubmittal, InsertChangeOrder, InsertActionItem, InsertDailyLog, InsertPunchItem, InsertContact, InsertEquipment, InsertPhoto, InsertDocument, InsertCompanyDocument, InsertBlueprint, InsertDroneCapture, InsertMessage, InsertNote, InsertTeamMember, Milestone, InsertMilestone, Account, AccountPublic, Session, PasswordResetToken, Subscriber, DemoRequest, InsertSubscriber, InsertDemoRequest, JarvisMemory, InsertJarvisMemory, Timesheet, InsertTimesheet, TimeEntry, InsertTimeEntry, FieldPunch, InsertFieldPunch, FieldObservation, InsertFieldObservation, MobilizationPlan, InsertMobilizationPlan, MobilizationItem, InsertMobilizationItem, MobilizationPermit, InsertMobilizationPermit, MobilizationEquipment, InsertMobilizationEquipment, MobilizationUtility, InsertMobilizationUtility, MobilizationStaff, InsertMobilizationStaff, MobilizationSub, InsertMobilizationSub, MobilizationRisk, InsertMobilizationRisk, MobilizationSignature, InsertMobilizationSignature, MobilizationSectionNote, ProjectSetup, InsertProjectSetup, ProjectSetupStakeholder, InsertProjectSetupStakeholder, ProjectSetupContractDoc, InsertProjectSetupContractDoc, ProjectSetupDeliverable, InsertProjectSetupDeliverable, ProjectSetupSignature, InsertProjectSetupSignature, PreConstruction, InsertPreConstruction, PreConstructionDesignDoc, InsertPreConstructionDesignDoc, PreConstructionDesignRfi, InsertPreConstructionDesignRfi, PreConstructionVeItem, InsertPreConstructionVeItem, PreConstructionPermit, InsertPreConstructionPermit, PreConstructionPrequalSub, InsertPreConstructionPrequalSub, PreConstructionBidPackage, InsertPreConstructionBidPackage, PreConstructionLongLeadItem, InsertPreConstructionLongLeadItem, PreConstructionSignature, InsertPreConstructionSignature, LeanModuleState, InsertLeanModuleState, LeanModuleItem, InsertLeanModuleItem, LeanModuleItemAttachment, InsertLeanModuleItemAttachment } from '@shared/schema';

// Scoping contract for the org-scoped list reads below (getTeam, getProjects,
// getContacts, getEquipment, getCompanyDocuments): passing `undefined` reads
// across all tenants and is reserved for admin/system paths; passing `null`
// means "caller has no organization" and returns nothing. Never let a null
// scope widen into an unscoped read.
export interface IStorage {
  getTeam(organizationId?: number | null): Promise<TeamMember[]>;
  getTeamMember(id: number): Promise<TeamMember | undefined>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: number, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: number): Promise<void>;
  getProjects(organizationId?: number | null): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: number, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  getTasks(projectId?: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(data: InsertTask): Promise<Task>;
  updateTaskStatus(id: number, status: string): Promise<Task | undefined>;
  patchTask(id: number, patch: Partial<Pick<Task, "assigneeId" | "assignedSubCompanyId" | "priority" | "title" | "dueDate" | "status" | "trade">>): Promise<Task | undefined>;
  listTasksForSub(projectId: number, subCompanyId: number): Promise<Task[]>;
  markTaskCompleteBySub(params: {
    taskId: number;
    projectId: number;
    organizationId: number;
    subCompanyId: number;
    note?: string | null;
    attachmentOriginalName?: string | null;
    attachmentStoredName?: string | null;
  }): Promise<{ task: Task | undefined; completion: SubTaskCompletion }>;
  listSubTaskCompletions(taskId: number): Promise<SubTaskCompletion[]>;
  updateRfiStatus(id: number, status: string): Promise<Rfi | undefined>;
  updateSubmittalStatus(id: number, status: string): Promise<Submittal | undefined>;
  updateChangeOrderStatus(id: number, status: string): Promise<ChangeOrder | undefined>;
  getRfis(projectId?: number): Promise<Rfi[]>;
  getRfi(id: number): Promise<Rfi | undefined>;
  createRfi(data: InsertRfi): Promise<Rfi>;
  acceptSubDraftRfi(
    id: number,
    acceptedByAccountId: number,
    patch?: Partial<Pick<Rfi, "subject" | "trade" | "assigneeId" | "dueDate" | "specSection" | "drawingRef" | "priority" | "body">>,
  ): Promise<Rfi | undefined>;
  listRfisSubmittedBySub(projectId: number, subCompanyId: number): Promise<Rfi[]>;
  nextRfiNumber(projectId: number): Promise<string>;
  getSubmittals(projectId?: number): Promise<Submittal[]>;
  createSubmittal(data: InsertSubmittal): Promise<Submittal>;
  getChangeOrders(projectId?: number): Promise<ChangeOrder[]>;
  getChangeOrder(id: number): Promise<ChangeOrder | undefined>;
  createChangeOrder(data: InsertChangeOrder): Promise<ChangeOrder>;
  acceptSubDraftChangeOrder(
    id: number,
    acceptedByAccountId: number,
    patch?: Partial<Pick<ChangeOrder, "title" | "trade" | "amount" | "scheduleImpact" | "description" | "category">>,
  ): Promise<ChangeOrder | undefined>;
  recordSubDecisionOnChangeOrder(
    id: number,
    decision: "approved" | "rejected" | "needs_changes",
    comment: string | null,
    decidedByAccountId: number,
  ): Promise<ChangeOrder | undefined>;
  listChangeOrdersSubmittedBySub(projectId: number, subCompanyId: number): Promise<ChangeOrder[]>;
  nextChangeOrderNumber(projectId: number): Promise<string>;
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
  getContacts(organizationId?: number | null): Promise<Contact[]>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  getEquipment(projectId?: number, organizationId?: number | null): Promise<Equipment[]>;
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
  getCompanyDocuments(organizationId?: number | null): Promise<CompanyDocument[]>;
  getCompanyDocument(id: number): Promise<CompanyDocument | undefined>;
  createCompanyDocument(data: InsertCompanyDocument): Promise<CompanyDocument>;
  updateCompanyDocument(id: number, data: Partial<InsertCompanyDocument>): Promise<CompanyDocument | undefined>;
  deleteCompanyDocument(id: number): Promise<void>;
  // Deleted Items Bin
  // UNSCOPED: deleted_items has no organization_id column. Callers scope it
  // from each row's JSON snapshot — see scopedDeletedItems() in routes.ts.
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

  // ----- Mobilization (Command Deck) -----
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
  // By-id child reads. A row id alone doesn't say which project owns it, so
  // mutation routes load the row before acting on it.
  getMobilizationItemById(id: number): Promise<MobilizationItem | null>;
  getMobilizationPermitById(id: number): Promise<MobilizationPermit | null>;
  getMobilizationEquipmentById(id: number): Promise<MobilizationEquipment | null>;
  getMobilizationUtilityById(id: number): Promise<MobilizationUtility | null>;
  getMobilizationStaffById(id: number): Promise<MobilizationStaff | null>;
  getMobilizationSubById(id: number): Promise<MobilizationSub | null>;
  getMobilizationRiskById(id: number): Promise<MobilizationRisk | null>;
  getMobilizationSignatureById(id: number): Promise<MobilizationSignature | null>;
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
  getStakeholderById(id: number): Promise<ProjectSetupStakeholder | null>;
  getContractDocById(id: number): Promise<ProjectSetupContractDoc | null>;
  getDeliverableById(id: number): Promise<ProjectSetupDeliverable | null>;
  getSetupSignatureById(id: number): Promise<ProjectSetupSignature | null>;

  // ----- Pre-Construction (Command Deck) -----
  seedPreConstruction(projectId: number, organizationId: number | null): Promise<void>;
  getPreConstruction(projectId: number): Promise<PreConstruction | null>;
  getPreConstructionBundle(projectId: number): Promise<{
    preCon: PreConstruction | null;
    designDocs: PreConstructionDesignDoc[];
    designRfis: PreConstructionDesignRfi[];
    veItems: PreConstructionVeItem[];
    permits: PreConstructionPermit[];
    prequalSubs: PreConstructionPrequalSub[];
    bidPackages: PreConstructionBidPackage[];
    longLeadItems: PreConstructionLongLeadItem[];
    signatures: PreConstructionSignature[];
  }>;
  updatePreConstruction(projectId: number, patch: Partial<InsertPreConstruction>): Promise<PreConstruction | null>;
  createDesignDoc(data: InsertPreConstructionDesignDoc): Promise<PreConstructionDesignDoc>;
  updateDesignDoc(id: number, data: Partial<InsertPreConstructionDesignDoc>): Promise<PreConstructionDesignDoc | undefined>;
  deleteDesignDoc(id: number): Promise<void>;
  createDesignRfi(data: InsertPreConstructionDesignRfi): Promise<PreConstructionDesignRfi>;
  updateDesignRfi(id: number, data: Partial<InsertPreConstructionDesignRfi>): Promise<PreConstructionDesignRfi | undefined>;
  deleteDesignRfi(id: number): Promise<void>;
  createVeItem(data: InsertPreConstructionVeItem): Promise<PreConstructionVeItem>;
  updateVeItem(id: number, data: Partial<InsertPreConstructionVeItem>): Promise<PreConstructionVeItem | undefined>;
  deleteVeItem(id: number): Promise<void>;
  createPermit(data: InsertPreConstructionPermit): Promise<PreConstructionPermit>;
  updatePermit(id: number, data: Partial<InsertPreConstructionPermit>): Promise<PreConstructionPermit | undefined>;
  deletePermit(id: number): Promise<void>;
  createPrequalSub(data: InsertPreConstructionPrequalSub): Promise<PreConstructionPrequalSub>;
  updatePrequalSub(id: number, data: Partial<InsertPreConstructionPrequalSub>): Promise<PreConstructionPrequalSub | undefined>;
  deletePrequalSub(id: number): Promise<void>;
  createBidPackage(data: InsertPreConstructionBidPackage): Promise<PreConstructionBidPackage>;
  updateBidPackage(id: number, data: Partial<InsertPreConstructionBidPackage>): Promise<PreConstructionBidPackage | undefined>;
  deleteBidPackage(id: number): Promise<void>;
  createLongLeadItem(data: InsertPreConstructionLongLeadItem): Promise<PreConstructionLongLeadItem>;
  updateLongLeadItem(id: number, data: Partial<InsertPreConstructionLongLeadItem>): Promise<PreConstructionLongLeadItem | undefined>;
  deleteLongLeadItem(id: number): Promise<void>;
  createPreconSignature(data: InsertPreConstructionSignature): Promise<PreConstructionSignature>;
  updatePreconSignature(id: number, data: Partial<InsertPreConstructionSignature>): Promise<PreConstructionSignature | undefined>;
  deletePreconSignature(id: number): Promise<void>;
  getDesignDocById(id: number): Promise<PreConstructionDesignDoc | null>;
  getDesignRfiById(id: number): Promise<PreConstructionDesignRfi | null>;
  getVeItemById(id: number): Promise<PreConstructionVeItem | null>;
  getPermitById(id: number): Promise<PreConstructionPermit | null>;
  getPrequalSubById(id: number): Promise<PreConstructionPrequalSub | null>;
  getBidPackageById(id: number): Promise<PreConstructionBidPackage | null>;
  getLongLeadItemById(id: number): Promise<PreConstructionLongLeadItem | null>;
  getPreconSignatureById(id: number): Promise<PreConstructionSignature | null>;

  // ----- Lean Command Deck modules (4-22) -----
  getLeanModuleBundle(projectId: number, moduleId: string): Promise<{
    state: LeanModuleState | null;
    items: LeanModuleItem[];
  }>;
  ensureLeanModuleState(projectId: number, moduleId: string): Promise<LeanModuleState>;
  updateLeanModuleState(projectId: number, moduleId: string, patch: Partial<InsertLeanModuleState>): Promise<LeanModuleState | null>;
  createLeanModuleItem(data: InsertLeanModuleItem): Promise<LeanModuleItem>;
  /** Bulk-create a batch of items in one shot (paste-import flow). */
  bulkCreateLeanModuleItems(
    projectId: number,
    moduleId: string,
    rows: Array<Omit<InsertLeanModuleItem, "projectId" | "moduleId">>,
  ): Promise<LeanModuleItem[]>;
  updateLeanModuleItem(id: number, projectId: number, moduleId: string, patch: Partial<InsertLeanModuleItem>): Promise<LeanModuleItem | null>;
  deleteLeanModuleItem(id: number, projectId: number, moduleId: string): Promise<boolean>;
  /** List attachments for a module, optionally filtered by a single item. */
  listLeanModuleItemAttachments(projectId: number, moduleId: string, itemId?: number): Promise<LeanModuleItemAttachment[]>;
  createLeanModuleItemAttachment(row: InsertLeanModuleItemAttachment): Promise<LeanModuleItemAttachment>;
  updateLeanModuleItemAttachmentUrl(id: number, url: string): Promise<void>;
  deleteLeanModuleItemAttachment(id: number, projectId: number, moduleId: string): Promise<boolean>;
  /**
   * Bulk portfolio rollup. Returns one entry per (projectId, moduleId) that
   * has activity. Routes filter `projectIds` to the caller's org first — this
   * method is intentionally unaware of org scoping so it can be reused by any
   * caller that already has authorization to see the projects it passes.
   */
  getLeanModuleRollup(projectIds: number[]): Promise<Array<{
    projectId: number;
    moduleId: string;
    status: string;
    ownerName: string | null;
    targetCompleteDate: string | null;
    updatedAt: string | null;
    itemsTotal: number;
    itemsOpen: number;
    itemsOverdue: number;
    itemsAtRisk: number;
  }>>;

  getMessages(projectId: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  getNotes(projectId?: number): Promise<Note[]>;
  createNote(data: InsertNote): Promise<Note>;
  getNotesForOrg(organizationId?: number): Promise<Note[]>;
  updateNotePosition(id: number, x: number, y: number): Promise<Note | undefined>;
  getNoteById(id: number): Promise<Note | undefined>;
  updateNote(id: number, patch: Partial<Note>): Promise<Note | undefined>;
  deleteNote(id: number): Promise<void>;
  // UNSCOPED: integrations.key is globally unique, so per-org rows cannot
  // exist. See the note on the implementation.
  getIntegrations(): Promise<Integration[]>;
  setIntegration(key: string, connected: boolean, config?: string): Promise<Integration>;
  connectIntegration(key: string, data: { accountLabel?: string; config?: string }): Promise<Integration>;
  disconnectIntegration(key: string): Promise<Integration>;
  createSubscriber(data: InsertSubscriber): Promise<Subscriber>;
  // UNSCOPED: platform-level marketing table, not tenant data. Owner-only route.
  listSubscribers(): Promise<Subscriber[]>;
  createDemoRequest(data: InsertDemoRequest): Promise<DemoRequest>;
  // UNSCOPED: platform-level marketing table, not tenant data. Owner-only route.
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
  getRecentFieldObservations(opts: { accountId?: number; organizationId?: number | null; projectId?: number; limit?: number }): Promise<FieldObservation[]>;
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
  // UNSCOPED: platform-admin view of the accounts table, which spans orgs
  // by definition. Reached only through a requireOwner route.
  listDemoAccounts(): Promise<AccountPublic[]>;
  expireDemoAccount(id: number): Promise<AccountPublic | undefined>;
  purgeExpiredDemos(graceDays: number): Promise<{ purgedAccountIds: number[]; purgedOrgIds: number[] }>;
  // ----- Admin / access control -----
  // UNSCOPED: platform-admin view of the accounts table, which spans orgs
  // by definition. Reached only through a requireOwner route.
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
