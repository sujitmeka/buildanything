import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractProductSpec } from '../../src/graph/parser/product-spec.js';
import type {
  AcceptanceCriterionNode,
  BusinessRuleNode,
  FeatureNode,
  GraphFragment,
  PersonaConstraintNode,
  PersonaNode,
  ScreenNode,
  StateNode,
  TransitionNode,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parseFixture(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractProductSpec({ mdPath: p, mdContent: md });
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function nodesOfType<T extends { entity_type: string }>(
  fragment: GraphFragment,
  type: T['entity_type'],
): T[] {
  return fragment.nodes.filter((n): n is T & typeof n => n.entity_type === type) as T[];
}

describe('parser correctness — valid fixtures', () => {
  it('marketplace fixture parses with expected counts and structure', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment, 'fragment should be defined');
    const fragment = result.fragment;

    const personas = nodesOfType<PersonaNode>(fragment, 'persona');
    assert.ok(personas.length >= 2, `expected >= 2 personas, got ${personas.length}`);
    const primaries = personas.filter((p) => p.is_primary);
    assert.equal(primaries.length, 1, 'expected exactly one primary persona');

    const features = nodesOfType<FeatureNode>(fragment, 'feature');
    assert.equal(features.length, 3);

    const screens = nodesOfType<ScreenNode>(fragment, 'screen');
    assert.equal(screens.length, 8);

    const states = nodesOfType<StateNode>(fragment, 'state');
    const transitions = nodesOfType<TransitionNode>(fragment, 'transition');
    const acceptance = nodesOfType<AcceptanceCriterionNode>(fragment, 'acceptance_criterion');

    for (const f of features) {
      const fStates = states.filter((s) => s.feature_id === f.id);
      const fTransitions = transitions.filter((t) =>
        fStates.some((s) => s.id === t.from_state_id),
      );
      const fAccept = acceptance.filter((a) => a.feature_id === f.id);
      assert.ok(fStates.length >= 3, `${f.label}: expected >= 3 states, got ${fStates.length}`);
      assert.ok(fTransitions.length >= 1, `${f.label}: expected >= 1 transition`);
      assert.ok(fAccept.length >= 1, `${f.label}: expected >= 1 acceptance criterion`);
    }

    const constraints = nodesOfType<PersonaConstraintNode>(fragment, 'persona_constraint');
    const distinctPersonaIds = new Set(constraints.map((c) => c.persona_id));
    assert.ok(
      distinctPersonaIds.size >= 2,
      `expected persona constraints to reference >= 2 personas, got ${distinctPersonaIds.size}`,
    );

    const featureIds = new Set(features.map((f) => f.id));
    const crossFeatureEdges = fragment.edges.filter(
      (e) => e.relation === 'depends_on' && featureIds.has(e.source) && featureIds.has(e.target),
    );
    assert.ok(crossFeatureEdges.length >= 1, 'expected at least one cross-feature depends_on edge');
  });

  it('saas fixture parses with 3 personas (1 primary), 2 features, cross-feature edges', () => {
    const result = parseFixture('saas-product-spec.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const fragment = result.fragment;

    const personas = nodesOfType<PersonaNode>(fragment, 'persona');
    assert.equal(personas.length, 3);
    assert.equal(personas.filter((p) => p.is_primary).length, 1);

    const features = nodesOfType<FeatureNode>(fragment, 'feature');
    assert.equal(features.length, 2);

    const featureIds = new Set(features.map((f) => f.id));
    const crossFeatureEdges = fragment.edges.filter(
      (e) => e.relation === 'depends_on' && featureIds.has(e.source) && featureIds.has(e.target),
    );
    assert.ok(crossFeatureEdges.length >= 1, 'expected cross-feature depends_on edge');
  });

  it('single-persona fixture parses with 1 persona, 1 feature, 3 screens', () => {
    const result = parseFixture('single-persona-product-spec.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const fragment = result.fragment;

    const personas = nodesOfType<PersonaNode>(fragment, 'persona');
    assert.equal(personas.length, 1);
    assert.equal(personas[0].is_primary, true);

    const features = nodesOfType<FeatureNode>(fragment, 'feature');
    assert.equal(features.length, 1);

    const screens = nodesOfType<ScreenNode>(fragment, 'screen');
    assert.equal(screens.length, 3);
  });
});

describe('parser fail-loud', () => {
  it('malformed fixture (missing App Overview) returns ok:false with no fragment', () => {
    const result = parseFixture('malformed-missing-app-overview.md');
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    const matchesAppOverview = result.errors.some((e) => /App Overview/i.test(e.message));
    assert.ok(matchesAppOverview, 'expected at least one error referencing App Overview');
    assert.equal(result.fragment, undefined);
  });

  it('audit fix #16: malformed fixture (missing First 60 Seconds) returns ok:false', () => {
    const result = parseFixture('malformed-missing-first-60-seconds.md');
    assert.equal(result.ok, false);
    const matchesFirst60 = result.errors.some((e) => /First 60 Seconds/i.test(e.message));
    assert.ok(matchesFirst60, 'expected at least one error referencing First 60 Seconds');
  });

  it('audit fix #16: First-encounter promise without comparison marker returns ok:false', () => {
    const result = parseFixture('malformed-stub-first-60-seconds.md');
    assert.equal(result.ok, false);
    const noComparison = result.errors.some((e) => /no comparison marker/i.test(e.message));
    assert.ok(noComparison, 'expected error about missing comparison marker');
    const mentionsAlternative = result.errors.some((e) => /closest alternative/i.test(e.message));
    assert.ok(mentionsAlternative, 'expected hint to reference competitive-differentiation alternative');
  });
});

describe('parser determinism', () => {
  it('parsing the marketplace fixture twice produces byte-identical output (modulo produced_at)', () => {
    const a = parseFixture('marketplace-product-spec.md');
    const b = parseFixture('marketplace-product-spec.md');
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });

  it('produced_at is a valid ISO timestamp', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.ok(result.fragment);
    const ts = result.fragment.produced_at;
    assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.ok(!Number.isNaN(new Date(ts).getTime()));
  });
});

describe('parser ID stability and structural invariants', () => {
  it('marketplace fragment contains the expected stable IDs', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.ok(result.fragment);
    const ids = new Set(result.fragment.nodes.map((n) => n.id));
    const required = [
      'feature__product-discovery',
      'feature__order-placement',
      'feature__seller-fulfillment',
      'persona__buyer',
      'persona__seller',
      'screen__catalog',
      'state__order-placement__empty-cart',
    ];
    for (const id of required) {
      assert.ok(ids.has(id), `expected id "${id}" in fragment.nodes`);
    }
  });

  it('Order Placement persona constraints attribute to multiple personas', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.ok(result.fragment);
    const constraints = nodesOfType<PersonaConstraintNode>(result.fragment, 'persona_constraint')
      .filter((c) => c.feature_id === 'feature__order-placement');
    const personaIds = new Set(constraints.map((c) => c.persona_id));
    assert.ok(personaIds.has('persona__buyer'), 'expected Buyer constraint on Order Placement');
    assert.ok(personaIds.has('persona__seller'), 'expected Seller constraint on Order Placement');
  });

  it('at least one business_rule in the marketplace fragment is decision_needed', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.ok(result.fragment);
    const rules = nodesOfType<BusinessRuleNode>(result.fragment, 'business_rule');
    const flagged = rules.filter((r) => r.decision_needed);
    assert.ok(flagged.length >= 1, 'expected >= 1 [DECISION NEEDED] rule');
  });

  it('every feature has exactly one initial state', () => {
    const result = parseFixture('marketplace-product-spec.md');
    assert.ok(result.fragment);
    const features = nodesOfType<FeatureNode>(result.fragment, 'feature');
    const states = nodesOfType<StateNode>(result.fragment, 'state');
    for (const f of features) {
      const initials = states.filter((s) => s.feature_id === f.id && s.is_initial);
      assert.equal(initials.length, 1, `${f.label}: expected exactly 1 initial state, got ${initials.length}`);
    }
  });
});
