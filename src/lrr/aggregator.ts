export type Verdict = 'PASS' | 'CONCERNS' | 'BLOCK';
export interface ChapterResult {
  chapter: string;
  verdict: Verdict;
  override_blocks_launch: boolean;
  findings: Array<{ severity: string; description: string; related_decision_id?: string }>;
  follow_up_spawned?: boolean;
  follow_up_confirmed?: boolean;
}

export interface RoutingTarget {
  decision_id: string;
  resolved_decision_id: string;
  phase: string;
  step_id: string | null;
  decided_by: string;
  superseded: boolean;
}

export interface AggregateResult {
  combined_verdict: 'PRODUCTION READY' | 'NEEDS WORK' | 'BLOCKED';
  triggered_rule: number;
  chapters: ChapterResult[];
  star_rule_triggered?: boolean;
  star_rule_decision_ids?: string[];
  cross_chapter_contradiction?: string;
  routing_targets?: RoutingTarget[];
  routing_source?: 'graph' | 'fallback';
  routing_warnings?: string[];
}

export function aggregate(chapters: ChapterResult[]): AggregateResult {
  // Rule 1: ANY override_blocks_launch → BLOCKED
  if (chapters.some(c => c.override_blocks_launch))
    return { combined_verdict: 'BLOCKED', triggered_rule: 1, chapters };

  // Rule 6: contradictions between chapters on related_decision_id → BLOCKED
  // Two chapters contradict if they reference the same decision_id
  // but assign conflicting verdicts (one PASS, one BLOCK).
  const verdictByDecisionId = new Map<string, Set<Verdict>>();
  for (const ch of chapters) {
    for (const f of ch.findings) {
      if (!f.related_decision_id) continue;
      const key = f.related_decision_id;
      if (!verdictByDecisionId.has(key)) verdictByDecisionId.set(key, new Set());
      verdictByDecisionId.get(key)!.add(ch.verdict);
    }
  }
  for (const [decId, verdicts] of verdictByDecisionId) {
    if (verdicts.has('PASS') && verdicts.has('BLOCK')) {
      return {
        combined_verdict: 'BLOCKED', triggered_rule: 6, chapters,
        cross_chapter_contradiction: decId,
      };
    }
  }

  // Rule 5: follow_up spawned AND confirmed → treat as BLOCK
  const effectiveChapters = chapters.map(c => ({
    ...c,
    verdict: (c.follow_up_spawned && c.follow_up_confirmed ? 'BLOCK' : c.verdict) as Verdict,
  }));

  // Rule 2: ALL PASS and 0 follow-ups → PRODUCTION READY
  if (effectiveChapters.every(c => c.verdict === 'PASS') && !chapters.some(c => c.follow_up_spawned))
    return { combined_verdict: 'PRODUCTION READY', triggered_rule: 2, chapters };

  // Rule 3: ANY BLOCK → NEEDS WORK
  if (effectiveChapters.some(c => c.verdict === 'BLOCK'))
    return { combined_verdict: 'NEEDS WORK', triggered_rule: 3, chapters };

  // Rule 4: ANY CONCERNS → NEEDS WORK
  if (effectiveChapters.some(c => c.verdict === 'CONCERNS'))
    return { combined_verdict: 'NEEDS WORK', triggered_rule: 4, chapters };

  return { combined_verdict: 'PRODUCTION READY', triggered_rule: 2, chapters };
}

/** ⭐⭐ Star rule: on BLOCK, find related_decision_id and route back to authoring phase */
export function applyStarRule(result: AggregateResult): AggregateResult {
  if (result.combined_verdict === 'NEEDS WORK' || result.combined_verdict === 'BLOCKED') {
    const blockFindings = result.chapters
      .filter(c => c.verdict === 'BLOCK')
      .flatMap(c => c.findings.filter(f => f.related_decision_id));
    if (blockFindings.length > 0) {
      return {
        ...result,
        star_rule_triggered: true,
        star_rule_decision_ids: blockFindings.map(f => f.related_decision_id!),
      };
    }
  }
  return { ...result, star_rule_triggered: false };
}

/**
 * Slice 4 graph fast-path for backward routing.
 *
 * Given an aggregate result with `star_rule_decision_ids`, resolve each ID to a
 * routing target (phase + step_id + decided_by) by querying the graph layer.
 * Walks `decision_supersedes` via DecisionView.superseded_by so a finding
 * tagged with a resolved-and-replaced decision routes to the replacement's
 * authoring phase.
 *
 * Falls back to the existing string-only path on any graph failure: returns
 * the input result with `routing_source: "fallback"` so the caller knows to
 * use `star_rule_decision_ids` directly with whatever legacy logic it has.
 */
export async function resolveRoutingTargets(
  result: AggregateResult,
  projectDir: string,
): Promise<AggregateResult> {
  if (!result.star_rule_triggered || !result.star_rule_decision_ids?.length) {
    return result;
  }

  let loadAllGraphs: typeof import('../graph/storage/index.js').loadAllGraphs;
  let queryDecisions: typeof import('../graph/storage/index.js').queryDecisions;
  try {
    const mod = await import('../graph/storage/index.js');
    loadAllGraphs = mod.loadAllGraphs;
    queryDecisions = mod.queryDecisions;
  } catch (err) {
    return {
      ...result,
      routing_source: 'fallback',
      routing_warnings: [`graph storage import failed: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const graph = loadAllGraphs(projectDir);
  if (!graph) {
    return {
      ...result,
      routing_source: 'fallback',
      routing_warnings: [`no graph fragment in ${projectDir} — string-only routing path`],
    };
  }

  const targetIds = new Set(result.star_rule_decision_ids);
  const allViews = queryDecisions(graph, {});
  const byDecisionId = new Map(allViews.map(v => [v.decision_id, v]));

  const targets: RoutingTarget[] = [];
  const warnings: string[] = [];

  for (const decId of result.star_rule_decision_ids) {
    const view = byDecisionId.get(decId);
    if (!view) {
      warnings.push(`decision_id "${decId}" not found in graph`);
      continue;
    }

    const replacement = view.superseded_by
      ? allViews.find(v => v.id === view.superseded_by!.id)
      : undefined;
    const resolved = replacement ?? view;

    targets.push({
      decision_id: decId,
      resolved_decision_id: resolved.decision_id,
      phase: resolved.phase,
      step_id: resolved.step_id,
      decided_by: resolved.decided_by,
      superseded: replacement !== undefined,
    });
  }

  return {
    ...result,
    routing_source: 'graph',
    routing_targets: targets,
    ...(warnings.length > 0 ? { routing_warnings: warnings } : {}),
  };
}
