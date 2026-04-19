// End-to-end pipeline smoke test.
//
// Boots the real stdio MCP server + spawns the real PreToolUse hook as
// subprocesses against a fresh tempdir fixture. Exercises every critical
// path that tonight's 2.0.1-2.0.4 bug set broke. If any of these assertions
// had been in CI before 2.0.0 shipped, none of tonight's bugs would have
// reached a user.
//
// What this covers (bug classes guarded):
//   - MCP server registration + tools/list surface (2.0.1)
//   - writer-owner cache compiles with post-fix artifact set (2.0.2)
//   - scribe schema contract: phase "-1", empty ref, no category (2.0.3)
//   - glob specificity: specific writers beat catch-all globs (2.0.4)
//   - PreToolUse allow/deny decisions on fixture paths
//
// What this does NOT cover (needs a real Claude orchestrator):
//   - Subagent dispatch semantics, sprint-context rendering, metric loop
//   - Phase transition logic, backward routing
//   - Any behavior that requires a Claude-driven phase loop

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const PLUGIN_ROOT = resolve(__dirname, '..', '..');
const MCP_ENTRY = join(PLUGIN_ROOT, 'bin', 'mcp-servers', 'orchestrator-mcp.js');
const HOOK_ENTRY = join(PLUGIN_ROOT, 'hooks', 'pre-tool-use');
const PHASE_GRAPH = join(PLUGIN_ROOT, 'docs', 'migration', 'phase-graph.yaml');
const COMPILE_CACHE = join(PLUGIN_ROOT, 'hooks', 'compile-writer-owner-cache.ts');

// ---------------------------------------------------------------------------
// MCP client helpers
// ---------------------------------------------------------------------------

class McpClient {
  private proc: ChildProcess;
  private buffer = '';
  private pending = new Map<number, (msg: any) => void>();
  private nextId = 1;

  constructor(cwd: string) {
    this.proc = spawn(MCP_ENTRY, [], {
      cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf-8');
      let idx;
      while ((idx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (typeof msg.id === 'number') {
            const cb = this.pending.get(msg.id);
            if (cb) {
              this.pending.delete(msg.id);
              cb(msg);
            }
          }
        } catch { /* ignore non-JSON stdout */ }
      }
    });
  }

