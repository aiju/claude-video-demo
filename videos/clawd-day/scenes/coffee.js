'use strict';
// 8-16 s: coffee. Each sip (SCORE.times.sip) raises the caffeine level: wider eyes,
// faster sunburst, more shake, until the build lands on the drop at 16.

function sceneCoffee(R, t) {
  const T = SCORE.times, sips = T.sip;
  const n = sips.filter((s) => s <= t).length;
  const last = n ? sips[n - 1] : -9, ds = t - last;
  const caf = n ? (n - 1 + sstep(0, 0.3, ds)) / sips.length : 0;
  const kick = pulse(T.bigKick, t, 10);
  const frantic = sstep(14.8, 15.9, t);

  const E = R.env;
  E.baseA = cmix(hex('#2a1040', 0.6), hex('#4a0a3a', 0.7), caf);
  E.baseB = cmix(hex('#6a2a12', 0.6), hex('#ff4a2a', 0.45), caf);
  E.stars = 0; E.nebula = 0.25; E.nebA = hex('#5a1a3a'); E.nebB = hex('#7a3a12');

  const camZ = mix(9.4, 7.0, ease.inCubic(range(t, 11.5, 16))) - kick * 0.1;
  R.setCamera(vadd([0.2, 0.0, camZ], shake(t, 0.01 + 0.06 * frantic, 4)), [0.2, -0.25, 0]);

  // comic sunburst behind Clawd, spinning faster with caffeine
  const C = [-0.4, -0.4, -2];
  const spin = (t - 8) * 0.25 + Math.max(0, t - 12) ** 2 * 0.35;
  R.use('add');
  for (let i = 0; i < 18; i++) {
    const an = (i / 18) * TAU + spin, d = [Math.cos(an), Math.sin(an), 0];
    const col = i % 2 ? hex('#ff9a3c') : hex('#ff4a7a');
    R.line(vadd(C, vscale(d, 1.2)), vadd(C, vscale(d, 13)), col, col, 0.55, (0.16 + 0.14 * caf) * (1 + kick * 0.6), 0.02);
  }
  // drifting coffee beans
  R.use('under');
  for (let i = 0; i < 26; i++) {
    const h1 = hash2(i, 31), h2 = hash2(i, 32), h3 = hash2(i, 33);
    const p = [(h1 - 0.5) * 18, ((fract(h2 + (t - 8) * (0.03 + 0.05 * h3) * (1 + caf * 3)) - 0.5) * 12), -3 - h3 * 3];
    const rot = t * (0.5 + h3) + i;
    pxRect(R, p, 0.42, 0.28, hex('#7a4422', 0.7), 0.85, rot);
    pxRect(R, p, 0.32, 0.05, hex('#2a1208', 0.8), 0.85, rot);
  }

  // Clawd + mug
  const u = 0.26;
  const jitter = shake(t, 0.004 + 0.07 * caf * caf + 0.05 * frantic, 7);
  const hop = 0.12 * pulse(T.bigKick, t, 12) * (1 + caf);
  const p = [-1.0 + jitter[0], -2.3 + hop + Math.abs(jitter[1]), 0];
  const sipE = n ? sstep(0, 0.07, ds) * (1 - sstep(0.16, 0.26, ds)) : 0;
  const flap = caf > 0.5 ? Math.sin(t * 40) * 0.5 * (caf - 0.5) * 2 : 0;
  drawClawd(R, p, u, {
    col: cmix(PAL.clawd, PAL.clawdHot, caf * 0.55), glow: 0.3 + 0.7 * caf,
    eyeScale: 1 + 0.55 * caf + 0.25 * frantic, shine: caf > 0.15 ? 1 : 0, happy: sipE > 0.3 ? 1 : 0,
    blink: t > 9.4 && t < 9.52 ? 1 : 0, look: [0.35 * sipE + 0.2, 0.25 * caf],
    armR: 0.15 + 0.75 * sipE, armL: 0.25 + flap + 0.6 * frantic, squash: 0.12 * kick - 0.08 * sipE,
    sweat: frantic, sweatT: t * 3,
  });
  const rest = [p[0] + 8.2 * u, p[1] + 3.6 * u, 0.1], sip = [p[0] + 4.4 * u, p[1] + 6.2 * u, 0.1];
  const mp = vlerp(rest, sip, sipE);
  drawArt(R, ART.mug, mp, 0.135, { anchor: [0.1, 0.0], rot: sipE * 0.95 });

  // steam
  R.use('add');
  const steamA = 0.35 * (1 - sipE);
  for (let j = 0; j < 3; j++) {
    const pts = [];
    for (let s = 0; s <= 10; s++) {
      const v = s / 10;
      pts.push([mp[0] + 0.35 + j * 0.42 + Math.sin(v * 5 + t * 3 + j * 2) * 0.12 * v, mp[1] + 1.65 + v * 1.1, 0]);
    }
    R.polyline(pts, COL.white, 0.045, steamA, 0);
  }

  // sip! pops
  R.use('top');
  sips.forEach((s0, i) => {
    const age = t - s0;
    if (age < 0 || age > 0.7) return;
    const big = i >= 6;
    const pos = big ? [mp[0] + 2.6 + (hash1(i + 3) - 0.5) * 1.0, mp[1] + 0.5 + age * 0.9 + hash1(i + 9) * 0.4, 0.5]
      : [mp[0] + 1.9 + (hash1(i + 3) - 0.5) * 1.4, mp[1] + 1.6 + age * 1.1 + hash1(i + 9) * 0.5, 0.5];
    R.text(big ? 'SIP!' : 'sip!', pos, (big ? 0.5 : 0.38) * (1 + 0.6 * Math.exp(-age * 14)), ACCENTS[(i * 3) % ACCENTS.length], { font: 'disp', alpha: 1 - sstep(0.45, 0.7, age), glow: 0.7 });
  });
  // FULLY CAFFEINATED
  popText(R, 'FULLY CAFFEINATED', [0.2, 1.45, 0.5], 0.4, hex('#ffe08a', 1.4), t, 14.9, 1e9, { glow: 0.5,
    fx: (i, ch, s) => { s.dx += (hash3(i, Math.floor(t * 30), 1) - 0.5) * 0.12 * frantic; s.dy += (hash3(i, Math.floor(t * 30), 2) - 0.5) * 0.14 * frantic; },
  });
  R.use('add');

  // HUD caffeine meter under the clock
  const hudA = sstep(8.0, 8.4, t);
  R.use('hud');
  R.text(n >= sips.length && Math.sin(t * 30) > 0 ? 'CAFFEINE  MAX!' : 'CAFFEINE', [7.3, 3.08, 0], 0.2, cmix(COL.amber, COL.white, 0.3), { align: 1, alpha: hudA, glow: 0.4 });
  for (let i = 0; i < 10; i++) {
    const lit = i < n, col = cmix(COL.mint, COL.magenta, i / 9);
    const pop = lit ? 1 + 0.5 * pulse([sips[i]], t, 10) : 1;
    R.sprite([4.75 + i * 0.27, 2.72, 0], 0.095 * pop, col, hudA * (lit ? 1.5 : 0.22), 2, 0, 1.15);
  }
  R.use('add');
  R.post.aberr += 0.008 * frantic;
}
