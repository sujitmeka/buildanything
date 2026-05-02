import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDesignMd } from '../../src/graph/parser/design-md.js';
import type {
  BrandDnaGuidelineNode,
  BrandReferenceNode,
  DesignDocRootNode,
  DnaAxisNode,
  GraphFragment,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parseFixture(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractDesignMd({ mdPath: p, mdContent: md });
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

describe('design-md parser — valid fixtures', () => {
  it('marketplace fixture: 1 design_doc_root + 7 dna_axis nodes + ≥4 guidelines + ≥1 brand_reference, 7 has_axis edges', () => {
    const result = parseFixture('design-md-pass1-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const f = result.fragment;

    const roots = nodesOfType<DesignDocRootNode>(f, 'design_doc_root');
    assert.equal(roots.length, 1);

    const axes = nodesOfType<DnaAxisNode>(f, 'dna_axis');
    assert.equal(axes.length, 7);

    const guidelines = nodesOfType<BrandDnaGuidelineNode>(f, 'brand_dna_guideline');
    assert.ok(guidelines.length >= 4, `expected ≥4 guidelines, got ${guidelines.length}`);

    const refs = nodesOfType<BrandReferenceNode>(f, 'brand_reference');
    assert.ok(refs.length >= 1, `expected ≥1 brand_reference, got ${refs.length}`);

    const axisNames = new Set(axes.map((a) => a.axis_name));
    for (const name of ['scope', 'density', 'character', 'material', 'motion', 'type', 'copy'] as const) {
      assert.ok(axisNames.has(name), `missing axis: ${name}`);
    }

    const hasAxisEdges = f.edges.filter((e) => e.relation === 'has_axis');
    assert.ok(hasAxisEdges.length >= 7, `expected ≥7 has_axis edges, got ${hasAxisEdges.length}`);
  });

  it('marketplace: Copy axis = "Punchy", Material axis = "Flat"', () => {
    const result = parseFixture('design-md-pass1-marketplace.md');
    assert.ok(result.fragment);
    const axes = nodesOfType<DnaAxisNode>(result.fragment, 'dna_axis');

    const copy = axes.find((a) => a.axis_name === 'copy');
    assert.ok(copy);
    assert.equal(copy.value, 'Punchy');

    const material = axes.find((a) => a.axis_name === 'material');
    assert.ok(material);
    assert.equal(material.value, 'Flat');
  });

  it('saas fixture: same shape, Copy axis = "Functional"', () => {
    const result = parseFixture('design-md-pass1-saas.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);

    const axes = nodesOfType<DnaAxisNode>(result.fragment, 'dna_axis');
    assert.equal(axes.length, 7);

    const copy = axes.find((a) => a.axis_name === 'copy');
    assert.ok(copy);
    assert.equal(copy.value, 'Functional');
  });

  it('saas: at least one guideline has axis_scope = "copy"', () => {
    const result = parseFixture('design-md-pass1-saas.md');
    assert.ok(result.fragment);
    const guidelines = nodesOfType<BrandDnaGuidelineNode>(result.fragment, 'brand_dna_guideline');
    const withCopyScope = guidelines.filter((g) => g.axis_scope === 'copy');
    assert.ok(withCopyScope.length >= 1, 'expected at least one guideline with axis_scope="copy"');
  });

  it('marketplace: at least one guideline has axis_scope = null (multi-axis match)', () => {
    const result = parseFixture('design-md-pass1-marketplace.md');
    assert.ok(result.fragment);
    const guidelines = nodesOfType<BrandDnaGuidelineNode>(result.fragment, 'brand_dna_guideline');
    const nullScope = guidelines.filter((g) => g.axis_scope === null);
    assert.ok(nullScope.length >= 1, 'expected at least one guideline with axis_scope=null (multi-axis)');
  });
});

describe('design-md parser — fail-loud', () => {
  it('malformed fixture (missing Brand DNA) returns ok:false with error mentioning "Brand DNA"', () => {
    const result = parseFixture('design-md-malformed-missing-brand-dna.md');
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    const mentionsBrandDna = result.errors.some((e) => /Brand DNA/i.test(e.message));
    assert.ok(mentionsBrandDna, 'expected at least one error referencing Brand DNA');
  });

  it('inline fixture with `### BrandDNA` (no space) fails loud', () => {
    const base = readFileSync(join(FIXTURES, 'design-md-pass1-marketplace.md'), 'utf-8');
    const mutated = base.replace('### Brand DNA', '### BrandDNA');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: mutated });
    assert.equal(result.ok, false);
    const mentionsBrandDna = result.errors.some((e) => /Brand DNA/i.test(e.message));
    assert.ok(mentionsBrandDna, 'expected error referencing Brand DNA');
  });

  it('inline fixture missing the Copy axis fails loud and names "copy" specifically', () => {
    const base = readFileSync(join(FIXTURES, 'design-md-pass1-marketplace.md'), 'utf-8');
    // Remove the Copy axis bullet and its continuation line
    const mutated = base.replace(/- \*\*Copy:\*\*.*(?:\n(?!- \*\*).*)*/, '');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: mutated });
    assert.equal(result.ok, false);
    const mentionsCopy = result.errors.some((e) => /copy/i.test(e.message));
    assert.ok(mentionsCopy, 'expected at least one error mentioning "copy"');
  });

  it('inline fixture with broken YAML frontmatter fails loud', () => {
    const base = readFileSync(join(FIXTURES, 'design-md-pass1-marketplace.md'), 'utf-8');
    const mutated = base.replace('name: Stockyard', 'name: [unclosed');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: mutated });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length >= 1);
    assert.ok(result.errors[0].line >= 1);
  });
});

