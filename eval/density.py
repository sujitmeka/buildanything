"""Prompt readability + instruction density."""
from __future__ import annotations
import re
from common import iter_markdown_files, read, rel

try:
    import textstat
except ImportError:
    raise SystemExit("pip install textstat")

IMPERATIVES = re.compile(
    r"\b(must|should|never|always|do not|don't|avoid|ensure|require[sd]?|mandatory)\b",
    re.IGNORECASE,
)


def main():
    rows = []
    for p in iter_markdown_files():
        _, body = read(p)
        words = len(body.split())
        if words < 20:
            continue
        imp = len(IMPERATIVES.findall(body))
        grade = textstat.flesch_kincaid_grade(body)
        density = imp / max(words, 1) * 1000  # per 1000 words
        rows.append((rel(p), words, grade, density))

    rows.sort(key=lambda r: -r[3])
    print(f"{'FILE':<60} {'WORDS':>7} {'GRADE':>6} {'IMP/1K':>8}")
    for f, w, g, d in rows:
        flag = ""
        if d > 40:
            flag = "  nagging?"
        elif d < 5:
            flag = "  vague?"
        if g > 16:
            flag += "  dense"
        print(f"{f[:59]:<60} {w:>7} {g:>6.1f} {d:>8.1f}{flag}")


if __name__ == "__main__":
    main()
