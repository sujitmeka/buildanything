#!/usr/bin/env python3
"""Eval: write-lease MCP module logic (Python simulation)."""
from __future__ import annotations
import json, sys, copy
from datetime import datetime, timezone

_leases: list[dict] = []

def reset(): _leases.clear()

def acquire(task_id: str, paths: list[str]) -> dict:
    for ex in _leases:
        overlap = [p for p in paths if p in ex["paths"]]
        if overlap:
            return {"granted": False, "conflict": {"holder": ex["holder"], "paths": overlap}}
    lease = {"holder": task_id, "paths": list(paths), "acquired_at": datetime.now(timezone.utc).isoformat()}
    _leases.append(lease)
    return {"granted": True, "lease": lease}

def release(task_id: str) -> bool:
    for i, l in enumerate(_leases):
        if l["holder"] == task_id: _leases.pop(i); return True
    return False

results: list[dict] = []
def run(name: str, fn):
    reset()
    try: ok, detail = fn()
    except Exception as e: ok, detail = False, str(e)
    results.append({"test": name, "pass": ok, "detail": detail})

def t1():
    r = acquire("task-A", ["src/app.ts"])
    return r["granted"], f"fresh acquire granted={r['granted']}"

def t2():
    acquire("task-A", ["src/app.ts"])
    r = acquire("task-B", ["src/app.ts"])
    return not r["granted"] and r["conflict"]["holder"] == "task-A", \
        f"overlap denied, holder={r.get('conflict',{}).get('holder')}"

def t3():
    r1, r2 = acquire("task-A", ["src/app.ts"]), acquire("task-B", ["src/index.ts"])
    return r1["granted"] and r2["granted"], "non-overlapping paths both granted"

def t4():
    acquire("task-A", ["src/app.ts"]); release("task-A")
    r = acquire("task-B", ["src/app.ts"])
    return r["granted"], f"release then re-acquire granted={r['granted']}"

def t5():
    acquire("task-A", ["src/app.ts"])
    lease = copy.deepcopy(_leases)[0]
    ok = all(k in lease for k in ("holder", "paths", "acquired_at"))
    return ok, f"persistence shape keys: {list(lease.keys())}"

def t6():
    pbx = "ios/project.pbxproj"
    acquire("task-A", [pbx]); r = acquire("task-B", [pbx])
    return not r["granted"] and pbx in r["conflict"]["paths"], \
        f"pbxproj collision: {r.get('conflict',{}).get('paths')}"

for name, fn in [("fresh_acquire", t1), ("overlapping_denied", t2),
                 ("non_overlapping_ok", t3), ("release_reacquire", t4),
                 ("persistence_format", t5), ("pbxproj_collision", t6)]:
    run(name, fn)

passed, total = sum(r["pass"] for r in results), len(results)
print(json.dumps({"suite": "write_lease", "passed": passed, "total": total, "results": results}, indent=2))
print(f"\n{'✅' if passed == total else '❌'} {passed}/{total} write-lease checks passed")
sys.exit(0 if passed == total else 1)
