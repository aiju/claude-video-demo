'use strict';
// 16-24 s: the drop. Token vectors explode into a 3D "embedding space" galaxy;
// the camera visits word clusters (with their famous vector arithmetic).

const CLUSTERS = [
  { name: 'animals', c: [9, 2.5, -4], col: COL.mint, words: [['cat', [0, 0, 0]], ['Katze', [1.0, 0.55, 0.3]], ['猫', [0.25, -0.8, 0.7]], ['ねこ', [-0.8, 0.45, 0.6]], ['dog', [2.6, -1.1, -0.7]], ['Hund', [3.4, -0.4, -0.3]], ['犬', [2.8, -1.8, 0.3]]] },
  { name: 'royalty', c: [-9, 3.5, -2], col: COL.amber, words: [['king', [0, 0, 0]], ['queen', [2.6, 0.2, 0.3]], ['man', [-0.3, -2.3, 0.9]], ['woman', [2.3, -2.1, 1.2]]] },
  { name: 'numbers', c: [2, -7.5, -6], col: COL.cyan, words: [['1', [-2, 0, 0]], ['2', [-1.2, 0.1, 0.1]], ['3', [-0.4, 0.2, 0.1]], ['7', [0.8, 0.3, 0]], ['42', [2.2, 0.5, -0.2]], ['π', [0.2, -1.2, 0.6]]] },
  { name: 'feelings', c: [-4, -5.5, 6.5], col: COL.magenta, words: [['joy', [0, 0, 0]], ['Freude', [0.9, 0.4, 0.4]], ['love', [-1.2, 0.8, -0.2]], ['hope', [0.4, -1.0, 0.8]]] },
  { name: 'meaning', c: [-2, 6.5, 5], col: COL.violet, words: [['meaning', [0, 0, 0]], ['life', [2.6, -1.6, 0.9]], ['purpose', [-1.6, 1.2, 0.6]], ['why', [0.8, 1.9, -1.0]]] },
  { name: 'function', c: [5.5, -1, 7.5], col: COL.blue, words: [['The', [-1.4, 0.4, 0]], ['of', [1.6, 1.5, -0.8]], ['is', [0.9, -2.0, 1.2]], ['a', [-1.2, 1.6, 0.8]], ['to', [-0.9, -1.4, -1.0]], ['and', [2.3, -0.8, 0.9]]] },
  { name: 'code', c: [12, -5, 1.5], col: COL.coral, words: [['def', [0, 0, 0]], ['return', [1.2, 0.6, 0.3]], ['{}', [-0.8, -0.6, 0.5]], ['=>', [0.5, -1.1, -0.5]]] },
  { name: 'space', c: [-12, -3, -6.5], col: hex('#ff8af0'), words: [['star', [0, 0, 0]], ['galaxy', [1.3, 0.5, 0.2]], ['星', [0.4, -0.9, 0.6]]] },
  { name: '', c: [0, 11, -9], col: hex('#6a7dff'), words: [] },
  { name: '', c: [-7, 10, -11], col: hex('#3dd6ff'), words: [] },
  { name: '', c: [13, 7, 4], col: hex('#ff5fa8'), words: [] },
  { name: '', c: [-14, 6, 7], col: hex('#9dff6a'), words: [] },
];
// Our prompt tokens live in the galaxy too.
const HERO_WORDS = [['function', 'The'], ['meaning', 'meaning'], ['function', 'of'], ['meaning', 'life'], ['function', 'is']];

