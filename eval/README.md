# Plugin Evaluation Toolkit

Deterministic, non-LLM analysis of the plugin's agents, prompts, orchestration graph,
and token budget. Run these to evaluate quality without paying for inference.

## Setup

```bash
cd eval
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Scripts

| Script | Purpose |
|---|---|
| `token_count.py` | Token count per agent/skill/command/protocol file. Flags oversized prompts. |
| `refs.py` | Dead-link check: every `skills/X`, `agents/Y`, `protocols/Z` reference resolves. |
| `similarity.py` | TF-IDF cosine similarity matrix across agent prompts. Flags redundant agents. |
| `graph.py` | Builds agent→skill/agent DAG. Reports orphans, cycles, fan-out hotspots, dead nodes. |
| `lint_frontmatter.py` | Checks required YAML frontmatter fields on every agent. |
| `density.py` | Readability (Flesch-Kincaid) + imperative density per prompt. |
| `simulate.py` | Workflow token-budget simulator. Takes a YAML workflow spec, outputs cost/tokens per phase. |
| `report.py` | Runs everything, emits `report.md` dashboard. |

## Quick start

```bash
python report.py              # full dashboard
python token_count.py --top 20   # heaviest files
python simulate.py workflows/ios-build.yaml
```

## Calibration

`simulate.py` needs a baseline for tool-result token sizes. Edit `calibration.json`
with numbers from 2–3 real runs (`/cost` or transcript inspection).
