import { ExecutiveOsComingSoon } from "./coming-soon";

/**
 * Central registry for every Executive OS module that has been skeleton-scaffolded
 * but not yet built. Adding an entry here automatically:
 *  - creates a portfolio page component (`<Name>Portfolio`) and a detail page
 *    component (`<Name>Detail`) exported below
 *  - is registered in App.tsx and shared/app-manifest.ts by hand
 *  - is guarded in shared/access-levels.ts
 *
 * When a module ships for real, remove it from this registry and swap the
 * routes over to its purpose-built pages in App.tsx.
 */
export type UpcomingModule = {
  slug: string;
  title: string;
  blurb: string;
};

export const UPCOMING_MODULES: UpcomingModule[] = [
  {
    slug: "site-logistics",
    title: "Site Logistics & Temp Facilities",
    blurb:
      "Site plan, laydown yards, crane picks, hoisting, temporary power/water/sanitation, fencing, gates, signage, and traffic control — how the jobsite is organized before trades arrive in force.",
  },
  {
    slug: "sitework",
    title: "Sitework & Earthwork",
    blurb:
      "Clear-and-grub, mass excavation, cut/fill balance, erosion control, dewatering, underground utilities, and rough grading — from Notice to Proceed through pad-ready.",
  },
  {
    slug: "foundations",
    title: "Foundations",
    blurb:
      "Footings, foundation walls, slab-on-grade, deep foundations (piles/piers/caissons), foundation waterproofing, and structural embeds — through top-of-foundation.",
  },
  {
    slug: "structure",
    title: "Structure",
    blurb:
      "Structural steel, cast-in-place and precast concrete, wood framing, and structural connections — erection, plumb/level/align, and topping-out.",
  },
  {
    slug: "envelope",
    title: "Envelope",
    blurb:
      "Roofing, cladding, curtain wall, glazing, waterproofing, air/vapor barriers, and dry-in — through building watertight.",
  },
  {
    slug: "mep",
    title: "MEP Rough-in",
    blurb:
      "Mechanical, electrical, plumbing, fire protection, and low-voltage rough-in coordination — from overhead layouts through in-wall inspections.",
  },
  {
    slug: "interior-framing",
    title: "Interior Framing & Drywall",
    blurb:
      "Metal stud framing, in-wall blocking, insulation, drywall hang and finish, and taping levels — from layout through ready-for-paint.",
  },
  {
    slug: "interior-finishes",
    title: "Interior Finishes",
    blurb:
      "Flooring, paint, wall covering, tile, millwork, casework, doors, hardware, ceilings, and specialties — from finish-schedule sign-off through substantial completion.",
  },
  {
    slug: "vertical-transportation",
    title: "Vertical Transportation",
    blurb:
      "Elevators, escalators, dumbwaiters, and lifts — shop drawings through jurisdictional acceptance, first-car turnover, and final inspection.",
  },
  {
    slug: "site-improvements",
    title: "Site Improvements & Landscaping",
    blurb:
      "Paving, striping, curbs, sidewalks, hardscape, irrigation, planting, site furnishings, and final grading — through owner walk of the site perimeter.",
  },
  {
    slug: "commissioning",
    title: "Commissioning & Testing",
    blurb:
      "Systems commissioning, testing and balancing, functional performance tests, integrated systems testing, and commissioning agent sign-off — through Cx acceptance.",
  },
  {
    slug: "punch-list",
    title: "Punch List & Walkthroughs",
    blurb:
      "Pre-punch, architect punch, owner walkthroughs, punch-item tracking by trade and location, and back-punch verification — through zero-open punch.",
  },
  {
    slug: "closeout",
    title: "Closeout & Turnover",
    blurb:
      "O&M manuals, warranties, as-builts, attic stock, training, certificate of occupancy, keys and access, and turnover packages — through substantial completion and owner acceptance.",
  },
  {
    slug: "warranty",
    title: "Post-Occupancy / Warranty",
    blurb:
      "Warranty tracking, 11-month walk, callback response, warranty claims, and manufacturer/subcontractor warranty expirations — from turnover through end of warranty period.",
  },
  {
    slug: "safety",
    title: "Safety Program",
    blurb:
      "Site-specific safety plans, JHA/AHA, toolbox talks, incident reporting, near-miss tracking, OSHA logs, and safety metrics — a cross-cutting program active every day of the job.",
  },
  {
    slug: "quality",
    title: "Quality Program",
    blurb:
      "QA/QC plans, inspection and test plans, first-in-place inspections, mock-ups, deficiency tracking, and non-conformance reports — a cross-cutting program active every day of the job.",
  },
  {
    slug: "financials",
    title: "Financials & Change Management",
    blurb:
      "Budget, cost-to-complete, forecast at completion, change orders (owner and sub), pay applications, contingency use, and cash flow — the money spine of the project.",
  },
  {
    slug: "schedule",
    title: "Schedule Control",
    blurb:
      "Master schedule, look-ahead schedules, pull planning, critical path monitoring, delay tracking, recovery schedules, and schedule variance reports — the time spine of the project.",
  },
  {
    slug: "risk",
    title: "Risk & Insurance",
    blurb:
      "Risk register, insurance certificates, subcontractor insurance tracking, claims, bonds, indemnifications, and risk mitigation actions — the exposure spine of the project.",
  },
];

/**
 * For each upcoming module, export a Portfolio and Detail component tied to
 * that module's title/blurb. App.tsx imports these directly.
 */
type ModuleComponents = {
  Portfolio: () => JSX.Element;
  Detail: () => JSX.Element;
};

function makeModuleComponents(mod: UpcomingModule): ModuleComponents {
  const portfolioHref = `/executive-os/${mod.slug}`;
  return {
    Portfolio: () => (
      <ExecutiveOsComingSoon title={mod.title} blurb={mod.blurb} portfolioHref={portfolioHref} />
    ),
    Detail: () => (
      <ExecutiveOsComingSoon title={mod.title} blurb={mod.blurb} portfolioHref={portfolioHref} isDetail />
    ),
  };
}

export const UPCOMING_MODULE_COMPONENTS: Record<string, ModuleComponents> = Object.fromEntries(
  UPCOMING_MODULES.map((m) => [m.slug, makeModuleComponents(m)]),
);
