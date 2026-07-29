/**
 * Auto-classifier for sub-uploaded files.
 *
 * Three deterministic layers, no LLM call on the critical path:
 *   Layer 1 \u2014 metadata: project + sub company + trade are already known from
 *             the drop token + sub form. We could use trade as a nudge, but
 *             most classification comes from the filename or file type below.
 *   Layer 2 \u2014 filename patterns: catches ~70\u201380% of real construction docs
 *             because subs universally name things like "COI-2026.pdf" or
 *             "MSDS_MethyleneChloride.pdf".
 *   Layer 3 \u2014 file type: JPEG/PNG/HEIC always go to Site Photos; DWG/RVT
 *             would go to Shop Drawings; XLSX defaults to Financials for
 *             review.
 *
 * Anything the layers can't confidently classify falls into "Needs Sorting"
 * so the PM can drag it into the right folder. Their manual assignment can
 * become a learned pattern later; for MVP we just get out of their way.
 *
 * Return shape: { category, confidence } where confidence is the layer
 * number (2 or 3) that made the call, 0 for uncategorized. This is stored
 * on the sub_uploads row for future tuning.
 */
import type { SubUploadCategory } from "@shared/schema";

export type ClassifyResult = {
  category: SubUploadCategory;
  confidence: 0 | 1 | 2 | 3 | 4;
};

// Filename keyword \u2192 category. Order matters: earlier patterns win.
// Keep the LHS lowercase so callers can match case-insensitively without
// re-lowercasing the pattern every call. Each pattern is a substring match
// (not a regex) so it stays predictable and fast.
const FILENAME_PATTERNS: Array<[string[], SubUploadCategory]> = [
  // Insurance / COIs \u2014 checked first because "certificate" alone would
  // otherwise steal the safety-cert lane.
  [["coi", "certificate of insurance", "acord", "liability insurance", "cert of ins"], "Insurance / COIs"],
  // Safety data sheets
  [["msds", " sds ", "sds-", "sds_", "safety data", "material safety"], "Safety Data Sheets"],
  // Safety certifications \u2014 OSHA cards, 10/30-hour, silica, fall protection.
  [["osha", "safety cert", "safety training", "10-hour", "10 hour", "30-hour", "30 hour", "silica", "fall protection", "safety-cert"], "Safety Certifications"],
  // Tax / compliance
  [["w-9", "w9", " 1099", "1099-", "1099_", "tax id"], "Tax / Compliance"],
  // Shop drawings / submittals
  [["shop drawing", "shop dwg", "shop-dwg", "submittal", "sd-", "sd_"], "Shop Drawings"],
  // Financials \u2014 flagged for PM review by convention (subs usually shouldn't
  // send invoices through the drop portal but if they do we surface it fast).
  [["invoice", "inv-", "inv_", "pay app", "pay-app", "payapp", "application for payment", "aia g702", "aia g703"], "Financials"],
];

// MIME type \u2192 category fallback when the filename doesn't hit. Images are the
// dominant case: subs take a picture of a delivery, damage, or completed
// work and it's just "IMG_4821.jpg". Those go straight to Site Photos.
const MIME_DEFAULTS: Array<[RegExp, SubUploadCategory]> = [
  [/^image\//i, "Site Photos"],
  // Excel = usually a payroll summary, WIP report, or bid \u2014 review it.
  [/spreadsheetml|excel|ms-excel/i, "Financials"],
];

/**
 * Classify a single upload from its original filename and MIME type. Pure
 * function \u2014 no I/O, no side effects, safe to call inline in the upload
 * handler without adding latency.
 */
export function classifyUpload(originalFileName: string, mimeType: string): ClassifyResult {
  const name = (originalFileName || "").toLowerCase();

  // Layer 2 \u2014 filename patterns.
  for (const [keywords, category] of FILENAME_PATTERNS) {
    for (const kw of keywords) {
      if (name.includes(kw)) return { category, confidence: 2 };
    }
  }

  // Layer 3 \u2014 MIME type defaults.
  for (const [pattern, category] of MIME_DEFAULTS) {
    if (pattern.test(mimeType)) return { category, confidence: 3 };
  }

  // Unclassified \u2014 PM sorts manually. Not a bug, not an error, just an
  // "inbox for the residue" as designed.
  return { category: "Needs Sorting", confidence: 0 };
}
