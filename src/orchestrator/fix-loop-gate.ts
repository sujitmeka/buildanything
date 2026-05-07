/**
 * Fix-loop gate (audit issue #6).
 *
 * Enforces: if HIGH or CRITICAL severity findings remain unresolved after
 * cycle 1, cycle 2 MUST run. The fix loop cannot exit early.
 *
 * Called by the orchestrator between fix cycles to determine whether
 * another cycle is required.
 */

export interface Finding {
  finding_id: string;
  severity: string;
  status?: 'open' | 'fixed' | 'wontfix';
}

export interface FixLoopGateResult {
  may_exit: boolean;
  reason: string;
  remaining_high: number;
  remaining_critical: number;
  cycle: number;
}

const MAX_CYCLES = 2;

/**
 * Determine whether the fix loop may exit.
 *
 * Rules:
 * - After cycle 1: if any HIGH or CRITICAL findings remain open → must continue.
 * - After cycle 2 (max): may exit regardless (escalate to user in interactive mode).
 * - If zero HIGH/CRITICAL remain after any cycle → may exit.
 */
export function fixLoopGate(findings: Finding[], currentCycle: number): FixLoopGateResult {
  const open = findings.filter(f => f.status !== 'fixed' && f.status !== 'wontfix');
  const critical = open.filter(f => f.severity === 'critical');
  const high = open.filter(f => f.severity === 'high');

  if (currentCycle >= MAX_CYCLES) {
    return {
      may_exit: true,
      reason: `Max cycles (${MAX_CYCLES}) reached. ${critical.length} critical + ${high.length} high findings remain — escalate to user.`,
      remaining_high: high.length,
      remaining_critical: critical.length,
      cycle: currentCycle,
    };
  }

  if (critical.length === 0 && high.length === 0) {
    return {
      may_exit: true,
      reason: 'No HIGH or CRITICAL findings remain open.',
      remaining_high: 0,
      remaining_critical: 0,
      cycle: currentCycle,
    };
  }

  return {
    may_exit: false,
    reason: `Cycle ${currentCycle}/${MAX_CYCLES}: ${critical.length} critical + ${high.length} high findings still open. Cycle ${currentCycle + 1} required.`,
    remaining_high: high.length,
    remaining_critical: critical.length,
    cycle: currentCycle,
  };
}
