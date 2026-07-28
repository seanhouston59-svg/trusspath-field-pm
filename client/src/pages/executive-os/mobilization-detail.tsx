import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, FileText, Rocket, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Avatar } from "@/components/bits";
import {
  ProgressRing, HealthChip, PermitStatusBadge, YesNoBadge, EmptyState,
} from "@/components/mobilization/bits";
import { TrackerTab, type TrackerField } from "@/components/mobilization/tracker-tab";
import { ChecklistTab } from "@/components/mobilization/checklist-tab";
import { OverviewTab } from "@/components/mobilization/overview-tab";
import { DashboardTab } from "@/components/mobilization/dashboard-tab";
import { TimelineTab } from "@/components/mobilization/timeline-tab";
import { useProject, useTeam } from "@/hooks/use-data";
import { useMobilization, useMobilizationHealth, useSeedMobilization } from "@/hooks/use-mobilization";
import { useMobilizationGate } from "@/hooks/use-project-setup";
import {
  PERMIT_STATUSES, UTILITY_KINDS, UTILITY_KIND_LABELS, RISK_SCALES, RISK_STATUSES,
} from "@shared/mobilization-catalog";
import type {
  MobilizationPermit, MobilizationEquipment, MobilizationUtility,
  MobilizationStaff, MobilizationSub, MobilizationRisk, TeamMember,
} from "@shared/schema";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "dashboard", label: "Dashboard" },
  { value: "checklist", label: "Checklist" },
  { value: "permits", label: "Permits" },
  { value: "equipment", label: "Equipment" },
  { value: "utilities", label: "Utilities" },
  { value: "staff", label: "Staff & Subs" },
  { value: "timeline", label: "Timeline" },
  { value: "risks", label: "Risks" },
];

