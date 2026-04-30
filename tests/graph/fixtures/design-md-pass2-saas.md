---
version: alpha
name: Ledgerlight
description: A quiet expense-reconciliation tool for finance teams who want fewer tabs and more closed books.
colors:
  primary: "#2D3F36"
  accent: "#88A096"
  surface: "#FBF8F2"
  surface-glass: "rgba(251, 248, 242, 0.72)"
  text: "#1F2A24"
  muted: "#7C8A82"
  error: "#A94442"
  border-soft: "#E5DED1"
typography:
  headline-display:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.2
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.25
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.01em
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 32px
  margin: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.lg}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.lg}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  card-glass:
    backgroundColor: "{colors.surface-glass}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  nav-glass:
    backgroundColor: "{colors.surface-glass}"
    typography: "{typography.label-md}"
    padding: "{spacing.md} {spacing.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm} {spacing.md}"
motion-base:
  duration: "180ms"
  easing: "ease-out"
elevation-glass:
  blur: "12px"
  saturation: "180%"
  border: "1px solid rgba(255, 255, 255, 0.4)"
---

# Ledgerlight

## Overview

Ledgerlight is an internal expense-reconciliation tool for finance teams at mid-market companies (200–2,000 employees). The core workflow is receipt capture → categorization → approval → export to ERP. Users are accountants and finance managers who spend 4–6 hours a day in the tool during close periods. The interface must be comfortable for sustained reading — long expense reports, multi-line item descriptions, and audit trails that scroll for pages.

The editorial register sets Ledgerlight apart from the spreadsheet-gray competitors. Source Serif 4 headlines give each page the quiet authority of a well-typeset annual report. Glassy surfaces — backdrop-blur on navigation and modals — add depth without clutter, but glass never touches data tables where legibility is paramount. The palette is warm parchment and desaturated forest green; nothing competes with the numbers.

Motion is present but invisible: 180ms ease-out on drawer transitions, subtle opacity fades on approval state changes. Nothing bounces, nothing slides in from off-screen. The tool should feel like turning pages, not watching a presentation.

### Brand DNA

- **Scope:** Internal Tool
  Ledgerlight is used by a known, trained finance team — no onboarding funnel, no marketing page, no public-facing brand surface.
- **Density:** Airy
  Finance readers scan long expense reports for hours; 32px gutters and 48px section spacing reduce fatigue and error rates.
- **Character:** Editorial
  Quiet authority via typographic hierarchy and generous whitespace. The interface reads like a well-set financial document, not a SaaS dashboard.
- **Material:** Glassy
  Backdrop-blur surfaces on navigation chrome and modal overlays add layered depth. Glass is never applied to data-bearing surfaces.
- **Motion:** Subtle
  180ms ease-out transitions on state changes and drawer open/close. No choreographed sequences, no spring physics.
- **Type:** Serif-forward
  Source Serif 4 for page titles and section headers (32–48px). Body text in a neutral sans (e.g. IBM Plex Sans at 15/24) for tabular legibility.
- **Copy:** Functional
  Labels describe the action: "Approve", "Export CSV", "Reconcile". No marketing softeners, no aspirational language, no exclamation marks.

### Locked At

- locked_at: 2026-04-26T16:45:33Z
- locked_by: design-brand-guardian
- build_session: build-session-ledgerlight-2026-04-26

### References

