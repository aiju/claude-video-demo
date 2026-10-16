'use strict';
// Poster-print helpers for "Sand to GPU": flat inks on paper instead of neon on black.
// Everything here draws crisp fills (sprite shapes 8–12, plus 3) into whatever alpha
// layer is current ('under', 'over' or 'hudUnder'), so shapes stack like screen-printed inks.

// The composite runs ACES then gamma 2.2. Invert that, so a hex colour shows up on
// screen as that hex colour (contrast and saturation are left at 1 below).
function acesInv(y) {
  y = clamp(y, 0, 0.99);
  const a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y, c = -0.14 * y;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}
function ink(h, k = 1) {
  const n = parseInt(h.slice(1), 16);
  return [16, 8, 0].map((s) => acesInv(Math.pow(((n >> s) & 255) / 255, 2.2)) * k);
}
const PAL = {
  paper: ink('#efe1c1'), paper2: ink('#e3cc9c'), cream: ink('#f7ecd3'),
  red: ink('#c8261b'), redL: ink('#d9442c'), redD: ink('#8e1610'),
  black: ink('#1d1916'), char: ink('#3a332d'),
  gold: ink('#edb52b'), goldD: ink('#b9821a'),
  sand: ink('#d8b06a'), sandL: ink('#e8cc92'), sandD: ink('#a87f43'),
  steel: ink('#7f8b93'), steelL: ink('#c9d1d4'), steelD: ink('#465058'),
  orange: ink('#f08a24'), olive: ink('#4d4a2c'),
};
// Hot colours for the additive layer (these bloom).
const HOT = { orange: [6, 2.2, 0.35], gold: [5, 3.6, 1.2], white: [6, 5.6, 4.6] };

// Paper background + print-like grading. Call first in every scene.
function paperEnv(R, bg = PAL.paper) {
  const E = R.env, P = R.post;
  E.baseA = bg; E.baseB = bg;
  E.nebula = 1; E.nebA = cmul(bg, 0.05); E.nebB = cmul(bg, 0.09); // faint mottling, like pulp
  P.threshold = 3.2; P.bloom = 0.55; P.knee = 0.8;
  P.contrast = 1; P.sat = 1; P.exposure = 1;
  P.vignette = 0.42; P.grain = 0.055; P.scan = 0; P.distort = 0.015; P.aberr = 0.0018;
  P.flashColor = ink('#fff6e0');
}

// Camera looking straight at the z = 0 poster plane. zoom 1 shows x in [-8, 8], y in [-4.5, 4.5].
function posterCam(R, zoom = 1, cx = 0, cy = 0, roll = 0) {
  const d = fitDistance(16) / zoom;
  R.setCamera([cx, cy, d], [cx, cy, 0], [-Math.sin(roll), Math.cos(roll), 0]);
}

// ---- transform for compound objects: p' = o + s·Rot(r)·p --------------------------------
let PT = null;
function withT(T, fn) { const prev = PT; PT = Object.assign({ c: Math.cos(T.r || 0), sn: Math.sin(T.r || 0), s: 1, r: 0, x: 0, y: 0 }, T); fn(); PT = prev; }
function tpt(x, y) { return PT ? [PT.x + PT.s * (x * PT.c - y * PT.sn), PT.y + PT.s * (x * PT.sn + y * PT.c), 0] : [x, y, 0]; }
const ts = (v) => (PT ? v * PT.s : v);
const tr = (r) => (PT ? r + PT.r : r);

