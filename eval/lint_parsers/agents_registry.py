"""Parse docs/migration/agents.yaml — extract agent specs keyed by name.

Two entry points:

* ``parse_agents_registry(yaml_path)`` — raw dict extractor matching the
  shape used by the other source parsers in this package.
* ``validate_agents_registry(repo)`` — validator conforming to the Parser
  protocol in ``base.py``. Returns ``list[ParseIssue]`` the aggregator
  consumes. Drift rules: prompt_path exists on disk, phase_usage ∈ the
  top-level phase ids declared in ``docs/migration/phase-graph.yaml``
  (SSOT — derived, not hard-coded), tool names non-empty, no duplicate
  agent names.
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

# Used only when phase-graph.yaml is absent or unreadable (SSOT itself is
# broken). Kept aligned with the known top-level phases as of the A8 migration.
_FALLBACK_VALID_PHASES: frozenset[str] = frozenset(
    {"-1", "0", "1", "2", "3", "4", "5", "6", "7"}
)


def _load_valid_phases(repo: Path) -> frozenset[str]:
    """Return the set of top-level phase ids declared in phase-graph.yaml."""
    graph_path = repo / PHASE_GRAPH_REL_PATH
    if not graph_path.exists():
        return _FALLBACK_VALID_PHASES
    try:
        data = yaml.safe_load(graph_path.read_text())
    except yaml.YAMLError:
        return _FALLBACK_VALID_PHASES
    if not isinstance(data, dict):
        return _FALLBACK_VALID_PHASES
    phases = data.get("phases")
    if not isinstance(phases, list):
        return _FALLBACK_VALID_PHASES
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
    return frozenset(ids) if ids else _FALLBACK_VALID_PHASES


@dataclass(frozen=True)
class AgentSpec:
    """Typed view of one entry in agents.yaml for downstream consumers."""

    name: str
    prompt_path: str
    tools: tuple[str, ...]
    phase_usage: tuple[str, ...]
    dispatch_modes: tuple[str, ...]


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


def load_agent_specs(repo: Path) -> dict[str, AgentSpec]:
    """Return ``AgentSpec`` records keyed by name. Raises on unreadable registry."""
    registry_path = repo / REGISTRY_REL_PATH
    data = yaml.safe_load(registry_path.read_text())
    specs: dict[str, AgentSpec] = {}
    for entry in (data or {}).get("agents", []) or []:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name")
        if not isinstance(name, str):
            continue
        specs[name] = AgentSpec(
            name=name,
            prompt_path=str(entry.get("prompt_path", "")),
            tools=tuple(str(t) for t in (entry.get("tools") or [])),
            phase_usage=tuple(str(p) for p in (entry.get("phase_usage") or [])),
            dispatch_modes=tuple(str(d) for d in (entry.get("dispatch_modes") or [])),
        )
    return specs


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

    valid_phases = _load_valid_phases(repo)
    issues: list[ParseIssue] = []
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
        elif not (repo / prompt_path).resolve().is_file():
            issues.append(
                ParseIssue(
                    parser=PARSER_NAME,
                    kind="prompt_path_missing",
                    message=(
                        f"agent {name!r} prompt_path does not exist on disk: "
                        f"{prompt_path}"
                    ),
                    source=entry_src,
                    details={"agent": name, "prompt_path": prompt_path},
                )
            )

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

        for phase in entry.get("phase_usage") or []:
            phase_str = str(phase)
            if phase_str not in valid_phases:
                issues.append(
                    ParseIssue(
                        parser=PARSER_NAME,
                        kind="invalid_phase",
                        message=(
                            f"agent {name!r} has invalid phase {phase_str!r}; "
                            f"valid: {sorted(valid_phases)}"
                        ),
                        source=entry_src,
                        details={"agent": name, "phase": phase_str},
                    )
                )

    return issues
