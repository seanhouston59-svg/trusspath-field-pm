import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Construction } from "lucide-react";

/**
 * Executive OS module skeleton — a "coming soon" placeholder used by every
 * unshipped module (site logistics, sitework, foundations, structure,
 * envelope, MEP, drywall, finishes, elevators, landscaping, commissioning,
 * punch, closeout, warranty, safety, quality, financials, schedule, risk).
 *
 * Each module gets its own portfolio and detail route pointing at this
 * component with a distinct title/blurb. When the module ships for real,
 * the routes swap to purpose-built pages and this placeholder is retired
 * for that module.
 */
export function ExecutiveOsComingSoon({
  title,
  blurb,
  portfolioHref,
  isDetail = false,
}: {
  title: string;
  blurb: string;
  portfolioHref: string;
  isDetail?: boolean;
}) {
  return (
    <Layout title={title}>
      <div className="mx-auto max-w-3xl px-4 py-8">
        {isDetail && (
          <Link
            href={portfolioHref}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Back to {title}
          </Link>
        )}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Construction className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-dashed border-primary/30 bg-background/60 p-4 text-sm text-muted-foreground">
              This module is on the roadmap. The nav entry and routes are wired up so the shape of the Executive OS is visible end-to-end; the working surface lands in a follow-up.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
