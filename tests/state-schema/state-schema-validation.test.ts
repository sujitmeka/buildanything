import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Structural validator (~60 lines) ---

const REQUIRED_FIELDS = [
  'schema_version', 'project_type', 'phase', 'step', 'session_id',
  'session_started', 'session_last_saved', 'autonomous', 'mode',
  'build_request', 'context_level', 'git_branch', 'completed_tasks',
  'pending_tasks', 'phase_artifacts', 'metric_loop_history',
  'dispatch_counter', 'phase_progress', 'resume_point', 'verification',
];
const VALID_PHASES = [-1, 0, 1, 2, 3, 4, 5, 6, 7];
const VALID_PROJECT_TYPES = ['ios', 'web'];
const VALID_CONTEXT_LEVELS = ['raw_idea', 'decision_brief', 'partial_context', 'full_design'];
const VALID_MODES = ['interactive', 'autonomous'];
const KNOWN_FIELDS = new Set([
  ...REQUIRED_FIELDS, 'app_name', 'bundle_id', 'xcodeproj_path',
  'ios_features', 'in_progress_task', 'active_metric_loop', 'blockers',
  'decisions_next_id', 'backward_routing_count',
  'backward_routing_count_by_target_phase', 'in_flight_backward_edge',
  'mode_transitions', 'lrr_cycle_state', 'current_sprint_context_hash',
]);
const IOS_FEATURE_KEYS = [
  'widgets', 'liveActivities', 'appIntents', 'foundationModels',
  'storekit', 'healthkit', 'push', 'cloudkit', 'siri', 'location',
  'background', 'cameraPhoto', 'microphone', 'contacts', 'calendar', 'appleWatch',
];

function validateState(s: Record<string, unknown>): string[] {
  const errors: string[] = [];
  // Rule 1: required fields
  for (const f of REQUIRED_FIELDS) {
    if (!(f in s)) errors.push(`missing required field: ${f}`);
  }
  // Fail-closed: unknown fields
  for (const k of Object.keys(s)) {
    if (!KNOWN_FIELDS.has(k)) errors.push(`unknown field: ${k}`);
  }
  // Rule 3+4: type & enum checks
  if (typeof s.schema_version !== 'number') errors.push('schema_version must be integer');
  if (!VALID_PROJECT_TYPES.includes(s.project_type as string)) errors.push('invalid project_type');
  if (!VALID_PHASES.includes(s.phase as number)) errors.push('invalid phase');
  if (typeof s.step !== 'string') errors.push('step must be string');
  if (!VALID_CONTEXT_LEVELS.includes(s.context_level as string)) errors.push('invalid context_level');
  if (!VALID_MODES.includes(s.mode as string)) errors.push('invalid mode');
  if (typeof s.autonomous !== 'boolean') errors.push('autonomous must be boolean');
  // Rule 6: mode/autonomous consistency
  if (s.mode === 'autonomous' && s.autonomous !== true) errors.push('mode/autonomous inconsistency');
  if (s.mode === 'interactive' && s.autonomous !== false) errors.push('mode/autonomous inconsistency');
  // Rule 7: iOS gating
  if (s.project_type === 'ios') {
    for (const f of ['app_name', 'bundle_id', 'xcodeproj_path', 'ios_features']) {
      if (!(f in s)) errors.push(`iOS build missing ${f}`);
    }
  }
  // Rule 8: ios_features shape
  if (s.ios_features && typeof s.ios_features === 'object') {
    const keys = Object.keys(s.ios_features as object);
    if (keys.length !== 16 || !IOS_FEATURE_KEYS.every(k => keys.includes(k)))
      errors.push('ios_features must have exactly 16 boolean keys');
  }
  // Rule 9: completed_tasks shape
  if (Array.isArray(s.completed_tasks)) {
    for (const t of s.completed_tasks as Record<string, unknown>[]) {
      for (const f of ['task_id', 'task_name', 'status', 'evidence_files', 'completed_at']) {
        if (!(f in t)) errors.push(`completed_task missing ${f}`);
      }
    }
  }
  return errors;
}

