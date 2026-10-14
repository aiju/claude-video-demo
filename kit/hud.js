'use strict';
// Optional HUD overlay: viewfinder corners, chapter label + ticks, caption,
// timecode and a little spectrum driven by the score. Drawn in HUD space
// (x in [-8, 8], y in [-4.5, 4.5]).

function drawHud(R, t, V) {
  const S = V.score || { times: {} }, T = S.times || {};
  const hudA = sstep(1.0, 1.6, t) * (1 - sstep(V.duration - 2.5, V.duration - 1.5, t));
  if (hudA <= 0.001) return;
  R.use('hud');
  const si = sectionIndex(V, t), sec = V.sections[si];
  const st = t - sec.t0;
  const dimCyan = cmix(COL.cyan, COL.white, 0.25);

  const cx = 7.6, cy = 4.15, L = 0.45;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = [sx * cx, sy * cy, 0];
    R.line(p, [p[0] - sx * L, p[1], 0], dimCyan, dimCyan, 0.012, 0.55 * hudA);
    R.line(p, [p[0], p[1] - sy * L, 0], dimCyan, dimCyan, 0.012, 0.55 * hudA);
  }
  if (sec.label) {
    const label = `${String(si + 1).padStart(2, '0')}  ${sec.label}`;
    R.text(label, [-7.3, 3.62, 0], 0.3, COL.white, { align: -1, font: 'disp', alpha: hudA * 0.95, glow: 0.6, tracking: 0.06, fx: decodeFx(t, sec.t0 + 0.05, 0.25, 0.03, si) });
    const barW = 2.6 * ease.outExpo(range(st, 0.05, 0.6));
    R.line([-7.3, 3.3, 0], [-7.3 + barW, 3.3, 0], ACCENTS[si % 5], ACCENTS[si % 5], 0.02, hudA * 1.2, hudA * 0.2);
    V.sections.forEach((s, i) => {
      const done = t >= s.t1 ? 1 : i === si ? 0.5 + 0.5 * Math.sin(t * 8) : 0;
      R.sprite([-7.3 + i * 0.37, 3.05, 0], 0.05, i <= si ? ACCENTS[i % 5] : COL.dim, hudA * (0.5 + done), 2, 0, 1.6);
    });
  }
  if (sec.caption) {
    R.text(sec.caption, [-7.3, -3.72, 0], 0.24, cmix(COL.cyan, COL.white, 0.6), { align: -1, alpha: hudA * 0.85 * sstep(0.2, 0.5, st), glow: 0.4, fx: decodeFx(t, sec.t0 + 0.2, 0.18, 0.012, si + 20) });
  }
  const tc = `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  R.text(tc, [7.3, -3.72, 0], 0.22, dimCyan, { align: 1, alpha: hudA * 0.8, glow: 0.3 });
  if (!V._hudPulses) {
    const e = (k) => T[k] || [];
    V._hudPulses = { kick: e('kick'), hat: e('hat'), sn: e('snare').concat(e('clap')).sort((a, b) => a - b), arp: e('arp'), lead: e('lead'), bass: e('bass') };
  }
  const H = V._hudPulses;
  const kick = pulse(H.kick, t, 10), hat = pulse(H.hat, t, 30), sn = pulse(H.sn, t, 12);
  const arp = pulse(H.arp, t, 14), lead = pulse(H.lead, t, 5), bass = pulse(H.bass, t, 12);
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
