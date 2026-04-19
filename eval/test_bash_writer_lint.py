#!/usr/bin/env python3
"""Eval: agent-role writer must declare Write/Edit/MultiEdit in frontmatter.

Closes a META-level security hole in the writer-owner enforcement chain.

The hook at ``hooks/pre-tool-use.ts`` defines
``WATCHED_TOOLS = new Set(["Write", "Edit", "MultiEdit"])``. Only those three
tool calls trip the writer-owner default-deny. An agent whose frontmatter
``tools:`` list contains ``Bash`` but NOT Write/Edit/MultiEdit can still
write files via shell redirection (``echo ... > path``, ``jq ... > path``,
``tee path``, ``python3 -c "open(...)"``) and the hook will never see those
writes — every writer-owner declaration in ``phase-graph.yaml`` is silently
bypassed.

Expanding ``WATCHED_TOOLS`` to include ``Bash`` and parsing argv for
write-intent is non-trivial and prone to false positives that would block
legitimate Bash commands. This eval enforces a cheaper static guarantee
instead: **if an agent is named as an agent-role writer in the artifacts
table, it MUST declare at least one of Write/Edit/MultiEdit in its
frontmatter.** That way the deny-by-default branch in the hook actually
fires when the agent attempts a write through the watched path.

Bycatch: also asserts every agent-role writer token in the artifacts table
resolves to an existing ``agents/<token>.md`` file — catches typos and
orphaned references.

Phase tokens (``phase-1``, ``every-phase``, ``phase-6-aggregator``, ...)
are NOT enforced here. The hook does phase-match for those, not agent-role
match, so they don't need Write in any frontmatter.

Run: ``pytest -v eval/test_bash_writer_lint.py``
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
PHASE_GRAPH = ROOT / "docs" / "migration" / "phase-graph.yaml"
AGENTS_DIR = ROOT / "agents"

# Tool names that satisfy the writer-owner watched-tool requirement. Mirror of
# WATCHED_TOOLS in hooks/pre-tool-use.ts. If you add a tool here you are
# loosening the lint; do not do that without first widening WATCHED_TOOLS.
WATCHED_WRITE_TOOLS: frozenset[str] = frozenset({"Write", "Edit", "MultiEdit"})

# Allowlist of writer tokens that are NOT subagent-type names. Combination of:
#   - phase identifiers the hook matches via phase-match, not agent-role match
#   - non-agent pseudo-writers (mirror of NON_AGENT_OWNER_PSEUDOS in
#     hooks/pre-tool-use.ts, plus the ``user`` and ``resume`` tokens that
#     appear in writers-adjacent prose but never in agent-role enforcement)
NON_AGENT_WRITER_ALLOWLIST: frozenset[str] = frozenset(
    {
        # Phase tokens
        "phase-0",
        "phase-1",
        "phase-2",
        "phase-3",
        "phase-4",
        "phase-5",
        "phase-6",
        "phase-6-aggregator",
        "phase-7",
        # Cross-phase pseudos
        "every-phase",
        "auto-rendered-view",
        "all-subagents-auto",
        # Orchestrator-side roles (run in main context, not as subagents)
        "orchestrator",
        "orchestrator-scribe",
        # Reader-only tokens that show up in writer-adjacent fields in some
        # narrative blocks; harmless to allowlist defensively.
        "user",
        "resume",
    }
)

# Frontmatter delimiter — same convention as eval/common.py.
_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)", re.DOTALL)


def _load_phase_graph() -> dict:
    return yaml.safe_load(PHASE_GRAPH.read_text())


def _collect_writer_tokens() -> set[str]:
    """Return the union of every string token that appears under ``writer:``
    or ``writers:`` in the top-level ``artifacts:`` table.

    The artifacts table is the compiler-authoritative writer-owner source —
    it's what ``hooks/compile-writer-owner-cache.ts`` reads. Per-step
    ``writes:`` blocks in the phases section are narrative and are guarded
    separately by ``test_writer_owner_drift.py``; we don't traverse them
    here.
    """
    doc = _load_phase_graph()
    out: set[str] = set()
    for entry in doc.get("artifacts", []):
        writer = entry.get("writer")
        if isinstance(writer, str):
            out.add(writer)
        writers = entry.get("writers")
        if isinstance(writers, list):
            for w in writers:
                if isinstance(w, str):
                    out.add(w)
    return out


def _classify_writer_token(token: str) -> str:
    """Return one of ``"phase_or_pseudo"`` or ``"agent_role"``.

    Tokens in NON_AGENT_WRITER_ALLOWLIST are phase/pseudo. Anything else is
    treated as an agent-role token (a ``subagent_type`` name) and is expected
    to resolve to an ``agents/<token>.md`` file with the right tool list.
    """
    if token in NON_AGENT_WRITER_ALLOWLIST:
        return "phase_or_pseudo"
    return "agent_role"


def _agent_role_writer_tokens() -> list[str]:
    return sorted(
        token
        for token in _collect_writer_tokens()
        if _classify_writer_token(token) == "agent_role"
    )


def _read_frontmatter(agent_md: Path) -> dict:
    """Parse the YAML frontmatter at the top of an agent file.

    Returns ``{}`` if the file has no frontmatter or the frontmatter fails to
    parse — both are caller-visible failure modes the lint should surface as
    "no Write declared".
    """
    text = agent_md.read_text(encoding="utf-8", errors="replace")
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}
    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        return {}
    return fm if isinstance(fm, dict) else {}


def _frontmatter_tools(fm: dict) -> list[str] | None:
    """Return the ``tools`` list from a parsed frontmatter dict.

    Returns ``None`` when ``tools:`` is absent — by Claude Code convention an
    agent without an explicit ``tools:`` declaration inherits ALL tools
    (which DOES include Write/Edit/MultiEdit), so an absent tools field
    satisfies the lint. Returns an empty list when ``tools: []`` was
    written explicitly — that empty case fails the lint.
    """
    if "tools" not in fm:
        return None
    raw = fm["tools"]
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str):
        return [raw]
    return []


def _has_watched_write_tool(tools: list[str] | None) -> bool:
    """``None`` (no ``tools:`` field) means "inherits all tools" → satisfies."""
    if tools is None:
        return True
    return any(t in WATCHED_WRITE_TOOLS for t in tools)


def _writer_paths_for(token: str) -> list[str]:
    """Return every artifact path on which ``token`` is named as a writer.

    Used purely for the failure report so the human reading the test output
    knows which artifacts are at risk if this agent tries to bypass the hook
    via Bash.
    """
    doc = _load_phase_graph()
    paths: list[str] = []
    for entry in doc.get("artifacts", []):
        writer = entry.get("writer")
        writers = entry.get("writers") if isinstance(entry.get("writers"), list) else []
        named: list[str] = []
        if isinstance(writer, str):
            named.append(writer)
        named.extend(w for w in writers if isinstance(w, str))
        if token in named:
            paths.append(entry["path"])
    return paths


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_every_agent_role_writer_token_resolves_to_an_agent_file() -> None:
    """Every subagent-type writer in the artifacts table must map to an
    actual ``agents/<token>.md`` file.

    Catches two failure modes:
      1. Typo in the writer list (``code-review`` vs ``code-reviewer``) —
         silently breaks the writer-owner cache lookup.
      2. Stale reference to an agent that was renamed or deleted — same
         silent breakage.

    Phase tokens and non-agent pseudos are filtered out via
    NON_AGENT_WRITER_ALLOWLIST and not checked here.
    """
    missing: list[str] = []
    for token in _agent_role_writer_tokens():
        if not (AGENTS_DIR / f"{token}.md").exists():
            missing.append(
                f"writer={token!r} → agents/{token}.md does not exist; "
                f"declared as writer of: {_writer_paths_for(token)}"
            )
    assert not missing, (
        "agent-role writer tokens in docs/migration/phase-graph.yaml that "
        "do not resolve to a file in agents/ — these will silently fail the "
        "writer-owner cache lookup at runtime:\n  - " + "\n  - ".join(missing)
    )


def test_every_agent_role_writer_can_use_the_watched_write_path() -> None:
    """Every agent-role writer must declare Write|Edit|MultiEdit in its
    frontmatter so the writer-owner hook is on the watched code path when
    that agent tries to write.

    Why this matters — the security hole this lint closes:
    ``WATCHED_TOOLS = {Write, Edit, MultiEdit}`` in
    hooks/pre-tool-use.ts. An agent whose frontmatter restricts it to
    ``[Read, Bash, ...]`` (no Write) cannot trip the writer-owner deny via
    the watched tools — but Bash redirection (``echo ... > path``,
    ``tee path``, ``python3 -c "open(...)"``) bypasses the hook entirely
    and writes the file anyway. Every writer-owner declaration that names
    such an agent is silently unenforceable.

    Statically guaranteeing every writer-named agent has Write means the
    only path it CAN use to write is the watched one — restoring the
    deny-by-default behaviour at the right moment.
    """
    failures: list[str] = []
    for token in _agent_role_writer_tokens():
        agent_md = AGENTS_DIR / f"{token}.md"
        if not agent_md.exists():
            # Reported by test_every_agent_role_writer_token_resolves_to_an_agent_file.
            continue
        fm = _read_frontmatter(agent_md)
        tools = _frontmatter_tools(fm)
        if _has_watched_write_tool(tools):
            continue
        failures.append(
            f"agent={token!r} tools={tools!r} — declared as writer of "
            f"{_writer_paths_for(token)}; the writer-owner hook only "
            f"enforces on Write|Edit|MultiEdit, so this agent can bypass "
            f"the hook entirely via Bash redirection."
        )
    assert not failures, (
        "agent-role writers missing Write|Edit|MultiEdit in their frontmatter "
        "tools list. The writer-owner hook (hooks/pre-tool-use.ts WATCHED_TOOLS) "
        "only intercepts those three tools; an agent with Bash but no Write can "
        "perform shell-redirection writes that bypass writer-owner enforcement.\n"
        "Either add Write to the agent's frontmatter (so the hook sees the "
        "write attempt) OR remove the agent from the writers list in "
        "docs/migration/phase-graph.yaml (so the artifact is not declared "
        "as agent-role-owned by an agent that cannot use the watched path).\n"
        "  - " + "\n  - ".join(failures)
    )


def test_writer_token_classifier_covers_every_collected_token() -> None:
    """Sanity: every collected writer token classifies as either phase/pseudo
    or agent_role. If a token is neither in NON_AGENT_WRITER_ALLOWLIST nor a
    real agent file, the previous test reports it; this test guards against
    silent mis-classification by ensuring the allowlist hasn't grown stale
    relative to whatever phase tokens phase-graph.yaml introduces.

    Specifically: if a NEW phase token is added (e.g. ``phase-8``) and
    appears as a writer, this test surfaces it as an unrecognized token so
    the maintainer adds it to NON_AGENT_WRITER_ALLOWLIST consciously rather
    than letting the lint quietly demand a (non-existent) ``agents/phase-8.md``.
    """
    pseudo_phase_pattern = re.compile(r"^phase-\d+(?:-[a-z0-9-]+)?$")
    suspicious: list[str] = []
    for token in sorted(_collect_writer_tokens()):
        if token in NON_AGENT_WRITER_ALLOWLIST:
            continue
        if (AGENTS_DIR / f"{token}.md").exists():
            continue
        if pseudo_phase_pattern.match(token):
            suspicious.append(
                f"{token!r} looks like a phase token but is not in "
                f"NON_AGENT_WRITER_ALLOWLIST — add it there or rename it."
            )
    assert not suspicious, (
        "writer tokens that look like phase identifiers but are not in the "
        "NON_AGENT_WRITER_ALLOWLIST. Add them to the allowlist (intentional) "
        "or rename them in phase-graph.yaml:\n  - " + "\n  - ".join(suspicious)
    )


if __name__ == "__main__":
    tokens = _agent_role_writer_tokens()
    print(f"Collected {len(tokens)} agent-role writer token(s):")
    for t in tokens:
        print(f"  - {t}")
    fails: list[str] = []
    for token in tokens:
        agent_md = AGENTS_DIR / f"{token}.md"
        if not agent_md.exists():
            fails.append(f"MISSING FILE: {token}")
            continue
        fm = _read_frontmatter(agent_md)
        tools = _frontmatter_tools(fm)
        if not _has_watched_write_tool(tools):
            fails.append(f"NO WRITE TOOL: {token} tools={tools}")
    if fails:
        print("\nFAIL:")
        for f in fails:
            print(f"  - {f}")
        raise SystemExit(1)
    print("\nOK — every agent-role writer can use the watched write path.")
