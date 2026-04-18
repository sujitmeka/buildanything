# Phase Graph — Canonical Orchestration Source of Truth

**Purpose:** single structured representation of the `/buildanything:build` pipeline, extracted from the prose in `commands/build.md`, `protocols/web-phase-branches.md`, `protocols/ios-phase-branches.md`, and the callable-service protocols. Today the same information is scattered across ~4,273 lines of markdown; the orchestrator has to read and reason about it every run. This file is the single source of truth both the current markdown entry points AND the future SDK orchestrator will consume.

**Invariant:** if the pipeline changes, this file changes first. Prose files become thin narrative wrappers that `$include` or reference sections here. Code generators (SDK orchestrator) parse this file directly.

**Scope of this document:**
1. Artifact writer-owner table (who writes what, when)
2. Project-type classification matrix
3. Phase graph (phases 0 through 7, with steps, dispatches, gates, reads, writes)
4. Cross-cutting callable services
5. Backward-routing edges
6. State schema (`.build-state.json` top-level fields)
7. Pre-migration cleanup list
8. Migration plan (partial hybrid, canary-first)
9. Sequencing recommendation

---

## 1. Artifact Writer-Owner Table

Every shared artifact has ONE concurrent writer at any instant. Non-owning phase writes are a HARD-GATE violation.

| Artifact | Writer | Readers |
|---|---|---|
| `CLAUDE.md` | Phase 1 | auto-loaded into every subagent |
| `docs/plans/design-doc.md` (PRD) | Phase 1 | Phase 2-7 via refs |
| `docs/plans/architecture.md` | Phase 2 | Phase 3-7 via refs |
| `docs/plans/sprint-tasks.md` | Phase 2 | Phase 4-6 via refs |
| `docs/plans/quality-targets.json` | Phase 2 | Phase 4, 5, 6 |
| `docs/plans/visual-design-spec.md` (web) | Phase 3 | Phase 4, 5, 6 |
| `docs/plans/ios-design-board.md` (iOS) | Phase 3 | Phase 4, 5, 6 |
| `docs/plans/component-manifest.md` (web) | Phase 3 | Phase 4 (HARD-GATE import source) |
| `docs/plans/visual-dna.md` (web) | Phase 3 | Phase 3-6 |
| `docs/plans/refs.json` | Phase 2 writer, Phase 3 extender | Phase 4 Briefing Officer |
| `docs/plans/decisions.jsonl` | orchestrator-scribe ONLY (subagents return `deviation_row`) | Phase 0 resume, Phase 5 reality-checker, Phase 6 LRR Aggregator |
| `docs/plans/learnings.jsonl` | Phase 5, Phase 7 | Phase 0 Learnings Loader, Phase 5 reality sweep |
| `docs/plans/evidence/*.json` | Phase 5 writer, Phase 4 contributors | Phase 6, Phase 7 |
| `docs/plans/evidence/lrr/*.json` | Phase 6 (1 per chapter) | Phase 6 Aggregator |
| `docs/plans/evidence/lrr-aggregate.json` | Phase 6 Aggregator ONLY | Phase 7 |
| `docs/plans/.build-state.json` | orchestrator (every phase boundary) | all phases, resume handler |
| `docs/plans/.build-state.md` | auto-rendered view of `.build-state.json` | read-only |
| `docs/plans/.task-outputs/[task-id].json` | Phase 4 per-task | Phase 5, Phase 6 |
| `docs/plans/build-log.md` | every phase (append on transition) | user, resume |

Phase-internal scratch (never read by Phase 3+):
`docs/plans/phase1-scratch/{idea-draft,feature-intel,tech-feasibility,ux-research,business-model,findings-digest,suggested-questions,user-decisions,prereqs}.{md,json}`

---

## 2. Classification Matrix

Classifications write to `.build-state.json` at Phase 0 and gate downstream branches.

### 2.1 `project_type` — platform

| Signal | Action | Value |
|---|---|---|
| iOS keywords in prompt (iOS, iPhone, SwiftUI, Xcode, App Store, TestFlight, Apple, SwiftData, HIG, Liquid Glass, watchOS, visionOS) | Confirm with user (interactive) or infer (autonomous) | `ios` |
| `.xcodeproj` / `Package.swift` / `*.swift` in repo | Auto-set | `ios` |
| No iOS signals | Default | `web` |

Branch-file load is conditional:
- `project_type=ios` → load `protocols/ios-phase-branches.md` + `protocols/ios-context.md`
- `project_type=web` → load `protocols/web-phase-branches.md`

### 2.2 `ios_features` — 16-flag block (iOS only, resolved end of Phase 2)

`widgets, liveActivities, appIntents, foundationModels, storekit, healthkit, push, cloudkit, siri, location, background, cameraPhoto, microphone, contacts, calendar, appleWatch`

Each is `true|false`. Gates Phase 4 skill bundle loading and entitlement generation.

---

## 3. Phase Graph

Structured representation. Every phase has: `id`, `name`, `kind`, `skip_conditions`, `steps`. Every step has: `id`, `name`, `kind` (dispatch-single | dispatch-parallel | dispatch-team | internal-inline | loop | gate | transition), `dispatches` (list of agent calls), `reads`, `writes`, `gates`, `on_failure`.

### Phase 0 — Pre-flight (state read only, no dispatch)

**Kind:** `classify-only` (no agent dispatches). **Skip conditions:** none.

