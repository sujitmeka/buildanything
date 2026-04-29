#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import process from "node:process";
import { extractProductSpec, extractDesignMd, extractComponentManifest, saveGraph } from "../src/graph/index.js";

const mdPath = process.argv[2];
if (!mdPath || !(() => { try { readFileSync(mdPath); return true; } catch { return false; } })()) {
  process.stderr.write("Usage: graph-index <path>\n  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md\n");
  process.exit(64);
}

try {
  const absPath = resolve(mdPath);
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
  } else {
    process.stderr.write(
      `Usage: graph-index <path>\n  Recognized basenames: product-spec.md, DESIGN.md, component-manifest.md\n  Got: ${base}\n`,
    );
    process.exit(64);
  }

  if (result.ok) {
    const fragment = result.fragment!;
    saveGraph(process.cwd(), fragment, targetFile);
    process.stdout.write(
      `[graph-index] ok — ${fragment.nodes.length} nodes, ${fragment.edges.length} edges → .buildanything/graph/${targetFile}\n`,
    );
    process.exit(0);
  } else {
    for (const err of result.errors) {
      process.stderr.write(`[graph-index] L${err.line}: ${err.message}\n`);
    }
    process.exit(1);
  }
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`[graph-index] fatal: ${msg}\n`);
  process.exit(2);
}
