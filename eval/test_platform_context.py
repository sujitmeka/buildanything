#!/usr/bin/env python3
"""Validate iOS and web builds get correct platform-specific context, skills, and protocols."""
from __future__ import annotations

import json, sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT / "eval" / "results"

checks: list[dict] = []

def check(name: str, ok: bool, detail: str = ""):
    checks.append({"name": name, "pass": ok, "detail": detail})

def nonempty(p: Path) -> bool:
    return p.exists() and p.stat().st_size > 0

# --- 1. iOS protocol files exist and are non-empty ---
for name in ["ios-phase-branches.md", "ios-context.md", "ios-frameworks-map.md"]:
    p = ROOT / "protocols" / name
    check(f"ios_protocol_{p.stem}", nonempty(p), str(p.relative_to(ROOT)))
preflight = ROOT / "protocols" / "ios-preflight.md"
if preflight.exists():
    check("ios_protocol_ios-preflight", nonempty(preflight))

# --- 2. Web protocol files exist and are non-empty ---
check("web_protocol_web-phase-branches", nonempty(ROOT / "protocols" / "web-phase-branches.md"))

# --- 3. iOS agents have iOS skills ---
agents_yaml = yaml.safe_load((ROOT / "docs" / "migration" / "agents.yaml").read_text())
agents_by_name = {a["name"]: a for a in agents_yaml["agents"]}

ios_agents = [a for a in agents_yaml["agents"] if "ios" in a["name"]]
for a in ios_agents:
    skills = a.get("skills_granted", [])
    has_ios = any(s.startswith("skills/ios/") for s in skills)
    check(f"ios_agent_skills_{a['name']}", has_ios or len(skills) == 0,
          f"skills: {skills[:3]}..." if skills else "no skills_granted")

swift_arch = agents_by_name.get("ios-swift-architect", {})
swift_skills = swift_arch.get("skills_granted", [])
check("swift_architect_concurrency", any("concurrency" in s for s in swift_skills),
      f"has {[s for s in swift_skills if 'concurrency' in s]}")
check("storekit_specialist_exists", "ios-storekit-specialist" in agents_by_name)

# --- 4. iOS Phase -1 bootstrap ---
ios_branches = (ROOT / "protocols" / "ios-phase-branches.md").read_text()
check("phase_neg1_in_protocol", "Phase -1" in ios_branches or "phase -1" in ios_branches.lower())
check("ios_bootstrap_skill_dir", (ROOT / "skills" / "ios" / "ios-bootstrap").is_dir())

# --- 5. Phase-graph iOS branches ---
pg = yaml.safe_load((ROOT / "docs" / "migration" / "phase-graph.yaml").read_text())
phases_with_ios = []
for phase in pg.get("phases", []):
    pid = str(phase.get("id", ""))
    blob = json.dumps(phase)
    has_ios = phase.get("ios_branch") or phase.get("ios_ship") or '"ios"' in blob
    if has_ios:
        phases_with_ios.append(pid)
for pid in ["1", "2", "3", "4"]:
    check(f"phase_{pid}_ios_branch", pid in phases_with_ios, f"found: {phases_with_ios}")

ios_flags = pg.get("classifications", {}).get("ios_features", {}).get("flags", [])
check("ios_features_16_flags", len(ios_flags) == 16, f"got {len(ios_flags)} flags")

# --- 6. Writer-owner table platform tags ---
artifacts = {a["path"]: a for a in pg.get("artifacts", [])}
design_md = artifacts.get("DESIGN.md", {})
check("design_md_no_platform_constraint", "platform" not in design_md, "DESIGN.md is shared web+iOS; should have no platform key")
check("design_md_writers_include_web_pass2", "design-ui-designer" in (design_md.get("writers") or []))
check("design_md_writers_include_ios_pass2", "ios-swift-ui-design" in (design_md.get("writers") or []))
check("component_manifest_web", artifacts.get("docs/plans/component-manifest.md", {}).get("platform") == "web")

# --- 7. Skill directories ---
ios_dirs = [d for d in (ROOT / "skills" / "ios").iterdir() if d.is_dir()]
web_dirs = [d for d in (ROOT / "skills" / "web").iterdir() if d.is_dir()]
check("ios_skill_dirs_gte_10", len(ios_dirs) >= 10, f"found {len(ios_dirs)}")
check("web_skill_dirs_gte_5", len(web_dirs) >= 5, f"found {len(web_dirs)}")

# --- Output ---
passed = sum(c["pass"] for c in checks)
total = len(checks)
ok = passed == total

RESULTS_DIR.mkdir(parents=True, exist_ok=True)
result = {"passed": passed, "total": total, "ok": ok, "checks": checks}
(RESULTS_DIR / "platform-context.json").write_text(json.dumps(result, indent=2) + "\n")

print(f"Platform context: {passed}/{total} checks passed {'✓' if ok else '✗'}")
for c in checks:
    mark = "✓" if c["pass"] else "✗"
    detail = f"  ({c['detail']})" if c["detail"] else ""
    print(f"  {mark} {c['name']}{detail}")
sys.exit(0 if ok else 1)
