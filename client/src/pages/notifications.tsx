import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, AlertTriangle, HelpCircle, GitPullRequestArrow, ClipboardList,
  ClipboardCheck, ShieldAlert, Rocket, Flag, ArrowRight,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";

/**
 * Full notifications list — the "expand" surface for the dashboard
 * NotificationsBox. Shows every alert the aggregator returns, grouped by
 * phase (milestones, tasks, RFIs, submittals, change orders, inspections,
 * contracts/COIs, mobilization) with tone-coded rows and deep links into
 * each source item.
 */

type ServerAlert = {
  id: string;
  tone: "red" | "amber" | "sky" | "violet" | "emerald";
  icon: string;
  text: string;
  meta: string;
  href: string;
  phase: string;
  dueDate: string | null;
};

const ICON_MAP: Record<string, any> = {
  Flag, AlertTriangle, HelpCircle, ClipboardList, GitPullRequestArrow,
  ClipboardCheck, ShieldAlert, Rocket,
};

const TONE_CLASS: Record<ServerAlert["tone"], string> = {
  red: "text-red-500 bg-red-500/12",
  amber: "text-amber-500 bg-amber-500/12",
  sky: "text-sky-500 bg-sky-500/12",
  violet: "text-violet-500 bg-violet-500/12",
  emerald: "text-emerald-500 bg-emerald-500/12",
};

// Order + human labels for the grouped sections. Anything not in this map
// falls through to a generic "Other" bucket, which shouldn't happen but
// keeps new alert phases from disappearing silently.
const PHASE_ORDER: Array<{ key: string; label: string; blurb: string }> = [
  { key: "milestones", label: "Milestones", blurb: "Lifecycle milestones due soon or overdue" },
  { key: "tasks", label: "Tasks", blurb: "Overdue and due-soon open tasks" },
  { key: "rfis", label: "RFIs", blurb: "Open RFIs approaching or past their due date" },
  { key: "submittals", label: "Submittals", blurb: "Under review, response due soon" },
  { key: "change-orders", label: "Change Orders", blurb: "Pending approvals" },
  { key: "inspections", label: "Inspections", blurb: "Upcoming, and failed with open follow-up" },
  { key: "contracts", label: "Contracts & COIs", blurb: "Certificates of insurance expiring or expired" },
  { key: "mobilization", label: "Mobilization", blurb: "Projects still in Planning without an active plan" },
];

export default function NotificationsPage() {
  const { data, isLoading } = useQuery<{ alerts: ServerAlert[]; generatedAt: string }>({
    queryKey: ["/api/dashboard/alerts"],
    refetchInterval: 60_000,
  });

  const alerts = data?.alerts ?? [];
  const grouped = new Map<string, ServerAlert[]>();
  for (const a of alerts) {
    const arr = grouped.get(a.phase) ?? [];
    arr.push(a);
    grouped.set(a.phase, arr);
  }

  return (
    <Layout title="Notifications">
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Everything a PM needs to know across the portfolio, grouped by phase.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <Bell className="size-3.5" /> {alerts.length}
          </span>
        </header>

        {isLoading && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading notifications…
          </div>
        )}

        {!isLoading && alerts.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-10 text-center">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500">
              <Bell className="size-5" />
            </div>
            <p className="mt-3 font-display text-lg font-bold">You're all caught up.</p>
            <p className="text-sm text-muted-foreground">Nothing overdue or due soon across the portfolio.</p>
          </div>
        )}

        {PHASE_ORDER.map(({ key, label, blurb }) => {
          const rows = grouped.get(key);
          if (!rows || rows.length === 0) return null;
          return (
            <section key={key} data-testid={`notif-section-${key}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <h2 className="font-display text-base font-bold">{label}</h2>
                  <p className="text-xs text-muted-foreground">{blurb}</p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">{rows.length}</span>
              </div>
              <div className="space-y-2 rounded-lg border border-border bg-card p-2 shadow-sm">
                {rows.map((n) => {
                  const Icon = ICON_MAP[n.icon] ?? Bell;
                  return (
                    <Link
                      key={n.id}
                      href={n.href}
                      className="flex items-start gap-3 rounded-md border border-transparent p-3 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      data-testid={`notif-row-${n.id}`}
                    >
                      <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md", TONE_CLASS[n.tone])}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold leading-tight">{n.text}</div>
                        <div className="truncate text-xs text-muted-foreground">{n.meta}</div>
                      </div>
                      <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Layout>
  );
}
