import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');
const FIXTURES = join(__dirname, 'fixtures');
const SCREENSHOTS = join(FIXTURES, 'screenshots');

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-cli-test-'));
  tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of tmpDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
});

function runCli(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const cliPath = join(REPO_ROOT, 'bin', 'graph-index.ts');
  const result = spawnSync('npx', ['tsx', cliPath, ...args], { cwd, encoding: 'utf-8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

describe('graph-index CLI — Issue #2 best-effort image extraction', () => {
  it('partial success: 2 valid + 1 zero-byte image → exit 0, partial fragment, warnings logged', () => {
    const tmp = newTmp();
    const imgDir = join(tmp, 'design-references');
    mkdirSync(imgDir, { recursive: true });

    copyFileSync(join(SCREENSHOTS, 'marketplace-hero-reference.png'), join(imgDir, 'marketplace-hero-reference.png'));
    copyFileSync(join(SCREENSHOTS, 'dashboard-card-reference.png'), join(imgDir, 'dashboard-card-reference.png'));
    writeFileSync(join(imgDir, 'broken.png'), new Uint8Array(0));

    const result = runCli(['design-references'], tmp);

    assert.equal(result.status, 0);

    const fragmentPath = join(tmp, '.buildanything', 'graph', 'slice-5-references.json');
    assert.ok(existsSync(fragmentPath), 'fragment file should exist');
    const fragment = JSON.parse(readFileSync(fragmentPath, 'utf-8'));
    assert.ok(fragment.nodes.length >= 2, `expected >= 2 nodes, got ${fragment.nodes.length}`);

    assert.ok(result.stdout.includes('[graph-index] ok —'), 'stdout should contain success line');
    assert.ok(result.stdout.includes('broken.png'), 'stdout should contain warning about broken.png');
    assert.ok(result.stdout.includes('indexed 2/3 images; 1 warnings'), 'stdout should contain summary');
  });

  it('all images fail → exit 1, no fragment written, all warnings on stderr', () => {
    const tmp = newTmp();
    const imgDir = join(tmp, 'design-references');
    mkdirSync(imgDir, { recursive: true });

    writeFileSync(join(imgDir, 'bad1.png'), new Uint8Array(0));
    writeFileSync(join(imgDir, 'bad2.png'), new Uint8Array(0));
    writeFileSync(join(imgDir, 'bad3.png'), new Uint8Array(0));

    const result = runCli(['design-references'], tmp);

    assert.equal(result.status, 1);

    const fragmentPath = join(tmp, '.buildanything', 'graph', 'slice-5-references.json');
    assert.ok(!existsSync(fragmentPath), 'fragment file should not exist');

    assert.ok(result.stderr.includes('bad1.png'), 'stderr should mention bad1.png');
    assert.ok(result.stderr.includes('bad2.png'), 'stderr should mention bad2.png');
    assert.ok(result.stderr.includes('bad3.png'), 'stderr should mention bad3.png');
  });
});

describe('graph-index CLI — Issue #5 stale slice-3-tokens.json cleanup', () => {
  const designMdContent = readFileSync(join(FIXTURES, 'design-md-pass1-marketplace.md'), 'utf-8');

  it('Pass 2 yields zero token nodes → existing slice-3-tokens.json is deleted', () => {
    const tmp = newTmp();
    const graphDir = join(tmp, '.buildanything', 'graph');
    mkdirSync(graphDir, { recursive: true });
    writeFileSync(join(graphDir, 'slice-3-tokens.json'), JSON.stringify({
      source_file: 'DESIGN.md',
      source_sha: 'deadbeef',
      produced_at: '2026-01-01T00:00:00.000Z',
      version: 1,
      schema: 'buildanything-slice-3',
      nodes: [],
      edges: [],
    }));

    writeFileSync(join(tmp, 'DESIGN.md'), designMdContent);

    const result = runCli(['DESIGN.md'], tmp);

    assert.equal(result.status, 0);
    assert.ok(!existsSync(join(graphDir, 'slice-3-tokens.json')), 'stale file should be deleted');
    assert.ok(result.stdout.includes('[graph-index] Pass 2 empty — removed stale slice-3-tokens.json'));
  });

  it('Pass 2 yields zero tokens but no prior file → no error, no message', () => {
    const tmp = newTmp();

    writeFileSync(join(tmp, 'DESIGN.md'), designMdContent);

    const result = runCli(['DESIGN.md'], tmp);

    assert.equal(result.status, 0);
    assert.ok(!result.stdout.includes('removed stale slice-3-tokens.json'));
  });
});
