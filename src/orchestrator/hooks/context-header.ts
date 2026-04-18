import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export interface ContextHeaderInput {
  projectType: 'web' | 'ios';
  phase: number;
  iosFeatures?: Record<string, boolean>;
  visualDnaPath?: string;  // path to visual-dna.md
}

export interface RenderedHeader {
  content: string;
  hash: string;
}

/** Cache: rendered header keyed by phase + input hash for automatic invalidation */
let cachedHeader: RenderedHeader | null = null;
let cachedPhase: number | null = null;
let cachedInputHash: string | null = null;

/**
 * Compute a hash of the variable inputs that affect the rendered header.
 * Used to detect mid-phase mutations (e.g., ios_features changing within a phase).
 */
function inputHash(input: ContextHeaderInput): string {
  const key = JSON.stringify({
    projectType: input.projectType,
    phase: input.phase,
    iosFeatures: input.iosFeatures ?? null,
    visualDnaPath: input.visualDnaPath ?? null,
  });
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Render the CONTEXT header for a phase.
 * Called once at phase boundary; result reused for all dispatches in that phase.
 * Automatically invalidates if inputs change within the same phase
 * (e.g., ios_features mutating mid-build per spec pass criteria).
 */
export function renderContextHeader(input: ContextHeaderInput): RenderedHeader {
  const currentInputHash = inputHash(input);
  // Return cached if same phase AND same inputs
  if (cachedPhase === input.phase && cachedInputHash === currentInputHash && cachedHeader) return cachedHeader;

  const lines: string[] = ['CONTEXT:'];
  lines.push(`  project_type: ${input.projectType}`);
  lines.push(`  phase: ${input.phase}`);

  // DNA: only for web, phase >= 4
  if (input.projectType === 'web' && input.phase >= 4 && input.visualDnaPath) {
    if (existsSync(input.visualDnaPath)) {
      const dna = readFileSync(input.visualDnaPath, 'utf-8');
      const summary = dna.split('\n').slice(0, 5).join('\n').trim();
      lines.push(`  dna: ${summary}`);
    }
  }

  // iOS features: only for ios
  if (input.projectType === 'ios' && input.iosFeatures) {
    const enabled = Object.entries(input.iosFeatures)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (enabled.length > 0) {
      lines.push(`  ios_features: [${enabled.join(', ')}]`);
    }
  }

  lines.push('');
  lines.push('TASK:');

  const content = lines.join('\n');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);

  cachedHeader = { content, hash };
  cachedPhase = input.phase;
  cachedInputHash = currentInputHash;
  return cachedHeader;
}

/**
 * Invalidate the cache (call on phase boundary or state mutation).
 */
export function invalidateCache(): void {
  cachedHeader = null;
  cachedPhase = null;
  cachedInputHash = null;
}

/**
 * Check if the cache is valid for a given phase.
 */
export function isCacheValid(phase: number): boolean {
  return cachedPhase === phase && cachedHeader !== null;
}
