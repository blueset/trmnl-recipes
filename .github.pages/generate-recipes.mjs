#!/usr/bin/env node

import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pagesDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(pagesDirectory, "..");
const outputPath = resolve(process.argv[2] ?? join(pagesDirectory, "recipes.json"));
const rawBaseUrl =
  process.env.REPOSITORY_RAW_BASE_URL ??
  "https://raw.githubusercontent.com/blueset/trmnl-recipes/master/";

function findRecipeDirectories(directory) {
  const recipes = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.name === ".git" ||
      entry.name === "node_modules"
    ) {
      continue;
    }

    const child = join(directory, entry.name);
    if (existsSync(join(child, ".trmnlp.yml"))) {
      recipes.push(child);
    } else {
      recipes.push(...findRecipeDirectories(child));
    }
  }

  return recipes;
}

function requiredMatch(content, pattern, label, filePath) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${label} in ${relative(repositoryRoot, filePath)}`);
  }
  return match;
}

function parseYamlString(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readRecipeMetadata(recipeDirectory) {
  const slug = basename(recipeDirectory);
  const readmePath = join(recipeDirectory, "README.md");
  const settingsPath = join(recipeDirectory, "src", "settings.yml");
  const readme = readFileSync(readmePath, "utf8");
  const settings = readFileSync(settingsPath, "utf8");

  const [, iconPath, readmeName] = requiredMatch(
    readme,
    /^#\s+<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s+(.+?)\s*$/m,
    "recipe name and icon",
    readmePath,
  );
  const [, id] = requiredMatch(
    settings,
    /^id:\s*(\d+)\s*$/m,
    "numerical recipe ID",
    settingsPath,
  );
  const settingsNameMatch = settings.match(/^name:\s*(.+?)\s*$/m);
  const connectionBadge = requiredMatch(
    readme,
    /^!\[Connections\]\([^)]+\)\s*$/m,
    "connections badge",
    readmePath,
  );
  const description = readme
    .slice(connectionBadge.index + connectionBadge[0].length)
    .trimStart()
    .split(/\r?\n\s*\r?\n/, 1)[0]
    .trim();
  const [, localScreenshotPath] = requiredMatch(
    readme,
    /!\[Screenshot\]\(([^)]+)\)/,
    "main screenshot",
    readmePath,
  );

  if (!description) {
    throw new Error(`Could not find long description in ${relative(repositoryRoot, readmePath)}`);
  }

  return {
    id: Number(id),
    slug,
    name:
      readmeName.trim() ||
      (settingsNameMatch ? parseYamlString(settingsNameMatch[1]) : undefined),
    description,
    iconPath,
    localScreenshotPath,
  };
}

function rootScreenshotPaths() {
  const rootReadme = readFileSync(join(repositoryRoot, "README.md"), "utf8");
  const screenshots = new Map();
  const pattern = /!\[Screenshot\]\((\.\/([^/]+)\/[^)]+)\)/g;

  for (const match of rootReadme.matchAll(pattern)) {
    const [, screenshotPath, slug] = match;
    if (!screenshots.has(slug)) {
      screenshots.set(slug, screenshotPath);
    }
  }

  return screenshots;
}

function repositoryAssetUrl(slug, assetPath, pathIsFromRoot = false) {
  const repositoryPath = pathIsFromRoot
    ? assetPath.replace(/^\.\//, "")
    : posix.join(slug, assetPath.replace(/^\.\//, ""));
  const normalizedPath = posix.normalize(repositoryPath);

  if (normalizedPath.startsWith("../") || posix.isAbsolute(normalizedPath)) {
    throw new Error(`Asset path points outside the repository: ${assetPath}`);
  }

  return new URL(normalizedPath, rawBaseUrl).href;
}

const screenshots = rootScreenshotPaths();
const seenSlugs = new Set();
const recipes = findRecipeDirectories(repositoryRoot)
  .map(readRecipeMetadata)
  .map((recipe) => {
    if (seenSlugs.has(recipe.slug)) {
      throw new Error(`Duplicate recipe folder name: ${recipe.slug}`);
    }
    seenSlugs.add(recipe.slug);

    const rootScreenshotPath = screenshots.get(recipe.slug);
    return {
      id: recipe.id,
      slug: recipe.slug,
      name: recipe.name,
      description: recipe.description,
      screenshot_url: repositoryAssetUrl(
        recipe.slug,
        rootScreenshotPath ?? recipe.localScreenshotPath,
        Boolean(rootScreenshotPath),
      ),
      icon_url: repositoryAssetUrl(recipe.slug, recipe.iconPath),
    };
  })
  .sort((a, b) => a.id - b.id);

writeFileSync(outputPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
console.log(`Generated ${recipes.length} recipes at ${outputPath}`);
