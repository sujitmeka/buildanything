---
name: ios-entitlements-generator
description: Generates a .entitlements plist from ios_features flags and syncs Xcode capability toggles via XcodeBuildMCP. Delegates the capability→entitlement table to protocols/ios-frameworks-map.md §4. Use during Phase 4 Foundation.
version: 0.2.0
status: ready
---

# iOS Entitlements Generator (Phase 4)

## Purpose
Turns the `ios_features` checklist in `.build-state.md` into a correct `.entitlements` plist and syncs the Xcode capability UI. Removes the foot-gun of hand-editing entitlement keys.

## Authoritative mapping source
**This skill does NOT maintain its own capability→entitlement table.** It DELEGATES to `protocols/ios-frameworks-map.md` **§4 Entitlement Mapping**. Always consult that table at generation time — it is the single source of truth and is kept in sync with iOS SDK releases.

## When this fires
- Phase 4 Foundation, after architecture decisions finalized
- A new capability is added mid-project (Push, App Groups, CloudKit, …)
- Pre-archive audit to confirm entitlements match used capabilities

## Inputs
- `ios_features` object from `docs/plans/.build-state.md` — boolean flags like `push`, `cloudKit`, `healthKit`, `appGroups`, `signInWithApple`, `associatedDomains`, `keychainSharing`, `weatherKit`, `musicKit`, `networkExtension`
- `app_groups_ids` (string[], optional)
- `associated_domains` (string[], optional — e.g. `applinks:app.example.com`)
- `icloud_container_ids` (string[], optional)
- `background_modes` (string[], optional — `fetch`, `remote-notification`, `processing`, `audio`, `location`, `bluetooth-central`, `voip`)

## Outputs
- `<ProjectName>.entitlements` plist at the target's Signing/Capabilities dir
- `docs/plans/entitlements-summary.md` — diff of added/removed keys, per-capability rationale
- XcodeBuildMCP capability toggles (Push, HealthKit, CloudKit, App Groups, Sign in with Apple) flipped on in the target UI

## Workflow
1. **Read state** — load `ios_features` from `docs/plans/.build-state.md`.
2. **Resolve entitlements** — for each flag set `true`, look up the entitlement key(s) in `protocols/ios-frameworks-map.md §4`. Do not invent keys; if the table doesn't cover it, query `apple-docs-mcp` and surface as a TODO in the summary.
3. **Merge plist immutably** — read existing `<ProjectName>.entitlements` if present, compute new dict as a merge (never clobber user-added keys), write a new file. Preserve key ordering for clean diffs.
4. **Sync Xcode capability UI** — for capabilities that require target-level toggles (Push, HealthKit, CloudKit, App Groups, Sign in with Apple, Background Modes), call XcodeBuildMCP's capability-toggle tool so the Signing & Capabilities tab matches the plist.
5. **Emit summary** — write `entitlements-summary.md` listing each capability, keys added, and values requiring user input (team ID, container IDs, domain list).

## Validation
- Every key in the output must trace back to a row in `ios-frameworks-map.md §4` or an explicit user-provided value.
- `aps-environment` must be `development` in debug configs, `production` in release.
- Associated domains must be prefixed (`applinks:`, `webcredentials:`, `activitycontinuation:`).
- iCloud container IDs must start with `iCloud.` and match the CloudKit dashboard.

---
_Part of buildanything iOS mode. Delegates to `protocols/ios-frameworks-map.md §4`. See `protocols/ios-context.md` for persona._
