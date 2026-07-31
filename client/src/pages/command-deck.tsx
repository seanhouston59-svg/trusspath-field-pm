import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Rocket, ClipboardList, Ruler, DollarSign, FileText, FileSignature, ClipboardCheck, ChevronRight } from "lucide-react";
import { LeanPortfolioRollup } from "@/components/command-deck/lean-portfolio-rollup";

type ModuleCard = {
  href: string;
  label: string;
  Icon: typeof Rocket;
  description: string;
  testId: string;
};

// Ordered chronologically along the lifecycle so an executive scans the
// landing top-to-bottom the same way a project moves through Command Deck.
// Financials + Board Packets sit at the bottom because they're cross-cutting
// surfaces that aggregate the other modules, not a lifecycle stage.
const MODULES: ModuleCard[] = [
  {
    href: "/executive-os/project-setup",
    label: "Project Setup",
    Icon: ClipboardList,
    description:
      "Charter, stakeholders, contract documents, deliverables, and kickoff — the intake step before pre-construction begins.",
    testId: "exec-os-project-setup-link",
  },
  {
    href: "/executive-os/pre-construction",
    label: "Pre-Construction",
    Icon: Ruler,
    description:
      "Design tracking, RFIs, value engineering, permits, prequalification, bid packages, and long-lead procurement — through plan approval and full buyout.",
    testId: "exec-os-pre-construction-link",
  },
  {
    href: "/executive-os/mobilization",
    label: "Mobilization",
    Icon: Rocket,
    description:
      "Readiness across every project — checklist, permits, equipment, utilities, onboarding, milestones, and risks from Notice to Proceed through the first day of earthwork.",
    testId: "exec-os-mobilization-link",
  },
  {
    href: "/executive-os/contracts",
    label: "Contracts Register",
    Icon: FileSignature,
    description:
      "Owner contract, subcontracts, and vendor agreements in one register — party, scope, value, dates, insurance certs, bonds, and status across every project.",
    testId: "exec-os-contracts-link",
  },
  {
    href: "/executive-os/inspections",
    label: "Inspections",
    Icon: ClipboardCheck,
    description:
      "Every third-party and AHJ inspection across the portfolio — type, inspector, result, and follow-up items — with pass/fail rollup and open-item drill-down.",
    testId: "exec-os-inspections-link",
  },
  {
    href: "/executive-os/financials",
    label: "Financials",
    Icon: DollarSign,
    description:
      "Org-wide budget vs. committed cost, approved and pending change orders, contingency remaining, and per-project drill-down.",
    testId: "exec-os-financials-link",
  },
  {
    href: "/executive-os/board-packets",
    label: "Board Packets",
    Icon: FileText,
    description:
      "One-click PDF export that assembles portfolio health, top risks, and the financial rollup into a board-ready document.",
    testId: "exec-os-board-packets-link",
  },
];

/**
 * Command Deck landing.
 *
 * Hosts the executive-level operating surfaces: per-lifecycle-stage portfolios
 * (Project Setup, Pre-Construction, Mobilization), the cross-cutting Financials
 * rollup, and one-click Board Packet PDF export. The full 19-cell lean-module
 * strip lives below the primary cards for deeper drill-down.
 */
export default function CommandDeck() {
  return (
    <Layout title="Command Deck">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Command Deck</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Portfolio KPIs, financial rollups, board-ready packets, and
                cross-project risk — a single surface for the executive team.
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
          </CardContent>
        </Card>

        <div className="mt-6">
          <LeanPortfolioRollup />
        </div>
      </div>
    </Layout>
  );
}
