# Graphify Architecture Deep Dive

> Research date: 2026-04-22
> Repository: https://github.com/safishamsi/graphify (branch: v4)
> Version: 0.4.26 | Language: Python 100% | License: MIT
> Stars: 32.4k | PyPI: `graphifyy`

---

## Core Architecture

### Language & Stack

Python 3.10+ (no other languages). Key dependencies:

| Library | Role |
|---------|------|
| `networkx` | Graph data structure (core, required) |
| `tree-sitter` ≥0.23 + 22 language grammars | Deterministic AST extraction for code |
| `graspologic` (optional) | Leiden community detection |
| `mcp` (optional) | MCP stdio server |
| `vis.js` (embedded in HTML output) | Interactive graph visualization |
| `faster-whisper` + `yt-dlp` (optional) | Video/audio transcription |
| `pypdf` (optional) | PDF text extraction |
| `python-docx`, `openpyxl` (optional) | Office file conversion |
| `watchdog` (optional) | File system watching |
| `matplotlib` (optional) | SVG export |
| `neo4j` (optional) | Direct Neo4j push |

### Module Map

The codebase is a flat Python package (`graphify/`) with ~20 modules. No subpackages, no framework — just plain functions communicating through dicts and NetworkX graphs.

```
graphify/
├── __main__.py      # CLI entry point: install, query, path, explain, add, watch, etc.
├── detect.py        # File discovery, type classification, .graphifyignore, corpus health
├── extract.py       # Deterministic AST extraction via tree-sitter (25 languages)
├── build.py         # Assemble extraction dicts into a NetworkX graph
├── cluster.py       # Leiden/Louvain community detection + oversized community splitting
├── analyze.py       # God nodes, surprising connections, suggested questions, graph diff
├── report.py        # Generate GRAPH_REPORT.md from analysis results
├── export.py        # Output: JSON, HTML (vis.js), Obsidian vault, SVG, GraphML, Neo4j Cypher
├── serve.py         # MCP stdio server exposing 7 graph query tools
├── cache.py         # SHA256-based per-file extraction cache
├── validate.py      # Schema enforcement for extraction dicts
├── ingest.py        # URL fetching (papers, tweets, videos) → save to corpus
├── manifest.py      # File mtime tracking for incremental updates
├── security.py      # URL validation, path sandboxing, label sanitization
├── hooks.py         # Git post-commit/post-checkout hook install/uninstall
├── watch.py         # File system watcher for auto-rebuild
├── benchmark.py     # Token reduction measurement
├── transcribe.py    # Video/audio → text via faster-whisper
├── wiki.py          # Wikipedia-style markdown article generation per community
└── skill*.md        # Platform-specific skill files (Claude, Codex, Kiro, etc.)
```

### Pipeline

The core pipeline is a linear chain of pure functions:

```
detect() → extract() → build_graph() → cluster() → analyze() → report() → export()
```

Each stage is a single function in its own module. They communicate through plain Python dicts and NetworkX graphs — no shared state, no side effects outside `graphify-out/`.

### Graph Library

**NetworkX** — the standard Python graph library. Used for:
- Graph construction (`nx.Graph` or `nx.DiGraph` with `--directed` flag)
- Node/edge storage with arbitrary attribute dicts
- Community detection (Louvain fallback via `nx.community.louvain_communities`)
- Shortest path (`nx.shortest_path`)
- Betweenness centrality (`nx.betweenness_centrality`, `nx.edge_betweenness_centrality`)
- Serialization via `nx.readwrite.json_graph.node_link_data/graph`

No custom graph implementation. The entire graph lives in memory as a NetworkX object.

### Persistence Format

**Primary: `graph.json`** — NetworkX node-link JSON format:

```json
{
  "nodes": [
    {
      "id": "extract_python",
      "label": "extract_python()",
      "file_type": "code",
      "source_file": "graphify/extract.py",
      "source_location": "L42",
      "community": 0,
      "norm_label": "extract_python()"
    }
  ],
  "links": [
    {
      "source": "extract_python",
      "target": "extract_generic",
      "relation": "calls",
      "confidence": "EXTRACTED",
      "confidence_score": 1.0,
      "source_file": "graphify/extract.py",
      "source_location": "L45",
      "weight": 1.0,
      "_src": "extract_python",
      "_tgt": "extract_generic"
    }
  ],
  "hyperedges": [...]
}
```

**Cache: `graphify-out/cache/{sha256}.json`** — per-file extraction results keyed by SHA256 of file contents + relative path. Cache entries are portable across machines.

**Other outputs:**
- `graph.html` — self-contained vis.js interactive visualization
- `GRAPH_REPORT.md` — human-readable analysis report
- `graphify-out/transcripts/` — cached Whisper transcriptions
- `graphify-out/memory/` — saved Q&A results for feedback loop
- `graphify-out/converted/` — office file markdown sidecars

No SQLite. No database. Everything is JSON files on disk + in-memory NetworkX.

### Clustering / Community Detection

**Primary: Leiden algorithm** via `graspologic.partition.leiden()` — best quality community detection.

