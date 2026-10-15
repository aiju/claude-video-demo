---
name: make-video
description: Make a short flashy animated video (WebGL visuals + synthesized soundtrack, rendered live in the browser) with this repo's kit. Use when asked to make, animate or "render" a video, motion graphic, music visualiser or explainer animation here.
---

# Make a video with the kit

Aim: a 30–40 s piece in about 10–15 minutes. Do not render an MP4 unless asked.
Read `kit/API.md` (the whole API on one page) instead of the kit source, and
`PLAYBOOK.md` once if you have not.

1. `cp -r videos/_template videos/<name>`. It already runs.
2. Plan briefly, in the file rather than in prose: in `videos/<name>/video.js`
   write `sections` (4–5 chapters, each starting on a bar line; 120 BPM = 2 s per bar)
   and the score with `ScoreBuilder`: chords, `fullBar/rollingBass/arpBar` for
   groove, `build(t0, t1)` before and `drop(t)` on the big moment, `add('blip'|'pluck'|'whoosh', t)`
   for anything a visual should hit.
3. Write one scene function per chapter, `scene(R, t, local, section)`, pure in `t`.
   Use `envSpace/envSynthwave/envTunnel`, `drawChip`, `decodeFx`, `burst`,
   `shockwave`, `pointCloud`, `arcPoints/drawArc`, `orbit/fitDistance/shake`,
   and sync with `pulse(SCORE.times.<track>, t, decay)`. Labels that must stay
   readable while the camera moves go in HUD space.
4. Check once: `node tools/check.mjs videos/<name>/index.html --audio`, then Read
   the contact sheet PNG it writes. Fix what is flagged and anything off-frame or unreadable.
5. Show it: if the user runs `node tools/dev.mjs`, the page live-reloads; in a
   cloud session run `node tools/build-single.mjs videos/<name>/index.html --artifact`
   and publish the output file as an Artifact.

Keep flashes short (`pulse` decay ≥ 12), shockwaves ≤ 10 units, hero intensities
1.5–2.5, and frame rows of text with `fitDistance`. For speed, chapters can be
written by parallel subagents (see PLAYBOOK.md).
