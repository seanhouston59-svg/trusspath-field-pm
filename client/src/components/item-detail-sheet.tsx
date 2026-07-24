import { type ReactNode } from "react";
import { MapPin } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { googleMapsUrlForLocation } from "@/lib/maps";

/**
 * Generic detail sheet for workflow items. Renders a side panel with:
 * - Header (title, number/subtitle, optional badges)
 * - Field rows (label + value pairs)
 * - Status dropdown wired to the caller's mutate function
 */

export type DetailField = {
  label: string;
  value: ReactNode;
  full?: boolean; // span full width instead of two columns
  mono?: boolean;
  /**
   * When set, render this field as a Google Maps link. The link combines the
   * field's own text with the supplied project address (e.g. "Level 4 room 12,
   * 1820 Healing Way, Denver, CO"), which makes area descriptors like
   * "Kitchen backsplash" navigable.
   */
  mapAddress?: string | null;
};

export function ItemDetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  eyebrow,
  headerRight,
  fields,
  currentStatus,
  statusOptions,
  onStatusChange,
  isStatusPending,
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  headerRight?: ReactNode;
  fields: DetailField[];
  currentStatus?: string;
  statusOptions?: string[];
  onStatusChange?: (status: string) => void;
  isStatusPending?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="item-detail-sheet">
        <SheetHeader className="text-left">
          {eyebrow && (
            <div className="mb-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base leading-snug">{title}</SheetTitle>
              {subtitle && <SheetDescription className="mt-0.5">{subtitle}</SheetDescription>}
            </div>
            {headerRight && <div className="shrink-0">{headerRight}</div>}
          </div>
        </SheetHeader>

        {statusOptions && currentStatus && onStatusChange && (
          <div className="mt-5 space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</div>
            <Select value={currentStatus} onValueChange={onStatusChange} disabled={isStatusPending}>
              <SelectTrigger className="h-9" data-testid="detail-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4">
          {fields.map((f, i) => {
            const locText = typeof f.value === "string" ? f.value : "";
            const mapsHref = f.mapAddress !== undefined
              ? googleMapsUrlForLocation(locText, f.mapAddress)
              : null;
            return (
              <div key={i} className={cn(f.full && "col-span-2")}>
                <dt className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {f.label}
                </dt>
                <dd className={cn("text-sm", f.mono && "font-mono tabular-nums")}>
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                      data-testid={`link-maps-${f.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <MapPin className="size-3.5 shrink-0" />
                      <span>{f.value}</span>
                    </a>
                  ) : f.value ? (
                    f.value
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        {footer && <div className="mt-6 border-t border-border pt-5">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
