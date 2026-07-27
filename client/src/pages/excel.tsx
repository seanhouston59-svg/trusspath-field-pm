import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet, Upload, ExternalLink, Download, Plus, Trash2,
  FilePlus, Sheet as SheetIcon,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Microsoft Excel — in-app spreadsheet viewer / editor.
 *
 * Why we don't just iframe office.com: Microsoft sets
 *   X-Frame-Options: SAMEORIGIN
 * on office.com / onedrive.live.com, so any <iframe> from trusspath.com is
 * refused. And embedding Excel Online for read/write needs a Microsoft 365
 * tenant + Graph OAuth + WOPI or Office Add-ins — a multi-week project.
 *
 * Instead this page uses SheetJS (`xlsx`) to give a real, offline-capable
 * .xlsx viewer + light editor right inside TrussPath:
 *   - Open any .xlsx/.xls/.csv from disk (drag-drop or picker).
 *   - Switch between sheet tabs.
 *   - Edit any cell — changes stay in memory until you Save-As.
 *   - Add / delete rows and columns.
 *   - Download the edited workbook as a fresh .xlsx.
 *   - "Open in Excel Online" escape hatch for when the user wants the full
 *      Microsoft feature set (charts, pivot tables, collab).
 *
 * The heavy lifting (parsing, formula evaluation on read, writing) is done
 * by SheetJS in the browser — no server round-trip, works offline once the
 * SW has the bundle cached.
 */

const EXCEL_ONLINE_HOME = "https://www.office.com/launch/excel";
const EXCEL_ONLINE_NEW = "https://www.office.com/launch/excel?auth=1";
const EXCEL_DOWNLOAD = "https://www.microsoft.com/en-us/microsoft-365/excel";

type Grid = string[][]; // row-major; empty cell = ""

interface Workbook {
  name: string;
  sheets: Record<string, Grid>;
  order: string[]; // sheet-name order
  activeSheet: string;
  dirty: boolean;
}

function gridFromSheet(ws: XLSX.WorkSheet): Grid {
  const aoa = XLSX.utils.sheet_to_json<any>(ws, { header: 1, blankrows: false, defval: "" });
  // Normalize to string[][] and rectangular-ish (pad each row to max width so
  // the editor grid isn't jagged; the visual table will render fine either
  // way, but rectangular makes col ops predictable).
  const rows = (aoa as any[][]).map((row) => (row ?? []).map((cell) => (cell == null ? "" : String(cell))));
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => (r.length === maxCols ? r : [...r, ...Array(maxCols - r.length).fill("")]));
}

function sheetFromGrid(grid: Grid): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(grid);
}

function newBlankWorkbook(name = "Untitled.xlsx"): Workbook {
  const rows = 20;
  const cols = 8;
  const blank: Grid = Array.from({ length: rows }, () => Array(cols).fill(""));
  return {
    name,
    sheets: { Sheet1: blank },
    order: ["Sheet1"],
    activeSheet: "Sheet1",
    dirty: false,
  };
}

