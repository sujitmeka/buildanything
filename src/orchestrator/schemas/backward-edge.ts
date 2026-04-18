/**
 * Schema for the in_flight_backward_edge field in .build-state.json.
 * Added at Stage 4 (A3 crash-seam fix).
 *
 * When a backward-routing edge is dispatched, this field is written atomically
 * alongside the counter increment. The target phase clears it on re-entry.
 * If --resume finds this field with age > 60s, the counter is decremented
 * (the edge never started).
 */

export interface InFlightBackwardEdge {
  /** The decision ID that triggered the backward route */
  decision_id: string;
  /** The phase being routed back to */
  target_phase: string;
  /** The counter value at the time of dispatch */
  counter_value: number;
  /** ISO timestamp when the edge was dispatched */
  started_at: string;
}

/** Staleness threshold in milliseconds — edges older than this are considered crashed */
export const STALE_EDGE_THRESHOLD_MS = 60_000;

/**
 * Check if an in-flight edge is stale (crash recovery).
 * If stale, the counter should be decremented because the edge never completed.
 */
export function isStaleEdge(edge: InFlightBackwardEdge): boolean {
  const age = Date.now() - new Date(edge.started_at).getTime();
  return age > STALE_EDGE_THRESHOLD_MS;
}

/**
 * Schema for the per-target-phase backward routing counter (A6).
 * Tracks how many times each target phase has been routed to,
 * regardless of which decision triggered it.
 */
export interface BackwardRoutingCounters {
  /** Per-decision counter: decision_id -> count */
  backward_routing_count: Record<string, number>;
  /** Per-target-phase counter: phase -> count */
  backward_routing_count_by_target_phase: Record<string, number>;
  /** In-flight edge, if any */
  in_flight_backward_edge?: InFlightBackwardEdge;
}
