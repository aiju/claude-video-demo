'use strict';
// Renderer: immediate-mode batches (glow sprites, beams, SDF text) drawn into an
// HDR buffer over a procedural environment, then bloom + a filmic composite.

const GLSL_HEAD = '#version 300 es\nprecision highp float;\n';

const SPRITE_VS = GLSL_HEAD + `
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iPosSize;
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iParams; // shape, rotation, stretch, extra
uniform mat4 uView, uProj;
out vec2 vUV; out vec4 vColor; flat out float vShape; flat out float vStretch; flat out float vExtra;
void main() {
  vec4 vp = uView * vec4(iPosSize.xyz, 1.0);
  float c = cos(iParams.y), s = sin(iParams.y);
  vec2 corner = aCorner * vec2(iParams.z, 1.0);
  vp.xy += mat2(c, s, -s, c) * corner * iPosSize.w;
  gl_Position = uProj * vp;
  vUV = aCorner; vColor = iColor; vShape = iParams.x; vStretch = iParams.z; vExtra = iParams.w;
}`;

const SPRITE_FS = GLSL_HEAD + `
in vec2 vUV; in vec4 vColor; flat in float vShape; flat in float vStretch; flat in float vExtra;
out vec4 o;
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 uv = vUV; float r = length(uv); float a = 0.0;
  int s = int(vShape + 0.5);
  if (s == 0) {          // soft glow orb with a hot core
    a = exp(-r * r * 7.0) * 0.55 + smoothstep(0.32, 0.0, r) * 0.9;
    a *= smoothstep(1.0, 0.75, r);
  } else if (s == 1) {   // ring
    float d = abs(r - 0.78);
    float px = fwidth(r);
    a = smoothstep(0.05 + px, 0.03, d) + exp(-d * d * 90.0) * 0.5;
    a *= smoothstep(1.0, 0.9, r);
  } else if (s == 2) {   // rounded cell / bar
    vec2 b = vec2(vStretch, 1.0);
    vec2 p = uv * b;
    float d = sdRoundBox(p, b - 0.18, min(0.16, vStretch * 0.5));
    float px = fwidth(d);
    a = smoothstep(px, -px, d) * 0.9 + exp(-max(d, 0.0) * 14.0) * 0.3;
    a *= smoothstep(0.0, -0.03, sdRoundBox(p, b, 0.0));
  } else if (s == 3) {   // crisp disc
    float px = fwidth(r);
    a = smoothstep(1.0, 1.0 - px * 1.5, r);
  } else if (s == 4) {   // lens flare star
    a = exp(-r * r * 18.0) * 1.3
      + (exp(-abs(uv.y) * 40.0) * exp(-abs(uv.x) * 2.5) + exp(-abs(uv.x) * 40.0) * exp(-abs(uv.y) * 2.5)) * 0.9;
    a *= smoothstep(1.0, 0.6, r);
  } else if (s == 5) {   // rounded-rect outline (chip)
    vec2 b = vec2(vStretch, 1.0);
    vec2 p = uv * b;
    float d = sdRoundBox(p, b - 0.22, 0.32);
    float px = fwidth(d);
    a = smoothstep(px * 1.5, 0.0, abs(d) - 0.015) + exp(-abs(d) * 14.0) * 0.4 + step(d, 0.0) * 0.05;
    a *= smoothstep(0.0, -0.04, sdRoundBox(p, b, 0.0));
  } else if (s == 6) {   // rounded-rect solid fill
    vec2 b = vec2(vStretch, 1.0);
    vec2 p = uv * b;
    float d = sdRoundBox(p, b - 0.22, 0.32);
    float px = fwidth(d);
    a = smoothstep(px, -px, d);
  } else {               // 7: horizontal streak
    a = exp(-uv.y * uv.y * 30.0) * (1.0 - abs(uv.x)) ;
  }
  o = vec4(vColor.rgb * vColor.a * a, vColor.a * a);
}`;