describe('design-md parser — determinism', () => {
  it('parsing marketplace twice produces byte-identical fragment (modulo produced_at)', () => {
    const a = parseFixture('design-md-pass1-marketplace.md');
    const b = parseFixture('design-md-pass1-marketplace.md');
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('design-md parser — axis word-boundary matching (regression: substring false positives)', () => {
  const baseFixture = readFileSync(join(FIXTURES, 'design-md-pass1-marketplace.md'), 'utf-8');

  function withReferences(refsBlock: string): string {
    // Replace the entire `### References` block (up to the next `## ` h2) with a synthetic one.
    return baseFixture.replace(
      /### References\n[\s\S]*?(?=\n## )/,
      `### References\n\n${refsBlock}\n`,
    );
  }

  function withDosBlock(dosBlock: string): string {
    return baseFixture.replace(
      /## Do's and Don'ts\n[\s\S]*$/,
      `## Do's and Don'ts\n\n${dosBlock}\n`,
    );
  }

  it('brand_reference: substring "designscope" does NOT match "scope" axis (no false positive)', () => {
    const md = withReferences('- Designscope (https://example.com/designscope) — a portfolio site');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const refs = nodesOfType<BrandReferenceNode>(result.fragment, 'brand_reference');
    assert.equal(refs.length, 1);
    assert.deepEqual(refs[0].exemplifies_axes, [], 'expected no axis matches for "designscope"');
  });

  it('brand_reference: "exemplifies Density" matches the density axis', () => {
    const md = withReferences('- Acme (https://acme.example) — exemplifies Density');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const refs = nodesOfType<BrandReferenceNode>(result.fragment, 'brand_reference');
    assert.equal(refs.length, 1);
    assert.deepEqual(refs[0].exemplifies_axes, ['density']);
  });

  it('brand_reference: "Density and Motion" matches both axes (sorted)', () => {
    const md = withReferences('- Linear (https://linear.app) — exemplifies Density and Motion');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const refs = nodesOfType<BrandReferenceNode>(result.fragment, 'brand_reference');
    assert.equal(refs.length, 1);
    assert.deepEqual(refs[0].exemplifies_axes, ['density', 'motion']);
  });

  it('brand_reference: compound "designtype" does NOT match "type" axis', () => {
    const md = withReferences('- Designtype Studio (https://example.com/designtype) — typography agency');
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const refs = nodesOfType<BrandReferenceNode>(result.fragment, 'brand_reference');
    assert.equal(refs.length, 1);
    assert.deepEqual(refs[0].exemplifies_axes, [], 'expected no axis matches for "designtype"');
  });

  it("guideline axis_scope: 'characterize the page' does NOT set axis_scope to 'character'", () => {
    const dos = [
      "- Do keep table row height at 32px or below — violating Density=Dense kills the catalog scan rhythm.",
      "- Do use JetBrains Mono for every SKU, lot number, quantity, and price — needed for the brand signal.",
      "- Do use 1px hairlines for all dividers.",
      "- Don't characterize the page with too many fonts.",
    ].join('\n');
    const md = withDosBlock(dos);
    const result = extractDesignMd({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const guidelines = nodesOfType<BrandDnaGuidelineNode>(result.fragment, 'brand_dna_guideline');
    const characterize = guidelines.find((g) => /characterize the page/.test(g.text));
    assert.ok(characterize, 'expected the "characterize the page" guideline to be parsed');
    assert.notEqual(
      characterize.axis_scope,
      'character',
      'word-boundary should prevent "characterize" from matching "character"',
    );
  });
});

describe('design-md parser — pass detection and ID stability', () => {
  it('marketplace fixture: pass_complete = { pass1: true, pass2: false }', () => {
    const result = parseFixture('design-md-pass1-marketplace.md');
    assert.ok(result.fragment);
    const roots = nodesOfType<DesignDocRootNode>(result.fragment, 'design_doc_root');
    assert.equal(roots.length, 1);
    assert.equal(roots[0].pass_complete.pass1, true);
    assert.equal(roots[0].pass_complete.pass2, false);
  });

  it('marketplace: dna_axis__scope and dna_axis__copy with value "Punchy" exist', () => {
    const result = parseFixture('design-md-pass1-marketplace.md');
    assert.ok(result.fragment);
    const ids = new Set(result.fragment.nodes.map((n) => n.id));
    assert.ok(ids.has('dna_axis__scope'), 'expected dna_axis__scope');
    const copyNode = result.fragment.nodes.find((n) => n.id === 'dna_axis__copy') as DnaAxisNode | undefined;
    assert.ok(copyNode, 'expected dna_axis__copy node');
    assert.equal(copyNode.value, 'Punchy');
  });
});
