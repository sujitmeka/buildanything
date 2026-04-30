# Knowledge Graph Integration — Per-Phase Benefit Analysis

**Date:** 2026-04-26
**Status:** Plan / decision input — no code changes yet
**Question:** Beyond the Product Owner, which agents/phases meaningfully benefit from a per-project knowledge graph? How do we wire it up? Where is the line vs. one-shotting with Opus 4.7 / GPT-5.5?

---

## 1. The benefit bar

A phase only "benefits" from a KG if integrating it produces output the user can feel in the shipped product **that one-shotting with a frontier model cannot match**. Frontier one-shots are very good at:
- Coherent design within one screen
- Standalone code that compiles
- Plausible architecture sketches

They are bad at:
- **Persistent multi-document consistency** (the same persona constraint applied to 14 screens)
- **Provenance-aware revisits** (which decision drove this feature in scope, can we still cut it?)
- **Cross-feature contract enforcement** (wave 2 actually conforms to wave 1's signatures)
- **Audit traceability** (which spec line failed, by which task, in which feature)

The KG only earns its keep where a job requires those four properties. Anything else, file-passing is fine.

## 2. Current state recap

What ships or is designed today (per `docs/graph/02-phase-implications.md`, `agents/product-owner.md`, `docs/plans/2026-04-22-phase4-orchestration-spec.md`):

- `refs.json` — anchor index over all Phase 0–3 docs, generated end of Phase 2. **Shipping.**
- `graph_query_*` MCP interface — specified in the Phase 4 orchestration spec; PO prompts already code against it. **No implementation behind it; PO uses fallback path on every run.**
- `agents/product-owner.md` — graph-first cognitive sequence with markdown fallback.
- `agents/briefing-officer.md` — **NO** graph awareness today. Reads only files. This is a quiet gap from the Phase 4 redesign.
- `docs/graph/` (this dir) — Graphify deep-dive + per-phase implication analysis. Conclusion: Graphify's generic extractors don't fit; we'd need custom deterministic extractors against `protocols/product-spec-schema.md`.
- CLAUDE.md says "graph layer deferred, product-spec + refs.json may suffice" (Apr 21 four-persona debate).

The April 21 debate is now ~5 days old. The question reopens because we've since shipped the product-spec phase, made `refs.json` real, and hit the wall the deferral assumed we wouldn't: implementers still don't carry phase 0-3 context.

## 3. The five facts that drift the most (drives everything below)

Distilled from the phase-by-phase audit:

1. **Persona** — born in `ux-research.md`, restated in design-doc, product-spec, every BO brief, Phase 3 DNA persona check, Phase 3.3b flow validation, Phase 5.1 UX audit. ~6 paraphrases per build.
2. **Visual DNA 7-axis card (Scope/Density/Character/Material/Motion/Type/Copy)** — locked at 3.0, re-extracted by ~12 downstream agents. New home is the `### Brand DNA` h3 inside `DESIGN.md` `## Overview` (was `visual-dna.md`). The CONTEXT header was *added because subagents kept getting it wrong* — same drift problem persists after the file consolidation, just in a new file.
3. **Per-screen states** — `Login: idle/loading/error/locked` born in product-spec, restated in page-specs, restated in component-state-matrix, re-checked Phase 5, re-judged Phase 6.
4. **Component manifest entries (HARD-GATE)** — slot→variant binding policed by prose grep today; both implementer and code-simplifier should enforce it but cleanup agent doesn't actually read the manifest.
5. **Decision provenance with `decided_by` routing** — Phase 6 LRR backward-routes BLOCKs by walking `related_decision_id → decisions.jsonl → decided_by → phase`. Today this works on free-form role strings; it's brittle and the only structurally graph-shaped data we have.

These five drive the per-phase recommendations.

## 4. Per-phase benefit matrix

| Phase | Step | KG benefit | Recommendation |
|---|---|---|---|
| 0 | Resume / Type / Learnings | Read-only consumer of any KG that exists. `learnings.jsonl` cross-build join is the one win. | **Low priority.** Wire only after KG exists for current build. |
| 1.0–1.4 | Brainstorm + research + PRD | Producers of facts that *will* drift. Can write to KG as a side effect of artifact writes. | **Indirect.** Don't change agent behavior; index after Step 1.6. |
| 1.6 | product-spec-writer | THE indexing trigger. Raw research SPENT after this step. | **Index here.** Custom deterministic extractor over schema-conformant product-spec. |
| 2.2a–d | 6-architect debate | Debate outcomes (rejected alternatives, why) lost today. Decision-shaped. | **Medium.** Write architect decisions to KG with `rejected_alternative` edges. |
| 2.3.1 | code-architect blueprint | Producer; modules + contracts are graph-shaped. | **Index.** Module/contract nodes feed cross-feature contract checks at Phase 4. |
| 2.3.2 | planner / sprint-tasks | Task DAG is *literally* a graph today (DAG validator at 2.3.3). | **Index.** Task→file→feature lineage enables Phase 5.4 routing. |
| 3.0 | Brand Guardian / DNA (DESIGN.md Pass 1) | Most-read decision in the build. 7-axis card lives in `DESIGN.md` `## Overview` `### Brand DNA`. | **HIGH.** Single Visual DNA node, 7 axis values, queryable by every downstream consumer. Replace CONTEXT header re-injection. |
| 3.2 | Component manifest | HARD-GATE source. Slot→variant→library binding. | **HIGH.** Manifest entries as graph edges; cleanup agent + implementer query by slot. Enables programmatic HARD-GATE. |
| 3.2b | DNA persona check | Consumer of Persona + DNA nodes. | **Indirect benefit.** Cleaner check via two graph reads vs. paraphrased re-derivation. |
| 3.3 | UX architect + page-specs | Producer. Per-screen states + content hierarchy. | **HIGH.** Page-spec → screen → state graph; lets implementers fetch exact slice. |
| 3.4 | DESIGN.md Pass 2 (tokens) | Producer. Tokens come from the YAML front matter + Colors/Typography/Layout/Elevation/Shapes/Components prose in `DESIGN.md` (no longer a separate `visual-design-spec.md`). DNA-axis provenance preserved. | **Medium-HIGH.** Token nodes with concrete values + axis lineage; eliminates "guess the curve value" in Phase 4. |
| 3.5 | Inclusive visuals | Findings. | Low. |
| 3.6 | Style guide metric loop | Producer of per-iter axis subscores. | **Medium.** Score history per DNA axis lets Phase 6 Brand chapter reuse vs. rescore. |
| 3.7 | A11y review | Producer of findings, same agent rescores in Phase 6. | **Medium.** A11y findings as graph nodes prevents Phase 6 a11y-architect re-running the review. |
| 3.8 | DESIGN.md lint gate | `hooks/design-md-lint.ts` runs structural checks; produces `lint-results.json`. | **Low (graph-side).** Could ingest lint results as Finding nodes, but only in Slice 5+, not Slice 2-3. |
| **4.1** | **Product Owner** | Already designed graph-first. | **Required.** This is the anchor — turn the dead `graph_query_*` calls live. |
| **4.2.a** | **Briefing Officer** | Currently graph-unaware. The single biggest fix. | **Required.** The drift CLAUDE.md complains about lives here. BO must query graph for per-feature spec slice + per-task component bindings, not paste-summarize. |
| **4.2.b.1** | **Implementer** | Today receives only BO paste. Cannot reach product-spec, DESIGN.md, full page-spec. | **HIGH.** Give implementer a *narrow* read-only graph tool: `kg.feature(id)`, `kg.screen(id)`, `kg.token(name)`, `kg.contract(endpoint)`. Don't pollute prompt; let it pull on demand. |
| 4.2.b.3 | code-simplifier / refactor-cleaner | Should enforce manifest HARD-GATE; doesn't read manifest today. | **Medium.** Manifest edge query = enforceable. |
| 4.3 | PO acceptance | Already graph-aware. | Reuses §4.1 wiring. |
| 5.1 | TEAM-of-6 audit | Each auditor independently re-derives quality targets, scope axis, persona. | **Medium.** Shared graph reads eliminate per-auditor re-derivation. |
| 5.4 | Feedback synthesizer | Routes findings by heuristic grep today. | **HIGH.** `file → task → feature → spec_section` lineage routes findings deterministically. |
| 6.0 | Reality checker / Dissent revisit | Walks `decisions.jsonl` for open-revisit rows. | **HIGH.** Decisions are already graph-shaped JSONL; promote to typed nodes with `status: open|triggered|resolved` edges. |
| 6.1 | LRR 5-chapter judges | Eng-Quality builds `requirements_coverage[]` from PRD; Brand re-judges DNA. | **Medium-HIGH.** Coverage check = graph join (requirement→task→evidence). |
| 6.2 | LRR Aggregator backward routing | Free-form `decided_by` strings. Brittle. | **HIGH.** Typed authorship edges → deterministic backward routing. |
| 7.x | Docs / ASO / deploy | Tech-stack + scope-axis lookup. | Low. Refs.json suffices. |

**Summary: 8 HIGH-value integration points** (3.0, 3.2, 3.3, 4.1, 4.2.a, 4.2.b.1, 5.4, 6.0/6.2). The rest are nice-to-have or downstream consumers of the same graph.

## 5. Wiring — how this actually plugs in

### 5.1 Schema — the entities that matter

Custom-extracted (deterministic, not LLM):

```
Persona { id, label, tech_sophistication, primary_jtbd, alternatives_used[] }
Feature { id, name, scope_status: in|out|cut, justification_decision_id }
Screen { id, route, parent_feature_id, hierarchy[] }
State { id, screen_id, name, transitions_to[] }
BusinessRule { id, feature_id, value, source_doc_section }
Token { name, value, layer: token|material|motion|type, axis_provenance: scope|density|character|material|motion|type|copy }
DNAAxis { name: scope|density|character|material|motion|type|copy, value }
ComponentManifestEntry { slot, library, variant, source_ref }
Task { id, size, behavioral_test, dag_predecessors[], owns_files[] }
APIContract { endpoint, request_schema, response_schema, providing_feature_id }
Decision { id, summary, decided_by, rejected_alternatives[], status, related_decision_id, revisit_criterion }
Finding { id, severity, target_phase, target_task_id, evidence_path }
```

Edges: `Feature.requires_component → ComponentManifestEntry`, `Task.implements → Feature.has_screen → Screen.has_state`, `Decision.drove → Feature.scope_status`, `Token.derived_from → DNAAxis`, etc. The five drift offenders from §3 each become first-class node types.

### 5.2 Indexing triggers (when does the graph get written)

| Trigger | What gets written |
|---|---|
| End of Step 1.6 (product-spec done) | Persona, Feature, Screen, State, BusinessRule, scope decisions |
| End of Step 2.3.2 (sprint-tasks) | Task DAG, Task↔Feature, Task.owns_files |
| End of Step 2.3.4 (refs indexer) | Refs anchors → already graph-adjacent |
| End of Step 3.0 (DESIGN.md Pass 1) | DNAAxis ×7, Brand DNA prose, Do's and Don'ts entries |
| End of Step 3.2 | ComponentManifestEntry per slot |
| End of Step 3.3 | Screen.hierarchy + per-screen ASCII slice |
| End of Step 3.4 (DESIGN.md Pass 2) | Token nodes (from YAML front matter) with axis_provenance, component variant nodes (from `## Components` prose), token→axis_provenance edges |
| End of Step 3.8 (lint) | Lint warnings as Finding nodes (Slice 5+ scope, optional) |
| Each `scribe_decision` MCP call (orchestrator-only, all phases) | Decision nodes, edges |
| End of each Phase 4 task verify (deviation rows) | Decision deltas, finding nodes if cleanup happened |
| End of Phase 5 audits | Finding nodes with target_task_id |

Indexing is **deterministic** — schema-aware Python/TS scripts, not LLM extractors. The product-spec already conforms to `protocols/product-spec-schema.md`; we exploit that. This is the lesson from `docs/graph/02-phase-implications.md`.

### 5.3 Query surface (the MCP tool set agents see)

Already specified in the Apr 22 spec. Make these real:
- `graph_query_feature(id) → {states, transitions, business_rules, screens, persona_constraints, acceptance_criteria}`
- `graph_query_dependencies(feature_id) → {provides[], consumes[], dag_predecessors[]}`
- `graph_query_cross_contracts(endpoint) → {provider_feature, consumers[], schema}`
- `graph_query_acceptance(task_id) → {behavioral_test, business_rules_in_scope, persona_constraints}`
- `graph_query_screen(screen_id) → {hierarchy, states, components_used, tokens_used}`
- `graph_query_dna() → {axes[7], scope_budget, provenance, lint_status}` — `lint_status` is the latest result from the Step 3.8 hook. No new tools needed for DESIGN.md ingestion; existing tool set fits.
- `graph_query_manifest(slot) → {library, variant, source}`
- `graph_query_decisions(filter) → Decision[]`

PO and BO get the full set. Implementer gets a **narrow read-only subset** (`feature`, `screen`, `acceptance`, `manifest`, `dna`) — keeps the prompt clean, lets it pull authoritative values when it needs them.

### 5.4 The Briefing Officer rewrite (highest single-step ROI)

Today: BO reads 6 markdown files and pastes summaries into per-task context.
With KG: BO writes per-task brief by:

1. `graph_query_feature(feature_id)` — full structured spec slice
2. For each task in feature: `graph_query_acceptance(task_id)` + `graph_query_screen(screen_ids)` + `graph_query_manifest(slots)` + `graph_query_dna()`
3. Brief becomes a **structured handoff with graph references**, not a paste-summary. Implementer can pull the same data on demand if it needs more context than the brief carries.

Cuts BO context by ~60% (no more pasting page-spec slices). Eliminates the lossy paraphrase that CLAUDE.md identifies as the root problem.

### 5.5 Implementer access pattern

Implementer prompt unchanged in shape. Add a one-line tool affordance:
> "If the brief doesn't carry enough context, query `graph_query_feature(<feature_id>)` or `graph_query_screen(<screen_id>)`. Don't re-read product-spec.md or DESIGN.md — those are SPENT once the graph is built."

Cost: one MCP tool registration, ~30 lines of prompt. Benefit: implementer can resolve token names to values, fetch state lists, check business-rule values without ever reading multi-thousand-line markdown.

## 6. Tool choice

**Revised 2026-04-26** after re-reading `docs/graph/01-graphify-architecture.md`. Initial recommendation (build custom) underweighted Graphify's reusable surface. Corrected:

| Option | Verdict |
|---|---|
| **Fork+extend Graphify (recommended)** | ~60-70% reusable out of box: NetworkX storage, SHA256 portable cache, MCP server, tree-sitter for 25 langs, native vision pipeline for `.png/.jpg/.webp`, `EXTRACTED`/`INFERRED`/`AMBIGUOUS` confidence schema, three-pass parallel-subagent extraction (same pattern our plugin uses), incremental update via mtime + watch mode, exports to JSON/HTML/Neo4j/GraphML/Obsidian. Architecture doc explicitly enumerates the customization points we need (`Customization Needed for Agent Orchestration Pipeline`, line 467). Pin `graphifyy` PyPI + adapter layer beats hard fork. **~4-5 days work.** |
| **Build custom from scratch** | Rebuild storage, cache, MCP scaffold, vision pipeline, exports, incremental indexer — all things Graphify already ships. Only wins on dependency footprint (no Python runtime). **~7 days** with strictly inferior infrastructure. |
| **Graphiti (Zep)** | Designed for LLM extraction over unstructured/conversational input. Our artifacts are structured-by-construction. Temporal-fact win (DNA relock at T+45m) is real but narrow. Park as v2 swap if temporal-decision queries become load-bearing for Phase 6 LRR aggregator. |

**Recommendation: pin `graphifyy` + extend.**

What we add on top of Graphify:
1. Extend `file_type` enum + `validate.py` with our entity types (Feature, Screen, State, BusinessRule, Persona, DNAAxis, ManifestEntry, Task, APIContract, Decision, Finding). ~50 LOC.
2. Schema-aware extractors as a new pass for known-structure markdown (product-spec, page-specs, sprint-tasks, decisions.jsonl). ~300 LOC × 5-6 parsers ≈ **1,500-1,800 LOC**. This is the bulk of the work.
3. Typed MCP tool wrappers producing structured JSON (vs. Graphify's plain-text BFS output) — `graph_query_feature/screen/acceptance/manifest/dna/decisions`. ~400 LOC.
4. Edge schema extension: `produced_by_agent` attribution field. Trivial.
5. Orchestrator hooks to fire indexer at end of Step 1.6, 3.0, 3.2, 3.3, 3.4. Plugin-side, ~100 LOC across `phase-graph.yaml` + command files.

What we delete from Graphify's default behavior for our use:
- Leiden community clustering (we don't need community detection)
- Plain-text BFS query output (replaced by typed JSON)
- Suggested-questions / god-nodes analysis at index time (cheap to re-enable later for debugging)

### Plugin distribution wrinkle

buildanything is TypeScript. Graphify is Python. Adding it requires:
- Python 3.10+ runtime dependency for every plugin user
- `pip install graphifyy` on plugin install (likely already needed for other Python tools)
- MCP server registration in plugin's MCP config
- Vendor option: include Graphify as `vendor/graphify/` to avoid PyPI version skew, but lose upstream auto-improvements

Not a blocker — plugin already shells to kiro-cli, agent-browser, Chrome for Testing, Maestro. iOS users already carry a heavy toolchain. Worth user confirmation before locking in.

## 7. Build order

Sequenced as **slices** — each ships independently and earns the next.

### Slice 1 — Product-spec → graph → Briefing Officer (~2 days)
Highest single-step ROI. Everything else is optional after this proves out.
1. Pin `graphifyy` dep + adapter layer in plugin
2. Extend `validate.py` with Feature/Screen/State/BusinessRule/Persona node types
3. Schema-aware extractor for `product-spec.md` only (against `protocols/product-spec-schema.md`)
4. Three typed MCP tools: `graph_query_feature`, `graph_query_screen`, `graph_query_acceptance`
5. Orchestrator hook at end of Step 1.6
6. Modify `agents/briefing-officer.md` to query these instead of pasting product-spec slices. **Keep file-fallback path intact.**

**Earns Slice 2 if:** measurable Phase 4 token reduction + reduction in BO drift (track via `learnings.jsonl`).

### Slice 2 — DESIGN.md Pass 1 + manifest at Phase 3 (~1 day)
Reads `DESIGN.md` Brand DNA section + 7 axes + `component-manifest.md` (still its own file). Indexer fires after Step 3.0 (Pass 1 complete) and incrementally after Step 3.2 (manifest).
1. DNAAxis + ComponentManifestEntry node types
2. Extractors for `DESIGN.md` Pass 1 (Overview / Brand DNA / Do's and Don'ts) + `component-manifest.md`
3. `graph_query_dna`, `graph_query_manifest` tools
4. Orchestrator hooks at end of Step 3.0 + 3.2
5. PO + BO + cleanup-agent prompts query graph instead of re-reading

### Slice 3 — Page-specs + DESIGN.md Pass 2 tokens (~1 day)
DESIGN.md re-indexed after Step 3.4 (Pass 2 fills YAML front matter + token prose). Page-specs still come from `page-specs/*.md`.
1. Page-spec extractor (per-screen wireframes + states + content hierarchy)
2. Token extractor from `DESIGN.md` Pass 2 (YAML front matter + Colors/Typography/Layout/Elevation/Shapes/Components prose) with axis_provenance edges
3. Implementer narrow tool affordance: `graph_query_screen`, `graph_query_token`
4. Orchestrator hooks at end of Step 3.3 + 3.4

### Slice 4 — Phase 2 + decisions (~1 day)
1. APIContract + Task + Decision node types
2. Extractors for architecture.md modules/contracts, sprint-tasks.md, decisions.jsonl
3. Edge schema gains `produced_by_agent` attribution
4. PO graph queries activated (already coded against interface — just point at real backend)
5. Phase 5.4 feedback synthesizer rewrite for graph-routed findings
6. Phase 6.2 LRR aggregator backward routing via typed authorship edges

**Total: ~5 days focused work** for full coverage. Slice 1 alone (~2 days) delivers the bulk of the user-visible quality lift per CLAUDE.md's stated problem.

## 8. Where this beats one-shotting

Frontier one-shot weaknesses this targets directly:

- **Persona consistency across 14 screens** — KG: one Persona node, queried by every screen renderer. One-shot: drift starts at screen 4.
- **DNA-axis discipline at Phase 4** — KG: `graph_query_dna()` returns 7 typed axis values. One-shot: design vocabulary collapses into "modern, clean, professional" by mid-build.
- **Cross-feature contract enforcement** — KG: wave-2 features query wave-1's actual `APIContract.response_schema`. One-shot: signatures invented per file.
- **Decision-aware revisits in Phase 6** — KG: `Decision.status: open` rows surface automatically with revisit criteria. One-shot: cannot do this at all; the audit doesn't even know which decisions exist.
- **Manifest HARD-GATE** — KG: cleanup agent does a graph join, finds custom code that should have used a manifest entry, reverts. One-shot: cleanup is judgment-call grep.

These are the failure modes the user product visibly suffers from when one-shotting. Each is a place the KG produces concretely better code, not just better internal documents.

## 9. Where to hold the line (don't over-build)

- **Don't index raw research files** (Phase 1.1 outputs). They're SPENT after Step 1.6 by design. Indexing them would re-introduce drift.
- **Don't add an LLM extractor.** Schema is known; deterministic parsing is faster, cheaper, more correct. Graphiti's appeal is for unstructured input we don't have.
- **Don't graph everything.** Tokens and components, yes. Source files and import trees, no — that's what tree-sitter exists for elsewhere.
- **Don't break the fallback path.** Every agent already has "if graph unavailable, read X" wording. Keep it. Graceful degrade is cheap insurance against the inevitable indexer bug.
- **Don't ship before measuring.** CLAUDE.md "Still TODO" already calls for measurement infrastructure. Count backward-routing events (Phase 5.4 + Phase 6.2) before/after KG. If they don't drop, the graph isn't earning.
- **Don't try to graph DESIGN.md before Pass 2 lands.** Pass 1 alone gives DNA axes (Slice 2). Pass 2 gives tokens + components (Slice 3). Indexing twice — once after each pass — is correct, not a bug.

## 10. Open questions for the user

1. **Build now vs. wait.** Apr 21 debate said defer indefinitely. Has enough changed (product-spec real, refs.json shipping, BO redesign exposing the gap) to flip that?
2. **Graphify pin vs. vendor.** PyPI pin gets upstream improvements; vendoring (`vendor/graphify/`) avoids version skew. Pin is cleaner unless we hit upstream bugs.
3. **Python runtime dependency for plugin users.** Graphify needs Python 3.10+. Plugin already requires several heavy tools — is one more acceptable?
4. **Implementer narrow tool — prompt bloat tolerance.** Adding even 30 lines of MCP tool affordance to every Phase 4 dispatch is real context cost. Worth it if implementer pulls auth values right; not worth it if it doesn't.
5. **Briefing Officer rewrite scope.** Is this a `agents/briefing-officer.md` patch (Slice 1 plan), or do we re-debate the BO's role first?
6. **DESIGN.md Pass 1 vs Pass 2 indexing.** The artifact is the same file, written across two phase steps. Index incrementally (Pass 1 fields at 3.0, Pass 2 fields at 3.4) or full re-index after each pass? Vote: incremental — Pass 1 fields are stable after 3.0, Pass 2 should not touch them per the authoring contract.

## 11. Screenshots in the graph

Recommended: **scoped extraction**, not all images. Graphify already ships native vision extraction for `.png/.jpg/.webp/.gif` (line 290 of `01-graphify-architecture.md`) — no new infrastructure needed. The decision is what to extract for which images.

### Three image classes, three extraction levels

| Class | Source | Extract | Why |
|---|---|---|---|
| **Design references** | `docs/plans/design-references/{competitors,inspiration}/*.png` (~30/build) | DNA-axis tags, component presence, palette, perceptual hash, caption | These are the canonical design anchors. Phase 3.6 critic queries by axis ("Density references that scored Dense"). Brand drift compares prod shots against these. |
| **Brand-drift + Phase 5 prod shots** | `evidence/brand-drift/*`, Phase 5.1 Playwright captures (~20-40/build) | Perceptual hash + DNA-axis tags + screen-id link | Enables similarity queries: "current /pricing vs Material=Flat references." Brand Guardian today eyeballs this; graph makes it programmatic. |
| **Dogfood evidence** | Phase 5.3 evidence captures linked to findings (~10-20/build) | Caption + screen-id only | Cheap. Just enough for Phase 5.4 synthesizer to route `screenshot → screen → feature → task`. |

### Skip extraction for

- Per-task verify screenshots in `evidence/[task-name]/` — path-only reference is fine
- Critic-loop interim renders (5 iters × N components) — perceptual hash cache catches these for free, no entity extraction needed

### Cost

≈100-150 images/build × ~1.5K tokens per multimodal subagent dispatch = **~200K tokens/build**. ~5% of post-graph total. Worth it for the four query patterns it unlocks (brand drift, reference retrieval, evidence routing, did-we-ship-the-design). Inside Claude Code the subagent inherits the user's Claude OAuth via the Agent tool — no separate API integration needed; subagent token usage bills the user's Claude credits the same as a direct API call.

### Cache

SHA256 of pixel bytes as cache key. Critic loop regenerates same screenshot 5×; cache hits skip re-extraction. ~30 LOC. Graphify's existing `cache.py` already does SHA256-keyed extraction caching for files — extend it for image content.

### Storage

Add `Screenshot` node type with edges:
- `Screenshot.depicts → Screen`
- `Screenshot.evidences → Finding`
- `Screenshot.references → DNAAxis` (for design references)
- `Screenshot.similar_to → Screenshot` (perceptual-hash matches, INFERRED edge)

Schedule: defer until Slice 5 (post-Slice 1-4 proof of value). The four screenshot-driven queries are real but not the load-bearing problem — the BO→Implementer drift is.
