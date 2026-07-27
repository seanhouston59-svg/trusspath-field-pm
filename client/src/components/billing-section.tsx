import { CreditCard, ExternalLink, FileText, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useBillingStatus,
  useCurrentOrg,
  useInvoices,
  useManageBilling,
  useUpcomingInvoice,
} from "@/hooks/use-data";

// Billing section for /settings/team. Owner-only surface with:
// - Current plan + trial/cancel state
// - Seat usage vs plan-included seats
// - Next-charge preview from Stripe (upcoming invoice)
// - Recent invoice history with hosted receipt + PDF links
// - Manage-in-Stripe CTA (portal handles plan change, payment methods, cancel)
export function BillingSection() {
  const { data: orgData } = useCurrentOrg();
  const { data: statusData } = useBillingStatus();
  const invoicesQ = useInvoices();
  const upcomingQ = useUpcomingInvoice();
  const openPortal = useManageBilling();

  const org = orgData?.organization;
  const seats = orgData?.seats;
  const status = statusData || null;
  const invoices = invoicesQ.data?.invoices || [];
  const upcoming = upcomingQ.data?.upcoming || null;

  const planName = status?.plan
    ? status.plan.charAt(0).toUpperCase() + status.plan.slice(1)
    : "—";
  const billingCadence = status?.billing === "annual" ? "Annual" : status?.billing === "monthly" ? "Monthly" : null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <CreditCard className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold">Billing</h2>
            <p className="text-xs text-muted-foreground">Plan, seats, invoices, and payment method.</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openPortal.mutate()}
          disabled={openPortal.isPending}
          data-testid="button-manage-billing"
        >
          {openPortal.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <ExternalLink className="mr-1.5 size-3.5" />}
          Manage in Stripe
        </Button>
      </div>

      {/* Plan summary tiles */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-display text-base font-bold">{planName}</span>
            {billingCadence && <Badge variant="outline" className="text-[10px]">{billingCadence}</Badge>}
          </div>
          <StatusBadge status={status?.status || null} cancelAtPeriodEnd={!!status?.cancelAtPeriodEnd} />
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-xs text-muted-foreground">Seats</div>
          <div className="mt-0.5 font-display text-base font-bold">
            {seats ? seats.active : "—"}
            {seats?.included !== null && seats?.included !== undefined && (
              <span className="text-xs font-normal text-muted-foreground"> / {seats.included} included</span>
            )}
          </div>
          {seats && seats.overage !== null && seats.overage > 0 && (
            <div className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
              +{seats.overage} paid overage seat{seats.overage === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="text-xs text-muted-foreground">Next charge</div>
          {upcomingQ.isLoading ? (
            <div className="mt-1 text-xs text-muted-foreground">Loading…</div>
          ) : upcoming ? (
            <>
              <div className="mt-0.5 font-display text-base font-bold">{fmtMoney(upcoming.amountDue, upcoming.currency)}</div>
              <div className="text-[11px] text-muted-foreground">
                {upcoming.nextPaymentAttempt ? `on ${fmtDate(upcoming.nextPaymentAttempt)}` : upcoming.periodEnd ? `~ ${fmtDate(upcoming.periodEnd)}` : ""}
              </div>
            </>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">No upcoming charge</div>
          )}
        </div>
      </div>

      {/* Invoice history */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Invoice history</h3>
        </div>
        {invoicesQ.isLoading ? (
          <div className="rounded-lg border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-xs text-muted-foreground">
            {org?.subscriptionStatus === "trialing"
              ? "You're in a free trial — the first invoice will show up after your trial ends."
              : "No invoices yet."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Amount</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border/40" data-testid={`invoice-row-${inv.id}`}>
                    <td className="px-3 py-2 text-xs">{fmtDate(inv.created)}</td>
                    <td className="px-3 py-2 text-xs font-medium">{fmtMoney(inv.amountPaid || inv.amountDue, inv.currency)}</td>
                    <td className="px-3 py-2">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex gap-2">
                        {inv.hostedInvoiceUrl && (
                          <a
                            href={inv.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                            data-testid={`link-invoice-hosted-${inv.id}`}
                          >
                            View
                          </a>
                        )}
                        {inv.invoicePdf && (
                          <a
                            href={inv.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            data-testid={`link-invoice-pdf-${inv.id}`}
                          >
                            <FileText className="size-3" /> PDF
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        Seat count auto-syncs with Stripe when teammates are invited or removed. Plan swaps, payment method updates, and cancellations happen in the Stripe portal.
      </p>
    </section>
  );
}

function StatusBadge({ status, cancelAtPeriodEnd }: { status: string | null; cancelAtPeriodEnd: boolean }) {
  if (!status) return null;
  const label = cancelAtPeriodEnd ? "Canceling at period end" : status.replace(/_/g, " ");
  const color = cancelAtPeriodEnd
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    : status === "active"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "trialing"
        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
        : status === "past_due" || status === "unpaid"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return <span className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>{label}</span>;
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    status === "paid"
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : status === "open"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : status === "uncollectible" || status === "void"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${color}`}>{status}</span>;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function fmtMoney(amount: number, currency: string): string {
  if (typeof amount !== "number") return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase(), minimumFractionDigits: 2 }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}
