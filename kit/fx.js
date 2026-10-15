'use strict';
// Reusable effects and helpers for scenes: palette, labels/chips, text reveals,
// particles, shockwaves, arcs, camera helpers and environment presets.
// Everything is a pure function of time, so scrubbing and offline renders work.

const COL = {
  cyan: hex('#19e6ff'), magenta: hex('#ff2d95'), violet: hex('#8b5cff'), amber: hex('#ffb21e'),
  mint: hex('#3dffb5'), blue: hex('#3b7bff'), coral: hex('#ff6a4d'), pink: hex('#ff8af0'), gold: hex('#ffcf5a'),
  white: [1, 1, 1], ink: hex('#07040f'), dim: hex('#2a2440'),
};
// Cycle through these for "one colour per item" (tokens, sections, series).
const ACCENTS = [COL.cyan, COL.violet, COL.magenta, COL.amber, COL.mint, COL.blue, COL.coral, COL.pink];

// Diverging colour map for values in [-1, 1]: cyan (neg) - dark - magenta - amber (pos).
function valueColor(v) {
  const base = [0.02, 0.01, 0.05];
  if (v < 0) return cmix(base, COL.cyan, Math.min(1, -v * 1.2));
  if (v < 0.6) return cmix(base, COL.magenta, v / 0.6);
  return cmix(COL.magenta, COL.amber, Math.min(1, (v - 0.6) / 0.4));
}

// ---- labels ---------------------------------------------------------------------
// "Chip": dark rounded panel, glowing outline and a neon label. Returns half-width.
// Options: font, glow, outline, fill, textCol, dimFirst (dim the first char), fx,
// panelLayer ('over'), lineLayer ('top').
function chipHalfWidth(R, label, size, font = 'mono') { return (R.measure(label, font) * size) / 2 + size * 0.42; }
function drawChip(R, label, p, size, col, a = 1, o = {}) {
  const font = o.font || 'mono';
  const hw = chipHalfWidth(R, label, size, font);
  if (a <= 0.001) return hw;
  const hh = size * 0.62;
  const S = hh / 0.78, stretch = hw / S + 0.22;
  const prev = R.cur;
  R.use(o.panelLayer || 'over');
  R.sprite(p, S, COL.ink, 0.88 * a * (o.fill ?? 1), 6, 0, stretch);
  R.use(o.lineLayer || 'top');
  R.sprite(p, S, col, (o.outline ?? 1.2) * a, 5, 0, stretch);
  R.text(label, p, size, o.textCol || cmix(col, COL.white, 0.35), {
    font, alpha: a, glow: o.glow ?? 0.5, hot: 0.3,
    fx: (i, ch, s, n) => { if (i === 0 && o.dimFirst) s.alpha = 0.35; if (o.fx) o.fx(i, ch, s, n); },
  });
  R.cur = prev;
  return hw;
}
// Lay out chips centred on x=0 with a gap; returns the centre x of each.
function chipRow(R, labels, size, gap, font = 'mono') {
  const hws = labels.map((t) => chipHalfWidth(R, t, size, font));
  const total = hws.reduce((s, w) => s + 2 * w, 0) + gap * (labels.length - 1);
  let x = -total / 2;
  return hws.map((w) => { const c = x + w; x += 2 * w + gap; return c; });
}

// ---- text reveals (pass as the `fx` option of R.text) -----------------------------
// Random glyphs settle into the real text, char by char from t0.
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
// Typewriter: char i appears at t0 + i * rate with a pop.
function typeFx(t, t0, rate = 0.06, col = null) {
  return (i, ch, s) => {
    const local = t - (t0 + i * rate);
    if (local < 0) { s.alpha = 0; return; }
    s.scale = 1 + 0.5 * Math.exp(-local * 18);
    if (col) s.color = cmix(COL.white, col, Math.min(1, local * 3));
  };
}
// Per-char wave.
function waveFx(t, amp = 0.08, speed = 4, k = 0.5) { return (i, ch, s) => { s.dy += Math.sin(t * speed + i * k) * amp; }; }

