import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractArchitecture } from '../../src/graph/parser/architecture.js';
import type {
  ArchitectureModuleNode,
  ApiContractNode,
  DataModelNode,
  GraphFragment,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parseFixture(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractArchitecture({ mdPath: p, mdContent: md });
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

describe('architecture parser -- marketplace fixture', () => {
  it('parses ok:true with exactly 5 architecture_module nodes', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const modules = nodesOfType<ArchitectureModuleNode>(result.fragment, 'architecture_module');
    assert.equal(modules.length, 5, `expected 5 modules, got ${modules.length}: ${modules.map((m) => m.name).join(', ')}`);
  });

  it('has exactly 9 api_contract nodes', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const contracts = nodesOfType<ApiContractNode>(result.fragment, 'api_contract');
    assert.equal(contracts.length, 9);
  });

  it('has exactly 6 data_model nodes', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const models = nodesOfType<DataModelNode>(result.fragment, 'data_model');
    assert.equal(models.length, 6);
  });

  it('GET /api/orders and POST /api/orders are distinct nodes', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const getOrders = result.fragment.nodes.find((n) => n.id === 'api_contract__get-api-orders');
    const postOrders = result.fragment.nodes.find((n) => n.id === 'api_contract__post-api-orders');
    assert.ok(getOrders, 'expected api_contract__get-api-orders');
    assert.ok(postOrders, 'expected api_contract__post-api-orders');
  });

  it('Order data model has fields including id:uuid and total:number', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const order = nodesOfType<DataModelNode>(result.fragment, 'data_model')
      .find((n) => n.entity_name === 'Order');
    assert.ok(order, 'expected Order data model');
    assert.ok(order.fields.includes('id:uuid'), `expected id:uuid in fields: ${order.fields}`);
    assert.ok(order.fields.includes('total:number'), `expected total:number in fields: ${order.fields}`);
  });

  it('module_has_contract edges count equals api_contract node count (9)', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const contractEdges = result.fragment.edges.filter((e) => e.relation === 'module_has_contract');
    assert.equal(contractEdges.length, 9);
  });

  it('module_has_data_model edges count equals 6', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const modelEdges = result.fragment.edges.filter((e) => e.relation === 'module_has_data_model');
    assert.equal(modelEdges.length, 6);
  });

  it('determinism: parsing twice produces byte-identical output (modulo produced_at)', () => {
    const a = parseFixture('architecture-marketplace.md');
    const b = parseFixture('architecture-marketplace.md');
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('architecture parser -- saas fixture', () => {
  it('parses ok:true with 5 modules, 7 contracts, 4 data models', () => {
    const result = parseFixture('architecture-saas.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const modules = nodesOfType<ArchitectureModuleNode>(result.fragment, 'architecture_module');
    assert.equal(modules.length, 5, `modules: ${modules.map((m) => m.name).join(', ')}`);
    const contracts = nodesOfType<ApiContractNode>(result.fragment, 'api_contract');
    assert.equal(contracts.length, 7);
    const models = nodesOfType<DataModelNode>(result.fragment, 'data_model');
    assert.equal(models.length, 4);
  });
});

describe('architecture parser -- malformed fixture', () => {
  it('returns ok:false with error about no recognizable module sections', () => {
    const result = parseFixture('architecture-malformed-no-modules.md');
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    assert.ok(
      result.errors[0].message.includes('no recognizable module sections'),
      `expected error about no recognizable module sections, got: ${result.errors[0].message}`,
    );
  });
});

describe('architecture parser -- feature attribution edges', () => {
  it('emits feature_provides_endpoint edges from explicit (provides: x) annotations', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    assert.ok(provides.length >= 4, `expected >=4 feature_provides_endpoint edges, got ${provides.length}`);

    const cart = provides.find((e) => e.target === 'api_contract__post-api-cart');
    assert.ok(cart, 'expected provides edge for POST /api/cart');
    assert.equal(cart.source, 'feature__order-placement');

    const orders = provides.find((e) => e.target === 'api_contract__post-api-orders');
    assert.ok(orders, 'expected provides edge for POST /api/orders');
    assert.equal(orders.source, 'feature__order-placement');

    const inventory = provides.find((e) => e.target === 'api_contract__get-api-inventory-id');
    assert.ok(inventory, 'expected provides edge for GET /api/inventory/{id}');
    assert.equal(inventory.source, 'feature__inventory');

    const ship = provides.find((e) => e.target === 'api_contract__post-api-seller-orders-id-ship');
    assert.ok(ship, 'expected provides edge for POST /api/seller/orders/{id}/ship');
    assert.equal(ship.source, 'feature__seller-fulfillment');
  });

  it('emits feature_consumes_endpoint edges from explicit (consumes: x) annotations', () => {
    const result = parseFixture('architecture-marketplace.md');
    assert.ok(result.fragment);
    const consumes = result.fragment.edges.filter(
      (e) => e.relation === 'feature_consumes_endpoint',
    );
    assert.ok(consumes.length >= 1, `expected >=1 feature_consumes_endpoint edge, got ${consumes.length}`);

    const inventory = consumes.find((e) => e.target === 'api_contract__get-api-inventory-id');
    assert.ok(inventory, 'expected consumes edge for GET /api/inventory/{id}');
    assert.equal(inventory.source, 'feature__order-placement');
  });

  it('explicit annotation: parses (provides: x) (consumes: y) on heading line', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**POST /api/foo** (provides: foo) (consumes: bar)',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const consumes = result.fragment.edges.filter(
      (e) => e.relation === 'feature_consumes_endpoint',
    );
    assert.equal(provides.length, 1);
    assert.equal(provides[0].source, 'feature__foo');
    assert.equal(provides[0].target, 'api_contract__post-api-foo');
    assert.equal(consumes.length, 1);
    assert.equal(consumes[0].source, 'feature__bar');
  });

  it('explicit annotation: emitted edges are tagged EXTRACTED', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**POST /api/foo** (provides: foo) (consumes: bar)',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const consumes = result.fragment.edges.filter(
      (e) => e.relation === 'feature_consumes_endpoint',
    );
    assert.equal(provides[0].confidence, 'EXTRACTED');
    assert.equal(consumes[0].confidence, 'EXTRACTED');
  });

  it('explicit annotation: comma-separated targets fan out into multiple edges', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**POST /api/foo** (provides: foo, baz)',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    assert.equal(provides.length, 2);
    const sources = provides.map((e) => e.source).sort();
    assert.deepEqual(sources, ['feature__baz', 'feature__foo']);
  });

  it('heuristic: path inference picks first non-stopword segment when no annotation, marked INFERRED', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**POST /api/checkout**',
      '- Auth required: yes',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const checkout = provides.find((e) => e.source === 'feature__checkout');
    assert.ok(checkout, `expected feature__checkout edge`);
    assert.equal(checkout.confidence, 'INFERRED', 'path-inferred edges must be INFERRED');
  });

  it('heuristic: path-param placeholders are skipped during inference, edge marked INFERRED', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**GET /api/inventory/{id}**',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const inv = provides.find((e) => e.source === 'feature__inventory');
    assert.ok(inv, `expected feature__inventory edge`);
    assert.equal(inv.confidence, 'INFERRED');
    const sources = provides.map((e) => e.source);
    assert.ok(!sources.includes('feature__id'));
    assert.ok(!sources.includes('feature__api'));
  });

  it('heuristic: module-name match emits INFERRED feature edge for non-generic top-level modules', () => {
    const md = [
      '# Backend',
      'Required module marker.',
      '',
      '# Checkout',
      '',
      '## API Endpoints',
      '',
      '**POST /api/place**',
      '- Auth required: yes',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const checkout = provides.find((e) => e.source === 'feature__checkout');
    assert.ok(checkout, `expected feature__checkout from module match`);
    assert.equal(checkout.confidence, 'INFERRED');
  });

  it('heuristic: generic module names (Frontend/Backend/Auth) do not produce module-name edges', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**GET /api/health**',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const sources = provides.map((e) => e.source);
    assert.ok(!sources.includes('feature__backend'), 'generic Backend module name should not produce feature edge');
  });

  it('prose phrases like "consumed by X" no longer emit edges (heuristic removed 2026-04-30)', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**GET /api/products**',
      '- Auth required: no',
      '- Consumed by Catalog and Discovery features',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const consumes = result.fragment.edges.filter(
      (e) => e.relation === 'feature_consumes_endpoint',
    );
    // No consumes edges should be emitted from prose patterns
    assert.equal(consumes.length, 0, `expected no consumes edges from prose, got: ${consumes.map(e => e.source).join(', ')}`);
  });

  it('explicit annotation takes precedence over heuristics (no path/module fallback when annotation present)', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**POST /api/checkout** (provides: alpha)',
      '- Auth required: yes',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.ok(result.fragment);
    const provides = result.fragment.edges.filter(
      (e) => e.relation === 'feature_provides_endpoint',
    );
    const sources = provides.map((e) => e.source).sort();
    assert.deepEqual(sources, ['feature__alpha'], 'only the explicit annotation target should appear');
  });
});

