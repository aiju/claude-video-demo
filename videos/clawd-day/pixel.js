'use strict';
// Pixel-art toolkit for "Clawd's Day". Characters and props are soft square
// pixels on the alpha layer ('over'), so they read as solid shapes in front of
// the glowing additive backgrounds. Everything here is a pure function of its
// arguments, so scenes stay pure functions of time.

const PAL = {
  clawd: hex('#d97757', 0.9), clawdHot: hex('#ff7a4a', 1.5), eye: hex('#1a0e0a'), blush: hex('#ff7aa8', 1.1),
  white: hex('#fff4e6', 1.0), sheet: hex('#efe8ff', 0.85), cream: hex('#ffeacc', 0.9),
  wood: hex('#a0603a', 0.8), woodDk: hex('#643a22', 0.75),
  blanket: hex('#4f6ff0', 0.9), blanketLt: hex('#8aa2ff', 0.95), cap: hex('#6a4cff', 1.0),
  coffee: hex('#3b1d0e', 0.9), steel: hex('#aab1cc', 0.75), steelDk: hex('#4a5070', 0.8), panel: hex('#120c24'),
  bug: hex('#7dff5a', 1.1), bugDk: hex('#2f8f3a', 0.9), bugHead: hex('#5a2a8a', 1.0),
  crab: hex('#ff4b3a', 1.15), leaf: hex('#36d17a', 0.85), leafDk: hex('#1f8a52', 0.8),
  trunk: hex('#b07a45', 0.8), trunkDk: hex('#7a4e26', 0.8), sand: hex('#e6ad6c', 0.5), sandDk: hex('#b8824a', 0.5),
  sea: hex('#1fb5c9', 0.55), seaDk: hex('#127c9e', 0.5), wool: hex('#f4f1ff', 1.0),
  rocket: hex('#eef0ff', 0.95), rocketRed: hex('#ff3d5a', 1.1), gray: hex('#8088a8', 0.75),
  gold: hex('#ffcf5a', 1.3), red: hex('#ff4d5e', 1.1),
};

// A solid rounded rectangle of exactly w x h (world units) centred at c.
function pxRect(R, c, w, h, col, a = 1, rot = 0) {
  if (w <= 1e-4 || h <= 1e-4 || a <= 0.001) return;
  if (w >= h) { const s = h / 1.56; R.sprite(c, s, col, a, 6, rot, w / (2 * s) + 0.22); }
  else { const s = w / 1.56; R.sprite(c, s, col, a, 6, rot + Math.PI / 2, h / (2 * s) + 0.22); }
}

// ---- pixel art from strings ----------------------------------------------------------
// rows top to bottom, '.' is transparent, other chars index the palette.
function art(rows, pal) { return { rows, pal, W: Math.max(...rows.map((r) => r.length)), H: rows.length, runs: null }; }
function artRuns(A) {
  if (A.runs) return A.runs;
  A.runs = [];
  A.rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let e = x + 1;
      while (e < row.length && row[e] === ch) e++;
      A.runs.push({ ch, x0: x, x1: e, y });
      x = e;
    }
  });
  return A.runs;
}
// Draws A with the point at anchor (fractions of its box, default bottom-centre) at p.
// o: alpha, rot, flip, sx, sy, anchor, pal (overrides), shade, layer.
function drawArt(R, A, p, unit, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.001) return;
  const runs = artRuns(A), rot = o.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
  const fx = o.flip ? -1 : 1, sx = unit * (o.sx ?? 1), sy = unit * (o.sy ?? 1);
  const [ax, ay] = o.anchor || [0.5, 0];
  const k = o.shade ?? 1;
  const prev = R.cur;
  R.use(o.layer || 'over');
  for (const r of runs) {
    let col = (o.pal && o.pal[r.ch]) || A.pal[r.ch];
    if (!col) continue;
    if (k !== 1) col = cmul(col, k);
    const lx = ((r.x0 + r.x1) / 2 - ax * A.W) * sx * fx, ly = (A.H - r.y - 0.5 - ay * A.H) * sy;
    pxRect(R, [p[0] + lx * c - ly * s, p[1] + lx * s + ly * c, p[2] || 0], (r.x1 - r.x0) * sx + unit * 0.04, sy * 1.08, col, a, rot);
  }
  R.cur = prev;
}

