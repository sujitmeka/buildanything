# Changelog

All notable changes to `buildanything` are documented here.

## [2.4.0] — 2026-05-07

### Breaking Changes

- **Phase 6 Launch Readiness Review replaced with a single Customer Reality Judge.** The 5-chapter system (Eng-Quality, Security, SRE, A11y, Brand-Guardian) was structurally blind to coherence failures (illogical buttons, disconnected features, layouts with no reason to exist) — none of the chapters were positioned to ask "would a real customer be served by this product?" Each chapter checked a sub-property and inherited the build's own framing from evidence files. Replaced with a single `customer-reality-judge` agent that reads only the user's brief + Q&A + competitive-differentiation matrix + the running app, and is forbidden from reading product-spec/architecture/page-specs/evidence (deliberate confirmation-bias prevention).
- **Phase 6 verdict is now binary** — `PRODUCTION READY` or `BLOCKED`. The `NEEDS WORK` rung is removed at this stage; it was a softening hatch in disguise. Findings either ship-ready or block.
- **`lrr-aggregate.json` and `lrr-routing.json` are no longer written.** Replaced by `customer-reality-aggregate.json`, `customer-reality-findings.json`, `customer-reality-routing.json`. Consumers (Completion Report) updated to read the new files.

### Added — Customer Reality Judge

- **`agents/customer-reality-judge.md`** — opus xhigh agent that walks the running app as a first-time customer who has read the marketing brief. Output is two lists of findings: `doesnt_deliver` (surfaces where the brief promised X and the app does Y) and `confusing_or_illogical` (surfaces where a customer would close the tab and revert to the closest alternative). No verdict score, no rubric, no severity gradation — the two-list shape is the only signal. Each finding cites a verbatim brief quote OR what the alternative does differently, plus a screenshot.
- **`src/orchestrator/customer-reality-routing.ts`** — mechanical findings classifier (no LLM) that maps each finding to a target phase: `doesnt_deliver` → Phase 1 (product-spec re-scope), `confusing_or_illogical` → Phase 3 (page-spec re-design). Architectural keywords (`/\b(performance|latency|throughput|schema|data model|API contract)\b/i`) escape-hatch to Phase 2; implementation-drift hints escape to Phase 4.
- **A11y promoted to wave-end gate cheap tier.** Mechanical a11y (axe-core / Lighthouse) now runs at Step 4.3.5 per wave with blocking authority on `critical` / `serious` findings. The Phase 6 judge can still flag a11y when it manifests as customer confusion ("can't tab to this button"), but deterministic checks fire first.
- **Dissent Log Revisit Pass relocated** to Phase 5 closeout (Step 5.5.5) — orchestrator-internal mechanical step, no agent dispatch. The pass scans `decisions.jsonl` for open rows whose `revisit_criterion` has triggered against current evidence and writes PITFALL rows to `learnings.jsonl`.
- **`docs/specs/v2.4-fix/lrr-replacement.md`** — full spec doc for the replacement.
- **12 new tests** in `tests/phase6/customer-reality-routing.test.ts`.

### Removed — 5-chapter LRR

- 5 chapter dispatches at old Step 6.1 (Eng-Quality / Security / SRE / A11y / Brand Guardian).
- Old Step 6.0 Reality Checker evidence-sweep dispatch (the dissent-log-revisit portion is preserved at Phase 5 Step 5.5.5).
- Old Step 6.1a PM coverage fold-in.
- Old Step 6.2 LRR Aggregator with 6 aggregation rules — replaced by mechanical orchestrator routing in `customer-reality-routing.ts`.
- Old Step 6.3 verdict resolution with 3-rung verdict.
- Old `protocols/launch-readiness.md` 5-chapter schema — replaced with v2.4 customer-reality protocol.

### Changed

- `src/lrr/aggregator.ts` `aggregate()` is marked `@deprecated`. Kept temporarily for rollback safety + legacy test fixtures (20 tests in `tests/lrr/`); to be removed after one production cycle.
- `validateAggregateResult()` and the star-rule routing infrastructure are preserved — the verdict enum and BLOCK-no-softening rule continue to apply at Phase 6.
- The `INTERNAL inline role-string` registry in `commands/build.md:24` no longer lists `LRR Aggregator` or `PM chapter` (both removed).

