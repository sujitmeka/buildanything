# iOS Phase Branches

_Loaded into orchestrator session context when `project_type=ios`. Contains per-phase iOS-specific instructions. Mode-agnostic phase scaffolding lives in `commands/build.md`._

## Dispatch rules

Every Agent tool call in this file MUST include a `subagent_type:` field unless explicitly marked INTERNAL. See `commands/build.md` top preamble for the project-wide HARD-GATE. iOS agents live at `/agents/ios-*.md` plus the general-purpose engineering and testing agents from ECC and agency-agents.

## CONTEXT header injection (iOS branch — project_type hardcoded)

Every `subagent_type:` dispatch in this file prepends a CONTEXT header to its prompt. Per `commands/build.md` CONTEXT HEADER HARD-GATE: the orchestrator MUST render this header ONCE at the start of each phase by resolving all values into concrete strings, then reuse the rendered header verbatim for every dispatch in that phase. DO NOT leave `{read from ...}` placeholders — resolve them before the first dispatch.

```
CONTEXT:
  project_type: ios
  phase: <resolved: current phase number>
  ios_features: <resolved: 16-flag block from .build-state.json — the literal YAML values, NOT a pointer>

TASK:
```

**Resolution rules:**
- `ios_features` = the 16 boolean flags resolved to their values. ~200 tokens.
- The rendered header is a stable prefix — it does not change between dispatches within a phase.

Individual dispatches below reference `[CONTEXT header above]` and rely on this rendered template.

Individual dispatches below reference `[CONTEXT header above]` and rely on this template. The orchestrator fills `phase` per the enclosing section.

## iOS Mode Tool Stack

When `project_type=ios` is set in `docs/plans/.build-state.md`, use this stack in place of the web defaults:

- Project creation: Xcode New Project dialog (user-guided — no Tuist, no XcodeGen)
- Structure changes: XcodeBuildMCP primary / user-assisted Add Files fallback
- Swift code edits: direct file writes (Claude via Edit/Write tools)
- Build, diagnostics, SwiftUI Preview capture: XcodeBuildMCP
- E2E tests: Maestro (`.yaml` flows — agent-friendly)
- OAuth / web-views on simulator: agent-browser `-p ios` (Mobile Safari only, not native UI)
- Design references: Apple HIG + SF Symbols + Liquid Glass (iOS 26+)
- Code signing / TestFlight / App Store: fastlane (optional — Phase 7 only)

**Architecture default for iOS:** vanilla SwiftUI + `@Observable`. TCA is opt-in only (user explicitly requests it, or existing TCA codebase detected). Do not propose TCA by default.

All iOS implementation agents inherit the `protocols/ios-context.md` persona (Senior iOS Engineer) — pass it into every agent prompt in Phases 4, 5, 6, 7 when `project_type=ios`.

## Phase 0 additions (iOS-specific)

When Phase 0 classifier sets `project_type=ios`:
- Load `protocols/ios-context.md` into orchestrator session context — it holds the Senior iOS Engineer persona inherited by every iOS implementation agent (injected into agent prompts).
- Reference `protocols/ios-frameworks-map.md` by **path only** — do NOT load its 323 lines into session context or inject into agent prompts. It is a lookup reference: agents `Read` it on-demand when they hit a "user wants X → which Apple framework?" question, grep for their capability, extract the 1-2 relevant rows. The orchestrator cites it by path when dispatching the architect, entitlements-generator, and impl agents; those agents open it themselves.
- Use the iOS Mode Tool Stack above — not the web defaults.
- Phase 3 skips `/design-system` (no web style guide). Phase 5 dispatches to iOS twins of `/verify` + `/ux-review` + `/fix`.
- If greenfield (no `.xcodeproj` exists), **Phase -1 Bootstrap** runs before Phase 1.

## Phase -1 — iOS Bootstrap (iOS-only, greenfield only)

**Runs ONLY if** `project_type=ios` AND no `.xcodeproj` exists in the project root. Skip entirely for `project_type=web` OR when an Xcode project already exists.

**Goal:** verify the iOS toolchain, create the Xcode project, wire MCP servers, install test tooling — so Phase 1 planning starts against a real, buildable Xcode project.

### Step -1.1 — Environment Check

Verify (or guide the user to install):
- **Xcode 26.3+** (hard requirement — no fallback). If missing or older, direct user to Mac App Store update. Requires macOS 26 Tahoe + Apple Silicon.
- **XcodeBuildMCP** server configured in Claude settings.
- **apple-docs-mcp** server configured (for iOS 26 API lookups during architecture).
- **Maestro CLI** (`brew install maestro`) for E2E tests.
- **fastlane** — defer to Phase 7, do NOT install now (optional, ship-only).

### Step -1.2 — Xcode Project Creation (user-guided)

