'use strict';
// 36-46 s: a dive through 32 transformer blocks along the residual stream. The
// camera passes each block exactly on the beat; a "logit lens" word above each
// block shows the model's guess converging.

const LAYER_D = 10;
const BEAM_X = (i) => (i - 2) * 1.2;
const LENS_WORDS = ['the', ',', 'a', 'and', 'the', 'not', 'a', 'love', 'what', 'love', '42', 'a', 'to', '42', 'love', 'to',
  '42', 'to', 'to', 'love', 'to', '42', 'to', 'to', 'to', 'to', 'to', 'to', 'to', 'to', 'to', 'to'];
let LAYER_CAM = null;

function layerZ(k) { return -(k + 1) * LAYER_D; }
function layerCamZ(t) {
  if (!LAYER_CAM) {
    const ts = [36.0], zs = [8];
    SCORE.layer.forEach((lt, k) => { ts.push(lt); zs.push(layerZ(k) + 4); });
    ts.push(46.0); zs.push(layerZ(31) - 120);
    LAYER_CAM = monotoneSpline(ts, zs);
  }
  return LAYER_CAM(t);
}

function sceneLayers(R, t) {
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9), hat = pulse(S.times.hat, t, 22);
  const hyper = sstep(45.15, 46, t), whiteout = sstep(45.72, 46, t);
  E.nebula = 0.25; E.stars = 0.5; E.nebA = hex('#1d0b44'); E.nebB = hex('#073a52');
  E.tunnel = sstep(36.3, 38, t) * 0.42 + sstep(43, 45, t) * 0.25 + hyper * 0.7; E.tunnelR = 11; E.tunnelZ = 0;
  E.tunnelA = hex('#19e6ff'); E.tunnelB = hex('#ff2d95');

  const cz = layerCamZ(t);
  const speed = (layerCamZ(t + 0.01) - cz) / 0.01; // negative (moving into -z)
  const roll = Math.sin(t * 0.7) * 0.12 + ease.inOutCubic(range(t, 44, 45.6)) * Math.PI * 0.5;
  const pos = [Math.sin(t * 0.8) * 0.6, 1.5 + Math.sin(t * 0.55) * 0.25, cz];
  const sh = kick * 0.05 + hyper * 0.15;
  pos[0] += noise1(t * 17, 8) * sh; pos[1] += noise1(t * 17, 9) * sh;
  R.setCamera(pos, [0, 0.2, cz - 14], [Math.sin(roll), Math.cos(roll), 0], mix(52, 75, hyper));

  // ---- residual stream beams ----
  const zNear = cz + 6, zFar = cz - 260;
  for (let i = 0; i < 5; i++) {
    const col = TOKEN_COLS[i];
    R.line([BEAM_X(i), 0, zNear], [BEAM_X(i), 0, zFar], col, col, 0.14 + kick * 0.05, 2.2, 0.0);
    R.line([BEAM_X(i), 0, zNear], [BEAM_X(i), 0, zFar], COL.white, COL.white, 0.03, 1.8, 0.0);
    // Data packets racing ahead along each beam.
    for (let k = 0; k < 14; k++) {
      const h = hash2(i, k + 50);
      const z = cz + 4 - fract(h + (t - 36) * (0.25 + h * 0.2)) * 120;
      const len = 1 + Math.min(12, -speed * 0.06);
      R.line([BEAM_X(i), 0, z], [BEAM_X(i), 0, z + len], col, col, 0.06, 1.5, 0);
    }
  }

  // ---- blocks ----
  const passed = lastIndex(S.times.layer, t) + 1;
  for (let k = 0; k < 32; k++) {
    const z = layerZ(k);
    const rel = z - cz;
    if (rel > 8 || rel < -170) continue;
    const near = Math.exp(-Math.abs(rel + 4) * 0.12);
    const close = 1 - sstep(-4, 1, rel); // fade things that are about to hit the lens
    const flash = pulse([S.layer[k]], t, 5);
    const hue = k / 31;
    const col = hue < 0.5 ? cmix(COL.cyan, COL.violet, hue * 2) : cmix(COL.violet, COL.amber, (hue - 0.5) * 2);
    const fadeIn = sstep(-170, -110, rel);
    const a = fadeIn * (0.55 + near * 0.8 + flash * 2.5);
    const hw = 3.6, hh = 2.5;
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    for (let c = 0; c < 4; c++) {
      const p0 = corners[c], p1 = corners[(c + 1) % 4];
      R.line([p0[0], p0[1], z], [p1[0], p1[1], z], col, col, 0.05, a);
    }
    // Corner ticks for a tech look.
    for (const [x, y] of corners) R.sprite([x, y, z], 0.18, COL.white, a * 0.8, 0);
    R.text(`L${String(k + 1).padStart(2, '0')}`, [-hw + 0.45, hh + 0.38, z], 0.38, col, { alpha: a * 0.9 * close, glow: 0.5, align: 0 });

    // Attention mini-arcs between beams just before the block.
    const za = z + 1.5;
    for (let j = 0; j < 4; j++) {
      const q = 1 + Math.floor(hash2(k, j) * 4), kk = Math.floor(hash2(k, j + 9) * q);
      const pts = arcPoints([BEAM_X(kk), 0, za], [BEAM_X(q), 0, za], 0.7 + 0.4 * (q - kk), (j - 1.5) * 0.6, 12);
      drawArc(R, pts, HEAD_COLS[(k + j) % 8], 0.025, a * 0.8 * (1 - sstep(-8, -1, rel)), 1);
    }

    // MLP neurons: a sparse firing grid behind the block.
    const zm = z - 3;
    const fire = Math.exp(-Math.abs(rel + 1) * 0.25) + flash;
    for (let gx = 0; gx < 14; gx++) {
      for (let gy = 0; gy < 5; gy++) {
        const h = hash3(k, gx, gy);
        const x = (gx - 6.5) * 0.52, y = (gy - 2) * 0.62 + 0.2;
        const on = h < 0.18;
        const ac = on ? fire * (0.8 + hat * 0.6) : 0.12;
        const nc = on ? cmix(col, COL.white, 0.4) : col;
        R.sprite([x, y, zm], on ? 0.14 : 0.07, nc, ac * fadeIn, 0);
        if (on && fire > 0.3) {
          const bi = Math.min(4, Math.max(0, Math.round(x / 1.2 + 2)));
          R.line([BEAM_X(bi), 0, zm + 1.2], [x, y, zm], col, nc, 0.01, fire * 0.2 * fadeIn, fire * 0.5 * fadeIn);
        }
      }
    }

    // Logit lens: the current best guess for the next token at this depth.
    const word = LENS_WORDS[k];
    const conv = k / 31;
    const lc = word === 'to' ? cmix(GEN_COL, COL.white, 0.2) : cmix(COL.white, col, 0.5);
    R.text(word, [hw - 0.3, hh + 0.42, z], 0.5 + conv * 0.25, lc, { alpha: a * (0.35 + conv * 0.6) * close, glow: 0.6, align: 1 });
  }

  // ---- HUD: layer counter ----
  R.use('hud');
  const cnt = Math.min(32, passed);
  R.text(`LAYER ${String(cnt).padStart(2, '0')} / 32`, [7.3, 3.55, 0], 0.34, cmix(COL.cyan, COL.white, 0.5), { align: 1, glow: 0.6, alpha: sstep(36.2, 36.6, t) * (1 - hyper) });
  for (let k = 0; k < 32; k++) {
    const x = 7.3 - (31 - k) * 0.105;
    const on = k < cnt;
    R.sprite([x, 3.2, 0], 0.035, on ? cmix(COL.cyan, COL.amber, k / 31) : COL.dim, (on ? 1.4 : 0.6) * (1 - hyper), 2, 0, 1);
  }
  R.text('logit lens ▸ next-token guess', [7.3, 2.9, 0], 0.2, cmix(GEN_COL, COL.white, 0.4), { align: 1, glow: 0.4, alpha: sstep(37, 37.5, t) * (1 - hyper) * 0.8 });
  R.use('add');

  // ---- exit into white ----
  P.flash += whiteout * whiteout * 4;
  P.exposure *= 1 + hyper * 0.3;
  P.aberr += kick * 0.004 + hyper * 0.05;
  P.tint = cmix([1, 1, 1], [1.05, 0.95, 1.1], hyper);
}
