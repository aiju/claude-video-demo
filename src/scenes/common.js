'use strict';
// Shared palette, helpers and reusable effects for all scenes.

const COL = {
  cyan: hex('#19e6ff'), magenta: hex('#ff2d95'), violet: hex('#8b5cff'), amber: hex('#ffb21e'),
  mint: hex('#3dffb5'), blue: hex('#3b7bff'), coral: hex('#ff6a4d'), white: [1, 1, 1],
  ink: hex('#07040f'), dim: hex('#2a2440'),
};
const TOKEN_COLS = [COL.cyan, COL.violet, COL.magenta, COL.amber, COL.mint];
const HEAD_COLS = [COL.cyan, COL.magenta, COL.amber, COL.violet, COL.mint, COL.blue, COL.coral, hex('#ff8af0')];
const GEN_COL = hex('#ffcf5a');

const tokenLabel = (text) => (text.startsWith(' ') ? '·' + text.slice(1) : text);
// Dim the leading-space marker of a token label.
const spaceDotFx = (text, extra) => (i, ch, s, n) => {
  if (i === 0 && text.startsWith(' ')) s.alpha = 0.35;
  if (extra) extra(i, ch, s, n);
};

// Diverging colour map for vector components in [-1, 1].
function valueColor(v) {
  const base = [0.02, 0.01, 0.05];
  if (v < 0) return cmix(base, COL.cyan, Math.min(1, -v * 1.2));
  if (v < 0.6) return cmix(base, COL.magenta, v / 0.6);
  return cmix(COL.magenta, COL.amber, Math.min(1, (v - 0.6) / 0.4));
}

// Token "chip": dark rounded panel, glowing outline and neon label.
// Returns the chip's half-width in world units.
function chipHalfWidth(R, text, size) { return (R.measure(tokenLabel(text), 'mono') * size) / 2 + size * 0.42; }
function drawChip(R, text, p, size, col, a = 1, o = {}) {
  if (a <= 0.001) return chipHalfWidth(R, text, size);
  const label = tokenLabel(text);
  const hw = chipHalfWidth(R, text, size), hh = size * 0.62;
  const S = hh / 0.78, stretch = hw / S + 0.22;
  const prev = R.cur;
  R.use(o.panelLayer || 'over');
  R.sprite(p, S, COL.ink, 0.88 * a * (o.fill ?? 1), 6, 0, stretch);
  R.use(o.lineLayer || 'top');
  R.sprite(p, S, col, (o.outline ?? 1.2) * a, 5, 0, stretch);
  R.text(label, p, size, o.textCol || cmix(col, COL.white, 0.35), { alpha: a, glow: o.glow ?? 0.5, fx: spaceDotFx(text, o.fx), hot: 0.3 });
  R.cur = prev;
  return hw;
}
// Lay out chips centred on x=0 with a gap; returns centre x for each.
function chipRow(R, texts, size, gap) {
  const hws = texts.map((t) => chipHalfWidth(R, t, size));
  const total = hws.reduce((s, w) => s + 2 * w, 0) + gap * (texts.length - 1);
  let x = -total / 2;
  return hws.map((w) => { const c = x + w; x += 2 * w + gap; return c; });
}

// Per-character decode: random glyphs settle into the real text.
function decodeFx(t, t0, dur = 0.25, stagger = 0.03, seed = 0) {
  return (i, ch, s) => {
    const local = t - (t0 + i * stagger);
    if (local < 0) { s.alpha = 0; return; }
    if (local < dur && ch !== ' ') {
      s.ch = SCRAMBLE_CHARS[Math.floor(hash3(i, Math.floor(t * 30), seed) * SCRAMBLE_CHARS.length)];
      s.alpha = 0.75;
    }
  };
}

