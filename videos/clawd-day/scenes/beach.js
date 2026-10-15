'use strict';
// 28-38 s: lunch at the beach. Clawd crab-walks along the sand, three crabs pop up
// and ask the obvious question, and it all turns into a crab rave on the drop at 34.

const SAND_Y = -2.7;
const CRABS = [
  { x: 2.0, t0: 32.0 }, { x: 3.4, t0: 32.25 }, { x: 4.8, t0: 32.5 },
  { x: -2.6, t0: 34.0 }, { x: -4.0, t0: 34.1 }, { x: -5.4, t0: 34.2 }, { x: 6.2, t0: 34.3 },
];

function drawPalm(R, base, t, k) {
  R.use('over');
  const top = [base[0] + 0.9, base[1] + 3.6, base[2]];
  for (let i = 0; i < 11; i++) {
    const s = i / 10, x = base[0] + 0.9 * s * s, y = base[1] + 3.6 * s;
    pxRect(R, [x, y, base[2]], 0.36 - 0.08 * s, 0.38, cmul(i % 2 ? PAL.trunk : PAL.trunkDk, k), 1, -0.25 * s);
  }
  for (let j = 0; j < 7; j++) {
    const an = mix(0.25, Math.PI - 0.25, j / 6) + 0.06 * Math.sin(t * 2 + j);
    for (let s = 1; s <= 6; s++) {
      const r = s * 0.32, droop = 0.035 * s * s;
      const q = [top[0] + Math.cos(an) * r, top[1] + Math.sin(an) * r * 0.7 - droop, base[2]];
      const dir = Math.atan2(Math.sin(an) * 0.7 - 0.07 * s, Math.cos(an));
      pxRect(R, q, 0.42, 0.22 - 0.022 * s, cmul(j % 2 ? PAL.leaf : PAL.leafDk, k), 1, dir);
    }
  }
  [[-0.12, -0.12], [0.14, -0.1], [0.0, -0.28]].forEach(([dx, dy]) => R.sprite([top[0] + dx, top[1] + dy, base[2]], 0.13, cmul(hex('#6b4220', 0.8), k), 1, 3));
  R.use('add');
}

function discoBall(R, c, r, t, a) {
  R.use('add');
  R.line([c[0], 6, c[2]], [c[0], c[1] + r, c[2]], COL.white, COL.white, 0.015, 0.4 * a);
  R.sprite(c, r * 2.4, hex('#b8a0ff', 0.35), a * 0.8, 0);
  R.use('over');
  R.sprite(c, r, hex('#5a5a7a', 0.9), a, 3);
  R.use('top');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) {
    const lat = (i + 0.5) / 8 * Math.PI - Math.PI / 2, lon = (j / 10) * TAU + t * 1.5;
    const z = Math.cos(lat) * Math.cos(lon);
    if (z < 0) continue;
    const q = [c[0] + Math.cos(lat) * Math.sin(lon) * r * 0.92, c[1] + Math.sin(lat) * r * 0.92, c[2] + 0.1];
    const tw = 0.4 + 0.6 * (hash3(i, j, Math.floor(t * 8)) > 0.7 ? 1 : 0.3);
    R.sprite(q, r * 0.09, ACCENTS[(i + j) % ACCENTS.length], a * tw * (0.5 + z), 2, 0, 1);
  }
  R.use('add');
}

