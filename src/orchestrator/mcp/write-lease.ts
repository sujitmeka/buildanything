/**
 * Write-lease MCP handler (A5).
 * Prevents intra-phase file collisions by requiring implementer dispatches
 * to acquire exclusive leases on file paths before Write|Edit operations.
 *
 * Leases are persisted atomically to .build-state.json.active_write_leases[]
 * so the PreToolUse hook (which re-reads from disk) sees them.
 */

import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';

export interface Lease {
  holder: string;       // task_id of the lease holder
  paths: string[];      // file paths under lease
  acquired_at: string;  // ISO timestamp
}

export interface LeaseConflict {
  holder: string;       // task_id of the existing lease holder
  paths: string[];      // overlapping file paths
}

export interface AcquireResult {
  granted: boolean;
  lease?: Lease;
  conflict?: LeaseConflict;
}

/** In-memory lease store — kept in sync with disk via persistLeases(). */
const leases: Lease[] = [];

/** Path to .build-state.json — set via init() or defaults to docs/plans/.build-state.json */
let statePath = 'docs/plans/.build-state.json';

/**
 * Initialize the lease manager with the state file path.
 * Loads existing leases from disk into memory.
 */
export function init(buildStatePath: string): void {
  statePath = buildStatePath;
  leases.length = 0;
  if (!existsSync(statePath)) return;
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    const diskLeases = state?.active_write_leases;
    if (Array.isArray(diskLeases)) {
      for (const l of diskLeases) {
        if (l?.holder && Array.isArray(l?.paths)) {
          leases.push({ holder: l.holder, paths: l.paths, acquired_at: l.acquired_at ?? '' });
        }
      }
    }
  } catch { /* fresh state or parse error — start with empty leases */ }
}

/**
 * Persist current leases to .build-state.json atomically.
 * Uses write-to-.tmp + rename (same protocol as state_save MCP).
 *
 * CRITICAL: If persist fails, the in-memory lease exists but the PreToolUse
 * hook (a separate process) reads from disk and won't see it — creating a
 * silent fail-closed where legitimate writes are denied. On persist failure,
 * we roll back the in-memory state to match disk and re-throw so the caller
 * knows the acquire didn't stick.
 */
function persistLeases(): void {
  if (!existsSync(statePath)) return;
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf-8'));
    state.active_write_leases = leases.map(l => ({ ...l }));
    const tmp = `${statePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf-8');
    renameSync(tmp, statePath);
  } catch (err) {
    // Persist failed — roll back in-memory state to match what's on disk,
    // then re-throw. This prevents the MCP thinking a lease exists while
    // the hook (reading disk) sees nothing and denies writes.
    try {
      const diskState = JSON.parse(readFileSync(statePath, 'utf-8'));
      const diskLeases = diskState?.active_write_leases;
      leases.length = 0;
      if (Array.isArray(diskLeases)) {
        for (const l of diskLeases) {
          if (l?.holder && Array.isArray(l?.paths)) {
            leases.push({ holder: l.holder, paths: l.paths, acquired_at: l.acquired_at ?? '' });
          }
        }
      }
    } catch { /* disk unreadable — empty leases is the safest state */ leases.length = 0; }
    throw new Error(`write-lease: persist failed, in-memory rolled back: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Acquire a write lease for the given file paths.
 * Persists to disk atomically so the PreToolUse hook sees the lease.
 */
export function acquireWriteLease(taskId: string, filePaths: string[]): AcquireResult {
  if (!taskId) throw new Error('task_id is required');
  if (!filePaths.length) throw new Error('file_paths must be non-empty');

  for (const existing of leases) {
    const overlap = filePaths.filter(p => existing.paths.includes(p));
    if (overlap.length > 0) {
      return { granted: false, conflict: { holder: existing.holder, paths: overlap } };
    }
  }

  const lease: Lease = { holder: taskId, paths: [...filePaths], acquired_at: new Date().toISOString() };
  leases.push(lease);
  persistLeases();
  return { granted: true, lease };
}

/**
 * Release ALL leases held by a task (handles multiple leases per task).
 * Persists to disk. Called by SubagentStop hook on dispatch return.
 */
export function releaseLease(taskId: string): boolean {
  let released = false;
  for (let i = leases.length - 1; i >= 0; i--) {
    if (leases[i].holder === taskId) {
      leases.splice(i, 1);
      released = true;
    }
  }
  if (released) persistLeases();
  return released;
}

/**
 * Release specific paths for a task. Persists to disk.
 */
export function releasePathsForTask(taskId: string, paths: string[]): void {
  const lease = leases.find(l => l.holder === taskId);
  if (!lease) return;
  lease.paths = lease.paths.filter(p => !paths.includes(p));
  if (lease.paths.length === 0) {
    releaseLease(taskId);
  } else {
    persistLeases();
  }
}

/** Get all active leases. */
export function getActiveLeases(): readonly Lease[] {
  return leases;
}

/**
 * Check if a specific file path is leased and by whom.
 * Used by the writer-owner PreToolUse hook extension.
 */
export function checkPathLease(filePath: string, callerTaskId: string): { allowed: boolean; conflict?: LeaseConflict } {
  for (const lease of leases) {
    if (lease.paths.includes(filePath)) {
      if (lease.holder === callerTaskId) return { allowed: true };
      return { allowed: false, conflict: { holder: lease.holder, paths: [filePath] } };
    }
  }
  return { allowed: false, conflict: undefined };
}

/** Reset all leases (for testing). */
export function reset(): void {
  leases.length = 0;
}