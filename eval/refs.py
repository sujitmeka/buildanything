"""Dead-link / reference integrity checker.

Scans markdown for references to agents/skills/protocols/commands and verifies targets exist.
Filters out:
  - fenced code blocks (``` ... ```)
  - GitHub URL fragments (skills/tree/main/...)
"""
from __future__ import annotations
import re
from common import iter_markdown_files, rel, ROOT

REF_RE = re.compile(
    r"\b(agents|skills|protocols|commands)/([a-zA-Z0-9_\-./]+?)(?:\.md)?(?=[\s`'\"\)\]\},;:]|$)"
)
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
IGNORE_PREFIXES = ("tree/", "blob/")


def strip_code_blocks(text: str) -> str:
    return FENCE_RE.sub("", text)


def resolve(kind: str, name: str) -> bool:
    candidates = [
        ROOT / kind / f"{name}.md",
        ROOT / kind / name,
        ROOT / kind / name / "SKILL.md",
    ]
    return any(c.exists() for c in candidates)


def main():
    broken = []
    total_refs = 0
    skipped = 0
    for p in iter_markdown_files():
        text = strip_code_blocks(p.read_text(encoding="utf-8", errors="replace"))
        seen = set()
        for m in REF_RE.finditer(text):
            kind, name = m.group(1), m.group(2).rstrip("/.")
            if name.startswith(IGNORE_PREFIXES):
                skipped += 1
                continue
            key = (kind, name)
            if key in seen:
                continue
            seen.add(key)
            total_refs += 1
            if not resolve(kind, name):
                broken.append((rel(p), kind, name))

    print(f"Refs scanned: {total_refs} (skipped {skipped} GitHub URL fragments)")
    print(f"Broken refs : {len(broken)}\n")
    for src, kind, name in broken:
        print(f"  {src}  ->  {kind}/{name}  [MISSING]")
    return len(broken)


if __name__ == "__main__":
    import sys
    sys.exit(1 if main() else 0)
