"""Shared contract for phase-graph lint parsers.

Every parser in this package consumes the repo root Path and returns a list
of ParseIssue records. The aggregator in eval/lint_phase_graph.py iterates
registered parsers, collects issues, emits structured output, and sets the
process exit code.

Parsers never raise on drift. They raise only on unexpected programmer
error; the aggregator converts such raises into a parser_crash ParseIssue
so one broken parser does not mask drift found by the others.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Protocol


@dataclass(frozen=True)
class ParseIssue:
    """A single drift or validation finding from a lint parser."""

    parser: str
    kind: str
    message: str
    source: str | None = None
    details: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "parser": self.parser,
            "kind": self.kind,
            "message": self.message,
            "source": self.source,
            "details": self.details,
        }


class Parser(Protocol):
    """Callable contract every registered parser satisfies."""

    def __call__(self, repo: Path) -> list[ParseIssue]: ...


@dataclass(frozen=True)
class ParserRegistration:
    """One entry in the aggregator's parser registry."""

    name: str
    fn: Callable[[Path], list[ParseIssue]]
    description: str = ""