const permitFields: TrackerField<MobilizationPermit>[] = [
  { key: "name", label: "Permit", type: "text", required: true },
  { key: "agency", label: "Agency", type: "text" },
  { key: "permitNumber", label: "Number", type: "text" },
  { key: "status", label: "Status", type: "select", options: PERMIT_STATUSES, required: true, cell: (r) => <PermitStatusBadge status={r.status} /> },
  { key: "appliedDate", label: "Applied", type: "date" },
  { key: "approvedDate", label: "Approved", type: "date" },
  { key: "expirationDate", label: "Expires", type: "date" },
  { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
];

const equipmentFields: TrackerField<MobilizationEquipment>[] = [
  { key: "name", label: "Equipment", type: "text", required: true },
  { key: "vendor", label: "Vendor", type: "text" },
  { key: "arrivalDate", label: "Arrival", type: "date" },
  { key: "onSiteConfirmed", label: "On site confirmed", type: "bool", cell: (r) => <YesNoBadge value={r.onSiteConfirmed} /> },
  { key: "departureDate", label: "Departure", type: "date" },
  { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
];

const utilityFields: TrackerField<MobilizationUtility>[] = [
  {
    key: "kind", label: "Utility", type: "select", options: UTILITY_KINDS, required: true,
    cell: (r) => UTILITY_KIND_LABELS[r.kind as keyof typeof UTILITY_KIND_LABELS] ?? r.kind,
  },
  { key: "provider", label: "Provider", type: "text" },
  { key: "requestedDate", label: "Requested", type: "date" },
  { key: "installedDate", label: "Installed", type: "date" },
  { key: "accountNumber", label: "Account #", type: "text" },
  { key: "meterNumber", label: "Meter #", type: "text" },
  { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
];

const subFields: TrackerField<MobilizationSub>[] = [
  { key: "trade", label: "Trade", type: "text", required: true },
  { key: "company", label: "Company", type: "text", required: true },
  { key: "contactName", label: "Contact", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "email", label: "Email", type: "text", hideInTable: true },
  { key: "insuranceOnFile", label: "Insurance", type: "bool", cell: (r) => <YesNoBadge value={r.insuranceOnFile} /> },
  { key: "w9OnFile", label: "W-9", type: "bool", cell: (r) => <YesNoBadge value={r.w9OnFile} /> },
  { key: "msaSigned", label: "MSA", type: "bool", cell: (r) => <YesNoBadge value={r.msaSigned} /> },
  { key: "onSiteDate", label: "On site", type: "date" },
  { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
];

function staffFields(team: TeamMember[], teamMap: Map<number, TeamMember>): TrackerField<MobilizationStaff>[] {
  return [
    {
      key: "teamMemberId", label: "Team member", type: "select", required: true, numeric: true,
      choices: team.map((m) => ({ value: String(m.id), label: `${m.name} — ${m.role}` })),
      cell: (r) => {
        const m = teamMap.get(r.teamMemberId);
        return m
          ? <span className="flex items-center gap-2"><Avatar initials={m.initials} color={m.color} size={22} />{m.name}</span>
          : `#${r.teamMemberId}`;
      },
    },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "orientationDone", label: "Orientation", type: "bool", cell: (r) => <YesNoBadge value={r.orientationDone} /> },
    { key: "drugTestDone", label: "Drug test", type: "bool", cell: (r) => <YesNoBadge value={r.drugTestDone} /> },
    { key: "ppeIssued", label: "PPE issued", type: "bool", cell: (r) => <YesNoBadge value={r.ppeIssued} /> },
    { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
  ];
}

function riskFields(team: TeamMember[], teamMap: Map<number, TeamMember>): TrackerField<MobilizationRisk>[] {
  return [
    { key: "risk", label: "Risk", type: "textarea", required: true },
    { key: "likelihood", label: "Likelihood", type: "select", options: RISK_SCALES, required: true },
    { key: "impact", label: "Impact", type: "select", options: RISK_SCALES, required: true },
    { key: "mitigation", label: "Mitigation", type: "textarea" },
    {
      key: "ownerId", label: "Owner", type: "select", numeric: true,
      choices: team.map((m) => ({ value: String(m.id), label: m.name })),
      cell: (r) => (r.ownerId ? teamMap.get(r.ownerId)?.name ?? `#${r.ownerId}` : "—"),
    },
    { key: "status", label: "Status", type: "select", options: RISK_STATUSES, required: true },
    { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
  ];
}

/**
 * Generates the Mobilization Plan PDF. The report streams from the server, so
 * it opens in a new tab rather than going through the query client.
 */
function GenerateReportDialog({ projectId, seeded }: { projectId: number; seeded: boolean }) {
  const { account } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [revision, setRevision] = useState("Rev 0");

  const openDialog = () => {
    setPreparedBy(account?.displayName || "");
    setOpen(true);
  };

  const generate = () => {
    const qs = new URLSearchParams({
      preparedBy: preparedBy.trim() || account?.displayName || "Project Team",
      revision: revision.trim() || "Rev 0",
    });
    window.open(`/api/projects/${projectId}/mobilization/report?${qs}`, "_blank");
    setOpen(false);
    toast({
      title: "Generating Mobilization Plan",
      description: "Your PDF will download in a new tab.",
    });
  };

  const trigger = (
    <Button size="sm" disabled={!seeded} onClick={openDialog} data-testid="mob-generate-report">
      <FileText className="size-4" /> Generate Mobilization Plan
    </Button>
  );

  return (
    <>
      {seeded ? trigger : (
        <TooltipProvider>
          <Tooltip>
            {/* A disabled button swallows pointer events, so the tooltip needs a live wrapper. */}
            <TooltipTrigger asChild><span className="inline-block">{trigger}</span></TooltipTrigger>
            <TooltipContent>Set up mobilization first</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Mobilization Plan</DialogTitle>
            <DialogDescription>
              Produces the executive PDF from the current plan data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="mob-prepared-by" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Prepared by
              </Label>
              <Input
                id="mob-prepared-by"
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Project Team"
              />
            </div>
            <div>
              <Label htmlFor="mob-revision" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Revision
              </Label>
              <Input
                id="mob-revision"
                value={revision}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="Rev 0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generate} data-testid="mob-generate-report-submit">
              <FileText className="size-4" /> Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Warns when the upstream Project Setup module is incomplete. Never blocks —
 *  a PM can always mobilize; the banner just makes the cost visible. */
function SetupGateBanner({ projectId }: { projectId: number | undefined }) {
  const { data: gate } = useMobilizationGate(projectId);
  if (!gate?.warnings.length) return null;
  return (
    <div
      className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"
      data-testid="mob-setup-gate-banner"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            Project Setup is not complete
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-700/90 dark:text-amber-300/90">
            {gate.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
        <Link
          href={`/executive-os/project-setup/${projectId}`}
          className="shrink-0 whitespace-nowrap text-xs font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300"
        >
          View Project Setup →
        </Link>
      </div>
    </div>
  );
}

export default function MobilizationDetail() {
  const [, params] = useRoute("/executive-os/mobilization/:id");
  const projectId = params?.id ? parseInt(params.id, 10) : undefined;
  const [tab, setTab] = useState("overview");

  const { data: project } = useProject(projectId);
  const { data: team = [] } = useTeam();
  const { data: bundle, isLoading } = useMobilization(projectId);
  const { data: health } = useMobilizationHealth(projectId);
  const seed = useSeedMobilization(projectId);

  const teamMap = new Map(team.map((m) => [m.id, m]));

  return (
    <Layout title="Mobilization">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/executive-os/mobilization" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All projects
        </Link>

        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            {health
              ? <ProgressRing value={health.overallPct} tone={health.health} />
              : <Skeleton className="size-16 rounded-full" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Rocket className="size-4 shrink-0 text-primary" />
                <h1 className="truncate font-display text-lg font-bold">{project?.name ?? "Project"}</h1>
                {health && bundle?.seeded && <HealthChip tone={health.health} />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {project?.address ?? "Mobilization readiness"}
                {health?.milestoneDaysToEarthwork !== null && health?.milestoneDaysToEarthwork !== undefined && (
                  <span className="ml-2">
                    · {health.milestoneDaysToEarthwork < 0
                      ? `Earthwork ${Math.abs(health.milestoneDaysToEarthwork)}d late`
                      : `Earthwork in ${health.milestoneDaysToEarthwork}d`}
                  </span>
                )}
              </p>
            </div>
            {projectId != null && (
              <GenerateReportDialog projectId={projectId} seeded={!!bundle?.seeded} />
            )}
          </div>
        </div>

        <SetupGateBanner projectId={projectId} />

        {isLoading || !bundle || !health ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !bundle.seeded ? (
          <EmptyState
            message="This project was created before the Mobilization module shipped, so it has no plan yet."
            action={
              <Button onClick={() => seed.mutate()} disabled={seed.isPending}>
                {seed.isPending ? "Seeding…" : "Create mobilization plan"}
              </Button>
            }
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} data-testid={`mob-tab-${t.value}`}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                plan={bundle.plan}
                signatures={bundle.signatures}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="dashboard">
              <DashboardTab health={health} />
            </TabsContent>

            <TabsContent value="checklist">
              <ChecklistTab
                items={bundle.items}
                sectionNotes={bundle.sectionNotes}
                team={team}
                projectId={projectId}
                onJumpToTab={setTab}
              />
            </TabsContent>

            <TabsContent value="permits">
              <TrackerTab
                projectId={projectId} resource="permits" rows={bundle.permits}
                fields={permitFields} addLabel="Add permit"
                emptyMessage="No permits tracked yet."
              />
            </TabsContent>

            <TabsContent value="equipment">
              <TrackerTab
                projectId={projectId} resource="equipment" rows={bundle.equipment}
                fields={equipmentFields} addLabel="Add equipment"
                emptyMessage="No equipment scheduled to mobilize yet."
              />
            </TabsContent>

            <TabsContent value="utilities">
              <TrackerTab
                projectId={projectId} resource="utilities" rows={bundle.utilities}
                fields={utilityFields} addLabel="Add utility"
                emptyMessage="No temporary utilities requested yet."
              />
            </TabsContent>

            <TabsContent value="staff">
              <div className="space-y-8">
                <section>
                  <h2 className="mb-2 font-display text-sm font-bold">Staff onboarding</h2>
                  <TrackerTab
                    projectId={projectId} resource="staff" rows={bundle.staff}
                    fields={staffFields(team, teamMap)} addLabel="Add staff"
                    emptyMessage="No staff onboarded to this project yet."
                  />
                </section>
                <section>
                  <h2 className="mb-2 font-display text-sm font-bold">Subcontractor onboarding</h2>
                  <TrackerTab
                    projectId={projectId} resource="subs" rows={bundle.subs}
                    fields={subFields} addLabel="Add subcontractor"
                    emptyMessage="No subcontractors onboarded yet."
                  />
                </section>
              </div>
            </TabsContent>

            <TabsContent value="timeline">
              <TimelineTab
                milestones={bundle.milestones}
                onSeed={() => seed.mutate()}
                seeding={seed.isPending}
                seeded={bundle.seeded}
              />
            </TabsContent>

            <TabsContent value="risks">
              <TrackerTab
                projectId={projectId} resource="risks" rows={bundle.risks}
                fields={riskFields(team, teamMap)} addLabel="Add risk"
                emptyMessage="No risks logged yet."
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