// ---- flat primitives (x, y in poster units) ---------------------------------------------
function rect(R, x, y, hw, hh, col, a = 1, rot = 0) {
  if (hw <= 0 || hh <= 0) return;
  R.sprite(tpt(x, y), ts(hh), col, a, 11, tr(rot), hw / hh);
}
function bar(R, x0, y0, x1, y1, hw, col, a = 1) {
  const L = Math.hypot(x1 - x0, y1 - y0) / 2;
  if (L < 1e-4) return;
  rect(R, (x0 + x1) / 2, (y0 + y1) / 2, L, hw, col, a, Math.atan2(y1 - y0, x1 - x0));
}
function disc(R, x, y, rx, col, a = 1, ry = rx, rot = 0) {
  if (rx <= 0 || ry <= 0) return;
  R.sprite(tpt(x, y), ts(ry), col, a, 3, tr(rot), rx / ry);
}
function star(R, x, y, r, col, a = 1, rot = 0, inner = 0.4) { if (r > 0) R.sprite(tpt(x, y), ts(r), col, a, 8, tr(rot), 1, inner); }
function gear(R, x, y, r, col, a = 1, rot = 0, teeth = 10) { if (r > 0) R.sprite(tpt(x, y), ts(r), col, a, 10, tr(rot), 1, teeth); }
function ringC(R, x, y, r, col, a = 1, thick = 0.2) { if (r > 0) R.sprite(tpt(x, y), ts(r), col, a, 12, 0, 1, thick); }
// Triangle with its apex at (x0, y0) and a base of half-width hb centred on (x1, y1).
function wedge(R, x0, y0, x1, y1, hb, col, a = 1) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 1e-4 || hb <= 0) return;
  R.sprite(tpt((x0 + x1) / 2, (y0 + y1) / 2), ts(hb), col, a, 9, tr(Math.atan2(y1 - y0, x1 - x0)), L / (2 * hb));
}
// Rectangle outline (stamp frames).
function box(R, x, y, hw, hh, th, col, a = 1, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const k = [P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)];
  for (let i = 0; i < 4; i++) {
    const p = k[i], q = k[(i + 1) % 4], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
    bar(R, p[0] - (dx / L) * th, p[1] - (dy / L) * th, q[0] + (dx / L) * th, q[1] + (dy / L) * th, th, col, a);
  }
}
// Sunburst: n rays (wedges from the centre) covering half the circle.
function sunburst(R, x, y, n, rOut, rot, col, a = 1, fill = 0.5) {
  const hb = Math.tan((Math.PI / n) * fill) * rOut;
  for (let i = 0; i < n; i++) {
    const ang = rot + (i * TAU) / n;
    wedge(R, x, y, x + Math.cos(ang) * rOut, y + Math.sin(ang) * rOut, hb, col, a);
  }
}
// Halftone dot field: dot radius = dot * f(u, v) with u, v in [0, 1] across the box.
function halftone(R, x0, y0, x1, y1, step, dot, col, a, f) {
  for (let y = y0; y <= y1 + 1e-6; y += step) {
    const row = Math.round((y - y0) / step);
    for (let x = x0 + (row % 2) * step * 0.5; x <= x1 + 1e-6; x += step) {
      const k = f((x - x0) / (x1 - x0), (y - y0) / (y1 - y0));
      if (k > 0.04) disc(R, x, y, dot * Math.min(1, k), col, a);
    }
  }
}

// ---- type ----------------------------------------------------------------------------------
// Poster text: flat fill (no glow), optional rotation of the whole line and an offset shadow.
// o: font ('post' | 'cond'), align, alpha, rot, tracking, shadow: [dx, dy, col], fx, n (chars shown)
function txt(R, str, x, y, size, col, o = {}) {
  const font = o.font || 'post', tracking = o.tracking || 0, rot = tr(o.rot || 0), align = o.align || 0;
  size = ts(size);
  const p = tpt(x, y);
  let fx = o.fx;
  if (o.n !== undefined) { const inner = fx, n = o.n; fx = (i, ch, s, len) => { if (inner) inner(i, ch, s, len); if (i >= n) s.alpha = 0; }; }
  if (Math.abs(rot) > 1e-4) fx = rotFx(R, str, font, tracking, align, rot, fx);
  const base = { font, align, tracking, glow: 0, hot: 0, alpha: o.alpha ?? 1, fx };
  if (o.shadow) {
    const [dx, dy, sc] = o.shadow;
    R.text(str, [p[0] + ts(dx), p[1] + ts(dy), p[2]], size, sc, base);
  }
  return R.text(str, p, size, col, base);
}
// Rotates a whole line about its anchor by moving and turning each glyph.
function rotFx(R, str, font, tracking, align, rot, inner) {
  const chars = Array.from(str);
  const adv = chars.map((ch) => { const g = R.atlas && R.atlas.get(font, ch); return g ? g.adv : 0.6; });
  const total = adv.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);
  let pen = align === -1 ? 0 : align === 1 ? -total : -total / 2;
  const cx = adv.map((w) => { const c = pen + w / 2; pen += w + tracking; return c; });
  const c = Math.cos(rot), s = Math.sin(rot);
  return (i, ch, st, n) => {
    if (inner) inner(i, ch, st, n);
    const x = cx[i] + st.dx, y = st.dy;
    st.dx = x * c - y * s - cx[i]; st.dy = x * s + y * c; st.rot += rot;
  };
}
// Rubber-stamp slam: returns the scale for something that lands at t0 (0 before it).
function slam(t, t0, from = 1.8, dur = 0.11) {
  if (t < t0) return 0;
  const u = range(t, t0, t0 + dur);
  return mix(from, 1, ease.outQuad(u)) - 0.06 * Math.sin(range(t, t0 + dur, t0 + dur + 0.2) * Math.PI);
}
// Typewriter: number of characters visible.
const typed = (t, t0, rate = 0.07) => (t < t0 ? 0 : Math.floor((t - t0) / rate) + 1);

