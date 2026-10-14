# Kit API cheat sheet

Everything is a global (classic scripts, so pages also work from `file://`).
Load order: `math gl text render fx music synth hud timeline` → your scripts → `player`.
Scenes must be **pure functions of time**: no `Math.random()`, no state carried
between frames (use `hash1/2/3`, `mulberry32(seed)`, and build data once lazily).

## A video in one file

```js
const sc = new ScoreBuilder({ bpm: 120, duration: 30 });   // 1 bar = 2 s, 16th step = 0.125 s
sc.chords([[0, 'Am'], [2, 'F'], [4, 'C'], [6, 'G']]);       // [time, chord symbol]
for (let bar = 2; bar < 10; bar++) sc.fullBar(bar).rollingBass(bar).arpBar(bar);
sc.build(2, 4).drop(4);
const SCORE = sc.done();

function sceneA(R, t, local, section) { envSpace(R); R.setCamera([0, 0, 12], [0, 0, 0]); R.text('HI', [0, 0, 0], 1, COL.cyan); }

defineVideo({ title: 'X', score: SCORE, sections: [
  { name: 'a', t0: 0, label: 'INTRO', caption: '▸ …', scene: 'sceneA' },   // t1 = next t0
]});
```

`defineVideo` fields: `title, eyebrow, subtitle, endMessage, duration (default score.duration),
score, sections[{name, t0, t1?, label?, caption?, scene}], hud=true, globalFx=true,
fontLoads=['700 56px "JetBrains Mono"', ['700 56px "Noto Sans JP"', '猫'] …], fonts, chars, post(R,t)`.
`scene` is a function or a global function's name. `globalFx` adds: flash + aberration on
`impact` events, frame tearing during `glitch` events, a cut flash at every section start, bloom
pump on strong kicks. `hud` draws chapter label, caption, timecode, a spectrum.

## Space and units

- World: y up, units are arbitrary (text size 1 = 1 unit em height). Default fov 50.
  Visible width at distance d ≈ `1.66·d`. `fitDistance(width)` gives d for a width.
- HUD layers (`'hudUnder'`, `'hud'`): fixed 16:9 box, x ∈ [-8, 8], y ∈ [-4.5, 4.5], no perspective.
- Colors are **linear** RGB arrays. `hex('#19e6ff', k)` converts (k = intensity). Anything
  brighter than ~1 blooms; 1.5–2.5 for hero elements. `cmix(a, b, t)`, `cmul(c, k)`.

## Renderer `R` (passed to scenes)

| Call | Notes |
| --- | --- |
| `R.setCamera(pos, target, up=[0,1,0], fov=50)` | once per frame |
| `R.use(layer)` | `'under'` (alpha) → `'add'` (default) → `'over'` (alpha) → `'top'` → `'hudUnder'` (alpha) → `'hud'`. Reset to `'add'` after. |
| `R.sprite(p, size, rgb, a=1, shape=0, rot=0, stretch=1)` | camera-facing quad, half-size `size`. Shapes: 0 glow orb · 1 ring · 2 rounded cell/bar (stretch = aspect) · 3 crisp disc · 4 lens-flare star · 5 rounded-rect outline · 6 rounded-rect fill · 7 streak |
| `R.line(a, b, rgbA, rgbB, width, alphaA=1, alphaB=alphaA)` | glowing beam, width in world units (≥1.2 px) |
| `R.polyline(pts, rgb, width, a0=1, a1=1, rgb1)` | |
| `R.text(str, p, size, rgb, opts)` → width | SDF neon text, billboarded. opts: `font:'mono'\|'disp'`, `align:-1\|0\|1`, `glow`, `alpha`, `tracking`, `hot`, `fx(i, ch, s, n)` per-char hook (set `s.ch, s.dx, s.dy, s.dz, s.scale, s.alpha, s.color, s.rot, s.glow`) |
| `R.measure(str, font, tracking)` | width in em |
| `R.env.*` | background: `nebula, nebA, nebB, stars, baseA, baseB, grid, gridY, gridCell, gridFog, gridScroll, gridColor, horizon, horizonColor, tunnel, tunnelR, tunnelZ, tunnelA, tunnelB` |
| `R.post.*` | `flash` (0–1 blend to white, decays per frame you set it), `flashColor, aberr, glitch` (0–1), `fade` (0–1 to black), `bloom, threshold, exposure, sat, contrast, vignette, grain, scan, distort, tint` |

All fields reset every frame, so set them every frame (from time).

## math.js

`clamp mix fract smooth smoother` · `range(x,a,b)` 0..1 · `sstep(a,b,x)` smooth 0..1 ·
`win(t,t0,t1,fadeIn,fadeOut)` 1 inside a window · `ease.{inQuad,outQuad,inCubic,outCubic,inOutCubic,outExpo,inExpo,inOutExpo,outBack,outElastic}` ·
`hash1(n) hash2(a,b) hash3(a,b,c)` → [0,1) · `mulberry32(seed)()` · `gauss(rng)` · `noise1(x,seed)` ·
vectors are arrays: `vadd vsub vscale vlerp vdot vcross vlen vnorm rotX rotY rotZ bezier3(a,ctrl,b,t)` ·
`pulse(times, t, decay)` exp decay since last event · `lastIndex(times, t)` ·
`monotoneSpline(xs, ys)` → f(x), hits every point without overshoot (camera paths on exact beats).

