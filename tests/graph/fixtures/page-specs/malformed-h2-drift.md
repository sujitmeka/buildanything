# Page: Map Browse

## Purpose

The default landing surface for any visitor — a game-styled illustrated map. Mirrors the broken-build form from tables2.1.1.

## Layout

```
┌──────────────────────────────────────┐
│ <Header>  goodtables       sign in │
├──────────────────────────────────────┤
│   <MapCanvas mode="discover">        │
│   - illustrated MapTiler tiles       │
│   - 15+ pins at zoom 7               │
└──────────────────────────────────────┘
```

## Content Hierarchy

| # | Section | Data Shown | Component | Data Source | Weight |
|---|---------|-----------|-----------|-------------|--------|
| 1 | Header | Wordmark, sign-in link | `nav-top` | `local` | tertiary |
| 2 | Map Canvas | Illustrated map with pins | `map-canvas` | `GET /api/cafes?bbox=` | primary |

## Key Copy

- **"goodtables"** — placement: header wordmark.
- **"sign in"** — placement: header CTA.
