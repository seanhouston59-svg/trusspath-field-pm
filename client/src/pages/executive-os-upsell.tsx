import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Copy, FileText, Layers, Lock, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentOrg, useSetMemberExecutiveOs } from "@/hooks/use-data";
import { useExecutiveOsEntitlement } from "@/hooks/use-entitlements";
import { useToast } from "@/hooks/use-toast";

const PITCH = [
  {
    icon: Layers,
    title: "Portfolio, not one project",
    body: "Every job's setup, pre-con, and mobilization status in one roll-up. Stop opening twelve projects to answer one question.",
  },
  {
    icon: BarChart3,
    title: "Cross-project analytics",
    body: "Financial roll-ups, schedule health, and gate readiness compared across the whole book of work.",
  },
  {
    icon: FileText,
    title: "Board-ready output",
    body: "Generate board packets and lifecycle reports straight from live project data — no spreadsheet assembly.",
  },
  {
    icon: ShieldCheck,
    title: "Lifecycle modules",
    body: "Track risk, contracts, inspections, and closeout against a consistent stage-gate model on every project.",
  },
];

export default function ExecutiveOsUpsellPage() {
  const { data: orgData } = useCurrentOrg();
  const { seatCount } = useExecutiveOsEntitlement();
  const setExecOs = useSetMemberExecutiveOs();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const myMembership = orgData?.membership;
  const canManage = myMembership?.role === "owner" || myMembership?.role === "admin";
  const orgName = orgData?.organization?.name;

  async function handleEnableForMe() {
    if (!myMembership) return;
    try {
      await setExecOs.mutateAsync({ id: myMembership.id, enabled: true });
      // The mutation already invalidates billing status; wait for the refetch so
      // the route gate sees the new entitlement instead of bouncing us back here.
      await qc.refetchQueries({ queryKey: ["/api/billing/status"] });
      toast({
        title: "Executive OS enabled",
        description: "$5/month was added to your subscription, prorated for this cycle.",
      });
      window.location.hash = "/executive-os";
    } catch (err: any) {
      toast({
        title: "Could not enable Executive OS",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  }

  function copyRequest() {
    const body = `Hi — could you enable the Executive OS add-on for my TrussPath seat${orgName ? ` on ${orgName}` : ""}? It's $5/user/month and I need the portfolio roll-ups. You can turn it on under Settings → Team.`;
    navigator.clipboard.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Layout title="Executive OS">
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <div>
          <Badge variant="secondary" className="gap-1.5">
            <Lock className="size-3" /> Paid add-on
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold">Executive OS</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            The portfolio layer above your projects. Built for the people who answer for all of
            them at once — not the ones running a single job.
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold">$5</span>
            <span className="text-muted-foreground">per user / month</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Added to your existing subscription and prorated immediately. Turn it off any time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PITCH.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {canManage ? (
            <>
              <h2 className="font-display text-lg font-bold">Turn it on for your seat</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You manage this org, so you can enable Executive OS for yourself right now.
                {seatCount > 0 && ` Your org has ${seatCount} seat${seatCount === 1 ? "" : "s"} enabled.`}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={handleEnableForMe} disabled={setExecOs.isPending} data-testid="button-exec-os-enable-me">
                  {setExecOs.isPending ? "Enabling…" : "Enable for me — $5/mo"}
                </Button>
                <Link href="/settings/team" className="text-sm font-medium text-primary hover:underline">
                  Manage team access →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-lg font-bold">Ask your admin to enable this</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Executive OS is granted per seat by an owner or admin on your organization.
                Copy the message below and send it their way.
              </p>
              <div className="mt-4">
                <Button variant="outline" onClick={copyRequest} data-testid="button-exec-os-copy-request">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy request message"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
