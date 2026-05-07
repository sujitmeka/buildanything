/**
 * Halt-condition assertions (audit issue #12).
 *
 * Infrastructure for defining and checking project-specific "never do X" rules
 * during the per-task verify gate. Halt-conditions are grep-based assertions
 * that fire when forbidden patterns appear in the codebase.
 *
 * Format: docs/plans/halt-conditions.json
 * ```json
 * [
 *   {
 *     "id": "no-default-maptiler",
 *     "description": "Never use default MapTiler Streets style",
 *     "pattern": "streets-v2|MapTiler Streets",
 *     "glob": "src/**",
 *     "severity": "critical"
 *   }
 * ]
 * ```
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

export interface HaltCondition {
  id: string;
  description: string;
  /** Regex pattern — if matched in files, the condition is violated */
  pattern: string;
  /** Glob for files to check (default: src/**) */
  glob?: string;
  severity: 'critical' | 'high';
}

export interface HaltViolation {
  condition_id: string;
  description: string;
  file: string;
  line: number;
  match: string;
}

export interface HaltCheckResult {
  pass: boolean;
  violations: HaltViolation[];
  conditions_checked: number;
}

const DEFAULT_PATH = 'docs/plans/halt-conditions.json';

/**
 * Load halt-conditions from the project's halt-conditions.json.
 * Returns empty array if file doesn't exist (no conditions defined = pass).
 */
export function loadHaltConditions(projectDir: string): HaltCondition[] {
  const path = join(projectDir, DEFAULT_PATH);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as HaltCondition[];
}

/**
 * Check all halt-conditions against the project files.
 * Uses grep to find violations.
 */
export function checkHaltConditions(projectDir: string, conditions?: HaltCondition[]): HaltCheckResult {
  const conds = conditions ?? loadHaltConditions(projectDir);
  if (conds.length === 0) {
    return { pass: true, violations: [], conditions_checked: 0 };
  }

  const violations: HaltViolation[] = [];

  for (const cond of conds) {
    const glob = cond.glob ?? 'src/**';
    try {
      const result = execSync(
        `grep -rnE ${shellEscape(cond.pattern)} --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.swift' .`,
        { cwd: projectDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      );
      for (const line of result.trim().split('\n').filter(Boolean)) {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (match) {
          violations.push({
            condition_id: cond.id,
            description: cond.description,
            file: match[1],
            line: parseInt(match[2], 10),
            match: match[3].trim(),
          });
        }
      }
    } catch {
      // grep returns exit 1 when no matches — that's a pass for this condition
    }
  }

  return {
    pass: violations.length === 0,
    violations,
    conditions_checked: conds.length,
  };
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}
