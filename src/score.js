'use strict';
// The score: one shared timeline that drives both the synthesized soundtrack and
// the visuals, so every flash, cut and pulse lands on the music.
// 120 BPM, 4/4, A minor. One bar = 2 s, one 16th step = 0.125 s. 30 bars = 60 s.

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const STEP = BEAT / 4;
const DURATION = 60;
const bt = (bar, step = 0) => bar * BAR + step * STEP;

const SECTIONS = [
  { name: 'prompt', t0: 0, t1: 8, label: 'PROMPT' },
  { name: 'tokens', t0: 8, t1: 16, label: 'TOKENIZE' },
  { name: 'embed', t0: 16, t1: 24, label: 'EMBED' },
  { name: 'attention', t0: 24, t1: 36, label: 'ATTENTION' },
  { name: 'layers', t0: 36, t1: 46, label: 'LAYERS' },
  { name: 'logits', t0: 46, t1: 52, label: 'SOFTMAX' },
  { name: 'generate', t0: 52, t1: 60, label: 'GENERATE' },
];

// Story content shared by scenes.
const PROMPT = 'The meaning of life is';
const PROMPT_TOKENS = [
  { text: 'The', id: 464 },
  { text: ' meaning', id: 3616 },
  { text: ' of', id: 286 },
  { text: ' life', id: 1204 },
  { text: ' is', id: 318 },
];
const CANDIDATES = [
  { text: ' to', p: 0.47 },
  { text: ' 42', p: 0.21 },
  { text: ' love', p: 0.12 },
  { text: ' unknown', p: 0.06 },
  { text: ' a', p: 0.04 },
];
const GENERATED = [' to', ' predict', ' the', ' next', ' token', '.'];
const APPEND_TIMES = [52.0, 52.5, 53.0, 53.5, 54.0, 54.5];

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  let n = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return n + (parseInt(m[3], 10) + 1) * 12;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const freq = (name) => mtof(midi(name));

const CHORDS = {
  Am9: ['A3', 'C4', 'E4', 'B4'], Am: ['A3', 'C4', 'E4', 'A4'], F: ['A3', 'C4', 'F4', 'A4'],
  C: ['G3', 'C4', 'E4', 'G4'], G: ['G3', 'B3', 'D4', 'G4'], E: ['G#3', 'B3', 'E4', 'G#4'],
  Dm: ['A3', 'D4', 'F4', 'A4'], Bb: ['Bb3', 'D4', 'F4', 'A4'], Esus: ['A3', 'B3', 'E4', 'A4'],
};
const ROOTS = { Am9: 'A1', Am: 'A1', F: 'F1', C: 'C2', G: 'G1', E: 'E1', Dm: 'D2', Bb: 'Bb1', Esus: 'E1' };
const CHORD_TL = [
  [0, 'Am9'], [2, 'F'], [4, 'C'], [6, 'G'],
  [8, 'Am'], [10, 'F'], [12, 'C'], [14, 'G'],
  [16, 'Am'], [18, 'F'], [20, 'C'], [22, 'G'],
  [24, 'Am'], [26, 'F'], [28, 'C'], [30, 'G'],
  [32, 'Am'], [34, 'F'],
  [36, 'C'], [38, 'G'], [40, 'Am'], [42, 'F'], [44, 'E'],
  [46, 'Dm'], [48, 'Bb'], [50, 'Esus'], [51, 'E'],
  [52, 'Am'], [54, 'F'], [55, 'G'], [56, 'Am9'],
];
function chordAt(t) {
  let c = CHORD_TL[0][1];
  for (const [ct, name] of CHORD_TL) { if (ct <= t + 1e-6) c = name; else break; }
  return c;
}

// Lead hook, written per chord (Am, F, C, G): [16th step, note, length in steps].
const HOOK = [
  [[0, 'A4', 3], [3, 'C5', 3], [6, 'B4', 2], [8, 'A4', 2], [10, 'E4', 3], [13, 'G4', 3]],
  [[0, 'A4', 3], [3, 'C5', 3], [6, 'D5', 2], [8, 'C5', 2], [10, 'A4', 6]],
  [[0, 'G4', 3], [3, 'C5', 3], [6, 'E5', 2], [8, 'D5', 2], [10, 'C5', 3], [13, 'B4', 3]],
  [[0, 'B4', 3], [3, 'D5', 3], [6, 'G5', 4], [10, 'E5', 2], [12, 'D5', 4]],
];
const ARP_PATTERN = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 4, 3, 1];

