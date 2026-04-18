"""Shared helpers for eval scripts."""
from __future__ import annotations
import re
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parent.parent
SCAN_DIRS = ["agents", "commands", "protocols", "skills"]

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?(.*)", re.DOTALL)


def iter_markdown_files() -> Iterator[Path]:
    for d in SCAN_DIRS:
        base = ROOT / d
        if not base.exists():
            continue
        for p in base.rglob("*.md"):
            yield p


def split_frontmatter(text: str) -> tuple[dict, str]:
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    import yaml
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        fm = {}
    return fm, m.group(2)


def read(p: Path) -> tuple[dict, str]:
    txt = p.read_text(encoding="utf-8", errors="replace")
    return split_frontmatter(txt)


def rel(p: Path) -> str:
    return str(p.relative_to(ROOT))
