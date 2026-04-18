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

/** Cache: one rendered header per phase boundary */
let cachedHeader: RenderedHeader | null = null;
let cachedPhase: number | null = null;

/**
 * Render the CONTEXT header for a phase.
 * Called once at phase boundary; result reused for all dispatches in that phase.
 */
export function renderContextHeader(input: ContextHeaderInput): RenderedHeader {
  // Return cached if same phase
  if (cachedPhase === input.phase && cachedHeader) return cachedHeader;

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
  return cachedHeader;
}

/**
 * Invalidate the cache (call on phase boundary or state mutation).
 */
export function invalidateCache(): void {
  cachedHeader = null;
  cachedPhase = null;
}

/**
 * Check if the cache is valid for a given phase.
 */
export function isCacheValid(phase: number): boolean {
  return cachedPhase === phase && cachedHeader !== null;
}
