// Catalog for the 19 lean Executive OS modules (lifecycle order 4-22).
//
// Each entry defines what a module is called, what it's for, what its rows
// represent, and what categories those rows fall into. The client uses this
// to render module-appropriate labels; the server uses it to validate the
// moduleId query param and to know which slugs are still "lean" vs graduated.

export type LeanModuleDef = {
  /** URL slug + moduleId in lean_module_state / lean_module_items */
  slug: string;
  /** Human-readable module title, shown in page header + nav */
  title: string;
  /** One-line description of the module's scope */
  blurb: string;
  /** What a row in this module represents, singular. e.g. "Zone" for Site Logistics */
  itemNoun: string;
  /** Same as itemNoun but plural. e.g. "Zones" */
  itemNounPlural: string;
  /** Suggested category values shown as a dropdown when adding a row. */
  categories: string[];
  /**
   * Ghost / placeholder examples shown in the empty text inputs and textareas.
   * These are never persisted \u2014 they just guide the user on what to type.
   * See lean-module.tsx for how each field maps to a placeholder.
   */
  placeholders: {
    overview: string;
    risks: string;
    nextSteps: string;
    ownerName: string;
    itemTitle: string;
    itemOwner: string;
    itemNotes: string;
  };
};

/** Fallback placeholders for any module that doesn't declare its own. */
const DEFAULT_PLACEHOLDERS: LeanModuleDef["placeholders"] = {
  overview: "What is this module tracking on this project? Add scope notes, boundaries, and any decisions the team has made so far.",
  risks: "List known risks and open items. e.g. \u201cLong-lead item slipping\u201d, \u201cInspector unavailable next week\u201d.",
  nextSteps: "What needs to happen next. e.g. \u201cConfirm sub schedule by Friday\u201d, \u201cSubmit RFI on detail 3/A5.02\u201d.",
  ownerName: "e.g. Jordan Martinez",
  itemTitle: "Describe this item",
  itemOwner: "Owner name",
  itemNotes: "Notes",
};

