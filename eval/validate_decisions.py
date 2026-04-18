#!/usr/bin/env python3
"""Validate docs/plans/decisions.jsonl rows against docs/migration/decisions.schema.json.

Usage:
    python eval/validate_decisions.py [path/to/decisions.jsonl]

Exits non-zero on any invalid row or malformed JSON. Intended as a CI gate and
pre-migration guardrail: today's decisions.jsonl is written by the model and
drifts run-to-run; the SDK orchestrator will emit the same schema.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

REPO = Path(__file__).resolve().parent.parent
DEFAULT_LOG = REPO / "docs" / "plans" / "decisions.jsonl"
SCHEMA_PATH = REPO / "docs" / "migration" / "decisions.schema.json"


def load_schema() -> Draft7Validator:
    with SCHEMA_PATH.open() as f:
        schema = json.load(f)
    Draft7Validator.check_schema(schema)
    return Draft7Validator(schema, format_checker=FormatChecker())


def validate_file(path: Path, validator: Draft7Validator) -> tuple[int, int]:
    """Return (row_count, error_count). Prints errors to stderr."""
    row_count = 0
    error_count = 0
    seen_ids: set[str] = set()

    with path.open() as f:
        for lineno, raw in enumerate(f, start=1):
            raw = raw.strip()
            if not raw:
                continue
            row_count += 1
            try:
                row = json.loads(raw)
            except json.JSONDecodeError as e:
                error_count += 1
                print(f"{path}:{lineno}: invalid JSON: {e}", file=sys.stderr)
                continue

            errors = sorted(validator.iter_errors(row), key=lambda e: e.path)
            for err in errors:
                error_count += 1
                loc = "/".join(str(p) for p in err.path) or "<root>"
                print(
                    f"{path}:{lineno}: schema violation at {loc}: {err.message}",
                    file=sys.stderr,
                )

            decision_id = row.get("decision_id")
            if decision_id:
                if decision_id in seen_ids:
                    error_count += 1
                    print(
                        f"{path}:{lineno}: duplicate decision_id {decision_id!r}",
                        file=sys.stderr,
                    )
                seen_ids.add(decision_id)

    return row_count, error_count


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "path",
        nargs="?",
        default=str(DEFAULT_LOG),
        help="Path to decisions.jsonl (default: docs/plans/decisions.jsonl)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress success summary on stdout",
    )
    args = parser.parse_args()

    log_path = Path(args.path)
    if not log_path.exists():
        print(f"no decisions.jsonl at {log_path} — nothing to validate", file=sys.stderr)
        return 0

    validator = load_schema()
    rows, errors = validate_file(log_path, validator)

    if errors:
        print(f"{log_path}: {errors} violation(s) across {rows} row(s)", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"{log_path}: {rows} row(s) valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