Dispatch the `ios-bootstrap` skill (or inline the prompt if the skill isn't available):

Call the Agent tool — description: "iOS bootstrap" — subagent_type: INTERNAL (user-guided skill dispatch, no backing agent file) — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: -1] Guide the user through creating a new Xcode project via Xcode's New Project dialog (File > New > Project > iOS App). Target: iOS 26.0+, Swift 6.2+, SwiftUI interface, SwiftData storage (if data persistence is in the design). Do NOT use Tuist or XcodeGen. After the user confirms project creation, verify: `.xcodeproj` exists, the project builds clean via XcodeBuildMCP, and the app launches on a simulator. Also create the canonical `maestro/` directory at the project root (for Phase 4 flow stubs + Phase 5 smoke tests) — no leading dot, committed to git. Report the project path and bundle identifier."

### Step -1.2b — Overwrite Apple template test files with AUTOGENERATED HARNESS marker

Immediately after the Xcode project is created (and BEFORE Step -1.3 Bootstrap Verification), the orchestrator MUST overwrite the auto-generated Apple-template test files with an AUTOGENERATED HARNESS marker. This closes the "forgot Apple templates exist and shipped them" failure mode at the earliest possible point in the build.

Locate the test files at `<app-target>Tests/<app-target>Tests.swift` and `<app-target>UITests/<app-target>UITests.swift` (paths depend on the Xcode target name chosen in Step -1.2 — derive from `.xcodeproj` path). Use the Write tool to replace each file's contents with the marker below. Substitute `<TargetName>` with the actual test-target name.

**Unit test file** (`<app-target>Tests/<app-target>Tests.swift`):

```swift
// AUTOGENERATED BY /buildanything:build iOS BOOTSTRAP — DO NOT SHIP THIS TEMPLATE. Replace with actual tests per sprint-tasks.md Behavioral Test fields.
//
// Layer C stub detector directive: any test file containing this AUTOGENERATED BY /buildanything:build iOS BOOTSTRAP header
// MUST be reported as "MARKER: pending implementation" (not STUB). The marker is a deliberate placeholder, not an accidental
// Apple template. It is intentionally sized >500 bytes with >=1 assertion so it compiles and runs, while the header comment
// flags it for human replacement before ship. Replace this entire file before Phase 6 Step 6.0 Reality Check.

import Testing
import Foundation

@Suite("Bootstrap marker — replace before ship")
struct BootstrapMarkerTests {
    @Test func bootstrapMarkerSanityCheck() async throws {
        #expect(Bundle.main.bundleIdentifier != nil)
    }
}
```

**UI test file** (`<app-target>UITests/<app-target>UITests.swift`):

```swift
// AUTOGENERATED BY /buildanything:build iOS BOOTSTRAP — DO NOT SHIP THIS TEMPLATE. Replace with actual tests per sprint-tasks.md Behavioral Test fields.
//
// Layer C stub detector directive: any test file containing this AUTOGENERATED BY /buildanything:build iOS BOOTSTRAP header
// MUST be reported as "MARKER: pending implementation" (not STUB). The marker is a deliberate placeholder, not an accidental
// Apple template. It is intentionally sized >500 bytes with >=1 assertion so it compiles and runs, while the header comment
// flags it for human replacement before ship. Replace this entire file before Phase 6 Step 6.0 Reality Check.

import XCTest

final class BootstrapMarkerUITests: XCTestCase {
    func testBootstrapMarkerSanityCheck() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.state == .runningForeground || app.state == .runningBackground)
    }
}
```

**Layer C detector PASS-through directive:** The `protocols/verify.md` Step 2 test-stub detector MUST treat any test file whose first non-blank line contains the literal string `AUTOGENERATED BY /buildanything:build iOS BOOTSTRAP` as a "MARKER: pending implementation" result — NOT as a STUB. Rationale: the marker is a deliberate placeholder with a conspicuous header and known sanity assertion; the STUB classification is reserved for accidental/unmodified templates. The orchestrator MUST still surface MARKER results in the Phase 6 Step 6.0 Reality Check as an unresolved task, and the user MUST replace marker files before `combined_verdict = PRODUCTION READY` can be emitted.

After writing both marker files, verify via XcodeBuildMCP that the test targets still compile.

### Step -1.3 — Bootstrap Verification

Confirm all of: Xcode version OK, `.xcodeproj` exists, XcodeBuildMCP responds, apple-docs-mcp responds, Maestro installed, first build+launch on simulator succeeded. Log status to `docs/plans/.build-state.md` under `## iOS Bootstrap`. If any check fails, STOP and surface the blocker — do NOT proceed to Phase 1.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format in `commands/build.md`.

## Phase 1 — Plan (iOS additions)

Load phase-specific iOS skill bundle per `protocols/ios-context.md` §Phase 1. The Phase 1.1 research team is the same 4 agents as the web branch (`subagent_type: feature-intel`, `subagent_type: tech-feasibility`, `subagent_type: design-ux-researcher`, `subagent_type: business-model`) but each prompt must additionally check App Store category landscape, TestFlight constraints, and iOS 26 API availability (via apple-docs-mcp). For AI / Foundation Models prompts, additionally dispatch `subagent_type: ios-foundation-models-specialist`. Note: the Phase 2.3 sprint-breakdown `subagent_type: planner` is replaced by `subagent_type: ios-swift-architect` for iOS mode (see Phase 2 additions below).

