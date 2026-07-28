import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Rocket, ClipboardList, Ruler, ChevronRight } from "lucide-react";
import { LeanPortfolioRollup } from "@/components/executive-os/lean-portfolio-rollup";

type ModuleCard = {
  href: string;
  label: string;
  Icon: typeof Rocket;
  description: string;
  testId: string;
};

const MODULES: ModuleCard[] = [
  {
    href: "/executive-os/project-setup",
    label: "Project Setup",
    Icon: ClipboardList,
    description:
      "Charter, stakeholders, contract documents, deliverables, and kickoff \u2014 the intake step before pre-construction begins.",
    testId: "exec-os-project-setup-link",
  },
  {
    href: "/executive-os/pre-construction",
    label: "Pre-Construction",
    Icon: Ruler,
    description:
      "Design tracking, RFIs, value engineering, permits, prequalification, bid packages, and long-lead procurement \u2014 through plan approval and full buyout.",
    testId: "exec-os-pre-construction-link",
  },
  {
    href: "/executive-os/mobilization",
    label: "Mobilization",
    Icon: Rocket,
    description:
      "Readiness across every project \u2014 checklist, permits, equipment, utilities, onboarding, milestones, and risks from Notice to Proceed through the first day of earthwork.",
    testId: "exec-os-mobilization-link",
  },
];

/**
 * Executive OS \u2014 placeholder landing.
 *
 * This will host the executive-level operating surfaces (portfolio KPIs,
 * financial rollups, board packets, cross-project risk view). Contents will
 * be added in a follow-up. For now it renders a friendly \u201ccoming soon\u201d card
 * so the nav entry is not a dead link.
 */
export default function ExecutiveOs() {
  return (
    <Layout title="Executive OS">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Executive OS</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Portfolio KPIs, financial rollups, board-ready packets, and
                cross-project risk \u2014 a single command deck for the executive team.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {MODULES.map(({ href, label, Icon, description, testId }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-4 rounded-lg border border-primary/30 bg-background p-4 shadow-sm transition-colors hover:border-primary hover:bg-primary/5"
                data-testid={testId}
              >
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold">{label}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}

            <div className="rounded-md border border-dashed border-primary/30 bg-background/60 p-4 text-sm text-muted-foreground">
              More modules coming soon \u2014 financial rollups and board packets are next.
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <LeanPortfolioRollup />
        </div>
      </div>
    </Layout>
  );
}