| Step | Name | Kind | Writes | Notes |
|---|---|---|---|---|
| resume-check | Resume handler | internal | rehydrates `.build-state.json`, reads top 5 decisions.jsonl rows, rebuilds TodoWrite | fires on `--resume` or post-compaction SessionStart hook |
| 0.1 | Read the Room | classify | `context_level` ∈ {full-design, decision-brief, partial, raw-idea} | scans input + `docs/plans/` + `docs/briefs/` |
| 0.1b | Project Type Classification | classify | `project_type` ∈ {web, ios} | iOS keyword scan, `.xcodeproj` detection |
| 0.1d | Learnings Loader | read | `docs/plans/.active-learnings.md` (top 3 relevant PITFALLs) | reads `learnings.jsonl` local, fallback to `~/.claude/buildanything/learnings.jsonl` |
| 0.2 | Initialize | write | `docs/plans/.build-state.json`, TodoWrite checklist | no prereq collection yet (stack not decided) |

**No prereq collection in Phase 0.** Stack isn't decided until Phase 1 Step 1.4. Prereqs move to Step 1.5.

---

### Phase -1 — iOS Bootstrap (iOS-only, greenfield only)

**Kind:** `bootstrap`. **Skip conditions:** `project_type != ios` OR `.xcodeproj` exists.

| Step | Name | Kind | Dispatches | Gates |
|---|---|---|---|---|
| -1.1 | Environment Check | internal | verifies Xcode 26.3+, XcodeBuildMCP, apple-docs-mcp, Maestro CLI | hard-fail on missing Xcode (no fallback) |
| -1.2 | Xcode Project Creation | dispatch-single (INTERNAL) | user-guided Xcode New Project (iOS 26.0+, Swift 6.2+, SwiftUI, SwiftData) | no Tuist, no XcodeGen |
| -1.2b | Overwrite Apple template tests | write | replaces `<target>Tests/<target>Tests.swift` + `<target>UITests/<target>UITests.swift` with AUTOGENERATED HARNESS marker | Layer C stub detector directive: marker → MARKER, not STUB |
| -1.3 | Bootstrap Verification | internal | verifies all of: Xcode OK, `.xcodeproj` exists, MCP servers respond, Maestro installed, first build+launch on simulator succeeded | HARD-STOP if any fails |

---

### Phase 1 — Discover (brainstorm ↔ research loop)

**Kind:** `sequential-with-parallel-research`. **Skip conditions:** `context_level == full-design` (goes straight to Phase 2).

| Step | Name | Kind | Dispatches | Reads | Writes |
|---|---|---|---|---|---|
| 1.0 | Initial Brainstorm | dispatch-single (INTERNAL, no `subagent_type`) | Brainstorm Facilitator (round 1) — 4-8 questions capturing WHAT/WHO/PROBLEM/CONSTRAINTS | $ARGUMENTS, conversation | `phase1-scratch/idea-draft.md` |
| 1.1 | Research (4 parallel agents, ONE message) | dispatch-parallel | `feature-intel`, `tech-feasibility`, `design-ux-researcher`, `business-model` | `idea-draft.md` | `phase1-scratch/{feature-intel,tech-feasibility,ux-research,business-model}.md` |
| 1.2 | Research Digest | dispatch-single (INTERNAL) | Research Synthesizer reads all 4 raw files IN ITS OWN context, writes digest + dynamic questions | 4 raw research files | `phase1-scratch/findings-digest.md`, `phase1-scratch/suggested-questions.md` |
| 1.3 | Informed Brainstorm | dispatch-single (INTERNAL) | Brainstorm Facilitator (round 2) — dynamic Q&A using digest | digest + suggested-questions | `phase1-scratch/user-decisions.md` |
| 1.4 | Design Doc + CLAUDE.md | dispatch-single (INTERNAL) | Design Doc Writer → 2 outputs: PRD + `CLAUDE.md` (<200 lines HARD-GATE) + 3 decision rows (tech-stack, data-model, scope-boundary) | idea-draft, digest, user-decisions | `docs/plans/design-doc.md`, `CLAUDE.md` |
| GATE-1 | Quality Gate 1 | gate | interactive: user approves design; autonomous: auto-approve | — | — |
| 1.5 | Prereq Collector | dispatch-single (INTERNAL) | reads stack from PRD, asks ONLY for stack-specific creds | `design-doc.md#tech-stack` | `phase1-scratch/prereqs.json` |

**iOS branch additions (Phase 1):** same 4 research agents, but each prompt adds App Store category landscape + TestFlight constraints + iOS 26 API availability checks. For AI/Foundation Models builds, additionally dispatch `ios-foundation-models-specialist`.

**Backward edge:** `GATE-1 NO → Step 1.0` (round-1 facilitator re-invocation with user feedback).

**Decision rows written at this phase:** 3 (via orchestrator-scribe, never by subagents directly).

---

### Phase 2 — Plan / Architect (TEAM of 6 + sequence)

**Kind:** `team-then-sequence`. **Skip conditions:** none (runs on `context_level == full-design` too).

| Step | Name | Kind | Dispatches |
|---|---|---|---|
| 2.1 | Explore existing codebase | dispatch-single (INTERNAL, conditional) | inline exploration agent — only if existing code detected |
| 2.2a | Team create | internal | `TeamCreate(team_name: "phase-2-architects")` |
| 2.2b | 6 architects as teammates (ONE message) | dispatch-team (6 parallel) | see table below |
| 2.2c | Wait for all idle | internal | await all 6 teammate idle states before synthesis |
| 2.2d | Team teardown | internal | `TeamDelete("phase-2-architects")` — after synthesizer returns |
| 2.3.1 | Implementation Blueprint | dispatch-single | `code-architect` reads all 6 post-debate contracts, writes `architecture.md` |
| 2.3.2 | Sprint Breakdown | dispatch-single | `planner` writes `sprint-tasks.md` with Dependencies + Behavioral Test fields |
| 2.3.3 | Task DAG Validator | dispatch-single (INTERNAL) | validates no circular deps, IDs exist, sizing consistent, Behavioral Tests present |
| 2.3.4 | Refs Indexer | dispatch-single (INTERNAL) | generates `refs.json` covering all live docs |
| 2.3.loop | Architecture Metric Loop | loop (callable service) | metric: PRD coverage + specificity + simplicity. Max 3 iterations |
| GATE-2 | Quality Gate 2 | gate | interactive approval OR autonomous auto-approve |
| 2.ios-flags | iOS Feature Flag Resolution | classify (iOS only) | resolve 16-flag `ios_features` block per `protocols/ios-phase-branches.md` |

