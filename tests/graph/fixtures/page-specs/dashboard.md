# Page: Dashboard

## Screen Overview

Analytics dashboard — home screen for Ledgerlight finance managers. Displays KPI summary cards, revenue trend chart, and recent activity feed. Density=Airy drives generous spacing; Material=Glassy applies to nav and modal chrome only.

## Route

`/dashboard`

## ASCII Wireframe

### Desktop (1024px+)

```
┌──────────────────────────────────────────────────────────┐
│ [Header]                                                 │
│  Ledgerlight                    [Refresh]  [Avatar ▼]    │
├────────────┬─────────────────────────────────────────────┤
│ [Sidebar   │ Dashboard                                   │
│  Nav]      │ Last updated 5 minutes ago                  │
│            │                                             │
│  Dashboard │ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  Reports   │ │[KPI Card]  │ │[KPI Card]  │ │[KPI Card]│ │
│  Approvals │ │ Open       │ │ Pending    │ │ Closed   │ │
│  Settings  │ │ Reports    │ │ Approvals  │ │ This Mo. │ │
│            │ │    12      │ │    7       │ │    43    │ │
│            │ │ +3 vs last │ │ −2 vs last │ │ +8 vs   │ │
│            │ └────────────┘ └────────────┘ └──────────┘ │
│            │                                             │
│            │ [KPI Cards Row]                             │
│            │                                             │
│            │ ┌──────────────────────────────────────┐    │
│            │ │[Revenue Chart]                       │    │
│            │ │                                      │    │
│            │ │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇                │    │
│            │ │  Jan  Feb  Mar  Apr                  │    │
│            │ │                                      │    │
│            │ └──────────────────────────────────────┘    │
│            │                                             │
│            │ ┌──────────────────────────────────────┐    │
│            │ │[Activity Feed]                       │    │
│            │ │ • Report #1042 approved — 2m ago     │    │
│            │ │ • New submission from J. Park — 15m  │    │
│            │ │ • Payout processed — 1h ago          │    │
│            │ └──────────────────────────────────────┘    │
│            │                                             │
├────────────┴─────────────────────────────────────────────┤
│ [Footer]   © 2026 Ledgerlight                            │
└──────────────────────────────────────────────────────────┘
```

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | Header | App wordmark, Refresh button, user avatar dropdown | `nav-top` (web equivalent of `nav-stack`) | `local` (user session) | tertiary |
| 2 | Sidebar Nav | Navigation links: Dashboard, Reports, Approvals, Settings. Active state highlight. | `nav-sidebar` (web equivalent of `tab-bar`) | `local` (route) | tertiary |
| 3 | KPI Cards Row | Three cards: Open Reports, Pending Approvals, Closed This Month — each with count + delta vs prior period | `kpi-card` (web equivalent of `card-glass` for iOS 26+) | `GET /api/dashboard/kpis` | primary |
| 4 | Revenue Chart | 30-day revenue trend area chart with month labels | `chart-area` (custom chart component) | `GET /api/dashboard/revenue?range=30d` | primary |
| 5 | Activity Feed | Last 10 events (approvals, submissions, payouts) with relative timestamps | `feed-list` (web equivalent of `list-row`) | `GET /api/dashboard/activity?limit=10` | secondary |
| 6 | Footer | Copyright, version | `footer` (custom) | `local` (static) | tertiary |

## States

| State | Appearance |
|-------|-----------|
| skeleton-loading | Three shimmer rectangles for KPI cards (matching final card dimensions). Chart area shows shimmer block. Activity feed shows 3 shimmer rows with circle + text lines. Sidebar and header render immediately. |
| loaded | All sections populated with live data. Stale indicator hidden (data fresh). |
| partial-data | KPI cards loaded and visible. Chart area still shows shimmer block. Activity feed still shows shimmer rows. Stale indicator hidden. |
| empty | New account, no data. KPI cards show "—" for counts, delta hidden. Chart shows flat line at zero. Activity feed shows empty-state copy. |
| error | Inline error banner below page title: "Couldn't load dashboard data. Check your connection and try again." with Retry button. KPI cards, chart, and feed show last-known-good data if available, otherwise skeleton. |

## Key Copy

- **"Dashboard"** — placement: page heading (h1). Source Serif 4 per Type=Serif-forward.
- **"Open Reports" / "Pending Approvals" / "Closed This Month"** — placement: KPI card titles. IBM Plex Sans label-md.
- **"No activity yet. Once expense reports start flowing, you'll see them here."** — placement: activity feed empty state body.
- **"Last updated 5 minutes ago"** — placement: subtle timestamp below page title, visible when data age > 60s.
- **"Couldn't load dashboard data. Check your connection and try again."** — placement: inline error banner below page title.
- **"Refresh"** — placement: header secondary action button (Copy=Functional — label describes the action).

## Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (1024px+) | Sidebar visible (240px wide). KPI cards in 3-column row. Chart full width of main area. Activity feed below chart. Footer full width. |
| Tablet (768px) | Sidebar collapses to icon-only rail (64px). KPI cards remain 3-column (narrower). Chart and feed unchanged. |
| Mobile (375px) | Sidebar hidden behind hamburger menu in header. KPI cards stack vertically (full width each). Chart full width. Activity feed below chart. Footer stacks. |

## Data Loading

- **On mount:** Parallel fetch — `GET /api/dashboard/kpis`, `GET /api/dashboard/revenue?range=30d`, `GET /api/dashboard/activity?limit=10`. Each resolves independently (partial-data state supported).
- **Auto-refresh:** Poll every 60s. Stale indicator appears if last successful fetch > 60s ago. No full-page reload — data swaps in place.
- **Loading skeleton:** Shimmer cards (3) + shimmer chart block + shimmer feed rows (3). Sidebar and header render immediately from local state.
- **Refresh button:** Manual trigger re-fires all three fetches. Button shows spinner during fetch.

## Component Picks

| Section | Role | Manifest Slot |
|---------|------|---------------|
| Header | Top navigation bar (glass surface on scroll) | `nav-top` |
| Sidebar Nav | Persistent side navigation | `nav-sidebar` |
| KPI Cards | Summary metric cards | `kpi-card` |
| Revenue Chart | Area trend chart | `chart-area` |
| Activity Feed | Event list with timestamps | `feed-list` |
| Footer | Page footer | `footer` |
| Header — Refresh | Secondary action button | `button-tinted` |
| Header — Avatar | User menu trigger | `button-secondary` |