const ART = {
  cap: art([
    '..........ww',
    '........bbww',
    '......bbbb..',
    '....bbbbbb..',
    '..bbbbbbbb..',
    'wwwwwwwwwwww',
  ], { b: PAL.cap, w: PAL.white }),
  clock: art([
    '.gg.....gg.',
    'gggg...gggg',
    '.ggrrrrrgg.',
    '.rrwwwwwrr.',
    'rrwwwkwwwrr',
    'rrwwwkwwwrr',
    'rrwwwkkkwrr',
    'rrwwwwwwwrr',
    '.rrwwwwwrr.',
    '..rrrrrrr..',
    '..r.....r..',
  ], { g: PAL.gold, r: PAL.red, w: PAL.cream, k: PAL.eye }),
  mug: art([
    'wwwwwwwwww...',
    'wkkkkkkkkw...',
    'wwwwwwwwwwhhh',
    'wwoowoowww..h',
    'woooooooww..h',
    'woooooooww..h',
    'wwooooowwwhhh',
    'wwwooowwww...',
    'wwwwowwwww...',
    'wwwwwwwwww...',
    '.wwwwwwww....',
  ], { w: PAL.white, h: PAL.white, k: PAL.coffee, o: PAL.clawd }),
  bugA: art([
    'a.a.........',
    '.a.a........',
    '..a..vvvvv..',
    '.hhhvvvvvvv.',
    'hehhvvpvvpvv',
    'hhhhvvvvvvvv',
    '.hhvvpvvvpv.',
    '..l.l..l.l..',
  ], { a: PAL.bugHead, h: PAL.bugHead, e: PAL.white, v: PAL.bug, p: PAL.bugDk, l: PAL.bugHead }),
  bugB: art([
    'a.a.........',
    '.a.a........',
    '..a..vvvvv..',
    '.hhhvvvvvvv.',
    'hehhvvpvvpvv',
    'hhhhvvvvvvvv',
    '.hhvvpvvvpv.',
    '.l.l..l.l...',
  ], { a: PAL.bugHead, h: PAL.bugHead, e: PAL.white, v: PAL.bug, p: PAL.bugDk, l: PAL.bugHead }),
  crab: art([
    '.rr.......rr.',
    'r.rr.....rr.r',
    'rrr..k.k..rrr',
    '.r...r.r...r.',
    '.rr.rrrrr.rr.',
    '..rrrrrrrrr..',
    '..rrrrrrrrr..',
    '...rrrrrrr...',
    '..r.r...r.r..',
  ], { r: PAL.crab, k: PAL.eye }),
  sheep: art([
    '.wwwww....',
    'wwwwwwwkk.',
    'wwwwwwkkkk',
    'wwwwwwkekk',
    'wwwwwwwkk.',
    '.wwwwwww..',
    '.k.k..k.k.',
    '.k.k..k.k.',
  ], { w: PAL.wool, k: PAL.eye, e: PAL.white }),
  rocket: art([
    '.....r.....',
    '....rrr....',
    '...rrrrr...',
    '..rrrrrrr..',
    '..wwwwwww..',
    '.wgggggggw.',
    '.wgokokogw.',
    '.wgokokogw.',
    '.wgooooogw.',
    '.wgggggggw.',
    '.wwwwwwwww.',
    '.wwrrrrrww.',
    '.wwwwwwwww.',
    'rwwwwwwwwwr',
    'rrwwwwwwwrr',
    'rr.ggggg.rr',
    'r...ggg...r',
  ], { r: PAL.rocketRed, w: PAL.rocket, g: PAL.gray, o: PAL.clawd, k: PAL.eye }),
};

