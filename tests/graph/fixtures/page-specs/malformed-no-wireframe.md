# Page: Account Settings

## Screen Overview

Account Settings — profile management, notification preferences, payment methods, and sign-out for both Buyer and Seller personas.

## Route

`/settings/account`

## ASCII Wireframe

Wireframe pending — see Figma link: https://figma.com/file/stockyard-settings-draft

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | Header | Logo, nav links, avatar | `nav-top` from manifest | `local` (session) | tertiary |
| 2 | Profile | Display name, email, avatar upload | `form-input` from manifest | `GET /api/user/profile` | primary |
| 3 | Notifications | Email and push notification toggles per event type | `form-checkbox` from manifest | `GET /api/user/profile` | secondary |
| 4 | Payment Methods | Saved cards list with add/remove actions | `data-table` from manifest | `GET /api/user/payment-methods` | secondary |
| 5 | Sign Out | Sign out button | `button-secondary` from manifest | `local` (triggers `POST /api/auth/logout`) | tertiary |

## States

| State | Appearance |
|-------|-----------|
| loaded | All sections populated with user data. Save button enabled. |
| saving | Save button disabled with inline spinner. Form fields locked. "Saving..." label on button. |
| error | Inline error banner below header: "Couldn't save your changes. Please try again." Save button re-enabled. Form fields unlocked with prior values preserved. |

## Key Copy

- **"Account Settings"** — placement: page heading (h1).
- **"Save changes"** — placement: primary action button at bottom of form.
- **"Settings saved"** — placement: success toast (4s duration, auto-dismiss).

## Responsive Behavior

| Breakpoint | Changes |
|-----------|---------|
| Desktop (1024px+) | Two-column layout: sidebar nav left, settings form right. |
| Tablet (768px) | Single column, full width. Sidebar collapses to top tabs. |
| Mobile (375px) | Single column, full width with 16px margin. Sections stack vertically. |

## Data Loading

- **On mount:** `GET /api/user/profile` returns profile data, notification preferences, and payment methods in a single response.
- **On save:** `PATCH /api/user/profile` with changed fields only. On 200: show success toast. On 4xx/5xx: show error state.
- **Loading skeleton:** Shimmer blocks matching form field dimensions. Header renders immediately.

## Component Picks

| Section | Role | Manifest Slot |
|---------|------|---------------|
| Header | Top navigation bar | `nav-top` |
| Profile — Name | Text input | `form-input` |
| Profile — Email | Text input (read-only) | `form-input` |
| Notifications | Toggle checkboxes | `form-checkbox` |
| Payment Methods | Card list table | `data-table` |
| Save | Primary action button | `button-primary` |
| Sign Out | Secondary action button | `button-secondary` |