// --- Fixtures ---

function makeBaseState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: 1,
    project_type: 'web',
    phase: 3,
    step: '3.2',
    session_id: '6f3a9c82-7d4e-4b51-9f2a-1e8c6d3f4a0b',
    session_started: '2026-04-13T09:12:00Z',
    session_last_saved: '2026-04-13T11:47:33Z',
    autonomous: false,
    mode: 'interactive',
    build_request: 'Build a task manager app',
    context_level: 'raw_idea',
    git_branch: 'main',
    completed_tasks: [],
    pending_tasks: [],
    phase_artifacts: {},
    metric_loop_history: [],
    dispatch_counter: { dispatches_since_save: 0, last_save_phase: '3' },
    phase_progress: {
      phase_0: true, phase_1: true, phase_2: true, phase_3: false,
      phase_4: false, phase_5: false, phase_6: false, phase_7: false,
    },
    resume_point: { phase: 3, step: '3.2', autonomous: false, completed_summary: 'Phases 0-2 done', git_branch: 'main' },
    verification: { last_verify_result: null, last_verify_timestamp: null },
    ...overrides,
  };
}

function makeIosFeatures(): Record<string, boolean> {
  return Object.fromEntries(IOS_FEATURE_KEYS.map(k => [k, false]));
}

// --- Tests ---

describe('state-schema structural validation', () => {
  it('valid web state passes all structural checks', () => {
    const errors = validateState(makeBaseState());
    assert.deepStrictEqual(errors, []);
  });

  it('valid iOS state passes all structural checks', () => {
    const state = makeBaseState({
      project_type: 'ios',
      phase: -1,
      step: '-1.1',
      app_name: 'TestApp',
      bundle_id: 'com.test.app',
      xcodeproj_path: '/Users/dev/TestApp.xcodeproj',
      ios_features: makeIosFeatures(),
      phase_progress: {
        phase_minus_1: false,
        phase_0: false, phase_1: false, phase_2: false, phase_3: false,
        phase_4: false, phase_5: false, phase_6: false, phase_7: false,
      },
      resume_point: { phase: -1, step: '-1.1', autonomous: false, completed_summary: 'iOS bootstrap', git_branch: 'main' },
    });
    const errors = validateState(state);
    assert.deepStrictEqual(errors, []);
  });

  it('missing required field detected', () => {
    const state = makeBaseState();
    delete state.build_request;
    const errors = validateState(state);
    assert.ok(errors.some(e => e.includes('missing required field: build_request')));
  });

  it('invalid phase value detected', () => {
    const errors = validateState(makeBaseState({ phase: 99 }));
    assert.ok(errors.some(e => e.includes('invalid phase')));
  });

  it('invalid project_type detected', () => {
    const errors = validateState(makeBaseState({ project_type: 'android' }));
    assert.ok(errors.some(e => e.includes('invalid project_type')));
  });

  it('mode/autonomous consistency check', () => {
    const errors = validateState(makeBaseState({ mode: 'autonomous', autonomous: false }));
    assert.ok(errors.some(e => e.includes('mode/autonomous inconsistency')));
  });

  it('Stage 4 state with backward_routing_count is valid', () => {
    const state = makeBaseState({
      schema_version: 2,
      backward_routing_count: { 'D-3-001': 1 },
      backward_routing_count_by_target_phase: { '2': 1 },
    });
    const errors = validateState(state);
    assert.deepStrictEqual(errors, []);
  });

  it('Stage 6 state with current_sprint_context_hash is valid', () => {
    const state = makeBaseState({
      schema_version: 4,
      current_sprint_context_hash: 'abc123def456',
    });
    const errors = validateState(state);
    assert.deepStrictEqual(errors, []);
  });

  it('unknown field rejected (fail-closed)', () => {
    const state = makeBaseState({ rogue_field: 'should not be here' });
    const errors = validateState(state);
    assert.ok(errors.some(e => e.includes('unknown field: rogue_field')));
  });
});
