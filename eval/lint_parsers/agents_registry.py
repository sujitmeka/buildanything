"""Parse docs/migration/agents.yaml — extract agent specs keyed by name.

Two entry points:

* ``parse_agents_registry(yaml_path)`` — raw dict extractor matching the
  shape used by the other source parsers in this package.
* ``validate_agents_registry(repo)`` — validator conforming to the Parser
  protocol in ``base.py``. Returns ``list[ParseIssue]`` the aggregator
  consumes. Drift rules: prompt_path exists on disk AND resolves inside
  the repo, phase_usage ∈ the top-level phase ids declared in
  ``docs/migration/phase-graph.yaml`` (SSOT — derived, not hard-coded;
  missing/unreadable phase-graph emits ``phase_graph_unreadable`` and
  skips the phase check rather than falling back silently), tool names
  non-empty, no duplicate agent names.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .base import ParseIssue

PARSER_NAME = "agents_registry"
REGISTRY_REL_PATH = "docs/migration/agents.yaml"
PHASE_GRAPH_REL_PATH = "docs/migration/phase-graph.yaml"


@dataclass(frozen=True)
class _PhaseLoadResult:
    """Result of reading the phase-graph SSOT for phase validation."""

    phases: frozenset[str] | None
    error: str | None


def _load_valid_phases(repo: Path) -> _PhaseLoadResult:
    """Return the set of top-level phase ids declared in phase-graph.yaml.

    Returns ``phases=None`` with an error string when the SSOT is missing
    or malformed; the caller emits ``phase_graph_unreadable`` and skips
    phase validation rather than falling back to a stale constant.
    """
    graph_path = repo / PHASE_GRAPH_REL_PATH
    if not graph_path.exists():
        return _PhaseLoadResult(None, f"{PHASE_GRAPH_REL_PATH} not found")
    try:
        data = yaml.safe_load(graph_path.read_text())
    except yaml.YAMLError as exc:
        return _PhaseLoadResult(None, f"yaml parse error: {exc}")
    if not isinstance(data, dict):
        return _PhaseLoadResult(None, "top-level is not a mapping")
    phases = data.get("phases")
    if not isinstance(phases, list):
        return _PhaseLoadResult(None, "'phases:' list missing or not a list")
    ids: set[str] = set()
    for phase in phases:
        if not isinstance(phase, dict):
            continue
        pid = phase.get("id")
        if pid is None:
            continue
        pid_str = str(pid)
        if "." in pid_str:
            continue
        ids.add(pid_str)
    if not ids:
        return _PhaseLoadResult(None, "no top-level phase ids found")
    return _PhaseLoadResult(frozenset(ids), None)


def parse_agents_registry(yaml_path: str | Path) -> dict[str, dict[str, Any]]:
    """Return a dict keyed by agent name with prompt_path, phase_usage, dispatch_modes, tools."""
    with open(yaml_path) as f:
        data = yaml.safe_load(f)
    out: dict[str, dict[str, Any]] = {}
    for entry in (data or {}).get("agents") or []:
        name = entry.get("name")
        if not name:
            continue
        out[name] = {
            "prompt_path": entry.get("prompt_path", ""),
            "phase_usage": [str(p) for p in (entry.get("phase_usage") or [])],
            "dispatch_modes": list(entry.get("dispatch_modes") or []),
            "tools": list(entry.get("tools") or []),
        }
    return out


def get_agents_for_phase(registry: dict[str, dict[str, Any]], phase: str) -> list[str]:
    """Return agent names whose phase_usage includes *phase*."""
    return [name for name, spec in registry.items() if phase in spec.get("phase_usage", [])]


def _prompt_path_issue(
    repo_root: Path, repo_rel: Path, name: str, prompt_path: str, entry_src: str
) -> ParseIssue | None:
    """Validate one ``prompt_path`` — return a ParseIssue or None on success."""
    candidate = (repo_root / prompt_path).resolve()
    try:
        candidate.relative_to(repo_rel)
    except ValueError:
        return ParseIssue(
            parser=PARSER_NAME,
            kind="prompt_path_outside_repo",
            message=(
                f"agent {name!r} prompt_path escapes repo root: {prompt_path}"
            ),
            source=entry_src,
            details={"agent": name, "prompt_path": prompt_path},
        )
    if not candidate.is_file():
        return ParseIssue(
            parser=PARSER_NAME,
            kind="prompt_path_missing",
            message=(
                f"agent {name!r} prompt_path does not exist on disk: "
                f"{prompt_path}"
            ),
            source=entry_src,
            details={"agent": name, "prompt_path": prompt_path},
        )
    return None


def validate_agents_registry(repo: Path) -> list[ParseIssue]:
    """Return a list of drift issues for agents.yaml; empty when clean."""
    registry_path = repo / REGISTRY_REL_PATH
    if not registry_path.exists():
        return [
            ParseIssue(
                parser=PARSER_NAME,
                kind="registry_missing",
                message=f"agents.yaml not found at {REGISTRY_REL_PATH}",
                source=REGISTRY_REL_PATH,
            )
        ]

    try:
        data = yaml.safe_load(registry_path.read_text())
    except yaml.YAMLError as exc:
        return [
            ParseIssue(
                parser=PARSER_NAME,
                kind="yaml_parse_error",
                message=str(exc),
                source=REGISTRY_REL_PATH,
            )
        ]

    if data is None:
        return [
            ParseIssue(
                parser=PARSER_NAME,
                kind="registry_empty",
                message="agents.yaml parsed as empty",
                source=REGISTRY_REL_PATH,
            )
        ]

    agents = data.get("agents") if isinstance(data, dict) else None
    if not isinstance(agents, list):
        return [
            ParseIssue(
                parser=PARSER_NAME,
                kind="schema_violation",
                message="top-level 'agents:' list missing or not a list",
                source=REGISTRY_REL_PATH,
            )
        ]

    issues: list[ParseIssue] = []
    phase_result = _load_valid_phases(repo)
    if phase_result.phases is None:
        issues.append(
            ParseIssue(
                parser=PARSER_NAME,
                kind="phase_graph_unreadable",
                message=(
                    f"cannot derive valid phases from {PHASE_GRAPH_REL_PATH} "
                    f"({phase_result.error}); skipping phase validation"
                ),
                source=PHASE_GRAPH_REL_PATH,
            )
        )

    repo_rel = repo.resolve()
    seen_names: set[str] = set()

    for idx, entry in enumerate(agents):
        entry_src = f"{REGISTRY_REL_PATH}#agents[{idx}]"
        if not isinstance(entry, dict):
            issues.append(
                ParseIssue(
                    parser=PARSER_NAME,
                    kind="schema_violation",
                    message=f"agents[{idx}] is not a mapping",
                    source=entry_src,
                )
            )
            continue

        name = entry.get("name")
        if not isinstance(name, str) or not name.strip():
            issues.append(
                ParseIssue(
                    parser=PARSER_NAME,
                    kind="missing_name",
                    message=f"agents[{idx}] missing or empty 'name'",
                    source=entry_src,
                )
            )
            continue

        if name in seen_names:
            issues.append(
                ParseIssue(
                    parser=PARSER_NAME,
                    kind="duplicate_name",
                    message=f"duplicate agent name: {name}",
                    source=entry_src,
                )
            )
        seen_names.add(name)

        prompt_path = entry.get("prompt_path")
        if not isinstance(prompt_path, str) or not prompt_path.strip():
            issues.append(
                ParseIssue(
                    parser=PARSER_NAME,
                    kind="missing_prompt_path",
                    message=f"agent {name!r} missing 'prompt_path'",
                    source=entry_src,
                )
            )
        else:
            issue = _prompt_path_issue(repo, repo_rel, name, prompt_path, entry_src)
            if issue is not None:
                issues.append(issue)

        for tool in entry.get("tools") or []:
            if not str(tool).strip():
                issues.append(
                    ParseIssue(
                        parser=PARSER_NAME,
                        kind="empty_tool_name",
                        message=f"agent {name!r} has an empty tool name",
                        source=entry_src,
                        details={"agent": name},
                    )
                )

        if phase_result.phases is not None:
            for phase in entry.get("phase_usage") or []:
                phase_str = str(phase)
                if phase_str not in phase_result.phases:
                    issues.append(
                        ParseIssue(
                            parser=PARSER_NAME,
                            kind="invalid_phase",
                            message=(
                                f"agent {name!r} has invalid phase {phase_str!r}; "
                                f"valid: {sorted(phase_result.phases)}"
                            ),
                            source=entry_src,
                            details={"agent": name, "phase": phase_str},
                        )
                    )

    return issues
