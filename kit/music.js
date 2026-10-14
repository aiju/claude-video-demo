'use strict';
// Music theory helpers and a small score builder. A score is a bag of timed
// events ({t, ...}) per track plus automation lanes; kit/synth.js turns it into
// audio and scenes read the same events (via score.times) to sync visuals.

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  return NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const freq = (name) => mtof(midi(name));

// Chord symbols: root + quality, e.g. Am, F, Cmaj7, G7, Dm7, Esus4, Bbadd9, Am9, Bdim.
const CHORD_QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 9: [0, 4, 7, 10, 14], m9: [0, 3, 7, 10, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
};
function parseChord(sym) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym);
  if (!m || !(m[3] in CHORD_QUALITIES)) throw new Error(`unknown chord: ${sym}`);
  const root = (NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, intervals: CHORD_QUALITIES[m[3]] };
}
// Four-note close voicing between G3 and ~B4 (good pad register).
function voiceChord(sym) {
  const { root, intervals } = parseChord(sym);
  const LO = 55;
  let notes = [...new Set(intervals.map((i) => (root + i) % 12))].map((pc) => LO + ((pc - LO) % 12 + 12) % 12).sort((a, b) => a - b);
  if (notes.length > 4) notes = notes.filter((n, i) => i === 0 || (n - notes[0]) % 12 !== 7).slice(0, 4); // drop the fifth first
  while (notes.length < 4) notes.push(notes[notes.length - 4 < 0 ? 0 : notes.length - 4] + 12);
  return notes.slice(0, 4);
}
// Bass root in the E1..D#2 range.
function chordRoot(sym) { const { root } = parseChord(sym); return 28 + ((root - 28) % 12 + 12) % 12; }

const ARP_PATTERN = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 4, 3, 1];

class ScoreBuilder {
  // bpm, duration in seconds; voicings: optional {chordSymbol: [noteNames]} overrides.
  constructor({ bpm = 120, duration = 60, voicings = {} } = {}) {
    this.bpm = bpm; this.duration = duration;
    this.BEAT = 60 / bpm; this.BAR = this.BEAT * 4; this.STEP = this.BEAT / 4;
    this.voicings = voicings;
    this.S = { duck: [], padLevel: null, padCut: null, arpCut: null, chordNames: [], drone: [], mix: {}, voices: {} };
  }
  bt(bar, step = 0) { return bar * this.BAR + step * this.STEP; }
  add(track, t, props = {}) { (this.S[track] || (this.S[track] = [])).push({ t, ...props }); return this; }
  marks(name, times) { this.S[name] = times.slice(); return this; }
  kick(t, v = 1) { this.add('kick', t, { v }); if (v >= 0.8) this.S.duck.push(t); return this; }

  // ---- harmony ----
  chords(list) { this.S.chordNames = list.map(([t, sym]) => [t, sym]); return this; }
  voicing(sym) { return this.voicings[sym] ? this.voicings[sym].map(midi) : voiceChord(sym); }
  chordAt(t) {
    let c = this.S.chordNames[0][1];
    for (const [ct, name] of this.S.chordNames) { if (ct <= t + 1e-6) c = name; else break; }
    return c;
  }
  rootAt(t) { return chordRoot(this.chordAt(t)); }