---

## [2.3.0] — 2026-05-07

### Added — Audit-driven pipeline fixes

Five groups of fixes addressing failure modes surfaced by a real-build audit (see `docs/known-issues-2026-05-06.md`). The audit found a test build that produced output worse than one-shotting Claude despite the multi-phase pipeline. Root causes were soft-tolerance seams between writer/parser/orchestrator boundaries, plus structural gaps in product-coherence judgment.

#### Group 1 — Briefing substrate

The biggest leverage fix in the tranche. Closes the seams that let planning artifacts produce silent skips downstream.

- **Page-spec parser h1/h2 schema enforcement.** `src/graph/parser/page-spec.ts` now rejects files with non-canonical headings (`## Layout` instead of `## ASCII Wireframe`, `# 01 — Map Browse` instead of `# Page: Map Browse`) with rename hints in the error message. The producing agent (`design-ux-architect`) now declares the required h1/h2 names verbatim at the dispatch site.
- **HARD-GATE on indexer SKIP.** `commands/build.md` Steps 2.3.1.idx, 2.3.2.idx, 2.3.4.idx (plus `protocols/web-phase-branches.md` and `protocols/ios-phase-branches.md` Step 3.3.idx) now forbid the orchestrator from writing `outcome=SKIP` rows when the parser fails. Recovery is fix-the-source, not skip-the-index.
- **Briefing Officer halt-on-null.** `agents/briefing-officer.md` removes the file-read fallback that was contradicting the global STOP rule. A null `graph_query_screen()` response now halts the build with a re-dispatch directive.
- **`feature-briefs/` on-disk gate.** New Step 4.2.a.gate in `commands/build.md` blocks Phase 4 implementer dispatch until `docs/plans/feature-briefs/{feature}.md` exists and is non-empty. Closes the failure mode where Briefing Officers returned briefs in-memory only.
- New tests + fixtures (`malformed-h2-drift.md`, `malformed-h1-format.md`).

#### Group 2 — Severity discipline

