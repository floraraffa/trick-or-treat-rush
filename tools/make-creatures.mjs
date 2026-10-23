// The team's creature drawings (art/creatures/, front views in a T-pose) → what the game builds its
// creature puppets from:
//   public/assets/monsters/<name>.webp   an atlas: on the left the drawing with its background cut away
//                                         (alpha; edge colours pushed outwards so no halo shows at the
//                                         cut), on the right, at half size, what each part looks like
//                                         from behind (hair, fur or cloth quilted from a swatch of the
//                                         drawing itself, blending into the drawing's colours at the edges;
//                                         limbs keep the drawing's own colours);
//   src/actors/creature-shapes.js        each body part traced off the cut-out. Heads, round bodies and
//                                         the ball are height grids: the part's true outline (holes filled)
//                                         puffed up as a union of spheres, the biggest ball that fits at
//                                         each point, so ears, cats and curls get their own thickness; the
//                                         grid's rim points sit exactly on the outline. Arms are horizontal
//                                         profiles (top and bottom per column); legs, necks, gowns and slim
//                                         bodies vertical ones (left and right per row).
//   node tools/make-creatures.mjs
// The part boxes below are in the drawings' own pixels; they only have to keep the parts apart.
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

// bg: how the background is told apart: 'grey' (a light checkerboard or white) or 'grow' (paper: grown from the
// borders while neighbouring colours stay close). Parts: blob [x0, y0, x1, y1, cx, cy, opts], h / v [x0, y0, x1, y1, opts].
// opts.back: the swatch [x0, y0, x1, y1] its back is quilted from (none: the drawing's own colours).
// thin: on a checkerboard, background lines thinner than about twice this are not followed (see background()).
const CREATURES = {
  catgirl: { src: 'catgirl.webp', bg: 'grow', parts: {
    head: ['blob', 240, 150, 790, 709, 490, 470, { back: [420, 250, 600, 380] }],
    neck: ['v', 488, 690, 538, 736],
    torso: ['v', 360, 716, 660, 1068, { back: [405, 930, 465, 1040] }],
    armL: ['h', 40, 700, 382, 765], armR: ['h', 642, 700, 990, 765],
    legL: ['v', 452, 1060, 512, 1412], legR: ['v', 512, 1060, 574, 1412] } },
  goggles: { src: 'goggles.webp', bg: 'grey', parts: {
    head: ['blob', 268, 118, 782, 566, 525, 360, { back: [330, 140, 540, 250] }], neck: ['v', 498, 560, 548, 618],
    torso: ['blob', 398, 600, 612, 846, 505, 720, { back: [500, 636, 556, 672] }], // (plain tin above the emblem)
    armL: ['h', 40, 602, 412, 652], armR: ['h', 598, 602, 990, 652],
    legL: ['v', 438, 840, 511, 1432], legR: ['v', 511, 840, 590, 1432], ball: ['blob', 695, 745, 790, 842, 740, 790] } },
  lips: { src: 'lips.webp', bg: 'grey', parts: {
    head: ['blob', 218, 8, 804, 376, 510, 200, { back: [250, 22, 780, 140] }], neck: ['v', 494, 366, 536, 438],
    torso: ['blob', 388, 424, 642, 618, 512, 515, { back: [425, 438, 470, 500] }],
    armL: ['h', 40, 418, 428, 472], armR: ['h', 594, 418, 988, 472], dress: ['v', 270, 606, 754, 1458] } },
  catman: { src: 'catman.webp', bg: 'grey', thin: 2, parts: {
    head: ['blob', 268, 120, 762, 516, 515, 330, { back: [345, 210, 465, 300] }],
    torso: ['v', 404, 512, 622, 930, { back: [418, 620, 478, 880] }],
    armL: ['h', 18, 498, 420, 568], armR: ['h', 600, 498, 1008, 568],
    legL: ['v', 404, 900, 510, 1472], legR: ['v', 510, 900, 616, 1472] } },
  longneck: { src: 'longneck.png', bg: 'grey', step: 3, open: 1, grid: 4, parts: {
    head: ['blob', 68, 8, 382, 206, 225, 110, { back: [150, 28, 290, 75] }], neck: ['v', 204, 196, 242, 352],
    torso: ['v', 166, 340, 282, 506, { back: [178, 456, 272, 500] }],
    armL: ['h', 0, 352, 182, 398], armR: ['h', 266, 352, 448, 398],
    legL: ['v', 118, 488, 226, 716], legR: ['v', 226, 488, 334, 716] } },
};

