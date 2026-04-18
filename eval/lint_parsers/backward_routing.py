"""Compare backward-routing edges between commands/build.md prose and phase-graph.yaml.

Parser for the phase-graph lint (A8 SSOT infrastructure). Extracts backward-
routing topology from both prose and YAML so the lint can detect drift.
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from .base import ParseIssue

PARSER_NAME = "backward_routing"
PROSE_REL_PATH = "commands/build.md"
YAML_REL_PATH = "docs/migration/phase-graph.yaml"

_SECTION_RE = re.compile(
    r"^#{2,4}\s+Backward\s+Edges.*$", re.IGNORECASE | re.MULTILINE
)
_SECTION_END = re.compile(r"^(?:---\s*$|##\s)", re.MULTILINE)
_EDGE_RE = re.compile(r"^(?P<fr>.+?)\s*(?:->|→)\s*(?P<to>.+?)\s*$", re.MULTILINE)
_SKIP = re.compile(r"^(?:problem found|[-=\s]+$)", re.IGNORECASE)


def parse_prose_backward_edges(build_md_path: str) -> list[dict]:
    """Regex-parse the backward-routing table from build.md prose."""
    text = Path(build_md_path).read_text()
    m = _SECTION_RE.search(text)
    if m is None:
        return []
    rest = text[m.end():]
    end = _SECTION_END.search(rest)
    body = rest[: end.start()] if end else rest
    edges: list[dict] = []
    for hit in _EDGE_RE.finditer(body):
        fr, to = hit.group("fr").strip().strip("|").strip(), hit.group("to").strip().strip("|").strip()
        if not fr or not to or _SKIP.match(fr):
            continue
        edges.append({"from": fr, "to": to})
    return edges


def parse_yaml_backward_edges(yaml_path: str) -> list[dict]:
    """Walk phases in phase-graph.yaml and collect backward_edges entries."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    if not isinstance(data, dict):
        return []
    edges: list[dict] = []
    # Top-level backward_routing key (flat list form)
    for entry in data.get("backward_routing") or []:
        if isinstance(entry, dict) and entry.get("from") and entry.get("to"):
            edges.append({"from": str(entry["from"]), "to": str(entry["to"])})
    # Per-phase backward_edges key
    for phase in data.get("phases") or []:
        if not isinstance(phase, dict):
            continue
        for entry in phase.get("backward_edges") or []:
            if isinstance(entry, dict) and entry.get("from") and entry.get("to"):
                edges.append({"from": str(entry["from"]), "to": str(entry["to"])})
    return edges



# ---------------------------------------------------------------------------
# Slug-based drift detection (used by lint aggregator + tests)
# ---------------------------------------------------------------------------

_NOISE = frozenset({"with", "the", "a", "an", "on", "for", "by", "feedback"})


def _slug(text: str) -> str:
    """Lowercase, drop noise words, collapse to dash-separated slug.

    Parenthesised content is kept inline (e.g. "code issue") unless it is a
    pure yes/no gate qualifier, in which case the paren is removed and the
    qualifier is appended at the end.
    """
    low = text.lower()
    qualifier = ""
    paren = re.search(r"\(([^)]*)\)", low)
    if paren:
        inner = paren.group(1).strip()
        # Pure gate qualifiers like (human says "no") → append "no"
        if re.search(r'\bno\b', inner) and re.search(r'\bhuman\b', inner):
            qualifier = "no"
            low = re.sub(r"\([^)]*\)", " ", low)
        elif re.search(r'\byes\b', inner) and re.search(r'\bhuman\b', inner):
            qualifier = "yes"
            low = re.sub(r"\([^)]*\)", " ", low)
        else:
            # Keep paren content inline — just strip the parens themselves
            low = low.replace("(", " ").replace(")", " ")
    tokens = [t for t in re.split(r"[^a-z0-9]+", low) if t and t not in _NOISE]
    if qualifier:
        tokens.append(qualifier)
    return re.sub(r"-+", "-", "-".join(tokens)).strip("-")


def parse_backward_routing(repo: Path) -> list[ParseIssue]:
    """Return drift issues between prose and YAML backward-routing sources."""
    issues: list[ParseIssue] = []
    prose_path = repo / PROSE_REL_PATH
    yaml_path = repo / YAML_REL_PATH

    if not prose_path.exists():
        issues.append(ParseIssue(parser=PARSER_NAME, kind="prose_file_missing",
                                 message=f"{PROSE_REL_PATH} not found", source=PROSE_REL_PATH))
    if not yaml_path.exists():
        issues.append(ParseIssue(parser=PARSER_NAME, kind="yaml_file_missing",
                                 message=f"{YAML_REL_PATH} not found", source=YAML_REL_PATH))
    if issues:
        return issues

    # --- prose ---
    prose_edges = parse_prose_backward_edges(str(prose_path))
    if not prose_edges:
        section_match = _SECTION_RE.search(prose_path.read_text())
        if section_match is None:
            issues.append(ParseIssue(parser=PARSER_NAME, kind="prose_section_missing",
                                     message="backward-routing section not found in build.md",
                                     source=PROSE_REL_PATH))

    # --- yaml ---
    try:
        yaml_edges = parse_yaml_backward_edges(str(yaml_path))
    except yaml.YAMLError as exc:
        issues.append(ParseIssue(parser=PARSER_NAME, kind="yaml_parse_error",
                                 message=str(exc), source=YAML_REL_PATH))
        return issues

    yaml_data = yaml.safe_load(yaml_path.read_text())
    has_yaml_section = (
        isinstance(yaml_data, dict)
        and (yaml_data.get("backward_routing") is not None
             or any(isinstance(p, dict) and p.get("backward_edges")
                    for p in yaml_data.get("phases") or []))
    )
    if not has_yaml_section:
        issues.append(ParseIssue(parser=PARSER_NAME, kind="yaml_section_missing",
                                 message="backward_routing: section not found in phase-graph.yaml",
                                 source=YAML_REL_PATH))

    if not prose_edges or not has_yaml_section:
        return issues

    # Build slug-keyed maps for comparison
    prose_map = {_slug(e["from"]): e for e in prose_edges}
    yaml_map = {_slug(e["from"]): e for e in yaml_edges}

    for slug, pe in prose_map.items():
        if slug not in yaml_map:
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="prose_only_edge",
                message=f"edge {pe['from']!r} -> {pe['to']!r} is in prose but not in YAML",
                source=PROSE_REL_PATH,
                details={"trigger": slug, "prose_target": _slug(pe["to"]),
                         "raw": [pe["from"], pe["to"]]}))
        elif _slug(pe["to"]) != _slug(yaml_map[slug]["to"]):
            ye = yaml_map[slug]
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="target_mismatch",
                message=f"edge {pe['from']!r} prose target {pe['to']!r} != yaml target {ye['to']!r}",
                source=YAML_REL_PATH,
                details={"trigger": slug, "prose_target": _slug(pe["to"]),
                         "yaml_target": _slug(ye["to"])}))

    for slug, ye in yaml_map.items():
        if slug not in prose_map:
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="yaml_only_edge",
                message=f"edge {ye['from']!r} -> {ye['to']!r} is in YAML but not in prose",
                source=YAML_REL_PATH,
                details={"trigger": slug, "yaml_target": _slug(ye["to"]),
                         "raw": [ye["from"], ye["to"]]}))

    return issues
