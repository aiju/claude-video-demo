'use strict';
// 38-48 s: ship it. A nervous `git push` in the dark, "Y" on the last 16th, then
// liftoff on the drop at 40: up through the clouds, past the moon, SHIPPED at 44.

// Distance the world has scrolled past the rocket (analytic integral of its speed).
function shipScroll(t) {
  const a = 40.2, b = 42.0, v = 14;
  if (t <= a) return 0;
  if (t <= b) return (v * (t - a) ** 3) / (3 * (b - a) ** 2);
  return (v * (b - a)) / 3 + v * (t - b);
}

function sceneShip(R, t) {
  const T = SCORE.times;
  if (t < 40) return shipBreakdown(R, t, T);
  const kick = pulse(T.bigKick, t, 10);
  const S = shipScroll(t), speed = clamp((t - 40.2) / 1.8);
  const alt = clamp(S / 30);
  const E = R.env;
  E.baseA = cmix(hex('#3a4fd0', 0.45), hex('#020210'), alt);
  E.baseB = cmix(hex('#ff8a5a', 0.6), hex('#0a0626'), alt);
  E.stars = sstep(0.3, 0.8, alt) * 1.0; E.nebula = 0.4 * sstep(0.4, 1, alt); E.nebA = hex('#3a1670'); E.nebB = hex('#08607a');
  const launch = pulse([40], t, 5) * (t >= 40 ? 1 : 0);
  R.setCamera(vadd([0, 0, 10.4 - kick * 0.15], shake(t, 0.12 * launch + 0.025 * speed, 3)), [0, 0, 0]);

  // rocket screen position: sits on the pad, then climbs to centre
  const ry = mix(-2.1, -0.75, ease.inOutCubic(range(t, 40.15, 41.6))) + 0.05 * Math.sin(t * 7);
  const rx = 3.4 * ease.inOutCubic(range(t, 43.1, 44.0));
  const rp = [rx, ry, 0];

  // far clouds (parallax), launch pad, near clouds
  const cloud = (cx, cy, s, a, layer) => {
    R.use(layer);
    [[-0.9, 0, 0.55], [-0.3, 0.25, 0.75], [0.45, 0.18, 0.65], [1.0, -0.05, 0.45], [0, -0.15, 0.6]].forEach(([x, y, r]) =>
      R.sprite([cx + x * s, cy + y * s, -1], r * s, cmix(hex('#ffe0f0', 0.9), hex('#8a7ad0', 0.6), alt), a, 3));
  };
  for (let i = 0; i < 6; i++) {
    const y = 7 - fract(hash1(i + 40) + (S * 0.35) / 14) * 14;
    cloud((hash1(i + 50) - 0.5) * 15, y, 0.8, 0.35 * (1 - sstep(0.5, 0.9, alt)), 'under');
  }
  R.use('over');
  const padY = -2.85 - S;
  if (padY > -8) {
    pxRect(R, [0, padY - 1.2, 0], 30, 2.4, hex('#2a2150', 0.9));
    pxRect(R, [0, padY - 0.05, 0], 3.2, 0.14, PAL.steelDk);
    for (let i = 0; i < 6; i++) pxRect(R, [-2.2, padY + 0.35 + i * 0.6, -0.2], 0.16, 0.62, PAL.steelDk), pxRect(R, [-1.9, padY + 0.35 + i * 0.6, -0.2], 0.6, 0.06, PAL.steelDk, 1, 0.6);
  }
  // the moon flies past
  if (t > 45.2 && t < 48) {
    const my = mix(6.5, -6.5, range(t, 45.2, 47.9));
    drawMoon(R, [-8.4, my, -2], 1.2, 1);
  }
  // speed lines
  R.use('add');
  for (let i = 0; i < 40; i++) {
    const x = (hash1(i + 7) - 0.5) * 17, len = 0.6 + hash1(i + 9) * 1.4;
    const y = 6 - fract(hash1(i + 3) + (S * (0.06 + 0.04 * hash1(i + 5)))) * 12;
    R.line([x, y, -1.5], [x, y + len * (0.3 + speed), -1.5], COL.white, cmix(COL.cyan, COL.white, 0.5), 0.02, 0.5 * speed, 0);
  }

  // exhaust
  const nozzle = [rp[0], rp[1] - 0.05, 0.2];
  const fl = 0.8 + 0.4 * hash1(Math.floor(t * 40));
  R.use('add');
  R.line(nozzle, vadd(nozzle, [0, -(1.4 + 1.6 * speed) * fl, 0]), hex('#ffd36a', 2.2), hex('#ff2d95', 0.6), 0.32, 1.2, 0);
  R.sprite(vadd(nozzle, [0, -0.25, 0]), 0.55 * fl, hex('#ffe08a', 2.2), 1, 0);
  R.sprite(vadd(nozzle, [0, -0.6, 0]), 0.75 * fl, hex('#ff7a3c', 1.4), 0.8, 0);
  // smoke on the pad
  R.use('over');
  for (let i = 0; i < 18; i++) {
    const age = t - 40 - hash1(i) * 0.4;
    if (age < 0 || age > 2.2) continue;
    const dir = i % 2 ? 1 : -1, sp = 1.5 + hash1(i + 20) * 2.5;
    const q = [dir * sp * (1 - Math.exp(-age * 2)), padY + 0.2 + hash1(i + 30) * 0.5 + age * 0.2, 0.3];
    R.sprite(q, 0.35 + age * 0.45, hex('#c8c0e0', 0.6), 0.8 * (1 - age / 2.2), 3);
  }
  drawArt(R, ART.rocket, rp, 0.2, { rot: 0.025 * Math.sin(t * 9) - 0.12 * Math.sin(Math.PI * range(t, 43.1, 44.0)) });

  // telemetry
  R.use('hud');
  const ft = Math.floor(S * 2400);
  R.text(`ALT ${ft.toLocaleString('en-US')} ft`, [7.3, 3.08, 0], 0.2, cmix(COL.cyan, COL.white, 0.4), { align: 1, alpha: sstep(40.3, 40.6, t), glow: 0.4 });
  // shipped!
  const users = Math.floor(1000000 * ease.outExpo(range(t, 44.6, 47.4)));
  if (t >= 44.6) drawChip(R, `happy users: ${users.toLocaleString('en-US')}`, [0, -2.85, 0], 0.3, COL.mint, sstep(44.6, 44.9, t), { panelLayer: 'hudUnder', lineLayer: 'hud' });
  R.use('top');
  popText(R, 'SHIPPED!', [-1.9, 1.9, 0.6], 0.95, hex('#ffd36a', 1.4), t, 44.0, 1e9, { glow: 0.5, fx: waveFx(t, 0.07, 6, 0.6) });
  popText(R, 'v1.0 is live', [-1.9, 0.95, 0.6], 0.36, cmix(COL.mint, COL.white, 0.3), t, 44.35, 1e9, { font: 'mono' });
  const fireworks = [44].concat(T.clap.filter((c) => c > 44 && c < 48));
  fireworks.forEach((f, i) => {
    const c = [(hash1(i + 70) - 0.5) * 13, 2.5 + hash1(i + 71) * 1.1, -0.5];
    burst(R, c, t, f, { n: 46, speed: 5.5, life: 1.0, colors: [ACCENTS[i % 8], ACCENTS[(i + 3) % 8], COL.white], seed: 90 + i, drag: 2.5 });
    shockwave(R, c, t, f, { size: 1.6, color: ACCENTS[i % 8], alpha: 0.5, life: 0.45 });
  });
  R.use('add');
}

