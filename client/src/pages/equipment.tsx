import { useMemo, useState } from "react";
import { Plus, Wrench, MapPin, User, Car, Smartphone, Laptop, Tablet, HardHat, ChevronDown, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout";
import { EquipmentStatusBadge } from "@/components/bits";
import { CreateEntityDialog, type FieldDef } from "@/components/create-entity-dialog";
import { EquipmentDetailSheet } from "@/components/equipment-detail-sheet";
import { useEquipment, useProjects, useCreateEquipment, useTeam } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { googleMapsUrlForLocation } from "@/lib/maps";
import { cn } from "@/lib/utils";
import type { Equipment } from "@shared/schema";

const TYPE_ICON: Record<string, string> = {
  Crane: "🏗️", Excavator: "⛏️", "Skid Steer": "🚜", Lift: "🛗", Pump: "🚿",
  Truck: "🛻", Van: "🚐", Car: "🚗", Trailer: "🚚",
};

type AssetClass = "Equipment" | "Vehicle" | "Tech";
const CLASSES: { value: AssetClass; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "Equipment", label: "Equipment", icon: HardHat },
  { value: "Vehicle", label: "Vehicles", icon: Car },
  { value: "Tech", label: "Tech", icon: Smartphone },
];

const TECH_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone: Smartphone,
  Tablet: Tablet,
  Computer: Laptop,
};

