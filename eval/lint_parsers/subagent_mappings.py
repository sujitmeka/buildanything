"""Parse subagent_type dispatch mappings from build.md prose and phase-graph.yaml."""
import re, yaml
from pathlib import Path

def parse_prose_subagent_mappings(build_md_path: str = "commands/build.md") -> dict:
    """Extract the Phase 4 dispatch table from build.md prose."""
    text, web = Path(build_md_path).read_text(), {}
    for line in text.splitlines():
        agents = re.findall(r"`subagent_type:\s*([^`]+)`", line)
        cat = re.match(r"^-\s*([\w][\w/ -]*?) tasks?:", line)
        if not agents or not cat or "Dispatch by task type" in line:
            continue
        label = cat.group(1).strip().lower().replace(" ", "_").replace("/", "_")
        sizes = re.findall(r"\(([SML](?:/[SML])*)\)", line)
        if len(agents) >= 2 and sizes and label == "ui":
            for a, sz in zip(agents, sizes):
                web[f"{label}_{sz.replace('/', '')}"] = [a.strip()]
        else:
            web[label] = [a.strip() for a in agents]
    return {"web": web} if web else {}

def parse_yaml_subagent_mappings(yaml_path: str = "docs/migration/phase-graph.yaml") -> dict:
    """Extract the Phase 4 per_task_flow dispatch_table from phase-graph.yaml."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    for phase in data.get("phases", []):
        if str(phase.get("id")) != "4":
            continue
        for step in phase.get("per_task_flow", {}).get("sub_steps", []):
            dt = step.get("dispatch_table")
            if not dt:
                continue
            out = {}
            for platform, cats in dt.items():
                out[platform] = {}
                for cat, v in cats.items():
                    if isinstance(v, list):       out[platform][cat] = v
                    elif " OR " in str(v):        out[platform][cat] = [x.strip() for x in v.split(" OR ")]
                    else:                         out[platform][cat] = [v]
            return out
    return {}
