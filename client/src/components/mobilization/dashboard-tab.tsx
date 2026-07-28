import { StatTile, SectionProgressBar } from "@/components/mobilization/bits";
import { MOBILIZATION_SECTIONS } from "@shared/mobilization-catalog";
import type { MobilizationHealth } from "@/hooks/use-mobilization";

export function DashboardTab({ health }: { health: MobilizationHealth }) {
  const days = health.milestoneDaysToEarthwork;
  const daysLabel = days === null ? "—" : days < 0 ? `${Math.abs(days)}d late` : `${days}d`;
  const daysTone = days === null ? "default" : days < 0 ? "danger" : days < 3 ? "warn" : "default";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Overall" value={`${health.overallPct}%`} hint="Checklist complete" />
        <StatTile label="Earthwork" value={daysLabel} hint="Until field work begins" tone={daysTone as "default" | "warn" | "danger"} />
        <StatTile
          label="Permits"
          value={`${health.permitStatus.approved}/${health.permitStatus.total}`}
          hint={health.permitStatus.blocked > 0 ? `${health.permitStatus.blocked} blocked` : "Approved"}
          tone={health.permitStatus.blocked > 0 ? "danger" : "default"}
        />
        <StatTile label="Equipment" value={`${health.equipmentOnSitePct}%`} hint="On site" />
        <StatTile label="Utilities" value={`${health.utilitiesInstalledPct}%`} hint="Installed" />
        <StatTile
          label="Open risks" value={health.risksOpen}
          hint={health.risksOpen > 0 ? "Need mitigation" : "None open"}
          tone={health.risksOpen > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Staff onboarded" value={`${health.staffOnboardedPct}%`} hint="Orientation + drug test + PPE" />
        <StatTile label="Subs ready" value={`${health.subsReadyPct}%`} hint="Insurance + W-9 + MSA on file" />
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-display text-sm font-bold">Section progress</h3>
        <div className="space-y-2">
          {MOBILIZATION_SECTIONS.map((s) => (
            <SectionProgressBar key={s} label={s} value={health.sectionPct[s] ?? 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
