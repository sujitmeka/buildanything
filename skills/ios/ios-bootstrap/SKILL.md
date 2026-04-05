---
name: ios-bootstrap
description: Bootstraps a new iOS project — gates Xcode 26.3, guides the Xcode New Project dialog, wires XcodeBuildMCP + apple-docs-mcp, installs Maestro. Use when project_type=ios and no .xcodeproj exists in the project root.
version: 0.2.0
status: ready
---

# iOS Bootstrap (Phase -1)

## Purpose
Phase -1 bring-up for a fresh iOS project. Enforces the Xcode 26.3 hard requirement, walks the user through Xcode's New Project dialog (no Tuist), and wires the MCP + CLI tooling stack the rest of the iOS workflow depends on.

## When this fires
- `project_type=ios` AND no `.xcodeproj` / `.xcworkspace` at project root
- User explicitly invokes `/build` iOS branch on an empty directory
- First-run provisioning for an iOS mode session

## Inputs
- `app_name` (string)
- `bundle_id_prefix` (string, e.g. `com.acme`)
- `team_id` (string, optional — Apple Developer team ID)
- `deployment_target` (string, default `iOS 26.0`)
- `ship_to_device` (bool, default false — skip signing if simulator-only)

## Outputs
- `.xcodeproj` created by Xcode (user-assisted via dialog)
- `docs/plans/` and `maestro/` directories created
- MCP config updated with XcodeBuildMCP + apple-docs-mcp
- Maestro installed via Homebrew and on PATH
- `.build-state.md` seeded with toolchain versions

## Workflow

### 1. Xcode version gate (blocking)
Run `xcodebuild -version`. Parse the first line (`Xcode <version>`). Require `Xcode 26.3` or later.
If missing or older: fail with `"Install Xcode 26.3 from the Mac App Store, then run xcode-select -s /Applications/Xcode.app"`. Do not proceed.

### 2. Host environment check
- `sw_vers -productVersion` — require macOS 26.0+ (Tahoe). Warn if older; Xcode 26.3 may still run but is unsupported.
- `uname -m` — require `arm64` (Apple Silicon). Intel Macs are not a supported dev host for iOS 26 SDKs.

### 3. Create project directory structure
From project root, create:
- `docs/plans/` — holds `.build-state.md`, `ios-design-board.md`, task lists
- `maestro/` — canonical name for Maestro YAML flows

### 4. User-assisted Xcode New Project dialog
Instruct the user to run `open -a Xcode` then **File → New → Project** (`⇧⌘N`). Exact selections:

| Step | Choice |
|---|---|
| Platform tab | **iOS** |
| Template | **App** |
| Product Name | `{app_name}` |
| Team | user's default (or None for sim-only) |
| Organization Identifier | `{bundle_id_prefix}` (becomes `{bundle_id_prefix}.{app_name}`) |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | **SwiftData** |
| Include Tests | **checked** |
| Save location | project root (do NOT create a nested git repo) |

See `references/new-project-dialog.md` for the full click path.

### 5. Wire XcodeBuildMCP
Check `~/.claude.json` and `./.mcp.json` for an `xcodebuildmcp` entry. If absent, guide the user to add the JSON snippet from `references/xcode-mcp-config.md`. After editing, instruct: restart Claude Code so the MCP server loads.

### 6. Wire apple-docs-mcp
Same pattern — check for `apple-docs-mcp` entry, insert snippet from `references/apple-docs-mcp-config.md` if missing, restart.

### 7. Install Maestro
```bash
brew install maestro
maestro --version   # verify — expect 1.x
```
If `brew` missing: halt and instruct user to install Homebrew first.

### 8. Signing defaults (conditional)
If `ship_to_device=true`: prompt user for Team ID, write to project's `.xcconfig` or target build settings via XcodeBuildMCP. If `false` (simulator-only): skip — user can add signing later.

### 9. Deferred (do NOT install here)
- **fastlane** — Phase 7 only (distribution). Skip.
- **Optional Apple Developer account check** — only runs if `ship_to_device=true`.

## Handoff checklist
- [ ] `xcodebuild -version` ≥ 26.3
- [ ] `.xcodeproj` exists at root, opens in Xcode, builds clean for simulator
- [ ] `docs/plans/` and `maestro/` present
- [ ] `maestro --version` prints a version
- [ ] XcodeBuildMCP + apple-docs-mcp present in MCP config

## References
- `references/xcode-mcp-config.md` — XcodeBuildMCP JSON snippet
- `references/apple-docs-mcp-config.md` — apple-docs-mcp JSON snippet
- `references/new-project-dialog.md` — exact Xcode click path

---
_Part of buildanything iOS mode. See `protocols/ios-context.md` for Senior iOS Engineer persona._