## Phase 2 — Architecture (iOS additions)

Load phase-specific iOS skill bundle per `protocols/ios-context.md` §Phase 2. Architecture agents must select iOS 26 APIs via apple-docs-mcp (verify availability, deprecations, minimum OS). Replace the web `subagent_type: engineering-backend-architect` / `subagent_type: engineering-frontend-developer` architecture dispatches with a single `subagent_type: ios-swift-architect` dispatch covering: (1) SwiftUI view hierarchy + navigation model, (2) SwiftData schema + CloudKit strategy, (3) Swift Concurrency / actor isolation plan, (4) iOS-specific security (Keychain, entitlements, ATS). Implementation blueprint lists Swift files + Xcode targets, not web modules. Security architecture stays on `subagent_type: engineering-security-engineer` (unchanged from web branch — the security engineer handles both stacks).

The iOS architect (and the iOS-context security architect) MUST also read `docs/plans/product-spec.md` — the Screen Inventory drives SwiftUI view hierarchy, per-feature Persona Constraints drive HIG navigation pattern choices (TabView vs NavigationStack vs sheets), and per-feature Permissions & Roles drive Keychain + entitlement scopes.

### Feature Flag Resolution (end of Phase 2)

Before leaving Phase 2, resolve the `ios_features` flag block (schema in `protocols/ios-context.md` §iOS Feature Flag Schema) and WRITE it to `docs/plans/.build-state.md` under the `ios_features:` key. Determine each flag from the brainstorm + architecture outputs:

- `widgets` — true if Home/Lock Screen widgets mentioned.
- `liveActivities` — true if Live Activities / Dynamic Island mentioned.
- `appIntents` — true if Siri / Shortcuts / App Intents mentioned.
- `foundationModels` — true if on-device LLM / Foundation Models mentioned.
- `storekit` — true if IAP / subscriptions mentioned.
- `healthkit` — true if health / fitness data mentioned.
- `push` — true if remote/local push notifications mentioned.
- `cloudkit` — true if cross-device sync mentioned.
- `siri` — true if Siri voice integration mentioned.
- `location` — true if Maps / geolocation / geofencing mentioned.
- `background` — true if background fetch / processing / BGTaskScheduler mentioned.
- `cameraPhoto` — true if camera or photo picker mentioned.
- `microphone` — true if audio recording / Speech mentioned.
- `contacts` — true if Contacts framework mentioned.
- `calendar` — true if EventKit / calendar / reminders mentioned.
- `appleWatch` — true if watchOS companion mentioned.

Resolution rule: keyword-match the brainstorm transcript + architecture doc; in autonomous mode default to `false` on ambiguous flags and log the assumption to `build-log.md`; in interactive mode confirm ambiguous flags with the user. These flags gate Phase 4 per-task skill loading and Phase 4 Step 4.0 entitlement generation.

### Visual DNA Directional Preview (pre-Gate-2)

Before the Quality Gate 2 approval prompt in `commands/build.md` is rendered, dispatch a lightweight directional preview of the intended iOS visual direction. This is NOT the full `DESIGN.md` (Pass 1 lands at Step 3.0; Pass 2 — the iOS-flavored YAML + remaining prose — lands at Step 3.2-ios). It is a 3-5 bullet sanity-check surfaced at Gate 2 so the user catches wrong visual direction before Phase 3+ burns tokens against it.

Call the Agent tool once:

1. Description: "iOS visual direction preview" — subagent_type: `ios-swift-ui-design` — prompt: "[CONTEXT header above — phase: 2] Read `docs/plans/design-doc.md` (#persona, #scope, #voice), `docs/plans/phase1-scratch/findings-digest.md`, and `docs/plans/architecture.md`. Emit a 3-5 bullet DIRECTIONAL preview of the intended iOS visual direction — one-line brand read, then proposed leanings on: navigation pattern (TabView vs NavigationStack vs sheets), typography (Dynamic Type scale + tone), color (semantic + dark mode leaning), motion/material feel (Liquid Glass on iOS 26+ yes/no, haptic-forward yes/no), SF Symbol family vibe. NO rationale paragraphs, NO reference citations. Save to `docs/plans/visual-dna-preview.md` as a flat bullet list. Target 150 tokens, max 250."

Output: `docs/plans/visual-dna-preview.md` — surfaced by the orchestrator in the Gate 2 prompt. Phase 3.0 + Phase 3.2-ios together produce the full `DESIGN.md`; the preview is discarded after Gate 2 approval.

## Phase 3 — Design (iOS branch)

Load phase-specific iOS skill bundle per `protocols/ios-context.md` §Phase 3. Do **NOT** build `/design-system` (web-only). The artifact is `DESIGN.md` at the repo root, same format as web — see `protocols/design-md-authoring.md` for the contract and §9 for iOS-specific rules.

