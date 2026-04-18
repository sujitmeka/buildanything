---
name: asc-privacy-manifest
description: Generate and validate PrivacyInfo.xcprivacy files for iOS apps — required reason APIs, collected data types, tracking declarations, and SDK aggregation.
license: MIT
metadata:
  author: oneshot
  version: "1.0.0"
---

# iOS Privacy Manifest (PrivacyInfo.xcprivacy)

Since iOS 17 / Xcode 15, every app and third-party SDK must ship a `PrivacyInfo.xcprivacy` file declaring what data it collects, which privacy-sensitive APIs it calls, and whether it tracks users. App Store Connect rejects submissions that omit required entries (ITMS-91053, ITMS-91055).

## File structure

`PrivacyInfo.xcprivacy` is a property list (XML plist) with four top-level keys:

| Key | Type | Purpose |
|-----|------|---------|
| `NSPrivacyTracking` | Boolean | `true` if the app tracks users per ATT definition |
| `NSPrivacyTrackingDomains` | Array of String | Domains contacted for tracking (only when tracking is true) |
| `NSPrivacyCollectedDataTypes` | Array of Dict | Each data category collected, with purpose and linkage |
| `NSPrivacyAccessedAPITypes` | Array of Dict | Each required-reason API category used, with reason codes |

## 1. Required reason APIs (NSPrivacyAccessedAPITypes)

Five API categories require declared reasons. Each entry is a dict with `NSPrivacyAccessedAPIType` (category string) and `NSPrivacyAccessedAPITypeReasons` (array of reason codes).

### File timestamp APIs — `NSPrivacyAccessedAPICategoryFileTimestamp`

Triggered by: `FileManager` attribute reads (`modificationDate`, `creationDate`), `stat()`, `fstat()`, `getattrlist()`, `NSFileModificationDate`, `NSURLContentModificationDateKey`, `NSURLCreationDateKey`.

| Code | Meaning |
|------|---------|
| `DDA9.1` | Display file timestamps to the user on-device only (no off-device transmission) |
| `C617.1` | Access file metadata inside app container, app group container, or CloudKit container |
| `3B52.1` | Access metadata for files the user explicitly selected (document picker, drag-and-drop) |
| `0A2A.1` | Third-party SDK wrapper — only when the host app invokes the wrapper API |

### System boot time APIs — `NSPrivacyAccessedAPICategorySystemBootTime`

Triggered by: `ProcessInfo.processInfo.systemUptime`, `mach_absolute_time()`, `clock_gettime(CLOCK_MONOTONIC)`.

| Code | Meaning |
|------|---------|
| `35F9.1` | Measure elapsed time between events within the app |
| `8FFB.1` | Calculate absolute timestamps for events (e.g. UIKit or AVFAudio timestamps) |
| `3D61.1` | Include boot time in an optional, user-initiated bug report |

### Disk space APIs — `NSPrivacyAccessedAPICategoryDiskSpace`

Triggered by: `FileManager` `attributesOfFileSystem(forPath:)`, `volumeAvailableCapacityKey`, `volumeTotalCapacityKey`, `statfs()`, `statvfs()`.

| Code | Meaning |
|------|---------|
| `85F4.1` | Display disk space information to the user on-device |
| `E174.1` | Check available space before writing files or delete files on low disk |
| `7D9E.1` | Include disk space in an optional, user-initiated bug report |
| `B728.1` | Health research apps detecting low disk for data integrity |

### Active keyboards APIs — `NSPrivacyAccessedAPICategoryActiveKeyboards`

Triggered by: `UITextInputMode.activeInputModes`.

| Code | Meaning |
|------|---------|
| `3EC4.1` | Custom keyboard app checking which keyboards are active |
| `54BD.1` | Customize UI or input behavior based on active keyboards |

### User defaults APIs — `NSPrivacyAccessedAPICategoryUserDefaults`

Triggered by: `UserDefaults` standard or suite access. Almost every app hits this.

| Code | Meaning |
|------|---------|
| `CA92.1` | Read/write data accessible only to the app itself |
| `1C8F.1` | Read/write data shared via App Group (app + widgets/extensions) |
| `C56D.1` | Third-party SDK wrapper providing access to user defaults |
| `AC6B.1` | Read managed app configuration or write feedback for MDM |

