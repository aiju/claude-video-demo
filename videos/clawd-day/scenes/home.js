'use strict';
// Home: the hill with Clawd's bed. Used at sunrise (sceneWake) and at night (sceneNight).

const HOME_GROUND = -2.4;

// Stepped pixel hills + ground. k = brightness (night ~0.5, day 1).
function drawHills(R, night) {
  const back = cmix(hex('#2f7a5e', 0.55), hex('#1c1446', 0.6), night);
  const front = cmix(hex('#3f9a5a', 0.45), hex('#140f33', 0.7), night);
  R.use('over');
  [[-4.6, 9.5, 2.1], [4.4, 10.5, 1.5], [9.5, 6, 2.6], [-10, 6, 1.4]].forEach(([cx, w, h]) => {
    for (let i = 0; i < 5; i++) {
      const top = HOME_GROUND + (h * (i + 1)) / 5, ww = w * (1 - i / 5.5);
      pxRect(R, [cx, (HOME_GROUND - 2.5 + top) / 2, -3], ww, top - HOME_GROUND + 2.5, back);
    }
  });
  pxRect(R, [0, HOME_GROUND - 2.4, 0], 30, 4.8, front);
  for (let i = 0; i < 26; i++) {   // grass tufts
    const x = -8 + i * 0.64 + hash1(i) * 0.3;
    if (Math.abs(x) < 2.1) continue;
    pxRect(R, [x, HOME_GROUND + 0.06, 0], 0.08, 0.16, cmul(front, 1.5));
    pxRect(R, [x + 0.1, HOME_GROUND + 0.1, 0], 0.08, 0.24, cmul(front, 1.5));
  }
  R.use('add');
}

// The bed and furniture. o: blanketTop (world y of the blanket's top edge),
// lampOn 0..1, shade, clockShake (rad), sleeper (callback that draws Clawd in bed).
function drawBed(R, t, o) {
  const k = o.shade ?? 1, W = (c) => cmul(c, k);
  R.use('over');
  // lamp table (left)
  pxRect(R, [-2.75, HOME_GROUND + 0.45, 0], 0.9, 0.9, W(PAL.wood));
  pxRect(R, [-2.75, HOME_GROUND + 0.55, 0], 0.7, 0.06, W(PAL.woodDk));
  pxRect(R, [-2.75, HOME_GROUND + 1.15, 0], 0.08, 0.6, W(PAL.steelDk));
  const lampCol = cmix(W(hex('#b88a5a', 0.7)), hex('#ffd08a', 1.6), o.lampOn ?? 0);
  pxRect(R, [-2.75, HOME_GROUND + 1.55, 0], 0.75, 0.45, lampCol);
  pxRect(R, [-2.75, HOME_GROUND + 1.82, 0], 0.5, 0.15, lampCol);
  if (o.lampOn) { R.use('add'); R.sprite([-2.75, HOME_GROUND + 1.4, 0], 2.4, hex('#ffb35a', 0.6), o.lampOn * 0.8, 0); R.use('over'); }
  // headboard
  for (const s of [-1, 1]) {
    pxRect(R, [s * 1.75, -1.05, 0], 0.32, 2.7, W(PAL.woodDk));
    pxRect(R, [s * 1.75, 0.35, 0], 0.46, 0.26, W(PAL.woodDk));
  }
  pxRect(R, [0, -1.25, 0], 3.3, 2.3, W(PAL.wood));
  pxRect(R, [0, 0.0, 0], 2.9, 0.3, W(PAL.wood));
  pxRect(R, [0, -0.52, 0], 2.4, 0.78, W(PAL.sheet));
  if (o.sleeper) o.sleeper();
  R.use('over');
  // blanket: quilt squares, folded sheet on top
  const bt0 = o.blanketTop ?? -1.05, bb = -2.0, bh = bt0 - bb;
  pxRect(R, [0, (bt0 + bb) / 2, 0], 3.2, bh, W(PAL.blanket));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    if ((i + j) % 2) continue;
    pxRect(R, [-1.2 + i * 0.8, bb + (bh - 0.2) * (j + 0.5) / 2, 0], 0.72, (bh - 0.2) / 2 - 0.06, W(PAL.blanketLt));
  }
  pxRect(R, [0, bt0 - 0.1, 0], 3.24, 0.22, W(PAL.sheet));
  // footboard
  pxRect(R, [0, -2.15, 0], 3.6, 0.7, W(PAL.wood));
  pxRect(R, [0, -1.85, 0], 3.3, 0.08, W(PAL.woodDk));
  for (const s of [-1, 1]) pxRect(R, [s * 1.85, -2.0, 0], 0.36, 1.05, W(PAL.woodDk));
  // nightstand + alarm clock
  pxRect(R, [2.75, HOME_GROUND + 0.5, 0], 1.1, 1.0, W(PAL.wood));
  pxRect(R, [2.75, HOME_GROUND + 0.5, 0], 0.9, 0.06, W(PAL.woodDk));
  pxRect(R, [2.75, HOME_GROUND + 0.7, 0], 0.16, 0.08, W(PAL.gold));
  const sh = o.clockShake || 0;
  drawArt(R, ART.clock, [2.75, HOME_GROUND + 1.0 + Math.abs(sh) * 0.5, 0], 0.075, { rot: sh, shade: k });
  R.use('add');
}

