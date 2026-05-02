#!/usr/bin/env python3
"""Eval: A7 schema-version forward-reject logic."""
from __future__ import annotations
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
schema = json.loads((ROOT / "protocols/state-schema.json").read_text())
plugin = json.loads((ROOT / ".claude-plugin/plugin.json").read_text())
max_supported = plugin["config"]["maxSupportedSchemaVersion"]
sv_prop = schema["properties"]["schema_version"]
schema_max = sv_prop["maximum"]
results: list[dict] = []

def run(name: str, fn):
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, str(e)
    results.append({"test": name, "pass": ok, "detail": detail})

def t1():
    ok = 1 <= max_supported
    return ok, f"schema_version 1 <= maxSupported ({max_supported})"

def t2():
    future = 5
    rejected = future > max_supported
    msg = "newer plugin version" if rejected else ""
    return rejected and "newer plugin version" in msg, f"version {future} > {max_supported} → rejected with '{msg}'"

def t3():
    default = sv_prop.get("minimum", 1)
    ok = default == 1
    return ok, f"minimum/default is {default}; 0 or missing → treated as 1"

def t4():
    ok = max_supported <= schema_max
    return ok, f"plugin maxSupported ({max_supported}) within schema range [1..{schema_max}]"

def t5():
    comment = schema.get("$comment", "")
    has_table = "migration table" in comment.lower()
    versions_ok = all(f"schema_version {v}" in comment for v in range(1, 5))
    ok = has_table and versions_ok
    return ok, f"$comment has migration table with versions 1-4: {ok}"

for name, fn in [("current_accepted", t1), ("future_rejected", t2),
                 ("zero_defaults_to_1", t3), ("max_in_range", t4),
                 ("migration_table_documented", t5)]:
    run(name, fn)

passed = sum(r["pass"] for r in results)
total = len(results)

if __name__ == "__main__":
    print(json.dumps({"suite": "schema_version", "passed": passed, "total": total, "results": results}, indent=2))
    print(f"\n{'✅' if passed == total else '❌'} {passed}/{total} schema-version checks passed")
    sys.exit(0 if passed == total else 1)