- **Track B 1:1 coverage diff (#8).** `commands/build.md` Step 5.2 now diffs `dispatched_ids` vs `disk_ids` vs `spec_ids` after Track B post-dispatch verification. Missing audit folders for spec-listed features emit synthetic block-severity findings via `track-b-coverage-gaps.json`. Closes the broken-build pattern where Auth was a feature in product-spec but Track B silently skipped it.
- **Fix-loop cycle 2 mandatory on HIGH (#6, prior parallel-session work).** `src/orchestrator/fix-loop-gate.ts` enforces a second cycle when CRITICAL or HIGH findings remain after cycle 1.
- **LRR no BLOCK softening (#7, prior parallel-session work).** `src/lrr/aggregator.ts` `validateAggregateResult()` rejects any `combined_verdict` outside the allowed enum and any softening where a chapter returned BLOCK but the aggregate was downgraded.

#### Group 3 — Audit trail

- **Broader `learnings.jsonl` writer (#9).** Step 5.4 synthesizer now derives `learnings_rows` from 4 sources (Track B coverage gaps, fake-data CRITICAL, E2E iteration count, fix-loop pass-on-cycle-1) and appends to `learnings.jsonl`. Sentinel-row rule for clean builds prevents empty-file blocks. Phase 5 → Phase 6 gate (`learningsGate()` from prior parallel-session work) enforces emission.
- **Decisions scribed across all phases (#10).** Per-phase orchestrator-scribe dispatch blocks added at end of Phases 3, 5, 6, 7 (mirroring Phase 4). Six agents updated to return decision rows on consequential branches: design-brand-guardian (DNA lock), design-ui-designer (manifest closure), design-critic (threshold gap), product-owner (acceptance gap), product-feedback-synthesizer (routing override), LRR Aggregator (verdict). Total per-build budget stays ~10–18 rows.
- Phase 0 reader updated to surface `status: "triggered"` revisit-criterion rows on resume.

#### Group 4 — Per-wave verification

The biggest behavior change in the v2.3 release. Catches integration-level and spec-adherence bugs *during* Phase 4 instead of letting them accumulate to Phase 5's overflowing fix loop.

- **New Step 4.3.5 wave-end gate** in `commands/build.md` between PO acceptance and wave transition. Two-tier composition:
  - **Cheap tier** (parallel, ~1–3 min): production-mode build (#4 — `NODE_ENV=production`), halt-condition runtime assertions (#12, prior parallel-session work via `src/orchestrator/halt-conditions.ts`), schema/code execution check (#13), a11y mechanical check (#11b — promoted from old LRR A11y chapter).
  - **Expensive tier** (sequential, ~10–20 min): brand-drift critic with blocking authority (#11), PO Mode 2 visual acceptance with mandatory artifact contract (#5), security-execute with proof-of-exploit (#14), holistic dogfood per-wave (#17).
- **PO Mode 2 mandatory artifact contract (#5)** — `agents/product-owner.md` now requires three on-disk artifacts (`screenshots/`, `verdict.json`, `wireframe-diff.md`) per feature; missing artifacts → automatic `NEEDS_REVISION`. Closes the `feature_acceptance: {}` shipping pattern.
- **`wave_gate` macro** added to `protocols/verify.md`.
- Wave-fix routing: max 2 cycles per gate-check; on cycle 2 failure, autonomous emits a Phase 4 deviation row + accepts gap; interactive presents to user.
- Token cost: ~600K added per typical 4-wave build (~$1.50–3 at Sonnet medium pricing). Net negative vs cost of a single Phase 5 fix-loop cycle exhausting.

iOS parity for #4, #12 lands with this release; iOS parity for #5, #11, #13, #14, #17 deferred per spec.

#### Group 5 — Spec quality (utility-first)

The hardest group; addresses the Phase 1 failure where engagement mechanics got specified in extreme depth while core utility got 75 sparse lines.

- **`## First 60 Seconds` required section** in `protocols/product-spec-schema.md`. Single field per persona (`**First-encounter promise**:`), ≥ 50 chars, must contain a comparison marker (`vs`, `than`, `compared to`, `instead of`, `rather than`, `unlike`). The comparison marker is the structural enforcement: a writer cannot satisfy with "user opens the app" — they must reference an external alternative. Designed to force engagement, not invite form-filling.
- **`competitive-differentiation.md` artifact** at Phase 1, produced by `feature-intel`. Required sections: closest 1–3 alternatives with citations, what this product does better/worse on the core job, implications for the first surface. Step 1.6 product-spec-writer dispatch halts if file is missing. The "no positioning" rule in `feature-intel.md:40` lifted for core-job differentiation (market-sizing/pricing-positioning ban survives).
- **Cognitive Protocol Step 0 — UTILITY-FRAMING** added to `agents/product-spec-writer.md`. Every feature opens with a paragraph naming its core-job contribution; headline-utility features cite a constraint from `competitive-differentiation.md`. Self-check: count lines per feature; utility features must land in the upper half.
- 3 fixtures updated, 2 new negative fixtures (`malformed-missing-first-60-seconds.md`, `malformed-stub-first-60-seconds.md`), 2 new test cases.

### Fixed — Parser bugs

- **Architecture parser h2-as-peer-module bug** (`src/graph/parser/architecture.ts`). Recently relaxed parser was treating every h2 inside an h1 module as a peer module — a doc with `# Frontend / # Backend / # Data Model / # Security / # Infrastructure` plus 16 subheadings was extracting 21 modules instead of 5. Fixed: only scan h2 children of h1 sections that did NOT themselves become module candidates. Both doc styles still work — `# Frontend / ## Layout` (h1 is module, h2 is subsection) AND `# Architecture / ## Frontend` (h1 is meta, h2 is module).
- **Backend-tasks parser ignored Screens column** (`src/graph/parser/backend-tasks.ts`). The `screen_ids` field was hardcoded `[]`; the `task_touches_screen` edges were never emitted. Fixed.

### Changed

- `commands/build.md` writer-owner table updated for the broader scribe scope across phases.
- `protocols/decision-log.md` referenced consistently across Phases 3, 5, 6, 7 scribe dispatches.

### Notes on prior parallel-session work

Some v2.3 fixes (#6 fix-loop gate, #7 LRR softening, #9 learnings gate, #12 halt-conditions) were authored in a parallel session before this release was assembled, and are wired through new modules under `src/orchestrator/` (`fix-loop-gate.ts`, `halt-conditions.ts`, `learnings-gate.ts`) and `src/lrr/aggregator.ts`. The v2.3 release integrates that work alongside Groups 1, 5, the parser bugfixes, and #8/#10 from this session.

---

## [2.0.0] — 2026-04-18

### Breaking Changes

- **Requires Claude Code ≥ 1.5.0** — orchestrator now uses the Claude Agent SDK for all subagent dispatch. Older hosts do not support the SDK runtime.
- **State files are forward-rejected** — `.build-state.json` files with `schema_version > 2` are rejected at startup rather than silently misread. Resume an older build with the same plugin version that wrote it.

### Added — SDK Orchestration Infrastructure

The orchestrator migrated from markdown-loop dispatch to the Claude Agent SDK. Four MCP handlers ship with the plugin and are wired at runtime:

- **`scribe_decision` MCP** — single writer for `decisions.jsonl`; ensures concurrent phases cannot race-write the decision log
- **`acquire_write_lease` / `release_write_lease` MCP** — prevents intra-phase file collisions; implementer dispatches must hold an exclusive lease before any Write/Edit operation
- **`state_save` MCP** — atomic `.build-state.json` writes (write-to-.tmp + rename + SHA-256 integrity)
- **`increment_cycle` MCP** — backward-routing cycle counter with re-entry halt at `max_cycles`

### Added — Writer-Owner Enforcement

- **PreToolUse hook** reads `phase-graph.yaml` (compiled to a JSON cache at session-start) and denies Write/Edit/MultiEdit when the current phase or subagent type is not the declared owner of the target path
- **Default-deny** for all paths under protected prefixes (`docs/plans/`, `hooks/`, `src/orchestrator/`, etc.) that are not in the writer-owner table
- **Hard-deny** for raw writes to `.build-state.json` — must route through `state_save` MCP
- **Subagent-role enforcement** — `lrr/<chapter>.json` restricted to the 5 LRR chapter subagents; aggregator cannot write chapter files

### Added — Sprint-Context Hoisting (Stage 6)

Phase 4 implementation prompts now hoist the sprint context block into the static cache layer. Per-task refs blocks are replaced with a pointer. Measured: ~−15% cumulative token cost vs. markdown baseline on reference builds.

### Added — Token Accounting

- SubagentStart/Stop hooks record per-phase token usage into `.build-state.json`
- Orchestrator surfaces cumulative cost at every phase boundary

### Added — Anti-Slop Gates

- gstack-inspired quality gates added to LRR: 7th Copy axis (does the output read like a template?), Goodwill Reservoir (does the output spend its reader's attention wisely?)
- Reality Checker rewrite — stricter evidence requirements before shipping gate passes

### Added — iOS Auto-Install

`npx buildanything --ios` and `/buildanything:setup` now auto-install the iOS toolchain (XcodeBuildMCP, apple-docs-mcp, Maestro) without manual steps.

### Fixed

- Write-lease `releaseLease()` now removes ALL leases held by a task, not just the first
- `persistLeases()` failure no longer creates a fail-closed scenario — disk and in-memory state are kept consistent
- `gen-critic.ts` dead code wired into Stage 4 generator/critic separation flow
- SubagentStop hook auto-releases all leases on dispatch return
- Lease manager loads persisted leases from disk at runtime startup (survived process restart)

### Changed

- `task_id` derivation tightened to STRICT mode: derived only from `parent_tool_use_id` (per SDK subagent propagation), not from `tool_use_id` or env vars
- Phase graph YAML is the authoritative runtime source for all routing, writer-owner, and dispatch tables — prose in `build.md` is narrative only
- SSOT drift CI workflow enforces YAML/prose consistency on every push

---

## [1.8.0] — 2026-04-04

### Added — iOS Mode (Swift-only)

`buildanything` now routes iOS/Swift app builds through a unified orchestrator. A single `/buildanything:build` entry point classifies the user's prompt and dispatches either the web flow (unchanged) or the new iOS flow.

**iOS capabilities:**
- **9-phase iOS pipeline** — Phase -1 Bootstrap → Phase 0 Route → Phases 1-7 (Ship optional)
- **22 iOS skills** vendored/ported under `skills/ios/` — SwiftUI Pro, Swift Concurrency, SwiftData Pro, Swift Security Expert, Swift Testing Expert, Swift Accessibility, Liquid Glass, View Refactor, Performance Audit, UI Patterns, iOS Debugger, iOS HIG, iOS 26 Platform, WidgetKit, ActivityKit, App Intents, Apple On-Device AI, plus 4 in-house skills (ios-bootstrap, entitlements-generator, info-plist-hardening, maestro-flow-author)
- **6 iOS agents** under `agents/ios-*.md` — swift-architect, swift-ui-design, swift-search, foundation-models-specialist, app-review-guardian, storekit-specialist
- **3 iOS twin commands** — `/verify`, `/ux-review`, `/fix` have iOS branches that run iOS-specific toolchains
- **`protocols/ios-context.md`** — Senior iOS Engineer persona loaded for every iOS agent
- **`protocols/ios-frameworks-map.md`** — 323-line capability→framework→entitlement lookup (HealthKit, EventKit, PhotosUI, MapKit, etc.); read on-demand by agents
- **`protocols/ios-phase-branches.md`** — iOS per-phase instructions (loaded only when `project_type=ios`)
- **`protocols/ios-preflight.md`** — shared preflight for iOS twin commands
- **`protocols/web-phase-branches.md`** — web per-phase instructions extracted for mode isolation

**iOS tool stack** (users install these only when starting an iOS build; guided by Phase -1 Bootstrap):
- Xcode 26.3 (macOS 26 + Apple Silicon hard requirement)
- XcodeBuildMCP (build + simulator + SwiftUI Preview capture)
- apple-docs-mcp (Apple Developer docs + WWDC search)
- Maestro (E2E flow runner, installed via `brew install maestro`)

**Architectural defaults** — vanilla SwiftUI + `@Observable` (TCA is opt-in only); iOS 26 SDK; Swift 6.2; SwiftData over Core Data.

**Detection** — prompt-intent classifier scans for iOS keywords (iOS, iPhone, SwiftUI, Swift, App Store, TestFlight, Xcode, Apple Watch) and confirms with the user at Phase 0. Web mode remains the default.

### Changed

- `commands/build.md` refactored to load mode-specific branch files conditionally, saving tokens for both web and iOS users
- Extracted web-only Phase 3/5/6/7 content into `protocols/web-phase-branches.md` so iOS users no longer read it
- `files` array in `package.json` now includes `protocols/` and `skills/` so iOS content ships with the npm package

### Unchanged — Web mode

All existing web-build behavior is preserved. Web users see no difference in the build flow; the only change is that `/design-system`, Playwright, and agent-browser content now lives in `protocols/web-phase-branches.md` instead of being inline in `build.md`.

### iOS Dependencies (not auto-installed)

iOS-mode external tools (Xcode 26.3, XcodeBuildMCP, apple-docs-mcp, Maestro) are **not** auto-installed when upgrading from 1.7.x because:
- They are macOS-only and would fail on other platforms
- Web-only users never need them
- They require user consent for MCP config changes

Instead, Phase -1 Bootstrap (the first phase of any iOS build) guides the user through installing them the first time they start an iOS project. Users upgrading from 1.7.1 who only build web apps will experience no change.

---

## [1.7.1] — Prior release

See git history.
