'use strict';
// 16-28 s: deep work. Clawd types behind a laptop between two floating terminals,
// tests go green, a bug crawls onto the desk and gets stomped on the bar line at 24.

const DESK_Y = -1.45;
const CODE_LINES = [
  'function day(clawd) {',
  '  clawd.wake();',
  '  clawd.sip(coffee, 10);',
  '  while (ideas.left()) {',
  '    clawd.write(code);',
  '    clawd.test(code);',
  '  }',
  '  return "ship it";',
  '}',
];

// Desk + laptop seen from behind (lid with a tiny Clawd sticker). glowCol lights Clawd's face.
function drawDesk(R, t, glowCol, k = 1) {
  R.use('over');
  pxRect(R, [0, DESK_Y - 0.11, 0.2], 5.4, 0.22, cmul(hex('#2a2150'), k));
  for (const s of [-1, 1]) pxRect(R, [s * 2.3, DESK_Y - 1.1, 0.15], 0.18, 1.9, cmul(hex('#1c1638'), k));
  pxRect(R, [0, DESK_Y + 0.7, 0.3], 2.6, 1.4, cmul(PAL.steel, k));
  pxRect(R, [0, DESK_Y + 0.7, 0.3], 2.44, 1.24, cmul(hex('#c8cde4', 0.8), k));
  drawClawd(R, [0, DESK_Y + 0.42, 0.31], 0.032, { glow: 0, happy: 1 });
  R.use('top');
  R.line([-2.7, DESK_Y, 0.25], [2.7, DESK_Y, 0.25], COL.cyan, COL.magenta, 0.03, 0.9 * k);
  R.line([-1.3, DESK_Y + 1.4, 0.32], [1.3, DESK_Y + 1.4, 0.32], glowCol, glowCol, 0.03, 0.8);
  R.sprite([0, DESK_Y + 1.5, 0.35], 1.3, cmul(glowCol, 0.45), 0.45, 0);
  R.use('add');
}

// A floating terminal window: dark panel, title bar, outline. Returns the top-left text origin.
function drawTerminal(R, c, hw, hh, title, col, a) {
  if (a <= 0.001) return;
  R.use('under');
  pxRect(R, c, hw * 2, hh * 2, COL.ink, 0.82 * a);
  pxRect(R, [c[0], c[1] + hh - 0.2, c[2]], hw * 2, 0.4, hex('#241a44'), 0.95 * a);
  R.use('add');
  rectOutline(R, c, hw, hh, col, 0.025, 0.7 * a);
  [COL.coral, COL.amber, COL.mint].forEach((cc, i) => R.sprite([c[0] - hw + 0.3 + i * 0.25, c[1] + hh - 0.2, c[2]], 0.07, cc, a * 1.2, 3));
  R.text(title, [c[0] + 0.3, c[1] + hh - 0.2, c[2]], 0.2, cmix(col, COL.white, 0.5), { alpha: a * 0.8, glow: 0.3 });
}

