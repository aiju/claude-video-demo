'use strict';
// Video definition + frame director. A video is:
//   defineVideo({
//     title, eyebrow?, subtitle?, duration,
//     score,                       // from ScoreBuilder.done()
//     sections: [{ name, t0, t1, label?, caption?, scene }],  // scene(R, t, localT, section)
//     hud?: true,                  // draw the kit HUD (labels/captions/timecode)
//     globalFx?: true,             // impact flashes, glitch tears, cut flashes, kick bloom
//     fonts?, fontLoads?, endMessage?, post?(R, t)
//   })
// `scene` may be a function or the name of a global function (resolved at draw time,
// so script order does not matter).

let VIDEO = null;
function defineVideo(def) {
  const V = Object.assign({ hud: true, globalFx: true, eyebrow: '', subtitle: '' }, def);
  if (!V.duration) V.duration = V.score ? V.score.duration : V.sections[V.sections.length - 1].t1;
  V.sections = V.sections.map((s, i, a) => Object.assign({ t1: a[i + 1] ? a[i + 1].t0 : V.duration, name: `s${i}` }, s));
  VIDEO = V;
  window.__video = V;
  return V;
}
function sectionIndex(V, t) {
  for (let i = V.sections.length - 1; i >= 0; i--) if (t >= V.sections[i].t0) return i;
  return 0;
}

function directFrame(R, t, V = VIDEO) {
  R.resetFrameState();
  if (t < 0 || t >= V.duration) { R.post.fade = 1; R.setCamera([0, 0, 10], [0, 0, 0]); return; }
  const P = R.post, T = (V.score && V.score.times) || {};
  const sec = V.sections[sectionIndex(V, t)];
  const fn = typeof sec.scene === 'string' ? window[sec.scene] : sec.scene;
  if (typeof fn !== 'function') throw new Error(`section "${sec.name}": scene is not a function`);
  fn(R, t, t - sec.t0, sec);

  if (V.globalFx) {
    // Impacts flash and smear, glitch events tear the frame, cuts flash, kicks bloom.
    const imp = pulse(T.impact || [], t, 14);
    P.flash += imp * 0.8;
    P.aberr += imp * 0.025;
    for (const g of (V.score && V.score.glitch) || []) {
      if (t >= g.t && t < g.t + g.dur) P.glitch = Math.max(P.glitch, 0.5 + 0.5 * hash1(Math.floor(t * 40)));
    }
    if (!V._cuts) V._cuts = V.sections.map((s) => s.t0).filter((x) => x > 0);
    P.flash += pulse(V._cuts, t, 28) * 0.5;
    P.bloom *= 1 + pulse(T.bigKick || [], t, 10) * 0.25;
  }
  if (V.hud) drawHud(R, t, V);
  if (V.post) V.post(R, t);
}
