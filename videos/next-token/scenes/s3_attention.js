'use strict';
// 24-36 s: attention. Tokens split into Q/K/V, eight heads draw causal arcs in
// rotated planes around the row, attention matrices fan out, then everything
// blazes during a barrel roll and the tokens are launched into the layer stack.

const ATT_SP = 3.2;
const attX = (i) => (i - 2) * ATT_SP;
const headAppear = (h) => (h === 0 ? 26.0 : 26.5 + h * 0.4);

function sceneAttention(R, t) {
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9), hat = pulse(S.times.hat, t, 20), clap = pulse(S.times.clap, t, 7);
  E.nebula = 0.35; E.stars = 0.6; E.nebA = hex('#2a0f55'); E.nebB = hex('#0a3d66');
  const gridA = sstep(24, 25, t) * (1 - sstep(31.6, 32.2, t));
  E.grid = 0.75 * gridA; E.gridY = -4; E.gridCell = 1.6; E.gridFog = 0.035; E.gridScroll = t * 3;
  E.gridColor = cmix(hex('#7a3dff'), hex('#19e6ff'), 0.5 + 0.5 * Math.sin(t * 0.5));
  E.horizon = 0.5 * gridA; E.horizonColor = hex('#ff2d95');

  // ---- camera ----
  let theta, dist, yaw, tgt = [0, 0.6, 0];
  if (t < 26) { theta = mix(0.08, 0.16, range(t, 24, 26)); dist = mix(15, 13, ease.outCubic(range(t, 24, 26))); yaw = Math.sin(t * 0.4) * 0.08; }
  else if (t < 30) { const u = ease.inOutCubic(range(t, 26, 30)); theta = mix(0.16, 0.62, u); dist = mix(13, 12, u); yaw = mix(0, 0.62, u); }
  else if (t < 32) { theta = mix(0.62, 0.42, ease.inOutCubic(range(t, 30, 30.7))); dist = mix(12, 14, ease.inOutCubic(range(t, 30, 30.7))); yaw = mix(0.62, 0, ease.inOutCubic(range(t, 30, 30.8))); tgt = [0, mix(0.6, 3.9, ease.inOutCubic(range(t, 30, 30.7))), 0]; }
  else { theta = 0.42 + ease.inOutCubic(range(t, 32, 35.2)) * (TAU - 0.2); dist = mix(14, 12.5, range(t, 32, 35)); yaw = Math.sin((t - 32) * 1.3) * 0.2; tgt = [0, mix(3.9, 0.4, ease.inOutCubic(range(t, 32, 32.8))), 0]; }
  let pos = vadd(tgt, rotY(rotX([0, 0, dist], -theta), yaw));
  let up = rotX([0, 1, 0], -theta);
  const launch = ease.inOutCubic(range(t, 35.1, 36));
  if (launch > 0) {
    pos = vlerp(pos, [0, 3.2, 11], launch);
    up = vnorm(vlerp(up, [0, 1, 0], launch));
    tgt = vlerp(tgt, [0, 0, -30], launch);
  }
  const sh = kick * 0.06 + pulse(S.times.impact, t, 5) * 0.35;
  pos = vadd(pos, [noise1(t * 11, 4) * sh, noise1(t * 11, 5) * sh, 0]);
  R.setCamera(pos, tgt, up, 50);

  dust(R, t, { n: 160, alpha: 0.3, box: [30, 16, 24] });

  // ---- tokens ----
  const fly = ease.inExpo(range(t, 35.2, 36));
  const tokPos = (i) => [attX(i) * (1 - fly * 0.6), 0, -fly * 70 - fly * i * 4];
  const glowGain = 1 + sstep(32, 35, t) * 0.8;
  for (let i = 0; i < 5; i++) {
    const p = tokPos(i), col = TOKEN_COLS[i];
    const pop = ease.outBack(range(t, 24.0 + i * 0.06, 24.4 + i * 0.06), 2);
    R.sprite(p, (1.2 + kick * 0.4) * glowGain, col, 0.6 * pop, 0);
    tokChip(R, PROMPT_TOKENS[i].text, p, 0.62 * pop, col, pop, { outline: 1.2 * glowGain });
    if (fly > 0) R.line(p, vadd(p, [0, 0, 6 + fly * 20]), col, col, 0.12, 1.2, 0);
  }
  shockwave(R, [0, 0, 0], t, 24.0, { size: 22, life: 0.8, color: COL.cyan, alpha: 1.2 });

  // ---- Q / K / V ----
  const qkvA = sstep(24.5, 24.8, t) * (1 - sstep(25.9, 26.3, t));
  if (qkvA > 0.001) {
    const names = ['Q', 'K', 'V'], cols = [COL.cyan, COL.magenta, COL.amber];
    for (let i = 0; i < 5; i++) {
      const base = tokPos(i);
      for (let k = 0; k < 3; k++) {
        const ang = (k - 1) * 0.75 + Math.sin(t * 2 + i) * 0.05;
        const rad = 1.25 * ease.outBack(range(t, 24.5 + k * 0.08, 24.9 + k * 0.08), 2) * (1 - sstep(25.9, 26.3, t));
        const p = vadd(base, [Math.sin(ang) * rad, Math.cos(ang) * rad + 0.15, 0]);
        R.line(base, p, cols[k], cols[k], 0.015, qkvA * 0.3, qkvA);
        R.sprite(p, 0.32, cols[k], qkvA * 1.2, 0);
        R.text(names[k], vadd(p, [0, 0.02, 0.05]), 0.3, COL.white, { alpha: qkvA, glow: 0.4 });
      }
    }
  }

  // ---- attention arcs ----
  const arcDim = t > 30 && t < 32 ? mix(1, 0.25, sstep(30, 30.4, t) * (1 - sstep(31.6, 32, t))) : 1;
  const wob = t > 32 ? (t - 32) * 1.2 : 0;
  const collapse = sstep(34.9, 35.4, t);
  const pulseRate = t > 32 ? 4 : 2;
  for (let h = 0; h < 8; h++) {
    const ta = headAppear(h);
    if (t < ta) continue;
    const hc = HEAD_COLS[h];
    const ang = (h * TAU) / 8;
    const headFlash = pulse([ta], t, 6);
    for (let q = 0; q < 5; q++) {
      const reveal0 = h === 0 && q === 4 ? ta : h === 0 ? 26.5 : ta;
      const w = attnWeights(h, q, wob);
      for (let k = 0; k <= q; k++) {
        const r = sstep(0, 0.35, t - reveal0 - k * 0.05) * (1 - collapse);
        if (r <= 0) continue;
        const wk = w[k];
        const a = (0.35 + wk * 1.3) * arcDim * (1 + headFlash * 1.5) * (0.85 + hat * 0.3);
        if (k === q) {
          const c = vadd(tokPos(q), rotX([0, 0.75, 0], ang));
          R.sprite(c, 0.18 + wk * 0.3, hc, a * r * 0.6, 1);
          continue;
        }
        const pts = arcPoints(tokPos(k), tokPos(q), 1.3 + 1.05 * (q - k), ang, 20);
        drawArc(R, pts, hc, (0.012 + 0.07 * wk) * (1 + kick * 0.3), a, r);
        if (r >= 1 && wk > 0.12) {
          const s = fract((t - ta) * pulseRate * 0.5 + hash3(h, q, k));
          const pp = pointOnPolyline(pts, s);
          R.sprite(pp, 0.1 + wk * 0.25, cmix(hc, COL.white, 0.5), wk * 2.2 * arcDim, 0);
          if (t > 32) {
            const s2 = fract(s + 0.5);
            R.sprite(pointOnPolyline(pts, s2), 0.08 + wk * 0.2, COL.amber, wk * 1.8, 0);
          }
        }
      }
    }
  }

  // ---- attention matrices (breakdown) ----
  const cardIn = ease.outBack(range(t, 29.9, 30.4), 1.6), cardOut = ease.inCubic(range(t, 32.1, 32.7));
  if (cardIn > 0 && cardOut < 1) {
    for (let h = 0; h < 8; h++) {
      const hc = HEAD_COLS[h];
      const off = h - 3.5;
      const col4 = h % 4, row = Math.floor(h / 4);
      let c = [(col4 - 1.5) * 3.5, 5.7 - row * 3.1, -1.0 - Math.abs(col4 - 1.5) * 0.3];
      c = vlerp([off * 0.5, 0, 0], c, cardIn);
      c = vadd(c, [0, cardOut * 12, -cardOut * 6]);
      const sc = Math.max(0, cardIn) * (1 - cardOut * 0.5);
      const cs = 0.47 * sc;
      R.use('over'); R.sprite(c, 1.62 * sc, COL.ink, 0.85, 6, 0, 1); R.use('add');
      R.sprite(c, 1.62 * sc, hc, 0.8 * (1 + pulse(S.times.clap, t, 6)), 5, 0, 1);
      for (let q = 0; q < 5; q++) {
        const w = attnWeights(h, q, 0);
        const rowOn = sstep(0, 0.15, t - (30.15 + h * 0.06 + q * 0.11));
        for (let k = 0; k < 5; k++) {
          const p = vadd(c, [(k - 2) * cs, (2 - q) * cs, 0.02]);
          if (k > q) { R.sprite(p, cs * 0.3, COL.dim, 0.5, 2); continue; }
          R.sprite(p, cs * 0.42, cmix(COL.ink, hc, 0.15 + 0.85 * Math.min(1, w[k] * 1.6)), (0.25 + w[k] * 1.6) * rowOn, 2);
        }
      }
      R.text(`head ${h + 1}`, vadd(c, [0, -1.5 * sc, 0]), 0.28 * Math.max(0.01, sc), cmix(hc, COL.white, 0.4), { alpha: sstep(30.2, 30.5, t) * (1 - cardOut), glow: 0.5 });
    }
  }

  // ---- HUD formula ----
  R.use('hud');
  const fA = sstep(24.6, 24.9, t) * (1 - sstep(29.6, 30, t));
  R.text('softmax( Q·Kᵀ / √d ) · V', [0, 3.35, 0], 0.5, cmix(COL.cyan, COL.white, 0.5), { alpha: fA, glow: 0.8, fx: decodeFx(t, 24.6, 0.2, 0.02, 9) });
  if (t >= 30 && t < 32) {
    const a = sstep(30.2, 30.5, t) * (1 - sstep(31.7, 32, t));
    R.text('causal mask: no peeking at the future', [0, -3.3, 0], 0.32, cmix(COL.magenta, COL.white, 0.4), { alpha: a, glow: 0.6, fx: decodeFx(t, 30.2, 0.2, 0.015, 4) });
  }
  if (t >= 32 && t < 35.2) {
    const a = sstep(32.2, 32.5, t) * (1 - sstep(34.8, 35.2, t));
    R.text('8 heads × 32 layers', [0, -3.3, 0], 0.36, cmix(COL.amber, COL.white, 0.4), { alpha: a, glow: 0.6, fx: decodeFx(t, 32.2, 0.2, 0.02, 5) });
  }
  R.use('add');

  P.aberr += kick * 0.005 + fly * 0.03;
  P.glitch = Math.max(P.glitch, pulse(S.times.glitch, t, 2.5) * (t > 30.9 && t < 31.8 ? 0.8 : 0));
}