## 2. Collected data types (NSPrivacyCollectedDataTypes)

Each dict in the array declares one data category with four keys:

| Key | Type | Description |
|-----|------|-------------|
| `NSPrivacyCollectedDataType` | String | Identifier from Apple's predefined list |
| `NSPrivacyCollectedDataTypeLinked` | Boolean | `true` if this data is linked to the user's identity |
| `NSPrivacyCollectedDataTypeTracking` | Boolean | `true` if this data is used for tracking |
| `NSPrivacyCollectedDataTypePurposes` | Array of String | Why this data is collected |

### Common data type identifiers

| Identifier | Category |
|------------|----------|
| `NSPrivacyCollectedDataTypeName` | Contact info — name |
| `NSPrivacyCollectedDataTypeEmailAddress` | Contact info — email |
| `NSPrivacyCollectedDataTypePhoneNumber` | Contact info — phone |
| `NSPrivacyCollectedDataTypeUserID` | Identifiers — user ID |
| `NSPrivacyCollectedDataTypeDeviceID` | Identifiers — device ID (IDFA, IDFV) |
| `NSPrivacyCollectedDataTypePreciseLocation` | Location — precise |
| `NSPrivacyCollectedDataTypeCoarseLocation` | Location — coarse |
| `NSPrivacyCollectedDataTypeProductInteraction` | Usage data — product interaction |
| `NSPrivacyCollectedDataTypeOtherUsageData` | Usage data — other |
| `NSPrivacyCollectedDataTypeCrashData` | Diagnostics — crash data |
| `NSPrivacyCollectedDataTypePerformanceData` | Diagnostics — performance |
| `NSPrivacyCollectedDataTypeOtherDiagnosticData` | Diagnostics — other |
| `NSPrivacyCollectedDataTypePaymentInfo` | Financial — payment info |
| `NSPrivacyCollectedDataTypePhotosorVideos` | User content — photos/videos |
| `NSPrivacyCollectedDataTypeContacts` | User content — contacts |
| `NSPrivacyCollectedDataTypeHealth` | Health & fitness |
| `NSPrivacyCollectedDataTypeFitness` | Health & fitness |
| `NSPrivacyCollectedDataTypeOtherDataTypes` | Catch-all |

### Purpose identifiers

| Identifier | Meaning |
|------------|---------|
| `NSPrivacyCollectedDataTypePurposeAppFunctionality` | Core app features |
| `NSPrivacyCollectedDataTypePurposeAnalytics` | Analytics |
| `NSPrivacyCollectedDataTypePurposeProductPersonalization` | Personalization |
| `NSPrivacyCollectedDataTypePurposeDeveloperAdvertising` | Developer's own ads/marketing |
| `NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising` | Third-party ad networks |
| `NSPrivacyCollectedDataTypePurposeOther` | Other purposes |

## 3. Tracking and ATT (NSPrivacyTracking)

Set `NSPrivacyTracking` to `true` only if the app links collected data with third-party data for advertising or ad measurement. This aligns with Apple's App Tracking Transparency (ATT) definition.

When `NSPrivacyTracking` is `true`:
- The app **must** call `ATTrackingManager.requestTrackingAuthorization()` before tracking.
- `NSPrivacyTrackingDomains` must list every domain contacted for tracking purposes.
- iOS blocks network requests to listed domains when the user denies tracking permission.
- `Info.plist` must include `NSUserTrackingUsageDescription` with a user-facing explanation.

When `NSPrivacyTracking` is `false`, leave `NSPrivacyTrackingDomains` as an empty array.

## 4. Third-party SDK manifests and aggregation

Each SDK must bundle its own `PrivacyInfo.xcprivacy` inside its framework or Swift package bundle. During archival, Xcode aggregates all manifests into a unified **Privacy Report** (accessible via Product > Generate Privacy Report in Xcode).

Rules:
- The app's manifest covers the app target only — not its dependencies.
- Each framework/xcframework/Swift package provides its own manifest.
- Xcode merges all manifests at archive time; duplicates are union-merged.
- If an SDK lacks a manifest, App Store Connect flags the submission (ITMS-91061).
- Update third-party SDKs regularly — most major SDKs (Alamofire, Firebase, Sentry, etc.) ship manifests since mid-2024.

