// One-shot visual + audio check of a video page, made for quick review loops.
//   node tools/check.mjs videos/<name>/index.html [options]
// Renders frames headlessly into ONE contact sheet (default: 3 per chapter),
// flags frames that look broken (blown out, black, empty), reports console
// errors and per-chapter JS cost, and with --audio synthesizes the soundtrack
// and reports levels per chapter.
// Options: --out check.png  --w 480 --h 270  --n 24 (evenly spaced instead of per chapter)
//          --t 3.5,12.25 (extra times)  --only (just the --t times)  --cols 4
//          --audio  --frames <dir> (also save each frame)  --gpu
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const page_ = argv.find((a) => !a.startsWith('--') && /\.html?$/.test(a));
if (!page_) { console.error('usage: node tools/check.mjs videos/<name>/index.html [--audio] [--t 1,2] [--n 24]'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const W = +opt('w', 480), H = +opt('h', 270), COLS = +opt('cols', 4);
const OUT = path.resolve(opt('out', 'check.png'));
const extra = opt('t', '') === true ? [] : String(opt('t', '')).split(',').filter(Boolean).map(Number);
const t0 = Date.now();

const browser = await chromium.launch({ args: opt('gpu', false) ? ['--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.stack || e.message));
await page.goto(`file://${path.resolve(page_)}?render&w=${W}&h=${H}`);
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }); }
catch (e) { console.log('PAGE DID NOT BOOT\n' + errors.join('\n')); await browser.close(); process.exit(1); }

const info = await page.evaluate(() => ({ duration: window.__video.duration, sections: window.__video.sections.map((s) => ({ name: s.name, t0: s.t0, t1: s.t1 })) }));
let times;
if (opt('only', false)) times = extra;
else if (opt('n', false)) { const n = +opt('n'); times = Array.from({ length: n }, (_, i) => +(((i + 0.5) * info.duration) / n).toFixed(2)); }
else {
  times = [];
  for (const s of info.sections) {
    const len = s.t1 - s.t0;
    // mid point nudged off the bar line, where impacts usually sit
    times.push(+(s.t0 + Math.min(0.35, len / 4)).toFixed(2), +(s.t0 + len / 2 + 0.15).toFixed(2), +(s.t1 - Math.min(0.35, len / 4)).toFixed(2));
  }
}
times = [...new Set(times.concat(opt('only', false) ? [] : extra))].sort((a, b) => a - b);

const result = await page.evaluate(({ times, W, H, COLS, saveFrames }) => {
  const R = window.__renderer;
  const rows = Math.ceil(times.length / COLS), pad = 4, labelH = 18;
  const sheet = document.createElement('canvas');
  sheet.width = COLS * (W + pad) + pad; sheet.height = rows * (H + labelH + pad) + pad;
  const c = sheet.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#111'; c.fillRect(0, 0, sheet.width, sheet.height);
  const probe = document.createElement('canvas'); probe.width = 64; probe.height = 36;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  const out = [], frames = [];
  const secOf = (t) => { const S = window.__video.sections; let i = 0; for (let k = 0; k < S.length; k++) if (t >= S[k].t0) i = k; return S[i].name; };
  const stats = () => {
    pc.drawImage(R.canvas, 0, 0, 64, 36);
    const d = pc.getImageData(0, 0, 64, 36).data;
    let sum = 0, sum2 = 0, hi = 0, n = 64 * 36;
    for (let k = 0; k < d.length; k += 4) { const l = (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]) / 255; sum += l; sum2 += l * l; if (l > 0.92) hi++; }
    const mean = sum / n, std = Math.sqrt(Math.max(0, sum2 / n - mean * mean)), white = hi / n;
    const flags = [];
    if (mean > 0.55 || white > 0.35) flags.push('blown out');
    else if (mean > 0.4) flags.push('very bright');
    if (mean < 0.012) flags.push('black');
    else if (std < 0.025) flags.push('flat/empty');
    return { mean, std, white, flags };
  };
  times.forEach((t, i) => {
    directFrame(R, t); // warm-up (one-time setup, lazy glyphs) so the timing below is steady-state
    const a = performance.now(); directFrame(R, t); const js = performance.now() - a;
    R.render(t);
    const x = pad + (i % COLS) * (W + pad), y = pad + Math.floor(i / COLS) * (H + labelH + pad);
    c.drawImage(R.canvas, x, y + labelH, W, H);
    if (saveFrames) frames.push(R.canvas.toDataURL('image/jpeg', 0.92));
    const s = stats();
    let transient = false;
    if (s.flags.length && !s.flags.includes('black')) {
      // A hit on the beat is fine if it clears quickly.
      directFrame(R, t + 0.2); R.render(t + 0.2);
      if (!stats().flags.length) transient = true;
    }
    out.push({ t, section: secOf(t), mean: +s.mean.toFixed(3), std: +s.std.toFixed(3), white: +s.white.toFixed(3), js: +js.toFixed(1), flags: s.flags, transient });
    const col = !s.flags.length ? '#9fb3c8' : transient ? '#ffb21e' : '#ff3b5c';
    c.fillStyle = col; c.font = '12px monospace';
    c.fillText(`${t.toFixed(2)}s ${secOf(t)}${s.flags.length ? '  ⚠ ' + s.flags.join(', ') + (transient ? ' (clears in 0.2 s)' : '') : ''}`, x + 2, y + 13);
    if (s.flags.length) { c.strokeStyle = col; c.lineWidth = 3; c.strokeRect(x + 1.5, y + labelH + 1.5, W - 3, H - 3); }
  });
  return { frames: out, sheet: sheet.toDataURL('image/png'), images: frames };
}, { times, W, H, COLS, saveFrames: !!opt('frames', false) });

fs.writeFileSync(OUT, Buffer.from(result.sheet.split(',')[1], 'base64'));
if (opt('frames', false)) {
  const dir = path.resolve(String(opt('frames'))); fs.mkdirSync(dir, { recursive: true });
  result.images.forEach((u, i) => fs.writeFileSync(path.join(dir, `f_${String(times[i].toFixed(2)).padStart(6, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')));
}

console.log(`contact sheet: ${OUT} (${times.length} frames)`);
const flagged = result.frames.filter((f) => f.flags.length && !f.transient);
const flashes = result.frames.filter((f) => f.transient);
console.log(flagged.length ? 'FLAGGED (look at these):\n' + flagged.map((f) => `  ${f.t}s [${f.section}] ${f.flags.join(', ')} (mean ${f.mean}, white ${f.white}, std ${f.std})`).join('\n') : 'no frames flagged');
if (flashes.length) console.log('flagged but recovers within 0.2 s (a beat flash or an entrance, usually fine): ' + flashes.map((f) => `${f.t}s`).join(', '));
const perSec = {};
for (const f of result.frames) perSec[f.section] = Math.max(perSec[f.section] || 0, f.js);
console.log('max JS ms per frame by chapter: ' + Object.entries(perSec).map(([k, v]) => `${k} ${v}`).join(' · ') + '  (keep < 8 ms)');

if (opt('audio', false)) {
  const a = await page.evaluate(async () => {
    const V = window.__video, t = performance.now();
    const ab = await renderSoundtrack(V.score);
    const ms = performance.now() - t;
    const L = ab.getChannelData(0), Rr = ab.getChannelData(1), sr = ab.sampleRate;
    const db = (x) => (20 * Math.log10(x + 1e-9)).toFixed(1);
    let clip = 0, peak = 0;
    for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (v > peak) peak = v; if (v > 0.999) clip++; }
    const secs = V.sections.map((s) => {
      let pk = 0, ss = 0; const i0 = Math.floor(s.t0 * sr), i1 = Math.min(L.length, Math.floor(s.t1 * sr));
      for (let i = i0; i < i1; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (v > pk) pk = v; ss += L[i] * L[i]; }
      return `${s.name}: peak ${db(pk)} dB, rms ${db(Math.sqrt(ss / Math.max(1, i1 - i0)))} dB`;
    });
    return { ms, peak: db(peak), clip, secs };
  });
  console.log(`audio: synth ${(a.ms / 1000).toFixed(1)} s, peak ${a.peak} dBFS, clipped samples ${a.clip}`);
  console.log('  ' + a.secs.join('\n  '));
}
console.log(errors.length ? `ERRORS (${errors.length}):\n  ` + errors.slice(0, 10).join('\n  ') : 'no console errors');
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
process.exit(errors.length ? 1 : 0);
