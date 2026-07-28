// Standard picklists for the New Punch Item dialog.
// Each item template is tagged to the trade that typically owns the fix, so
// the UI can auto-fill Trade when an item is picked and, going the other
// direction, narrow the item list once a Trade is chosen.
//
// Trade strings here MUST match entries in PUNCH_TRADES exactly.

export type PunchItemTemplate = { label: string; trade: string };

// Common punch item templates, sorted alphabetically inside each trade group
// for reviewability. The runtime UI sorts and filters as needed.
export const PUNCH_ITEM_TEMPLATES: PunchItemTemplate[] = [
  // Concrete
  { label: "Chip and patch concrete spall", trade: "Concrete" },
  { label: "Grind smooth uneven slab", trade: "Concrete" },
  { label: "Grout base plate", trade: "Concrete" },
  { label: "Level uneven floor", trade: "Concrete" },
  { label: "Repair concrete crack", trade: "Concrete" },
  { label: "Repair exposed rebar", trade: "Concrete" },

  // Drywall
  { label: "Fix drywall damage", trade: "Drywall" },
  { label: "Level uneven wall", trade: "Drywall" },
  { label: "Repair drywall corner bead", trade: "Drywall" },
  { label: "Touch up drywall texture", trade: "Drywall" },

  // Framing — Wood / Steel
  { label: "Reframe misaligned wall", trade: "Framing \u2014 Wood" },
  { label: "Straighten bowed stud", trade: "Framing \u2014 Wood" },

  // Doors, Frames & Hardware
  { label: "Adjust door alignment", trade: "Doors, Frames & Hardware" },
  { label: "Adjust door closer", trade: "Doors, Frames & Hardware" },
  { label: "Install door hardware", trade: "Doors, Frames & Hardware" },
  { label: "Install missing door stop", trade: "Doors, Frames & Hardware" },
  { label: "Rehang misaligned door", trade: "Doors, Frames & Hardware" },
  { label: "Repair damaged door frame", trade: "Doors, Frames & Hardware" },
  { label: "Replace broken door hardware", trade: "Doors, Frames & Hardware" },
  { label: "Replace damaged door", trade: "Doors, Frames & Hardware" },

  // Windows / Glass
  { label: "Replace broken window", trade: "Windows" },
  { label: "Reseal window", trade: "Windows" },
  { label: "Clean glass", trade: "Glass & Glazing" },

  // Painting
  { label: "Match paint color", trade: "Painting" },
  { label: "Refinish scuffed surface", trade: "Painting" },
  { label: "Retouch paint", trade: "Painting" },
  { label: "Sand and repaint", trade: "Painting" },
  { label: "Strip and refinish trim", trade: "Painting" },
  { label: "Touch up finishes", trade: "Painting" },

  // Caulking & Sealants
  { label: "Caulk fixture to counter", trade: "Caulking & Sealants" },
  { label: "Caulk gap", trade: "Caulking & Sealants" },
  { label: "Reseal exterior joint", trade: "Caulking & Sealants" },
  { label: "Reseal joint", trade: "Caulking & Sealants" },

  // Flooring
  { label: "Regrout tile", trade: "Flooring \u2014 Tile" },
  { label: "Replace cracked tile", trade: "Flooring \u2014 Tile" },
  { label: "Reseat loose tile", trade: "Flooring \u2014 Tile" },
  { label: "Replace damaged flooring", trade: "Flooring \u2014 Resilient" },
  { label: "Reseat transition strip", trade: "Flooring \u2014 Resilient" },
  { label: "Stretch or replace carpet", trade: "Flooring \u2014 Carpet" },

  // Cabinets & Millwork
  { label: "Adjust cabinet door", trade: "Cabinets & Millwork" },
  { label: "Realign millwork joint", trade: "Cabinets & Millwork" },
  { label: "Repair damaged trim", trade: "Carpentry \u2014 Finish" },

  // Ceiling / Acoustical
  { label: "Realign ceiling grid", trade: "Ceiling" },
  { label: "Replace ceiling tile", trade: "Ceiling" },
  { label: "Repair ceiling stain", trade: "Ceiling" },

  // HVAC
  { label: "Adjust HVAC diffuser", trade: "HVAC" },
  { label: "Balance HVAC airflow", trade: "HVAC" },
  { label: "Insulate exposed duct", trade: "HVAC" },
  { label: "Repair damaged ductwork", trade: "HVAC" },
  { label: "Replace damaged HVAC filter", trade: "HVAC" },
  { label: "Replace missing diffuser", trade: "HVAC" },

  // Electrical
  { label: "Cover open junction box", trade: "Electrical" },
  { label: "Fix loose outlet", trade: "Electrical" },
  { label: "Install missing cover plate", trade: "Electrical" },
  { label: "Label electrical panel", trade: "Electrical" },
  { label: "Replace faulty switch", trade: "Electrical" },
  { label: "Reroute exposed conduit", trade: "Electrical" },
  { label: "Terminate loose wiring", trade: "Electrical" },

  // Lighting
  { label: "Reaim recessed light", trade: "Lighting" },
  { label: "Replace burned-out lamp", trade: "Lighting" },
  { label: "Replace damaged fixture", trade: "Lighting" },

  // Plumbing
  { label: "Adjust plumbing trim", trade: "Plumbing" },
  { label: "Fix leaking fixture", trade: "Plumbing" },
  { label: "Install missing escutcheon", trade: "Plumbing" },
  { label: "Repair damaged pipe", trade: "Plumbing" },
  { label: "Replace damaged plumbing fixture", trade: "Plumbing" },
  { label: "Reset toilet", trade: "Plumbing" },
  { label: "Reset trap", trade: "Plumbing" },

  // Fire Protection / Life Safety
  { label: "Install missing exit sign", trade: "Fire Alarm" },
  { label: "Test fire alarm device", trade: "Fire Alarm" },
  { label: "Install missing fire caulking", trade: "Fireproofing" },
  { label: "Replace damaged sprinkler head", trade: "Fire Protection / Sprinkler" },

  // Roofing / Envelope
  { label: "Repair damaged flashing", trade: "Roofing" },
  { label: "Repair damaged roof membrane", trade: "Roofing" },
  { label: "Reseal roof penetration", trade: "Roofing" },
  { label: "Replace damaged siding", trade: "Waterproofing" },

  // Masonry / Stone
  { label: "Repoint masonry joint", trade: "Masonry" },
  { label: "Repair damaged stone", trade: "Stone" },

  // Site / Landscape
  { label: "Regrade site drainage", trade: "Earthwork" },
  { label: "Repair damaged asphalt", trade: "Asphalt" },
  { label: "Repair damaged curb", trade: "Concrete" },
  { label: "Restripe parking lot", trade: "Asphalt" },
  { label: "Reinstall damaged fencing", trade: "Fencing" },
  { label: "Replace damaged landscape", trade: "Landscaping" },

  // Cleaning
  { label: "Clean construction debris", trade: "Cleaning" },
  { label: "Complete final cleaning", trade: "Cleaning" },
  { label: "Deep clean bathroom fixtures", trade: "Cleaning" },
  { label: "Remove construction adhesive", trade: "Cleaning" },
  { label: "Remove protective film", trade: "Cleaning" },

  // Commissioning / Docs
  { label: "Complete equipment commissioning", trade: "Commissioning" },
  { label: "Provide missing O&M manual", trade: "Commissioning" },
  { label: "Provide warranty documentation", trade: "Commissioning" },
  { label: "Update as-built drawings", trade: "General Conditions" },
];

