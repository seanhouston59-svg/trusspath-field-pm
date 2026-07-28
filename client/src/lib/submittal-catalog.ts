// Common Submittal subject templates + typical trades. Used by the New
// Submittal dialog to power a type-to-filter combo box and to auto-fill
// Trade when a subject is picked.
//
// Trade names should match PUNCH_TRADES entries so all four catalogs stay
// consistent (Punch, RFI, Change Order, Submittal).

export type SubmittalSubjectTemplate = { label: string; trade: string };

export const SUBMITTAL_SUBJECT_TEMPLATES: SubmittalSubjectTemplate[] = [
  // Concrete / structural
  { label: "Concrete mix design", trade: "Concrete" },
  { label: "Rebar shop drawings", trade: "Concrete" },
  { label: "Structural steel shop drawings", trade: "Steel \u2014 Structural" },
  { label: "Steel connection calculations", trade: "Steel \u2014 Structural" },
  { label: "Anchor bolt layout", trade: "Concrete" },

  // Framing
  { label: "Cold-formed metal framing shop drawings", trade: "Framing \u2014 Steel" },
  { label: "Wood truss shop drawings", trade: "Framing \u2014 Wood" },

  // Masonry / envelope
  { label: "Masonry mix design", trade: "Masonry" },
  { label: "Curtain wall shop drawings", trade: "Curtain Wall" },
  { label: "Storefront system shop drawings", trade: "Glass & Glazing" },
  { label: "Window shop drawings", trade: "Windows" },
  { label: "Roofing system product data", trade: "Roofing" },
  { label: "Waterproofing product data", trade: "Waterproofing" },
  { label: "Insulation product data", trade: "Insulation" },

  // Interior finishes
  { label: "Door schedule and hardware sets", trade: "Doors, Frames & Hardware" },
  { label: "Drywall product data", trade: "Drywall" },
  { label: "Acoustical ceiling product data", trade: "Acoustical" },
  { label: "Ceiling grid shop drawings", trade: "Ceiling" },
  { label: "Paint product data and color samples", trade: "Painting" },
  { label: "Millwork shop drawings", trade: "Cabinets & Millwork" },
  { label: "Finish carpentry shop drawings", trade: "Carpentry \u2014 Finish" },

  // Flooring / tile / stone
  { label: "Flooring product samples", trade: "Flooring \u2014 Resilient" },
  { label: "Carpet product data and samples", trade: "Flooring \u2014 Carpet" },
  { label: "Tile shop drawings and samples", trade: "Flooring \u2014 Tile" },
  { label: "Wood flooring product data", trade: "Flooring \u2014 Wood" },
  { label: "Stone shop drawings and samples", trade: "Stone" },

  // Mechanical / HVAC
  { label: "HVAC equipment cut sheets", trade: "HVAC" },
  { label: "HVAC ductwork shop drawings", trade: "HVAC" },
  { label: "HVAC controls submittal", trade: "HVAC" },
  { label: "Test and balance report", trade: "HVAC" },

  // Plumbing
  { label: "Plumbing fixture cut sheets", trade: "Plumbing" },
  { label: "Plumbing riser diagram", trade: "Plumbing" },
  { label: "Backflow preventer submittal", trade: "Plumbing" },

  // Electrical / lighting / low voltage
  { label: "Electrical panel schedules", trade: "Electrical" },
  { label: "Switchgear shop drawings", trade: "Electrical" },
  { label: "Lighting fixture cut sheets", trade: "Lighting" },
  { label: "Lighting control system submittal", trade: "Lighting" },
  { label: "Fire alarm system shop drawings", trade: "Fire Alarm" },
  { label: "Low voltage cabling submittal", trade: "Low Voltage" },

  // Fire / life safety
  { label: "Fire sprinkler shop drawings", trade: "Fire Protection / Sprinkler" },
  { label: "Fire pump product data", trade: "Fire Protection / Sprinkler" },
  { label: "Fireproofing product data", trade: "Fireproofing" },

  // Elevator / conveying
  { label: "Elevator shop drawings", trade: "Elevator" },

  // Site / civil
  { label: "Asphalt mix design", trade: "Asphalt" },
  { label: "Site utility shop drawings", trade: "Site Utilities" },
  { label: "Erosion control plan", trade: "Earthwork" },
  { label: "Landscape plant list and samples", trade: "Landscaping" },

  // Specialties
  { label: "Signage shop drawings", trade: "Signage" },
  { label: "Stucco / EIFS product data", trade: "Stucco / EIFS" },
  { label: "Miscellaneous metals shop drawings", trade: "Metals \u2014 Miscellaneous" },

  // Commissioning / closeout
  { label: "Commissioning plan", trade: "Commissioning" },
  { label: "Startup and test procedures", trade: "Commissioning" },
  { label: "O&M manuals", trade: "Commissioning" },
];

export function tradeForSubmittalSubject(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (!s) return "";
  const hit = SUBMITTAL_SUBJECT_TEMPLATES.find((t) => t.label.toLowerCase() === s);
  return hit?.trade ?? "";
}

export function subjectsForTrade(trade: string): SubmittalSubjectTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return SUBMITTAL_SUBJECT_TEMPLATES;
  const hits = SUBMITTAL_SUBJECT_TEMPLATES.filter((s) => s.trade.toLowerCase() === t);
  return hits.length > 0 ? hits : SUBMITTAL_SUBJECT_TEMPLATES;
}
