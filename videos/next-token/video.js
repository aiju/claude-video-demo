'use strict';
// Next Token: score and chapter list. 120 BPM, A minor, 30 bars = 60 s.

const sc = new ScoreBuilder({
  bpm: 120, duration: 60,
  // Hand-picked pad voicings (others come from the chord parser).
  voicings: {
    Am9: ['A3', 'C4', 'E4', 'B4'], Am: ['A3', 'C4', 'E4', 'A4'], F: ['A3', 'C4', 'F4', 'A4'],
    C: ['G3', 'C4', 'E4', 'G4'], G: ['G3', 'B3', 'D4', 'G4'], E: ['G#3', 'B3', 'E4', 'G#4'],
    Dm: ['A3', 'D4', 'F4', 'A4'], Bb: ['Bb3', 'D4', 'F4', 'A4'], Esus4: ['A3', 'B3', 'E4', 'A4'],
  },
});
const bt = (bar, step) => sc.bt(bar, step), STEP = sc.STEP;
sc.chords([
  [0, 'Am9'], [2, 'F'], [4, 'C'], [6, 'G'], [8, 'Am'], [10, 'F'], [12, 'C'], [14, 'G'],
  [16, 'Am'], [18, 'F'], [20, 'C'], [22, 'G'], [24, 'Am'], [26, 'F'], [28, 'C'], [30, 'G'],
  [32, 'Am'], [34, 'F'], [36, 'C'], [38, 'G'], [40, 'Am'], [42, 'F'], [44, 'E'],
  [46, 'Dm'], [48, 'Bb'], [50, 'Esus4'], [51, 'E'], [52, 'Am'], [54, 'F'], [55, 'G'], [56, 'Am9'],
]);
// Lead hook, one bar per chord of Am F C G: [16th step, note, length in steps].
const HOOK = [
  [[0, 'A4', 3], [3, 'C5', 3], [6, 'B4', 2], [8, 'A4', 2], [10, 'E4', 3], [13, 'G4', 3]],
  [[0, 'A4', 3], [3, 'C5', 3], [6, 'D5', 2], [8, 'C5', 2], [10, 'A4', 6]],
  [[0, 'G4', 3], [3, 'C5', 3], [6, 'E5', 2], [8, 'D5', 2], [10, 'C5', 3], [13, 'B4', 3]],
  [[0, 'B4', 3], [3, 'D5', 3], [6, 'G5', 4], [10, 'E5', 2], [12, 'D5', 4]],
];

// ---- 0-8 s: heartbeat, typing, glitch, riser ----
for (let bar = 1; bar < 4; bar++) { sc.kick(bt(bar, 0), 0.32); sc.kick(bt(bar, 3), 0.22); }
Array.from(PROMPT).forEach((ch, i) => sc.add('type', 1.25 + i * STEP, { i }));
sc.glitch(5.5, 0.35).glitch(7.5, 0.45);
sc.add('riser', 4.5, { dur: 3.5, v: 0.5 }).add('reverse', 6.5, { dur: 1.5 });
sc.drone('A1', [[0, 0], [2.5, 0.13], [7.9, 0.1], [8.2, 0]]);

// ---- 8-16 s: tokenize ----
sc.add('impact', 8, { v: 1 }).add('crash', 8, { v: 0.8 });
for (let bar = 4; bar < 8; bar++) {
  for (let s = 0; s < 16; s += 2) sc.add('hat', bt(bar, s), { v: bar < 6 ? 0.22 : 0.3 });
  if (bar < 6) { sc.kick(bt(bar, 0)); sc.kick(bt(bar, 10), 0.75); sc.add('clap', bt(bar, 8), { v: 0.8 }); }
  else { [0, 4, 8, 12].forEach((s) => (bar === 7 && s === 12) || sc.kick(bt(bar, s))); sc.add('clap', bt(bar, 8), { v: 0.6 }); }
  sc.offbeatBass(bar);
}
PROMPT_TOKENS.forEach((tok, i) => sc.add('blip', 8.5 + i * 0.5, { note: midi(['A5', 'C6', 'D6', 'E6', 'G6'][i]), v: 0.9 }));
for (let i = 0; i < 24; i++) sc.add('blip', 10.5 + i * STEP * 0.5, { note: midi('A6') + [0, 3, 5, 7, 10, 12][Math.floor(hash1(i + 77) * 6)], v: 0.25 });
for (let s = 0; s < 16; s += 2) sc.add('snare', bt(6, s), { v: 0.15 + s * 0.02 });
for (let s = 0; s < 8; s++) sc.add('snare', bt(7, s), { v: 0.45 + s * 0.03 });
for (let s = 8; s < 15; s += 0.5) sc.add('snare', bt(7, s), { v: 0.7 + (s - 8) * 0.04 });
sc.add('riser', 12, { dur: 4, v: 0.9 }).add('reverse', 14.5, { dur: 1.5 });

