import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderSprintContext, SprintContextInput } from '../../src/orchestrator/phase4-shared-context';

const base: SprintContextInput = {
  buildState: { status: 'green' },
  refs: { api: '/v1' },
  architecture: 'swift-ui',
  qualityTargets: { crashes: 0 },
};

describe('sprint-context iOS flags', () => {
  it('includes iOS Features section when iosFeatures provided', () => {
    const input = { ...base, iosFeatures: ['HealthKit', 'StoreKit2'] };
    const block = renderSprintContext(input);
    assert.ok(block.content.includes('## iOS Features'));
    assert.ok(block.content.includes('HealthKit, StoreKit2'));
  });

  it('omits iOS Features section when iosFeatures is empty', () => {
    const input = { ...base, iosFeatures: [] };
    const block = renderSprintContext(input);
    assert.ok(!block.content.includes('## iOS Features'));
  });

  it('Pacely iOS refs share correctly with multiple features', () => {
    const input = { ...base, iosFeatures: ['FoundationModels', 'SwiftUI', 'CoreData'] };
    const block = renderSprintContext(input);
    assert.ok(block.content.includes('FoundationModels, SwiftUI, CoreData'));
    assert.ok(block.content.includes('## Refs Index'));
  });
});
