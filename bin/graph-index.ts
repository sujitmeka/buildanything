#!/usr/bin/env tsx

import { readFileSync, statSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { basename, resolve, join, relative, extname } from "node:path";
import { createHash } from "node:crypto";
import process from "node:process";
import { extractProductSpec, extractDesignMd, extractDesignMdTokens, extractComponentManifest, extractPageSpec, extractArchitecture, extractSprintTasks, extractBackendTasks, extractDecisionsJsonl, extractScreenshot, saveGraph } from "../src/graph/index.js";
import type { GraphFragment } from "../src/graph/types.js";

type ImageClass = "reference" | "brand_drift" | "dogfood";

const VALID_IMAGE_CLASSES: ReadonlySet<string> = new Set(["reference", "brand_drift", "dogfood"]);
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function parseArgs(argv: string[]): { positional: string[]; imageClass: string | undefined } {
  const positional: string[] = [];
  let imageClass: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--image-class=")) {
      imageClass = arg.slice("--image-class=".length);
    } else if (arg === "--image-class") {
      // peek-ahead style not supported; require =VALUE form
      process.stderr.write("[graph-index] error: --image-class requires =VALUE form (e.g. --image-class=reference)\n");
      process.exit(64);
    } else {
      positional.push(arg);
    }
  }
  return { positional, imageClass };
}

function inferImageClassFromPath(absPath: string): ImageClass | null {
  // Normalize trailing slash + lower-case scan against known suffixes.
  const normalized = absPath.replace(/\/+$/, "");
  if (normalized.endsWith("/design-references") || normalized.includes("/design-references/")) {
    return "reference";
  }
  if (normalized.endsWith("/evidence/brand-drift") || normalized.includes("/evidence/brand-drift/")) {
    return "brand_drift";
  }
  if (normalized.endsWith("/evidence/dogfood") || normalized.includes("/evidence/dogfood/")) {
    return "dogfood";
  }
  return null;
}

function targetFileForClass(c: ImageClass): string {
  switch (c) {
    case "reference": return "slice-5-references.json";
    case "brand_drift": return "slice-5-brand-drift.json";
    case "dogfood": return "slice-5-dogfood.json";
  }
}

function collectImageFiles(dir: string): string[] {
  const files: string[] = [];
  // Recurse one level — competitors/, inspiration/, screenshots/ subdirs are common.
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      try {
        for (const sub of readdirSync(full, { withFileTypes: true })) {
          if (sub.isFile() && IMAGE_EXTENSIONS.has(extname(sub.name).toLowerCase())) {
            files.push(join(full, sub.name));
          }
        }
      } catch { /* unreadable subdir */ }
    } else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files.sort();
}