// The sampling wheel: wedges sized by probability (plus "everything else").
const WHEEL_P = CANDIDATES.map((c) => c.p).concat([1 - CANDIDATES.reduce((a, c) => a + c.p, 0)]);
const WHEEL_BOUNDS = WHEEL_P.map((_, i) => WHEEL_P.slice(0, i).reduce((a, b) => a + b, 0));
const WHEEL_LAND = 0.11; // lands just inside the winning wedge
function wheelTurns(t) {
  const u = clamp((t - 49) / 2);
  return (3 + WHEEL_LAND) * (1 - (1 - u) ** 3);
}
function wheelWedge(a) {
  const f = fract(a);
  let j = 0;
  for (let i = 0; i < WHEEL_BOUNDS.length; i++) if (f >= WHEEL_BOUNDS[i]) j = i;
  return j;
}

function buildScore() {
  const S = {
    kick: [], snare: [], clap: [], hat: [], ohat: [], crash: [],
    impact: [], riser: [], reverse: [], whoosh: [], subdrop: [], glitch: [],
    type: [], blip: [], tick: [], ding: [], pluck: [],
    bass: [], arp: [], lead: [], duck: [], layer: [],
    padLevel: [], padCut: [], arpCut: [],
  };
  const add = (arr, t, extra = {}) => arr.push({ t, ...extra });
  const kick = (t, v = 1) => { add(S.kick, t, { v }); if (v >= 0.8) S.duck.push(t); };

  // ---- Intro (bars 0-3): heartbeat, typing, glitch, riser ----
  for (let bar = 1; bar < 4; bar++) { kick(bt(bar, 0), 0.32); kick(bt(bar, 3), 0.22); }
  Array.from(PROMPT).forEach((ch, i) => add(S.type, 1.25 + i * STEP, { i }));
  add(S.glitch, 5.5, { dur: 0.35 });
  add(S.glitch, 7.5, { dur: 0.45 });
  add(S.riser, 4.5, { dur: 3.5, v: 0.5 });
  add(S.reverse, 6.5, { dur: 1.5 });

  // ---- Tokenize (bars 4-7) ----
  add(S.impact, 8, { v: 1 });
  add(S.crash, 8, { v: 0.8 });
  for (let bar = 4; bar < 8; bar++) {
    for (let s = 0; s < 16; s += 2) add(S.hat, bt(bar, s), { v: bar < 6 ? 0.22 : 0.3 });
    if (bar < 6) { kick(bt(bar, 0)); kick(bt(bar, 10), 0.75); add(S.clap, bt(bar, 8), { v: 0.8 }); }
    else { [0, 4, 8, 12].forEach((s) => (bar === 7 && s === 12) || kick(bt(bar, s))); add(S.clap, bt(bar, 8), { v: 0.6 }); }
    for (const s of [2, 6, 10, 14]) {
      const root = midi(ROOTS[chordAt(bt(bar, s))]) + 12;
      add(S.bass, bt(bar, s), { note: root, dur: 0.18, v: 0.9 });
    }
  }
  PROMPT_TOKENS.forEach((tok, i) => add(S.blip, 8.5 + i * 0.5, { note: midi(['A5', 'C6', 'D6', 'E6', 'G6'][i]), v: 0.9 }));
  // Embedding look-up chatter.
  for (let i = 0; i < 24; i++) add(S.blip, 10.5 + i * STEP * 0.5, { note: midi('A6') + [0, 3, 5, 7, 10, 12][Math.floor(hash1(i + 77) * 6)], v: 0.25 });
  for (let s = 0; s < 16; s += 2) add(S.snare, bt(6, s), { v: 0.15 + s * 0.02 });
  for (let s = 0; s < 8; s++) add(S.snare, bt(7, s), { v: 0.45 + s * 0.03 });
  for (let s = 8; s < 15; s += 0.5) add(S.snare, bt(7, s), { v: 0.7 + (s - 8) * 0.04 });
  add(S.riser, 12, { dur: 4, v: 0.9 });
  add(S.reverse, 14.5, { dur: 1.5 });

  // ---- Drop: embedding galaxy (bars 8-11) and attention (bars 12-17) ----
  const fullBar = (bar, { hats = true, clap = true } = {}) => {
    [0, 4, 8, 12].forEach((s) => kick(bt(bar, s)));
    if (clap) { add(S.clap, bt(bar, 4), { v: 0.9 }); add(S.clap, bt(bar, 12), { v: 0.9 }); }
    if (hats) for (let s = 0; s < 16; s++) {
      if (s % 4 === 2) add(S.ohat, bt(bar, s), { v: 0.45 });
      else add(S.hat, bt(bar, s), { v: s % 2 ? 0.2 : 0.32 });
    }
  };
  const rollingBass = (bar) => {
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) continue;
      const t = bt(bar, s);
      const root = midi(ROOTS[chordAt(t)]) + 12;
      add(S.bass, t, { note: root + (s === 7 || s === 15 ? 12 : 0), dur: 0.1, v: s % 2 ? 0.75 : 0.95 });
    }
  };
  const hookBar = (bar, which) => HOOK[which].forEach(([s, n, len]) => add(S.lead, bt(bar, s), { note: midi(n), dur: len * STEP * 0.92, v: 1 }));

  add(S.impact, 16, { v: 1.2 }); add(S.crash, 16, { v: 1 }); add(S.subdrop, 16);
  for (let bar = 8; bar < 12; bar++) { fullBar(bar); rollingBass(bar); hookBar(bar, bar - 8); }
  [18, 20, 22].forEach((t, i) => add(S.whoosh, t - 0.35, { dur: 0.7, pan: i % 2 ? -1 : 1, v: 0.6 }));
  add(S.whoosh, 22.9, { dur: 1.1, pan: 0, v: 0.8 });
  add(S.crash, 20, { v: 0.5 });
  for (let s = 12; s < 16; s++) add(S.snare, bt(11, s), { v: 0.5 + (s - 12) * 0.12 });

  add(S.impact, 24, { v: 0.7 }); add(S.crash, 24, { v: 0.8 });
  for (let bar = 12; bar < 15; bar++) { fullBar(bar); rollingBass(bar); }
  // Breakdown (bar 15): no kick, filtered, glitchy.
  for (let s = 0; s < 16; s += 2) add(S.hat, bt(15, s), { v: 0.18 });
  add(S.bass, bt(15, 0), { note: midi('G2'), dur: 1.8, v: 0.7 });
  add(S.glitch, 31.0, { dur: 0.5 });
  add(S.reverse, 30.5, { dur: 1.5 });
  for (let s = 12; s < 16; s += 0.5) add(S.snare, bt(15, s), { v: 0.35 + (s - 12) * 0.12 });
  add(S.impact, 32, { v: 0.8 }); add(S.crash, 32, { v: 1 });
  for (let bar = 16; bar < 18; bar++) { fullBar(bar); rollingBass(bar); hookBar(bar, bar - 16); }
  for (let s = 12; s < 16; s++) add(S.snare, bt(17, s), { v: 0.5 + (s - 12) * 0.12 });
  add(S.riser, 34, { dur: 2, v: 0.6 });

  // ---- Layer dive (bars 18-22) ----
  add(S.impact, 36, { v: 1 }); add(S.crash, 36, { v: 1 }); add(S.subdrop, 36);
  for (let bar = 18; bar < 23; bar++) {
    fullBar(bar, { clap: bar < 22 });
    rollingBass(bar);
    if (bar === 20 || bar === 21) for (let s = 2; s < 16; s += 4) add(S.snare, bt(bar, s), { v: 0.22 });
  }
  hookBar(18, 2); hookBar(19, 3); hookBar(20, 0); hookBar(21, 1);
  ['E4', 'G#4', 'B4', 'E5', 'G#5', 'B5', 'E6', 'G#6'].forEach((n, i) => add(S.lead, bt(22, i * 2), { note: midi(n), dur: STEP * 1.8, v: 0.9 }));
  for (let s = 0; s < 8; s++) add(S.snare, bt(22, s), { v: 0.45 + s * 0.03 });
  for (let s = 8; s < 15.5; s += 0.5) add(S.snare, bt(22, s), { v: 0.7 + (s - 8) * 0.04 });
  add(S.riser, 42, { dur: 4, v: 1 });
  add(S.reverse, 44.5, { dur: 1.5 });
  // Layer passes: one per beat, then 8ths, then 16ths. 32 layers.
  for (let i = 0; i < 8; i++) S.layer.push(36.5 + i * 0.5);
  for (let i = 0; i < 16; i++) S.layer.push(40.25 + i * 0.25);
  for (let i = 0; i < 8; i++) S.layer.push(44.125 + i * 0.125);
  S.layer.forEach((t, i) => i % 2 === 0 && i < 24 && add(S.whoosh, t - 0.12, { dur: 0.28, pan: (i / 2) % 2 ? -0.7 : 0.7, v: 0.25 }));

  // ---- Logits / softmax / sampling (bars 23-25) ----
  add(S.impact, 46, { v: 1.2 }); add(S.crash, 46, { v: 1 }); add(S.subdrop, 46);
  for (let bar = 23; bar < 25; bar++) {
    kick(bt(bar, 0), 0.9); kick(bt(bar, 10), 0.6); add(S.clap, bt(bar, 8), { v: 0.8 });
    for (let s = 0; s < 16; s += 2) add(S.hat, bt(bar, s), { v: 0.16 });
  }
  add(S.bass, 46, { note: midi('D2'), dur: 1.9, v: 0.8 });
  add(S.bass, 48, { note: midi('Bb1'), dur: 1.9, v: 0.8 });
  add(S.bass, 50, { note: midi('E2'), dur: 1.9, v: 0.8 });
  // Sampling wheel: a tick each time a wedge boundary passes the pointer.
  {
    let prev = wheelTurns(49);
    for (let t = 49.001; t <= 51; t += 0.001) {
      const a = wheelTurns(t);
      for (const c of WHEEL_BOUNDS) {
        const crossings = Math.floor(a - c) - Math.floor(prev - c);
        if (crossings > 0) add(S.tick, t);
      }
      prev = a;
    }
  }
  add(S.impact, 51, { v: 0.8 }); add(S.ding, 51, { note: midi('A5'), v: 0.8 });
  kick(51, 1);
  for (let s = 4; s < 8; s += 0.5) add(S.snare, bt(25, s + 8), { v: 0.35 + (s - 4) * 0.12 });
  add(S.riser, 50.5, { dur: 1.5, v: 0.6 });

  // ---- Generate (bars 26-27) and outro (bars 28-29) ----
  add(S.impact, 52, { v: 1.2 }); add(S.crash, 52, { v: 1 }); add(S.subdrop, 52);
  for (let bar = 26; bar < 28; bar++) { fullBar(bar); rollingBass(bar); }
  hookBar(26, 0); hookBar(27, 1);
  APPEND_TIMES.forEach((t, i) => add(S.pluck, t, { note: midi(['A4', 'C5', 'E5', 'G5', 'A5', 'C6'][i]), v: 0.8 }));
  add(S.impact, 56, { v: 1 }); add(S.crash, 56, { v: 1 });
  add(S.bass, 56, { note: midi('A1'), dur: 3, v: 0.8 });
  add(S.reverse, 57.8, { dur: 1.2 });
  add(S.impact, 59, { v: 1.3 }); add(S.ding, 59, { note: midi('A5'), v: 1, chord: true }); add(S.subdrop, 59);

  // ---- Arpeggio ----
  const arpBar = (bar, every = 1, v = 0.8) => {
    for (let s = 0; s < 16; s += every) {
      const t = bt(bar, s);
      const tones = CHORDS[chordAt(t)].map(midi);
      const ext = tones.concat(tones.map((x) => x + 12));
      add(S.arp, t, { note: ext[ARP_PATTERN[s]] + 12, dur: STEP * every * 0.8, v });
    }
  };
  for (let bar = 2; bar < 4; bar++) arpBar(bar, 2, 0.35);
  for (let bar = 4; bar < 23; bar++) arpBar(bar, 1, bar < 8 ? 0.6 : 0.8);
  for (let bar = 23; bar < 26; bar++) arpBar(bar, 2, 0.7);
  for (let bar = 26; bar < 28; bar++) arpBar(bar, 1, 0.85);
  // Gentle descending shimmer in the outro.
  ['E6', 'C6', 'B5', 'A5', 'E5', 'C5', 'B4', 'A4'].forEach((n, i) => add(S.arp, 56 + i * 0.25, { note: midi(n), dur: 0.3, v: 0.5 - i * 0.04 }));

  // ---- Automation lanes: [time, value] ----
  S.padLevel = [[0, 0], [4, 0.75], [8, 0.55], [16, 0.7], [30, 0.95], [32, 0.7], [36, 0.6], [46, 0.95], [52, 0.75], [56, 1], [58.5, 0.7], [60, 0]];
  S.padCut = [[0, 260], [7.9, 1800], [8, 1100], [15.9, 4200], [16, 3200], [30, 3200], [30.2, 700], [31.9, 3000], [32, 3600], [36, 2600], [45.9, 7000], [46, 1400], [51.9, 2600], [52, 4200], [56, 3000], [60, 600]];
  S.arpCut = [[0, 900], [8, 1200], [15.9, 6000], [16, 4500], [30, 4500], [30.2, 900], [31.9, 4000], [36, 3500], [45.9, 9000], [46, 2000], [52, 6000], [56, 3000], [60, 1500]];

  for (const k in S) if (Array.isArray(S[k]) && S[k].length && S[k][0].t !== undefined) S[k].sort((a, b) => a.t - b.t);
  S.duck.sort((a, b) => a - b);
  // Plain sorted time arrays for visual sync.
  S.times = {};
  for (const k of ['kick', 'snare', 'clap', 'hat', 'ohat', 'crash', 'impact', 'type', 'blip', 'tick', 'pluck', 'glitch', 'lead', 'arp', 'bass']) {
    S.times[k] = S[k].map((e) => e.t);
  }
  S.times.bigKick = S.kick.filter((e) => e.v >= 0.8).map((e) => e.t);
  S.times.layer = S.layer.slice();
  return S;
}

const SCORE = buildScore();
