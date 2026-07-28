// Common Change Order title templates + typical trades. Used by the New
// Change Order dialog to power a type-to-filter combo box and to auto-fill
// Trade when a title is picked.
//
// Trade names should match PUNCH_TRADES entries so the two catalogs stay
// consistent.

export type CoTitleTemplate = { label: string; trade: string };

export const CO_TITLE_TEMPLATES: CoTitleTemplate[] = [
  // Design changes / owner-directed
  { label: "Add owner-directed scope", trade: "General Conditions" },
  { label: "Delete owner-directed scope", trade: "General Conditions" },
  { label: "Design change per owner request", trade: "General Conditions" },
  { label: "Value engineering credit", trade: "General Conditions" },

  // Concrete / structural
  { label: "Add concrete curb", trade: "Concrete" },
  { label: "Modify slab reinforcement", trade: "Concrete" },
  { label: "Revise foundation design", trade: "Concrete" },
  { label: "Structural steel modification", trade: "Steel \u2014 Structural" },

  // Architectural
  { label: "Add door / hardware set", trade: "Doors, Frames & Hardware" },
  { label: "Add window opening", trade: "Windows" },
  { label: "Delete interior partition", trade: "Drywall" },
  { label: "Modify wall assembly", trade: "Drywall" },
  { label: "Revise ceiling type", trade: "Ceiling" },
  { label: "Upgrade finish schedule", trade: "Painting" },
  { label: "Upgrade flooring specification", trade: "Flooring \u2014 Resilient" },
  { label: "Upgrade millwork specification", trade: "Cabinets & Millwork" },

  // Mechanical / HVAC
  { label: "Add HVAC zone", trade: "HVAC" },
  { label: "Ductwork rework for coordination", trade: "HVAC" },
  { label: "Equipment substitution", trade: "HVAC" },
  { label: "Revise HVAC controls scope", trade: "HVAC" },

  // Electrical / lighting
  { label: "Add electrical circuits", trade: "Electrical" },
  { label: "Add lighting fixtures", trade: "Lighting" },
  { label: "Lighting control upgrade", trade: "Lighting" },
  { label: "Modify panel schedule", trade: "Electrical" },

  // Plumbing
  { label: "Add plumbing fixtures", trade: "Plumbing" },
  { label: "Reroute plumbing for coordination", trade: "Plumbing" },

  // Fire / life safety
  { label: "Add fire alarm devices", trade: "Fire Alarm" },
  { label: "Add sprinkler coverage", trade: "Fire Protection / Sprinkler" },

  // Envelope / roofing
  { label: "Curtain wall upgrade", trade: "Curtain Wall" },
  { label: "Roofing scope revision", trade: "Roofing" },
  { label: "Waterproofing upgrade", trade: "Waterproofing" },

  // Site
  { label: "Add landscaping scope", trade: "Landscaping" },
  { label: "Site drainage revision", trade: "Earthwork" },
  { label: "Site utility rerouting", trade: "Site Utilities" },

  // Unforeseen conditions / impact
  { label: "Differing site condition impact", trade: "Earthwork" },
  { label: "Hazardous material abatement", trade: "Demolition" },
  { label: "Schedule acceleration", trade: "General Conditions" },
  { label: "Weather delay impact", trade: "General Conditions" },
];

export function tradeForCoTitle(title: string): string {
  const t = title.trim().toLowerCase();
  if (!t) return "";
  const hit = CO_TITLE_TEMPLATES.find((c) => c.label.toLowerCase() === t);
  return hit?.trade ?? "";
}

export function titlesForTrade(trade: string): CoTitleTemplate[] {
  const t = trade.trim().toLowerCase();
  if (!t) return CO_TITLE_TEMPLATES;
  const hits = CO_TITLE_TEMPLATES.filter((c) => c.trade.toLowerCase() === t);
  return hits.length > 0 ? hits : CO_TITLE_TEMPLATES;
}
