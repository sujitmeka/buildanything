# Product Spec

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Live Tail | Streaming log view with inline filter bar | Log Tailing |
| Filter Builder | Modal for composing complex filter expressions | Log Tailing |
| Settings TUI | Config screen for sources, colors, keybindings | Log Tailing |

## Permissions & Roles

Single role: developer running the CLI on their own machine. No admin, no remote access, no multi-user concept.

## Cross-Feature Interactions

- Filter Builder → Live Tail: applying a filter from the builder updates the active filter expression on Live Tail without restarting the stream
- Settings TUI → Live Tail: changing source paths in Settings reloads the tail with new sources, preserving filter state

## Feature: Log Tailing

### States
States: idle (initial), connecting, streaming, filter-active, paused, source-error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| idle → connecting | User runs `logtail <source>` | Source path readable | Open file handle |
| connecting → streaming | First line read from source | — | Render line, start render loop |
| connecting → source-error | File not found or permission denied | — | Print error to stderr |
| streaming → filter-active | User types in filter bar | Filter expression valid | Apply filter |
| filter-active → streaming | User clears filter | — | Show all lines |
| streaming → paused | User presses spacebar | — | Stop rendering, buffer in background |
| paused → streaming | User presses spacebar again | — | Drain buffer, resume |
| any → idle | User presses q or Ctrl+C | — | Close handles, exit |

### Data Requirements
- streaming: ring buffer of last 10,000 lines [{timestamp, level, message, raw}], viewport offset
- filter-active: same as streaming plus filter expression and match count
- paused: same as streaming plus pause indicator and buffered count
- source-error: error_kind, error_message, source_path
- idle: no data, blank screen

### Failure Modes
- Source file deleted mid-stream →
  User sees: "Source '{path}' was deleted. Tail paused. Press 'r' to retry or 'q' to quit."
  User can: Retry, quit, switch source
  System: Stop reading immediately, do NOT crash

- Filter expression syntax invalid →
  User sees: Filter bar red underline with "Unexpected token at column N"
  User can: Edit expression, press Esc to clear
  System: Do NOT apply broken filter, keep showing previous valid filter results

### Business Rules
- Ring buffer size: 10,000 lines max, oldest dropped on overflow
- Maximum line length: 1MB before truncation
- Filter languages: substring (default), regex (`re:` prefix), JSONPath (`jp:` prefix) for JSON sources
- Render rate: 60fps target, batch every 16ms
- Keystroke latency target: < 100ms

### Happy Path
1. Developer runs `logtail ~/myapp/server.log`. Sees: live stream colored by level.
2. Developer types `error` in filter bar. Sees: filter applied within 100ms, match count visible.
3. Developer presses spacebar. Sees: pause indicator, buffer counter increments.
4. Developer presses spacebar again. Sees: buffer drains, stream resumes.
5. Developer presses `q`. Exits cleanly.

### Persona Constraints
- Persona: Developer — keyboard-first, expects sub-100ms feedback [ux-research.md]
  Constraint: filter must apply within 100ms of keystroke [feature-intel.md]
  Constraint: default filter must be substring, regex/JSONPath opt-in [ux-research.md]

### Empty/Loading/Error States
- Idle: "Pass a file or pipe stdin. Press ? for help."
- Connecting: "Connecting to {source}..." spinner, max 100ms.
- Source error: Full-screen "{error_kind}: {path}\n{message}\nPress 'r' to retry or 'q' to quit."

### Acceptance Criteria
- [ ] Verify that filter applies within 100 milliseconds of the user's last keystroke
- [ ] Verify that the ring buffer holds the last 10,000 lines
- [ ] Verify that source-deleted-mid-stream pauses gracefully and offers retry
- [ ] Verify that invalid filter expressions show inline syntax error
- [ ] Verify that pause-resume preserves order
