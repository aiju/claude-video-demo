'use strict';
// Sand to GPU: a five-year plan in sixty seconds.
// 60 s at 120 BPM = 30 bars (one bar = 2 s, one 16th step = 0.125 s). D minor march,
// turning to D major when the GPU is born. Poster helpers live in poster.js.

// ---------------------------------------------------------------- geometry the score needs
// Lithography wafer: dies on a grid inside the circle, exposed row by row.
const WAFER = { x: -3.2, y: -0.35, r: 3.35 };
const DIES = [];
(() => {
  const pitch = 0.66, half = 0.3;
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
    const x = i * pitch, y = -j * pitch;
    const far = Math.hypot(Math.abs(x) + half, Math.abs(y) + half);
    if (far < WAFER.r - 0.18) DIES.push({ x: WAFER.x + x, y: WAFER.y + y, i, j, h: hash2(i + 9, j + 17) });
  }
})();
const ROWS = [...new Set(DIES.map((d) => d.j))].sort((a, b) => a - b);

// ---------------------------------------------------------------- score
const sc = new ScoreBuilder({ bpm: 120, duration: 60 });
const bt = (bar, step = 0) => sc.bt(bar, step);
const STAMPS = [];
function stamp(t, v = 1) { STAMPS.push(t); sc.kick(t, 0.7 * v); sc.add('clap', t, { v: 0.75 * v }); return t; }
function typing(t0, str, rate) { Array.from(str).forEach((ch, i) => { if (ch !== ' ') sc.add('type', t0 + i * rate); }); }

sc.chords([
  [0, 'Dm'], [4, 'Bb'], [6, 'A'],                         // 1 sand
  [8, 'Dm'], [10, 'Gm'], [12, 'C'], [14, 'A'],            // 2 purify
  [16, 'Dm'], [18, 'Bb'], [20, 'F'], [22, 'A'],           // 3 grow (drop)
  [24, 'Dm'], [26, 'Bb'], [28, 'C'],                      // 4 slice
  [30, 'F'], [32, 'C'], [34, 'Dm'], [36, 'Bb'], [38, 'A'], // 5 print
  [40, 'Gm'], [42, 'Dm'], [44, 'A'],                      // 6 inspect
  [46, 'D'], [48, 'Bm'], [50, 'G'], [52, 'A'],            // 7 assemble (major!)
  [54, 'D'], [56, 'G'], [57, 'A'], [58, 'D'],             // 8 multiply
]);

// 1 · sand: a little military march
sc.drone('D2', [[0, 0], [0.6, 0.2], [7.6, 0.2], [8, 0]]);
for (let bar = 0; bar < 4; bar++) {
  sc.kick(bt(bar, 0), 0.6); sc.kick(bt(bar, 8), 0.5);
  [[4, 0.3], [6, 0.15], [7, 0.2], [12, 0.3], [14, 0.15], [15, 0.2]].forEach(([s, v]) => sc.add('snare', bt(bar, s), { v }));
}
stamp(0.5);
typing(1.5, 'THIS HUMBLE SAND', 0.1);
sc.whoosh(4.4, 0.9, -0.5, 0.4);
sc.add('blip', 5.0, { note: midi('A5') }).add('blip', 5.12, { note: midi('E6') });
stamp(6.0); sc.add('ding', 6.0, { note: midi('D6'), chord: true });
sc.melody(2, [[0, 'F4', 3], [3, 'F4', 1], [4, 'Bb4', 4], [8, 'D5', 8]]);
sc.melody(3, [[0, 'E5', 3], [3, 'D5', 1], [4, 'C#5', 4], [8, 'A4', 7]]);

// 2 · purify: oom-pah, eight impurities kicked out, eight nines added
for (let bar = 4; bar < 8; bar++) { sc.fullBar(bar, { hats: bar >= 5 }); sc.offbeatBass(bar); }
sc.arpBar(6, 2, 0.45).arpBar(7, 1, 0.55);
const EJECT = Array.from({ length: 8 }, (_, k) => 8.5 + k * 0.5);
EJECT.forEach((t, k) => sc.add('blip', t, { note: midi(['D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6', 'D6'][k]) }));
stamp(8.25); stamp(13.0, 0.8); stamp(14.0, 0.8);
sc.build(12, 16);
sc.roll(7, 8, 16, 1, 0.3, 1);

// 3 · grow: the drop, and the anthem
sc.drop(16, 1.2);
for (let bar = 8; bar < 12; bar++) sc.fullBar(bar).rollingBass(bar).arpBar(bar, 1, 0.5);
sc.melody(8, [[0, 'D5', 6], [6, 'A4', 2], [8, 'D5', 4], [12, 'F5', 4]]);
sc.melody(9, [[0, 'F5', 6], [6, 'E5', 2], [8, 'D5', 4], [12, 'Bb4', 4]]);
sc.melody(10, [[0, 'C5', 6], [6, 'A4', 2], [8, 'F4', 4], [12, 'A4', 2], [14, 'C5', 2]]);
sc.melody(11, [[0, 'E5', 6], [6, 'D5', 2], [8, 'C#5', 8]]);
stamp(16.5, 0.5); stamp(17.0, 0.5); stamp(17.5, 0.5);
const LIST3 = [18.5, 19.5, 20.5];
LIST3.forEach((t) => sc.add('tick', t));

// 4 · slice: one wafer per half bar
for (let bar = 12; bar < 15; bar++) { sc.fullBar(bar); sc.offbeatBass(bar); sc.arpBar(bar, 2, 0.4); }
const CUTS = Array.from({ length: 10 }, (_, k) => 24.5 + k * 0.5);
CUTS.forEach((t, k) => sc.add('pluck', t, { note: midi(['D5', 'E5', 'F5', 'G5', 'A5', 'Bb5', 'C6', 'D6', 'E6', 'F6'][k]) }));
stamp(24.25, 0.6); stamp(27.5, 0.6);
sc.whoosh(29.6, 0.9, 0.6, 0.5);

// 5 · print: light, row by row, layer after layer
for (let bar = 15; bar < 19; bar++) { sc.halfTimeBar(bar); sc.arpBar(bar, 1, 0.45); }
sc.rollingBass(17).rollingBass(18);
sc.halfTimeBar(19, { hats: false });
const EXPO1 = ROWS.map((_, k) => 30.5 + k * 0.25), EXPO2 = ROWS.map((_, k) => 33.0 + k * 0.25);
EXPO1.concat(EXPO2).forEach((t) => sc.add('tick', t));
for (let s = 0; s < 16; s++) sc.add('blip', 35.5 + s * 0.125, { note: midi('D5') + [0, 3, 7, 10, 12, 15, 19, 22][s % 8] + (s >= 8 ? 12 : 0) });
stamp(30.25, 0.6); stamp(30.75, 0.7); stamp(31.5, 0.6); stamp(37.0, 0.6); stamp(37.5, 0.6);
sc.build(38, 40, 0.6);

