---
name: swiftui-design-tokens
description: Map brand design tokens (colors, typography, spacing, shapes) to SwiftUI Color/Font/Shape extensions with dark mode and Dynamic Type support. Use when implementing a design system, theming layer, or converting Figma/Style Dictionary tokens to Swift.
license: MIT
metadata:
  author: oneshot
  version: "1.0.0"
---

Generate SwiftUI design token infrastructure from brand specifications. Tokens follow a three-tier hierarchy and produce type-safe Swift extensions that respect dark mode and Dynamic Type.

## Token Hierarchy

Design tokens are organized in three tiers. Each tier references only the tier below it.

```
Component Tokens  ──>  Semantic/Alias Tokens  ──>  Global Tokens
(buttonBackground)     (brandPrimary)              (blue600)
```

**Global tokens** are raw values with no semantic meaning: hex colors, point sizes, font names.

**Semantic (alias) tokens** assign meaning to globals. A single semantic token resolves to different globals depending on context (light/dark, high contrast). Most UI code references this tier.

**Component tokens** bind semantic tokens to specific controls. A `ButtonStyle` reads `button.background` rather than reaching down to `brandPrimary` directly.

---

## 1. Color Tokens

### Global palette

```swift
// GlobalTokens+Color.swift
extension Color {
    enum Global {
        static let blue50  = Color(hex: 0xE3F2FD)
        static let blue600 = Color(hex: 0x1E88E5)
        static let blue900 = Color(hex: 0x0D47A1)
        static let grey50  = Color(hex: 0xFAFAFA)
        static let grey900 = Color(hex: 0x212121)
    }
}
```

### Semantic tokens with dark mode

**Option A -- Programmatic resolution (no asset catalog):**

```swift
// SemanticTokens+Color.swift
extension Color {
    // Resolves light/dark at read time via UIColor's trait system.
    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(dark)
                : UIColor(light)
        })
    }
}

extension Color {
    enum Brand {
        static let primary    = Color(light: .Global.blue600, dark: .Global.blue50)
        static let onPrimary  = Color(light: .Global.grey50,  dark: .Global.grey900)
    }
    enum Surface {
        static let background = Color(light: .Global.grey50,  dark: .Global.grey900)
        static let foreground = Color(light: .Global.grey900, dark: .Global.grey50)
    }
    enum Status {
        static let error      = Color(light: Color(hex: 0xB71C1C), dark: Color(hex: 0xEF9A9A))
        static let success    = Color(light: Color(hex: 0x1B5E20), dark: Color(hex: 0xA5D6A7))
    }
}
```

**Option B -- Asset catalog (preferred when designers hand off ColorSets):**

1. Create `Colors.xcassets` with entries like `brand-primary`, setting Appearances to "Any, Dark."
2. Reference them with a thin extension:

```swift
extension Color {
    enum Brand {
        static let primary   = Color("brand-primary")
        static let onPrimary = Color("brand-onPrimary")
    }
}
```

Asset catalogs also support High Contrast variants (Appearances: "Any, Dark" + "High Contrast, High Contrast Dark") at no extra code cost.

### Hex initializer (utility)

```swift
extension Color {
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8)  & 0xFF) / 255,
            blue:  Double( hex        & 0xFF) / 255,
            opacity: alpha
        )
    }
}
```

---

## 2. Typography Tokens

### Global type scale

```swift
// GlobalTokens+Typography.swift
enum TypeScale {
    case displayLarge   // 34pt
    case displayMedium  // 28pt
    case headlineLarge  // 24pt
    case headlineMedium // 20pt
    case bodyLarge      // 17pt -- iOS default body
    case bodyMedium     // 15pt
    case caption        // 12pt
    case overline       // 11pt
}
```

### Font extension with Dynamic Type

Always use `Font.TextStyle` or `.relativeTo()` so the system scales with the user's preferred content size.

```swift
// SemanticTokens+Font.swift
extension Font {
    enum Brand {
        static let displayLarge   = Font.system(.largeTitle, weight: .light)
        static let displayMedium  = Font.system(.title, weight: .light)
        static let headlineLarge  = Font.system(.title2, weight: .semibold)
        static let headlineMedium = Font.system(.title3, weight: .semibold)
        static let bodyLarge      = Font.system(.body)
        static let bodyMedium     = Font.system(.subheadline)
        static let caption        = Font.system(.caption)
        static let overline       = Font.system(.caption2, weight: .medium)
    }
}
```

### Custom font families with Dynamic Type scaling