function indexImageDirectory(absPath: string, imageClass: ImageClass): void {
  // TODO Slice 5 production: when imageClass === 'dogfood', read evidence/dogfood/findings.json side-channel to populate linked_finding_id per screenshot.
  const imageFiles = collectImageFiles(absPath);

  if (imageFiles.length === 0) {
    // Per Slice 5 schema §11 scenario 1: empty directory writes empty fragment, does NOT fail.
    process.stdout.write(`[graph-index] info — no images in ${absPath}, writing empty fragment\n`);
  }

  const allNodes: GraphFragment["nodes"] = [];
  const allEdges: GraphFragment["edges"] = [];
  const hashChunks: Buffer[] = [];
  const warnings: string[] = [];
  let successCount = 0;

  for (const filePath of imageFiles) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(filePath);
    } catch (err) {
      const msg = `failed to read ${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      process.stderr.write(`[graph-index] warning: ${msg}\n`);
      warnings.push(msg);
      continue;
    }
    hashChunks.push(bytes);

    try {
      const result = extractScreenshot({
        imagePath: relative(process.cwd(), filePath),
        imageClass,
        imageBytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      });

      if (!result.ok) {
        const msg = `${filePath}: ${result.errors.map((e) => e.message).join("; ")}`;
        warnings.push(msg);
        continue;
      }
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
      successCount++;
    } catch (err) {
      const msg = `${filePath}: ${err instanceof Error ? err.message : String(err)}`;
      warnings.push(msg);
      continue;
    }
  }

  if (imageFiles.length > 0 && successCount === 0) {
    for (const w of warnings) {
      process.stderr.write(`[graph-index] warning: ${w}\n`);
    }
    process.exit(1);
  }

  const combined = Buffer.concat(hashChunks);
  const combinedHash = combined.length > 0
    ? createHash("sha256").update(combined).digest("hex")
    : "0".repeat(64);

  const relDir = relative(process.cwd(), absPath) + "/";

  const fragment: GraphFragment = {
    source_file: relDir,
    source_sha: combinedHash,
    produced_at: new Date().toISOString(),
    version: 1,
    schema: "buildanything-slice-5",
    nodes: allNodes,
    edges: allEdges,
  };

  const targetFile = targetFileForClass(imageClass);
  saveGraph(process.cwd(), fragment, targetFile);
  process.stdout.write(
    `[graph-index] ok — ${fragment.nodes.length} nodes, ${fragment.edges.length} edges → .buildanything/graph/${targetFile}\n`,
  );

  if (imageFiles.length > 0) {
    for (const w of warnings) {
      process.stdout.write(`[graph-index] warning: ${w}\n`);
    }
    process.stdout.write(`[graph-index] indexed ${successCount}/${imageFiles.length} images; ${warnings.length} warnings\n`);
  }
}

const { positional, imageClass: explicitImageClass } = parseArgs(process.argv.slice(2));
const target = positional[0];

if (!target) {
  process.stderr.write(
    "Usage: graph-index <path> [--image-class=reference|brand_drift|dogfood]\n" +
    "  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md (legacy), backend-tasks.md, decisions.jsonl\n" +
    "  Directory mode: page-specs/ → indexes all *.md files inside\n" +
    "  Image directory mode: design-references/ | evidence/brand-drift/ | evidence/dogfood/ → indexes all images\n" +
    "  DESIGN.md produces both slice-2-dna.json (Pass 1) and slice-3-tokens.json (Pass 2, if tokens found)\n",
  );
  process.exit(64);
}

if (explicitImageClass !== undefined && !VALID_IMAGE_CLASSES.has(explicitImageClass)) {
  process.stderr.write(`[graph-index] error: --image-class must be one of: reference, brand_drift, dogfood (got: ${explicitImageClass})\n`);
  process.exit(64);
}

try {
  const absPath = resolve(target);

  // ── Directory mode ──────────────────────────────────────────────────
  let isDir = false;
  try { isDir = statSync(absPath).isDirectory(); } catch { /* not a dir */ }

  if (isDir) {
    // page-specs/ — Slice 3 markdown directory mode
    if (basename(absPath) === "page-specs") {
      const mdFiles = readdirSync(absPath)
        .filter((f) => f.endsWith(".md"))
        .sort();

      if (mdFiles.length === 0) {
        process.stderr.write(`[graph-index] error: no .md files found in directory: ${absPath}\n`);
        process.exit(1);
      }

      const allNodes: GraphFragment["nodes"] = [];
      const allEdges: GraphFragment["edges"] = [];
      const contents: string[] = [];

      for (const file of mdFiles) {
        const filePath = join(absPath, file);
        const content = readFileSync(filePath, "utf-8");
        contents.push(content);
        const result = extractPageSpec({ mdPath: filePath, mdContent: content });
        if (!result.ok) {
          for (const err of result.errors) {
            process.stderr.write(`[graph-index] ${file} L${err.line}: ${err.message}\n`);
          }
          process.stderr.write(`[graph-index] fatal: page-spec parse failed for ${file}\n`);
          process.exit(1);
        }
        allNodes.push(...result.fragment!.nodes);
        allEdges.push(...result.fragment!.edges);
      }

      const combinedHash = createHash("sha256").update(contents.join("")).digest("hex");
      const relDir = relative(process.cwd(), absPath) + "/";

      const fragment: GraphFragment = {
        source_file: relDir,
        source_sha: combinedHash,
        produced_at: new Date().toISOString(),
        version: 1,
        schema: "buildanything-slice-3",
        nodes: allNodes,
        edges: allEdges,
      };

      saveGraph(process.cwd(), fragment, "slice-3-pages.json");
      process.stdout.write(
        `[graph-index] ok — ${fragment.nodes.length} nodes, ${fragment.edges.length} edges → .buildanything/graph/slice-3-pages.json\n`,
      );
      process.exit(0);
    }

    // Slice 5 image-directory mode — explicit override OR path inference
    const inferred = inferImageClassFromPath(absPath);
    const resolvedClass = (explicitImageClass ?? inferred) as ImageClass | null;

    if (resolvedClass !== null) {
      indexImageDirectory(absPath, resolvedClass);
      process.exit(0);
    }

    process.stderr.write(
      `[graph-index] error: directory ${absPath} is not a recognized indexer target.\n` +
      `  Markdown directory: page-specs/\n` +
      `  Image directories (auto-detected): design-references/, evidence/brand-drift/, evidence/dogfood/\n` +
      `  Or pass --image-class=reference|brand_drift|dogfood to force.\n`,
    );
    process.exit(64);
  }

  // ── File mode ───────────────────────────────────────────────────────
  if (!(() => { try { readFileSync(absPath); return true; } catch { return false; } })()) {
    process.stderr.write(
      "Usage: graph-index <path>\n" +
      "  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md (legacy), backend-tasks.md, decisions.jsonl\n" +
      "  Directory mode: pass a page-specs/ directory to index all *.md files inside\n",
    );
    process.exit(64);
  }

  const mdContent = readFileSync(absPath, "utf-8");
  const base = basename(absPath);

  let result;
  let targetFile: string;
  if (base === "product-spec.md") {
    result = extractProductSpec({ mdPath: absPath, mdContent });
    targetFile = "slice-1.json";
  } else if (base === "DESIGN.md") {
    result = extractDesignMd({ mdPath: absPath, mdContent });
    targetFile = "slice-2-dna.json";
  } else if (base === "component-manifest.md") {
    result = extractComponentManifest({ mdPath: absPath, mdContent });
    targetFile = "slice-2-manifest.json";
  } else if (base === "architecture.md") {
    result = extractArchitecture({ mdPath: absPath, mdContent });
    targetFile = "slice-4-architecture.json";
  } else if (base === "sprint-tasks.md") {
    result = extractSprintTasks({ mdPath: absPath, mdContent });
    targetFile = "slice-4-tasks.json";
  } else if (base === "backend-tasks.md") {
    result = extractBackendTasks({ mdPath: absPath, mdContent });
    targetFile = "slice-4-backend-tasks.json";
  } else if (base === "decisions.jsonl") {
    result = extractDecisionsJsonl({ mdPath: absPath, mdContent });
    targetFile = "slice-4-decisions.json";
  } else {
    process.stderr.write(
      `Usage: graph-index <path>\n  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md, architecture.md, sprint-tasks.md (legacy), backend-tasks.md, decisions.jsonl\n  Directory mode: pass a page-specs/ directory to index all *.md files inside\n  Got: ${base}\n`,
    );
    process.exit(64);
  }

  if (result.ok) {
    const fragment = result.fragment!;
    saveGraph(process.cwd(), fragment, targetFile);
    process.stdout.write(
      `[graph-index] ok — ${fragment.nodes.length} nodes, ${fragment.edges.length} edges → .buildanything/graph/${targetFile}\n`,
    );
  } else {
    for (const err of result.errors) {
      process.stderr.write(`[graph-index] L${err.line}: ${err.message}\n`);
    }
    process.exit(1);
  }

  // ── DESIGN.md Pass 2: tokens ────────────────────────────────────────
  if (base === "DESIGN.md") {
    const pass2 = extractDesignMdTokens({ mdPath: absPath, mdContent });
    if (pass2.ok && pass2.fragment!.nodes.length > 0) {
      saveGraph(process.cwd(), pass2.fragment!, "slice-3-tokens.json");
      process.stdout.write(
        `[graph-index] ok — ${pass2.fragment!.nodes.length} nodes, ${pass2.fragment!.edges.length} edges → .buildanything/graph/slice-3-tokens.json\n`,
      );
    } else if (!pass2.ok) {
      for (const err of pass2.errors) {
        process.stderr.write(`[graph-index] warning (Pass 2): L${err.line}: ${err.message}\n`);
      }
    }

    if ((pass2.ok && pass2.fragment!.nodes.length === 0) || !pass2.ok) {
      const stalePath = join(process.cwd(), ".buildanything", "graph", "slice-3-tokens.json");
      try {
        if (existsSync(stalePath)) {
          unlinkSync(stalePath);
          process.stdout.write("[graph-index] Pass 2 empty — removed stale slice-3-tokens.json\n");
        }
      } catch { /* best-effort */ }
    }
  }
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`[graph-index] fatal: ${msg}\n`);
  process.exit(2);
}