For Swift packages: place `PrivacyInfo.xcprivacy` in the package's resource bundle and declare it in `Package.swift` via `.process("PrivacyInfo.xcprivacy")` in the target's `resources` array.

## 5. Xcode integration

### Where to place the file
- **App target**: project root, alongside `Info.plist`. Xcode copies it into the app bundle at build time.
- **Framework target**: inside the framework's bundle resources.
- **Swift Package**: in `Sources/<Target>/` and declared in `Package.swift` resources.

### How to create it in Xcode
1. File > New > File (or Cmd-N).
2. Search for "App Privacy" and select the template.
3. Choose the correct target in the file inspector.
4. Xcode creates `PrivacyInfo.xcprivacy` with a visual editor for the four top-level keys.

The file **must** be named exactly `PrivacyInfo.xcprivacy` — Apple's tooling scans for this specific filename.

### Generate a privacy report
1. Archive the app (Product > Archive).
2. Right-click the archive in the Organizer > Generate Privacy Report.
3. Review the aggregated report for missing entries before submission.

## 6. Common App Store rejection reasons

| Error code | Cause | Fix |
|------------|-------|-----|
| ITMS-91053 | App uses a required-reason API without declaring it in the manifest | Add the missing `NSPrivacyAccessedAPIType` entry with valid reason codes |
| ITMS-91055 | Invalid reason code for a declared API category | Replace with a valid reason code from Apple's predefined list |
| ITMS-91056 | Malformed or invalid privacy manifest file | Validate plist XML structure; re-create via Xcode template |
| ITMS-91061 | A third-party SDK is missing its privacy manifest | Update the SDK or add a manifest to its bundle |

**TestFlight catches these errors** — always run a TestFlight build before production submission.

Other common pitfalls:
- Declaring `NSPrivacyTracking = true` but omitting `NSUserTrackingUsageDescription` in `Info.plist`.
- Using reason code `CA92.1` (app-only) when the app actually shares `UserDefaults` via App Group — use `1C8F.1` instead.
- Forgetting to declare `NSPrivacyAccessedAPICategoryFileTimestamp` when using `SDWebImage`, `Kingfisher`, or other caching libraries that call `stat()`.
- Declaring collected data types without matching entries in the App Store Connect privacy questionnaire.

## 7. Complete example

A typical app using `UserDefaults`, file timestamps (caching), and analytics with crash reporting:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>

  <!-- Tracking -->
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>

  <!-- Collected data types -->
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- Crash data for stability monitoring -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeCrashData</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Performance metrics -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePerformanceData</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
      </array>
    </dict>
    <!-- User ID for account features -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeUserID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>

  <!-- Required reason APIs -->
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- UserDefaults: app-only storage -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <!-- File timestamps: cache management -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
    <!-- System boot time: elapsed time measurement -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
  </array>

</dict>
</plist>
```

### Variant: app with App Group sharing and tracking

If the app shares data with a widget via App Group and uses an ad SDK:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>

  <key>NSPrivacyTracking</key>
  <true/>
  <key>NSPrivacyTrackingDomains</key>
  <array>
    <string>analytics.example.com</string>
    <string>ads.example.com</string>
  </array>

  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeDeviceID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <true/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising</string>
      </array>
    </dict>
  </array>

  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
        <string>1C8F.1</string>
      </array>
    </dict>
  </array>

</dict>
</plist>
```

Note: when `NSPrivacyTracking` is `true`, the app must also declare `NSUserTrackingUsageDescription` in `Info.plist` and call `ATTrackingManager.requestTrackingAuthorization()` before any tracking occurs.

## Decision checklist

Before generating the manifest, answer these:

1. Does the app use `UserDefaults`? (almost always yes) --> `CA92.1` or `1C8F.1`
2. Does the app or any dependency read file timestamps? (caching libraries do) --> `C617.1`
3. Does the app measure elapsed time or call `mach_absolute_time()`? --> `35F9.1`
4. Does the app check disk space before writes? --> `E174.1`
5. Does the app inspect active keyboards? (rare) --> `54BD.1`
6. Does the app collect crash/performance data? --> add collected data type entries
7. Does the app link data to user identity? --> set `Linked` to `true` on those types
8. Does the app track users for advertising? --> `NSPrivacyTracking = true` + ATT + tracking domains
