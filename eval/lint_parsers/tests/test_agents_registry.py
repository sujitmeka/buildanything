"""Tests for the agents registry parser (lint task 1.5.2.4)."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from lint_parsers.agents_registry import (
    get_agents_for_phase,
    parse_agents_registry,
    validate_agents_registry,
)


def _write_registry(tmp: Path, body: str) -> str:
    tmp.mkdir(parents=True, exist_ok=True)
    p = tmp / "agents.yaml"
    p.write_text(textwrap.dedent(body).lstrip("\n"))
    return str(p)


SAMPLE = """
version: 1
agents:
  - name: alpha
    prompt_path: agents/alpha.md
    tools: [Read, Write]
    phase_usage: ['1', '2']
    dispatch_modes: [single]
  - name: beta
    prompt_path: agents/beta.md
    tools: [Read]
    phase_usage: ['3']
    dispatch_modes: [single, team]
"""


@pytest.mark.unit
def test_parse_returns_dict_keyed_by_name(tmp_path: Path) -> None:
    path = _write_registry(tmp_path, SAMPLE)
    reg = parse_agents_registry(path)
    assert set(reg.keys()) == {"alpha", "beta"}


@pytest.mark.unit
def test_parse_extracts_fields(tmp_path: Path) -> None:
    path = _write_registry(tmp_path, SAMPLE)
    reg = parse_agents_registry(path)
    assert reg["alpha"]["prompt_path"] == "agents/alpha.md"
    assert reg["alpha"]["phase_usage"] == ["1", "2"]
    assert reg["alpha"]["dispatch_modes"] == ["single"]
    assert reg["alpha"]["tools"] == ["Read", "Write"]


@pytest.mark.unit
def test_get_agents_for_phase(tmp_path: Path) -> None:
    path = _write_registry(tmp_path, SAMPLE)
    reg = parse_agents_registry(path)
    assert get_agents_for_phase(reg, "1") == ["alpha"]
    assert get_agents_for_phase(reg, "3") == ["beta"]
    assert get_agents_for_phase(reg, "99") == []


@pytest.mark.unit
def test_missing_optional_fields(tmp_path: Path) -> None:
    path = _write_registry(
        tmp_path,
        """
        version: 1
        agents:
          - name: minimal
            prompt_path: agents/minimal.md
        """,
    )
    reg = parse_agents_registry(path)
    assert reg["minimal"]["tools"] == []
    assert reg["minimal"]["phase_usage"] == []
    assert reg["minimal"]["dispatch_modes"] == []


# ---------------------------------------------------------------------------
# Validator tests (lint task 1.5.2.4) — repo-rooted ParseIssue contract.
# ---------------------------------------------------------------------------


def _write_repo_registry(repo: Path, body: str) -> None:
    migration = repo / "docs" / "migration"
    migration.mkdir(parents=True, exist_ok=True)
    (migration / "agents.yaml").write_text(textwrap.dedent(body).lstrip("\n"))


def _write_prompt(repo: Path, rel_path: str) -> None:
    prompt = repo / rel_path
    prompt.parent.mkdir(parents=True, exist_ok=True)
    prompt.write_text("# prompt\n")


@pytest.mark.unit
def test_validate_clean_registry_has_no_issues(tmp_path: Path) -> None:
    _write_prompt(tmp_path, "agents/alpha.md")
    _write_prompt(tmp_path, "agents/beta.md")
    _write_repo_registry(tmp_path, SAMPLE)

    assert validate_agents_registry(tmp_path) == []


@pytest.mark.unit
def test_validate_missing_prompt_file_is_reported(tmp_path: Path) -> None:
    _write_repo_registry(
        tmp_path,
        """
        version: 1
        agents:
          - name: ghost
            prompt_path: agents/ghost.md
            tools: [Read]
            phase_usage: ['2']
            dispatch_modes: [single]
        """,
    )

    issues = validate_agents_registry(tmp_path)

    assert "prompt_path_missing" in {i.kind for i in issues}


@pytest.mark.unit
def test_validate_invalid_phase_is_reported(tmp_path: Path) -> None:
    _write_prompt(tmp_path, "agents/alpha.md")
    _write_repo_registry(
        tmp_path,
        """
        version: 1
        agents:
          - name: alpha
            prompt_path: agents/alpha.md
            tools: [Read]
            phase_usage: ['2', '99']
            dispatch_modes: [single]
        """,
    )

    issues = validate_agents_registry(tmp_path)

    assert "invalid_phase" in {i.kind for i in issues}


@pytest.mark.unit
def test_validate_empty_tool_name_is_reported(tmp_path: Path) -> None:
    _write_prompt(tmp_path, "agents/alpha.md")
    _write_repo_registry(
        tmp_path,
        """
        version: 1
        agents:
          - name: alpha
            prompt_path: agents/alpha.md
            tools: [Read, '']
            phase_usage: ['2']
            dispatch_modes: [single]
        """,
    )

    issues = validate_agents_registry(tmp_path)

    assert "empty_tool_name" in {i.kind for i in issues}


@pytest.mark.unit
def test_validate_missing_registry_file_is_reported(tmp_path: Path) -> None:
    issues = validate_agents_registry(tmp_path)

    assert "registry_missing" in {i.kind for i in issues}


@pytest.mark.unit
def test_validate_phase_negative_one_is_valid(tmp_path: Path) -> None:
    _write_prompt(tmp_path, "agents/setup.md")
    _write_repo_registry(
        tmp_path,
        """
        version: 1
        agents:
          - name: setup
            prompt_path: agents/setup.md
            tools: [Read]
            phase_usage: ['-1']
            dispatch_modes: [single]
        """,
    )

    assert validate_agents_registry(tmp_path) == []
