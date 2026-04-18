"""Tests for the backward-routing topology parser (lint task 1.5.2.5)."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from lint_parsers.backward_routing import parse_backward_routing


CLEAN_PROSE = """
# intro

### Backward Edges — Routing Fix

When a later phase finds a problem whose root cause lives earlier, control flows BACKWARD to the authoring phase.

```
PROBLEM FOUND AT                    ROUTES BACK TO
---------------------------------------------------------
Gate 1 (human says "no")        ->   Phase 1 Step 1.0 with feedback
Gate 2 (human says "no")        ->   Phase 2 with feedback
Phase 5 Audit (code issue)      ->   Phase 4 target task
```

footer
"""

CLEAN_YAML = """
version: 1
backward_routing:
  - from: GATE-1-NO
    to: phase-1.step-1.0
    note: Brainstorm Facilitator r1 with feedback
  - from: GATE-2-NO
    to: phase-2
    note: with user feedback
  - from: phase-5-audit-code-issue
    to: phase-4.target-task
"""


def _write_sources(repo: Path, prose: str, yaml_text: str) -> None:
    (repo / "commands").mkdir(parents=True, exist_ok=True)
    (repo / "docs" / "migration").mkdir(parents=True, exist_ok=True)
    (repo / "commands" / "build.md").write_text(textwrap.dedent(prose).lstrip("\n"))
    (repo / "docs" / "migration" / "phase-graph.yaml").write_text(
        textwrap.dedent(yaml_text).lstrip("\n")
    )


@pytest.mark.unit
def test_clean_sources_produce_no_issues(tmp_path: Path) -> None:
    _write_sources(tmp_path, CLEAN_PROSE, CLEAN_YAML)

    issues = parse_backward_routing(tmp_path)

    assert issues == [], [i.message for i in issues]


@pytest.mark.unit
def test_edge_only_in_prose_is_reported(tmp_path: Path) -> None:
    prose_with_extra = CLEAN_PROSE.replace(
        "Phase 5 Audit (code issue)      ->   Phase 4 target task",
        'Phase 5 Audit (code issue)      ->   Phase 4 target task\n'
        'Phase 5 Audit (design issue)    ->   Phase 3 target step',
    )
    _write_sources(tmp_path, prose_with_extra, CLEAN_YAML)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "prose_only_edge" in kinds


@pytest.mark.unit
def test_edge_only_in_yaml_is_reported(tmp_path: Path) -> None:
    yaml_with_extra = CLEAN_YAML + (
        "  - from: phase-5-audit-design-issue\n"
        "    to: phase-3.target-step\n"
    )
    _write_sources(tmp_path, CLEAN_PROSE, yaml_with_extra)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "yaml_only_edge" in kinds


@pytest.mark.unit
def test_target_phase_mismatch_is_reported(tmp_path: Path) -> None:
    diverged_yaml = CLEAN_YAML.replace(
        "to: phase-4.target-task", "to: phase-2"
    )
    _write_sources(tmp_path, CLEAN_PROSE, diverged_yaml)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "target_mismatch" in kinds


@pytest.mark.unit
def test_missing_prose_section_is_reported(tmp_path: Path) -> None:
    prose_without_section = "# build.md\n\nSome intro text.\n\nNo backward routing here.\n"
    _write_sources(tmp_path, prose_without_section, CLEAN_YAML)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "prose_section_missing" in kinds


@pytest.mark.unit
def test_missing_yaml_section_is_reported(tmp_path: Path) -> None:
    yaml_without_section = "version: 1\nphases: []\n"
    _write_sources(tmp_path, CLEAN_PROSE, yaml_without_section)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "yaml_section_missing" in kinds


@pytest.mark.unit
def test_prose_section_present_but_no_edges_is_reported(tmp_path: Path) -> None:
    """Section header present but body has no matching rows — regex regression sentinel."""
    prose_header_only = (
        "# build\n\n"
        "### Backward Edges — Routing Fix\n\n"
        "The table has been temporarily removed pending reformat.\n"
        "No arrows in this body.\n\n"
        "---\n"
    )
    _write_sources(tmp_path, prose_header_only, CLEAN_YAML)

    issues = parse_backward_routing(tmp_path)

    kinds = [i.kind for i in issues]
    assert "prose_edges_empty" in kinds