const LINE_VS = GLSL_HEAD + `
layout(location=0) in vec2 aCorner; // x: 0/1 along, y: -1/1 across
layout(location=1) in vec4 iA;      // xyz, width
layout(location=2) in vec4 iB;
layout(location=3) in vec4 iColA;
layout(location=4) in vec4 iColB;
uniform mat4 uView, uProj; uniform vec2 uRes;
out vec4 vColor; out vec3 vSeg; // along px, across px, length px
flat out float vW;
void main() {
  vec4 ca = uProj * uView * vec4(iA.xyz, 1.0);
  vec4 cb = uProj * uView * vec4(iB.xyz, 1.0);
  const float eps = 0.02;
  if (ca.w < eps && cb.w < eps) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < eps) ca = mix(ca, cb, (eps - ca.w) / (cb.w - ca.w));
  if (cb.w < eps) cb = mix(cb, ca, (eps - cb.w) / (ca.w - cb.w));
  vec2 h = uRes * 0.5;
  vec2 sa = ca.xy / ca.w * h, sb = cb.xy / cb.w * h;
  vec2 d = sb - sa; float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float t = aCorner.x;
  vec4 c = mix(ca, cb, t);
  float wpx = iA.w * uProj[1][1] * h.y / c.w;
  float fade = clamp(wpx / 1.2, 0.0, 1.0);
  wpx = max(wpx, 1.2);
  vec2 s = mix(sa, sb, t) + nrm * aCorner.y * wpx + dir * (t * 2.0 - 1.0) * wpx;
  gl_Position = vec4(s / h, clamp(c.z / c.w, -1.0, 1.0), 1.0);
  vColor = mix(iColA, iColB, t); vColor.a *= fade;
  vSeg = vec3(t * len + (t * 2.0 - 1.0) * wpx, aCorner.y * wpx, len);
  vW = wpx;
}`;

const LINE_FS = GLSL_HEAD + `
in vec4 vColor; in vec3 vSeg; flat in float vW;
out vec4 o;
void main() {
  float dx = max(0.0, max(-vSeg.x, vSeg.x - vSeg.z));
  float d = length(vec2(dx, vSeg.y)) / vW;
  float a = exp(-d * d * 4.0) * 0.7 + smoothstep(0.45, 0.1, d) * 0.6;
  a *= smoothstep(1.0, 0.85, d);
  o = vec4(vColor.rgb * vColor.a * a, vColor.a * a);
}`;

const GLYPH_VS = GLSL_HEAD + `
layout(location=0) in vec2 aCorner; // 0..1
layout(location=1) in vec4 iAnchor; // xyz, em size
layout(location=2) in vec4 iRect;   // x0, y0 (bottom-left in em), w, h
layout(location=3) in vec4 iUV;
layout(location=4) in vec4 iColor;
layout(location=5) in vec4 iParams; // glow, bias, rotation, hot
uniform mat4 uView, uProj;
out vec2 vUV; out vec4 vColor; flat out vec4 vParams;
void main() {
  vec4 vp = uView * vec4(iAnchor.xyz, 1.0);
  vec2 local = iRect.xy + aCorner * iRect.zw;
  vec2 ctr = iRect.xy + 0.5 * iRect.zw;
  float c = cos(iParams.z), s = sin(iParams.z);
  local = ctr + mat2(c, s, -s, c) * (local - ctr);
  vp.xy += local * iAnchor.w;
  gl_Position = uProj * vp;
  vUV = vec2(mix(iUV.x, iUV.z, aCorner.x), mix(iUV.w, iUV.y, aCorner.y));
  vColor = iColor; vParams = iParams;
}`;

const GLYPH_FS = GLSL_HEAD + `
uniform sampler2D uAtlas; uniform float uEdge;
in vec2 vUV; in vec4 vColor; flat in vec4 vParams;
out vec4 o;
void main() {
  float d = texture(uAtlas, vUV).r;
  float w = max(fwidth(d) * 0.7, 1e-3);
  float e = uEdge - vParams.y;
  float fill = smoothstep(e - w, e + w, d);
  float g = smoothstep(0.0, e, d);
  float glow = g * g * g * vParams.x;
  vec3 col = mix(vColor.rgb, vec3(dot(vColor.rgb, vec3(0.33))) + vColor.rgb * 0.5, vParams.w) * fill + vColor.rgb * glow;
  o = vec4(col * vColor.a, fill * vColor.a);
}`;

