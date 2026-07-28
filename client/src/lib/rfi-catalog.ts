// Common RFI subject templates + typical trades. Used by the New RFI dialog
// to power a type-to-filter combo box and to auto-fill Trade when a subject
// is picked. Subjects are lightly grouped by discipline for reviewability;
// the runtime UI just filters through the whole list.
//
// Trade names should match PUNCH_TRADES entries so the two catalogs stay
// consistent \u2014 same drop-down, same values.

export type RfiSubjectTemplate = { label: string; trade: string };

export const RFI_SUBJECT_TEMPLATES: RfiSubjectTemplate[] = [
  // Architectural
  { label: "Clarify door schedule discrepancy", trade: "Doors, Frames & Hardware" },
  { label: "Clarify finish schedule discrepancy", trade: "Painting" },
  { label: "Clarify window schedule discrepancy", trade: "Windows" },
  { label: "Confirm room dimensions", trade: "General Conditions" },
  { label: "Confirm wall type / assembly", trade: "Drywall" },
  { label: "Request revised architectural detail", trade: "General Conditions" },

  // Structural
  { label: "Clarify beam-to-column connection", trade: "Steel \u2014 Structural" },
  { label: "Clarify rebar layout / lap length", trade: "Concrete" },
  { label: "Clarify slab-on-grade thickness", trade: "Concrete" },
  { label: "Clarify structural steel connection", trade: "Steel \u2014 Structural" },
  { label: "Confirm anchor bolt embedment", trade: "Concrete" },
  { label: "Confirm shear wall nailing pattern", trade: "Framing \u2014 Wood" },

  // Mechanical / HVAC
  { label: "Clarify duct routing conflict", trade: "HVAC" },
  { label: "Clarify equipment specification", trade: "HVAC" },
  { label: "Confirm HVAC diffuser locations", trade: "HVAC" },
  { label: "Confirm thermostat locations", trade: "HVAC" },

  // Electrical
  { label: "Clarify branch circuit routing", trade: "Electrical" },
  { label: "Clarify device mounting height", trade: "Electrical" },
  { label: "Clarify panel schedule", trade: "Electrical" },
  { label: "Confirm fixture specification", trade: "Lighting" },
  { label: "Confirm lighting control zoning", trade: "Lighting" },
  { label: "Confirm receptacle locations", trade: "Electrical" },

  // Plumbing
  { label: "Clarify fixture rough-in dimensions", trade: "Plumbing" },
  { label: "Clarify pipe routing conflict", trade: "Plumbing" },
  { label: "Confirm fixture specification", trade: "Plumbing" },
  { label: "Confirm floor drain locations", trade: "Plumbing" },

  // Fire protection / life safety
  { label: "Clarify sprinkler head coverage", trade: "Fire Protection / Sprinkler" },
  { label: "Confirm exit sign locations", trade: "Fire Alarm" },
  { label: "Confirm fire alarm device layout", trade: "Fire Alarm" },
  { label: "Confirm fire caulking assembly", trade: "Fireproofing" },

  // Envelope / roofing
  { label: "Clarify curtain wall detail", trade: "Curtain Wall" },
  { label: "Clarify flashing detail", trade: "Roofing" },
  { label: "Clarify roof drain locations", trade: "Roofing" },
  { label: "Clarify waterproofing detail", trade: "Waterproofing" },

  // Finishes
  { label: "Clarify ceiling grid layout", trade: "Ceiling" },
  { label: "Clarify flooring transition detail", trade: "Flooring \u2014 Resilient" },
  { label: "Clarify millwork elevation", trade: "Cabinets & Millwork" },
  { label: "Confirm paint color / finish", trade: "Painting" },
  { label: "Confirm tile pattern / layout", trade: "Flooring \u2014 Tile" },

  // Site / civil
  { label: "Clarify grading / elevation", trade: "Earthwork" },
  { label: "Clarify site utility routing", trade: "Site Utilities" },
  { label: "Confirm pavement section", trade: "Asphalt" },

  // Coordination / general
  { label: "Coordinate MEP above ceiling", trade: "HVAC" },
  { label: "Request substitution approval", trade: "General Conditions" },
  { label: "Verify existing conditions", trade: "General Conditions" },
];

export function tradeForRfiSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (!s) return "";
  const hit = RFI_SUBJECT_TEMPLATES.find((t) => t.label.toLowerCase() === s);
  return hit?.trade ?? "";
}

export function subjectsForTrade(trade: string): RfiSubjectTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return RFI_SUBJECT_TEMPLATES;
  const hits = RFI_SUBJECT_TEMPLATES.filter((s) => s.trade.toLowerCase() === t);
  return hits.length > 0 ? hits : RFI_SUBJECT_TEMPLATES;
}
