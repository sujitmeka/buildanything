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
 * writes a JSON summary to .buildanything/graph/lint-status.json (consumed by
 * src/graph/storage/index.ts queryDna lint_status field), and appends a
 * one-line summary to docs/plans/build-log.md under
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
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import YAML from "yaml";

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

// Atomic write — tmp + rename so a crash mid-write never leaves a partial
// JSON that graph/storage queryDna would fail to parse.
function atomicWrite(path: string, content: string): void {
  ensureDir(path);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
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
  const infos: LintFinding[] = [];

  // §9.5 iOS-specific post-process checks (gated on project_type=ios).
  const buildStatePath = resolve(cwd, "docs/plans/.build-state.json");
  if (existsSync(buildStatePath)) {
    try {
      const bs = JSON.parse(readFileSync(buildStatePath, "utf8")) as Record<string, unknown>;
      if (bs.project_type === "ios") {
        // Parse YAML frontmatter for token inspection.
        const fmMatch = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const fmYaml = fmMatch ? fmMatch[1] : "";
        let fm: Record<string, unknown> = {};
        try { fm = YAML.parse(fmYaml) ?? {}; } catch { /* skip if unparseable */ }

        const colors = (typeof fm.colors === "object" && fm.colors !== null) ? fm.colors as Record<string, unknown> : {};
        const typography = (typeof fm.typography === "object" && fm.typography !== null) ? fm.typography as Record<string, unknown> : {};
        const components = (typeof fm.components === "object" && fm.components !== null) ? fm.components as Record<string, unknown> : {};

        // 1. Dark-pair rule: every color token needs a -dark counterpart.
        const colorKeys = Object.keys(colors);
        for (const ck of colorKeys) {
          if (ck.endsWith("-dark")) continue;
          if (!colorKeys.includes(`${ck}-dark`)) {
            warnings.push({ rule: "ios-dark-pair", severity: "warning", message: `colors.${ck} has no -dark pair for dark mode` });
          }
        }

        // 2. Dynamic Type role check: typography tokens should match iOS roles.
        const DYNAMIC_TYPE_ROLES = new Set(["largeTitle", "title", "title2", "title3", "headline", "body", "callout", "subheadline", "footnote", "caption", "caption2"]);
        for (const tk of Object.keys(typography)) {
          if (!DYNAMIC_TYPE_ROLES.has(tk)) {
            warnings.push({ rule: "ios-dynamic-type", severity: "warning", message: `typography.${tk} is not a Dynamic Type role — fixed-size Font, breaks accessibility scaling` });
          }
        }

        // 3. iOS 26 gating: Glassy material + iOS 26 → require card-glass/button-tinted.
        const dnaMatch = fileContent.match(/###\s*Brand DNA[\s\S]*?(?=###|\n##\s|$)/);
        const dnaBlock = dnaMatch ? dnaMatch[0] : "";
        const materialMatch = dnaBlock.match(/Material\s*:\s*(.+)/i);
        const material = materialMatch ? materialMatch[1].trim() : "";
        const iosFeatures = Array.isArray(bs.ios_features) ? bs.ios_features as string[] : [];
        const targetsIos26 = iosFeatures.some((f) => /ios\s*26|26\s*sdk/i.test(String(f)));
        const isGlassy = /glassy/i.test(material);
        const compKeys = Object.keys(components);

        if (isGlassy && targetsIos26) {
          if (!compKeys.includes("card-glass")) infos.push({ rule: "ios26-glassy-gate", severity: "info", message: "Material=Glassy + iOS 26 target but components.card-glass is missing" });
          if (!compKeys.includes("button-tinted")) infos.push({ rule: "ios26-glassy-gate", severity: "info", message: "Material=Glassy + iOS 26 target but components.button-tinted is missing" });
        } else if (!isGlassy) {
          if (compKeys.includes("card-glass")) infos.push({ rule: "ios26-glassy-gate", severity: "info", message: "Material is not Glassy but components.card-glass is present — remove it" });
          if (compKeys.includes("button-tinted")) infos.push({ rule: "ios26-glassy-gate", severity: "info", message: "Material is not Glassy but components.button-tinted is present — remove it" });
        }
      }
    } catch { /* build-state unreadable — skip iOS checks */ }
  }
  const brokenRefs = errors.length;
  const exitCode = brokenRefs > 0 ? 2 : 0;

  const ranAt = new Date().toISOString();
  const status: "pass" | "warn" | "fail" =
    brokenRefs > 0 ? "fail" : (warnings.length > 0 || infos.length > 0) ? "warn" : "pass";

  // Storage layer (src/graph/storage/index.ts queryDna) reads
  // .buildanything/graph/lint-status.json and only consumes the `status`
  // field. Extra diagnostic fields (broken_refs, warnings, errors, raw_*)
  // are preserved here for human/tool inspection and are ignored by storage.
  const summary: LintSummary & { status: "pass" | "warn" | "fail"; at: string; source: string } = {
    status,
    at: ranAt,
    source: "DESIGN.md",
    file_hash: fileHash,
    broken_refs: brokenRefs,
    warnings,
    errors,
    ran_at: ranAt,
    exit_code: exitCode,
    raw_stdout: stdout.slice(0, 8000),
    raw_stderr: stderr.slice(0, 2000),
    ...(infos.length > 0 ? { infos } : {}),
  };

  const summaryPath = resolve(cwd, ".buildanything/graph/lint-status.json");
  atomicWrite(summaryPath, JSON.stringify(summary, null, 2));

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
  if (infos.length > 0) {
    process.stdout.write(`design-md-lint: ${infos.length} info(s) (logged, non-blocking)\n`);
  }

  return exitCode;
}

if (process.argv[1]?.endsWith("design-md-lint.ts") || process.argv[1]?.endsWith("design-md-lint")) {
  process.exit(main());
}