/**
 * Background mask (1 = background) by flood fill from the borders. On a checkerboard ('grey') the fill runs
 * through the background shrunk by `thin` pixels and then grows back only that far, so white whiskers or
 * hairs drawn across it can't carry it into a white face (the cat's blaze).
 */
function background(data, W, H, mode, thin = 0) {
  const bg = new Uint8Array(W * H), stack = [];
  const c = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const greyish = (i) => { const [r, g, b] = c(i); return Math.min(r, g, b) > 196 && Math.max(r, g, b) - Math.min(r, g, b) < 20; };
  const close = (i, j) => { const a = c(i), b = c(j); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 6 && (a[0] + a[1] + a[2]) / 3 > 150; };
  if (mode === 'grey') {
    const grey = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) grey[i] = greyish(i);
    const core = new Uint8Array(W * H); // greyish with greyish all round (off the image counts as background)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let ok = grey[y * W + x];
      for (let dy = -thin; dy <= thin && ok; dy++) for (let dx = -thin; dx <= thin; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && !grey[yy * W + xx]) { ok = 0; break; }
      }
      core[y * W + x] = ok;
    }
    for (let i = 0; i < W * H; i++) bg[i] = 0;
    for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
    for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
    const open = stack.filter((i) => core[i]);
    for (const i of open) bg[i] = 1;
    while (open.length) {
      const i = open.pop(), x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !bg[j] && core[j]) { bg[j] = 1; open.push(j); }
    }
    for (let k = 0; k < thin + 1; k++) { // grow back over the background's own edges, no further
      const add = [];
      for (let i = 0; i < W * H; i++) {
        if (bg[i] || !grey[i]) continue;
        const x = i % W, y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && bg[j]) { add.push(i); break; }
      }
      for (const i of add) bg[i] = 1;
    }
    enclosedBoard(data, W, H, bg, grey);
    return bg;
  }
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  for (const i of stack) bg[i] = 1;
  const open = [...stack];
  while (open.length) {
    const i = open.pop(), x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || bg[j]) continue;
      if (close(i, j)) { bg[j] = 1; open.push(j); }
    }
  }
  return bg;
}

/**
 * Pockets of checkerboard the border fill can't reach (between the goggles' leg rods): the board's two flat
 * tones are learnt from the background already found, and an enclosed pale patch made almost only of those
 * two tones, with plenty of each, is background too (white rods, fur and highlights have gradients).
 */
function enclosedBoard(data, W, H, bg, grey) {
  const lum = (i) => (data[i * 3] + data[i * 3 + 1] + data[i * 3 + 2]) / 3;
  const sample = [];
  for (let k = 0; k < 40000; k++) { const i = Math.floor(((k * 2654435761) >>> 0) % (W * H)); if (bg[i]) sample.push(i); }
  if (sample.length < 500) return;
  let lo = 200, hi = 255; // the two tones (2-means)
  for (let it = 0; it < 10; it++) {
    let a = 0, na = 0, b = 0, nb = 0;
    for (const i of sample) { const v = lum(i); if (Math.abs(v - lo) < Math.abs(v - hi)) { a += v; na++; } else { b += v; nb++; } }
    if (na) lo = a / na;
    if (nb) hi = b / nb;
  }
  if (hi - lo < 8) return; // plain white: no board
  const tol = Math.min(7, (hi - lo) / 3);
  const seen = new Uint8Array(W * H);
  for (let s0 = 0; s0 < W * H; s0++) {
    if (seen[s0] || bg[s0] || !grey[s0]) continue;
    const comp = [s0];
    seen[s0] = 1;
    for (let h = 0; h < comp.length; h++) {
      const i = comp[h], x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && !seen[j] && !bg[j] && grey[j]) { seen[j] = 1; comp.push(j); }
    }
    if (comp.length < 60) continue;
    let nl = 0, nh = 0;
    for (const i of comp) { const v = lum(i); if (Math.abs(v - lo) <= tol) nl++; else if (Math.abs(v - hi) <= tol) nh++; }
    if ((nl + nh) / comp.length > 0.55 && nl > comp.length * 0.1 && nh > comp.length * 0.1) for (const i of comp) bg[i] = 1;
  }
}

