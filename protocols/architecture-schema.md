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
- `# Scope`
- `# Out of Scope`

For iOS builds, `# Frontend` MAY be titled `# App` and `# Backend` MAY be omitted if the app is fully on-device (the `refs.json` index reflects whatever headings exist). For web builds, all eight headings are required.

## Anchor naming rules

- Anchors are **kebab-case** within a section — lowercase, hyphen-separated, no spaces.
- Subsections use a **nested anchor** of the form `parent/child`. For example, `frontend/checkout` refers to a `## Checkout` subsection under `# Frontend`.
- Anchors must be **stable across synthesizer reruns**. A rerun of the synthesizer on the same inputs must produce the same anchors, so that refs cached in `refs.json` or in implementer prompts do not break.
- Anchors are **referenced via `architecture.md#parent/child`** in prompt bodies and in `refs.json`. The `#` separator is a plain markdown fragment — no special escaping.
- Deeper nesting (`parent/child/grandchild`) is allowed but discouraged. Prefer two levels.
- Anchor names MUST NOT include spaces, uppercase letters, punctuation other than `-` and `/`, or numeric prefixes like `1-frontend`.

## Required subsection anchors (minimum)

Every synthesized `architecture.md` MUST provide at least these subsection anchors under the named top-level section. Additional subsections are allowed; fewer is a synthesizer failure.

### Under `# Frontend`

- `frontend/layout` — page hierarchy, routing, navigation structure. MUST state whether the product exposes a public, unauthenticated, content-indexable surface (yes / no / partial) — downstream SEO skill loading keys off this answer. MUST include a navigation map listing every route with its nav element (sidebar item, tab, breadcrumb, direct URL only).
- `frontend/components` — core component list and responsibilities.
- `frontend/state` — state management approach (stores, context, local state boundaries).
- `frontend/styling` — design tokens, CSS/styling approach.

### Under `# Backend`

- `backend/services` — service boundaries and responsibilities.
- `backend/api` — API contracts (routes, request/response shapes). Each endpoint heading MUST include feature attribution annotations: `**POST /api/orders** (provides: order-placement)` or `**GET /api/inventory/{id}** (provides: inventory) (consumes: order-placement)`. Use the feature's kebab-case name from `product-spec.md`. `provides` = the feature that implements this endpoint; `consumes` = features that call it. These annotations are parsed by the graph indexer to emit `feature_provides_endpoint` / `feature_consumes_endpoint` edges — without them, the Product Owner cannot group features by API dependency.
- `backend/persistence` — data layer, ORM choice, query patterns.

### Under `# Data Model`

- `data-model/entities` — entities and their relationships.
- `data-model/migrations` — migration strategy (omit only if no persistence layer exists).

### Under `# Security`

- `security/auth` — authentication and authorization model.
- `security/input-validation` — boundary validation rules.
- `security/secrets` — secret storage and rotation.

### Under `# Infrastructure`

- `infrastructure/deployment` — deployment target (Vercel, AWS, self-hosted, TestFlight), CI/CD approach, environment strategy (dev/staging/prod).
- `infrastructure/caching` — caching strategy (CDN, in-memory, database query cache), cache invalidation approach, what's cached and for how long. Stub with "N/A — no caching layer needed" if the product doesn't warrant it.
- `infrastructure/background-jobs` — async processing model (email sending, webhook handling, scheduled tasks, queue system). Stub with "N/A — no background processing needed" if all operations are synchronous.
- `infrastructure/env-vars` — required environment variables and secrets for each environment (dev/staging/prod). List every key the app needs to run, which service it authenticates with, and whether it's a secret or a config value. Format: `STRIPE_SECRET_KEY — Stripe payment processing — secret — required`.

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

The Phase 2.3 architecture synthesizer MUST produce one artifact:

1. `docs/plans/architecture.md` — the human-readable architecture doc, containing:
   - All eight required top-level headings (or the iOS-adjusted set).
   - All required subsection anchors for each top-level section present.
   - Prose content under each subsection sufficient for an implementer to ground their work.

The synthesizer does NOT write `refs.json`. The Phase 2.2 Refs Indexer owns that file (see below).

The synthesizer MUST fail loudly (emit a BLOCKED verdict) if it cannot produce all required subsection anchors — e.g., if the architecture is too thin to have a meaningful `security/auth` section, the synthesizer stubs the anchor with a one-line "N/A — {reason}" rather than omitting it.

