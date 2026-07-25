import { useState, useEffect, type ReactNode } from "react";
import { Bot, Building2, Mic2, Stethoscope, TriangleAlert, RotateCcw, CheckCircle2, XCircle, CreditCard, ExternalLink, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSettings, useUpdateSettings, useProjects, useHealthScan, useReseed, useWipeData, useBillingStatus, useManageBilling, type HealthReport } from "@/hooks/use-data";
import type { AppSettings } from "@shared/schema";
import { useAccess } from "@/lib/access";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function Card({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div>
        <div>
          <h2 className="font-display text-sm font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings } = useSettings();
  const { data: projects = [] } = useProjects();
  const update = useUpdateSettings();
  const scan = useHealthScan();
  const reseed = useReseed();
  const wipe = useWipeData();
  const { toast } = useToast();
  const { can } = useAccess();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [resetText, setResetText] = useState("");
  const [wipeText, setWipeText] = useState("");
  const [company, setCompany] = useState("");
  const [addr, setAddr] = useState("");

  // sync local input state once settings load from the server (defaultValue alone
  // would show fallbacks on a cold reload)
  useEffect(() => { if (settings?.companyName) setCompany(settings.companyName); }, [settings?.companyName]);
  useEffect(() => { if (settings?.addressTerm) setAddr(settings.addressTerm); }, [settings?.addressTerm]);

  const s = settings;
  const set = (patch: Partial<AppSettings>) => update.mutate(patch);

  const runScan = () => {
    scan.mutate(undefined, {
      onSuccess: (r) => { setReport(r); toast({ title: r.ok ? "App healthy" : "Issues found", description: r.summary }); },
      onError: () => toast({ title: "Scan failed", description: "Could not run the health scan.", variant: "destructive" }),
    });
  };

  return (
    <Layout title="Settings">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* AI & Voice */}
        <Card icon={Bot} title="AI & Voice" desc="Tune Jarvis's voice and persona. Changes apply immediately across the app.">
          <div className="divide-y divide-border">
            <Row label="Voice enabled" hint="Speak Jarvis's replies aloud">
              <Switch checked={s?.voiceEnabled ?? true} onCheckedChange={(v) => set({ voiceEnabled: v })} data-testid="setting-voiceEnabled" />
            </Row>
            <Row label="Auto-speak replies" hint="Read chat replies automatically when voice is on">
              <Switch checked={s?.autoSpeak ?? true} onCheckedChange={(v) => set({ autoSpeak: v })} data-testid="setting-autoSpeak" />
            </Row>
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">Voice speed</Label>
                <span className="ff-mono text-xs text-muted-foreground">{(s?.voiceRate ?? 0.97).toFixed(2)}x</span>
              </div>
              <Slider value={[s?.voiceRate ?? 0.97]} min={0.5} max={1.3} step={0.01} onValueChange={([v]) => set({ voiceRate: v })} data-testid="setting-voiceRate" />
            </div>
            <div className="py-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-sm font-medium">Voice pitch</Label>
                <span className="ff-mono text-xs text-muted-foreground">{(s?.voicePitch ?? 0.9).toFixed(2)}</span>
              </div>
              <Slider value={[s?.voicePitch ?? 0.9]} min={0} max={1.5} step={0.05} onValueChange={([v]) => set({ voicePitch: v })} data-testid="setting-voicePitch" />
            </div>
            <Row label="Address term" hint="How Jarvis addresses you">
              <Input
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                onBlur={() => set({ addressTerm: addr.trim() || "sir" })}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="h-8 w-32"
                data-testid="setting-addressTerm"
              />
            </Row>
            <Row label="Tone" hint="Concise vs detailed replies">
              <Select value={s?.tone ?? "concise"} onValueChange={(v) => set({ tone: v as "concise" | "detailed" })}>
                <SelectTrigger className="h-8 w-36" data-testid="setting-tone"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          </div>
        </Card>

        {/* Company & default project */}
        <div className="grid gap-5">
          <Card icon={Building2} title="Company" desc="Shown as the brand label in the sidebar.">
            <Row label="Company name" hint="Defaults to TrussPath">
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onBlur={() => set({ companyName: company.trim() || "TrussPath" })}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="h-8 w-44"
                data-testid="setting-companyName"
              />
            </Row>
          </Card>

          <Card icon={Mic2} title="Default project" desc="Pre-selected on the Gantt chart.">
            <Select
              value={String(s?.defaultProjectId ?? 0)}
              onValueChange={(v) => set({ defaultProjectId: parseInt(v, 10) })}
            >
              <SelectTrigger className="w-full" data-testid="setting-defaultProject"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">None (first active)</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        </div>

        {/* App Health */}
        <Card icon={Stethoscope} title="App Health Scan" desc="Jarvis checks every in-app link resolves to a registered route and that each data module loads.">
          <div className="mb-3 flex items-center gap-2">
            <Button onClick={runScan} disabled={scan.isPending} data-testid="setting-runscan" size="sm">
              <Stethoscope className="size-4" /> {scan.isPending ? "Scanning…" : "Run health scan"}
            </Button>
            {report && (
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", report.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400")}>
                {report.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                {report.ok ? "All healthy" : `${report.brokenLinks.length + report.moduleChecks.filter((c) => c.status === "fail").length} issue(s)`}
              </span>
            )}
          </div>

          {report ? (
            <div className="space-y-3" data-testid="health-report">
              <p className="text-xs text-muted-foreground">{report.summary}</p>

              {report.brokenLinks.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">Broken links</div>
                  <ul className="space-y-1">
                    {report.brokenLinks.map((l, i) => (
                      <li key={i} className="flex items-center gap-2 rounded-md bg-red-500/5 px-2 py-1 text-xs">
                        <XCircle className="size-3.5 text-red-500" />
                        <span className="font-medium">{l.label}</span>
                        <span className="ff-mono text-muted-foreground">→ {l.href}</span>
                        <span className="ml-auto text-[10px] uppercase text-muted-foreground">{l.source}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modules ({report.moduleChecks.length})</div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {report.moduleChecks.map((c) => (
                    <div key={c.name} className={cn("flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]", c.status === "ok" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")} data-testid={`health-module-${c.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {c.status === "ok" ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-red-500" />}
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{c.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No scan run yet. This checks links and data integrity — not full UI rendering. For visual QA, run a Playwright pass.</p>
          )}
        </Card>

        {/* Data */}
        <Card icon={TriangleAlert} title="Data" desc="Reset the demo dataset back to seeded sample projects, tasks, and records.">
          {can("canResetData") ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="setting-reseed-trigger"><RotateCcw className="size-4" /> Reset demo data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes every project, task, RFI, submittal, change order, photo, document and record, then re-seeds the original sample dataset. Your settings are preserved. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="reset-confirm" className="text-xs">Type <span className="ff-mono font-bold">RESET</span> to confirm</Label>
                <Input id="reset-confirm" value={resetText} onChange={(e) => setResetText(e.target.value)} className="mt-1" data-testid="setting-reseed-input" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setResetText("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={resetText !== "RESET" || reseed.isPending}
                  onClick={() => reseed.mutate(undefined, {
                    onSuccess: () => { setResetText(""); toast({ title: "Demo data reset", description: "Sample dataset re-seeded." }); },
                    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
                  })}
                  data-testid="setting-reseed-confirm"
                >
                  {reseed.isPending ? "Resetting…" : "Reset everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          ) : (
            <p className="text-xs text-muted-foreground">Resetting demo data requires Project Executive access.</p>
          )}
        </Card>

        {/* Wipe — clean slate, no re-seed */}
        <Card icon={TriangleAlert} title="Wipe All Data" desc="Permanently delete every project, task, record, and file — no re-seed. Use before going live for a clean start.">
          {can("canResetData") ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="setting-wipe-trigger"><Trash2 className="size-4" /> Wipe all data</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Wipe ALL data? This cannot be undone.</AlertDialogTitle>
                <AlertDialogDescription>
                  Every project, task, RFI, submittal, change order, photo, document, daily log, contact, team member, note, and message will be permanently deleted. Your account, settings, and subscription are preserved. The app will be empty — use this before going live with real data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-2">
                <Label htmlFor="wipe-confirm" className="text-xs">Type <span className="ff-mono font-bold">WIPE</span> to confirm</Label>
                <Input id="wipe-confirm" value={wipeText} onChange={(e) => setWipeText(e.target.value)} className="mt-1" data-testid="setting-wipe-input" />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setWipeText("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={wipeText !== "WIPE" || wipe.isPending}
                  onClick={() => wipe.mutate(undefined, {
                    onSuccess: () => { setWipeText(""); toast({ title: "All data wiped", description: "The app is now empty and ready for real data." }); },
                    onError: () => toast({ title: "Wipe failed", variant: "destructive" }),
                  })}
                  data-testid="setting-wipe-confirm"
                >
                  {wipe.isPending ? "Wiping…" : "Permanently delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          ) : (
            <p className="text-xs text-muted-foreground">Wiping data requires Project Executive access.</p>
          )}
        </Card>
      </div>
      <div className="mt-4">
        <Card icon={CreditCard} title="Billing & Subscription" desc="Manage your subscription, payment method, and invoices via Stripe.">
          <BillingSection />
        </Card>
      </div>
    </Layout>
  );
}

function BillingSection() {
  const { data: billing, isLoading } = useBillingStatus();
  const manageMut = useManageBilling();
  const { toast } = useToast();

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading billing info…</p>;

  const statusColor = billing?.status === "active" ? "text-emerald-600" : billing?.status === "past_due" ? "text-red-500" : "text-muted-foreground";
  const statusLabel = billing?.status ? billing.status.charAt(0).toUpperCase() + billing.status.slice(1) : "No subscription";

  return (
    <div className="space-y-3" data-testid="billing-section">
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
        <div>
          <div className="text-xs text-muted-foreground">Plan</div>
          <div className="font-display text-sm font-bold capitalize">{billing?.plan || "Free"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className={cn("text-sm font-semibold", statusColor)} data-testid="text-billing-status">{statusLabel}</div>
        </div>
        {billing?.currentPeriodEnd && (
          <div>
            <div className="text-xs text-muted-foreground">Renews</div>
            <div className="text-sm font-medium">{new Date(billing.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
          </div>
        )}
        {billing?.billing && (
          <div>
            <div className="text-xs text-muted-foreground">Billing</div>
            <div className="text-sm font-medium capitalize">{billing.billing}</div>
          </div>
        )}
      </div>
      {billing?.hasCustomer ? (
        <Button
          variant="outline"
          onClick={() => manageMut.mutate(undefined, {
            onError: (e: any) => toast({ title: "Failed to open billing portal", description: e?.message, variant: "destructive" }),
          })}
          disabled={manageMut.isPending}
          data-testid="button-manage-billing"
        >
          <ExternalLink className="size-4" /> {manageMut.isPending ? "Opening…" : "Manage Billing"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          No billing account yet. Subscribe from the <a href="/#pricing" className="font-semibold text-primary hover:underline">pricing page</a> to get started.
        </p>
      )}
    </div>
  );
}
