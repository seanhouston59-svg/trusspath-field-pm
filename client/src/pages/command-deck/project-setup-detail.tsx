import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ClipboardList, FileText, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, SectionProgressBar } from "@/components/mobilization/bits";
import { OverviewTab } from "@/components/project-setup/overview-tab";
import { StakeholdersTab } from "@/components/project-setup/stakeholders-tab";
import { ContractDocsTab } from "@/components/project-setup/contract-docs-tab";
import { DeliverablesTab } from "@/components/project-setup/deliverables-tab";
import { SignaturesTab } from "@/components/project-setup/signatures-tab";
import { useProject } from "@/hooks/use-data";
import {
  useProjectSetup, useProjectSetupHealth, useSeedProjectSetup,
} from "@/hooks/use-project-setup";
import { PROJECT_SETUP_STATUSES } from "@shared/project-setup-catalog";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "stakeholders", label: "Stakeholders" },
  { value: "contract-docs", label: "Contract Documents" },
  { value: "deliverables", label: "Deliverables & Kickoff" },
  { value: "signatures", label: "Signatures" },
];

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(PROJECT_SETUP_STATUSES.map((s) => [s.value, s.label]));

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  ready_for_kickoff: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  kicked_off: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
};

type ReportKind = "charter" | "kickoff-agenda";

const REPORT_META: Record<ReportKind, { title: string; path: string; blurb: string }> = {
  charter: {
    title: "Project Charter",
    path: "charter",
    blurb: "The CEO-facing charter — identity, financials, directory, standards, and the sign-off block.",
  },
  "kickoff-agenda": {
    title: "Kickoff Meeting Agenda",
    path: "kickoff-agenda",
    blurb: "The agenda before the meeting. Fill in decisions and action items and it regenerates as minutes.",
  },
};

function GenerateReportDialog({ projectId, kind, seeded }: {
  projectId: number; kind: ReportKind; seeded: boolean;
}) {
  const meta = REPORT_META[kind];
  const { account } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [rev, setRev] = useState("");

  const generate = () => {
    const qs = new URLSearchParams({
      preparedBy: preparedBy.trim() || account?.displayName || "Project Team",
      rev: rev.trim() || "Rev 0",
    });
    window.open(`/api/projects/${projectId}/project-setup/report/${meta.path}?${qs}`, "_blank");
    setOpen(false);
    toast({ title: `Generating ${meta.title}`, description: "Your PDF will download in a new tab." });
  };

  return (
    <>
      <Button
        size="sm"
        variant={kind === "charter" ? "default" : "outline"}
        disabled={!seeded}
        onClick={() => { setPreparedBy(account?.displayName || ""); setOpen(true); }}
        data-testid={`setup-generate-${meta.path}`}
      >
        <FileText className="size-4" /> {meta.title} PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {meta.title}</DialogTitle>
            <DialogDescription>{meta.blurb}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`setup-prepared-by-${meta.path}`} className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Prepared by
              </Label>
              <Input
                id={`setup-prepared-by-${meta.path}`}
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Project Team"
              />
            </div>
            <div>
              <Label htmlFor={`setup-rev-${meta.path}`} className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Revision
              </Label>
              <Input
                id={`setup-rev-${meta.path}`}
                value={rev}
                onChange={(e) => setRev(e.target.value)}
                placeholder="Rev 0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={generate} data-testid={`setup-generate-${meta.path}-submit`}>
              <FileText className="size-4" /> Generate PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ProjectSetupDetail() {
  const [, params] = useRoute("/command-deck/project-setup/:id");
  const projectId = params?.id ? parseInt(params.id, 10) : undefined;
  const [tab, setTab] = useState("overview");

  const { data: project } = useProject(projectId);
  const { data: bundle, isLoading } = useProjectSetup(projectId);
  const { data: health } = useProjectSetupHealth(projectId);
  const seed = useSeedProjectSetup(projectId);

  return (
    <Layout title="Project Setup">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/command-deck/project-setup" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All projects
        </Link>

        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList className="size-4 shrink-0 text-primary" />
                <h1 className="truncate font-display text-lg font-bold">{project?.name ?? "Project"}</h1>
                {health?.seeded && (
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                    STATUS_STYLES[health.status] ?? STATUS_STYLES.in_progress,
                  )}>
                    {STATUS_LABELS[health.status] ?? health.status}
                  </span>
                )}
                {!!health?.missingCritical.length && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400">
                    <AlertTriangle className="size-3" /> {health.missingCritical.length} critical missing
                  </span>
                )}
              </div>
              <div className="mt-1.5 max-w-md">
                {health ? (
                  <SectionProgressBar
                    label={`Deliverables ${health.deliverablesComplete}/${health.deliverablesTotal}`}
                    value={health.completePct}
                  />
                ) : <Skeleton className="h-4 w-64" />}
              </div>
            </div>
            {projectId != null && (
              <div className="flex flex-wrap gap-2">
                <GenerateReportDialog projectId={projectId} kind="charter" seeded={!!bundle?.seeded} />
                <GenerateReportDialog projectId={projectId} kind="kickoff-agenda" seeded={!!bundle?.seeded} />
              </div>
            )}
          </div>
        </div>

        {isLoading || !bundle ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !bundle.seeded ? (
          <EmptyState
            message="This project was created before the Project Setup module shipped, so it has no setup record yet."
            action={
              <Button onClick={() => seed.mutate(undefined)} disabled={seed.isPending} data-testid="setup-seed-btn">
                {seed.isPending ? "Setting up…" : "Set up this project"}
              </Button>
            }
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} data-testid={`setup-tab-${t.value}`}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab setup={bundle.setup} projectId={projectId} />
            </TabsContent>

            <TabsContent value="stakeholders">
              <StakeholdersTab stakeholders={bundle.stakeholders} projectId={projectId} />
            </TabsContent>

            <TabsContent value="contract-docs">
              <ContractDocsTab
                contractDocs={bundle.contractDocs}
                deliverables={bundle.deliverables}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="deliverables">
              <DeliverablesTab
                setup={bundle.setup}
                deliverables={bundle.deliverables}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="signatures">
              <SignaturesTab signatures={bundle.signatures} projectId={projectId} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