- **Step 3.0 iOS** — same dispatch as web: `subagent_type: design-brand-guardian` writes Pass 1 of `DESIGN.md` (Overview + 7-axis Brand DNA + Rationale + Locked At + References + Do's and Don'ts). Pass 2 sections present as placeholders. The Brand Guardian honors iOS-specific Material gating (Liquid Glass requires iOS 26+ target).
- **Step 3.1 iOS** — dispatch `subagent_type: visual-research` with the agent-browser (`-p desktop`) skill to harvest iOS UI references from **free** sources: screenlane.com (iOS screenshots), App Store web listings for top apps in the product category, Apple HIG pages, SF Symbols browser. No Mobbin (paid). Fallback: vibe-only design board if scraping blocked.
- **Step 3.2-ios** — dispatch `subagent_type: ios-swift-ui-design` to write Pass 2 of `DESIGN.md`. Fills YAML front matter (`colors` with `-dark` pairs per §9.2; `typography` named after Dynamic Type roles; `rounded` for continuous corners; `spacing` on the HIG 4/8/16/20/24 scale; `components` covering at minimum the iOS vocabulary in §9.3 — nav-tab-bar, list-row, card-elevated, button-primary, input-text, sheet-modal, etc.) AND writes Pass 2 prose for `## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components`. Pass 1 sections are READ-ONLY at this step. Grounded in Apple HIG + Liquid Glass (iOS 26+ when DNA Material = Glassy) + SF Symbols + the harvested references + the user's stated app vibe.
- **Step 3.3-ios** — dispatch `subagent_type: design-ux-architect` to write `docs/plans/ux-architecture.md` + `docs/plans/page-specs/*.md` (one file per screen from product-spec Screen Inventory). Same agent as web — the agent already understands both platforms via skill gating. Reads:
  - Product spec: `docs/plans/product-spec.md` (FULL — Screen Inventory is the screen list; per-feature sections define what each screen does, what data it shows, what states exist, persona constraints, business rules)
  - DESIGN.md `## Overview > ### Brand DNA` (Density axis drives layout — Airy uses generous safe-area margins; Dense uses HIG-minimum spacing. Character + Motion shape navigation transitions)
  - DESIGN.md YAML `components:` block (the iOS component vocabulary the wireframes compose from — nav-tab-bar, list-row, card-elevated, button-primary, etc.)
  - `docs/plans/architecture.md#frontend` (SwiftUI view hierarchy + navigation model + state management — page-specs map screens to this hierarchy)
  - `docs/plans/architecture.md#backend/api` or SwiftData schema (data available per screen)
  - `docs/plans/design-references/` (iOS reference screenshots from Step 3.1-ios)

  Produces TWO outputs:
  - `docs/plans/ux-architecture.md` — information architecture, user flows (derived from product-spec feature flows, not invented), navigation model (TabView vs NavigationStack vs sheets per HIG + persona context), interaction patterns (swipe gestures, long-press menus, haptics), responsive strategy across iPhone/iPad sizes.
  - `docs/plans/page-specs/*.md` — one file per screen, following `protocols/page-spec-schema.md`. iOS-specific wireframe conventions:
    - **Single mobile-first ASCII wireframe** at iPhone 16 Pro (393×852) — iPad layout deltas captured as Notes.
    - **Navigation annotation per screen** — name the parent NavigationStack/TabView, the modal sheet/popover relationship, and the back/dismiss gesture.
    - **Component refs from DESIGN.md `components:`** — every interactive element references a token name (`button-primary`, `list-row-grouped`, `card-elevated`).
    - **Dynamic Type expectation** — declare which typography roles the screen uses; flag any layout that breaks at xxxLarge.
    - **Safe-area handling** — name top/bottom safe-area treatments (large title vs nav bar; tab bar inset).
    - **Data loading strategy** — async/await + .task modifier vs ObservableObject; loading/error/empty states from product-spec.

  DESIGN.md Pass 2 (exact spacing values, typography ramp YAML) already exists at this point — Step 3.2-ios produced it. Page-specs reference DESIGN.md token names, not raw values; the SwiftUI translator at Step 4.0.b emits the constants.