/** Morphological opening of the figure (erode then dilate by r): whiskers and stray hairs drop out of the traced shapes. */
function opened(fg, W, H, r) {
  const pass = (src, keep) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = keep;
      for (let dy = -r; dy <= r && v === keep; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy, s = xx < 0 || yy < 0 || xx >= W || yy >= H ? 0 : src[yy * W + xx];
        if (s !== keep) { v = 1 - keep; break; }
      }
      out[y * W + x] = v;
    }
    return out;
  };
  return pass(pass(fg, 1), 0);
}

/** Euclidean distance (Felzenszwalb & Huttenlocher) from every pixel of a w × h grid to the nearest pixel where `feature` is 1. */
function distance(feature, w, h) {
  const INF = 1e20, n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const out = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = feature[i] ? 0 : INF;
  const line = (len) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = out[y * w + x]; line(h); for (let y = 0; y < h; y++) out[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = out[y * w + x]; line(w); for (let x = 0; x < w; x++) out[y * w + x] = Math.sqrt(d[x]); }
  return out;
}

/** The connected piece of `solid` inside the box that holds (cx, cy) (or the pixel nearest it), with its holes filled. */
function blobMask(solid, W, H, [x0, y0, x1, y1], cx, cy) {
  const inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  let seed = -1, best = Infinity;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (solid[y * W + x]) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < best) { best = d; seed = y * W + x; } }
  const mask = new Uint8Array(W * H), stack = [seed];
  mask[seed] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const j = yy * W + xx;
      if (inBox(xx, yy) && !mask[j] && solid[j]) { mask[j] = 1; stack.push(j); }
    }
  }
  // holes: whatever the box's border can't reach without crossing the piece
  const out = new Uint8Array(W * H), open = [];
  for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) open.push(y * W + x);
  for (let y = y0; y <= y1; y++) for (const x of [x0, x1]) open.push(y * W + x);
  for (const i of open) out[i] = mask[i] ? 0 : 1;
  const reach = open.filter((i) => out[i]);
  while (reach.length) {
    const i = reach.pop(), x = i % W, y = (i / W) | 0;
    for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const j = yy * W + xx;
      if (inBox(xx, yy) && !out[j] && !mask[j]) { out[j] = 1; reach.push(j); }
    }
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!out[y * W + x]) mask[y * W + x] = 1;
  return mask;
}

/**
 * A blob as a height grid over its mask: inside points rise as a union of spheres (each grid point the top
 * of the tallest ball, centred on another grid point, that fits inside the outline and covers it); rim
 * points are grid points just outside, moved onto the nearest pixel of the outline, at height 0.
 * Returns { grid, inside } (inside: the distance to the outline per pixel, for the back's edge blend).
 */
