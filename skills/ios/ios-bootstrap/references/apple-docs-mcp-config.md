# apple-docs-mcp — MCP config snippet

Add under `mcpServers` in `~/.claude.json` or `./.mcp.json`:

```json
{
  "mcpServers": {
    "apple-docs": {
      "command": "npx",
      "args": ["-y", "apple-docs-mcp@latest"]
    }
  }
}
```

## What it gives you
- Live query against developer.apple.com/documentation
- Framework → symbol lookup (protocols, methods, availability annotations)
- Deprecation flags and iOS-version gating
- Sample-code snippets for specific APIs

## When to use it
- Before writing any non-trivial iOS code, confirm the current API (especially for iOS 26 additions: FoundationModels, AlarmKit, SwiftUI `WebView`, Visual Intelligence).
- Whenever a symbol triggers a deprecation warning — find the replacement.
- When `ios-frameworks-map.md` is ambiguous about which framework covers a capability.

## Verification
After restarting Claude Code, confirm tools prefixed `mcp__apple-docs__` appear.
