/**
 * Phase-boundary + Task-completion token accounting emitter (task 3.4.2).
 *
 * Subscribes to SDK assistant+result message `usage` fields.
 * At every phase boundary and Task tool call completion, calls
 * recordUsage() to append a cost line to docs/plans/build-log.md.
 *
 * Spec: MIGRATION-PLAN-FINAL.md §4 Stage 3 G3
 * Depends on: src/orchestrator/hooks/token-accounting.ts (task 3.4.1)
 */

import { recordUsage, type TokenUsage, type AccountingEntry } from './token-accounting';

const DEFAULT_BUILD_LOG = 'docs/plans/build-log.md';

export interface SdkUsageMessage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface PhaseContext {
  phase: number;
  step: string;
  buildLogPath?: string;
}

export interface TaskContext extends PhaseContext {
  task: string;
  subagent_type: string;
}

/**
 * Extract TokenUsage from an SDK usage message.
 * SDK field names differ slightly from our internal format.
 */
export function extractUsage(msg: SdkUsageMessage): TokenUsage {
  return {
    input_tokens: msg.input_tokens ?? 0,
    output_tokens: msg.output_tokens ?? 0,
    cache_read: msg.cache_read_input_tokens ?? 0,
    cache_create: msg.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Emit a cost line at a phase boundary.
 * Called by the orchestrator after each phase completes.
 */
export function emitPhaseBoundary(
  ctx: PhaseContext,
  usage: SdkUsageMessage,
): AccountingEntry {
  return recordUsage(ctx.buildLogPath ?? DEFAULT_BUILD_LOG, {
    phase: ctx.phase,
    step: ctx.step,
    usage: extractUsage(usage),
  });
}

/**
 * Emit a cost line at task completion.
 * Called after each Task tool call returns from a subagent dispatch.
 */
export function emitTaskCompletion(
  ctx: TaskContext,
  usage: SdkUsageMessage,
): AccountingEntry {
  return recordUsage(ctx.buildLogPath ?? DEFAULT_BUILD_LOG, {
    phase: ctx.phase,
    step: ctx.step,
    task: ctx.task,
    subagent_type: ctx.subagent_type,
    usage: extractUsage(usage),
  });
}
