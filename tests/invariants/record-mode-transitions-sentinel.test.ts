import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Subprocess-driven verification of hooks/record-mode-transitions.ts.
// We drive the real script (not a re-implementation) via its documented
// BUILDANYTHING_STATE_PATH / BUILDANYTHING_BUILD_LOG_PATH env contract, so the
// sentinel + diff-logic fix is exercised end-to-end including JSON I/O.

const SCRIPT = resolve(__dirname, '../../hooks/record-mode-transitions.ts');
const TRACKED_FLAGS = [
  'BUILDANYTHING_SDK',
  'BUILDANYTHING_SDK_SPRINT_CONTEXT',
  'BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS',
  'BUILDANYTHING_ENFORCE_WRITER_OWNER',
  'BUILDANYTHING_ENFORCE_WRITE_LEASE',
  'BUILDANYTHING_SCRIBE_SINGLE_WRITER',
  'BUILDANYTHING_ALLOW_RAW_STATE_WRITES',
  'BUILDANYTHING_STRICT_TASK_ID',
] as const;
const UNSET = '<unset>';

type FlagName = typeof TRACKED_FLAGS[number];
type Snapshot = Record<FlagName, string>;
interface Row {
  timestamp: string;
  session_id: string | null;
  flag: FlagName;
  old_value: string;
  new_value: string;
  post_flags: Snapshot;
}
interface State {
  mode_transitions?: Row[];
  [k: string]: unknown;
}

let dir: string;
let statePath: string;
let logPath: string;

// Strip any BUILDANYTHING_* env already present in the parent shell so tests
// are hermetic. Pass only the specific ones each case wants to set.
function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('BUILDANYTHING_') && k !== 'CLAUDE_SESSION_ID') {
      env[k] = v;
    }
  }
  return env;
}