**6 architects (all teammates of `phase-2-architects`, dispatched in ONE message):**

| Name (team slot) | subagent_type | Domain |
|---|---|---|
| `backend-architect` | `engineering-backend-architect` | services, API contracts, DB schema |
| `frontend-architect` | `engineering-frontend-developer` | component hierarchy, state mgmt, routing |
| `data-engineer` | `engineering-data-engineer` | ETL/ELT, schema versioning, query patterns |
| `security-engineer` | `engineering-security-engineer` | auth model, input validation, threat model |
| `accessibility-auditor` | `a11y-architect` | WCAG 2.2 AA constraints on component/nav choice |
| `performance-benchmarker` | `testing-performance-benchmarker` | `quality-targets.json`, bundle + latency budgets |

**Cross-check pairings (mandatory SendMessage boundaries):**
- Backend ↔ Frontend → API contract shape
- Security ↔ Backend → auth flow
- Accessibility ↔ Frontend → component patterns
- Performance ↔ Backend+Data → query shapes

**iOS branch overrides (Phase 2):** replaces Backend+Frontend architect dispatches with a SINGLE `ios-swift-architect` dispatch covering (1) SwiftUI view hierarchy + navigation, (2) SwiftData schema + CloudKit, (3) Swift Concurrency / actor isolation, (4) iOS security (Keychain, entitlements, ATS). Security stays on `engineering-security-engineer`.

**Writes:** `docs/plans/phase-2-contracts/*.md` (6 files — post-debate positions), then `architecture.md`, `sprint-tasks.md`, `quality-targets.json`, `refs.json`.

**Decision rows written at this phase:** 4 (API contract, persistence, auth, framework).

**Backward edges:** `GATE-2 NO → Phase 2`. `LRR BLOCK decided_by=architect → Phase 2` (re-entry template).

**Re-entry rule:** only the architect whose domain matches `decision_row.author` re-runs. Synthesizer re-runs once. Unaffected domains NOT re-run.

---

### Phase 3 — Design (DNA-first, web) / Design Board (iOS)

**Kind:** `dna-first-sequence`. **Skip conditions:** project has no user-facing frontend (CLI tools, pure APIs, backend services).

#### 3.a Web branch (`protocols/web-phase-branches.md`)

| Step | Name | Kind | Dispatches |
|---|---|---|---|
| 3.0 | Visual DNA Selection (DNA owner) | dispatch-single | `design-brand-guardian` → locks 6-axis DNA card (Scope, Density, Character, Material, Motion, Type) per `protocols/visual-dna.md` |
| 3.1 | Visual Research (2 parallel, Playwright-driven) | dispatch-parallel | `visual-research` mode=`competitive-audit`, `visual-research` mode=`inspiration-mining` |
| 3.2 | Component Library Mapping (HARD-GATE source) | dispatch-single | `design-ui-designer` reads catalog + DNA, writes `component-manifest.md` |
| 3.2b | DNA Persona Check | dispatch-single | `design-ux-researcher` validates DNA vs persona/JTBD; may route back to 3.0 |
| 3.3 | UX Architecture | dispatch-single | `design-ux-architect` writes `ux-architecture.md` |
| 3.4 | Visual Design Spec | dispatch-single | `design-ui-designer` (writer invocation) writes `visual-design-spec.md` with tokens + material + motion + typography + state matrix |
| 3.5 | Inclusive Visuals Check | dispatch-single | `design-inclusive-visuals-specialist` writes `inclusive-visuals-audit.md` |
| 3.6 | Style Guide Implementation | loop (generator/critic, callable) | generator: `engineering-frontend-developer` builds `/design-system`. critic: `design-critic` scores 6 DNA axes × 5 craft dims = /220, target 180. Max 5 iters |
| 3.7 | A11y Design Review | dispatch-single | `a11y-architect` runtime WCAG 2.2 AA check on `/design-system` + key pages |
| 3.8 | Autonomous Quality Gate | gate | log summary to `build-log.md`, no user pause |

**Phase 3 web HARD-GATES:**
1. UI/UX IS THE PRODUCT — do NOT skip this phase.
2. Compositional not reconstructive — every element with a library variant MUST be mapped to that variant in `component-manifest.md`. Writing from scratch when the manifest covers the case is a HARD-GATE violation; cleanup agent reverts.

**Phase 4 entry requirement (web):** `visual-dna.md` AND `visual-design-spec.md` AND `component-manifest.md` must all exist.

#### 3.b iOS branch (`protocols/ios-phase-branches.md`)

