# Product Spec

## App Overview

LogTail is a developer CLI for tailing and filtering structured logs from local services with sub-100ms keystroke latency. It's an indie tool serving exactly one persona — the individual developer running services on their own machine — and intentionally does not target team or enterprise use cases. There is no admin role, no shared state, and no multi-user concept; justifying the single-persona structure: the tool runs entirely on the developer's local machine, reads only from local log files or local stdin, and never sends data anywhere. Adding a second persona would expand scope into territory better served by hosted log aggregators.

| Persona | Role | Primary JTBD | Relationship to Other Personas |
|---------|------|--------------|--------------------------------|
| Developer (primary) | Individual engineer running local services | Tail and filter local log streams without learning a new query language | None — single-persona tool by design |

## Screen Inventory

| Screen | Description | Features |
|--------|-------------|----------|
| Live Tail | Streaming log view with inline filter bar | Log Tailing |
| Filter Builder | Modal for composing complex filter expressions | Log Tailing |
| Settings TUI | Config screen for sources, colors, keybindings | Log Tailing |

## Permissions & Roles

Single role: developer running the CLI on their own machine. No admin, no remote access, no multi-user concept. The CLI inherits the OS user's filesystem permissions and reads only files the user can already read.

## First 60 Seconds

### Persona: Developer

**First-encounter promise**: The developer can apply a substring filter to a live stream with sub-100ms keystroke latency, rather than piping through `tail -f | grep` and re-running every time the pattern changes.

## Cross-Feature Interactions

- Filter Builder → Live Tail: applying a filter from the builder updates the active filter expression on Live Tail without restarting the stream
- Settings TUI → Live Tail: changing source paths in Settings reloads the tail with new sources, preserving filter state

## Feature: Log Tailing

### States
States: idle (initial), connecting, streaming, filter-active, paused, source-error, parse-error

### Transitions
| From → To | Trigger | Preconditions | Side Effects |
|-----------|---------|---------------|--------------|
| idle → connecting | User runs `logtail <source>` or selects source in TUI | Source path readable by user | Open file handle or stdin reader |
| connecting → streaming | First line successfully read from source | — | Render line in tail view, start render loop |
| connecting → source-error | File not found, permission denied, or source invalid | — | Print error to stderr with specific reason |
| streaming → filter-active | User types in filter bar | Filter expression syntactically valid (validated keystroke-by-keystroke) | Apply filter to incoming and visible lines |
| filter-active → streaming | User clears filter (Esc or backspace to empty) | — | Show all lines |
| streaming → paused | User presses spacebar | — | Stop rendering new lines, buffer in background |
| paused → streaming | User presses spacebar again | — | Drain buffer, resume rendering |
| streaming → parse-error | Line fails to parse as expected format | Source declared as JSON but line is not valid JSON | Show line in raw form with red marker, continue streaming |
| parse-error → streaming | Next valid line arrives | — | Resume normal rendering |
| source-error → connecting | User retries via `r` key | — | Re-attempt to open source |
| any → idle | User presses `q` or Ctrl+C | — | Close file handles, flush buffers, exit cleanly |

### Data Requirements
- idle: no data, blank screen with "Press ? for help"
- connecting: source path string, no display data beyond "Connecting to {source}..."
- streaming: ring buffer of last 10,000 lines [{timestamp, level, message, raw, line_number}], current viewport offset
- filter-active: same as streaming plus current filter expression and match count
- paused: same as streaming plus pause indicator and buffered count
- source-error: error_kind enum (file-not-found | permission-denied | invalid-format), error_message, source_path
- parse-error: failed line raw text — line is rendered with red marker; user can press `i` to inspect the parse error context

### Failure Modes
- Source file deleted mid-stream →
  User sees: Inline message in tail: "Source '{path}' was deleted. Tail paused. Press 'r' to retry or 'q' to quit."
  User can: Retry (re-open if file recreated), quit, switch source via Settings
  System: Stop reading immediately, do NOT crash, do NOT lose buffered lines

- Filter expression has invalid syntax →
  User sees: Filter bar shows red underline with inline error: "Unexpected token ')' at column 14"
  User can: Edit expression, press Esc to clear filter
  System: Do NOT apply broken filter — keep showing previous valid filter results until expression parses