export const LEAN_MODULES: LeanModuleDef[] = [
  {
    slug: "site-logistics",
    title: "Site Logistics & Temp Facilities",
    blurb:
      "How the jobsite is physically organized before trades arrive in force: laydown yards, staging areas, crane picks, hoists, temp utilities, gates, and traffic control.",
    itemNoun: "Logistics Item",
    itemNounPlural: "Logistics Items",
    categories: [
      "Zone / Laydown",
      "Temp Power",
      "Temp Water",
      "Temp Sanitation",
      "Temp Heat",
      "Temp Lighting",
      "Jobsite Internet",
      "Crane / Hoist",
      "Fencing",
      "Gates",
      "Badging / Access",
      "Cameras",
      "Traffic Control",
      "Delivery Window",
      "MOT Permit",
      "Signage",
    ],
    placeholders: {
      overview: "Where trailers, laydown, and crane picks sit; how deliveries route in; when temp power/water hit dates. e.g. “Crane on north side, laydown along east fence, MOT permit through 8/15.”",
      risks: "e.g. “Crane swing crosses ROW – need city sign-off”; “Temp power gear on 8wk lead”.",
      nextSteps: "e.g. “Lock crane pick plan Friday”; “Coordinate MOT permit with city by 8/12”.",
      ownerName: "e.g. Marcus Reyes, Superintendent",
      itemTitle: "e.g. Tower crane pick plan for Zone B",
      itemOwner: "e.g. Site Super",
      itemNotes: "e.g. Requires city MOT permit, 3-day lane closure",
    },
  },
  {
    slug: "sitework",
    title: "Sitework & Earthwork",
    blurb:
      "Clear-and-grub, mass excavation, cut/fill, erosion control, dewatering, underground utilities, and rough grading through pad-ready.",
    itemNoun: "Sitework Activity",
    itemNounPlural: "Sitework Activities",
    categories: [
      "Clear & Grub",
      "Demolition",
      "Mass Excavation",
      "Cut / Fill",
      "Erosion Control",
      "Dewatering",
      "Underground Utility",
      "Rough Grading",
      "Compaction / Testing",
      "Site Survey",
    ],
    placeholders: {
      overview: "Scope of earthwork, dewatering plan, offsite disposal, and utility tie-ins. e.g. “18k CY export, well-point dewatering north half.”",
      risks: "e.g. “Unsuitable soils in NW corner”; “Wet weather forecast slipping mass ex”.",
      nextSteps: "e.g. “Geotech to re-test pad prior to compaction”; “Schedule storm inlet inspection”.",
      ownerName: "e.g. Alicia Cheng, Site Super",
      itemTitle: "e.g. Mass excavation Zone A to elev 4820",
      itemOwner: "e.g. Excavation Sub",
      itemNotes: "e.g. Coordinate with dewatering; export to Yard 7",
    },
  },
  {
    slug: "foundations",
    title: "Foundations",
    blurb:
      "Footings, foundation walls, slab-on-grade, deep foundations (piles / piers / caissons), foundation waterproofing, and structural embeds.",
    itemNoun: "Foundation Activity",
    itemNounPlural: "Foundation Activities",
    categories: [
      "Footing",
      "Foundation Wall",
      "Slab-on-Grade",
      "Deep Foundation",
      "Waterproofing",
      "Embed / Anchor Bolt",
      "Backfill",
      "Concrete Placement",
      "Rebar",
      "Formwork",
      "Inspection",
    ],
    placeholders: {
      overview: "Foundation type, sequencing, embed schedule, and waterproofing scope. e.g. “Spread footings + 6” SOG, 4 pours, PMMA waterproofing.”",
      risks: "e.g. “Anchor bolt template late from steel fab”; “Rebar shortage risk in Q3”.",
      nextSteps: "e.g. “Release footing rebar shop tickets”; “Schedule pre-pour inspection”.",
      ownerName: "e.g. Devon Park, Concrete Super",
      itemTitle: "e.g. Pour footing sequence 1 (F-1 through F-14)",
      itemOwner: "e.g. Concrete Sub",
      itemNotes: "e.g. 4000 psi, requires special inspection for anchor pull-out",
    },
  },
  {
    slug: "structure",
    title: "Structure",
    blurb:
      "Structural steel, cast-in-place and precast concrete, wood framing, and structural connections through top-out.",
    itemNoun: "Structural Activity",
    itemNounPlural: "Structural Activities",
    categories: [
      "Steel Erection",
      "Steel Detailing",
      "Concrete Placement",
      "Precast Erection",
      "Wood Framing",
      "Connection",
      "Bracing",
      "Deck",
      "Shear Wall",
      "Inspection",
    ],
    placeholders: {
      overview: "Structural system, erection sequence, and connection scope. e.g. “Steel frame w/ metal deck, 3 sequences NE→SW.”",
      risks: "e.g. “Steel delivery Sequence 2 slipping 2 wks”; “Welder cert renewals due”.",
      nextSteps: "e.g. “Confirm crane pick plan for column erection”; “Schedule mock-up connection test”.",
      ownerName: "e.g. Ryan O'Neill, Structural Super",
      itemTitle: "e.g. Erect Sequence 1 steel (columns C1–C22)",
      itemOwner: "e.g. Steel Erector",
      itemNotes: "e.g. Bolt/weld inspection required; UT testing on FR moment connections",
    },
  },
  {
    slug: "material-tracking",
    title: "Material Tracking",
    blurb:
      "On-site material inventory and status: what's ordered, what's arrived, what's stored where, and what's been consumed. Separate from procurement/long-lead which tracks the buy; this tracks the physical goods.",
    itemNoun: "Material Item",
    itemNounPlural: "Material Items",
    categories: [
      "Concrete / Rebar",
      "Steel",
      "Framing Lumber",
      "Sheathing / Drywall",
      "Roofing",
      "Cladding",
      "Glazing",
      "Insulation",
      "MEP Fixture",
      "Finish Material",
      "Owner-Furnished",
      "Attic Stock",
    ],
    placeholders: {
      overview: "On-site material inventory strategy, storage locations, and consumption tracking. e.g. \u201cLaydown Yard 2 for envelope; owner-furnished FF&E in Zone C storage.\u201d",
      risks: "e.g. \u201cWeather-sensitive drywall stored outdoors\u201d; \u201cFinish tile arrived damaged\u201d.",
      nextSteps: "e.g. \u201cInventory attic stock before turnover\u201d; \u201cReconcile steel deliveries against fab tickets\u201d.",
      ownerName: "e.g. Priya Shah, Material Coordinator",
      itemTitle: "e.g. Curtain wall unitized panels \u2013 Zone A delivery",
      itemOwner: "e.g. Glazing Sub",
      itemNotes: "e.g. 48 panels received, stored in Yard 2, inspected clean",
    },
  },
  {
    slug: "envelope",
    // "Building Envelope" is the industry-standard term; the slug stays
    // "envelope" to keep existing URLs + lean_module_state rows valid.
    title: "Building Envelope",
    blurb:
      "Roofing, cladding, curtain wall, glazing, waterproofing, and air/vapor barriers through dry-in.",
    itemNoun: "Envelope Activity",
    itemNounPlural: "Envelope Activities",
    categories: [
      "Roofing",
      "Cladding",
      "Curtain Wall",
      "Storefront",
      "Glazing",
      "Waterproofing",
      "Air / Vapor Barrier",
      "Flashing",
      "Sealants",
      "Mockup",
      "Water Test",
    ],
    placeholders: {
      overview: "Envelope assemblies and dry-in plan. e.g. “TPO roof + rainscreen ACM, curtain wall unitized.”",
      risks: "e.g. “Unitized CW panels slipping”; “Water test failed at mock-up joint”.",
      nextSteps: "e.g. “Schedule AAMA 501.2 water test”; “Release roofing PO”.",
      ownerName: "e.g. Priya Shah, Envelope Lead",
      itemTitle: "e.g. Install curtain wall Zone A (grids 1–12 / A–F)",
      itemOwner: "e.g. Glazing Sub",
      itemNotes: "e.g. Requires mock-up water test sign-off before proceeding",
    },
  },
  {
    slug: "mep",
    title: "MEP Rough-in",
    blurb:
      "Mechanical, electrical, plumbing, fire protection, and low-voltage rough-in coordination from overhead layouts through in-wall inspections.",
    itemNoun: "MEP Activity",
    itemNounPlural: "MEP Activities",
    categories: [
      "Mechanical / HVAC",
      "Electrical",
      "Plumbing",
      "Fire Protection",
      "Low Voltage / Data",
      "Coordination Drawing",
      "Overhead Rough",
      "In-Wall Rough",
      "Inspection",
    ],
    placeholders: {
      overview: "MEP scope, coordination method (BIM/CD), and rough-in phasing. e.g. “BIM-coordinated, in-wall by area, overhead by level.”",
      risks: "e.g. “Switchgear on 22wk lead”; “Coordination clashes Level 3 corridor”.",
      nextSteps: "e.g. “Resolve clashes at grid E/8”; “Schedule in-wall inspection Level 2”.",
      ownerName: "e.g. Jordan Kim, MEP Coordinator",
      itemTitle: "e.g. Overhead rough Level 3 East wing",
      itemOwner: "e.g. Mechanical Sub",
      itemNotes: "e.g. Coordinate with fire sprinkler drops; inspection scheduled 8/29",
    },
  },
  {
    slug: "interior-framing",
    title: "Interior Framing & Drywall",
    blurb:
      "Metal stud framing, in-wall blocking, insulation, drywall hang and finish, and taping levels.",
    itemNoun: "Framing Activity",
    itemNounPlural: "Framing Activities",
    categories: [
      "Layout",
      "Metal Studs",
      "Blocking",
      "Insulation",
      "Drywall Hang",
      "Drywall Tape / Finish",
      "Sound Attenuation",
      "Fire-Rated Assembly",
      "Inspection",
    ],
    placeholders: {
      overview: "Framing standards, sound/fire ratings, blocking coordination. e.g. “25ga @ typ walls, UL U419 corridor, Level 4 finish.”",
      risks: "e.g. “In-wall blocking coord for equipment TBD”; “Drywall labor shortage”.",
      nextSteps: "e.g. “Issue blocking RFI to owner”; “Schedule pre-rock walkthrough”.",
      ownerName: "e.g. Sam Rodriguez, Interior Super",
      itemTitle: "e.g. Layout & top-track Level 2 offices",
      itemOwner: "e.g. Drywall Sub",
      itemNotes: "e.g. Coordinate blocking for TVs and grab bars before rock",
    },
  },
  {
    slug: "interior-finishes",
    title: "Interior Finishes",
    blurb:
      "Flooring, paint, wall covering, tile, millwork, casework, doors, hardware, ceilings, and specialties.",
    itemNoun: "Finish Activity",
    itemNounPlural: "Finish Activities",
    categories: [
      "Flooring",
      "Paint",
      "Wall Covering",
      "Tile",
      "Millwork / Casework",
      "Doors & Hardware",
      "Ceilings",
      "Specialties",
      "Signage",
      "Finish Schedule Review",
    ],
    placeholders: {
      overview: "Finish schedule status, mockup approvals, long-lead items. e.g. “LVT + carpet tile, custom millwork lobby, 12wk lead on tile.”",
      risks: "e.g. “Lobby stone slipping”; “Paint color not yet approved by owner”.",
      nextSteps: "e.g. “Schedule mock-up review”; “Submit door hardware sample set”.",
      ownerName: "e.g. Taylor Nguyen, Finishes Lead",
      itemTitle: "e.g. Install LVT Level 2 open office",
      itemOwner: "e.g. Flooring Sub",
      itemNotes: "e.g. Ambient temp 65–85°F required 48h before/after",
    },
  },
  {
    slug: "vertical-transportation",
    title: "Vertical Transportation",
    blurb:
      "Elevators, escalators, dumbwaiters, and lifts from shop drawings through jurisdictional acceptance.",
    itemNoun: "VT Item",
    itemNounPlural: "VT Items",
    categories: [
      "Elevator",
      "Escalator",
      "Dumbwaiter",
      "Lift",
      "Shop Drawing",
      "Rail Delivery",
      "Cab Delivery",
      "Machine Room Ready",
      "Jurisdictional Inspection",
      "First-Car Turnover",
    ],
    placeholders: {
      overview: "VT scope, delivery dates, machine room readiness. e.g. “2 passenger + 1 service elevator, cab finishes selected.”",
      risks: "e.g. “Hoistway not plumb, requires rework”; “Cab delivery slipping to Q4”.",
      nextSteps: "e.g. “Survey hoistway plumbness”; “Release cab finish PO”.",
      ownerName: "e.g. Chris Patel, Owner Rep",
      itemTitle: "e.g. Elevator EL-1 rail delivery + install",
      itemOwner: "e.g. Elevator Sub",
      itemNotes: "e.g. Machine room ready 2 wks prior; state inspector scheduled 10/12",
    },
  },
  {
    slug: "site-improvements",
    title: "Site Improvements & Landscaping",
    // Scheduled AFTER most building work is complete so heavy equipment is no
    // longer driving across finished paving, curbs, or planting. Lives late in
    // the lifecycle (after Vertical Transportation, before Commissioning).
    blurb:
      "Paving, striping, curbs, sidewalks, hardscape, irrigation, planting, site furnishings, and final grading. Sequenced after building work wraps so heavy equipment doesn't cross finished improvements.",
    itemNoun: "Site Improvement",
    itemNounPlural: "Site Improvements",
    categories: [
      "Paving",
      "Striping",
      "Curb & Gutter",
      "Sidewalks",
      "Hardscape",
      "Irrigation",
      "Planting",
      "Sod / Seed",
      "Site Furnishings",
      "Final Grading",
    ],
    placeholders: {
      overview: "Paving/landscape phasing, planting seasons, final grade tolerances. e.g. “Asphalt base coat pre-topout, top coat post-punch.”",
      risks: "e.g. “Paving weather window closing”; “Irrigation stub-outs not located”.",
      nextSteps: "e.g. “Schedule asphalt base course”; “Confirm plant material availability”.",
      ownerName: "e.g. Morgan Lee, Site Improvements Lead",
      itemTitle: "e.g. Curb and gutter west parking lot",
      itemOwner: "e.g. Sitework Sub",
      itemNotes: "e.g. Requires grading approval before pour",
    },
  },
  {
    slug: "commissioning",
    title: "Commissioning & Testing",
    blurb:
      "Systems commissioning, testing and balancing, functional performance tests, and integrated systems testing through Cx acceptance.",
    itemNoun: "Cx Activity",
    itemNounPlural: "Cx Activities",
    categories: [
      "Pre-Functional Checklist",
      "TAB (Test & Balance)",
      "Functional Performance Test",
      "Integrated Systems Test",
      "Trend Log Review",
      "Deficiency",
      "Retest",
      "Cx Report",
    ],
    placeholders: {
      overview: "Cx scope, agent, systems in scope, and pre-functional plan. e.g. “3rd-party Cx, HVAC + BAS + lighting controls in scope.”",
      risks: "e.g. “BAS graphics behind”; “TAB start delayed by controls”.",
      nextSteps: "e.g. “Review pre-functional checklists”; “Schedule integrated systems test”.",
      ownerName: "e.g. Dana Fowler, Cx Agent",
      itemTitle: "e.g. Functional performance test AHU-1",
      itemOwner: "e.g. Mechanical Sub",
      itemNotes: "e.g. Requires BAS trend logs 7 days prior",
    },
  },
  {
    slug: "punch-list",
    title: "Punch List & Walkthroughs",
    blurb:
      "Pre-punch, architect punch, owner walkthroughs, and back-punch verification through zero-open punch.",
    itemNoun: "Punch Item",
    itemNounPlural: "Punch Items",
    categories: [
      "Pre-Punch",
      "Architect Punch",
      "Owner Punch",
      "Back-Punch",
      "Deficiency",
      "Warranty Callback",
      "Zero-Punch Sign-off",
    ],
    placeholders: {
      overview: "Punch strategy, walkthrough sequence, target zero-punch date. e.g. “Pre-punch by area lead, arch punch after zone complete.”",
      risks: "e.g. “Punch backlog growing on Level 3”; “Sub not responding to callbacks”.",
      nextSteps: "e.g. “Schedule owner walkthrough Level 2”; “Assign back-punch owner”.",
      ownerName: "e.g. Elena Brooks, Punch Coordinator",
      itemTitle: "e.g. Paint touch-up corridor 2E",
      itemOwner: "e.g. Paint Sub",
      itemNotes: "e.g. Back-punch verify by 9/10",
    },
  },
  {
    slug: "closeout",
    // Narrowed to regulatory closeout; the O&M/as-built/training/turnover
    // detail lives in the four dedicated modules that follow. Slug preserved
    // so existing project data isn't orphaned.
    title: "Closeout & C of O",
    blurb:
      "Certificate of Occupancy, final lien waivers, retainage release, keys, and warranty start-date confirmation. Detailed deliverables (O&M, as-builts, training, turnover package) live in their own modules.",
    itemNoun: "Closeout Item",
    itemNounPlural: "Closeout Items",
    categories: [
      "O&M Manual",
      "Warranty",
      "As-Built",
      "Attic Stock",
      "Training",
      "Certificate of Occupancy",
      "Keys / Access",
      "Turnover Package",
      "Final Lien Waiver",
      "Retainage Release",
    ],
    placeholders: {
      overview: "Closeout deliverables, target substantial completion, C of O plan. e.g. “O&Ms in Procore, TCO 10/1, final C of O 11/15.”",
      risks: "e.g. “As-builts not yet compiled”; “AHJ backlog on C of O”.",
      nextSteps: "e.g. “Collect final O&M submittals”; “Schedule fire marshal walk”.",
      ownerName: "e.g. Chris Patel, PM",
      itemTitle: "e.g. Submit HVAC O&M manuals",
      itemOwner: "e.g. Mechanical Sub",
      itemNotes: "e.g. Include warranty start dates and training records",
    },
  },
  {
    slug: "om-manuals",
    title: "O&M Manuals",
    blurb:
      "Operations & Maintenance documentation for every installed system: HVAC, plumbing, electrical, roofing, envelope, elevators, and specialty equipment. Collected from subs, indexed, and formatted per owner spec.",
    itemNoun: "O&M Deliverable",
    itemNounPlural: "O&M Deliverables",
    categories: [
      "HVAC",
      "Plumbing",
      "Electrical",
      "Fire Protection",
      "Roofing",
      "Envelope",
      "Elevators / VT",
      "Controls / BAS",
      "Specialty Equipment",
      "Owner-Furnished Equipment",
    ],
    placeholders: {
      overview: "O&M format (bound/digital), delivery cadence, owner acceptance criteria. e.g. \u201cDigital PDF + hard copies, delivered at 90% completion.\u201d",
      risks: "e.g. \u201cSub not responsive on chiller O&M\u201d; \u201cOwner rejected format \u2013 needs rework\u201d.",
      nextSteps: "e.g. \u201cCompile HVAC O&M into master binder\u201d; \u201cReview format with owner rep\u201d.",
      ownerName: "e.g. Sam Rodriguez, Closeout Lead",
      itemTitle: "e.g. Rooftop unit O&M (RTU-1 through RTU-6)",
      itemOwner: "e.g. Mechanical Sub",
      itemNotes: "e.g. Includes warranty registration + service contact info",
    },
  },
  {
    slug: "as-builts",
    title: "As-Built Drawings",
    blurb:
      "Redlines from construction rolled up into a final as-built set: architectural, structural, MEP, and civil. Deliverable to owner and required by most authorities before final C of O.",
    itemNoun: "As-Built Item",
    itemNounPlural: "As-Built Items",
    categories: [
      "Architectural",
      "Structural",
      "Civil",
      "Mechanical",
      "Electrical",
      "Plumbing",
      "Fire Protection",
      "Landscape",
      "Redline Sheet",
      "Final As-Built Set",
    ],
    placeholders: {
      overview: "Redline collection process, drafting responsibility, delivery format. e.g. \u201cSubs redline weekly; final CAD delivery by GC drafter.\u201d",
      risks: "e.g. \u201cRedlines missing from Level 3 MEP\u201d; \u201cCivil grade changes not captured\u201d.",
      nextSteps: "e.g. \u201cCollect Q3 redlines from subs\u201d; \u201cIssue draft as-built set for owner review\u201d.",
      ownerName: "e.g. Alicia Cheng, Project Manager",
      itemTitle: "e.g. Compile MEP as-built set\u2014Level 1 through Roof",
      itemOwner: "e.g. MEP Coordinator",
      itemNotes: "e.g. Requires field verification of hidden runs",
    },
  },
  {
    slug: "owner-training",
    title: "Owner Training",
    blurb:
      "Training sessions for owner facilities staff on every operable system delivered with the building. Documented with attendee lists, recordings, and sign-off sheets.",
    itemNoun: "Training Session",
    itemNounPlural: "Training Sessions",
    categories: [
      "HVAC",
      "BAS / Controls",
      "Plumbing",
      "Electrical",
      "Fire / Life Safety",
      "Elevators",
      "Roofing",
      "Security / Access",
      "Specialty Equipment",
      "Emergency Systems",
    ],
    placeholders: {
      overview: "Training curriculum, schedule, and attendee list. e.g. \u201c14 sessions across 3 weeks; sign-in sheets + video capture per owner spec.\u201d",
      risks: "e.g. \u201cOwner facilities lead unavailable during training window\u201d; \u201cControls sub not scheduled\u201d.",
      nextSteps: "e.g. \u201cPublish training calendar to owner\u201d; \u201cRecord fire alarm session\u201d.",
      ownerName: "e.g. Devon Park, Closeout Lead",
      itemTitle: "e.g. BAS training \u2013 facilities engineering team",
      itemOwner: "e.g. Controls Sub",
      itemNotes: "e.g. 3 hrs, 6 attendees, video + sign-in on file",
    },
  },
  {
    slug: "turnover-package",
    title: "Turnover Package",
    blurb:
      "The consolidated deliverable handed to the owner at substantial completion: keys, warranties, O&Ms, as-builts, training records, spare parts inventory, contact list, and any commissioning reports.",
    itemNoun: "Turnover Item",
    itemNounPlural: "Turnover Items",
    categories: [
      "Keys / Access Fobs",
      "Warranties",
      "O&M Manuals",
      "As-Built Drawings",
      "Training Records",
      "Attic Stock / Spare Parts",
      "Emergency Contact List",
      "Commissioning Report",
      "System Startup Reports",
      "Owner Sign-Off",
    ],
    placeholders: {
      overview: "Turnover package format, target delivery date, owner sign-off protocol. e.g. \u201cDigital + physical package on 11/1; formal handoff meeting 11/8.\u201d",
      risks: "e.g. \u201cAttic stock inventory incomplete\u201d; \u201cKey management protocol not agreed with owner\u201d.",
      nextSteps: "e.g. \u201cReconcile attic stock against submittals\u201d; \u201cSchedule turnover meeting\u201d.",
      ownerName: "e.g. Chris Patel, PM",
      itemTitle: "e.g. Master turnover binder \u2013 all systems",
      itemOwner: "e.g. Project Manager",
      itemNotes: "e.g. 12 systems, indexed with cross-references to as-builts",
    },
  },
  {
    slug: "warranty",
    title: "Post-Occupancy / Warranty",
    blurb:
      "Warranty tracking, 11-month walk, callback response, and manufacturer/subcontractor warranty expirations.",
    itemNoun: "Warranty Item",
    itemNounPlural: "Warranty Items",
    categories: [
      "Warranty Claim",
      "11-Month Walk",
      "Callback",
      "Manufacturer Warranty",
      "Sub Warranty",
      "Owner Concern",
      "Resolution",
    ],
    placeholders: {
      overview: "Warranty coverage window, 11-month walk schedule, callback process. e.g. “1-yr GC warranty, 11-mo walk on 4/15/2027.”",
      risks: "e.g. “Roof callback unresolved”; “Sub non-responsive to owner concern”.",
      nextSteps: "e.g. “Schedule 11-month walk”; “Collect manufacturer warranty certs”.",
      ownerName: "e.g. Sam Rodriguez, Warranty Lead",
      itemTitle: "e.g. Roof leak Level 4 SW corner",
      itemOwner: "e.g. Roofing Sub",
      itemNotes: "e.g. Reported by owner 8/12; dispatched sub 8/13",
    },
  },
  {
    slug: "safety",
    title: "Safety Program",
    blurb:
      "Site-specific safety plans, JHA/AHA, toolbox talks, incident reporting, near-miss tracking, and OSHA logs. Cross-cutting; active every day.",
    itemNoun: "Safety Item",
    itemNounPlural: "Safety Items",
    categories: [
      "Site-Specific Safety Plan",
      "JHA / AHA",
      "Toolbox Talk",
      "Incident",
      "Near-Miss",
      "OSHA 300 Entry",
      "Safety Inspection",
      "Training Record",
      "PPE",
      "Emergency Drill",
    ],
    placeholders: {
      overview: "Site-specific safety plan, incident reporting cadence, current OSHA log status. e.g. “Zero recordable YTD, weekly toolbox talks, JHAs by activity.”",
      risks: "e.g. “Fall protection gap at edge Level 3”; “Near-miss at loading dock”.",
      nextSteps: "e.g. “Update SSSP with new crane picks”; “Schedule fall protection training”.",
      ownerName: "e.g. Priya Shah, Safety Manager",
      itemTitle: "e.g. Toolbox talk – heat illness prevention",
      itemOwner: "e.g. Safety Manager",
      itemNotes: "e.g. 42 attendees; sign-in sheet on file",
    },
  },
  {
    slug: "quality",
    title: "Quality Program",
    blurb:
      "QA/QC plans, inspection and test plans, first-in-place inspections, mock-ups, deficiency tracking, and NCRs. Cross-cutting; active every day.",
    itemNoun: "Quality Item",
    itemNounPlural: "Quality Items",
    categories: [
      "QA/QC Plan",
      "Inspection & Test Plan",
      "First-in-Place",
      "Mockup",
      "Deficiency",
      "Non-Conformance Report",
      "Corrective Action",
      "Third-Party Inspection",
      "Material Test",
    ],
    placeholders: {
      overview: "QA/QC plan owner, inspection cadence, first-in-place strategy. e.g. “Weekly QC walks, first-in-place all major assemblies.”",
      risks: "e.g. “Recurring drywall corner defect”; “Third-party inspector unavailable”.",
      nextSteps: "e.g. “Schedule first-in-place window install”; “Close out NCR #14”.",
      ownerName: "e.g. Alicia Cheng, QA/QC Manager",
      itemTitle: "e.g. First-in-place inspection: exterior stud framing",
      itemOwner: "e.g. QA/QC Manager",
      itemNotes: "e.g. Photo doc, sub trained on standard, sign-off filed",
    },
  },
  {
    slug: "financials",
    title: "Financials & Change Management",
    blurb:
      "Budget, cost-to-complete, forecast at completion, change orders, pay applications, contingency use, and cash flow.",
    itemNoun: "Financial Item",
    itemNounPlural: "Financial Items",
    categories: [
      "Budget Line",
      "Change Order (Owner)",
      "Change Order (Sub)",
      "Pay Application",
      "Contingency Draw",
      "Forecast Adjustment",
      "Cash Flow Note",
      "Cost-to-Complete",
      "Retainage",
      "Invoice",
    ],
    placeholders: {
      overview: "Budget position, contingency remaining, forecast vs original GMP. e.g. “GMP $48.2M, 62% complete, contingency 41% remaining.”",
      risks: "e.g. “Steel escalation exposure”; “Owner CO #14 not approved”.",
      nextSteps: "e.g. “Submit August pay app”; “Resolve retention with structural sub”.",
      ownerName: "e.g. Devon Park, Project Executive",
      itemTitle: "e.g. Owner CO #12 – lobby scope change",
      itemOwner: "e.g. Project Executive",
      itemNotes: "e.g. $214K net; awaiting owner PM signature",
    },
  },
  {
    slug: "schedule",
    title: "Schedule Control",
    blurb:
      "Master schedule, look-aheads, pull planning, critical path monitoring, delay tracking, and recovery schedules.",
    itemNoun: "Schedule Item",
    itemNounPlural: "Schedule Items",
    categories: [
      "Milestone",
      "Look-Ahead",
      "Pull Plan Commitment",
      "Critical Path Activity",
      "Delay",
      "Recovery Plan",
      "Time Impact Analysis",
      "Baseline Update",
      "Schedule Variance",
    ],
    placeholders: {
      overview: "Baseline status, current variance, and float remaining on critical path. e.g. “Baseline Rev 3 in place, 4d ahead, 12d float on CP.”",
      risks: "e.g. “Steel delivery slipping into CP”; “Weather losses accumulating”.",
      nextSteps: "e.g. “Update 3-week look-ahead”; “Run TIA on curtain wall delay”.",
      ownerName: "e.g. Ryan O'Neill, Scheduler",
      itemTitle: "e.g. Milestone – building dry-in",
      itemOwner: "e.g. Project Manager",
      itemNotes: "e.g. On CP, 5d float, target 10/22",
    },
  },
  {
    slug: "risk-register",
    title: "Risk Register",
    blurb:
      "Cross-lifecycle strategic risks with likelihood, impact, and mitigation owner. Distinct from insurance/COI (which handles compliance) and mobilization risks (which are startup-specific).",
    itemNoun: "Risk",
    itemNounPlural: "Risks",
    categories: [
      "Schedule",
      "Cost / Budget",
      "Design",
      "Site / Environmental",
      "Regulatory / Permitting",
      "Subcontractor",
      "Supply Chain",
      "Weather",
      "Labor / Trade",
      "Safety",
      "Quality",
      "Stakeholder / Owner",
      "Financial / Cash Flow",
    ],
    placeholders: {
      overview: "Risk methodology, scoring approach, review cadence. e.g. \u201cQuarterly executive review; scored L/M/H likelihood \u00d7 L/M/H impact.\u201d",
      risks: "e.g. \u201cLong-lead switchgear 40-week lead\u201d; \u201cInsufficient concrete crew for peak weeks\u201d.",
      nextSteps: "e.g. \u201cReview top 10 risks with executive team\u201d; \u201cAssign mitigation owner for supply chain items\u201d.",
      ownerName: "e.g. Elena Brooks, Risk Manager",
      itemTitle: "e.g. Curtain wall vendor at capacity risk",
      itemOwner: "e.g. Project Executive",
      itemNotes: "e.g. Likelihood M / Impact H; mitigation: dual-source engaged",
    },
  },
  {
    slug: "meetings",
    title: "Meetings & Minutes",
    blurb:
      "Standing project meetings and one-offs: OAC, subcontractor coordination, design review, safety, and pull planning. Agenda, attendees, decisions, and action items in one place.",
    itemNoun: "Meeting",
    itemNounPlural: "Meetings",
    categories: [
      "OAC (Owner/Architect/Contractor)",
      "Sub Coordination",
      "Design Review",
      "Pre-Con",
      "Kickoff",
      "Pull Planning",
      "Safety",
      "Quality / QAQC",
      "Commissioning",
      "Closeout",
      "Executive / Owner",
      "Ad-hoc",
    ],
    placeholders: {
      overview: "Standing meeting cadence, attendee lists, minute-taking protocol. e.g. \u201cWeekly OAC Tuesdays 9am; sub coord Thursdays; minutes distributed within 24h.\u201d",
      risks: "e.g. \u201cOwner PM missing last 3 OACs\u201d; \u201cAction items not being closed between meetings\u201d.",
      nextSteps: "e.g. \u201cPublish August meeting calendar\u201d; \u201cChase overdue action items from 7/15 OAC\u201d.",
      ownerName: "e.g. Alicia Cheng, Project Manager",
      itemTitle: "e.g. OAC #14 \u2013 8/13/2026",
      itemOwner: "e.g. Project Manager",
      itemNotes: "e.g. 12 attendees, 6 action items, minutes filed",
    },
  },
  {
    slug: "risk",
    // Narrowed to insurance/COI compliance; a new dedicated cross-lifecycle
    // Risk Register module lives below. Slug preserved for existing data.
    title: "Insurance & COI Compliance",
    blurb:
      "Certificates of insurance, subcontractor COI tracking, bonds, umbrella policies, waivers of subrogation, and claims. The strategic risk register with likelihood/impact scoring lives in its own module.",
    itemNoun: "Insurance Item",
    itemNounPlural: "Insurance Items",
    categories: [
      "COI (Certificate of Insurance)",
      "Sub COI",
      "Claim",
      "Bond",
      "Indemnification",
      "Mitigation Action",
      "Umbrella Policy",
      "Waiver of Subrogation",
    ],
    placeholders: {
      overview: "Top risks, insurance program status, and sub COI compliance. e.g. “Top 5 risks tracked weekly; 94% sub COI compliance.”",
      risks: "e.g. “3 subs with expired COIs”; “Builder's risk deductible increased”.",
      nextSteps: "e.g. “Chase expired COIs”; “Review umbrella policy at renewal”.",
      ownerName: "e.g. Elena Brooks, Risk Manager",
      itemTitle: "e.g. Renew builder's risk policy",
      itemOwner: "e.g. Risk Manager",
      itemNotes: "e.g. Expires 12/31; broker quote pending",
    },
  },
];