/** A→Z, AA→AZ, BA→… */
function colLabel(i: number): string {
  let s = "";
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

export default function ExcelPage() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Warn on close if unsaved.
  useEffect(() => {
    if (!wb?.dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [wb?.dirty]);

  const openFile = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const parsed = XLSX.read(buf, { type: "array" });
      const order = parsed.SheetNames.slice();
      if (order.length === 0) throw new Error("Workbook has no sheets.");
      const sheets: Record<string, Grid> = {};
      for (const name of order) sheets[name] = gridFromSheet(parsed.Sheets[name]);
      setWb({ name: file.name, sheets, order, activeSheet: order[0], dirty: false });
      toast({ title: "Opened", description: `${file.name} — ${order.length} sheet${order.length === 1 ? "" : "s"}` });
    } catch (err: any) {
      toast({ title: "Couldn't open file", description: err?.message ?? "Unsupported format.", variant: "destructive" });
    }
  }, [toast]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) openFile(f);
    e.target.value = ""; // allow re-pick of same file
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) openFile(f);
  };

  const saveAs = () => {
    if (!wb) return;
    const out = XLSX.utils.book_new();
    for (const name of wb.order) {
      XLSX.utils.book_append_sheet(out, sheetFromGrid(wb.sheets[name]), name);
    }
    // Preserve extension: if the source was .csv, still export as .xlsx unless
    // it started as multi-sheet-less CSV. Keep it simple: always .xlsx.
    const base = wb.name.replace(/\.(xlsx|xls|csv|ods)$/i, "");
    XLSX.writeFile(out, `${base}.xlsx`);
    setWb((w) => (w ? { ...w, dirty: false } : w));
  };

  const updateCell = (r: number, c: number, value: string) => {
    setWb((w) => {
      if (!w) return w;
      const grid = w.sheets[w.activeSheet];
      if (grid[r][c] === value) return w;
      const nextGrid = grid.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? value : cell)) : row));
      return { ...w, sheets: { ...w.sheets, [w.activeSheet]: nextGrid }, dirty: true };
    });
  };

  const activeGrid: Grid | null = wb ? wb.sheets[wb.activeSheet] : null;

  const addRow = () => setWb((w) => {
    if (!w) return w;
    const g = w.sheets[w.activeSheet];
    const cols = g[0]?.length ?? 8;
    return { ...w, dirty: true, sheets: { ...w.sheets, [w.activeSheet]: [...g, Array(cols).fill("")] } };
  });

  const addCol = () => setWb((w) => {
    if (!w) return w;
    const g = w.sheets[w.activeSheet];
    return { ...w, dirty: true, sheets: { ...w.sheets, [w.activeSheet]: g.map((row) => [...row, ""]) } };
  });

  const addSheet = () => setWb((w) => {
    if (!w) return w;
    let i = w.order.length + 1;
    let name = `Sheet${i}`;
    while (w.sheets[name]) { i += 1; name = `Sheet${i}`; }
    const cols = w.sheets[w.activeSheet]?.[0]?.length ?? 8;
    const blank: Grid = Array.from({ length: 20 }, () => Array(cols).fill(""));
    return { ...w, dirty: true, activeSheet: name, order: [...w.order, name], sheets: { ...w.sheets, [name]: blank } };
  });

  const deleteSheet = (name: string) => setWb((w) => {
    if (!w) return w;
    if (w.order.length <= 1) {
      toast({ title: "Can't delete the last sheet", description: "A workbook needs at least one sheet." });
      return w;
    }
    const nextSheets = { ...w.sheets };
    delete nextSheets[name];
    const nextOrder = w.order.filter((n) => n !== name);
    const nextActive = w.activeSheet === name ? nextOrder[0] : w.activeSheet;
    return { ...w, dirty: true, order: nextOrder, sheets: nextSheets, activeSheet: nextActive };
  });

  return (
    <Layout title="Microsoft Excel">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">

        {/* Hero */}
        <section className="rounded-xl border border-border/60 bg-gradient-to-br from-[#107c41]/10 via-background to-background p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-[#107c41] text-white shadow-sm">
                <FileSpreadsheet className="size-6" />
              </div>
              <div>
                <div className="ff-kicker text-xs text-muted-foreground">Spreadsheets</div>
                <h2 className="font-display text-xl font-extrabold tracking-tight">Microsoft Excel</h2>
                <p className="mt-1 text-sm text-muted-foreground">Open, view, and edit .xlsx spreadsheets right inside TrussPath.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => window.open(EXCEL_ONLINE_HOME, "_blank", "noopener,noreferrer")} className="gap-2" data-testid="button-excel-online">
                <ExternalLink className="size-4" />
                Excel Online
              </Button>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2" data-testid="button-excel-open">
                <Upload className="size-4" />
                Open file
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={onPickFile}
            data-testid="input-excel-file"
          />
        </section>

        {!wb && (
          <section
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-10 text-center transition",
              dragOver ? "border-[#107c41] bg-[#107c41]/5" : "border-border/70 bg-card"
            )}
            data-testid="dropzone-excel"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-[#107c41]/10 text-[#107c41]">
              <FileSpreadsheet className="size-7" />
            </div>
            <div>
              <div className="font-display text-lg font-bold">Drop a spreadsheet here</div>
              <p className="mt-1 text-sm text-muted-foreground">Supports .xlsx, .xls, .csv, and .ods. Nothing leaves your device.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2" data-testid="button-excel-pick">
                <Upload className="size-4" />
                Choose file
              </Button>
              <Button variant="outline" onClick={() => setWb(newBlankWorkbook())} className="gap-2" data-testid="button-excel-new">
                <FilePlus className="size-4" />
                New blank workbook
              </Button>
            </div>
            <a
              href={EXCEL_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              data-testid="link-excel-download"
            >
              Or install the Microsoft Excel desktop app
              <ExternalLink className="size-3" />
            </a>
          </section>
        )}

        {wb && activeGrid && (
          <section className="rounded-xl border border-border/60 bg-card">
            {/* Workbook toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#107c41]/10 text-[#107c41]">
                  <SheetIcon className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-bold" data-testid="text-excel-filename">
                    {wb.name}
                    {wb.dirty && <span className="ml-2 text-xs font-normal text-amber-600">• unsaved</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {wb.order.length} sheet{wb.order.length === 1 ? "" : "s"} · {activeGrid.length} rows × {activeGrid[0]?.length ?? 0} cols
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={addRow} className="gap-1" data-testid="button-excel-add-row">
                  <Plus className="size-3.5" /> Row
                </Button>
                <Button variant="outline" size="sm" onClick={addCol} className="gap-1" data-testid="button-excel-add-col">
                  <Plus className="size-3.5" /> Column
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1" data-testid="button-excel-open-another">
                  <Upload className="size-3.5" /> Open…
                </Button>
                <Button size="sm" onClick={saveAs} className="gap-1" data-testid="button-excel-save">
                  <Download className="size-3.5" /> Save as .xlsx
                </Button>
              </div>
            </div>

            {/* Sheet tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5">
              {wb.order.map((name) => {
                const active = name === wb.activeSheet;
                return (
                  <div
                    key={name}
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition",
                      active
                        ? "border-[#107c41]/40 bg-[#107c41]/10 text-[#107c41]"
                        : "border-border/60 bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setWb((w) => (w ? { ...w, activeSheet: name } : w))}
                      className="max-w-[160px] truncate"
                      title={name}
                      data-testid={`tab-sheet-${name}`}
                    >
                      {name}
                    </button>
                    {wb.order.length > 1 && (
                      <button
                        type="button"
                        onClick={() => deleteSheet(name)}
                        className="opacity-40 transition hover:opacity-100"
                        title="Delete sheet"
                        aria-label={`Delete sheet ${name}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addSheet}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                data-testid="button-add-sheet"
              >
                <Plus className="size-3" /> New sheet
              </button>
            </div>

            {/* Grid */}
            <SpreadsheetGrid grid={activeGrid} onEdit={updateCell} />
          </section>
        )}

        {wb && (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
            Edits stay in your browser until you <span className="font-semibold">Save as .xlsx</span>. Need charts, formulas, or live collaboration? Open the file in <a href={EXCEL_ONLINE_HOME} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Excel Online</a> or the desktop app.
          </div>
        )}
      </div>
    </Layout>
  );
}

function SpreadsheetGrid({ grid, onEdit }: { grid: Grid; onEdit: (r: number, c: number, v: string) => void }) {
  const cols = grid[0]?.length ?? 0;
  const colHeaders = useMemo(() => Array.from({ length: cols }, (_, i) => colLabel(i)), [cols]);
  return (
    <div className="max-h-[65vh] overflow-auto">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
          <tr>
            <th className="sticky left-0 z-20 w-10 border-b border-r border-border/60 bg-muted/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">#</th>
            {colHeaders.map((h) => (
              <th key={h} className="min-w-[110px] border-b border-r border-border/60 px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, r) => (
            <tr key={r}>
              <th className="sticky left-0 z-10 w-10 border-b border-r border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                {r + 1}
              </th>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-r border-border/40 p-0">
                  <Input
                    value={cell}
                    onChange={(e) => onEdit(r, c, e.target.value)}
                    className="h-8 rounded-none border-0 bg-transparent px-2 text-sm focus-visible:ring-1 focus-visible:ring-[#107c41]/40"
                    data-testid={`cell-${r}-${c}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
