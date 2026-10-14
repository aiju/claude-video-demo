// Render still frames at given times for quick visual checks.
// Usage: node tools/frames.mjs <outDir> <w> <h> t1 t2 ...
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [outDir = 'frames', w = '960', h = '540', ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`file://${root}/index.html?render&w=${w}&h=${h}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
for (const t of times) {
  const t0 = Date.now();
  const url = await page.evaluate((tt) => window.__frame(tt), parseFloat(t));
  const file = path.join(outDir, `f_${String(parseFloat(t).toFixed(2)).padStart(6, '0')}.jpg`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file, Date.now() - t0, 'ms');
}
await browser.close();
