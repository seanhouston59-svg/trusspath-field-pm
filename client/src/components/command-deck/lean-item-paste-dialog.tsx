/**
 * Bulk paste-import dialog for a lean module's item list.
 *
 * User pastes a block of tab-separated (or CSV-ish) rows from any spreadsheet.
 * The parser auto-detects a header row and maps columns to Title, Category,
 * Owner, Due, Status, Notes (case-insensitive). If no header is present, the
 * first column is treated as Title and remaining columns are inferred by
 * position.
 *
 * A preview grid shows exactly what will be created so users can spot mistakes
 * before they hit Import. Everything is client-side until the confirm click,
 * which fires a single POST /items/bulk request.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useBulkCreateLeanModuleItems } from "@/hooks/use-lean-modules";
import { useToast } from "@/hooks/use-toast";
import type { InsertLeanModuleItem } from "@shared/schema";

/** Fields our parser knows how to fill from a pasted table. */
type ParsedRow = Partial<Pick<InsertLeanModuleItem, "title" | "category" | "ownerName" | "dueDate" | "status" | "notes">> & {
  title: string;
};

/**
 * Match a spreadsheet column header to one of our field names. Returns null
 * for headers we don't recognize (those columns are ignored on import).
 */
function matchHeader(header: string): keyof ParsedRow | null {
  const h = header.trim().toLowerCase();
  if (!h) return null;
  if (["title", "name", "item", "task", "description"].includes(h)) return "title";
  if (["category", "type", "phase", "group"].includes(h)) return "category";
  if (["owner", "assignee", "assigned", "responsible", "who"].includes(h)) return "ownerName";
  if (["due", "due date", "duedate", "target", "target date", "deadline"].includes(h)) return "dueDate";
  if (["status", "state"].includes(h)) return "status";
  if (["notes", "comment", "comments", "note", "detail", "details"].includes(h)) return "notes";
  return null;
}

/** Normalize a raw status string to our canonical values. */
function normalizeStatus(raw: string): string | undefined {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const known = ["not_started", "in_progress", "complete", "on_hold", "at_risk", "n_a"];
  if (known.includes(s)) return s;
  // Common aliases
  if (["todo", "to_do", "pending", "new"].includes(s)) return "not_started";
  if (["doing", "wip", "active", "started"].includes(s)) return "in_progress";
  if (["done", "closed", "finished"].includes(s)) return "complete";
  if (["blocked", "paused"].includes(s)) return "on_hold";
  if (["risk", "at-risk", "warning"].includes(s)) return "at_risk";
  if (["na", "n/a", "skip", "skipped"].includes(s)) return "n_a";
  return undefined;
}

/**
 * Parse a pasted block into rows. Splits on newlines, cells on tabs, with a
 * fallback to comma-splitting when there are no tabs anywhere in the block
 * (so users pasting CSV still get sensible parsing).
 */
function parsePasteBlock(text: string): { rows: ParsedRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], warnings };

  const useCommaFallback = !text.includes("\t");
  const split = (line: string) =>
    useCommaFallback
      ? // Simple CSV split \u2014 doesn't handle quoted commas, but the spreadsheet
        // clipboard path (TSV) covers that case and is the primary use.
        line.split(",").map((c) => c.trim())
      : line.split("\t").map((c) => c.trim());

  // Header detection: first row is considered a header if at least one cell
  // maps to a known field. This lets people paste with or without headers.
  const firstCells = split(lines[0]);
  const headerMatches = firstCells.map(matchHeader);
  const hasHeader = headerMatches.some((h) => h !== null);
  const columnMap: Array<keyof ParsedRow | null> = hasHeader
    ? headerMatches
    : // No header \u2014 assume positional layout: title, category, owner, due, status, notes.
      ["title", "category", "ownerName", "dueDate", "status", "notes"];
  const bodyLines = hasHeader ? lines.slice(1) : lines;

  if (hasHeader && !columnMap.includes("title")) {
    warnings.push("No 'Title' column detected in header — first column will be used as the title.");
    columnMap[0] = "title";
  }

  const rows: ParsedRow[] = [];
  for (const line of bodyLines) {
    const cells = split(line);
    const row: ParsedRow = { title: "" };
    for (let i = 0; i < cells.length; i += 1) {
      const field = columnMap[i];
      if (!field) continue;
      const raw = cells[i]?.trim();
      if (!raw) continue;
      if (field === "status") {
        row.status = normalizeStatus(raw);
      } else {
        (row as Record<string, string>)[field] = raw;
      }
    }
    if (row.title.trim()) rows.push(row);
  }

  if (rows.length === 0 && bodyLines.length > 0) {
    warnings.push("Couldn't extract any titles — make sure the first column has a value on each row.");
  }
  return { rows, warnings };
}