**Fallback: Louvain** via `networkx.community.louvain_communities()` — used when graspologic is not installed (it's an optional dependency, Python <3.13 only).

Key implementation details from `cluster.py`:

1. **Directed graphs converted to undirected** — both Leiden and Louvain require undirected input
2. **Isolates handled separately** — each isolate becomes its own single-node community
3. **Oversized community splitting** — communities larger than 25% of graph nodes (min 10 nodes) get a second Leiden pass on their subgraph
4. **Deterministic ordering** — communities sorted by size descending, community 0 = largest
5. **Cohesion scoring** — ratio of actual intra-community edges to maximum possible (edge density)

The clustering is **topology-based, not embedding-based**. No vector embeddings, no separate similarity computation. Semantic similarity edges that Claude extracts (`semantically_similar_to`, marked INFERRED) are already in the graph as edges, so they influence community detection directly through graph structure.

### Node/Edge Schema

**Node schema** (enforced by `validate.py`):

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Stable ID: `_make_id(stem, name)` → lowercase, alphanumeric + underscores |
| `label` | ✅ | Human-readable: `"ClassName"`, `"func_name()"`, `".method_name()"` |
| `file_type` | ✅ | One of: `code`, `document`, `paper`, `image`, `rationale` |
| `source_file` | ✅ | Relative file path |
| `source_location` | ❌ | Line number: `"L42"` |
| `community` | ❌ | Added during clustering phase |
| `norm_label` | ❌ | Diacritic-stripped lowercase label, added during JSON export |

**Edge schema**:

| Field | Required | Description |
|-------|----------|-------------|
| `source` | ✅ | Source node ID |
| `target` | ✅ | Target node ID |
| `relation` | ✅ | Relationship type (see below) |
| `confidence` | ✅ | `EXTRACTED`, `INFERRED`, or `AMBIGUOUS` |
| `source_file` | ✅ | File where relationship was found |
| `source_location` | ❌ | Line number |
| `confidence_score` | ❌ | Float 0.0–1.0 (EXTRACTED=1.0, INFERRED=0.5, AMBIGUOUS=0.2) |
| `weight` | ❌ | Edge weight (default 1.0, cross-file INFERRED uses 0.8) |
| `_src` / `_tgt` | ❌ | Original direction preserved for undirected graphs |

**Relation types** (from AST extraction):
- `contains` — file contains class/function
- `method` — class has method
- `calls` — function calls function (within-file EXTRACTED, cross-file INFERRED)
- `imports` / `imports_from` — import statements
- `inherits` — class inheritance
- `uses` — cross-file class-level usage (INFERRED from import resolution)
- `rationale_for` — docstring/comment explains entity
- `case_of` — Swift enum case
- `defines` — module/struct definition (Go, Julia, Verilog)
- `instantiates` — Verilog module instantiation
- `listened_by` — PHP event listener binding
- `bound_to` — PHP service container binding
- `uses_static_prop` / `references_constant` / `uses_config` — PHP-specific
- `includes` — Blade template inclusion
- `semantically_similar_to` — LLM-inferred conceptual link (from semantic extraction)

**Hyperedges** (stored in `graph.graph["hyperedges"]`):
- Group relationships connecting 3+ nodes that pairwise edges can't express
- Generated by LLM semantic extraction, not AST

---

## MCP Server

### Implementation

`serve.py` implements an MCP stdio server using the official `mcp` Python package (`pip install mcp`). It's a standard MCP Server with async handlers.

```python
from mcp.server import Server
from mcp.server.stdio import stdio_server

server = Server("graphify")
```

### Starting the Server

```bash
python -m graphify.serve graphify-out/graph.json
# or via the CLI flag:
/graphify ./raw --mcp
```

### MCP Client Configuration

```json
{
  "mcpServers": {
    "graphify": {
      "type": "stdio",
      "command": "python",
      "args": ["-m", "graphify.serve", "graphify-out/graph.json"]
    }
  }
}
```

### Tools Exposed (7 total)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `query_graph` | BFS/DFS traversal from keyword-matched start nodes | `question` (string), `mode` (bfs/dfs), `depth` (1-6), `token_budget` |
| `get_node` | Full details for a specific node by label/ID | `label` (string) |
| `get_neighbors` | All direct neighbors with edge details | `label`, optional `relation_filter` |
| `get_community` | All nodes in a community by ID | `community_id` (int) |
| `god_nodes` | Most connected nodes (core abstractions) | `top_n` (default 10) |
| `graph_stats` | Summary: node/edge counts, communities, confidence breakdown | (none) |
| `shortest_path` | Shortest path between two concepts | `source`, `target`, `max_hops` (default 8) |

### Query Interface Details

**Node matching** uses keyword scoring with diacritic stripping:
- Each search term is matched against node labels and source file paths
- Label matches score 1.0, source file matches score 0.5
- Top-scoring nodes become BFS/DFS start points

**Output format** is plain text, not JSON:
```
NODE ClassName [src=path/to/file.py loc=L42 community=0]
EDGE ClassName --calls [EXTRACTED]--> OtherClass
```

Output is truncated to a configurable token budget (default 2000 tokens, ~3 chars/token).

**Blank line filtering**: The server installs an OS-level stdin pipe filter to drop blank lines that some MCP clients send between JSON messages, preventing Pydantic validation errors.

### Graph Loading

The graph is loaded once at server startup from `graph.json` using `json_graph.node_link_graph()`. Communities are reconstructed from the `community` attribute stored on each node. The graph stays in memory for the lifetime of the server process — no re-reading on each query.

---

## Indexing Process

### Three-Pass Architecture

**Pass 1: Deterministic AST extraction** (no LLM, `extract.py`)
- Tree-sitter parses each code file into an AST
- Generic walker driven by `LanguageConfig` dataclass extracts classes, functions, imports
- Call-graph second pass walks function bodies to find `calls` edges
- Cross-file import resolution turns file-level imports into class-level INFERRED edges
- Python rationale extraction: docstrings + `# NOTE:`, `# IMPORTANT:`, `# HACK:`, `# WHY:` comments

**Pass 2: Video/audio transcription** (local, no LLM, `transcribe.py`)
- `faster-whisper` transcribes locally with domain-aware prompt derived from corpus god nodes
- Transcripts cached in `graphify-out/transcripts/`

**Pass 3: Semantic extraction** (LLM-powered, orchestrated by skill.md)
- Claude subagents run in parallel over docs, papers, images, and transcripts
- Extract concepts, relationships, design rationale, semantic similarity edges
- Results merged with AST extraction, semantic nodes overwrite AST nodes (richer labels)

### Supported File Types

| Type | Extensions | Extraction Method |
|------|-----------|-------------------|
| Code | `.py .ts .js .jsx .tsx .mjs .go .rs .java .c .cpp .h .hpp .rb .cs .kt .scala .php .swift .lua .zig .ps1 .ex .exs .m .mm .jl .vue .svelte .dart .v .sv` + `.blade.php` | tree-sitter AST (25 languages) |
| Docs | `.md .mdx .html .txt .rst` | LLM semantic extraction |
| Papers | `.pdf` | pypdf text extraction → LLM |
| Images | `.png .jpg .webp .gif` | Claude vision |
| Office | `.docx .xlsx` | python-docx/openpyxl → markdown → LLM |
| Video/Audio | `.mp4 .mov .mkv .webm .avi .m4v .mp3 .wav .m4a .ogg` | faster-whisper → LLM |

### Code Extraction Details (from `extract.py`)

The extraction is driven by a `LanguageConfig` dataclass that parameterizes the generic walker for each language:

```python
@dataclass
class LanguageConfig:
    ts_module: str              # tree-sitter grammar module
    class_types: frozenset      # AST node types for classes
    function_types: frozenset   # AST node types for functions
    import_types: frozenset     # AST node types for imports
    call_types: frozenset       # AST node types for calls
    import_handler: Callable    # Language-specific import resolution
    # ... 15+ more fields
```

Each language has a config instance (`_PYTHON_CONFIG`, `_JS_CONFIG`, etc.) and a thin public function (`extract_python()`, `extract_js()`, etc.) that calls `_extract_generic()`.

Languages with complex semantics (Go, Rust, Julia, Verilog, Elixir, Objective-C, PowerShell, Dart) have custom extractors instead of using the generic walker.

**Call-graph resolution** is two-phase:
1. Within-file: direct label matching against `label_to_nid` map → EXTRACTED edges
2. Cross-file: unresolved calls saved as `raw_calls`, resolved after all files processed → INFERRED edges with confidence_score 0.8

**Python-specific cross-file import resolution** (`_resolve_cross_file_imports`):
- Builds global map: `stem → {ClassName: node_id}`
- For `from .module import Name`, creates INFERRED `uses` edges from each class in the importing file to the imported entity
- Turns `auth.py --imports_from--> models.py` into `DigestAuth --uses--> Response [INFERRED]`

### Caching

SHA256-based per-file cache in `graphify-out/cache/`:
- Key: `SHA256(file_contents + relative_path)`
- Value: extraction dict as JSON
- For Markdown files, only body below YAML frontmatter is hashed (metadata changes don't invalidate)
- Atomic writes via `os.replace()` with Windows fallback
- Re-runs only process changed files

### File Discovery (`detect.py`)

- Walks directory tree, prunes noise dirs (`node_modules`, `.git`, `venv`, `__pycache__`, etc.)
- Respects `.graphifyignore` (gitignore syntax, walks up to `.git` boundary)
- Skips sensitive files (`.env`, `.pem`, `*credential*`, etc.)
- Classifies files by extension, with heuristic paper detection for `.md`/`.txt` (checks for arxiv IDs, citations, academic phrasing)
- Corpus health warnings: <50k words → "may not need a graph", >500k words or >200 files → "expensive"
- Office files auto-converted to markdown sidecars in `graphify-out/converted/`

### Indexing Performance

- **Code files**: Fast — tree-sitter AST parsing is deterministic, no LLM calls. Progress logged every 100 files.
- **Docs/papers/images**: Slow — requires LLM API calls (Claude, GPT-4, etc.). Parallelized via subagents.
- **Re-runs**: Near-instant for unchanged files due to SHA256 cache.
- **Incremental updates** (`--update`): Only re-extracts changed files (mtime comparison against manifest), merges into existing graph.
- **Watch mode** (`--watch`): Code changes trigger instant AST-only rebuild. Doc/image changes notify user to run `--update`.

---

## Query Capabilities

### Query Types

1. **BFS/DFS traversal** (`query_graph` / `graphify query`):
   - Keyword-match start nodes → BFS or DFS to configurable depth
   - Returns subgraph as text with token budget truncation
   - Good for "what connects X to Y?" questions

2. **Shortest path** (`shortest_path` / `graphify path`):
   - NetworkX `shortest_path` between two keyword-matched nodes
   - Returns hop-by-hop path with relation types and confidence labels
   - Good for tracing specific dependency chains

3. **Node explain** (`get_node` / `graphify explain`):
   - Full node details + all neighbors sorted by degree
   - Shows community, source file, degree, all connections with relation/confidence

4. **Neighbor exploration** (`get_neighbors`):
   - All direct neighbors with optional relation type filter
   - Good for "what does X connect to?"

5. **Community browsing** (`get_community`):
   - All nodes in a community by ID
   - Good for understanding module boundaries

6. **God nodes** (`god_nodes`):
   - Top-N most connected nodes, excluding file-level hubs and concept nodes
   - The core abstractions of the codebase

7. **Graph stats** (`graph_stats`):
   - Node/edge counts, community count, confidence breakdown percentages

### Semantic vs Structural Queries

There is **no separate semantic search** (no embeddings, no vector DB). All queries are structural graph traversals:

- **Keyword matching** on node labels and source file paths (diacritic-insensitive)
- **BFS/DFS** graph traversal from matched start nodes
- **Shortest path** via NetworkX algorithms

Semantic understanding comes from the graph structure itself:
- LLM-extracted `semantically_similar_to` edges connect conceptually related nodes
- Leiden clustering groups semantically related nodes into communities
- The graph IS the semantic index — no separate embedding step

### Response Format

All query responses are **plain text**, not structured JSON:

```
Traversal: BFS depth=3 | Start: [ClassName, OtherClass] | 15 nodes found

NODE ClassName [src=path/file.py loc=L42 community=0]
NODE OtherClass [src=path/other.py loc=L10 community=1]
EDGE ClassName --calls [EXTRACTED]--> OtherClass
```

Truncated to token budget (default 2000 tokens ≈ 6000 chars).

### Analysis Features (from `analyze.py`)

**God nodes**: Top-N by degree, excluding:
- File-level hub nodes (label matches source filename)
- AST method stubs (`.method_name()`)
- Module-level function stubs with degree ≤ 1
- Concept nodes (empty source_file)

**Surprising connections**: Composite scoring system:
- Confidence weight: AMBIGUOUS (3) > INFERRED (2) > EXTRACTED (1)
- Cross file-type bonus: code↔paper (+2)
- Cross-repo bonus: different top-level directory (+2)
- Cross-community bonus (+1)
- Semantic similarity bonus (1.5x multiplier)
- Peripheral→hub bonus (+1)
- Each result includes a `why` field explaining what makes it surprising

**Suggested questions**: Generated from graph topology:
- AMBIGUOUS edges → unresolved relationship questions
- Bridge nodes (high betweenness) → cross-cutting concern questions
- God nodes with many INFERRED edges → verification questions
- Isolated/weakly-connected nodes → exploration questions
- Low-cohesion communities → structural split questions

**Graph diff** (`graph_diff`): Compares two graph snapshots, returns new/removed nodes and edges.

---

## Limitations

### What It Doesn't Do Well

1. **No real-time semantic search**: Queries are keyword-matched graph traversals, not embedding-based similarity search. If you search for "authentication" but the node is labeled "AuthManager", you need the exact term or a substring match.

2. **LLM-dependent for non-code**: Docs, papers, images all require LLM API calls for extraction. This is slow and costs tokens. Code-only extraction is fast and free.

3. **No incremental semantic updates**: `--update` only re-extracts code files (AST-only). Changed docs/images require a full `--update` with LLM re-pass.

4. **Single-machine, in-memory**: The entire graph lives in a NetworkX object in memory. No distributed graph, no streaming, no lazy loading.

5. **Community detection is non-deterministic**: Leiden/Louvain can produce slightly different communities across runs (seed=42 helps but doesn't guarantee).

6. **No entity resolution across languages**: A Python class `AuthManager` and a TypeScript class `AuthManager` in different files get separate nodes. Cross-language semantic linking depends on the LLM extraction pass.

7. **Flat module structure**: No subpackages, no plugin system. Adding a new extractor means editing `extract.py` directly.

8. **HTML viz caps at 5,000 nodes**: `MAX_NODES_FOR_VIZ = 5_000` — larger graphs must use `--no-viz` or export to Gephi/Neo4j.

### Scalability Concerns

- **Memory**: Entire graph in NetworkX in memory. For very large codebases (>10k files), memory usage could be significant.
- **Leiden on large graphs**: graspologic's Leiden can be slow on graphs with >50k nodes. The Louvain fallback is faster but lower quality.
- **MCP server**: Graph loaded once at startup, stays in memory. No pagination on query results (just token budget truncation).
- **Cache size**: One JSON file per source file in `graphify-out/cache/`. Large codebases = many small files.
- **Corpus warnings**: Built-in thresholds at 50k words (lower) and 500k words / 200 files (upper) suggest the tool is designed for project-scale, not enterprise-scale.

### Customization Needed for Agent Orchestration Pipeline

1. **Programmatic API**: The current interface is CLI + MCP. For tight integration, you'd want to import `build.py`, `cluster.py`, `analyze.py` directly as a library. The functions are clean and composable — this should be straightforward.

2. **Streaming/incremental graph updates**: The current model is batch: detect → extract → build → cluster → export. For a live agent pipeline, you'd want to add nodes/edges incrementally without full rebuild. NetworkX supports this natively, but the clustering and analysis would need to be re-run.

3. **Custom node types**: The schema supports arbitrary attributes on nodes, but `file_type` is constrained to `{code, document, paper, image, rationale}`. For agent state (tasks, decisions, artifacts), you'd need to extend `validate.py`.

4. **Query result format**: Plain text output is designed for LLM consumption. For programmatic use, you'd want the raw NetworkX subgraph or structured JSON.

5. **Multi-graph support**: Currently one graph per project (`graphify-out/graph.json`). For an orchestration pipeline tracking multiple projects or agent sessions, you'd need to manage multiple graph instances.

6. **Edge provenance**: Edges track `source_file` and `source_location`, but not which agent or extraction pass created them. For an agent pipeline, you'd want agent attribution on edges.

7. **Temporal dimension**: No timestamps on nodes/edges. `graph_diff()` exists for comparing snapshots, but there's no built-in versioning or time-series support.

---

## Key Design Decisions

1. **No embeddings, no vector DB**: Clustering is purely topology-based. Semantic similarity is captured as explicit graph edges by the LLM, not as embedding distances. This is a deliberate choice — the graph structure IS the similarity signal.

2. **Confidence tagging**: Every edge is `EXTRACTED` (deterministic), `INFERRED` (reasonable deduction), or `AMBIGUOUS` (uncertain). This provenance tracking is baked into the schema, not bolted on.

3. **AST-first, LLM-second**: Code extraction is deterministic and free. LLM extraction is only used for non-code content. This keeps costs predictable and re-runs fast.

4. **Portable cache**: SHA256 keys use relative paths, so cache entries work across machines and CI environments.

5. **Platform-agnostic skill system**: The same core library works with 15+ AI coding assistants via platform-specific skill files and hook mechanisms.

---

## Files Not Accessed

The following files were referenced but not fetched in full:

- `graphify/report.py` — report generation (GRAPH_REPORT.md formatting)
- `graphify/ingest.py` — URL fetching and content ingestion
- `graphify/hooks.py` — git hook install/uninstall
- `graphify/watch.py` — file system watcher
- `graphify/benchmark.py` — token reduction measurement
- `graphify/transcribe.py` — Whisper transcription
- `graphify/wiki.py` — wiki article generation
- `graphify/security.py` — URL/path/label validation
- `graphify/manifest.py` — mtime tracking
- `graphify/skill.md` — the actual skill prompt (orchestrates the 3-pass pipeline)
- `tests/` — test suite
- `worked/` — worked examples with real output

The `skill.md` file is particularly important — it contains the LLM prompt that orchestrates the semantic extraction pass (Pass 3). This is where the parallel subagent dispatch, semantic edge extraction, and hyperedge generation are defined. It was not fetched because it's a large prompt file, but it's the key to understanding how the LLM extraction works.
