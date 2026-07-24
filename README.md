# TrussPath — Field Project Management

A modern, opinionated project management app for construction field operations. Built for general contractors and project executives who need to coordinate schedules, RFIs, submittals, change orders, punch lists, daily logs, and photo documentation in one place.

Live preview: https://www.perplexity.ai/computer/a/trusspath-field-project-manage-3uphvEKmS1iKlKvXJzoX0w

## Features

- **Gantt chart** with 1W / 2W / 1M / Qtr / All zoom levels, sticky month headers, adaptive day cells with weekend highlighting, live Today indicator, and full-screen mode
- **Flow Chart** view — trade-by-trade phase flow with Kickoff → Closeout endpoints, connected by arrows, plus a Risk & Approvals section
- **Drill-down dialogs** for Tasks and Risks (Change Orders / Submittals / RFIs) from either view
- **Full construction PM workflows** — Projects, Schedule, Tasks, Action Items, RFIs, Submittals, Change Orders, Punch List, Daily Logs, Photo Log, Documents, Blueprints, Fleet & Equipment, Drone Captures, Team, and a Sticky Board
- **Persistent SQLite storage** via Drizzle ORM
- **Dark mode** with matched design tokens throughout

## Stack

- **Frontend:** React 18 · Vite · Tailwind CSS v3 · shadcn/ui · wouter (hash routing) · TanStack Query
- **Backend:** Express · Drizzle ORM · better-sqlite3
- **Language:** TypeScript end-to-end with a shared `shared/schema.ts` data model

## Getting Started

```bash
npm install
npm run dev
```

Dev server runs on `http://localhost:5000` (Express + Vite on the same port).

## Build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Project Layout

```
client/    React app (pages, components, hooks)
server/    Express routes, storage layer, Vite dev middleware
shared/    Drizzle schema and shared TypeScript types
script/    Utility scripts (seed, etc.)
data.db    SQLite database (checked in with sample data)
```

## Notes

- The database file `data.db` is committed with sample project data for three projects: Lakeside Medical Pavilion, Union Tower, and Riverside.
- The transient SQLite WAL/SHM files are gitignored — they'll be regenerated at runtime.
