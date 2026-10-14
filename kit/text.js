'use strict';
// Signed-distance-field glyph atlas. Glyphs are rasterised from web fonts the
// first time they are used, so any character (CJK, symbols, emoji-free Unicode)
// just works; text stays crisp at any scale and can glow.

const FONT_STACKS = {
  mono: { weight: 700, stack: '"JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "IPAGothic", "WenQuanYi Zen Hei Mono", ui-monospace, Menlo, Consolas, monospace' },
  disp: { weight: 800, stack: '"Unbounded", "JetBrains Mono", "Noto Sans JP", "Hiragino Sans", "IPAGothic", system-ui, sans-serif' },
};
const SDF_PX = 56;      // font size used for rasterising
const SDF_PAD = 12;     // padding / distance radius in px
const SDF_CUTOFF = 0.3; // edge value is 1 - cutoff
const SDF_EDGE = 1 - SDF_CUTOFF;
const SCRAMBLE_CHARS = '01<>/\\|#%&*+=-ABCDEFGHJKLMNPQRSTUVWXYZ0123456789{}[]$@';

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

class GlyphAtlas {
  constructor(gl, fonts = FONT_STACKS, size = 2048) {
    this.gl = gl; this.fonts = fonts; this.W = size; this.H = size;
    this.data = new Uint8Array(size * size);
    this.glyphs = new Map();
    this.cellH = Math.ceil(SDF_PX * 1.32) + SDF_PAD * 2;
    this.ascent = Math.ceil(SDF_PX * 0.98);
    this.x = 0; this.y = 0;
    this.dirty0 = Infinity; this.dirty1 = -1;
    this.cv = document.createElement('canvas');
    this.cx = this.cv.getContext('2d', { willReadFrequently: true });
    this.cv.width = 512; this.cv.height = this.cellH;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, this.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  font(key) { const f = this.fonts[key] || this.fonts.mono; return `${f.weight} ${SDF_PX}px ${f.stack}`; }
  preload(key, chars) { for (const ch of chars) this.get(key, ch); }
  // Glyph metrics in em units, rasterising on first use.
  get(key, ch) {
    const id = key + ch;
    let g = this.glyphs.get(id);
    if (g) return g;
    const cx = this.cx, font = this.font(key);
    cx.font = font;
    const adv = cx.measureText(ch).width;
    const w = Math.ceil(adv) + SDF_PAD * 2, h = this.cellH;
    if (this.x + w > this.W) { this.x = 0; this.y += h; }
    if (this.y + h > this.H) { console.warn('glyph atlas full'); return this.glyphs.get(key + '?') || null; }
    if (w > this.cv.width) this.cv.width = w;
    cx.clearRect(0, 0, this.cv.width, this.cv.height);
    cx.font = font; cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic';
    cx.fillText(ch, SDF_PAD, SDF_PAD + this.ascent);
    const img = cx.getImageData(0, 0, w, h).data;
    const outer = new Float64Array(w * h), inner = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = img[i * 4 + 3] / 255;
      if (a === 1) { outer[i] = 0; inner[i] = INF; }
      else if (a === 0) { outer[i] = INF; inner[i] = 0; }
      else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
    }
    edt2d(outer, w, h); edt2d(inner, w, h);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        const v = Math.round(255 - 255 * ((Math.sqrt(outer[i]) - Math.sqrt(inner[i])) / SDF_PAD + SDF_CUTOFF));
        this.data[(this.y + py) * this.W + this.x + px] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    const s = 1 / SDF_PX;
    g = {
      adv: adv * s, x0: -SDF_PAD * s, y1: (SDF_PAD + this.ascent) * s, w: w * s, h: h * s,
      u0: this.x / this.W, v0: this.y / this.H, u1: (this.x + w) / this.W, v1: (this.y + h) / this.H,
    };
    this.glyphs.set(id, g);
    this.dirty0 = Math.min(this.dirty0, this.y); this.dirty1 = Math.max(this.dirty1, this.y + h);
    this.x += w;
    return g;
  }
  // Upload rows touched since the last flush.
  flush() {
    if (this.dirty1 < 0) return;
    const gl = this.gl, y0 = this.dirty0, rows = this.dirty1 - y0;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, this.W, rows, gl.RED, gl.UNSIGNED_BYTE, this.data.subarray(y0 * this.W, (y0 + rows) * this.W));
    this.dirty0 = Infinity; this.dirty1 = -1;
  }
}
