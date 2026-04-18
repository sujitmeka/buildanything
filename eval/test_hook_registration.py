#!/usr/bin/env python3
"""Validate that all required hooks are registered in hooks.json with correct matchers/types."""
from __future__ import annotations

import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOOKS_JSON = ROOT / "hooks" / "hooks.json"
RESULTS_DIR = ROOT / "eval" / "results"

REQUIRED = {
    "SessionStart": {"matcher": r"startup|resume|clear|compact", "type": "command"},
    "PreToolUse":   {"matcher": r"Write|Edit",                   "type": "command"},
    "SubagentStart": {"matcher": r".*",                          "type": "command"},
    "SubagentStop":  {"matcher": r".*",                          "type": "command"},
    "PreCompact":    {"matcher": r".*",                          "type": "prompt"},
}

SHELL_WRAPPERS = ["hooks/session-start", "hooks/pre-tool-use",
                  "hooks/subagent-start", "hooks/subagent-stop"]

def run() -> list[dict]:
    checks: list[dict] = []
    def check(name: str, ok: bool, detail: str = ""):
        checks.append({"name": name, "pass": ok, "detail": detail})

    data = json.loads(HOOKS_JSON.read_text())["hooks"]

    # 1 — required hooks present with correct matchers
    for event, spec in REQUIRED.items():
        entries = data.get(event, [])
        check(f"{event}_present", len(entries) > 0, f"found {len(entries)} entry(ies)")
        if entries:
            check(f"{event}_matcher", entries[0]["matcher"] == spec["matcher"],
                  f"expected {spec['matcher']!r}, got {entries[0]['matcher']!r}")

    # 2 — hook commands resolve to actual files
    for wrapper in SHELL_WRAPPERS:
        check(f"shell_{Path(wrapper).name}_exists", (ROOT / wrapper).exists())
    # TS handlers referenced by shell wrappers
    for wrapper in SHELL_WRAPPERS:
        text = (ROOT / wrapper).read_text() if (ROOT / wrapper).exists() else ""
        for ts in re.findall(r'hooks/[a-z\-]+\.ts', text):
            check(f"ts_{Path(ts).stem}_exists", (ROOT / ts).exists(), ts)

    # 3 — hook types are correct
    for event, spec in REQUIRED.items():
        entries = data.get(event, [])
        if entries:
            hook_type = entries[0]["hooks"][0]["type"]
            check(f"{event}_type", hook_type == spec["type"],
                  f"expected {spec['type']!r}, got {hook_type!r}")

    # 4 — no duplicate registrations per event type
    dupes = [e for e, v in data.items() if len(v) > 1]
    check("no_duplicate_registrations", len(dupes) == 0,
          f"duplicates: {dupes}" if dupes else "")

    return checks

def main() -> int:
    checks = run()
    passed = sum(c["pass"] for c in checks)
    total = len(checks)
    ok = passed == total

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    result = {"passed": passed, "total": total, "ok": ok, "checks": checks}
    (RESULTS_DIR / "hook-registration.json").write_text(json.dumps(result, indent=2) + "\n")

    print(f"Hook registration: {passed}/{total} checks passed {'✓' if ok else '✗'}")
    for c in checks:
        mark = "✓" if c["pass"] else "✗"
        detail = f"  ({c['detail']})" if c["detail"] else ""
        print(f"  {mark} {c['name']}{detail}")
    return 0 if ok else 1

if __name__ == "__main__":
    sys.exit(main())
