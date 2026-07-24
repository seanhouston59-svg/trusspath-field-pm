# TrussPath — Field Project Management App

**Concept:** A field-first project management platform for general contractors and construction firms — a focused, affordable alternative to Procore that covers the workflows small/mid-market GCs actually use every day: projects, tasks, RFIs, daily logs, and punch lists.

**Working prototype:** The deployed app is a functional fullstack demo seeded with realistic construction data (4 projects, 8 team members, tasks, RFIs, daily logs, punch items). You can browse the dashboard, drill into a project, change task/punch status (persisted to SQLite), and toggle light/dark theme.

---

## 1. Features

### Shipped in this prototype
- **Dashboard** — portfolio KPIs (active projects, open RFIs, tasks due this week, open punch), budget-vs-spent bar chart, "needs attention" (blocked tasks), open RFIs, project portfolio with progress bars.
- **Sticky Board** — draggable, free-positioned sticky notes (persisted x/y) with color picker and add/delete; a visual field-command board per project.
- **Projects** — card grid with status, budget burn, schedule, superintendent; click into a detail view.
- **Project detail** — header stats (budget, schedule, open tasks/RFIs), budget-burn bar, and tabbed workspace: Overview, Tasks, RFIs, Daily Logs, Punch List.
- **Schedule (Gantt)** — custom div-based Gantt with month timeline, status-colored task bars, a TODAY marker, sticky task labels, and auto-scroll to today.
- **Tasks** — searchable table by trade/assignee; inline status changes (Not Started → In Progress → Blocked → Complete) that persist via API.
- **Action Items** — meeting-derived action log with owner, source, priority, and inline status workflow.
- **RFIs** — tracked by number, subject, assignee, created/due dates, overdue highlighting.
- **Submittals** — submittal log by number, subject, type, assignee, submitted/due dates, status.
- **Change Orders** — CO log with amount, schedule-impact days, issued date, status; auto-totals approved value.
- **Daily Logs** — crew count, weather/temp, author, narrative summary; sorted newest-first.
- **Photo Log** — hue-tinted photo tiles with caption, location, photographer, date.
- **Documents** — drawing/spec/permit/contract register with uploader, date, file size.
- **Fleet & Equipment** — equipment cards with on-site/maintenance status, operator, location.
- **Punch List** — location-aware closeout items with inline status workflow.
- **Team** — internal directory with roles, trades, companies, contact info.
- **Contacts** — external project contacts (owners, architects, subcontractors, authorities) with type badges.
- **Messages** — per-project discussion thread with chat bubbles and an Enter-to-send composer (persisted).
- **Schedule (month view)** — classic full-month calendar overlaying tasks, RFIs, submittals, change orders, and milestones; Google Calendar import (.ics) and one-click export.
- **Blueprints** — sheet-level drawing register with discipline, sheet numbers, revision, and grid-lined thumbnails for fast field lookup.
- **Drone Captures** — aerial progress capture cards by flight date, capture type, altitude, and location, with gradient aerial-imagery thumbnails.
- **Jarvis AI** — voice-and-text site copilot (routed through the platform LLM) that reads live project data and drafts RFIs, logs, and summaries; speaks responses aloud.
- **Integrations Hub** — connectors for ADP, TriNet, Google Sheets, QuickBooks, Google Calendar, DocuSign, and Dropbox, plus CSV and .ics export per project.
- **Responsive + dark mode** — dark slate sidebar, safety-amber accent, mobile drawer nav.

### Roadmap (to reach Procore parity)
| Area | Feature |
|------|---------|
| Documents | Drawing management, version control, sheet compare, markups |
| Financials | Change orders, pay applications, budget commitments, invoicing |
| Scheduling | Gantt / CPM scheduling tied to tasks, look-ahead planning |
| Submittals | Submittal log with approval workflow |
| Quality & Safety | Inspections, observation reports, safety checklists, OSHA logs |
| Mobile field app | Offline-capable PWA, photo capture with GPS stamps, e-signatures |
| Integrations | Accounting (QuickBooks/Sage), BIM (Autodesk), ERP |
| Reporting | Custom report builder, owner portal, automated daily-report PDFs |
| Auth & roles | Multi-tenant orgs, role-based access (PM / supt / foreman / sub / viewer) |
| Real-time | WebSocket notifications, live RFI comments |

---

## 2. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | React 18 + TypeScript + Vite | Fast HMR, mature ecosystem |
| **UI** | Tailwind CSS v3 + shadcn/ui + Radix primitives | Accessible, consistent, themeable |
| **Charts** | Recharts | Lightweight data viz |
| **Routing** | Wouter (hash-based) | Works inside deployed iframes |
| **State/data** | TanStack React Query | Server-state caching, optimistic UI |
| **Backend** | Express 5 (Node) | Simple REST API on port 5000 |
| **ORM** | Drizzle ORM | Type-safe SQL, great DX |
| **Database** | SQLite (better-sqlite3) | Zero-config persistence for the demo; swap for Postgres at scale |
| **Validation** | Zod (via drizzle-zod) | Shared schemas between client/server |

