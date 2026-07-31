/**
 * Executive OS document engine.
 *
 * ReportBuilder wraps pdfkit with the layout vocabulary every Executive OS
 * report shares — cover page, running header/footer, headings, tables,
 * checklists, stat rows, and the standard executive sections (financials,
 * schedule, quality, safety, risk, manpower, sign-off).
 *
 * Modules that don't exist yet are handled by `unavailable()`, so a report can
 * render its full outline today and fill in as the notebook grows.
 *
 * Import note: we pull pdfkit's *standalone* build. The default entry reads its
 * .afm font metrics off disk via readFileSync(__dirname + "/data/..."), which
 * Vercel's file tracer does not reliably bundle into the serverless function.
 * The standalone build inlines that data, so it works anywhere.
 */
/// <reference types="pdfkit" />
// tsconfig narrows `types`, so @types/pdfkit needs the explicit reference above
// to bring in the PDFKit namespace and the standalone module declaration.
import PDFDocument from "pdfkit/js/pdfkit.standalone";

export const PALETTE = {
  primary: "#0F172A",
  accent: "#2563EB",
  muted: "#64748B",
  bgTint: "#F1F5F9",
  green: "#16A34A",
  yellow: "#D97706",
  red: "#DC2626",
  white: "#FFFFFF",
  hairline: "#CBD5E1",
} as const;

export type HealthTone = "green" | "yellow" | "red";
export type Tone = "default" | "green" | "yellow" | "red";

export type ReportMeta = {
  title: string;
  projectName: string;
  projectNumber: string;
  owner: string;
  gcName: string;
  address: string;
  reportingPeriod?: string;
  preparedBy: string;
  preparedByRole?: string;
  distribution?: string[];
  revision?: string;
  health?: HealthTone;
  phase?: string;
  /** Optional cover-page additions — each is skipped when empty. */
  ownerRep?: string | null;
  architect?: string | null;
  engineerOfRecord?: string | null;
  jurisdiction?: string | null;
};

export type StatChip = { label: string; value: string; tone?: Tone };

