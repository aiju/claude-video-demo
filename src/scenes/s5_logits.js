'use strict';
// 46-52 s: unembedding to a spectrum of logits, softmax collapses it to a few
// candidates, and a probability wheel spins to sample the next token.

const SPEC_N = 360, SPEC_W = 30, SPEC_BASE = -2.6;
const CAND_IDX = [205, 61, 288, 140, 330];
const CAND_COLS = [GEN_COL, COL.cyan, COL.magenta, COL.violet, COL.mint];
const WHEEL_C = [5.3, -0.1, 0], WHEEL_R = 2.5;
const CHART_X = -5.6, ROW_Y = (r) => 2.0 - r * 1.0, BAR_SCALE = 11.5;

function logitAt(i, t) {
  const c = CAND_IDX.indexOf(i);
  if (c >= 0) return [4.3, 3.55, 3.1, 2.4, 2.1][c];
  const base = 0.5 + 1.1 * (0.5 + 0.5 * Math.sin(i * 0.11) * Math.sin(i * 0.037 + 1.3)) + hash2(i, 3) * 0.9;
  return base + (hash2(i, Math.floor(t * 8)) - 0.5) * 0.35;
}

function sceneLogits(R, t) {
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9), tick = pulse(S.times.tick, t, 30);
  E.nebula = 0.3; E.stars = 0.45; E.nebA = hex('#2a0d4a'); E.nebB = hex('#0b3550');
  E.grid = 0.35 * (1 - sstep(48, 49, t)); E.gridY = -2.7; E.gridCell = 1.2; E.gridFog = 0.05; E.gridColor = hex('#5a3dff');
  E.horizon = 0.16 * (1 - sstep(48, 49, t)) + 0.05; E.horizonColor = hex('#19e6ff');

  // ---- camera ----
  const c1 = ease.inOutCubic(range(t, 46, 48.2)), c2 = ease.inOutCubic(range(t, 48.0, 48.9));
  let pos = vlerp([-6, 1.8, 16], [3, 1.2, 14], c1), tgt = vlerp([-4, -0.6, 0], [2, -0.4, 0], c1);
  pos = vlerp(pos, [0, 0.2, 15.8], c2); tgt = vlerp(tgt, [0, 0, 0], c2);
  const fin = ease.inExpo(range(t, 51.5, 52));
  pos = vlerp(pos, [0, 0, 6], fin);
  const sh = kick * 0.05 + pulse(S.times.impact, t, 5) * 0.4;
  pos = vadd(pos, [noise1(t * 12, 3) * sh, noise1(t * 12, 6) * sh, 0]);
  R.setCamera(pos, tgt, [0, 1, 0], 50);

  dust(R, t, { n: 140, alpha: 0.25 });

  // ---- spectrum + softmax ----
  const grow = ease.outCubic(range(t, 46.05, 46.7));
  const soft = ease.inOutCubic(range(t, 47.3, 48.1));
  const specFade = 1 - sstep(48.2, 48.6, t);
  const k = mix(1, 7, soft);
  let maxE = 0;
  const ex = new Float32Array(SPEC_N);
  for (let i = 0; i < SPEC_N; i++) { ex[i] = Math.exp(k * (logitAt(i, t) - 4.3)); maxE = Math.max(maxE, ex[i]); }
  const fly = ease.inOutCubic(range(t, 48.15, 48.85));
  for (let i = 0; i < SPEC_N; i++) {
    const x = (i / (SPEC_N - 1) - 0.5) * SPEC_W;
    const lg = logitAt(i, t);
    const hLogit = lg * 0.95;
    const hSoft = (ex[i] / maxE) * 4.6;
    const h = mix(hLogit, hSoft, soft) * grow;
    const c = CAND_IDX.indexOf(i);
    const gcol = cmix(cmix(COL.cyan, COL.violet, clamp(i / SPEC_N * 2)), COL.magenta, clamp(i / SPEC_N * 2 - 1));
    if (c < 0) {
      if (specFade <= 0) continue;
      const a = specFade * (0.55 + 0.4 * (1 - soft)) * (0.9 + kick * 0.4);
      R.line([x, SPEC_BASE, 0], [x, SPEC_BASE + Math.max(0.02, h), 0], gcol, cmix(gcol, COL.white, 0.4), 0.032, a * 0.5, a);
    } else {
      const col = CAND_COLS[c];
      const A0 = [x, SPEC_BASE, 0], B0 = [x, SPEC_BASE + h, 0];
      const L = CANDIDATES[c].p * BAR_SCALE * ease.outCubic(range(t, 48.5, 49.0));
      const A1 = [CHART_X, ROW_Y(c), 0], B1 = [CHART_X + Math.max(0.3, L), ROW_Y(c), 0];
      const sel = selectedRow(t);
      const hl = sel === c ? 1 : 0;
      const win = c === 0 ? sstep(51, 51.1, t) : 0;
      const dimLose = c !== 0 ? 1 - sstep(51, 51.4, t) * 0.7 : 1;
      const out = 1 - sstep(51.3, 51.8, t);
      const pa = vlerp(A0, A1, fly), pb = vlerp(B0, B1, fly);
      const w = mix(0.05, 0.32, fly) * (1 + hl * 0.25);
      R.line(pa, pb, col, cmix(col, COL.white, 0.3), w, (1.1 + hl * 1.2 + win * 2) * dimLose * out);
      if (t > 46.7 && fly < 0.5) {
        R.text(tokenLabel(CANDIDATES[c].text), vadd(B0, [0, 0.45, 0]), 0.42, cmix(col, COL.white, 0.4), { alpha: sstep(46.7, 47.0, t) * (1 - fly * 2), glow: 0.6, fx: decodeFx(t, 46.7 + c * 0.06, 0.2, 0.03, c) });
      }
      if (fly >= 1) {
        drawChip(R, CANDIDATES[c].text, [CHART_X - 1.6, ROW_Y(c), 0], 0.58, col, dimLose * out, { outline: 1 + hl * 1.5 + win * 2 });
        const pct = Math.round(CANDIDATES[c].p * 100 * ease.outCubic(range(t, 48.5, 49.1)));
        R.text(pct + '%', [B1[0] + 0.3, ROW_Y(c), 0], 0.44, cmix(col, COL.white, 0.5), { align: -1, alpha: dimLose * out, glow: 0.5 });
      }
    }
  }

  // ---- the wheel ----
  const wIn = ease.outBack(range(t, 48.5, 49.0), 1.5), wOut = 1 - sstep(51.3, 51.8, t);
  if (wIn > 0 && wOut > 0) {
    const a = wheelTurns(t);
    const rad = WHEEL_R * wIn;
    const ang = (f) => Math.PI / 2 - (f - a) * TAU;
    const cur = wheelWedge(a);
    const landed = t >= 51.0;
    for (let j = 0; j < WHEEL_P.length; j++) {
      const f0 = WHEEL_BOUNDS[j], f1 = f0 + WHEEL_P[j];
      const col = j < 5 ? CAND_COLS[j] : COL.dim;
      const isCur = j === cur;
      const pts = [];
      const n = Math.max(3, Math.ceil(WHEEL_P[j] * 90));
      for (let s = 0; s <= n; s++) {
        const f = mix(f0 + 0.004, f1 - 0.004, s / n), an = ang(f);
        pts.push(vadd(WHEEL_C, [Math.cos(an) * rad, Math.sin(an) * rad, 0]));
      }
      const al = (isCur ? 1.6 + tick * 1.5 : 0.65) * (landed && j !== 0 ? 0.35 : 1) * wOut * (landed && j === 0 ? 2 : 1);
      R.polyline(pts, col, isCur ? 0.42 : 0.34, al, al);
      // Label on the wedge's outer edge.
      if (j < 3) {
        const an = ang((f0 + f1) / 2);
        R.text(tokenLabel(CANDIDATES[j].text), vadd(WHEEL_C, [Math.cos(an) * (rad + 0.75), Math.sin(an) * (rad + 0.6), 0]), 0.36, cmix(col, COL.white, 0.4), { alpha: wIn * wOut * 0.9, glow: 0.5 });
      }
    }
    // Inner ring and spokes.
    R.sprite(WHEEL_C, rad * 0.62, COL.violet, 0.5 * wOut, 1);
    R.sprite(WHEEL_C, 0.35, COL.white, 1.2 * wOut, 0);
    // Pointer at the top.
    const tip = vadd(WHEEL_C, [0, rad - 0.15, 0.05]), b0 = vadd(tip, [-0.3, 0.6, 0]), b1 = vadd(tip, [0.3, 0.6, 0]);
    const pc = cmix(COL.white, CAND_COLS[Math.min(cur, 4)], 0.3);
    R.line(tip, b0, pc, pc, 0.05, 1.5 * wOut); R.line(b0, b1, pc, pc, 0.05, 1.5 * wOut); R.line(b1, tip, pc, pc, 0.05, 1.5 * wOut);
    R.sprite(tip, 0.5 + tick * 0.4, pc, (0.8 + tick) * wOut, 4);
    burst(R, tip, t, 51.0, { n: 50, speed: 7, life: 1.0, color: GEN_COL, seed: 51 });
    shockwave(R, WHEEL_C, t, 51.0, { size: 6, life: 0.5, color: GEN_COL, alpha: 0.45 });
  }

  // ---- the winner ----
  if (t > 51.05) {
    const u = ease.outBack(range(t, 51.05, 51.45), 1.6);
    const p = vlerp([CHART_X - 1.6, ROW_Y(0), 0], [0, 0, 2], ease.inOutCubic(range(t, 51.05, 51.5)));
    drawChip(R, CANDIDATES[0].text, p, mix(0.58, 1.3, u), GEN_COL, 1, { outline: 2.5, glow: 0.9 });
    R.sprite(p, 3 + kick, GEN_COL, 0.7, 0);
  }

  // ---- HUD ----
  R.use('hud');
  const l1 = sstep(46.3, 46.5, t) * (1 - sstep(47.2, 47.5, t));
  R.text('unembed ▸ 50,257 logits', [0, 3.45, 0], 0.4, cmix(COL.cyan, COL.white, 0.5), { alpha: l1, glow: 0.6, fx: decodeFx(t, 46.3, 0.2, 0.02, 1) });
  const l2 = sstep(47.3, 47.5, t) * (1 - sstep(48.4, 48.7, t));
  R.text('softmax', [0, 2.9, 0], 1.1, cmix(COL.magenta, COL.white, 0.4), { alpha: l2, glow: 1.0, font: 'disp', fx: decodeFx(t, 47.3, 0.25, 0.04, 2) });
  const l3 = sstep(48.9, 49.1, t) * (1 - sstep(51.2, 51.5, t));
  R.text('sample · temperature 0.8', [0, 3.45, 0], 0.4, cmix(GEN_COL, COL.white, 0.4), { alpha: l3, glow: 0.6, fx: decodeFx(t, 48.9, 0.2, 0.02, 3) });
  R.use('add');

  P.flash += Math.max(0, 1 - (t - 46) * 5) * 2.0 + pulse([51], t, 12) * 0.6;
  P.aberr += kick * 0.004 + tick * 0.004 + fin * 0.03;
}

function selectedRow(t) {
  if (t < 49) return -1;
  const j = wheelWedge(wheelTurns(t));
  return j < 5 ? j : -1;
}