| Step | Name | Kind | Dispatches |
|---|---|---|---|
| 3.1-ios | Visual research | dispatch-single | `visual-research` + agent-browser `-p desktop` to harvest from screenlane.com, App Store web listings, Apple HIG pages, SF Symbols browser (no paid sources) |
| 3.2-ios | iOS Design Board | dispatch-single | `ios-swift-ui-design` writes `ios-design-board.md` grounded in HIG + Liquid Glass + SF Symbols |
| 3.4-ios | Visual QA loop | loop (generator/critic) | generator: `ios-swift-ui-design` (Preview tweaks). critic: `design-critic`. Uses XcodeBuildMCP SwiftUI Preview captures. Max 3 iterations (tighter than web's 5) |

**Phase 4 entry requirement (iOS):** `ios-design-board.md` must exist.

**Backward edge:** `LRR BLOCK decided_by=design-brand-guardian or Phase 3 writer → Phase 3` (re-entry to specific step by `decision_row.author`).

---

### Phase 4 — Build (parallel batches by task dependencies)

**Kind:** `scaffold-then-parallel-task-batches`. **Skip conditions:** none.

#### 4.0 Scaffold (three sequential sub-dispatches, then Verify gate)

| Step | Name | Kind | Dispatches (web) | Dispatches (iOS) |
|---|---|---|---|---|
| 4.0.a | Project scaffolding | dispatch-single | `engineering-rapid-prototyper` — Next.js/Vite/etc. scaffolding | N/A (done by Phase -1) — instead: XcodeBuildMCP creates `Views/`, `Models/`, `Services/`, `Resources/` folders |
| 4.0.b | Design system setup | dispatch-single | `engineering-frontend-developer` — CSS tokens from visual-design-spec | `engineering-senior-developer` — SwiftUI `Color`/`Font`/`ShapeStyle` tokens from `ios-design-board.md` |
| 4.0.c | Acceptance test scaffolding | dispatch-single (INTERNAL) | Playwright test stubs in `tests/e2e/acceptance/` (one per sprint-task Behavioral Test) | Maestro YAML stubs in `maestro/` (HARD-GATE: `find maestro -name '*.yaml' \| wc -l >= 2`) |
| 4.0.d | Scaffold metric loop (iOS) | loop | — | builds clean via XcodeBuildMCP, `@Test`s pass. Max 3. Build-fix dispatch → `swift-build-resolver` |
| 4.0.e | Verify gate | gate | Verify Protocol (7 checks) — must PASS before Step 4.1 | XcodeBuildMCP build + test |

#### 4.1+ Per-task flow (runs for EVERY task in EVERY dependency-ordered batch)

The orchestrator builds a DAG from `sprint-tasks.md` Dependencies fields and executes in batches. Independent sibling tasks run in parallel (~30-50% wall-clock saving on typical sprints).

| Sub-step | Name | Kind | Dispatches |
|---|---|---|---|
| briefing | Briefing Officer (INTERNAL) | dispatch-single | reads `refs.json` + task row, writes ~40-line CONTEXT MAP |
| impl | Implementer | dispatch-single | by task type: web UI → `engineering-frontend-developer` (S/M) or `engineering-senior-developer` (L); backend → `engineering-backend-architect` or `engineering-senior-developer`; AI/ML → `engineering-ai-engineer`. iOS UI → `ios-swift-ui-design` (planner) + `engineering-senior-developer` / `engineering-mobile-app-builder` (implementer); Foundation Models → `ios-foundation-models-specialist`; StoreKit → `ios-storekit-specialist` |
| impl.re-entry | On re-entry from LRR | dispatch-single | implementer reads `blocking_finding` + `prior_output` + `decision_row`; revises ONLY what finding requires |
| sec-review | Security review (conditional) | dispatch-single | `security-reviewer` — only for auth/PII/Keychain/credential tasks |
| swift-review | Swift review (iOS only) | dispatch-single | `swift-reviewer` — Swift concurrency 6.2 + SwiftUI + protocol DI + Foundation Models checklist |
| cleanup | Senior Dev cleanup (2 passes) | dispatch-parallel | `code-simplifier` + `refactor-cleaner` (TS/JS) or SwiftLint-aware (iOS). Scope: changeset only |
| review | Code review pair (parallel) | dispatch-parallel (2 in ONE message) | `code-reviewer` + `silent-failure-hunter`. 80%+ confidence threshold |
| metric-loop | Metric Loop (generator/critic) | loop (callable service) | generator: same implementer re-invoked. critic: measurement agent dispatched fresh. Max 5 iters. For UI: web uses agent-browser; iOS uses SwiftUI Preview captures. THIS IS THE AUTHORITATIVE BEHAVIORAL VERIFICATION |
| smoke | Behavioral Smoke Test (iOS) | dispatch-single | Maestro flow against booted simulator. Preconditions: Maestro CLI installed, flow files exist, booted simulator available. On precondition fail → BLOCKED (not SKIPPED, not PASS) |
| verify | Verify Service (static checks only) | gate (callable service) | type-check + lint + build. Behavioral verification already done in metric loop. Max 3 fix attempts. Build-fix: `swift-build-resolver` (iOS) |
| scribe | Orchestrator-scribe handler | internal | walks batch_results, collects non-null `deviation_row`s, allocates IDs `D-{phase}-<seq>`, atomically appends to `decisions.jsonl`, updates `.build-state.json.decisions_next_id.P{N}` |

**HARD-GATE: `decisions.jsonl` is orchestrator-scribe ONLY.** Subagents return `deviation_row` objects in their structured result. Any prompt asking a subagent to write `decisions.jsonl` directly is a bug.

**HARD-GATE (web compositional):** if a task needs a button/card/hero/chart/modal/form/marquee/bento/3D element, the implementer MUST import from `component-manifest.md`. Writing from scratch when manifest names the variant → cleanup reverts.

**Per-task writes:** source code, `docs/plans/.task-outputs/[task-id].json` with `{files-changed, tests-passing, verify-status}`.

**Backward edges:** `LRR NEEDS_WORK (code-level) → Phase 4 target task`. Dogfood → Phase 5 Feedback Synthesizer → Phase 4 target task.

---

### Phase 5 — Audit (TEAM of 6 + eval harness + 3 parallel + feedback synth)

**Kind:** `team-then-eval-then-parallel-then-synth`. **Skip conditions:** none. **Precondition:** Verify Protocol must pass.

#### 5.a Web branch

| Step | Name | Kind | Dispatches |
|---|---|---|---|
| 5.1 | TEAM of 6 parallel auditors (ONE message) | dispatch-parallel (6) | see table below |
| 5.2 | Eval Harness → Metric Loop | loop (callable service) | 8-15 executable eval cases from audit findings. Metric Loop max 4 iters, routes fixes to right specialist (security → `security-reviewer`, a11y → `engineering-frontend-developer`, perf → `testing-performance-benchmarker`). Re-run eval after loop |
| 5.3 | TEAM of 3 parallel (ONE message) | dispatch-parallel (3) | E2E runner (Playwright, 3 iters mandatory), Dogfood runner (agent-browser), Fake-data detector |
| 5.4 | Feedback Synthesizer | dispatch-single | `product-feedback-synthesizer` classifies Dogfood findings → routes to Phase 4 (code) / Phase 3 (visual) / Phase 2 (structural). Max 2 fix cycles |

**6 auditors in ONE message:**

| # | subagent_type | Focus |
|---|---|---|
| 1 | `testing-api-tester` | API validation, edge cases, error responses, auth flows |
| 2 | `testing-performance-benchmarker` | response times, bottlenecks, Per-Scope bundle budgets (Marketing 500KB / Product 300KB / Dashboard 400KB / Internal 200KB gzipped, >25% over auto-blocks LRR SRE) |
| 3 | `a11y-architect` | WCAG 2.2 AA runtime (contrast, keyboard, focus, touch targets >=44px, reduced-motion) |
| 4 | `engineering-security-engineer` | auth, input validation, data exposure, dependency vulns |
| 5 | `design-ux-researcher` | loading/error/empty states, mobile at 375px, form validation, visual consistency vs style guide |
| 6 | `design-brand-guardian` | DNA drift check (Phase 5 re-invite, does NOT issue verdict — feeds LRR Brand Guardian chapter) |

#### 5.b iOS branch

Instead of the web 6+3, iOS dispatches **three slash-commands in sequence** (each twin owns its own internal `subagent_type` wiring):
1. `/buildanything:verify` (iOS twin — XcodeBuildMCP diagnostics, Maestro E2E)
2. `/buildanything:ux-review` (iOS twin — HIG audit via SwiftUI Preview + HIG checklist)
3. `/buildanything:fix` (iOS twin — dispatches specialist iOS agents, includes `ios-app-review-guardian`)

Required iOS artifacts after twins complete:
- `docs/plans/ios-verify-report.md` (non-empty)
- `docs/plans/ios-ux-review-report.md` (non-empty)
- ≥1 `*.yaml` in `maestro/`
- ≥1 `*.png` in `docs/plans/evidence/maestro-runs/`

**Writes:** `docs/plans/evidence/*.json`, `evidence/fake-data-audit.md`, `evidence/dogfood/classified-findings.json`, `learnings.jsonl` (reality sweep PITFALL/PATTERN rows).

---

### Phase 6 — Launch Readiness Review (5 chapter judges + mechanical aggregator)

**Kind:** `evidence-sweep-then-5-parallel-chapters-then-aggregator`. **Skip conditions:** none.

#### 6.0 Reality Check (evidence sweep + dissent log revisit pass)

Preconditions (HARD-GATE — orchestrator-side BEFORE dispatching Reality Checker):

**All projects:** `.build-state.json` exists + has recent VERIFY:PASS.

**Web:** `eval-harness/baseline.json`, `eval-harness/final.json`, `e2e/iter-3-results.json`, `dogfood/findings.md`, `dogfood/classified-findings.json`, `fake-data-audit.md`, `manifest.json` (all non-empty).

**iOS:** `ios-verify-report.md`, `ios-ux-review-report.md`, ≥1 `maestro/*.yaml`, ≥1 `maestro-runs/*.png`, `manifest.json`.

Dispatch: `testing-reality-checker` — evidence-sweep role only. Receives evidence by PATH only (never paste). Uses Read/Glob/Grep. Writes `evidence/reality-check-manifest.json` with `{file_path, sha256, byte_count, modified_time, verdict_contribution}`.

**Dissent Log Revisit Pass:** reads `decisions.jsonl`, for every `status=open` row with non-empty `revisit_criterion`, semantically evaluates against current evidence. If triggered → (1) structural finding, (2) PITFALL row appended to `learnings.jsonl` with `provenance.decision_id`, (3) flag for LRR.

Reality Checker does NOT issue combined verdict — that authority moved to LRR Aggregator.

#### 6.1 LRR: 5 chapter judges in parallel (ONE message)

Net-5 panel (NOT 4, NOT 6):

| # | Chapter | subagent_type | Schema verdict | Follow-up permission |
|---|---|---|---|---|
| 1 | Eng-Quality (merged Eng+QA+PM fold-in) | `code-reviewer` (primary) + parallel sub-dispatch `pr-test-analyzer` for test coverage | PASS/CONCERNS/BLOCK + `requirements_coverage[]` | NO |
| 2 | Security | `security-reviewer` | PASS/CONCERNS/BLOCK | YES, read-only, 15 tool calls max, ONLY if verdict would be BLOCK |
| 3 | SRE (includes Performance) | `engineering-sre` | PASS/CONCERNS/BLOCK; bundle >25% over Scope budget auto-blocks | YES, same caps as Security |
| 4 | A11y (NEW SEAT) | `a11y-architect` | PASS if 0 Serious + 0 Critical; CONCERNS if 1-3 Serious + 0 Critical; BLOCK if any Critical or >3 Serious | NO |
| 5 | Brand Guardian (REPLACES old Design mechanical check) | `design-brand-guardian` | PASS/CONCERNS/BLOCK on 6 DNA axes + 5 craft dims | NO |

Every chapter writes `docs/plans/evidence/lrr/<chapter>.json` per `protocols/launch-readiness.md` schema with fields: `chapter`, `verdict`, `override_blocks_launch`, `evidence_files_read` (non-empty), `findings[]` (each with `severity`, `description`, `evidence_ref`, `related_decision_id` if tied to decision row), `follow_up_spawned`, `follow_up_findings`.

#### 6.1a PM coverage fold-in

PM coverage is a sub-input of the Eng-Quality chapter (not a separate dispatch). Evaluated inline via `requirements_coverage[]` field on `eng-quality.json`. Chapter count stays 5.

#### 6.2 LRR Aggregator (sequential, after all 5 chapter files exist)

INTERNAL inline role-string. Applies 6 mechanical rules. MAY NOT self-approve. MUST cite triggering rule number.

**Step 1 — File-completeness checkpoint:** Glob `evidence/lrr/*.json`, verify ALL 5 exist and parse. If any missing or malformed → log INCOMPLETE, write `evidence/lrr-incomplete.json`, STOP.

**Step 2 — Apply 6 rules:**
1. ANY `override_blocks_launch: true` → `combined_verdict = BLOCKED`
2. ALL verdicts PASS AND 0 follow-ups → `PRODUCTION READY`
3. ANY verdict BLOCK (without override) → `NEEDS WORK` + route findings to fix loop
4. ANY CONCERNS → `NEEDS WORK`, concerns logged
5. Follow-up spawned AND `follow_up.confirmed: true` → treat parent chapter as BLOCK
6. Contradictions between chapters on typed fields → `BLOCKED` with cross-chapter contradiction finding

**Step 3 — ⭐⭐ star rule (backward routing on BLOCK):** For each BLOCK finding, read `related_decision_id` → look up row in `decisions.jsonl` → read `decided_by` → route BACKWARD to authoring phase. Known `decided_by` values: `architect` (P2), `design-brand-guardian` (P3), `implementer` (P4), `human` (Gates 1/2).

**Step 4 — NEEDS_WORK:** classify findings by kind → Phase 4 (code) / Phase 2 (structural) / Phase 3 (visual).

**Step 5 — READY:** write `evidence/lrr-aggregate.json` with `combined_verdict`, `chapter_verdicts{}`, `triggered_rule`, `findings[]`, `follow_ups_spawned[]`, `backward_routing[]`, `timestamp`. Forward to Phase 7.

#### 6.3 Verdict resolution

- **PRODUCTION READY** → Phase 7.
- **NEEDS WORK** → apply `lrr-routing.json` via re-entry template. Max 2 cycles before user (interactive) / warning (autonomous).
- **BLOCKED** → apply backward routing. NEVER proceed to Phase 7.

**HARD-GATE:** LRR Aggregator is the ONLY agent that may emit `combined_verdict`. Not orchestrator, not Reality Checker, not individual chapters.

**Re-entry dispatch template** (used by backward routing and Phase 5 → 4 fix loop):
```
INPUT: {blocking_finding, prior_output, decision_row}
TASK: Revise prior_output to address blocking_finding. Do NOT redo unaffected work. Emit new decision_row.
```

---

### Phase 7 — Ship

**Kind:** `sequential-ship-pipeline`. **Skip conditions:** none. **Precondition:** pre-ship Verify gate — 7 checks must pass, max 2 fix attempts.

| Step | Name | Kind | Dispatches |
|---|---|---|---|
| 7.1.1 | Technical Writer | dispatch-single | `engineering-technical-writer` — README + API docs + deploy notes per PRD target |
| 7.1.2 | Documentation Metric Loop | loop (callable service) | metric: new-dev-can-follow-readme-end-to-end. Max 3 iters |
| 7.1.3 | App Store Optimizer (iOS only, conditional on ship) | dispatch-single | `marketing-app-store-optimizer` with `asc-metadata-generator`, `asc-screenshot-generator`, `asc-privacy-manifest` skills. Also `ios-app-review-guardian` sanity check before TestFlight |
| 7.1.4 | Deploy | dispatch-single | `engineering-devops-automator` — pre-deploy checks, execute deploy, verify 200 at deploy URL |
| 7.1.5 | Completion Report | dispatch-single (INTERNAL) | reads `lrr-aggregate.json` + `reality-check-manifest.json`. Surfaces Verification Gap BEFORE writing if declared ≠ passing or stub-flagged > 0 |

**iOS ship:** optional (simulator-only is valid end-state). Separate from web ship.

**Writes:** `docs/plans/learnings.jsonl` (late learnings only — doc friction, deploy blockers, late-surfacing gaps).

---

## 4. Cross-Cutting Callable Services

Five services invoked from multiple phases:

### 4.1 Metric Loop (`protocols/metric-loop.md`)

**Callers:** Phase 2 (architecture), Phase 3 Step 3.6 (design critic web), Phase 3 Step 3.4-ios (visual QA), Phase 4 per-task, Phase 4.0.d (iOS scaffold), Phase 5 Step 5.2 (hardening), Phase 7 (documentation).

**Contract:**
- Orchestrator defines metric for the context (not predefined).
- Measure/critic agent and fix/generator agent are SEPARATE dispatches — never share context (author-bias elimination).
- Fix agent receives ONLY the top issue + file paths + acceptance criteria. NOT the full findings.
- One fix per iteration. Measure impact before next fix.
- Each measurement is fresh — do not accumulate findings across iterations.
- Track all scores in `.build-state.json` (survives compaction).
- **Iter-1 short-circuit:** if first measurement ≥ target + 10, exit immediately (log `exit_reason: "short_circuit_iter1"`).
- Exit: target met | iter ≥ max | stall (2 consecutive delta ≤ 0) | short-circuit iter-1.
- Autonomous stall: accept at ≥60% target (warning); below 60% or any CRITICAL remaining → HALT.

### 4.2 Verify Protocol (`protocols/verify.md`)

**Callers:** Phase 2 (architecture check), Phase 4 (scaffold gate + per-task), Phase 5 (pre-audit), Phase 7 (pre-ship).

**Contract:** 7 sequential checks: Build → Type-Check → Lint → Test → Security → Diff Review → Artifacts. Stop on first FAIL. INTERNAL inline dispatch ("Verify scaffolding" role). Phase 4 per-task: static-only (behavioral already done in metric loop).

### 4.3 Decision Log (`protocols/decision-log.md`)

**Callers (writers):** Phase 1 synthesis (3 rows), Phase 2 architecture synthesis (4 rows), Phase 4 implementers (only on deviation). **Callers (readers):** Phase 0 resume, Phase 5 Reality Checker, Phase 6 LRR Aggregator.

**Contract:**
- `docs/plans/decisions.jsonl` — append-only, ORCHESTRATOR-SCRIBE ONLY.
- Subagents return `deviation_row` in structured result. Orchestrator allocates `D-{phase}-<seq>` and appends.
- Max 3 rejected alternatives per row. Max 2 sentences per `reason`. Max 1 sentence per `revisit_criterion`. Max 5 rows per phase. Total 15-25 rows per build.
- Fields: `decision_id`, `phase`, `timestamp`, `decision`, `chosen_approach`, `rejected_alternatives[]`, `decided_by` (free-form role string), `ref` (anchor), `status` (open|triggered|resolved).
- Findings in LRR chapter verdicts reference rows via `related_decision_id` on the finding.

### 4.4 Learnings (`learnings.jsonl`)

**Writers:** Phase 5 reality sweep, Phase 7 (late learnings only). **Readers:** Phase 0 Learnings Loader (Step 0.1d), Phase 5 reality sweep.

**Row schema:** `{run_id, timestamp, project_type, phase_where_learning_surfaced, metric, top_issue, fix_applied, score_delta, pattern_type: "PITFALL" | "PATTERN" | "HEURISTIC"}`.

Phase 4 implementer dispatch reads `.active-learnings.md` (top 3 relevant filtered at Phase 0) and injects into prompts. This is how learnings from build N flow into build N+1.

### 4.5 Briefing Officer (INTERNAL, callable per Phase 4 task)

**Contract:** reads `refs.json` + task row, writes ~40-line CONTEXT MAP in exact shape below. Refs-not-pastes. `CLAUDE.md` NOT in the map (auto-loaded). Phase 1 scratch NOT in map (SPENT).

```
CONTEXT MAP — [task-id] [task name]
  persona / JTBD     → design-doc.md#persona
  product scope      → design-doc.md#scope
  visual tokens      → visual-design-spec.md#tokens
  component variants → component-manifest.md#[category]
  auth model         → architecture.md#auth
  data schema        → architecture.md#data-model
  sibling task deps  → sprint-tasks.md#[dep-id-1], #[dep-id-2]
  prior decisions    → decisions.jsonl rows [row-id-1], [row-id-2]
  quality targets    → quality-targets.json (full file)
```

---

## 5. Backward Routing Edges

```
PROBLEM FOUND AT                    ROUTES BACK TO
─────────────────────────────────────────────────────────────────
Gate 1 NO                       →   Phase 1 Step 1.0 (Brainstorm Facilitator r1 with feedback)
Gate 2 NO                       →   Phase 2 (with user feedback)
Phase 3.2b (DNA-persona)        →   Phase 3 Step 3.0 (re-lock DNA)
Phase 5 Audit — code issue      →   Phase 4 target task
Phase 5 Audit — design issue    →   Phase 3 target step
Phase 5 Audit — spec issue      →   Phase 2 (re-architect)
Phase 5 Dogfood — classified    →   target_phase per classified-findings.json
Phase 6 LRR BLOCK (⭐⭐)         →   Aggregator reads decisions.jsonl `decided_by` → re-open that phase
Phase 6 LRR NEEDS_WORK (code)   →   Phase 4 target task via `related_decision_id`
Phase 6 LRR NEEDS_WORK (struct) →   Phase 2 or Phase 3 (by finding classification)
```

**⭐⭐ star rule (precise):** Aggregator receives BLOCK → for each blocker finding, reads `related_decision_id` → looks up row in `decisions.jsonl` → reads `decided_by` (free-form role string). Matches string directly against known-agent registry. Unknown values fall through to legacy classification in Step 4.

**Re-entry template (same for all backward edges):**
```
INPUT: {blocking_finding: {...}, prior_output: <path>, decision_row: <row>}
TASK:  Revise prior_output to address blocking_finding ONLY. Do NOT redo unaffected work. Emit new decision_row.
```

Phase 2 re-entry: only the architect whose domain matches `decision_row.author` re-runs. Synthesizer re-runs once. Unaffected architects NOT re-run.

Phase 3 re-entry: only the step named by `decision_row.author` re-runs (DNA lock, component manifest, or visual spec). Unaffected steps NOT re-run.

Phase 4 re-entry: target task only. Reads `prior_output` under `.task-outputs/[task-id].json` + changed files. Revises ONLY what `blocking_finding` requires. Does NOT re-run acceptance tests that passed. Does NOT touch files outside finding blast radius.

**NEEDS_WORK loop cap:** Max 2 cycles. On third NEEDS_WORK → interactive: present all remaining issues, ask direction. Autonomous: log remaining, proceed to Phase 7 with warning in Completion Report.

---

## 6. State Schema (`.build-state.json` top-level)

```jsonc
{
  "project_type": "web" | "ios",
  "ios_features": { /* 16 flags when project_type=ios */ },
  "phase": 0-7,
  "step": "X.Y",
  "input": "$ARGUMENTS",
  "context_level": "full-design" | "decision-brief" | "partial" | "raw-idea",
  "prerequisites": { /* populated at Step 1.5 */ },
  "dispatch_count": 0,           // compaction trigger — reset to 0 after save
  "last_save_phase": "X.Y",
  "autonomous": true | false,
  "session_id": "...",
  "session_started": "ISO-8601",
  "completed_tasks": [ "task-id", ... ],
  "metric_loop_scores": [ /* per loop, per iter */ ],
  "decisions_next_id": { "1": 4, "2": 5, "4": 12 },  // allocator per phase
  "resume_point": {
    "phase": 0-7,
    "step": "X.Y",
    "completed_tasks": [ ... ],
    "git_branch": "..."
  }
}
```

Rendered view: `.build-state.md` (regenerated from JSON on every update — never edit markdown directly).

**Compaction trigger:** at every phase boundary, check `dispatch_count`. If ≥ 8 → save ALL state, reset to 0, regenerate markdown view. TodoWrite does NOT survive compaction; rebuild from JSON on resume.

---

## 7. Pre-Migration Cleanup (do FIRST — these also de-risk the migration)

1. **Extract phase graph to a single structured file** (YAML/JSON). Today it's spread across `build.md`, `phase-branches.md`, `smoke-test.md` with overlap. One canonical file = SDK's future input AND today's source-of-truth.
2. **Lock decisions.jsonl schema + validator agent.** Current format drifts run-to-run because the model writes it. JSON Schema + validator stops drift now, and SDK will emit the same schema later.
3. **Delete dead weight.** Contains-studio agent files (3 already deleted in `git status`), unused protocols, orphaned subagent_type references. Smaller surface = smaller migration. Finish the sweep.
4. **Compress `build.md` prose.** Move verbose examples to sub-files loaded on demand. Reduces today's main-session bloat AND the slimmer prose is easier to port to config.
5. **Normalize agent registry.** One file enumerating every agent + its prompt path + allowed tools. Today these are implicit across markdown files.

---

## 8. Migration Steps (partial hybrid, canary-first)

1. **Design the split line on paper.** One-page doc: which orchestration pieces go to SDK, which stay in Claude Code. Phase-graph schema + IPC protocol defined.
2. **Build minimal SDK orchestrator.** Runs standalone CLI, reads phase-graph YAML, executes ONE phase, writes decisions.jsonl. No slash-command wiring yet.
3. **Pick a canary command.** Start with the simplest (`/buildanything:verify` or `/buildanything:fix`, not `build`). Low blast radius.
4. **Wire IPC bridge** so subprocess can request visible subagent spawns in the main session (preserves colored-spawn UX).
5. **Canary in prod** — real users run the one migrated command, both paths available via feature flag. Measure: tokens, wall time, failure rate.
6. **Migrate `/buildanything:build` phase-by-phase**, not all at once. Phase 1 first, compare against prose version, then phase 2, etc.
7. **Delete migrated prose** as each phase ports over. No dead code left behind.

---

## 9. Sequencing — Plan or Execute?

**Plan architecture upfront, migrate iteratively.** Big-bang orchestration rewrites fail because you can't test the whole pipeline at once. So: full architectural design doc (1-2 days), then canary-first rollout over weeks. Pre-migration cleanup happens before the design doc, because a clean current state clarifies what actually needs to move.

**Order:** cleanup (1-2 weeks) → architecture doc (1-2 days) → canary (1 week) → progressive migration (2-4 weeks).

---

## 10. What Lives Where (Split Line Preview)

| Component | SDK orchestrator (code) | Claude Code main session (prose + Task tool) |
|---|---|---|
| Phase routing / gate evaluation | ✅ | ❌ |
| `decisions.jsonl` writes | ✅ (orchestrator-scribe) | ❌ |
| `.build-state.json` writes | ✅ | ❌ |
| Metric loop control flow (iterate, exit, route fix) | ✅ | ❌ |
| Verify Protocol orchestration | ✅ | ❌ |
| Agent prompts (personas, system prompts) | reused byte-for-byte | reused byte-for-byte |
| Visible subagent spawns (colored profiles) | spawn requests via IPC | ✅ Task tool renders them |
| TeamCreate / SendMessage debate | form-team requests via IPC | ✅ main session hosts debate |
| Skill invocation (user-facing announcement) | N/A | ✅ Skill tool |
| Skill content (prose loaded as context) | ✅ (load same .md as prompt) | ✅ (Skill tool) |
| Hooks (SessionStart, PreToolUse) | N/A | ✅ |
| Memory system (`MEMORY.md`, auto-memory) | reads/writes same folder | ✅ |
| User interrupt handling | receives via IPC | ✅ |
| Claude-mem MCP server | config pointer | ✅ |
| `/loop` skill | equivalent scheduler | ✅ (for user-triggered loops) |

---

## 11. Open Questions (to answer in architecture design doc)

1. **IPC transport** — named pipe, UNIX socket, or HTTP loopback for main ↔ subprocess messaging?
2. **Event rendering** — does the SDK orchestrator stream structured events the main session parses and renders as pseudo-Task spawns, or are subagents always spawned from main via Task tool and the orchestrator only coordinates?
3. **Feature-flag mechanism** — per-command env var? `.build-state.json` field? `~/.claude/buildanything/config.json`?
4. **SDK language** — Python or TypeScript? (Agent SDK supports both. Today's plugin has no strong preference — the plugin itself is loaded declaratively by Claude Code.)
5. **Auth propagation** — does the SDK subprocess inherit the user's Max OAuth token from Claude Code, or re-authenticate?
6. **Schema versioning** — phase-graph.md will evolve. Version field at the top? Migration scripts when the schema breaks?
7. **Parallelism model** — SDK `Promise.all` for parallel agents, but how do those show up in the main session's UI? One pseudo-spawn per parallel branch, or collapsed as a group?

---

*Generated from `commands/build.md` (1092 lines), `protocols/web-phase-branches.md` (308 lines), `protocols/ios-phase-branches.md` (294 lines), `protocols/metric-loop.md`, `protocols/decision-log.md`, `protocols/state-schema.md`, `protocols/launch-readiness.md` on 2026-04-17. If prose files diverge from this doc, this doc wins — prose becomes the liar.*