## refs.json — the live downstream docs index

`refs.json` is the live downstream docs index. It covers every anchor in:

- `design-doc.md` (THE PRD)
- `architecture.md`
- `backend-tasks.md`
- `page-specs/*.md`
- `visual-design-spec.md` (if exists)
- `quality-targets.json` (via flat key anchors)

Writer: Phase 2.2 Refs Indexer step (dispatched as INTERNAL inline role-string). Consumers: Phase 3+ agents via the Briefing Officer per-task context map (no full pastes). Phase 1 raw research files are NOT in `refs.json` — they are spent after Phase 2 hybrid routing distributes them to architects.

The Phase 2.2 Refs Indexer (INTERNAL inline role-string dispatched by the orchestrator) is the sole writer of `refs.json`. It runs after the architecture synthesizer and Backend Task Breakdown steps, reads the live docs (`design-doc.md`, `architecture.md`, `backend-tasks.md`, `page-specs/*.md`, `visual-design-spec.md` if exists, `quality-targets.json`), and emits the multi-doc anchor index.

See `commands/build.md` Phase 2.2 Step 2.3 Refs Indexer dispatch for the exact generation prompt.

## refs.json example

```json
{
  "schema_version": "2.0",
  "generated_at": "2026-04-13T10:00:00Z",
  "generated_by": "Phase 2.2 Refs Indexer",
  "anchors": [
    {
      "file_path": "docs/plans/design-doc.md",
      "anchor": "#persona",
      "topic": "primary user persona + JTBD",
      "line_start": 12,
      "line_end": 38
    },
    {
      "file_path": "docs/plans/architecture.md",
      "anchor": "#frontend/checkout",
      "topic": "checkout flow component tree",
      "line_start": 102,
      "line_end": 145
    },
    {
      "file_path": "docs/plans/architecture.md",
      "anchor": "#data-model/orders",
      "topic": "Orders entity, status enum, relations to users and items",
      "line_start": 302,
      "line_end": 358
    },
    {
      "file_path": "docs/plans/backend-tasks.md",
      "anchor": "#task-3",
      "topic": "implement /api/checkout endpoint",
      "line_start": 88,
      "line_end": 104
    }
  ]
}
```

Fields:

- `schema_version` (string) — currently `"2.0"`. Bumped from `1` when the index was extended from architecture-only to the multi-doc scope above.
- `generated_at` (ISO 8601) — Refs Indexer run timestamp.
- `generated_by` (string) — `"Phase 2.2 Refs Indexer"`.
- `anchors` (array) — one entry per anchor across all indexed files. Each: `{file_path, anchor, topic, line_start, line_end}`.
  - `file_path` — repo-relative path of the file the anchor lives in. Required. Tells consumers which document to `Read`.
  - `anchor` — the markdown fragment, including the leading `#` (e.g. `#frontend/checkout`, `#persona`). For `quality-targets.json` entries, the anchor is the flat key name.
  - `topic` — one-sentence summary used by the Briefing Officer to pick refs without reading the file.
  - `line_start`, `line_end` — optional but recommended. Allow consumers to `Read` just the section instead of the whole file.

## Validation

A synthesized `architecture.md` plus `refs.json` pair is well-formed iff:

1. All required top-level headings exist in `architecture.md` (grep `^# {Heading}$` for each).
2. All required subsection anchors resolve to real `## Heading` lines under the correct parent. (A heading `## Checkout` under `# Frontend` resolves the anchor `frontend/checkout`.)
3. `refs.json` parses as valid JSON against the shape above.
4. Every architecture-scoped entry in `refs.json.anchors[]` (those with `file_path` ending in `architecture.md`) resolves to a real heading in `architecture.md` at the claimed `line_start`.
5. Every required anchor from this document appears in `refs.json.anchors` with the correct `file_path`.
6. No `(file_path, anchor)` pair appears twice in `refs.json.anchors`.
7. `schema_version` is `"2.0"` and `generated_by` is `"Phase 2.2 Refs Indexer"`.

The Wave 1 `buildanything:verify` protocol runs these checks after Phase 2.3 completes. A failure flips the Phase 2 verdict to `NEEDS_WORK` and re-dispatches the Refs Indexer (or the synthesizer, if the missing anchors indicate `architecture.md` itself is incomplete) with a directive listing the missing anchors.
