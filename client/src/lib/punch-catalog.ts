// Standard picklists for the New Punch Item dialog.
// Keep these sorted A-Z within groups so the dropdown scans predictably.
// Users can always pick "Other\u2026" to type in something bespoke.

export const PUNCH_OTHER = "__other__";

// Common punch item templates. Structured as "<verb> <noun>" so a super can
// pick one and refine in the description if needed. Grouped mentally by
// discipline but rendered flat \u2014 the dropdown gets long, that's fine.
export const PUNCH_ITEM_TEMPLATES: string[] = [
  // Concrete / structural
  "Chip and patch concrete spall",
  "Grind smooth uneven slab",
  "Grout base plate",
  "Repair concrete crack",
  "Repair exposed rebar",

  // Framing / drywall
  "Fix drywall damage",
  "Level uneven wall",
  "Reframe misaligned wall",
  "Repair drywall corner bead",
  "Touch up drywall texture",

  // Doors, windows, hardware
  "Adjust door alignment",
  "Adjust door closer",
  "Install door hardware",
  "Install missing door stop",
  "Rehang misaligned door",
  "Repair damaged door frame",
  "Replace broken door hardware",
  "Replace broken window",
  "Replace damaged door",
  "Reseal window",

  // Paint & finishes
  "Caulk gap",
  "Match paint color",
  "Refinish scuffed surface",
  "Reseal joint",
  "Retouch paint",
  "Sand and repaint",
  "Strip and refinish trim",

  // Flooring
  "Level uneven floor",
  "Regrout tile",
  "Replace cracked tile",
  "Replace damaged flooring",
  "Reseat loose tile",
  "Reseat transition strip",
  "Stretch or replace carpet",

  // Ceiling
  "Realign ceiling grid",
  "Replace ceiling tile",
  "Repair ceiling stain",

  // MEP \u2014 mechanical
  "Adjust HVAC diffuser",
  "Balance HVAC airflow",
  "Insulate exposed duct",
  "Repair damaged ductwork",
  "Replace damaged HVAC filter",
  "Replace missing diffuser",

  // MEP \u2014 electrical
  "Cover open junction box",
  "Fix loose outlet",
  "Install missing cover plate",
  "Label electrical panel",
  "Reaim recessed light",
  "Replace burned-out lamp",
  "Replace damaged fixture",
  "Replace faulty switch",
  "Reroute exposed conduit",
  "Terminate loose wiring",

  // MEP \u2014 plumbing
  "Adjust plumbing trim",
  "Caulk fixture to counter",
  "Fix leaking fixture",
  "Install missing escutcheon",
  "Repair damaged pipe",
  "Replace damaged fixture",
  "Reset toilet",
  "Reset trap",

  // Fire / life safety
  "Install missing exit sign",
  "Install missing fire caulking",
  "Replace damaged sprinkler head",
  "Test fire alarm device",

  // Envelope / roofing
  "Repair damaged flashing",
  "Repair damaged roof membrane",
  "Reseal exterior joint",
  "Reseal roof penetration",
  "Replace damaged siding",

  // Site / exterior
  "Clean construction debris",
  "Regrade site drainage",
  "Reinstall damaged fencing",
  "Repair damaged asphalt",
  "Repair damaged curb",
  "Replace damaged landscape",
  "Restripe parking lot",

  // Cleanup / general
  "Clean glass",
  "Complete final cleaning",
  "Deep clean bathroom fixtures",
  "Remove construction adhesive",
  "Remove protective film",
  "Touch up finishes",

  // Documentation / commissioning
  "Complete equipment commissioning",
  "Provide missing O&M manual",
  "Provide warranty documentation",
  "Update as-built drawings",
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
