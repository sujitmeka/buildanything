# SDK / Host Compatibility Matrix

Tracks validated Claude Code host version ranges for each SDK pin version.
Used to gate SDK features and ensure runtime compatibility across migration stages.

## Compatibility Table

| SDK Version | Host Range (semver) | Validated Date | Notes |
|-------------|---------------------|----------------|-------|
| `0.1.0` | `>=1.5.0 <3.0.0` | 2026-04-18 | Initial pin — Stage 1 bootstrap |

## Update Policy

Updated per Stage release. Each row represents a tested SDK pin version with its validated Claude Code host range. The `claudeCodeHostRange` field in `.claude-plugin/plugin.json` must match the latest row.

## Degradation Behavior

If the host does not expose `CLAUDE_CODE_VERSION`, the version probe no-ops (logged, not errored). Fallback: markdown mode with user-visible warning.
