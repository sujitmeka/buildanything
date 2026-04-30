# Graphify Integration: Phase-by-Phase Implications

> Date: 2026-04-22
> Depends on: `docs/graph/01-graphify-architecture.md` (Graphify deep dive)
> Depends on: `docs/plans/2026-04-22-phase4-orchestration-spec.md` (PO/BO query contract)
> Status: Analysis — no implementation decisions made here

---

## Phase 1 Implications

### Artifacts to Index

Phase 1 produces these artifacts (all under `docs/plans/phase1-scratch/`):

| Artifact | Writer | Format | Graph-Relevant? |
|---|---|---|---|
| `idea-draft.md` | Step 1.0 Brainstorm Facilitator | Freeform markdown | Low — superseded by design-doc |
| `feature-intel.md` | Step 1.1 `feature-intel` agent | Two tables: must-have matrix + stand-out list | **Yes** — competitive differentiators feed persona constraints |
| `tech-feasibility.md` | Step 1.1 `tech-feasibility` agent | Markdown | Low — consumed by architecture |
| `ux-research.md` | Step 1.1 `design-ux-researcher` | Markdown | **Yes** — behavioral patterns, pain points |
| `business-model.md` | Step 1.1 `business-model` agent | Markdown | Low — revenue model, not graph-queryable |
| `findings-digest.md` | Step 1.2 Research Synthesizer | Markdown | Medium — synthesis of above |
| `user-decisions.md` | Step 1.3 Informed Brainstorm | Markdown | Medium — user choices |
| `design-doc.md` (PRD) | Step 1.4 | Structured markdown with anchors | **Yes** — persona, JTBD, scope, features |
| `product-spec.md` | Step 1.6 (TODO) | Highly structured — see schema | **Critical** — the source of truth for Phase 4 |
| `CLAUDE.md` | Step 1.4 | <200 lines, project brain | Low — auto-loaded everywhere, no graph needed |

### When to Index

Two candidate moments:

1. **After Step 1.6 (product-spec.md written):** This is the natural boundary. Per CLAUDE.md: "Phase 1 raw research files are SPENT after the Product Spec step." The product spec is the last consumer of raw research — everything actionable survives in `product-spec.md` and `design-doc.md`. Indexing raw research files after this point adds noise without value.

2. **After Gate 1 (user approval):** Gate 1 happens *before* Step 1.6 (it gates the design-doc, not the product spec). Indexing after Gate 1 but before Step 1.6 would miss the most important artifact.

**Recommendation:** Index after Step 1.6 completes. Index only `product-spec.md` and `design-doc.md` — not the raw research files. Raw research is SPENT; its insights are already distilled into the product spec's Persona Constraints, Business Rules, and Competitive Differentiators sections.

### Entities That Matter

From `product-spec.md` (per `protocols/product-spec-schema.md`):

| Entity Type | Source Section | Example |
|---|---|---|
| **Features** | `## Feature: {Name}` sections | "Checkout", "Dashboard", "Auth" |
| **Screens** | `## Screen Inventory` table | "Login", "Dashboard", "Checkout (3 screens)" |
| **Personas** | `## App Overview` + per-feature `### Persona Constraints` | "time-poor ops manager" |
| **Business Rules** | Per-feature `### Business Rules` | "one discount per order" |
| **States** | Per-feature `### States` | "initial, loading, loaded, empty, error, stale" |
| **Transitions** | Per-feature `### Transitions` table | "initial → loading on page mount" |
| **Acceptance Criteria** | Per-feature `### Acceptance Criteria` | "Verify checkout completes in 3 steps" |
| **Cross-Feature Deps** | `## Cross-Feature Interactions` | "Auth → Checkout: must be authenticated" |
| **Roles** | `## Permissions & Roles` table | "Anonymous", "User", "Admin" |

From `design-doc.md`: persona, JTBD, scope boundary, tech stack decision.

### Does Graphify's Extraction Work?

**No — not out of the box.** Graphify's extraction pipeline has three passes:

