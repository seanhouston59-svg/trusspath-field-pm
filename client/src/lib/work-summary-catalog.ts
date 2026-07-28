// Pre-written work summary templates for the Field kit daily log.
//
// These are meant as *starter text* \u2014 the field crew taps one, the template
// gets inserted into the "What got done" box, and they lightly edit it (fill
// in the location, add crew names, tweak quantities). Faster than typing on
// a phone in the middle of a jobsite.
//
// Grouped by trade/phase so the picker can render as a two-tab-ish list.

export type WorkSummaryTemplate = {
  label: string;   // short button label
  text: string;    // full text inserted into the textarea
  trade: string;   // used to group / filter
};

export const WORK_SUMMARY_TEMPLATES: WorkSummaryTemplate[] = [
  // --- General / crew day ---
  {
    label: "Standard crew day",
    trade: "General",
    text:
      "Crew on site from 7am to 3:30pm. Work continued per schedule with no incidents. Site cleaned at end of shift.",
  },
  {
    label: "Weather delay",
    trade: "General",
    text:
      "Weather delay this morning \u2014 crew held until [TIME] due to [rain/snow/high wind]. Productive hours reduced. Made up ground on covered/interior work.",
  },
  {
    label: "Safety toolbox talk",
    trade: "General",
    text:
      "Started shift with a safety toolbox talk on [TOPIC]. All crew present signed off. No incidents or near-misses reported.",
  },
  {
    label: "Materials delivery",
    trade: "General",
    text:
      "[MATERIAL] delivered at [TIME]. Off-loaded and staged at [LOCATION]. Quantities matched packing slip. No damage noted.",
  },
  {
    label: "Inspection",
    trade: "General",
    text:
      "[Building official / third-party inspector] on site for [SCOPE] inspection. Result: [pass / pass with corrections / fail]. Corrections listed in follow-up notes.",
  },

  // --- Concrete ---
  {
    label: "Concrete pour",
    trade: "Concrete",
    text:
      "Poured [QTY] CY of [MIX] at [LOCATION]. Placement start [TIME], finish [TIME]. Slump and air tested per spec. Cylinders taken. Cured / covered per plan.",
  },
  {
    label: "Formwork set",
    trade: "Concrete",
    text:
      "Set [wall / slab / footing] formwork at [LOCATION]. Lines and grades checked. Rebar and embeds coordinated with structural. Ready for inspection.",
  },
  {
    label: "Rebar install",
    trade: "Concrete",
    text:
      "Installed rebar per shop drawings at [LOCATION]. Sizes and spacing verified. Chairs and dobies in place. Ready for pre-pour inspection.",
  },

  // --- Framing ---
  {
    label: "Wall framing",
    trade: "Framing",
    text:
      "Framed [LEVEL / GRID] walls per plan. Studs, plates, and openings placed. Shear panels installed where called out. Straightened and braced.",
  },
  {
    label: "Floor / roof framing",
    trade: "Framing",
    text:
      "Set [joists / trusses / rafters] at [LEVEL]. Sheathing installed and nailed per schedule. Openings blocked and marked. Ready for MEP rough-in coordination.",
  },

  // --- Drywall ---
  {
    label: "Drywall hang",
    trade: "Drywall",
    text:
      "Hung [QTY] sheets of [type/thickness] gyp at [LOCATION]. Fastener spacing per code. Corners protected. Ready for tape.",
  },
  {
    label: "Drywall finish",
    trade: "Drywall",
    text:
      "Tape and mud, coat [1/2/3] at [LOCATION]. Sanded [level of finish]. Ready for prime.",
  },

  // --- Electrical ---
  {
    label: "Electrical rough-in",
    trade: "Electrical",
    text:
      "Ran branch circuits at [LEVEL / AREA]. Boxes set to finished-wall depth. Home-runs pulled to panel [ID]. Ready for rough-in inspection.",
  },
  {
    label: "Electrical trim",
    trade: "Electrical",
    text:
      "Devices, plates, and fixtures installed at [LOCATION]. Panels labeled. Circuits meggered and tested. GFI and AFCI verified. Ready for final.",
  },

  // --- Plumbing ---
  {
    label: "Plumbing rough-in",
    trade: "Plumbing",
    text:
      "Set DWV and water lines at [LOCATION]. Pressure test held at [PSI] for [DURATION]. Cleanouts and vents per code. Ready for inspection.",
  },
  {
    label: "Plumbing trim",
    trade: "Plumbing",
    text:
      "Set fixtures at [LOCATION]. Traps, escutcheons, and supply lines installed. Leak-checked at each connection. Ready for final walk.",
  },

  // --- HVAC ---
  {
    label: "HVAC rough-in",
    trade: "HVAC",
    text:
      "Set ductwork and equipment at [LEVEL / AREA]. Hangers per SMACNA. Refrigerant / condensate lines run. Ready for insulation and inspection.",
  },
  {
    label: "HVAC start-up",
    trade: "HVAC",
    text:
      "Started [EQUIPMENT ID] at [LOCATION]. Charged and verified refrigerant per manufacturer. Airflows read at diffusers. Controls confirmed with sequence of operations.",
  },

  // --- Paint ---
  {
    label: "Paint \u2014 prime",
    trade: "Paint",
    text:
      "Prepped and primed walls / ceilings at [LOCATION]. Cut lines, rolled fields. Ready for finish coat.",
  },
  {
    label: "Paint \u2014 finish",
    trade: "Paint",
    text:
      "Applied [1st/2nd] finish coat at [LOCATION]. Color [SW/BM #]. Touch-ups scheduled after final trades leave.",
  },

  // --- Flooring ---
  {
    label: "Flooring install",
    trade: "Flooring",
    text:
      "Installed [material] at [LOCATION]. Substrate prepped and moisture-tested per spec. Transitions and base coordinated with door frames.",
  },

  // --- Roofing ---
  {
    label: "Roofing install",
    trade: "Roofing",
    text:
      "Installed [system] on [AREA / SF]. Underlayment, insulation, and membrane per spec. Flashings and terminations detailed. Weather-tight at end of day.",
  },
];

// Trades in the order used by the Field kit tile grid. Anything not matching
// falls into "General".
export const WORK_SUMMARY_TRADES: string[] = [
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

export function summariesForTrade(trade: string): WorkSummaryTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return WORK_SUMMARY_TEMPLATES;
  const hits = WORK_SUMMARY_TEMPLATES.filter((s) => s.trade.toLowerCase() === t);
  return hits.length > 0 ? hits : WORK_SUMMARY_TEMPLATES;
}
