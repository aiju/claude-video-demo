'use strict';
// "Clawd's Day": 60 s at 120 BPM (30 bars, 1 bar = 2 s) in C major.
// wake 0-8 · coffee 8-16 · deep work 16-28 · beach + crab rave 28-38 · ship it 38-48 · night 48-60
// Every hit lives in the score; scenes read SCORE.times.<track> to sync.

const sc = new ScoreBuilder({ bpm: 120, duration: 60 });
const bt = (bar, s = 0) => sc.bt(bar, s);
sc.chords([
  [0, 'Cmaj7'], [2, 'Em7'], [4, 'Fmaj7'], [6, 'G'],
  [8, 'C'], [10, 'G'], [12, 'Am'], [14, 'F'],
  [16, 'C'], [18, 'G'], [20, 'Am'], [22, 'F'], [24, 'C'], [26, 'G'],
  [28, 'F'], [30, 'C'], [32, 'Dm7'], [34, 'C'], [36, 'F'], [37, 'G'],
  [38, 'Am'], [40, 'C'], [42, 'G'], [44, 'Am'], [46, 'F'],
  [48, 'Fmaj7'], [50, 'Em7'], [52, 'Dm7'], [54, 'G'], [56, 'Cmaj7'],
]);
const pluck = (t, n, v = 0.6) => sc.add('pluck', t, { note: midi(n), v });
const lull = (bar, notes, v) => notes.forEach(([s, n]) => pluck(bt(bar, s), n, v));

// ---- 0-8 wake: music-box lullaby, alarm, hop out of bed
lull(0, [[0, 'E5'], [3, 'G5'], [6, 'B5'], [8, 'C6'], [11, 'B5'], [14, 'G5']], 0.55);
lull(1, [[0, 'D5'], [3, 'G5'], [6, 'B5'], [8, 'D6'], [11, 'B5'], [14, 'G5']], 0.55);
sc.marks('zzz', [0.3, 1.2, 2.1, 3.0]);
const ALARM = [0, 1, 2, 3, 8, 9, 10, 11].map((s) => bt(2, s));
ALARM.forEach((t) => sc.add('blip', t, { note: midi('G6'), v: 0.75 }));
sc.marks('alarm', ALARM);
for (let s = 0; s < 16; s += 2) sc.add('hat', bt(2, s), { v: 0.15 });
sc.add('ding', 6, { note: midi('C6'), chord: true, v: 0.7 }).add('impact', 6, { v: 0.45 }).add('crash', 6, { v: 0.5 });
sc.fullBar(3, { clap: false }).offbeatBass(3).arpBar(3, 2, 0.5);
sc.whoosh(8, 0.6, 1, 0.5);

// ---- 8-16 coffee: sips get faster and higher as the caffeine kicks in
for (let bar = 4; bar < 8; bar++) { sc.fullBar(bar, { clap: bar >= 6 }); sc.offbeatBass(bar); sc.arpBar(bar, 2, 0.55); }
const SIPS = [8.5, 10.5, 12.5, 13.5, 14.0, 14.5, 15.0, 15.25, 15.5, 15.75];
['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6'].forEach((n, i) => sc.add('blip', SIPS[i], { note: midi(n), v: 0.85 }));
sc.marks('sip', SIPS);
sc.build(12, 16);
sc.roll(7, 0, 16, 1, 0.25, 0.9);
sc.glitch(15.5, 0.45);

// ---- 16-28 deep work: the drop, typing, tests, a bug, a stomp
sc.drop(16, 1.2);
for (let bar = 8; bar < 14; bar++) { sc.fullBar(bar); sc.rollingBass(bar); sc.arpBar(bar, 1, 0.65); }
const HOOK = [
  [[0, 'E5', 2], [2, 'G5', 2], [4, 'C6', 3], [7, 'B5', 1], [8, 'G5', 2], [10, 'E5', 2], [12, 'G5', 4]],
  [[0, 'D5', 2], [2, 'G5', 2], [4, 'B5', 3], [7, 'A5', 1], [8, 'G5', 2], [10, 'D5', 2], [12, 'B4', 4]],
  [[0, 'C5', 2], [2, 'E5', 2], [4, 'A5', 3], [7, 'G5', 1], [8, 'E5', 2], [10, 'C5', 2], [12, 'E5', 4]],
  [[0, 'F5', 2], [2, 'A5', 2], [4, 'C6', 2], [6, 'D6', 2], [8, 'C6', 2], [10, 'A5', 2], [12, 'G5', 4]],
];
HOOK.forEach((n, i) => sc.melody(8 + i, n, 'lead', 0.9));
sc.melody(12, HOOK[0], 'lead', 0.9);
sc.melody(13, [[0, 'D5', 2], [2, 'G5', 2], [4, 'B5', 3], [7, 'A5', 1], [8, 'B5', 2], [10, 'C6', 2], [12, 'D6', 4]], 'lead', 0.9);
for (let bar = 8; bar < 11; bar++) for (let s = 1; s < 16; s += 2) sc.add('type', bt(bar, s));
const CHECKS = [20, 20.5, 21, 21.5];
['C6', 'E6', 'G6', 'C7'].forEach((n, i) => pluck(CHECKS[i], n, 0.7));
sc.marks('check', CHECKS);
sc.glitch(22, 0.3).whoosh(22.1, 0.5, 1, 0.5);
const BUGSTEPS = []; for (let t = 22.25; t < 23.45; t += 0.125) BUGSTEPS.push(t);
BUGSTEPS.forEach((t) => sc.add('tick', t));
sc.marks('bugstep', BUGSTEPS);
sc.whoosh(23.75, 0.5, -1, 0.6);
sc.drop(24, 0.9);
sc.marks('squash', [24]);
sc.whoosh(28, 0.8, 1, 0.6);