1. **AST extraction** (`extract.py`): Only works on code files via tree-sitter. Markdown files are classified as `document` type and routed to LLM extraction. Product-spec.md is not code.

2. **LLM semantic extraction** (Pass 3, via `skill.md`): This is where markdown gets processed. But it extracts *generic* concepts and relationships — "semantically_similar_to", "rationale_for", etc. It does NOT understand our product-spec schema. It would not reliably extract the structured tables (States, Transitions, Permissions) or the per-feature subsection hierarchy.

3. **Node schema mismatch**: Graphify's `file_type` enum is `{code, document, paper, image, rationale}`. Our entities (features, screens, personas, business rules) don't map to any of these. The `validate.py` schema would need extension.

**Gap:** Graphify treats markdown as unstructured documents for LLM extraction. Our product-spec.md is *highly structured* with a known schema. We need **custom extractors** that parse the known section structure deterministically — no LLM needed, just markdown heading/table parsing against the schema defined in `protocols/product-spec-schema.md`.

---

## Phase 2 Implications

### Artifacts to Index

| Artifact | Writer | Format | Graph-Relevant? |
|---|---|---|---|
| `phase-2-contracts/*.md` (6 files) | Step 2.2b (6 parallel architects) | Post-debate position papers | Medium — superseded by architecture.md |
| `architecture.md` | Step 2.3.1 `code-architect` | Highly structured with stable anchors (see `protocols/architecture-schema.md`) | **Critical** — API contracts, data model, component hierarchy |
| `sprint-tasks.md` | Step 2.3.2 `planner` | Task table with IDs, dependencies, sizing, behavioral tests | **Critical** — task graph, dependency edges |
| `quality-targets.json` | Step 2.3.2 | JSON with thresholds | **Yes** — NFR targets per scope |
| `refs.json` | Step 2.3.4 Refs Indexer | Multi-doc anchor index | **No** — this IS an index; don't index the index |

### Entities

From `architecture.md` (per `protocols/architecture-schema.md`):

| Entity Type | Source Section | Example |
|---|---|---|
| **Routes/Pages** | `#frontend/layout` | "/checkout", "/dashboard", "/settings" |
| **Components** | `#frontend/components` | "CartItemCard", "KPIWidget" |
| **State Stores** | `#frontend/state` | "cartStore", "authContext" |
| **Services** | `#backend/services` | "OrderService", "InventoryService" |
| **API Endpoints** | `#backend/api` | "GET /api/orders", "POST /api/checkout" |
| **Data Entities** | `#data-model/entities` | "Order", "User", "Product" |
| **Auth Model** | `#security/auth` | "JWT + refresh token", "role-based" |
| **Infra Targets** | `#infrastructure/deployment` | "Vercel", "AWS", "TestFlight" |

From `sprint-tasks.md`:

| Entity Type | Example |
|---|---|
| **Tasks** | "T5: Build checkout form component" |
| **Task Dependencies** | "T5 depends on T3 (auth)" |
| **Behavioral Tests** | "Verify cart displays items with quantities" |

### Cross-Phase Relationships (Phase 1 → Phase 2)

These are the edges that make the graph valuable:

| Phase 1 Entity | Relation | Phase 2 Entity |
|---|---|---|
| Feature: Checkout | `implemented_by` | API: POST /api/checkout |
| Feature: Checkout | `implemented_by` | Tasks: T5, T6, T7 |
| Feature: Checkout | `has_screen` | Route: /checkout |
| Screen: Dashboard | `uses_component` | Component: KPIWidget |
| Business Rule: "one discount per order" | `enforced_by` | API: POST /api/discounts/validate |
| Persona Constraint: "3 steps max" | `shapes` | Route: /checkout (3-step flow) |
| Cross-Feature Dep: Auth → Checkout | `maps_to` | Task Dep: T5 depends on T3 |

### Does Architecture Structure Map to Graphify?

**Partially.** The architecture doc has stable anchors (`#frontend/layout`, `#backend/api`, etc.) which are machine-parseable. But:

1. **Graphify's LLM extraction** would treat `architecture.md` as a generic document and extract freeform concepts. It would NOT reliably produce nodes typed as "API endpoint" or "data entity" — it would produce generic `document` nodes with `semantically_similar_to` edges.

2. **The anchor structure is a gift.** The architecture schema defines exact subsection anchors (`frontend/layout`, `backend/api`, `data-model/entities`). A custom extractor can parse these deterministically — walk the heading tree, extract entities from each known section type. No LLM needed for structure; LLM only needed for semantic edges between entities.

3. **Sprint-tasks.md** has a table format with task IDs, dependencies, and behavioral tests. This is trivially parseable — regex or markdown table parser. Each task becomes a node; each dependency becomes an edge.

**Gap:** Same as Phase 1 — Graphify's generic extraction won't produce the typed entities we need. Custom extractors required for `architecture.md` (anchor-aware) and `sprint-tasks.md` (table-aware).

---

## Phase 3 Implications

### Artifacts to Index

| Artifact | Writer | Format | Graph-Relevant? |
|---|---|---|---|
| `visual-dna.md` | Step 3.0 `design-brand-guardian` | 6-axis DNA card (Scope, Density, Character, Material, Motion, Type) | **Yes** — design tokens, density axis drives layout |
| `component-manifest.md` | Step 3.2 `design-ui-designer` | Component-to-library-variant mapping | **Critical** — every UI task references this |
| `ux-architecture.md` | Step 3.3 `design-ux-architect` | Flows, navigation, IA | **Yes** — navigation graph, flow sequences |
| `page-specs/*.md` | Step 3.3 `design-ux-architect` | Per-screen: ASCII wireframe + 8 structured sections | **Critical** — spatial blueprint per screen |
| `visual-design-spec.md` | Step 3.4 `design-ui-designer` | Tokens, material, motion, typography, state matrix | **Yes** — design tokens as entities |
| `ux-flow-validation.md` | Step 3.3b `design-ux-researcher` | Validation findings | Low — consumed inline |
| `inclusive-visuals-audit.md` | Step 3.5 | Audit findings | Low |
| `design-references/` | Step 3.1 | Screenshots | Low — visual, not structured |

### Entities

| Entity Type | Source | Example |
|---|---|---|
| **Screens** (enriched) | `page-specs/*.md` | "cart-review" with wireframe, content hierarchy, data loading |
| **Components** (mapped) | `component-manifest.md` | "CartItemCard → StatCard variant from shadcn" |
| **Design Tokens** | `visual-design-spec.md` | "primary-500: #3B82F6", "spacing-4: 16px" |
| **Navigation Patterns** | `ux-architecture.md` | "sidebar → main content", "tab bar → 5 tabs" |
| **Content Sections** | `page-specs/*.md` § Content Hierarchy | "KPI Cards (primary)", "Activity Feed (secondary)" |
| **DNA Axes** | `visual-dna.md` | "Density: Airy", "Character: Professional" |

### Cross-Phase Relationships (Phase 1/2 → Phase 3)

| Earlier Entity | Relation | Phase 3 Entity |
|---|---|---|
| Feature: Dashboard | `has_screen` | Screen: dashboard (page-spec) |
| Screen Inventory row | `detailed_by` | page-specs/dashboard.md |
| API: GET /api/orders | `feeds` | Content Section: "Order List" in page-spec |
| Component: KPIWidget (arch) | `mapped_to` | Component: StatCard variant (manifest) |
| Persona: "scans, doesn't read" | `constrains` | DNA Axis: Density=Airy |
| Business Rule: "3 steps max" | `constrains` | Navigation: checkout 3-step flow |

### Can Graphify Extract Page Specs?

**No — the page-spec format is too structured for generic extraction.** Each page spec has 8 required sections per `protocols/page-spec-schema.md`:

1. Screen Overview
2. ASCII Wireframe (box-drawing characters — not prose)
3. Content Hierarchy (ordered list with component refs, data sources, visual weight)
4. Key Copy (headings, CTAs, empty states, errors)
5. Responsive Behavior
6. Platform Conventions
7. Data Loading (API endpoints, skeleton descriptions, refresh strategy)
8. States (references product-spec feature states)

Graphify's LLM extraction would see these as a generic document and extract freeform concepts. It would NOT:
- Parse the Content Hierarchy into typed entries with component refs and data source links
- Connect Data Loading API references back to `architecture.md#backend/api` endpoints
- Link States references back to `product-spec.md` feature states
- Extract the ASCII wireframe as a spatial structure (nor should it — wireframes are for human/implementer consumption)

**What's needed:** A custom page-spec extractor that walks the 8 known sections, extracts typed entities from each, and creates edges to Phase 1/2 entities by matching refs (API endpoint names, component names, feature names).

---

## Phase 4 Implications (Most Critical)

Phase 4 is where the graph pays for itself. The orchestration spec (`2026-04-22-phase4-orchestration-spec.md`) defines 5 required queries as the graph layer's interface contract.

### Required Queries vs Graphify Capabilities

#### Query 1: `graph_query_feature` — Full Feature Context

**Spec requires:** Given a feature name, return: screens, API endpoints, business rules, persona constraints, acceptance criteria, cross-feature deps, source refs. ~2-3K tokens. Callers: PO, BO.

**Graphify can do:** `query_graph` with BFS from a keyword-matched start node. If a "Checkout" node exists with edges to screen nodes, API nodes, etc., BFS depth=2-3 would traverse them.

**Gap:** Graphify's `query_graph` returns plain text (`NODE ... EDGE ...` format) truncated to a token budget. The PO/BO need *typed, structured* output — they need to know which nodes are screens vs API endpoints vs business rules. Graphify's output format doesn't distinguish node types beyond `file_type ∈ {code, document, paper, image, rationale}`. Our entities (features, screens, APIs, business rules) are all custom types that don't exist in Graphify's schema.

**Verdict: Graphify's traversal engine works; its schema and output format don't.** We'd need: (a) custom node types in the schema, (b) a query wrapper that filters/formats BFS results into the structured output the PO/BO expect.

#### Query 2: `graph_query_feature_screens` — Screen Details

**Spec requires:** Given a feature name, return screen nodes with components, data sources, content hierarchy refs. ~1-2K tokens. Caller: BO.

**Graphify can do:** `get_neighbors` with a relation filter could return screen nodes connected to a feature node. Then `get_neighbors` on each screen node could return components and data sources.

**Gap:** This is a two-hop query (feature → screens → components/data sources) that Graphify can express as BFS depth=2. But the output needs to be structured: screen name, its components (from manifest), its data sources (from page-spec § Data Loading). Graphify returns flat text, not nested structures.

**Verdict: Traversal works; output formatting doesn't.**

#### Query 3: `graph_query_dependencies` — Feature Dependency Graph

**Spec requires:** No input. Return full feature dependency graph + suggested wave ordering. ~300-500 tokens. Caller: PO.

**Graphify can do:** If features are nodes and cross-feature deps are edges, this is a full-graph query filtered to feature-type nodes. Graphify's `graph_stats` gives counts but not filtered subgraphs. `query_graph` could work if you BFS from all feature nodes.

**Gap:** Wave ordering requires topological sort on the dependency graph. Graphify has no topological sort — it has BFS/DFS, shortest path, community detection, and god nodes. NetworkX *does* have `nx.topological_sort()` and `nx.topological_generations()`, but Graphify doesn't expose them through its MCP tools.

**Verdict: Need a custom query that filters to feature nodes, extracts the dependency subgraph, and runs topological sort. Graphify's MCP tools can't do this; direct NetworkX API can.**

#### Query 4: `graph_query_cross_contracts` — Shared Contracts per Wave

**Spec requires:** Given a wave number, return shared API contracts, shared state, shared components between features in this wave and prior waves. ~1-2K tokens. Caller: PO.

