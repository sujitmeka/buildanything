import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDesignMdTokens } from '../../src/graph/parser/design-md-pass2.js';
import type { GraphFragment, TokenNode } from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parsePass2(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractDesignMdTokens({ mdPath: p, mdContent: md });
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function tokens(fragment: GraphFragment): TokenNode[] {
  return fragment.nodes.filter((n): n is TokenNode => n.entity_type === 'token');
}

describe('design-md-pass2 — marketplace', () => {
  it('parses ok=true with token count in range 35–40', () => {
    const result = parsePass2('design-md-pass2-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const count = tokens(result.fragment).length;
    assert.ok(count >= 35 && count <= 40, `expected 35–40 tokens, got ${count}`);
  });

  it('axis_provenance distribution: color→character, typography→type, spacing→density', () => {
    const result = parsePass2('design-md-pass2-marketplace.md');
    assert.ok(result.fragment);
    const toks = tokens(result.fragment);
    const colorCharacter = toks.filter((t) => t.layer === 'color' && t.axis_provenance === 'character');
    const typographyType = toks.filter((t) => t.layer === 'typography' && t.axis_provenance === 'type');
    const spacingDensity = toks.filter((t) => t.layer === 'spacing' && t.axis_provenance === 'density');
    assert.ok(colorCharacter.length >= 8, `expected >= 8 color/character, got ${colorCharacter.length}`);
    assert.ok(typographyType.length >= 6, `expected >= 6 typography/type, got ${typographyType.length}`);
    assert.ok(spacingDensity.length >= 5, `expected >= 5 spacing/density, got ${spacingDensity.length}`);
  });

  it('colors.primary token has correct value and axis_provenance', () => {
    const result = parsePass2('design-md-pass2-marketplace.md');
    assert.ok(result.fragment);
    const tok = tokens(result.fragment).find((t) => t.name === 'colors.primary');
    assert.ok(tok);
    assert.equal(tok.value, '#0F172A');
    assert.equal(tok.axis_provenance, 'character');
  });

  it('components.button-primary is emitted as stringified object', () => {
    const result = parsePass2('design-md-pass2-marketplace.md');
    assert.ok(result.fragment);
    const tok = tokens(result.fragment).find((t) => t.name === 'components.button-primary');
    assert.ok(tok);
    assert.equal(tok.layer, 'component');
    assert.ok(tok.value.startsWith('{'), 'expected stringified object starting with {');
  });

  it('token_derived_from edge count equals tokens with non-null axis_provenance', () => {
    const result = parsePass2('design-md-pass2-marketplace.md');
    assert.ok(result.fragment);
    const toks = tokens(result.fragment);
    const withAxis = toks.filter((t) => t.axis_provenance !== null).length;
    const derivedEdges = result.fragment.edges.filter((e) => e.relation === 'token_derived_from').length;
    assert.equal(derivedEdges, withAxis);
  });

  it('determinism: two parses produce identical fragments (modulo produced_at)', () => {
    const a = parsePass2('design-md-pass2-marketplace.md');
    const b = parsePass2('design-md-pass2-marketplace.md');
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _a, ...aRest } = a.fragment;
    const { produced_at: _b, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('design-md-pass2 — saas', () => {
  it('parses ok=true with token count in range 33–42', () => {
    const result = parsePass2('design-md-pass2-saas.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const count = tokens(result.fragment).length;
    assert.ok(count >= 33 && count <= 42, `expected 33–42 tokens, got ${count}`);
  });

  it('has at least one token with axis_provenance === "material"', () => {
    const result = parsePass2('design-md-pass2-saas.md');
    assert.ok(result.fragment);
    const material = tokens(result.fragment).filter((t) => t.axis_provenance === 'material');
    assert.ok(material.length >= 1, 'expected at least one material token');
  });

  it('colors.surface-glass has axis_provenance === "material"', () => {
    const result = parsePass2('design-md-pass2-saas.md');
    assert.ok(result.fragment);
    const tok = tokens(result.fragment).find((t) => t.name === 'colors.surface-glass');
    assert.ok(tok, 'expected colors.surface-glass token');
    assert.equal(tok.axis_provenance, 'material');
  });

  it('top-level motion-base and elevation-glass tokens have correct layers and provenance', () => {
    const result = parsePass2('design-md-pass2-saas.md');
    assert.ok(result.fragment);
    const toks = tokens(result.fragment);
    const motion = toks.find((t) => t.name === 'motion-base');
    assert.ok(motion, 'expected motion-base token');
    assert.equal(motion.layer, 'motion');
    assert.equal(motion.axis_provenance, 'motion');
    const elev = toks.find((t) => t.name === 'elevation-glass');
    assert.ok(elev, 'expected elevation-glass token');
    assert.equal(elev.layer, 'elevation');
    assert.equal(elev.axis_provenance, 'material');
  });
});

describe('design-md-pass2 — pass1-only fixture', () => {
  it('pass1-marketplace returns ok=true with zero tokens', () => {
    const result = parsePass2('design-md-pass1-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    assert.equal(result.fragment.nodes.length, 0);
    assert.equal(result.fragment.edges.length, 0);
  });
});

describe('design-md-pass2 — malformed inline', () => {
  it('colors as string value returns ok=false', () => {
    const md = `---\nversion: alpha\nname: Bad\ndescription: test\ncolors: "not-an-object"\n---\n\n# Bad\n`;
    const result = extractDesignMdTokens({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('design-md-pass2 — iOS attribution', () => {
  it('edges use ios-swift-ui-design / 3.2-ios when projectType is ios', () => {
    const p = join(FIXTURES, 'design-md-pass2-marketplace.md');
    const md = readFileSync(p, 'utf-8');
    const result = extractDesignMdTokens({ mdPath: p, mdContent: md, projectType: 'ios' });
    assert.ok(result.fragment);
    const edges = result.fragment.edges.filter((e) => e.relation === 'token_derived_from');
    assert.ok(edges.length > 0);
    for (const e of edges) {
      assert.equal(e.produced_by_agent, 'ios-swift-ui-design');
      assert.equal(e.produced_at_step, '3.2-ios');
    }
  });

  it('defaults to web attribution when projectType is omitted', () => {
    const p = join(FIXTURES, 'design-md-pass2-marketplace.md');
    const md = readFileSync(p, 'utf-8');
    const result = extractDesignMdTokens({ mdPath: p, mdContent: md });
    assert.ok(result.fragment);
    const edges = result.fragment.edges.filter((e) => e.relation === 'token_derived_from');
    assert.ok(edges.length > 0);
    for (const e of edges) {
      assert.equal(e.produced_by_agent, 'design-ui-designer');
      assert.equal(e.produced_at_step, '3.4');
    }
  });
});