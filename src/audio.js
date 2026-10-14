'use strict';
// Soundtrack synthesis. Drums and effects are synthesized sample-by-sample in JS;
// tonal parts are WebAudio oscillators driven by automation. Everything renders
// once into an AudioBuffer through an OfflineAudioContext, so playback is
// sample-accurate and seekable.

const SR = 44100;

// ---- tiny JS DSP kit ---------------------------------------------------------------
class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(f); }
  set(f) {
    const w0 = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * this.q);
    let b0, b1, b2;
    if (this.type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (this.type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }
    const a0 = 1 + al;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * cw) / a0; this.a2 = (1 - al) / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
const noiseSrc = (seed) => { const r = mulberry32(seed); return () => r() * 2 - 1; };
const buf = (dur) => new Float32Array(Math.ceil(dur * SR));

// 808-style metallic source: six detuned square waves.
function metallic(t, base = 1) {
  const f = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
  let s = 0;
  for (let i = 0; i < 6; i++) s += Math.sin(2 * Math.PI * f[i] * base * t) > 0 ? 1 : -1;
  return s / 6;
}

const DRUMS = {
  kick() {
    const b = buf(0.6); let ph = 0; const n = noiseSrc(1);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const f = 46 + 120 * Math.exp(-t * 26) + 260 * Math.exp(-t * 180);
      ph += (2 * Math.PI * f) / SR;
      const env = t < 0.015 ? 1 : Math.exp(-(t - 0.015) * 6.5);
      const click = n() * Math.exp(-t * 500) * 0.35;
      b[i] = Math.tanh((Math.sin(ph) * env + click) * 1.6) * 0.95;
    }
    return [b];
  },
  snare() {
    const b = buf(0.35); const n = noiseSrc(2); const bp = new Biquad('bp', 3200, 0.6), hp = new Biquad('hp', 600, 0.7);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const tone = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 22) * 0.5 + Math.sin(2 * Math.PI * 330 * t) * Math.exp(-t * 30) * 0.25;
      const nz = hp.p(bp.p(n())) * Math.exp(-t * 14) * 1.6;
      b[i] = Math.tanh((tone + nz) * 1.3);
    }
    return [b];
  },
  clap() {
    const L = buf(0.45), R = buf(0.45);
    [[L, 3], [R, 4]].forEach(([b, seed]) => {
      const n = noiseSrc(seed); const bp = new Biquad('bp', 1250, 1.3), hp = new Biquad('hp', 400);
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        let env = 0;
        for (const o of [0, 0.011, 0.023]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 280));
        if (t >= 0.032) env = Math.max(env, Math.exp(-(t - 0.032) * 13) * 0.8);
        b[i] = hp.p(bp.p(n())) * env * 2.2;
      }
    });
    return [L, R];
  },
  hat() {
    const b = buf(0.09); const n = noiseSrc(5); const hp = new Biquad('hp', 7500, 0.8), bp = new Biquad('bp', 10000, 0.9);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = hp.p(bp.p(metallic(t) * 0.6 + n() * 0.6)) * Math.exp(-t * 60) * 1.4;
    }
    return [b];
  },
  ohat() {
    const b = buf(0.5); const n = noiseSrc(6); const hp = new Biquad('hp', 7000, 0.8), bp = new Biquad('bp', 9500, 0.8);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = hp.p(bp.p(metallic(t) * 0.6 + n() * 0.6)) * Math.exp(-t * 8) * 1.1;
    }
    return [b];
  },
  crash() {
    const out = [];
    for (const seed of [7, 8]) {
      const b = buf(3); const n = noiseSrc(seed); const hp = new Biquad('hp', 3500, 0.7), bp = new Biquad('bp', 7000, 0.5);
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        const env = Math.exp(-t * 1.5) * (1 + 2 * Math.exp(-t * 30));
        b[i] = hp.p(bp.p(n() * 0.8 + metallic(t, 1.7 + seed * 0.01) * 0.5)) * env * 0.9;
      }
      out.push(b);
    }
    return out;
  },
};