// ---- 28-38 beach: tropical stroll, three crabs, a question, CRAB RAVE
for (let bar = 14; bar < 16; bar++) {
  sc.halfTimeBar(bar); sc.offbeatBass(bar);
  for (const s of [2, 6, 10, 14]) { const t = bt(bar, s); sc.voicing(sc.chordAt(t)).slice(1).forEach((n) => sc.add('pluck', t, { note: n + 12, v: 0.32 })); }
}
const STEPS = []; for (let t = 28; t < 32; t += 0.25) STEPS.push(t);
sc.marks('step', STEPS);
const CRABPOP = [32, 32.25, 32.5];
['E6', 'G6', 'C7'].forEach((n, i) => sc.add('blip', CRABPOP[i], { note: midi(n), v: 0.8 }));
sc.marks('crabpop', CRABPOP);
sc.longBass(32, 1.9, 0.6);
'are you one of us?'.split('').forEach((ch, i) => { if (ch !== ' ') sc.add('type', 32.78 + i * 0.045); });
'uh... yes!'.split('').forEach((ch, i) => { if (ch !== ' ') sc.add('type', 33.38 + i * 0.045); });
sc.build(32.5, 34, 0.8);
sc.drop(34, 0.9);
for (let bar = 17; bar < 19; bar++) { sc.fullBar(bar); sc.rollingBass(bar); sc.arpBar(bar, 1, 0.6); }
sc.melody(17, [[0, 'C6', 1], [2, 'C6', 1], [3, 'G5', 1], [5, 'E5', 1], [6, 'G5', 1], [8, 'C6', 1], [10, 'C6', 1], [11, 'D6', 1], [13, 'E6', 1], [14, 'D6', 2]], 'lead', 0.95);
sc.melody(18, [[0, 'A5', 1], [2, 'A5', 1], [3, 'F5', 1], [5, 'C5', 1], [6, 'F5', 1], [8, 'B5', 1], [10, 'B5', 1], [11, 'G5', 1], [13, 'D6', 1], [14, 'B5', 2]], 'lead', 0.95);

// ---- 38-48 ship it: breakdown, git push, liftoff, SHIPPED, fireworks
const PUSH_CMD = '$ git push origin main', PUSH_T0 = 38.25, PUSH_RATE = 0.055;
PUSH_CMD.split('').forEach((ch, i) => { if (i > 1 && ch !== ' ') sc.add('type', PUSH_T0 + i * PUSH_RATE); });
sc.add('blip', 39.75, { note: midi('E6'), v: 0.9 }).add('type', 39.75);
sc.marks('yes', [39.75]);
sc.build(38, 40, 1.0);
sc.roll(19, 8, 16, 0.5, 0.2, 1);
sc.drop(40, 1.3);
sc.marks('launch', [40]);
for (let bar = 20; bar < 24; bar++) { sc.fullBar(bar); sc.rollingBass(bar); sc.arpBar(bar, 1, 0.7); sc.melody(bar, HOOK[bar - 20], 'lead', 0.9); }
sc.add('impact', 44, { v: 0.6 }).add('ding', 44, { note: midi('C6'), chord: true, v: 0.8 });
sc.marks('shipped', [44]);
sc.whoosh(48, 1.0, -1, 0.6);

