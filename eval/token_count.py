"""Token counts per markdown file. Flags oversized prompts."""
from __future__ import annotations
import argparse
import csv
import sys
from common import iter_markdown_files, rel, read

try:
    import tiktoken
    ENC = tiktoken.get_encoding("cl100k_base")
    count = lambda s: len(ENC.encode(s))
except ImportError:
    # Fallback: ~4 chars/token approximation
    count = lambda s: max(1, len(s) // 4)


BUDGETS = {
    "agents": 3000,
    "commands": 2000,
    "protocols": 2500,
    "skills": 4000,
}


def analyze():
    rows = []
    for p in iter_markdown_files():
        fm, body = read(p)
        tokens = count(body)
        fm_tokens = count(str(fm))
        category = rel(p).split("/")[0]
        budget = BUDGETS.get(category, 3000)
        rows.append({
            "file": rel(p),
            "category": category,
            "body_tokens": tokens,
            "frontmatter_tokens": fm_tokens,
            "total": tokens + fm_tokens,
            "budget": budget,
            "over_budget": tokens + fm_tokens > budget,
        })
    return sorted(rows, key=lambda r: -r["total"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=0, help="show top N")
    ap.add_argument("--csv", help="write CSV to path")
    ap.add_argument("--over", action="store_true", help="only over-budget files")
    args = ap.parse_args()

    rows = analyze()
    if args.over:
        rows = [r for r in rows if r["over_budget"]]
    if args.top:
        rows = rows[: args.top]

    if args.csv:
        with open(args.csv, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=rows[0].keys())
            w.writeheader()
            w.writerows(rows)

    total = sum(r["total"] for r in rows)
    over = sum(1 for r in rows if r["over_budget"])
    print(f"{'FILE':<60} {'CAT':<12} {'TOKENS':>8} {'BUDGET':>8} {'OVER'}")
    for r in rows:
        flag = "!" if r["over_budget"] else ""
        print(f"{r['file'][:59]:<60} {r['category']:<12} {r['total']:>8} {r['budget']:>8} {flag}")
    print(f"\nfiles: {len(rows)} | total: {total:,} tokens | over budget: {over}")


if __name__ == "__main__":
    main()