function shipBreakdown(R, t, T) {
  envSynthwave(R, t, 0.35, { y: -2.6, speed: 1 });
  R.env.baseA = hex('#05030f'); R.env.baseB = hex('#120a2a');
  const push = ease.inOutCubic(range(t, 38, 40));
  R.setCamera(vadd([0, 0.35, mix(7.6, 5.4, push)], shake(t, 0.015 * push, 5)), [0, 0.35, 0]);
  const yes = t >= T.yes[0];
  const look = Math.sin(t * 7) > 0 ? 0.55 : -0.55;
  drawClawd(R, [0, -1.1, 0], 0.2, {
    look: yes ? [0, 0] : [look, -0.2], sweat: 1, sweatT: t * 2.5, eyeScale: yes ? 1 : 1.1,
    blink: yes ? 1 : 0, squash: (yes ? -0.06 : 0.02 * Math.sin(t * 40)), armL: -0.4, armR: yes ? -0.8 : -0.4,
  });
  drawDesk(R, t, yes ? COL.gold : COL.cyan);
  const n = Math.floor((t - PUSH_T0) / PUSH_RATE) + 1;
  if (t >= PUSH_T0 - 0.1) drawChip(R, PUSH_CMD, [0, 2.25, 0.5], 0.3, COL.cyan, sstep(PUSH_T0 - 0.1, PUSH_T0, t), {
    fx: (i, ch, s) => { if (i >= n) s.alpha = 0; },
  });
  if (t >= 39.3) drawChip(R, 'deploy to production? [Y/n]', [0, 1.45, 0.5], 0.26, COL.amber, sstep(39.3, 39.4, t), { fx: typeFx(t, 39.3, 0.012) });
  popText(R, 'Y', [0, 0.65, 0.6], 0.6, hex('#ffd36a', 2.2), t, T.yes[0]);
  R.post.vignette += 0.2;
}
