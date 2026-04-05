# iOS Frameworks Capability Map

_**Reference file** — agents READ this on demand when hitting a "user wants X → which Apple framework?" question. **NOT injected into agent prompts** (323 lines would waste ~400k tokens across a build). The orchestrator cites this file by path; agents open it, grep for their capability, extract the 1-2 relevant rows. Authoritative source for framework selection. When in doubt, consult apple-docs-mcp to confirm current API status._

## Purpose

This is a **framework-selection index**, not a best-practices guide. It answers: "the user described capability X, which Apple framework should I import?" The rule is: **prefer Apple's native framework over custom code or third-party libraries whenever one exists.**

---

## 1. Capability Index (user intent → framework)

### Health & Fitness

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Log workouts, steps, heart rate, sleep | HealthKit | `com.apple.developer.healthkit` | — |
| Start/control workout sessions, build workout plans | WorkoutKit (iOS 17+) | HealthKit | — |
| Pull clinical records (labs, allergies, meds) | HealthKit ClinicalHealth | `health-records` | — |
| Mindful minutes / state of mind | HealthKit (iOS 17+) | HealthKit | — |

### Calendar & Reminders

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Create/read calendar events | EventKit | `NSCalendarsFullAccessUsageDescription` | Deprecated: `NSCalendarsUsageDescription` (iOS 17+ splits read/write) |
| Pre-built event editor UI | EventKitUI | Calendar | — |
| Create/read reminders | EventKit | `NSRemindersFullAccessUsageDescription` | — |

### Photos & Media

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Pick photos/videos from library | PhotosUI (`PhotosPicker`) | — (no permission prompt needed for picker) | Deprecated: `UIImagePickerController` |
| Full library access, albums, assets | PhotoKit | `NSPhotoLibraryUsageDescription` | — |
| Camera capture, audio/video record | AVFoundation | `NSCameraUsageDescription`, `NSMicrophoneUsageDescription` | — |
| Play video with controls | AVKit (`VideoPlayer`) | — | Deprecated: `MPMoviePlayerController` |
| Play user's music, now-playing info | MediaPlayer | `NSAppleMusicUsageDescription` | — |
| Apple Music catalog, playback | MusicKit | MusicKit capability | — |
| Song ID (Shazam) | ShazamKit | Microphone | — |
| Classify sounds on-device | SoundAnalysis | Microphone | — |
| Speech-to-text | Speech | `NSSpeechRecognitionUsageDescription` | — |
| View/annotate/render PDF | PDFKit | — | — |
| Preview documents inline | QuickLook | — | — |
| Thumbnails for any file type | QuickLookThumbnailing | — | — |
| Image filters, Core Image | CoreImage | — | — |
| Low-level audio engine/effects | AVAudioEngine | — | Prefer over `AudioToolbox` for new code |

