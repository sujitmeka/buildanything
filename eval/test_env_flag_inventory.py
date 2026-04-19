#!/usr/bin/env python3
"""Eval: env-flag inventory drift guard.

Fails when an enforcement-affecting `BUILDANYTHING_*` env var is read by any
file under ``hooks/`` but is NOT listed in
``hooks/record-mode-transitions.ts``'s ``TRACKED_FLAGS`` constant.

Why this exists: ``hooks/record-mode-transitions.ts`` writes one
``mode_transitions[]`` row per flag flip into ``.build-state.json`` so the
build log carries an audit trail of "what was the enforcement regime at
03:14 when the bad commit landed?". If ``hooks/pre-tool-use.ts`` reads a
flag that the recorder doesn't track, an operator can flip enforcement on
or off mid-run and leave no audit-trail entry. That breaks the audit-trail
contract (incident-postmortem evidence).

The hook source is the AUTHORITATIVE list of flags that exist; the recorder
must follow it. This test makes that follow-the-leader relationship
mechanically enforceable.

Run: ``pytest -v eval/test_env_flag_inventory.py``
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = ROOT / "hooks"
RECORDER = HOOKS_DIR / "record-mode-transitions.ts"

# Flags read in hooks/*.ts that are NOT enforcement toggles. Each exclusion
# carries a one-word reason. Keep this list TIGHT — every entry is a "trust
# me, this isn't a flip-able policy switch" assertion.
NON_ENFORCEMENT_ALLOWLIST: dict[str, str] = {
    "BUILDANYTHING_TASK_ID": "task-id",  # identity, not a policy toggle
    "BUILDANYTHING_BUILD_LOG_PATH": "path",  # build-log path override
    "BUILDANYTHING_STATE_PATH": "path",  # state-file path override
    "BUILDANYTHING_PROJECT_TYPE": "selector",  # web vs ios routing
}

# Regex tuned to the call sites we care about — `process.env.BUILDANYTHING_*`
# (dot form) and `process.env["BUILDANYTHING_*"]` / `process.env['...']`
# (bracket form). Both shapes appear in the hooks today.
_ENV_REF_RE = re.compile(
    r"""process\.env
        (?:\.(?P<dot>BUILDANYTHING_[A-Z0-9_]+)
         |\[\s*["'](?P<bracket>BUILDANYTHING_[A-Z0-9_]+)["']\s*\])
    """,
    re.VERBOSE,
)

# Match `BUILDANYTHING_*` string literals stored in const aliases, e.g.
# `const ENFORCE_ENV = "BUILDANYTHING_ENFORCE_WRITER_OWNER";`. The hook
# pattern reads via `process.env[ENFORCE_ENV]` so the dot/bracket regex
# above misses the actual flag name; this catches the literal.
_CONST_LITERAL_RE = re.compile(
    r"""=\s*["'](?P<flag>BUILDANYTHING_[A-Z0-9_]+)["']"""
)

# Match the TRACKED_FLAGS const array body in the recorder source. Captures
# the bracketed body so we can pull individual quoted flag names out.
_TRACKED_FLAGS_RE = re.compile(
    r"""const\s+TRACKED_FLAGS\s*=\s*\[(?P<body>[^\]]+)\]\s*as\s+const\s*;""",
    re.MULTILINE,
)


def _collect_referenced_flags() -> set[str]:
    """Walk every `hooks/*.ts` file and collect every BUILDANYTHING_* token
    that appears either as a `process.env.X` reference or as a string literal
    bound to a const (which the hook then reads via `process.env[CONST]`).
    """
    found: set[str] = set()
    for ts in sorted(HOOKS_DIR.glob("*.ts")):
        text = ts.read_text()
        for m in _ENV_REF_RE.finditer(text):
            found.add(m.group("dot") or m.group("bracket"))
        for m in _CONST_LITERAL_RE.finditer(text):
            found.add(m.group("flag"))
    return found


def _collect_tracked_flags() -> set[str]:
    """Extract the literal flag names from `TRACKED_FLAGS` in the recorder."""
    text = RECORDER.read_text()
    m = _TRACKED_FLAGS_RE.search(text)
    assert m is not None, (
        f"could not locate `TRACKED_FLAGS = [...]` in {RECORDER}; the "
        "regex extraction may be stale relative to the source"
    )
    body = m.group("body")
    return set(re.findall(r'"(BUILDANYTHING_[A-Z0-9_]+)"', body))


def _enforcement_flags_referenced() -> set[str]:
    """Referenced flags minus the non-enforcement allowlist."""
    referenced = _collect_referenced_flags()
    return {f for f in referenced if f not in NON_ENFORCEMENT_ALLOWLIST}


def test_collection_finds_known_enforcement_flags() -> None:
    """Pin a baseline so a regex regression doesn't silently empty the set.

    Without this, future refactors of `_ENV_REF_RE` could narrow the match
    so far that the inventory test trivially passes against a stub.
    """
    referenced = _collect_referenced_flags()
    expected_baseline = {
        "BUILDANYTHING_ENFORCE_WRITER_OWNER",
        "BUILDANYTHING_ENFORCE_WRITE_LEASE",
        "BUILDANYTHING_SCRIBE_SINGLE_WRITER",
        "BUILDANYTHING_ALLOW_RAW_STATE_WRITES",
        "BUILDANYTHING_STRICT_TASK_ID",
        "BUILDANYTHING_SDK_SPRINT_CONTEXT",
        "BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS",
    }
    missing = expected_baseline - referenced
    assert not missing, (
        f"flag-collection regex regression — these enforcement flags are "
        f"present in hooks/*.ts but the collector did not find them: "
        f"{sorted(missing)}. Found: {sorted(referenced)}"
    )


def test_every_enforcement_flag_is_tracked() -> None:
    """Every BUILDANYTHING_* flag that affects enforcement and is read
    anywhere under hooks/ MUST be listed in TRACKED_FLAGS so a flip is
    captured in the mode_transitions[] audit trail.

    The bug class this catches: a new ENFORCE_* / ALLOW_* / STRICT_* flag
    lands in `hooks/pre-tool-use.ts` (or another hook), an operator flips
    it mid-run, the change of regime never lands in `.build-state.json`,
    and a postmortem can't reconstruct what was enforced when.
    """
    tracked = _collect_tracked_flags()
    referenced = _enforcement_flags_referenced()
    untracked = sorted(referenced - tracked)
    assert not untracked, (
        "enforcement-affecting BUILDANYTHING_* flags read by hooks/ but "
        "missing from TRACKED_FLAGS in hooks/record-mode-transitions.ts. "
        "Operators can flip these without leaving an audit trail in "
        ".build-state.json.mode_transitions[]:\n  - "
        + "\n  - ".join(untracked)
        + "\n\nAdd each to TRACKED_FLAGS, or — if the flag is not actually "
        "an enforcement toggle — add it to NON_ENFORCEMENT_ALLOWLIST in "
        "this test with a one-word reason."
    )


def test_tracked_flags_are_actually_referenced() -> None:
    """Every flag in TRACKED_FLAGS should be referenced by at least one
    hook file. Catches the inverse drift: a flag was removed from the
    hooks but the recorder still wastes a slot tracking it.

    Soft assertion — fails informationally; the real correctness invariant
    is the other direction (test_every_enforcement_flag_is_tracked).
    """
    tracked = _collect_tracked_flags()
    referenced = _collect_referenced_flags()
    orphans = sorted(tracked - referenced)
    assert not orphans, (
        "TRACKED_FLAGS contains flags no hook reads anymore — recorder is "
        "tracking dead state:\n  - " + "\n  - ".join(orphans)
    )


if __name__ == "__main__":
    referenced = _collect_referenced_flags()
    tracked = _collect_tracked_flags()
    enforcement = _enforcement_flags_referenced()
    untracked = sorted(enforcement - tracked)
    orphans = sorted(tracked - referenced)
    print(f"referenced flags ({len(referenced)}):")
    for f in sorted(referenced):
        tag = (
            " [allowlisted]" if f in NON_ENFORCEMENT_ALLOWLIST else ""
        )
        print(f"  - {f}{tag}")
    print(f"\ntracked flags ({len(tracked)}):")
    for f in sorted(tracked):
        print(f"  - {f}")
    if untracked:
        print("\nFAIL — untracked enforcement flags:")
        for f in untracked:
            print(f"  - {f}")
        raise SystemExit(1)
    if orphans:
        print("\nFAIL — orphan tracked flags:")
        for f in orphans:
            print(f"  - {f}")
        raise SystemExit(1)
    print("\nOK — flag inventory in sync.")