function sceneWork(R, t) {
  const T = SCORE.times;
  const kick = pulse(T.bigKick, t, 10);
  envSynthwave(R, t, 1, { y: -2.6, speed: 5 });
  const squashT = 24, hit = pulse([squashT], t, 7) * (t >= squashT ? 1 : 0);
  R.setCamera(vadd([Math.sin((t - 16) * 0.35) * 0.7, 0.35, 10.6 - kick * 0.12], shake(t, 0.12 * hit, 9)), [0, 0.05, 0]);

  // terminals slide in on the drop
  const inL = ease.outBack(range(t, 16.0, 16.5)), inR = ease.outBack(range(t, 16.15, 16.65));
  const L = [-5.15 - (1 - inL) * 7, 0.45, -0.5], Rr = [5.15 + (1 - inR) * 7, 0.45, -0.5];
  drawTerminal(R, L, 2.55, 1.9, 'clawd.js', COL.cyan, sstep(16, 16.2, t));
  drawTerminal(R, Rr, 2.55, 1.9, 'tests', COL.mint, sstep(16.15, 16.35, t));
  // code types itself out
  const chars = Math.floor(Math.max(0, t - 16.4) * 32);
  let used = 0;
  CODE_LINES.forEach((line, i) => {
    const vis = clamp(chars - used, 0, line.length);
    used += line.length + 2;
    if (vis <= 0) return;
    const col = line.trim().startsWith('return') ? COL.amber : i === 0 || line.trim() === '}' ? COL.violet : cmix(COL.cyan, COL.white, 0.35);
    R.text(line.slice(0, vis), [L[0] - 2.3, L[1] + 1.25 - i * 0.37, L[2]], 0.22, col, { align: -1, glow: 0.4 });
  });
  if (Math.sin(t * 12) > 0) {
    const li = Math.min(CODE_LINES.length - 1, CODE_LINES.findIndex((_, i) => CODE_LINES.slice(0, i + 1).reduce((s, l) => s + l.length + 2, 0) > chars));
    const row = li < 0 ? CODE_LINES.length - 1 : li;
    R.sprite([L[0] - 2.25 + (chars >= used ? 0.3 : 0), L[1] + 1.25 - (row + (chars >= used ? 1 : 0)) * 0.37, L[2]], 0.08, COL.cyan, 1, 2, 0, 0.7);
  }
  // tests
  const tests = ['✓ wake_up()', '✓ coffee(10)', '✓ vibes()', '✓ is_helpful()'];
  if (t < T.check[0]) R.text('running' + '.'.repeat(1 + (Math.floor(t * 4) % 3)), [Rr[0] - 2.3, Rr[1] + 1.25, Rr[2]], 0.22, cmix(COL.mint, COL.white, 0.4), { align: -1, alpha: sstep(16.6, 16.9, t), glow: 0.3 });
  tests.forEach((s, i) => {
    const t0 = T.check[i];
    if (t < t0) return;
    R.text(s, [Rr[0] - 2.3, Rr[1] + 1.25 - i * 0.37, Rr[2]], 0.22 * (1 + 0.4 * Math.exp(-(t - t0) * 14)), COL.mint, { align: -1, glow: 0.5 });
  });
  if (t >= 22 && t < squashT) {
    R.text('✗ bug found!', [Rr[0] - 2.3, Rr[1] + 1.25 - 4 * 0.37, Rr[2]], 0.22, hex('#ff4d5e', 1.6), { align: -1, alpha: Math.sin(t * 20) > -0.3 ? 1 : 0.3, glow: 0.6 });
  }
  if (t >= squashT) {
    R.text('✓ bug squashed', [Rr[0] - 2.3, Rr[1] + 1.25 - 4 * 0.37, Rr[2]], 0.22 * (1 + 0.4 * pulse([squashT], t, 12)), COL.mint, { align: -1, glow: 0.5 });
    popText(R, 'ALL GREEN ✓', [Rr[0] + 0.5, Rr[1] - 1.3, Rr[2]], 0.38, hex('#3dffb5', 1.8), t, 25.0, 1e9, { glow: 0.8 });
  }

  // Clawd: typing, noticing the bug, jumping, stomping, celebrating
  const types = T.type.filter((x) => x >= 16 && x < 22.1);
  const ti = lastIndex(types, t), tap = ti >= 0 ? Math.exp(-(t - types[ti]) * 14) : 0;
  const tapL = ti % 2 === 0 ? tap : 0, tapR = ti % 2 === 1 ? tap : 0;
  const noticed = sstep(22.2, 22.4, t);
  const jumpU = range(t, 23.4, 24.0);
  const bugX = mix(2.55, 1.2, ease.outCubic(range(t, 22.0, 23.45)));
  let p = [0, -1.1, 0], st, inFront = false;
  const u = 0.2;
  if (t < 23.4) {
    st = {
      look: [mix(0, 0.65, noticed), mix(-0.3, -0.25, noticed)], squash: 0.05 * tap + 0.06 * kick,
      armL: -0.35 - 0.35 * tapL, armR: -0.35 - 0.35 * tapR, sweat: noticed, sweatT: t * 2, eyeScale: 1 + 0.25 * noticed, shine: 1,
      blink: t > 18.9 && t < 19.0 ? 1 : 0,
    };
  } else if (t < squashT) {
    p = [mix(0, 1.2, jumpU), mix(-1.1, DESK_Y, ease.inQuad(jumpU)) + 1.9 * 4 * jumpU * (1 - jumpU), 0.4];
    st = { squash: -0.18 * Math.sin(jumpU * Math.PI), armL: 1.3, armR: 1.3, eyeScale: 1.2, look: [0.2, -0.5] };
    inFront = jumpU > 0.2;
  } else {
    const b = Math.abs(Math.sin((t - squashT) * Math.PI * 2));
    p = [1.2, DESK_Y + (t > 24.6 ? 0.22 * b : 0), 0.4];
    const wave = Math.sin((t - squashT) * TAU);
    inFront = true;
    st = { happy: 1, squash: 0.38 * hit + 0.1 * kick, armL: 1.0 + 0.5 * wave, armR: 1.0 - 0.5 * wave, glow: 0.5 };
  }
  const glowCol = t >= squashT ? COL.mint : t >= 22 ? hex('#ff4d5e', 1.2) : COL.cyan;
  if (!inFront) drawClawd(R, p, u, st);
  drawDesk(R, t, glowCol);

  // the bug
  if (t >= 22.0) {
    const steps = lastIndex(T.bugstep, t);
    const squashed = t >= squashT;
    const appear = sstep(22.0, 22.2, t);
    drawArt(R, steps % 2 ? ART.bugB : ART.bugA, [bugX, DESK_Y + 0.02, 0.45], 0.09, {
      sx: squashed ? 1.7 : 1, sy: squashed ? 0.22 : 1, alpha: appear * (squashed ? 0.9 : 1),
      shade: squashed ? 0.6 : 1, rot: squashed ? 0 : 0.06 * Math.sin(t * 30),
    });
    if (t < squashT) speech(R, 'a wild BUG appeared!', [2.4, -2.35, 0.6], 0.26, hex('#ff4d5e', 1.4), t, 22.15, 23.9, { tail: -0.6, rate: 0.025 });
  }
  if (inFront) drawClawd(R, p, u, st);

  // stomp!
  R.use('top');
  for (let i = 0; i < 16; i++) {   // pixel debris
    const age = t - squashT;
    if (age < 0 || age > 0.9) break;
    const an = Math.PI * (0.1 + 0.8 * hash2(i, 77)), sp = 2 + 3 * hash2(i, 78);
    const q = [1.2 + Math.cos(an) * sp * age * (i % 2 ? 1 : -1), DESK_Y + Math.sin(an) * sp * age - 5 * age * age, 0.6];
    R.sprite(q, 0.06, i % 3 ? COL.mint : hex('#7dff5a', 1.6), 1.3 * (1 - age / 0.9), 2, age * 8);
  }
  shockwave(R, [1.2, DESK_Y, 0.5], t, squashT, { size: 3.5, color: COL.mint, alpha: 0.6 });
  popText(R, 'SQUASHED!', [1.0, 2.55, 0.6], 0.9, hex('#7dff5a', 1.4), t, squashT, 26.2, { glow: 0.5,
    fx: (i, ch, s) => { s.dy += Math.sin(t * 18 + i * 0.8) * 0.05; },
  });
  confetti(R, t, 24.6, { n: 60, seed: 11, alpha: 1 - sstep(27.3, 27.9, t) });
  R.use('add');
}