// Canonical CSI-adjacent trade list. Ordered alphabetically for scanability.
export const PUNCH_TRADES: string[] = [
  "Acoustical",
  "Asphalt",
  "Cabinets & Millwork",
  "Carpentry \u2014 Finish",
  "Carpentry \u2014 Rough",
  "Caulking & Sealants",
  "Ceiling",
  "Cleaning",
  "Commissioning",
  "Concrete",
  "Curtain Wall",
  "Demolition",
  "Doors, Frames & Hardware",
  "Drywall",
  "Earthwork",
  "Electrical",
  "Elevator",
  "Excavation",
  "Fencing",
  "Fire Alarm",
  "Fire Protection / Sprinkler",
  "Fireproofing",
  "Flooring \u2014 Carpet",
  "Flooring \u2014 Resilient",
  "Flooring \u2014 Tile",
  "Flooring \u2014 Wood",
  "Framing \u2014 Steel",
  "Framing \u2014 Wood",
  "General Conditions",
  "Glass & Glazing",
  "HVAC",
  "Insulation",
  "Landscaping",
  "Lighting",
  "Low Voltage",
  "Masonry",
  "Metals \u2014 Miscellaneous",
  "Painting",
  "Plumbing",
  "Roofing",
  "Signage",
  "Site Utilities",
  "Steel \u2014 Structural",
  "Stone",
  "Stucco / EIFS",
  "Tile",
  "Utilities",
  "Waterproofing",
  "Windows",
];

// Priority is short and standardized.
export const PUNCH_PRIORITIES: string[] = ["Critical", "High", "Medium", "Low"];

// Kept for backward compatibility with existing imports; the combo box UI
// no longer needs an explicit "Other" sentinel because free-typing is the
// escape hatch.
export const PUNCH_OTHER = "__other__";

// Helper: given the current trade text (may be free-typed or empty), return
// the item labels that make sense to show. If nothing is picked yet, return
// all templates. If the trade doesn't match any known template, return all
// templates too (don't leave the user staring at an empty list).
export function itemsForTrade(trade: string): PunchItemTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return PUNCH_ITEM_TEMPLATES;
  const matches = PUNCH_ITEM_TEMPLATES.filter((it) => it.trade.toLowerCase() === t);
  return matches.length > 0 ? matches : PUNCH_ITEM_TEMPLATES;
}

// Helper: given an item label the user picked/typed, return the trade tagged
// on that template (empty string if it's a free-typed / unknown item).
export function tradeForItem(item: string): string {
  const t = item.trim().toLowerCase();
  if (!t) return "";
  const hit = PUNCH_ITEM_TEMPLATES.find((it) => it.label.toLowerCase() === t);
  return hit?.trade ?? "";
}