  // ---- drum & bass patterns (one bar each) ----
  fullBar(bar, { hats = true, clap = true } = {}) {
    [0, 4, 8, 12].forEach((s) => this.kick(this.bt(bar, s)));
    if (clap) { this.add('clap', this.bt(bar, 4), { v: 0.9 }); this.add('clap', this.bt(bar, 12), { v: 0.9 }); }
    if (hats) for (let s = 0; s < 16; s++) {
      if (s % 4 === 2) this.add('ohat', this.bt(bar, s), { v: 0.45 });
      else this.add('hat', this.bt(bar, s), { v: s % 2 ? 0.2 : 0.32 });
    }
    return this;
  }
  halfTimeBar(bar, { hats = true } = {}) {
    this.kick(this.bt(bar, 0)); this.kick(this.bt(bar, 10), 0.75); this.add('clap', this.bt(bar, 8), { v: 0.8 });
    if (hats) for (let s = 0; s < 16; s += 2) this.add('hat', this.bt(bar, s), { v: 0.22 });
    return this;
  }
  rollingBass(bar) {
    for (let s = 0; s < 16; s++) {
      if (s % 4 === 0) continue;
      const t = this.bt(bar, s);
      this.add('bass', t, { note: this.rootAt(t) + 12 + (s === 7 || s === 15 ? 12 : 0), dur: 0.1, v: s % 2 ? 0.75 : 0.95 });
    }
    return this;
  }
  offbeatBass(bar) {
    for (const s of [2, 6, 10, 14]) { const t = this.bt(bar, s); this.add('bass', t, { note: this.rootAt(t) + 12, dur: 0.18, v: 0.9 }); }
    return this;
  }
  longBass(t, dur, v = 0.8) { this.add('bass', t, { note: this.rootAt(t) + 12, dur, v }); return this; }
  arpBar(bar, every = 1, v = 0.8, pattern = ARP_PATTERN) {
    for (let s = 0; s < 16; s += every) {
      const t = this.bt(bar, s);
      const tones = this.voicing(this.chordAt(t));
      const ext = tones.concat(tones.map((x) => x + 12));
      this.add('arp', t, { note: ext[pattern[s % pattern.length]] + 12, dur: this.STEP * every * 0.8, v });
    }
    return this;
  }
  // notes: [[16th step, noteName, length in steps], ...]
  melody(bar, notes, track = 'lead', v = 1) {
    notes.forEach(([s, n, len]) => this.add(track, this.bt(bar, s), { note: midi(n), dur: len * this.STEP * 0.92, v }));
    return this;
  }
  // Snare roll from step a to step b (exclusive) in `bar`, at `rate` steps per hit.
  roll(bar, a, b, rate = 1, v0 = 0.4, v1 = 1) {
    for (let s = a; s < b; s += rate) this.add('snare', this.bt(bar, s), { v: mix(v0, v1, (s - a) / Math.max(1e-9, b - a)) });
    return this;
  }

  // ---- big moments ----
  drop(t, v = 1) { this.add('impact', t, { v }); this.add('crash', t, { v: Math.min(1, v) }); this.add('subdrop', t); return this; }
  // Riser + reverse cymbal landing exactly on t1.
  build(t0, t1, v = 0.9) { this.add('riser', t0, { dur: t1 - t0, v }); this.add('reverse', t1 - Math.min(1.5, t1 - t0), { dur: Math.min(1.5, t1 - t0) }); return this; }
  whoosh(t, dur = 0.7, pan = 1, v = 0.6) { return this.add('whoosh', t - dur / 2, { dur, pan, v }); }
  glitch(t, dur = 0.4) { return this.add('glitch', t, { dur }); }
  // A held low note with a gain envelope [[t, gain], ...].
  drone(note, env, type = 'triangle') { this.S.drone.push({ note: midi(note), env, type }); return this; }

  // ---- automation lanes ([time, value] pairs) ----
  padLevel(lane) { this.S.padLevel = lane; return this; }
  padCut(lane) { this.S.padCut = lane; return this; }
  arpCut(lane) { this.S.arpCut = lane; return this; }
  mixer(gains) { Object.assign(this.S.mix, gains); return this; }

  done() {
    const S = this.S, D = this.duration;
    S.bpm = this.bpm; S.duration = D; S.beat = this.BEAT;
    S.chordTL = S.chordNames.map(([t, sym]) => [t, this.voicing(sym)]);
    S.padLevel = S.padLevel || [[0, 0.7], [D, 0.7]];
    S.padCut = S.padCut || [[0, 2400], [D, 2400]];
    S.arpCut = S.arpCut || [[0, 4500], [D, 4500]];
    for (const k in S) if (Array.isArray(S[k]) && S[k].length && S[k][0] && S[k][0].t !== undefined) S[k].sort((a, b) => a.t - b.t);
    S.duck.sort((a, b) => a - b);
    S.times = {};
    for (const k in S) {
      const a = S[k];
      if (!Array.isArray(a) || !a.length) continue;
      if (typeof a[0] === 'number' && k !== 'duck') S.times[k] = a.slice();
      else if (a[0] && a[0].t !== undefined) S.times[k] = a.map((e) => e.t);
    }
    S.times.bigKick = (S.kick || []).filter((e) => e.v >= 0.8).map((e) => e.t);
    return S;
  }
}
