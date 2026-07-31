import { useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, DraftingCompass, FileText, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { EmptyState, SectionProgressBar } from "@/components/mobilization/bits";
import { OverviewTab } from "@/components/pre-construction/overview-tab";
import { DesignTab } from "@/components/pre-construction/design-tab";
import { PermitsTab } from "@/components/pre-construction/permits-tab";
import { PrequalTab } from "@/components/pre-construction/prequal-tab";
import { LongLeadTab } from "@/components/pre-construction/long-lead-tab";
import { SignaturesTab } from "@/components/pre-construction/signatures-tab";
import { useProject } from "@/hooks/use-data";
import {
  usePreConstruction, usePreConstructionHealth, useSeedPreConstruction,
} from "@/hooks/use-pre-construction";
import { PRE_CONSTRUCTION_STATUSES } from "@shared/pre-construction-catalog";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "design", label: "Design" },
  { value: "permits", label: "Permits" },
  { value: "prequal", label: "Prequal & Bid Packages" },
  { value: "long-lead", label: "Long-Lead Items" },
  { value: "signatures", label: "Signatures" },
];

const STATUS_LABELS: Record<string, string> =
  Object.fromEntries(PRE_CONSTRUCTION_STATUSES.map((s) => [s.value, s.label]));

const STATUS_STYLES: Record<string, string> = {
  in_progress: "bg-blue-500/12 text-blue-600 dark:text-blue-400 ring-blue-500/25",
  design_locked: "bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-amber-500/25",
  bought_out: "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-violet-500/25",
  complete: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25",
};

/** `key` is the test hook, `path` the route segment — they differ for Buyout. */
const REPORTS = [
  { key: "plan", path: "plan.pdf", label: "Pre-Construction Plan" },
  { key: "design-review", path: "design-review.pdf", label: "Design Review Report" },
  { key: "buyout-plan", path: "buyout.pdf", label: "Buyout Plan" },
] as const;

/** Each report streams from the server, so it opens in a new tab rather than
 *  going through the query client. */
function ReportButtons({ projectId, seeded }: { projectId?: number; seeded: boolean }) {
  const { account } = useAuth();
  const { toast } = useToast();

  const generate = (report: typeof REPORTS[number]) => {
    const qs = new URLSearchParams({
      preparedBy: account?.displayName || "Project Team",
      revision: "Rev 0",
    });
    window.open(
      `/api/projects/${projectId}/pre-construction/reports/${report.path}?${qs}`,
      "_blank",
    );
    toast({
      title: `Generating ${report.label}`,
      description: "Your PDF will open in a new tab.",
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {REPORTS.map((r, i) => (
        <Button
          key={r.key}
          size="sm"
          variant={i === 0 ? "default" : "outline"}
          disabled={!seeded || projectId == null}
          onClick={() => generate(r)}
          data-testid={`precon-generate-${r.key}`}
        >
          <FileText className="size-4" /> {r.label} PDF
        </Button>
      ))}
    </div>
  );
}

export default function PreConstructionDetail() {
  const [, params] = useRoute("/command-deck/pre-construction/:id");
  const projectId = params?.id ? parseInt(params.id, 10) : undefined;
  const [tab, setTab] = useState("overview");

  const { data: project } = useProject(projectId);
  const { data: bundle, isLoading } = usePreConstruction(projectId);
  const { data: health } = usePreConstructionHealth(projectId);
  const seed = useSeedPreConstruction(projectId);

  return (
    <Layout title="Pre-Construction">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/command-deck/pre-construction" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All projects
        </Link>

        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DraftingCompass className="size-4 shrink-0 text-primary" />
                <h1 className="truncate font-display text-lg font-bold">{project?.name ?? "Project"}</h1>
                {health?.seeded && (
                  <span className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                    STATUS_STYLES[health.status] ?? STATUS_STYLES.in_progress,
                  )}>
                    {STATUS_LABELS[health.status] ?? health.status}
                  </span>
                )}
                {!!health?.missingCriticalPermits.length && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-600 ring-1 ring-red-500/25 dark:text-red-400">
                    <AlertTriangle className="size-3" /> {health.missingCriticalPermits.length} critical permits missing
                  </span>
                )}
              </div>
              <div className="mt-1.5 max-w-md">
                {health ? (
                  <SectionProgressBar
                    label={`Buyout ${health.bidPackagesBoughtOut}/${health.bidPackagesTotal}`}
                    value={health.completePct}
                  />
                ) : <Skeleton className="h-4 w-64" />}
              </div>
            </div>
            <ReportButtons projectId={projectId} seeded={!!bundle?.seeded} />
          </div>
        </div>

        {isLoading || !bundle ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !bundle.seeded ? (
          <EmptyState
            message="This project was created before the Pre-Construction module shipped, so it has no pre-construction record yet."
            action={
              <Button onClick={() => seed.mutate(undefined)} disabled={seed.isPending} data-testid="precon-seed-btn">
                {seed.isPending ? "Setting up…" : "Set up this project"}
              </Button>
            }
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} data-testid={`precon-tab-${t.value}`}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab
                preCon={bundle.preCon}
                bidPackages={bundle.bidPackages}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="design">
              <DesignTab
                designDocs={bundle.designDocs}
                designRfis={bundle.designRfis}
                veItems={bundle.veItems}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="permits">
              <PermitsTab
                permits={bundle.permits}
                missingCriticalPermits={health?.missingCriticalPermits ?? []}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="prequal">
              <PrequalTab
                prequalSubs={bundle.prequalSubs}
                bidPackages={bundle.bidPackages}
                projectId={projectId}
              />
            </TabsContent>

            <TabsContent value="long-lead">
              <LongLeadTab items={bundle.longLeadItems} projectId={projectId} />
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
