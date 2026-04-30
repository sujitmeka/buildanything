# Slice 4 — Schema + Tool Spec

**Date:** 2026-04-26
**Status:** Draft for redline. No code yet.
**Scope:** `architecture.md` + `sprint-tasks.md` + `decisions.jsonl` → graph → Product Owner + Briefing Officer + Feedback Synthesizer + LRR Aggregator. Slice 4 is the cross-feature contract enforcement + decision-aware revisit slice — it activates the dead `graph_query_*` interfaces the PO and BO already code against, and replaces free-form `decided_by` string matching in the LRR aggregator with typed authorship edges.

Ground truth: `protocols/architecture-schema.md` for module/anchor structure, `protocols/decision-log.md` + `src/orchestrator/mcp/scribe.ts` for the `decisions.jsonl` row shape, and the Sprint Breakdown prompt in `commands/build.md` Step 2.3 for the (informally specified) `sprint-tasks.md` table shape — flagged in §10 as a redline because there is no `protocols/sprint-tasks-schema.md` yet.

Slice 1 + Slice 2 + Slice 3 are untouched; Slice 4 extends `entity_type` and `relation` enums and adds three new extractors + three MCP tools. Edge schema gains `produced_by_agent` attribution that downstream consumers (LRR aggregator, feedback synthesizer) read as a typed field instead of grep'ing prose.

---

## 1. Node types (extends Slice 3's `entity_type` enum)

Slice 4 adds five entity types. Existing Slice 1/2/3 nodes are untouched.