export function LeanItemPasteDialog({
  projectId,
  moduleId,
  itemNounPlural,
  currentItemCount,
  trigger,
}: {
  projectId: number;
  moduleId: string;
  itemNounPlural: string;
  currentItemCount: number;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { toast } = useToast();
  const bulk = useBulkCreateLeanModuleItems(projectId, moduleId);

  // Recompute parse only when text changes \u2014 cheap for typical paste sizes.
  const parsed = useMemo(() => parsePasteBlock(text), [text]);

  const handleImport = async () => {
    if (parsed.rows.length === 0) return;
    const payload = parsed.rows.map((r, i) => ({
      title: r.title.trim(),
      category: r.category,
      ownerName: r.ownerName,
      dueDate: r.dueDate,
      status: r.status ?? "not_started",
      notes: r.notes,
      sortOrder: currentItemCount + i,
    }));
    try {
      const result = await bulk.mutateAsync(payload);
      toast({
        title: `Imported ${result.count} ${result.count === 1 ? itemNounPlural.replace(/s$/, "").toLowerCase() : itemNounPlural.toLowerCase()}`,
        description: "Rows added to the list below.",
      });
      setText("");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          data-testid={`lean-${moduleId}-paste-btn`}
        >
          <ClipboardPaste className="mr-1 size-4" />
          Paste rows
        </Button>
      )}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Paste {itemNounPlural.toLowerCase()} from a spreadsheet</DialogTitle>
          <DialogDescription>
            Copy any block of cells from Excel, Google Sheets, or Numbers and paste it below.
            First column is the title; add columns named Category, Owner, Due, Status, or Notes
            to fill those fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Title\tCategory\tOwner\tDue\nCoordinate crane pick\tLogistics\tSarah\t2026-08-04\nSubmit permit revision\tPermitting\tMarcus\t2026-08-02`}
            rows={8}
            className="font-mono text-xs"
            data-testid={`lean-${moduleId}-paste-textarea`}
          />

          {parsed.warnings.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <div className="space-y-1">
                {parsed.warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          )}

          {parsed.rows.length > 0 && (
            <div className="rounded-md border border-border">
              <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preview — {parsed.rows.length} {parsed.rows.length === 1 ? "row" : "rows"}
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b border-border text-left text-[10px] uppercase text-muted-foreground">
                      <th className="px-3 py-2 font-semibold">Title</th>
                      <th className="px-3 py-2 font-semibold">Category</th>
                      <th className="px-3 py-2 font-semibold">Owner</th>
                      <th className="px-3 py-2 font-semibold">Due</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-1.5 font-medium">{r.title}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.category ?? ""}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.ownerName ?? ""}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.dueDate ?? ""}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{r.status ?? "not_started"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 100 && (
                  <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
                    Showing first 100 of {parsed.rows.length} rows. All will be imported.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={bulk.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsed.rows.length === 0 || bulk.isPending}
            data-testid={`lean-${moduleId}-paste-import-btn`}
          >
            {bulk.isPending && <Loader2 className="mr-1 size-4 animate-spin" />}
            Import {parsed.rows.length > 0 ? parsed.rows.length : ""}{" "}
            {parsed.rows.length === 1 ? "row" : "rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