// Drifting z's from a sleeper's head.
function drawZzz(R, t, times, origin, until = 1e9, a0 = 1) {
  R.use('top');
  times.forEach((tz, i) => {
    const age = t - tz;
    if (age < 0 || age > 2.4) return;
    const a = sstep(0, 0.25, age) * (1 - sstep(1.5, 2.4, age)) * (1 - sstep(until, until + 0.25, t)) * a0;
    const p = [origin[0] + age * 0.55 + Math.sin(age * 3 + i) * 0.12, origin[1] + age * 0.8, 0.3];
    R.text(i % 2 ? 'Z' : 'z', p, 0.24 + age * 0.14, hex('#c4b5ff', 1.5), { font: 'disp', alpha: a, glow: 0.6 });
  });
  R.use('add');
}

function homeSky(R, top, bottom, stars, horizon) {
  const E = R.env;
  E.baseA = top; E.baseB = bottom; E.stars = stars; E.nebula = stars * 0.25;
  E.nebA = hex('#3a1670'); E.nebB = hex('#08607a');
  E.horizon = horizon; E.horizonColor = hex('#ff7a4d');
}

// ------------------------------------------------------------------ 0-8 s: wake
function sceneWake(R, t) {
  const T = SCORE.times;
  const dawn = sstep(3.8, 7.6, t);
  homeSky(R, cmix(hex('#04071c'), hex('#2a56c9', 0.32), dawn), cmix(hex('#120a30'), hex('#ff9a6a', 0.42), dawn), 0.9 * (1 - dawn), 0.12 + 0.3 * dawn);
  const kick = t > 6.5 ? pulse(T.bigKick, t, 10) : 0;
  const camZ = mix(9.8, 8.4, ease.inOutCubic(range(t, 0, 8))) - kick * 0.08;
  R.setCamera(vadd([0, 0.15, camZ], shake(t, 0.03 * pulse([6], t, 6))), [0, -0.05, 0]);

  // sky objects behind the hills
  drawMoon(R, [-5.0, 2.7 - dawn * 3.2, -4], 0.5, 1 - dawn * 0.8);
  drawSun(R, [6.4, mix(-5.5, 1.9, ease.outCubic(range(t, 3.9, 7.8))), -4], 0.85, t, 1, sstep(5.5, 7, t));
  drawHills(R, 1 - dawn);

  // Clawd: asleep -> alarm panic -> hop out of bed
  const alarmOn = t >= 4 && t < 6;
  const jolt = pulse(T.alarm, t, 18) * (alarmOn ? 1 : 0);
  const hopU = range(t, 6.0, 6.7);
  const inBed = t < 6.0;
  const shade = mix(0.75, 1, dawn);
  const st = { glow: 0.15 + 0.2 * dawn, shade, cap: 1 };
  let p = [0, -1.75, 0], u = 0.14;
  if (t < 4) {
    Object.assign(st, { blink: 1, squash: 0.03 * Math.sin(t * 2.6) });
  } else if (inBed) {
    const lookR = Math.sin(t * 9) > -0.3 ? 0.5 : -0.2;
    Object.assign(st, { blink: t > 4.9 && t < 5.0 ? 1 : 0, eyeScale: 1.15 + 0.3 * jolt, look: [lookR, 0.1], sweat: 1, sweatT: t * 1.6, squash: -0.12 * jolt });
    p = [0, -1.75 + 0.1 * jolt, 0];
  } else {
    const landed = t >= 6.7;
    const y = landed ? -1.55 : mix(-1.75, -1.55, hopU) + 1.7 * 4 * hopU * (1 - hopU);
    const land = pulse([6.7], t, 9) * (landed ? 1 : 0);
    const wave = Math.sin((t - 6.7) * TAU);
    Object.assign(st, {
      happy: 1, squash: landed ? 0.28 * land + 0.12 * kick : -0.15 * Math.sin(hopU * Math.PI), cap: 1 - sstep(6.0, 6.05, t),
      armL: landed ? 1.0 + 0.45 * wave : 1.3, armR: landed ? 1.0 - 0.45 * wave : 1.3,
    });
    p = [0, y + (landed ? 0.18 * Math.abs(Math.sin((t - 6.7) * TAU)) : 0), 0];
    u = mix(0.14, 0.17, sstep(6.0, 6.7, t));
  }
  const shakeClock = alarmOn ? 0.2 * Math.sin(t * 70) * (0.4 + 0.6 * pulse(T.alarm, t, 6)) : 0;
  const blanketTop = inBed ? -1.05 + 0.025 * Math.sin(t * 2.6) : mix(-1.05, -1.62, sstep(6.0, 6.2, t));
  drawBed(R, t, { shade, clockShake: shakeClock, blanketTop, lampOn: 0, sleeper: inBed ? () => drawClawd(R, p, u, st) : null });
  if (!inBed) drawClawd(R, p, u, st);

  // the nightcap flies off when Clawd leaps
  if (t >= 6.0 && t < 7.6) {
    const a = t - 6.0;
    drawArt(R, ART.cap, [-0.2 - a * 2.4, -0.3 + a * 2.6 - a * a * 2.2, 0], 0.11, { rot: a * 5, alpha: 1 - sstep(1.1, 1.6, a) });
  }

  drawZzz(R, t, T.zzz, [0.55, -0.55], 4.0);

  // alarm ring lines + RING!
  R.use('top');
  for (const ta of T.alarm) {
    const age = t - ta;
    if (age < 0 || age > 0.3) continue;
    const r = 0.55 + age * 1.6, a = (1 - age / 0.3) * 1.2;
    for (const side of [-1, 1]) {
      const pts = [];
      for (let j = 0; j <= 8; j++) { const an = (side < 0 ? Math.PI : 0) + (j / 8 - 0.5) * 1.1; pts.push([2.75 + Math.cos(an) * r, -1.0 + Math.sin(an) * r, 0.2]); }
      R.polyline(pts, COL.gold, 0.035, a, a);
    }
  }
  popText(R, 'RING!', [2.75, -0.05, 0.3], 0.42, hex('#ff4d5e', 2.0), t, 4.0, 4.7, { fx: (i, ch, s) => { s.dy += Math.sin(t * 40 + i) * 0.04; } });
  popText(R, 'RING!!', [2.9, 0.25, 0.3], 0.5, hex('#ff4d5e', 2.0), t, 5.0, 5.8, { fx: (i, ch, s) => { s.dy += Math.sin(t * 40 + i) * 0.05; } });

  // title
  const ta = 1 - sstep(3.5, 3.95, t);
  R.text('a day in the life of', [0, 2.75, 0], 0.34, cmix(COL.white, hex('#c4b5ff'), 0.5), { alpha: ta * 0.9, glow: 0.4, fx: decodeFx(t, 0.4, 0.3, 0.03, 1) });
  R.text('CLAWD', [0, 1.6, 0], 1.35, PAL.clawdHot, {
    font: 'disp', alpha: ta, glow: 0.7, tracking: 0.08,
    fx: (i, ch, s) => { const k = clamp((t - (1.0 + i * 0.12)) / 0.45); s.alpha *= k > 0 ? 1 : 0; s.dy += (1 - ease.outBack(k)) * 1.2; s.dy += Math.sin(t * 2 + i) * 0.04; },
  });

  // good morning
  popText(R, 'GOOD MORNING!', [0, 2.2, 0.3], 0.85, hex('#ffd36a', 1.35), t, 6.0, 7.75, { glow: 0.5, fx: waveFx(t, 0.08, 6, 0.6) });
  R.use('top');
  burst(R, [0, -0.4, 0.4], t, 6.0, { n: 50, speed: 6, colors: [COL.gold, COL.coral, COL.pink, COL.white], life: 1.0 });
  shockwave(R, [0, -0.6, 0.2], t, 6.0, { size: 3.5, color: COL.gold, alpha: 0.5 });
  R.use('add');
  R.post.fade = 1 - sstep(0, 0.6, t);
}