// ---- Clawd -------------------------------------------------------------------------
// Matches the terminal logo: a 12x8 body, 2x2 arms, four 1x2 legs, two 1x2 eyes.
// p = ground point between the feet; u = world size of one pixel.
// st: blink 0..1, eyeScale, look [x, y] (pixels), happy (^ ^ eyes), shine, armL/armR
// (raise angle, rad), walk (leg phase, rad), squash (+ flat, - tall), tilt, blush,
// sweat (alpha) + sweatT, cap (nightcap alpha), alpha, shade, glow, col, layer.
function drawClawd(R, p, u, st = {}) {
  const a = st.alpha ?? 1;
  if (a <= 0.001) return;
  const sq = st.squash || 0, sx = 1 + sq * 0.6, sy = 1 - sq;
  const tl = st.tilt || 0, ct = Math.cos(tl), sn = Math.sin(tl);
  const k = st.shade ?? 1, body = cmul(st.col || PAL.clawd, k), eyeC = PAL.eye;
  const z = p[2] || 0;
  const W = (x, y) => { const X = x * sx * u, Y = (y + 6) * sy * u; return [p[0] + X * ct - Y * sn, p[1] + X * sn + Y * ct, z]; };
  const rect = (x, y, w, h, col, rot = 0, al = a) => pxRect(R, W(x, y), w * sx * u, h * sy * u, col, al, tl + rot);
  const prev = R.cur;
  const glow = st.glow ?? 0.3;
  if (glow > 0) { R.use('add'); R.sprite(W(0, -0.5), 12 * u, cmul(body, 0.45), a * glow, 0); }
  R.use(st.layer || 'over');
  [-4.5, -2.5, 2.5, 4.5].forEach((x, i) => {
    const lift = st.walk === undefined ? 0 : Math.max(0, Math.sin(st.walk + (i % 2) * Math.PI)) * 0.9;
    rect(x, (-6 + lift - 3.6) / 2, 1, 2.4 - lift, body);
  });
  for (const side of [-1, 1]) {
    const ang = side < 0 ? st.armL || 0 : st.armR || 0;
    rect(side * (6 + Math.cos(ang) * 0.9), -1 + Math.sin(ang) * 0.9, 2.4, 2, body, side * ang);
  }
  for (let r = 0; r < 8; r++) rect(0, 3.5 - r, 12, 1.08, body);
  const es = st.eyeScale ?? 1, bl = clamp(st.blink || 0), lk = st.look || [0, 0];
  for (const side of [-1, 1]) {
    const ex = side * 3.5 + lk[0], ey = 1 + lk[1];
    if ((st.happy || 0) > 0.5) {
      rect(ex - 0.4, ey + 0.1, 1.25, 0.55, eyeC, 0.8);
      rect(ex + 0.4, ey + 0.1, 1.25, 0.55, eyeC, -0.8);
    } else {
      rect(ex, ey - bl * 0.6, mix(1, 1.8, bl) * es, mix(2, 0.38, bl) * es, eyeC);
      if (st.shine && bl < 0.5) rect(ex + 0.2 * es, ey + 0.5 * es, 0.4 * es, 0.4 * es, PAL.white, 0, a * st.shine);
    }
  }
  if (st.blush) for (const side of [-1, 1]) rect(side * 4.4, -0.7, 1.6, 0.7, PAL.blush, 0, a * st.blush);
  if (st.sweat) {
    const f = fract(st.sweatT || 0), sa = a * st.sweat * (1 - f);
    rect(7.2, 4.6 - f * 2.5, 0.9, 1.2, hex('#7fdcff', 1.3), 0, sa);
    rect(7.2, 5.3 - f * 2.5, 0.5, 0.5, hex('#7fdcff', 1.3), Math.PI / 4, sa);
  }
  if (st.cap) drawArt(R, ART.cap, W(0, 3.7), u * sx, { alpha: a * st.cap, rot: tl, layer: st.layer || 'over', shade: k });
  R.cur = prev;
}

