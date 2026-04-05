# Xcode 26.3 — New Project Dialog click path

## Launch
- `open -a Xcode` (or click Xcode in /Applications)
- Menu: **File → New → Project…** (`⇧⌘N`)

## Dialog screens

### Screen 1 — Choose a template
- Platform tabs at top: select **iOS**
- Template grid: select **App**
- Click **Next**

### Screen 2 — Choose options
| Field | Value |
|---|---|
| Product Name | `{app_name}` (e.g. `HabitForge`) |
| Team | your Apple Developer team (or **None** for simulator-only) |
| Organization Identifier | `{bundle_id_prefix}` (e.g. `com.acme`) |
| Bundle Identifier | auto-populated: `{bundle_id_prefix}.{app_name}` |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | **SwiftData** |
| Include Tests | **checked** |

Click **Next**.

### Screen 3 — Save location
- Navigate to the project root directory (NOT a subdirectory).
- **Uncheck** "Create Git repository on my Mac" if a git repo already exists at the root (avoid nested repos).
- Click **Create**.

## Verification after creation
- `.xcodeproj` bundle is at project root
- `⌘B` builds clean with no errors
- `⌘R` launches the default "Hello, world!" SwiftUI view in a booted simulator

## Common pitfalls
- Choosing UIKit storyboard template by mistake — re-do, the iOS mode assumes SwiftUI lifecycle.
- Saving into a nested folder — breaks downstream path assumptions in MCP tools.
- Selecting CoreData instead of SwiftData — iOS 26 default is SwiftData; CoreData is legacy.
