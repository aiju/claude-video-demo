# claude-video-demo

Live-rendered WebGL + WebAudio videos. `kit/` is the reusable engine, `videos/<name>/`
holds one video each (`videos/_template` is the starter, `videos/next-token` the
full example). To make a new video, follow `.claude/skills/make-video/SKILL.md`;
the API is summarised in `kit/API.md` and the speed notes are in `PLAYBOOK.md`.

- No build step; pages are classic scripts sharing globals and also work from `file://`.
- Scenes must be pure functions of time (no `Math.random()`, no per-frame state).
- Check visuals with `node tools/check.mjs videos/<name>/index.html [--audio]`.