### Maps & Location

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Show a map, annotations, overlays | MapKit (SwiftUI `Map` iOS 17+) | — | Deprecated for SwiftUI: `MKMapView` wrapper |
| User location / geofencing | CoreLocation | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` | — |
| Weather forecast / historical | WeatherKit | WeatherKit capability | — |
| Directions, search, POI, lookAround | MapKit | — | — |

### Identity & Auth

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Sign in with Apple, passkeys, OAuth web flow | AuthenticationServices | `com.apple.developer.applesignin` | Deprecated: custom `WKWebView` OAuth |
| Face ID / Touch ID / passcode | LocalAuthentication | `NSFaceIDUsageDescription` | — |
| Keychain storage | Security | — | Avoid: `UserDefaults` for secrets |
| Crypto primitives (AES, ChaCha, SHA, EC) | CryptoKit | — | Deprecated: `CommonCrypto` in new Swift code |

### Payments & Commerce

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| In-app purchases, subscriptions | StoreKit 2 | In-App Purchase capability | Deprecated: StoreKit 1 (`SKPayment*`) |
| Apple Pay, Wallet passes | PassKit | `com.apple.developer.in-app-payments`, merchant IDs | — |

### Communication & Notifications

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Local + remote push notifications | UserNotifications | `aps-environment` (remote) | Deprecated: `UILocalNotification`, `UIUserNotification*` |
| VoIP push | PushKit + CallKit | VoIP capability | — |
| System call UI, CallKit directory | CallKit | — | — |
| iMessage app extensions, stickers | Messages | — | — |
| Peer-to-peer device networking | MultipeerConnectivity | Local network | — |
| Bonjour / local network discovery | Network | `NSLocalNetworkUsageDescription` | Deprecated: `NetService` |
| Email / SMS compose sheets | MessageUI | — | — |

### AR / Vision / ML

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| World-tracking AR, plane detection | ARKit | Camera | — |
| 3D rendering for AR | RealityKit | Camera | Deprecated in AR: `SceneKit+ARKit` combo |
| Room scanning (LiDAR) | RoomPlan | Camera | — |
| Text recognition, face/body detect, barcode | Vision | — | — |
| Document scanner, data-scanner UI | VisionKit | Camera | — |
| Run custom ML models | CoreML | — | — |
| Train models on-device | CreateML | — | — |
| On-device LLM (text gen, summarize) | **FoundationModels (iOS 26+)** | — | iOS 26 only; check availability |
| Visual Intelligence interactions | **Visual Intelligence (iOS 26+)** | — | iOS 26 only |
| Natural-language tokenization, tagging | NaturalLanguage | — | — |
| Live Text / Data scanner | VisionKit `DataScannerViewController` | Camera | — |

### Contacts & People

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Read/write contacts | Contacts | `NSContactsUsageDescription` | Deprecated: `AddressBook` |
| Contact picker UI | ContactsUI | Contacts (picker-only: not required) | — |

### System & Device

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Background fetch, background processing | BackgroundTasks | `BGTaskSchedulerPermittedIdentifiers` | Deprecated: `performFetchWithCompletionHandler` |
| Background asset download at install | BackgroundAssets | Background Assets capability | — |
| VPN / content filter / packet tunnel | NetworkExtension | NetworkExtension capability | — |
| Device attestation / anti-abuse | DeviceCheck / AppAttest | — | — |
| IDFA / tracking consent | AppTrackingTransparency | `NSUserTrackingUsageDescription` | — |
| File Provider extension (cloud drive) | FileProvider | File Provider capability | — |
| Share sheet / activity items | UIKit `UIActivityViewController` (SwiftUI `ShareLink`) | — | Prefer SwiftUI `ShareLink` |
| Drag & drop, pasteboard | UniformTypeIdentifiers + SwiftUI `Transferable` | — | Deprecated: `kUTType*` constants |

### Home & IoT

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| HomeKit accessories | HomeKit | `NSHomeKitUsageDescription` | — |
| Matter accessory pairing | MatterSupport | Matter capability | — |
| BLE peripherals & centrals | CoreBluetooth | `NSBluetoothAlwaysUsageDescription` | — |
| Ultra-wideband ranging | NearbyInteraction | — | — |
| Car key | CarKey | CarKey entitlement | — |
| CarPlay apps / audio / nav | CarPlay | CarPlay entitlement (Apple approval) | — |

### Wearables & Companions

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| iPhone ↔ Apple Watch messaging | WatchConnectivity | — | — |
| Watch workouts | WorkoutKit + HealthKit | HealthKit | — |

### Intents, Widgets & Automation

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Siri / Shortcuts / App Intents | AppIntents | — | Deprecated: `SiriKit` custom intents (keep only for domains AppIntents doesn't cover) |
| Home/Lock-Screen widgets | WidgetKit | App Groups (usually) | — |
| Live Activities / Dynamic Island | ActivityKit | `NSSupportsLiveActivities` Info.plist | — |
| Control Center widgets (iOS 18+) | WidgetKit `ControlWidget` | — | — |
| System-style alarms (iOS 26+) | **AlarmKit** | — | iOS 26 only |

### Web & Content

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| In-app Safari tab (SFSafariVC) | SafariServices | — | — |
| Full web view / JS bridge | WebKit | — | Deprecated: `UIWebView` |
| SwiftUI-native web view (iOS 26+) | SwiftUI `WebView` | — | iOS 26 only |
| Rich URL preview cards | LinkPresentation | — | — |

### Graphics & Games

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| 2D game engine | SpriteKit | — | — |
| 3D scene graph | SceneKit | — | (Maintenance mode; prefer RealityKit for new 3D) |
| GPU rendering | MetalKit / Metal | — | Deprecated: OpenGL ES |
| 3D model I/O (USDZ) | ModelIO | — | — |
| Game Center, leaderboards, matches | GameKit | Game Center capability | — |
| Controller input | GameController | — | — |

### Accessibility & Input

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| VoiceOver/Switch Control labels | Accessibility (SwiftUI modifiers) | — | — |
| Dictation / speech recognition | Speech | Speech recognition | — |
| Hand/pencil input | PencilKit | — | — |

### Persistence

| User intent | Framework(s) | Entitlement needed | Deprecation note |
|---|---|---|---|
| Model persistence (new projects) | SwiftData | — | — |
| Model persistence (legacy) | CoreData | — | Prefer SwiftData for new work |
| Tiny prefs (≤ a few KB) | Foundation `UserDefaults` | — | Do not use for secrets or large blobs |
| iCloud key-value | Foundation `NSUbiquitousKeyValueStore` | iCloud Key-Value | — |
| iCloud Drive documents | CloudKit + UIDocument | iCloud (CloudKit) | — |
| CloudKit sync | CloudKit | iCloud (CloudKit) | — |

---

## 2. Selection Rules (multi-choice disambiguation)

When multiple frameworks can solve a problem, pick the most modern:

- **Photos:** PhotosUI `PhotosPicker` (iOS 16+) > PhotoKit `PHPickerViewController` (iOS 14+) > `UIImagePickerController` (deprecated).
- **Auth:** AuthenticationServices (Sign in with Apple, passkeys, OAuth) > manual `WKWebView` OAuth flows.
- **Audio:** `AVAudioEngine` (modern graph) > `AVAudioPlayer` (simple file playback) > `AudioToolbox` (low-level CoreAudio).
- **Notifications:** UserNotifications (local + remote, iOS 10+) > legacy `UIUserNotification*` (removed).
- **Maps:** SwiftUI `Map` (iOS 17+) > `MKMapView` via `UIViewRepresentable`.
- **On-device AI:** FoundationModels (iOS 26+, text) > CoreML (custom models) > MLX (low-level experimental).
- **Persistence:** SwiftData > Core Data (legacy only) > `UserDefaults` (tiny prefs only).
- **3D:** RealityKit (AR + general 3D) > SceneKit (maintenance mode).
- **Web view:** SwiftUI `WebView` (iOS 26+) > `WKWebView` via `UIViewRepresentable` > `SFSafariViewController` (if you just need a browser tab).
- **Background work:** BackgroundTasks (`BGAppRefreshTask`, `BGProcessingTask`) > deprecated background-fetch.
- **Networking:** `URLSession` + async/await > `Network` framework (sockets, Bonjour) > third-party HTTP clients.
- **JSON:** `Codable` > `JSONSerialization`.
- **Share:** SwiftUI `ShareLink` > `UIActivityViewController` wrapper.
- **Crypto:** CryptoKit > `CommonCrypto`.

---

## 3. Framework Combinations (common pairings)

- **Push notifications** = UserNotifications + APNs + `aps-environment` entitlement.
- **VoIP** = CallKit + PushKit + VoIP background mode + CallKit entitlement.
- **Sign in with Apple** = AuthenticationServices + "Sign in with Apple" capability.
- **Widgets** = WidgetKit + App Groups + shared SwiftData container.
- **Live Activities** = ActivityKit + UserNotifications push + `NSSupportsLiveActivities` in Info.plist.
- **App Intents in widgets** = AppIntents + WidgetKit + shared target membership.
- **HealthKit workouts** = HealthKit + WorkoutKit + HealthKit entitlement + `NSHealthShareUsageDescription` + `NSHealthUpdateUsageDescription`.
- **ARKit 3D scene** = ARKit + RealityKit + `NSCameraUsageDescription`.
- **Document scanning** = VisionKit `VNDocumentCameraViewController` + `NSCameraUsageDescription`.
- **Barcode / text scanner** = VisionKit `DataScannerViewController` + Camera.
- **Passkeys** = AuthenticationServices + Associated Domains (`webcredentials:`).
- **Universal Links** = Associated Domains (`applinks:`) + `onOpenURL` / `NSUserActivity`.
- **CloudKit-synced SwiftData** = SwiftData + iCloud (CloudKit) capability + follow CloudKit-compatible model rules (no `.unique`, all relationships optional).
- **Matter pairing** = MatterSupport + HomeKit + Matter entitlement.
- **Apple Pay** = PassKit + Merchant ID + in-app-payments entitlement.

---

## 4. Entitlement Mapping (feeds ios-entitlements-generator)

| Framework | Entitlement key | Info.plist keys | Setup notes |
|---|---|---|---|
| HealthKit | `com.apple.developer.healthkit` | `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` | Add access types to entitlement plist |
| HomeKit | — | `NSHomeKitUsageDescription` | HomeKit capability on target |
| EventKit | — | `NSCalendarsFullAccessUsageDescription`, `NSRemindersFullAccessUsageDescription` | iOS 17+ split access model |
| Contacts | — | `NSContactsUsageDescription` | — |
| Photos | — | `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` | Not needed for `PhotosPicker` |
| Camera | — | `NSCameraUsageDescription` | AVFoundation, Vision, ARKit, VisionKit |
| Microphone | — | `NSMicrophoneUsageDescription` | AVFoundation, Speech, ShazamKit |
| Speech | — | `NSSpeechRecognitionUsageDescription` | — |
| Face ID | — | `NSFaceIDUsageDescription` | LocalAuthentication |
| CoreLocation | — | `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationTemporaryUsageDescriptionDictionary` | — |
| Bluetooth | — | `NSBluetoothAlwaysUsageDescription` | — |
| Local Network | — | `NSLocalNetworkUsageDescription`, `NSBonjourServices` | Multipeer, Bonjour |
| Music | — | `NSAppleMusicUsageDescription` | MediaPlayer, MusicKit |
| Tracking (IDFA) | — | `NSUserTrackingUsageDescription` | AppTrackingTransparency |
| Sign in with Apple | `com.apple.developer.applesignin` | — | — |
| Push (remote) | `aps-environment` | — | `development` / `production` |
| Associated Domains | `com.apple.developer.associated-domains` | — | `applinks:`, `webcredentials:`, `activitycontinuation:` |
| App Groups | `com.apple.security.application-groups` | — | Share data with widgets/extensions |
| iCloud (CloudKit) | `com.apple.developer.icloud-services`, `com.apple.developer.icloud-container-identifiers` | — | CloudKit + iCloud Drive |
| Keychain Sharing | `keychain-access-groups` | — | Share keychain items across apps |
| In-App Purchase | `com.apple.developer.in-app-payments` (Apple Pay) | — | IAP capability on target for StoreKit |
| HealthKit Clinical | `com.apple.developer.healthkit.access` | — | Array of clinical record types |
| WeatherKit | `com.apple.developer.weatherkit` | — | Register service in developer portal |
| MusicKit | `com.apple.developer.musickit` | — | — |
| CarPlay | `com.apple.developer.carplay-*` | — | Requires Apple entitlement approval |
| CarKey | `com.apple.developer.car-key` | — | — |
| NetworkExtension | `com.apple.developer.networking.networkextension` | — | Packet tunnel, content filter, DNS proxy |
| BackgroundAssets | `com.apple.developer.background-assets` | — | — |
| Matter | `com.apple.developer.matter.allow-setup-payload` | — | — |
| DriverKit / USB / HID | various | — | Specialized — usually not needed in consumer apps |
| Live Activities | — | `NSSupportsLiveActivities`, `NSSupportsLiveActivitiesFrequentUpdates` | Info.plist only |
| Background modes | `com.apple.developer.background-modes` (via Xcode UI) | — | audio, location, voip, fetch, processing, remote-notification |

---

## 5. Deprecation Flags (avoid in new code)

- `UIImagePickerController` → use PhotosUI `PhotosPicker`.
- `UIUserNotification*` / `UILocalNotification` → use UserNotifications.
- Core Data in new projects → use SwiftData.
- `UIAlertView` / `UIActionSheet` → use SwiftUI `alert` / `confirmationDialog` (or `UIAlertController` in UIKit).
- `MKMapView` wrapped in SwiftUI → use SwiftUI `Map` (iOS 17+).
- `ObservableObject` / `@Published` / `@StateObject` → use `@Observable` macro.
- `DispatchQueue.main.async` for UI → use `@MainActor` + async/await.
- `Timer` / GCD timers → use async `Task.sleep` / `AsyncTimerSequence`.
- `DateFormatter` / `NumberFormatter` → use `FormatStyle` (`.formatted(...)`).
- `replacingOccurrences(of:with:)` → `.replacing("a", with: "b")`.
- `foregroundColor` → `foregroundStyle`.
- `cornerRadius` → `clipShape(.rect(cornerRadius:))`.
- `NavigationView` → `NavigationStack`.
- `tabItem` on TabView → new `Tab` API (iOS 18+).
- `UIWebView` → `WKWebView` (or SwiftUI `WebView` iOS 26+).
- `AddressBook` → Contacts.
- `CommonCrypto` in Swift → CryptoKit.
- `SKPayment*` (StoreKit 1) → StoreKit 2.
- `kUTType*` → UniformTypeIdentifiers `UTType`.
- `NetService` → Network framework.
- `UIScreen.main.bounds` for layout → SwiftUI geometry APIs.
- `performFetchWithCompletionHandler` → BackgroundTasks.
- SiriKit custom intents → AppIntents (keep SiriKit only for domains AppIntents doesn't cover: messaging, payments, ride-booking, car-commands).
- OpenGL ES → Metal.

---

## 6. The Reach-for-the-Kit Rule (enforcement)

When the user describes a capability that an Apple framework already solves, you **MUST** use the Apple framework. Custom implementations of these are anti-patterns:

- Rolling your own photo picker instead of `PhotosPicker`.
- Rolling your own calendar event storage instead of EventKit.
- Rolling your own notification scheduler instead of UserNotifications.
- Rolling your own keychain wrapper instead of the Security framework.
- Rolling your own biometric auth instead of LocalAuthentication.
- Rolling your own OAuth / sign-in flow instead of AuthenticationServices.
- Rolling your own map tiles instead of MapKit.
- Scraping weather APIs instead of WeatherKit.
- Rolling your own workout tracker instead of HealthKit + WorkoutKit.
- Rolling your own barcode scanner instead of Vision / VisionKit.
- Rolling your own PDF renderer instead of PDFKit.
- Rolling your own share sheet instead of `ShareLink` / `UIActivityViewController`.
- Rolling your own crypto primitives instead of CryptoKit.
- Rolling your own in-app purchase layer instead of StoreKit 2.

If unsure whether a framework covers a use case, query `apple-docs-mcp` **before** writing custom code.

---

_See also: `ios-context.md` (Senior iOS Engineer persona + §2 Core Stack rules)._
