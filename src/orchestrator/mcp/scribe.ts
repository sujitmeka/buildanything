/**
 * scribe_decision MCP handler.
 *
 * The ONLY writer to docs/plans/decisions.jsonl.
 * Subagents return deviation_row objects → orchestrator routes them here.
 * Append-only — NEVER rewrites or truncates the file.
 *
 * Spec: protocols/decision-log.md
 * Schema: docs/migration/decisions.schema.json
 * Migration ref: MIGRATION-PLAN-FINAL.md §4 Stage 1 (tasks 1.2.1–1.2.3)
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RejectedAlternative {
  approach: string;
  reason: string;
  revisit_criterion: string;
}

export interface DecisionRow {
  decision_id: string;
  phase: string;
  timestamp: string;
  decision: string;
  chosen_approach: string;
  rejected_alternatives: RejectedAlternative[];
  decided_by: string;
  ref: string;
  status: 'open' | 'triggered' | 'resolved';
}

export interface ScribeInput {
  phase: string;
  summary: string;
  decided_by: string;
  impact_level: 'low' | 'medium' | 'high' | 'critical';
  chosen_approach: string;
  rejected_alternatives?: RejectedAlternative[];
  ref: string;
}

// ---------------------------------------------------------------------------
// Constants — sourced from protocols/decision-log.md §Hard Field Constraints
// ---------------------------------------------------------------------------

const VALID_IMPACTS = ['low', 'medium', 'high', 'critical'] as const;
const VALID_STATUSES = ['open', 'triggered', 'resolved'] as const;
const MAX_ALTERNATIVES = 3;
const MAX_ROWS_PER_PHASE = 5;
const MAX_DECISION_LEN = 240;
const MAX_CHOSEN_APPROACH_LEN = 480;
const MAX_APPROACH_LEN = 240;
const MAX_REASON_LEN = 400;
const MAX_REVISIT_LEN = 240;

/** Ref field pattern from decisions.schema.json */
const REF_PATTERN = /^[a-zA-Z0-9_\-./]+\.(md|json|jsonl|yaml|yml)(#[a-zA-Z0-9_\-/.]+)?$/;

/** Phase string pattern from decisions.schema.json. Leading minus allowed for Phase -1 (iOS bootstrap). */
const PHASE_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;

/** Encode a phase token for embedding in a decision_id. Negative phases get an "N" prefix
 * instead of "-" to avoid colliding with the "-" delimiter in the ID format. So phase "-1"
 * becomes "N1" in the ID slot, yielding "D-N1-01". Round-trippable via decodePhaseFromId. */
function encodePhaseForId(phase: string): string {
  return phase.startsWith('-') ? `N${phase.slice(1)}` : phase;
}

// ---------------------------------------------------------------------------
// Per-phase sequence counters (task 1.2.3 — ID allocation)
// ---------------------------------------------------------------------------

const counters: Record<string, number> = {};

/**
 * Load existing counters from a decisions.jsonl file.
 * Scans all rows to find the max seq per phase so new IDs don't collide.
 */
export function loadCounters(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf-8').trim();
  if (!content) return;
  const lines = content.split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line) as DecisionRow;
      const match = row.decision_id.match(/^D-(.+)-(\d{2,})$/);
      if (match) {
        const phase = match[1];
        const seq = parseInt(match[2], 10);
        counters[phase] = Math.max(counters[phase] ?? 0, seq);
      }
    } catch {
      /* skip malformed lines */
    }
  }
}