// ---- 16-36 s: drop (embedding galaxy) and attention ----
sc.drop(16, 1.2);
for (let bar = 8; bar < 12; bar++) sc.fullBar(bar).rollingBass(bar).melody(bar, HOOK[bar - 8]);
[18, 20, 22].forEach((t, i) => sc.whoosh(t, 0.7, i % 2 ? -1 : 1, 0.6));
sc.add('whoosh', 22.9, { dur: 1.1, pan: 0, v: 0.8 });
sc.add('crash', 20, { v: 0.5 });
for (let s = 12; s < 16; s++) sc.add('snare', bt(11, s), { v: 0.5 + (s - 12) * 0.12 });
sc.add('impact', 24, { v: 0.7 }).add('crash', 24, { v: 0.8 });
for (let bar = 12; bar < 15; bar++) sc.fullBar(bar).rollingBass(bar);
for (let s = 0; s < 16; s += 2) sc.add('hat', bt(15, s), { v: 0.18 });   // breakdown
sc.add('bass', bt(15, 0), { note: midi('G2'), dur: 1.8, v: 0.7 });
sc.glitch(31.0, 0.5).add('reverse', 30.5, { dur: 1.5 });
for (let s = 12; s < 16; s += 0.5) sc.add('snare', bt(15, s), { v: 0.35 + (s - 12) * 0.12 });
sc.add('impact', 32, { v: 0.8 }).add('crash', 32, { v: 1 });
for (let bar = 16; bar < 18; bar++) sc.fullBar(bar).rollingBass(bar).melody(bar, HOOK[bar - 16]);
for (let s = 12; s < 16; s++) sc.add('snare', bt(17, s), { v: 0.5 + (s - 12) * 0.12 });
sc.add('riser', 34, { dur: 2, v: 0.6 });

// ---- 36-46 s: layer dive ----
sc.drop(36, 1);
for (let bar = 18; bar < 23; bar++) {
  sc.fullBar(bar, { clap: bar < 22 }).rollingBass(bar);
  if (bar === 20 || bar === 21) for (let s = 2; s < 16; s += 4) sc.add('snare', bt(bar, s), { v: 0.22 });
}
sc.melody(18, HOOK[2]).melody(19, HOOK[3]).melody(20, HOOK[0]).melody(21, HOOK[1]);
['E4', 'G#4', 'B4', 'E5', 'G#5', 'B5', 'E6', 'G#6'].forEach((n, i) => sc.add('lead', bt(22, i * 2), { note: midi(n), dur: STEP * 1.8, v: 0.9 }));
for (let s = 0; s < 8; s++) sc.add('snare', bt(22, s), { v: 0.45 + s * 0.03 });
for (let s = 8; s < 15.5; s += 0.5) sc.add('snare', bt(22, s), { v: 0.7 + (s - 8) * 0.04 });
sc.add('riser', 42, { dur: 4, v: 1 }).add('reverse', 44.5, { dur: 1.5 });
// 32 layer passes: one per beat, then 8ths, then 16ths.
const LAYER_TIMES = [];
for (let i = 0; i < 8; i++) LAYER_TIMES.push(36.5 + i * 0.5);
for (let i = 0; i < 16; i++) LAYER_TIMES.push(40.25 + i * 0.25);
for (let i = 0; i < 8; i++) LAYER_TIMES.push(44.125 + i * 0.125);
sc.marks('layer', LAYER_TIMES);
LAYER_TIMES.forEach((t, i) => i % 2 === 0 && i < 24 && sc.add('whoosh', t - 0.12, { dur: 0.28, pan: (i / 2) % 2 ? -0.7 : 0.7, v: 0.25 }));

// ---- 46-52 s: logits, softmax, sampling wheel ----
sc.drop(46, 1.2);
for (let bar = 23; bar < 25; bar++) {
  sc.kick(bt(bar, 0), 0.9); sc.kick(bt(bar, 10), 0.6); sc.add('clap', bt(bar, 8), { v: 0.8 });
  for (let s = 0; s < 16; s += 2) sc.add('hat', bt(bar, s), { v: 0.16 });
}
sc.add('bass', 46, { note: midi('D2'), dur: 1.9, v: 0.8 }).add('bass', 48, { note: midi('Bb1'), dur: 1.9, v: 0.8 }).add('bass', 50, { note: midi('E2'), dur: 1.9, v: 0.8 });
{ // A tick each time a wedge boundary passes the pointer.
  let prev = wheelTurns(49);
  for (let t = 49.001; t <= 51; t += 0.001) {
    const a = wheelTurns(t);
    for (const c of WHEEL_BOUNDS) if (Math.floor(a - c) - Math.floor(prev - c) > 0) sc.add('tick', t);
    prev = a;
  }
}
sc.add('impact', 51, { v: 0.8 }).add('ding', 51, { note: midi('A5'), v: 0.8 });
sc.kick(51, 1);
for (let s = 4; s < 8; s += 0.5) sc.add('snare', bt(25, s + 8), { v: 0.35 + (s - 4) * 0.12 });
sc.add('riser', 50.5, { dur: 1.5, v: 0.6 });

