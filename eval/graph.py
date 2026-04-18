"""Orchestration graph: dispatch edges vs doc edges.

Dispatch edges = real control flow:
  - subagent_type: <name>
  - Task tool with subagent_type
  - "Load <path>" / "load protocols/<file>" directives

Doc edges = prose cross-references (weaker signal; used for fan-in/out only).

Cycles and orphans are computed on the DISPATCH graph only.
"""
from __future__ import annotations
import re
from collections import defaultdict
from common import iter_markdown_files, rel, ROOT, read

try:
    import networkx as nx
except ImportError:
    raise SystemExit("pip install networkx")

DOC_REF_RE = re.compile(
    r"\b(agents|skills|protocols|commands)/([a-zA-Z0-9_\-./]+?)(?:\.md)?(?=[\s`'\"\)\]\},;:]|$)"
)
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
IGNORE_PREFIXES = ("tree/", "blob/")

# Real dispatch patterns
SUBAGENT_RE = re.compile(r"subagent_type:\s*[`'\"]?([a-zA-Z0-9_\-:/]+)[`'\"]?")
LOAD_RE = re.compile(
    r"[Ll]oad\s+[`']?(agents|skills|protocols|commands)/([a-zA-Z0-9_\-./]+?)(?:\.md)?[`'\s]"
)
# Negation preceding "load" — "Do NOT load X", "Don't load X", "never load X".
# We re-check the match's preceding ~30 chars to filter these out.
NEGATION_LOOKBACK_RE = re.compile(
    r"(?:do\s+not|don[\'']t|never|must\s+not|not\s+to)\s*$",
    re.IGNORECASE,
)
ENTRYPOINTS = {"commands"}  # categories that are never orphans (user-invoked)
SKILL_AUTOLOAD = True  # SKILL.md files are discovered by skill system


def node_id(path_str: str) -> str:
    return path_str.replace(".md", "")


def is_entrypoint(node: str) -> bool:
    return node.split("/")[0] in ENTRYPOINTS


def is_autoloaded_skill(node: str) -> bool:
    return SKILL_AUTOLOAD and node.startswith("skills/") and (
        node.endswith("/SKILL") or node.endswith("/AGENTS")
    )


def strip_code_blocks(text: str) -> str:
    return FENCE_RE.sub("", text)


def extract_dispatch_targets(text: str) -> set[str]:
    """Agent dispatches + explicit protocol loads."""
    targets = set()
    # Agent subagent_type references
    for m in SUBAGENT_RE.finditer(text):
        name = m.group(1).strip()
        # Strip plugin prefix like "feature-dev:code-architect"
        bare = name.split(":")[-1]
        candidates = [f"agents/{bare}", f"agents/{name.replace(':', '-')}"]
        for c in candidates:
            if (ROOT / f"{c}.md").exists():
                targets.add(c)
                break
    # Explicit "Load <path>" directives — skip negated forms
    for m in LOAD_RE.finditer(text):
        kind, name = m.group(1), m.group(2).rstrip("/.")
        if name.startswith(IGNORE_PREFIXES):
            continue
        # Look back up to 30 chars before "load" for negation
        window_start = max(0, m.start() - 30)
        preceding = text[window_start:m.start()]
        if NEGATION_LOOKBACK_RE.search(preceding):
            continue
        # Skills are directories containing SKILL.md — resolve to node id
        if kind == "skills" and (ROOT / kind / name / "SKILL.md").exists():
            targets.add(f"skills/{name}/SKILL")
        else:
            targets.add(f"{kind}/{name}")
    return targets


def extract_doc_targets(text: str) -> set[str]:
    text = strip_code_blocks(text)
    targets = set()
    for m in DOC_REF_RE.finditer(text):
        kind, name = m.group(1), m.group(2).rstrip("/.")
        if name.startswith(IGNORE_PREFIXES):
            continue
        targets.add(f"{kind}/{name}")
    return targets


def main():
    dispatch = nx.DiGraph()
    doc = nx.DiGraph()
    all_nodes = set()

    dynamic_dispatch = set()
    for p in iter_markdown_files():
        src = node_id(rel(p))
        dispatch.add_node(src)
        doc.add_node(src)
        all_nodes.add(src)
        fm, _ = read(p)
        if fm.get("dispatch_note"):
            dynamic_dispatch.add(src)

    for p in iter_markdown_files():
        src = node_id(rel(p))
        text = p.read_text(encoding="utf-8", errors="replace")
        for tgt in extract_dispatch_targets(text):
            if tgt != src:
                dispatch.add_edge(src, tgt)
        for tgt in extract_doc_targets(text):
            if tgt != src:
                doc.add_edge(src, tgt)

    # Orphans on DISPATCH graph, excluding entrypoints and skill auto-loads
    incoming = defaultdict(int)
    for u, v in dispatch.edges():
        incoming[v] += 1
    orphans = [
        n for n in all_nodes
        if incoming[n] == 0
        and not is_entrypoint(n)
        and not is_autoloaded_skill(n)
        and n not in dynamic_dispatch
    ]

    dead = [(u, v) for u, v in dispatch.edges() if v not in all_nodes]

    try:
        cycles = list(nx.simple_cycles(dispatch))
    except Exception:
        cycles = []

    # Doc-graph hotspots (useful for "what references this file")
    doc_incoming = defaultdict(int)
    for u, v in doc.edges():
        doc_incoming[v] += 1
    fanout = sorted(((n, doc.out_degree(n)) for n in all_nodes), key=lambda x: -x[1])[:10]
    fanin = sorted(((n, doc_incoming[n]) for n in all_nodes), key=lambda x: -x[1])[:10]

    print(f"Nodes: {len(all_nodes)}")
    print(f"Dispatch edges: {dispatch.number_of_edges()}  (real control flow)")
    print(f"Doc edges    : {doc.number_of_edges()}  (prose cross-references)\n")

    print(f"Orphans on dispatch graph: {len(orphans)}")
    print("  (excludes commands/* and skills/*/SKILL.md — those are entry points)")
    for o in sorted(orphans)[:40]:
        print(f"  - {o}")
    if len(orphans) > 40:
        print(f"  ... and {len(orphans) - 40} more")

    print(f"\nDead dispatch refs: {len(dead)}")
    for u, v in dead[:20]:
        print(f"  {u}  ->  {v}  [MISSING]")

    print(f"\nReal orchestration cycles: {len(cycles)}")
    for c in cycles:
        print(f"  {' -> '.join(c)} -> {c[0]}")

    print("\nDoc-graph fan-out hotspots (most outgoing prose refs):")
    for n, d in fanout:
        if d:
            print(f"  {d:>3}  {n}")
    print("\nDoc-graph fan-in hotspots (most referenced by prose):")
    for n, d in fanin:
        if d:
            print(f"  {d:>3}  {n}")


if __name__ == "__main__":
    main()