const FS_TRI_VS = GLSL_HEAD + `
out vec2 vUV;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUV = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const NOISE_GLSL = `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;

const ENV_FS = GLSL_HEAD + NOISE_GLSL + `
in vec2 vUV; out vec4 o;
uniform vec3 uCamPos, uCamRight, uCamUp, uCamFwd; uniform vec2 uTan;
uniform float uTime;
uniform vec3 uBaseA, uBaseB;
uniform float uNebula; uniform vec3 uNebA, uNebB; uniform float uStars;
uniform float uGrid, uGridY, uGridCell, uGridFog, uGridScroll; uniform vec3 uGridColor;
uniform float uHorizon; uniform vec3 uHorizonColor;
uniform float uTunnel, uTunnelR, uTunnelZ; uniform vec3 uTunnelA, uTunnelB;
vec3 nebula(vec3 rd) {
  vec3 p = rd * 2.1 + vec3(0.0, 0.0, uTime * 0.01);
  float w = fbm(p * 1.4 + 3.0);
  float n = fbm(p + w * 1.9);
  float m = smoothstep(0.38, 0.9, n);
  vec3 c = mix(uNebA, uNebB, smoothstep(0.35, 0.68, w));
  return c * (m * m * 1.6 + n * 0.06);
}
float stars(vec3 rd, float scale, float thr) {
  vec3 p = rd * scale; vec3 id = floor(p); vec3 f = fract(p) - 0.5;
  float h = hash13(id);
  vec3 off = vec3(hash13(id + 7.1), hash13(id + 3.3), hash13(id + 1.7)) - 0.5;
  float d = length(f - off * 0.6);
  float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
  return step(thr, h) * smoothstep(0.22, 0.0, d) * tw * (h - thr) / (1.0 - thr);
}
void main() {
  vec2 ndc = vUV * 2.0 - 1.0;
  vec3 rd = normalize(uCamFwd + ndc.x * uTan.x * uCamRight + ndc.y * uTan.y * uCamUp);
  vec3 ro = uCamPos;
  vec3 col = mix(uBaseB, uBaseA, smoothstep(-0.6, 0.6, rd.y));
  if (uNebula > 0.001) col += nebula(rd) * uNebula;
  if (uStars > 0.001) col += vec3(0.8, 0.9, 1.0) * (stars(rd, 140.0, 0.9) * 2.5 + stars(rd, 260.0, 0.85) * 1.2) * uStars;
  if (uHorizon > 0.001) col += uHorizonColor * exp(-abs(rd.y + 0.02) * 14.0) * uHorizon;
  if (uGrid > 0.001 && rd.y < -0.0005) {
    float t = (uGridY - ro.y) / rd.y;
    if (t > 0.0) {
      vec3 p = ro + rd * t;
      vec2 g = vec2(p.x, p.z + uGridScroll) / uGridCell;
      vec2 gw = fwidth(g);
      vec2 gd = abs(fract(g - 0.5) - 0.5);
      vec2 l = 1.0 - clamp(gd / (gw * 1.5), 0.0, 1.0);
      float line = max(l.x, l.y) * (1.0 - smoothstep(0.15, 0.6, max(gw.x, gw.y)));
      float glow = exp(-min(gd.x, gd.y) * 10.0) * 0.18;
      float fog = exp(-t * uGridFog);
      col += uGridColor * (line + glow) * fog * uGrid;
    }
  }
  if (uTunnel > 0.001) {
    vec2 rd2 = rd.xy; vec2 ro2 = ro.xy;
    float a = dot(rd2, rd2), b = dot(ro2, rd2), c = dot(ro2, ro2) - uTunnelR * uTunnelR;
    float disc = b * b - a * c;
    if (disc > 0.0 && a > 1e-6) {
      float t = (-b + sqrt(disc)) / a;
      vec3 p = ro + rd * t;
      float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
      float lanes = 64.0;
      float li = floor(ang * lanes), lf = fract(ang * lanes);
      float h = hash11(li + 1.0);
      float z = (p.z - uTunnelZ) * (0.025 + 0.03 * h) + h * 7.0;
      float dash = smoothstep(0.0, 0.08, fract(z)) * smoothstep(0.6, 0.1, fract(z));
      float lane = smoothstep(0.5, 0.05, abs(lf - 0.5));
      float ring = exp(-abs(fract((p.z - uTunnelZ) / 18.0) - 0.5) * 60.0) * 0.4;
      float fog = exp(-t * 0.012);
      vec3 tc = mix(uTunnelA, uTunnelB, h);
      col += tc * (dash * lane * (0.4 + h) + ring) * fog * uTunnel;
    }
  }
  o = vec4(col, 1.0);
}`;

