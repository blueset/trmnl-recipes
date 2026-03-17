import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, '.tmp', 'icon-metadata.json');
const readmePatchPath = path.join(rootDir, '.tmp', 'readme-icon.patch');
const defaultHeaders = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0',
};
const mimeToExt = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
  ['image/x-icon', 'ico'],
  ['image/vnd.microsoft.icon', 'ico'],
]);

async function findSettingsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === '.tmp') {
          return [];
        }
        return findSettingsFiles(fullPath);
      }

      if (entry.isFile() && entry.name === 'settings.yml' && fullPath.endsWith(`${path.sep}src${path.sep}settings.yml`)) {
        return [fullPath];
      }

      return [];
    }),
  );

  return files.flat();
}

function getExtension(contentType) {
  const mappedExtension = mimeToExt.get(contentType);
  if (mappedExtension) {
    return mappedExtension;
  }

  const match = /^image\/(.+)$/.exec(contentType);
  if (!match) {
    throw new Error(`Unsupported MIME type: ${contentType}`);
  }

  return match[1].toLowerCase();
}

function escapeForPatch(value) {
  return value.replace(/\\/g, '\\\\');
}

function buildRootReadmePatch(rootReadmeContent, results) {
  const tocEntries = [...rootReadmeContent.matchAll(/^\* \[(.+?)\]\(#(.+?)\)$/gm)];
  const sectionHeadings = [...rootReadmeContent.matchAll(/^## (.+)$/gm)].filter((match) => match[1] !== 'Table of Contents');
  const anchorByTitle = new Map();

  for (let index = 0; index < Math.min(tocEntries.length, sectionHeadings.length); index += 1) {
    anchorByTitle.set(sectionHeadings[index][1], tocEntries[index][2]);
  }

  return results
    .map((result) => {
      const title = result.title;
      const anchor = anchorByTitle.get(title);

      if (!anchor) {
        throw new Error(`Missing root README anchor for ${title}`);
      }

      return [
        '*** Update File: c:\\Users\\ilove\\Codebase\\trmnl-recipies\\README.md',
        `-## ${escapeForPatch(title)}`,
        `+<a id="${escapeForPatch(anchor)}"></a>`,
        `+## ![Icon](./${escapeForPatch(result.iconPath)}) ${escapeForPatch(title)}`,
      ].join('\n');
    })
    .join('\n');
}

async function buildReadmePatch(results) {
  const patchParts = [];

  for (const result of results) {
    const recipeReadmePath = path.join(rootDir, result.recipe, 'README.md');
    patchParts.push([
      `*** Update File: ${recipeReadmePath}`,
      `-# ${escapeForPatch(result.title)}`,
      `+# ![Icon](./images/${escapeForPatch(result.iconFileName)}) ${escapeForPatch(result.title)}`,
    ].join('\n'));
  }

  const rootReadmePath = path.join(rootDir, 'README.md');
  const rootReadmeContent = await readFile(rootReadmePath, 'utf8');
  patchParts.push(buildRootReadmePatch(rootReadmeContent, results));

  return ['*** Begin Patch', ...patchParts, '*** End Patch', ''].join('\n');
}

async function main() {
  const settingsFiles = (await findSettingsFiles(rootDir)).sort();
  const results = [];
  const skipped = [];

  for (const settingsPath of settingsFiles) {
    const recipeDir = path.dirname(path.dirname(settingsPath));
    const recipeName = path.basename(recipeDir);
    const settingsContent = await readFile(settingsPath, 'utf8');
    const idMatch = /^id:\s*(.+)$/m.exec(settingsContent);

    if (!idMatch) {
      throw new Error(`Missing id in ${settingsPath}`);
    }

    const id = idMatch[1].trim();
    const readmePath = path.join(recipeDir, 'README.md');
    const readmeContent = await readFile(readmePath, 'utf8');
    const title = readmeContent.split(/\r?\n/, 1)[0].replace(/^#\s*/, '');
    const response = await fetch(`https://trmnl.com/recipes/${id}.json`, {
      headers: defaultHeaders,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch recipe metadata for ${recipeName} (${id}): ${response.status}`);
    }

    const json = await response.json();
    const iconUrl = json.data?.icon_url;
    const contentType = json.data?.icon_content_type;

    if (!iconUrl || !contentType) {
      skipped.push({
        recipe: recipeName,
        id,
        reason: 'Missing icon metadata',
      });
      continue;
    }

    const extension = getExtension(contentType);
    const iconResponse = await fetch(iconUrl, {
      headers: {
        'User-Agent': defaultHeaders['User-Agent'],
      },
    });

    if (!iconResponse.ok) {
      throw new Error(`Failed to download icon for ${recipeName} (${id}): ${iconResponse.status}`);
    }

    const iconBuffer = Buffer.from(await iconResponse.arrayBuffer());
    const imagesDir = path.join(recipeDir, 'images');
    const iconFileName = `icon.${extension}`;
    const iconPath = path.join(imagesDir, iconFileName);

    await mkdir(imagesDir, { recursive: true });
    await writeFile(iconPath, iconBuffer);

    results.push({
      recipe: recipeName,
      id,
      title,
      contentType,
      iconUrl,
      iconPath: path.relative(rootDir, iconPath).split(path.sep).join('/'),
      iconFileName,
    });
  }

  const manifest = { results, skipped };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const readmePatch = await buildReadmePatch(results);
  await writeFile(readmePatchPath, readmePatch);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});