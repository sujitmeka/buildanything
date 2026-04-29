#!/usr/bin/env tsx
/*
 * buildanything: DESIGN.md lint runner (Phase 3 Step 3.8 gate).
 *
 * Runs the pinned @google/design.md linter (devDependency in package.json) via
 * `npx --no-install` against the DESIGN.md at the current working directory.
 * Auto-installs the pinned version on first use if the package is listed in
 * package.json devDependencies but not yet in node_modules — runs plain
 * `npm install` (no args) so package.json is not mutated. Classifies findings
 * (broken-ref => error, everything else => warning per
 * protocols/design-md-authoring.md §8),
 * writes a JSON summary to docs/plans/evidence/design-md-lint.json, and
 * appends a one-line summary to docs/plans/build-log.md under
 * `## Phase 3 Step 3.8 — DESIGN.md Lint`.
 *
 * Exit codes:
 *   0 — pass (broken-refs == 0; warnings allowed)
 *   2 — fail (broken-refs > 0; orchestrator routes back to Step 3.4)
 *   3 — DESIGN.md missing
 *
 * Invocation:
 *   npx tsx hooks/design-md-lint.ts          # run inside project root
 *   hooks/design-md-lint                     # via bash wrapper
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

interface LintFinding {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
}

interface LintSummary {
  file_hash: string;
  broken_refs: number;
  warnings: LintFinding[];
  errors: LintFinding[];
  ran_at: string;
  exit_code: number;
  raw_stdout: string;
  raw_stderr: string;
}

const BROKEN_REF_RULES = new Set(["broken-ref"]);

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function parseFindings(stdout: string): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^DESIGN\.md(?::(\d+))?\s+(error|warn|warning|info)\s+([\w-]+)\s+(.+)$/i);
    if (!m) continue;
    const sev = m[2].toLowerCase();
    const severity: LintFinding["severity"] =
      sev === "error" ? "error" : sev === "info" ? "info" : "warning";
    findings.push({
      rule: m[3],
      severity,
      message: m[4],
      line: m[1] ? Number(m[1]) : undefined,
    });
  }
  return findings;
}

interface PackageJson {
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
}

/**
 * Returns true if @google/design.md is pinned in package.json devDependencies
 * (or dependencies) but is NOT installed under node_modules. This is the
 * narrow window where auto-install is safe — the package is "ours" to install.
 * Returns false in any other state (missing package.json, missing pin,
 * already installed, parse error) so the caller falls through to existing
 * behavior.
 */
function shouldAutoInstall(cwd: string): boolean {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) return false;
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;
  } catch {
    return false;
  }
  const pinned =
    pkg.devDependencies?.["@google/design.md"] ??
    pkg.dependencies?.["@google/design.md"];
  if (!pinned) return false;
  // Installed if the package directory exists. We don't validate the
  // version range here — npm install will reconcile against package-lock.
  const installedPath = resolve(cwd, "node_modules", "@google", "design.md");
  return !existsSync(installedPath);
}

function main(): number {
  const cwd = process.cwd();
  const designMd = resolve(cwd, "DESIGN.md");
  if (!existsSync(designMd)) {
    process.stderr.write(`design-md-lint: DESIGN.md not found at ${designMd}\n`);
    return 3;
  }

  const fileContent = readFileSync(designMd, "utf8");
  const fileHash = sha256(fileContent);

  // First attempt: --no-install ensures we use the pinned version from
  // package.json (devDependency). If the package isn't installed locally,
  // we auto-install once below rather than silently fetching latest from
  // npm — that's the whole point of pinning.
  const runLint = () =>
    spawnSync("npx", ["--no-install", "@google/design.md", "lint", "DESIGN.md"], {
      cwd,
      encoding: "utf8",
    });

  let lint = runLint();

  // Auto-install fallback: only fires when the package is pinned in
  // package.json but missing from node_modules. We run plain `npm install`
  // (no args, no --save-dev) — that installs from the existing devDeps
  // block and does NOT mutate package.json or package-lock.json beyond
  // what npm already does for normal install resolution.
  const linterNotInstalled = lint.error || (lint.status !== null && lint.status !== 0 && /could not determine|could not find/i.test(lint.stderr ?? ""));
  if (linterNotInstalled && shouldAutoInstall(cwd)) {
    process.stdout.write("design-md-lint: pinned linter not installed; running 'npm install' once (~5-15s)...\n");
    const install = spawnSync("npm", ["install", "--silent"], {
      cwd,
      encoding: "utf8",
    });
    if (install.status === 0) {
      lint = runLint();
    } else {
      process.stderr.write(`design-md-lint: auto-install failed (exit ${install.status}). Run 'npm install' from the plugin root manually.\n`);
      if (install.stderr) process.stderr.write(install.stderr);
      return 2;
    }
  }

  const stdout = lint.stdout ?? "";
  const stderr = lint.stderr ?? "";

  if (lint.error) {
    process.stderr.write(`design-md-lint: linter spawn failed: ${lint.error.message}\n`);
    process.stderr.write(`design-md-lint: install pinned version with: npm install --save-dev @google/design.md\n`);
    process.stderr.write(stderr);
    return 2;
  }

  const findings = parseFindings(stdout);
  const errors = findings.filter((f) => f.severity === "error" && BROKEN_REF_RULES.has(f.rule));
  const warnings = findings.filter((f) => f.severity === "warning" || (f.severity === "error" && !BROKEN_REF_RULES.has(f.rule)));
  const brokenRefs = errors.length;
  const exitCode = brokenRefs > 0 ? 2 : 0;

  const summary: LintSummary = {
    file_hash: fileHash,
    broken_refs: brokenRefs,
    warnings,
    errors,
    ran_at: new Date().toISOString(),
    exit_code: exitCode,
    raw_stdout: stdout.slice(0, 8000),
    raw_stderr: stderr.slice(0, 2000),
  };

  const summaryPath = resolve(cwd, "docs/plans/evidence/design-md-lint.json");
  ensureDir(summaryPath);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const buildLogPath = resolve(cwd, "docs/plans/build-log.md");
  if (existsSync(buildLogPath)) {
    const shortHash = fileHash.slice(0, 12);
    const oneLine = `${summary.ran_at} | broken-refs: ${brokenRefs} | warnings: ${warnings.length} | hash: ${shortHash}\n`;
    let existing = readFileSync(buildLogPath, "utf8");
    if (!/## Phase 3 Step 3\.8 — DESIGN\.md Lint/.test(existing)) {
      existing += `\n## Phase 3 Step 3.8 — DESIGN.md Lint\n\n`;
      writeFileSync(buildLogPath, existing);
    }
    appendFileSync(buildLogPath, oneLine);
  }

  if (brokenRefs > 0) {
    process.stderr.write(`design-md-lint: ${brokenRefs} broken-ref error(s) — Phase 3.8 routes back to Step 3.4\n`);
    for (const e of errors) {
      process.stderr.write(`  ${e.rule}${e.line ? ` (line ${e.line})` : ""}: ${e.message}\n`);
    }
  }
  if (warnings.length > 0) {
    process.stdout.write(`design-md-lint: ${warnings.length} warning(s) (logged, non-blocking)\n`);
  }

  return exitCode;
}

if (process.argv[1]?.endsWith("design-md-lint.ts") || process.argv[1]?.endsWith("design-md-lint")) {
  process.exit(main());
}