// ---- particles & hits -------------------------------------------------------------
// Deterministic spark burst from c starting at t0. Options: n, speed, life, drag,
// size, width, color / colors, seed, flat (in the xz plane).
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
// Expanding ring. Keep size modest (it is in world units and blooms a lot).
function shockwave(R, c, t, t0, o = {}) {
  const local = t - t0, life = o.life ?? 0.6;
  if (local < 0 || local > life) return;
  const u = local / life;
  R.sprite(c, (o.size ?? 6) * ease.outExpo(u), o.color || COL.white, (1 - u) ** 2 * (o.alpha ?? 0.6), 1);
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
// A field of points that flies in from `from` (default: origin) to their homes.
// pts: [{p, col, size}], u: 0..1 progress. Returns nothing; draws sprites.
function pointCloud(R, pts, u = 1, o = {}) {
  const from = o.from || [0, 0, 0], k = o.brightness ?? 1;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    const ui = ease.outExpo(clamp(u * 1.3 - hash1(i) * 0.3));
    if (ui <= 0) continue;
    R.sprite(vlerp(from, q.p, ui), q.size ?? 0.08, q.col || COL.white, (q.b ?? 1) * k, 0);
  }
}

// ---- curves -----------------------------------------------------------------------
// Quadratic arc between a and b, bulging by `height` in a plane rotated about the x axis.
function arcPoints(a, b, height, angle = 0, n = 24) {
  const mid = vlerp(a, b, 0.5);
  const ctrl = vadd(mid, rotX([0, height, 0], angle));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(bezier3(a, ctrl, b, i / n));
  return pts;
}
// Draw a partial polyline (reveal 0..1 of its length), alpha ramping from a0 to 1.
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
// Line with an arrowhead that faces the camera.
function arrow(R, a, b, col, w, reveal = 1, alpha = 1) {
  if (reveal <= 0) return;
  const tip = vlerp(a, b, reveal);
  R.line(a, tip, col, col, w, alpha * 0.5, alpha);
  const dir = vnorm(vsub(b, a));
  const side = vnorm(vcross(dir, vnorm(vsub(tip, R.cam.pos))));
  const hl = 0.28;
  R.line(tip, vadd(tip, vadd(vscale(dir, -hl), vscale(side, hl * 0.55))), col, col, w, alpha);
  R.line(tip, vadd(tip, vadd(vscale(dir, -hl), vscale(side, -hl * 0.55))), col, col, w, alpha);
}
// Axis-aligned rectangle outline in the plane z = p[2].
function rectOutline(R, p, hw, hh, col, w = 0.04, a = 1) {
  const c = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  for (let i = 0; i < 4; i++) {
    const p0 = c[i], p1 = c[(i + 1) % 4];
    R.line([p[0] + p0[0], p[1] + p0[1], p[2]], [p[0] + p1[0], p[1] + p1[1], p[2]], col, col, w, a);
  }
}

// ---- camera -------------------------------------------------------------------------
// Position orbiting `target` at distance d: yaw around y, pitch up from the horizon.
function orbit(target, d, yaw = 0, pitch = 0) {
  return vadd(target, [Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d]);
}
// Camera distance that fits `width` world units across the frame.
function fitDistance(width, fov = 50, aspect = 16 / 9) { return width / (2 * Math.tan((fov * Math.PI) / 360) * aspect); }
// Small noise offset for shake; amt in world units.
function shake(t, amt, seed = 1) { return [noise1(t * 13, seed) * amt, noise1(t * 13, seed + 1) * amt, 0]; }

// ---- environment presets (set R.env; call at the top of a scene) ----------------------
function envSpace(R, k = 1) {
  const E = R.env;
  E.nebula = 0.45 * k; E.stars = 0.8 * k; E.nebA = hex('#3a1670'); E.nebB = hex('#08607a');
}
function envSynthwave(R, t, k = 1, o = {}) {
  const E = R.env;
  E.nebula = 0.3 * k; E.stars = 0.5 * k; E.nebA = hex('#2a0f55'); E.nebB = hex('#0a3d66');
  E.grid = 0.75 * k; E.gridY = o.y ?? -3; E.gridCell = o.cell ?? 1.6; E.gridFog = 0.035; E.gridScroll = t * (o.speed ?? 3);
  E.gridColor = o.color || cmix(hex('#7a3dff'), hex('#19e6ff'), 0.5 + 0.5 * Math.sin(t * 0.5));
  E.horizon = 0.5 * k; E.horizonColor = o.horizon || hex('#ff2d95');
}
// Warp tunnel around the z axis; pass the camera's z so dashes stream past.
function envTunnel(R, k = 0.5) {
  const E = R.env;
  E.nebula = 0.25; E.stars = 0.5; E.nebA = hex('#1d0b44'); E.nebB = hex('#073a52');
  E.tunnel = k; E.tunnelR = 11; E.tunnelZ = 0; E.tunnelA = hex('#19e6ff'); E.tunnelB = hex('#ff2d95');
}
