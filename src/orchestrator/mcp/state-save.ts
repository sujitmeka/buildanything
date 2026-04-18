/**
 * state_save MCP handler.
 *
 * Atomic state persistence for .build-state.json (and any state file).
 * All mutations to .build-state.json MUST route through this MCP —
 * raw Write|Edit is denied by the writer-owner hook (Stage 3.3.1).
 *
 * Protocol: write-to-.tmp + fsync + rename (POSIX atomic on same filesystem).
 * Every write produces a SHA-256 integrity checksum for verification.
 *
 * Spec: MIGRATION-PLAN-FINAL.md §4 Stage 3 (tasks 3.2.1–3.2.3)
 */

import {
  writeFileSync,
  readFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  openSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateSaveResult {
  success: boolean;
  path: string;
  sha256: string;
  bytesWritten: number;
}

export interface StateReadResult {
  state: Record<string, unknown>;
  sha256: string;
}

// ---------------------------------------------------------------------------
// Exclusive-write lock — prevents concurrent state_save calls
// ---------------------------------------------------------------------------

let writeLocked = false;

// ---------------------------------------------------------------------------
// Core: atomic state save (tasks 3.2.1 + 3.2.2 + 3.2.3)
// ---------------------------------------------------------------------------

/**
 * Atomically save state to a JSON file.
 *
 * Protocol (write-to-.tmp + fsync + os.replace):
 *   1. Serialize state to deterministic JSON
 *   2. Compute SHA-256 checksum over serialized content
 *   3. Write to {path}.tmp
 *   4. fsync the .tmp fd (flush to disk — survives power loss)
 *   5. rename .tmp → target (POSIX atomic on same filesystem)
 *   6. On failure: delete .tmp, release lock, re-throw
 *
 * Callers: orchestrator phase transitions, cycle_counter_check MCP,
 * SubagentStart hook, write-lease persistence, token accounting.
 */
export function stateSave(path: string, state: Record<string, unknown>): StateSaveResult {
  if (writeLocked) {
    throw new Error('Exclusive write lock held — concurrent state_save call rejected');
  }

  writeLocked = true;
  const tmp = `${path}.tmp`;

  try {
    // Ensure parent directory exists
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // 1. Serialize — deterministic pretty-print + trailing newline
    const content = JSON.stringify(state, null, 2) + '\n';

    // 2. SHA-256 integrity checksum (task 3.2.3)
    const sha256 = createHash('sha256').update(content).digest('hex');

    // 3. Write to .tmp
    writeFileSync(tmp, content, 'utf-8');

    // 4. fsync — flush kernel buffers to disk (task 3.2.2)
    // Open with 'r+' (read-write) to guarantee data buffer flush on all platforms.
    // Opening with 'r' (read-only) may only flush metadata on some systems.
    const fd = openSync(tmp, 'r+');
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    // 5. Atomic rename — os.replace() equivalent (task 3.2.2)
    renameSync(tmp, path);

    return { success: true, path, sha256, bytesWritten: Buffer.byteLength(content) };
  } catch (err) {
    // 6. Clean up .tmp on failure — never leave partial state
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort */ }
    throw err;
  } finally {
    writeLocked = false;
  }
}

// ---------------------------------------------------------------------------
// State read + integrity verification
// ---------------------------------------------------------------------------

/**
 * Read state from a JSON file and compute its SHA-256 checksum.
 * Used by SubagentStart hook, cycle_counter_check, write-lease init.
 */
export function stateRead(path: string): StateReadResult {
  const content = readFileSync(path, 'utf-8');
  const sha256 = createHash('sha256').update(content).digest('hex');
  return { state: JSON.parse(content) as Record<string, unknown>, sha256 };
}

/**
 * Verify integrity of a state file against an expected SHA-256 checksum.
 * Returns true if the file content matches the expected hash.
 *
 * Use case: crash recovery — confirm .build-state.json wasn't corrupted
 * by a partial write (the atomic protocol prevents this, but defense-in-depth).
 */
export function verifyIntegrity(path: string, expectedSha256: string): boolean {
  const content = readFileSync(path, 'utf-8');
  const actual = createHash('sha256').update(content).digest('hex');
  return actual === expectedSha256;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Reset internal state (write lock). For testing only.
 */
export function reset(): void {
  writeLocked = false;
}
