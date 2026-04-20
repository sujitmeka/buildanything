"""Compare subagent dispatch mappings between commands/build.md prose and phase-graph.yaml.

Parser for the phase-graph lint (SSOT infrastructure). Extracts step→subagent_type
dispatch entries from both prose and YAML so the lint can detect drift.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from .base import ParseIssue

PARSER_NAME = "subagent_mappings"
PROSE_REL_PATH = "commands/build.md"
YAML_REL_PATH = "docs/migration/phase-graph.yaml"

# Matches prose dispatch lines like:
#   subagent_type: `engineering-backend-architect`
#   subagent_type: `code-reviewer`
# Captures the surrounding description to correlate with YAML step ids.
_PROSE_DISPATCH_RE = re.compile(
    r"subagent_type:\s*`(?P<agent>[a-z][\w-]*)`",
    re.IGNORECASE,
)

# Matches step references like "Step 2.2b" or "Step 1.1" in prose headings/context.
_STEP_REF_RE = re.compile(
    r'(?:Step\s+|step\s+|id:\s*["\']?)(?P<step_id>\d[\w.]*)',
    re.IGNORECASE,
)


def parse_prose_subagent_mappings(build_md_path: str) -> list[dict]:
    """Extract step→subagent_type pairs from build.md prose dispatch instructions."""
    text = Path(build_md_path).read_text()
    entries: list[dict] = []
    seen: set[tuple[str, str]] = set()

    # Walk numbered dispatch lines that contain subagent_type
    for m in _PROSE_DISPATCH_RE.finditer(text):
        agent = m.group("agent")
        # Look backward from the match to find the nearest step reference
        preceding = text[max(0, m.start() - 500): m.start()]
        step_matches = list(_STEP_REF_RE.finditer(preceding))
        step_id = step_matches[-1].group("step_id") if step_matches else None
        key = (step_id or "", agent)
        if key not in seen:
            seen.add(key)
            entries.append({"step_id": step_id, "subagent_type": agent})
    return entries


def _walk_yaml_dispatches(data: Any) -> list[dict]:
    """Recursively collect step_id→subagent_type pairs from phase-graph.yaml."""
    if not isinstance(data, dict):
        return []
    entries: list[dict] = []

    for phase in data.get("phases") or []:
        if not isinstance(phase, dict):
            continue
        _collect_from_steps(phase.get("steps") or [], entries)
        # Web / iOS branch steps
        for branch_key in ("web_branch", "ios_branch"):
            branch = phase.get(branch_key)
            if isinstance(branch, dict):
                _collect_from_steps(branch.get("steps") or [], entries)
        # Scaffold steps
        scaffold = phase.get("scaffold")
        if isinstance(scaffold, dict):
            _collect_from_steps(scaffold.get("steps") or [], entries)
        # Per-task flow sub-steps
        per_task = phase.get("per_task_flow")
        if isinstance(per_task, dict):
            _collect_from_steps(per_task.get("sub_steps") or [], entries)
        # Reality check dispatch
        rc = phase.get("reality_check")
        if isinstance(rc, dict):
            dispatch = rc.get("dispatch")
            if isinstance(dispatch, dict) and dispatch.get("subagent_type"):
                entries.append({
                    "step_id": str(phase.get("id", "")),
                    "subagent_type": str(dispatch["subagent_type"]),
                })
        # Chapters (Phase 6)
        chapters = phase.get("chapters")
        if isinstance(chapters, dict):
            for panel_entry in chapters.get("panel") or []:
                if not isinstance(panel_entry, dict):
                    continue
                step_id = str(panel_entry.get("number", ""))
                if panel_entry.get("subagent_type"):
                    entries.append({
                        "step_id": f"6.1-ch{step_id}",
                        "subagent_type": str(panel_entry["subagent_type"]),
                    })
                st = panel_entry.get("subagent_types")
                if isinstance(st, dict):
                    if st.get("primary"):
                        entries.append({
                            "step_id": f"6.1-ch{step_id}",
                            "subagent_type": str(st["primary"]),
                        })
                    if st.get("parallel_sub_dispatch"):
                        entries.append({
                            "step_id": f"6.1-ch{step_id}",
                            "subagent_type": str(st["parallel_sub_dispatch"]),
                        })
    return entries


def _collect_from_steps(steps: list, entries: list[dict]) -> None:
    """Extract subagent_type from a list of step dicts."""
    for step in steps:
        if not isinstance(step, dict):
            continue
        step_id = str(step.get("id", ""))
        # Direct subagent_type
        if step.get("subagent_type"):
            entries.append({
                "step_id": step_id,
                "subagent_type": str(step["subagent_type"]),
            })
        # Dispatches list (parallel dispatches)
        for d in step.get("dispatches") or []:
            if isinstance(d, str):
                entries.append({"step_id": step_id, "subagent_type": d})
            elif isinstance(d, dict) and d.get("subagent_type"):
                entries.append({
                    "step_id": step_id,
                    "subagent_type": str(d["subagent_type"]),
                })
        # Teammates (team dispatches)
        for t in step.get("teammates") or []:
            if isinstance(t, dict) and t.get("subagent_type"):
                entries.append({
                    "step_id": step_id,
                    "subagent_type": str(t["subagent_type"]),
                })
        # Platform-branched subagent_type (e.g. web: {subagent_type: ...})
        for platform in ("web", "ios"):
            branch = step.get(platform)
            if isinstance(branch, dict) and branch.get("subagent_type"):
                entries.append({
                    "step_id": step_id,
                    "subagent_type": str(branch["subagent_type"]),
                })
        # dispatch_table (Phase 4 impl routing)
        dt = step.get("dispatch_table")
        if isinstance(dt, dict):
            for _platform, routes in dt.items():
                if isinstance(routes, dict):
                    for _slot, agent in routes.items():
                        if isinstance(agent, str):
                            # Handle compound "X OR Y" strings
                            parts = agent.split(" OR ")
                            for part in parts:
                                entries.append({
                                    "step_id": step_id,
                                    "subagent_type": part,
                                })
                        elif isinstance(agent, list):
                            for a in agent:
                                entries.append({
                                    "step_id": step_id,
                                    "subagent_type": str(a),
                                })
    return


def parse_yaml_subagent_mappings(yaml_path: str) -> list[dict]:
    """Extract step→subagent_type pairs from phase-graph.yaml."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    return _walk_yaml_dispatches(data)



