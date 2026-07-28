// Pre-written work notes / descriptions for Field kit punch items.
//
// The Punch title is a short one-liner ("Paint touch-up on north wall").
// The notes field is where the foreman adds the *actual work needed* \u2014
// what to fix, where, quantities, materials. These templates give a
// consistent starting point so items are actionable for whoever picks them
// up later, without the foreman thumbing out a paragraph on a phone.
//
// Grouped by trade to match the field-kit tile grid. "General" is a
// catch-all for site/access/coordination issues.

export type PunchNotesTemplate = {
  label: string;   // short button label
  text: string;    // full text inserted into the notes textarea
  trade: string;   // used to filter / group
};

export const PUNCH_NOTES_TEMPLATES: PunchNotesTemplate[] = [
  // --- General ---
  {
    label: "Access blocked",
    trade: "General",
    text:
      "Area currently blocked by [material/other trade]. Need it cleared before this work can start. Please coordinate with [TRADE] to move by [DATE].",
  },
  {
    label: "Missing signage",
    trade: "General",
    text:
      "Signage missing / incorrect at [LOCATION]. Verify against approved sign package and install / correct.",
  },
  {
    label: "Housekeeping",
    trade: "General",
    text:
      "Debris and material left in the space at [LOCATION]. Clean up and remove all trash, offcuts, and packaging.",
  },

  // --- Concrete ---
  {
    label: "Concrete honeycomb",
    trade: "Concrete",
    text:
      "Honeycombing / voids visible in concrete at [LOCATION]. Grind, patch with structural repair mortar per spec, and match finish. Notify structural if depth exceeds cover.",
  },
  {
    label: "Concrete crack",
    trade: "Concrete",
    text:
      "Crack observed at [LOCATION], approx. [LENGTH] long, [WIDTH] wide. Route and seal per spec; verify with structural if wider than 1/16\u201d or through-slab.",
  },

  // --- Framing ---
  {
    label: "Framing out of plumb",
    trade: "Framing",
    text:
      "Wall / column at [LOCATION] out of plumb by ~[MEASUREMENT]. Straighten and re-brace before drywall goes up.",
  },
  {
    label: "Missing blocking",
    trade: "Framing",
    text:
      "Blocking missing at [LOCATION] for [TV mount / grab bar / cabinets / handrail]. Install per detail before wall closure.",
  },

  // --- Drywall ---
  {
    label: "Drywall damage",
    trade: "Drywall",
    text:
      "Damaged gyp board at [LOCATION] \u2014 [describe: gouge / dent / hole size]. Cut back to nearest stud, replace section, tape, mud, sand, and prime to match.",
  },
  {
    label: "Drywall finish level",
    trade: "Drywall",
    text:
      "Finish at [LOCATION] not at spec level [3/4/5]. Additional coat and sanding required. Verify under critical lighting before paint.",
  },
  {
    label: "Corner bead",
    trade: "Drywall",
    text:
      "Corner bead damaged / bowed at [LOCATION]. Cut out, replace bead, tape and mud to match adjacent finish.",
  },

  // --- Electrical ---
  {
    label: "Missing device plate",
    trade: "Electrical",
    text:
      "Cover plate missing at [device] at [LOCATION]. Install matching plate; verify device is flush and level.",
  },
  {
    label: "Fixture crooked",
    trade: "Electrical",
    text:
      "Light fixture at [LOCATION] not level / aligned with ceiling grid. Reset fixture, verify hangers, and level to grid.",
  },
  {
    label: "Circuit not working",
    trade: "Electrical",
    text:
      "Outlet / switch at [LOCATION] non-functional. Trace to panel [ID] circuit [#], verify connections, and confirm at device with meter.",
  },
  {
    label: "Label panel",
    trade: "Electrical",
    text:
      "Panel [ID] at [LOCATION] missing / incorrect circuit directory. Label all circuits with current room usage per as-built.",
  },

  // --- Plumbing ---
  {
    label: "Leak",
    trade: "Plumbing",
    text:
      "Active leak at [LOCATION] \u2014 [supply / drain / fitting]. Isolate, dry the area, repair connection, and re-test at operating pressure.",
  },
  {
    label: "Fixture alignment",
    trade: "Plumbing",
    text:
      "Fixture at [LOCATION] not level / caulk gap uneven. Reset trim, re-caulk with matching sealant, and clean overspray.",
  },
  {
    label: "Slow drain",
    trade: "Plumbing",
    text:
      "Drain at [LOCATION] running slow. Snake / clear line, then verify flow rate. Check trap for debris from construction.",
  },

  // --- HVAC ---
  {
    label: "Diffuser adjustment",
    trade: "HVAC",
    text:
      "Diffuser at [LOCATION] delivering [too much / too little] air. Verify balance report, adjust damper, and re-read airflow.",
  },
  {
    label: "Duct leak",
    trade: "HVAC",
    text:
      "Air leak at duct joint near [LOCATION]. Reseal per SMACNA (mastic + mesh), re-insulate, and re-test static.",
  },
  {
    label: "Filter change",
    trade: "HVAC",
    text:
      "Construction filters need to be swapped to permanent filters at [EQUIPMENT ID]. Verify size and MERV per spec.",
  },

  // --- Paint ---
  {
    label: "Paint touch-up",
    trade: "Paint",
    text:
      "Touch-up needed at [LOCATION] \u2014 [scuff / roller mark / drip]. Use paint labeled for this room from the closeout kit. Feather in edges.",
  },
  {
    label: "Paint holidays",
    trade: "Paint",
    text:
      "Coverage inconsistent at [LOCATION] \u2014 holidays and roller lines visible under critical light. Apply additional finish coat.",
  },
  {
    label: "Wrong color",
    trade: "Paint",
    text:
      "Color at [LOCATION] does not match approved schedule. Verify against room finish schedule, re-paint with correct SW/BM #.",
  },

  // --- Flooring ---
  {
    label: "Flooring damage",
    trade: "Flooring",
    text:
      "Damaged flooring at [LOCATION] \u2014 [scratch / dent / stain]. Replace affected tiles / planks with matching stock, re-set transitions.",
  },
  {
    label: "Transition strip",
    trade: "Flooring",
    text:
      "Transition strip missing / damaged at [LOCATION]. Install matching profile and secure per manufacturer.",
  },
  {
    label: "Base gap",
    trade: "Flooring",
    text:
      "Gap between base and floor / wall at [LOCATION]. Re-set base, caulk / paint to match.",
  },

  // --- Roofing ---
  {
    label: "Ponding water",
    trade: "Roofing",
    text:
      "Ponding water observed at [LOCATION] more than 48 hrs after rain. Verify drain / slope, clear any blockage, and confirm no membrane damage.",
  },
  {
    label: "Flashing detail",
    trade: "Roofing",
    text:
      "Flashing at [LOCATION] not per detail. Re-work per approved shop drawings; ensure counterflashing lapping and sealants.",
  },
];

export const PUNCH_NOTES_TRADES: string[] = [
  "General",
  "Concrete",
  "Framing",
  "Drywall",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Paint",
  "Flooring",
  "Roofing",
];

export function punchNotesForTrade(trade: string): PunchNotesTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return PUNCH_NOTES_TEMPLATES;
  const hits = PUNCH_NOTES_TEMPLATES.filter((s) => s.trade.toLowerCase() === t);
  return hits.length > 0 ? hits : PUNCH_NOTES_TEMPLATES;
}
