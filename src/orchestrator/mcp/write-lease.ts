/**
 * Write-lease MCP handler (A5).
 * Prevents intra-phase file collisions by requiring implementer dispatches
 * to acquire exclusive leases on file paths before Write|Edit operations.
 */

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

/** In-memory lease store. Persisted to .build-state.json.active_write_leases[] */
const leases: Lease[] = [];

/**
 * Acquire a write lease for the given file paths.
 * Returns granted:true if no overlapping lease exists.
 * Returns granted:false with conflict details if overlap detected.
 */
export function acquireWriteLease(taskId: string, filePaths: string[]): AcquireResult {
  if (!taskId) throw new Error('task_id is required');
  if (!filePaths.length) throw new Error('file_paths must be non-empty');

  // Check for overlapping leases
  for (const existing of leases) {
    const overlap = filePaths.filter(p => existing.paths.includes(p));
    if (overlap.length > 0) {
      return {
        granted: false,
        conflict: { holder: existing.holder, paths: overlap },
      };
    }
  }

  // Grant the lease
  const lease: Lease = {
    holder: taskId,
    paths: [...filePaths],
    acquired_at: new Date().toISOString(),
  };
  leases.push(lease);

  return { granted: true, lease };
}


/**
 * Release all leases held by a task.
 * Called by SubagentStop hook on dispatch return.
 */
export function releaseLease(taskId: string): boolean {
  const idx = leases.findIndex(l => l.holder === taskId);
  if (idx >= 0) {
    leases.splice(idx, 1);
    return true;
  }
  return false;
}

/**
 * Release all leases for a specific task and paths.
 * More granular than releaseLease — releases only specified paths.
 */
export function releasePathsForTask(taskId: string, paths: string[]): void {
  const lease = leases.find(l => l.holder === taskId);
  if (!lease) return;
  lease.paths = lease.paths.filter(p => !paths.includes(p));
  if (lease.paths.length === 0) {
    releaseLease(taskId);
  }
}

/**
 * Get all active leases (for persisting to .build-state.json).
 */
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
  // No lease exists for this path — caller should acquire one first
  return { allowed: false, conflict: undefined };
}

/**
 * Reset all leases (for testing).
 */
export function reset(): void {
  leases.length = 0;
}