- Log line exceeds maximum line length (1MB) →
  User sees: Line truncated at 1MB with "...[truncated, full line written to ~/.logtail/overflow.log]" suffix in red
  User can: Open overflow file separately, increase limit in settings
  System: Write full line to overflow file, do NOT block stream, do NOT load full line into memory

- Stdin source closes (piped command exits) →
  User sees: "Stream ended. {N} lines tailed. Press 'q' to exit."
  User can: Quit, scroll back through tailed lines, save buffer to file
  System: Stop reading, keep ring buffer in memory for inspection

### Business Rules
- Ring buffer size: 10,000 lines max, oldest dropped on overflow
- Maximum line length: 1MB before truncation
- Filter languages supported: simple substring (default), regex (prefixed `re:`), JSONPath (prefixed `jp:`) for JSON sources
- Render rate: target 60fps, batch render every 16ms regardless of incoming rate
- Pause behavior: while paused, buffer up to 5,000 additional lines, drop oldest beyond that
- Source autodetect: file extension `.json` and `.ndjson` parsed as JSON, everything else parsed as plain text
- Color theme: 16-color terminal default, [DECISION NEEDED: Should we ship a 256-color or truecolor theme as a separate flag? Suggest: yes — `--theme=truecolor` flag, falls back to 16-color if terminal doesn't support]
- Overflow log path: `~/.logtail/overflow.log`, rotated at 100MB
- Keystroke latency target: < 100ms from keypress to filter applied to visible lines
- Config file: `~/.logtail/config.toml`, hot-reloaded on save

### Happy Path
1. Developer runs `logtail ~/myapp/server.log`. Sees: "Connecting to ~/myapp/server.log..." for < 100ms, then live stream of log lines colored by level (info=white, warn=yellow, error=red).
2. Developer types `error` in the filter bar. Sees: filter applied within 100ms, only lines containing "error" visible, match count "127 / 4,521 lines" in the status bar.
3. Developer presses `re:` prefix and types `^\[ERROR\] user_id=\d+`. Sees: regex filter applied, only matching lines visible, syntax errors highlighted live as user types.
4. Developer presses spacebar. Sees: pause indicator appears, "+47 buffered" counter increments as new lines arrive in background. Can: scroll back through tailed lines.
5. Developer presses spacebar again. Sees: buffer drains, "+0 buffered", live stream resumes from where paused.
6. Developer presses `q`. Tail exits cleanly, returns to shell prompt.

### Persona Constraints
- Persona: Developer (primary) — keyboard-first, expects sub-100ms feedback, does not want to learn a query DSL [ux-research.md, feature-intel.md]
  Constraint: filter must apply within 100ms of keystroke — competitor CLI tools have 200-500ms lag, this is the primary differentiator [feature-intel.md]
  Constraint: default filter syntax must be plain substring matching, with regex/JSONPath as opt-in prefixes — developers in research preferred starting simple and escalating [ux-research.md]
  Constraint: must work over SSH on tmux with 16-color terminals — developers reported 256-color tools breaking on legacy servers [ux-research.md]
  Constraint: every keystroke must be reversible (Esc clears filter, spacebar toggles pause) — power users in research valued reversibility over discoverability [feature-intel.md]

### Empty/Loading/Error States
- Idle (no source provided): "Pass a file path or pipe stdin: `logtail <file>` or `tail -f file | logtail`. Press ? for help."
- Connecting: "Connecting to {source}..." with subtle spinner, max 100ms before transitioning to streaming or source-error.
- Streaming with no lines yet: "Waiting for first line..." in dim text. Status bar shows source path.
- Source error: Full-screen message: "{error_kind}: {source_path}\n{error_message}\nPress 'r' to retry or 'q' to quit."
- Parse error inline: Line rendered in red with prefix "[parse error]" — non-blocking, stream continues.

### Acceptance Criteria
- [ ] Verify that filter applies within 100 milliseconds of the user's last keystroke
- [ ] Verify that the ring buffer holds the last 10,000 lines and drops oldest when full
- [ ] Verify that lines exceeding 1MB are truncated with overflow written to ~/.logtail/overflow.log
- [ ] Verify that source-deleted-mid-stream pauses gracefully and offers retry, does not crash
- [ ] Verify that invalid filter expressions show a syntax error inline and do NOT apply a broken filter
- [ ] Verify that pause-resume preserves order and drains buffered lines without dropping
- [ ] Verify that the tool runs on a 16-color terminal over SSH without color glitches
