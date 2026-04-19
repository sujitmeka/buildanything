#!/usr/bin/env tsx
/*
 * buildanything: record mode/flag transitions (task 4.7.1).
 *
 * Called from hooks/session-start after the writer-owner cache compile.
 * Reads docs/plans/.build-state.json, compares the current buildanything
 * flag values (passed via env vars) against the last recorded flag state
 * under mode_transitions[], and APPENDs one row per changed flag.
 *
 * No-op when:
 *   - docs/plans/.build-state.json does not exist (fresh project)
 *   - mode_transitions[] is absent/empty (no prior state to diff against;
 *     first-session capture is deferred to the first actual flip — the
 *     safer choice per the task spec)
 *   - no flags differ from the previous post_flags snapshot
 *
 * Writes atomically: JSON.stringify -> <state>.tmp -> rename().
 *
 * Fail-open: any error is written to stderr and we exit non-zero so the
 * caller can fold it into DEPS_WARNING, but session-start never aborts.
 *
 * CJS-compatible (no import.meta). Invoked via `npx --no-install tsx`.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const TRACKED_FLAGS = [
  "BUILDANYTHING_SDK",
  "BUILDANYTHING_SDK_SPRINT_CONTEXT",
  "BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS",
  "BUILDANYTHING_ENFORCE_WRITER_OWNER",
  "BUILDANYTHING_ENFORCE_WRITE_LEASE",
  "BUILDANYTHING_SCRIBE_SINGLE_WRITER",
  "BUILDANYTHING_ALLOW_RAW_STATE_WRITES",
  "BUILDANYTHING_STRICT_TASK_ID",
] as const;

// Distinct unset sentinel — angle brackets make it un-shell-settable without
// quoting, six chars, no sane operator uses this literal. Replaces the prior
// colliding default of "false" which silently swallowed real operator opt-outs
// like BUILDANYTHING_ENFORCE_WRITER_OWNER=false (warn-mode rollback).
const UNSET_SENTINEL = "<unset>";

type FlagName = (typeof TRACKED_FLAGS)[number];
type FlagSnapshot = Record<FlagName, string>;

interface ModeTransitionRow {
  timestamp: string;
  session_id: string | null;
  flag: FlagName;
  old_value: string;
  new_value: string;
  post_flags: FlagSnapshot;
}

interface BuildState {
  mode_transitions?: ModeTransitionRow[];
  [key: string]: unknown;
}

function defaultFor(_flag: FlagName): string {
  // Unified sentinel for all tracked flags — collision-free with any plausible
  // operator value. See UNSET_SENTINEL comment above.
  return UNSET_SENTINEL;
}

// Legacy default the pre-fix recorder wrote to post_flags snapshots when a
// tracked env var was unset. Only consulted during prev-vs-curr equivalence so
// the first post-fix run does not spuriously record transitions against old
// state files. Matches the old defaultFor() behavior exactly.
function legacyDefaultFor(flag: FlagName): string {
  return flag === "BUILDANYTHING_SDK" ? "on" : "false";
}

// True when the `prev` snapshot was written by the pre-fix recorder. Signal:
// every tracked flag in the snapshot equals its legacy default ("on" for SDK,
// "false" for everything else) and no `<unset>` appears anywhere. Once even a
// single flag has been recorded as `<unset>` (or as any operator-set literal),
// the snapshot is post-fix and legacy-compat does NOT apply — keeps real
// "false" → `<unset>` transitions visible.
function isLegacyDefaultOnlySnapshot(snap: FlagSnapshot): boolean {
  for (const flag of TRACKED_FLAGS) {
    if (snap[flag] !== legacyDefaultFor(flag)) return false;
  }
  return true;
}

// True when `prev` (from disk) and `curr` (from env this run) both represent
// the "unset / default" state, so no real transition occurred. Handles:
//   - exact match: prev == curr (any literal operator value)         → equivalent
//   - new shape:   prev=<unset>, curr=<unset>                        → equivalent
//   - legacy whole-snapshot: prev is pristine legacy defaults AND curr=<unset>
//     for this flag → equivalent (suppresses spurious diff on first post-fix
//     run against a state file written by the pre-fix recorder)
// Any other mismatch — including the critical "false" → `<unset>` un-set after
// a real operator flip — falls through to non-equivalent and records a diff.
function flagValuesEquivalent(
  flag: FlagName,
  prev: string,
  curr: string,
  prevSnapshot: FlagSnapshot,
): boolean {
  if (prev === curr) return true;
  if (prev === UNSET_SENTINEL && curr === UNSET_SENTINEL) return true;
  if (
    curr === UNSET_SENTINEL &&
    prev === legacyDefaultFor(flag) &&
    isLegacyDefaultOnlySnapshot(prevSnapshot)
  ) {
    return true;
  }
  return false;
}

function readCurrentFlags(): FlagSnapshot {
  const out = {} as FlagSnapshot;
  for (const flag of TRACKED_FLAGS) {
    const raw = process.env[flag];
    out[flag] = raw === undefined || raw === "" ? defaultFor(flag) : raw;
  }
  return out;
}

function lastRecordedFlags(state: BuildState): FlagSnapshot | null {
  const rows = Array.isArray(state.mode_transitions) ? state.mode_transitions : [];
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const snap = last?.post_flags;
  if (!snap || typeof snap !== "object") return null;
  const out = {} as FlagSnapshot;
  for (const flag of TRACKED_FLAGS) {
    const v = (snap as Record<string, unknown>)[flag];
    out[flag] = typeof v === "string" ? v : defaultFor(flag);
  }
  return out;
}

function diffFlags(prev: FlagSnapshot, curr: FlagSnapshot): FlagName[] {
  const changed: FlagName[] = [];
  for (const flag of TRACKED_FLAGS) {
    if (!flagValuesEquivalent(flag, prev[flag], curr[flag], prev)) changed.push(flag);
  }
  return changed;
}

function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function formatTransitionLogLine(row: ModeTransitionRow): string {
  const sessionId = row.session_id ?? "null";
  return `[${row.timestamp}] mode_transition flag=${row.flag} old_value=${row.old_value} new_value=${row.new_value} session_id=${sessionId}`;
}

function appendTransitionsToBuildLog(rows: ModeTransitionRow[]): void {
  const logPath = resolve(
    process.env.BUILDANYTHING_BUILD_LOG_PATH ?? "docs/plans/build-log.md",
  );
  const dir = dirname(logPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const payload = `${rows.map(formatTransitionLogLine).join("\n")}\n`;
  appendFileSync(logPath, payload, "utf8");
}

function main(): number {
  const statePath = resolve(
    process.env.BUILDANYTHING_STATE_PATH ?? "docs/plans/.build-state.json",
  );
  if (!existsSync(statePath)) return 0;

  let state: BuildState;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8")) as BuildState;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`record-mode-transitions: parse failed: ${msg}\n`);
    return 1;
  }

  const curr = readCurrentFlags();
  const prev = lastRecordedFlags(state);
  if (prev === null) return 0; // no prior state to diff against; defer capture

  const changed = diffFlags(prev, curr);
  if (changed.length === 0) return 0;

  const timestamp = new Date().toISOString();
  const sessionId =
    (typeof state.session_id === "string" && state.session_id) ||
    process.env.CLAUDE_SESSION_ID ||
    null;

  const rows: ModeTransitionRow[] = changed.map((flag) => ({
    timestamp,
    session_id: sessionId,
    flag,
    old_value: prev[flag],
    new_value: curr[flag],
    post_flags: curr,
  }));

  const existing = Array.isArray(state.mode_transitions) ? state.mode_transitions : [];
  const next: BuildState = { ...state, mode_transitions: [...existing, ...rows] };

  try {
    atomicWriteJson(statePath, next);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`record-mode-transitions: write failed: ${msg}\n`);
    return 1;
  }

  // Best-effort: build-log is additive; state row is already persisted.
  try {
    appendTransitionsToBuildLog(rows);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`record-mode-transitions: build-log append failed: ${msg}\n`);
  }

  return 0;
}

process.exit(main());