const DOWN_FS = GLSL_HEAD + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThreshold, uKnee; uniform int uPrefilter;
vec3 s(vec2 off) { return texture(uTex, vUV + off * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter == 1) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    col *= max(soft, br - uThreshold) / max(br, 1e-4);
    col = min(col, vec3(40.0));
  }
  o = vec4(col, 1.0);
}`;

const UP_FS = GLSL_HEAD + `
in vec2 vUV; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uScatter;
void main() {
  vec4 d = uTexel.xyxy * vec4(1.0, 1.0, -1.0, 0.0);
  vec3 s = texture(uTex, vUV - d.xy).rgb + texture(uTex, vUV - d.wy).rgb * 2.0 + texture(uTex, vUV - d.zy).rgb
         + texture(uTex, vUV + d.zw).rgb * 2.0 + texture(uTex, vUV).rgb * 4.0 + texture(uTex, vUV + d.xw).rgb * 2.0
         + texture(uTex, vUV + d.zy).rgb + texture(uTex, vUV + d.wy).rgb * 2.0 + texture(uTex, vUV + d.xy).rgb;
  o = vec4(s / 16.0 * uScatter, 1.0);
}`;

const COMPOSITE_FS = GLSL_HEAD + `
in vec2 vUV; out vec4 o;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes; uniform float uTime;
uniform float uBloomStr, uExposure, uAberr, uGlitch, uFlash, uFade, uGrain, uVignette, uSat, uScan, uDistort, uContrast;
uniform vec3 uFlashColor, uTint;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv = vUV;
  float gt = floor(uTime * 24.0);
  if (uGlitch > 0.0) {
    float band = floor(uv.y * 18.0 + hash12(vec2(gt, 3.0)) * 4.0);
    float h = hash12(vec2(band, gt));
    if (h < uGlitch * 0.5) uv.x += (hash12(vec2(band * 3.1, gt + 1.0)) - 0.5) * 0.12 * uGlitch;
    float blk = hash12(floor(uv * vec2(12.0, 30.0)) + gt);
    if (blk < uGlitch * 0.06) uv = fract(uv + vec2(hash12(vec2(gt, blk)) * 0.2, 0.0));
  }
  vec2 dc = uv - 0.5;
  float r2 = dot(dc, dc);
  uv = 0.5 + dc * (1.0 - uDistort * r2);
  vec2 ab = dc * (uAberr * (0.4 + r2 * 3.0) + uGlitch * 0.012);
  vec3 col;
  col.r = texture(uScene, uv + ab).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - ab).b;
  vec3 bl;
  bl.r = texture(uBloom, uv + ab * 1.5).r;
  bl.g = texture(uBloom, uv).g;
  bl.b = texture(uBloom, uv - ab * 1.5).b;
  col += bl * uBloomStr;
  col *= uExposure * uTint;
  col += uFlashColor * max(uFlash - 1.0, 0.0); // only very strong flashes push into HDR
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0) * 0.85);
  col = mix(vec3(0.5), col, uContrast);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col *= 1.0 - uVignette * smoothstep(0.25, 0.95, length(dc * vec2(1.0, 0.85)) * 1.35);
  col *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 1.7));
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.13) * 500.0) - 0.5) * uGrain;
  col *= 1.0 - uFade;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const SPRITE_LAYOUT = [[1, 4], [2, 4], [3, 4]];
const LINE_LAYOUT = [[1, 4], [2, 4], [3, 4], [4, 4]];
const GLYPH_LAYOUT = [[1, 4], [2, 4], [3, 4], [4, 4], [5, 4]];
const QUAD_CENTERED = [-1, -1, 1, -1, -1, 1, 1, 1];
const QUAD_LINE = [0, -1, 1, -1, 0, 1, 1, 1];
const QUAD_UNIT = [0, 0, 1, 0, 0, 1, 1, 1];

