'use strict';
// Signed-distance-field glyph atlas built at startup from canvas-rendered fonts,
// so text stays crisp at any scale and can glow.

const FONT_STACKS = {
  mono: '"JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "IPAGothic", "WenQuanYi Zen Hei Mono", ui-monospace, Menlo, Consolas, monospace',
  disp: '"Unbounded", "JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "IPAGothic", system-ui, sans-serif',
};
const SDF_PX = 56;     // font size used for rasterising
const SDF_PAD = 12;    // padding / distance radius in px
const SDF_CUTOFF = 0.3; // edge value is 1 - cutoff
const SDF_EDGE = 1 - SDF_CUTOFF;

const INF = 1e20;
function edt1d(f, d, v, z, n) {
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1, k = 0; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}
function edt2d(grid, w, h) {
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, d, v, z, h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, d, v, z, w);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
}

// Build an atlas for {fontKey: {weight, chars}}. Returns {tex, glyphs: Map(key -> glyph)}.
function buildGlyphAtlas(gl, specs) {
  const ATLAS_W = 2048;
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const cellH = Math.ceil(SDF_PX * 1.32) + SDF_PAD * 2;
  const ascent = Math.ceil(SDF_PX * 0.98);

  // First pass: measure and pack.
  const items = [];
  let x = 0, y = 0;
  for (const fontKey in specs) {
    const { weight, chars } = specs[fontKey];
    const font = `${weight} ${SDF_PX}px ${FONT_STACKS[fontKey]}`;
    cx.font = font;
    for (const ch of new Set(Array.from(chars))) {
      const adv = cx.measureText(ch).width;
      const cellW = Math.ceil(adv) + SDF_PAD * 2;
      if (x + cellW > ATLAS_W) { x = 0; y += cellH; }
      items.push({ fontKey, font, ch, adv, cellW, x, y });
      x += cellW;
    }
  }
  const ATLAS_H = 1 << Math.ceil(Math.log2(y + cellH));
  const atlas = new Uint8Array(ATLAS_W * ATLAS_H);

  const glyphs = new Map();
  const maxW = Math.max(...items.map((i) => i.cellW));
  cv.width = maxW; cv.height = cellH;
  const size = maxW * cellH;
  const outer = new Float64Array(size), inner = new Float64Array(size);
  for (const it of items) {
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.font = it.font;
    cx.fillStyle = '#fff';
    cx.textBaseline = 'alphabetic';
    cx.fillText(it.ch, SDF_PAD, SDF_PAD + ascent);
    const img = cx.getImageData(0, 0, it.cellW, cellH).data;
    const w = it.cellW, h = cellH;
    for (let i = 0; i < w * h; i++) {
      const a = img[i * 4 + 3] / 255;
      if (a === 1) { outer[i] = 0; inner[i] = INF; }
      else if (a === 0) { outer[i] = INF; inner[i] = 0; }
      else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
    }
    edt2d(outer, w, h);
    edt2d(inner, w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
        const v = Math.round(255 - 255 * (d / SDF_PAD + SDF_CUTOFF));
        atlas[(it.y + py) * ATLAS_W + it.x + px] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    const s = 1 / SDF_PX;
    glyphs.set(it.fontKey + it.ch, {
      adv: it.adv * s,
      // Quad in em units relative to the pen position on the baseline (y up).
      x0: -SDF_PAD * s, y1: (SDF_PAD + ascent) * s, w: it.cellW * s, h: cellH * s,
      u0: it.x / ATLAS_W, v0: it.y / ATLAS_H, u1: (it.x + it.cellW) / ATLAS_W, v1: (it.y + cellH) / ATLAS_H,
    });
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, ATLAS_W, ATLAS_H, 0, gl.RED, gl.UNSIGNED_BYTE, atlas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { tex, glyphs, size: [ATLAS_W, ATLAS_H] };
}

const SCRAMBLE_CHARS = '01<>/\\|#%&*+=-ABCDEFGHJKLMNPQRSTUVWXYZ0123456789{}[]$@';