function sceneBeach(R, t) {
  const T = SCORE.times;
  const rave = sstep(33.95, 34.15, t);
  const kick = pulse(T.bigKick, t, 10);
  const E = R.env;
  E.baseA = cmix(hex('#1a64e0', 0.28), hex('#16063a', 0.8), rave);
  E.baseB = cmix(hex('#ff9a7a', 0.3), hex('#ff2d95', 0.25), rave);
  E.stars = 0.6 * rave; E.nebula = 0.3 * rave; E.nebA = hex('#5a1a8a'); E.nebB = hex('#0a5a7a');
  E.horizon = 0.15; E.horizonColor = cmix(hex('#ffd08a'), hex('#ff2d95'), rave);
  R.setCamera([0, 0.1 + kick * 0.04 * rave, 9.7 - kick * 0.15 * rave], [0, -0.1, 0]);

  const k = mix(1, 0.55, rave);
  drawSun(R, [4.8, 2.5, -4], 0.75, t, 1 - rave, 1);
  // sea + sand
  R.use('over');
  pxRect(R, [0, -1.2, -1], 30, 1.25, cmul(PAL.sea, k));
  pxRect(R, [0, -0.62, -1], 30, 0.1, cmul(hex('#7fe8ff', 0.7), k));
  pxRect(R, [0, -4.0, 0], 30, 2.9, cmul(PAL.sand, k));
  pxRect(R, [0, -1.85, -0.5], 30, 0.25, cmul(PAL.sandDk, k));
  R.use('top');
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const x = -8 + i * 2 + fract(t * 0.15 * (row + 1) + hash1(i + row * 9)) * 2 - 1, y = -0.85 - row * 0.32;
      R.line([x - 0.3, y, -0.9], [x + 0.3, y, -0.9], COL.white, COL.white, 0.03, 0.35 * k, 0.35 * k);
    }
  }
  // shells
  R.use('over');
  [[-6.5, -3.4], [3.6, -3.9], [6.8, -3.2], [-2.0, -4.1]].forEach(([x, y], i) => pxRect(R, [x, y, 0], 0.22, 0.14, cmul(i % 2 ? hex('#ffd0e0') : hex('#fff0c8'), k), 1, i));
  drawPalm(R, [-7.0, SAND_Y + 0.6, -0.3], t, k);

  // party lights
  if (rave > 0.01) {
    R.use('add');
    for (let i = 0; i < 6; i++) {
      const x0 = -6 + i * 2.4, an = -Math.PI / 2 + Math.sin(t * 1.8 + i * 1.3) * 0.55;
      const end = [x0 + Math.cos(an) * 9, 5 + Math.sin(an) * 9, -0.5];
      const col = ACCENTS[(i + Math.floor(Math.max(0, t - 34) * 2)) % ACCENTS.length];
      R.line([x0, 5, -0.5], end, col, col, 0.45, 0.22 * rave * (1 + kick), 0.02);
      R.sprite([end[0], Math.max(end[1], SAND_Y - 0.6), -0.4], 1.2, col, 0.18 * rave * (1 + kick), 0);
    }
    discoBall(R, [0, mix(6, 3.75, ease.outBack(range(t, 34.0, 34.6))), -0.6], 0.42, t, rave);
  }

  // footprints
  R.use('over');
  const walkU = (x) => mix(-4.6, -0.8, ease.outCubic(range(x, 28, 32)));
  T.step.forEach((ts, i) => {
    if (ts > t || t - ts > 3) return;
    const a = 0.5 * (1 - sstep(1.8, 3, t - ts));
    pxRect(R, [walkU(ts) + (i % 2 ? 0.35 : -0.35), SAND_Y - 0.12 - (i % 2) * 0.08, 0.05], 0.12, 0.07, cmul(PAL.sandDk, 0.8), a);
  });

  // Clawd
  const u = 0.16;
  let p, st;
  if (t < 32) {
    const ph = ((t - 28) / 0.25) * Math.PI;
    p = [walkU(t), SAND_Y + 0.06 * Math.abs(Math.sin(ph)), 0];
    st = { walk: ph, armL: 0.45 + 0.4 * Math.sin(ph), armR: 0.45 - 0.4 * Math.sin(ph), look: [0.45, 0], happy: t > 29.6 && t < 30.4 ? 1 : 0, shade: k };
  } else if (t < 33.9) {
    p = [-0.8, SAND_Y, 0];
    st = {
      look: [0.6, 0], eyeScale: 1 + 0.35 * pulse(T.crabpop, t, 8), squash: -0.1 * pulse(T.crabpop, t, 10),
      blush: sstep(33.3, 33.5, t), happy: t > 33.4 ? 1 : 0, armL: 0.1, armR: t > 33.4 ? 1.0 : 0.1, shade: k,
    };
  } else {
    const h = range(t, 33.9, 34.2), beat = fract((t - 34) / 0.5);
    const bounce = t >= 34.2 ? Math.sin(beat * Math.PI) * 0.35 : 0;
    p = [mix(-0.8, 0, h), SAND_Y + 0.9 * 4 * h * (1 - h) + bounce, 0];
    const up = Math.floor((t - 34) / 0.5) % 2;
    st = { happy: 1, squash: 0.25 * pulse(T.bigKick, t, 14) - 0.1 * bounce, armL: up ? 1.4 : 0.2, armR: up ? 0.2 : 1.4, glow: 0.4 + 0.4 * kick, blush: 0.6 };
  }
  drawClawd(R, p, u, st);

  // crabs
  CRABS.forEach((c, i) => {
    if (t < c.t0) return;
    const pop = ease.outBack(range(t, c.t0, c.t0 + 0.35));
    const beat = fract((t - 34) / 0.5), dancing = t >= 34.2;
    const hop = dancing ? Math.sin(beat * Math.PI) * 0.3 : 0;
    const up = dancing ? Math.floor((t - 34) / 0.5 + i) % 2 : 0;
    drawArt(R, ART.crab, [c.x, SAND_Y + hop, 0.05], 0.105, {
      sy: pop * (dancing ? 1 - 0.18 * pulse(T.bigKick, t, 14) + (up ? 0.12 : 0) : 1), sx: dancing ? 1 + 0.12 * pulse(T.bigKick, t, 14) : 1,
      flip: i % 2 === 1, rot: dancing ? (up ? 0.12 : -0.12) : 0,
    });
    R.use('top');
    burst(R, [c.x, SAND_Y + 0.1, 0.3], t, c.t0, { n: 14, speed: 3, life: 0.5, color: hex('#ffd08a', 1.2), seed: 30 + i });
    if (i < 3) popText(R, '!', [c.x, SAND_Y + 1.45, 0.3], 0.5, COL.gold, t, c.t0 + 0.05, 33.6);
    R.use('add');
  });

  // dialogue
  speech(R, 'are you one of us?', [3.4, -0.75, 0.6], 0.28, COL.coral, t, 32.72, 33.95, { rate: 0.045 });
  speech(R, 'uh... yes!', [-1.3, -0.75, 0.6], 0.28, PAL.clawdHot, t, 33.32, 33.95, { tail: 0.4, rate: 0.045 });

  // CRAB RAVE
  if (t >= 34) {
    R.use('top');
    const beatHit = pulse(T.bigKick, t, 12);
    popText(R, 'CRAB RAVE', [0, 2.15, 0.6], 1.1 * (1 + 0.06 * beatHit), COL.white, t, 34.0, 1e9, {
      tracking: 0.06, glow: 0.5,
      fx: (i, ch, s) => { s.color = cmul(ACCENTS[(i + Math.floor(Math.max(0, t - 34) * 4)) % ACCENTS.length], 1.25); s.dy += Math.sin(t * 8 + i * 0.7) * 0.08; },
    });
    confetti(R, t, 34.0, { n: 70, seed: 21 });
    R.use('add');
  }
  R.post.sat *= 1 + 0.15 * rave;
}
