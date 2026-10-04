import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
http.createServer(async (request, response) => {
  try {
    const name = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const resolved = path.resolve(root, name === '/' ? 'preview.html' : '.' + name);
    if (!resolved.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const data = await fs.readFile(resolved);
    response.writeHead(200, { 'Content-Type': types[path.extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(5197, '127.0.0.1', () => process.stdout.write('Preview ready at http://127.0.0.1:5197/\n'));