function heightGrid(mask, W, H, g) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = Math.ceil(g * 1.6) + 2, bx = Math.max(0, x0 - m), by = Math.max(0, y0 - m), bw = Math.min(W - 1, x1 + m) - bx + 1, bh = Math.min(H - 1, y1 + m) - by + 1;
  const local = new Uint8Array(bw * bh), notLocal = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = mask[(y + by) * W + x + bx]; local[y * bw + x] = v; notLocal[y * bw + x] = 1 - v; }
  const din = distance(notLocal, bw, bh), dout = distance(local, bw, bh);
  const gx0 = bx, gy0 = by, cols = Math.floor((bw - 1) / g) + 1, rows = Math.floor((bh - 1) / g) + 1;
  const kind = new Uint8Array(cols * rows), rim = [], balls = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const lx = i * g, ly = j * g, k = ly * bw + lx;
    if (local[k]) { kind[j * cols + i] = 2; balls.push([lx, ly, din[k]]); }
    else if (dout[k] <= g * 1.5) { // a rim point: onto the outline
      let sx = 0, sy = 0, sd = Infinity;
      const r = Math.ceil(g * 1.5) + 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = lx + dx, yy = ly + dy;
        if (xx < 0 || yy < 0 || xx >= bw || yy >= bh || !local[yy * bw + xx]) continue;
        const d = dx * dx + dy * dy;
        if (d < sd) { sd = d; sx = dx; sy = dy; }
      }
      kind[j * cols + i] = 1; rim.push(sx, sy);
    }
  }
  const h = new Float64Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (kind[j * cols + i] !== 2) continue;
    const px = i * g, py = j * g;
    let best = 0;
    for (const [qx, qy, r] of balls) { const d2 = (px - qx) ** 2 + (py - qy) ** 2; if (d2 < r * r) best = Math.max(best, Math.sqrt(r * r - d2)); }
    h[j * cols + i] = best;
  }
  for (let pass = 0; pass < 2; pass++) { // soften the creases where balls meet
    const s = Float64Array.from(h);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (kind[j * cols + i] !== 2) continue;
      let sum = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < cols && jj < rows && kind[jj * cols + ii] === 2) { sum += s[jj * cols + ii]; n++; } }
      h[j * cols + i] = sum / n;
    }
  }
  let hmax = 0;
  for (const v of h) hmax = Math.max(hmax, v);
  const bytes = new Uint8Array(cols * rows);
  for (let k = 0; k < cols * rows; k++) bytes[k] = kind[k] === 2 ? 2 + Math.round((253 * h[k]) / hmax) : kind[k];
  const inside = new Float64Array(W * H);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) inside[(y + by) * W + x + bx] = din[y * bw + x];
  return {
    grid: { x0: gx0, y0: gy0, step: g, cols, rows, hmax: Math.round(hmax * 10) / 10, h: Buffer.from(bytes).toString('base64'), rim: Buffer.from(Int8Array.from(rim).buffer).toString('base64') },
    inside, box: [bx, by, bx + bw - 1, by + bh - 1],
  };
}

/** Deterministic little random generator for the quilting. */
function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/**
 * Covers a region with the swatch at its own scale: overlapping patches, each flipped at random, blended
 * so the strongest patch wins (no grid of repeats, little blur). Returns rgb per pixel of the region's box.
 */
function quilt(raw, W, [sx0, sy0, sx1, sy1], [bx0, by0, bx1, by1], seed) {
  const sw = sx1 - sx0, sh = sy1 - sy0, bw = bx1 - bx0 + 1, bh = by1 - by0 + 1, R = rand(seed);
  const acc = new Float64Array(bw * bh * 3), wsum = new Float64Array(bw * bh);
  const stepX = sw * 0.55, stepY = sh * 0.55;
  for (let oy = -sh * 0.5; oy < bh; oy += stepY) for (let ox = -sw * 0.5; ox < bw; ox += stepX) {
    const px = Math.round(ox + (R() - 0.5) * stepX * 0.5), py = Math.round(oy + (R() - 0.5) * stepY * 0.5), fx = R() < 0.5, fy = R() < 0.3;
    for (let y = Math.max(0, py); y < Math.min(bh, py + sh); y++) for (let x = Math.max(0, px); x < Math.min(bw, px + sw); x++) {
      const u = (x - px + 0.5) / sw, v = (y - py + 0.5) / sh, w = (Math.min(u, 1 - u) * Math.min(v, 1 - v)) ** 3 + 1e-9;
      const tx = sx0 + (fx ? sw - 1 - (x - px) : x - px), ty = sy0 + (fy ? sh - 1 - (y - py) : y - py), si = (ty * W + tx) * 3, k = y * bw + x;
      acc[k * 3] += raw[si] * w; acc[k * 3 + 1] += raw[si + 1] * w; acc[k * 3 + 2] += raw[si + 2] * w; wsum[k] += w;
    }
  }
  return (x, y) => { const k = (y - by0) * bw + (x - bx0); return [acc[k * 3] / wsum[k], acc[k * 3 + 1] / wsum[k], acc[k * 3 + 2] / wsum[k]]; };
}

