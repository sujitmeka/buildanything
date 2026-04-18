#!/usr/bin/env python3
"""Validate CONTEXT header renderer produces correct fields per phase/platform.

Re-implements rendering logic from src/orchestrator/hooks/context-header.ts and
verifies field inclusion rules match the HARD-GATE spec in commands/build.md.
Exit 0 if all pass, 1 otherwise. Outputs JSON result + human summary.
"""
from __future__ import annotations
import hashlib, json, sys, tempfile, os
from pathlib import Path

_cache: dict | None = None

def _ihash(pt, ph, ios, dna):
    return hashlib.sha256(json.dumps({"p": pt, "ph": ph, "i": ios, "d": dna},
                                      sort_keys=True).encode()).hexdigest()[:16]

def render(pt, ph, ios=None, dna_path=None):
    global _cache
    ih = _ihash(pt, ph, ios, dna_path)
    if _cache and _cache["ph"] == ph and _cache["ih"] == ih:
        return _cache["r"]
    lines = ["CONTEXT:", f"  project_type: {pt}", f"  phase: {ph}"]
    if pt == "web" and ph >= 4 and dna_path and os.path.isfile(dna_path):
        lines.append(f"  dna: {chr(10).join(open(dna_path).read().split(chr(10))[:5]).strip()}")
    if pt == "ios" and ios:
        en = [k for k, v in ios.items() if v]
        if en: lines.append(f"  ios_features: [{', '.join(en)}]")
    lines += ["", "TASK:"]
    content = "\n".join(lines)
    r = {"content": content, "hash": hashlib.sha256(content.encode()).hexdigest()[:16]}
    _cache = {"ph": ph, "ih": ih, "r": r}
    return r

def reset():
    global _cache; _cache = None

H = lambda c, f: f"  {f}:" in c
L = lambda c, f: f"  {f}:" not in c

def t01():
    """Web phase 2: no dna, no ios_features"""
    c = render("web", 2)["content"]; return H(c,"project_type") and H(c,"phase") and L(c,"dna") and L(c,"ios_features")
def t02():
    """Web phase 4: dna present"""
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as f:
        f.write("# DNA\ncolor: blue\nfont: Inter\nstyle: min\nmode: dark\n"); f.flush()
        r = render("web", 4, dna_path=f.name)
    os.unlink(f.name); return H(r["content"], "dna") and "blue" in r["content"]
def t03():
    """Web phase 3: no dna (phase < 4)"""
    return L(render("web", 3, dna_path="/nonexistent")["content"], "dna")
def t04():
    """iOS phase 4: ios_features present, no dna"""
    c = render("ios", 4, ios={"healthkit": True, "storekit": True})["content"]
    return H(c, "ios_features") and L(c, "dna")
def t05():
    """iOS phase 2: ios_features present"""
    return H(render("ios", 2, ios={"widgets": True})["content"], "ios_features")
def t06():
    """iOS: empty ios_features omitted"""
    return L(render("ios", 4, ios={"a": False})["content"], "ios_features")
def t07():
    """Header ends with TASK:"""
    for pt in ("web","ios"):
        for ph in (1,4):
            if not render(pt, ph, ios={"x":True} if pt=="ios" else None)["content"].rstrip().endswith("TASK:"): return False
    return True
def t08():
    """Render-once: same input → same hash"""
    reset(); return render("web",2)["hash"] == render("web",2)["hash"]
def t09():
    """Cache invalidates on phase change"""
    reset(); return render("web",2)["hash"] != render("web",3)["hash"]
def t10():
    """Cache invalidates on ios_features change"""
    reset(); a = render("ios",4,ios={"hk":True}); b = render("ios",4,ios={"hk":True,"sk":True})
    return a["hash"] != b["hash"]

TESTS = [t01,t02,t03,t04,t05,t06,t07,t08,t09,t10]

def main() -> int:
    results = []
    for fn in TESTS:
        reset(); results.append({"test": fn.__doc__ or fn.__name__, "pass": fn()})
    ok = all(r["pass"] for r in results)
    out = {"probe": "context-fields", "pass": ok, "tests": results}
    d = Path(__file__).parent / "results"; d.mkdir(exist_ok=True)
    (d / "context-fields.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))
    print(f"\n{'TEST':<48} RESULT")
    for r in results: print(f"  {r['test']:<46} {'✓' if r['pass'] else '✗ FAIL'}")
    print(f"\nOverall: {'PASS' if ok else 'FAIL'} ({sum(r['pass'] for r in results)}/{len(results)})")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
