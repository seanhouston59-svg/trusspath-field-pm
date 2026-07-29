import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

import { formatCurrency } from "@/lib/format";

export type BudgetChartRow = {
  id: number;
  name: string;
  fullName: string;
  Budget: number;
  Spent: number;
  budgetRaw: number;
  spentRaw: number;
  pct: number;
};

/**
 * Clickable x-axis tick for the Budget vs Spent chart. recharts renders ticks
 * inside the chart's <svg>, so the link has to be an SVG <a> — that keeps it a
 * real anchor (focusable, keyboard-activatable, right-click-able) instead of an
 * onClick on <text>. A custom tick bypasses XAxis's own `angle`/`textAnchor`
 * props, so the rotation and the 0.71em baseline offset recharts would have
 * applied are replicated here.
 */
function ProjectAxisTick({
  rows, rotate, x, y, payload,
}: {
  rows: { id: number; name: string; fullName: string }[];
  rotate: boolean;
  x?: number;
  y?: number;
  payload?: { value?: string | number; index?: number };
}) {
  const label = String(payload?.value ?? "");
  const row =
    (payload?.index != null ? rows[payload.index] : undefined) ??
    rows.find((r) => r.name === label);
  const text = (
    <text
      dy="0.71em"
      textAnchor={rotate ? "end" : "middle"}
      transform={rotate ? "rotate(-20)" : undefined}
      style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
    >
      {label}
    </text>
  );
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      {row ? (
        <a href={`#/projects/${row.id}`} className="chart-axis-link" aria-label={`Open ${row.fullName}`}>
          {text}
        </a>
      ) : (
        text
      )}
    </g>
  );
}

export default function DashboardBudgetChart({
  data, unit, onSelectProject,
}: {
  data: BudgetChartRow[];
  unit: "M" | "K" | "";
  onSelectProject: (projectId: number) => void;
}) {
  const rotate = data.length > 4;
  return (
    <ResponsiveContainer width="100%" height="100%">
      {/* barGap: gap between Budget/Spent within a project (tight, they're a pair)
          barCategoryGap: gap BETWEEN projects (wide, so each project reads as its own group).
          45% category gap gives clear visual separation between projects. */}
      <BarChart
        data={data}
        barGap={2}
        barCategoryGap="35%"
        margin={{ top: 16, right: 8, left: -8, bottom: rotate ? 20 : 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="name"
          tick={<ProjectAxisTick rows={data} rotate={rotate} />}
          tickLine={false}
          axisLine={false}
          interval={0}
          height={rotate ? 44 : 24}
        />
        <YAxis tick={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} unit={unit} />
        <Tooltip
          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: 8, fontSize: 12 }}
          cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const row = payload[0]?.payload as BudgetChartRow | undefined;
            if (!row) return null;
            return (
              <div className="rounded-lg border border-popover-border bg-popover px-3 py-2 text-xs shadow-md">
                <div className="mb-1 font-semibold">{row.fullName}</div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-sky-500/40" />Budget</span>
                  <span className="font-mono tabular-nums">{formatCurrency(row.budgetRaw, { compact: true })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary" />Spent</span>
                  <span className="font-mono tabular-nums">{formatCurrency(row.spentRaw, { compact: true })}</span>
                </div>
                <div className="mt-1 border-t border-border pt-1 text-muted-foreground">{row.pct}% of budget used</div>
              </div>
            );
          }}
        />
        {/* Bars drill into the project. recharts hands the row back on
            the click payload, so no extra lookup is needed. */}
        <Bar
          dataKey="Budget"
          radius={[4, 4, 0, 0]}
          fill="hsl(var(--chart-2))"
          fillOpacity={0.35}
          cursor="pointer"
          onClick={(d: any) => d?.payload?.id && onSelectProject(d.payload.id)}
        />
        <Bar
          dataKey="Spent"
          radius={[4, 4, 0, 0]}
          fill="hsl(var(--chart-1))"
          cursor="pointer"
          onClick={(d: any) => d?.payload?.id && onSelectProject(d.payload.id)}
        >
          {/* Show "NN%" above each Spent bar so at-a-glance you can see
              which projects are running hot without hovering. */}
          <LabelList
            dataKey="pct"
            position="top"
            formatter={(v: number) => (v > 0 ? `${v}%` : "")}
            style={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "hsl(var(--muted-foreground))" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
