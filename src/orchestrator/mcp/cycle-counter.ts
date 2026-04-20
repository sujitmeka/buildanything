/**
 * cycle_counter_check MCP handler (Stage 4, A6 semantic).
 *
 * Authoritative semantic: escalation fires when NEW counter value > max_cycles.
 * max_cycles = 2 → first two attempts allow, third escalates.
 *
 * Dual counter: per-decision AND per-target-phase. Escalation when EITHER exceeds cap.
 */

import type { InFlightBackwardEdge, BackwardRoutingCounters } from '../schemas/backward-edge';
import { STALE_EDGE_THRESHOLD_MS } from '../schemas/backward-edge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CycleCheckInput {
  decision_id: string;
  target_phase: string;
}

export interface CycleCheckResult {
  action: 'allow' | 'escalate_to_user';
  decision_count: number;
  phase_count: number;
}

export interface CounterState extends BackwardRoutingCounters {}

const DEFAULT_MAX_CYCLES = 2;

// ---------------------------------------------------------------------------
// Core handler (tasks 4.2.1, 4.2.2, 4.2.3)
// ---------------------------------------------------------------------------

/**
 * Check and increment the cycle counter for a backward-routing edge.
 * Returns allow for the first max_cycles attempts, escalate_to_user after.
 *
 * Mutates the state object in place — caller must persist via a single
 * atomic state_save combining counter increment + in_flight_backward_edge
 * write (A3 crash-seam protocol).
 */
export function cycleCounterCheck(
  state: CounterState,
  input: CycleCheckInput,
  maxCycles: number = DEFAULT_MAX_CYCLES,
): CycleCheckResult {
  if (!input.decision_id) throw new Error('decision_id is required');
  if (!input.target_phase) throw new Error('target_phase is required');

  // Initialize counters if missing
  state.backward_routing_count ??= {};
  state.backward_routing_count_by_target_phase ??= {};

  // Atomically increment both counters
  const decisionCount = (state.backward_routing_count[input.decision_id] ?? 0) + 1;
  const phaseCount = (state.backward_routing_count_by_target_phase[input.target_phase] ?? 0) + 1;

  state.backward_routing_count[input.decision_id] = decisionCount;
  state.backward_routing_count_by_target_phase[input.target_phase] = phaseCount;

  // Write in_flight_backward_edge (A3 crash-seam) — single atomic state_save
  state.in_flight_backward_edge = {
    decision_id: input.decision_id,
    target_phase: input.target_phase,
    counter_value: decisionCount,
    started_at: new Date().toISOString(),
  };

  // Escalation: EITHER counter exceeds cap → escalate
  const action: CycleCheckResult['action'] =
    (decisionCount > maxCycles || phaseCount > maxCycles)
      ? 'escalate_to_user'
      : 'allow';

  return { action, decision_count: decisionCount, phase_count: phaseCount };
}

// ---------------------------------------------------------------------------
// Edge lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Clear the in-flight backward edge (called by target phase on re-entry).
 * Caller must persist via state_save.
 */
export function clearInFlightEdge(state: CounterState): void {
  delete state.in_flight_backward_edge;
}

/**
 * Handle stale edge on --resume (A3 crash recovery).
 * If edge is older than threshold, decrement both counters and clear the edge.
 * Returns true if a stale edge was cleaned up.
 */
export function handleStaleEdge(state: CounterState, thresholdMs: number = STALE_EDGE_THRESHOLD_MS): boolean {
  const edge = state.in_flight_backward_edge;
  if (!edge) return false;

  const age = Date.now() - new Date(edge.started_at).getTime();
  if (age <= thresholdMs) return false; // edge is fresh, standard resume

  // Edge never completed — decrement per-decision counter
  const decCurrent = state.backward_routing_count[edge.decision_id] ?? 0;
  if (decCurrent > 0) {
    state.backward_routing_count[edge.decision_id] = decCurrent - 1;
  }

  // Decrement per-target-phase counter
  const phaseCurrent = state.backward_routing_count_by_target_phase[edge.target_phase] ?? 0;
  if (phaseCurrent > 0) {
    state.backward_routing_count_by_target_phase[edge.target_phase] = phaseCurrent - 1;
  }

  delete state.in_flight_backward_edge;
  return true; // stale edge handled
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a fresh empty CounterState. For testing only. */
export function createEmptyState(): CounterState {
  return {
    backward_routing_count: {},
    backward_routing_count_by_target_phase: {},
  };
}