let GALAXY = null;
function buildGalaxy() {
  const rng = mulberry32(1234);
  const pts = []; // {p, col, size, tw}
  const wordPos = {};
  for (const cl of CLUSTERS) {
    const n = cl.name ? 1100 : 750;
    const sx = 1.4 + rng() * 1.2, sy = 1.0 + rng() * 1.0, sz = 1.2 + rng() * 1.0;
    for (let i = 0; i < n; i++) {
      const g = [gauss(rng) * sx, gauss(rng) * sy, gauss(rng) * sz];
      const d = vlen(g);
      const br = 0.35 + 0.9 * Math.exp(-d * 0.6) + rng() * 0.3;
      pts.push({ p: vadd(cl.c, g), col: cmix(cl.col, COL.white, rng() * 0.25), b: br, size: 0.05 + rng() * 0.09, tw: rng() });
    }
    for (const [w, off] of cl.words) wordPos[cl.name + ':' + w] = vadd(cl.c, off);
  }
  // Filaments between clusters: a faint cosmic web.
  for (let f = 0; f < 22; f++) {
    const a = CLUSTERS[Math.floor(rng() * CLUSTERS.length)].c, b = CLUSTERS[Math.floor(rng() * CLUSTERS.length)].c;
    if (a === b) continue;
    const mid = vadd(vlerp(a, b, 0.5), [gauss(rng) * 3, gauss(rng) * 3, gauss(rng) * 3]);
    for (let i = 0; i < 120; i++) {
      const u = rng();
      const p = vadd(bezier3(a, mid, b, u), [gauss(rng) * 0.35, gauss(rng) * 0.35, gauss(rng) * 0.35]);
      pts.push({ p, col: cmix(COL.violet, COL.cyan, rng()), b: 0.3 + rng() * 0.3, size: 0.04 + rng() * 0.05, tw: rng() });
    }
  }
  for (let i = 0; i < 1800; i++) {
    const d = vnorm([gauss(rng), gauss(rng), gauss(rng)]);
    pts.push({ p: vscale(d, 8 + rng() * 22), col: cmix(COL.blue, COL.white, rng() * 0.5), b: 0.18 + rng() * 0.3, size: 0.05 + rng() * 0.06, tw: rng() });
  }
  const maxR = Math.max(...pts.map((q) => vlen(q.p)));
  for (const q of pts) q.delay = (vlen(q.p) / maxR) * 0.35;
  const heroes = HERO_WORDS.map(([c, w]) => wordPos[c + ':' + w]);
  // Nearest neighbours of each hero for the flickering connection lines.
  const neigh = heroes.map((h) => pts.map((q, i) => [vlen(vsub(q.p, h)), i]).sort((a, b) => a[0] - b[0]).slice(1, 9).map((x) => x[1]));
  GALAXY = { pts, wordPos, heroes, neigh };
}

function galaxyRot(t) { return (t - 16) * 0.06; }

function arrow(R, a, b, col, w, reveal, alpha = 1) {
  if (reveal <= 0) return;
  const tip = vlerp(a, b, reveal);
  R.line(a, tip, col, col, w, alpha * 0.5, alpha);
  const dir = vnorm(vsub(b, a));
  const view = vnorm(vsub(tip, R.cam.pos));
  const side = vnorm(vcross(dir, view));
  const hl = 0.28;
  R.line(tip, vadd(tip, vadd(vscale(dir, -hl), vscale(side, hl * 0.55))), col, col, w, alpha);
  R.line(tip, vadd(tip, vadd(vscale(dir, -hl), vscale(side, -hl * 0.55))), col, col, w, alpha);
}