const PAGE_WIDTH = 612;   // 8.5" x 72
const PAGE_HEIGHT = 792;  // 11" x 72
const MARGIN = 54;        // 0.75"
const CONTENT_W = PAGE_WIDTH - MARGIN * 2;
const HEADER_H = 34;
const FOOTER_H = 30;
/** Lowest y a section may occupy before we break to a new page. */
const BODY_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_H;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `$1,234,567.00`; null/NaN render as an em dash. */
export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const neg = n < 0;
  const [whole, cents] = Math.abs(n).toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${neg ? "-" : ""}$${grouped}.${cents}`;
}

/** `2026-07-27` → `Jul 27, 2026`. Passes through anything unparseable. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mon = MONTHS[parseInt(m[2], 10) - 1];
  if (!mon) return iso;
  return `${mon} ${parseInt(m[3], 10)}, ${m[1]}`;
}

function toneColor(tone: Tone | undefined): string {
  switch (tone) {
    case "green": return PALETTE.green;
    case "yellow": return PALETTE.yellow;
    case "red": return PALETTE.red;
    default: return PALETTE.primary;
  }
}

const HEALTH_LABEL: Record<HealthTone, string> = {
  green: "ON TRACK",
  yellow: "AT RISK",
  red: "BEHIND",
};

export class ReportBuilder {
  private doc: PDFKit.PDFDocument;
  private meta: ReportMeta;
  private generatedAt: string;
  /** Cover art is drawn edge-to-edge, so chrome is suppressed for page 1. */
  private chromeEnabled = false;
  private drawingChrome = false;
  private pageNo = 0;

  constructor(meta: ReportMeta) {
    this.meta = meta;
    this.generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    this.doc = new PDFDocument({
      size: "LETTER",
      margins: { top: MARGIN + HEADER_H, bottom: MARGIN + FOOTER_H, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `${meta.title} — ${meta.projectName}`,
        Author: meta.preparedBy,
        Creator: "TrussPath Command Deck",
      },
    });
    this.doc.on("pageAdded", () => {
      this.pageNo += 1;
      if (this.chromeEnabled) this.drawChrome();
    });
    this.pageNo = 1;
  }

  pipe(stream: NodeJS.WritableStream): this {
    this.doc.pipe(stream);
    return this;
  }

  end(): void {
    this.doc.end();
  }

  // ---------------------------------------------------------------- chrome

  private drawChrome(): void {
    if (this.drawingChrome) return;
    this.drawingChrome = true;
    const d = this.doc;
    const y = MARGIN;
    // The footer sits below the bottom margin. pdfkit reads that as text
    // overflow and auto-adds a page, which re-enters this method — so the
    // margin is lifted for the duration of the draw.
    const savedBottom = d.page.margins.bottom;
    d.page.margins.bottom = 0;
    // save()/restore() covers the graphics state but not the text state, so the
    // caller's font would otherwise come back as the 7pt footer face mid-list.
    const savedFont = (d as any)._font;
    const savedFontSize = (d as any)._fontSize;
    const savedFill = (d as any)._fillColor;
    d.save();
    d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted);
    d.text(this.truncate(this.meta.projectName, 40), MARGIN, y, { width: CONTENT_W / 3, align: "left", lineBreak: false });
    d.text(this.meta.title, MARGIN + CONTENT_W / 3, y, { width: CONTENT_W / 3, align: "center", lineBreak: false });
    d.text(`${this.meta.revision ?? "Rev 0"}  ·  Page ${this.pageNo}`,
      MARGIN + (CONTENT_W * 2) / 3, y, { width: CONTENT_W / 3, align: "right", lineBreak: false });
    d.moveTo(MARGIN, y + 13).lineTo(PAGE_WIDTH - MARGIN, y + 13)
      .lineWidth(0.5).strokeColor(PALETTE.hairline).stroke();

    const fy = PAGE_HEIGHT - MARGIN - 12;
    d.moveTo(MARGIN, fy - 6).lineTo(PAGE_WIDTH - MARGIN, fy - 6)
      .lineWidth(0.5).strokeColor(PALETTE.hairline).stroke();
    d.fontSize(7).fillColor(PALETTE.muted);
    d.text(this.truncate(this.meta.preparedBy, 36), MARGIN, fy, { width: CONTENT_W / 3, align: "left", lineBreak: false });
    d.text(this.generatedAt, MARGIN + CONTENT_W / 3, fy, { width: CONTENT_W / 3, align: "center", lineBreak: false });
    d.text("TrussPath — Confidential", MARGIN + (CONTENT_W * 2) / 3, fy, { width: CONTENT_W / 3, align: "right", lineBreak: false });
    d.restore();
    if (savedFont) (d as any)._font = savedFont;
    (d as any)._fontSize = savedFontSize;
    // Each page is its own content stream, so the caller's fill colour has to
    // be re-emitted here. Clearing the cache first defeats pdfkit's
    // already-set check, which would otherwise skip the operator.
    (d as any)._fillColor = null;
    if (savedFill) d.fillColor(savedFill[0], savedFill[1]);
    d.page.margins.bottom = savedBottom;
    this.drawingChrome = false;
    d.x = MARGIN;
    d.y = MARGIN + HEADER_H;
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  /** Break to a new page when `need` points won't fit in the remaining body. */
  private ensure(need: number): void {
    if (this.doc.y + need > BODY_BOTTOM) this.doc.addPage();
  }

  private resetText(): void {
    this.doc.fillColor(PALETTE.primary).font("Helvetica").fontSize(10);
  }

  // ------------------------------------------------------------ structural

  coverPage(subtitle?: string): this {
    const d = this.doc;
    const bandH = PAGE_HEIGHT * 0.4;
    // The cover is laid out full-bleed against absolute coordinates, so the
    // body margin must not be allowed to spill it onto a second page.
    const savedBottom = d.page.margins.bottom;
    d.page.margins.bottom = 0;

    d.rect(0, 0, PAGE_WIDTH, bandH).fill(PALETTE.primary);
    d.fillColor(PALETTE.white).font("Helvetica-Bold").fontSize(13)
      .text("TRUSSPATH", MARGIN, MARGIN + 6, { characterSpacing: 3 });
    d.font("Helvetica").fontSize(9).fillColor("#94A3B8")
      .text("COMMAND DECK", MARGIN, MARGIN + 26, { characterSpacing: 2 });

    d.fillColor(PALETTE.white).font("Times-Bold").fontSize(38)
      .text(this.meta.title.toUpperCase(), MARGIN, bandH - 150, { width: CONTENT_W });
    if (subtitle) {
      d.font("Helvetica").fontSize(12).fillColor("#CBD5E1")
        .text(subtitle, MARGIN, d.y + 6, { width: CONTENT_W });
    }
    if (this.meta.phase) {
      d.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.accent)
        .text(`PHASE: ${this.meta.phase.toUpperCase()}`, MARGIN, bandH - 34, { characterSpacing: 1.5 });
    }

    // Middle 40% — project identity.
    let y = bandH + 42;
    d.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.muted)
      .text("PROJECT", MARGIN, y, { characterSpacing: 1.5 });
    y += 18;
    const rows: Array<[string, string]> = [
      ["Project Number", this.meta.projectNumber || "—"],
      ["Project Name", this.meta.projectName || "—"],
      ["Owner / Client", this.meta.owner || "—"],
      ["General Contractor", this.meta.gcName || "—"],
      ["Address", this.meta.address || "—"],
    ];
    if (this.meta.ownerRep?.trim()) rows.push(["Owner Rep", this.meta.ownerRep.trim()]);
    if (this.meta.architect?.trim()) rows.push(["Architect", this.meta.architect.trim()]);
    if (this.meta.engineerOfRecord?.trim()) rows.push(["Engineer of Record", this.meta.engineerOfRecord.trim()]);
    if (this.meta.jurisdiction?.trim()) rows.push(["Jurisdiction", this.meta.jurisdiction.trim()]);
    if (this.meta.reportingPeriod) rows.push(["Reporting Period", this.meta.reportingPeriod]);

    const labelW = 150;
    for (const [k, v] of rows) {
      d.font("Helvetica").fontSize(9).fillColor(PALETTE.muted).text(k, MARGIN, y, { width: labelW, lineBreak: false });
      d.font("Helvetica-Bold").fontSize(10).fillColor(PALETTE.primary)
        .text(v, MARGIN + labelW, y - 1, { width: CONTENT_W - labelW });
      y = Math.max(d.y, y + 14) + 6;
    }

    // Bottom 20% — provenance.
    let by = PAGE_HEIGHT * 0.8 - 6;
    d.moveTo(MARGIN, by).lineTo(PAGE_WIDTH - MARGIN, by).lineWidth(0.5).strokeColor(PALETTE.hairline).stroke();
    by += 14;

    if (this.meta.health) {
      const tone = this.meta.health;
      const label = `HEALTH: ${HEALTH_LABEL[tone]}`;
      const w = d.font("Helvetica-Bold").fontSize(9).widthOfString(label) + 20;
      d.roundedRect(MARGIN, by, w, 18, 9).fill(toneColor(tone));
      d.fillColor(PALETTE.white).font("Helvetica-Bold").fontSize(9)
        .text(label, MARGIN + 10, by + 5, { lineBreak: false });
      by += 28;
    }

    const foot: Array<[string, string]> = [
      ["Revision", this.meta.revision ?? "Rev 0"],
      ["Prepared By", this.meta.preparedByRole
        ? `${this.meta.preparedBy} — ${this.meta.preparedByRole}`
        : this.meta.preparedBy],
      ["Issued", formatDate(new Date().toISOString().slice(0, 10))],
    ];
    if (this.meta.distribution?.length) foot.push(["Distribution", this.meta.distribution.join(", ")]);
    for (const [k, v] of foot) {
      d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted).text(k, MARGIN, by, { width: 100, lineBreak: false });
      d.font("Helvetica").fontSize(9).fillColor(PALETTE.primary).text(v, MARGIN + 100, by - 1, { width: CONTENT_W - 100 });
      by = Math.max(d.y, by + 12) + 3;
    }

    d.page.margins.bottom = savedBottom;

    // Everything after the cover gets the running header/footer, and body
    // content always starts on its own page rather than on the cover art.
    this.chromeEnabled = true;
    d.addPage();
    return this;
  }

  sectionBreak(): this {
    // The cover already advances to a fresh page, as does a preceding break, so
    // an unconditional addPage() here would emit a blank one.
    if (this.doc.y <= MARGIN + HEADER_H + 0.5) return this;
    this.doc.addPage();
    return this;
  }

  h1(text: string): this {
    this.ensure(70);
    const d = this.doc;
    if (d.y > MARGIN + HEADER_H + 2) d.y += 12;
    d.font("Helvetica-Bold").fontSize(16).fillColor(PALETTE.primary).text(text, MARGIN, d.y, { width: CONTENT_W });
    d.y += 3;
    d.moveTo(MARGIN, d.y).lineTo(MARGIN + 46, d.y).lineWidth(2.5).strokeColor(PALETTE.accent).stroke();
    d.y += 10;
    this.resetText();
    return this;
  }

  h2(text: string): this {
    this.ensure(46);
    const d = this.doc;
    d.y += 8;
    d.font("Helvetica-Bold").fontSize(11.5).fillColor(PALETTE.primary).text(text, MARGIN, d.y, { width: CONTENT_W });
    d.y += 5;
    this.resetText();
    return this;
  }

  h3(text: string): this {
    this.ensure(34);
    const d = this.doc;
    d.y += 6;
    d.font("Helvetica-Bold").fontSize(9.5).fillColor(PALETTE.muted)
      .text(text.toUpperCase(), MARGIN, d.y, { width: CONTENT_W, characterSpacing: 0.8 });
    d.y += 4;
    this.resetText();
    return this;
  }

  p(text: string, opts?: { muted?: boolean }): this {
    if (!text) return this;
    this.ensure(26);
    const d = this.doc;
    d.font("Helvetica").fontSize(9.5).fillColor(opts?.muted ? PALETTE.muted : PALETTE.primary)
      .text(text, MARGIN, d.y, { width: CONTENT_W, align: "left", lineGap: 1.5 });
    d.y += 5;
    this.resetText();
    return this;
  }

  /** Muted italic marker for data that needs a module we haven't shipped. */
  unavailable(text: string): this {
    this.ensure(20);
    const d = this.doc;
    d.font("Helvetica-Oblique").fontSize(9).fillColor(PALETTE.muted)
      .text(`— unavailable — ${text}`, MARGIN, d.y, { width: CONTENT_W });
    d.y += 4;
    this.resetText();
    return this;
  }

  // ------------------------------------------------------------------ data

  statRow(chips: StatChip[]): this {
    if (!chips.length) return this;
    const shown = chips.slice(0, 6);
    this.ensure(58);
    const d = this.doc;
    const gap = 8;
    const w = (CONTENT_W - gap * (shown.length - 1)) / shown.length;
    const top = d.y;
    const h = 46;

    shown.forEach((c, i) => {
      const x = MARGIN + i * (w + gap);
      d.roundedRect(x, top, w, h, 4).fill(PALETTE.bgTint);
      d.roundedRect(x, top, 3, h, 1.5).fill(toneColor(c.tone));
      d.font("Helvetica").fontSize(7).fillColor(PALETTE.muted)
        .text(c.label.toUpperCase(), x + 10, top + 8, { width: w - 16, characterSpacing: 0.5, lineBreak: false });
      d.font("Helvetica-Bold").fontSize(14).fillColor(toneColor(c.tone))
        .text(c.value, x + 10, top + 21, { width: w - 16, lineBreak: false });
    });

    d.y = top + h + 10;
    this.resetText();
    return this;
  }

  keyValueGrid(items: Array<[string, string]>, cols: number = 2): this {
    if (!items.length) return this;
    const d = this.doc;
    const n = Math.max(1, Math.min(3, cols));
    const gap = 14;
    const colW = (CONTENT_W - gap * (n - 1)) / n;

    for (let i = 0; i < items.length; i += n) {
      const slice = items.slice(i, i + n);
      // Measure the tallest cell so the row's columns stay aligned.
      let rowH = 0;
      for (const [k, v] of slice) {
        d.font("Helvetica").fontSize(8);
        const kh = d.heightOfString(k, { width: colW });
        d.font("Helvetica-Bold").fontSize(9.5);
        const vh = d.heightOfString(v || "—", { width: colW });
        rowH = Math.max(rowH, kh + vh + 8);
      }
      this.ensure(rowH + 4);
      const top = d.y;
      slice.forEach(([k, v], j) => {
        const x = MARGIN + j * (colW + gap);
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted).text(k, x, top, { width: colW });
        d.font("Helvetica-Bold").fontSize(9.5).fillColor(PALETTE.primary)
          .text(v || "—", x, top + d.heightOfString(k, { width: colW }) + 1, { width: colW });
      });
      d.y = top + rowH;
    }
    d.y += 4;
    this.resetText();
    return this;
  }

  table(
    cols: Array<{ header: string; width?: number; align?: "left" | "right" | "center" }>,
    rows: string[][],
  ): this {
    if (!cols.length) return this;
    const d = this.doc;
    // Unweighted columns split whatever the weighted ones leave behind.
    const fixed = cols.reduce((s, c) => s + (c.width ?? 0), 0);
    const flexCount = cols.filter((c) => !c.width).length;
    const flexW = flexCount ? Math.max(40, (CONTENT_W - fixed) / flexCount) : 0;
    const widths = cols.map((c) => c.width ?? flexW);
    const padX = 5;

    const drawHeader = () => {
      this.ensure(30);
      const top = d.y;
      d.rect(MARGIN, top, CONTENT_W, 20).fill(PALETTE.bgTint);
      cols.forEach((c, i) => {
        const x = MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0);
        d.font("Helvetica-Bold").fontSize(8).fillColor(PALETTE.primary)
          .text(c.header.toUpperCase(), x + padX, top + 6.5,
            { width: widths[i] - padX * 2, align: c.align ?? "left", lineBreak: false, characterSpacing: 0.4 });
      });
      d.y = top + 20;
    };

    drawHeader();

    if (!rows.length) {
      d.font("Helvetica-Oblique").fontSize(9).fillColor(PALETTE.muted)
        .text("No records.", MARGIN + padX, d.y + 6, { width: CONTENT_W - padX * 2 });
      d.y += 22;
      this.resetText();
      return this;
    }

    for (const row of rows) {
      d.font("Helvetica").fontSize(8.5);
      let cellH = 0;
      cols.forEach((_, i) => {
        cellH = Math.max(cellH, d.heightOfString(row[i] ?? "—", { width: widths[i] - padX * 2 }));
      });
      const rowH = cellH + 10;

      // Repeat the header when a long table spills onto the next page.
      if (d.y + rowH > BODY_BOTTOM) {
        d.addPage();
        drawHeader();
      }

      const top = d.y;
      cols.forEach((c, i) => {
        const x = MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0);
        d.font("Helvetica").fontSize(8.5).fillColor(PALETTE.primary)
          .text(row[i] ?? "—", x + padX, top + 5, { width: widths[i] - padX * 2, align: c.align ?? "left" });
      });
      d.y = top + rowH;
      d.moveTo(MARGIN, d.y).lineTo(MARGIN + CONTENT_W, d.y)
        .lineWidth(0.5).strokeColor(PALETTE.hairline).stroke();
    }

    d.y += 8;
    this.resetText();
    return this;
  }

  bulletList(items: string[]): this {
    if (!items.length) {
      return this.p("None recorded.", { muted: true });
    }
    const d = this.doc;
    for (const item of items) {
      d.font("Helvetica").fontSize(9.5);
      const h = d.heightOfString(item, { width: CONTENT_W - 16 });
      this.ensure(h + 6);
      const top = d.y;
      d.circle(MARGIN + 3, top + 4.5, 1.8).fill(PALETTE.accent);
      d.fillColor(PALETTE.primary).text(item, MARGIN + 14, top, { width: CONTENT_W - 16, lineGap: 1 });
      d.y = top + h + 4;
    }
    d.y += 4;
    this.resetText();
    return this;
  }

  checklist(items: Array<{ label: string; done: boolean; subtitle?: string }>): this {
    if (!items.length) {
      return this.p("No items in this section.", { muted: true });
    }
    const d = this.doc;
    for (const item of items) {
      d.font("Helvetica").fontSize(9.5);
      const labelH = d.heightOfString(item.label, { width: CONTENT_W - 24 });
      let subH = 0;
      if (item.subtitle) {
        d.font("Helvetica").fontSize(8);
        subH = d.heightOfString(item.subtitle, { width: CONTENT_W - 24 }) + 1;
      }
      const rowH = Math.max(14, labelH + subH) + 5;
      this.ensure(rowH + 2);
      const top = d.y;

      d.roundedRect(MARGIN, top + 1, 9, 9, 1.5)
        .lineWidth(0.8)
        .fillAndStroke(item.done ? PALETTE.green : PALETTE.white, item.done ? PALETTE.green : PALETTE.hairline);
      if (item.done) {
        d.save().lineWidth(1.2).strokeColor(PALETTE.white)
          .moveTo(MARGIN + 2.2, top + 5.6).lineTo(MARGIN + 4, top + 7.6).lineTo(MARGIN + 6.9, top + 3.1)
          .stroke().restore();
      }

      d.font("Helvetica").fontSize(9.5).fillColor(item.done ? PALETTE.muted : PALETTE.primary)
        .text(item.label, MARGIN + 18, top, { width: CONTENT_W - 24 });
      if (item.subtitle) {
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted)
          .text(item.subtitle, MARGIN + 18, top + labelH + 1, { width: CONTENT_W - 24 });
      }
      d.y = top + rowH;
    }
    d.y += 4;
    this.resetText();
    return this;
  }

  progressBar(pct: number, label?: string): this {
    const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
    this.ensure(24);
    const d = this.doc;
    const barW = 200;
    const barH = 8;
    const top = d.y + 2;
    let x = MARGIN;

    if (label) {
      d.font("Helvetica").fontSize(8.5).fillColor(PALETTE.muted)
        .text(label, MARGIN, top - 1, { width: 150, lineBreak: false });
      x = MARGIN + 158;
    }
    d.roundedRect(x, top, barW, barH, barH / 2).fill(PALETTE.bgTint);
    if (clamped > 0) {
      d.roundedRect(x, top, Math.max(barH, (barW * clamped) / 100), barH, barH / 2).fill(PALETTE.accent);
    }
    d.font("Helvetica-Bold").fontSize(8.5).fillColor(PALETTE.primary)
      .text(`${clamped}%`, x + barW + 8, top - 1, { width: 40, lineBreak: false });

    d.y = top + barH + 6;
    this.resetText();
    return this;
  }

  // --------------------------------------------------------------- signals

  callout(text: string, tone: "info" | "warn" | "danger" | "success"): this {
    const color = tone === "danger" ? PALETTE.red
      : tone === "warn" ? PALETTE.yellow
      : tone === "success" ? PALETTE.green
      : PALETTE.accent;
    const d = this.doc;
    d.font("Helvetica").fontSize(9);
    const h = d.heightOfString(text, { width: CONTENT_W - 30 }) + 16;
    this.ensure(h + 6);
    const top = d.y;
    d.roundedRect(MARGIN, top, CONTENT_W, h, 3).fill(PALETTE.bgTint);
    d.rect(MARGIN, top, 3, h).fill(color);
    d.font("Helvetica").fontSize(9).fillColor(PALETTE.primary)
      .text(text, MARGIN + 14, top + 8, { width: CONTENT_W - 30 });
    d.y = top + h + 8;
    this.resetText();
    return this;
  }

  /** Titled free-text block. Renders nothing when the body is empty, so a
   *  caller can list every optional narrative without guarding each one. */
  narrativeBlock(title: string, body?: string | null): this {
    const text = (body ?? "").trim();
    if (!text) return this;
    this.h3(title);
    this.p(text);
    return this;
  }

  /** Red-flagged box of the numbers somebody needs when things go wrong.
   *  Rows with neither a name nor a phone are dropped; an all-empty list
   *  renders nothing at all. */
  emergencyContactCard(
    contacts: Array<{ label: string; name?: string | null; phone?: string | null; note?: string | null }>,
  ): this {
    const rows = contacts
      .map((c) => ({
        label: c.label,
        name: (c.name ?? "").trim(),
        phone: (c.phone ?? "").trim(),
        note: (c.note ?? "").trim(),
      }))
      .filter((c) => c.name || c.phone);
    if (!rows.length) return this;

    const d = this.doc;
    const labelW = 130;
    const valueW = CONTENT_W - labelW - 28;
    const lineH = 13;

    d.font("Helvetica").fontSize(9);
    const bodyH = rows.reduce((h, r) => {
      const value = [r.name, r.phone].filter(Boolean).join("  ·  ");
      const vh = Math.max(lineH, d.heightOfString(value, { width: valueW }));
      const nh = r.note ? d.heightOfString(r.note, { width: valueW }) + 2 : 0;
      return h + vh + nh + 3;
    }, 0);
    const boxH = bodyH + 30;

    this.ensure(boxH + 6);
    const top = d.y;
    d.roundedRect(MARGIN, top, CONTENT_W, boxH, 3).fill(PALETTE.bgTint);
    d.rect(MARGIN, top, 3, boxH).fill(PALETTE.red);
    d.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.red)
      .text("EMERGENCY CONTACTS", MARGIN + 14, top + 8, { width: CONTENT_W - 28, characterSpacing: 0.8 });

    let y = top + 24;
    for (const r of rows) {
      const value = [r.name, r.phone].filter(Boolean).join("  ·  ");
      d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted)
        .text(r.label, MARGIN + 14, y, { width: labelW, lineBreak: false });
      d.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.primary)
        .text(value, MARGIN + 14 + labelW, y - 1, { width: valueW });
      let rowBottom = Math.max(d.y, y + lineH);
      if (r.note) {
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted)
          .text(r.note, MARGIN + 14 + labelW, rowBottom + 1, { width: valueW });
        rowBottom = d.y;
      }
      y = rowBottom + 3;
    }

    d.y = top + boxH + 8;
    this.resetText();
    return this;
  }

  // ---------------------------------------------------- executive sections

  executiveSummary(opts: {
    currentPhase: string;
    health: HealthTone;
    daysToNextMilestone?: number;
    keyWins: string[];
    topRisks: string[];
    topIssues: string[];
    decisionsRequired: string[];
  }): this {
    this.h1("Executive Summary");

    const days = opts.daysToNextMilestone;
    const daysVal = days === undefined || days === null ? "—"
      : days < 0 ? `${Math.abs(days)}d late`
      : `${days}d`;
    this.statRow([
      { label: "Current Phase", value: opts.currentPhase },
      { label: "Health", value: HEALTH_LABEL[opts.health], tone: opts.health },
      {
        label: "Next Milestone", value: daysVal,
        tone: days === undefined || days === null ? "default" : days < 0 ? "red" : days < 3 ? "yellow" : "default",
      },
    ]);

    this.h3("Key Wins This Period");
    this.bulletList(opts.keyWins);

    this.h3("Top Risks");
    this.bulletList(opts.topRisks);

    this.h3("Top Open Issues");
    this.bulletList(opts.topIssues);

    this.h3("Decisions Required");
    if (opts.decisionsRequired.length) {
      this.callout(
        "The following items need executive or owner sign-off before they can advance.",
        "warn",
      );
      this.bulletList(opts.decisionsRequired);
    } else {
      this.p("No decisions are currently blocked pending executive sign-off.", { muted: true });
    }
    return this;
  }

  financialsSection(opts: {
    originalContract: number;
    approvedChangeOrders: number;
    revisedContract: number;
    costToDate?: number;
    costToComplete?: number;
    estimateAtCompletion?: number;
    variance?: number;
    contingencyDrawn?: number;
    contingencyRemaining?: number;
    pendingChangeOrders?: number;
    pendingPayApps?: number;
    unavailableSections?: string[];
  }): this {
    this.h1("Financials");

    this.statRow([
      { label: "Original Contract", value: formatMoney(opts.originalContract) },
      { label: "Approved COs", value: formatMoney(opts.approvedChangeOrders) },
      { label: "Revised Contract", value: formatMoney(opts.revisedContract) },
    ]);

    const rows: string[][] = [
      ["Original contract value", formatMoney(opts.originalContract)],
      ["Approved change orders", formatMoney(opts.approvedChangeOrders)],
      ["Revised contract value", formatMoney(opts.revisedContract)],
      ["Cost to date", formatMoney(opts.costToDate)],
      ["Cost to complete", formatMoney(opts.costToComplete)],
      ["Estimate at completion", formatMoney(opts.estimateAtCompletion)],
      ["Variance", formatMoney(opts.variance)],
      ["Contingency drawn", formatMoney(opts.contingencyDrawn)],
      ["Contingency remaining", formatMoney(opts.contingencyRemaining)],
      ["Pending change orders", opts.pendingChangeOrders === undefined ? "—" : String(opts.pendingChangeOrders)],
      ["Pending pay applications", opts.pendingPayApps === undefined ? "—" : String(opts.pendingPayApps)],
    ];
    this.table(
      [{ header: "Line Item", width: 300 }, { header: "Amount", align: "right" }],
      rows,
    );

    for (const u of opts.unavailableSections ?? []) this.unavailable(u);
    return this;
  }

  scheduleSection(opts: {
    baselineStart: string;
    baselineEnd: string;
    currentStart: string;
    currentEnd: string;
    percentComplete: number;
    daysAheadBehind: number;
    upcomingMilestones: Array<{ name: string; date: string; status: string }>;
    criticalPathNote?: string;
    delays?: Array<{ cause: string; days: number; recovery: string }>;
  }): this {
    this.h1("Schedule");

    const behind = opts.daysAheadBehind < 0;
    this.statRow([
      { label: "Complete", value: `${Math.round(opts.percentComplete)}%` },
      {
        label: behind ? "Days Behind" : "Days Ahead",
        value: String(Math.abs(opts.daysAheadBehind)),
        tone: behind ? "red" : "green",
      },
    ]);
    this.progressBar(opts.percentComplete, "Schedule complete");

    this.keyValueGrid([
      ["Baseline start", formatDate(opts.baselineStart)],
      ["Baseline finish", formatDate(opts.baselineEnd)],
      ["Current start", formatDate(opts.currentStart)],
      ["Current finish", formatDate(opts.currentEnd)],
    ], 2);

    this.h2("Upcoming Milestones");
    this.table(
      [{ header: "Milestone" }, { header: "Target Date", width: 110 }, { header: "Status", width: 90 }],
      opts.upcomingMilestones.map((m) => [m.name, formatDate(m.date), m.status]),
    );

    if (opts.criticalPathNote) {
      this.h2("Critical Path");
      this.p(opts.criticalPathNote);
    }

    if (opts.delays?.length) {
      this.h2("Delays & Recovery");
      this.table(
        [{ header: "Cause" }, { header: "Days", width: 55, align: "right" }, { header: "Recovery Plan", width: 200 }],
        opts.delays.map((d) => [d.cause, String(d.days), d.recovery]),
      );
    }
    return this;
  }

  qualitySection(opts: {
    openPunchItems: number;
    openNcrs?: number;
    inspectionPassRate?: number;
    testingSummary?: string;
    unavailableSections?: string[];
  }): this {
    this.h1("Quality");
    this.statRow([
      { label: "Open Punch Items", value: String(opts.openPunchItems), tone: opts.openPunchItems > 0 ? "yellow" : "green" },
      { label: "Open NCRs", value: opts.openNcrs === undefined ? "—" : String(opts.openNcrs) },
      { label: "Inspection Pass Rate", value: opts.inspectionPassRate === undefined ? "—" : `${Math.round(opts.inspectionPassRate)}%` },
    ]);
    if (opts.testingSummary) this.p(opts.testingSummary);
    for (const u of opts.unavailableSections ?? []) this.unavailable(u);
    return this;
  }

  safetySection(opts: {
    incidentsThisPeriod: number;
    nearMisses: number;
    trainingHours?: number;
    trir?: number;
    dart?: number;
    correctiveActions?: string[];
    unavailableSections?: string[];
  }): this {
    this.h1("Safety");
    this.statRow([
      { label: "Incidents", value: String(opts.incidentsThisPeriod), tone: opts.incidentsThisPeriod > 0 ? "red" : "green" },
      { label: "Near Misses", value: String(opts.nearMisses), tone: opts.nearMisses > 0 ? "yellow" : "green" },
      { label: "Training Hours", value: opts.trainingHours === undefined ? "—" : String(opts.trainingHours) },
      { label: "TRIR", value: opts.trir === undefined ? "—" : opts.trir.toFixed(2) },
      { label: "DART", value: opts.dart === undefined ? "—" : opts.dart.toFixed(2) },
    ]);
    if (opts.correctiveActions?.length) {
      this.h2("Corrective Actions");
      this.bulletList(opts.correctiveActions);
    }
    for (const u of opts.unavailableSections ?? []) this.unavailable(u);
    return this;
  }

  rfiSubmittalCoSection(opts: {
    openRfis: number;
    avgRfiResponseDays?: number;
    topOpenRfis?: Array<{ number: string; subject: string; dueDate: string }>;
    openSubmittals: number;
    openChangeOrders: number;
    pendingChangeOrderValue?: number;
  }): this {
    this.h1("RFIs, Submittals & Change Orders");
    this.statRow([
      { label: "Open RFIs", value: String(opts.openRfis), tone: opts.openRfis > 0 ? "yellow" : "green" },
      { label: "Avg Response", value: opts.avgRfiResponseDays === undefined ? "—" : `${opts.avgRfiResponseDays.toFixed(1)}d` },
      { label: "Open Submittals", value: String(opts.openSubmittals) },
      { label: "Open COs", value: String(opts.openChangeOrders) },
      { label: "Pending CO Value", value: formatMoney(opts.pendingChangeOrderValue) },
    ]);
    if (opts.topOpenRfis?.length) {
      this.h2("Oldest Open RFIs");
      this.table(
        [{ header: "No.", width: 70 }, { header: "Subject" }, { header: "Due", width: 100 }],
        opts.topOpenRfis.map((r) => [r.number, r.subject, formatDate(r.dueDate)]),
      );
    }
    return this;
  }

  riskRegisterSection(opts: {
    risks: Array<{ risk: string; likelihood: string; impact: string; mitigation: string; owner: string; status: string }>;
  }): this {
    this.h1("Risk Register");
    this.table(
      [
        { header: "Risk" },
        { header: "Likelihood", width: 62, align: "center" },
        { header: "Impact", width: 52, align: "center" },
        { header: "Mitigation", width: 140 },
        { header: "Owner", width: 72 },
        { header: "Status", width: 58, align: "center" },
      ],
      opts.risks.map((r) => [r.risk, r.likelihood, r.impact, r.mitigation, r.owner, r.status]),
    );
    return this;
  }

  manpowerSection(opts: {
    trades: Array<{ trade: string; headcount: number; hoursThisPeriod: number }>;
    totalHeadcount: number;
    totalHours: number;
    plannedHours?: number;
  }): this {
    this.h1("Manpower");
    this.statRow([
      { label: "Total Headcount", value: String(opts.totalHeadcount) },
      { label: "Total Hours", value: opts.totalHours.toFixed(1) },
      { label: "Planned Hours", value: opts.plannedHours === undefined ? "—" : opts.plannedHours.toFixed(1) },
    ]);
    this.table(
      [{ header: "Trade" }, { header: "Headcount", width: 90, align: "right" }, { header: "Hours", width: 90, align: "right" }],
      opts.trades.map((t) => [t.trade, String(t.headcount), t.hoursThisPeriod.toFixed(1)]),
    );
    return this;
  }

  lookAheadSection(opts: {
    weeks: 3 | 2;
    activities: Array<{ activity: string; owner: string; startDate: string; blockers?: string }>;
  }): this {
    this.h1(`${opts.weeks}-Week Look Ahead`);
    this.table(
      [{ header: "Activity" }, { header: "Owner", width: 110 }, { header: "Start", width: 90 }, { header: "Blockers", width: 130 }],
      opts.activities.map((a) => [a.activity, a.owner, formatDate(a.startDate), a.blockers ?? "—"]),
    );
    return this;
  }

  photosSection(opts: { captions: string[]; note?: string }): this {
    this.h1("Progress Photos");
    if (opts.note) this.p(opts.note, { muted: true });

    const d = this.doc;
    const gap = 12;
    const w = (CONTENT_W - gap) / 2;
    const h = w * 0.62;

    for (let i = 0; i < opts.captions.length; i += 2) {
      const pair = opts.captions.slice(i, i + 2);
      this.ensure(h + 26);
      const top = d.y;
      pair.forEach((caption, j) => {
        const x = MARGIN + j * (w + gap);
        d.roundedRect(x, top, w, h, 3).fill(PALETTE.bgTint);
        d.font("Helvetica-Oblique").fontSize(8).fillColor(PALETTE.muted)
          .text("Photo placeholder", x, top + h / 2 - 5, { width: w, align: "center", lineBreak: false });
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.primary)
          .text(caption, x, top + h + 4, { width: w });
      });
      d.y = top + h + 24;
    }
    this.resetText();
    return this;
  }

  signOffBlock(opts: { signers: Array<{ role: string; name: string; date?: string }> }): this {
    this.h1("Approvals & Sign-Off");
    this.p(
      "By signing below, each party acknowledges review of this report and concurrence with its contents.",
      { muted: true },
    );

    const d = this.doc;
    const gap = 24;
    const w = (CONTENT_W - gap) / 2;

    for (let i = 0; i < opts.signers.length; i += 2) {
      const pair = opts.signers.slice(i, i + 2);
      this.ensure(72);
      const top = d.y + 10;
      pair.forEach((s, j) => {
        const x = MARGIN + j * (w + gap);
        d.moveTo(x, top + 26).lineTo(x + w, top + 26).lineWidth(0.8).strokeColor(PALETTE.primary).stroke();
        // The rule above already is the signature line; an underscore
        // placeholder under it just reads as a doubled line.
        if (s.name) {
          d.font("Helvetica-Bold").fontSize(9).fillColor(PALETTE.primary)
            .text(s.name, x, top + 31, { width: w, lineBreak: false });
        }
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted)
          .text(s.role, x, top + 42, { width: w, lineBreak: false });
        d.font("Helvetica").fontSize(8).fillColor(PALETTE.muted)
          .text(`Date: ${s.date ? formatDate(s.date) : "_______________"}`, x, top + 54, { width: w, lineBreak: false });
      });
      d.y = top + 74;
    }
    this.resetText();
    return this;
  }

  appendix(sections: Array<{ title: string; body: string }>): this {
    this.sectionBreak();
    this.h1("Appendix");
    for (const s of sections) {
      this.h2(s.title);
      this.p(s.body);
    }
    return this;
  }
}
