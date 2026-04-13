# architecture.md Anchor Convention

## Purpose

Phase 2.3's architecture synthesizer emits `docs/plans/architecture.md` with **stable section anchors** so that Phase 5.1 implementer agents can receive content-addressed **refs** (file path + anchor name) instead of pasted content slices. This document defines the required top-level sections, the anchor naming convention, the minimum subsection anchors each top-level section must provide, the exact ref format Phase 5.1 prompts inject, and the synthesizer's output contract. Introduced in Wave 1 (W1-4) to close the capdotai Phase 5 regression where the orchestrator loaded a 43KB architecture doc into its own context 48 times to slice it — violating the "dispatcher not doer" HARD-GATE at `commands/build.md:24` and burning ~528K tokens on slicing alone.

## Required top-level sections

The synthesized `architecture.md` MUST contain these top-level headings, in this order:

- `# Overview`
- `# Frontend`
- `# Backend`
- `# Data Model`
- `# Security`
- `# Infrastructure`
- `# MVP Scope`
- `# Out of Scope`

For iOS builds, `# Frontend` MAY be titled `# App` and `# Backend` MAY be omitted if the app is fully on-device (the `.refs.json` index reflects whatever headings exist). For web builds, all eight headings are required.

## Anchor naming rules

- Anchors are **kebab-case** within a section — lowercase, hyphen-separated, no spaces.
- Subsections use a **nested anchor** of the form `parent/child`. For example, `frontend/checkout` refers to a `## Checkout` subsection under `# Frontend`.
- Anchors must be **stable across synthesizer reruns**. A rerun of the synthesizer on the same inputs must produce the same anchors, so that refs cached in `.refs.json` or in implementer prompts do not break.
- Anchors are **referenced via `architecture.md#parent/child`** in prompt bodies and in `.refs.json`. The `#` separator is a plain markdown fragment — no special escaping.
- Deeper nesting (`parent/child/grandchild`) is allowed but discouraged. Prefer two levels.
- Anchor names MUST NOT include spaces, uppercase letters, punctuation other than `-` and `/`, or numeric prefixes like `1-frontend`.

## Required subsection anchors (minimum)

Every synthesized `architecture.md` MUST provide at least these subsection anchors under the named top-level section. Additional subsections are allowed; fewer is a synthesizer failure.

### Under `# Frontend`

- `frontend/layout` — page hierarchy, routing, navigation structure.
- `frontend/components` — core component list and responsibilities.
- `frontend/state` — state management approach (stores, context, local state boundaries).
- `frontend/styling` — design tokens, CSS/styling approach.

### Under `# Backend`

- `backend/services` — service boundaries and responsibilities.
- `backend/api` — API contracts (routes, request/response shapes).
- `backend/persistence` — data layer, ORM choice, query patterns.

### Under `# Data Model`

- `data-model/entities` — entities and their relationships.
- `data-model/migrations` — migration strategy (omit only if no persistence layer exists).

### Under `# Security`

- `security/auth` — authentication and authorization model.
- `security/input-validation` — boundary validation rules.
- `security/secrets` — secret storage and rotation.

## Ref format used by implementer prompts

Phase 5.1 implementer prompts inject a `ARCHITECTURE REFS:` block in place of pasted architecture content. The block is parsed by the implementer agent, which uses the `Read` tool to fetch refs on demand.

```
ARCHITECTURE REFS:
  - architecture.md#frontend/checkout (primary)
  - architecture.md#data-model/orders (secondary — read if touching order creation)
  - architecture.md#security/auth (read if touching /api/checkout)
```

Rules:

- `(primary)` — the implementer MUST Read this ref before starting work.
- `(secondary — read if touching X)` — conditional; the implementer reads only if the task description overlaps with the hint.
- Refs are one per line, bullet-prefixed `-`, with two-space indent.
- File paths are relative to the repo root. Anchors are kebab-case per the rules above.

The orchestrator NEVER pastes section content into the implementer prompt. It emits only refs. If the implementer needs more context, it Reads additional refs or opens the full `architecture.md`.

## Phase 2.3 synthesizer output contract

The Phase 2.3 architecture synthesizer MUST produce two artifacts:

1. `docs/plans/architecture.md` — the human-readable architecture doc, containing:
   - All eight required top-level headings (or the iOS-adjusted set).
   - All required subsection anchors for each top-level section present.
   - Prose content under each subsection sufficient for an implementer to ground their work.

2. `docs/plans/.refs.json` — a flat JSON index of every anchor in `architecture.md`, used by the orchestrator for quick lookup when constructing implementer prompts. The synthesizer writes this file; no other agent edits it.

The synthesizer MUST fail loudly (emit a BLOCKED verdict) if it cannot produce all required subsection anchors — e.g., if the architecture is too thin to have a meaningful `security/auth` section, the synthesizer stubs the anchor with a one-line "N/A — {reason}" rather than omitting it.

## .refs.json example

```json
{
  "schema_version": 1,
  "generated_at": "2026-04-13T10:00:00Z",
  "generated_from": "docs/plans/architecture.md",
  "anchors": [
    {
      "anchor": "frontend/layout",
      "topic": "Page hierarchy and Next.js App Router routing",
      "line_start": 42,
      "line_end": 91
    },
    {
      "anchor": "frontend/checkout",
      "topic": "Checkout page layout and flow",
      "line_start": 120,
      "line_end": 180
    },
    {
      "anchor": "data-model/orders",
      "topic": "Orders entity, status enum, relations to users and items",
      "line_start": 302,
      "line_end": 358
    },
    {
      "anchor": "security/auth",
      "topic": "Supabase Auth with JWT; server-side route guards",
      "line_start": 410,
      "line_end": 455
    }
  ]
}
```

Fields:

- `schema_version` (integer) — currently `1`.
- `generated_at` (ISO 8601) — synthesizer run timestamp.
- `generated_from` (string) — source markdown path.
- `anchors` (array) — one entry per anchor. Each: `{anchor, topic, line_start, line_end}`. `topic` is a one-sentence summary used by the orchestrator to pick refs without reading the file.

## Validation

A synthesized `architecture.md` plus `.refs.json` pair is well-formed iff:

1. All required top-level headings exist in `architecture.md` (grep `^# {Heading}$` for each).
2. All required subsection anchors resolve to real `## Heading` lines under the correct parent. (A heading `## Checkout` under `# Frontend` resolves the anchor `frontend/checkout`.)
3. `.refs.json` parses as valid JSON against the shape above.
4. Every anchor in `.refs.json.anchors[].anchor` resolves to a real heading in `architecture.md` at the claimed `line_start`.
5. Every required anchor from this document appears in `.refs.json.anchors`.
6. No anchor appears twice in `.refs.json.anchors`.
7. `generated_from` matches the actual path written by the synthesizer.

The Wave 1 `buildanything:verify` protocol runs these checks after Phase 2.3 completes. A failure flips the Phase 2 verdict to `NEEDS_WORK` and re-dispatches the synthesizer with a directive listing the missing anchors.
