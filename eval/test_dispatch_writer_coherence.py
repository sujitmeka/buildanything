#!/usr/bin/env python3
"""Eval: cross-validation of dispatched-subagent writes vs artifacts table.

Catches the drift bug where a dispatched subagent — named in a
``parallel_sub_dispatch`` / ``sub_dispatch`` / ``dispatches`` field of
``docs/migration/phase-graph.yaml`` — is told by the dispatching prose in
``commands/build.md`` or ``protocols/*.md`` to ``Save to <path>``, but the
``artifacts:`` writer list for ``<path>`` doesn't include that agent.

Two failure modes motivate this guard:

1. The dispatched agent frontmatter includes Write → the PreToolUse
   writer-owner hook default-denies the write mid-dispatch.
2. The dispatched agent frontmatter excludes Write → the prose silently
   pushes the agent toward Bash heredoc / redirect writes, which today
   bypass the hook entirely.

Both leave Phase 6 LRR in a broken state. The sibling
``test_writer_owner_drift.py`` guards the path-in-table invariant; this one
guards the agent-is-allowed-to-write-that-path invariant.

Run: ``pytest -v eval/test_dispatch_writer_coherence.py``
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
PHASE_GRAPH = ROOT / "docs" / "migration" / "phase-graph.yaml"
BUILD_MD = ROOT / "commands" / "build.md"
PROTOCOLS_DIR = ROOT / "protocols"

# Dispatch keys we recognize in phase-graph.yaml. Values may be a bare string
# (agent name), a list of strings, or a list of dicts with a ``subagent_type``
# key — all three forms appear in the graph today.
DISPATCH_KEYS: frozenset[str] = frozenset(
    {
        "parallel_sub_dispatch",
        "sub_dispatch",
        "dispatches",
        "dispatch",
    }
)

_WRITE_VERB = r"(?:Save(?:\s+findings)?\s+to|Write(?:\s+findings)?\s+to|writes?\s+to|Append\s+to)"

# Match any prose saying "Save to <path>" near a dispatched subagent name.
# Restricted to evidence/ JSON paths because those are the ones the
# writer-owner hook gates agent-by-agent (per artifacts entry
# docs/plans/evidence/lrr/*.json, etc.). Bare-name evidence paths don't
# appear in the sub-dispatch sites we care about.
_SAVE_PATH_RE = re.compile(
    rf"{_WRITE_VERB}\s+`?(?P<path>docs/plans/[A-Za-z0-9_./*-]+\.(?:md|json|jsonl|yaml|yml))`?",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class DispatchSite:
    """A (dispatching_agent, dispatched_agent, output_path) triple."""

    dispatched_agent: str
    output_path: str
    source_file: Path
    line_number: int


def _walk_dispatches(node: object, out: list[str]) -> None:
    """Recursively collect every dispatched-subagent name under DISPATCH_KEYS.

    Handles three value shapes seen in phase-graph.yaml today:
      - string:      ``parallel_sub_dispatch: pr-test-analyzer``
      - list[str]:   ``dispatches: [feature-intel, tech-feasibility]``
      - list[dict]:  ``dispatches: [{subagent_type: visual-research, ...}]``
    Also collects bare ``subagent_type:`` scalars nested one level deep inside
    dispatch values (list of dicts case above).
    """
    if isinstance(node, dict):
        for k, v in node.items():
            if k in DISPATCH_KEYS:
                _collect_dispatch_value(v, out)
            _walk_dispatches(v, out)
    elif isinstance(node, list):
        for item in node:
            _walk_dispatches(item, out)


def _collect_dispatch_value(value: object, out: list[str]) -> None:
    if isinstance(value, str):
        out.append(value)
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                out.append(item)
            elif isinstance(item, dict):
                sub = item.get("subagent_type")
                if isinstance(sub, str):
                    out.append(sub)
    elif isinstance(value, dict):
        sub = value.get("subagent_type")
        if isinstance(sub, str):
            out.append(sub)


# Pseudo-writer tokens that are NOT agent-role names. Mirror of the set in
# hooks/pre-tool-use.ts (NON_AGENT_WRITERS). Tokens outside this set AND not
# matching ``^phase-?-?N$`` are treated as subagent_type names by the hook.
_NON_AGENT_WRITERS: frozenset[str] = frozenset(
    {
        "orchestrator",
        "orchestrator-scribe",
        "every-phase",
        "auto-rendered-view",
        "all-subagents-auto",
        "user",
    }
)

_PHASE_TOKEN_RE = re.compile(r"^phase-?-?\d+(?:-[a-z0-9-]+)?$", re.IGNORECASE)


def _is_agent_role_writer_set(writers: list[str]) -> bool:
    """True iff at least one writer token is an agent-role name (not a phase
    and not a non-agent pseudo). The hook only runs agent-role matching when
    this is true; otherwise a phase-match alone grants the write.
    """
    for w in writers:
        if _PHASE_TOKEN_RE.match(w):
            continue
        if w in _NON_AGENT_WRITERS:
            continue
        return True
    return False


def _load_phase_graph() -> dict:
    return yaml.safe_load(PHASE_GRAPH.read_text())


def _scratch_regex() -> re.Pattern | None:
    doc = _load_phase_graph()
    scratch = doc.get("phase_internal_scratch", {}).get("path_glob")
    return _glob_to_regex(scratch) if scratch else None


def _glob_to_regex(pattern: str) -> re.Pattern:
    """Mirror the glob semantics of hooks/compile-writer-owner-cache.ts."""
    out: list[str] = []
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                out.append(".*")
                i += 2
                continue
            out.append("[^/]*")
        elif ch == "{":
            close = pattern.find("}", i)
            if close == -1:
                out.append(re.escape(ch))
            else:
                alts = [re.escape(p) for p in pattern[i + 1 : close].split(",")]
                out.append(f"(?:{'|'.join(alts)})")
                i = close
        elif ch in r".+?^$(){}|[]\\":
            out.append(re.escape(ch))
        else:
            out.append(ch)
        i += 1
    return re.compile(f"^{''.join(out)}$")


def _artifact_writers_for(path: str, artifacts: list[dict]) -> list[str] | None:
    """Return the declared writers list for the MOST SPECIFIC artifact glob
    matching ``path``. Returns None if no artifact entry matches.

    Specificity = length of the literal (non-glob) prefix of the path, with
    exact matches winning over any glob and shorter glob chars winning over
    longer ones (``lrr/*.json`` beats ``**/*.json``). This mirrors author
    intent when multiple globs in the artifacts table overlap.
    """
    best: tuple[int, int, dict] | None = None
    for entry in artifacts:
        glob = re.sub(r"\[[^\]]+\]", "*", entry["path"])
        if not _glob_to_regex(glob).match(path):
            continue
        # Specificity score: longer literal prefix wins; fewer glob chars wins
        # on tie. Exact match has no glob chars at all.
        prefix = re.split(r"[*{\[]", glob, maxsplit=1)[0]
        score = (len(prefix), -glob.count("*"))
        if best is None or score > best[:2]:
            best = (score[0], score[1], entry)
    if best is None:
        return None
    entry = best[2]
    if "writers" in entry:
        writers = entry["writers"]
        return list(writers) if isinstance(writers, list) else [writers]
    if "writer" in entry:
        return [entry["writer"]]
    return []


def _collect_dispatched_agents() -> set[str]:
    doc = _load_phase_graph()
    names: list[str] = []
    _walk_dispatches(doc, names)
    return set(names)


def _find_sub_dispatch_sites() -> list[DispatchSite]:
    """Find every case where a dispatched subagent in phase-graph.yaml is
    accompanied by a ``Save to <path>`` instruction in the prose of
    commands/build.md or protocols/*.md.

    Heuristic: for each dispatched agent name collected from the graph, scan
    every prose file for co-located ``subagent_type: <name>`` and ``Save to
    <path>`` — but ONLY flag cases where BOTH tokens appear in the same
    paragraph (single line in build.md's one-line-per-instruction style).
    This is intentionally strict: we only want to cross-check sites where
    the dispatched agent is explicitly named together with its output path
    in the same instruction.
    """
    graph_agents = _collect_dispatched_agents()
    prose_files = [BUILD_MD] + sorted(PROTOCOLS_DIR.glob("*.md"))
    sites: list[DispatchSite] = []

    for src in prose_files:
        if not src.exists():
            continue
        for lineno, line in enumerate(src.read_text().splitlines(), start=1):
            # Must contain a save-path and at least one dispatched agent name
            # from the graph on the same line.
            path_match = _SAVE_PATH_RE.search(line)
            if not path_match:
                continue
            out_path = path_match.group("path")
            for agent in graph_agents:
                # Require the agent name to appear as a subagent_type token
                # on this same line — avoids matching prose that just mentions
                # the agent name in a descriptive sentence.
                needle = f"subagent_type: `{agent}`"
                if needle in line:
                    sites.append(
                        DispatchSite(
                            dispatched_agent=agent,
                            output_path=out_path,
                            source_file=src,
                            line_number=lineno,
                        )
                    )
    return sites


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def _classify_site(
    site: DispatchSite, artifacts: list[dict], scratch_re: re.Pattern | None
) -> tuple[str, list[str] | None]:
    """Return (status, writers) for a dispatch site.

    Status is one of:
      - "ok"          — writers list includes the dispatched agent
      - "phase_only"  — writers are phase/pseudo tokens only; agent-role
                        enforcement is not active at runtime for this path,
                        so the prose is benignly less specific than the YAML
      - "scratch"     — path is covered by phase_internal_scratch.path_glob
                        (hook exempts via scratch_globs)
      - "no_entry"    — path has NO artifact entry at all (default-deny)
      - "missing"     — writers list has agent-role tokens but not this agent
    """
    if scratch_re is not None and scratch_re.match(site.output_path):
        return ("scratch", None)
    writers = _artifact_writers_for(site.output_path, artifacts)
    if writers is None:
        return ("no_entry", None)
    if site.dispatched_agent in writers:
        return ("ok", writers)
    if not _is_agent_role_writer_set(writers):
        return ("phase_only", writers)
    return ("missing", writers)


def test_dispatched_agents_allowed_to_write_their_output_paths() -> None:
    """Every (dispatched_agent, output_path) pair whose artifact entry uses
    agent-role writers MUST include that agent in the writers list.

    The specific bug this catches: ``commands/build.md`` Step 6.1 tells
    ``pr-test-analyzer`` to save ``docs/plans/evidence/lrr/eng-quality-
    coverage.json``, but the ``docs/plans/evidence/lrr/*.json`` artifact
    entry historically didn't include ``pr-test-analyzer`` in its writers
    list. The PreToolUse hook default-denies the write; the LRR Eng-Quality
    chapter blocks on missing sub-verdict evidence; the entire Phase 6
    wedges.

    Paths whose artifacts entry uses only phase/pseudo writers are NOT
    flagged here — the hook doesn't run agent-role matching on those, so a
    phase-match alone grants the write. Those sites surface in
    ``test_report_phase_only_writer_drift_sites`` as informational output.
    """
    sites = _find_sub_dispatch_sites()
    assert sites, (
        "no (dispatched agent, output path) prose sites detected — the "
        "collection heuristic may be broken; expected at least the "
        "pr-test-analyzer / eng-quality-coverage.json pair"
    )

    doc = _load_phase_graph()
    artifacts = doc.get("artifacts", [])
    scratch_re = _scratch_regex()

    failures: list[str] = []
    for site in sites:
        status, writers = _classify_site(site, artifacts, scratch_re)
        if status == "missing":
            failures.append(
                f"{site.source_file.name}:{site.line_number} "
                f"dispatched={site.dispatched_agent!r} "
                f"path={site.output_path!r} — writers={writers} "
                f"does not include {site.dispatched_agent!r}"
            )

    assert not failures, (
        "dispatched subagent is told to Save to <path>, but the artifacts:\n"
        "writer list for <path> does not include that agent. The writer-owner\n"
        "hook WILL default-deny the write (agent-role enforcement active):\n"
        "  - " + "\n  - ".join(failures)
    )


def test_collection_heuristic_finds_the_known_lrr_site() -> None:
    """Pin the known site so an over-broad future refactor of the collection
    heuristic doesn't silently stop finding it.
    """
    sites = _find_sub_dispatch_sites()
    hits = [
        s
        for s in sites
        if s.dispatched_agent == "pr-test-analyzer"
        and s.output_path == "docs/plans/evidence/lrr/eng-quality-coverage.json"
    ]
    assert hits, (
        "expected to find pr-test-analyzer dispatch saving "
        "eng-quality-coverage.json in commands/build.md — collection "
        "heuristic missed it. Sites found: "
        + ", ".join(f"{s.dispatched_agent}->{s.output_path}" for s in sites)
    )


if __name__ == "__main__":
    sites = _find_sub_dispatch_sites()
    doc = _load_phase_graph()
    artifacts = doc.get("artifacts", [])
    bad: list[str] = []
    for site in sites:
        writers = _artifact_writers_for(site.output_path, artifacts)
        if writers is None or site.dispatched_agent not in writers:
            bad.append(f"{site.dispatched_agent} -> {site.output_path} "
                       f"(writers={writers})")
    if bad:
        print("FAIL — dispatch/writer coherence drift detected")
        for b in bad:
            print(f"  - {b}")
        raise SystemExit(1)
    print(f"OK — {len(sites)} sub-dispatch sites, all agent-path pairs covered.")