- **Step 3.3b-ios** — dispatch `subagent_type: design-ux-researcher` to validate the iOS UX flows against persona/JTBD. Reads `docs/plans/ux-architecture.md`, `docs/plans/page-specs/`, `docs/plans/product-spec.md`, `docs/plans/design-doc.md`, DESIGN.md `### Brand DNA`. Walk each user flow as the target persona on an iPhone — narrate the steps, flag friction points, check HIG conformance (gesture discoverability, tap target ≥44pt, navigation depth), check critical tasks reachable in minimum taps, check Dynamic Type at xxxLarge doesn't break flows. Writes `docs/plans/ux-flow-validation.md`. Critical issues route back to Step 3.3-ios.
- **Skip Step 3.3** (Living Style Guide) — no web route. The visual-design surface is the SwiftUI Preview captures from Step 3.4-ios.
- **Step 3.4-ios** — Per `protocols/metric-loop.md` Step 0.5, extract scoring criteria from `DESIGN.md` (HIG values from spacing/typography YAML, navigation pattern from components, color tokens, SF Symbol choices from prose) into the Scoring Criteria Checklist. Extraction is **mechanical** — `DESIGN.md` has structured YAML + named prose sections. Persist to `active_metric_loop.scoring_criteria_checklist` in `.build-state.json`. Visual QA loop uses XcodeBuildMCP SwiftUI Preview captures (not Playwright screenshots). The loop runs `subagent_type: ios-swift-ui-design` as the generator (Preview tweaks AND DESIGN.md token re-tunes per critic findings) paired with `subagent_type: design-critic` as the critic. Critic receives the checklist + fresh Preview captures each iteration (NOT the full `DESIGN.md`). Generator re-invocation on iteration 2+ follows the lean context rule (top issue + file paths + relevant checklist values only). Exit criterion = user-approved pass/fail (not a 0-100 rubric). **Max 3 iterations** (tighter than web's 5). On stall or max iterations, present the score history to the user.
- **Step 3.8 iOS lint** — same lint hook as web (`hooks/design-md-lint`). Broken-refs is a hard fail and routes back to Step 3.2-ios. Warnings logged. Three iOS-specific post-process checks per §9.5 (dark-pair rule, Dynamic Type role check, iOS 26 gating) layer on top of the vendored linter — codepath in `hooks/design-md-lint.ts` gated on `project_type=ios`.

Phase 4 HARD-GATE: iOS mode requires `DESIGN.md` (Pass 1 + Pass 2 complete; broken-refs lint == 0) AND `docs/plans/page-specs/` (at least one file from Step 3.3-ios) to exist before Phase 4 starts. If missing or failing lint, return to Phase 3.

## Phase 4 — Build (iOS branch)

Load phase-specific iOS skill bundle per `protocols/ios-context.md` §Phase 4 — Build (Step 4.0 Scaffold).

Phase 4 in the iOS branch contains the Step 4.0 Scaffold work (iOS project bootstrap follow-up, entitlements, Info.plist, XcodeBuildMCP folder structure, SwiftUI design tokens, Maestro flow stubs). Per-task implementation (Step 4.1+) is handled inline in the "Phase 4 — Build per-task flow (iOS branch)" section below.

Dispatch the `ios-entitlements-generator` skill (Info.plist + entitlements based on features: push, background, HealthKit, etc.) and the `ios-info-plist-hardening` skill (ATS config, privacy usage strings, URL schemes). Both live under `skills/ios/` and are loaded as skill bundles, not agents — they inherit the active implementer's `subagent_type` rather than being dispatched standalone. The active implementer for Phase 4 scaffold work is `subagent_type: engineering-senior-developer` (inheriting the `ios-context.md` persona).

- **Step 4.0.a (iOS):** Scaffolding is already done by Phase -1 Bootstrap. Instead, create the app target's folder structure (`Views/`, `Models/`, `Services/`, `Resources/`) via XcodeBuildMCP.
- **Step 4.0.b (iOS):** Implement iOS-native design tokens from `DESIGN.md` (YAML `colors`, `typography`, `rounded`, `spacing` blocks). Write `Sources/<target>/DesignTokens.swift` per the SwiftUI translator template in `protocols/design-md-authoring.md` §9.4 — emits `Color` extensions (Asset Catalog–backed; the `-dark` color pairs populate the dark appearance), `Font` extensions (Dynamic Type roles map to `Font.TextStyle`), `Spacing` and `Radius` enums (CGFloat constants; use radius with `.continuous` corner style). Also create `Resources/Assets.xcassets` color set entries — one per `colors:` token, with the `-dark` variant populating the Dark appearance slot. Component tokens (`button-primary`, `card-elevated`, etc.) are applied via SwiftUI view modifiers in per-screen views — NOT translated to Swift directly. NOT web CSS.
- **Step 4.0.c (iOS):** Replace Playwright acceptance scaffolds with Maestro YAML flow stubs in `maestro/` directory.
- **Step 4.0.d (iOS):** Metric Loop on scaffold health — builds clean via XcodeBuildMCP, Swift Testing `@Test`s pass, structure matches architecture. Max 3 iterations. Scoring criteria = clean build + @Test pass + expected folder structure. Checklist is minimal and **mechanical** — no large doc extraction needed. On `xcodebuild` failure, spawn the Swift build resolver — see the dispatch block below.
- **Step 4.0.e (iOS):** Verification Gate via XcodeBuildMCP build + test. Do not proceed to Step 4.1+ per-task flow until it passes.

**Step 4.0.d build-fix dispatch (iOS):** When the scaffold-health metric loop hits an `xcodebuild` failure, the orchestrator MUST dispatch the Swift build resolver rather than re-running the scaffolder blindly.

Call the Agent tool — description: "Swift build fix (scaffold)" — subagent_type: `swift-build-resolver` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] xcodebuild failed with this error: [paste]. Apply the minimal diff to fix the specific error. No architectural edits, no dependency changes, no refactors. Confirm green before returning."

