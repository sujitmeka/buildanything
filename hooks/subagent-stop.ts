#!/usr/bin/env tsx
/*
 * buildanything: SubagentStop lease-release hook handler (task 2.5.1).
 *
 * When a subagent terminates, Claude Code fires a SubagentStop event. This
 * handler reads that payload, derives the stopping subagent's task_id
 * strictly from parent_tool_use_id (matching the 2.4.2 semantic), and
 * removes every entry from docs/plans/.build-state.json.active_write_leases[]
 * whose task_id matches. Writes back via atomic write-to-.tmp + rename.
 *
 * This mirrors the contract of src/orchestrator/mcp/write-lease.ts's
 * releaseLease(taskId) without importing it — subagents running in Claude
 * Code do not have that module loaded.
 *
 * Best-effort semantics:
 *   - No parent_tool_use_id → no-op
 *   - Missing / corrupt state file → stderr log, exit 0
 *   - Write failure → stderr log, exit 0
 *   - ANY error → stderr log, exit 0. Never block the Stop event.
 *
 * Unknown keys on lease entries are preserved when filtering.
 */

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const STATE_PATH_REL = "docs/plans/.build-state.json";

interface SubagentStopPayload {
  session_id?: string;
  parent_tool_use_id?: string;
  tool_use_id?: string;
  subagent_type?: string;
}

// Lease entries are `{task_id, file_paths[]}` plus possibly extra fields.
// We preserve unknown keys when filtering, so treat the entry shape opaquely
// except for the task_id we need to compare on.
interface LeaseEntry {
  task_id?: unknown;
  [k: string]: unknown;
}

interface BuildState {
  active_write_leases?: LeaseEntry[];
  [k: string]: unknown;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload(raw: string): SubagentStopPayload | null {
  const text = raw.trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as SubagentStopPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function deriveTaskId(payload: SubagentStopPayload): string | null {
  // STRICT: only parent_tool_use_id, matching the 2.4.2 acquisition semantic.
  const raw = payload.parent_tool_use_id;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function atomicWriteJson(path: string, value: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function main(): number {
  const raw = readStdin();
  const payload = parsePayload(raw);
  if (!payload) {
    process.stderr.write(
      "buildanything: subagent-stop could not parse stdin payload; skipping\n",
    );
    return 0;
  }

  const taskId = deriveTaskId(payload);
  if (!taskId) {
    // No parent_tool_use_id → nothing to release. Silent no-op.
    return 0;
  }

  const statePath = resolve(process.cwd(), STATE_PATH_REL);

  let text: string;
  try {
    text = readFileSync(statePath, "utf8");
  } catch {
    // No state file (build not started) — nothing to release.
    return 0;
  }

  let state: BuildState;
  try {
    state = JSON.parse(text) as BuildState;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-stop could not parse .build-state.json (${msg}); skipping\n`,
    );
    return 0;
  }

  const existing = Array.isArray(state.active_write_leases)
    ? state.active_write_leases
    : [];

  const filtered = existing.filter((l) => l?.task_id !== taskId);
  const releasedCount = existing.length - filtered.length;

  if (releasedCount === 0) {
    // No leases owned by this task_id — nothing to write.
    return 0;
  }

  const next: BuildState = { ...state, active_write_leases: filtered };

  try {
    atomicWriteJson(statePath, next);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-stop could not write .build-state.json (${msg}); leases NOT released for task '${taskId}'\n`,
    );
    return 0;
  }

  process.stderr.write(
    `buildanything: subagent-stop released ${releasedCount} lease(s) for task '${taskId}'\n`,
  );
  return 0;
}

process.exit(main());