**Production-grade swaps for a real launch:** Postgres (Drizzle supports it), Supabase or Clerk for auth/multi-tenant, S3 for documents, a PWA shell for offline field capture, and Vercel/Fly.io for hosting.

### Data model
`team_members` · `projects` (budget, spent, progress, superintendent) · `tasks` (trade, status, priority, assignee, due) · `rfis` (number, subject, status, due) · `daily_logs` (weather, crew, summary) · `punch_items` (location, trade, status).

### API surface
`GET/POST /api/projects` · `GET /api/projects/:id` · `GET/POST /api/tasks` · `PATCH /api/tasks/:id/status` · `GET/POST /api/rfis` · `GET/POST /api/daily-logs` · `GET /api/punch` · `PATCH /api/punch/:id/status` · `GET /api/team` — each endpoint filters by `?projectId=` where relevant.

---

## 3. Pricing — what to charge

Two scenarios depending on whether you are **selling the build** (custom dev for a client) or **selling the product** (SaaS subscriptions). Both are grounded in 2026 market data.

### A) Custom build (you're building it for a client)

| Scope | Price range | Timeline |
|-------|-------------|----------|
| Focused MVP (this prototype + auth, ~2-3 workflows) | **$40K – $80K** | 8–12 weeks |
| Full field-PM platform (subcontractor portal, offline mobile, integrations) | **$150K – $300K** | 4–6 months |
| Procore-tier ERP (financials, BIM, accounting sync, deep reporting) | **$300K – $500K+** | 6–12 months |

Rule of thumb from market data: a small-business system replacing spreadsheets lands **$40K–$80K**; a full project-management platform runs **$150K–$300K** ([Digital Heroes](https://blog.digitalheroesco.com/industries/custom-construction-management-software/)). Add ongoing **~$3K/month** maintenance/hosting ([Slickrock](https://www.slickrock.dev/saas-tax/procore)).

Price it as a fixed-scope phase 1 (the MVP) with a retainer for phase 2 features — this protects margin on a category where scope creeps fast.

### B) SaaS product (you're selling subscriptions)

Procore is the price ceiling: it charges by **annual construction volume**, not seats, and small-to-mid contractors typically pay **$10K–$60K/year** ($375–$1,749/mo per company) with unlimited users ([EHS Reviews](https://ehsreviews.com/procore-review/), [US Tech Automations](https://ustechautomations.com/resources/blog/automate-procore-alternatives-for-construction-firms-2026)). For a $50M–$150M GC that becomes **five-to-six figures/year** ([EyeOn Automations](https://www.eyeonautomations.com/blog/custom-software-vs-procore-for-construction-companies)).

That pricing model (per-seat "SaaS tax") is exactly the gap a focused competitor can exploit. Recommended packaging — undercut Procore while staying profitable:

| Plan | Price | Best for |
|------|-------|----------|
| **Starter** | $199 /mo flat | Solo GCs & remodelers, 1 project portfolio |
| **Pro** | $499 /mo flat | Small GCs ($2M–$10M), unlimited projects |
| **Business** | $1,200 /mo + $39/user field | Mid-market ($10M–$50M), 5–25 users |
| **Enterprise** | Custom ($15K–$50K+/yr) | Large GCs, modules, SSO, integrations |

Flat per-company pricing (not per-seat) is the key wedge — it removes the "SaaS tax" fear that pushes firms toward custom builds. The opening price for a small GC/remodeler in 2026–27 sits around **$239–$499/mo per company + $39–$89/user** ([Pulse RevOps](https://pulserevops.com/knowledge/gp0088)).

### If you charge one number
- **Selling the build to a single client:** quote **$60K–$90K** for this MVP + auth, in the **$40K–$80K** market band, billed milestone-based with a ~$3K/mo support retainer.
- **Selling it as a product:** launch at **$499/mo flat** (Pro plan) targeting mid-market GCs; Procore's floor for comparable firms is ~$375+/user/month, so $499/mo for the whole company is an easy sell.

---

## 4. Running locally

```bash
cd fieldpm
npm install
npm run dev          # Express + Vite on http://localhost:5000
npm run build       # production build -> dist/
npm start           # production server
```

The SQLite database (`data.db`) auto-creates tables and seeds on first run. Delete `data.db*` to reseed.

---

*TrussPath — prototype built July 2026. Pricing figures are directional estimates from third-party analyses (July 2026) and should be re-verified against current vendor quotes before any commercial use.*