// ---- 52-60 s: generate and outro ----
sc.drop(52, 1.2);
for (let bar = 26; bar < 28; bar++) sc.fullBar(bar).rollingBass(bar);
sc.melody(26, HOOK[0]).melody(27, HOOK[1]);
APPEND_TIMES.forEach((t, i) => sc.add('pluck', t, { note: midi(['A4', 'C5', 'E5', 'G5', 'A5', 'C6'][i]), v: 0.8 }));
sc.add('impact', 56, { v: 1 }).add('crash', 56, { v: 1 });
sc.add('bass', 56, { note: midi('A1'), dur: 3, v: 0.8 });
sc.add('reverse', 57.8, { dur: 1.2 });
sc.add('impact', 59, { v: 1.3 }).add('ding', 59, { note: midi('A5'), v: 1, chord: true }).add('subdrop', 59);

// ---- arpeggio ----
for (let bar = 2; bar < 4; bar++) sc.arpBar(bar, 2, 0.35);
for (let bar = 4; bar < 23; bar++) sc.arpBar(bar, 1, bar < 8 ? 0.6 : 0.8);
for (let bar = 23; bar < 26; bar++) sc.arpBar(bar, 2, 0.7);
for (let bar = 26; bar < 28; bar++) sc.arpBar(bar, 1, 0.85);
['E6', 'C6', 'B5', 'A5', 'E5', 'C5', 'B4', 'A4'].forEach((n, i) => sc.add('arp', 56 + i * 0.25, { note: midi(n), dur: 0.3, v: 0.5 - i * 0.04 }));

// ---- automation ----
sc.padLevel([[0, 0], [4, 0.75], [8, 0.55], [16, 0.7], [30, 0.95], [32, 0.7], [36, 0.6], [46, 0.95], [52, 0.75], [56, 1], [58.5, 0.7], [60, 0]]);
sc.padCut([[0, 260], [7.9, 1800], [8, 1100], [15.9, 4200], [16, 3200], [30, 3200], [30.2, 700], [31.9, 3000], [32, 3600], [36, 2600], [45.9, 7000], [46, 1400], [51.9, 2600], [52, 4200], [56, 3000], [60, 600]]);
sc.arpCut([[0, 900], [8, 1200], [15.9, 6000], [16, 4500], [30, 4500], [30.2, 900], [31.9, 4000], [36, 3500], [45.9, 9000], [46, 2000], [52, 6000], [56, 3000], [60, 1500]]);

const SCORE = sc.done();

defineVideo({
  title: 'Next Token',
  eyebrow: '60 seconds · inside a language model',
  subtitle: 'Typing, tokens, embeddings, attention, 32 layers and a spin of the sampling wheel. Every frame and every sound is generated live in your browser.',
  endMessage: 'that was one forward pass… and then six more',
  duration: 60,
  score: SCORE,
  fontLoads: ['700 56px "JetBrains Mono"', '800 56px "Unbounded"', ['700 56px "Noto Sans JP"', '猫ねこ犬星']],
  sections: [
    { name: 'prompt', t0: 0, label: 'PROMPT', caption: '▸ input: plain text', scene: 'sceneTokens' },
    { name: 'tokens', t0: 8, label: 'TOKENIZE', caption: '▸ text → tokens → ids → vectors', scene: 'sceneTokens' },
    { name: 'embed', t0: 16, label: 'EMBED', caption: '▸ embedding space: similar meanings sit close together', scene: 'sceneGalaxy' },
    { name: 'attention', t0: 24, label: 'ATTENTION', caption: '▸ every token looks back at the tokens before it', scene: 'sceneAttention' },
    { name: 'layers', t0: 36, label: 'LAYERS', caption: '▸ 32 blocks of attention + MLP on the residual stream', scene: 'sceneLayers' },
    { name: 'logits', t0: 46, label: 'SOFTMAX', caption: '▸ a score for every token in the vocabulary → probabilities', scene: 'sceneLogits' },
    { name: 'generate', t0: 52, label: 'GENERATE', caption: '▸ append the new token · run again · repeat', scene: 'sceneGenerate' },
  ],
});
