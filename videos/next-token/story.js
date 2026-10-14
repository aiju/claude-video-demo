'use strict';
// Story content and helpers shared by the Next Token scenes.

const PROMPT = 'The meaning of life is';
const PROMPT_TOKENS = [
  { text: 'The', id: 464 },
  { text: ' meaning', id: 3616 },
  { text: ' of', id: 286 },
  { text: ' life', id: 1204 },
  { text: ' is', id: 318 },
];
const CANDIDATES = [
  { text: ' to', p: 0.47 },
  { text: ' 42', p: 0.21 },
  { text: ' love', p: 0.12 },
  { text: ' unknown', p: 0.06 },
  { text: ' a', p: 0.04 },
];
const GENERATED = [' to', ' predict', ' the', ' next', ' token', '.'];
const APPEND_TIMES = [52.0, 52.5, 53.0, 53.5, 54.0, 54.5];

const TOKEN_COLS = [COL.cyan, COL.violet, COL.magenta, COL.amber, COL.mint];
const HEAD_COLS = [COL.cyan, COL.magenta, COL.amber, COL.violet, COL.mint, COL.blue, COL.coral, COL.pink];
const GEN_COL = COL.gold;

// Tokens show their leading space as a dimmed "·".
const tokenLabel = (text) => (text.startsWith(' ') ? '·' + text.slice(1) : text);
function tokChip(R, text, p, size, col, a = 1, o = {}) { return drawChip(R, tokenLabel(text), p, size, col, a, Object.assign({ dimFirst: text.startsWith(' ') }, o)); }
function tokChipRow(R, texts, size, gap) { return chipRow(R, texts.map(tokenLabel), size, gap); }

// Pseudo attention weights: causal, softmax-normalised, a distinct pattern per head.
function attnWeights(head, q, wobble = 0) {
  const raw = [];
  for (let k = 0; k <= q; k++) {
    let s = hash3(head, q, k) * 1.5;
    if (head % 4 === 0) s += k === q - 1 ? 3 : 0;          // previous-token head
    if (head % 4 === 1) s += k === 0 ? 3 : 0;              // first-token head
    if (head % 4 === 2) s += (q === 3 && k === 1) || (q === 4 && k === 3) ? 3.2 : 0; // semantic head
    if (head % 4 === 3) s += k === q ? 2.5 : 0;            // self head
    s += Math.sin(wobble * 3 + head * 1.7 + k * 2.1 + q) * wobble * 0.8;
    raw.push(s * 1.4);
  }
  const mx = Math.max(...raw), ex = raw.map((v) => Math.exp(v - mx)), z = ex.reduce((a, b) => a + b, 0);
  return ex.map((v) => v / z);
}

// The sampling wheel: wedges sized by probability (plus "everything else").
const WHEEL_P = CANDIDATES.map((c) => c.p).concat([1 - CANDIDATES.reduce((a, c) => a + c.p, 0)]);
const WHEEL_BOUNDS = WHEEL_P.map((_, i) => WHEEL_P.slice(0, i).reduce((a, b) => a + b, 0));
const WHEEL_LAND = 0.11; // lands just inside the winning wedge
function wheelTurns(t) {
  const u = clamp((t - 49) / 2);
  return (3 + WHEEL_LAND) * (1 - (1 - u) ** 3);
}
function wheelWedge(a) {
  const f = fract(a);
  let j = 0;
  for (let i = 0; i < WHEEL_BOUNDS.length; i++) if (f >= WHEEL_BOUNDS[i]) j = i;
  return j;
}
