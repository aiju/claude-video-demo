# Next Token

A 60-second, deliberately over-the-top animation of what happens inside a large
language model, rendered live in the browser with raw WebGL2. The soundtrack is
synthesized in JavaScript at load time.

The story: the prompt *"The meaning of life is"* gets typed, split into tokens,
turned into ids and embedding vectors, flung into an embedding-space galaxy, run
through eight attention heads and a dive through 32 transformer layers, unembedded
into logits, squashed by softmax, sampled on a probability wheel, and then
generated one token at a time until the sentence finishes itself.

## Run it

No build step and no dependencies. Either:

- open `index.html` directly in a modern browser (Chrome, Edge, Firefox, Safari 15+), or
- serve the folder: `npm start` (runs `http-server` on <http://localhost:8080>).

The soundtrack is synthesized while the title screen is up (a couple of seconds),
then **Play** starts it.

| Key | Action |
| --- | --- |
| `space` / `k` | play / pause |
| `←` `→` | skip one bar (2 s) |
| `1`–`7` | jump to a chapter |
| `f` | fullscreen |
| `m` | mute |
| `h` | hide all UI |

URL options: `?t=33` starts at 33 s, `?q=0.5` renders at half resolution for slow GPUs.

## Timeline

120 BPM, 30 bars, A minor. Every cut, flash and pulse is placed on the musical grid.

| Time | Chapter | What you see |
| --- | --- | --- |
| 0–8 s | Prompt | heartbeat, typed prompt, scanner finds token boundaries |
| 8–16 s | Tokenize | token chips, ids, embedding-matrix lookup, vectors + positional waves |
| 16–24 s | Embed | the drop: a 16k-point galaxy, *king − man + woman ≈ queen*, *cat ≈ Katze ≈ 猫 ≈ ねこ* |
| 24–36 s | Attention | Q/K/V, eight heads of causal arcs, attention matrices, a barrel roll |
| 36–46 s | Layers | flight through 32 blocks; each one passes on the beat, with a "logit lens" guess |
| 46–52 s | Softmax | 50k-logit spectrum, softmax collapse, a probability wheel picks the token |
| 52–60 s | Generate | autoregressive appends, each attending back over the sentence; collapse to a cursor |

## How it works

- `src/score.js` is the single source of truth for timing: drum hits, notes,
  sound effects, layer-pass times and the sampling wheel's motion. The audio
  renderer and the visuals both read it, so sync comes for free. The wheel's
  tick sounds are computed from the wheel's own rotation.
- `src/audio.js` renders the whole track once through an `OfflineAudioContext`:
  drums and effects are synthesized sample-by-sample in JS (kick, snare, clap,
  808-style hats, risers, impacts, glitches, Karplus–Strong plucks, bells) and
  mixed into stems; pads (detuned supersaws), bass, arp and lead are WebAudio
  oscillators driven by automation, with sidechain pumping, a ping-pong delay and
  a generated convolution reverb. Playback is the rendered buffer, and the
  visual clock follows the audio hardware clock.
- `src/render.js` is a small immediate-mode renderer: instanced glow sprites,
  screen-space beams and SDF text drawn additively into a half-float buffer over
  a procedural environment shader (nebula, stars, synthwave grid, warp tunnel),
  then bloom, chromatic aberration, glitch, ACES tonemapping, grain and vignette.
- `src/text.js` builds a signed-distance-field glyph atlas at startup from web
  fonts, which keeps neon text sharp at any size.
- `src/scenes/*` holds one file per chapter. Each scene is a pure function of time,
  so scrubbing and offline rendering are exact.

## Render an MP4

```sh
npm install                      # installs Playwright
npm run render                   # 1920×1080 @ 60 fps → next-token.mp4
npm run render:preview           # 1280×720 @ 30 fps, quicker
node tools/render-video.mjs --gpu --w 3840 --h 2160 --fps 60 --out next-token-4k.mp4
```

The renderer drives the same page headlessly in `?render` mode, captures every
frame exactly, synthesizes the identical soundtrack to WAV and muxes both with
ffmpeg, which must be on your `PATH`. Without `--gpu` it uses SwiftShader, which
works anywhere but is slow.
