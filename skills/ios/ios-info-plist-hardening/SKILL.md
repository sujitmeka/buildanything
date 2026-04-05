---
name: ios-info-plist-hardening
description: Generates and audits Info.plist defaults (usage-description strings, URL schemes, background modes, scene manifest) AND produces PrivacyInfo.xcprivacy so the app clears App Review and launches cleanly. Use during Phase 4 Foundation on every iOS project.
version: 0.2.0
status: ready
---

# iOS Info.plist Hardening (Phase 4)

## Purpose
Ensures `Info.plist` carries every required usage-description string, correctly registered URL schemes, declared background modes, and a sane SwiftUI scene manifest. Also emits the iOS 17+ `PrivacyInfo.xcprivacy` manifest. Catches "rejected because NSCameraUsageDescription is missing" before it happens.

## When this fires
- Phase 4 Foundation (always, for iOS projects)
- Whenever a new API that requires a usage-description is added
- Pre-archive audit

## Inputs
- `ios_features` from `docs/plans/.build-state.md` (boolean flags: camera, microphone, location_when_in_use, location_always, photos, contacts, calendar, reminders, motion, health, bluetooth, localNetwork, tracking, faceID, music, homeKit, siri, nearbyInteraction, speech, appleMusic)
- `url_schemes` (string[], optional)
- `background_modes` (string[], optional)
- `app_lifecycle` (enum: `swiftui_app` | `uikit_appdelegate`, default `swiftui_app`)
- `tracking_required_reasons` (object, optional) — required-reason API categories in use
- `collects_tracking_data` (bool, default false)

## Outputs
- Updated `Info.plist` with merged keys (via XcodeBuildMCP)
- `PrivacyInfo.xcprivacy` at target root (iOS 17+)
- Audit report `docs/plans/plist-audit.md`: missing keys, stale keys, weak description strings

## Required usage-description keys

| Info.plist key | Triggered by |
|---|---|
| `NSCameraUsageDescription` | Camera / AVFoundation / Vision / ARKit / VisionKit |
| `NSMicrophoneUsageDescription` | Microphone / Speech / ShazamKit |
| `NSPhotoLibraryUsageDescription` | PhotoKit read |
| `NSPhotoLibraryAddUsageDescription` | Writing to photo library |
| `NSLocationWhenInUseUsageDescription` | CoreLocation foreground |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | CoreLocation background |
| `NSContactsUsageDescription` | Contacts |
| `NSCalendarsUsageDescription` / `NSCalendarsFullAccessUsageDescription` | EventKit (iOS 17+ split) |
| `NSRemindersUsageDescription` / `NSRemindersFullAccessUsageDescription` | EventKit reminders |
| `NSMotionUsageDescription` | CoreMotion |
| `NSHealthShareUsageDescription` | HealthKit read |
| `NSHealthUpdateUsageDescription` | HealthKit write |
| `NSSpeechRecognitionUsageDescription` | Speech |
| `NSBluetoothAlwaysUsageDescription` | CoreBluetooth |
| `NSLocalNetworkUsageDescription` | Bonjour / Multipeer / Network framework LAN |
| `NSUserTrackingUsageDescription` | AppTrackingTransparency / IDFA |
| `NSFaceIDUsageDescription` | LocalAuthentication biometrics |
| `NSAppleMusicUsageDescription` | MediaPlayer / MusicKit |
| `NSHomeKitUsageDescription` | HomeKit |
| `NSSiriUsageDescription` | SiriKit / App Intents w/ Siri |
| `NSNearbyInteractionUsageDescription` | NearbyInteraction (UWB) |

Usage descriptions must be **specific and user-facing** ("To scan receipts with your camera" beats "Needs camera"). Reject strings under 20 characters or containing placeholder text.

## URL scheme registration template
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.acme.habitforge</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>habitforge</string>
    </array>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
  </dict>
</array>
```

## UIBackgroundModes enumeration
Valid values (set only what the app actually uses):
- `fetch` — background app refresh
- `remote-notification` — silent push wake
- `audio` — background audio playback
- `location` — continuous location updates
- `bluetooth-central` — BLE central role
- `bluetooth-peripheral` — BLE peripheral role
- `voip` — VoIP calls
- `external-accessory`
- `processing` — BGProcessingTask (long-running)
- `nearby-interaction`

## Scene manifest (SwiftUI app lifecycle default)
```xml
<key>UIApplicationSceneManifest</key>
<dict>
  <key>UIApplicationSupportsMultipleScenes</key>
  <true/>
  <key>UISceneConfigurations</key>
  <dict/>
</dict>
```

## PrivacyInfo.xcprivacy (iOS 17+ — this skill owns creation at Phase 4)
Generate with four top-level keys:

- **`NSPrivacyTracking`** — bool; true only if `collects_tracking_data` is true.
- **`NSPrivacyTrackingDomains`** — array of tracking domains contacted (only if tracking is true).
- **`NSPrivacyCollectedDataTypes`** — array of dicts, one per data category collected, each with: `NSPrivacyCollectedDataType`, `NSPrivacyCollectedDataTypeLinked`, `NSPrivacyCollectedDataTypeTracking`, `NSPrivacyCollectedDataTypePurposes`.
- **`NSPrivacyAccessedAPITypes`** — array of required-reason API declarations. Each entry has `NSPrivacyAccessedAPIType` + `NSPrivacyAccessedAPITypeReasons`. Common categories:
  - `NSPrivacyAccessedAPICategoryFileTimestamp`
  - `NSPrivacyAccessedAPICategorySystemBootTime`
  - `NSPrivacyAccessedAPICategoryDiskSpace`
  - `NSPrivacyAccessedAPICategoryActiveKeyboards`
  - `NSPrivacyAccessedAPICategoryUserDefaults`

Detect required-reason API usage by scanning code for patterns (e.g. `FileManager` attributes, `UserDefaults` access, `UIDevice` boot time). Emit a declaration for each detected category with the appropriate reason code.

## Workflow
1. **Read state** — load `ios_features` flags from `docs/plans/.build-state.md`.
2. **Select required keys** — for each true flag, resolve to usage-description key(s) from the table above (cross-check `ios-frameworks-map.md §4` column "Info.plist keys").
3. **Scan code for required-reason APIs** — grep for `FileManager`, `UserDefaults`, `systemUptime`, `.systemFreeSize`, keyboard APIs; build privacy-manifest entries.
4. **Generate patches** — compute Info.plist additions and PrivacyInfo.xcprivacy content.
5. **Write via XcodeBuildMCP** — merge Info.plist (never clobber user keys), create/overwrite `PrivacyInfo.xcprivacy` at target root.
6. **Emit audit report** — `docs/plans/plist-audit.md` listing additions, weak descriptions, and any manual follow-ups (e.g. "add tracking domain list").

## Validation
- Every usage-description string is ≥ 20 chars and references the concrete app action.
- No placeholder strings (`TODO`, `lorem`, `test`, `permission required`).
- Background modes in plist match entitlements and actual runtime usage.
- PrivacyInfo.xcprivacy includes a required-reason entry for every detected API category — missing entries block App Store submission.

---
_Part of buildanything iOS mode. See `protocols/ios-context.md` for persona. Cross-references `protocols/ios-frameworks-map.md §4`._