const round = (v) => Math.round(v * 10) / 10;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

mkdirSync('public/assets/monsters', { recursive: true });
const shapes = {};
let seed = 1;
for (const [name, cfg] of Object.entries(CREATURES)) {
  const img = sharp(`art/creatures/${cfg.src}`).removeAlpha();
  const { data, info } = await img.clone().blur(cfg.bg === 'grow' ? 1.2 : 0.6).raw().toBuffer({ resolveWithObject: true });
  const raw = await img.clone().raw().toBuffer();
  const W = info.width, H = info.height, unit = W / 1024; // (pixel sizes below are for a 1024-wide drawing)
  const bg = background(data, W, H, cfg.bg, cfg.thin);
  const fg = bg.map((b) => 1 - b);
  const solid = opened(fg, W, H, cfg.open ?? 3);
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? solid[(y | 0) * W + (x | 0)] : 0);
  const alpha = Uint8Array.from(fg); // what the drawing shows (blob holes get filled in below)
  const groove = new Uint8Array(W * H * 3), grooved = []; // background inside a limb's outline (the goggles' rod legs): the limb's own colour, dark; never see-through
  const parts = {}, backs = []; // backs: [region mask, distance to its edge, swatch]
  let top = H;
  for (let i = 0; i < W * H; i++) if (solid[i]) { top = Math.floor(i / W); break; }
  for (const [part, [kind, x0, y0, x1, y1, ...rest]] of Object.entries(cfg.parts)) {
    const step = cfg.step ?? 6;
    const [cx, cy, o = {}] = kind === 'blob' ? rest : [0, 0, rest[0] ?? {}];
    if (kind === 'blob') {
      const mask = blobMask(solid, W, H, [x0, y0, x1, y1], cx, cy);
      for (let i = 0; i < W * H; i++) if (mask[i]) alpha[i] = 1;
      const { grid, inside } = heightGrid(mask, W, H, cfg.grid ?? 8);
      parts[part] = { kind, center: [cx, cy], grid };
      if (o.back) backs.push({ mask, inside, swatch: o.back });
      continue;
    }
    const profile = [];
    if (kind === 'h') {
      for (let x = x0; x <= x1; x += step) {
        let t = -1, b = -1;
        for (let y = y0; y <= y1; y++) if (at(x, y)) { if (t < 0) t = y; b = y; }
        if (t >= 0 && b - t >= 2) profile.push([x, t + 1, b - 1]);
      }
    } else {
      for (let y = y0; y <= y1; y += step) {
        let l = -1, r = -1;
        for (let x = x0; x <= x1; x++) if (at(x, y)) { if (l < 0) l = x; r = x; }
        if (l >= 0 && r - l >= 2) profile.push([y, l + 1, r - 1]);
      }
    }
    parts[part] = { kind, profile };
    // The shell's own footprint, rows filled between their ends: solid all through (gaps in the drawing
    // become a dark groove), and, with a swatch, where its back is quilted.
    const mask = new Uint8Array(W * H), gaps = [], mean = [0, 0, 0];
    let nm = 0;
    for (let k = 0; k + 1 < profile.length; k++) {
      const [a0, l0, r0] = profile[k], [a1, l1, r1] = profile[k + 1];
      for (let a = a0; a <= a1; a++) {
        const t = (a - a0) / Math.max(1, a1 - a0), l = Math.floor(l0 + (l1 - l0) * t), r = Math.ceil(r0 + (r1 - r0) * t);
        for (let b = l - 3; b <= r + 3; b++) {
          const [x, y] = kind === 'v' ? [b, a] : [a, b];
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = y * W + x;
          mask[i] = 1;
          if (b < l || b > r) continue;
          if (fg[i]) { for (let c = 0; c < 3; c++) mean[c] += raw[i * 3 + c]; nm++; } else gaps.push(i);
        }
      }
    }
    for (const i of gaps) { alpha[i] = 1; grooved.push(i); for (let c = 0; c < 3; c++) groove[i * 3 + c] = Math.round((mean[c] / Math.max(1, nm)) * 0.3); }
    if (o.back) backs.push({ mask, inside: distance(mask.map((v) => 1 - v), W, H), swatch: o.back });
  }
  shapes[name] = { size: [W, H], atlas: [W + Math.ceil(W / 2), H], top, parts };

  // Front: the drawing; background pixels take the colour of the nearest figure pixel (grown outwards) so
  // sampling at the cut never picks up the paper or the checkerboard, and filled holes get their surroundings.
  const rgb = new Uint8Array(W * H * 3), have = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (fg[i]) { rgb[i * 3] = raw[i * 3]; rgb[i * 3 + 1] = raw[i * 3 + 1]; rgb[i * 3 + 2] = raw[i * 3 + 2]; have[i] = 1; }
  for (let ring = 0; ; ring++) {
    const add = [];
    for (let i = 0; i < W * H; i++) {
      if (have[i] || (ring >= 12 && !alpha[i])) continue;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && have[j]) { add.push([i, j]); break; }
    }
    if (!add.length) break;
    for (const [i, j] of add) { rgb[i * 3] = rgb[j * 3]; rgb[i * 3 + 1] = rgb[j * 3 + 1]; rgb[i * 3 + 2] = rgb[j * 3 + 2]; have[i] = 1; }
  }
  for (const i of grooved) for (let k = 0; k < 3; k++) rgb[i * 3 + k] = groove[i * 3 + k];
  // Back: the same colours, with each swatch-backed part quilted over and blended into its own edge.
  const back = Uint8Array.from(rgb), rim = [6 * unit, 30 * unit];
  for (const b of backs) {
    let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
    for (let i = 0; i < W * H; i++) if (b.mask[i]) { const x = i % W, y = (i / W) | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    const pad = Math.ceil(14 * unit) + 2;
    bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad); bx1 = Math.min(W - 1, bx1 + pad); by1 = Math.min(H - 1, by1 + pad);
    const q = quilt(raw, W, b.swatch, [bx0, by0, bx1, by1], seed++);
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const i = y * W + x, w = smooth(rim[0], rim[1], b.inside[i]);
      if (w <= 0) continue;
      const c = q(x, y);
      for (let k = 0; k < 3; k++) back[i * 3 + k] = Math.round(rgb[i * 3 + k] * (1 - w) + c[k] * w);
    }
  }
  const rgba = (src) => { const out = Buffer.alloc(W * H * 4); for (let i = 0; i < W * H; i++) { out[i * 4] = src[i * 3]; out[i * 4 + 1] = src[i * 3 + 1]; out[i * 4 + 2] = src[i * 3 + 2]; out[i * 4 + 3] = alpha[i] ? 255 : 0; } return out; };
  const half = await sharp(rgba(back), { raw: { width: W, height: H, channels: 4 } }).resize(Math.ceil(W / 2), Math.ceil(H / 2)).png().toBuffer();
  const out = await sharp({ create: { width: W + Math.ceil(W / 2), height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(rgba(rgb), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), left: 0, top: 0 }, { input: half, left: W, top: 0 }])
    .webp({ quality: 82, alphaQuality: 90 }).toFile(`public/assets/monsters/${name}.webp`);
  console.log(`${name.padEnd(9)} ${W}×${H} → atlas ${W + Math.ceil(W / 2)}×${H}  ${(out.size / 1024).toFixed(0)} KB  parts: ${Object.entries(parts).map(([k, p]) => `${k}(${p.grid ? `${p.grid.cols}×${p.grid.rows}` : p.profile.length})`).join(' ')}`);
}

writeFileSync('src/actors/creature-shapes.js', `// Generated by tools/make-creatures.mjs from art/creatures/: do not edit by hand.
// Each creature's drawing size, its texture atlas size (drawing, then the backs at half size to its right),
// the top of the figure, and its parts in drawing pixels: blob { center, grid } (a height grid: base64
// bytes per point, 0 none, 1 rim, 2..255 height up to hmax px; rim: base64 int8 pairs, each rim point's
// offset onto the outline), h { profile: [x, top, bottom] } (arms), v { profile: [y, left, right] }.
export const SHAPES = ${JSON.stringify(shapes)};
`);