export default function EquipmentPage() {
  const { data: items = [], isLoading } = useEquipment();
  const { data: projects = [] } = useProjects();
  const { data: teamList = [] } = useTeam();
  const create = useCreateEquipment();

  const projName = (id: number | null | undefined) => projects.find((p) => p.id === id)?.name ?? "Fleet yard";
  const projAddress = (id: number | null | undefined) => projects.find((p) => p.id === id)?.address ?? "";
  const teamName = (id: number | null | undefined) => teamList.find((t) => t.id === id)?.name ?? null;

  const projectOptions = [{ value: "0", label: "Fleet yard" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))];
  const teamOptions = [{ value: "0", label: "— Unassigned —" }, ...teamList.map((m) => ({ value: String(m.id), label: m.name }))];

  const [filter, setFilter] = useState<"All" | AssetClass>("All");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openClass, setOpenClass] = useState<AssetClass | null>(null);
  const [selected, setSelected] = useState<Equipment | null>(null);

  // Bucket items by asset class. Legacy rows without an assetClass value
  // default to "Equipment" so nothing gets orphaned.
  const filtered = useMemo(() => {
    if (filter === "All") return items;
    return items.filter((e) => (e.assetClass ?? "Equipment") === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: items.length, Equipment: 0, Vehicle: 0, Tech: 0 };
    for (const e of items) {
      const k = (e.assetClass ?? "Equipment") as AssetClass;
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const equipmentFields: FieldDef[] = [
    { name: "name", label: "Equipment name", type: "text", required: true, placeholder: "Link-Belt 80T Crane #1" },
    { name: "type", label: "Type", type: "select", options: ["Crane", "Excavator", "Skid Steer", "Lift", "Pump"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["On Site", "In Maintenance", "Off Site"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "projectId", label: "Assigned to", type: "select", options: projectOptions, half: true },
    { name: "operator", label: "Operator", type: "text", half: true, placeholder: "T. Bradshaw" },
    { name: "location", label: "Location", type: "text", half: true, placeholder: "North pad" },
    { name: "currentMileage", label: "Current hours/miles", type: "number", half: true },
    { name: "nextServiceDate", label: "Next service due", type: "date", half: true },
  ];

  const vehicleFields: FieldDef[] = [
    { name: "name", label: "Vehicle name / #", type: "text", required: true, placeholder: "Truck 7 — F-250" },
    { name: "type", label: "Vehicle type", type: "select", options: ["Truck", "Van", "Car", "Trailer"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["On Site", "In Maintenance", "Off Site"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "make", label: "Make", type: "text", half: true, placeholder: "Ford" },
    { name: "model", label: "Model", type: "text", half: true, placeholder: "F-250" },
    { name: "year", label: "Year", type: "text", half: true, placeholder: "2024" },
    { name: "plate", label: "License plate", type: "text", half: true },
    { name: "vin", label: "VIN", type: "text" },
    { name: "assignedToId", label: "Driver", type: "select", options: teamOptions, half: true },
    { name: "projectId", label: "Assigned to project", type: "select", options: projectOptions, half: true },
    { name: "currentMileage", label: "Current mileage", type: "number", half: true },
    { name: "nextServiceDate", label: "Next service due", type: "date", half: true },
    { name: "nextServiceMileage", label: "Next service mileage", type: "number", half: true },
    { name: "location", label: "Current location", type: "text", half: true },
  ];

  const techFields: FieldDef[] = [
    { name: "type", label: "Device type", type: "select", options: ["Phone", "Tablet", "Computer", "Other"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "status", label: "Status", type: "select", options: ["On Site", "In Maintenance", "Off Site"].map((v) => ({ value: v, label: v })), required: true, half: true },
    { name: "name", label: "Device name / label", type: "text", required: true, placeholder: 'iPhone 15 Pro — "Field foreman phone"' },
    { name: "make", label: "Make", type: "text", half: true, placeholder: "Apple" },
    { name: "model", label: "Model", type: "text", half: true, placeholder: "iPhone 15 Pro" },
    { name: "serialNumber", label: "Serial / IMEI / asset tag", type: "text" },
    { name: "assignedToId", label: "Assigned to", type: "select", options: teamOptions, half: true },
    { name: "condition", label: "Condition", type: "select", options: ["New", "Good", "Fair", "Poor", "Lost"].map((v) => ({ value: v, label: v })), half: true },
    { name: "issueDate", label: "Issue date", type: "date", half: true },
    { name: "purchaseDate", label: "Purchase date", type: "date", half: true },
    { name: "purchaseCost", label: "Purchase cost", type: "text", half: true, placeholder: "$1,299" },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  const fields = openClass === "Vehicle" ? vehicleFields : openClass === "Tech" ? techFields : equipmentFields;
  const dialogTitle = openClass === "Vehicle" ? "New Vehicle" : openClass === "Tech" ? "New Tech Asset" : "New Equipment";
  const submitLabel = openClass === "Vehicle" ? "Add Vehicle" : openClass === "Tech" ? "Add Tech" : "Add Equipment";
  const defaults: Record<string, string | number> =
    openClass === "Vehicle"
      ? { type: "Truck", status: "On Site", projectId: "0", assignedToId: "0" }
      : openClass === "Tech"
      ? { type: "Phone", status: "On Site", condition: "Good", assignedToId: "0" }
      : { type: "Crane", status: "On Site", projectId: "0" };

  return (
    <Layout
      title="Fleet & Assets"
      actions={
        <div className="relative">
          <Button size="sm" onClick={() => setPickerOpen((s) => !s)} data-testid="button-new-asset">
            <Plus className="size-4" /> Add
            <ChevronDown className="ml-1 size-3.5" />
          </Button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-lg" data-testid="picker-asset-class">
                {CLASSES.map((c) => (
                  <button
                    key={c.value}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onClick={() => { setPickerOpen(false); setOpenClass(c.value); }}
                    data-testid={`picker-add-${c.value.toLowerCase()}`}
                  >
                    <c.icon className="size-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{c.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.value === "Equipment" ? "Cranes, excavators, lifts, pumps" : c.value === "Vehicle" ? "Trucks, vans, trailers" : "Phones, tablets, computers"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      }
    >
      <CreateEntityDialog
        open={openClass !== null}
        onOpenChange={(o) => { if (!o) setOpenClass(null); }}
        title={dialogTitle}
        fields={fields}
        defaults={defaults}
        submitLabel={submitLabel}
        isPending={create.isPending}
        onSubmit={async (v) => {
          const cls = openClass ?? "Equipment";
          const num = (k: string): number | null => {
            const raw = v[k];
            if (raw === "" || raw === undefined || raw === null) return null;
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
          };
          const str = (k: string) => (v[k] === "" || v[k] === undefined ? null : String(v[k]));
          const projectIdRaw = v.projectId;
          const assigneeRaw = v.assignedToId;
          await create.mutateAsync({
            name: String(v.name || ""),
            type: String(v.type || ""),
            status: String(v.status || "On Site"),
            projectId: projectIdRaw === "0" || projectIdRaw === undefined ? null : Number(projectIdRaw),
            operator: str("operator"),
            location: str("location"),
            assetClass: cls,
            make: str("make"),
            model: str("model"),
            year: str("year"),
            vin: str("vin"),
            plate: str("plate"),
            currentMileage: num("currentMileage"),
            nextServiceDate: str("nextServiceDate"),
            nextServiceMileage: num("nextServiceMileage"),
            assignedToId: assigneeRaw === "0" || assigneeRaw === undefined ? null : Number(assigneeRaw),
            issueDate: str("issueDate"),
            returnedDate: null,
            returnSignature: null,
            condition: str("condition"),
            serialNumber: str("serialNumber"),
            purchaseDate: str("purchaseDate"),
            purchaseCost: str("purchaseCost"),
            notes: str("notes"),
          } as any);
        }}
      />

      {/* Filter chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["All", "Equipment", "Vehicle", "Tech"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
            data-testid={`filter-${f.toLowerCase()}`}
          >
            {f === "All" ? "All" : f === "Vehicle" ? "Vehicles" : f}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-lg border border-border bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            {filter === "Vehicle" ? <Car className="size-6" /> : filter === "Tech" ? <Smartphone className="size-6" /> : <HardHat className="size-6" />}
          </div>
          <h3 className="font-display text-lg font-bold">Nothing here yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add your first {filter === "All" ? "asset" : filter.toLowerCase()} to get started.</p>
          <div className="mt-4">
            <Button size="sm" onClick={() => setOpenClass(filter === "All" ? "Equipment" : (filter as AssetClass))} data-testid="button-add-empty">
              <Plus className="size-4" /> Add {filter === "All" ? "Equipment" : filter}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <AssetCard
              key={e.id}
              item={e}
              projName={projName}
              projAddress={projAddress}
              teamName={teamName}
              onClick={() => setSelected(e)}
            />
          ))}
        </div>
      )}

      <EquipmentDetailSheet
        item={selected}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
        projects={projects}
        team={teamList}
      />
    </Layout>
  );
}

function AssetCard({
  item, projName, projAddress, teamName, onClick,
}: {
  item: Equipment;
  projName: (id: number | null | undefined) => string;
  projAddress: (id: number | null | undefined) => string;
  teamName: (id: number | null | undefined) => string | null;
  onClick: () => void;
}) {
  const cls = (item.assetClass ?? "Equipment") as AssetClass;
  const isVehicle = cls === "Vehicle";
  const isTech = cls === "Tech";

  // Overdue if nextServiceDate < today, or nextServiceMileage <= currentMileage.
  const today = new Date().toISOString().slice(0, 10);
  const dueByDate = !!item.nextServiceDate && item.nextServiceDate <= today;
  const dueByMiles = !!(item.nextServiceMileage && item.currentMileage != null && item.currentMileage >= item.nextServiceMileage);
  const dueSoon = !dueByDate && !!item.nextServiceDate && (() => {
    const t = new Date(today);
    const d = new Date(item.nextServiceDate!);
    const days = (d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 14;
  })();
  const overdue = dueByDate || dueByMiles;

  const iconNode = isTech ? (() => {
    const Icon = TECH_ICON[item.type] ?? Smartphone;
    return <Icon className="size-5 text-muted-foreground" />;
  })() : isVehicle ? (
    <span className="text-lg">{TYPE_ICON[item.type] ?? "🚗"}</span>
  ) : (
    <span className="text-lg">{TYPE_ICON[item.type] ?? "🔧"}</span>
  );

  const driver = teamName(item.assignedToId);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary/40"
      data-testid={`card-eq-${item.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-md bg-muted">{iconNode}</span>
          <div>
            <div className="font-display text-sm font-bold leading-tight">{item.name}</div>
            <div className="text-xs text-muted-foreground">
              {isVehicle && [item.year, item.make, item.model].filter(Boolean).join(" ") || item.type}
              {isVehicle && item.plate && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{item.plate}</span>}
            </div>
          </div>
        </div>
        <EquipmentStatusBadge status={item.status} />
      </div>

      <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {isTech ? (
          <>
            <div className="flex items-center gap-2"><User className="size-3.5" /> Issued to: {driver ?? "—"}</div>
            {item.condition && <div className="flex items-center gap-2">🎯 Condition: {item.condition}</div>}
            {item.serialNumber && <div className="flex items-center gap-2 font-mono text-[10px]">SN: {item.serialNumber}</div>}
            {item.issueDate && <div className="flex items-center gap-2">📅 Issued {item.issueDate}</div>}
            {item.returnedDate && <div className="flex items-center gap-2 text-emerald-700">↩ Returned {item.returnedDate}</div>}
          </>
        ) : (
          <>
            {(() => {
              const href = googleMapsUrlForLocation(item.location, projAddress(item.projectId));
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`link-map-eq-${item.id}`}
                >
                  <MapPin className="size-3.5 shrink-0" /> {item.location ?? "—"}
                </a>
              ) : (
                <div className="flex items-center gap-2"><MapPin className="size-3.5" /> {item.location ?? "—"}</div>
              );
            })()}
            {isVehicle ? (
              <div className="flex items-center gap-2"><User className="size-3.5" /> Driver: {driver ?? item.operator ?? "—"}</div>
            ) : (
              <div className="flex items-center gap-2"><User className="size-3.5" /> Operator: {item.operator ?? "—"}</div>
            )}
            <div className="flex items-center gap-2"><span className="size-3.5">📁</span> {projName(item.projectId ?? null)}</div>
            {item.currentMileage != null && (
              <div className="flex items-center gap-2">
                <span className="size-3.5">🛞</span>
                {isVehicle ? `${item.currentMileage.toLocaleString()} mi` : `${item.currentMileage.toLocaleString()} hrs`}
              </div>
            )}
            {(overdue || dueSoon) && (
              <div className={cn("mt-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
                overdue ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300")}>
                <AlertTriangle className="size-3" />
                {overdue ? "Service overdue" : "Service due soon"}
                {item.nextServiceDate && <span className="ml-1 opacity-80">· {item.nextServiceDate}</span>}
              </div>
            )}
          </>
        )}
      </div>
    </button>
  );
}
