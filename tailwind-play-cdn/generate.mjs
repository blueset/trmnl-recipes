#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, "trmnl-shared.css");

const BEGIN = "/* BEGIN GENERATED UTILITIES */";
const END = "/* END GENERATED UTILITIES */";

// --- Utility definitions ---

/**
 * Each group defines:
 *   name     – the utility class prefix (e.g. "content" → `content-base`)
 *   varPrefix – the CSS variable prefix (e.g. "richtext" → `--richtext-font-family`)
 *   variants – the size variants to generate
 *
 * For "base" variant the var infix is empty (e.g. --richtext-font-family).
 * For others it is the variant name (e.g. --richtext-small-font-family).
 */
const utilityGroups = [
  {
    name: "content",
    varPrefix: "richtext",
    variants: ["small", "base", "large", "xlarge", "xxlarge", "xxxlarge"],
  },
  {
    name: "description",
    varPrefix: "description",
    variants: ["base", "large", "xlarge"],
  },
];

function utility(name, varPrefix, variant) {
  const infix = variant === "base" ? "" : `-${variant}`;
  return `\
@utility ${name}-${variant} {
  font-family: var(--${varPrefix}${infix}-font-family);
  font-size: var(--${varPrefix}${infix}-font-size);
  line-height: var(--${varPrefix}${infix}-line-height);
  font-weight: var(--font-weight-${name}-${variant});
  -webkit-font-smoothing: var(--${varPrefix}${infix}-font-smoothing);
}`;
}

// --- Generate ---

const generated = utilityGroups
  .map(({ name, varPrefix, variants }) =>
    variants.map((v) => utility(name, varPrefix, v)).join("\n"),
  )
  .join("\n\n");

// --- Replace in file ---

const css = readFileSync(cssPath, "utf-8");

const beginIdx = css.indexOf(BEGIN);
const endIdx = css.indexOf(END);

if (beginIdx === -1 || endIdx === -1) {
  console.error(
    `Could not find "${BEGIN}" and/or "${END}" markers in ${cssPath}`,
  );
  process.exit(1);
}

const before = css.slice(0, beginIdx + BEGIN.length);
const after = css.slice(endIdx);

const result = `${before}\n\n${generated}\n\n${after}`;

writeFileSync(cssPath, result, "utf-8");
console.log(`Updated ${cssPath}`);
