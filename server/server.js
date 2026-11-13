import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { GameServer } from './GameServer.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
// URL prefix -> directory. Three.js is served from node_modules so the demo runs offline.
const MOUNTS = [
  ['/vendor/three/', path.join(ROOT, 'node_modules/three/build/')],
  ['/shared/', path.join(ROOT, 'shared/')],
  ['/', path.join(ROOT, 'client/')],
];

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (url.endsWith('/')) url += 'index.html';
  for (const [prefix, dir] of MOUNTS) {
    if (!url.startsWith(prefix)) continue;
    const file = path.join(dir, url.slice(prefix.length));
    if (!file.startsWith(dir)) { res.writeHead(403); return res.end(); }
    return fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }
  res.writeHead(404); res.end();
});

const io = new Server(server, { pingInterval: 5000, pingTimeout: 8000 });
new GameServer(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ASHFALL server running -> http://localhost:${PORT}`));
