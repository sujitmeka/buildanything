# Vendored iOS Skills (P0)

_Wholesale copies from `research/swift-skills/` per `research/swift-skills/_docs/_COMPARISON.md` adoption plan. Source repos are the authoritative version — update from source, don't edit in place._

| Skill | Source | License | Copyright | Captured |
|---|---|---|---|---|
| swiftui-pro | twostraws/SwiftUI-Agent-Skill | MIT | Paul Hudson | 2026-04-04 |
| swift-concurrency | AvdLee/Swift-Concurrency-Agent-Skill | MIT | Antoine van der Lee | 2026-04-04 |
| swift-security-expert | ivan-magda/swift-security-skill | MIT | Ivan Magda | 2026-04-04 |
| swiftdata-pro | twostraws/SwiftData-Agent-Skill | MIT | Paul Hudson | 2026-04-04 |
| swift-testing-expert | AvdLee/Swift-Testing-Agent-Skill | MIT | Antoine van der Lee | 2026-04-04 |
| swift-accessibility | PasqualeVittoriosi/swift-accessibility-skill | MIT | Pasquale Vittoriosi | 2026-04-04 |
| swiftui-ui-patterns | Dimillian/Skills | MIT | Dimillian | 2026-04-04 |
| swiftui-view-refactor | Dimillian/Skills | MIT | Dimillian | 2026-04-04 |
| swiftui-liquid-glass | Dimillian/Skills | MIT | Dimillian | 2026-04-04 |
| swiftui-performance-audit | Dimillian/Skills | MIT | Dimillian | 2026-04-04 |
| swiftui-design-principles | arjitj2 | license check pending | arjitj2 | 2026-04-04 |
| ios-hig | johnrogers/claude-swift-engineering | MIT | John Rogers | 2026-04-04 |
| ios-26-platform | johnrogers/claude-swift-engineering | MIT | John Rogers | 2026-04-04 |
| widgetkit | dpearson2699/swift-ios-skills | PolyForm Perimeter 1.0 | dpearson2699 | 2026-04-04 |
| activitykit | dpearson2699/swift-ios-skills | PolyForm Perimeter 1.0 | dpearson2699 | 2026-04-04 |
| app-intents | dpearson2699/swift-ios-skills | PolyForm Perimeter 1.0 | dpearson2699 | 2026-04-04 |
| apple-on-device-ai | dpearson2699/swift-ios-skills | PolyForm Perimeter 1.0 | dpearson2699 | 2026-04-04 |
| ios-debugger-agent | Dimillian/Skills | MIT | Dimillian | 2026-04-04 |

## Update procedure

1. `cd research/swift-skills/<category>/<repo>/ && git pull`
2. Copy the inner skill dir + root `LICENSE` into `skills/ios/<skill>/`
3. Bump the Captured date in the table above
4. Spot-check `SKILL.md` frontmatter `name:` still matches the target dir name

## Excluded from vendoring

- `.git/`, `node_modules/`, `.DS_Store`
- Repo-root `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `package.json`
- Repo-root `tests/` (swift-security-skill only)
- `AGENTS.md`, `CLAUDE.md` at repo root (swift-security-skill)

## Missing LICENSE files

The following skill dirs currently lack a `LICENSE` file and need one copied in from upstream (or an in-house LICENSE added for stubs):

- `ios-26-platform/` — vendored from johnrogers/claude-swift-engineering; upstream MIT LICENSE to be copied in.
- `ios-hig/` — vendored from johnrogers/claude-swift-engineering; upstream MIT LICENSE to be copied in.
- `ios-bootstrap/` — in-house stub; needs an in-house LICENSE.
- `ios-entitlements-generator/` — in-house stub; needs an in-house LICENSE.
- `ios-info-plist-hardening/` — in-house stub; needs an in-house LICENSE.
- `ios-maestro-flow-author/` — in-house stub; needs an in-house LICENSE.

## In-House Skills (buildanything iOS mode)

Authored in-house for the buildanything plugin. Not vendored from upstream.

| Skill | Status | Purpose | Fleshed-out? | Created |
|---|---|---|---|---|
| ios-bootstrap | expanding | Phase -1 scaffolding: create Xcode project, wire XcodeBuildMCP, verify toolchain | stub | 2026-04-04 |
| ios-entitlements-generator | expanding | Derive `.entitlements` file from required iOS capabilities (Keychain, Push, HealthKit, etc.) | stub | 2026-04-04 |
| ios-info-plist-hardening | expanding | Populate Info.plist usage-description strings, ATS settings, privacy manifest alignment | stub | 2026-04-04 |
| ios-maestro-flow-author | expanding | Author Maestro `.yaml` E2E flows for critical user journeys | stub | 2026-04-04 |
