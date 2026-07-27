import { Link } from "wouter";
import { ArrowLeft, Hammer } from "lucide-react";
import { Layout } from "@/components/layout";

/**
 * Placeholder for the Field pages that haven't shipped yet (timecard, photo,
 * observation, punch). Kept intentionally simple — we want the /field/* URLs
 * to resolve so the hub tiles never 404, but users see a clear "coming soon"
 * rather than a broken screen.
 */
export function FieldComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <Layout title={title}>
      <div className="mx-auto max-w-md pt-6">
        <Link href="/field" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Field
        </Link>
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Hammer className="size-7" />
          </div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{blurb}</p>
        </div>
      </div>
    </Layout>
  );
}

export const FieldPhoto = () => <FieldComingSoon title="Take photo" blurb="Camera capture with geo + timestamp burn-in. Landing in the next update." />;
export const FieldObservation = () => <FieldComingSoon title="Observation" blurb="Quick safety, RFI, or issue capture. Landing in the next update." />;
export const FieldPunch = () => <FieldComingSoon title="Punch item" blurb="Add or close a punch item from the field. Landing in the next update." />;
