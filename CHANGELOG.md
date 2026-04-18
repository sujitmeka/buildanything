# Changelog

All notable changes to `buildanything` are documented here.

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