If the resolver returns `status: blocked` (architectural change required), the orchestrator returns to Step 4.0.a/4.0.b with the blocker surfaced — the resolver is NOT permitted to restructure foundation types.

**Step 4.0.c HARD-GATE (Maestro flow scaffold assertion):** At the end of Step 4.0.c — before proceeding to Step 4.0.d — the orchestrator MUST run:

```bash
find maestro -name '*.yaml' -type f | wc -l
```

The result MUST be `>= 2`. If less than 2, re-dispatch the Maestro stub scaffolder ONCE (max 1 retry) via:

Call the Agent tool — description: "Maestro stub scaffold (retry)" — subagent_type: `engineering-senior-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] Step 4.0.c regression: Maestro flow stubs were not scaffolded. Load the `skills/ios/ios-maestro-flow-author/` skill bundle and scaffold at least 2 .yaml flow stubs in `maestro/` per the sprint-tasks.md Behavioral Test fields. Do NOT touch other files."

After the retry, re-run the `find` command. If still `< 2`, HALT the build with directive: "Step 4.0.c regression: Maestro flow stubs were not scaffolded. Return to Step 4.0.c before proceeding." Do NOT advance to Step 4.0.d / Step 4.0.e / Step 4.1+ per-task flow until the assertion passes.

## Phase 4 — Build per-task flow (iOS branch)

These are the iOS-specific prompt templates for the per-task flow inside Phase 4 Step 4.1+. The orchestrator-side machinery (**three-tier: Product Owner → Briefing Officer → Execution Agents**, Senior Dev cleanup, code review pair, Metric Loop, Verify Service) lives in `commands/build.md` Phase 4. This section overrides the implementer dispatch and iOS-specific verification prompts.

**Wave dispatch (feature-grained, from feature-delegation-plan.json):** The Product Owner (Step 4.1) groups features into waves and writes `docs/plans/feature-delegation-plan.json`. The orchestrator reads that plan to determine wave membership. Each wave dispatches one Briefing Officer per feature in parallel. Within a feature, tasks run in DAG-parallel batches (topological order from the `Dependencies:` field in sprint-tasks.md — independent sibling tasks run in parallel). iOS wave 1 commonly contains independent `Models/`, `Services/`, and static-view scaffolds; downstream view-model and navigation tasks fall into later waves as their deps clear.

Load full iOS skill bundle per `protocols/ios-context.md` §Phase 4 — Build (Step 4.1+ per-task flow). Every implementation agent inherits the `ios-context.md` Senior iOS Engineer persona. Bundle includes: `swiftui-pro`, `swift-concurrency`, `swiftdata-pro`, `swift-security-expert`, `swift-accessibility`.

**Feature-flag gated skill loading** — before dispatching any gated skill, the orchestrator MUST read `ios_features` from `docs/plans/.build-state.md`. Load a gated skill only when its flag is `true`:
- `widgets: true` → load `skills/ios/widgetkit/`
- `liveActivities: true` → `skills/ios/activitykit/`
- `appIntents: true` → `skills/ios/app-intents/`
- `foundationModels: true` → `agents/ios-foundation-models-specialist.md`
- `storekit: true` → `agents/ios-storekit-specialist.md`

**Other Apple frameworks** (HealthKit, GameKit, ARKit, RealityKit, Vision, CoreML, MapKit, PhotoKit, WeatherKit, MusicKit, Contacts, EventKit, CallKit) — **available via iOS 26 SDK `import`**; agent uses `apple-docs-mcp` lookups + `ios-context.md` persona + `ios-entitlements-generator` for capability wiring. No dedicated mentor-skill yet — add one only if a specific framework becomes friction during dogfooding.

### Step 4.1 — Implement (iOS)

Call the Agent tool — description: "[task name]" — subagent_type: `[from BO brief]` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] [COMPLEXITY: S/M/L from sprint-tasks.md].

TASK: [task description from BO brief]

FEATURE CONTEXT:
[product_context from BO brief — persona constraints, business rules, key error scenarios]

SCREEN SPEC:
[relevant section from page-spec or DESIGN.md (## Components prose + relevant component YAML tokens), pasted from BO brief. Omit for non-UI tasks.]

COMPONENTS:
[SwiftUI component picks from BO brief — View types, SF Symbols, HIG patterns]

API CONTRACT:
[endpoint shape or SwiftData model from BO brief]

ERROR STATES:
[specific failure modes from BO brief — trigger, user message, recovery]

BUSINESS RULES:
[concrete rules from BO brief]

SKILLS ASSIGNED: [skill list from BO brief]

ACCEPTANCE: [criteria from BO brief]

## Prior Learnings
[paste contents of docs/plans/.active-learnings.md if it exists]

## Deviation Reporting
Return deviation_row or null. Do NOT write decisions.jsonl directly.

Implement fully with real code and tests. Commit: 'feat: [task]'."

Implementation agents edit Swift files directly and build/diagnose via XcodeBuildMCP. Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

**Agent selection table for Step 4.1 (keyed on `ios_features.*` + task kind):**

| Task kind | Gating flag | Dispatch `subagent_type` |
|-----------|-------------|--------------------------|
| Foundation Models / on-device LLM | `ios_features.foundationModels == true` | `ios-foundation-models-specialist` |
| StoreKit / IAP / subscriptions | `ios_features.storekit == true` | `ios-storekit-specialist` |
| Widgets / Lock Screen | `ios_features.widgets == true` | `engineering-senior-developer` (loads `skills/ios/widgetkit/`) |
| Live Activities / Dynamic Island | `ios_features.liveActivities == true` | `engineering-senior-developer` (loads `skills/ios/activitykit/`) |
| App Intents / Siri / Shortcuts | `ios_features.appIntents == true` | `engineering-senior-developer` (loads `skills/ios/app-intents/`) |
| SwiftUI view / view model / navigation (UI task) | n/a | `engineering-senior-developer` (L) or `engineering-mobile-app-builder` (S/M) |
| Exploratory Swift-code search before implementation | n/a | `ios-swift-search` |
| General / cross-cutting | n/a | `engineering-senior-developer` (L) or `engineering-mobile-app-builder` (S/M) |

Precedence rule: if a task matches multiple rows, the most specific (top-down) wins. UI *planning* (not implementation) may additionally dispatch `ios-swift-ui-design` as a separate plan step — the implementer proper remains per the table.

### Step 4.1b — Swift review (iOS)

After every Step 4.1 implementer returns (and before Step 4.2 Metric Loop / verify), run a Swift-specific review pass to catch concurrency / SwiftUI / protocol-DI issues the generic code-reviewer misses. Run in parallel with the generic code-reviewer + silent-failure-hunter pair from `commands/build.md` per-task review block.

Call the Agent tool — description: "Swift review: [task name]" — subagent_type: `swift-reviewer` — prompt: "[CONTEXT header above — phase: 4] Review the Swift changes in this task. Task: [name]. Files changed: [list]. Walk the CRITICAL → HIGH → MEDIUM checklist for Swift concurrency 6.2, SwiftUI patterns, protocol DI testability, and Foundation Models integration. Confidence-filter at 80%."

For auth / PII / Keychain / credential tasks, also dispatch `subagent_type: security-reviewer` per the build.md per-task review block.

### Step 4.1c — Cleanup (iOS)

Run the code-simplifier + refactor-cleaner pair from `commands/build.md` per-task cleanup block against the Swift changeset. Swift dead-code detection relies on SwiftLint / xcodebuild warnings rather than `knip` / `depcheck` — the refactor-cleaner runs in a Swift-aware mode.

1. Call the Agent tool — description: "Simplify [task name]" — subagent_type: `code-simplifier` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] Simplify changed Swift files from [task]. Remove dead code, unused imports, redundant abstractions. Do NOT add features. Do NOT change architecture. Do NOT touch files outside the changeset. Files: [list]."
2. Call the Agent tool — description: "Refactor-clean [task name]" — subagent_type: `refactor-cleaner` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] Clean dead code from changed Swift files in [task]. Run SwiftLint / xcodebuild warning sweep and remove orphaned helpers, unused types, dead functions. Same scope rules — changeset only. Files: [list]."

### Step 4.2 — Metric Loop (iOS)

Per `protocols/metric-loop.md` Step 0.5, extract task acceptance criteria from `sprint-tasks.md` Behavioral Test field into the Scoring Criteria Checklist. **Phase 4 per-task extraction is mechanical — no dispatch.** The Behavioral Test field is a single structured value per task; the orchestrator copies it directly into `active_metric_loop.scoring_criteria_checklist` in `.build-state.json`.

Metric loop uses XcodeBuildMCP SwiftUI Preview captures for UI verification (not agent-browser). Critic receives the checklist + fresh Preview captures each iteration. Generator re-invocation on iteration 2+ follows the lean context rule (top issue + file paths + relevant checklist values only — no full `[CONTEXT header above]`). Max 5 iterations.

**Build-fix dispatch (iOS):** When `xcodebuild` fails during the metric loop (or during Step 4.1 implementer return), the orchestrator MUST spawn the Swift build resolver rather than asking the generic implementer to guess at the error.

Call the Agent tool — description: "Swift build fix" — subagent_type: `swift-build-resolver` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] xcodebuild failed with this error: [paste]. Apply the minimal diff to fix the specific error. No architectural edits, no dependency changes, no refactors. Confirm green before returning."

If the resolver returns `status: blocked` (architectural or dependency change required), the orchestrator hands back to the Step 4.1 implementer with the resolver's `blocking_error` payload so the implementer can make an informed architectural fix — the resolver is NOT permitted to restructure types.

### Step 4.3b — Behavioral Smoke Test (iOS) — PRECONDITIONS

Before running the Maestro smoke test, the orchestrator MUST verify:

1. **Maestro CLI installed:** `which maestro`. If missing, dispatch installer agent: `brew install --cask maestro` OR `curl -Ls https://get.maestro.mobile.dev | bash`. MAX 2 attempts. If still missing, hard-fail with directive: "Maestro is required for iOS behavioral verification. Install manually or downgrade affected tasks' Behavioral Test fields to N/A in sprint-tasks.md."

