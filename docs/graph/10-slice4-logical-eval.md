# Slice 4 — Logical Evaluation (Hypothetical Build Walkthrough)

**Date:** 2026-04-26
**Status:** Pre-implementation thought experiment. No code run.
**Scope:** Trace what would happen during a real `/build` now that Slice 4 parsers (`architecture.ts`, `sprint-tasks.ts`, `decisions-jsonl.ts`), `queryDependencies`, `queryCrossContracts`, and `queryDecisions` exist — and surface wiring gaps the schema doc papers over.

Paired with `docs/graph/09-slice4-schema.md` §11. §11 enumerates parser-level failure modes; this file traces a Phase 2→4→6 pipeline run and identifies windows where consumers query data that hasn't been indexed, plus issues found by reading the actual code. Slice 2 + Slice 3 evals are not re-litigated.

---

## 1. Walkthrough — happy path through Phase 2 + Phase 4 + Phase 6

A web marketplace build with three features: Auth, Search, Checkout.

- **T+0 (Step 1.6.idx, `commands/build.md:516`).** `extractProductSpec` runs → `slice-1.json` written. Three feature nodes live.
- **T+5–T+12 (Phase 2, Steps 2.2-2.3).** Architects debate, synthesizer writes `architecture.md`, planner writes `sprint-tasks.md`, scribe MCP appends D-2-01..D-2-04 (`commands/build.md:631`).
- **T+13 (Step 2.3.1.idx — should fire after `code-architect`).** **GAP.** No 2.3.1.idx block exists in `commands/build.md` or `protocols/web-phase-branches.md` (`grep` returns zero). `extractArchitecture` (`src/graph/parser/architecture.ts:353`) is callable, but `bin/graph-index.ts:93-107` only routes `product-spec.md`/`DESIGN.md`/`component-manifest.md` and the `page-specs/` directory. `architecture.md` hits the `else` branch and exits 64. **`slice-4-architecture.json` never produced.** Bug #1a.
- **T+14 (Step 2.3.2.idx — should fire after `planner`).** Same gap. `extractSprintTasks` (`src/graph/parser/sprint-tasks.ts:235`) exists; CLI doesn't route to it. **`slice-4-tasks.json` never produced.** Bug #1b.
- **T+12.5+ (per-`scribeDecision` incremental hook).** §7 specifies a post-write callback in `scribeDecision()`. `grep "slice-4\|graph_query" src/orchestrator/mcp/scribe.ts` returns zero. **`slice-4-decisions.json` never produced incrementally.** Even on resume there's no orchestrator step running `graph-index.js docs/plans/decisions.jsonl` — and the CLI wouldn't route it. Bug #1c.
- **T+95 (Step 4.1 — Product Owner).** `agents/product-owner.md:30` calls `graph_query_dependencies(feature_id)`. Slice 4 fragments are absent; per `loadAllGraphs` (`storage/index.ts:420-477`) the merged graph contains Slice 1-3 nodes only. `queryDependencies` (`storage/index.ts:691-767`) does not early-null because the Slice 1 feature node exists; it returns `{ feature, provides: [], consumes: [], task_dag: [], depends_on_features: [...from Slice 1] }` — partial. PO falls back to file reads of architecture.md + sprint-tasks.md per its existing prompt. Brief assembles; Slice 4 token savings collapse to zero.
- **T+100 (Step 4.2.a — BO).** `agents/briefing-officer.md:31-36` lists six graph tools. **None are Slice 4** — `grep "graph_query_cross_contracts\|graph_query_decisions" agents/briefing-officer.md` returns zero. Schema §6.2 says "BO can query the graph instead of architecture.md," but the prompt doesn't tell it to. Even after Bug #1, BO never gains the "API contracts in scope" or "Open decisions to honor" blocks. Bug #2.
- **T+200 (Step 4.4 — end-of-wave).** Implementers return `deviation_row` objects via `scribe_decision` (`commands/build.md:854`). Without the incremental hook (Bug #1c), the fragment is stale; no re-index runs at end-of-wave either. Bug #1c.
- **T+300 (Step 5.4 — feedback synthesizer).** `agents/product-feedback-synthesizer.md` is a generic 124-line system prompt — `grep "graph_query\|target_phase\|owns_files"` returns zero. Schema §6.3's two-walk routing logic is paper only. Bug #3.
- **T+400 (Step 6.0/6.2 — LRR aggregator).** `src/lrr/aggregator.ts` is fully sync. `applyStarRule` (`:68-82`) emits `star_rule_decision_ids` as raw strings. No `queryDecisions` call, no `routing_targets` field on `AggregateResult` (`:11-18`), no supersedes resolution. Orchestrator still re-reads decisions.jsonl per `commands/build.md:1073`. Schema §6.4's "typed walk" is paper only. Bug #4.

**Consumer-window verdict.** Schema designed five integration points; current code wires zero through to consumers. Parsers are sound; CLI dispatch, indexer triggers, BO prompt, synthesizer prompt, and aggregator code path are gaps. Same shape as Slice 2's first ship.

---

## 2. Walkthrough — re-entry from Phase 6 BLOCK

LRR routes BLOCK back to Phase 2 (auth model needs revisit). Pipeline re-enters at Step 2.2c per `commands/build.md:687`. Architect emits new row D-2-05 with `related_decision_id = "D-2-02"` and `status = "resolved"`. After re-entry, decisions.jsonl is re-parsed (full re-parse on resume per Schema §11.7).

- **Supersedes-vs-relates.** `decisions-jsonl.ts:316-323` checks `r.status === "resolved" && parent.raw.status === "open"|"triggered"`. If D-2-02 is `open`, emit `decision_supersedes`. Correct.
- **D-2-02 already resolved.** Both rows resolved → emit `decision_relates_to`. Correct: a supersedes semantic between two historical decisions misleads walkers looking for the live authority. Aligns with §10 redline 4.
- **D-2-02 open with revisit_criterion just triggered.** Parser sees the on-disk state at parse time. Emits `decision_supersedes` from D-2-05 → D-2-02 immediately. Per §10 redline 4 the orchestrator owns the parent's `open → resolved` transition. **GAP:** scribe is append-only — the status flip must arrive as a follow-up row, not an in-place edit. Until that row lands, `queryDecisions({ status: "open" })` still returns D-2-02 as open. The `superseded_by` field on `DecisionView` (`storage/index.ts:881-888`) does correctly attach when a resolved child points at an open parent — so walkers that check `superseded_by` get the right answer; walkers that filter only on `status` get the wrong one. **Document the precondition:** prefer `superseded_by` over raw status when reasoning about supersession.
- **Cycle handling.** `detectCycles` (`decisions-jsonl.ts:170-209`) walks the single-pointer graph via gray/black DFS but emits a WARNING (`:329-335`) while still returning `ok: true` (`:347`). Schema §11.3 + §8 fixture both expect fail-loud. **Bug #5: schema/implementation drift on cycle severity.** Pick a side. Either way, `queryDecisions` should expose a `corruption_warning: string[]` so consumers see the cycle at runtime — currently the warning is stranded in the parser's return.
- **`decision_drove` edge.** Schema §2 specifies decision → feature | task | api_contract via `ref` anchor. `grep "decision_drove" src/graph/parser/decisions-jsonl.ts` returns zero matches. Parser only emits supersedes/relates_to. Bug #6. After re-entry, a finding can't walk from a decision to its affected module — falls back to grepping `ref` strings. Schema §6.4's typed walk is partial.

---

## 3. Walkthrough — feedback synthesizer routing

Phase 5.4 dogfood found three issues. Idealized routing — actual synthesizer prompt has no graph instructions yet (Bug #3).

- **Issue 1: "Cart timeout too aggressive (30 min)."** Affected file: `src/api/cart.ts` (T-3). Suppose D-2-03 ("Cart timeout: 30 minutes", `revisit_criterion: "If users complain"`) is open. Synthesizer should call `queryDecisions({ status: "open" })`, match by `ref` (`architecture.md#backend/cart`) → resolve via `decision_drove` to module — except `decision_drove` isn't emitted (Bug #6), so `ref` matching collapses to substring match against summaries. Routing: `target_phase = "2"`, `related_decision_id = "D-2-03"`. Correct in principle once Bugs #3+#6 land.
- **Issue 2: "Empty state copy on browse page is generic."** Affected file: `src/pages/browse.tsx` (T-2). No open decisions match. Synthesizer falls back to `task.owns_files` lookup. **GAP:** `queryDependencies.task_dag` (`storage/index.ts:679-686`) does NOT surface `owns_files` — synthesizer must walk `loadAllGraphs(...).nodes` directly. No typed file-to-task query path. Bug #7. Routing: `target_phase = T-2.assigned_phase`, `target_task_id = "T-2"`. Correct shape once Bug #7 lands.
- **Issue 3: "Auth redirect loop on Safari."** Affected file: `src/auth/middleware.ts`. No clear feature attribution, no open decisions. Lookup: T-1's `owns_files` includes `src/auth/*.ts`. Same Bug #7 — synthesizer needs a typed lookup. Routes to T-1's `assigned_phase`.

**Verdict.** Schema's two-step routing (decisions first, tasks fallback) is sound. Three implementation gaps before it changes behavior: synthesizer prompt has no graph instructions (Bug #3), `decision_drove` missing (Bug #6), no typed file-to-task query (Bug #7).

---

## 4. PO wave-grouping with API contracts

Once Bugs #1+#2 land, PO calls `queryDependencies` per feature:

- **Auth:** provides POST /api/auth/signin; no consumers; tasks T-1.
- **Checkout:** provides POST /api/cart, POST /api/orders; consumes GET /api/inventory/{id}; tasks T-3, T-4.
- **Search:** provides GET /api/products, GET /api/inventory/{id}; no consumers; tasks T-2.

PO derives waves from `consumes`:
- Wave 1: Auth (foundational, no upstream contracts).
- Wave 2: Search (provides inventory endpoint Checkout needs).
- Wave 3: Checkout (depends on Auth + Search).

**Verifying queryDependencies returns this data.** `queryDependencies` walks `feature_provides_endpoint` and `feature_consumes_endpoint` edges (`storage/index.ts:713-723`). Per Schema §2 these come from product-spec.md feature `### API Endpoints Provided`/`Consumed` subsections — meaning they're emitted by `extractProductSpec`, not by `extractArchitecture`. Verification needed: does the Slice 1 parser emit these edges? Does the product-spec authoring template require these subsections? If either is missing, `provides`/`consumes` are empty, wave-ordering degrades to topo-by-`depends_on_features` (a Slice 1 edge that does emit). Workable but coarser than the schema implies. Bug #8 candidate; needs verification.

---

## 5. Cross-feature contract drift

Wave 1 ships Auth: implements POST /api/auth/signin returning `{ token, user }` per architecture.md. Wave 3 calls `queryCrossContracts("POST /api/auth/signin")` → returns `request_schema`/`response_schema` verbatim from architecture.md (JSON-string blobs per §10 redline 2).

If Wave 1's actual implementation diverged (returned `{ jwt, userId }`), the graph contains the spec, NOT the code. Wave 3 writes against `{ token, user }`, breaks at runtime.

**Mitigations:**
- Implementers SHOULD return a `deviation_row` on divergence (`commands/build.md:794`). Auth implementer logs D-4-NN; Wave 3 BO calls `queryDecisions({ status: "open", phase: "4" })` and surfaces the deviation. Requires governance + Bug #2.
- Phase 5 audit (testing-api-tester) catches contract drift at audit time.
- Phase 6 SRE chapter reads NFR + perf evidence; not specifically wired for API shape validation.

**What Slice 4 cannot catch.** The graph layer ingests architecture.md, NOT route handler code. A Slice 5+ tree-sitter parse of Express/Hono/Fastify route handlers could emit `actual_api_contract` nodes alongside the spec contracts; a validator joins them and warns on drift. Out of scope for v1.

---

## 6. Decision supersedes resolution

D-2-04 supersedes D-2-01. Both end up `resolved` after Phase 2 churn. Per `decisions-jsonl.ts:316-323`, both resolved → emit `decision_relates_to`. Correct: "supersedes" implies replacement of an active authority; both being historical means neither is active.

If parent is open and child resolves it → `decision_supersedes`, correct (revisit-triggered path).

**Cycles.** D-A relates_to D-B, D-B relates_to D-A. The orchestrator routes decisions sequentially through `scribe_decision`, so true mutual references shouldn't occur — but if they do, the protocol allows "two open decisions both gating each other" semantically (auth model depends on data model and vice versa). `detectCycles` warns rather than fails (Bug #5). Resolution: pick severity (warn vs fail-loud) and align spec with code. If keeping warn, surface the cycle to consumers via a `corruption_warning` field on `queryDecisions` output (Bug #5b) — currently stranded in parser errors[].

---

## 7. Sprint-tasks orphan handling

A task implements a feature not in product-spec.md (e.g. "Implement legacy data migration" added late). `deriveFeatureId` (`sprint-tasks.ts:159-166`) walks the regex table at `:144-157`; on no match returns `null`. Task node emits with `feature_id: null` and **no `task_implements_feature` edge** (`:344` guards). PO's `queryDependencies(feature)` per known feature never iterates the orphan; it's invisible to wave-grouping.

Mitigations:
- Planner prompt at `commands/build.md:610` requires "every feature in the spec must have at least one task" — one-direction. The reverse ("every task must implement a known feature") is not enforced.
- Step 2.3.3 DAG validator (`commands/build.md:612`) checks DAG correctness, not feature coverage. Could be extended; ~10 LOC.
- Schema §4.2 says parser warns on orphan. **Implementation at `sprint-tasks.ts:322` silently sets null with no error/warn entry. Bug #9.**

**Fix:** after `:322`, push `{ line: row.line, message: "WARNING: task <id> has no matched feature" }` into `ctx.errors`. 5 LOC.

---

## 8. Architecture.md re-index after Phase 2 re-run

Phase 2 re-runs (LRR routes back per `commands/build.md:687`); architect revises `phase-2-contracts/<name>.md`; synthesizer re-stitches `architecture.md`. Step 2.3.1.idx fires (once Bug #1 lands) → `slice-4-architecture.json` overwritten atomically (`storage/index.ts:84-110`). Endpoint renames produce new `api_contract__*` IDs (kebab(method-path) per Schema §3); old node dropped wholesale, not orphaned.

**Effects:**
- BO briefs from prior wave shipped to disk reference the old IDs as text blobs — not re-resolved, but they're already done, so stale IDs don't matter for that wave's runtime.
- Future Phase 4 wave queries see new endpoints.
- A `decision_drove` edge (when Bug #6 ships) from `decision__d-2-03` → `api_contract__post-api-orders` becomes dangling after rename. The append-only protocol says: write a new D-2-NN superseding D-2-03 with the new endpoint ref. Full re-parse of decisions.jsonl on resume re-resolves refs; old refs no longer match.

**Verdict.** Wholesale-overwrite is correct. `decision_drove` (when it ships) needs re-resolve on resume — full re-parse handles this for free. Document: re-run Phase 2 → re-index architecture → re-index decisions → cross-fragment edges consistent.

---

## 9. Token budget impact

Slice 4 enables PO + BO + synthesizer + aggregator to skip large file reads — once wiring lands.

- **PO Step 4.1.** `queryDependencies` per feature replaces architecture.md (~8KB) + sprint-tasks.md (~4KB) reads. Three features × ~12KB = ~9000 tokens of file reads → ~450 tokens of JSON. **−8500 tokens.**
- **BO Step 4.2.a.** Per task, `queryCrossContracts` returns ~300 chars vs grepping architecture.md (~1.5KB). Plus per-task `queryDecisions({ phase, status: "open" })` ~200 chars per row. ~30 tasks → **−7300 tokens.**
- **Synthesizer Step 5.4.** One `queryDecisions` + per-finding task lookup vs grep prose. ~10-20 findings → **−3000 tokens.**
- **LRR aggregator.** Typed access vs file re-read. ~500 tokens per BLOCK round.

**Cumulative.** Slice 4 buys ~−10% on top of Slices 1+2+3, concentrated at Phase 4.1 (PO) and Phase 4.2 (BO). Until Bugs #1–#4 land, savings = 0.

---

## 10. Open follow-ups for Slice 5+

- **Vision/screenshots** — Slice 5.
- **Cross-feature contract drift validator** (route handler code vs architecture.md spec) — Slice 5+ via tree-sitter; out of graph scope.
- **Decision auto-status-transition.** Append-only follow-up row "D-2-02 transitioned to resolved" should be written by orchestrator when a child resolves an open parent. Scribe doesn't do this today; flag.
- **Implementer narrow-tool affordance.** Implementer prompts (`agents/engineering-frontend-developer.md`, dispatch template at `protocols/web-phase-branches.md:286-316`) need a Tool Affordances footer listing `graph_query_cross_contracts` (per §6 — implementer can pre-verify contract shape) and `graph_query_token`. Same gap surfaced in Slice 3 eval; Slice 4 widens it.
- **`decision_drove` edge implementation.** Bug #6.
- **Scribe MCP incremental hook.** Bug #1c.
- **Typed file-to-task query.** Bug #7.
- **Sprint-tasks-schema.md.** §10 redline 1 punted; worth doing once column-set is stable.

---

## Bugs surfaced (real, found by reading code, need fixing now)

> **Verification update — 2026-04-26 (post-wiring integrity check).** Re-verified Bugs #1–#4 against current code. Findings:
> - Bug #1 (a) RESOLVED — CLI dispatcher (`bin/graph-index.ts:93-115`) routes all 7 basenames; verified by running each indexer in a temp dir and producing `slice-1.json`, `slice-2-dna.json`, `slice-2-manifest.json`, `slice-3-pages.json`, `slice-3-tokens.json`, `slice-4-architecture.json`, `slice-4-tasks.json`, `slice-4-decisions.json`.
> - Bug #1 (b) RESOLVED — `Step 2.3.1.idx`, `Step 2.3.2.idx`, `Step 2.3.4.idx` blocks present in `commands/build.md:631`, `:641`, `:651`. (They live in `commands/build.md`, NOT `protocols/web-phase-branches.md` — the original grep hit the right answer; the eval misread the result.)
> - Bug #1 (c) Status not re-checked here; orchestrator scribe re-index is still a real gap or a deferred design choice.
> - Bug #2 CONFIRMED — `agents/briefing-officer.md` still lists only Slices 1–3 tools; `grep "graph_query_cross_contracts\|graph_query_decisions" agents/briefing-officer.md` returns zero.
> - Bug #3 RESOLVED — `agents/product-feedback-synthesizer.md:20-21,34,36,43` wires `graph_query_decisions` + `graph_query_dependencies` with full two-walk routing protocol and grep fallback.
> - Bug #4 RESOLVED — `src/lrr/aggregator.ts` has the graph fast path: `routing_source: 'graph' | 'fallback'`, `applyStarRuleWithGraph` semantics via dynamic `loadAllGraphs` + `queryDecisions` calls (`:97-171`), with `routing_warnings` on import/load failure.
> - MCP server registers all 9 expected tools (3 Slice 1 + 2 Slice 2 + 1 Slice 3 + 3 Slice 4); 157/157 graph tests pass; tsc clean.
> - Slice 4 ship-readiness: **YELLOW** — happy path works end-to-end except for Bug #8 (`feature_provides_endpoint`/`feature_consumes_endpoint` never emitted; verified — 0 such edges in produced fragment), which silently degrades PO wave-grouping to topo-by-`depends_on_features`. Bugs #2, #5, #6, #9 are quality-of-life gaps that surface on re-entry / multi-task briefs / supersedes paths.

1. **Slice 4 indexer triggers + CLI dispatch missing (three-pronged).** ~~LIVE~~ MOSTLY RESOLVED (verified 2026-04-26 — see banner above)
   - (a) ~~`bin/graph-index.ts:93-107` switch only routes Slice 1-3 basenames~~ — RESOLVED. CLI now routes all 7 basenames including `architecture.md`, `sprint-tasks.md`, `decisions.jsonl`, plus `page-specs/` directory mode. Empirically verified producing the full fragment set in a temp build dir.
   - (b) ~~No `Step 2.3.1.idx` or `Step 2.3.2.idx` block in `commands/build.md`~~ — RESOLVED. Steps `2.3.1.idx` (architecture), `2.3.2.idx` (sprint-tasks), and `2.3.4.idx` (decisions re-index end-of-Phase 2) all present in `commands/build.md`.
   - (c) `src/orchestrator/mcp/scribe.ts` post-write hook for incremental `slice-4-decisions.json` — still open as a design choice. End-of-phase re-index (Step 2.3.4.idx) handles batch refresh; per-write incremental is not wired. Probably acceptable for v1.

2. **BO has no Slice 4 graph affordances in its prompt.** LIVE
   - `agents/briefing-officer.md:31-36` lists six graph tools, none Slice 4. Re-confirmed 2026-04-26 — `grep "graph_query_cross_contracts\|graph_query_decisions" agents/briefing-officer.md` returns zero.
   - Schema §6.2 requires per-task `queryCrossContracts(endpoint)` + `queryDecisions({ phase: task.assigned_phase, status: "open" })` populating "API contracts in scope" and "Open decisions to honor" brief blocks.
   - **Severity: S2.** Fix in Slice 5 wiring pass. Token savings on Phase 4.2 BO blocked until then.
   - **Fix:** add bullets 7–8 to the tool list at `:31-36`; add a paragraph in §74's "QUERY FEATURE DETAILS"; add the two new brief blocks. ~25 LOC of agent prompt.

3. **Feedback synthesizer prompt is generic — no graph routing.** ~~LIVE~~ RESOLVED (verified 2026-04-26)
   - `agents/product-feedback-synthesizer.md:20-21,34,36,43` now wires `graph_query_decisions` (open-decision-first walk, `target_phase = decision.phase`, `related_decision_id` attachment) and `graph_query_dependencies` (`task_dag` + `owns_files` walk for fallback file→task mapping). Legacy grep retained as `graph_used: false` fallback.

4. **LRR aggregator has no Slice 4 integration.** ~~LIVE~~ RESOLVED (verified 2026-04-26)
   - `src/lrr/aggregator.ts:97-171` has the graph fast-path: dynamic import of `loadAllGraphs`/`queryDecisions`, fragment lookup, `routing_source: 'graph' | 'fallback'`, `routing_warnings` for missing-fragment / import-failure / unknown-decision-id cases. String-only path remains as fallback per design.

5. **`detectCycles` warns instead of fail-loud.** LIVE — confirmed 2026-04-26
   - `decisions-jsonl.ts:329-335` pushes cycles as `WARNING:` entries while returning `ok: true` (`:347`). Schema §11.3 + §8 fixture both expect fail-loud.
   - **Severity: S3.** Cycles are unlikely in practice (orchestrator routes scribe writes sequentially); warning still leaks into `parser.errors[]` which can be inspected. Prefer fixing in Slice 5 with a clear schema decision.
   - **Fix:** either change parser to return `ok: false` on cycles, or change schema to accept warning-with-continue. Pick a side. **5b:** add `corruption_warning: string[]` to `queryDecisions` output so consumers see the cycle at runtime.

6. **`decision_drove` edge specified but not emitted.** LIVE — confirmed 2026-04-26
   - Schema §2 lists decision → feature | task | api_contract via `ref` anchor. `decision_drove` is declared in `src/graph/types.ts:77` but never pushed in `decisions-jsonl.ts` (only `decision_supersedes`/`decision_relates_to`).
   - **Severity: S2.** Synthesizer's "open decision matches finding's affected feature" walk degrades to substring matching `ref` strings — probabilistic but usually correct. Aggregator's `decided_by` lookup (the load-bearing path for backward routing) does NOT depend on `decision_drove`; it walks decision nodes directly. Net effect: routing works, attribution is lossy.
   - **Fix:** add `resolveRef(ref, knownNodes)` parsing `architecture.md#backend/persistence` style anchors; emit edges in pass 2. Cross-fragment resolution required — pass other fragments as second arg or post-process in CLI dispatcher. ~40 LOC. Slice 5.

7. **No typed file-to-task query.** LIVE — confirmed 2026-04-26
   - `queryDependencies.task_dag` (`storage/index.ts:680-687`) returns `{ task_id, title, size, depends_on, behavioral_test, assigned_phase }` only. `owns_files` is on the underlying `TaskNode` but not exposed in the `task_dag` view.
   - Synthesizer prompt currently instructs "Walk the `task_dag` and find the task whose `owns_files` contains the affected file path" (`agents/product-feedback-synthesizer.md:36`) — but the typed view does not surface `owns_files`. Synthesizer must walk raw `graph.nodes` instead, which the prompt doesn't currently spell out.
   - **Severity: S2.** Synthesizer routing for orphan-file findings is broken in spirit even though Bug #3 wired the prompt. Either expose `owns_files` in `task_dag` view, or add `graph_query_task_by_file(filepath)` MCP tool. Slice 5.

8. **`feature_provides_endpoint` / `feature_consumes_endpoint` not emitted.** LIVE — empirically confirmed 2026-04-26
   - `queryDependencies.provides`/`.consumes` walk these edges (`storage/index.ts:714-724`). Empirical test on the marketplace fixture: `slice-1.json` produced has zero `feature_provides_endpoint` edges (verified by walking `graph.edges`). 9 `api_contract` nodes exist; 0 are connected to features. `queryCrossContracts("POST /api/orders")` returns the contract but `provider_feature: null`, `consumer_features: []`.
   - PO wave-grouping by API contract dependency silently degrades to topo-by-`depends_on_features` only. The "Search must ship before Checkout because Checkout consumes Search's GET /api/inventory" reasoning the schema implies cannot run.
   - **Severity: S1.** Highest-impact Slice 4 bug — affects PO Step 4.1 (the primary justification for `queryDependencies`). Recommend immediate fix before Slice 4 ships GREEN.
   - **Fix:** verify whether the product-spec authoring template requires `### API Endpoints Provided` / `Consumed` subsections (likely yes per schema); if so, plumb emission in `extractProductSpec`. If template is missing, plumb both — parser + protocol authoring requirement. ~25 LOC.

9. **Sprint-tasks orphan warning silent.** LIVE — confirmed 2026-04-26
   - `src/graph/parser/sprint-tasks.ts` `deriveFeatureId` returns `null` on no-match (`:165`); the call site sets `featureId: null` with no `ctx.errors` push. Schema §4.2 says "warn — orphan task per §11 scenario 2."
   - **Severity: S3.** Late-added tasks orphan to PO's wave-grouping invisibly. ~5 LOC fix; bundle with Bug #8 in Slice 5.

**Status summary as of 2026-04-26:**

- **RESOLVED (verified):** Bug #1a, #1b, #3, #4 — wiring shipped, integrity check passes.
- **LIVE S1:** Bug #8 — feature/endpoint edges not emitted; the silent killer for PO wave-grouping.
- **LIVE S2:** Bug #2 (BO Slice 4 affordances), Bug #6 (`decision_drove` edge), Bug #7 (no typed file-to-task query).
- **LIVE S3:** Bug #1c (incremental scribe re-index — design choice), Bug #5 (cycle severity drift), Bug #9 (orphan task silent).
- **Recommendation:** Slice 4 ships YELLOW. S1 (#8) should be patched before declaring GREEN. S2/S3 bundle into Slice 5 wiring pass.
