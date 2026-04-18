"""Validate G3 token-accounting build-log entries.
Usage: python test_token_accounting.py [path/to/build-log.md]
Exit 0 = all checks pass.  Output: JSON + human summary.
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

CALIB = json.loads((Path(__file__).parent / "calibration.json").read_text())
PRICE = CALIB["pricing_per_mtok"]
CEILINGS = {"habita": 4.00, "pacely": 5.50}

LINE_RE = re.compile(
    r"^\[(?P<ts>\d{4}-\d{2}-\d{2}T[\d:]+Z)\] "
    r"phase=(?P<phase>\d+) step=(?P<step>[\d.]+) task=(?P<task>\S+) subagent_type=(?P<agent>\S+)\n"
    r"input_tokens=(?P<inp>\d+) output_tokens=(?P<out>\d+) "
    r"cache_read=(?P<cr>\d+) cache_create=(?P<cw>\d+) "
    r"cost_usd=(?P<cost>[\d.]+) cumulative_usd=(?P<cum>[\d.]+)$", re.MULTILINE)

def expected_cost(inp, out, cr, cw, model="sonnet"):
    fresh = max(0, inp - cr - cw)
    cw_p = PRICE.get(f"{model}_cache_write", CALIB.get("sonnet_cache_write_per_mtok", 3.75))
    cr_p = PRICE.get(f"{model}_cache_read", CALIB.get("sonnet_cache_read_per_mtok", 0.30))
    return fresh/1e6*PRICE[f"{model}_input"] + cw/1e6*cw_p + cr/1e6*cr_p + out/1e6*PRICE[f"{model}_output"]

def validate(log_path: Path):
    matches = list(LINE_RE.finditer(log_path.read_text()))
    errors, checks = [], dict.fromkeys(
        ["line_format","cost_calc","cumulative_mono","phase_order","ceo_ceiling"], True)
    if not matches:
        return {"pass": False, "checks": checks, "errors": ["No valid cost lines"], "lines_parsed": 0}
    prev_cum, prev_phase = 0.0, 0
    for m in matches:
        d = m.groupdict()
        inp, out, cr, cw = int(d["inp"]), int(d["out"]), int(d["cr"]), int(d["cw"])
        cost, cum, phase = float(d["cost"]), float(d["cum"]), int(d["phase"])
        exp = expected_cost(inp, out, cr, cw)
        if exp > 0 and abs(cost - exp) / exp > 0.01:
            errors.append(f"step {d['step']}: cost={cost} expected={exp:.4f}"); checks["cost_calc"] = False
        if cum < prev_cum - 1e-6:
            errors.append(f"step {d['step']}: cum {cum} < prev {prev_cum}"); checks["cumulative_mono"] = False
        if phase < prev_phase:
            errors.append(f"step {d['step']}: phase {phase} < prev {prev_phase}"); checks["phase_order"] = False
        prev_cum, prev_phase = cum, phase
    product = "pacely" if "pacely" in log_path.name.lower() else "habita"
    ceiling = CEILINGS[product]
    if prev_cum > ceiling:
        errors.append(f"final ${prev_cum:.2f} > {product} ceiling ${ceiling:.2f}"); checks["ceo_ceiling"] = False
    return {"pass": all(checks.values()), "checks": checks, "errors": errors,
            "lines_parsed": len(matches), "final_cumulative_usd": round(prev_cum, 4),
            "ceiling": ceiling, "product": product}

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("log", nargs="?", type=Path,
                    default=Path(__file__).parent / "fixtures" / "sample-build-log.md")
    args = ap.parse_args()
    if not args.log.exists():
        print(json.dumps({"pass": False, "error": f"{args.log} not found"})); sys.exit(1)
    result = validate(args.log)
    print(json.dumps(result, indent=2))
    tag = "✓ ALL PASSED" if result["pass"] else "✗ FAILURES"
    print(f"\n{tag} — {result['lines_parsed']} lines, ${result['final_cumulative_usd']}"
          f" (ceiling=${result['ceiling']} {result['product']})")
    sys.exit(0 if result["pass"] else 1)

if __name__ == "__main__":
    main()
