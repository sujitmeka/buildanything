"""P6 — Sprint-context cost probe.

Question: what is the cumulative cost reduction of Shape B (Stages 1-6) vs
the markdown-mode baseline?

Method:
  1. Baseline = markdown-mode (no modifiers, same as P1 SHAPE_MODS["markdown"]).
  2. Variant  = Shape B with all Stages 1-6 applied.
     Stage 6 effect on Phase 4:
       - static_mod  0.74 → 0.55  (sprint context cached, not re-sent per task)
       - dynamic_mod 0.90 → 0.78  (per-task refs block removed, replaced with pointer)
     Stages 1-5 apply the standard Shape B modifiers from P1.
  3. 3-run median with ±10% jitter (same as P1).
  4. Reports per-build (Habita + Pacely) separately.
  5. Stage 5 intermediate result also reported for reference (shows Stages 1-5 sub-total).

Pass condition (FINAL §11.3):
  - strong_pass:  both builds >= 15% cumulative reduction  → ships, C3 lifts to 9
  - marginal_pass: both builds >= 10% reduction            → ships with CEO sign-off
  - single_build_fail: one build < 10%                     → partial ship
  - dual_fail: both builds < 10%                           → Stage 6 does NOT ship
"""
from __future__ import annotations
import json, random, statistics, sys
from dataclasses import replace as dc_replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "eval"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import read  # noqa: E402
from p1_token_cost import (  # noqa: E402
    PhaseSpec, HABITA_PHASES, PACELY_PHASES, CALIB,
    _phase_static_tokens, _phase_dynamic_tokens,
)

try:
    import tiktoken
    _count = lambda s: len(tiktoken.get_encoding("cl100k_base").encode(s))
