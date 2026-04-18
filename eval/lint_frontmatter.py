"""Validate required frontmatter fields on agents/skills/commands."""
from __future__ import annotations
from common import iter_markdown_files, read, rel

REQUIRED = {
    "agents": ["name", "description"],
    "commands": ["description"],
    "skills": ["name", "description"],
    "protocols": [],
}

RECOMMENDED = {
    "agents": ["model", "tools"],
}


def main():
    issues = 0
    for p in iter_markdown_files():
        category = rel(p).split("/")[0]
        fm, _ = read(p)
        missing = [k for k in REQUIRED.get(category, []) if k not in fm]
        missing_rec = [k for k in RECOMMENDED.get(category, []) if k not in fm]
        if missing:
            issues += 1
            print(f"[MISSING] {rel(p)}: {missing}")
        if missing_rec:
            print(f"[WARN]    {rel(p)}: missing recommended {missing_rec}")
    print(f"\nHard issues: {issues}")
    return issues


if __name__ == "__main__":
    import sys
    sys.exit(1 if main() else 0)