// HUD space is a fixed 16:9 box: x in [-8, 8], y in [-4.5, 4.5].
const HUD_W = 8, HUD_H = 4.5;

class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    gl.__hasFloat = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.canvas = canvas;
    this.progs = {
      sprite: glProgram(gl, SPRITE_VS, SPRITE_FS, 'sprite'),
      line: glProgram(gl, LINE_VS, LINE_FS, 'line'),
      glyph: glProgram(gl, GLYPH_VS, GLYPH_FS, 'glyph'),
      env: glProgram(gl, FS_TRI_VS, ENV_FS, 'env'),
      down: glProgram(gl, FS_TRI_VS, DOWN_FS, 'down'),
      up: glProgram(gl, FS_TRI_VS, UP_FS, 'up'),
      comp: glProgram(gl, FS_TRI_VS, COMPOSITE_FS, 'composite'),
    };
    this.emptyVAO = gl.createVertexArray();
    const mkLayer = (name, hud, blend) => ({
      name, hud, blend,
      sprites: new InstanceBatch(gl, SPRITE_LAYOUT, QUAD_CENTERED),
      lines: new InstanceBatch(gl, LINE_LAYOUT, QUAD_LINE),
      glyphs: new InstanceBatch(gl, GLYPH_LAYOUT, QUAD_UNIT),
    });
    // Draw order. 'under'/'over'/'hudUnder' are alpha-blended panels; the rest add light.
    this.layers = {
      under: mkLayer('under', false, 'alpha'),
      add: mkLayer('add', false, 'add'),
      over: mkLayer('over', false, 'alpha'),
      top: mkLayer('top', false, 'add'),
      hudUnder: mkLayer('hudUnder', true, 'alpha'),
      hud: mkLayer('hud', true, 'add'),
    };
    this.order = ['under', 'add', 'over', 'top', 'hudUnder', 'hud'];
    this.cur = this.layers.add;
    this.hudView = mat4Identity();
    this.hudProj = mat4Ortho(-HUD_W, HUD_W, -HUD_H, HUD_H, -10, 10);
    this.atlas = null;
    this.w = this.h = 0;
    this.resetFrameState();
  }

  setAtlas(atlas) { this.atlas = atlas; }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    this.w = w; this.h = h;
    this.canvas.width = w; this.canvas.height = h;
    glDeleteTarget(gl, this.scene);
    (this.mips || []).forEach((m) => glDeleteTarget(gl, m));
    this.scene = glTarget(gl, w, h);
    this.mips = [];
    let mw = w >> 1, mh = h >> 1;
    for (let i = 0; i < 6 && mw >= 4 && mh >= 4; i++) {
      this.mips.push(glTarget(gl, mw, mh));
      mw >>= 1; mh >>= 1;
    }
  }

  resetFrameState() {
    for (const k in this.layers || {}) { const L = this.layers[k]; L.sprites.count = L.lines.count = L.glyphs.count = 0; }
    this.env = {
      baseA: [0.004, 0.005, 0.012], baseB: [0.0, 0.0, 0.002],
      nebula: 0, nebA: hex('#3a1c71'), nebB: hex('#0f6e8c'), stars: 0,
      grid: 0, gridY: -2, gridCell: 1, gridFog: 0.06, gridScroll: 0, gridColor: hex('#00d5ff', 1.0),
      horizon: 0, horizonColor: hex('#ff2e88'),
      tunnel: 0, tunnelR: 9, tunnelZ: 0, tunnelA: hex('#00e5ff'), tunnelB: hex('#ff3d9a'),
    };
    this.post = {
      bloom: 0.85, threshold: 1.0, knee: 0.6, scatter: 0.62, exposure: 1.0, aberr: 0.003, glitch: 0,
      flash: 0, flashColor: [1, 1, 1], fade: 0, grain: 0.035, vignette: 0.45, sat: 1.12, scan: 0.04,
      distort: 0.06, contrast: 1.04, tint: [1, 1, 1],
    };
    this.cam = { pos: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0], fov: 50 };
    this.cur = this.layers.add;
  }

  use(name) { this.cur = this.layers[name]; return this; }

  setCamera(pos, target, up = [0, 1, 0], fov = 50) {
    this.cam = { pos, target, up, fov };
  }

  // --- immediate-mode primitives -------------------------------------------------
  // color: linear rgb (may exceed 1 for bloom); a: opacity multiplier.
  sprite(p, size, color, a = 1, shape = 0, rot = 0, stretch = 1, extra = 0) {
    if (a <= 0.001 || size <= 0) return;
    const b = this.cur.sprites, o = b.alloc(), d = b.data;
    d[o] = p[0]; d[o + 1] = p[1]; d[o + 2] = p[2]; d[o + 3] = size;
    d[o + 4] = color[0]; d[o + 5] = color[1]; d[o + 6] = color[2]; d[o + 7] = a;
    d[o + 8] = shape; d[o + 9] = rot; d[o + 10] = stretch; d[o + 11] = extra;
  }
  line(pa, pb, ca, cb, width, aa = 1, ab = aa) {
    if (aa <= 0.001 && ab <= 0.001) return;
    const b = this.cur.lines, o = b.alloc(), d = b.data;
    d[o] = pa[0]; d[o + 1] = pa[1]; d[o + 2] = pa[2]; d[o + 3] = width;
    d[o + 4] = pb[0]; d[o + 5] = pb[1]; d[o + 6] = pb[2]; d[o + 7] = 0;
    d[o + 8] = ca[0]; d[o + 9] = ca[1]; d[o + 10] = ca[2]; d[o + 11] = aa;
    d[o + 12] = cb[0]; d[o + 13] = cb[1]; d[o + 14] = cb[2]; d[o + 15] = ab;
  }
  // Polyline through points with alpha fading from a0 to a1.
  polyline(pts, color, width, a0 = 1, a1 = 1, color1 = color) {
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
      this.line(pts[i], pts[i + 1], cmix(color, color1, t0), cmix(color, color1, t1), width, mix(a0, a1, t0), mix(a0, a1, t1));
    }
  }
  measure(str, font = 'mono', tracking = 0) {
    let w = 0;
    for (const ch of str) {
      const g = this.atlas.get(font, ch);
      w += (g ? g.adv : 0.6) + tracking;
    }
    return Math.max(0, w - tracking);
  }
  // Billboarded SDF text. Options: font, align (-1/0/1), glow, tracking, bias, hot, fx(i, ch, s).
  text(str, p, size, color, o = {}) {
    if (!this.atlas || (o.alpha ?? 1) <= 0.001) return 0;
    const font = o.font || 'mono', tracking = o.tracking || 0, glow = o.glow ?? 0.6;
    const alpha = o.alpha ?? 1, bias = o.bias || 0, hot = o.hot ?? 0.25;
    const chars = Array.from(str);
    const total = this.measure(str, font, tracking);
    let pen = o.align === -1 ? 0 : o.align === 1 ? -total : -total / 2;
    const vy = o.valign ?? -0.36; // centre on cap height
    const b = this.cur.glyphs;
    const s = this._fxs || (this._fxs = {});
    for (let i = 0; i < chars.length; i++) {
      let ch = chars[i];
      const base = this.atlas.get(font, ch);
      const adv = base ? base.adv : 0.6;
      s.ch = ch; s.dx = 0; s.dy = 0; s.dz = 0; s.scale = 1; s.alpha = 1; s.color = color; s.rot = 0; s.glow = glow;
      if (o.fx) o.fx(i, ch, s, chars.length);
      ch = s.ch;
      const g = ch === ' ' ? null : (this.atlas.get(font, ch) || base);
      if (g && s.alpha > 0.001 && s.scale > 0) {
        const off = b.alloc(), d = b.data;
        const sc = s.scale;
        // Scale each glyph about its own centre so per-char animation stays in place.
        const cx = pen + adv / 2;
        d[off] = p[0]; d[off + 1] = p[1]; d[off + 2] = p[2] + s.dz; d[off + 3] = size;
        d[off + 4] = cx + (g.x0 - g.adv / 2) * sc + s.dx; d[off + 5] = vy + 0.36 + (g.y1 - g.h - 0.36) * sc + s.dy;
        d[off + 6] = g.w * sc; d[off + 7] = g.h * sc;
        d[off + 8] = g.u0; d[off + 9] = g.v0; d[off + 10] = g.u1; d[off + 11] = g.v1;
        d[off + 12] = s.color[0]; d[off + 13] = s.color[1]; d[off + 14] = s.color[2]; d[off + 15] = alpha * s.alpha;
        d[off + 16] = s.glow; d[off + 17] = bias; d[off + 18] = s.rot; d[off + 19] = hot;
      }
      pen += adv + tracking;
    }
    return total * size;
  }

  // --- frame ---------------------------------------------------------------------
  render(time) {
    const gl = this.gl, P = this.progs, w = this.w, h = this.h;
    const aspect = w / h;
    const cam = this.cam;
    const view = mat4LookAt(cam.pos, cam.target, cam.up);
    const proj = mat4Perspective((cam.fov * Math.PI) / 180, aspect, 0.05, 600);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    // Environment.
    const fwd = vnorm(vsub(cam.target, cam.pos));
    let right = vcross(fwd, cam.up);
    if (vlen(right) < 1e-6) right = [1, 0, 0];
    right = vnorm(right);
    const up = vcross(right, fwd);
    const tanY = Math.tan((cam.fov * Math.PI) / 360);
    const E = this.env;
    P.env.use().set({
      uCamPos: cam.pos, uCamRight: right, uCamUp: up, uCamFwd: fwd, uTan: [tanY * aspect, tanY], uTime: time,
      uBaseA: E.baseA, uBaseB: E.baseB, uNebula: E.nebula, uNebA: E.nebA, uNebB: E.nebB, uStars: E.stars,
      uGrid: E.grid, uGridY: E.gridY, uGridCell: E.gridCell, uGridFog: E.gridFog, uGridScroll: E.gridScroll, uGridColor: E.gridColor,
      uHorizon: E.horizon, uHorizonColor: E.horizonColor,
      uTunnel: E.tunnel, uTunnelR: E.tunnelR, uTunnelZ: E.tunnelZ, uTunnelA: E.tunnelA, uTunnelB: E.tunnelB,
    });
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Batched layers.
    if (this.atlas) this.atlas.flush();
    gl.enable(gl.BLEND);
    for (const name of this.order) {
      const L = this.layers[name];
      if (L.blend === 'add') gl.blendFunc(gl.ONE, gl.ONE);
      else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const V = L.hud ? this.hudView : view, Pm = L.hud ? this.hudProj : proj;
      if (L.sprites.count) { P.sprite.use().set({ uView: V, uProj: Pm }); L.sprites.draw(); }
      if (L.lines.count) { P.line.use().set({ uView: V, uProj: Pm, uRes: [w, h] }); L.lines.draw(); }
      if (L.glyphs.count) { P.glyph.use().set({ uView: V, uProj: Pm, uAtlas: this.atlas.tex, uEdge: SDF_EDGE }); L.glyphs.draw(); }
    }

    // Bloom.
    const po = this.post;
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVAO);
    let src = this.scene;
    for (let i = 0; i < this.mips.length; i++) {
      const dst = this.mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      P.down.use().set({ uTex: src.tex, uTexel: [1 / src.w, 1 / src.h], uThreshold: po.threshold, uKnee: po.knee, uPrefilter: i === 0 ? 1 : 0 });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i], dst = this.mips[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      P.up.use().set({ uTex: s.tex, uTexel: [1 / s.w, 1 / s.h], uScatter: po.scatter });
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // Composite to screen.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    P.comp.use().set({
      uScene: this.scene.tex, uBloom: this.mips[0].tex, uRes: [w, h], uTime: time,
      uBloomStr: po.bloom, uExposure: po.exposure, uAberr: po.aberr, uGlitch: po.glitch, uFlash: po.flash,
      uFade: po.fade, uGrain: po.grain, uVignette: po.vignette, uSat: po.sat, uScan: po.scan, uDistort: po.distort,
      uContrast: po.contrast, uFlashColor: po.flashColor, uTint: po.tint,
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
}