describe('architecture parser -- inline fixtures', () => {
  it('inline md with no recognizable module headings returns ok:false', () => {
    const md = '# Foo\nbar\n# Baz\nqux\n';
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, false);
    assert.ok(result.errors[0].message.includes('no recognizable module sections'));
  });

  // Duplicate method+path within one module dedupes to a single node (the
  // module-scoping fix: when `## API Endpoints` is a subsection of `# Backend`,
  // the endpoints are scanned within Backend's body and deduplicated by id,
  // rather than `## API Endpoints` becoming its own peer module).
  it('duplicate method+path within one module produces a single deduplicated node', () => {
    const md = [
      '# Backend',
      '## API Endpoints',
      '',
      '**GET /api/foo**',
      '- Auth required: no',
      '',
      '**GET /api/foo**',
      '- Auth required: no',
      '',
    ].join('\n');
    const result = extractArchitecture({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const contracts = nodesOfType<ApiContractNode>(result.fragment, 'api_contract');
    assert.equal(contracts.length, 1, 'duplicate endpoints in one module dedupe to a single node');
    assert.equal(contracts[0].id, 'api_contract__get-api-foo');
    const modules = nodesOfType<ArchitectureModuleNode>(result.fragment, 'architecture_module');
    assert.equal(modules.length, 1, 'h2 subsection should not become a peer module of its h1 parent');
    assert.equal(modules[0].name, 'Backend');
  });
});
