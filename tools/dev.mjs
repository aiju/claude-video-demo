// Zero-dependency dev server with live reload.
//   node tools/dev.mjs [port]
// Serves the repo, and any page using kit/player.js reloads itself (keeping its
// playback position) whenever a .js/.html/.css file changes.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || process.env.PORT || 8080);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
const clients = new Set();

function listVideos() {
  const dir = path.join(root, 'videos');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'index.html'))) : [];
}

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__dev/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': hello\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(`<!doctype html><meta charset="utf-8"><title>videos</title><body style="background:#000;color:#cfe;font:16px ui-monospace,monospace;padding:32px">
      <h1>videos</h1>${listVideos().map((v) => `<p><a style="color:#19e6ff" href="/videos/${v}/">${v}</a></p>`).join('')}</body>`);
    return;
  }
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`dev server on http://localhost:${port}/`);
  for (const v of listVideos()) console.log(`  http://localhost:${port}/videos/${v}/`);
});

// Poll for changes (portable; recursive fs.watch is not available everywhere).
const WATCH = ['kit', 'videos'];
let stamp = new Map();
function scan() {
  const next = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|html|css|json)$/.test(e.name)) next.set(p, fs.statSync(p).mtimeMs);
    }
  };
  for (const w of WATCH) if (fs.existsSync(path.join(root, w))) walk(path.join(root, w));
  const changed = [...next].filter(([p, m]) => stamp.get(p) !== m).map(([p]) => path.relative(root, p));
  const first = stamp.size === 0;
  stamp = next;
  if (!first && changed.length) {
    console.log('changed:', changed.join(', '));
    for (const c of clients) c.write(`event: reload\ndata: ${changed[0]}\n\n`);
  }
}
scan();
setInterval(scan, 400);
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 15000);