export const LEAN_MODULE_SLUGS: string[] = LEAN_MODULES.map((m) => m.slug);

export function isLeanModuleSlug(slug: string): boolean {
  return LEAN_MODULE_SLUGS.includes(slug);
}

export function getLeanModuleDef(slug: string): LeanModuleDef | undefined {
  return LEAN_MODULES.find((m) => m.slug === slug);
}

/**
 * Return the placeholder set for a given module, falling back to a sensible
 * generic set when the module doesn't declare its own. Client components use
 * this to render ghost text in every empty text input and textarea.
 */
export function getLeanModulePlaceholders(slug: string): LeanModuleDef["placeholders"] {
  const def = getLeanModuleDef(slug);
  return def?.placeholders ?? DEFAULT_PLACEHOLDERS;
}

// Status vocabularies used by state + items. Kept as plain string unions so
// the client can render dropdowns without importing zod on the client.
export const LEAN_MODULE_STATE_STATUSES = [
  "not_started",
  "in_progress",
  "ready_for_review",
  "approved",
  "complete",
  "on_hold",
] as const;
export type LeanModuleStateStatus = (typeof LEAN_MODULE_STATE_STATUSES)[number];

export const LEAN_MODULE_ITEM_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
  "on_hold",
  "at_risk",
  "n_a",
] as const;
export type LeanModuleItemStatus = (typeof LEAN_MODULE_ITEM_STATUSES)[number];
