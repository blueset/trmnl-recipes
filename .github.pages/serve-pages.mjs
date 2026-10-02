import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const port = Number(process.env.PORT || 4173);
createServer(async (request, response) => {
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/trmnl-recipes(?=\/)/, '');
    let file = resolve(root, '.' + path);
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    response.end(await readFile(file));
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') response.writeHead(404).end('Not found');
    else {
      console.error(error);
      response.writeHead(500).end('Could not serve this file');
    }
  }
}).listen(port, '127.0.0.1', () => console.log(`Pages preview: http://127.0.0.1:${port}`));
