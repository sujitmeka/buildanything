#!/usr/bin/env python3
"""Phase-graph lint aggregator — enforces SSOT between prose and machine-readable sources.

Iterates a registry of parsers (each returning ``list[ParseIssue]``),
collects their output, emits a structured JSON diff, and exits 1 on any
drift. Owned parsers (module A, this session):

* ``agents_registry``   → ``lint_parsers.agents_registry.validate_agents_registry``
* ``backward_routing``  → ``lint_parsers.backward_routing.parse_backward_routing``

KIRO's parsers (1.5.2.1 writer-owner, 1.5.2.2 artifacts, 1.5.2.3
subagent_type) land by editing the ``_build_registry`` function below.

CLI::

    python eval/lint_phase_graph.py                  # human + JSON, repo root
    python eval/lint_phase_graph.py --json           # JSON only to stdout
    python eval/lint_phase_graph.py --parser NAME    # run only one parser
    python eval/lint_phase_graph.py --repo PATH      # point at another tree
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Sequence

from lint_parsers.agents_registry import validate_agents_registry
from lint_parsers.backward_routing import parse_backward_routing
from lint_parsers.base import ParseIssue, ParserRegistration
from lint_parsers.subagent_mappings import validate_subagent_mappings
from lint_parsers.yaml_artifacts import validate_yaml_artifacts

# Script lives at <repo>/eval/lint_phase_graph.py; parents[1] == repo root.
REPO_DEFAULT = Path(__file__).resolve().parents[1]

logger = logging.getLogger(__name__)


def _build_registry() -> list[ParserRegistration]:
    """Return the list of parsers the aggregator invokes, in stable order."""
    return [
        ParserRegistration(
            name="agents_registry",
            fn=validate_agents_registry,
            description="Validate docs/migration/agents.yaml against on-disk reality.",
        ),
        ParserRegistration(
            name="backward_routing",
            fn=parse_backward_routing,
            description="Compare backward-routing edges between build.md and phase-graph.yaml.",
        ),
        # KIRO parsers:
        ParserRegistration(
            name="yaml_artifacts",
            fn=validate_yaml_artifacts,
            description="Compare artifact writer-owner table between build.md and phase-graph.yaml.",
        ),
        ParserRegistration(
            name="subagent_mappings",
            fn=validate_subagent_mappings,
            description="Compare subagent dispatch mappings between build.md and phase-graph.yaml.",
        ),
    ]


def _run_parsers(
    registrations: Sequence[ParserRegistration], repo: Path
) -> list[ParseIssue]:
    """Invoke each parser, wrapping unexpected exceptions as parser_crash issues."""
    issues: list[ParseIssue] = []
    for registration in registrations:
        try:
            parser_issues = registration.fn(repo)
        except Exception as exc:  # noqa: BLE001 — deliberate firewall
            logger.exception("parser %s crashed", registration.name)
            issues.append(
                ParseIssue(
                    parser=registration.name,
                    kind="parser_crash",
                    message=f"{type(exc).__name__}: {exc}",
                    source=None,
                    details={"exception_type": type(exc).__name__},
                )
            )
            continue
        issues.extend(parser_issues)
    return issues


def _emit_json(
    issues: Sequence[ParseIssue], parsers_run: Sequence[str], repo: Path
) -> str:
    payload = {
        "repo": str(repo),
        "parsers_run": list(parsers_run),
        "issue_count": len(issues),
        "issues": [asdict(i) for i in issues],
    }
    return json.dumps(payload, indent=2, sort_keys=False)


def _emit_human(issues: Sequence[ParseIssue], parsers_run: Sequence[str]) -> str:
    if not issues:
        return (
            f"phase-graph lint: OK ({len(parsers_run)} parser(s): "
            f"{', '.join(parsers_run)})"
        )
    lines = [f"phase-graph lint: {len(issues)} issue(s) across {len(parsers_run)} parser(s)"]
    for issue in issues:
        source = f" ({issue.source})" if issue.source else ""
        lines.append(f"  [{issue.parser}:{issue.kind}] {issue.message}{source}")
    return "\n".join(lines)


def main(argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="lint_phase_graph",
        description="Lint: detect drift between prose and machine-readable SSOT.",
    )
    parser.add_argument(
        "--repo",
        type=Path,
        default=REPO_DEFAULT,
        help="Repo root (default: repo containing this script).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON only on stdout; suppress the human-readable summary on stderr.",
    )
    parser.add_argument(
        "--parser",
        action="append",
        default=None,
        metavar="NAME",
        help="Run only the named parser(s). Repeatable.",
    )
    parser.add_argument(
        "--list-parsers",
        action="store_true",
        help="Print the parser registry and exit.",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.WARNING, stream=sys.stderr, format="%(message)s")

    registry = _build_registry()
    known = {r.name for r in registry}

    if args.list_parsers:
        for r in registry:
            sys.stdout.write(f"{r.name}\t{r.description}\n")
        return 0

    if args.parser:
        unknown = [name for name in args.parser if name not in known]
        if unknown:
            sys.stderr.write(
                f"unknown parser(s): {', '.join(unknown)}. "
                f"Known: {', '.join(sorted(known))}\n"
            )
            return 2
        registry = [r for r in registry if r.name in set(args.parser)]

    repo = args.repo.resolve()
    parsers_run = [r.name for r in registry]
    issues = _run_parsers(registry, repo)

    json_output = _emit_json(issues, parsers_run, repo)
    human_output = _emit_human(issues, parsers_run)

    sys.stdout.write(json_output + "\n")
    if not args.json:
        sys.stderr.write(human_output + "\n")

    return 0 if not issues else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