// ------------------------------------------------------------------ 48-60 s: night
function sceneNight(R, t) {
  const T = SCORE.times;
  const dark = sstep(48, 51, t), lightsOff = sstep(51.5, 51.7, t);
  homeSky(R, cmix(hex('#3a2a8a', 0.5), hex('#03051a'), dark), cmix(hex('#ff6a7a', 0.6), hex('#0e0828'), dark), 0.25 + 0.75 * dark, 0.35 * (1 - dark) + 0.06);
  const outro = ease.inOutCubic(range(t, 56, 60));
  R.setCamera([0, mix(0.15, 0.9, outro), mix(9.2, 10.4, outro) - mix(0, 0.6, range(t, 48, 56))], [0, mix(-0.05, 0.8, outro), 0]);

  drawMoon(R, [-6.6, mix(-1.5, 2.9, ease.outCubic(range(t, 48, 53))), -4], 0.55, 1);
  // a shooting star for the ending
  if (t > 57.2 && t < 58.0) {
    const u = (t - 57.2) / 0.8, a = Math.sin(u * Math.PI);
    const p0 = [3.5 - u * 5, 3.8 - u * 1.6, -3];
    R.line(p0, vadd(p0, [1.2, 0.4, 0]), COL.white, hex('#8fa2ff'), 0.04, a * 1.6, 0);
    R.sprite(p0, 0.12, COL.white, a * 1.6, 4);
  }
  drawHills(R, 0.6 + 0.4 * dark);

  // Clawd: walk in, yawn, hop into bed, nightcap, lights out
  const shade = mix(0.9, 0.62, dark) * mix(1, 0.85, lightsOff);
  const st = { shade, glow: 0.15 };
  let p, u = 0.15, inBed = false;
  if (t < 49) {
    const w = ease.outCubic(range(t, 48, 49));
    p = [mix(-6.5, -2.2, w), HOME_GROUND - 0.15 + 0.08 * Math.abs(Math.sin(t * TAU * 2)), 0];
    Object.assign(st, { walk: t * TAU * 2 * (1 - w * 0.9), look: [-0.3, 0], armL: 0.2 * Math.sin(t * 12), armR: -0.2 * Math.sin(t * 12) });
  } else if (t < 50.0) {
    const y = sstep(49, 49.4, t) * (1 - sstep(49.7, 50, t));
    p = [-2.2, HOME_GROUND - 0.15, 0];
    Object.assign(st, { squash: -0.22 * y, blink: y > 0.1 ? 1 : 0, armL: 0.2 + 1.2 * y, armR: 0.2 + 1.2 * y });
  } else if (t < 50.7) {
    const h = range(t, 50.0, 50.7);
    p = [mix(-2.2, 0, h), mix(HOME_GROUND - 0.15, -1.75, h) + 1.3 * 4 * h * (1 - h), 0];
    Object.assign(st, { squash: -0.12, armL: 1.0, armR: 1.0, happy: 1 });
  } else {
    inBed = true;
    p = [0, -1.75 + 0.06 * pulse([50.7], t, 8), 0];
    const sleepy = sstep(51.2, 51.9, t);
    Object.assign(st, {
      squash: 0.2 * pulse([50.7], t, 10) + 0.03 * Math.sin(t * 2.6) * sleepy,
      blink: t > 52 ? 1 : mix(0.35, 1, sleepy), cap: ease.outBack(range(t, 51.0, 51.3)),
    });
  }
  const blanketTop = inBed ? mix(-1.62, -1.05, ease.outCubic(range(t, 50.75, 51.0))) + 0.025 * Math.sin(t * 2.6) : -1.62;
  drawBed(R, t, { shade, blanketTop, lampOn: 1 - lightsOff, sleeper: inBed ? () => drawClawd(R, p, u, st) : null });
  if (!inBed) drawClawd(R, p, u, st);
  popText(R, 'yaaawn', [-2.2, -0.35, 0.3], 0.36, hex('#c4b5ff', 1.5), t, 49.1, 49.9, { fx: waveFx(t, 0.05, 5, 0.7) });

  // dream bubble: sheep jumping a fence, one per beat; the eighth is a crab
  const bub = ease.outBack(range(t, 51.8, 52.2)) * (1 - ease.inCubic(range(t, 56.0, 56.4)));
  if (bub > 0.01) {
    const C = [3.1, 1.15, 0.5];
    R.use('over');
    [[0.32, -0.2, 0.08], [0.75, 0.15, 0.12], [1.25, 0.45, 0.17]].forEach(([x, y, r], i) => {
      const a = sstep(51.6 + i * 0.1, 51.75 + i * 0.1, t) * (bub > 0.5 ? 1 : bub * 2);
      R.sprite([x, y, 0.5], r + 0.03, hex('#a99bff', 1.2), a, 3);
      R.sprite([x, y, 0.5], r, hex('#1d1650'), a, 3);
    });
    const blobs = [[-1.25, 0, 0.95], [-0.45, 0.45, 1.0], [0.55, 0.45, 1.0], [1.3, 0.05, 0.95], [0.55, -0.42, 0.95], [-0.5, -0.42, 0.95]];
    for (const pass of [0, 1]) for (const [x, y, r] of blobs) R.sprite([C[0] + x * bub, C[1] + y * bub, 0.5], (r + (pass ? 0 : 0.05)) * bub, pass ? hex('#1d1650') : hex('#a99bff', 1.2), 1, 3);
    if (bub > 0.6) {
      const ga = sstep(0.6, 0.9, bub);
      pxRect(R, [C[0], C[1] - 0.62, 0.55], 3.4, 0.12, hex('#36d17a', 0.6), ga);
      // fence
      for (const fx of [-0.18, 0.18]) pxRect(R, [C[0] + fx, C[1] - 0.32, 0.55], 0.08, 0.55, PAL.wood, ga);
      for (const fy of [-0.22, -0.4]) pxRect(R, [C[0], C[1] + fy, 0.55], 0.6, 0.07, PAL.wood, ga);
      const n = T.sheep.filter((s) => s + 0.5 <= t).length;
      T.sheep.forEach((s0, i) => {
        const v = (t - s0) / 1.0;
        if (v < 0 || v > 1) return;
        const x = C[0] - 1.55 + v * 3.1, jump = Math.sin(Math.PI * clamp((v - 0.3) / 0.4));
        const a = sstep(0, 0.12, v) * (1 - sstep(0.88, 1, v)) * ga;
        const crab = i === 7;
        drawArt(R, crab ? ART.crab : ART.sheep, [x, C[1] - 0.58 + jump * 0.55, 0.6], crab ? 0.05 : 0.065, { alpha: a, rot: crab ? 0 : -0.25 * Math.cos(Math.PI * clamp((v - 0.3) / 0.4)) * (jump > 0 ? 1 : 0) });
      });
      R.use('top');
      const label = n >= 8 ? '8 sheep?? (1 crab)' : `${n} sheep`;
      const pop = 1 + 0.35 * pulse(T.sheep.map((s) => s + 0.5), t, 10);
      R.text(label, [C[0], C[1] + 0.62, 0.6], 0.24 * pop, hex('#e6e0ff', 1.4), { alpha: ga, glow: 0.4 });
    }
    R.use('add');
  }
  drawZzz(R, t, [52.3, 53.3, 54.3, 55.3, 56.3, 57.3], [0.5, -0.5], 1e9, 0.9);

  // goodnight
  const ga = sstep(56.0, 56.5, t) * (1 - sstep(58.6, 59.4, t));
  R.text('goodnight, clawd', [0, 2.7, 0.5], 0.6, hex('#c4b5ff', 1.4), { font: 'disp', alpha: ga, glow: 0.6, fx: decodeFx(t, 56.0, 0.35, 0.04, 9) });
  R.text('see you tomorrow ✦', [0, 1.85, 0.5], 0.32, cmix(COL.gold, COL.white, 0.4), { alpha: ga * sstep(56.9, 57.3, t), glow: 0.5, fx: typeFx(t, 56.9, 0.04) });
  R.post.exposure *= mix(1, 0.85, lightsOff);
  R.post.fade = sstep(58.9, 60, t);
}
