export type Verdict = 'PASS' | 'CONCERNS' | 'BLOCK';
export interface ChapterResult {
  chapter: string;
  verdict: Verdict;
  override_blocks_launch: boolean;
  findings: Array<{ severity: string; description: string; related_decision_id?: string }>;
  follow_up_spawned?: boolean;
  follow_up_confirmed?: boolean;
}

export interface AggregateResult {
  combined_verdict: 'PRODUCTION READY' | 'NEEDS WORK' | 'BLOCKED';
  triggered_rule: number;
  chapters: ChapterResult[];
  star_rule_triggered?: boolean;
  star_rule_decision_ids?: string[];
  cross_chapter_contradiction?: string;
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
