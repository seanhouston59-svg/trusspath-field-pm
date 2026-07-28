import { Camera, ClipboardList, Clock, ListChecks, MapPin, MessageSquareWarning, Download, WifiOff, CheckCircle2, Maximize2, StickyNote } from "lucide-react";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { subscribeQueue } from "@/lib/offline-queue";
import { subscribeInstallPrompt, triggerInstall, isStandalone, isIos } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFieldMode } from "@/hooks/use-field-mode";

/**
 * Field hub — the one-stop landing for foremen once they open TrussPath on
 * their phone. Big tap targets, no small text, always-visible offline status
 * and queue count. Every card links to a task-specific page that also works
 * without network via the offline queue.
 */

type Tile = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  accent: string;
};

const TILES: Tile[] = [
  { href: "/field/daily-log", label: "Daily log", icon: ClipboardList, hint: "Weather · crew · what got done", accent: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400" },
  { href: "/field/timecard", label: "Timecard", icon: Clock, hint: "Clock in or out", accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400" },
  { href: "/field/photo", label: "Take photo", icon: Camera, hint: "Geo + timestamp", accent: "from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400" },
  { href: "/field/observation", label: "Observation", icon: MessageSquareWarning, hint: "Safety · RFI · issue", accent: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400" },
  { href: "/field/punch", label: "Punch item", icon: ListChecks, hint: "Add or close a task", accent: "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400" },
  // Opens the shared corkboard at /notes — quick reminders, hand-offs
  // between shifts, or a spot to pin a photo caption before you forget.
  { href: "/notes", label: "Sticky notes", icon: StickyNote, hint: "Jot a reminder · corkboard", accent: "from-yellow-500/20 to-yellow-500/5 text-yellow-700 dark:text-yellow-400" },
];

export default function FieldHub() {
  const [queueSize, setQueueSize] = useState(0);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());
  const ios = isIos();
  const fieldMode = useFieldMode();

  useEffect(() => subscribeQueue(setQueueSize), []);
  useEffect(() => subscribeInstallPrompt(setInstallAvailable), []);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const handleInstall = async () => {
    const accepted = await triggerInstall();
    if (accepted) setInstalled(true);
  };

  return (
    <Layout title="Field">
      <div className="mx-auto max-w-2xl">
        {/* Status strip — offline / queue / install */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              online ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
            data-testid="field-status-online"
          >
            {online ? <CheckCircle2 className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? "Online" : "Offline — entries queued"}
          </span>
          {queueSize > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400" data-testid="field-queue-badge">
              {queueSize} pending
            </span>
          )}
          {!installed && installAvailable && (
            <Button size="sm" variant="secondary" onClick={handleInstall} data-testid="field-install-cta" className="ml-auto">
              <Download className="size-4" /> Install app
            </Button>
          )}
          {!installed && !installAvailable && ios && (
            <span className="ml-auto text-xs text-muted-foreground">Tap Share → Add to Home Screen to install</span>
          )}
          {installed && !fieldMode.enabled && (
            <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400" data-testid="field-installed-badge">
              <CheckCircle2 className="inline size-3.5 mr-1" /> Installed
            </span>
          )}
          {!fieldMode.enabled && (
            <Button
              size="sm"
              variant="outline"
              onClick={fieldMode.enter}
              data-testid="field-mode-enter"
              className={installed || (!installAvailable && !ios) ? "" : "ml-auto"}
            >
              <Maximize2 className="size-4" /> Field mode
            </Button>
          )}
        </div>

        <h1 className="mb-1 font-display text-3xl font-bold tracking-tight">Field</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Everything you need on-site. Works offline — anything you enter without signal will sync as soon as you're back.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                data-testid={`field-tile-${t.href.split("/").pop()}`}
                className={cn(
                  "group relative flex min-h-[7rem] flex-col justify-between rounded-2xl border border-border bg-gradient-to-br p-5 transition-all",
                  "hover:border-primary/60 hover:shadow-lg active:scale-[0.98]",
                  t.accent,
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn("grid size-11 place-items-center rounded-xl bg-background/70 backdrop-blur")}>
                    <Icon className="size-6" />
                  </div>
                </div>
                <div>
                  <div className="font-display text-lg font-bold leading-tight text-foreground">{t.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.hint}</div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/30 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-primary" /> Working from a dead zone?
          </div>
          <p className="text-xs text-muted-foreground">
            Every field entry saves locally first. When you reconnect (Wi-Fi in the truck, back at the yard), TrussPath sends everything automatically. Nothing is lost.
          </p>
        </div>
      </div>
    </Layout>
  );
}