function runRecorder(extraEnv: Record<string, string> = {}): void {
  const env = {
    ...cleanEnv(),
    BUILDANYTHING_STATE_PATH: statePath,
    BUILDANYTHING_BUILD_LOG_PATH: logPath,
    ...extraEnv,
  };
  execFileSync('npx', ['--no-install', 'tsx', SCRIPT], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readState(): State {
  return JSON.parse(readFileSync(statePath, 'utf8')) as State;
}

function writeState(state: State): void {
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function allUnsetSnapshot(): Snapshot {
  const snap = {} as Snapshot;
  for (const f of TRACKED_FLAGS) snap[f] = UNSET;
  return snap;
}

// Seed a baseline transition row so main() has a prev snapshot to diff
// against (the recorder defers on empty mode_transitions by design).
function seedBaselineAllUnset(): void {
  const baseline: State = {
    mode_transitions: [
      {
        timestamp: '2026-01-01T00:00:00.000Z',
        session_id: 'seed',
        flag: 'BUILDANYTHING_SDK',
        old_value: UNSET,
        new_value: UNSET,
        post_flags: allUnsetSnapshot(),
      },
    ],
  };
  writeState(baseline);
}

describe('record-mode-transitions sentinel + diff', () => {
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'rmt-sentinel-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Fresh sub-dir per test to avoid cross-test state bleed.
    const sub = mkdtempSync(join(dir, 'case-'));
    mkdirSync(sub, { recursive: true });
    statePath = join(sub, '.build-state.json');
    logPath = join(sub, 'build-log.md');
  });

  it('case 1: no env vars set + sentinel baseline → no new transition rows', () => {
    seedBaselineAllUnset();
    const before = readState().mode_transitions ?? [];

    runRecorder();

    const after = readState().mode_transitions ?? [];
    assert.equal(
      after.length,
      before.length,
      `expected zero new rows, got ${after.length - before.length}`
    );
    // Confirm the baseline we seeded uses <unset> for every tracked flag so
    // the recorder's readCurrentFlags() agrees on the unset-flag shape.
    for (const f of TRACKED_FLAGS) {
      assert.equal(before[0].post_flags[f], UNSET, `baseline ${f} should be ${UNSET}`);
    }
  });

  it('case 2: BUILDANYTHING_ENFORCE_WRITER_OWNER=false → transition row <unset> → "false"', () => {
    seedBaselineAllUnset();

    runRecorder({ BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false' });

    const rows = readState().mode_transitions ?? [];
    assert.equal(rows.length, 2, `expected 1 new row appended to baseline, got ${rows.length - 1}`);
    const row = rows[rows.length - 1];
    assert.equal(row.flag, 'BUILDANYTHING_ENFORCE_WRITER_OWNER');
    assert.equal(row.old_value, UNSET);
    assert.equal(row.new_value, 'false');
    assert.equal(row.post_flags.BUILDANYTHING_ENFORCE_WRITER_OWNER, 'false');
    // Other flags still unset in the new post_flags snapshot.
    for (const f of TRACKED_FLAGS) {
      if (f === 'BUILDANYTHING_ENFORCE_WRITER_OWNER') continue;
      assert.equal(row.post_flags[f], UNSET, `${f} should remain ${UNSET}`);
    }
  });

  it('case 3: flag stays at "false" on second run → no spurious new row', () => {
    seedBaselineAllUnset();
    runRecorder({ BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false' });
    const afterFirstFlip = (readState().mode_transitions ?? []).length;

    runRecorder({ BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false' });

    const rows = readState().mode_transitions ?? [];
    assert.equal(
      rows.length,
      afterFirstFlip,
      `expected stable row count across repeated runs, got ${rows.length - afterFirstFlip} extra`
    );
  });

  it('case 4: un-set after being "false" → transition row "false" → <unset>', () => {
    seedBaselineAllUnset();
    runRecorder({ BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false' });
    const countAfterFlip = (readState().mode_transitions ?? []).length;

    // Env var explicitly absent this run.
    runRecorder();

    const rows = readState().mode_transitions ?? [];
    assert.equal(rows.length, countAfterFlip + 1, 'expected exactly one new row on un-set');
    const row = rows[rows.length - 1];
    assert.equal(row.flag, 'BUILDANYTHING_ENFORCE_WRITER_OWNER');
    assert.equal(row.old_value, 'false');
    assert.equal(row.new_value, UNSET);
  });

  it('backward-compat: legacy post_flags with literal "false"/"on" does not spuriously diff on first post-fix run', () => {
    // Simulate state written by the pre-fix recorder: unset flags recorded as
    // literal "false" (non-SDK) / "on" (SDK). After the fix deploys, the
    // recorder runs with all env still unset — must not emit any transition.
    const legacyPost: Snapshot = {
      BUILDANYTHING_SDK: 'on',
      BUILDANYTHING_SDK_SPRINT_CONTEXT: 'false',
      BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS: 'false',
      BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false',
      BUILDANYTHING_ENFORCE_WRITE_LEASE: 'false',
      BUILDANYTHING_SCRIBE_SINGLE_WRITER: 'false',
      BUILDANYTHING_ALLOW_RAW_STATE_WRITES: 'false',
      BUILDANYTHING_STRICT_TASK_ID: 'false',
    };
    writeState({
      mode_transitions: [
        {
          timestamp: '2025-12-31T00:00:00.000Z',
          session_id: 'legacy',
          flag: 'BUILDANYTHING_SDK',
          old_value: 'on',
          new_value: 'on',
          post_flags: legacyPost,
        },
      ],
    });

    runRecorder();

    const rows = readState().mode_transitions ?? [];
    assert.equal(rows.length, 1, 'legacy-shape baseline + unset env should not diff');
  });

  it('initial-install: missing state file → recorder no-ops cleanly', () => {
    // statePath deliberately not created — fresh project.
    assert.equal(existsSync(statePath), false);

    runRecorder();

    assert.equal(existsSync(statePath), false, 'recorder must not create state file from nothing');
  });
});