/** Allocate the next decision ID for a phase. Format: D-{encodedPhase}-{seq} */
function allocateId(phase: string): string {
  const encoded = encodePhaseForId(phase);
  counters[encoded] = (counters[encoded] ?? 0) + 1;
  return `D-${encoded}-${String(counters[encoded]).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Exclusive-write lock (task 1.2.3)
// ---------------------------------------------------------------------------

let writeLocked = false;

// ---------------------------------------------------------------------------
// Schema validation (task 1.2.2)
// ---------------------------------------------------------------------------

/**
 * Count rows for a given phase in the target file.
 * Used to enforce the max-5-rows-per-phase constraint.
 */
function countPhaseRows(filePath: string, phase: string): number {
  if (!existsSync(filePath)) return 0;
  const content = readFileSync(filePath, 'utf-8').trim();
  if (!content) return 0;
  let count = 0;
  for (const line of content.split('\n')) {
    try {
      const row = JSON.parse(line) as DecisionRow;
      if (row.phase === phase) count++;
    } catch {
      /* skip */
    }
  }
  return count;
}

/**
 * Validate a single rejected alternative against schema constraints.
 */
function validateAlternative(alt: RejectedAlternative, index: number): void {
  if (!alt.approach || alt.approach.length === 0) {
    throw new Error(`rejected_alternatives[${index}].approach is required`);
  }
  if (alt.approach.length > MAX_APPROACH_LEN) {
    throw new Error(`rejected_alternatives[${index}].approach exceeds ${MAX_APPROACH_LEN} chars`);
  }
  if (!alt.reason || alt.reason.length === 0) {
    throw new Error(`rejected_alternatives[${index}].reason is required`);
  }
  if (alt.reason.length > MAX_REASON_LEN) {
    throw new Error(`rejected_alternatives[${index}].reason exceeds ${MAX_REASON_LEN} chars (max 2 sentences)`);
  }
  if (!alt.revisit_criterion || alt.revisit_criterion.length === 0) {
    throw new Error(`rejected_alternatives[${index}].revisit_criterion is required`);
  }
  if (alt.revisit_criterion.length > MAX_REVISIT_LEN) {
    throw new Error(`rejected_alternatives[${index}].revisit_criterion exceeds ${MAX_REVISIT_LEN} chars (max 1 sentence)`);
  }
}

/**
 * Validate scribe input against the decision log schema.
 * Throws on any validation failure.
 */
export function validate(input: ScribeInput): void {
  if (!input.phase || !PHASE_PATTERN.test(input.phase)) {
    throw new Error(`Invalid phase: "${input.phase ?? ''}". Must match pattern ${PHASE_PATTERN.source}`);
  }
  if (!input.summary || input.summary.length === 0) {
    throw new Error('summary is required');
  }
  if (input.summary.length > MAX_DECISION_LEN) {
    throw new Error(`summary exceeds ${MAX_DECISION_LEN} chars`);
  }
  if (!input.chosen_approach || input.chosen_approach.length === 0) {
    throw new Error('chosen_approach is required');
  }
  if (input.chosen_approach.length > MAX_CHOSEN_APPROACH_LEN) {
    throw new Error(`chosen_approach exceeds ${MAX_CHOSEN_APPROACH_LEN} chars`);
  }
  if (!input.decided_by || input.decided_by.length === 0) {
    throw new Error('decided_by is required');
  }
  if (!VALID_IMPACTS.includes(input.impact_level as typeof VALID_IMPACTS[number])) {
    throw new Error(`Invalid impact_level: ${input.impact_level}. Must be one of: ${VALID_IMPACTS.join(', ')}`);
  }
  if (!input.ref || input.ref.length === 0 || !REF_PATTERN.test(input.ref)) {
    throw new Error(`Invalid ref: "${input.ref ?? ''}". Must match pattern ${REF_PATTERN.source}`);
  }

  const alts = input.rejected_alternatives ?? [];
  if (alts.length > MAX_ALTERNATIVES) {
    throw new Error(`Max ${MAX_ALTERNATIVES} rejected alternatives per decision row`);
  }
  for (let i = 0; i < alts.length; i++) {
    validateAlternative(alts[i], i);
  }
}

// ---------------------------------------------------------------------------
// MCP handler (task 1.2.1)
// ---------------------------------------------------------------------------

/**
 * scribe_decision — in-process MCP tool handler.
 *
 * Validates input, allocates a sequential ID, acquires the exclusive-write
 * lock, and appends a single JSON line to the decisions file.
 * Returns the written DecisionRow.
 *
 * @param input  - ScribeInput from the calling subagent
 * @param filePath - Absolute path to decisions.jsonl (default: docs/plans/decisions.jsonl)
 */
export function scribeDecision(input: ScribeInput, filePath: string): DecisionRow {
  if (writeLocked) {
    throw new Error('Exclusive write lock held — concurrent scribe call rejected');
  }

  writeLocked = true;
  try {
    validate(input);

    // Auto-rehydrate counters from disk (idempotent — takes max per phase)
    loadCounters(filePath);

    // Enforce max 5 rows per phase
    const existing = countPhaseRows(filePath, input.phase);
    if (existing >= MAX_ROWS_PER_PHASE) {
      throw new Error(
        `Phase "${input.phase}" already has ${existing} decision rows (max ${MAX_ROWS_PER_PHASE}). ` +
        'Split into sub-phases or consolidate before adding more.',
      );
    }

    const row: DecisionRow = {
      decision_id: allocateId(input.phase),
      phase: input.phase,
      timestamp: new Date().toISOString(),
      decision: input.summary,
      chosen_approach: input.chosen_approach,
      rejected_alternatives: input.rejected_alternatives ?? [],
      decided_by: input.decided_by,
      ref: input.ref,
      status: 'open',
    };

    // Ensure parent directory exists
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // ATOMIC: read existing + append new row + write-to-tmp + rename
    const existingContent = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    const newContent = existingContent + JSON.stringify(row) + '\n';
    const tmp = `${filePath}.tmp`;
    writeFileSync(tmp, newContent, 'utf-8');
    renameSync(tmp, filePath); // atomic on POSIX same-filesystem

    return row;
  } finally {
    writeLocked = false;
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Reset internal state (counters + lock). For testing only.
 */
export function reset(): void {
  for (const key of Object.keys(counters)) delete counters[key];
  writeLocked = false;
}

/** Expose constants for test assertions */
export const LIMITS = {
  MAX_ALTERNATIVES,
  MAX_ROWS_PER_PHASE,
  MAX_DECISION_LEN,
  MAX_CHOSEN_APPROACH_LEN,
  MAX_APPROACH_LEN,
  MAX_REASON_LEN,
  MAX_REVISIT_LEN,
  VALID_IMPACTS,
  VALID_STATUSES,
} as const;