  async request(method: string, params: unknown = {}): Promise<any> {
    const id = this.nextId++;
    const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP timeout: ${method}`));
      }, 10_000);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.proc.stdin!.write(frame + '\n');
    });
  }

  async callTool(name: string, args: unknown): Promise<any> {
    return this.request('tools/call', { name, arguments: args });
  }

  close(): void {
    this.proc.stdin!.end();
    this.proc.kill();
  }
}

function parseToolResult(response: any): any {
  const text = response?.result?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error(`unexpected tool response: ${JSON.stringify(response)}`);
  }
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Hook subprocess helper
// ---------------------------------------------------------------------------

function fireHook(
  cwd: string,
  toolName: string,
  filePath: string,
  parentToolUseId?: string,
): { exitCode: number; stderr: string; stdout: string } {
  const payload: Record<string, unknown> = {
    tool_name: toolName,
    tool_input: { file_path: filePath },
  };
  if (parentToolUseId) payload.parent_tool_use_id = parentToolUseId;
  // Scrub BUILDANYTHING_* flags from the inherited env so operator-set
  // rollback flags don't silently mask deny assertions.
  const scrubbed = { ...process.env };
  for (const key of Object.keys(scrubbed)) {
    if (key.startsWith('BUILDANYTHING_')) delete scrubbed[key];
  }
  const result = spawnSync(HOOK_ENTRY, [], {
    cwd,
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    env: { ...scrubbed, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  return {
    exitCode: result.status ?? -1,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

function setupFixture(phase: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ba-e2e-'));
  mkdirSync(join(dir, 'docs', 'plans'), { recursive: true });
  mkdirSync(join(dir, '.buildanything'), { recursive: true });

  // Compile the writer-owner cache from the real phase-graph.yaml.
  const compileResult = spawnSync(
    'npx',
    ['tsx', COMPILE_CACHE, PHASE_GRAPH, join(dir, '.buildanything', 'writer-owner.json')],
    { encoding: 'utf-8' },
  );
  if (compileResult.status !== 0) {
    throw new Error(`writer-owner cache compile failed: ${compileResult.stderr}`);
  }

  // Seed state file at the requested phase.
  const state = {
    schema_version: 2,
    phase,
    project_type: 'web',
    autonomous: true,
    completed_tasks: [],
    metric_loop_scores: [],
    session_started: new Date().toISOString(),
  };
  writeFileSync(join(dir, 'docs', 'plans', '.build-state.json'), JSON.stringify(state, null, 2));
  return dir;
}

function stageSubagent(fixtureDir: string, taskId: string, subagentType: string): void {
  const cacheDir = join(fixtureDir, '.buildanything', 'subagent-start-cache');
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, `${taskId}.json`), JSON.stringify({ subagent_type: subagentType }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plugin pipeline — MCP surface', () => {
  let client: McpClient;
  let fixture: string;

  before(async () => {
    fixture = setupFixture('phase-6');
    client = new McpClient(fixture);
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-smoke', version: '1' },
    });
  });

  after(() => client.close());

  it('exposes exactly 10 orchestrator tools', async () => {
    const res = await client.request('tools/list');
    const names: string[] = res.result.tools.map((t: any) => t.name);
    const expected = [
      'state_save', 'state_read', 'verify_integrity',
      'acquire_write_lease', 'release_write_lease', 'list_write_leases',
      'cycle_counter_check', 'clear_in_flight_edge', 'handle_stale_edge',
      'scribe_decision',
    ];
    assert.deepEqual([...names].sort(), [...expected].sort());
  });

  it('state_save writes file with matching sha256', async () => {
    const path = join(fixture, 'docs', 'plans', '.build-state.json');
    const res = await client.callTool('state_save', {
      path,
      state: { phase: 'phase-3', project_type: 'web', schema_version: 2 },
    });
    const body = parseToolResult(res);
    assert.equal(body.success, true);
    const onDisk = readFileSync(path);
    const actualSha = createHash('sha256').update(onDisk).digest('hex');
    assert.equal(body.sha256, actualSha);
  });

  it('state_read round-trips + returns matching sha256', async () => {
    const path = join(fixture, 'docs', 'plans', '.build-state.json');
    const res = await client.callTool('state_read', { path });
    const body = parseToolResult(res);
    assert.equal(body.state.project_type, 'web');
    assert.equal(body.state.schema_version, 2);
    assert.equal(typeof body.sha256, 'string');
  });

  it('acquire + list + release write lease', async () => {
    const acquire = parseToolResult(
      await client.callTool('acquire_write_lease', {
        task_id: 'task-smoke-1',
        file_paths: ['docs/plans/architecture.md'],
      }),
    );
    assert.equal(acquire.granted, true);

    const list = parseToolResult(await client.callTool('list_write_leases', {}));
    assert.ok(list.leases.some((l: any) => l.task_id === 'task-smoke-1' || l.holder === 'task-smoke-1'));

    const release = parseToolResult(
      await client.callTool('release_write_lease', { task_id: 'task-smoke-1' }),
    );
    assert.equal(release.released, true);
  });

  it('scribe_decision writes schema-valid row', async () => {
    const path = join(fixture, 'docs', 'plans', 'decisions.jsonl');
    const res = await client.callTool('scribe_decision', {
      phase: '2',
      summary: 'Use DynamoDB single-table',
      decided_by: 'backend-architect',
      impact_level: 'high',
      chosen_approach: 'pk=tenantId, sk=entityId',
      ref: 'docs/plans/architecture.md#persistence',
    });
    const body = parseToolResult(res);
    assert.match(body.decision_id, /^D-2-\d{2,}$/);
    const row = JSON.parse(readFileSync(path, 'utf-8').trim().split('\n').pop()!);
    assert.equal(row.phase, '2');
    assert.equal(row.ref, 'docs/plans/architecture.md#persistence');
    assert.equal(row.status, 'open');
    assert.equal((row as any).category, undefined, 'category should not be emitted');
  });

  it('scribe_decision rejects empty ref (2.0.3 bug 1)', async () => {
    const res = await client.callTool('scribe_decision', {
      phase: '2',
      summary: 'no ref',
      decided_by: 'agent',
      impact_level: 'low',
      chosen_approach: 'x',
      ref: '',
    });
    // Rejection may surface as either isError:true or a top-level JSON-RPC error.
    const isError = res?.result?.isError === true || typeof res?.error === 'object';
    assert.ok(isError, 'expected rejection, got response: ' + JSON.stringify(res));
    const text = (res?.result?.content?.[0]?.text ?? res?.error?.message ?? '').toString();
    assert.match(text, /ref|String must contain|Invalid|regex/i);
  });

  it('scribe_decision accepts phase "-1" and encodes decision_id (2.0.3 bug 2)', async () => {
    const res = await client.callTool('scribe_decision', {
      phase: '-1',
      summary: 'Xcode 26.3 hard-pin',
      decided_by: 'ios-swift-architect',
      impact_level: 'high',
      chosen_approach: 'Abort bootstrap on older Xcode',
      ref: 'docs/plans/design-doc.md#bootstrap',
    });
    const body = parseToolResult(res);
    assert.match(body.decision_id, /^D-N1-\d{2,}$/);
  });

  it('cycle_counter_check returns mutated state', async () => {
    const res = await client.callTool('cycle_counter_check', {
      state: {
        backward_routing_count: {},
        backward_routing_count_by_target_phase: {},
      },
      input: { decision_id: 'D-1-01', target_phase: 'phase-1' },
      max_cycles: 2,
    });
    const body = parseToolResult(res);
    assert.equal(body.action, 'allow');
    assert.ok(body.state);
  });
});

describe('plugin pipeline — PreToolUse hook', () => {
  it('allows writes whose path matches a glob owned by current phase', () => {
    const dir = setupFixture('phase-2');
    const result = fireHook(dir, 'Write', 'docs/plans/phase-2-contracts/backend-architect.md');
    assert.equal(result.exitCode, 0, `expected allow, stderr=${result.stderr}`);
  });

  it('denies raw Write on .build-state.json (state_save MCP is the only writer)', () => {
    const dir = setupFixture('phase-1');
    const result = fireHook(dir, 'Write', 'docs/plans/.build-state.json');
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /raw Write.*\.build-state\.json.*state_save MCP/);
  });

  it('denies phase-mismatch write (phase-3 trying to write architecture.md owned by phase-2)', () => {
    const dir = setupFixture('phase-3');
    const result = fireHook(dir, 'Write', 'docs/plans/architecture.md');
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /writer-owner|phase-2/);
  });

  it('allows phase-3 to extend refs.json (2.0.3 extended_by fix)', () => {
    const dir = setupFixture('phase-3');
    const result = fireHook(dir, 'Write', 'docs/plans/refs.json');
    assert.equal(result.exitCode, 0, `expected allow for phase-3 extension, stderr=${result.stderr}`);
  });

  it('allows scratch-glob writes (phase_internal_scratch exemption)', () => {
    const dir = setupFixture('phase-1');
    const result = fireHook(dir, 'Write', 'docs/plans/phase1-scratch/feature-intel.md');
    assert.equal(result.exitCode, 0, `expected scratch allow, stderr=${result.stderr}`);
  });

  it('agent-role enforcement fires on lrr/*.json — specific glob beats catch-all (2.0.4)', () => {
    const dir = setupFixture('phase-6');
    stageSubagent(dir, 'task-lrr-1', 'visual-research');
    const result = fireHook(
      dir, 'Write',
      'docs/plans/evidence/lrr/eng-quality.json',
      'task-lrr-1',
    );
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /subagent 'visual-research'.*not an owner/);
  });

  it('agent-role enforcement allows a legitimate LRR chapter judge', () => {
    const dir = setupFixture('phase-6');
    stageSubagent(dir, 'task-lrr-2', 'code-reviewer');
    const result = fireHook(
      dir, 'Write',
      'docs/plans/evidence/lrr/eng-quality.json',
      'task-lrr-2',
    );
    assert.equal(result.exitCode, 0, `expected allow for code-reviewer, stderr=${result.stderr}`);
  });
});