| `entity_type` | Source section in source artifact | One per | Key fields |
|---|---|---|---|
| `architecture_module` | `architecture.md` top-level heading (`# Frontend`, `# Backend`, `# Data Model`, `# Security`, `# Infrastructure`) and any `## Module: {name}` subsection inside them | top-level section + named module subsection | `id`, `label`, `name` (kebab — `frontend`, `backend`, `auth`, `checkout-api`), `description`, `responsibilities` (string[], from prose bullets), `tech_stack` (string[], parsed from `### Tech Stack` subsection if present) |
| `api_contract` | `architecture.md` `### API Contracts` (under `# Backend`) or `## API Endpoints` subsection inside a module | endpoint | `id`, `label`, `endpoint` (e.g. `POST /api/orders`), `module_id` (FK to `architecture_module`), `request_schema` (JSON-string blob, verbatim from prose), `response_schema` (JSON-string blob), `auth_required: boolean`, `error_codes` (string[]) |
| `data_model` | `architecture.md` `# Data Model > ## {Entity}` (or `### {Entity}` under `data-model/entities`) | entity | `id`, `label`, `entity_name`, `module_id` (FK to the architecture_module that owns persistence — typically `backend` or `data-model`), `fields` (string[], `"name:type"` pairs parsed from the entity's field list), `indexes` (string[], from `### Indexes` if present) |
| `task` | `sprint-tasks.md` table row (or per-task `### T-{n}: {title}` heading with sub-fields) | row | `id`, `label`, `task_id` (e.g. `T-1`), `title`, `size: "S" \| "M" \| "L"`, `behavioral_test` (string — UI: "Navigate to X, click Y, verify Z"; API: curl-based assertion), `assigned_phase` (e.g. `"phase-4-frontend"`, `"phase-4-backend"`), `feature_id` (FK to Slice 1 `feature` node — kebab-matched against feature inventory), `screen_ids` (string[], FKs to Slice 1 `screen` nodes), `owns_files` (string[], file paths the task is responsible for — emitted as a node field, NOT as graph edges, since file paths aren't first-class nodes in this graph layer) |
| `decision` | `decisions.jsonl` JSON line (one row per decision per `protocols/decision-log.md`) | row | `id`, `label`, `decision_id` (e.g. `D-2-03`), `summary` (the `decision` field), `chosen_approach`, `rejected_alternatives` (string[] — flattened summaries; structured detail stays in source row), `decided_by` (string — agent role; preserved verbatim per the protocol's no-enum stance), `related_decision_id` (FK or `null`), `revisit_criterion` (string or `null` — concatenated from rejected alternatives' criteria when present), `status: "open" \| "triggered" \| "resolved"`, `phase` (e.g. `"2"`, `"2.2"`), `step_id` (e.g. `"2.3.1"` — derived from phase + the agent that wrote the row when unambiguous; `null` otherwise), `ref` (the `architecture.md#anchor` or `design-doc.md#anchor` string, preserved verbatim) |

All nodes inherit Slice 1's required base fields: `id`, `label`, `source_file`, `source_location`, `confidence`. Slice 4 nodes are all `EXTRACTED` confidence — deterministic parsers, no LLM.

---

## 2. Edge types

Extend Slice 3's `relation` enum. All Slice 4 edges are `EXTRACTED` confidence.

| Relation | From → To | Cardinality | Source |
|---|---|---|---|
| `module_has_contract` | architecture_module → api_contract | 1:N | `### API Contracts` rows under a module section |
| `module_has_data_model` | architecture_module → data_model | 1:N | `## {Entity}` headings under `# Data Model`, attributed to the owning module by anchor proximity |
| `task_implements_feature` | task → feature | N:1 | sprint-tasks.md row's "Feature" column or kebab-match on the task title against Slice 1 feature names |
| `task_touches_screen` | task → screen | N:N | sprint-tasks.md row's "Screen" column (multi-screen tasks fan out — one edge per screen) |
| `task_depends_on` | task → task | N:N (DAG) | sprint-tasks.md row's "Dependencies" column. DAG validator at Step 2.3.3 already enforces acyclicity at the source; Slice 4 parser re-checks per §9 |
| `feature_provides_endpoint` | feature → api_contract | N:N | product-spec feature's `### API Endpoints Provided` subsection (when present) — kebab-matched against `api_contract.endpoint` |
| `feature_consumes_endpoint` | feature → api_contract | N:N | product-spec feature's `### API Endpoints Consumed` subsection (when present) |
| `decision_supersedes` | decision → decision | N:1 | when current decision's `related_decision_id` is set AND the parent decision's `status` transitions to `"resolved"` (per §10 redline 4 vote) |
| `decision_relates_to` | decision → decision | N:1 | when `related_decision_id` is set but the parent is NOT yet `resolved` — soft pointer for findings to walk without implying replacement |
| `decision_drove` | decision → feature \| task \| api_contract | N:1 | resolved from the decision row's `ref` field (e.g. `architecture.md#backend/persistence` → owning module → `data_model` or `api_contract` node; `design-doc.md#feature-checkout` → `feature__checkout`) |

**Edge schema additions activated in Slice 4 (forward-compat field shipped in Slice 1):**

| Field | Required | Notes |
|---|---|---|
| `produced_by_agent` | optional | Slice 4 finally consumes this. For architecture nodes: `"code-architect"`. For task nodes: the planner role string from Step 2.3.2 (currently `"planner"`). For decision nodes: the `decided_by` value from the source row, preserved verbatim. The LRR aggregator and feedback synthesizer read this field as the deterministic substitute for free-form string parsing. |
| `produced_at_step` | optional | `"2.3.1"` for architecture-derived edges, `"2.3.2"` for task edges, `"<phase>"` for decision edges (the `phase` field of the source row). |

---

## 3. ID generation rules

Stable across re-runs. Same architecture.md + same sprint-tasks.md + same decisions.jsonl → identical IDs → SHA256 cache hits. Same `kebab` and `sha256_8` helpers as Slice 1/2/3 in `src/graph/ids.ts`. Same `normalizeForHash` rule (whitespace collapse, trim) before hashing.

- **architecture_module**: `module__{kebab(name)}` → `module__frontend`, `module__backend`, `module__auth`, `module__checkout-api`. Top-level sections produce IDs from the heading text (lowercased, hyphenated). Named module subsections (`## Module: Auth`) produce `module__auth`.
- **api_contract**: `api_contract__{kebab(method-path)}` → `api_contract__post-api-orders`, `api_contract__get-api-users-id`. Method comes first; path segments hyphenated; path params (`:id`, `{id}`) preserved as `id` segments.
- **data_model**: `data_model__{kebab(entity_name)}` → `data_model__order`, `data_model__order-line-item`. Singular by convention; if the source uses plural (`Orders`), the parser preserves source casing through `kebab` (`orders`), and downstream queries match either.
- **task**: `task__{lowercase(task_id)}` → `task__t-1`, `task__t-12`. Task IDs are preserved in lowercase form; the `task_id` field on the node retains the original casing for round-trip display.
- **decision**: `decision__{lowercase(decision_id)}` → `decision__d-2-03`, `decision__d-n1-01` (negative phases per scribe.ts encoding rule — phase `-1` becomes `N1` in the ID slot).

No content-hashing in Slice 4 — every source row already has a stable explicit ID (task_id, decision_id, endpoint, entity name, module heading). This is by design: Slice 4 IDs must be predictable so the LRR aggregator can construct them from a `related_decision_id` string without a graph walk.

---

## 4. Extractor mapping

Three new extractors under `src/graph/parser/`. Pure functions, dict in / dicts out, no I/O beyond the file read. Same fail-loud contract as Slice 1/2/3: malformed source → no partial graph fragment.

### 4.1 `src/graph/parser/architecture.ts`

Heading-driven walker over `docs/plans/architecture.md`. Uses the anchor convention from `protocols/architecture-schema.md` (kebab-cased, `parent/child` nesting) — anchors are stable so node IDs derived from them are stable too.

```ts
export function extractArchitecture(mdPath: string): ExtractResult {
  // Walks top-level # headings: Frontend, Backend, Data Model, Security, Infrastructure
  // For each, emits architecture_module node
  // Within Backend: scans for `### API Contracts` table or `## {Module} > ### API Endpoints`
  //   → emits api_contract nodes + module_has_contract edges
  // Within Data Model: scans `## {Entity}` subsections → emits data_model nodes
  //   + module_has_data_model edges (attribution: data-model module by default,
  //   reattributed to a sibling module if the entity heading explicitly says
  //   `(owned by {module})`)
  // Returns { ok, fragment } or { ok: false, errors }
}
```

**Failure modes** (each a hard-fail, fragment NOT written):
- File not found → `ExtractError { line: 0, message: "architecture.md missing at docs/plans/architecture.md" }`
- Required top-level heading missing per `protocols/architecture-schema.md` (Frontend/Backend/Data Model/Security/Infrastructure for web; iOS variant relaxes Backend) → fail loud with the missing heading name
- Required subsection anchor missing (e.g. `frontend/layout`, `security/auth`) — these are validated upstream by `buildanything:verify`, but the parser re-checks and fails loud if the upstream check was skipped
- Duplicate module name → fail loud (anchor convention forbids it)

**Warnings** (non-fatal, logged to `build-log.md`):
- API contract row with no parseable method+path (e.g. only "POST /orders endpoint") → emit node with `endpoint` set to the raw text, warn
- Data model entity with no field list → emit node with `fields: []`, warn
- Anchor doesn't match `parent/child` rule → warn but accept

### 4.2 `src/graph/parser/sprint-tasks.ts`

Markdown table walker over `docs/plans/sprint-tasks.md`. The schema is informally specified (per §10 redline 1: there is no `protocols/sprint-tasks-schema.md`) — the parser pins the column set against the planner prompt in `commands/build.md` Step 2.3. Required columns: `ID`, `Title`, `Size`, `Dependencies`, `Behavioral Test`. Optional: `Owns Files`, `Implementing Phase`, `Feature`, `Screen`.

```ts
export function extractSprintTasks(mdPath: string): ExtractResult {
  // Walks the markdown table(s). Header row determines column mapping.
  // For each row:
  //   - Emit task node with task_id, title, size, behavioral_test
  //   - Parse Dependencies column → task_depends_on edges (kebab task IDs)
  //   - Parse Feature column (if present) → task_implements_feature edge
  //     (else infer via title kebab-match against Slice 1 feature names)
  //   - Parse Screen column (if present, comma-separated) → task_touches_screen edges
  //   - Parse Owns Files column → task.owns_files string array
  //   - Parse Implementing Phase column → task.assigned_phase
  // Round-trip check: re-run DAG cycle detection on task_depends_on edges.
  // Returns { ok, fragment } or { ok: false, errors }
}
```

**Failure modes:**
- File not found → fail loud
- No table found → fail loud (per the planner prompt, sprint-tasks.md must be tabular)
- Missing required column (`ID`, `Title`, `Size`, `Dependencies`, `Behavioral Test`) → fail loud, name the missing column
- Anonymous task (empty `ID` cell) → fail loud per §10 redline 5
- Duplicate `task_id` → fail loud (DAG implies uniqueness)
- Cycle detected in `task_depends_on` → fail loud per §10 redline 3 (Step 2.3.3 should already have caught this, but Slice 4 fails-loud as a backstop)

**Warnings:**
- `Behavioral Test` cell empty for a UI-tagged task → warn (per planner prompt, behavioral test is required for UI tasks; advisory at parse time, the verify protocol enforces it)
- Feature column references an unknown feature ID (no Slice 1 match) → emit task node with `feature_id: null`, warn — orphan task per §11 scenario 2
- Size value not in `S | M | L` → warn, preserve raw value

### 4.3 `src/graph/parser/decisions-jsonl.ts`

JSON-Lines parser over `docs/plans/decisions.jsonl`. Each line is one `DecisionRow` (shape pinned in `src/orchestrator/mcp/scribe.ts`). The parser re-validates against the same constraints (max 3 rejected alternatives, max 5 rows per phase, ref pattern) as a defense-in-depth check.

```ts
export function extractDecisionsJsonl(jsonlPath: string): ExtractResult {
  // Reads file line-by-line, parses each line as JSON.
  // For each row:
  //   - Emit decision node with all scalar fields (decision_id, summary, etc.)
  //   - When related_decision_id is set:
  //       * If parent decision's status === "resolved" → emit decision_supersedes edge
  //       * Else → emit decision_relates_to edge
  //   - Resolve ref field (e.g. "architecture.md#backend/persistence") → owning
  //     architecture_module / data_model / api_contract via anchor lookup → emit
  //     decision_drove edge. If ref points to design-doc.md#feature-X →
  //     decision_drove edge to feature__X. Unresolvable refs warn.
  //   - decided_by preserved verbatim into produced_by_agent on outgoing edges
  //     and into the node itself (no enum validation per protocol).
  // Two-pass: first emit all decision nodes, then resolve relations
  //   (avoids forward-reference issues when decisions reference each other).
  // Returns { ok, fragment } or { ok: false, errors }
}
```

**Failure modes:**
- File not found → return `{ ok: true, fragment: empty }` (decisions.jsonl absent simply means no decisions written yet — first-build state, NOT a failure)
- File present but malformed JSON line → fail loud, name the offending line number per §10 redline 6 (treat malformed JSONL as a hard fail because scribe_decision is the sole writer and produces well-formed lines)
- `decision_id` collision (same ID appearing twice) → fail loud (scribe.ts allocates monotonically; collision means file was hand-edited)
- Cycle in `decision_supersedes` chain → fail loud per §11 scenario 3

**Warnings:**
- `ref` field cannot be resolved against any Slice 1/2/3/4 node → emit decision node without `decision_drove` edge, warn — orphan decision (forward references to features not yet shipped are tolerated per §10 redline 6)
- `revisit_criterion` empty on a decision with `status: "open"` and rejected alternatives present → warn (the protocol requires criteria on rejected alternatives, but doesn't require concatenation up to the row level)
- Decision row's `phase` doesn't match a known build phase (`-1`, `0`, `1`, `1.6`, `2`, `2.2`, `3`, `3.0`, `3.4`, `4`, `4.1`, `4.2`, `5`, `5.1`, `5.4`, `6`, `6.0`, `6.1`, `6.2`, `7`) → warn but preserve

CLI dispatch: extend `bin/graph-index.ts` to recognize the three new basenames (`architecture.md`, `sprint-tasks.md`, `decisions.jsonl`) and route to the matching parser. Same per-file dispatch pattern as Slice 1/2/3.

---

## 5. MCP tool specs

Three new tools for Slice 4. JSON in/out, same convention as Slice 1/2/3's `graph_query_*` family. The PO and BO already code against these interfaces (per `agents/product-owner.md` lines 30, 34, 88) — Slice 4 makes them real instead of falling back to file reads on every call.

### `graph_query_dependencies`

The PO's wave-grouping primary call. Single query returns everything needed to assemble the feature dependency map.

```json
{
  "name": "graph_query_dependencies",
  "input": { "feature_id": "feature__checkout" },
  "output": {
    "feature": { "id": "feature__checkout", "label": "Checkout" },
    "provides": [
      { "id": "api_contract__post-api-orders", "endpoint": "POST /api/orders", "auth_required": true }
    ],
    "consumes": [
      { "id": "api_contract__get-api-inventory-id", "endpoint": "GET /api/inventory/:id", "auth_required": false }
    ],
    "depended_on_by_features": [
      { "id": "feature__order-history", "label": "Order History" }
    ],
    "depends_on_features": [
      { "id": "feature__auth", "label": "Auth" },
      { "id": "feature__inventory", "label": "Inventory" }
    ],
    "task_dag": [
      { "id": "task__t-3", "task_id": "T-3", "title": "Wire checkout form to /api/orders", "size": "M", "depends_on": ["task__t-1", "task__t-2"], "behavioral_test": "Navigate to /cart/review, click Place Order, verify /orders/:id renders", "assigned_phase": "phase-4-frontend" }
    ]
  }
}
```

`task_dag` is the per-feature task slice — one entry per task with `task_implements_feature` to this feature, sorted topologically by `task_depends_on`. The PO uses this for wave grouping: a feature's tasks become a wave when all `depends_on_features` are already shipped.

Returns `null` for a feature_id with no graph entry (Phase 1.6 hasn't run, or the feature was never in product-spec). Consumer falls back to file read per existing PO prompt.

### `graph_query_cross_contracts`

The Phase 4 implementer's pre-write contract verification call. Given an endpoint, returns the providing feature and all consumers — so a wave-2 implementer can confirm wave-1 actually shipped the agreed-upon shape.

```json
{
  "name": "graph_query_cross_contracts",
  "input": { "endpoint": "POST /api/orders" },
  "output": {
    "contract": {
      "id": "api_contract__post-api-orders",
      "endpoint": "POST /api/orders",
      "request_schema": "{ items: { id: string, qty: number }[], shippingAddress: Address }",
      "response_schema": "{ orderId: string, total: number, status: 'pending' }",
      "auth_required": true,
      "error_codes": ["400 — invalid items", "401 — unauthenticated", "409 — out of stock"]
    },
    "providing_feature": { "id": "feature__checkout", "label": "Checkout" },
    "consumers": [
      { "id": "feature__order-history", "label": "Order History" },
      { "id": "feature__admin-dashboard", "label": "Admin Dashboard" }
    ]
  }
}
```

`request_schema` and `response_schema` are JSON-string blobs verbatim from architecture.md — Slice 4 does not parse them into typed sub-nodes (per §10 redline 2). Consumers parse on demand.

### `graph_query_decisions`

The LRR aggregator's backward-routing call and the feedback synthesizer's open-decision lookup. Filterable by `status`, `phase`, `decided_by` — returns matching decisions with their relations resolved inline.

```json
{
  "name": "graph_query_decisions",
  "input": { "status": "open", "phase": "2" },
  "output": {
    "decisions": [
      {
        "id": "decision__d-2-03",
        "decision_id": "D-2-03",
        "summary": "chose SQLite over Postgres for initial persistence",
        "chosen_approach": "SQLite with single-file .db in project root, migrations via drizzle-kit",
        "decided_by": "architect",
        "phase": "2.2",
        "step_id": "2.3.1",
        "status": "open",
        "ref": "architecture.md#backend/persistence",
        "revisit_criterion": "multi-user access OR >10k rows OR concurrent writes",
        "rejected_alternatives": ["Postgres via Supabase", "JSON file on disk"],
        "drove": [
          { "id": "data_model__order", "label": "Order", "entity_type": "data_model" }
        ],
        "supersedes": null,
        "superseded_by": null,
        "relates_to": []
      }
    ]
  }
}
```

Filter inputs are AND-combined. All three are optional — empty input returns every decision. The LRR aggregator's star rule (`src/lrr/aggregator.ts` `applyStarRule`) currently constructs `star_rule_decision_ids` from finding strings; Slice 4 lets the aggregator instead resolve each `related_decision_id` to a node and read its `decided_by` and `phase` fields directly.

---

## 6. Consumer integration

### 6.1 Product Owner

`agents/product-owner.md` already calls `graph_query_dependencies`, `graph_query_cross_contracts`, and `graph_query_acceptance` (Slice 1) — the file-read fallback path runs on every build today because the tools resolve to `null`. Slice 4 makes them real:

- Step 1 ("Enumerate features"): `graph_query_dependencies(feature_id)` for each feature → returns the dependency closure in one call.
- Step 3 ("Extract cross-feature contracts"): `graph_query_cross_contracts(endpoint)` per shared endpoint → returns provider + consumers + schema.
- Wave grouping: union the `task_dag` from each feature; topo-sort by `task_depends_on`; group by `assigned_phase`.

The fallback path stays intact — every PO step keeps "If graph unavailable, read X" wording per the existing prompt.

### 6.2 Briefing Officer

`agents/briefing-officer.md` per-task brief assembly currently reads architecture.md and sprint-tasks.md as files. Slice 4 lets the BO query the graph instead:

- Per task: `graph_query_cross_contracts(endpoint)` for each endpoint the task touches → populate the brief's new `API contracts in scope` block with `request_schema`, `response_schema`, `auth_required`, `error_codes` verbatim. No paraphrase.
- Per task: `graph_query_decisions({ phase: task.assigned_phase, status: "open" })` → surface decisions still open in the implementer's phase that constrain the task. Brief gains a `Open decisions to honor` block.
- The BO no longer needs to re-derive the task's feature back-pointer; it comes from `task_implements_feature`.

Cost: ~15 lines added to the brief assembly logic in `agents/briefing-officer.md`. Eliminates the BO's last file-read of architecture.md.

### 6.3 Feedback Synthesizer (Phase 5.4)

`agents/product-feedback-synthesizer.md` currently uses grep heuristics to find which task owns a file — fragile and frequently routes findings to the wrong task. Slice 4 rewrites the routing heuristic:

- For each finding with an evidence file path: walk `task.owns_files` → match the file path → resolve `task_implements_feature` → set `target_task_id` and (via `task.assigned_phase`) `target_phase`.
- For each finding tagged with a decision violation: `graph_query_decisions({ status: "open" })` → match by `ref` field or by feature → set `target_phase` to the decision's authoring phase, attach `related_decision_id`.
- The synthesizer no longer grep's prose for `decided_by`; it reads the typed `produced_by_agent` field on the decision node.

Brief change to the agent's prompt — replace the heuristic-grep section with the two graph-walk steps above.

### 6.4 LRR Aggregator (Phase 6.2)

`src/lrr/aggregator.ts` `applyStarRule` currently extracts `related_decision_id` strings from chapter findings and emits them as `star_rule_decision_ids`. The orchestrator then re-reads `decisions.jsonl` to figure out where to route. Slice 4 turns the round-trip into a typed walk:

- After `applyStarRule` produces the decision IDs, the aggregator calls `graph_query_decisions({ ... })` filtered to those IDs.
- For each returned node, read `decided_by` (preserved verbatim per protocol — no enum validation needed) and `phase` directly. Use `decision_supersedes` edges to resolve replacement chains: if `D-2-03` is `resolved` and superseded by `D-2-04`, route to `D-2-04`'s phase, not `D-2-03`'s.
- The free-form `decided_by` string parsing in the aggregator's existing legacy classification path is preserved as fallback (graph unavailable → string parsing path runs as today).

Code change: `src/lrr/aggregator.ts` gains an async wrapper that queries the graph after `applyStarRule`, attaches a resolved `routing_targets` field to the result, and degrades to string parsing on null. Aggregator's existing rules (1-6) are untouched.

---

## 7. Indexer triggers

Three new triggers in `commands/build.md`. All follow the Slice 1/2/3 best-effort pattern: log to `docs/plans/build-log.md` on failure, do NOT block.

### Step 2.3.1.idx — Architecture index

After `code-architect` writes `docs/plans/architecture.md`:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/architecture.md`
- The CLI dispatches to `parser/architecture.ts`.
- On exit 0: log success to `build-log.md`, write `slice-4-architecture.json`, continue.
- On non-zero exit: log warning (`graph-index architecture.md failed — continuing with file-read fallback`) and continue.

### Step 2.3.2.idx — Sprint tasks index

After `planner` writes `docs/plans/sprint-tasks.md` AND the Step 2.3.3 DAG validator returns PASS:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/sprint-tasks.md`
- Dispatches to `parser/sprint-tasks.ts`.
- Writes `slice-4-tasks.json`.
- Failure handling identical to above.

### Each `scribe_decision` MCP call → incremental decisions index

The scribe in `src/orchestrator/mcp/scribe.ts` is the sole writer of `decisions.jsonl`. Per §10 redline 1 (vote: incremental), Slice 4 hooks the scribe to append the new row to `slice-4-decisions.json` immediately after the JSONL append — no re-parse of the whole file.

- Implementation: a post-write callback in `scribeDecision()` that constructs the `decision` node and emits any `decision_supersedes` / `decision_relates_to` / `decision_drove` edges, then merges into the existing `slice-4-decisions.json` fragment file.
- On callback failure: log warning, do NOT fail the scribe call — graph is best-effort, the JSONL is the source of truth.
- Full re-parse remains available via `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/decisions.jsonl` (run on resume after Phase 0 to backfill the fragment if it's stale).

CLI dispatch: extend `bin/graph-index.ts` to recognize `architecture.md`, `sprint-tasks.md`, and `decisions.jsonl` basenames, alongside the Slice 1/2/3 dispatchers.

---

## 8. Validation checklist (before merging to main)

- [ ] Schema-validation tests for each new node type (`architecture_module`, `api_contract`, `data_model`, `task`, `decision`) — valid + invalid fixtures
- [ ] Round-trip determinism test: extractor on a fabricated architecture.md → byte-identical fragment on second run
- [ ] Idempotent indexing: `graph-index.js docs/plans/decisions.jsonl` twice (full re-parse) produces the same fragment as the incremental hook produces
- [ ] Decision DAG cycle detection: fixture with `D-2-03 → D-2-04 → D-2-03` (mutual `related_decision_id`) → fail loud at parse time per §11 scenario 3
- [ ] Task DAG cycle detection: fixture with `T-1 → T-2 → T-1` → fail loud (Step 2.3.3 already validates, Slice 4 backstops)
- [ ] Cross-fragment edge integrity: Slice 1 features ↔ Slice 4 tasks. Insert a task whose `feature_id` matches a known Slice 1 feature; query `graph_query_dependencies(feature)` → returns the task in `task_dag`
- [ ] Slice 1/2/3 nodes untouched after Slice 4 indexes (no clobbering, no edge contamination)
- [ ] Architecture.md anchor stability: re-running the synthesizer produces the same anchors → same `module__*` and `data_model__*` IDs
- [ ] Decision `produced_by_agent` preservation: a decision with `decided_by: "human"` round-trips with `produced_by_agent: "human"` on its outgoing edges
- [ ] Empty `decisions.jsonl` (file absent or empty) → `slice-4-decisions.json` exists with empty `nodes: []`, `edges: []`; `graph_query_decisions({})` returns `{ decisions: [] }`

---

## 9. Out of scope for Slice 4 (called out so we don't drift)

- Screenshots / vision pipeline → Slice 5
- Per-task verify deviation rows as Finding nodes → Slice 5+
- Phase 5 audit findings as graph nodes → Slice 5
- LLM-extracted cross-references (e.g. "this prose mentions auth → link to module__auth") → out of scope for v1; deterministic anchor-resolution only
- iOS-specific architecture variants — same parser handles iOS-adjusted heading set per `protocols/architecture-schema.md`; no separate parser
- Sprint-tasks-schema.md — Slice 4 ships a parser against the informally specified shape; formalizing the protocol is a separate document task per §10 redline 1

---

## 10. Open redlines for the user

1. **Sprint-tasks.md schema is informally specified.** No `protocols/sprint-tasks-schema.md` exists; the column set is pinned only in the Step 2.3.2 planner prompt. Slice 4 parser hard-codes the column expectations (`ID`, `Title`, `Size`, `Dependencies`, `Behavioral Test` required; `Owns Files`, `Implementing Phase`, `Feature`, `Screen` optional) — this is a brittle dependency. Vote: **ship Slice 4 against the informal shape now; open a follow-up to write `protocols/sprint-tasks-schema.md` and align the planner prompt + parser against it once the format stabilizes after a few real builds.** Don't gate Slice 4 on protocol authorship.

2. **API contract `request_schema` / `response_schema` storage.** Store as JSON-string blob (verbatim from architecture.md prose) or extract typed sub-nodes (per-field, per-type)? Vote: **JSON-string blob for v1.** Sub-nodes are appealing for cross-feature consistency checks but add 200+ LOC of parsing for marginal benefit; the implementer reads the blob and parses on demand. Revisit in Slice 5 if cleanup-agent enforcement needs structured field comparison.

3. **Task DAG cycle detection redundancy.** Step 2.3.3 already runs the DAG Validator. Should Slice 4's parser re-validate, or trust upstream? Vote: **fail loud at parse time as a backstop.** Cycles in the source mean a hand-edit happened post-validator; the parser detecting it surfaces the corruption immediately rather than letting it propagate to the graph. Marginal cost (~20 LOC).

4. **Decision supersedes vs relates.** When `related_decision_id` points to an `open` decision and the current decision is `resolved`, does that auto-trigger a `supersedes` edge? Vote: **yes, but only when the parent decision's status is then transitioned to `resolved`.** The parser walks pairs: child has `related_decision_id` = parent's `decision_id` AND child is `resolved` AND parent is `open` → emit `decision_supersedes` AND mark the parent for status update via the next `scribe_decision` cycle (the orchestrator owns the actual status flip; the parser only emits the edge speculatively when the data shape implies it). When parent stays `open`, emit `decision_relates_to` instead — soft pointer. **The parser never writes back to `decisions.jsonl`** (append-only invariant per protocol).

5. **Anonymous tasks (no task_id in sprint-tasks.md).** Fail loud or auto-assign? Vote: **fail loud.** Sprint-tasks.md must have explicit task IDs — auto-assigning would let the parser silently mask author error and break `task_depends_on` resolution.

6. **Forward references in decisions.** A decision row references a feature/task that doesn't exist yet (e.g. Phase 1 decision references a Phase 2 task that hasn't been planned). Vote: **allowed, no validation.** Decisions are temporal — they reference future work by design. Parser emits the decision node without the `decision_drove` edge, warns to build-log, and re-runs at index time may resolve the edge later. This matches the protocol's append-only invariant: decisions are written when made, and the graph is eventually consistent.

---

## 11. Logical scenarios — what could go wrong

Pre-implementation thought experiment. Each scenario states the desired behavior and a one-line implementation note.

1. **Architecture.md is empty / Phase 2 was skipped (e.g. `context_level == full-design`, user supplied architecture upstream).** Indexer behavior: emit empty `slice-4-architecture.json` fragment, log warning ("architecture.md absent — Phase 2 skipped or pre-supplied"), continue. `graph_query_dependencies(feature_id)` returns `{ feature, provides: [], consumes: [], depended_on_by_features: [], depends_on_features: [], task_dag: [] }` — partial result. PO's prompt instructs: on empty contract list, fall back to file read of `docs/plans/architecture.md` if it exists, else proceed without contract data.
   *Note:* Empty fragment is distinct from missing fragment; missing fragment means Slice 4 indexer never ran (a different failure to diagnose).

2. **sprint-tasks.md has a task that implements a feature not in product-spec.md (orphan task).** Parser emits the task node with `feature_id: null`, warns ("task T-7 references feature 'beta-feature' not in Slice 1 inventory"). `task_implements_feature` edge is NOT emitted. PO's wave grouping skips the orphan from feature-keyed groups; orphan tasks are listed in a separate "unattached tasks" section of the brief. Author error — Phase 1 product-spec and Phase 2 sprint-tasks should be coherent. Document that the orchestrator's verify protocol should catch this before Phase 4 dispatches.
   *Note:* Don't fail loud — orphan tasks are recoverable; failing the parser blocks the whole graph for one author mistake.

3. **decisions.jsonl has 3 decisions written cross-phase, two with `related_decision_id` pointing to each other (cycle in supersedes chain).** Example: `D-2-03.related_decision_id = D-2-04` AND `D-2-04.related_decision_id = D-2-03`. Parser detects the cycle in the second pass (after all decision nodes are emitted) and fails loud. The JSONL is preserved (append-only invariant) but no `slice-4-decisions.json` is written; orchestrator logs the corruption to build-log and surfaces a directive to the user: "decisions.jsonl has a circular supersedes chain between D-2-03 and D-2-04 — manual reconciliation required."
   *Note:* This shouldn't happen in practice (scribe.ts validates inputs and orchestrator routes decisions sequentially) but is worth catching because it breaks the LRR aggregator's backward-routing walk.

4. **PO calls `graph_query_dependencies("feature__checkout")` mid-Phase 4, but Phase 1.6 indexed and Phase 2.3.1 hasn't yet (resume from Phase 1.6).** The Slice 1 fragment exists (feature node present); the Slice 4 fragment is absent. Tool returns `{ feature: { id, label }, provides: [], consumes: [], depended_on_by_features: [], depends_on_features: [], task_dag: [] }` — feature known from Slice 1, contracts unknown (Phase 2 hasn't run). PO's prompt handles partial result: continue with feature-only data, fall back to file read of architecture.md if it exists. Document this partial-result shape so PO doesn't misinterpret empty arrays as "no contracts" vs "Phase 2 not yet indexed."
   *Note:* The tool could return a `slice_4_indexed: false` flag to disambiguate. Vote in §10 on whether to add this flag — leaning yes for consumer clarity.

5. **Feedback synthesizer at Phase 5.4 routes a finding using `graph_query_decisions({ status: "open" })` — finds two open decisions about the affected feature.** Synthesizer picks the most recent by `decision_id` (sequential allocation guarantees temporal order within a phase). Routes finding back to that decision's authoring phase via `produced_by_agent` (e.g. `decided_by: "code-architect"` → `target_phase: "phase-2.3.1"`). When `produced_by_agent: "human"`, the synthesizer routes to the orchestrator's user-facing dispatch instead of an agent re-spawn.
   *Note:* The two-open-decisions case is plausible — Phase 2.2 might log a persistence decision AND a separate auth decision, both `open`, and a Phase 5.4 finding could touch both. Synthesizer policy: route to all matching decisions (multi-target finding).

6. **LRR aggregator BLOCKs ship readiness and routes back via `graph_query_decisions({ status: "open", phase: "2" })` — gets all open Phase 2 decisions.** Aggregator's `applyStarRule` already extracts `related_decision_id` strings from chapter findings; Slice 4 lets the aggregator validate each ID against the graph and resolve `decision_supersedes` chains. If `D-2-03` is `resolved` and superseded by `D-2-04`, route to `D-2-04`'s authoring step (`step_id`), not `D-2-03`'s. Deterministic — no free-form string parsing in the routing path.
   *Note:* Star rule's existing fallback path (string-only) stays intact — graph unavailable → aggregator degrades to today's behavior.

7. **User hand-edits decisions.jsonl mid-build (rewriting a `status` from `open` to `resolved` for revisit testing).** Append-only invariant violated; scribe.ts still re-allocates IDs from max-seq-on-disk (no collision), but the graph fragment is now stale relative to disk. Slice 4's incremental hook only fires on `scribeDecision()` calls — a hand-edit doesn't trigger re-index. Solution: on resume from Phase 0, the orchestrator re-runs `graph-index.js docs/plans/decisions.jsonl` (full re-parse) to backfill any drift. Document this in build-log.
   *Note:* Same SHA256-cache freshness contract as Slice 1/2/3 — content-hashed cache key catches the change on next index, but only if the indexer is invoked.
