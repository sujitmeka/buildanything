#!/usr/bin/env python3
"""Generate docs/migration/agents.yaml from agent prompt frontmatter + phase-graph.yaml.

Extraction sources:
  - agents/*.md frontmatter (name, tools, model, description line 1)
  - agents/*.md '## Skill Access' section (positive/negative skill refs)
  - docs/migration/phase-graph.yaml (phase_usage, dispatch_modes, artifacts_written,
    team_role if the agent appears as a team teammate slot)

Hand-curated overrides live in eval/calibration.json under
"agent_registry_overrides" — use sparingly, only for utility agents (ios-swift-search,
testing-evidence-collector) whose phase usage isn't captured structurally yet.

Usage:
    python eval/generate_agent_registry.py              # writes docs/migration/agents.yaml
    python eval/generate_agent_registry.py --check      # exits non-zero if out of sync
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

import yaml

REPO = Path(__file__).resolve().parent.parent
AGENTS_DIR = REPO / "agents"
PHASE_GRAPH = REPO / "docs" / "migration" / "phase-graph.yaml"
REGISTRY_OUT = REPO / "docs" / "migration" / "agents.yaml"
CALIBRATION = REPO / "eval" / "calibration.json"

SECTION_RE = re.compile(r"^#{1,6}\s+Skill Access\s*$", re.MULTILINE)
NEXT_HEADER_RE = re.compile(r"^#{1,6}\s+\S", re.MULTILINE)
SKILL_REF_RE = re.compile(r"`(skills/[a-zA-Z0-9_\-./]+?)`")
NEGATIVE_RE = re.compile(r"(?:do\s+not|don[\'']t|never|must\s+not)\s+load", re.I)
LIST_FIELD_RE = re.compile(r"\[(.*?)\]", re.S)


def read_frontmatter(text: str) -> dict[str, str]:
    m = re.match(r"^---\n(.*?)\n---", text, re.S)
    if not m:
        return {}
    block = m.group(1)
    out: dict[str, str] = {}
    for line in block.splitlines():
        fm = re.match(r"^([a-zA-Z_]+):\s*(.+?)\s*$", line)
        if fm:
            out[fm.group(1)] = fm.group(2).strip()
    return out


def parse_tools(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    raw = raw.strip()
    if raw in ("*", "All tools"):
        return ["*"]
    m = LIST_FIELD_RE.search(raw)
    body = m.group(1) if m else raw
    items = [t.strip().strip("\"'") for t in body.split(",")]
    return [t for t in items if t]


def extract_skill_access(text: str) -> str | None:
    m = SECTION_RE.search(text)
    if not m:
        return None
    start = m.end()
    nxt = NEXT_HEADER_RE.search(text, start + 1)
    end = nxt.start() if nxt else len(text)
    return text[start:end]


def classify_skill_refs(section: str) -> tuple[list[str], list[str]]:
    pos: set[str] = set()
    neg: set[str] = set()
    for line in section.splitlines():
        refs = {r.rstrip("/.") for r in SKILL_REF_RE.findall(line)}
        if not refs:
            continue
        if NEGATIVE_RE.search(line):
            neg.update(refs)
        else:
            pos.update(refs)
    return sorted(pos), sorted(neg)


def first_description_line(text: str) -> str:
    m = re.match(r"^---\n.*?\n---\n+(.*?)(?:\n\n|\Z)", text, re.S)
    if not m:
        return ""
    para = m.group(1).strip()
    return para.splitlines()[0][:240] if para else ""


def walk_phase_graph(known: set[str]) -> dict[str, dict[str, Any]]:
    """Return {agent_name: {phase_usage, dispatch_modes, artifacts_written, team_role}}."""
    data = yaml.safe_load(PHASE_GRAPH.read_text())
    phase_usage: dict[str, set[str]] = defaultdict(set)
    dispatch_modes: dict[str, set[str]] = defaultdict(set)
    artifacts: dict[str, set[str]] = defaultdict(set)
    team_roles: dict[str, set[str]] = defaultdict(set)

    def is_phase_id(v: Any) -> bool:
        return isinstance(v, str) and bool(re.match(r"^-?\d+(\.\d+)?$", v)) and len(v) <= 3

    def infer_mode(kind: str | None) -> str:
        if not kind:
            return "single"
        if "parallel" in kind:
            return "parallel"
        if "team" in kind:
            return "team"
        if "loop" in kind:
            return "loop"
        return "single"

    def record_dispatch(name: str, ctx: dict[str, Any], kind: str | None) -> None:
        phase = ctx.get("phase")
        if phase:
            phase_usage[name].add(phase)
        dispatch_modes[name].add(infer_mode(kind or ctx.get("kind")))

    def walk(obj: Any, ctx: dict[str, Any]) -> None:
        if isinstance(obj, dict):
            st = obj.get("subagent_type")
            if isinstance(st, str) and st in known:
                record_dispatch(st, ctx, obj.get("kind"))
            teammates = obj.get("teammates")
            if isinstance(teammates, list):
                for t in teammates:
                    name = t.get("subagent_type") if isinstance(t, dict) else None
                    slot = t.get("slot") if isinstance(t, dict) else None
                    if name in known:
                        phase_usage[name].add(ctx.get("phase", "?"))
                        dispatch_modes[name].add("team")
                        if slot:
                            team_roles[name].add(f"worker:{slot}")
            writes = obj.get("writes")
            if isinstance(writes, list) and ctx.get("subagent_type") in known:
                for w in writes:
                    if isinstance(w, str):
                        artifacts[ctx["subagent_type"]].add(w)
            for k, v in obj.items():
                nc = dict(ctx)
                if k == "id" and is_phase_id(v):
                    nc["phase"] = str(v)
                if k == "kind" and isinstance(v, str):
                    nc["kind"] = v
                if k == "subagent_type" and isinstance(v, str):
                    nc["subagent_type"] = v
                walk(v, nc)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, ctx)
        elif isinstance(obj, str):
            # Match bare agent names inside list values (e.g., dispatches: [feature-intel, ...]).
            # Use word-boundary matching to avoid partial hits ('code-reviewer' in 'code-reviewer-extra').
            for agent in known:
                if re.search(rf"(^|[^a-zA-Z0-9_-]){re.escape(agent)}($|[^a-zA-Z0-9_-])", obj):
                    record_dispatch(agent, ctx, ctx.get("kind"))

    for phase in data.get("phases", []):
        ctx = {"phase": str(phase.get("id", ""))}
        walk(phase, ctx)
    walk(data.get("callable_services", {}), {})

    return {
        name: {
            "phase_usage": sorted(phase_usage.get(name, [])),
            "dispatch_modes": sorted(dispatch_modes.get(name, [])),
            "artifacts_written": sorted(artifacts.get(name, [])),
            "team_roles": sorted(team_roles.get(name, [])),
        }
        for name in known
    }


def load_overrides() -> dict[str, dict[str, Any]]:
    if not CALIBRATION.exists():
        return {}
    try:
        cal = json.loads(CALIBRATION.read_text())
    except json.JSONDecodeError:
        return {}
    return cal.get("agent_registry_overrides", {})


def build_registry() -> dict[str, Any]:
    known = {p.stem for p in AGENTS_DIR.glob("*.md")}
    graph_data = walk_phase_graph(known)
    overrides = load_overrides()

    agents: list[dict[str, Any]] = []
    for path in sorted(AGENTS_DIR.glob("*.md")):
        text = path.read_text()
        fm = read_frontmatter(text)
        name = fm.get("name", path.stem)

        section = extract_skill_access(text)
        positive_skills, negative_skills = ([], [])
        if section:
            positive_skills, negative_skills = classify_skill_refs(section)

        row: dict[str, Any] = {
            "name": name,
            "prompt_path": f"agents/{path.name}",
            "tools": parse_tools(fm.get("tools")),
            "model": fm.get("model"),
            "description": first_description_line(text),
            "phase_usage": graph_data[path.stem]["phase_usage"],
            "dispatch_modes": graph_data[path.stem]["dispatch_modes"],
            "team_roles": graph_data[path.stem]["team_roles"],
            "artifacts_written": graph_data[path.stem]["artifacts_written"],
            "skills_granted": positive_skills,
            "skills_forbidden": negative_skills,
        }
        ov = overrides.get(path.stem, {})
        for k, v in ov.items():
            row[k] = v
        # Drop empty lists and Nones to keep YAML small
        row = {
            k: v
            for k, v in row.items()
            if v not in (None, [], "")
        }
        agents.append(row)

    return {
        "version": 1,
        "source_prose": "agents/<name>.md frontmatter + Skill Access section",
        "phase_graph": "docs/migration/phase-graph.yaml",
        "generator": "eval/generate_agent_registry.py",
        "policy": (
            "Agent prompt files are source of truth for name/tools/model/description/skills. "
            "phase-graph.yaml is source of truth for phase_usage/dispatch_modes/artifacts_written. "
            "Hand overrides for utility agents live in eval/calibration.json "
            "under 'agent_registry_overrides'. Regenerate via "
            "`python eval/generate_agent_registry.py`; lint with `--check`."
        ),
        "agents": agents,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if the generated registry differs from docs/migration/agents.yaml",
    )
    args = parser.parse_args()

    registry = build_registry()
    rendered = yaml.safe_dump(
        registry, sort_keys=False, width=120, allow_unicode=True
    )

    if args.check:
        if not REGISTRY_OUT.exists():
            print(f"{REGISTRY_OUT}: missing — run generator", file=sys.stderr)
            return 1
        current = REGISTRY_OUT.read_text()
        if current != rendered:
            print(f"{REGISTRY_OUT}: out of sync with generator", file=sys.stderr)
            return 1
        print(f"{REGISTRY_OUT}: in sync")
        return 0

    REGISTRY_OUT.write_text(rendered)
    print(f"{REGISTRY_OUT}: wrote {len(registry['agents'])} agents")
    return 0


if __name__ == "__main__":
    sys.exit(main())