def validate_subagent_mappings(repo: Path) -> list[ParseIssue]:
    """Return drift issues between prose and YAML subagent dispatch tables."""
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

    prose_entries = parse_prose_subagent_mappings(str(prose_path))
    if not prose_entries:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="prose_mappings_empty",
            message="No subagent_type dispatch entries found in build.md prose",
            source=PROSE_REL_PATH))

    try:
        yaml_entries = parse_yaml_subagent_mappings(str(yaml_path))
    except yaml.YAMLError as exc:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_parse_error",
            message=str(exc), source=YAML_REL_PATH))
        return issues

    if not yaml_entries:
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_mappings_empty",
            message="No subagent_type dispatch entries found in phase-graph.yaml",
            source=YAML_REL_PATH))

    if not prose_entries or not yaml_entries:
        return issues

    # Compare by the set of unique agent names referenced in each source.
    # Step-level correlation is too fragile (prose step refs are approximate),
    # so we compare the global agent roster instead.
    prose_agents = sorted({e["subagent_type"] for e in prose_entries})
    yaml_agents = sorted({e["subagent_type"] for e in yaml_entries})

    prose_set = set(prose_agents)
    yaml_set = set(yaml_agents)

    for agent in sorted(prose_set - yaml_set):
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="prose_only",
            message=f"subagent_type {agent!r} dispatched in prose but absent from YAML",
            source=PROSE_REL_PATH,
            details={"subagent_type": agent}))

    for agent in sorted(yaml_set - prose_set):
        issues.append(ParseIssue(
            parser=PARSER_NAME, kind="yaml_only",
            message=f"subagent_type {agent!r} in YAML but not dispatched in prose",
            source=YAML_REL_PATH,
            details={"subagent_type": agent}))

    return issues
