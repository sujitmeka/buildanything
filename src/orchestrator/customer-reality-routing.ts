/**
 * Customer Reality routing (v2.4-fix — Phase 6 replacement).
 *
 * Mechanical classifier that maps Customer Reality Judge findings to backward-
 * routing target phases. No LLM dispatch — the judge produces findings, the
 * orchestrator routes.
 *
 * Default mapping:
 *   doesnt_deliver       → Phase 1 (product-spec re-scope)
 *   confusing_or_illogical → Phase 3 (page-spec re-design)
 *
 * Escape hatches (regex-detected from `description`):
 *   architectural concerns → Phase 2
 *   spec/code mismatch     → Phase 4
 */

export interface DoesntDeliverFinding {
  finding_id: string;
  surface?: string;
  description: string;
  screenshot_path?: string;
  brief_quote?: string;
  brief_source?: string;
}

export interface ConfusingFinding {
  finding_id: string;
  surface?: string;
  description: string;
  screenshot_path?: string;
  alternative_comparison?: string;
}

export interface CustomerRealityFindings {
  schema_version: string;
  judged_at: string;
  project_type: 'web' | 'ios';
  doesnt_deliver: DoesntDeliverFinding[];
  confusing_or_illogical: ConfusingFinding[];
  summary?: string;
}

export interface RoutingTarget {
  finding_id: string;
  source_list: 'doesnt_deliver' | 'confusing_or_illogical';
  target_phase: 1 | 2 | 3 | 4;
  target_step: string;
  description: string;
  screenshot_path?: string;
}

export interface AggregateOutput {
  schema_version: '1';
  combined_verdict: 'PRODUCTION READY' | 'BLOCKED';
  doesnt_deliver_count: number;
  confusing_or_illogical_count: number;
  cycle: number;
  routing_targets: RoutingTarget[];
  judged_at: string;
}

const ARCHITECTURAL_KEYWORDS = /\b(performance|latency|throughput|schema|data model|API contract)\b/i;
const IMPLEMENTATION_DRIFT_HINTS = /\b(rendered code does not match|matches the spec but the build|wave-gate missed|implementation drift)\b/i;

export function classifyFindings(findings: CustomerRealityFindings): RoutingTarget[] {
  const out: RoutingTarget[] = [];

  for (const f of findings.doesnt_deliver) {
    const target = pickTarget(f.description, 'doesnt_deliver');
    out.push({
      finding_id: f.finding_id,
      source_list: 'doesnt_deliver',
      target_phase: target.phase,
      target_step: target.step,
      description: f.description,
      ...(f.screenshot_path !== undefined ? { screenshot_path: f.screenshot_path } : {}),
    });
  }

  for (const f of findings.confusing_or_illogical) {
    const target = pickTarget(f.description, 'confusing_or_illogical');
    out.push({
      finding_id: f.finding_id,
      source_list: 'confusing_or_illogical',
      target_phase: target.phase,
      target_step: target.step,
      description: f.description,
      ...(f.screenshot_path !== undefined ? { screenshot_path: f.screenshot_path } : {}),
    });
  }

  return out;
}

interface Target {
  phase: 1 | 2 | 3 | 4;
  step: string;
}

function pickTarget(
  description: string,
  source: 'doesnt_deliver' | 'confusing_or_illogical',
): Target {
  if (ARCHITECTURAL_KEYWORDS.test(description)) {
    return { phase: 2, step: '2.3' };
  }
  if (IMPLEMENTATION_DRIFT_HINTS.test(description)) {
    return { phase: 4, step: '4.3.5' };
  }
  if (source === 'doesnt_deliver') {
    return { phase: 1, step: '1.6' };
  }
  return { phase: 3, step: '3.3' };
}

/**
 * Compute the binary verdict from a findings object. Empty lists → PRODUCTION
 * READY. Either list non-empty → BLOCKED. No NEEDS_WORK rung — the v1 LRR's
 * softening hatch is removed.
 */
export function computeVerdict(
  findings: CustomerRealityFindings,
  cycle: number,
): AggregateOutput {
  const dd = findings.doesnt_deliver.length;
  const ci = findings.confusing_or_illogical.length;
  const allEmpty = dd === 0 && ci === 0;
  return {
    schema_version: '1',
    combined_verdict: allEmpty ? 'PRODUCTION READY' : 'BLOCKED',
    doesnt_deliver_count: dd,
    confusing_or_illogical_count: ci,
    cycle,
    routing_targets: classifyFindings(findings),
    judged_at: findings.judged_at,
  };
}