except ImportError:
    _count = lambda s: max(1, len(s) // 4)

PRICE = dict(CALIB["pricing_per_mtok"])
PRICE.setdefault("sonnet_cache_write", PRICE["sonnet_input"] * 1.25)
PRICE.setdefault("sonnet_cache_read", PRICE["sonnet_input"] * 0.10)
OUTPUT_PER_TURN = CALIB["avg_output_tokens_per_turn"]
CARRY_RATIO = CALIB["context_carry_forward_ratio"]

BUILDS: dict[str, tuple[PhaseSpec, ...]] = {
    "habita": HABITA_PHASES, "pacely": PACELY_PHASES,
}

# -- Markdown baseline (no modifiers — same as P1 SHAPE_MODS["markdown"]) -
MARKDOWN_BASELINE: dict[str, tuple[float, float, bool]] = {
    "default": (1.00, 1.00, True),
}

# -- Shape B Stage 5 modifiers (from P1 SHAPE_MODS["B"]) ------------------
SHAPE_B_STAGE5: dict[str, tuple[float, float, bool]] = {
    "default":         (0.92, 0.95, True),
    "phase1-research": (0.70, 0.88, True),
    "phase2-design":   (0.72, 0.90, True),
    "phase4-impl":     (0.74, 0.90, True),
    "phase6-lrr":      (0.60, 0.85, True),
}

# -- Shape B Stage 6 (sprint-context hoisting on Phase 4) -----------------
# Phase 4: static_mod 0.74→0.55, dynamic_mod 0.90→0.78
# (~60% of Phase 4 prompt bytes served from cache per FINAL §4)
SHAPE_B_STAGE6: dict[str, tuple[float, float, bool]] = {
    **SHAPE_B_STAGE5,
    "phase4-impl":     (0.55, 0.78, True),  # ← Stage 6 reduction
}


def _sim_phase(phase: PhaseSpec, smod: float, dmod: float,
               hoist: bool, carry: int) -> tuple[float, int, int]:
    static = int(_phase_static_tokens(phase) * smod)
    dynamic = int(_phase_dynamic_tokens(phase) * dmod)
    turns = max(1, phase.turns)
    out_tok = OUTPUT_PER_TURN * turns
    dpt = dynamic / turns
    total_in, accum = 0, carry
    for _ in range(turns):
        total_in += static + accum
        accum += dpt
    cw = static if hoist else 0
    cr = static * (turns - 1) if hoist else 0
    fresh = total_in - cw - cr
    cost = (fresh / 1e6 * PRICE["sonnet_input"]
            + cw / 1e6 * PRICE["sonnet_cache_write"]
            + cr / 1e6 * PRICE["sonnet_cache_read"]
            + out_tok / 1e6 * PRICE["sonnet_output"])
    new_carry = int((carry + (dynamic - out_tok) + out_tok) * CARRY_RATIO)
    return cost, int(total_in), new_carry


def _sim_build(build: str, mods: dict, jitter: float) -> dict:
    total_cost, total_in, carry = 0.0, 0, 0
    for ph in BUILDS[build]:
        sm, dm, h = mods.get(ph.name, mods["default"])
        jp = dc_replace(ph,
            turns=max(1, ph.turns + random.choice((-1, 0, 1))),
            tools=tuple((t, max(0, int(n * (1 + random.uniform(-jitter, jitter)))))
                        for t, n in ph.tools)) if jitter > 0 else ph
        c, ti, carry = _sim_phase(jp, sm, dm, h, carry)
        total_cost += c; total_in += ti
    return {"cost": round(total_cost, 4), "input_tokens": total_in}


def _median(build: str, mods: dict, label: str, n: int = 3) -> dict:
    random.seed(42)
    runs = [_sim_build(build, mods, 0.10) for _ in range(n)]
    costs = [r["cost"] for r in runs]
    toks = [r["input_tokens"] for r in runs]
    return {"build": build, "stage": label, "runs": n,
            "cost_usd_median": round(statistics.median(costs), 4),
            "cost_usd_min": round(min(costs), 4),
            "cost_usd_max": round(max(costs), 4),
            "input_tokens_median": int(statistics.median(toks))}


# -- §11.3 outcome classification -----------------------------------------

def classify_outcome(habita_pct: float, pacely_pct: float) -> dict:
    """Classify per FINAL §11.3 pass criteria.

    pct values are negative (e.g., -15.2 means 15.2% reduction).
    """
    h_strong = habita_pct <= -15.0
    p_strong = pacely_pct <= -15.0
    h_marginal = -15.0 < habita_pct <= -10.0
    p_marginal = -15.0 < pacely_pct <= -10.0
    h_fail = habita_pct > -10.0
    p_fail = pacely_pct > -10.0

    if h_strong and p_strong:
        return {"outcome": "strong_pass",
                "action": "Stage 6 ships. C3 lifts to 9.", "ships": True}
    if (h_strong or h_marginal) and (p_strong or p_marginal):
        return {"outcome": "marginal_pass",
                "action": "Stage 6 ships with CEO sign-off. C3 stays at 8.",
                "ships": True, "requires_ceo_signoff": True}
    if (h_strong or h_marginal) and p_fail:
        return {"outcome": "single_build_fail",
                "action": "Stage 6 ships for Habita only; Pacely gated. C3=8.",
                "ships": "partial", "failing_build": "pacely"}
    if h_fail and (p_strong or p_marginal):
        return {"outcome": "single_build_fail",
                "action": "Stage 6 ships for Pacely only; Habita gated. C3=8.",
                "ships": "partial", "failing_build": "habita"}
    return {"outcome": "dual_fail",
            "action": "Stage 6 does NOT ship. On-record: migration delivered ~-10%.",
            "ships": False}


def run() -> dict:
    results: dict[str, dict] = {}
    for build in BUILDS:
        base = _median(build, MARKDOWN_BASELINE, "markdown")
        stage5 = _median(build, SHAPE_B_STAGE5, "stage5")
        var = _median(build, SHAPE_B_STAGE6, "stage6")
        d_usd = round(var["cost_usd_median"] - base["cost_usd_median"], 4)
        d_pct = round(d_usd / base["cost_usd_median"] * 100, 2) if base["cost_usd_median"] else 0.0
        results[build] = {"baseline_markdown": base, "stage5_subtotal": stage5,
                          "variant_stage6": var, "delta_usd": d_usd,
                          "cumulative_pct": d_pct}
    h_pct = results["habita"]["cumulative_pct"]
    p_pct = results["pacely"]["cumulative_pct"]
    return {"probe": "P6", "name": "sprint-context-cost",
            "pass_condition": "FINAL §11.3 — per-build cumulative reduction thresholds",
            "builds": results,
            "habita_cumulative_pct": h_pct, "pacely_cumulative_pct": p_pct,
            "classification": classify_outcome(h_pct, p_pct)}


def main() -> int:
    result = run()
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "p6-sprint-context-cost.json"
    out_path.write_text(json.dumps(result, indent=2))

    cls = result["classification"]
    print(f"P6 result -> {out_path}")
    print(f"\n{'BUILD':<9} {'STAGE':<9} {'COST':>8} {'Δ USD':>9} {'Δ %':>8}")
    print("-" * 46)
    for build, data in result["builds"].items():
        b, s5, v = data["baseline_markdown"], data["stage5_subtotal"], data["variant_stage6"]
        print(f"{build:<9} {'markdown':<9} {b['cost_usd_median']:>8.3f}")
        print(f"{'':<9} {'stage5':<9} {s5['cost_usd_median']:>8.3f}")
        print(f"{'':<9} {'stage6':<9} {v['cost_usd_median']:>8.3f} "
              f"{data['delta_usd']:>+9.3f} {data['cumulative_pct']:>+7.1f}%")
    print(f"\nOutcome : {cls['outcome']}")
    print(f"Action  : {cls['action']}")
    print(f"Ships   : {cls['ships']}")
    return 0 if cls.get("ships") is True else 1


if __name__ == "__main__":
    sys.exit(main())