2. **Maestro flow files exist:** `find maestro -name '*.yaml' -type f | wc -l`. If zero AND any iOS task in `sprint-tasks.md` has a non-N/A Behavioral Test field, hard-fail with directive: "Step 4.0.c regression: Maestro flow stubs were not scaffolded. Return to Step 4.0.c before proceeding to Step 4.3b."

3. **Booted simulator available:** XcodeBuildMCP `BootSimulator` returns success for the project's deployment target.

If any precondition fails, log "SMOKE: BLOCKED -- precondition [N] failed" to `docs/plans/.build-state.md` and return BLOCKED. Do NOT proceed to the smoke test execution. Do NOT log SKIPPED. Do NOT log PASS.

### Step 4.3b — Behavioral Smoke Test (iOS)

Executes the task's **Maestro** flow from `maestro/` against a booted simulator (via XcodeBuildMCP `BuildAndRun` → `maestro test maestro/<flow>.yaml`) — NOT agent-browser or localhost. Evidence = Maestro run log + Preview/simulator screenshots. For OAuth/web-view flows on the simulator only, use agent-browser `-p ios`.

## Phase 5 — Audit (iOS branch)

Phase 5 does NOT run the web audit bundle. Instead, **dispatch to the three iOS twin commands in sequence** (these are slash-command dispatches, not Agent tool calls — each twin command owns its own internal `subagent_type` wiring):