function sceneGalaxy(R, t) {
  if (!GALAXY) buildGalaxy();
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9), hat = pulse(S.times.hat, t, 25), clap = pulse(S.times.clap, t, 8);
  E.nebula = 0.55; E.stars = 0.9; E.nebA = hex('#3a1670'); E.nebB = hex('#08607a');
  const rot = galaxyRot(t);
  const W = (p) => rotY(p, rot);
  const shot = t < 18 ? 0 : t < 20 ? 1 : t < 22 ? 2 : 3;
  const st = t - (16 + shot * 2);

  // ---- camera ----
  let pos, tgt, fov = 52;
  if (shot === 0) {
    const d = mix(5, 25, ease.outCubic(range(t, 16, 17.9)));
    pos = rotY([0, mix(0.5, 6, range(t, 16, 18)), d], 0.2 + st * 0.12); tgt = [0, 0, 0];
  } else if (shot === 1) {
    const c = W(vadd(CLUSTERS[1].c, [1.15, -1.0, 0.6]));
    tgt = c; pos = vadd(c, rotY([0, 1.2, mix(9.5, 7.8, st / 2)], rot - 0.55 + st * 0.18));
  } else if (shot === 2) {
    const c = W(vadd(CLUSTERS[0].c, [0.9, -0.2, 0.3]));
    tgt = c; pos = vadd(c, rotY([0, 1.0, mix(8.8, 7.2, st / 2)], rot + 0.5 - st * 0.18));
  } else {
    pos = rotY([0, mix(7, 3, ease.inOutCubic(st / 2)), mix(30, 22, ease.inOutCubic(st / 2))], rot + 0.25 + st * 0.08); tgt = [0, mix(0, 1, st / 2), 0];
  }
  // Shake on kicks.
  const sh = kick * 0.08 + pulse(S.times.impact, t, 4) * 0.5;
  pos = vadd(pos, [noise1(t * 13, 1) * sh, noise1(t * 13, 2) * sh, 0]);
  R.setCamera(pos, tgt, [0, 1, 0], fov);

  // ---- points ----
  const boom = range(t, 16, 16.6);
  const hot = 1 - sstep(16, 16.8, t);
  for (let i = 0; i < GALAXY.pts.length; i++) {
    const q = GALAXY.pts[i];
    const u = ease.outExpo(range(t - 16 - q.delay * 0.6, 0, 1.6));
    if (u <= 0) continue;
    const p = W(vscale(q.p, u));
    const tw = 0.7 + 0.3 * Math.sin(t * (2 + q.tw * 4) + q.tw * 30);
    const c = hot > 0 ? cmix(q.col, COL.white, hot * 0.7) : q.col;
    R.sprite(p, q.size * (1 + kick * 0.3), c, q.b * tw * (0.9 + kick * 0.5 + hot * 0.5));
  }
  shockwave(R, [0, 0, 0], t, 16.0, { size: 15, life: 0.6, color: COL.cyan, alpha: 0.7 });
  shockwave(R, [0, 0, 0], t, 16.06, { size: 10, life: 0.5, color: COL.magenta, alpha: 0.6 });
  if (t < 16.5) R.sprite([0, 0, 0], 3 * (1 - boom) + 0.5, COL.white, (1 - boom) * 1.5, 4, t);

  // ---- hero tokens: bright stars + neighbour links ----
  const heroFly = ease.inOutCubic(range(t, 22.9, 24));
  const camFwd = vnorm(vsub(tgt, pos)), camRight = vnorm(vcross(camFwd, [0, 1, 0])), camUp = vcross(camRight, camFwd);
  const heroAt = (i) => {
    const h = W(vscale(GALAXY.heroes[i], ease.outExpo(range(t - 16, 0, 1.6))));
    if (heroFly <= 0) return h;
    const rowP = vadd(vadd(pos, vscale(camFwd, 12)), vadd(vscale(camRight, (i - 2) * 3.0), vscale(camUp, -0.2)));
    return vlerp(h, rowP, heroFly);
  };
  for (let i = 0; i < 5; i++) {
    const h = heroAt(i), col = TOKEN_COLS[i];
    R.sprite(h, 0.45 + kick * 0.2, col, 1.6, 0);
    R.sprite(h, 1.6 + kick * 0.6, col, 0.6, 4, t * 0.5 + i);
    if (heroFly < 0.5) {
      for (const j of GALAXY.neigh[i]) {
        const q = W(GALAXY.pts[j].p);
        const fl = hash2(j, Math.floor(t * 8)) > 0.4 ? 1 : 0.3;
        R.line(h, q, col, col, 0.012, 0.7 * fl * (1 - heroFly * 2) * sstep(16.6, 17.2, t), 0.1);
      }
    }
  }
  // Path through the prompt in the wide shot.
  if (shot === 3) {
    const a = sstep(22.1, 22.6, t);
    for (let i = 0; i < 4; i++) {
      const pa = heroAt(i), pb = heroAt(i + 1);
      const rev = sstep(22.1 + i * 0.12, 22.5 + i * 0.12, t);
      R.line(pa, vlerp(pa, pb, rev), TOKEN_COLS[i], TOKEN_COLS[i + 1], 0.04, a * 1.2);
    }
    for (let i = 0; i < 5; i++) {
      const h = heroAt(i);
      const lab = PROMPT_TOKENS[i].text;
      const size = mix(1.15, 0.62, heroFly);
      drawChip(R, lab, vadd(h, vscale(camUp, mix(1.2, 0, heroFly))), size, TOKEN_COLS[i], sstep(22.2 + i * 0.08, 22.5 + i * 0.08, t));
    }
    burst(R, heroAt(2), t, 22.9, { n: 40, speed: 8, life: 1, colors: TOKEN_COLS, seed: 77 });
  }
  if (shot === 0) {
    for (let i = 0; i < 5; i++) {
      R.text(tokenLabel(PROMPT_TOKENS[i].text), vadd(heroAt(i), [0, 1.1, 0]), 1.0, TOKEN_COLS[i], { alpha: sstep(16.8 + i * 0.1, 17.2 + i * 0.1, t), glow: 0.7, fx: decodeFx(t, 16.8 + i * 0.1, 0.25, 0.03, i) });
    }
  }

  // ---- close-ups ----
  const labelCluster = (ci, a) => {
    const cl = CLUSTERS[ci];
    cl.words.forEach(([w], k) => {
      const p = W(GALAXY.wordPos[cl.name + ':' + w]);
      const ta = st - 0.1 - k * 0.08;
      R.sprite(p, 0.32 + kick * 0.15, cmix(cl.col, COL.white, 0.4), 1.4 * a, 0);
      R.sprite(p, 0.55, cl.col, 0.9 * a * sstep(0, 0.2, ta), 1);
      R.text(w, vadd(p, [0, 0.48, 0]), 0.5, cmix(cl.col, COL.white, 0.45), { alpha: a * sstep(0, 0.15, ta), glow: 0.8, fx: decodeFx(t, 16 + shot * 2 + 0.1 + k * 0.08, 0.2, 0.03, k) });
    });
  };
  if (shot === 1) {
    labelCluster(1, 1);
    const wp = (w) => W(GALAXY.wordPos['royalty:' + w]);
    const g = COL.amber;
    arrow(R, wp('man'), wp('king'), g, 0.035, ease.outCubic(range(st, 0.35, 0.8)), 1.3);
    arrow(R, wp('woman'), wp('queen'), g, 0.035, ease.outCubic(range(st, 0.6, 1.05)), 1.3);
    arrow(R, wp('man'), wp('woman'), COL.magenta, 0.03, ease.outCubic(range(st, 0.85, 1.25)), 1.1);
    arrow(R, wp('king'), wp('queen'), COL.magenta, 0.03, ease.outCubic(range(st, 1.05, 1.45)), 1.1);
  }
  if (shot === 2) {
    labelCluster(0, 1);
    const wp = (w) => W(GALAXY.wordPos['animals:' + w]);
    const cats = ['cat', 'Katze', '猫', 'ねこ'];
    for (let i = 0; i < cats.length; i++) for (let j = i + 1; j < cats.length; j++) {
      const a = sstep(0.3 + (i + j) * 0.08, 0.6 + (i + j) * 0.08, st);
      R.line(wp(cats[i]), wp(cats[j]), COL.mint, COL.mint, 0.02, a * (0.6 + hat * 0.6));
    }
    const ctr = vscale(cats.map(wp).reduce((s, p) => vadd(s, p), [0, 0, 0]), 0.25);
    R.sprite(ctr, 2.0 + clap * 0.3, COL.mint, sstep(0.5, 0.9, st) * 0.9, 1);
    const dogs = ['dog', 'Hund', '犬'];
    for (let i = 0; i < 3; i++) R.line(wp(dogs[i]), wp(dogs[(i + 1) % 3]), COL.mint, COL.mint, 0.015, sstep(1.0, 1.4, st) * 0.7);
  }

  // ---- captions ----
  R.use('hud');
  const cap = shot === 1 ? 'king − man + woman ≈ queen' : shot === 2 ? 'cat ≈ Katze ≈ 猫 ≈ ねこ' : '';
  if (cap) {
    const a = sstep(0.15, 0.35, st) * (1 - sstep(1.8, 2.0, st));
    R.text(cap, [0, -3.0, 0], 0.62, shot === 1 ? cmix(COL.amber, COL.white, 0.3) : cmix(COL.mint, COL.white, 0.3), { alpha: a, glow: 0.8, fx: decodeFx(t, 16 + shot * 2 + 0.15, 0.2, 0.025, shot) });
  }
  R.use('add');

  // Cuts: a hard flash on each shot change.
  const cut = Math.max(pulse([18, 20, 22], t, 14));
  P.flash += cut * 0.5;
  P.aberr += cut * 0.03 + kick * 0.004;
}
