"""Static token-budget simulator for a workflow.

Usage: python simulate.py workflows/example-ios-build.yaml

Models:
  - Static cost per phase: system + CLAUDE.md + agent def + skills (cache-eligible)
  - Dynamic cost per phase: tool results + output (non-cached)
  - Context carry-forward between phases (carry_ratio of prior turn context)
  - Pricing: input / cache-write / cache-read / output separated
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

import yaml

from common import ROOT, read

try:
    import tiktoken
    ENC = tiktoken.get_encoding("cl100k_base")
    count = lambda s: len(ENC.encode(s))
except ImportError:
    count = lambda s: max(1, len(s) // 4)


def tokens_of(path_str: str) -> int:
    p = ROOT / path_str
    if not p.exists():
        return 0
    fm, body = read(p)
    return count(body) + count(str(fm))


def simulate(spec_path: Path, calib: dict) -> dict:
    spec = yaml.safe_load(spec_path.read_text())
    model = spec.get("model", "opus")
    price = calib["pricing_per_mtok"]
    tool_sizes = calib["tool_result_tokens"]
    output_per_turn = calib["avg_output_tokens_per_turn"]
    carry_ratio = calib["context_carry_forward_ratio"]

    results = []
    carry = 0

    for phase in spec["phases"]:
        # Static (cache-eligible) blocks
        static = (
            calib["system_prompt_tokens"]
            + calib["claude_md_tokens"]
            + tokens_of(phase["agent"])
            + sum(tokens_of(s) for s in phase.get("skills", []))
        )

        # Dynamic per turn: tool calls + output
        tool_tokens = sum(tool_sizes.get(t, 500) * n for t, n in phase.get("tools", {}).items())
        turns = phase.get("turns", 5)
        output_tokens = output_per_turn * turns

        # Every turn reads: static (cached after first) + accumulated dynamic so far + carry
        # Approximate total input tokens as sum across turns of (static + growing dynamic + carry).
        dyn_per_turn = (tool_tokens + output_tokens) / turns
        total_input = 0
        accum_dyn = carry
        for _ in range(turns):
            total_input += static + accum_dyn
            accum_dyn += dyn_per_turn

        # Cache model: first turn pays cache_write on static; rest pay cache_read
        cache_write = static
        cache_read = static * (turns - 1)
        fresh_input = total_input - cache_write - cache_read

        m_in = f"{model}_input"
        m_out = f"{model}_output"
        cw = f"{model}_cache_write"
        cr = f"{model}_cache_read"

        cost = (
            fresh_input / 1_000_000 * price[m_in]
            + cache_write / 1_000_000 * price[cw]
            + cache_read / 1_000_000 * price[cr]
            + output_tokens / 1_000_000 * price[m_out]
        )

        results.append({
            "phase": phase["name"],
            "static_tokens": static,
            "tool_tokens": tool_tokens,
            "output_tokens": output_tokens,
            "turns": turns,
            "total_input": int(total_input),
            "cache_write": cache_write,
            "cache_read": int(cache_read),
            "cost_usd": round(cost, 3),
        })

        carry = (carry + tool_tokens + output_tokens) * carry_ratio

    return {"workflow": spec["name"], "model": model, "phases": results}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("workflow", type=Path)
    ap.add_argument("--calib", type=Path, default=Path(__file__).parent / "calibration.json")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    calib = json.loads(args.calib.read_text())
    out = simulate(args.workflow, calib)

    if args.json:
        print(json.dumps(out, indent=2))
        return

    print(f"Workflow: {out['workflow']}  (model={out['model']})\n")
    print(f"{'PHASE':<20} {'TURNS':>6} {'STATIC':>8} {'TOOLS':>8} {'OUTPUT':>8} {'IN_TOT':>10} {'$':>8}")
    total_cost = 0
    total_in = 0
    for r in out["phases"]:
        print(f"{r['phase']:<20} {r['turns']:>6} {r['static_tokens']:>8} "
              f"{r['tool_tokens']:>8} {r['output_tokens']:>8} {r['total_input']:>10} "
              f"{r['cost_usd']:>8.3f}")
        total_cost += r["cost_usd"]
        total_in += r["total_input"]
    print(f"\nTotal input tokens: {total_in:,}")
    print(f"Total cost: ${total_cost:.2f}")
    print(f"% of 200k window at peak: {max(r['total_input']/r['turns'] for r in out['phases']) / 200_000 * 100:.1f}%")


if __name__ == "__main__":
    main()
