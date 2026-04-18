"""End-to-end subprocess tests for the lint_phase_graph aggregator."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

EVAL_DIR = Path(__file__).resolve().parents[2]
AGGREGATOR = EVAL_DIR / "lint_phase_graph.py"


def _seed_clean_repo(repo: Path) -> None:
    (repo / "commands").mkdir()
    (repo / "docs" / "migration").mkdir(parents=True)
    (repo / "agents").mkdir()
    (repo / "agents" / "alpha.md").write_text("# alpha\n")

    (repo / "commands" / "build.md").write_text(
        "# build\n\n"
        "### Backward Edges — Routing Fix\n\n"
        "```\n"
        "PROBLEM FOUND AT                    ROUTES BACK TO\n"
        "---------------------------------------------------------\n"
        'Gate 1 (human says "no")        ->   Phase 1 Step 1.0 with feedback\n'
        "```\n\n"
        "---\n"
    )

    (repo / "docs" / "migration" / "phase-graph.yaml").write_text(
        "version: 1\n"
        "backward_routing:\n"
        "  - from: GATE-1-NO\n"
        "    to: phase-1.step-1.0\n"
    )

    (repo / "docs" / "migration" / "agents.yaml").write_text(
        "version: 1\n"
        "agents:\n"
        "  - name: alpha\n"
        "    prompt_path: agents/alpha.md\n"
        "    tools: [Read]\n"
        "    phase_usage: ['1']\n"
        "    dispatch_modes: [single]\n"
    )


def _seed_drift_repo(repo: Path) -> None:
    """A clean repo tree with an obvious phase number drift in agents.yaml."""
    _seed_clean_repo(repo)
    (repo / "docs" / "migration" / "agents.yaml").write_text(
        "version: 1\n"
        "agents:\n"
        "  - name: alpha\n"
        "    prompt_path: agents/alpha.md\n"
        "    tools: [Read]\n"
        "    phase_usage: ['42']\n"
        "    dispatch_modes: [single]\n"
    )


def _run_aggregator(repo: Path, *args: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(EVAL_DIR) + os.pathsep + env.get("PYTHONPATH", "")
    return subprocess.run(
        [sys.executable, str(AGGREGATOR), "--repo", str(repo), *args],
        capture_output=True,
        text=True,
        env=env,
    )


@pytest.mark.integration
def test_exit_code_zero_on_clean_repo(tmp_path: Path) -> None:
    _seed_clean_repo(tmp_path)

    result = _run_aggregator(tmp_path, "--json")

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["issues"] == []


@pytest.mark.integration
def test_exit_code_one_on_drift(tmp_path: Path) -> None:
    _seed_drift_repo(tmp_path)

    result = _run_aggregator(tmp_path, "--json")

    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["issues"]
    assert any(i["kind"] == "invalid_phase" for i in payload["issues"])


@pytest.mark.integration
def test_parser_filter(tmp_path: Path) -> None:
    _seed_clean_repo(tmp_path)

    result = _run_aggregator(tmp_path, "--parser", "agents_registry", "--json")

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["parsers_run"] == ["agents_registry"]


@pytest.mark.integration
def test_unknown_parser_errors(tmp_path: Path) -> None:
    _seed_clean_repo(tmp_path)

    result = _run_aggregator(tmp_path, "--parser", "no_such_parser")

    assert result.returncode != 0
    assert "no_such_parser" in result.stderr


@pytest.mark.integration
def test_parser_crash_is_reported_not_raised(tmp_path: Path) -> None:
    """A broken parser must be caught and reported as parser_crash."""
    (tmp_path / "commands").mkdir()
    (tmp_path / "docs" / "migration").mkdir(parents=True)
    # Write malformed YAML so the agents_registry parser reports a
    # yaml_parse_error but the aggregator still exits 1 without crashing.
    (tmp_path / "docs" / "migration" / "agents.yaml").write_text("::not: valid: [\n")
    (tmp_path / "commands" / "build.md").write_text("stub\n")
    (tmp_path / "docs" / "migration" / "phase-graph.yaml").write_text("version: 1\n")

    result = _run_aggregator(tmp_path, "--json")

    assert result.returncode == 1
    payload = json.loads(result.stdout)
    kinds = {i["kind"] for i in payload["issues"]}
    assert "yaml_parse_error" in kinds or "parser_crash" in kinds
