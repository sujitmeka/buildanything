# iOS Preflight Protocol

_Shared preflight steps for iOS-mode commands. Included by `/verify`, `/ux-review`, `/fix` iOS twins._

## Preflight Checks

Before running any iOS-branch command flow, verify:

1. **`.xcodeproj` exists** in project root (use `ls *.xcodeproj` or equivalent). If not, HALT and prompt user to run `/buildanything:build` Phase -1 Bootstrap first.

2. **XcodeBuildMCP reachable** — dispatch a simple `xcodebuild -version` or MCP health check. If unreachable, HALT with instructions to re-add MCP config per `skills/ios/ios-bootstrap/references/xcode-mcp-config.md`.

3. **Simulator bootable** — list available iOS 26 simulators via XcodeBuildMCP. If none available, HALT and instruct user to install via Xcode.

4. **`docs/plans/.build-state.md` exists** with `project_type: ios` and `ios_features:` populated. If missing, HALT.

5. **apple-docs-mcp reachable** (non-blocking) — if unreachable, log warning; commands proceed with degraded docs lookup (WebFetch fallback per `protocols/ios-context.md` §apple-docs fallback rule).

## Usage

At the top of any iOS-twin command's iOS branch, insert:

```
**Run iOS preflight:** see `protocols/ios-preflight.md`.
```

Then proceed with command-specific steps.