// 6 · inspect: stamp, stamp, stamp… and one sad trombone
for (let bar = 20; bar < 22; bar++) {
  sc.kick(bt(bar, 0), 0.8); sc.kick(bt(bar, 8), 0.6); sc.offbeatBass(bar);
  for (let s = 0; s < 16; s += 2) sc.add('hat', bt(bar, s), { v: 0.18 });
}
sc.kick(bt(22, 0), 0.8);
const APPROVE = Array.from({ length: 9 }, (_, k) => 40.75 + k * 0.375);
APPROVE.forEach((t) => { STAMPS.push(t); sc.add('clap', t, { v: 0.6 }); sc.kick(t, 0.45); sc.add('tick', t); });
const REASSIGN = 44.25;
sc.kick(REASSIGN, 1).add('subdrop', REASSIGN).add('clap', REASSIGN, { v: 1 });
sc.melody(22, [[4, 'A4', 2], [6, 'G#4', 2], [8, 'G4', 2], [10, 'F#4', 5]]);
sc.build(44.75, 46, 0.8);
sc.roll(22, 8, 16, 1, 0.3, 0.9);

// 7 · assemble: D major, glory
sc.drop(46, 1.3);
for (let bar = 23; bar < 27; bar++) sc.fullBar(bar).rollingBass(bar).arpBar(bar, 1, 0.55);
sc.melody(23, [[0, 'A4', 6], [6, 'D5', 2], [8, 'F#5', 4], [12, 'A5', 4]]);
sc.melody(24, [[0, 'B5', 6], [6, 'A5', 2], [8, 'F#5', 4], [12, 'D5', 4]]);
sc.melody(25, [[0, 'G5', 6], [6, 'F#5', 2], [8, 'E5', 4], [12, 'D5', 2], [14, 'B4', 2]]);
sc.melody(26, [[0, 'C#5', 6], [6, 'E5', 2], [8, 'A5', 8]]);
const HBM = Array.from({ length: 6 }, (_, k) => 47.0 + k * 0.25);
HBM.forEach((t, k) => sc.add('pluck', t, { note: midi(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'][k]) }));
stamp(47.0, 0.5); stamp(48.5, 0.5);
const CLOSE = 50.0;
stamp(CLOSE, 0.8);
stamp(50.5, 0.6); stamp(51.25, 0.5); stamp(52.0, 0.5);

// 8 · multiply: the slogan, the final hit
sc.fullBar(27).rollingBass(27).arpBar(27, 1, 0.55);
stamp(54.25, 0.6);
const CELLS = Array.from({ length: 9 }, (_, k) => 54.5 + k * 0.375);
CELLS.forEach((t, k) => sc.add('blip', t, { note: midi(['D5', 'F#5', 'A5', 'D6', 'E6', 'F#6', 'A6', 'B6', 'D7'][k]) }));
sc.drop(56, 1.2).add('ding', 56, { note: midi('D6'), chord: true });
sc.halfTimeBar(28).longBass(56, 2);
sc.melody(28, [[0, 'D5', 4], [4, 'F#5', 4], [8, 'A5', 8]]);
sc.melody(29, [[0, 'D6', 12]]);
sc.kick(bt(29, 0), 0.8);

sc.padLevel([[0, 0], [1, 0.5], [8, 0.6], [16, 0.8], [24, 0.6], [30, 0.7], [40, 0.55], [46, 0.9], [56, 0.95], [59, 0.4], [60, 0]]);
sc.padCut([[0, 400], [7.9, 1400], [8, 1500], [15.9, 4200], [16, 2600], [40, 1400], [45.9, 4500], [46, 3000], [56, 3800], [60, 600]]);
sc.arpCut([[0, 900], [16, 4500], [30, 700], [38, 5200], [40, 1200], [46, 5000], [60, 2000]]);
sc.mixer({ hat: 0.8, ohat: 0.7 });
const SCORE = sc.done();
STAMPS.sort((a, b) => a - b);

// ---------------------------------------------------------------- shared bits
const kickPulse = (t) => pulse(SCORE.times.bigKick, t, 11);
function begin(R, t, sec, bg, idx) {
  paperEnv(R, bg);
  R.use('under');
  chapterTag(R, t, idx, sec.t0, sec.t1);
  R.use('under');
}
// Spray of crisp stars from (x, y) at t0.
function starBurst(R, t, t0, x, y, n, cols, seed, spread = 7) {
  const u = t - t0;
  if (u < 0 || u > 1.6) return;
  for (let i = 0; i < n; i++) {
    const ang = hash2(i, seed) * TAU, sp = spread * (0.45 + hash2(i, seed + 1) * 0.55);
    const d = sp * (1 - Math.exp(-u * 3.2)) / 3.2 * 3.2;
    const k = 1 - range(u, 0.9, 1.6);
    star(R, x + Math.cos(ang) * d, y + Math.sin(ang) * d - u * u * 0.6, (0.12 + hash2(i, seed + 2) * 0.16) * k, cols[i % cols.length], 1, u * (hash2(i, seed + 3) - 0.5) * 8);
  }
}
// A GPU die, top view: frame, SM grid, cache strip, memory PHYs.
function drawDie(R, x, y, h, a = 1, defect = 0) {
  rect(R, x, y, h, h, PAL.gold, a);
  rect(R, x, y, h * 0.93, h * 0.93, PAL.char, a);
  const cols = 6, rows = 4, gw = h * 0.72, gh = h * 0.62;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = x - gw + (c + 0.5) * (2 * gw / cols), cy = y - gh + (r + 0.5) * (2 * gh / rows) + (r < 2 ? -h * 0.06 : h * 0.06);
    rect(R, cx, cy, gw / cols * 0.8, gh / rows * 0.78, (r + c) % 3 === 0 ? PAL.redD : PAL.red, a);
  }
  rect(R, x, y, gw, h * 0.07, PAL.gold, a);
  for (let k = 0; k < 3; k++) {
    rect(R, x - h * 0.85, y + (k - 1) * h * 0.5, h * 0.05, h * 0.18, PAL.goldD, a);
    rect(R, x + h * 0.85, y + (k - 1) * h * 0.5, h * 0.05, h * 0.18, PAL.goldD, a);
  }
  if (defect > 0) {
    disc(R, x - h * 0.2, y + h * 0.15, h * 0.32 * defect, PAL.black, a);
    disc(R, x + h * 0.08, y + h * 0.3, h * 0.2 * defect, PAL.black, a);
    disc(R, x - h * 0.35, y - h * 0.05, h * 0.16 * defect, PAL.black, a);
    bar(R, x - h * 0.1, y + h * 0.1, x + h * 0.55, y - h * 0.5, h * 0.025, PAL.black, a * defect);
    bar(R, x + h * 0.25, y - h * 0.2, x + h * 0.6, y - h * 0.05, h * 0.02, PAL.black, a * defect);
  }
}

// ---------------------------------------------------------------- 1 · sand (0–8 s)
let SAND = null;
function sceneSand(R, t, u, sec) {
  if (!SAND) {
    const rng = mulberry32(11); SAND = [];
    for (let i = 0; i < 950; i++) {
      const x = (rng() * 2 - 1) * 8.7;
      const top = -4.75 + 2.45 * Math.max(0, 1 - (x / 8.3) ** 2);
      const y = mix(-4.9, top, Math.sqrt(rng()));
      const c = rng();
      SAND.push({ x, y, r: 0.06 + rng() * 0.08, col: c < 0.45 ? PAL.sand : c < 0.8 ? PAL.sandD : PAL.sandL, ph: rng() });
    }
    SAND.sort((a, b) => b.y - a.y);
  }
  begin(R, t, sec, PAL.paper, 0);
  posterCam(R, 1 + 0.05 * ease.inOutCubic(u / 8), 0, 0.1 * ease.inOutCubic(u / 8));
  R.post.fade = 1 - sstep(0, 0.7, t);
  const kick = pulse(SCORE.times.kick, t, 12);

  sunburst(R, 0, -3.0, 20, 16 * ease.outCubic(range(t, 0.2, 2.0)), 0.04 * t, PAL.paper2);
  disc(R, 0, mix(-8, -3.0, ease.outCubic(range(t, 0.3, 2.4))), 3.3, PAL.red);
  disc(R, 0, -4.75, 8.5, PAL.sandD, 1, 2.5);
  for (const g of SAND) {
    const hop = g.y > -3.4 ? kick * 0.05 * g.ph : 0;
    disc(R, g.x, g.y + hop, g.r, g.col);
  }

  // Comrade Sand Grain, chosen for greatness
  const rise = ease.inOutCubic(range(t, 4.0, 5.0));
  const gx = 0, gy = mix(-2.25, -0.65, rise), gr = mix(0.14, 0.55, rise);
  if (t > 4.4) {
    const h = sstep(4.4, 4.9, t);
    star(R, gx, gy, 1.05 * h + kick * 0.04, PAL.gold, 1, t * 0.6);
  }
  ball(R, gx, gy, gr, PAL.sand, PAL.sandL, PAL.sandD);
  if (t > 4.7) {
    const e = sstep(4.7, 4.85, t), look = t > 5.6 ? 0.04 : 0;
    disc(R, gx - 0.17 + look, gy + 0.1, 0.07 * e, PAL.black, 1, 0.1 * e);
    disc(R, gx + 0.15 + look, gy + 0.1, 0.07 * e, PAL.black, 1, 0.1 * e);
    bar(R, gx - 0.3, gy + 0.3, gx - 0.06, gy + 0.24, 0.025 * e, PAL.black); // determined brows
    bar(R, gx + 0.04, gy + 0.24, gx + 0.28, gy + 0.3, 0.025 * e, PAL.black);
  }

  R.use('over');
  // speech bubble: "ME?"
  const bub = slam(t, 5.0, 0.3, 0.12);
  if (bub > 0 && t < 6.0) {
    const bx = 1.55, by = 0.15;
    wedge(R, 0.6, -0.4, bx - 0.3, by - 0.1, 0.2 * bub, PAL.black);
    disc(R, bx, by, 0.82 * bub, PAL.black, 1, 0.52 * bub);
    disc(R, bx, by, 0.74 * bub, PAL.cream, 1, 0.45 * bub);
    txt(R, 'ME?', bx, by, 0.42 * bub, PAL.black);
  }
  slogan(R, t, 0.5, 'COMRADES!', 0, 3.0, 1.45, PAL.red, { shadow: [0.07, -0.07, PAL.black] });
  txt(R, 'THIS HUMBLE SAND', 0, 1.9, 0.55, PAL.black, { n: typed(t, 1.5, 0.1) });
  slogan(R, t, 6.0, 'SHALL BECOME A GPU!', 0, 1.12, 0.52, PAL.red);
  R.use('add');
}

// ---------------------------------------------------------------- 2 · purify (8–16 s)
const LAT = { cols: 7, rows: 5, sp: 0.95, x: -4.15, y: -0.55 };
const IMPURE = [[1, 0], [4, 1], [2, 3], [6, 2], [0, 2], [5, 4], [3, 1], [1, 4]]; // in ejection order
function scenePurify(R, t, u, sec) {
  begin(R, t, sec, PAL.paper, 1);
  posterCam(R, 1.0 + 0.03 * u / 8);
  const heat = sstep(13.6, 15.8, t);
  const shakeA = heat * 0.07;

  // red diagonal slab behind the counter (constructivist wedge on the right)
  const slab = ease.outExpo(range(t, 8.0, 8.5));
  rect(R, mix(12, 3.9, slab), 0.3, 5.3, 1.05, PAL.red, 1, 0.1);
  wedge(R, mix(8, 0.2, slab), -1.05, mix(16, 7.9, slab), -0.25, 0.32, PAL.black, 1);

  // lattice: bonds, then atoms
  const site = (c, r) => [LAT.x + (c - (LAT.cols - 1) / 2) * LAT.sp, LAT.y + (r - (LAT.rows - 1) / 2) * LAT.sp];
  const jig = (c, r) => [noise1(t * 9 + c * 3.1 + r * 7.7, 3) * shakeA, noise1(t * 9 + c * 5.3 + r * 2.9, 5) * shakeA];
  const bondCol = cmix(PAL.steelD, PAL.orange, heat * 0.8);
  for (let r = 0; r < LAT.rows; r++) for (let c = 0; c < LAT.cols; c++) {
    const [x, y] = site(c, r);
    if (c < LAT.cols - 1) bar(R, x, y, x + LAT.sp, y, 0.05, bondCol);
    if (r < LAT.rows - 1) bar(R, x, y, x, y + LAT.sp, 0.05, bondCol);
  }
  const base = cmix(PAL.steel, PAL.orange, heat), light = cmix(PAL.steelL, PAL.gold, heat), dark = cmix(PAL.steelD, PAL.redD, heat);
  for (let r = 0; r < LAT.rows; r++) for (let c = 0; c < LAT.cols; c++) {
    const [x, y] = site(c, r), [jx, jy] = jig(c, r);
    const k = IMPURE.findIndex(([ic, ir]) => ic === c && ir === r);
    if (k < 0) { ball(R, x + jx, y + jy, 0.3, base, light, dark); continue; }
    const te = EJECT[k], tau = t - te;
    if (tau < 0) {
      // a shifty impurity, eyes darting
      disc(R, x + jx, y + jy, 0.3, PAL.black);
      const dart = Math.sin(t * 6 + k) > 0 ? 0.05 : -0.05;
      disc(R, x - 0.1 + dart, y + 0.05, 0.065, PAL.cream); disc(R, x + 0.1 + dart, y + 0.05, 0.065, PAL.cream);
    } else {
      if (tau < 1.2) {
        const side = k % 2 ? 1 : -1;
        const fx = x + side * (1.5 + hash1(k) * 1.5) * tau * 2, fy = y + 9 * tau - 7 * tau * tau;
        disc(R, fx, fy, 0.3, PAL.black);
        disc(R, fx - 0.1, fy + 0.05, 0.08, PAL.cream); disc(R, fx + 0.1, fy + 0.05, 0.08, PAL.cream);
      }
      const pop = ease.outBack(range(tau, 0.12, 0.35));
      if (pop > 0) ball(R, x + jx, y + jy, 0.3 * pop, base, light, dark);
    }
  }
  if (heat > 0) { // the lattice glows as it melts
    R.use('add');
    for (let r = 0; r < LAT.rows; r++) for (let c = 0; c < LAT.cols; c++) {
      const [x, y] = site(c, r);
      R.sprite([x, y, 0], 0.75, HOT.orange, heat * heat * 0.12, 0);
    }
    R.use('under');
  }

  R.use('over');
  slogan(R, t, 8.25, 'IMPURITIES: OUT!', LAT.x, 2.25, 0.5, PAL.red, { shadow: [0.04, -0.04, PAL.black] });
  // the purity counter
  const n = EJECT.filter((x) => t >= x).length;
  const digits = n === 0 ? '97.3' : (() => { const s = '9'.repeat(n + 1); return s.length > 2 ? s.slice(0, 2) + '.' + s.slice(2) : s; })();
  const lastPop = n ? 1 + 0.6 * Math.exp(-(t - EJECT[n - 1]) * 14) : 1;
  const L = digits.length;
  txt(R, 'PURITY', 0.55, 1.95, 0.42, PAL.black, { align: -1, rot: 0.1, n: typed(t, 8.1, 0.06) });
  txt(R, digits + '%', 0.4, 0.3, 0.88, PAL.cream, {
    align: -1, rot: 0.1, alpha: sstep(8.2, 8.35, t),
    fx: (i, ch, s) => { if (i === L - 1 && n) { s.scale = lastPop; s.color = PAL.gold; } },
  });
  slogan(R, t, 13.0, 'NINE NINES FOR THE MOTHERBOARD!', 3.6, -1.75, 0.34, PAL.black, { rot: 0.1 });
  slogan(R, t, 14.0, 'NOW MELT IT DOWN!', LAT.x, -3.55, 0.5, PAL.red, { shadow: [0.04, -0.04, PAL.black] });
  R.use('add');
}

// ---------------------------------------------------------------- 3 · grow (16–24 s)
function sceneGrow(R, t, u, sec) {
  begin(R, t, sec, PAL.red, 2);
  const kick = kickPulse(t);
  posterCam(R, 1.02 - 0.02 * ease.outCubic(range(t, 16, 17)) + kick * 0.004);
  sunburst(R, 0, -2.7, 24, 18, 0.05 * t + 0.4 * ease.outExpo(range(t, 16, 16.8)), PAL.redL);

  // crucible + melt
  const MY = -2.7;
  rect(R, 0, -3.8, 2.9, 1.1, PAL.black);
  disc(R, 0, MY, 2.95, PAL.black, 1, 0.62);
  disc(R, 0, MY, 2.65, PAL.orange, 1, 0.48);

  // the crystal: seed rod, cone, body, rotating facets, growth rings
  const sy = mix(-2.4, 3.6, Math.pow(range(t, 16.0, 23.6), 0.92));
  const Rb = 1.25 * ease.outCubic(range(t, 16.0, 17.0));
  const coneTop = sy + 0.85 * Rb / 1.25 + 0.1;
  bar(R, 0, coneTop - 0.05, 0, 6, 0.06, PAL.black);
  rect(R, 0, coneTop + 0.1, 0.16, 0.12, PAL.black);
  if (sy > MY) {
    const hh = (sy - MY) / 2, cy = (sy + MY) / 2;
    rect(R, 0, cy, Rb, hh, PAL.steel);
    rect(R, -Rb * 0.81, cy, Rb * 0.19, hh, PAL.steelD);
    rect(R, Rb * 0.34, cy, Rb * 0.09, hh, PAL.steelL);
    for (let k = 0; k < 5; k++) {
      const ph = t * 2.4 + (k * TAU) / 5;
      if (Math.cos(ph) > 0) rect(R, Rb * 0.88 * Math.sin(ph), cy, 0.022, hh, PAL.steelL, 0.55 * Math.cos(ph));
    }
    for (let j = 0; j < 14; j++) {
      const ry = sy - 0.45 - j * 0.55;
      if (ry > MY + 0.1) rect(R, 0, ry, Rb * 0.98, 0.018, PAL.steelD, 0.4);
    }
  }
  wedge(R, 0, coneTop, 0, sy, Rb, PAL.steel);
  wedge(R, Rb * 0.05, coneTop, Rb * 0.32, sy, Rb * 0.1, PAL.steelL);
  // meniscus glow + rising sparks
  R.use('add');
  R.sprite([0, MY + 0.05, 0], 1.0, HOT.orange, 0.22 + kick * 0.06, 0, 0, 2.7);
  for (let i = 0; i < 26; i++) {
    const ph = fract(t * (0.5 + hash1(i) * 0.6) + hash1(i + 50));
    const sx = (hash1(i + 9) * 2 - 1) * 2.3 + Math.sin(t * 3 + i) * 0.1;
    R.sprite([sx, MY + ph * 2.2, 0], 0.06, HOT.gold, (1 - ph) * 0.5, 3);
  }
  R.use('under');

  R.use('over');
  slogan(R, t, 16.5, 'PULL', -7.45, 1.75, 1.5, PAL.cream, { align: -1, shadow: [0.08, -0.08, PAL.black] });
  slogan(R, t, 17.0, 'TOGETHER,', -7.45, 0.55, 0.72, PAL.cream, { align: -1, shadow: [0.05, -0.05, PAL.black] });
  slogan(R, t, 17.5, 'COMRADES!', -7.45, -0.35, 0.72, PAL.gold, { align: -1, shadow: [0.05, -0.05, PAL.black] });
  const items = ['1 CRYSTAL', '0 GRAIN BOUNDARIES', '100% DISCIPLINE'];
  items.forEach((s, k) => {
    const t0 = LIST3[k];
    if (t < t0) return;
    const y = 1.55 - k * 0.78, pop = slam(t, t0, 1.5, 0.1);
    star(R, 2.2, y, 0.2 * pop, PAL.gold, 1, 0);
    txt(R, s, 2.6, y, 0.42, PAL.cream, { align: -1, font: 'cond', n: typed(t, t0, 0.03), shadow: [0.03, -0.03, PAL.black] });
  });
  // diameter callout
  const dimA = sstep(19.6, 19.9, t);
  if (dimA > 0) {
    const y = -1.5;
    bar(R, -Rb, y, Rb, y, 0.025, PAL.black, dimA);
    bar(R, -Rb, y - 0.15, -Rb, y + 0.15, 0.025, PAL.black, dimA);
    bar(R, Rb, y - 0.15, Rb, y + 0.15, 0.025, PAL.black, dimA);
    txt(R, '⌀ 300 MM', 0, y + 0.32, 0.32, PAL.black, { font: 'cond', alpha: dimA });
  }
  txt(R, 'CZOCHRALSKI PROCESS · EST. 1916', 7.5, -4.1, 0.22, PAL.cream, { align: 1, font: 'cond', alpha: 0.85 * sstep(21.3, 21.6, t), tracking: 0.03 });
  R.use('add');
}

// ---------------------------------------------------------------- 4 · slice (24–30 s)
function sceneSlice(R, t, u, sec) {
  begin(R, t, sec, PAL.paper, 3);
  posterCam(R, 1);
  const out = ease.inOutCubic(range(t, 29.15, 29.95)); // final wafer takes centre stage
  sunburst(R, 3.6, 0.4, 18, 14, -0.05 * t, PAL.paper2, 1 - out);

  // ingot, fed to the wire after every cut
  const done = CUTS.filter((c) => t >= c).length;
  const feed = done ? 0.16 * (1 - ease.outCubic(range(t, CUTS[done - 1] + 0.05, CUTS[done - 1] + 0.25))) : 0;
  const endX = -0.6 - feed - out * 9, IY = 0.4, IR = 1.15;
  rect(R, (endX - 10) / 2, IY, (endX + 10) / 2, IR, PAL.steel);
  rect(R, (endX - 10) / 2, IY + IR * 0.62, (endX + 10) / 2, IR * 0.1, PAL.steelL);
  rect(R, (endX - 10) / 2, IY - IR * 0.8, (endX + 10) / 2, IR * 0.2, PAL.steelD);
  for (let k = 0; k < 16; k++) { const x = endX - 0.5 - k * 0.6; rect(R, x, IY, 0.018, IR, PAL.steelD, 0.35); }
  disc(R, endX, IY, 0.34, PAL.steelL, 1, IR);

  // diamond wire saw with its two pulleys
  const WX = -0.76, sawA = 1 - out;
  bar(R, WX, -3.6, WX, 3.6, 0.025, PAL.black, sawA);
  gear(R, WX, 3.6, 0.55, PAL.black, sawA, t * 5, 9);
  gear(R, WX, -3.6, 0.55, PAL.black, sawA, -t * 5, 9);
  // cutting spark travels down through the ingot before each cut
  const nextCut = CUTS[done];
  if (nextCut !== undefined && t > nextCut - 0.42 && out === 0) {
    const p = range(t, nextCut - 0.42, nextCut);
    const y = IY + IR - p * 2 * IR;
    R.use('add');
    R.sprite([WX, y, 0], 0.32, HOT.gold, 0.5, 4);
    for (let i = 0; i < 6; i++) {
      const ph = fract(t * 4 + i / 6);
      R.sprite([WX + 0.15 + ph * 0.8 * (0.5 + hash1(i)), y - ph * ph * 0.8, 0], 0.04, HOT.gold, 1 - ph, 3);
    }
    R.use('under');
  }

  // wafers hop off and line up like coins
  for (let k = 0; k < done; k++) {
    const tau = range(t, CUTS[k], CUTS[k] + 0.45), arc = Math.sin(Math.PI * tau);
    let x = mix(-0.68, 1.15 + k * 0.6, ease.outBack(tau)), y = IY + arc * 1.3;
    let rx = 0.2 + arc * 0.8, ry = IR, a = 1;
    if (k === CUTS.length - 1) {
      x = mix(x, WAFER.x, out); y = mix(y, WAFER.y, out);
      rx = mix(rx, WAFER.r, out); ry = mix(ry, WAFER.r, out);
    } else a = 1 - out;
    disc(R, x + 0.04, y, rx + 0.04, PAL.steelD, a, ry);
    disc(R, x, y, rx, PAL.steelL, a, ry);
    if (rx > 0.3 && rx < 1.2) disc(R, x - rx * 0.25, y + ry * 0.3, rx * 0.3, PAL.cream, a * 0.6 * (1 - out), ry * 0.18);
  }

  R.use('over');
  const ta = 1 - out;
  slogan(R, t, 24.25, 'ONE INGOT —', 3.7, 3.15, 0.72, PAL.black, { alpha: ta });
  slogan(R, t, 25.0, 'MANY WAFERS!', 3.7, 2.3, 0.72, PAL.red, { alpha: ta, shadow: [0.04, -0.04, PAL.black] });
  if (done) txt(R, `WAFERS: ${String(done).padStart(2, '0')}`, 3.85, -1.45, 0.4, PAL.black, { font: 'cond', alpha: ta, tracking: 0.04 });
  slogan(R, t, 27.5, 'NO WAFER LEFT BEHIND!', 3.85, -2.45, 0.42, PAL.red, { alpha: ta });
  R.use('add');
}

// ---------------------------------------------------------------- 5 · print (30–40 s)
function scenePrint(R, t, u, sec) {
  begin(R, t, sec, PAL.black, 4);
  // zoom into the central die at the end
  const D0 = DIES.reduce((b, d) => (Math.hypot(d.x - WAFER.x, d.y - WAFER.y) < Math.hypot(b.x - WAFER.x, b.y - WAFER.y) ? d : b), DIES[0]);
  const z = ease.inOutCubic(range(t, 38.0, 40.0));
  posterCam(R, mix(1, 7, z * z), mix(0, D0.x, z), mix(0, D0.y, z));
  R.post.vignette = 0.6;
  sunburst(R, WAFER.x, WAFER.y, 20, 16, 0.03 * t, PAL.char);

  // wafer
  disc(R, WAFER.x, WAFER.y, WAFER.r + 0.05, PAL.steelD);
  disc(R, WAFER.x, WAFER.y, WAFER.r - 0.05, PAL.steel);
  disc(R, WAFER.x, WAFER.y - WAFER.r, 0.13, PAL.black);
  const flood = range(t, 35.5, 37.5);
  for (const d of DIES) {
    const row = ROWS.indexOf(d.j);
    const e1 = EXPO1[row], e2 = EXPO2[row];
    rect(R, d.x, d.y, 0.3, 0.3, PAL.steelD);
    if (t >= e1) {
      const pop = 1 + 0.25 * Math.exp(-(t - e1) * 12);
      rect(R, d.x, d.y, 0.27 * pop, 0.27 * pop, PAL.gold);
      rect(R, d.x, d.y, 0.22, 0.22, PAL.char);
    }
    if (t >= e2) {
      const hue = flood > 0 && flood < 1 ? Math.floor(t * 16 + d.h * 3) % 3 : 0;
      const c = [PAL.red, PAL.gold, PAL.cream][hue];
      rect(R, d.x, d.y + 0.08, 0.17, 0.035, c);
      rect(R, d.x - 0.08, d.y - 0.06, 0.035, 0.11, c);
      rect(R, d.x + 0.09, d.y - 0.07, 0.06, 0.06, PAL.red);
    }
  }

  // the reticle and the light of 13.5 nm, row by row
  const rowY = (k) => WAFER.y - ROWS[k] * 0.66;
  let beamRow = -1, beamK = 0;
  const lit = (list) => { const i = lastIndex(list, t); return i >= 0 && t - list[i] < 0.24 ? i : -1; };
  const r1 = lit(EXPO1), r2 = lit(EXPO2);
  if (r1 >= 0) { beamRow = r1; beamK = pulse(EXPO1, t, 9); }
  if (r2 >= 0) { beamRow = r2; beamK = pulse(EXPO2, t, 9); }
  if (flood > 0 && flood < 1) { beamRow = Math.floor(fract(flood * 5) * ROWS.length); beamK = 0.7; }
  const RX = WAFER.x, RY = 3.85;
  rect(R, RX, RY, 1.0, 0.3, PAL.cream);
  rect(R, RX, RY, 0.92, 0.22, PAL.black);
  for (let k = 0; k < 4; k++) rect(R, RX - 0.6 + k * 0.4, RY, 0.08, 0.14, PAL.gold);
  R.use('add');
  if (beamRow >= 0) {
    const y = rowY(beamRow), half = Math.sqrt(Math.max(0, WAFER.r ** 2 - (y - WAFER.y) ** 2)) - 0.2;
    const k = 0.35 + beamK * 0.65;
    R.line([RX, RY - 0.3, 0], [RX, y, 0], cmul(HOT.gold, 0.5 * k), cmul(HOT.gold, 0.8 * k), 0.28);
    R.line([RX - half, y, 0], [RX + half, y, 0], cmul(HOT.gold, 0.9 * k), cmul(HOT.gold, 0.9 * k), 0.24);
  }
  R.use('under');

  R.use('over');
  const ta = 1 - z;
  slogan(R, t, 30.25, 'THE LIGHT OF', 4.3, 3.0, 0.48, PAL.cream, { alpha: ta });
  slogan(R, t, 30.75, '13.5 NM', 4.3, 1.85, 1.3, PAL.gold, { alpha: ta });
  slogan(R, t, 31.5, 'SHOWS THE WAY!', 4.3, 0.75, 0.55, PAL.red, { alpha: ta });
  if (t >= 33) {
    const layer = t < 35.5 ? (t < EXPO2[0] ? 1 : 2) : Math.min(80, 2 + Math.floor(78 * ease.inCubic(flood)));
    txt(R, `LAYER ${String(layer).padStart(2, '0')} / 80`, 4.3, -0.35, 0.46, PAL.cream, { font: 'cond', alpha: ta, tracking: 0.05 });
  }
  slogan(R, t, 37.0, 'FULFIL THE FIVE-YEAR PLAN', 4.3, -1.55, 0.3, PAL.cream, { alpha: ta });
  slogan(R, t, 37.5, 'IN THREE NANOMETRES!', 4.3, -2.25, 0.42, PAL.gold, { alpha: ta });
  txt(R, 'EXTREME ULTRAVIOLET · INVISIBLE TO SPIES', WAFER.x, -4.08, 0.25, PAL.steelL, { font: 'cond', alpha: ta * sstep(32, 32.4, t), tracking: 0.05 });
  R.use('add');
}

// ---------------------------------------------------------------- 6 · inspect (40–46 s)
const GRID6 = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) GRID6.push({ x: (c - 2) * 2.6, y: r === 0 ? 0.65 : -1.95 });
const VISIT = [0, 1, 2, 3, 4, 9, 8, 7, 5, 6]; // die 6 is the flawed one, inspected last
function sceneInspect(R, t, u, sec) {
  begin(R, t, sec, PAL.paper, 5);
  const push = ease.inOutCubic(range(t, 44.2, 46.0));
  posterCam(R, 1 + push * 0.12, GRID6[6].x * push * 0.1, GRID6[6].y * push * 0.1);
  halftone(R, -8.2, -4.7, 8.2, -2.4, 0.3, 0.13, PAL.paper2, 1, (x, y) => 1 - y);

  GRID6.forEach((g, i) => drawDie(R, g.x, g.y, 1.12, 1, i === 6 ? 1 : 0));

  // stamps
  R.use('over');
  VISIT.slice(0, 9).forEach((i, k) => {
    const g = GRID6[i];
    rubberStamp(R, t, APPROVE[k], 'APPROVED', g.x + 0.05, g.y - 0.1, 0.32, PAL.red, -0.22 + (hash1(i) - 0.5) * 0.2, { alpha: 1, back: PAL.cream });
  });
  const bad = GRID6[6], k6 = slam(t, REASSIGN, 1.8, 0.1);
  if (k6 > 0) {
    const rot = 0.14;
    rect(R, bad.x + 0.35, bad.y, 2.05 * k6, 0.68 * k6, PAL.cream, 1, rot);
    box(R, bad.x + 0.35, bad.y, 2.05 * k6, 0.68 * k6, 0.04 * k6, PAL.black, 1, rot);
    txt(R, 'REASSIGNED', bad.x + 0.35 - Math.sin(rot) * 0.2, bad.y + Math.cos(rot) * 0.2, 0.42 * k6, PAL.black, { rot });
    txt(R, 'TO THE MID-RANGE', bad.x + 0.35 + Math.sin(rot) * 0.28, bad.y - Math.cos(rot) * 0.28, 0.27 * k6, PAL.black, { rot, font: 'cond' });
  }

  // the people's magnifying glass, visiting each die just before its stamp
  const when = APPROVE.concat([REASSIGN]);
  let mx, my;
  const kk = lastIndex(when, t + 0.32);
  if (kk < 0) { mx = -8.5 + 3.3 * ease.outCubic(range(t, 40, 40.5)); my = 0.65; }
  else {
    const a = GRID6[VISIT[Math.max(0, kk - 1)]], b = GRID6[VISIT[kk]];
    const m = ease.inOutCubic(range(t, when[kk] - 0.32, when[kk] - 0.06));
    mx = kk === 0 ? mix(-5.2, b.x, m) : mix(a.x, b.x, m); my = kk === 0 ? b.y : mix(a.y, b.y, m);
  }
  const away = ease.inCubic(range(t, 44.6, 45.2));
  mx += 0.55 + away * 6; my += 0.5 - away * 5;
  bar(R, mx + 0.55, my - 0.55, mx + 1.35, my - 1.35, 0.13, PAL.black);
  disc(R, mx, my, 0.78, PAL.cream, 0.25);
  ringC(R, mx, my, 0.82, PAL.black, 1, 0.14);

  slogan(R, t, 40.25, 'QUALITY CONTROL!', 1.4, 3.05, 0.7, PAL.red, { shadow: [0.04, -0.04, PAL.black] });
  txt(R, 'THE PEOPLE’S MICROSCOPE SEES ALL', 1.4, 2.3, 0.3, PAL.black, { font: 'cond', n: typed(t, 40.6, 0.025), tracking: 0.03 });
  slogan(R, t, 44.6, '* BINNING: SLIGHTLY FLAWED DIES ARE SOLD AS CHEAPER MODELS', 0, -3.7, 0.28, PAL.black, { font: 'cond', tracking: 0.02, from: 1.2 });
  R.use('add');
}

// ---------------------------------------------------------------- 7 · assemble (46–54 s)
function drawFan(R, x, y, r, spin) {
  disc(R, x, y, r, PAL.black);
  ringC(R, x, y, r, PAL.steelD, 1, 0.07);
  for (let k = 0; k < 9; k++) {
    const a = spin + (k * TAU) / 9;
    wedge(R, x, y, x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86, r * 0.22, PAL.steel);
  }
  disc(R, x, y, r * 0.3, PAL.steelD);
  star(R, x, y, r * 0.22, PAL.red, 1, 0);
}
function sceneAssemble(R, t, u, sec) {
  begin(R, t, sec, PAL.red, 6);
  const kick = kickPulse(t);
  const card = ease.inOutCubic(range(t, 49.0, 49.7));
  posterCam(R, 1 + kick * 0.006);
  sunburst(R, 0, -0.2, 22, 18, 0.06 * t + 0.5 * ease.outExpo(range(t, 46, 46.8)), PAL.redL);

  // shockwave of the landing die
  const sw = range(t, 46.0, 46.6);
  if (sw > 0 && sw < 1) ringC(R, 0, 0.1, mix(1.4, 4.5, ease.outCubic(sw)), PAL.cream, 0.8 * (1 - sw), 0.06);

  const cy = mix(-6, -0.55, card) + Math.sin(t * 2.2) * 0.04 * sstep(50.5, 51.5, t);
  const tilt = -0.03 * sstep(50.5, 51.5, t);
  // the card: PCB, bracket, fingers, shroud (closing over the package), fans
  if (card > 0) {
    withT({ x: 0, y: cy, s: 1, r: tilt }, () => {
      rect(R, -0.4, -1.75, 2.4, 0.18, PAL.gold);
      for (let k = 0; k < 16; k++) rect(R, -2.65 + k * 0.3, -1.75, 0.02, 0.18, PAL.goldD);
      rect(R, -5.85, 0, 0.2, 1.95, PAL.steel);
      for (let k = 0; k < 5; k++) rect(R, -5.85, -1.1 + k * 0.55, 0.08, 0.18, PAL.steelD);
      rect(R, 0, -0.1, 5.6, 1.55, PAL.black);
    });
  }
  // package: substrate, die, six HBM stacks. Shrinks into the card at 49 s.
  const pk = mix(1, 0.34, card), py = mix(0.15, -0.55, card);
  withT({ x: 0, y: py, s: pk }, () => {
    rect(R, 0, 0, 2.35, 1.75, PAL.olive);
    for (let k = 0; k < 13; k++) {
      disc(R, -2.1 + k * 0.35, -1.55, 0.06, PAL.gold); disc(R, -2.1 + k * 0.35, 1.55, 0.06, PAL.gold);
    }
    const s = slam(t, 46.0, 1.8, 0.12);
    if (s > 0) withT({ x: PT.x, y: PT.y, s: PT.s * s }, () => drawDie(R, 0, 0, 0.95));
    HBM.forEach((h, k) => {
      const side = k % 2 ? 1 : -1, slot = Math.floor(k / 2);
      const m = ease.outBack(range(t, h, h + 0.3));
      if (m <= 0) return;
      const x = mix(side * 9, side * 1.6, m), y = 0.9 - slot * 0.9;
      rect(R, x, y, 0.42, 0.36, PAL.steel);
      for (let j = 0; j < 4; j++) rect(R, x, y - 0.24 + j * 0.16, 0.42, 0.02, PAL.steelD);
      txt(R, 'HBM', x, y, 0.2, PAL.black, { font: 'cond' });
    });
  });

  if (card > 0) {
    // shroud halves slide shut over the package, then the fans spin up
    const close = ease.outExpo(range(t, CLOSE - 0.25, CLOSE));
    withT({ x: 0, y: cy, s: 1, r: tilt }, () => {
      const L = mix(-11.5, 0, close), Rr = mix(11.5, 0, close);
      rect(R, L - 2.8, 0.05, 2.8, 1.62, PAL.char);
      rect(R, Rr + 2.8, 0.05, 2.8, 1.62, PAL.char);
      rect(R, L - 2.8, 1.56, 2.8, 0.11, PAL.redD);
      rect(R, Rr + 2.8, 1.56, 2.8, 0.11, PAL.redD);
      if (close > 0.98) {
        const spin = 7 * Math.max(0, t - CLOSE);
        drawFan(R, -2.75, 0.05, 1.35, spin);
        drawFan(R, 2.75, 0.05, 1.35, -spin * 1.1);
        star(R, 0, 0.05, 0.6, PAL.gold, 1, 0);
        txt(R, 'ГПУ-1', 0, -1.1, 0.26, PAL.gold, { font: 'cond', tracking: 0.08 });
      }
    });
  }

  // the people's arm, holding it aloft
  const arm = ease.outCubic(range(t, 50.4, 51.1));
  if (arm > 0) {
    const ay = mix(-4.5, 0, arm);
    bar(R, 2.4, -6.5 + ay, 1.4, -4.2 + ay, 0.62, PAL.char);
    bar(R, 1.55, -4.6 + ay, 0.55, -2.75 + ay, 0.42, PAL.black);
    rect(R, 0.45, -2.45 + ay, 0.55, 0.33, PAL.black, 1, -0.08);
    for (let k = 0; k < 4; k++) disc(R, 0.02 + k * 0.29, -2.12 + ay - k * 0.02, 0.15, PAL.black);
  }

  R.use('over');
  slogan(R, t, 47.0, 'HIGH-BANDWIDTH COMRADES', 0, 3.2, 0.4, PAL.cream, { alpha: 1 - sstep(49.8, 50.1, t), shadow: [0.03, -0.03, PAL.black] });
  slogan(R, t, 48.5, 'REPORT FOR DUTY!', 0, 2.5, 0.52, PAL.gold, { alpha: 1 - sstep(49.8, 50.1, t), shadow: [0.04, -0.04, PAL.black] });
  slogan(R, t, 50.5, 'GLORY TO THE GPU!', 0, 3.05, 0.82, PAL.cream, { shadow: [0.06, -0.06, PAL.black] });
  slogan(R, t, 51.25, 'СЛАВА ВИДЕОКАРТЕ!', 0, 2.25, 0.42, PAL.gold, { font: 'cond', tracking: 0.06 });
  slogan(R, t, 52.0, '80 BILLION TRANSISTORS · EVERY ONE A HERO', 0, 1.6, 0.3, PAL.cream, { font: 'cond', tracking: 0.04 });
  txt(R, '* NOT TO BE CONFUSED WITH THE OTHER ГПУ', -7.6, -4.1, 0.25, PAL.cream, { align: -1, font: 'cond', alpha: 0.8 * sstep(52.6, 52.9, t), tracking: 0.04 });
  R.use('add');
}

// ---------------------------------------------------------------- 8 · multiply (54–60 s)
const MA = [[2, 1, 3], [0, 4, 1], [5, 2, 2]], MB = [[1, 3, 0], [2, 1, 4], [3, 0, 2]];
const MC = MA.map((row, i) => MB[0].map((_, j) => row.reduce((s, a, k) => s + a * MB[k][j], 0)));
function drawMatrix(R, x, y, M, cell, fillFn) {
  const n = 3, w = n * cell;
  for (const sx of [-1, 1]) {
    bar(R, x + sx * (w / 2 + 0.12), y - w / 2 - 0.05, x + sx * (w / 2 + 0.12), y + w / 2 + 0.05, 0.035, PAL.black);
    bar(R, x + sx * (w / 2 + 0.12), y + w / 2 + 0.05, x + sx * (w / 2 - 0.05), y + w / 2 + 0.05, 0.035, PAL.black);
    bar(R, x + sx * (w / 2 + 0.12), y - w / 2 - 0.05, x + sx * (w / 2 - 0.05), y - w / 2 - 0.05, 0.035, PAL.black);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = x + (j - 1) * cell, cy = y - (i - 1) * cell;
    const f = fillFn(i, j);
    if (f.bg) rect(R, cx, cy, cell * 0.44 * f.k, cell * 0.44 * f.k, f.bg);
    if (f.label) txt(R, String(M[i][j]), cx, cy, cell * 0.5 * f.k, f.fg, { font: 'post' });
  }
}
function sceneMultiply(R, t, u, sec) {
  begin(R, t, sec, PAL.paper, 7);
  const kick = kickPulse(t);
  posterCam(R, 1 + 0.04 * ease.outCubic(range(t, 56, 59)));
  R.post.fade = sstep(59.1, 60, t);
  sunburst(R, 0, 1.75, 24, 16, -0.04 * t + 0.4 * ease.outExpo(range(t, 56, 56.8)), PAL.paper2);
  const big = ease.outBack(range(t, 56.0, 56.35));
  if (big > 0) disc(R, 0, 1.75, 2.55 * big + kick * 0.05, PAL.red, 1);
  starBurst(R, t, 56.0, 0, 1.75, 30, [PAL.gold, PAL.red, PAL.black], 7, 8);

  // A × B = C, one cell of C per step; its row of A and column of B light up
  const cell = 0.56, my = -2.05;
  const filled = CELLS.filter((c) => t >= c).length;
  const cur = filled - 1, ci = Math.floor(cur / 3), cj = cur % 3;
  const hot = cur >= 0 && cur < 9 && t - CELLS[cur] < 0.36;
  const appear = (x0) => ease.outBack(range(t, x0, x0 + 0.25));
  drawMatrix(R, -4.6, my, MA, cell, (i) => ({ bg: hot && i === ci ? PAL.red : PAL.black, fg: PAL.cream, label: true, k: appear(54.1) }));
  drawMatrix(R, -1.0, my, MB, cell, (i, j) => ({ bg: hot && j === cj ? PAL.red : PAL.black, fg: PAL.cream, label: true, k: appear(54.2) }));
  drawMatrix(R, 3.9, my, MC, cell, (i, j) => {
    const k = i * 3 + j, on = k < filled;
    const pop = on ? 1 + 0.35 * Math.exp(-(t - CELLS[k]) * 12) : 1;
    return { bg: on ? PAL.gold : PAL.paper2, fg: PAL.black, label: on, k: appear(54.3) * pop };
  });

  R.use('over');
  txt(R, '×', -2.8, my, 0.7 * appear(54.15), PAL.black);
  txt(R, '=', 1.25, my, 0.7 * appear(54.25), PAL.black);
  slogan(R, t, 54.25, 'WORKERS OF THE WORLD,', 0, 3.6, 0.55, PAL.black);
  slogan(R, t, 56.0, 'MULTIPLY!', 0, 1.75, 1.45, PAL.cream, { shadow: [0.08, -0.08, PAL.black], from: 2.2 });
  txt(R, 'МАТРИЦЫ ВСЕХ СТРАН, ПЕРЕМНОЖАЙТЕСЬ!', 0, 0.35, 0.36, PAL.black, { font: 'cond', n: typed(t, 56.6, 0.03), tracking: 0.03 });
  txt(R, 'NO SAND WAS HARMED IN THE MAKING OF THIS GPU', 0, -3.85, 0.22, PAL.char, { font: 'cond', alpha: sstep(57.8, 58.1, t), tracking: 0.05 });
  R.use('add');
}

// ---------------------------------------------------------------- definition
const CYR = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя';
defineVideo({
  title: 'Sand to GPU',
  eyebrow: 'a five-year plan in sixty seconds',
  subtitle: 'From humble sand to glorious GPU: purify, grow, slice, print, inspect, assemble, multiply.',
  endMessage: 'Workers of the world, multiply!',
  score: SCORE,
  hud: false,
  fonts: Object.assign({}, FONT_STACKS, {
    post: { weight: 400, stack: '"Russo One", "Oswald", system-ui, sans-serif' },
    cond: { weight: 700, stack: '"Oswald", "Russo One", system-ui, sans-serif' },
  }),
  fontLoads: ['700 56px "JetBrains Mono"', ['400 56px "Russo One"', CYR + '⌀×·—'], ['700 56px "Oswald"', CYR + '⌀×·—’']],
  sections: [
    { name: 'sand', t0: 0, scene: 'sceneSand' },
    { name: 'purify', t0: 8, scene: 'scenePurify' },
    { name: 'grow', t0: 16, scene: 'sceneGrow' },
    { name: 'slice', t0: 24, scene: 'sceneSlice' },
    { name: 'print', t0: 30, scene: 'scenePrint' },
    { name: 'inspect', t0: 40, scene: 'sceneInspect' },
    { name: 'assemble', t0: 46, scene: 'sceneAssemble' },
    { name: 'multiply', t0: 54, scene: 'sceneMultiply' },
  ],
});
