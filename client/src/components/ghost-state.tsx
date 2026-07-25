import { Link } from "wouter";
import type { LucideIcon } from "lucide-react";
import { Plus, Inbox } from "lucide-react";

/**
 * GhostState — shown when a page has no data after a wipe or on a fresh account.
 * Shows skeleton placeholder cards + a call-to-action to create the first record.
 */
export function GhostState({
  title,
  description,
  icon: Icon = Inbox,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {ctaLabel && ctaHref && (
        <Link href={ctaHref}>
          <button className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Plus className="size-4" /> {ctaLabel}
          </button>
        </Link>
      )}
    </div>
  );
}

/** Skeleton card grid for dashboards and list pages */
export function GhostCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg border border-border bg-muted/50"
        />
      ))}
    </div>
  );
}

/** Skeleton rows for table-based pages */
export function GhostRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg border border-border bg-muted/50"
        />
      ))}
    </div>
  );
}
