"""Compare artifact writer-owner entries between commands/build.md prose and phase-graph.yaml.

Parser for the phase-graph lint (SSOT infrastructure). Extracts the writer-owner
table from both prose and YAML so the lint can detect drift.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from .base import ParseIssue

PARSER_NAME = "yaml_artifacts"
PROSE_REL_PATH = "commands/build.md"
YAML_REL_PATH = "docs/migration/phase-graph.yaml"

# Matches the "Live downstream docs" bullet list inside the ARTIFACT WRITER-OWNER
# HARD-GATE block.  Each bullet looks like:
#   - `CLAUDE.md`              — P1 writer (then auto-loaded ...)
#   - `decisions.jsonl`        — orchestrator-scribe ONLY via ...
_BULLET_RE = re.compile(
    r"^\s*-\s+`(?P<path>[^`]+)`"       # path in backticks
    r"(?:\s+\((?P<alias>[^)]+)\))?"     # optional alias like (PRD)
    r"\s*—\s*(?P<rest>.+)$",            # everything after the em-dash
    re.MULTILINE,
)

# Extract the writer token from the "rest" portion.  Patterns:
#   "P1 writer"  /  "P2 writer + P3 writer"  /  "orchestrator-scribe ONLY"
#   "P5, P7 writers"  /  "P6 writer (1 per chapter ...)"
_WRITER_RE = re.compile(
    r"(?:P(?P<pnum>\d+)|(?P<named>[a-z][\w-]*))\s+writer",
    re.IGNORECASE,
)

_PHASE_ALIAS = re.compile(r"^phase-?(\d+)$", re.IGNORECASE)


def _normalise_writer(raw: str) -> str:
    """Normalise a writer string to a comparable slug like 'phase-1'."""
    raw = raw.strip().lower()
    m = _PHASE_ALIAS.match(raw)
    if m:
        return f"phase-{m.group(1)}"
    # Handle "P1" shorthand
    m2 = re.match(r"^p(\d+)$", raw, re.IGNORECASE)
    if m2:
        return f"phase-{m2.group(1)}"
    return raw


def parse_prose_artifacts(build_md_path: str) -> list[dict]:
    """Extract artifact path→writer mappings from the build.md prose table."""
    text = Path(build_md_path).read_text()
    entries: list[dict] = []
    for m in _BULLET_RE.finditer(text):
        path = m.group("path").strip()
        rest = m.group("rest")
        writers: list[str] = []
        for wm in _WRITER_RE.finditer(rest):
            if wm.group("pnum"):
                writers.append(f"phase-{wm.group('pnum')}")
            elif wm.group("named"):
                writers.append(_normalise_writer(wm.group("named")))
        # Special case: "orchestrator-scribe ONLY"
        if not writers and "orchestrator-scribe" in rest.lower():
            writers.append("orchestrator-scribe")
        # Special case: "every-phase" / "auto-rendered-view"
        if not writers:
            low = rest.lower()
            for token in ("every-phase", "auto-rendered-view"):
                if token in low:
                    writers.append(token)
                    break
        if writers:
            entries.append({"path": path, "writers": sorted(set(writers))})
    return entries


def parse_yaml_artifacts(yaml_path: str) -> list[dict]:
    """Extract artifact path→writer mappings from phase-graph.yaml."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    if not isinstance(data, dict):
        return []
    entries: list[dict] = []
    for item in data.get("artifacts") or []:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        if not path:
            continue
        writers: list[str] = []
        if item.get("writer"):
            writers.append(_normalise_writer(str(item["writer"])))
        for w in item.get("writers") or []:
            writers.append(_normalise_writer(str(w)))
        if item.get("extended_by"):
            writers.append(_normalise_writer(str(item["extended_by"])))
        if writers:
            entries.append({"path": str(path), "writers": sorted(set(writers))})
    return entries



def validate_yaml_artifacts(repo: Path) -> list[ParseIssue]:
    """Return drift issues between prose and YAML artifact writer-owner tables."""
    issues: list[ParseIssue] = []
    prose_path = repo / PROSE_REL_PATH
    yaml_path = repo / YAML_REL_PATH

    if not prose_path.exists():
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="prose_file_missing",
            message=f"{PROSE_REL_PATH} not found", source=PROSE_REL_PATH))
    if not yaml_path.exists():
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_file_missing",
            message=f"{YAML_REL_PATH} not found", source=YAML_REL_PATH))
    if issues:
        return issues

    prose_entries = parse_prose_artifacts(str(prose_path))
    if not prose_entries:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="prose_artifacts_empty",
            message="No artifact writer-owner entries found in build.md prose",
            source=PROSE_REL_PATH))

    try:
        yaml_entries = parse_yaml_artifacts(str(yaml_path))
    except yaml.YAMLError as exc:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_parse_error",
            message=str(exc), source=YAML_REL_PATH))
        return issues

    if not yaml_entries:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_artifacts_empty",
            message="No artifact entries found in phase-graph.yaml",
            source=YAML_REL_PATH))

    if not prose_entries or not yaml_entries:
        return issues

    prose_map = {e["path"]: e["writers"] for e in prose_entries}
    yaml_map = {e["path"]: e["writers"] for e in yaml_entries}

    # Prose uses short names (e.g. "architecture.md") while YAML uses full
    # paths ("docs/plans/architecture.md").  Build a lookup from basename to
    # full YAML path so we can correlate them.
    yaml_basename_to_full: dict[str, str] = {}
    for yp in yaml_map:
        base = yp.rsplit("/", 1)[-1]
        # Only map unambiguous basenames; skip globs and duplicates.
        if "*" not in base:
            yaml_basename_to_full.setdefault(base, yp)

    # Normalise prose paths: if a prose path isn't in yaml_map directly,
    # check whether its basename matches a YAML full path.
    normalised_prose: dict[str, list[str]] = {}
    for pp, writers in prose_map.items():
        if pp in yaml_map:
            normalised_prose[pp] = writers
        else:
            base = pp.rsplit("/", 1)[-1]
            full = yaml_basename_to_full.get(base)
            if full and full not in prose_map:
                normalised_prose[full] = writers
            else:
                normalised_prose[pp] = writers

    all_paths = sorted(set(normalised_prose) | set(yaml_map))
    for path in all_paths:
        in_prose = path in normalised_prose
        in_yaml = path in yaml_map
        if in_prose and not in_yaml:
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="prose_only",
                message=f"artifact {path!r} is in prose but not in YAML",
                source=PROSE_REL_PATH,
                details={"path": path, "prose_writers": normalised_prose[path]}))
        elif in_yaml and not in_prose:
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="yaml_only",
                message=f"artifact {path!r} is in YAML but not in prose",
                source=YAML_REL_PATH,
                details={"path": path, "yaml_writers": yaml_map[path]}))
        elif normalised_prose[path] != yaml_map[path]:
            issues.append(ParseIssue(
                parser=PARSER_NAME, kind="mismatch",
                message=(
                    f"artifact {path!r} writer mismatch: "
                    f"prose={normalised_prose[path]} yaml={yaml_map[path]}"
                ),
                source=YAML_REL_PATH,
                details={
                    "path": path,
                    "prose_writers": normalised_prose[path],
                    "yaml_writers": yaml_map[path],
                }))

    return issues
