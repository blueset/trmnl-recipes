import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, resolve } from 'node:path';
import { build } from 'vite';

const source = fileURLToPath(new URL('./', import.meta.url));
const destination = resolve(source, '../dist');
await mkdir(destination, { recursive: true });
await cp(source, destination, {
  recursive: true,
  filter: (path) => path !== resolve(source, 'holiday-editor') && basename(path) !== 'node_modules',
});
await build({ configFile: resolve(source, '../holiday-editor.vite.config.js') });
