---
name: ios-26-platform
description: Use when implementing iOS 26 APIs EXCEPT Liquid Glass (WebView, Chart3D, @Animatable, toolbar morphing, AlarmKit, FoundationModels, Visual Intelligence), deploying iOS 26+ apps, or supporting backward compatibility with iOS 17/18. For Liquid Glass, see `skills/ios/swiftui-liquid-glass/`.
---

# iOS 26 Platform

iOS 26 introduces new SwiftUI APIs, platform frameworks, and automatic modernization at compile time. This skill covers iOS 26 APIs EXCEPT Liquid Glass.

Liquid Glass → see `skills/ios/swiftui-liquid-glass/`

## Overview

iOS 26 modernizes UI with new SwiftUI APIs (WebView, Chart3D, @Animatable), and advanced features (@BackoffAnimation, free-form windows). The core principle: modern UI gets updated automatically at compile time from recompiling with Xcode 26.

## Reference Loading Guide

**ALWAYS load reference files if there is even a small chance the content may be required.** It's better to have the context than to miss a pattern or make a mistake.

| Reference | Load When |
|-----------|-----------|
| **Liquid Glass** | → see `skills/ios/swiftui-liquid-glass/` |
| **[Automatic Adoption](references/automatic-adoption.md)** | Understanding what iOS 26 changes automatically vs what requires code |
| **[SwiftUI APIs](references/swiftui-apis.md)** | Using WebView, Chart3D, `@Animatable`, AttributedString, or new view modifiers |
| **[Toolbar & Navigation](references/toolbar-navigation.md)** | Customizing toolbars with spacers, morphing, glass button styles, or search |
| **[Backward Compatibility](references/backward-compat.md)** | Supporting iOS 17/18 alongside iOS 26, or using UIDesignRequiresCompatibility |

## Core Workflow

1. **Check deployment target** — iOS 26+ required for new APIs
2. **Recompile with Xcode 26** — Standard controls get automatic modernization
3. **Identify new API opportunities** — WebView, Chart3D, @Animatable, toolbar morphing
4. **Add @available guards** — For backward compatibility with iOS 17/18
5. **Test accessibility** — Verify Reduce Transparency, Increase Contrast, Reduce Motion

Liquid Glass → see `skills/ios/swiftui-liquid-glass/`

## Common Mistakes

1. **Ignoring backward compatibility** — Targeting iOS 26+ without `@available` guards breaks iOS 17/18 support. Always use `if #available(iOS 26, *)` for new APIs.

2. **Animation performance issues** — New iOS 26 animations can be expensive. Respect Reduce Motion accessibility setting and profile with Instruments 26 before shipping.

3. **Not testing on actual devices** — Simulator rendering differs from hardware. Test new visual APIs on iPhone 15 Pro, iPad, and Mac to verify quality.

4. **Using old UIView patterns with new SwiftUI APIs** — Mixing UIView-based navigation with iOS 26 SwiftUI creates inconsistent appearances. Migrate fully to SwiftUI or wrap carefully with UIViewRepresentable.

Liquid Glass-specific pitfalls → see `skills/ios/swiftui-liquid-glass/`


---

Vendored from: https://github.com/johnrogers/claude-swift-engineering/tree/main/plugins/swift-engineering/skills/ios-26-platform
