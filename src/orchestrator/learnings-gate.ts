/**
 * Learnings gate (audit issue #9).
 *
 * Phase 5 must emit learnings.jsonl before the build can proceed to Phase 6.
 * This gate checks that the file exists and contains at least one valid row.
 */

import { existsSync, readFileSync } from 'node:fs';

export interface LearningsGateResult {
  pass: boolean;
  reason: string;
  rowCount: number;
}

/**
 * Check that learnings.jsonl exists and is non-empty.
 * Called by the orchestrator at the Phase 5 → Phase 6 boundary.
 */
export function learningsGate(projectDir: string): LearningsGateResult {
  const path = `${projectDir}/docs/plans/learnings.jsonl`;
  if (!existsSync(path)) {
    return { pass: false, reason: `learnings.jsonl not found at ${path}. Phase 5 must emit it before proceeding.`, rowCount: 0 };
  }

  const content = readFileSync(path, 'utf-8').trim();
  if (!content) {
    return { pass: false, reason: 'learnings.jsonl exists but is empty. Phase 5 must write at least one PITFALL/PATTERN row.', rowCount: 0 };
  }

  const lines = content.split('\n').filter(Boolean);
  let validRows = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.pattern_type) validRows++;
    } catch { /* skip malformed */ }
  }

  if (validRows === 0) {
    return { pass: false, reason: 'learnings.jsonl has no valid rows with pattern_type. Phase 5 must emit at least one PITFALL/PATTERN row.', rowCount: 0 };
  }

  return { pass: true, reason: `learnings.jsonl contains ${validRows} valid row(s).`, rowCount: validRows };
}
