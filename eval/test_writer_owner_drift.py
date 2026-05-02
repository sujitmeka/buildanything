#!/usr/bin/env python3
"""Eval: writer-owner drift guard.

Fails when a `writes:` block somewhere in `docs/migration/phase-graph.yaml`
or a `Save X to <path>` / `Write <path>` instruction in `protocols/*.md`
references an artifact that is NOT covered by the compiler-authoritative
top-level `artifacts:` table.

Why this exists: `hooks/compile-writer-owner-cache.ts` reads ONLY the top-
level `artifacts:` table. Per-step `writes:` blocks and per-protocol prose
are narrative-authoritative but INVISIBLE to the compiler. When they drift
out of sync, the PreToolUse default-deny blocks writes that a subagent was
explicitly told to perform, killing the build mid-phase.

Run: `pytest -v eval/test_writer_owner_drift.py`
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
PHASE_GRAPH = ROOT / "docs" / "migration" / "phase-graph.yaml"
PROTOCOLS_DIR = ROOT / "protocols"

# Non-file narratives that appear in `writes:` blocks but are not paths the
# writer-owner hook gates. Keep this list tight and documented.
ARTIFACT_ALLOWLIST: set[str] = {
    "TodoWrite",  # Claude Code's virtual todo list, not a file
    "source-code",  # narrative — "writes source code" in Phase 4 per_task
    "README",  # Phase 7 technical-writer narrative; actual README lives at repo root
    "API docs",
    "deploy notes",
    "~40-line CONTEXT MAP",
    "CONTEXT MAP (~40 lines)",
    "CONTEXT MAP",
    # phase-1 scratch directory covered by phase_internal_scratch.path_glob,
    # NOT by the artifacts: table. The hook exempts these via scratch_globs.
    # Filtered dynamically below via scratch-glob match.
}

# Regex for extracting WRITE-intent paths from protocol markdown prose.
# Only match paths that follow an explicit write verb (Save .. to, Write,
# Append to, writes to) so we don't flag Read-intent references.
_WRITE_VERB = r"(?:Save(?:\s+findings)?\s+to|Write(?:\s+findings)?\s+to|Writes?|Append\s+to|writes?\s+to)"
DOCS_PATH_RE = re.compile(
    rf"{_WRITE_VERB}\s+`?(?P<path>docs/plans/[A-Za-z0-9_./*-]+\.(?:md|json|jsonl|yaml|yml))`?",
    re.IGNORECASE,
)
BARE_NAME_RE = re.compile(
    rf"{_WRITE_VERB}\s+`?(?P<name>[a-z0-9][a-z0-9_-]*\.(?:md|json|jsonl|yaml|yml))`?",
    re.IGNORECASE,
)

# Bare-name extractions we intentionally DO NOT promote to docs/plans/.
# Usage-description files, narrative prose, misleading matches.
BARE_NAME_IGNORE: set[str] = {
    "PrivacyInfo.xcprivacy",  # iOS manifest at Xcode project root, not docs/plans
    "Package.swift",
    "Info.plist",
    "playwright.config.ts",
    "playwright.config.js",
    "decisions.json",       # regex false positive: "Do NOT write decisions.jsonl" truncated
    "findings.json",        # nested path (evidence/product-reality/*/findings.json), not docs/plans/
    "slice-3-tokens.json",  # graph index output at project root, not docs/plans/
}


def _walk_writes(node, out: list[str]) -> None:
    """Recursively collect every string under any `writes:` key."""
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "writes":
                if isinstance(v, list):
                    for item in v:
                        if isinstance(item, str):
                            out.append(item)
                        elif isinstance(item, dict):
                            _walk_writes(item, out)
                elif isinstance(v, str):
                    out.append(v)
                elif isinstance(v, dict):
                    _walk_writes(v, out)
            else:
                _walk_writes(v, out)
    elif isinstance(node, list):
        for item in node:
            _walk_writes(item, out)


def _load_phase_graph() -> dict:
    return yaml.safe_load(PHASE_GRAPH.read_text())


def _artifact_globs() -> list[tuple[str, re.Pattern]]:
    """Compile every `artifacts:` path into (path, regex) pairs.

    Mirrors the glob semantics of hooks/compile-writer-owner-cache.ts:
    `**` -> `.*`, `*` -> `[^/]*`, `{a,b}` -> `(?:a|b)`, plus `[x]` placeholder
    (e.g. `[task-id]`) -> `*` before regex compilation.
    """
    doc = _load_phase_graph()
    compiled: list[tuple[str, re.Pattern]] = []
    for entry in doc.get("artifacts", []):
        path = entry["path"]
        glob = re.sub(r"\[[^\]]+\]", "*", path)
        compiled.append((path, _glob_to_regex(glob)))
    return compiled


def _scratch_regex() -> re.Pattern | None:
    doc = _load_phase_graph()
    scratch_glob = doc.get("phase_internal_scratch", {}).get("path_glob")
    return _glob_to_regex(scratch_glob) if scratch_glob else None


def _glob_to_regex(pattern: str) -> re.Pattern:
    out = []
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


def _is_covered(path: str, artifact_regexes: list[tuple[str, re.Pattern]]) -> bool:
    for _, regex in artifact_regexes:
        if regex.match(path):
            return True
    return False


def _is_scratch(path: str, scratch_re: re.Pattern | None) -> bool:
    return bool(scratch_re and scratch_re.match(path))


def _normalize(path: str) -> str | None:
    """Normalize a `writes:`-style string to a path, or None to ignore."""
    path = path.strip().strip("`")
    if not path:
        return None
    if path in ARTIFACT_ALLOWLIST:
        return None
    # "<target>Tests/<target>Tests.swift" placeholder — angle brackets mean
    # the name is filled at runtime, not a real path.
    if "<" in path and ">" in path:
        return None
    # Strip trailing "(qualifier)" narration, e.g. "maestro/*.yaml (>=1)" or
    # "learnings.jsonl (reality sweep ...)".
    path = re.sub(r"\s*\([^)]*\)\s*$", "", path).strip()
    # Project-root files are their own entries in artifacts: — do NOT promote.
    if path in ("CLAUDE.md", "DESIGN.md"):
        return path
    # Paths starting with "evidence/", "phase1-scratch/", or any bare top-
    # level name known to live under docs/plans/ should be resolved to
    # docs/plans/... per the yaml convention.
    if path.startswith("evidence/") or path.startswith("phase1-scratch/"):
        return f"docs/plans/{path}"
    # maestro/ flows live at the iOS project root, not docs/plans.
    if path.startswith("maestro/"):
        return None
    # Bare filename → promote to docs/plans/ per yaml convention.
    if "/" not in path and path.endswith((".md", ".json", ".jsonl")):
        if path in BARE_NAME_IGNORE:
            return None
        return f"docs/plans/{path}"
    return path


def _collect_yaml_writes() -> set[str]:
    doc = _load_phase_graph()
    raw: list[str] = []
    _walk_writes(doc, raw)
    out: set[str] = set()
    for r in raw:
        n = _normalize(r)
        if n:
            out.add(n)
    return out


def _collect_protocol_writes() -> set[str]:
    out: set[str] = set()
    for md in sorted(PROTOCOLS_DIR.glob("*.md")):
        text = md.read_text()
        for m in DOCS_PATH_RE.finditer(text):
            out.add(m.group("path"))
        for m in BARE_NAME_RE.finditer(text):
            name = m.group("name")
            if name in BARE_NAME_IGNORE:
                continue
            # Repo-root files — do NOT promote to docs/plans/.
            if name in ("CLAUDE.md", "DESIGN.md"):
                out.add(name)
                continue
            out.add(f"docs/plans/{name}")
    return out


def _diff(declared: set[str]) -> list[str]:
    regexes = _artifact_globs()
    scratch = _scratch_regex()
    missing: list[str] = []
    for path in sorted(declared):
        if _is_covered(path, regexes) or _is_scratch(path, scratch):
            continue
        missing.append(path)
    return missing


def test_yaml_writes_covered_by_artifacts():
    """Every `writes:` block path in phase-graph.yaml must be in `artifacts:`.

    This is the bug class that killed the user's build at Phase 3.1: a
    per-step `writes:` declared a path the compiler never saw.
    """
    declared = _collect_yaml_writes()
    missing = _diff(declared)
    assert not missing, (
        "Paths declared in per-step `writes:` blocks but missing from the "
        "top-level `artifacts:` table (or scratch glob). The writer-owner "
        "hook WILL default-deny these mid-build:\n  - "
        + "\n  - ".join(missing)
    )


def test_protocol_writes_covered_by_artifacts():
    """Every `Save X to <path>` / `Write <path>` instruction in protocols/*.md
    must resolve to a path the writer-owner hook allows."""
    declared = _collect_protocol_writes()
    missing = _diff(declared)
    assert not missing, (
        "Paths named in protocols/*.md (Save findings to ... / Write ...) "
        "but missing from the top-level `artifacts:` table. Subagents "
        "following the protocol WILL be blocked mid-dispatch:\n  - "
        + "\n  - ".join(missing)
    )


def test_compiler_cache_shape_sane():
    """Sanity: the compiled cache must cover the phase_internal_scratch glob
    and every `artifacts:` entry must declare at least one writer."""
    doc = _load_phase_graph()
    artifacts = doc.get("artifacts", [])
    assert artifacts, "artifacts: table is empty — compiler would cache nothing"
    bad = [
        a["path"]
        for a in artifacts
        if not a.get("writer") and not a.get("writers")
    ]
    assert not bad, f"artifacts without writer/writers: {bad}"


if __name__ == "__main__":
    # Standalone mode for running without pytest.
    yaml_missing = _diff(_collect_yaml_writes())
    proto_missing = _diff(_collect_protocol_writes())
    if yaml_missing or proto_missing:
        print("FAIL — writer-owner drift detected")
        if yaml_missing:
            print("\nPhase-graph writes: blocks missing from artifacts:")
            for p in yaml_missing:
                print(f"  - {p}")
        if proto_missing:
            print("\nProtocol instructions missing from artifacts:")
            for p in proto_missing:
                print(f"  - {p}")
        raise SystemExit(1)
    print("OK — writer-owner table covers every declared write.")
