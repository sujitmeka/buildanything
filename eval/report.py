"""Run all analyses and append to report.md (running log)."""
from __future__ import annotations
import io
import contextlib
import datetime
import json
import sys
from pathlib import Path

import yaml

import token_count as tk
import refs as rf
import graph as gr
import lint_frontmatter as lf
import density as dn
import simulate as sm
import skill_access as sa


def capture(fn, *args, **kwargs) -> str:
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            fn(*args, **kwargs)
        except SystemExit:
            pass
    return buf.getvalue()


def run_simulations() -> str:
    here = Path(__file__).parent
    calib = json.loads((here / "calibration.json").read_text())
    out = []
    for wf in sorted((here / "workflows").glob("*.yaml")):
        result = sm.simulate(wf, calib)
        out.append(f"### {result['workflow']} (model={result['model']})\n")
        out.append(f"{'PHASE':<20} {'TURNS':>6} {'STATIC':>8} {'TOOLS':>8} {'OUTPUT':>8} {'IN_TOT':>10} {'$':>8}")
        total_cost = 0
        total_in = 0
        for r in result["phases"]:
            out.append(f"{r['phase']:<20} {r['turns']:>6} {r['static_tokens']:>8} "
                       f"{r['tool_tokens']:>8} {r['output_tokens']:>8} {r['total_input']:>10} "
                       f"{r['cost_usd']:>8.3f}")
            total_cost += r["cost_usd"]
            total_in += r["total_input"]
        out.append(f"\nTotal input tokens: {total_in:,}")
        out.append(f"Total cost: ${total_cost:.2f}\n")
    return "\n".join(out)


def main():
    out = Path(__file__).parent / "report.md"
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    sections = [f"\n\n---\n\n# Run: {ts}\n"]
    sections.append("## Token Budget\n```\n" + capture(tk.main) + "\n```\n")
    sections.append("## Frontmatter Lint\n```\n" + capture(lf.main) + "\n```\n")
    sections.append("## Reference Integrity\n```\n" + capture(rf.main) + "\n```\n")
    sections.append("## Orchestration Graph\n```\n" + capture(gr.main) + "\n```\n")
    sections.append("## Skill Access Routing\n```\n" + capture(sa.main) + "\n```\n")
    sections.append("## Readability & Density\n```\n" + capture(dn.main) + "\n```\n")
    sections.append("## Workflow Simulations\n```\n" + run_simulations() + "\n```\n")

    # Create header on first run
    if not out.exists():
        out.write_text("# Plugin Evaluation — Running Log\n\n"
                       "_Deterministic static analysis. Each run appends a new section below._\n")

    # Append
    with out.open("a") as f:
        f.write("\n".join(sections))
    print(f"Appended run {ts} to {out}")


if __name__ == "__main__":
    # Reset args so sub-mains don't inherit argv
    sys.argv = [sys.argv[0]]
    main()