// Deterministic spark burst.
function burst(R, c, t, t0, o = {}) {
  const local = t - t0, life = o.life ?? 0.9;
  if (local < 0 || local > life) return;
  const n = o.n ?? 40, speed = o.speed ?? 5, drag = o.drag ?? 3.5, seed = o.seed ?? 1;
  const fade = (1 - local / life) ** 2;
  const k = (1 - Math.exp(-drag * local)) / drag, v = Math.exp(-drag * local);
  for (let i = 0; i < n; i++) {
    const h1 = hash2(i, seed), h2 = hash2(i, seed + 99), h3 = hash2(i, seed + 7);
    const th = h1 * TAU, ph = o.flat ? Math.PI / 2 : Math.acos(2 * h2 - 1);
    const dir = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
    const sp = speed * (0.25 + 0.75 * h3);
    const p = vadd(c, vscale(dir, sp * k));
    const col = o.colors ? o.colors[i % o.colors.length] : o.color || COL.white;
    R.line(vsub(p, vscale(dir, sp * 0.05 * v + 0.02)), p, col, col, (o.width ?? 0.025), 0, fade * 1.5);
    R.sprite(p, (o.size ?? 0.07) * (0.5 + h3), col, fade * 1.4, 0);
  }
}

function shockwave(R, c, t, t0, o = {}) {
  const local = t - t0, life = o.life ?? 0.7;
  if (local < 0 || local > life) return;
  const u = local / life;
  R.sprite(c, (o.size ?? 8) * ease.outExpo(u), o.color || COL.white, (1 - u) ** 2 * (o.alpha ?? 1.2), 1);
}

// Quadratic arc between a and b, bulging by `height` in a plane rotated about the x axis.
function arcPoints(a, b, height, angle, n = 24) {
  const mid = vlerp(a, b, 0.5);
  const ctrl = vadd(mid, rotX([0, height, 0], angle));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(bezier3(a, ctrl, b, i / n));
  return pts;
}
// Draw a partial arc (0..1 of its length), with alpha fading along it.
function drawArc(R, pts, col, width, a, reveal = 1, a0 = 0.25) {
  const n = pts.length - 1, m = Math.max(0, Math.min(n, reveal * n));
  for (let i = 0; i < Math.ceil(m); i++) {
    const t0 = i / n, t1 = Math.min(m, i + 1) / n;
    const pb = i + 1 > m ? vlerp(pts[i], pts[i + 1], m - i) : pts[i + 1];
    R.line(pts[i], pb, col, col, width, a * mix(a0, 1, t0), a * mix(a0, 1, t1));
  }
}
function pointOnPolyline(pts, u) {
  const n = pts.length - 1, f = clamp(u) * n, i = Math.min(n - 1, Math.floor(f));
  return vlerp(pts[i], pts[i + 1], f - i);
}

// Drifting background dust, stable for a given seed.
function dust(R, t, o = {}) {
  const n = o.n ?? 220, box = o.box ?? [24, 14, 20], seed = o.seed ?? 3, col = o.color || [0.5, 0.6, 1.0];
  const c = o.center || [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const hx = hash2(i, seed), hy = hash2(i, seed + 1), hz = hash2(i, seed + 2), hs = hash2(i, seed + 3);
    const p = [
      c[0] + (fract(hx + t * 0.004 * (hs - 0.5)) - 0.5) * box[0],
      c[1] + (fract(hy + t * 0.006 * (0.3 + hs)) - 0.5) * box[1],
      c[2] + (hz - 0.5) * box[2],
    ];
    const tw = 0.5 + 0.5 * Math.sin(t * (1 + hs * 3) + hx * 50);
    R.sprite(p, 0.03 + 0.05 * hs, col, (o.alpha ?? 0.5) * tw, 0);
  }
}

// Monotone cubic interpolation through (xs, ys): used for camera paths that must
// hit exact positions at exact (musical) times without overshooting.
function monotoneSpline(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

// Pseudo attention weights: causal, softmax-normalised, a distinct pattern per head.
function attnWeights(head, q, wobble = 0) {
  const raw = [];
  for (let k = 0; k <= q; k++) {
    let s = hash3(head, q, k) * 1.5;
    if (head % 4 === 0) s += k === q - 1 ? 3 : 0;          // previous-token head
    if (head % 4 === 1) s += k === 0 ? 3 : 0;              // first-token head
    if (head % 4 === 2) s += (q === 3 && k === 1) || (q === 4 && k === 3) ? 3.2 : 0; // semantic head
    if (head % 4 === 3) s += k === q ? 2.5 : 0;            // self head
    s += Math.sin(wobble * 3 + head * 1.7 + k * 2.1 + q) * wobble * 0.8;
    raw.push(s * 1.4);
  }
  const mx = Math.max(...raw), ex = raw.map((v) => Math.exp(v - mx)), z = ex.reduce((a, b) => a + b, 0);
  return ex.map((v) => v / z);
}
