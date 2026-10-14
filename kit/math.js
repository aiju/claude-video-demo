'use strict';
// Small math toolkit: vectors, matrices, easing, deterministic noise.

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const fract = (x) => x - Math.floor(x);
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
// Map x from [a,b] to [0,1], clamped.
const range = (x, a, b) => clamp((x - a) / (b - a));
const sstep = (a, b, x) => smooth(range(x, a, b));

const ease = {
  inQuad: (t) => clamp(t) ** 2,
  outQuad: (t) => 1 - (1 - clamp(t)) ** 2,
  inCubic: (t) => clamp(t) ** 3,
  outCubic: (t) => 1 - (1 - clamp(t)) ** 3,
  inOutCubic: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; },
  outExpo: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  inExpo: (t) => { t = clamp(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
  inOutExpo: (t) => {
    t = clamp(t);
    if (t === 0 || t === 1) return t;
    return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  outBack: (t, s = 1.70158) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; },
  outElastic: (t) => {
    t = clamp(t);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
};

// Deterministic hashing / RNG -------------------------------------------------
function hash1(n) {
  // Integer-ish hash to [0,1).
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
const hash2 = (a, b) => hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
const hash3 = (a, b, c) => hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rng) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// Smooth 1D value noise, deterministic, range ~[-1,1].
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, seed) * 2 - 1, b = hash2(i + 1, seed) * 2 - 1;
  return mix(a, b, f * f * (3 - 2 * f));
}

// Vectors (plain arrays) -------------------------------------------------------
const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vscale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vlerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
const vnorm = (a) => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
function rotZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
function bezier3(a, b, c, t) {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]];
}

// Colors -----------------------------------------------------------------------
function hex(h, k = 1) {
  const n = parseInt(h.replace('#', ''), 16);
  // sRGB -> linear so that additive blending and tonemapping behave.
  const lin = (c) => Math.pow(c / 255, 2.2) * k;
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}
const cmul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const cmix = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// Matrices (column-major Float32Array(16)) --------------------------------------
function mat4Perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
  return m;
}
function mat4Ortho(l, r, b, t, n, f) {
  const m = new Float32Array(16);
  m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1;
  return m;
}
function mat4LookAt(eye, target, up) {
  const z = vnorm(vsub(eye, target));
  let x = vcross(up, z);
  if (vlen(x) < 1e-6) x = vcross([0, 0, 1], z);
  x = vnorm(x);
  const y = vcross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[1] = y[0]; m[2] = z[0];
  m[4] = x[1]; m[5] = y[1]; m[6] = z[1];
  m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
  m[12] = -vdot(x, eye); m[13] = -vdot(y, eye); m[14] = -vdot(z, eye); m[15] = 1;
  return m;
}
function mat4Identity() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }

// Sorted-event helpers (used to sync visuals to the music score) ---------------
// Index of the last element <= t, or -1.
function lastIndex(arr, t) {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= t) { ans = m; lo = m + 1; } else hi = m - 1;
  }
  return ans;
}
// Exponential decay since the most recent event.
function pulse(arr, t, decay = 8) {
  const i = lastIndex(arr, t);
  return i < 0 ? 0 : Math.exp(-(t - arr[i]) * decay);
}

// 1 inside [t0, t1], with smooth fades of length fi / fo at the edges.
function win(t, t0, t1, fi = 0.25, fo = fi) { return sstep(t0, t0 + fi, t) * (1 - sstep(t1 - fo, t1, t)); }

// Monotone cubic interpolation through (xs, ys): for camera paths that must hit
// exact positions at exact (musical) times without overshooting.
function monotoneSpline(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], u = (x - xs[i]) / h;
    const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}
