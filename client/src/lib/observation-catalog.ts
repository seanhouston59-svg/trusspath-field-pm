// Pre-written observation titles for the Field kit observation form.
//
// Observations have four kinds \u2014 safety, quality, RFI, and issue. Each has
// its own vocabulary of common titles, so the typeahead is filtered by the
// currently selected kind. Free-typed titles still work if nothing matches.

export type ObservationKind = "safety" | "quality" | "rfi" | "issue";

export type ObservationTitleTemplate = {
  label: string;   // full title text
  kind: ObservationKind;
};

export const OBSERVATION_TITLE_TEMPLATES: ObservationTitleTemplate[] = [
  // --- SAFETY ---
  { kind: "safety", label: "Missing handrail on scaffold" },
  { kind: "safety", label: "Unsecured ladder in use" },
  { kind: "safety", label: "Trip hazard \u2014 cords across walkway" },
  { kind: "safety", label: "Unprotected edge / floor opening" },
  { kind: "safety", label: "Worker without hard hat" },
  { kind: "safety", label: "Worker without eye protection" },
  { kind: "safety", label: "Worker without fall protection at height" },
  { kind: "safety", label: "Worker without hi-vis vest" },
  { kind: "safety", label: "Improper PPE for task" },
  { kind: "safety", label: "Fire extinguisher missing / expired" },
  { kind: "safety", label: "Blocked emergency exit" },
  { kind: "safety", label: "Blocked fire lane / hydrant" },
  { kind: "safety", label: "Housekeeping \u2014 debris pile in walkway" },
  { kind: "safety", label: "Unlabeled chemical container" },
  { kind: "safety", label: "SDS not on site for chemical in use" },
  { kind: "safety", label: "Damaged / frayed extension cord" },
  { kind: "safety", label: "Ungrounded electrical tool" },
  { kind: "safety", label: "Open electrical panel unattended" },
  { kind: "safety", label: "Silica dust \u2014 no water suppression / vacuum" },
  { kind: "safety", label: "Overhead work without exclusion zone" },
  { kind: "safety", label: "Crane / lift operating outside barricade" },
  { kind: "safety", label: "Trench without shoring / spoils too close" },
  { kind: "safety", label: "Confined space entry without permit" },
  { kind: "safety", label: "Near miss \u2014 dropped object" },
  { kind: "safety", label: "First aid administered \u2014 minor" },

  // --- QUALITY ---
  { kind: "quality", label: "Workmanship not per spec" },
  { kind: "quality", label: "Framing out of plumb" },
  { kind: "quality", label: "Concrete honeycombing" },
  { kind: "quality", label: "Concrete cold joint" },
  { kind: "quality", label: "Rebar spacing not per drawing" },
  { kind: "quality", label: "Missing blocking in wall" },
  { kind: "quality", label: "Drywall finish level below spec" },
  { kind: "quality", label: "Paint coverage inconsistent" },
  { kind: "quality", label: "Wrong paint color used" },
  { kind: "quality", label: "Tile layout not centered per plan" },
  { kind: "quality", label: "Grout color / joint width off" },
  { kind: "quality", label: "Flooring transitions uneven" },
  { kind: "quality", label: "Door / frame not plumb" },
  { kind: "quality", label: "Hardware set incorrect for door" },
  { kind: "quality", label: "Window / storefront leak at sill" },
  { kind: "quality", label: "Sealant joint fails adhesion" },
  { kind: "quality", label: "MEP rough-in interferes with plan" },
  { kind: "quality", label: "Duct hangers not per SMACNA" },
  { kind: "quality", label: "Piping insulation missing at joints" },
  { kind: "quality", label: "Fixture not level / aligned" },
  { kind: "quality", label: "Cover plate scratched or damaged" },
  { kind: "quality", label: "Roof flashing not per detail" },
  { kind: "quality", label: "Site utility slope reversed" },
  { kind: "quality", label: "Concrete finish outside tolerance" },

  // --- RFI ---
  { kind: "rfi", label: "Dimension conflict between arch and structural" },
  { kind: "rfi", label: "Missing dimension on plan" },
  { kind: "rfi", label: "Detail called out but not shown" },
  { kind: "rfi", label: "Existing condition differs from plan" },
  { kind: "rfi", label: "Beam pocket location conflict" },
  { kind: "rfi", label: "MEP routing conflicts with structural" },
  { kind: "rfi", label: "Ceiling height conflict with ductwork" },
  { kind: "rfi", label: "Door swing conflict with equipment" },
  { kind: "rfi", label: "Slab elevation appears incorrect" },
  { kind: "rfi", label: "Column line dimension unclear" },
  { kind: "rfi", label: "Finish schedule missing for room" },
  { kind: "rfi", label: "Fixture cut sheet does not match plan" },
  { kind: "rfi", label: "Waterproofing detail unclear at transition" },
  { kind: "rfi", label: "Firestopping detail missing at penetration" },
  { kind: "rfi", label: "Existing utility not shown on civil" },
  { kind: "rfi", label: "Grade elevation conflict with landscape" },

  // --- ISSUE ---
  { kind: "issue", label: "Material delivery delayed" },
  { kind: "issue", label: "Wrong material delivered" },
  { kind: "issue", label: "Damaged material on arrival" },
  { kind: "issue", label: "Short shipment \u2014 quantity below order" },
  { kind: "issue", label: "Weather delay this shift" },
  { kind: "issue", label: "Subcontractor no-show" },
  { kind: "issue", label: "Trade stacking / crew conflict" },
  { kind: "issue", label: "Power / water not available on site" },
  { kind: "issue", label: "Elevator / hoist out of service" },
  { kind: "issue", label: "Access blocked by other trade" },
  { kind: "issue", label: "Inspection failed \u2014 corrections needed" },
  { kind: "issue", label: "Inspector not on site as scheduled" },
  { kind: "issue", label: "Owner request \u2014 potential change" },
  { kind: "issue", label: "Existing condition damaged during work" },
  { kind: "issue", label: "Utility strike / near-strike" },
  { kind: "issue", label: "Vandalism / theft on site" },
  { kind: "issue", label: "Neighbor complaint (noise / dust / access)" },
  { kind: "issue", label: "Permit / inspection card missing" },
];

export function titlesForObservationKind(kind: ObservationKind): ObservationTitleTemplate[] {
  return OBSERVATION_TITLE_TEMPLATES.filter((t) => t.kind === kind);
}
