'use strict';
// Starter video: copy this folder to videos/<name>/ and edit.
// 20 s at 120 BPM = 10 bars (one bar = 2 s, one 16th step = 0.125 s).
// Put every cut on a bar line and every hit in the score; scenes read
// SCORE.times.<track> to sync (pulse(SCORE.times.bigKick, t, 9) etc.).

// ---------------------------------------------------------------- score
const sc = new ScoreBuilder({ bpm: 120, duration: 20 });
const bt = (bar, step) => sc.bt(bar, step);
sc.chords([[0, 'Am'], [2, 'F'], [4, 'C'], [6, 'G'], [8, 'Am'], [10, 'F'], [12, 'C'], [14, 'G'], [16, 'Am']]);
for (let bar = 0; bar < 2; bar++) { sc.kick(bt(bar, 0), 0.3); sc.kick(bt(bar, 3), 0.2); sc.arpBar(bar, 2, 0.4); }
'HELLO, WORLD'.split('').forEach((ch, i) => sc.add('type', 0.5 + i * 0.125));
sc.build(2, 4);                       // riser + reverse cymbal landing on the drop
sc.drop(4, 1.2);                      // impact + crash + sub drop
for (let bar = 2; bar < 6; bar++) sc.fullBar(bar).rollingBass(bar).arpBar(bar);
sc.melody(2, [[0, 'A4', 3], [3, 'C5', 3], [6, 'E5', 2], [8, 'D5', 4], [12, 'C5', 4]]);
sc.melody(4, [[0, 'G4', 3], [3, 'C5', 3], [6, 'E5', 2], [8, 'G5', 6]]);
sc.whoosh(8);
for (let bar = 6; bar < 8; bar++) sc.halfTimeBar(bar).arpBar(bar, 2, 0.6);
sc.roll(7, 8, 16, 0.5, 0.3, 1);
sc.drop(16, 1).add('ding', 16, { note: midi('A5'), chord: true });
sc.padLevel([[0, 0], [2, 0.7], [16, 0.9], [20, 0]]);
sc.padCut([[0, 300], [3.9, 2500], [4, 2000], [15.9, 5000], [16, 3000], [20, 500]]);
const SCORE = sc.done();

// ---------------------------------------------------------------- scenes
// Each scene is (R, t, local, section). R draws: R.sprite / R.line / R.text,
// R.setCamera(pos, target, up, fov), R.env (background), R.post (grading).
function sceneIntro(R, t, u) {
  envSpace(R, sstep(0, 2, t));
  R.setCamera([0, 0, mix(14, 11, ease.inOutCubic(u / 4))], [0, 0, 0]);
  dust(R, t);
  R.text('HELLO, WORLD', [0, 0.3, 0], 1.2, COL.cyan, { font: 'disp', glow: 0.8, fx: typeFx(t, 0.5, 0.125, COL.cyan) });
  R.text('made with the kit', [0, -1.1, 0], 0.4, COL.white, { alpha: 0.8, fx: decodeFx(t, 2.0, 0.3, 0.03) });
  R.post.glitch = sstep(3.4, 4, t) * 0.6;
}

let CLOUD = null;
function sceneDrop(R, t, u) {
  if (!CLOUD) { // a torus of points, built once
    const rng = mulberry32(7); CLOUD = [];
    for (let i = 0; i < 6000; i++) {
      const a = rng() * TAU, b = rng() * TAU, r = 4 + Math.cos(b) * 1.4;
      CLOUD.push({ p: [Math.cos(a) * r, Math.sin(b) * 1.4 + gauss(rng) * 0.1, Math.sin(a) * r], col: ACCENTS[i % 5], size: 0.05 + rng() * 0.06, b: 0.6 + rng() * 0.6 });
    }
  }
  const kick = pulse(SCORE.times.bigKick, t, 9);
  envSynthwave(R, t, 1, { y: -4 });
  R.setCamera(vadd(orbit([0, 0, 0], 13 - kick * 0.4, u * 0.35, 0.35), shake(t, kick * 0.05)), [0, 0, 0]);
  pointCloud(R, CLOUD, range(u, 0, 1.5), { brightness: 1 + kick * 0.6 });
  shockwave(R, [0, 0, 0], t, 4.0, { size: 10 });
  burst(R, [0, 0, 0], t, 4.0, { n: 60, speed: 9, colors: ACCENTS });
  // Labels live in HUD space (x in [-8, 8], y in [-4.5, 4.5]) so they stay readable while the camera orbits.
  const labels = ['idea', 'score', 'scenes', 'check', 'ship'];
  const xs = chipRow(R, labels, 0.4, 0.5);
  R.use('hud');
  labels.forEach((l, i) => drawChip(R, l, [xs[i], 2.9, 0], 0.4, ACCENTS[i], sstep(4.5 + i * 0.5, 4.7 + i * 0.5, t), { panelLayer: 'hudUnder', lineLayer: 'hud' }));
  for (let i = 0; i < 4; i++) {
    const pts = arcPoints([xs[i], 3.25, 0], [xs[i + 1], 3.25, 0], 0.5, 0, 16);
    drawArc(R, pts, ACCENTS[i], 0.02, 1, sstep(5 + i * 0.5, 5.4 + i * 0.5, t));
  }
  R.use('add');
  R.post.aberr += kick * 0.006;
}

function sceneOutro(R, t, u) {
  envSpace(R, 1 - sstep(18, 19.5, t));
  R.setCamera([0, 0, mix(12, 9, u / 8)], [0, 0, 0]);
  dust(R, t, { alpha: 0.4 });
  const collapse = ease.inExpo(range(t, 14, 16));
  pointCloud(R, CLOUD || [], 1 - collapse, { brightness: 0.8 });
  shockwave(R, [0, 0, 0], t, 16, { size: 12, color: COL.gold });
  burst(R, [0, 0, 0], t, 16, { n: 80, speed: 12, colors: [COL.gold, COL.cyan, COL.magenta] });
  R.text('the end', [0, 0, 0], 1.0, COL.gold, { font: 'disp', alpha: win(t, 16.1, 19.6, 0.3, 0.4), glow: 0.9, fx: decodeFx(t, 16.1) });
  R.post.fade = sstep(19.6, 20, t);
}

// ---------------------------------------------------------------- definition
defineVideo({
  title: 'Hello Kit',
  eyebrow: '20 seconds · starter template',
  subtitle: 'Copy videos/_template to start a new video.',
  score: SCORE,
  sections: [
    { name: 'intro', t0: 0, label: 'INTRO', caption: '▸ type, decode, glitch', scene: 'sceneIntro' },
    { name: 'drop', t0: 4, label: 'DROP', caption: '▸ points, chips, arcs, all on the beat', scene: 'sceneDrop' },
    { name: 'outro', t0: 12, label: 'OUTRO', caption: '▸ collapse and land the final hit', scene: 'sceneOutro' },
  ],
});