## fx.js

| Helper | |
| --- | --- |
| `COL.{cyan,magenta,violet,amber,mint,blue,coral,pink,gold,white,ink,dim}`, `ACCENTS[]` | palette |
| `valueColor(v)` | diverging map for v ∈ [-1,1] |
| `drawChip(R, label, p, size, rgb, a, {font, glow, outline, dimFirst, fx, panelLayer, lineLayer})` → half-width | readable label in a dark rounded panel. In HUD pass `panelLayer:'hudUnder', lineLayer:'hud'` |
| `chipRow(R, labels, size, gap)` → centre xs | |
| `decodeFx(t, t0, dur=.25, stagger=.03, seed)` | scramble-then-settle reveal (pass as `fx`) |
| `typeFx(t, t0, rate=.06, rgb?)` · `waveFx(t, amp, speed, k)` | typewriter · per-char wave |
| `burst(R, c, t, t0, {n, speed, life, drag, size, color, colors, seed, flat})` | spark burst |
| `shockwave(R, c, t, t0, {size=6, life=.6, color, alpha=.6})` | ring; keep size ≤ ~10 |
| `dust(R, t, {n, box, center, color, alpha, seed})` | drifting background specks |
| `pointCloud(R, pts, u, {from, brightness})` | `pts=[{p, col, size, b}]` fly in from `from` as u goes 0→1 |
| `arcPoints(a, b, height, angle, n)` · `drawArc(R, pts, rgb, width, a, reveal)` · `pointOnPolyline(pts, u)` | arcs (angle rotates the bulge around x) |
| `arrow(R, a, b, rgb, w, reveal, alpha)` · `rectOutline(R, centre, hw, hh, rgb, w, a)` | |
| `orbit(target, dist, yaw, pitch)` → pos · `fitDistance(width, fov, aspect)` · `shake(t, amt, seed)` → offset | camera |
| `envSpace(R, k)` · `envSynthwave(R, t, k, {y, cell, speed, color, horizon})` · `envTunnel(R, k)` | background presets |

## music.js: `ScoreBuilder`

`new ScoreBuilder({bpm, duration, voicings: {Am9: ['A3','C4','E4','B4']}})`
- time: `sc.bt(bar, step16)`, `sc.BEAT`, `sc.BAR`, `sc.STEP`
- harmony: `chords([[t,'Am'],…])` (symbols: `C Cm Cmaj7 Cm7 C7 Csus2 Csus4 Cadd9 Cm9 C9 C6 Cdim Caug`, `#`/`b` ok), `chordAt(t)`, `rootAt(t)`
- bars: `fullBar(bar,{hats,clap})` four-on-the-floor · `halfTimeBar(bar)` · `rollingBass(bar)` · `offbeatBass(bar)` · `longBass(t,dur)` · `arpBar(bar, every=1, v=.8)` · `melody(bar, [[step,'A4',lenSteps],…], track='lead')` · `roll(bar, fromStep, toStep, rate, v0, v1)` snare roll
- moments: `drop(t, v)` impact+crash+subdrop · `build(t0, t1)` riser + reverse cymbal landing on t1 · `whoosh(t, dur, pan, v)` · `glitch(t, dur)` · `drone(note, [[t,gain],…])`
- raw: `add(track, t, {v, note, dur, …})`, `kick(t, v)` (v ≥ .8 also pumps the sidechain), `marks(name, times)` (plain time list for visuals)
- automation: `padLevel([[t,v]])`, `padCut([[t,hz]])`, `arpCut([[t,hz]])`, `mixer({kick: .8, …})`
- `done()` → score. `score.times.<track>` are sorted times for visuals; `score.times.bigKick` = strong kicks.

Tracks the synth plays: drums `kick snare clap hat ohat crash` · fx `impact subdrop riser{dur} reverse{dur} whoosh{dur,pan} glitch{dur}` ·
ui `type tick blip{note} ding{note,chord} pluck{note}` · tonal `bass arp lead {note,dur,v}`, pads from chords, drones.
Any other track name is just data for your scenes. Mix keys = track names + `pads master music drums sfx reverb delay`.
Voices: `score.voices = {lead: {oscs, cutBase, cutPeak, …}}` overrides presets in `synth.js`.

## Player (`kit/player.js`)

URL: `?t=12` / `#t12` start time · `?q=0.5` half resolution · `?shot` hide UI · `?render&w=&h=` frame mode for tools.
Keys: space · ←/→ one bar · 1–9 chapters · f · m · h. Visuals start immediately; sound joins when synthesized
(cached in IndexedDB per score, so edits to scenes reload instantly). Under `tools/dev.mjs` it live-reloads and
keeps its position. Render mode exposes `window.__frame(t) → dataURL`, `__audioWav()`, `__renderer`, `__video`.

## Tools

```
node tools/dev.mjs [port]                                   # serve + live reload (no deps)
node tools/check.mjs videos/<v>/index.html [--audio] [--t 3,7.5] [--only] [--n 24] [--out check.png]
node tools/build-single.mjs videos/<v>/index.html [--artifact] [--out dist/<v>.html]
node tools/render-video.mjs videos/<v>/index.html --w 1920 --h 1080 --fps 60 [--gpu] --out v.mp4
```