// A slogan that slams in at t0: big line with a hard offset shadow.
function slogan(R, t, t0, str, x, y, size, col, o = {}) {
  const k = slam(t, t0, o.from || 1.6);
  if (k <= 0) return;
  const a = (o.alpha ?? 1) * clamp((t - t0) / 0.04, 0, 1);
  txt(R, str, x, y, size * k, col, Object.assign({}, o, { alpha: a }));
}
// Rubber stamp: framed text, rotated, slammed in at t0.
function rubberStamp(R, t, t0, str, x, y, size, col, rot = -0.18, o = {}) {
  const k = slam(t, t0, 1.9, 0.09);
  if (k <= 0) return;
  const a = (o.alpha ?? 0.92) * clamp((t - t0) / 0.03, 0, 1);
  const w = R.measure(str, o.font || 'post', o.tracking || 0) * size * k;
  const pad = size * 0.38 * k;
  if (o.back) rect(R, x, y, w / 2 + pad, size * 0.5 * k + pad * 0.7, o.back, a, rot);
  box(R, x, y, w / 2 + pad, size * 0.5 * k + pad * 0.7, size * 0.07 * k, col, a, rot);
  txt(R, str, x, y, size * k, col, { font: o.font || 'post', rot, alpha: a, tracking: o.tracking });
}

// ---- recurring furniture -------------------------------------------------------------------
// Chapter tag (HUD space, top-left): black block with № and the chapter name in two languages.
const CHAPTERS = [
  ['SAND', 'ПЕСОК'], ['PURIFY', 'ОЧИСТКА'], ['GROW', 'РОСТ'], ['SLICE', 'РЕЗКА'],
  ['PRINT', 'ЛИТОГРАФИЯ'], ['INSPECT', 'КОНТРОЛЬ'], ['ASSEMBLE', 'СБОРКА'], ['MULTIPLY', 'УМНОЖАЙ!'],
];
function chapterTag(R, t, i, t0, t1) {
  const a = sstep(t0, t0 + 0.25, t) * (1 - sstep(t1 - 0.12, t1, t)) * (i === 0 ? sstep(0.8, 1.1, t) : 1);
  if (a <= 0.001) return;
  R.use('hudUnder');
  const slide = 1 - ease.outCubic(range(t, t0, t0 + 0.35));
  const x0 = -7.75 - slide * 2.5, y0 = 4.25;
  const [en, ru] = CHAPTERS[i];
  const wEn = R.measure(en, 'post') * 0.36, wRu = R.measure(ru, 'cond') * 0.22;
  const w = 0.95 + Math.max(wEn, wRu, 1.95) + 0.25;
  rect(R, x0 + w / 2, y0 - 0.62, w / 2, 0.62, PAL.black, a);
  rect(R, x0 + 0.42, y0 - 0.5, 0.42, 0.5, PAL.red, a);
  txt(R, String(i + 1), x0 + 0.42, y0 - 0.47, 0.55, PAL.cream, { alpha: a });
  txt(R, en, x0 + 0.98, y0 - 0.33, 0.36, PAL.cream, { align: -1, alpha: a });
  txt(R, ru, x0 + 0.98, y0 - 0.75, 0.22, PAL.gold, { align: -1, font: 'cond', alpha: a, tracking: 0.04 });
  // eight stars: the plan's progress
  for (let k = 0; k < 8; k++) star(R, x0 + 0.98 + 0.11 + k * 0.245, y0 - 1.06, 0.1, k <= i ? PAL.gold : PAL.steelD, a, 0);
  R.use('under');
}

// Little cel-shaded sphere (atoms, sand grains with ambitions).
function ball(R, x, y, r, base, light, dark, a = 1) {
  disc(R, x, y, r, dark, a);
  disc(R, x - r * 0.08, y + r * 0.08, r * 0.9, base, a);
  disc(R, x - r * 0.35, y + r * 0.35, r * 0.28, light, a);
}
