# Page Spec Schema

## Purpose

Step 3.9's page spec writer (`design-ux-architect` in Phase 3.9 role) emits one file per screen to `docs/plans/page-specs/{screen-name}.md`. Each file is the spatial blueprint for a single screen — ASCII wireframe + structured metadata — so Phase 4 implementers know exactly what to build without interpreting prose. This protocol defines the required sections, wireframe format, platform conventions, and validation rules.

## Inputs

The page spec writer reads these artifacts before producing any page spec:

- `docs/plans/product-spec.md` — feature states, data requirements, persona constraints, screen inventory
- `docs/plans/architecture.md` — frontend component hierarchy, routing, API contracts
- `docs/plans/ux-architecture.md` — navigation model, user flows, information architecture
- `docs/plans/visual-dna.md` — 6-axis DNA card (Density axis drives layout decisions)
- `docs/plans/visual-design-spec.md` — tokens, spacing scale, typography ramp
- `docs/plans/component-manifest.md` — library component picks per slot
- `docs/plans/design-references/` — competitor/inspiration screenshots for layout reference

## Questions Answered

Page specs close three questions from the Phase 0-3 question map:

- **Q50** — Screen layouts (spatial arrangement of every element)
- **Q51** — Content hierarchy (what's primary, secondary, tertiary per screen)
- **Q53** — Key copy per screen (headings, CTAs, empty states, errors)

## File Convention

- Path: `docs/plans/page-specs/{screen-name}.md` (kebab-case)
- Anchors: `page-specs/{screen-name}#wireframe`, `page-specs/{screen-name}#content-hierarchy`, `page-specs/{screen-name}#key-copy`, etc.
- One file per screen in the product-spec Screen Inventory. Multi-step flows (e.g., checkout) get one file per step.

## Required Sections

Every page spec MUST contain these sections, in this order.

### 1. Screen Overview

One line: what this screen is, which feature(s) it serves.

### 2. ASCII Wireframe

Spatial layout using box-drawing characters. Desktop wireframe required for all platforms. Mobile wireframe required for web projects. Section labels inside brackets map to Content Hierarchy entries.

### 3. Content Hierarchy

Ordered list (top → bottom, primary → tertiary) of every content section. Each entry: section name, data shown, component from manifest (or `custom`), data source (API endpoint or `local`/`computed`), visual weight (`primary`/`secondary`/`tertiary`).

### 4. Key Copy

Headings, CTAs, labels, empty state messages, error messages for this screen. Not every string — the ones that set the tone and guide implementation.

### 5. Responsive Behavior (web only)

What changes at each breakpoint: desktop (1024px+), tablet (768px), mobile (375px). What reflows, collapses, or hides.

### 6. Platform Conventions

Which platform patterns this screen follows. iOS: navigation stack, tab bar, sheets. Web: sidebar state, breadcrumbs, header nav. Reference the relevant HIG pattern or web convention.

### 7. Data Loading

What's fetched on mount, loading skeleton description, refresh strategy (pull-to-refresh, auto-refresh, manual).

### 8. States

Reference to product-spec feature states, plus screen-specific visual states: skeleton loading, partial data, stale indicator, empty, error.

## ASCII Wireframe Format

**Characters:** `┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼`

**Rules:**
- Label every section inside brackets: `[Header]`, `[Sidebar]`, `[KPI Cards]`
- Show relative sizing — sidebar narrower than main content
- Desktop wireframe: ~60 chars wide
- Mobile wireframe: ~30 chars wide
- Include placeholder text for key copy: `[Place Order]`, `[Your cart is empty...]`
- Density axis from visual-dna.md drives spacing: Airy = generous gaps between sections, fewer items visible. Dense = compact rows, more items per viewport.

## Platform-Specific Wireframe Conventions

**Web SaaS:** Sidebar + main content area. Header with nav. Sidebar collapses to hamburger on mobile.

**iOS:** Navigation bar at top (title, back button if applicable), content area, tab bar at bottom. Standard HIG layout patterns.

**Dashboard/Analytics:** Filter bar, card grid, chart placement. Dense layout with data tables.

**CLI:** No wireframe. Show command output format with example terminal session instead.

**Mobile (React Native/Expo):** Follow target platform conventions — iOS patterns if iOS, Material if Android, cross-platform neutral if both.

## Validation Checklist

1. Every screen in product-spec.md Screen Inventory has a page spec file
2. Every page spec has all 8 required sections (skip Responsive Behavior for non-web)
3. Every content hierarchy entry references a component from `component-manifest.md` or marks it `custom`
4. Every data source references an API endpoint from `architecture.md#backend/api` or marks it `local`/`computed`
5. ASCII wireframe exists for desktop (and mobile for web projects)
6. Section labels in wireframe match content hierarchy entry names
7. Key copy includes at least: one heading, one primary CTA, one empty state message

## Worked Example: Dashboard (Web SaaS)

```markdown
# Page Spec: Dashboard

## Screen Overview

Main dashboard — KPI summary, recent activity, and quick actions. Features: Dashboard, Notifications.

## ASCII Wireframe

### Desktop (1024px+)

┌──────────────────────────────────────────────────────────┐
│ [Header]                          [Search] [Avatar ▼]    │
├────────────┬─────────────────────────────────────────────┤
│ [Sidebar]  │ [Page Title: Dashboard]                     │
│            │                                             │
│  Dashboard │ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  Orders    │ │[KPI:    ]│ │[KPI:    ]│ │[KPI:    ]│       │
│  Products  │ │ Revenue  │ │ Orders   │ │ Users    │       │
│  Customers │ │ $12,340  │ │ 142      │ │ 1,203    │       │
│  Settings  │ └─────────┘ └─────────┘ └─────────┘        │
│            │                                             │
│            │ ┌──────────────────────────────────────┐    │
│            │ │[Revenue Chart]                       │    │
│            │ │                                      │    │
│            │ │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇                │    │
│            │ │                                      │    │
│            │ └──────────────────────────────────────┘    │
│            │                                             │
│            │ ┌──────────────────────────────────────┐    │
│            │ │[Activity Feed]                       │    │
│            │ │ • New order #1042 — 2m ago           │    │
│            │ │ • User signed up — 15m ago           │    │
│            │ │ • Payment received — 1h ago          │    │
│            │ └──────────────────────────────────────┘    │
├────────────┴─────────────────────────────────────────────┤
│ [Footer]                                                 │
└──────────────────────────────────────────────────────────┘

### Mobile (375px)

┌────────────────────────────┐
│ [Header]  [☰]   [Avatar]  │
├────────────────────────────┤
│ [Page Title: Dashboard]    │
│                            │
│ ┌────────────────────────┐ │
│ │[KPI: Revenue]  $12,340 │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │[KPI: Orders]   142     │ │
│ └────────────────────────┘ │
│ ┌────────────────────────┐ │
│ │[KPI: Users]    1,203   │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │[Revenue Chart]         │ │
│ │ ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇   │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │[Activity Feed]         │ │
│ │ • New order — 2m ago   │ │
│ │ • Signup — 15m ago     │ │
│ │ • Payment — 1h ago     │ │
│ └────────────────────────┘ │
└────────────────────────────┘

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | KPI Cards | Revenue, order count, active users (current period + delta) | `StatCard` from manifest | `GET /api/dashboard/kpis` | primary |
| 2 | Revenue Chart | 30-day revenue trend line | `AreaChart` from manifest | `GET /api/dashboard/revenue?range=30d` | primary |
| 3 | Activity Feed | Last 10 events (orders, signups, payments) with relative timestamps | `FeedList` from manifest | `GET /api/dashboard/activity?limit=10` | secondary |
| 4 | Header | App logo, search, user avatar dropdown | `AppHeader` from manifest | `local` (user session) | tertiary |
| 5 | Sidebar | Navigation links with active state, unread badge on notifications | `SideNav` from manifest | `local` (route) + `GET /api/notifications/count` | tertiary |

## Key Copy

- **Page heading:** "Dashboard"
- **KPI labels:** "Revenue" · "Orders" · "Active Users"
- **KPI delta format:** "+12% vs last period" / "−3% vs last period"
- **Activity feed heading:** "Recent Activity"
- **Empty activity state:** "No activity yet. Once your first order comes in, you'll see it here."
- **Error state:** "Couldn't load dashboard data. Check your connection and try again." CTA: [Retry]
- **Stale indicator:** "Last updated 5 minutes ago" (appears after 60s without refresh)

## Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (1024px+) | Sidebar visible. KPI cards in 3-column row. Chart full width of main area. |
| Tablet (768px) | Sidebar collapses to icon-only rail. KPI cards in 3-column row (narrower). Chart full width. |
| Mobile (375px) | Sidebar hidden behind hamburger menu. KPI cards stack vertically (full width each). Chart full width. Activity feed below chart. |

## Platform Conventions

- **Web SaaS pattern:** Persistent sidebar navigation with active-state highlight on current page. Header with global search and user menu. Breadcrumbs not needed (top-level screen).
- **Sidebar:** Collapsible — user preference persisted in local storage. Icon-only mode at tablet breakpoint.
- **Data refresh:** No pull-to-refresh (web). Auto-refresh every 60s via polling. Manual refresh button in header.

## Data Loading

- **On mount:** Parallel fetch `GET /api/dashboard/kpis`, `GET /api/dashboard/revenue?range=30d`, `GET /api/dashboard/activity?limit=10`
- **Loading skeleton:** 3 shimmer rectangles for KPI cards (same dimensions as loaded cards). Chart area shows shimmer block. Activity feed shows 3 shimmer rows with avatar circle + text lines.
- **Refresh:** Auto-poll every 60s. Stale indicator appears if last successful fetch > 60s ago. No full-page reload — data swaps in place.

## States

- **From product-spec:** `initial`, `loading`, `loaded`, `empty`, `error`, `stale`
- **Screen-specific visuals:**
  - `skeleton-loading` — shimmer cards + shimmer chart + shimmer feed rows (see Data Loading)
  - `partial-data` — KPIs loaded but chart still loading: show KPI cards, chart area shows shimmer
  - `stale` — data older than 60s: subtle "Last updated X ago" badge below page title
  - `empty` — new account, no data yet: KPI cards show "—", chart shows flat line, activity feed shows empty state copy
  - `error` — fetch failed: inline error banner with retry button, no full-page error
```
