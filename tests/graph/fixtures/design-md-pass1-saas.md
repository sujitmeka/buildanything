---
version: alpha
name: Ledgerlight
description: A quiet expense-reconciliation tool for finance teams who want fewer tabs and more closed books.
colors:
typography:
rounded:
spacing:
components:
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

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Typography

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Layout

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Elevation & Depth

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Shapes

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Components

<!-- Pass 2 — UI Designer at Step 3.4 -->

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
