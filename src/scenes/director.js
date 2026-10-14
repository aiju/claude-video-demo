'use strict';
// Picks the scene for a given time, applies global music-synced effects and
// draws the HUD overlay.

const CAPTIONS = {
  prompt: '▸ input: plain text',
  tokens: '▸ text → tokens → ids → vectors',
  embed: '▸ embedding space: similar meanings sit close together',
  attention: '▸ every token looks back at the tokens before it',
  layers: '▸ 32 blocks of attention + MLP on the residual stream',
  logits: '▸ a score for every token in the vocabulary → probabilities',
  generate: '▸ append the new token · run again · repeat',
};

function sectionAt(t) {
  for (let i = SECTIONS.length - 1; i >= 0; i--) if (t >= SECTIONS[i].t0) return i;
  return 0;
}

function directFrame(R, t) {
  R.resetFrameState();
  if (t < 0 || t >= DURATION) { R.post.fade = 1; R.setCamera([0, 0, 10], [0, 0, 0]); return; }
  const S = SCORE, P = R.post;

  if (t < 16) sceneTokens(R, t);
  else if (t < 24) sceneGalaxy(R, t);
  else if (t < 36) sceneAttention(R, t);
  else if (t < 46) sceneLayers(R, t);
  else if (t < 52) sceneLogits(R, t);
  else sceneGenerate(R, t);

  // Global hits: impacts flash and smear, glitch events tear the frame.
  const imp = pulse(S.times.impact, t, 14);
  P.flash += imp * 0.8;
  P.aberr += imp * 0.025;
  for (const g of S.glitch) {
    if (t >= g.t && t < g.t + g.dur) P.glitch = Math.max(P.glitch, 0.5 + 0.5 * hash1(Math.floor(t * 40)));
  }
  // A one-frame flash on every section change.
  P.flash += pulse(SECTIONS.map((s) => s.t0).filter((x) => x > 0), t, 28) * 0.5;
  P.bloom *= 1 + pulse(S.times.bigKick, t, 10) * 0.25;

  drawHud(R, t);
}

function drawHud(R, t) {
  const S = SCORE;
  const hudA = sstep(1.0, 1.6, t) * (1 - sstep(57.5, 58.5, t));
  if (hudA <= 0.001) return;
  R.use('hud');
  const si = sectionAt(t), sec = SECTIONS[si];
  const st = t - sec.t0;
  const dimCyan = cmix(COL.cyan, COL.white, 0.25);

  // Viewfinder corners.
  const cx = 7.6, cy = 4.15, L = 0.45;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = [sx * cx, sy * cy, 0];
    R.line(p, [p[0] - sx * L, p[1], 0], dimCyan, dimCyan, 0.012, 0.55 * hudA);
    R.line(p, [p[0], p[1] - sy * L, 0], dimCyan, dimCyan, 0.012, 0.55 * hudA);
  }

  // Section label with a decode on entry.
  const label = `${String(si + 1).padStart(2, '0')}  ${sec.label}`;
  R.text(label, [-7.3, 3.62, 0], 0.3, COL.white, { align: -1, font: 'disp', alpha: hudA * 0.95, glow: 0.6, tracking: 0.06, fx: decodeFx(t, sec.t0 + 0.05, 0.25, 0.03, si) });
  const barW = 2.6 * ease.outExpo(range(st, 0.05, 0.6));
  R.line([-7.3, 3.3, 0], [-7.3 + barW, 3.3, 0], TOKEN_COLS[si % 5], TOKEN_COLS[si % 5], 0.02, hudA * 1.2, hudA * 0.2);
  // Timeline ticks: one per section.
  SECTIONS.forEach((s, i) => {
    const x = -7.3 + i * 0.37;
    const done = t >= s.t1 ? 1 : i === si ? 0.5 + 0.5 * Math.sin(t * 8) : 0;
    R.sprite([x, 3.05, 0], 0.05, i <= si ? TOKEN_COLS[i % 5] : COL.dim, hudA * (0.5 + done), 2, 0, 1.6);
  });

  // Caption.
  const cap = CAPTIONS[sec.name];
  R.text(cap, [-7.3, -3.72, 0], 0.24, cmix(COL.cyan, COL.white, 0.6), { align: -1, alpha: hudA * 0.85 * sstep(0.2, 0.5, st), glow: 0.4, fx: decodeFx(t, sec.t0 + 0.2, 0.18, 0.012, si + 20) });

  // Timecode + a little music-driven spectrum.
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  R.text(tc, [7.3, -3.72, 0], 0.22, dimCyan, { align: 1, alpha: hudA * 0.8, glow: 0.3 });
  const kick = pulse(S.times.kick, t, 10), hat = pulse(S.times.hat, t, 30), sn = pulse(S.times.snare.concat(S.times.clap).sort((a, b) => a - b), t, 12);
  const arp = pulse(S.times.arp, t, 14), lead = pulse(S.times.lead, t, 5), bass = pulse(S.times.bass, t, 12);
  for (let i = 0; i < 24; i++) {
    const f = i / 23;
    let v = kick * Math.exp(-f * 8) * 1.2 + bass * Math.exp(-Math.abs(f - 0.15) * 10) + sn * Math.exp(-Math.abs(f - 0.45) * 5) * 0.8
      + arp * Math.exp(-Math.abs(f - 0.62) * 9) * 0.7 + lead * Math.exp(-Math.abs(f - 0.5) * 6) * 0.6 + hat * Math.exp(-(1 - f) * 6) * 0.8;
    v = clamp(v * (0.75 + 0.25 * hash2(i, Math.floor(t * 20))), 0.03, 1);
    const x = 5.0 + i * 0.095, y0 = -3.45;
    const c = cmix(COL.cyan, COL.magenta, f);
    R.line([x, y0, 0], [x, y0 + v * 0.55, 0], c, cmix(c, COL.white, 0.3), 0.02, hudA * 0.9);
  }
  R.use('add');
}
