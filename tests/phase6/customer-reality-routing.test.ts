import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFindings,
  computeVerdict,
  type CustomerRealityFindings,
} from '../../src/orchestrator/customer-reality-routing.js';

const baseFindings: CustomerRealityFindings = {
  schema_version: '1',
  judged_at: '2026-05-07T00:00:00Z',
  project_type: 'web',
  doesnt_deliver: [],
  confusing_or_illogical: [],
};

describe('customer-reality routing — defaults', () => {
  it('doesnt_deliver routes to Phase 1 / 1.6 by default', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      doesnt_deliver: [
        {
          finding_id: 'CR-DD-001',
          description: 'Landing page does not surface table-friendliness signal',
        },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].target_phase, 1);
    assert.equal(targets[0].target_step, '1.6');
    assert.equal(targets[0].source_list, 'doesnt_deliver');
  });

  it('confusing_or_illogical routes to Phase 3 / 3.3 by default', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      confusing_or_illogical: [
        {
          finding_id: 'CR-CI-001',
          description: 'Mascot widget on home page has no apparent purpose',
        },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].target_phase, 3);
    assert.equal(targets[0].target_step, '3.3');
    assert.equal(targets[0].source_list, 'confusing_or_illogical');
  });
});

describe('customer-reality routing — escape hatches', () => {
  it('architectural keywords route to Phase 2 (perf)', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      doesnt_deliver: [
        {
          finding_id: 'CR-DD-001',
          description: 'Feed loads in 12 seconds — performance unacceptable for the brief',
        },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets[0].target_phase, 2);
    assert.equal(targets[0].target_step, '2.3');
  });

  it('schema keyword routes to Phase 2', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      confusing_or_illogical: [
        {
          finding_id: 'CR-CI-001',
          description: 'Companion outfit list is empty — schema mismatch suspected',
        },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets[0].target_phase, 2);
  });

  it('implementation drift hint routes to Phase 4', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      confusing_or_illogical: [
        {
          finding_id: 'CR-CI-001',
          description: 'Wave-gate missed this button placement — implementation drift from page-spec',
        },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets[0].target_phase, 4);
    assert.equal(targets[0].target_step, '4.3.5');
  });
});

describe('customer-reality routing — multiple findings', () => {
  it('routes a mixed batch into per-finding targets', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      doesnt_deliver: [
        { finding_id: 'CR-DD-001', description: 'Brief said anonymous browse; app forces sign-in' },
        { finding_id: 'CR-DD-002', description: 'Latency on first navigation is unacceptable' },
      ],
      confusing_or_illogical: [
        { finding_id: 'CR-CI-001', description: 'Two CTAs say nearly the same thing on cafe detail' },
      ],
    };
    const targets = classifyFindings(findings);
    assert.equal(targets.length, 3);
    assert.equal(targets[0].target_phase, 1);
    assert.equal(targets[1].target_phase, 2);
    assert.equal(targets[2].target_phase, 3);
  });
});

describe('customer-reality verdict — binary', () => {
  it('empty lists → PRODUCTION READY', () => {
    const result = computeVerdict(baseFindings, 1);
    assert.equal(result.combined_verdict, 'PRODUCTION READY');
    assert.equal(result.doesnt_deliver_count, 0);
    assert.equal(result.confusing_or_illogical_count, 0);
    assert.equal(result.routing_targets.length, 0);
  });

  it('non-empty doesnt_deliver → BLOCKED', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      doesnt_deliver: [{ finding_id: 'CR-DD-001', description: 'Anonymous browse missing' }],
    };
    const result = computeVerdict(findings, 1);
    assert.equal(result.combined_verdict, 'BLOCKED');
    assert.equal(result.routing_targets.length, 1);
  });

  it('non-empty confusing_or_illogical → BLOCKED (no softening rung)', () => {
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      confusing_or_illogical: [
        { finding_id: 'CR-CI-001', description: 'Mascot on home page makes no sense' },
      ],
    };
    const result = computeVerdict(findings, 1);
    assert.equal(result.combined_verdict, 'BLOCKED');
  });

  it('there is no NEEDS WORK rung — verdict is binary on the union', () => {
    // Mix of findings — still binary: either all empty (PRODUCTION READY) or any non-empty (BLOCKED).
    const findings: CustomerRealityFindings = {
      ...baseFindings,
      doesnt_deliver: [{ finding_id: 'CR-DD-001', description: 'foo' }],
      confusing_or_illogical: [{ finding_id: 'CR-CI-001', description: 'bar' }],
    };
    const result = computeVerdict(findings, 1);
    // Per spec: the v2.4 verdict enum at this stage is PRODUCTION READY | BLOCKED only.
    assert.ok(['PRODUCTION READY', 'BLOCKED'].includes(result.combined_verdict));
    assert.equal(result.combined_verdict, 'BLOCKED');
  });
});