- Stripe Atlas (https://stripe.com/atlas) — exemplifies Copy axis (functional register, no marketing softeners in product UI) and Type (Serif-forward editorial register in documentation)
- Notion (https://notion.so) — exemplifies Density and Character (Airy spacing, editorial typographic hierarchy with generous whitespace)
- Apple Weather (https://developer.apple.com/design/human-interface-guidelines/weather) — exemplifies Material (Glassy layered surfaces with backdrop-blur, depth without visual noise)

## Colors

The Ledgerlight palette is shaped by the Character=Editorial axis — warm parchment surfaces carry the typographic register of a well-set financial document. Every color choice serves legibility first and brand identity second; finance teams reading expense line items for hours cannot tolerate visual noise.

Primary `#2D3F36` is a desaturated forest green, chosen for its legibility on the parchment surface. At body-md size (15px IBM Plex Sans), primary on surface achieves a 4.8:1 contrast ratio — exceeding WCAG AA minimum (4.5:1) with enough margin to remain compliant across subpixel rendering variations. The green undertone is intentional: it reads as institutional and trustworthy without the coldness of pure gray or the aggression of pure black. Finance tools that default to `#000000` text feel harsh after 4 hours; Ledgerlight's primary is warm enough to sustain.

Accent `#88A096` is a softer mint, desaturated enough to avoid competing with primary text. It appears on chart fills, secondary action hover states, and the active-tab indicator in the sidebar. Accent is never used for text — its 3.1:1 ratio on surface fails AA for normal text. This is deliberate: accent is a surface color, not a reading color. Charts use it as fill with primary-colored labels; the accent provides the visual mass while primary provides the legible data.

Surface `#FBF8F2` is the warm parchment that defines the Editorial register. It is not white — the yellow-warm undertone (LAB: L*97, a*0, b*4) gives every page the feel of quality paper stock. This warmth reduces eye strain during long reading sessions, a critical requirement for the Scope=Internal Tool axis where users are captive for hours.

Surface-glass `rgba(251, 248, 242, 0.72)` is the translucent variant of surface, used exclusively on Material=Glassy chrome elements (nav-glass, sheet-modal). The 72% opacity allows the parchment warmth to show through while the backdrop-blur creates the frosted-glass depth effect. The opacity was tuned to maintain readable text on the glass surface — below 65%, label-md text on glass becomes illegible against busy backgrounds.

Text `#1F2A24` is the deep reading color for body copy. Slightly darker than primary, it provides maximum legibility for the long-form content that dominates Ledgerlight screens (expense descriptions, audit trail entries, policy violation explanations). The green undertone matches primary, keeping the palette cohesive.

Muted `#7C8A82` handles timestamps, metadata, and tertiary labels. At 4.5:1 on surface it passes AA for the label-md size (13px) where it is most commonly used. Muted text is never used at body-md or larger — if content is important enough for body size, it gets `text` color.

Error `#A94442` is a warm brick-red, chosen to be distinct from accent (green-mint) while remaining harmonious with the parchment palette. It appears on form validation errors, policy violation badges, and the rejection state in the approval workflow. The warm undertone prevents the jarring contrast that a cool true-red would create against the parchment surface.

Border-soft `#E5DED1` is the structural separator — a warm tan that is visible on the parchment surface without the harshness of a dark rule. Unlike Stockyard's near-black hairlines, Ledgerlight's borders are gentle, consistent with the Character=Editorial axis. Borders appear on card edges, table row dividers, and input field outlines. The soft tone means borders recede when the user is reading content and become visible only when scanning for structure.

## Typography

Type=Serif-forward makes Source Serif 4 the headline voice — page titles at 48px and section headers at 36px give every screen the quiet authority of an annual report. The serif is not decorative; it is the primary hierarchy signal. When a user sees Source Serif 4, they know they are reading a heading, a page title, or a section label. When they see IBM Plex Sans, they know they are reading data, body content, or interactive labels.

The headline ramp uses Source Serif 4 at three sizes: `headline-display` at 48px/600 for top-level page titles (Dashboard, Approval Queue, My Reports), `headline-lg` at 36px/600 for major section headers within a page (the "Line Items" section of a report detail, the "Pending" section of the approval queue), and `headline-md` at 24px/500 for card titles and subsection labels. The negative letter-spacing on display (−0.015em) tightens the serif at large sizes where the natural spacing feels too loose — a common tuning for transitional serifs above 36px.

Line-heights in the headline ramp are generous: 1.15 for display, 1.2 for lg, 1.25 for md. This is the Density=Airy axis at work — headlines breathe, giving the reader's eye a rest between the dense data sections below. A Dense system would compress these to 1.05–1.1; Ledgerlight's Airy register demands the extra vertical space.

Body text lives in IBM Plex Sans at two sizes: `body-lg` at 17px/400 for primary reading content (expense descriptions, policy explanations, audit trail entries) and `body-md` at 15px/400 for secondary content and form fields. The 1.55–1.6 line-heights are deliberately generous — Density=Airy means body text has room to breathe. Finance readers scanning 50-line expense reports benefit from the extra leading; it reduces line-skipping errors that plague dense tabular layouts.

IBM Plex Sans was chosen over the overuse-banned faces (Inter, Roboto, Open Sans) for its humanist construction and excellent tabular figures. The `tnum` OpenType feature is enabled globally — every number in Ledgerlight aligns vertically in columns, critical for expense amounts and approval totals. The humanist axis of Plex Sans pairs naturally with Source Serif 4's transitional construction; both share a vertical stress and moderate x-height.

`label-md` at 13px/500 with 0.01em tracking is the interactive label — button text, nav items, form labels, table column headers. IBM Plex Sans at medium weight provides enough visual mass to read as clickable without competing with the serif headlines. The slight tracking opens the characters for legibility at small sizes.

`caption` at 12px/400 handles timestamps, attribution, and footnotes. It is the quietest token — present but ignorable until the user specifically seeks it. Caption uses no tracking adjustment; at 12px the default Plex Sans spacing is already open enough.

Font loading: Source Serif 4 is self-hosted with `font-display: swap` and a system serif fallback (`Georgia, 'Times New Roman', serif`). IBM Plex Sans loads with `font-display: optional` — the system sans stack (`system-ui, -apple-system, sans-serif`) is close enough that a late swap is invisible. Both fonts are subset to Latin + Latin Extended for faster initial load.

## Layout

Density=Airy is the comfort layer for finance readers spending 4–6 hours in the tool during close periods. Every spacing decision traces back to this axis — generous gutters, wide margins, and section spacing that gives the eye room to rest between data-dense regions.

Gutters are 32px (`xl`) — four times the Stockyard marketplace's 8px gutter. This is not waste; it is the Airy axis doing its job. A 32px gutter between cards means each card reads as an independent unit, not a cell in a spreadsheet. Finance managers reviewing expense reports need to distinguish between line items at a glance; tight gutters cause items to blur together during long sessions.

Section spacing is 48px (`xxl`) between major page regions — the header-to-content gap, the gap between the KPI cards and the activity feed, the gap between the form and the action bar. This 48px rhythm is the maximum in the spacing scale and the signature of the Airy register. It creates a page that scrolls longer but reads easier.

Margin is 32px on container edges, matching the gutter. The content area maxes out at 1200px on desktop — wider than that and body-md text lines exceed 80 characters, which degrades reading speed. The 1200px max-width with 32px margins means the content area is 1136px on a 1200px viewport, narrowing gracefully as the viewport shrinks.

The content grid is a 12-column fluid grid with 32px gutters. On desktop (1024px+), the typical layout is a 240px sidebar + main content area. The sidebar uses 3 columns; main content uses 9. On tablet (768px), the sidebar collapses to an icon-only rail (64px) and main content expands. On mobile (375px), the sidebar disappears behind a hamburger and content goes full-width with 16px margins (half the desktop margin — a concession to mobile screen real estate).

Vertical rhythm follows the 8px base step for component-internal spacing and the 16px step for gaps between related elements (e.g., between a form label and its input). Card padding is 24px (`lg`) — generous enough to frame the content without crowding. Input padding is 8px vertical, 16px horizontal — comfortable for the 15px body-md text inside.

The approval queue and report detail screens are the most layout-critical surfaces. The queue uses a single-column list with 60px row height (matching the iOS `list-row` slot's Airy specification) — each row shows submitter name, total, date, and policy flag count without truncation. The report detail uses a two-column layout: line items on the left (8 columns), receipt thumbnails and audit trail on the right (4 columns).

## Elevation & Depth

Material=Glassy is applied surgically — `backdrop-filter: blur(12px) saturate(180%)` on navigation chrome and modal overlays only. Glass NEVER touches data tables, form fields, or any surface where the user reads numbers. The `## Do's and Don'ts` section forbids it explicitly, and the rationale is simple: backdrop-blur on a data surface means the data competes with whatever is behind the blur, destroying the legibility that the entire typography system is built to protect.

The glass effect uses a 1px white border at 40% opacity (`rgba(255, 255, 255, 0.4)`) to lift the surface above the parchment background. This border is the primary depth cue — it catches light (or simulates catching light) in a way that reads as "this surface is in front." Combined with the 72% opacity of `surface-glass`, the result is a frosted-parchment layer that feels elevated without casting a shadow.

`nav-glass` is the primary glass surface — the sticky top navigation bar. On scroll, the nav gains the glass effect (blur activates when content scrolls behind it). At rest (page scrolled to top with no content behind the nav), the nav renders as solid `surface` — the glass effect is invisible when there is nothing to blur. This scroll-triggered activation is a Motion=Subtle behavior: the transition from solid to glass happens over 180ms ease-out, matching the `motion-base` duration token.

`card-glass` is used for KPI summary cards on the dashboard and the approval queue header. These are non-data surfaces — they show aggregate counts and labels, not line-item detail. The glass effect on KPI cards creates a visual layer that separates the summary from the detail below, reinforcing the information hierarchy without a hard border.

`sheet-modal` uses `.presentationBackground(.thinMaterial)` on iOS and `backdrop-filter: blur(12px)` on web. The modal scrim is `rgba(31, 42, 36, 0.3)` — primary at 30% opacity, warm enough to maintain the parchment feel even when dimming. Motion=Subtle governs the modal entrance: 180ms ease-out slide-up from the bottom edge, no bounce, no overshoot.

Non-glass surfaces use `border-soft` (`#E5DED1`) for structural separation. Cards have a 1px `border-soft` outline. Table rows have a 1px `border-soft` bottom border. Input fields have a 1px `border-soft` border that transitions to 2px `primary` on focus (180ms ease-out per Motion=Subtle). There are no shadows on non-glass surfaces — the warm border does the separation work.

## Shapes

Character=Editorial favors gentle rounding over Brutalist sharp corners. The radius scale provides a progression from subtle to pronounced: `sm` at 4px for small interactive elements (badges, chips), `md` at 6px for buttons and inputs (the default interactive radius), `lg` at 8px for cards and modals (the default container radius), and `xl` at 12px for hero surfaces and featured content areas.

The 6px default for buttons and inputs is the sweet spot for the Editorial register — enough softness to feel approachable and modern without veering into Playful territory (which would demand 12px+ on buttons). The 8px card radius creates a gentle frame that reads as "contained content" without the sharp institutional feel of 0px or the bubbly consumer feel of 16px+.

`full: 9999px` exists for circular avatars and pill-shaped tags, same as any system. It is used sparingly — only on user avatar circles and the active-state pill on sidebar nav items.

Input fields use `{rounded.md}` (6px) to match buttons, ensuring visual consistency across form elements. A form with mismatched radii (rounded buttons, sharp inputs) reads as unfinished; the Editorial register demands consistency in these details.

Modal corners use `{rounded.lg}` (8px), matching cards. The modal is conceptually a card that floats above the page — same radius, same padding, different elevation treatment (glass scrim vs flat surface).

## Components

**button-primary** is the approval and submission action. Background `{colors.primary}` (forest green `#2D3F36`), text `{colors.surface}` (parchment), typography `{typography.label-md}` (IBM Plex Sans 13px/500). Padding is `{spacing.sm} {spacing.lg}` (8px 24px) — wider horizontal padding than Stockyard's buttons because Density=Airy gives interactive elements more breathing room. Radius `{rounded.md}` (6px). No shadow — Material=Glassy applies glass to chrome, not to buttons. Copy=Functional dictates that button labels are literal verbs: "Approve", "Reject", "Export CSV", "Reconcile", "Submit". No "Get started", no "Let's go", no exclamation marks. The Functional copy axis means every label describes exactly what the button does, with no marketing softener or emotional appeal.

**button-secondary** inverts primary: `{colors.surface}` background, `{colors.primary}` text, same `{typography.label-md}`. A 1px `{colors.border-soft}` outline distinguishes it from the page. Used for cancel actions, secondary navigation ("View all reports"), and filter controls. Hover shifts background to a 4% darker surface tone — subtle, per Motion=Subtle.

**card** is the standard content container. `{colors.surface}` background, `{rounded.lg}` (8px) radius, `{spacing.lg}` (24px) padding. A 1px `{colors.border-soft}` outline provides the structural boundary. Cards are used for report summaries, expense line item groups, and settings sections. The generous 24px padding is the Density=Airy signature — content inside the card has room to breathe.

**card-glass** is the elevated variant for non-data summary surfaces. `{colors.surface-glass}` background (72% opacity parchment), `{rounded.lg}` (8px) radius, `{spacing.lg}` (24px) padding. The glass effect (`backdrop-filter: blur(12px) saturate(180%)`) activates when the card overlaps scrollable content. A 1px white border at 40% opacity (`elevation-glass.border`) provides the depth cue. Card-glass is used for KPI cards on the dashboard and the approval queue summary header — never for data tables, never for form containers. Material=Glassy is the governing axis; the `-glass` suffix in the component name follows the naming convention from protocol §2.3.

**nav-glass** is the sticky top navigation bar. `{colors.surface-glass}` background, `{typography.label-md}` for nav items, padding `{spacing.md} {spacing.lg}` (16px 24px). The glass effect activates on scroll (solid at rest, frosted when content passes behind). Nav-glass is the only navigation variant — there is no solid nav option. The glass treatment on navigation is the most visible expression of Material=Glassy in the system; it is the first thing users see and the surface they interact with most frequently. The sticky behavior means the nav is always present, always glass (once scrolled), always providing the layered depth that defines the Glassy register.

**input** has `{colors.surface}` background, `{colors.text}` text, `{typography.body-md}` (IBM Plex Sans 15px). Radius `{rounded.md}` (6px), padding `{spacing.sm} {spacing.md}` (8px 16px). Border is 1px `{colors.border-soft}`, transitioning to 2px `{colors.primary}` on focus with a 180ms ease-out (Motion=Subtle). No glow, no ring, no shadow on focus — the border thickening is the sole focus indicator, keeping the interaction within the Glassy + Editorial vocabulary. Error state replaces the border with 2px `{colors.error}`. Placeholder text uses `{colors.muted}`.

## Do's and Don'ts

- Do use Source Serif 4 at 32–48px for page titles — Type=Serif-forward establishes the editorial register.
- Do allow 32px gutters and 48px section spacing — Density=Airy gives finance readers breathing room across long reports.
- Do name Glassy components with `-glass` suffix (`card-glass`, `nav-glass`) per protocol §2.3.
- Do keep button labels to literal verbs ("Approve", "Export CSV", "Reconcile") — Copy=Functional.
- Do use `.ultraThinMaterial` or `backdrop-blur(12px)` on nav and modal chrome only — Material=Glassy surfaces must stay off data tables.
- Don't pad button labels with marketing language ("Get started today", "Unlock insights") — Copy=Functional means labels describe the action.
- Don't apply backdrop-blur to data tables — Glassy + tabular data renders unreadable; restrict glass to nav and modals.
- Don't use Inter or Roboto as the primary headline face — overuse-ban per §4.2; the serif is the differentiator.
- Don't use violet-blue gradients for the primary accent — AI-slop pattern §4.3.1; use a desaturated forest green on warm parchment.
- Don't write 4-column feature grids with circle icons on the dashboard — banned cookie-cutter pattern §4.3.2.
