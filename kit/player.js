'use strict';
// Player shell for a video defined with defineVideo(): builds its own UI, boots
// the renderer, synthesizes (and caches) the soundtrack, and runs the clock.
//   - Visuals can play immediately; sound joins when the synth finishes.
//   - The clock follows the audio hardware clock while sound is playing.
//   - Served by tools/dev.mjs, it live-reloads on file changes and keeps its place.
//   - ?render puts it in frame-render mode for tools/ (window.__frame etc.).
//   - ?t=12 or #t12 starts at 12 s; ?q=0.5 renders at half resolution.

(function () {
  const params = new URLSearchParams(location.search);
  const renderMode = params.has('render');
  const DEV_KEY = 'kit-dev-state';

  const CSS = `
  :root { --bg:#000; --ink:#e9f6ff; --muted:#8aa3b8; --accent:#19e6ff; --hot:#ff2d95;
    --display:"Unbounded","JetBrains Mono",system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace; color-scheme:dark; }
  html,body { height:100%; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:var(--mono); overflow:hidden; }
  #stage { display:block; position:fixed; inset:0; margin:auto; background:#000; }
  .kit-overlay { position:fixed; inset:0; display:grid; place-items:center; text-align:center; box-sizing:border-box;
    background:radial-gradient(ellipse at 50% 55%, rgba(25,230,255,.10), rgba(0,0,0,.82) 60%);
    padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); }
  .kit-card { display:grid; gap:18px; justify-items:center; max-width:40rem; }
  .kit-eyebrow { font-size:12px; letter-spacing:.32em; text-transform:uppercase; color:var(--accent); }
  .kit-card h1 { font-family:var(--display); font-weight:800; margin:0; line-height:.95; text-wrap:balance; font-size:clamp(40px,9vw,104px); letter-spacing:-.02em;
    background:linear-gradient(100deg,#fff 10%,var(--accent) 45%,var(--hot) 90%); -webkit-background-clip:text; background-clip:text; color:transparent;
    filter:drop-shadow(0 0 24px rgba(25,230,255,.35)); }
  .kit-sub { color:var(--muted); font-size:15px; line-height:1.6; margin:0; max-width:34rem; }
  .kit button { font:inherit; color:var(--ink); background:transparent; border:1px solid rgba(233,246,255,.25); border-radius:999px; padding:8px 16px; cursor:pointer; }
  .kit button:hover { border-color:var(--accent); }
  .kit button:focus-visible, .kit input:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
  #kit-play { font-family:var(--display); font-weight:800; font-size:18px; letter-spacing:.08em; text-transform:uppercase; padding:14px 34px;
    border:1px solid var(--accent); color:#001014; background:var(--accent); box-shadow:0 0 32px rgba(25,230,255,.55), inset 0 0 12px rgba(255,255,255,.6); }
  #kit-status { font-size:12px; color:var(--muted); letter-spacing:.08em; min-height:1.2em; font-variant-numeric:tabular-nums; }
  .kit-keys { font-size:11px; color:var(--muted); opacity:.8; line-height:1.8; }
  .kit kbd { font-family:var(--mono); border:1px solid rgba(233,246,255,.2); border-radius:4px; padding:0 5px; color:var(--ink); }
  #kit-controls { position:fixed; left:0; right:0; bottom:0; display:flex; gap:12px; align-items:center; box-sizing:border-box; font-size:12px;
    padding:12px max(16px, env(safe-area-inset-right, 0px)) calc(12px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
    background:linear-gradient(transparent, rgba(0,0,0,.75)); transition:opacity .4s; }
  body.idle #kit-controls, body.clean #kit-controls, body.clean #kit-badge { opacity:0; pointer-events:none; }
  body.idle { cursor:none; }
  #kit-time { font-variant-numeric:tabular-nums; color:var(--muted); min-width:7.5em; text-align:center; }
  .kit-track { position:relative; flex:1; min-width:0; height:24px; display:flex; align-items:center; }
  #kit-scrub { width:100%; margin:0; accent-color:var(--accent); }
  #kit-marks { position:absolute; inset:0; pointer-events:none; }
  .kit-mark { position:absolute; top:0; width:10px; height:8px; padding:0 !important; border:0 !important; border-radius:2px !important; transform:translateX(-50%); background:var(--hot) !important; opacity:.8; pointer-events:auto; }
  #kit-badge { position:fixed; top:calc(12px + env(safe-area-inset-top, 0px)); right:max(16px, env(safe-area-inset-right, 0px)); font-size:11px; color:var(--muted);
    border:1px solid rgba(233,246,255,.2); border-radius:999px; padding:4px 10px; background:rgba(0,0,0,.5); }
  #kit-error { position:fixed; inset:auto 16px 16px; padding:12px 16px; background:#2a0010; color:#ffd6e4; border:1px solid var(--hot); border-radius:8px; white-space:pre-wrap; font-size:12px; }
  @media (max-width:560px) { .kit-keys, #kit-full { display:none; } #kit-controls { gap:8px; } }
  @media (prefers-reduced-motion:reduce) { #kit-controls { transition:none; } }`;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function buildDom(V) {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = document.createElement('div'); root.className = 'kit';
    root.innerHTML = `
      <canvas id="stage" aria-label="${esc(V.title || 'Animation')}"></canvas>
      <div id="kit-start" class="kit-overlay"><div class="kit-card">
        ${V.eyebrow ? `<div class="kit-eyebrow">${esc(V.eyebrow)}</div>` : ''}
        <h1>${esc(V.title || 'Untitled')}</h1>
        ${V.subtitle ? `<p class="kit-sub">${esc(V.subtitle)}</p>` : ''}
        <button id="kit-play" type="button">Play</button>
        <div id="kit-status" role="status" aria-live="polite"></div>
        <div class="kit-keys"><kbd>space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> skip a bar · <kbd>1</kbd>–<kbd>9</kbd> chapters · <kbd>f</kbd> fullscreen · <kbd>h</kbd> hide UI</div>
      </div></div>
      <div id="kit-controls" hidden>
        <button id="kit-toggle" type="button" aria-label="Pause">Pause</button>
        <span id="kit-time">0:00</span>
        <div class="kit-track"><input id="kit-scrub" type="range" min="0" max="1000" value="0" aria-label="Timeline"><div id="kit-marks"></div></div>
        <button id="kit-mute" type="button" aria-pressed="false">Sound on</button>
        <button id="kit-full" type="button">Fullscreen</button>
      </div>
      <div id="kit-badge" hidden></div>
      <div id="kit-error" hidden></div>`;
    document.body.appendChild(root);
    const $ = (id) => document.getElementById(id);
    return {
      canvas: $('stage'), start: $('kit-start'), play: $('kit-play'), status: $('kit-status'), bar: $('kit-controls'),
      toggle: $('kit-toggle'), time: $('kit-time'), scrub: $('kit-scrub'), marks: $('kit-marks'), mute: $('kit-mute'),
      full: $('kit-full'), badge: $('kit-badge'), error: $('kit-error'),
    };
  }
  function showError(msg) {
    console.error(msg);
    let el = document.getElementById('kit-error');
    if (!el) { el = document.createElement('div'); el.id = 'kit-error'; document.body.appendChild(el); }
    el.hidden = false; el.textContent = String(msg && msg.stack ? msg.stack : msg);
  }
  window.addEventListener('error', (e) => showError(e.error || e.message));

  // ---- soundtrack cache (IndexedDB), keyed by the score + synth version ----
  function scoreKey(S) {
    const o = {};
    for (const k of Object.keys(S).sort()) if (k !== 'times') o[k] = S[k];
    const s = JSON.stringify(o) + '|' + SYNTH_VERSION;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'snd-' + (h >>> 0).toString(16) + '-' + s.length;
  }
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('kit-video', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('audio');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function cacheGet(key) {
    try {
      const db = await idb();
      return await new Promise((res) => { const q = db.transaction('audio').objectStore('audio').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    } catch (e) { return null; }
  }
  async function cachePut(key, ab) {
    try {
      const db = await idb();
      const chans = Array.from({ length: ab.numberOfChannels }, (_, i) => ab.getChannelData(i).slice());
      const tx = db.transaction('audio', 'readwrite'), st = tx.objectStore('audio');
      st.clear(); st.put({ sr: ab.sampleRate, chans }, key);
    } catch (e) { /* caching is best-effort */ }
  }
  async function loadSoundtrack(S, onProgress) {
    const key = scoreKey(S);
    const hit = await cacheGet(key);
    if (hit) {
      const ab = new AudioBuffer({ length: hit.chans[0].length, numberOfChannels: hit.chans.length, sampleRate: hit.sr });
      hit.chans.forEach((c, i) => ab.copyToChannel(c, i));
      return ab;
    }
    const ab = await renderSoundtrack(S, onProgress);
    cachePut(key, ab);
    return ab;
  }

  async function boot() {
    const V = VIDEO;
    if (!V) throw new Error('No video defined: call defineVideo({...}) in a script before kit/player.js.');
    const ui = buildDom(V);
    const R = new Renderer(ui.canvas);
    const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    const loads = V.fontLoads || ['700 56px "JetBrains Mono"', '800 56px "Unbounded"'];
    await withTimeout(Promise.all(loads.map((f) => (Array.isArray(f) ? document.fonts.load(f[0], f[1]) : document.fonts.load(f)))).catch(() => {}), 4000);
    const atlas = new GlyphAtlas(R.gl, V.fonts || FONT_STACKS);
    let ascii = '';
    for (let c = 32; c < 127; c++) ascii += String.fromCharCode(c);
    for (const key in atlas.fonts) atlas.preload(key, ascii);
    if (V.chars) atlas.preload('mono', V.chars);
    R.setAtlas(atlas);
    const D = V.duration;

    // ---- offline render mode ----
    if (renderMode) {
      const w = parseInt(params.get('w') || '1920', 10), h = parseInt(params.get('h') || '1080', 10);
      ui.start.hidden = true;
      ui.canvas.style.width = w + 'px'; ui.canvas.style.height = h + 'px';
      R.resize(w, h);
      window.__frame = (t, type = 'image/jpeg', q = 0.93) => { directFrame(R, t); R.render(t); return ui.canvas.toDataURL(type, q); };
      window.__audioWav = async () => {
        const ab = await renderSoundtrack(V.score);
        const bytes = new Uint8Array(audioBufferToWav(ab));
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      window.__renderer = R;
      window.__ready = true;
      return;
    }

    // ---- sizing: a 16:9 stage letterboxed into the window ----
    const quality = parseFloat(params.get('q') || '1');
    function fit() {
      const vw = window.innerWidth, vh = window.innerHeight;
      let w = vw, h = (vw * 9) / 16;
      if (h > vh) { h = vh; w = (vh * 16) / 9; }
      ui.canvas.style.width = w + 'px'; ui.canvas.style.height = h + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
      let pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      const maxPx = 2560 * 1440;
      if (pw * ph > maxPx) { const k = Math.sqrt(maxPx / (pw * ph)); pw = Math.round(pw * k); ph = Math.round(ph * k); }
      R.resize(Math.max(16, pw), Math.max(9, ph));
    }
    fit();
    window.addEventListener('resize', fit);

    // ---- clock: wall clock until sound is available, then the audio clock ----
    const P = {
      ctx: null, gain: null, buffer: null, src: null, playing: false, offset: 0, mode: 'wall', wallStart: 0, startAt: 0, muted: false,
      now() {
        if (!this.playing) return this.offset;
        if (this.mode === 'audio') return Math.max(0, this.ctx.currentTime - this.startAt - (this.ctx.outputLatency || this.ctx.baseLatency || 0)) + this.offset;
        return (performance.now() - this.wallStart) / 1000 + this.offset;
      },
      canAudio() { return this.ctx && this.buffer && this.ctx.state === 'running'; },
      startAudio() {
        this.stopSource();
        this.src = this.ctx.createBufferSource(); this.src.buffer = this.buffer; this.src.connect(this.gain);
        this.startAt = this.ctx.currentTime + 0.03; this.src.start(this.startAt, this.offset); this.mode = 'audio';
      },
      play(from = this.offset) {
        this.offset = clamp(from, 0, D);
        if (this.offset >= D - 0.05) this.offset = 0;
        this.playing = true;
        if (this.canAudio()) this.startAudio();
        else { this.stopSource(); this.mode = 'wall'; this.wallStart = performance.now(); }
      },
      // Switch a silent playback over to sound as soon as it becomes possible.
      upgrade() { if (this.playing && this.mode === 'wall' && this.canAudio()) { this.offset = this.now(); this.startAudio(); } },
      pause() { this.offset = this.now(); this.playing = false; this.stopSource(); this.mode = 'wall'; },
      seek(t) { if (this.playing) this.play(t); else this.offset = clamp(t, 0, D); },
      stopSource() { if (this.src) { try { this.src.stop(); } catch (e) { /* already stopped */ } this.src.disconnect(); this.src = null; } },
    };
    function ensureContext() {
      if (!P.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        P.ctx = new AC({ latencyHint: 'playback' });
        P.gain = P.ctx.createGain(); P.gain.gain.value = P.muted ? 0 : 1; P.gain.connect(P.ctx.destination);
      }
      if (P.ctx.state !== 'running') P.ctx.resume().then(() => { P.upgrade(); updateBadge(); }).catch(() => {});
    }
    function updateBadge() {
      const needClick = P.playing && P.buffer && (!P.ctx || P.ctx.state !== 'running');
      const loading = P.playing && !P.buffer;
      ui.badge.hidden = !(needClick || loading);
      ui.badge.textContent = needClick ? 'click for sound' : 'synthesizing sound…';
    }

    const startT = parseFloat(params.get('t') || (location.hash.match(/^#t(\d+(?:\.\d+)?)$/) || [])[1] || '0');
    P.offset = clamp(startT || 0, 0, D);

    // Restore position after a dev live-reload.
    let restored = null;
    try { restored = JSON.parse(sessionStorage.getItem(DEV_KEY) || 'null'); sessionStorage.removeItem(DEV_KEY); } catch (e) { /* no storage */ }
    if (restored && Date.now() - restored.at < 60000) {
      P.offset = clamp(restored.t, 0, D);
      if (restored.started) { ui.start.hidden = true; ui.bar.hidden = false; }
      if (restored.playing) P.play(P.offset);
    }

    ui.status.textContent = 'synthesizing soundtrack… 0%';
    let t0 = performance.now();
    loadSoundtrack(V.score, (p) => { ui.status.textContent = `synthesizing soundtrack… ${Math.round(p * 100)}%`; })
      .then((buf) => {
        P.buffer = buf;
        ui.status.textContent = `sound ready (${((performance.now() - t0) / 1000).toFixed(1)} s)`;
        P.upgrade(); updateBadge();
      })
      .catch((e) => { console.error(e); ui.status.textContent = 'audio unavailable, playing silently'; });

    // ---- controls ----
    V.sections.forEach((s) => {
      const m = document.createElement('button');
      m.className = 'kit-mark'; m.type = 'button';
      m.style.left = (s.t0 / D) * 100 + '%';
      m.title = s.label || s.name; m.setAttribute('aria-label', `Jump to ${s.label || s.name}`);
      m.addEventListener('click', () => P.seek(s.t0));
      ui.marks.appendChild(m);
    });
    const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    let scrubbing = false;
    ui.scrub.addEventListener('input', () => { scrubbing = true; P.seek((ui.scrub.value / 1000) * D); });
    ui.scrub.addEventListener('change', () => { scrubbing = false; });
    const togglePlay = () => { if (P.playing) P.pause(); else { ensureContext(); P.play(); } updateBadge(); };
    ui.toggle.addEventListener('click', togglePlay);
    ui.play.addEventListener('click', () => {
      ensureContext();
      ui.start.hidden = true; ui.bar.hidden = false;
      P.play(P.offset >= D - 0.05 ? 0 : P.offset);
      updateBadge(); poke();
    });
    window.addEventListener('pointerdown', () => { if (P.playing) { ensureContext(); updateBadge(); } });
    ui.mute.addEventListener('click', () => {
      P.muted = !P.muted;
      if (P.gain) P.gain.gain.value = P.muted ? 0 : 1;
      ui.mute.textContent = P.muted ? 'Sound off' : 'Sound on';
      ui.mute.setAttribute('aria-pressed', String(P.muted));
    });
    ui.full.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    });
    const BAR_S = (V.score && V.score.beat ? V.score.beat * 4 : 2);
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); if (ui.start.hidden) togglePlay(); else ui.play.click(); }
      else if (e.key === 'ArrowLeft') P.seek(P.now() - BAR_S);
      else if (e.key === 'ArrowRight') P.seek(P.now() + BAR_S);
      else if (e.key === 'Home') P.seek(0);
      else if (e.key === 'f') ui.full.click();
      else if (e.key === 'm') ui.mute.click();
      else if (e.key === 'h') document.body.classList.toggle('clean');
      else if (/^[1-9]$/.test(e.key) && V.sections[+e.key - 1]) P.seek(V.sections[+e.key - 1].t0);
      poke();
    });
    let lastPoke = performance.now();
    const poke = () => { lastPoke = performance.now(); document.body.classList.remove('idle'); };
    window.addEventListener('pointermove', poke);

    // ---- dev live reload (tools/dev.mjs) ----
    if (location.protocol.startsWith('http')) {
      try {
        const es = new EventSource('/__dev/events');
        es.addEventListener('reload', () => {
          try { sessionStorage.setItem(DEV_KEY, JSON.stringify({ t: P.now(), playing: P.playing, started: ui.start.hidden, at: Date.now() })); } catch (e) { /* ignore */ }
          location.reload();
        });
        es.onerror = () => { if (es.readyState === 2) es.close(); };
      } catch (e) { /* not served by dev.mjs */ }
    }

    // ---- main loop ----
    let lastUi = -1;
    function frame() {
      let t = P.now();
      if (P.playing && t >= D) {
        P.pause(); P.offset = D; t = D;
        ui.start.hidden = false; ui.play.textContent = 'Replay';
        if (V.endMessage) ui.status.textContent = V.endMessage;
        updateBadge();
      }
      try { directFrame(R, Math.min(t, D - 1e-3)); R.render(t); }
      catch (e) { showError(e); return; }
      if (Math.abs(t - lastUi) > 0.05) {
        lastUi = t;
        if (!scrubbing) ui.scrub.value = String(Math.round((t / D) * 1000));
        ui.time.textContent = `${fmt(t)} / ${fmt(D)}`;
        ui.toggle.textContent = P.playing ? 'Pause' : 'Play';
        ui.toggle.setAttribute('aria-label', P.playing ? 'Pause' : 'Play');
      }
      if (P.playing && performance.now() - lastPoke > 2500) document.body.classList.add('idle');
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (params.has('shot')) { document.body.classList.add('clean'); ui.start.hidden = true; }
    window.__app = { player: P, R };
  }

  const go = () => boot().catch(showError);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