1. `/buildanything:verify` (iOS twin — functional correctness, XcodeBuildMCP diagnostics, Maestro E2E)
2. `/buildanything:ux-review` (iOS twin — HIG audit via SwiftUI Preview captures + Apple HIG checklist)
3. `/buildanything:fix` (iOS twin — dispatches specialist iOS agents for each finding, including `subagent_type: ios-app-review-guardian` for App Review rejection risks)

Each twin owns its own scope and reviewer — they are NOT merged into a single loop. After all three twins complete, verify the following output artifacts exist and are non-empty before proceeding to Phase 6:

- `docs/plans/ios-verify-report.md` — written by the `/buildanything:verify` twin
- `docs/plans/ios-ux-review-report.md` — written by the `/buildanything:ux-review` twin
- At least one `*.yaml` file in `maestro/` — Maestro flows from Phase 4 scaffold
- At least one `*.png` screenshot in `docs/plans/evidence/maestro-runs/` — from the verify run

If any required artifact is missing, re-dispatch the owning twin once. If still missing after one retry, log a blocker and present to user (interactive) or proceed with a warning in the Completion Report (autonomous).

Then run **Phase 6 Step 6.0 Reality Check** (in `commands/build.md`, backed by `subagent_type: testing-reality-checker`) with iOS evidence (Maestro run logs, Preview captures, HIG findings).

The Launch Readiness Review (Phase 6 in `commands/build.md`) also runs unchanged for iOS mode, with the usual LRR chapter agents: `subagent_type: code-reviewer` (Eng-Quality, paired with `subagent_type: swift-reviewer` for Swift-specific code review), `subagent_type: security-reviewer` (Security), `subagent_type: engineering-sre` (SRE), `subagent_type: a11y-architect` (A11y), `subagent_type: design-brand-guardian` (Brand).

Skip the web-only audit steps from `protocols/web-phase-branches.md` Phase 5 (5-agent audit team, eval harness, hardening metric loop, 3-iteration Playwright E2E, agent-browser dogfood, web fake-data patterns).

## Phase 7 — Ship (iOS branch, optional)

Ship pipeline is **optional** (simulator-only is a valid end-state — no Apple Developer account required).

If the user opts to ship: run the iOS `asc-*` pipeline. The per-agent wiring for Phase 7 lives in `commands/build.md` §Phase 7 — the iOS branch here only names the role slots:

- App Store Connect listing + keywords + description → `subagent_type: marketing-app-store-optimizer` (dispatch lives in `commands/build.md` Phase 7). The `asc-metadata-generator`, `asc-screenshot-generator`, and `asc-privacy-manifest` items below are skill bundles the optimizer pulls in, not standalone agents.
- `asc-metadata-generator` (skill — App Store Connect listing + keywords + description, loaded by marketing-app-store-optimizer)
- `asc-screenshot-generator` (skill — generate App Store screenshots via XcodeBuildMCP at all required device sizes)
- `asc-privacy-manifest` (skill — PrivacyInfo.xcprivacy)
- iOS app review sanity check → `subagent_type: ios-app-review-guardian` before TestFlight upload — catches rejection risks (IAP rules, HIG violations, entitlement issues, metadata problems).
- Code signing + TestFlight upload → `subagent_type: engineering-devops-automator` with `fastlane` as the underlying tool.

This is SEPARATE from the web ship pipeline — do NOT run web README/deployment steps. Documentation = README with simulator run instructions + TestFlight invite link (if shipped). Skip Step 7.1 web docs and web deployment notes.
