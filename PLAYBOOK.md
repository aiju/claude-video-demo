# Playbook: "Claude makes a video" as a live demo

The first run (Next Token, 60 s) took about 66 minutes of wall-clock time. This
repo now contains the parts that do not need to be rewritten for every video,
plus notes on what to skip. The goal is a demo in roughly 10–15 minutes, with
the audience watching the video take shape.

## Where the time went, and what replaces it

| Phase (first run) | Time | With the kit | How |
| --- | --- | --- | --- |
| Planning the story, scenes, music | ~10 min | 2–3 min | Fixed recipe below; ask for 30–40 s, 4–5 chapters; lower reasoning effort (the first run was at *xhigh*) |
| Engine: WebGL, bloom, SDF text | ~5 min | 0 | `kit/render.js`, `kit/text.js` |
| Soundtrack engine + tuning + speed fix | ~7 min | 1–2 min | `ScoreBuilder` (about 20 lines per soundtrack); synth already tuned, mixed in stems, cached |
| Writing six scenes | ~11 min | 4–6 min | `kit/fx.js` helpers; fewer chapters; optionally one subagent per scene |
| Review loop (7 render + look + fix rounds) | ~13 min | 2–3 min | One `tools/check.mjs` run (about 10 s) that flags broken frames; the defaults already avoid last run's problems |
| README, commit, publish | ~2 min | ~1 min | `tools/build-single.mjs --artifact` + one publish, or just the dev server |
| MP4 render + re-encodes + upload | ~20 min | 0 | Skip. Render afterwards if wanted |

These are estimates; the remaining time is mostly Claude writing scene code.

## Before going live

- **Local machine (best for a demo):** `npm install` once (Playwright, only for
  `check`), then `npm run dev` and open `http://localhost:8080/` in Chrome. Every
  file Claude saves reloads the page at the same playback position, so the
  audience watches the video build up. Click once for sound after a reload
  (browser autoplay rule); the badge says so.
- **Cloud session:** there is no shared browser. Preview with
  `node tools/build-single.mjs videos/<name>/index.html --artifact` and publish
  that file as an Artifact; republish the same path to update the same link.
- Warm up: open any video once so the fonts are cached.
- Pick the topic in advance, or have the audience choose from three you have
  tried before.
- Set reasoning effort to medium or high. Most of the first run's planning time
  was deliberation.

## The recipe (what Claude should do)

1. `cp -r videos/_template videos/<name>` (the template runs as-is).
2. In `video.js`: write the chapter list (4–5 sections on bar lines) and the
   score with `ScoreBuilder`. Put every hit, cut and reveal in the score.
3. Write one scene per chapter (inline or `scenes/*.js` added to `index.html`),
   using `kit/fx.js` helpers and env presets. Read `kit/API.md`, not the kit source.
4. Run `node tools/check.mjs videos/<name>/index.html --audio` **once**. Look at
   the contact sheet, fix flagged frames and anything obviously off-frame or
   unreadable. A second run only if something was flagged.
5. Show it (dev server) or publish it (single-file Artifact).

### Shape that works

- 30–40 s at 120 BPM = 15–20 bars. Chapters 2–4 bars each.
- Intro (quiet, text reveal) → build (riser, `sc.build`) → drop on a bar line
  (`sc.drop`, the visual explosion) → 1–2 development chapters → outro with a
  final hit and fade.
- One idea per chapter. One hero object per shot. Big readable text.

## Rules of thumb (each cost a review round last time)

- **Flashes:** `R.post.flash` is a display-space blend toward white. Peaks of
  0.5–1.0 with `pulse(..., decay ≥ 12)` read as a hit; long low flashes look like fog.
- **Shockwaves:** ≤ ~10 world units, alpha ≤ 0.7. Huge rings dominate the frame.
- **Bloom:** threshold is 1.0. Normal elements ~0.8–1.2 intensity, heroes 1.5–2.5.
  Thousands of overlapping additive sprites turn grey-white; thin them out or dim them.
- **Framing:** use `fitDistance(width)` so rows of text or chips never run off screen.
  `check.mjs` won't catch off-frame content, so look for it in the contact sheet.
- **Labels and orbiting cameras:** world-space text is billboarded, but rows of
  labels overlap or read backwards once the camera swings round. Put labels in
  HUD space (`R.use('hud')`, `drawChip(..., {panelLayer:'hudUnder', lineLayer:'hud'})`).
- **Overlapping labels in clusters:** keep ≥ 1.5 × text size between labelled points.
- **Sync:** drive visuals from `SCORE.times.*` with `pulse()`, never from guessed
  timestamps. Cuts on bar lines; the director flashes every section start for free.
- **Determinism:** no `Math.random()` or frame-to-frame state in scenes; scrubbing,
  the checker and offline rendering all rely on this.
- **Budget:** keep under ~20k sprites per frame and JS under ~8 ms (the checker reports it).
- **Text:** any character works (the glyph atlas fills in on demand). For a Google
  font subset, add `['700 56px "Font"', 'chars']` to `fontLoads`.
- **Software GL:** cloud containers render at ~2–3 frames/s at 720p. Never render
  an MP4 during a demo. File uploads to the chat are capped at 30 MiB, and the
  film grain makes encodes large (use `--crf 20` or above).

## Optional: parallel scenes

To cut scene-writing time further, have the main session write `video.js`
(score + sections) and then start one subagent per chapter, giving each:
`kit/API.md`, the chapter's time range and what it shows, the score's relevant
event names, and the palette/env preset to use. Each writes
`videos/<name>/scenes/<chapter>.js` defining the named scene function. The main
session adds the script tags and runs the checker. This trades some stylistic
consistency for speed; shared presets keep it coherent.

## Afterwards (not live)

- `npm run render -- videos/<name>/index.html --gpu` for a 1080p60 MP4 on a machine with a GPU.
- `node tools/build-single.mjs videos/<name>/index.html` for a single HTML file to share.
