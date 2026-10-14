// Offline, frame-exact render of the animation + soundtrack to an MP4.
// Requires Node 18+, `npm install` (Playwright) and ffmpeg on PATH.
//
//   node tools/render-video.mjs --w 1920 --h 1080 --fps 60 --out next-token.mp4
//
// Options: --w --h --fps --out --start --end --workers --crf (default 20; the film
// grain makes low CRFs very large) --gpu (use the real GPU
// instead of SwiftShader; much faster where available).
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => {
  const [k, ...v] = s.trim().split(/\s+/);
  return [k, v.length ? v.join(' ') : true];
}));
const W = +(args.w || 1920), H = +(args.h || 1080), FPS = +(args.fps || 60);
const START = +(args.start || 0), END = +(args.end || 60);
const OUT = path.resolve(args.out || 'next-token.mp4');
const WORKERS = +(args.workers || 2), CRF = +(args.crf || 20);
const launchArgs = args.gpu ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'next-token-'));
const frames = [];
for (let f = Math.round(START * FPS); f < Math.round(END * FPS); f++) frames.push(f);
console.log(`Rendering ${frames.length} frames at ${W}x${H}@${FPS} with ${WORKERS} worker(s) → ${OUT}`);

const browser = await chromium.launch({ args: launchArgs });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`file://${root}/index.html?render&w=${W}&h=${H}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  return page;
}

// Soundtrack first (same synthesis as the live page).
const audioPage = await openPage();
const wavB64 = await audioPage.evaluate(() => window.__audioWav());
const wavPath = path.join(tmp, 'audio.wav');
fs.writeFileSync(wavPath, Buffer.from(wavB64, 'base64'));
await audioPage.close();
console.log('soundtrack rendered');

const t0 = Date.now();
let done = 0;
async function worker(idx) {
  const page = await openPage();
  for (let i = idx; i < frames.length; i += WORKERS) {
    const f = frames[i];
    const url = await page.evaluate((t) => window.__frame(t, 'image/jpeg', 0.95), f / FPS);
    fs.writeFileSync(path.join(tmp, `f${String(f).padStart(6, '0')}.jpg`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
    if (++done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${frames.length} frames · ${(done / el).toFixed(1)} fps · eta ${Math.round((frames.length - done) / (done / el))}s`);
    }
  }
  await page.close();
}
await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)));
await browser.close();

const first = String(frames[0]).padStart(6, '0');
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', first, '-i', path.join(tmp, 'f%06d.jpg'),
  '-ss', String(START), '-t', String(END - START), '-i', wavPath,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '256k', '-shortest', OUT,
], { stdio: 'inherit' });
ff.on('close', (code) => {
  if (code === 0) { fs.rmSync(tmp, { recursive: true, force: true }); console.log(`wrote ${OUT}`); }
  else console.error(`ffmpeg failed (${code}); frames kept in ${tmp}`);
  process.exit(code);
});
