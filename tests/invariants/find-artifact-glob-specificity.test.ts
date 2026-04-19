import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findArtifact, type ArtifactEntry } from '../../hooks/pre-tool-use';

const LRR_CATCHALL: ArtifactEntry = {
  path: 'docs/plans/evidence/**/*.json',
  writers: ['phase-4', 'phase-5', 'phase-6'],
  is_glob: true,
};

const LRR_SPECIFIC: ArtifactEntry = {
  path: 'docs/plans/evidence/lrr/*.json',
  writers: ['code-reviewer', 'security-reviewer', 'engineering-sre', 'a11y-architect', 'design-brand-guardian', 'pr-test-analyzer'],
  is_glob: true,
};

const EXACT_ENTRY: ArtifactEntry = {
  path: 'docs/plans/architecture.md',
  writer: 'phase-2',
  is_glob: false,
};

const SHALLOW_JSON: ArtifactEntry = {
  path: 'docs/plans/evidence/*.json',
  writers: ['phase-5'],
  is_glob: true,
};

const DEEP_JSON: ArtifactEntry = {
  path: 'docs/plans/evidence/**/*.json',
  writers: ['phase-4', 'phase-5', 'phase-6'],
  is_glob: true,
};

describe('findArtifact — glob specificity', () => {
  it('specific glob wins over catch-all regardless of declaration order (catch-all first)', () => {
    const hit = findArtifact('docs/plans/evidence/lrr/eng-quality.json', [LRR_CATCHALL, LRR_SPECIFIC]);
    assert.ok(hit, 'expected a match');
    assert.equal(hit.path, 'docs/plans/evidence/lrr/*.json');
    assert.deepEqual(hit.writers, LRR_SPECIFIC.writers);
  });

  it('specific glob wins regardless of declaration order (specific first)', () => {
    const hit = findArtifact('docs/plans/evidence/lrr/security.json', [LRR_SPECIFIC, LRR_CATCHALL]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/evidence/lrr/*.json');
  });

  it('catch-all still matches paths outside the specific subtree', () => {
    const hit = findArtifact('docs/plans/evidence/screenshots/hero.json', [LRR_CATCHALL, LRR_SPECIFIC]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/evidence/**/*.json');
  });

  it('shallow *.json matches only single-segment paths', () => {
    const hit = findArtifact('docs/plans/evidence/fake-data-audit.json', [SHALLOW_JSON, DEEP_JSON]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/evidence/*.json');
  });

  it('deep **/*.json wins when path has subdirectories', () => {
    const hit = findArtifact('docs/plans/evidence/lrr/security.json', [SHALLOW_JSON, DEEP_JSON]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/evidence/**/*.json');
  });

  it('exact path wins over any matching glob', () => {
    const hit = findArtifact('docs/plans/architecture.md', [
      { path: 'docs/plans/*.md', writer: 'phase-5', is_glob: true },
      EXACT_ENTRY,
    ]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/architecture.md');
    assert.equal(hit.writer, 'phase-2');
  });

  it('returns null when no glob matches', () => {
    const hit = findArtifact('docs/plans/evidence/whatever.txt', [LRR_CATCHALL, LRR_SPECIFIC]);
    assert.equal(hit, null);
  });

  it('tie-break by specificity score: prefers longer literal prefix', () => {
    const a: ArtifactEntry = { path: 'docs/**/*.md', writer: 'phase-5', is_glob: true };
    const b: ArtifactEntry = { path: 'docs/plans/**/*.md', writer: 'phase-3', is_glob: true };
    const c: ArtifactEntry = { path: 'docs/plans/evidence/**/*.md', writers: ['phase-4', 'phase-5'], is_glob: true };
    const hit = findArtifact('docs/plans/evidence/lrr/brand-drift.md', [a, b, c]);
    assert.ok(hit);
    assert.equal(hit.path, 'docs/plans/evidence/**/*.md');
  });
});