// ---- 48-60 night: yawn, into bed, counting sheep, goodnight
for (let bar = 24; bar < 28; bar++) {
  sc.kick(bt(bar, 0), 0.5); sc.kick(bt(bar, 8), 0.35);
  for (let s = 4; s < 16; s += 8) sc.add('hat', bt(bar, s), { v: 0.12 });
  sc.longBass(bt(bar, 0), 1.8, 0.55); sc.arpBar(bar, 2, 0.35);
}
sc.melody(24, [[2, 'G5', 2], [4, 'E5', 2], [6, 'C5', 8]], 'lead', 0.55);   // the yawn
sc.marks('yawn', [49]);
sc.whoosh(50.35, 0.5, 1, 0.4);
pluck(50.75, 'C5', 0.6);
sc.add('blip', 51.0, { note: midi('A5'), v: 0.6 });
sc.add('tick', 51.5);
sc.marks('lightsOff', [51.5]);
const SHEEP = Array.from({ length: 8 }, (_, i) => 52 + i * 0.5);
['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5'].forEach((n, i) => pluck(SHEEP[i], n, 0.65));
sc.add('blip', SHEEP[7], { note: midi('C7'), v: 0.7 });   // ...the eighth one is a crab
sc.marks('sheep', SHEEP);
sc.add('ding', 56, { note: midi('C6'), chord: true, v: 0.6 }).add('crash', 56, { v: 0.35 });
lull(28, [[0, 'E5'], [3, 'G5'], [6, 'B5'], [8, 'C6'], [11, 'B5'], [14, 'G5']], 0.45);
pluck(58, 'C6', 0.4); pluck(58.75, 'G5', 0.3); pluck(59.25, 'E5', 0.25);

sc.padLevel([[0, 0.25], [3.9, 0.45], [6, 0.7], [16, 0.8], [28, 0.6], [32, 0.85], [34, 0.75], [38, 0.95], [40, 0.8], [48, 0.75], [56, 0.85], [59.6, 0]]);
sc.padCut([[0, 700], [4, 1200], [6, 2200], [12, 2000], [15.95, 5000], [16, 2600], [28, 1800], [32, 1200], [33.95, 4000], [34, 2600], [38, 700], [39.95, 5000], [40, 2800], [48, 1400], [56, 1800], [60, 500]]);
sc.arpCut([[0, 2200], [8, 3000], [16, 4500], [48, 2400], [60, 1500]]);
const SCORE = sc.done();

// ---- the in-world clock (top right): video time -> time of day
const DAY_CLOCK = monotoneSpline([0, 4, 8, 16, 28, 38, 48, 52, 60], [5.95, 6.0, 8.5, 10, 13, 17, 21, 23, 23.98]);
function drawDayClock(R, t) {
  const a = sstep(1.0, 1.6, t) * (1 - sstep(57.5, 58.5, t));
  if (a <= 0.001) return;
  const h = DAY_CLOCK(t), hh = Math.floor(h), mm = Math.min(59, Math.floor((h - hh) * 60));
  const str = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  R.use('hud');
  R.text(str, [7.3, 3.62, 0], 0.36, cmix(COL.gold, COL.white, 0.35), { align: 1, alpha: a, glow: 0.6 });
  const ic = [7.3 - R.measure(str, 'mono') * 0.36 - 0.3, 3.62, 0];
  if (h >= 6 && h < 19.5) {
    R.sprite(ic, 0.11, COL.gold, a * 1.3, 3);
    for (let i = 0; i < 8; i++) {
      const an = (i / 8) * TAU + t * 0.8, d = [Math.cos(an), Math.sin(an), 0];
      R.line(vadd(ic, vscale(d, 0.17)), vadd(ic, vscale(d, 0.25)), COL.gold, COL.gold, 0.022, a);
    }
  } else {
    R.sprite(ic, 0.12, hex('#dfe6ff', 1.2), a, 3);
    R.use('hudUnder'); R.sprite(vadd(ic, [0.07, 0.05, 0]), 0.1, [0.01, 0.01, 0.03], a, 3);
  }
  R.use('add');
}

defineVideo({
  title: "Clawd's Day",
  eyebrow: '60 seconds · a day in the life',
  subtitle: 'Wake up, coffee, code, crabs, ship it, sleep. Repeat.',
  endMessage: 'goodnight, clawd ✦',
  score: SCORE,
  post: drawDayClock,
  sections: [
    { name: 'wake', t0: 0, label: 'RISE & SHINE', caption: '▸ 06:00 · five more minutes? no.', scene: 'sceneWake' },
    { name: 'coffee', t0: 8, label: 'COFFEE', caption: '▸ one cup. maybe ten.', scene: 'sceneCoffee' },
    { name: 'work', t0: 16, label: 'DEEP WORK', caption: '▸ write code · run tests · stomp bugs', scene: 'sceneWork' },
    { name: 'beach', t0: 28, label: 'LUNCH BREAK', caption: '▸ beach day with the cousins', scene: 'sceneBeach' },
    { name: 'ship', t0: 38, label: 'SHIP IT', caption: '▸ git push and pray', scene: 'sceneShip' },
    { name: 'night', t0: 48, label: 'GOODNIGHT', caption: '▸ counting sheep (and one crab)', scene: 'sceneNight' },
  ],
});