// ---- little helpers -------------------------------------------------------------------
// Text that pops in with overshoot at t0 and shrinks away after t1.
function popText(R, str, p, size, col, t, t0, t1 = 1e9, o = {}) {
  if (t < t0 || t > t1 + 0.3) return;
  const s = ease.outBack(clamp((t - t0) / 0.35)) * (1 - ease.inCubic(clamp((t - t1) / 0.3)));
  if (s <= 0.01) return;
  R.text(str, p, size * s, col, Object.assign({ font: 'disp', glow: 0.8 }, o));
}
// A speech bubble (chip + tail) whose text types itself in.
function speech(R, str, p, size, col, t, t0, t1, o = {}) {
  if (t < t0 || t > t1 + 0.25) return;
  const a = clamp((t - t0) / 0.1) * (1 - clamp((t - t1) / 0.25));
  const s = size * (0.8 + 0.2 * ease.outBack(clamp((t - t0) / 0.3)));
  drawChip(R, str, p, s, col, a, { fx: typeFx(t, t0 + 0.08, o.rate ?? 0.045), glow: 0.5 });
  R.use('over');
  pxRect(R, [p[0] + (o.tail ?? 0), p[1] - s * 0.72, p[2] || 0], s * 0.36, s * 0.36, COL.ink, 0.88 * a, Math.PI / 4);
  R.use('add');
}
// Simple sun: hot disc, halo and slowly turning rays.
function drawSun(R, p, r, t, k = 1, rays = 1) {
  R.use('add');
  R.sprite(p, r * 2.8, hex('#ff9a3c', 0.5), 0.8 * k, 0);
  R.sprite(p, r, hex('#ffd36a', 2.2), k, 3);
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * TAU + t * 0.25, l0 = r * 1.25, l1 = r * (1.6 + 0.15 * Math.sin(t * 3 + i));
    R.line(vadd(p, [Math.cos(an) * l0, Math.sin(an) * l0, 0]), vadd(p, [Math.cos(an) * l1, Math.sin(an) * l1, 0]), COL.gold, COL.gold, r * 0.12, k * rays * 0.9, 0);
  }
}
function drawMoon(R, p, r, a = 1) {
  R.use('add');
  R.sprite(p, r * 2.6, hex('#8fa2ff', 0.35), 0.7 * a, 0);
  R.sprite(p, r, hex('#eef1ff', 1.5), a, 3);
  R.use('over');
  [[-0.3, 0.25, 0.22], [0.3, -0.2, 0.16], [0.05, -0.45, 0.1], [0.4, 0.35, 0.08]].forEach(([x, y, s]) =>
    R.sprite([p[0] + x * r, p[1] + y * r, p[2] || 0], s * r, hex('#9aa4c8', 1.0), 0.45 * a, 3));
  R.use('add');
}
// Confetti falling through a box; deterministic per seed.
function confetti(R, t, t0, o = {}) {
  const n = o.n ?? 70, seed = o.seed ?? 5, w = o.w ?? 16, top = o.top ?? 5.5, a0 = o.alpha ?? 1;
  const age = t - t0;
  if (age < 0) return;
  R.use(o.layer || 'top');
  for (let i = 0; i < n; i++) {
    const h1 = hash2(i, seed), h2 = hash2(i, seed + 1), h3 = hash2(i, seed + 2);
    const y = top + h3 * 3 - age * (1.6 + h2 * 1.4);
    if (y < -5.5) continue;
    const x = (h1 - 0.5) * w + Math.sin(age * (2 + h2 * 3) + i) * 0.3;
    const col = ACCENTS[i % ACCENTS.length];
    R.sprite([x, y, 0.5 + h2], 0.07, col, a0 * (o.fade ?? 1), 2, age * (3 + h3 * 6) + i, 1.8);
  }
  R.use('add');
}
