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

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const TRACKED_FLAGS = [
  "BUILDANYTHING_SDK",
  "BUILDANYTHING_ENFORCE_WRITER_OWNER",
  "BUILDANYTHING_ENFORCE_WRITE_LEASE",
  "BUILDANYTHING_SDK_SPRINT_CONTEXT",
  "BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS",
] as const;

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

function defaultFor(flag: FlagName): string {
  // BUILDANYTHING_SDK defaults to "on" when unset (v2 opt-out contract).
  // All other flags default to "false" when unset.
  return flag === "BUILDANYTHING_SDK" ? "on" : "false";
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
    if (prev[flag] !== curr[flag]) changed.push(flag);
  }
  return changed;
}

function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
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
  return 0;
}

process.exit(main());
