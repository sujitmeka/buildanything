"""Parse the artifacts section from phase-graph.yaml."""

from pathlib import Path
import yaml


def parse_yaml_artifacts(yaml_path: str = "docs/migration/phase-graph.yaml") -> list[dict]:
    """Return a list of dicts, one per artifact entry in phase-graph.yaml."""
    data = yaml.safe_load(Path(yaml_path).read_text())
    return data.get("artifacts", [])


if __name__ == "__main__":
    import json, sys

    path = sys.argv[1] if len(sys.argv) > 1 else "docs/migration/phase-graph.yaml"
    artifacts = parse_yaml_artifacts(path)
    print(json.dumps(artifacts, indent=2))
