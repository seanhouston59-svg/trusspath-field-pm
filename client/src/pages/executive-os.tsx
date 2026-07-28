import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

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
      <div className="mx-auto max-w-3xl px-4 py-8">
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
          <CardContent>
            <div className="rounded-md border border-dashed border-primary/30 bg-background/60 p-4 text-sm text-muted-foreground">
              Coming soon. Modules will be added here as they\u2019re built \u2014
              start with portfolio dashboards, then financial rollups and
              board packets.
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
