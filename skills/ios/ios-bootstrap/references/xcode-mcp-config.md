# XcodeBuildMCP — MCP config snippet

Add the following under the `mcpServers` object in `~/.claude.json` (user-wide) or `./.mcp.json` (project-scoped).

```json
{
  "mcpServers": {
    "xcodebuildmcp": {
      "command": "npx",
      "args": ["-y", "xcodebuildmcp@latest"]
    }
  }
}
```

## What it gives you
- Discover schemes, targets, and destinations from `.xcodeproj` / `.xcworkspace`
- Build, clean, archive via `xcodebuild` with structured output
- Boot, shutdown, and install apps on simulators
- Toggle target capabilities (Push, HealthKit, App Groups, iCloud, Sign in with Apple)
- Read and patch Info.plist / entitlements plists safely

## Verification
After adding and restarting Claude Code, confirm tools prefixed `mcp__xcodebuildmcp__` appear in the tool list.

## Troubleshooting
- **`npx` missing** — install Node 20+ (`brew install node`).
- **Server never initializes** — check Claude Code logs; usually first-run `npx` download stalled behind a proxy.
- **Multiple Xcode installs** — run `sudo xcode-select -s /Applications/Xcode.app` so the MCP picks up 26.3.