When the brand requires a non-system typeface, use `.relativeTo()` to inherit the scaling curve of a built-in text style.

```swift
extension Font {
    enum Brand {
        static let headlineLarge = Font.custom("InterDisplay-SemiBold", size: 24, relativeTo: .title2)
        static let bodyLarge     = Font.custom("Inter-Regular", size: 17, relativeTo: .body)
        static let caption       = Font.custom("Inter-Regular", size: 12, relativeTo: .caption)
    }
}
```

This ensures a user who sets their Dynamic Type preference to "Extra Large" sees proportionally larger text, while respecting the brand typeface.

### Testing Dynamic Type

Use the environment override in previews to verify all sizes:

```swift
#Preview("Accessibility XXL") {
    TokenShowcase()
        .environment(\.sizeCategory, .accessibilityExtraExtraExtraLarge)
}
```

---

## 3. Spacing & Shape Tokens

### Spacing

Define spacing on a base-4 or base-8 grid. Expose as static properties so call sites read `Spacing.md` not magic numbers.

```swift
enum Spacing {
    static let xxxs: CGFloat = 2
    static let xxs: CGFloat  = 4
    static let xs: CGFloat   = 8
    static let sm: CGFloat   = 12
    static let md: CGFloat   = 16
    static let lg: CGFloat   = 24
    static let xl: CGFloat   = 32
    static let xxl: CGFloat  = 48
}
```

### Corner radius

```swift
enum CornerRadius {
    static let none: CGFloat   = 0
    static let sm: CGFloat     = 4
    static let md: CGFloat     = 8
    static let lg: CGFloat     = 12
    static let xl: CGFloat     = 16
    static let full: CGFloat   = 9999  // pill shape
}
```

### Elevation / shadow

```swift
struct Elevation {
    let color: Color
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat

    static let none = Elevation(color: .clear, radius: 0, x: 0, y: 0)
    static let sm   = Elevation(color: .black.opacity(0.08), radius: 4, x: 0, y: 2)
    static let md   = Elevation(color: .black.opacity(0.12), radius: 8, x: 0, y: 4)
    static let lg   = Elevation(color: .black.opacity(0.16), radius: 16, x: 0, y: 8)
}

extension View {
    func elevation(_ e: Elevation) -> some View {
        self.shadow(color: e.color, radius: e.radius, x: e.x, y: e.y)
    }
}
```

---

## 4. Naming Conventions

Follow a `Category.Role.Variant` pattern. Autocomplete guides developers to valid values.

| Token path | Resolves to |
|---|---|
| `Color.Brand.primary` | Main brand color, adapts to dark mode |
| `Color.Surface.background` | Screen/card background |
| `Color.Status.error` | Destructive/error accent |
| `Font.Brand.headlineLarge` | Primary heading, scales with Dynamic Type |
| `Spacing.md` | Standard 16pt spacing unit |
| `CornerRadius.lg` | Card corner radius (12pt) |
| `Elevation.sm` | Subtle raised shadow |

Nested enums (`Color.Brand`, `Color.Surface`, `Color.Status`) group tokens by purpose while keeping the namespace under the native SwiftUI type. This means call sites write `Color.Brand.primary`, not `DesignTokens.Color.brand.primary`.

---

## 5. Environment-Based Theming

When an app supports multiple themes (e.g., per-brand white-labeling), inject the active theme through the SwiftUI environment.

```swift
// Theme.swift
struct Theme {
    let brandPrimary: Color
    let brandOnPrimary: Color
    let surfaceBackground: Color
    let headlineFont: Font
    let bodyFont: Font
    let cornerRadius: CGFloat
}

extension Theme {
    static let defaultTheme = Theme(
        brandPrimary: .Global.blue600,
        brandOnPrimary: .Global.grey50,
        surfaceBackground: .Global.grey50,
        headlineFont: .Brand.headlineLarge,
        bodyFont: .Brand.bodyLarge,
        cornerRadius: CornerRadius.md
    )
}

// EnvironmentKey
struct ThemeKey: EnvironmentKey {
    static let defaultValue = Theme.defaultTheme
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}
```

Usage in views:

```swift
struct BrandCard: View {
    @Environment(\.theme) private var theme

    var body: some View {
        VStack {
            Text("Welcome")
                .font(theme.headlineFont)
                .foregroundStyle(theme.brandOnPrimary)
        }
        .padding(Spacing.md)
        .background(theme.brandPrimary)
        .clipShape(RoundedRectangle(cornerRadius: theme.cornerRadius))
    }
}
```

