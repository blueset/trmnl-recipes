#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Scanner } from "@tailwindcss/oxide";
import { compile } from "tailwindcss";
import plugin from "tailwindcss/plugin";

import { createUtilities } from "./trmnl-tailwind-config.mjs";

const pagesDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(pagesDirectory);
const sharedCssPath = join(pagesDirectory, "trmnl-shared.css");
const cdnModuleName = "trmnl-play-cdn.mjs";
const generatedStyleId = "tailwind-trmnl-generated";
const generatedStylePattern = new RegExp(
  `(<style\\b(?=[^>]*\\bid\\s*=\\s*["']${generatedStyleId}["'])[^>]*>)([\\s\\S]*?)(<\\/style\\s*>)`,
  "gi",
);

async function findLiquidFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") {
        files.push(...(await findLiquidFiles(path)));
      }
    } else if (entry.isFile() && entry.name.endsWith(".liquid")) {
      files.push(path);
    }
  }

  return files;
}

async function findTargetPlugins() {
  const entries = await readdir(repositoryRoot, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

    const liquidFiles = await findLiquidFiles(join(repositoryRoot, entry.name));
    if (liquidFiles.length === 0) continue;

    const contents = await Promise.all(
      liquidFiles.map((path) => readFile(path, "utf8")),
    );
    if (contents.some((content) => content.includes(cdnModuleName))) {
      plugins.push({ name: entry.name, liquidFiles });
    }
  }

  return plugins;
}

async function loadStylesheet(id, base) {
  const path = fileURLToPath(import.meta.resolve(id));
  return { path, base: dirname(path), content: await readFile(path, "utf8") };
}

async function loadModule(id, base) {
  if (id !== "trmnl-plugin") {
    throw new Error(`Unsupported Tailwind module: ${id}`);
  }

  return {
    path: "virtual:trmnl-plugin/index.js",
    base,
    module: plugin(({ addUtilities }) => addUtilities(createUtilities())),
  };
}

function removeGeneratedCss(content) {
  return content.replace(generatedStylePattern, "");
}

function insertGeneratedCss(content, css, path) {
  const lineEnding = content.includes("\r\n") ? "\r\n" : "\n";
  const formattedCss = css.trim().replaceAll("\n", lineEnding);
  let replacements = 0;

  const updated = content.replace(
    generatedStylePattern,
    (_, openingTag, _currentCss, closingTag) => {
      replacements += 1;
      return `${openingTag}${lineEnding}${formattedCss}${lineEnding}${closingTag}`;
    },
  );

  if (replacements > 1) {
    throw new Error(`Found multiple style#${generatedStyleId} elements in ${path}`);
  }
  if (replacements === 1) return updated;

  const separator = content.endsWith(lineEnding)
    ? lineEnding
    : `${lineEnding}${lineEnding}`;
  return (
    content +
    separator +
    `<style type="text/css" id="${generatedStyleId}">${lineEnding}` +
    formattedCss +
    `${lineEnding}</style>${lineEnding}`
  );
}

async function main() {
  const sharedCss = await readFile(sharedCssPath, "utf8");
  const plugins = await findTargetPlugins();
  let fileCount = 0;

  for (const { name, liquidFiles } of plugins) {
    for (const path of liquidFiles) {
      const content = await readFile(path, "utf8");
      const source = removeGeneratedCss(content);
      const scanner = new Scanner({ sources: [] });
      const candidates = scanner.scanFiles([
        { content: source, extension: "liquid" },
      ]);
      const compiler = await compile(sharedCss, {
        base: pagesDirectory,
        loadModule,
        loadStylesheet,
      });
      const css = compiler.build(candidates);
      const updated = insertGeneratedCss(content, css, path);
      if (updated !== content) await writeFile(path, updated, "utf8");
      fileCount += 1;
    }
    console.log(`${name}: ${liquidFiles.length} Liquid files`);
  }

  console.log(`Generated Tailwind CSS for ${fileCount} files in ${plugins.length} plugins.`);
}

await main();