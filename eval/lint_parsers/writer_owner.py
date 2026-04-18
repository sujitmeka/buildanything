"""Extract writer-owner mappings from commands/build.md prose and phase-graph.yaml.

Moved verbatim from the original ``eval/lint_phase_graph.py`` so KIRO's
parser 1.5.2.1 remains available as a module when the aggregator replaces
that script. A future task can add a validator here that returns
``list[ParseIssue]``; for now this file holds the two source extractors.
"""

from __future__ import annotations

import re

PROSE_REL_PATH = "commands/build.md"
YAML_REL_PATH = "docs/migration/phase-graph.yaml"

_PFX = re.compile(r"^(?:docs/plans/)?(?:evidence/)?")


def _n(p: str) -> str:
    return _PFX.sub("", p)


def parse_prose_writer_owner(path: str) -> dict:
    """Return ``{path: {'writer': ..., 'readers': [...]}}`` for live downstream docs."""
    text = open(path).read()
    blk = re.search(r"Live downstream docs.*?(?=\nPhase-internal)", text, re.S)
    if not blk:
        return {}
    out: dict = {}
    for m in re.finditer(
        r"`([^`]+)`\s*(?:\([^)]*\)\s*)?(?:—|--)\s*(.+?)(?:\s*/\s*`([^`]+)`\s+(.+?))?$",
        blk.group(),
        re.M,
    ):
        entries = [(m.group(1), m.group(2).strip())]
        if m.group(3):
            entries.append((m.group(3), m.group(4).strip()))
        for p, raw in entries:
            core = re.sub(r"\(.*?\)", "", raw)
            ws = [f"phase-{x}" for x in re.findall(r"P(\d+)", core)]
            if "orchestrator-scribe" in raw.lower():
                ws = ["orchestrator-scribe"]
            out[_n(p)] = {"writer": ws[0] if len(ws) == 1 else ws, "readers": []}
    return out


def parse_yaml_writer_owner(path: str) -> dict:
    """Return ``{path: {'writer': ..., 'readers': [...]}}`` from phase-graph.yaml."""
    out: dict = {}
    cur: dict | None = None
    for line in open(path):
        m = re.match(r"\s+- path:\s+(.+)", line)
        if m:
            cur = {"writer": None, "readers": []}
            out[_n(m.group(1).strip())] = cur
            continue
        if not cur:
            continue
        wm = re.match(r"\s+writers?:\s+(.+)", line)
        if wm:
            v = wm.group(1).strip()
            cur["writer"] = (
                [x.strip() for x in v.strip("[]").split(",")]
                if v.startswith("[")
                else v
            )
        rm = re.match(r"\s+readers:\s+\[(.+)\]", line)
        if rm:
            cur["readers"] = [x.strip() for x in rm.group(1).split(",")]
    return out
