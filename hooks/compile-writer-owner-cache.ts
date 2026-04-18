#!/usr/bin/env tsx
/*
 * buildanything: compile writer-owner cache (tasks 2.1.2, 2.1.3).
 *
 * Called from hooks/session-start once per session. Reads the plugin's
 * docs/migration/phase-graph.yaml, flattens the artifacts table into a
 * JSON cache the PreToolUse handler can read without parsing YAML on every
 * tool call.
 *
 * Task 2.1.3 additive: also encodes `phase_internal_scratch.path_glob` as
 * `scratch_globs` so the handler can exempt scratch paths from default-deny
 * without re-parsing YAML. Still version 1 — new field is additive.
 *
 * Usage: tsx hooks/compile-writer-owner-cache.ts <source-yaml> <output-json>
 *
 * Exits 0 on success. Exits 1 (with stderr) on any failure so session-start
 * can log a warning and continue — the handler falls back to live YAML parse.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

interface RawArtifact {
  path: string;
  writer?: string;
  writers?: string[];
}

interface RawScratch {
  path_glob?: string;
}

interface PhaseGraph {
  artifacts?: RawArtifact[];
  phase_internal_scratch?: RawScratch;
}

interface CompiledArtifact {
  path: string;
  writers: string[];
  is_glob: boolean;
  regex?: string;
}

interface CompiledScratchGlob {
  glob: string;
  regex: string;
}

interface Cache {
  version: 1;
  source_sha: string;
  source_mtime: number;
  compiled_at: string;
  artifacts: CompiledArtifact[];
  // Additive v1 field (task 2.1.3): globs from `phase_internal_scratch` that
  // must be exempt from default-deny. Writers: any phase.
  scratch_globs: CompiledScratchGlob[];
}

const CACHE_VERSION = 1;

function globToRegex(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "{") {
      // Brace expansion: {md,json} -> (md|json). Flat alternation only (no nesting).
      const close = pattern.indexOf("}", i);
      if (close === -1) {
        out += "\\{";
        continue;
      }
      const parts = pattern.slice(i + 1, close).split(",").map((p) =>
        p.replace(/[.+?^${}()|[\]\\]/g, (m) => `\\${m}`),
      );
      out += `(?:${parts.join("|")})`;
      i = close;
    } else if (/[.+?^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return `^${out}$`;
}

function compile(sourcePath: string): Cache {
  const text = readFileSync(sourcePath, "utf8");
  const stat = statSync(sourcePath);
  const sha = createHash("sha256").update(text).digest("hex");
  const doc = parseYaml(text) as PhaseGraph;
  const rawArtifacts = Array.isArray(doc?.artifacts) ? doc.artifacts : [];

  const compiled: CompiledArtifact[] = rawArtifacts.map((a) => {
    const writers: string[] = [];
    if (a.writer) writers.push(String(a.writer).trim());
    if (Array.isArray(a.writers)) {
      for (const w of a.writers) writers.push(String(w).trim());
    }
    const hasGlobChar = a.path.includes("*");
    const hasBracketPlaceholder = /\[[^\]]+\]/.test(a.path);
    const is_glob = hasGlobChar || hasBracketPlaceholder;
    const entry: CompiledArtifact = {
      path: a.path,
      writers: writers.filter(Boolean),
      is_glob,
    };
    if (is_glob) {
      const normalized = a.path.replace(/\[[^\]]+\]/g, "*");
      entry.regex = globToRegex(normalized);
    }
    return entry;
  });

  const scratchGlobs: CompiledScratchGlob[] = [];
  const scratchGlob = doc?.phase_internal_scratch?.path_glob;
  if (typeof scratchGlob === "string" && scratchGlob.trim()) {
    scratchGlobs.push({ glob: scratchGlob, regex: globToRegex(scratchGlob) });
  }

  return {
    version: CACHE_VERSION,
    source_sha: sha,
    source_mtime: Math.floor(stat.mtimeMs),
    compiled_at: new Date().toISOString(),
    artifacts: compiled,
    scratch_globs: scratchGlobs,
  };
}

function main(): number {
  const [sourceArg, outputArg] = process.argv.slice(2);
  if (!sourceArg || !outputArg) {
    process.stderr.write(
      "compile-writer-owner-cache: usage: <source-yaml> <output-json>\n",
    );
    return 1;
  }
  const source = resolve(sourceArg);
  const output = resolve(outputArg);
  let cache: Cache;
  try {
    cache = compile(source);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`compile-writer-owner-cache: ${msg}\n`);
    return 1;
  }
  try {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`compile-writer-owner-cache: write failed: ${msg}\n`);
    return 1;
  }
  return 0;
}

process.exit(main());
