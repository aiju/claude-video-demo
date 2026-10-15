'use strict';
// 52-60 s: autoregression. Each sampled token is appended, attends back to the
// whole sentence, and the next one follows on the beat. Then everything
// collapses back into the single point the film started from.

const GEN_SIZE = 0.54;

function sceneGenerate(R, t) {
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9), pl = pulse(S.times.pluck, t, 6);
  const outro = sstep(56, 56.6, t);
  E.nebula = 0.3 + outro * 0.35; E.stars = 0.5 + outro * 0.4; E.nebA = hex('#2d1060'); E.nebB = hex('#0a5470');
  E.grid = 0.5 * (1 - outro); E.gridY = -3; E.gridCell = 1.5; E.gridFog = 0.04; E.gridScroll = t * 4; E.gridColor = hex('#7a3dff');
  E.horizon = 0.45 * (1 - outro); E.horizonColor = hex('#ff2d95');

  const all = PROMPT_TOKENS.map((x) => x.text).concat(GENERATED);
  const nVis = 5 + (lastIndex(APPEND_TIMES, t) + 1);
  const texts = all.slice(0, nVis);
  const xs = tokChipRow(R, texts, GEN_SIZE, 0.32);
  const fullXs = tokChipRow(R, all, GEN_SIZE, 0.32);
  const lastX = xs[xs.length - 1];

  // ---- camera ----
  const collapse = ease.inExpo(range(t, 57.8, 59.0));
  // Keep the whole (growing) sentence in frame.
  const rowW = (xs.length ? xs[xs.length - 1] - xs[0] : 0) + 4;
  const fitD = (w) => Math.max(11, (w + 2.5) / (2 * Math.tan((25 * Math.PI) / 180) * (16 / 9)));
  const settleCam = sstep(54.6, 55.6, t);
  const camX = mix((xs[0] + lastX) / 2, 0, settleCam);
  const camD = mix(fitD(rowW), fitD(fullXs[fullXs.length - 1] - fullXs[0] + 4), settleCam) - outro * 3 - collapse * 3;
  let pos = [camX + Math.sin(t * 0.6) * 0.5, 1.4 - outro * 1.0 + Math.sin(t * 0.4) * 0.2, camD];
  const tgt = [camX, 0.6 - outro * 0.6, 0];
  const sh = kick * 0.05 + pulse(S.times.impact, t, 5) * 0.35;
  pos = vadd(pos, [noise1(t * 12, 1) * sh, noise1(t * 12, 2) * sh, 0]);
  R.setCamera(pos, tgt, [0, 1, 0], 50);

  dust(R, t, { n: 200, alpha: 0.3 + outro * 0.2 });

  const sentenceA = 1 - sstep(55.92, 56.0, t);
  const chipPos = (i) => {
    const ta = i >= 5 ? APPEND_TIMES[i - 5] : 52.0;
    const u = i >= 5 ? ease.outBack(range(t, ta, ta + 0.28), 1.8) : 1;
    const settle = sstep(54.6, 55.6, t);
    const x = mix(xs[i] ?? fullXs[i], fullXs[i], settle);
    return [mix(x + 4, x, Math.min(1, u)), 0, mix(7, 0, Math.min(1, u))];
  };

  // ---- chips + per-append effects ----
  if (sentenceA > 0) {
    for (let i = 0; i < nVis; i++) {
      const isGen = i >= 5;
      const col = isGen ? GEN_COL : TOKEN_COLS[i];
      const p = chipPos(i);
      const ta = isGen ? APPEND_TIMES[i - 5] : 0;
      const f = isGen ? pulse([ta], t, 5) : 0;
      tokChip(R, all[i], p, GEN_SIZE * (1 + f * 0.25), col, sentenceA, { outline: 1.1 + f * 2 + kick * 0.3, glow: 0.5 + f });
      if (isGen) {
        shockwave(R, [fullXs[i], 0, 0], t, ta + 0.1, { size: 2.2, life: 0.4, color: col, alpha: 0.6 });
        burst(R, p, t, ta, { n: 24, speed: 5, life: 0.8, color: col, seed: 600 + i });
        // Forward-pass flicker: a stack of plates lighting up above the new token.
        for (let k = 0; k < 8; k++) {
          const tk = ta - 0.24 + k * 0.03;
          const a = pulse([tk], t, 14) * (t >= tk ? 1 : 0) * sentenceA;
          if (a < 0.02) continue;
          const y = 0.9 + k * 0.32;
          R.line([p[0] - 0.7, y, p[2]], [p[0] + 0.7, y, p[2]], cmix(COL.cyan, GEN_COL, k / 7), cmix(COL.cyan, GEN_COL, k / 7), 0.05, a * 1.5);
        }
        // Attention back over the whole context.
        const aA = (1 - sstep(ta + 0.35, ta + 0.9, t)) * sentenceA;
        if (t >= ta && aA > 0.01) {
          const w = attnWeights(i % 8, Math.min(4, i - 1), 0);
          for (let j = 0; j < i; j++) {
            const wj = j < 5 ? w[Math.min(j, w.length - 1)] : 0.18;
            const pts = arcPoints(chipPos(j), p, 0.8 + 0.28 * (i - j), 0, 20);
            drawArc(R, pts, HEAD_COLS[(i + j) % 8], 0.015 + wj * 0.05, aA * (0.5 + wj * 1.5), sstep(0, 0.22, t - ta - j * 0.01));
          }
        }
      }
    }
    // Full causal attention lights up once the sentence is complete.
    const fullA = sstep(55.0, 55.4, t) * sentenceA;
    if (fullA > 0) {
      for (let q = 1; q < all.length; q++) for (let k = 0; k < q; k++) {
        if ((q + k) % 2) continue;
        const pts = arcPoints(chipPos(k), chipPos(q), 0.6 + 0.22 * (q - k), (q % 3 - 1) * 0.5, 16);
        drawArc(R, pts, HEAD_COLS[(q * 3 + k) % 8], 0.014, fullA * (0.35 + kick * 0.4), 1);
      }
    }
  }

  // ---- outro: the sentence as one line of light, then collapse ----
  if (t >= 55.95) {
    const sentence = PROMPT + GENERATED.join('');
    const genStart = PROMPT.length;
    const a = sstep(55.98, 56.12, t);
    const size = 0.72;
    const w = R.measure(sentence, 'mono') * size;
    R.text(sentence, [0, 0, 0], size, COL.white, {
      alpha: a, glow: 0.8,
      fx: (i, ch, s, n) => {
        const isGen = i >= genStart;
        s.color = isGen ? cmix(GEN_COL, COL.white, 0.15) : cmix(COL.cyan, COL.white, 0.55);
        const x = -w / 2 + (i + 0.5) * (w / n);
        if (collapse > 0) {
          const k = Math.min(1, collapse * (1 + hash1(i) * 0.6));
          s.dx = -x / size * k;
          s.dy = (hash1(i + 3) - 0.5) * 2 * Math.sin(k * Math.PI) / size;
          s.scale = 1 - k * 0.9; s.rot = k * (hash1(i + 9) - 0.5) * 6;
        }
        s.dy += Math.sin(t * 3 + i * 0.4) * 0.03;
      },
    });
    // Rising embers.
    for (let i = 0; i < 90; i++) {
      const h = hash2(i, 42), hh = hash2(i, 43);
      const x0 = (h - 0.5) * 20, y0 = -3 + fract(hh + (t - 56) * (0.08 + h * 0.1)) * 8;
      let p = [x0, y0, (hash2(i, 44) - 0.5) * 6];
      p = vlerp(p, [0, 0, 0], collapse);
      R.sprite(p, 0.05 + h * 0.06, i % 3 ? GEN_COL : COL.cyan, a * (1 - collapse * 0.5) * 0.9, 0);
    }
    const core = collapse * (1 - sstep(59.0, 59.12, t));
    if (core > 0) {
      R.sprite([0, 0, 0], 0.4 + core * 2.5, COL.white, core * 2.2, 0);
      R.sprite([0, 0, 0], 2 + core * 9, GEN_COL, core * 0.9, 4, t * 2);
    }
  }
  shockwave(R, [0, 0, 0], t, 52.0, { size: 7, life: 0.45, color: GEN_COL, alpha: 0.45 });
  shockwave(R, [0, 0, 0], t, 56.0, { size: 9, life: 0.5, color: COL.cyan, alpha: 0.35 });

  // ---- final hit: a blinking cursor, then black ----
  if (t >= 59.0) {
    const u = t - 59.0;
    shockwave(R, [0, 0, 0], t, 59.0, { size: 9, life: 0.6, color: COL.white, alpha: 0.6 });
    burst(R, [0, 0, 0], t, 59.0, { n: 80, speed: 14, life: 1.0, colors: [GEN_COL, COL.cyan, COL.magenta], seed: 59 });
    const blink = u < 0.15 || (u > 0.4 && u < 0.6) || u > 0.85 ? 1 : 0;
    R.use('hud');
    R.sprite([0, 0, 0], 0.32, COL.white, blink * 1.6 * (1 - sstep(0.75, 0.95, u)), 2, 0, 0.5);
    R.text('one token at a time', [0, -0.75, 0], 0.26, cmix(COL.cyan, COL.white, 0.6), { alpha: sstep(0.1, 0.3, u) * (1 - sstep(0.75, 0.95, u)), glow: 0.5, fx: decodeFx(t, 59.1, 0.15, 0.015, 7), tracking: 0.08 });
    R.use('add');
  }

  P.flash += pulse([52], t, 14) * 1.2 + pulse([56], t, 12) * 1.0 + pulse([59], t, 14) * 2.0 + pl * 0.1;
  P.aberr += kick * 0.004 + collapse * 0.03;
  P.fade = sstep(59.75, 60, t);
  if (t >= 59.0) { P.flash *= 1; E.nebula *= 1 - sstep(59, 59.6, t); E.stars *= 1 - sstep(59, 59.6, t); }
}
