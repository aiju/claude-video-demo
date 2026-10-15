# claude-video-demo

Flashy, music-synced animations rendered live in the browser: raw WebGL2 visuals
and a soundtrack synthesized in JavaScript. No build step and no runtime
dependencies.

- **`kit/`**: the reusable engine (renderer with bloom and neon SDF text, effects,
  score builder, synth, player, HUD). API on one page: [`kit/API.md`](kit/API.md).
- **`videos/next-token/`**: *Next Token*, a 60-second trip through a language model.
- **`videos/clawd-day/`**: *Clawd's Day*, a playful 60-second day in the life of Clawd
  (wake up, coffee, deep work, a crab rave, ship it, counting sheep).
- **`videos/_template/`**: a 20-second starter that runs as-is; copy it to start a new video.
- **`tools/`**: dev server with live reload, a one-shot visual/audio checker, a
  single-file builder (for sharing or Artifacts), and an MP4 renderer.
- **[`PLAYBOOK.md`](PLAYBOOK.md)**: notes for doing "Claude makes a video" as a
  live demo in roughly 10–15 minutes.

## Quick start

```sh
npm run dev                       # http://localhost:8080/ — pages reload on every save
cp -r videos/_template videos/my-video
npm install                       # once; Playwright for the tools below
npm run check -- videos/my-video/index.html --audio   # contact sheet + flags + levels
npm run build -- videos/my-video/index.html           # one self-contained HTML file in dist/
npm run render -- videos/my-video/index.html --w 1920 --h 1080 --fps 60 --gpu --out my-video.mp4
```

Pages also open straight from disk (`file://`). In the player: `space` play/pause,
`←`/`→` skip a bar, `1`–`9` chapters, `f` fullscreen, `m` mute, `h` hide UI.
URL options: `?t=33` start time, `?q=0.5` half resolution.

## How a video is put together

A video is one `video.js` plus scene functions:

1. A **score** built with `ScoreBuilder` (`kit/music.js`): chords, drum and bass
   patterns, melodies, risers, drops and one-off sound effects, all on a musical
   grid. `kit/synth.js` renders it once through an `OfflineAudioContext`. Drums
   and effects are synthesized sample-by-sample in JS and mixed into stems, and
   pads/bass/arp/lead are oscillators with automation. The result is cached
   between reloads.
2. **Sections** (chapters) with a `scene(R, t)` each. A scene draws glow sprites,
   beams and text with the immediate-mode renderer, sets the background
   (`R.env`) and grading (`R.post`), and syncs to the music by reading the same
   score (`pulse(SCORE.times.kick, t, 9)`).
3. `defineVideo({...})` ties them together. `kit/player.js` builds the UI, runs
   the clock off the audio hardware clock, and supports frame-exact offline
   rendering, which the tools use.

Scenes are pure functions of time, so scrubbing, checking and offline rendering
are exact.

## Next Token

The prompt *"The meaning of life is"* is typed, tokenized, embedded into a
galaxy, run through eight attention heads and 32 layers, unembedded into logits,
squashed by softmax and sampled on a probability wheel. Then the sentence
finishes itself one token per beat. 120 BPM, A minor, 30 bars.

| Time | Chapter | What you see |
| --- | --- | --- |
| 0–8 s | Prompt | heartbeat, typed prompt, scanner finds token boundaries |
| 8–16 s | Tokenize | token chips, ids, embedding-matrix lookup, vectors + positional waves |
| 16–24 s | Embed | the drop: a 16k-point galaxy, *king − man + woman ≈ queen*, *cat ≈ Katze ≈ 猫 ≈ ねこ* |
| 24–36 s | Attention | Q/K/V, eight heads of causal arcs, attention matrices, a barrel roll |
| 36–46 s | Layers | flight through 32 blocks, each passing on the beat, with a "logit lens" guess |
| 46–52 s | Softmax | 50k-logit spectrum, softmax collapse, a probability wheel picks the token |
| 52–60 s | Generate | autoregressive appends, each attending back over the sentence; collapse to a cursor |
