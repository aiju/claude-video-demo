'use strict';
// 0-16 s: the prompt is typed, split into tokens, mapped to ids, then looked up
// in the embedding matrix and pulled out as vectors.

const TOK_SIZE = 0.74;          // chip text size after tokenisation
const MATRIX = { cols: 64, rows: 30, sp: 0.36, z: -5, y: -0.6 };
const MATRIX_ROWS = [4, 11, 17, 22, 27];
const VEC_N = 16, VEC_SP = 0.27, VEC_TOP = -0.15;

function sceneTokens(R, t) {
  const S = SCORE, E = R.env, P = R.post;
  const kick = pulse(S.times.bigKick, t, 9);
  E.nebula = 0.15 + sstep(6, 12, t) * 0.35;
  E.stars = 0.2 + sstep(8, 10, t) * 0.4;
  E.nebA = hex('#2b1460'); E.nebB = hex('#0b4f6e');

  // ---- camera ----
  const push = ease.inOutCubic(range(t, 1, 8));
  let cz = mix(14.5, 12.4, push), cy = 0, ty = 0;
  const down = ease.inOutCubic(range(t, 8.0, 10.8));
  cz = mix(cz, 15.5, down); cy = mix(0, -0.4, down); ty = mix(0, -1.3, down);
  const pull = ease.inExpo(range(t, 14, 16));
  cz += pull * 10;
  const roll = pull * 0.5 + Math.sin(t * 0.6) * 0.02;
  const sway = Math.sin(t * 0.35) * 0.6;
  R.setCamera([sway, cy + Math.sin(t * 0.5) * 0.15, cz], [0, ty, 0], [Math.sin(roll), Math.cos(roll), 0], 50);

  dust(R, t, { n: 260, alpha: 0.35 + kick * 0.2 });

  // ---- 0-1.25: a heartbeat point of light ----
  const hb = pulse(S.times.kick, t, 7);
  const firstX = -R.measure(PROMPT, 'mono') / 2;
  if (t < 1.4) {
    const a = sstep(0.1, 0.9, t) * (1 - sstep(1.15, 1.35, t));
    R.sprite([firstX, 0, 0], 0.5 + 0.2 * Math.sin(t * 6), COL.cyan, a * 1.6, 0);
    R.sprite([firstX, 0, 0], 1.6, COL.cyan, a * 0.6, 4);
  }

  const typeTimes = S.times.type;
  const tokenChars = []; // char index -> token index
  PROMPT_TOKENS.forEach((tok, i) => { for (const _ of tok.text) tokenChars.push(i); });

  // Token positions: start as continuous text, spread apart, then become chips.
  const textW = R.measure(PROMPT, 'mono');
  const tokStartX = []; let acc = 0;
  PROMPT_TOKENS.forEach((tok) => { tokStartX.push(-textW / 2 + acc + R.measure(tok.text, 'mono') / 2); acc += R.measure(tok.text, 'mono'); });
  const chipXs = tokChipRow(R, PROMPT_TOKENS.map((x) => x.text), TOK_SIZE, 0.75);
  const spread = ease.inOutCubic(range(t, 6, 7.9)) * 0.3;
  const chipT = ease.outBack(range(t, 8, 8.45), 1.4);
  const chipY = mix(0, 2.35, ease.inOutCubic(range(t, 9.6, 11.0)));

  // ---- typing (1.25 - 4) and scanning (4.6 - 6) ----
  const scanX = mix(-9, 9, range(t, 4.6, 5.9));
  if (t < 8.0) {
    const glitch = Math.max(pulse(S.times.glitch, t, 3) * (t < 6 ? 1 : 0), 0);
    PROMPT_TOKENS.forEach((tok, ti) => {
      const tx0 = tokStartX[ti] + (ti - 2) * spread * 2.2;
      const passed = scanX > tokStartX[ti];
      const tokCol = TOKEN_COLS[ti];
      const baseIdx = PROMPT_TOKENS.slice(0, ti).reduce((s, x) => s + x.text.length, 0);
      const jitter = (glitch > 0.05 ? (hash2(ti, Math.floor(t * 30)) - 0.5) * 0.4 * glitch : 0);
      R.text(tok.text, [tx0 + jitter, 0, 0], 1, COL.white, {
        glow: 0.55,
        fx: (i, ch, s) => {
          const ci = baseIdx + i;
          const tt = typeTimes[ci];
          if (t < tt) { s.alpha = 0; return; }
          const local = t - tt;
          if (local < 0.11 && ch !== ' ') s.ch = SCRAMBLE_CHARS[Math.floor(hash2(ci, Math.floor(t * 40)) * SCRAMBLE_CHARS.length)];
          s.scale = 1 + 0.5 * Math.exp(-local * 18);
          s.color = passed ? cmix(COL.white, tokCol, 0.65 + 0.35 * sstep(5.9, 7, t)) : cmix(COL.cyan, COL.white, Math.min(1, local * 3));
          s.dy = Math.sin(t * 9 + ci) * 0.03 * sstep(6.5, 8, t);
        },
      });
      // Underline + separators once the scanner has passed.
      if (passed) {
        const hwTok = R.measure(tok.text.trimStart(), 'mono') / 2;
        const lead = tok.text.startsWith(' ') ? R.measure(' ', 'mono') / 2 : 0;
        const ux = tx0 + lead;
        const ua = sstep(0, 0.3, t - (4.6 + (tokStartX[ti] + 9) / 18 * 1.3)) * (1 + kick);
        R.line([ux - hwTok, -0.62, 0], [ux + hwTok, -0.62, 0], tokCol, tokCol, 0.035, ua * 1.4);
      }
    });
    // Sparks at each freshly typed character.
    for (let ci = 0; ci < PROMPT.length; ci++) {
      const tt = typeTimes[ci];
      if (t >= tt && t < tt + 0.5 && PROMPT[ci] !== ' ') {
        const x = -textW / 2 + R.measure(PROMPT.slice(0, ci), 'mono') + 0.3;
        burst(R, [x, 0.1, 0.2], t, tt, { n: 10, speed: 2.5, life: 0.45, size: 0.05, color: COL.cyan, seed: ci + 10, width: 0.012 });
      }
    }
    // Cursor.
    const nTyped = lastIndex(typeTimes, t) + 1;
    if (t > 1.0 && t < 7.5) {
      const cx = -textW / 2 + R.measure(PROMPT.slice(0, nTyped), 'mono') + 0.32 + (nTyped >= PROMPT.length ? spread * 4.4 : 0);
      const typing = nTyped > 0 && nTyped < PROMPT.length;
      const on = typing || Math.floor(t * 2.6) % 2 === 0;
      if (on) R.sprite([cx, 0.02, 0], 0.48, COL.cyan, 1.2, 2, 0, 0.55 / 0.48 * 0.5);
    }
    // Scanner beam.
    if (t > 4.6 && t < 6.0) {
      const a = sstep(4.6, 4.75, t) * (1 - sstep(5.8, 6.0, t));
      R.line([scanX, -1.6, 0.1], [scanX, 1.6, 0.1], COL.white, COL.white, 0.05, a * 2.5);
      R.line([scanX, -2.6, 0.1], [scanX, 2.6, 0.1], COL.cyan, COL.cyan, 0.4, a * 0.35);
    }
    // Pre-impact glow build.
    P.glitch = Math.max(P.glitch, sstep(7.2, 8, t) * 0.5);
  }

  // ---- 8+: chips, ids, embedding look-up ----
  if (t >= 8.0) {
    const swirl = ease.inExpo(range(t, 14.6, 16));
    const chipPos = (ti) => {
      const from = [tokStartX[ti] + (ti - 2) * 0.3 * 2.2, 0, 0];
      const to = [chipXs[ti], chipY, 0];
      let p = vlerp(from, to, Math.min(1, chipT));
      if (chipT > 1) p = vadd(p, [(to[0] - from[0]) * (chipT - 1), 0, 0]);
      return p;
    };
    shockwave(R, [0, 0, 0], t, 8.0, { size: 8, life: 0.45, color: COL.cyan, alpha: 0.5 });
    shockwave(R, [0, 0, 0], t, 8.05, { size: 5, life: 0.4, color: COL.magenta, alpha: 0.45 });
    PROMPT_TOKENS.forEach((tok, ti) => {
      burst(R, chipPos(ti), t, 8.0, { n: 26, speed: 6, life: 1.1, color: TOKEN_COLS[ti], seed: 200 + ti });
    });

    const vecCells = []; // collected for the final swirl
    PROMPT_TOKENS.forEach((tok, ti) => {
      const col = TOKEN_COLS[ti];
      let p = chipPos(ti);
      const kickBob = kick * 0.08;
      const sw = swirlPos(p, ti * 7, t, swirl);
      tokChip(R, tok.text, sw, TOK_SIZE * (1 + kickBob) * (1 - swirl * 0.6), col, 1 - swirl * 0.7, { glow: 0.6 });

      // Token id with a decode effect, synced to the blips.
      const tId = S.times.blip[ti];
      if (t > tId - 0.02) {
        const idY = chipY - 1.05;
        const idP = swirlPos([chipXs[ti], idY, 0], ti * 7 + 3, t, swirl);
        const a = 1 - swirl;
        R.line(vadd(sw, [0, -0.5, 0]), vadd(idP, [0, 0.32, 0]), col, col, 0.015, a * 0.8 * sstep(0, 0.15, t - tId));
        R.text(String(tok.id), idP, 0.5, cmix(col, COL.white, 0.5), { alpha: a, glow: 0.7, fx: decodeFx(t, tId, 0.28, 0.04, ti) });
        burst(R, idP, t, tId, { n: 14, speed: 2.5, life: 0.5, size: 0.05, color: col, seed: 300 + ti });
      }
    });

    // Embedding matrix, faint in the background.
    const mA = sstep(10.2, 10.9, t) * (1 - sstep(14.2, 15.2, t));
    if (mA > 0.001) {
      const { cols, rows, sp, z, y } = MATRIX;
      for (let r = 0; r < rows; r++) {
        const hiTok = MATRIX_ROWS.indexOf(r);
        for (let c = 0; c < cols; c++) {
          const wipe = sstep(0, 0.4, t - 10.2 - (c + r) * 0.006);
          const v = Math.sin(c * 0.73 + r * 1.31) * 0.5 + (hash2(r * 97 + c, 5) - 0.5) * 1.2;
          const x = (c - (cols - 1) / 2) * sp, yy = y + ((rows - 1) / 2 - r) * sp;
          let a = 0.22 * wipe * mA;
          let colr = valueColor(clamp(v, -1, 1));
          if (hiTok >= 0) {
            const tLock = 10.95 + hiTok * 0.22;
            const lock = sstep(0, 0.1, t - tLock);
            a = mix(a, 1.1 * mA, lock * (1 - sstep(12.0, 12.4, t)));
            colr = cmix(colr, TOKEN_COLS[hiTok], lock * 0.4);
          }
          R.sprite([x, yy, z], sp * 0.36, colr, a, 2);
        }
      }
      // Scanning bars racing down the rows before locking.
      for (let ti = 0; ti < 5; ti++) {
        const t0 = 10.6 + ti * 0.22, t1 = 10.95 + ti * 0.22;
        if (t > t0 && t < t1 + 0.25) {
          const u = ease.outCubic(range(t, t0, t1));
          const yy = y + ((rows - 1) / 2 - MATRIX_ROWS[ti] * u) * sp;
          const half = (cols / 2) * sp;
          const a = 1 - sstep(t1, t1 + 0.25, t);
          R.line([-half, yy, z + 0.05], [half, yy, z + 0.05], TOKEN_COLS[ti], TOKEN_COLS[ti], 0.06, a * 1.5);
          // Connector from the id to the row.
          const idP = [chipXs[ti], chipY - 1.05, 0];
          R.line(vadd(idP, [0, -0.3, 0]), [chipXs[ti] * 1.6, yy, z], TOKEN_COLS[ti], TOKEN_COLS[ti], 0.02, a * 0.9, a * 0.2);
        }
      }
    }

    // Vectors pulled out of the matrix into columns under each chip.
    for (let ti = 0; ti < 5; ti++) {
      const col = TOKEN_COLS[ti];
      const r = MATRIX_ROWS[ti];
      for (let j = 0; j < VEC_N; j++) {
        const c = Math.round(4 + j * 3.7);
        const src = [(c - (MATRIX.cols - 1) / 2) * MATRIX.sp, MATRIX.y + ((MATRIX.rows - 1) / 2 - r) * MATRIX.sp, MATRIX.z];
        const dst = [chipXs[ti], chipY - 1.75 + VEC_TOP - j * VEC_SP, 0];
        const t0 = 12.0 + ti * 0.09 + j * 0.022;
        const u = ease.inOutCubic(range(t, t0, t0 + 0.55));
        if (u <= 0) continue;
        const v = clamp(Math.sin(c * 0.73 + r * 1.31) * 0.5 + (hash2(r * 97 + c, 5) - 0.5) * 1.2, -1, 1);
        // Arc through space on the way.
        let p = vlerp(src, dst, u);
        p = vadd(p, [0, 0, Math.sin(u * Math.PI) * 3]);
        // Positional encoding wave rippling down the column.
        const pe = sstep(13.3, 13.8, t) * (1 - sstep(14.6, 15.2, t));
        const wave = Math.sin(j * 0.9 - t * 7 + ti * 1.3) * 0.12 * pe;
        p = vadd(p, [wave, 0, 0]);
        const cell = valueColor(v);
        const glow = 0.9 + kick * 0.6 + pe * 0.4 * (0.5 + 0.5 * Math.sin(j - t * 7));
        const sp = swirlPos(p, 1000 + ti * 31 + j, t, swirl);
        R.sprite(sp, 0.12 * (1 + kick * 0.25), cell, glow * (u < 1 ? 1.4 : 1), 2);
        if (u < 1) {
          const pPrev = vadd(vlerp(src, dst, Math.max(0, u - 0.08)), [0, 0, Math.sin(Math.max(0, u - 0.08) * Math.PI) * 3]);
          R.line(pPrev, p, col, cell, 0.03, 0, 0.9);
        }
        vecCells.push(sp);
        // A few printed components next to the column.
        if (u >= 1 && j % 4 === 1 && swirl < 0.3) {
          const num = (v >= 0 ? '+' : '') + v.toFixed(2);
          R.text(num, [dst[0] + 0.62, dst[1], 0], 0.2, cmix(cell, COL.white, 0.4), { alpha: 0.75 * sstep(0, 0.3, t - t0 - 0.55) * (1 - swirl * 3), glow: 0.3, fx: decodeFx(t, t0 + 0.55, 0.3, 0.02, j) });
        }
      }
      // Positional-encoding sinusoid alongside the column.
      const pe = sstep(13.3, 13.8, t) * (1 - sstep(14.6, 15.2, t));
      if (pe > 0.01) {
        const pts = [];
        for (let k = 0; k <= 40; k++) {
          const yy = chipY - 1.75 + VEC_TOP + 0.1 - (k / 40) * (VEC_N * VEC_SP);
          pts.push([chipXs[ti] - 0.45 + Math.sin(k * 0.55 - t * 7 + ti * 1.3) * 0.12, yy, 0]);
        }
        R.polyline(pts, COL.white, 0.012, pe * 0.7, pe * 0.1);
      }
    }
    // Vortex core during the build-up.
    if (swirl > 0) {
      R.sprite([0, 0, 0], 1 + swirl * 4, COL.white, swirl * 1.5, 0);
      R.sprite([0, 0, 0], 3 + swirl * 10, COL.violet, swirl * 0.8, 4, t * 3);
    }
    P.aberr += swirl * 0.02;
  }
}

// During 14.6-16 everything spirals into the centre.
function swirlPos(p, seed, t, s) {
  if (s <= 0) return p;
  const r = Math.hypot(p[0], p[1]);
  const a0 = Math.atan2(p[1], p[0]);
  const a = a0 + s * (4 + hash1(seed) * 3);
  const rr = r * (1 - s);
  return [Math.cos(a) * rr, Math.sin(a) * rr, p[2] * (1 - s) + s * 2 * Math.sin(seed)];
}