**Gap:** This requires: (a) knowing which features are in which wave (from `feature-delegation-plan.json`, which doesn't exist until the PO writes it in Step 4.1), (b) finding intersection of API/state/component nodes between wave features. This is a computed query — not a simple traversal. Graphify has no concept of waves, no set-intersection queries.

**Verdict: Fully custom query. Graphify provides the underlying graph structure; the query logic is ours.**

#### Query 5: `graph_query_acceptance` — Acceptance Criteria

**Spec requires:** Given a feature name, return acceptance criteria + business rules + expected states. ~1-2K tokens. Caller: PO (acceptance mode).

**Graphify can do:** If acceptance criteria, business rules, and states are nodes connected to the feature node, BFS depth=1 with relation filtering would work.

**Gap:** Same as Query 1 — the output needs to be typed and structured, not flat text. The PO needs to distinguish acceptance criteria from business rules from states.

**Verdict: Traversal works; schema and output format don't.**

### Briefing Officer Queries

The BO uses two queries from the same set:
- `graph_query_feature` — full context (same as PO)
- `graph_query_feature_screens` — screen details

Plus it reads `sprint-tasks.md` task rows and `refs.json` directly. The BO's context map (from §4.5 of the phase graph) references specific anchors: `design-doc.md#persona`, `architecture.md#auth`, `sprint-tasks.md#[dep-id]`, etc. These are **ref-based lookups**, not graph traversals.

**Key insight:** The BO's primary need is *ref resolution* (given an anchor, return the content), not *graph traversal* (given a node, find connected nodes). `refs.json` already serves this purpose. The graph adds value for the BO only when it needs to discover *which* refs are relevant to a feature — i.e., the feature → screens → components → refs chain.

### Incremental vs All-at-Once Build

The orchestration spec says: "The graph is built from Phase 0-3 artifacts. It's built once before Phase 4 starts and refreshed if backward routing triggers Phase 2/3 re-dispatch."

**Option A — All-at-once after Phase 3:**
- Simpler. One build pass indexes all artifacts.
- Graphify's pipeline is batch-oriented (detect → extract → build → cluster). This fits.
- Cross-phase edges (feature → API → screen → component) are all resolvable in one pass.
- **Downside:** No graph available during Phases 1-3. Not needed today, but future phases might benefit.

**Option B — Incremental after each phase:**
- Phase 1 complete → index product-spec + design-doc → partial graph.
- Phase 2 complete → add architecture + sprint-tasks → richer graph.
- Phase 3 complete → add page-specs + component-manifest → full graph.
- **Downside:** Graphify has no streaming/incremental update for semantic content. `--update` only re-extracts code files (AST-only). For our custom extractors this doesn't matter — we control the extraction. But Leiden clustering would need to re-run each time (non-deterministic, communities may shift).

**Recommendation:** All-at-once after Phase 3, before Phase 4 starts. This matches the orchestration spec's stated assumption and Graphify's batch model. If backward routing triggers re-dispatch, rebuild the full graph (our artifacts are small — dozens of files, not thousands).

### Backward Routing and Graph Updates

When backward routing triggers Phase 2/3 re-dispatch:

1. An architect re-runs → `architecture.md` changes → some API endpoints, data entities, or component hierarchies change.
2. A design step re-runs → `page-specs/*.md` or `component-manifest.md` changes.

**Graphify's approach:** Full rebuild. The SHA256 cache means unchanged files skip extraction, but the graph is rebuilt from scratch. For our scale (dozens of markdown files, custom extractors, no LLM needed), a full rebuild takes seconds.

**Concern:** Leiden clustering is non-deterministic. Community IDs may shift between rebuilds. If any query depends on community IDs (Graphify's `get_community` tool), results become unstable. Our 5 required queries don't use communities — they use typed traversals. So this is not a blocker, but it means we should NOT expose community-based queries to PO/BO.

---

## Fit Assessment

### What Works Out of the Box

1. **NetworkX as the graph engine.** Our queries are graph traversals — BFS, neighbor lookup, subgraph extraction, topological sort. NetworkX provides all of these. Graphify wraps NetworkX cleanly; we can use the same library directly.

2. **JSON persistence format.** `graph.json` in node-link format is simple, portable, and sufficient for our scale. No need for SQLite or a database.

3. **MCP server pattern.** Graphify's `serve.py` demonstrates how to expose graph queries as MCP tools. The 7 existing tools don't match our 5 required queries, but the *pattern* (load graph at startup, expose typed query tools, return within token budget) is exactly what we need.

4. **SHA256 caching.** If we adopt Graphify's cache pattern, re-builds after backward routing only re-extract changed files. Good for iteration speed.

5. **Clean functional API.** Graphify's modules (`build.py`, `cluster.py`, `analyze.py`) are importable as a library. No framework lock-in.

### What Needs Customization

1. **Custom extractors for every artifact type.** Graphify's AST extraction is for code; its LLM extraction is for unstructured docs. Our artifacts are *structured markdown with known schemas*. We need deterministic extractors for:
   - `product-spec.md` (feature sections, states, transitions, business rules, acceptance criteria)
   - `architecture.md` (anchor-aware: API endpoints, data entities, components, services)
   - `sprint-tasks.md` (task table: IDs, dependencies, sizing, behavioral tests)
   - `page-specs/*.md` (8 structured sections: content hierarchy, data loading, states)
   - `component-manifest.md` (component-to-library mapping)
   - `visual-design-spec.md` (design tokens)

2. **Extended node schema.** Graphify's `file_type` enum (`code, document, paper, image, rationale`) doesn't cover our entity types. We need: `feature`, `screen`, `api_endpoint`, `data_entity`, `component`, `task`, `business_rule`, `acceptance_criterion`, `persona`, `design_token`, `role`. The `validate.py` schema enforcer would need to accept these.

3. **Custom MCP tools.** The 5 required queries (`graph_query_feature`, `graph_query_feature_screens`, `graph_query_dependencies`, `graph_query_cross_contracts`, `graph_query_acceptance`) don't map to any of Graphify's 7 existing tools. We need 5 new MCP tool handlers that:
   - Accept typed inputs (feature name, wave number)
   - Run multi-hop traversals with type filtering
   - Return structured output (not plain text `NODE ... EDGE ...` format)
   - Respect token budgets

4. **Structured output format.** Graphify returns plain text designed for LLM consumption. Our PO/BO agents need structured JSON or typed markdown so they can distinguish screens from APIs from business rules without parsing free text.

5. **Edge relation types.** Graphify's relation types are code-oriented (`calls`, `imports`, `inherits`, `uses`). We need product-oriented relations: `implemented_by`, `has_screen`, `feeds`, `mapped_to`, `constrains`, `enforced_by`, `depends_on` (feature-level), `assigned_to` (task-to-feature).

### What's Fundamentally Missing

1. **No concept of entity types beyond file_type.** Graphify's schema is file-centric (nodes represent code symbols or document concepts). Our graph is entity-centric (nodes represent product concepts: features, screens, APIs). This is a schema-level mismatch, not a bug — Graphify was designed for codebase understanding, not product knowledge graphs.

2. **No computed queries.** `graph_query_cross_contracts` requires set intersection (shared nodes between feature groups). `graph_query_dependencies` requires topological sort. Graphify's MCP tools are simple traversals. These computed queries must be built on top of NetworkX directly.

3. **No temporal dimension.** When backward routing triggers a rebuild, we lose the previous graph state. Graphify's `graph_diff()` can compare two snapshots, but there's no built-in versioning. For our use case this is acceptable — we only need the current state, not history.

4. **No wave/phase awareness.** The graph doesn't know about build phases or feature waves. Wave assignment comes from `feature-delegation-plan.json` (written by PO at Step 4.1). The graph layer needs to read this file to answer `graph_query_cross_contracts`.

5. **No cross-file entity resolution for markdown.** Graphify resolves cross-file references for code (Python imports → class-level edges). For our markdown artifacts, cross-file references are by name ("Feature: Checkout" in product-spec → "POST /api/checkout" in architecture). We need custom resolution logic that matches entity names across documents.

### Build vs Buy vs Fork

| Option | Effort | Risk | Outcome |
|---|---|---|---|
| **Use Graphify as-is** | Low | High — doesn't serve our queries | PO/BO fall back to raw doc reads (~15-20K tokens per dispatch vs ~5K with graph). Functional but expensive. |
| **Fork Graphify** | Medium-High | Medium — maintaining a fork of a 20-module Python package | Get NetworkX + caching + MCP server pattern. But we'd rewrite extractors, schema, query tools, and output format — most of the value-add code. |
| **Build custom on NetworkX** | Medium | Low — we control the full stack | Use NetworkX directly. Write our own extractors (deterministic markdown parsers), schema (typed entities), MCP server (5 query tools), and persistence (JSON). Skip Graphify's code extraction, clustering, visualization, and analysis — we don't need them. |
| **Use Graphify as a library** | Medium-Low | Low — import specific modules | Import `build.py` for graph construction patterns, `serve.py` for MCP server skeleton, `cache.py` for SHA256 caching. Write everything else custom. No fork maintenance. |

**Recommendation: Build custom on NetworkX, borrowing patterns from Graphify.**

Rationale:
- We need ~5 custom extractors, ~5 custom MCP tools, a custom schema, and custom output formatting. That's the majority of the graph layer.
- What Graphify provides that we'd actually use: NetworkX graph construction, JSON persistence, MCP server skeleton, SHA256 caching. These are patterns, not complex code — each is 50-200 lines.
- Forking adds maintenance burden for code we don't need (tree-sitter extraction for 25 languages, Whisper transcription, Leiden clustering, HTML visualization, Obsidian export, Neo4j push).
- Our artifact corpus is small (dozens of files, <100KB total). We don't need Graphify's scale optimizations.

### Estimated Effort

| Component | Effort | Notes |
|---|---|---|
| Schema definition (node types, edge types) | 1 day | Define entity types, relation types, validation rules |
| Extractors (5 artifact types) | 3-4 days | Deterministic markdown parsing against known schemas. product-spec is the most complex (per-feature subsections). |
| Graph builder | 1 day | NetworkX graph construction + cross-file entity resolution |
| MCP server (5 query tools) | 2-3 days | `graph_query_feature`, `_screens`, `_dependencies`, `_cross_contracts`, `_acceptance`. Structured output formatting. |
| Persistence + caching | 0.5 day | JSON node-link format + SHA256 cache (borrow Graphify's pattern) |
| Integration into build pipeline | 1 day | Trigger graph build after Phase 3, before Phase 4. Handle rebuild on backward routing. |
| Testing | 2 days | Unit tests for extractors, integration tests for queries against a sample product build |
| **Total** | **~10-12 days** | |

### Comparison: With Graph vs Without Graph

The orchestration spec notes: "PO and BO can fall back to raw doc reads until graph is available. Token cost is higher without graph (~15-20K per PO dispatch vs ~5K with graph) but functional."

| Metric | Without Graph | With Graph |
|---|---|---|
| PO planning dispatch tokens | ~15-20K (reads full docs) | ~5-8K (graph queries return focused context) |
| BO per-feature dispatch tokens | ~10-15K (reads full docs + page-specs) | ~5-8K (graph queries return relevant slices) |
| Total Phase 4 token overhead (10 features, 3 waves) | ~200-300K extra | baseline |
| Accuracy of context delivery | Medium — PO/BO must parse large docs to find relevant sections | High — graph returns pre-connected, typed entities |
| Backward routing cost | Re-read all docs | Rebuild graph (seconds), re-query |

The graph layer is not blocking — Phase 4 works without it. But it reduces token cost by ~60% and improves context precision. At 10-12 days of effort, it pays for itself after a few builds.