const FX = {
  riser(dur) {
    const out = [];
    for (const seed of [11, 12]) {
      const b = buf(dur); const n = noiseSrc(seed); const bp = new Biquad('bp', 300, 3); const lp = new Biquad('lp', 400, 2);
      let p1 = 0, p2 = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR, u = t / dur;
        if (i % 32 === 0) { bp.set(300 * Math.pow(30, u)); lp.set(400 * Math.pow(20, u)); }
        const f = 110 * Math.pow(8, u * u);
        p1 += f / SR; p2 += (f * 1.007) / SR;
        const saw = (p1 % 1) * 2 - 1 + ((p2 % 1) * 2 - 1);
        const trem = 0.75 + 0.25 * Math.sin(2 * Math.PI * (4 + 28 * u * u) * t);
        b[i] = (bp.p(n()) * 1.2 + lp.p(saw) * 0.25) * u * u * trem;
      }
      out.push(b);
    }
    return out;
  },
  reverse(dur) {
    const out = [];
    for (const seed of [13, 14]) {
      const b = buf(dur); const n = noiseSrc(seed); const hp = new Biquad('hp', 4000, 0.7);
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        b[i] = hp.p(n() + metallic(t, 1.9) * 0.4) * Math.exp((t - dur) * 3.2) * (i > b.length - 64 ? (b.length - i) / 64 : 1);
      }
      out.push(b);
    }
    return out;
  },
  impact() {
    const out = [];
    for (const seed of [15, 16]) {
      const b = buf(2.2); const n = noiseSrc(seed); const lp = new Biquad('lp', 900, 0.8); let ph = 0;
      for (let i = 0; i < b.length; i++) {
        const t = i / SR;
        ph += (2 * Math.PI * (32 + 70 * Math.exp(-t * 5))) / SR;
        const sub = Math.sin(ph) * Math.exp(-t * 2.0);
        const body = lp.p(n()) * Math.exp(-t * 5) * 1.6;
        const crack = n() * Math.exp(-t * 60) * 0.4;
        b[i] = Math.tanh((sub * 1.1 + body + crack) * 1.3);
      }
      out.push(b);
    }
    return out;
  },
  subdrop() {
    const b = buf(1.4); let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR, u = t / 1.4;
      ph += (2 * Math.PI * (28 + 80 * Math.exp(-t * 2.5))) / SR;
      b[i] = Math.sin(ph) * (1 - u) * (1 - u) * Math.min(1, t * 200);
    }
    return [b];
  },
  whoosh(dur, pan) {
    const L = buf(dur), R = buf(dur); const n = noiseSrc(17 + Math.round(dur * 100)); const bp = new Biquad('bp', 500, 1.8);
    for (let i = 0; i < L.length; i++) {
      const t = i / SR, u = t / dur;
      if (i % 32 === 0) bp.set(400 + 4200 * Math.sin(Math.PI * u) ** 2);
      const s = bp.p(n()) * Math.sin(Math.PI * u) ** 2 * 1.8;
      const p = clamp(pan === 0 ? 0 : pan * (u * 2 - 1), -1, 1);
      L[i] = s * Math.cos((p + 1) * Math.PI / 4); R[i] = s * Math.sin((p + 1) * Math.PI / 4);
    }
    return [L, R];
  },
  glitch(dur, seed) {
    const L = buf(dur), R = buf(dur); const r = mulberry32(seed); const n = noiseSrc(seed + 1);
    const seg = Math.floor(SR * 0.03125);
    let f = 200, mode = 0, crush = 1, ph = 0, held = 0;
    for (let i = 0; i < L.length; i++) {
      if (i % seg === 0) { f = 80 + r() * 1600; mode = Math.floor(r() * 3); crush = 2 + Math.floor(r() * 12); }
      ph += f / SR;
      let s = mode === 0 ? ((ph % 1) < 0.5 ? 0.5 : -0.5) : mode === 1 ? n() * 0.6 : Math.sin(ph * 2 * Math.PI) * 0.7;
      if (i % crush === 0) held = Math.round(s * 6) / 6;
      const gate = (i % seg) < seg * 0.7 ? 1 : 0;
      L[i] = held * gate * 0.8; R[i] = held * gate * 0.8 * ((i / seg) % 2 < 1 ? 1 : 0.4);
    }
    return [L, R];
  },
  click(seed) {
    const b = buf(0.06); const n = noiseSrc(seed); const hp = new Biquad('hp', 2200 + (seed % 5) * 300, 0.9);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = hp.p(n()) * Math.exp(-t * 190) * 0.9 + Math.sin(2 * Math.PI * (140 + (seed % 3) * 20) * t) * Math.exp(-t * 70) * 0.35;
    }
    return [b];
  },
  tick() {
    const b = buf(0.05); const n = noiseSrc(19);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 140) * 0.6 + n() * Math.exp(-t * 400) * 0.3;
    }
    return [b];
  },
  blip(note) {
    const b = buf(0.18); const f = mtof(note); let ph = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      ph += (f * (1 + 0.5 * Math.exp(-t * 90))) / SR;
      const sq = (ph % 1) < 0.5 ? 1 : -1;
      b[i] = (Math.sin(ph * 2 * Math.PI) * 0.7 + sq * 0.15) * Math.exp(-t * 26) * Math.min(1, t * 2000);
    }
    return [b];
  },
  ding(note, chord) {
    const out = [];
    const notes = chord ? [note, note + 7, note + 12, note - 12] : [note];
    for (const side of [0, 1]) {
      const b = buf(4);
      const partials = [[1, 1, 1.4], [2.0, 0.5, 1.0], [2.76, 0.4, 0.7], [4.07, 0.25, 0.45], [5.4, 0.18, 0.3]];
      for (const nn of notes) {
        const f0 = mtof(nn) * (side ? 1.002 : 0.998);
        for (const [ratio, amp, dec] of partials) {
          const w = (2 * Math.PI * f0 * ratio) / SR;
          for (let i = 0; i < b.length; i++) b[i] += Math.sin(w * i) * amp * Math.exp(-(i / SR) / dec) * Math.min(1, i / 100) * 0.35 / notes.length ** 0.5;
        }
      }
      out.push(b);
    }
    return out;
  },
  // Karplus-Strong plucked string with a little body.
  pluck(note) {
    const out = [];
    for (const seed of [21, 22]) {
      const b = buf(2.0); const n = noiseSrc(seed + note);
      const period = SR / mtof(note);
      const N = Math.floor(period), frac = period - N;
      const ring = new Float32Array(N + 2);
      for (let i = 0; i < ring.length; i++) ring[i] = n();
      let idx = 0, last = 0;
      for (let i = 0; i < b.length; i++) {
        const a = ring[idx], c = ring[(idx + 1) % ring.length];
        const s = a * (1 - frac) + c * frac;
        const y = 0.996 * (0.5 * (s + last));
        last = s;
        ring[idx] = y;
        idx = (idx + 1) % ring.length;
        b[i] = y * 0.9;
      }
      out.push(b);
    }
    return out;
  },
};

