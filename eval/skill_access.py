"""Parser + validator for agent-side declarative skill routing.

The orchestration plugin wires agents to skills via `## Skill Access` sections
in agent prompts (not via Agent-tool dispatch). Each section declares:

  - dispatch variables the agent receives (project_type, phase, dna.*, ios_features.*)
  - gated load rules: "<gate condition> -> `skills/X/Y`"
  - negative rules: "Do NOT load `skills/X/Y`"

This script parses those sections and validates:
  1. Every declared skill target exists (as `skills/X/Y/SKILL.md` or `.md`).
  2. Every agent has a Skill Access section (warn if missing).
  3. Every skill on disk is referenced by at least one agent (orphan skills).
  4. Negative rules point to real skills (so "Do NOT load X" isn't a typo).

Run: python skill_access.py
"""
from __future__ import annotations
import re
from collections import defaultdict
from pathlib import Path
from common import iter_markdown_files, rel, ROOT

SECTION_RE = re.compile(r"^#{1,6}\s+Skill Access\s*$", re.MULTILINE)
NEXT_HEADER_RE = re.compile(r"^#{1,6}\s+\S", re.MULTILINE)
SKILL_REF_RE = re.compile(r"`(skills/[a-zA-Z0-9_\-./]+?)`")
NEGATIVE_RE = re.compile(r"(?:do\s+not|don[\'']t|never|must\s+not)\s+load", re.IGNORECASE)


def extract_skill_access(text: str) -> str | None:
    """Return the Skill Access section body, or None if absent."""
    m = SECTION_RE.search(text)
    if not m:
        return None
    start = m.end()
    nxt = NEXT_HEADER_RE.search(text, start + 1)
    end = nxt.start() if nxt else len(text)
    return text[start:end]


def classify_refs(section: str) -> tuple[set[str], set[str]]:
    """Return (positive_refs, negative_refs) — set of `skills/...` paths."""
    positive: set[str] = set()
    negative: set[str] = set()
    for line in section.splitlines():
        refs = {r.rstrip("/.") for r in SKILL_REF_RE.findall(line)}
        if not refs:
            continue
        if NEGATIVE_RE.search(line):
            negative.update(refs)
        else:
            positive.update(refs)
    # A skill can appear in both positive (gated) and negative (anti-default)
    # on different lines of the same agent — that's fine. Keep both sets.
    return positive, negative


def resolve_skill(ref: str) -> Path | None:
    """Resolve `skills/X/Y` to an actual skill manifest file, or None."""
    candidates = [
        ROOT / f"{ref}.md",
        ROOT / ref / "SKILL.md",
        ROOT / ref,
    ]
    for c in candidates:
        if c.exists():
            return c
    return None


def discover_skills_on_disk() -> set[str]:
    """Every directory under `skills/` containing a SKILL.md is a skill."""
    out: set[str] = set()
    base = ROOT / "skills"
    if not base.exists():
        return out
    for skill_md in base.rglob("SKILL.md"):
        rel_dir = skill_md.parent.relative_to(ROOT).as_posix()
        out.add(rel_dir)
    return out


def analyze() -> dict:
    agents_dir = ROOT / "agents"
    agent_routes: dict[str, dict[str, set[str]]] = {}
    missing_section: list[str] = []
    broken_positive: list[tuple[str, str]] = []
    broken_negative: list[tuple[str, str]] = []
    skills_referenced: set[str] = set()

    for p in agents_dir.glob("*.md"):
        text = p.read_text(encoding="utf-8", errors="replace")
        section = extract_skill_access(text)
        name = rel(p)
        if section is None:
            missing_section.append(name)
            continue
        pos, neg = classify_refs(section)
        agent_routes[name] = {"positive": pos, "negative": neg}
        for ref in pos:
            if resolve_skill(ref) is None:
                broken_positive.append((name, ref))
            skills_referenced.add(ref)
        for ref in neg:
            if resolve_skill(ref) is None:
                broken_negative.append((name, ref))

    skills_on_disk = discover_skills_on_disk()
    referenced_dirs = {r for r in skills_referenced if resolve_skill(r)}
    orphan_skills = sorted(skills_on_disk - referenced_dirs)

    # Fan-in: how many agents route to each skill
    fanin: dict[str, int] = defaultdict(int)
    for routes in agent_routes.values():
        for ref in routes["positive"]:
            fanin[ref] += 1

    return {
        "agent_count": len(list(agents_dir.glob("*.md"))),
        "agents_with_section": len(agent_routes),
        "missing_section": sorted(missing_section),
        "broken_positive": broken_positive,
        "broken_negative": broken_negative,
        "skills_on_disk": len(skills_on_disk),
        "skills_referenced": len(referenced_dirs),
        "orphan_skills": orphan_skills,
        "fanin": fanin,
    }


def main() -> int:
    r = analyze()
    total = r["agent_count"]
    with_sec = r["agents_with_section"]
    print(f"Agents scanned: {total}")
    print(f"  with Skill Access section:    {with_sec}")
    print(f"  missing Skill Access section: {len(r['missing_section'])}")
    for a in r["missing_section"]:
        print(f"    - {a}")

    print(f"\nSkills on disk:     {r['skills_on_disk']}")
    print(f"Skills referenced:  {r['skills_referenced']}")
    print(f"Orphan skills (on disk but no agent routes to them): {len(r['orphan_skills'])}")
    for s in r["orphan_skills"][:30]:
        print(f"  - {s}")
    if len(r["orphan_skills"]) > 30:
        print(f"  ... and {len(r['orphan_skills']) - 30} more")

    print(f"\nBroken positive skill refs: {len(r['broken_positive'])}")
    for agent, ref in r["broken_positive"]:
        print(f"  {agent}  ->  {ref}  [MISSING]")

    print(f"\nBroken negative (Do NOT load) refs: {len(r['broken_negative'])}")
    print("  (harmless but suggests stale anti-default rule)")
    for agent, ref in r["broken_negative"]:
        print(f"  {agent}  -x  {ref}  [MISSING]")

    print(f"\nMost-routed skills (top 15):")
    top = sorted(r["fanin"].items(), key=lambda x: -x[1])[:15]
    for skill, n in top:
        print(f"  {n:>3}  {skill}")

    # Exit non-zero only if positive refs are broken (real bugs)
    return 1 if r["broken_positive"] else 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
