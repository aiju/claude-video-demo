'use strict';
// App shell: boot, playback clock (driven by the audio hardware clock when
// sound is on), controls, and an offline frame-render mode used by tools/.

(async function main() {
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  const canvas = document.getElementById('stage');
  const ui = {
    start: document.getElementById('start'), play: document.getElementById('play-btn'), status: document.getElementById('status'),
    bar: document.getElementById('controls'), toggle: document.getElementById('toggle'), time: document.getElementById('time'),
    scrub: document.getElementById('scrub'), marks: document.getElementById('marks'), mute: document.getElementById('mute'),
    full: document.getElementById('full'), error: document.getElementById('error'),
  };
  const fail = (msg) => { if (ui.error) { ui.error.hidden = false; ui.error.textContent = msg; } console.error(msg); };

  let R;
  try { R = new Renderer(canvas); } catch (e) { fail(e.message); return; }

  // ---- fonts + glyph atlas ----
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  await withTimeout(Promise.all([
    document.fonts.load('700 56px "JetBrains Mono"'), document.fonts.load('800 56px "Unbounded"'),
    document.fonts.load('700 56px "Noto Sans JP"', '猫ねこ犬星'),
  ]).catch(() => {}), 4000);
  let ascii = '';
  for (let c = 32; c < 127; c++) ascii += String.fromCharCode(c);
  const extra = '·−≈→▸×√ᵀπöäüß…' + CLUSTERS.flatMap((c) => c.words.map((w) => w[0])).join('') + Object.values(CAPTIONS).join('');
  R.setAtlas(buildGlyphAtlas(R.gl, { mono: { weight: 700, chars: ascii + extra }, disp: { weight: 800, chars: ascii } }));

  // ---- sizing: a 16:9 stage letterboxed into the window ----
  const quality = parseFloat(params.get('q') || '1');
  function fit() {
    if (renderMode) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    let w = vw, h = (vw * 9) / 16;
    if (h > vh) { h = vh; w = (vh * 16) / 9; }
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    let pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const maxPx = 2560 * 1440;
    if (pw * ph > maxPx) { const k = Math.sqrt(maxPx / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
    R.resize(pw, ph);
  }

  // ---- offline render mode (driven by tools/render-video.mjs) ----
  if (renderMode) {
    const w = parseInt(params.get('w') || '1920', 10), h = parseInt(params.get('h') || '1080', 10);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    R.resize(w, h);
    document.body.classList.add('render-mode');
    window.__frame = (t, type = 'image/jpeg', q = 0.93) => { directFrame(R, t); R.render(t); return canvas.toDataURL(type, q); };
    window.__audioWav = async () => {
      const ab = await renderSoundtrack();
      const bytes = new Uint8Array(audioBufferToWav(ab));
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    };
    window.__ready = true;
    return;
  }

  fit();
  window.addEventListener('resize', fit);

  // ---- playback clock ----
  const player = {
    ctx: null, buffer: null, src: null, gain: null, playing: false, startAt: 0, offset: 0, muted: false, wallStart: 0,
    now() {
      if (!this.playing) return this.offset;
      if (this.ctx && this.buffer) {
        const lat = this.ctx.outputLatency || this.ctx.baseLatency || 0;
        return Math.max(0, this.ctx.currentTime - this.startAt - lat) + this.offset;
      }
      return (performance.now() - this.wallStart) / 1000 + this.offset;
    },
    play(from = this.offset) {
      this.stopSource();
      this.offset = clamp(from, 0, DURATION);
      if (this.offset >= DURATION - 0.05) this.offset = 0;
      if (this.ctx && this.buffer) {
        this.ctx.resume();
        this.src = this.ctx.createBufferSource();
        this.src.buffer = this.buffer;
        this.src.connect(this.gain);
        this.startAt = this.ctx.currentTime + 0.03;
        this.src.start(this.startAt, this.offset);
      } else {
        this.wallStart = performance.now();
      }
      this.playing = true;
    },
    pause() { this.offset = this.now(); this.playing = false; this.stopSource(); },
    seek(t) { if (this.playing) this.play(t); else this.offset = clamp(t, 0, DURATION); },
    stopSource() { if (this.src) { try { this.src.stop(); } catch (e) { /* already stopped */ } this.src.disconnect(); this.src = null; } },
  };
  const startT = parseFloat(params.get('t') || (location.hash.match(/^#t(\d+(?:\.\d+)?)$/) || [])[1] || '0');
  player.offset = clamp(startT || 0, 0, DURATION);

  // Soundtrack renders in the background while the start screen is up.
  let audioReady = false;
  ui.status.textContent = 'synthesizing soundtrack… 0%';
  const audioPromise = renderSoundtrack(SCORE, (p) => { if (!audioReady) ui.status.textContent = `synthesizing soundtrack… ${Math.round(p * 100)}%`; })
    .then((buf) => { player.buffer = buf; audioReady = true; ui.status.textContent = 'ready · sound on'; ui.play.disabled = false; })
    .catch((e) => { console.error(e); ui.status.textContent = 'audio unavailable, playing silently'; ui.play.disabled = false; });

  function ensureAudioContext() {
    if (player.ctx || !player.buffer) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    player.ctx = new AC({ latencyHint: 'playback' });
    player.gain = player.ctx.createGain();
    player.gain.gain.value = player.muted ? 0 : 1;
    player.gain.connect(player.ctx.destination);
  }

  // ---- controls ----
  SECTIONS.forEach((s) => {
    const m = document.createElement('button');
    m.className = 'mark'; m.type = 'button';
    m.style.left = (s.t0 / DURATION) * 100 + '%';
    m.title = s.label; m.setAttribute('aria-label', `Jump to ${s.label}`);
    m.addEventListener('click', () => player.seek(s.t0));
    ui.marks.appendChild(m);
  });
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  let scrubbing = false;
  ui.scrub.addEventListener('input', () => { scrubbing = true; player.seek((ui.scrub.value / 1000) * DURATION); });
  ui.scrub.addEventListener('change', () => { scrubbing = false; });
  const togglePlay = () => {
    if (player.playing) player.pause();
    else { ensureAudioContext(); player.play(); }
  };
  ui.toggle.addEventListener('click', togglePlay);
  ui.play.addEventListener('click', async () => {
    ui.play.disabled = true;
    await audioPromise;
    ensureAudioContext();
    ui.start.hidden = true;
    ui.bar.hidden = false;
    player.play(player.offset >= DURATION - 0.05 ? 0 : player.offset);
    poke();
  });
  ui.mute.addEventListener('click', () => {
    player.muted = !player.muted;
    if (player.gain) player.gain.gain.value = player.muted ? 0 : 1;
    ui.mute.textContent = player.muted ? 'Sound off' : 'Sound on';
    ui.mute.setAttribute('aria-pressed', String(player.muted));
  });
  ui.full.addEventListener('click', () => {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); if (ui.start.hidden) togglePlay(); else ui.play.click(); }
    else if (e.key === 'ArrowLeft') { player.seek(player.now() - BAR); }
    else if (e.key === 'ArrowRight') { player.seek(player.now() + BAR); }
    else if (e.key === 'Home') { player.seek(0); }
    else if (e.key === 'f') { ui.full.click(); }
    else if (e.key === 'm') { ui.mute.click(); }
    else if (e.key === 'h') { document.body.classList.toggle('clean'); }
    else if (/^[1-7]$/.test(e.key)) { player.seek(SECTIONS[parseInt(e.key, 10) - 1].t0); }
    poke();
  });
  // Auto-hide the controls while playing.
  let lastPoke = performance.now();
  const poke = () => { lastPoke = performance.now(); document.body.classList.remove('idle'); };
  window.addEventListener('pointermove', poke);
  window.addEventListener('pointerdown', poke);

  // ---- main loop ----
  let lastUi = -1;
  function frame() {
    let t = player.now();
    if (player.playing && t >= DURATION) {
      player.pause(); player.offset = DURATION;
      t = DURATION;
      ui.start.hidden = false; ui.play.disabled = false;
      ui.play.textContent = 'Replay';
      ui.status.textContent = 'that was one forward pass… and then six more';
    }
    directFrame(R, Math.min(t, DURATION - 1e-3));
    R.render(t);
    if (Math.abs(t - lastUi) > 0.05) {
      lastUi = t;
      if (!scrubbing) ui.scrub.value = String(Math.round((t / DURATION) * 1000));
      ui.time.textContent = `${fmt(t)} / ${fmt(DURATION)}`;
      ui.toggle.textContent = player.playing ? 'Pause' : 'Play';
      ui.toggle.setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
    }
    if (player.playing && performance.now() - lastPoke > 2500) document.body.classList.add('idle');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (params.has('shot')) { document.body.classList.add('clean'); ui.start.hidden = true; }
  window.__app = { player, R };
})();