Apply a theme to an entire subtree:

```swift
ContentView()
    .environment(\.theme, .partnerBrand)
```

---

## 6. Component Tokens

Component tokens are the final tier -- they bind semantic tokens to a specific control's visual properties so the control never references globals directly.

```swift
struct ButtonTokens {
    let background: Color
    let foreground: Color
    let font: Font
    let cornerRadius: CGFloat
    let paddingH: CGFloat
    let paddingV: CGFloat

    static let primary = ButtonTokens(
        background: .Brand.primary,
        foreground: .Brand.onPrimary,
        font: .Brand.bodyLarge,
        cornerRadius: CornerRadius.md,
        paddingH: Spacing.md,
        paddingV: Spacing.sm
    )

    static let secondary = ButtonTokens(
        background: .clear,
        foreground: .Brand.primary,
        font: .Brand.bodyMedium,
        cornerRadius: CornerRadius.md,
        paddingH: Spacing.md,
        paddingV: Spacing.xs
    )
}

struct BrandButtonStyle: ButtonStyle {
    let tokens: ButtonTokens

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(tokens.font)
            .foregroundStyle(tokens.foreground)
            .padding(.horizontal, tokens.paddingH)
            .padding(.vertical, tokens.paddingV)
            .background(tokens.background)
            .clipShape(RoundedRectangle(cornerRadius: tokens.cornerRadius))
            .opacity(configuration.isPressed ? 0.8 : 1.0)
    }
}
```

---

## 7. Code Generation with Style Dictionary

When tokens originate from Figma or a design tool, use [Style Dictionary](https://styledictionary.com/) to generate Swift from a JSON source of truth.

### Token source file (`tokens/color.json`)

```json
{
  "color": {
    "brand": {
      "primary": {
        "value": "#1E88E5",
        "darkValue": "#E3F2FD",
        "type": "color"
      },
      "onPrimary": {
        "value": "#FAFAFA",
        "darkValue": "#212121",
        "type": "color"
      }
    }
  }
}
```

### Style Dictionary config (`config.json`)

```json
{
  "source": ["tokens/**/*.json"],
  "platforms": {
    "ios-swift": {
      "transformGroup": "ios-swift",
      "buildPath": "Generated/",
      "files": [
        {
          "destination": "ColorTokens.swift",
          "format": "ios-swift/enum.swift",
          "filter": { "type": "color" }
        }
      ]
    }
  }
}
```

### Custom Swift formatter (register in `build.js`)

```javascript
StyleDictionary.registerFormat({
  name: 'swiftui/color-tokens',
  formatter({ dictionary }) {
    const lines = dictionary.allTokens.map(token => {
      const name = token.name; // camelCase from transform
      const hex = token.value.replace('#', '0x');
      return `    static let ${name} = Color(hex: ${hex})`;
    });
    return `import SwiftUI\n\nextension Color {\n    enum Generated {\n${lines.join('\n')}\n    }\n}`;
  }
});
```

Run `npx style-dictionary build` to produce the Swift file. Commit the generated output so builds do not depend on Node at compile time.

### Alternative: SwiftTokenGen

[SwiftTokenGen](https://github.com/chrishoste/SwiftTokenGen) accepts Figma token exports or Style Dictionary JSON and generates Swift via Stencil templates, giving full control over the output format without writing JavaScript.

---

## 8. File Organization

```
DesignSystem/
  Tokens/
    GlobalTokens+Color.swift
    GlobalTokens+Typography.swift
    SemanticTokens+Color.swift
    SemanticTokens+Font.swift
    Spacing.swift
    CornerRadius.swift
    Elevation.swift
  Theme/
    Theme.swift
    ThemeKey.swift
  Components/
    ButtonTokens.swift
    BrandButtonStyle.swift
  Utilities/
    Color+Hex.swift
  Generated/          # output from Style Dictionary (if used)
    ColorTokens.swift
```

---

## Decision Guide

| Situation | Approach |
|---|---|
| Single brand, no runtime theming | Static extensions on `Color`/`Font` (Section 1-2) |
| Single brand, dark mode needed | `Color(light:dark:)` initializer or asset catalog (Section 1) |
| Multi-brand / white-label | Environment-based `Theme` struct (Section 5) |
| Tokens from Figma / design tool | Style Dictionary code gen (Section 7) |
| Many color variants + high contrast | Asset catalog with Appearances (Section 1, Option B) |