// Stereo convolution reverb impulse.
function makeIR(ctx, dur = 3.2, decay = 2.6) {
  const len = Math.floor(dur * SR), ir = ctx.createBuffer(2, len, SR);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c), n = noiseSrc(31 + c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const k = 0.15 + 0.8 * Math.min(1, t / dur); // darker over time
      lp += (n() - lp) * (1 - k);
      d[i] = (t < 0.012 ? 0 : lp) * Math.exp((-6.9 * t) / decay);
    }
  }
  return ir;
}

// Render the whole soundtrack. Returns a Promise<AudioBuffer>.
async function renderSoundtrack(S = SCORE, onProgress = () => {}) {
  const ctx = new OfflineAudioContext(2, Math.ceil((DURATION + 0.5) * SR), SR);
  const toBuffer = (chans) => {
    const b = ctx.createBuffer(chans.length, chans[0].length, SR);
    chans.forEach((c, i) => b.copyToChannel(c, i));
    return b;
  };

  // ---- buses ----
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2.5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.09;
  const master = ctx.createGain(); master.gain.value = 0.72;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -16; glue.knee.value = 8; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.2;
  glue.connect(master).connect(limiter).connect(ctx.destination);

  const music = ctx.createGain(); music.gain.value = 0.9; music.connect(glue);
  const duck = ctx.createGain(); duck.connect(music);
  const drums = ctx.createGain(); drums.gain.value = 0.85; drums.connect(glue);
  const sfx = ctx.createGain(); sfx.gain.value = 0.8; sfx.connect(glue);

  const reverb = ctx.createConvolver(); reverb.buffer = makeIR(ctx);
  const revSend = ctx.createGain(); revSend.gain.value = 1; revSend.connect(reverb);
  const revRet = ctx.createGain(); revRet.gain.value = 0.55; reverb.connect(revRet).connect(duck);

  // Ping-pong delay at a dotted eighth.
  const dIn = ctx.createGain(); dIn.gain.value = 0.5;
  const dL = ctx.createDelay(1), dR = ctx.createDelay(1);
  dL.delayTime.value = BEAT * 0.75; dR.delayTime.value = BEAT * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 3800;
  const merge = ctx.createChannelMerger(2);
  dIn.connect(dL); dL.connect(dR); dR.connect(fb).connect(dLP).connect(dL);
  dL.connect(merge, 0, 0); dR.connect(merge, 0, 1);
  const dRet = ctx.createGain(); dRet.gain.value = 0.5; merge.connect(dRet).connect(duck);
  dRet.connect(revSend);

  // Sidechain pump on every strong kick.
  duck.gain.setValueAtTime(1, 0);
  for (const t of S.duck) { duck.gain.setTargetAtTime(0.32, t, 0.004); duck.gain.setTargetAtTime(1, t + 0.04, 0.09); }

  // ---- one-shots: mixed straight into stereo stems in JS (fast, no graph overhead) ----
  const LEN = ctx.length;
  const stem = () => [new Float32Array(LEN), new Float32Array(LEN)];
  const drumStem = stem(), sfxStem = stem(), revStem = stem(), delStem = stem();
  const play = (chans, t, gain, dest, { pan = 0, rev = 0, del = 0 } = {}) => {
    if (t < 0) return;
    const at = Math.round(t * SR);
    const stereo = chans.length > 1;
    const gl = gain * (stereo ? Math.min(1, 1 - pan) : Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2);
    const gr = gain * (stereo ? Math.min(1, 1 + pan) : Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2);
    const L = chans[0], R = chans[stereo ? 1 : 0];
    const n = Math.min(L.length, LEN - at);
    const targets = [[dest, 1], [revStem, rev], [delStem, del]];
    for (const [st, k] of targets) {
      if (!k) continue;
      const a = st[0], b = st[1], kl = gl * k, kr = gr * k;
      for (let i = 0; i < n; i++) { a[at + i] += L[i] * kl; b[at + i] += R[i] * kr; }
    }
  };
  const D = {}; for (const k in DRUMS) D[k] = DRUMS[k]();
  onProgress(0.1);
  for (const e of S.kick) play(D.kick, e.t, 0.95 * e.v, drumStem);
  for (const e of S.snare) play(D.snare, e.t, 0.5 * e.v, drumStem, { rev: 0.25 });
  for (const e of S.clap) play(D.clap, e.t, 0.55 * e.v, drumStem, { rev: 0.35 });
  for (const e of S.hat) play(D.hat, e.t, 0.32 * e.v, drumStem, { pan: 0.25 });
  for (const e of S.ohat) play(D.ohat, e.t, 0.26 * e.v, drumStem, { pan: -0.2 });
  for (const e of S.crash) play(D.crash, e.t, 0.38 * e.v, drumStem, { rev: 0.3 });

  const cache = new Map();
  const fx = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
  for (const e of S.riser) play(fx('riser' + e.dur, () => FX.riser(e.dur)), e.t, 0.32 * e.v, sfxStem, { rev: 0.4 });
  for (const e of S.reverse) play(fx('rev' + e.dur, () => FX.reverse(e.dur)), e.t, 0.35, sfxStem, { rev: 0.2 });
  for (const e of S.impact) play(fx('impact', FX.impact), e.t, 0.75 * e.v, sfxStem, { rev: 0.6 });
  for (const e of S.subdrop) play(fx('subdrop', FX.subdrop), e.t, 0.7, sfxStem);
  for (const e of S.whoosh) play(fx('wh' + e.dur + e.pan, () => FX.whoosh(e.dur, e.pan)), e.t, 0.5 * e.v, sfxStem, { rev: 0.3 });
  S.glitch.forEach((e, i) => play(fx('gl' + i, () => FX.glitch(e.dur, 40 + i)), e.t, 0.28, sfxStem, { del: 0.3 }));
  S.type.forEach((e, i) => play(fx('click' + (i % 6), () => FX.click(50 + (i % 6))), e.t, 0.5, sfxStem, { pan: (hash1(i) - 0.5) * 0.6, rev: 0.15 }));
  for (const e of S.tick) play(fx('tick', FX.tick), e.t, 0.35, sfxStem, { rev: 0.2 });
  for (const e of S.blip) play(fx('blip' + e.note, () => FX.blip(e.note)), e.t, 0.32 * e.v, sfxStem, { del: 0.6, rev: 0.3, pan: (hash1(e.note * 7 + Math.round(e.t * 8)) - 0.5) * 0.8 });
  for (const e of S.ding) play(fx('ding' + e.note + !!e.chord, () => FX.ding(e.note, e.chord)), e.t, 0.42 * e.v, sfxStem, { rev: 0.6, del: 0.3 });
  for (const e of S.pluck) play(fx('pluck' + e.note, () => FX.pluck(e.note)), e.t, 0.5 * e.v, sfxStem, { rev: 0.4, del: 0.4 });
  const stemSource = (st, dest) => { const src = ctx.createBufferSource(); src.buffer = toBuffer(st); src.connect(dest); src.start(0); };
  stemSource(drumStem, drums);
  stemSource(sfxStem, sfx);
  stemSource(revStem, revSend);
  stemSource(delStem, dIn);
  onProgress(0.3);

  // ---- tonal voices ----
  const auto = (param, lane, exp = false) => {
    param.setValueAtTime(lane[0][1], lane[0][0]);
    for (let i = 1; i < lane.length; i++) {
      const [t, v] = lane[i];
      if (exp) param.exponentialRampToValueAtTime(Math.max(v, 1e-3), t);
      else param.linearRampToValueAtTime(v, t);
    }
  };

  // Pads: four voices of five detuned saws, spread across the stereo field.
  {
    const vca = ctx.createGain(); vca.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.connect(vca); vca.connect(duck);
    const pr = ctx.createGain(); pr.gain.value = 0.45; vca.connect(pr).connect(revSend);
    auto(vca.gain, S.padLevel.map(([t, v]) => [t, v * 0.05]));
    auto(lp.frequency, S.padCut, true);
    const detunes = [-14, -6, 0, 7, 15], pans = [-0.85, -0.4, 0, 0.45, 0.9];
    const panners = pans.map((p) => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(lp); return n; });
    for (let v = 0; v < 4; v++) {
      detunes.forEach((dt, k) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt;
        for (const [t, name] of CHORD_TL) o.frequency.setValueAtTime(freq(CHORDS[name][v]), t);
        o.connect(panners[k]); o.start(0); o.stop(DURATION + 0.4);
      });
    }
    // A sub-octave sine on the root keeps the pads warm.
    const sub = ctx.createOscillator(); sub.type = 'sine';
    for (const [t, name] of CHORD_TL) sub.frequency.setValueAtTime(freq(CHORDS[name][0]) / 2, t);
    const sg = ctx.createGain(); sg.gain.value = 0.5; sub.connect(sg).connect(lp); sub.start(0); sub.stop(DURATION + 0.4);
  }

  // Mono synth with filter + amp envelopes driven by setTargetAtTime chains.
  const mono = ({ oscs, q = 4, cutBase = 300, cutPeak = 3000, fDecay = 0.08, attack = 0.003, sustain = 0.7, release = 0.05, gain = 0.3, glide = 0, dest, rev = 0, del = 0, sweep = null, vibrato = 0 }) => {
    const vca = ctx.createGain(); vca.gain.value = 0;
    const env = ctx.createBiquadFilter(); env.type = 'lowpass'; env.Q.value = q; env.frequency.value = cutBase;
    let tail = env;
    if (sweep) { const sw = ctx.createBiquadFilter(); sw.type = 'lowpass'; sw.Q.value = 0.7; auto(sw.frequency, sweep, true); env.connect(sw); tail = sw; }
    tail.connect(vca); vca.connect(dest);
    if (rev) { const r = ctx.createGain(); r.gain.value = rev; vca.connect(r).connect(revSend); }
    if (del) { const d = ctx.createGain(); d.gain.value = del; vca.connect(d).connect(dIn); }
    let lfo = null;
    if (vibrato) { lfo = ctx.createOscillator(); lfo.frequency.value = 5.3; const lg = ctx.createGain(); lg.gain.value = vibrato; lfo.connect(lg); lfo.start(0); lfo.stop(DURATION + 0.4); lfo = lg; }
    const os = oscs.map(([type, detune, g, oct = 0]) => {
      const o = ctx.createOscillator(); o.type = type; o.detune.value = detune + oct * 1200;
      const og = ctx.createGain(); og.gain.value = g; o.connect(og).connect(env);
      if (lfo) lfo.connect(o.detune);
      o.start(0); o.stop(DURATION + 0.4);
      return o;
    });
    return (t, note, dur, v = 1) => {
      const f = mtof(note);
      for (const o of os) { if (glide) o.frequency.setTargetAtTime(f, t, glide); else o.frequency.setValueAtTime(f, t); }
      vca.gain.setTargetAtTime(gain * v, t, attack);
      vca.gain.setTargetAtTime(gain * v * sustain, t + attack * 4, 0.12);
      vca.gain.setTargetAtTime(0, t + dur, release);
      env.frequency.setTargetAtTime(cutBase + (cutPeak - cutBase) * v, t, 0.002);
      env.frequency.setTargetAtTime(cutBase, t + 0.01, fDecay);
    };
  };

  const bass = mono({ oscs: [['sawtooth', 0, 0.6], ['square', 7, 0.35], ['sine', 0, 0.9, -1]], q: 5, cutBase: 160, cutPeak: 1900, fDecay: 0.07, sustain: 0.8, release: 0.03, gain: 0.34, dest: duck });
  for (const e of S.bass) bass(e.t, e.note, e.dur, e.v);
  onProgress(0.45);
  const arp = mono({ oscs: [['square', -6, 0.5], ['sawtooth', 6, 0.5]], q: 6, cutBase: 500, cutPeak: 5200, fDecay: 0.06, sustain: 0.35, release: 0.04, gain: 0.11, dest: duck, rev: 0.35, del: 0.55, sweep: S.arpCut });
  for (const e of S.arp) arp(e.t, e.note, e.dur, e.v);
  onProgress(0.6);
  const lead = mono({ oscs: [['sawtooth', -11, 0.4], ['sawtooth', 0, 0.4], ['sawtooth', 12, 0.4], ['square', 0, 0.2, -1]], q: 1.5, cutBase: 1400, cutPeak: 5200, fDecay: 0.25, attack: 0.006, sustain: 0.8, release: 0.12, gain: 0.13, glide: 0.018, dest: duck, rev: 0.5, del: 0.45, vibrato: 9 });
  for (const e of S.lead) lead(e.t, e.note, e.dur, e.v);

  // Intro drone: a slow A that breathes in.
  {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq('A1');
    const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.13, 2.5); g.gain.linearRampToValueAtTime(0.1, 7.9); g.gain.linearRampToValueAtTime(0, 8.2);
    o.connect(g).connect(music); o.start(0); o.stop(8.5);
  }

  onProgress(0.7);
  // Report progress while rendering by suspending at intervals.
  for (let t = 5; t < DURATION; t += 5) {
    ctx.suspend(t).then(() => { onProgress(0.7 + 0.3 * (t / DURATION)); ctx.resume(); });
  }
  const out = await ctx.startRendering();
  onProgress(1);
  return out;
}

// 16-bit PCM WAV encoder (used by the offline video renderer).
function audioBufferToWav(ab) {
  const ch = ab.numberOfChannels, len = ab.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, ab.sampleRate, true); data.setUint32(28, ab.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); w(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => ab.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) { const s = clamp(chans[c][i], -1, 1); data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return data.buffer;
}
