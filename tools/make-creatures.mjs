// The team's creature drawings (art/creatures/, front views in a T-pose) → what the game builds its
// creature puppets from:
//   public/assets/monsters/<name>.webp   the drawing with its background cut away (alpha), edge colours
//                                         pushed outwards so no background halo shows at the cut;
//   src/actors/creature-shapes.js        each body part traced off the cut-out: heads and torsos as
//                                         outlines round a centre, arms as horizontal profiles (top and
//                                         bottom per column), legs, necks and dresses as vertical ones.
//   node tools/make-creatures.mjs
// The part boxes below are in the drawings' own pixels; they only have to keep the parts apart.
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

// bg: how the background is told apart: 'grey' (a light checkerboard or white) or 'grow' (paper: grown from the
// borders while neighbouring colours stay close). Parts: blob [x0, y0, x1, y1, cx, cy], h / v [x0, y0, x1, y1].
const CREATURES = {
  catgirl: { src: 'catgirl.webp', bg: 'grow', parts: {
    head: ['blob', 240, 150, 790, 709, 490, 470], torso: ['v', 360, 716, 660, 1068],
    armL: ['h', 40, 700, 382, 765], armR: ['h', 642, 700, 990, 765],
    legL: ['v', 452, 1060, 512, 1412], legR: ['v', 512, 1060, 574, 1412] } },
  goggles: { src: 'goggles.webp', bg: 'grey', parts: {
    head: ['blob', 268, 118, 782, 566, 525, 360], neck: ['v', 498, 560, 548, 618], torso: ['blob', 398, 600, 612, 846, 505, 720],
    armL: ['h', 40, 602, 412, 652], armR: ['h', 598, 602, 990, 652],
    legL: ['v', 438, 840, 511, 1432], legR: ['v', 511, 840, 590, 1432], ball: ['blob', 695, 745, 790, 842, 740, 790] } },
  lips: { src: 'lips.webp', bg: 'grey', parts: {
    head: ['blob', 218, 8, 804, 376, 510, 200], neck: ['v', 494, 366, 536, 438], torso: ['blob', 388, 424, 642, 618, 512, 515],
    armL: ['h', 40, 418, 428, 472], armR: ['h', 594, 418, 988, 472], dress: ['v', 270, 606, 754, 1458] } },
  catman: { src: 'catman.webp', bg: 'grey', parts: {
    head: ['blob', 268, 120, 762, 516, 515, 330], torso: ['v', 404, 512, 622, 930],
    armL: ['h', 18, 498, 420, 568], armR: ['h', 600, 498, 1008, 568],
    legL: ['v', 404, 900, 510, 1472], legR: ['v', 510, 900, 616, 1472] } },
  longneck: { src: 'longneck.png', bg: 'grey', step: 3, parts: {
    head: ['blob', 68, 8, 382, 206, 225, 110], neck: ['v', 204, 196, 242, 352], torso: ['v', 166, 340, 282, 506],
    armL: ['h', 0, 352, 182, 398], armR: ['h', 266, 352, 448, 398],
    legL: ['v', 118, 488, 226, 716], legR: ['v', 226, 488, 334, 716] } },
};

/** Background mask (1 = background) by flood fill from the borders. */
function background(data, W, H, mode) {
  const bg = new Uint8Array(W * H), stack = [];
  const c = (i) => [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
  const greyish = (i) => { const [r, g, b] = c(i); return Math.min(r, g, b) > 196 && Math.max(r, g, b) - Math.min(r, g, b) < 20; };
  const close = (i, j) => { const a = c(i), b = c(j); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 6 && (a[0] + a[1] + a[2]) / 3 > 150; };
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  for (const i of stack) bg[i] = mode === 'grey' ? +greyish(i) : 1;
  const open = stack.filter((i) => bg[i]);
  while (open.length) {
    const i = open.pop(), x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || bg[j]) continue;
      if (mode === 'grey' ? greyish(j) : close(i, j)) { bg[j] = 1; open.push(j); }
    }
  }
  return bg;
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

const round = (v) => Math.round(v * 10) / 10;

mkdirSync('public/assets/monsters', { recursive: true });
const shapes = {};
for (const [name, cfg] of Object.entries(CREATURES)) {
  const img = sharp(`art/creatures/${cfg.src}`).removeAlpha();
  const { data, info } = await img.clone().blur(cfg.bg === 'grow' ? 1.2 : 0.6).raw().toBuffer({ resolveWithObject: true });
  const raw = await img.clone().raw().toBuffer();
  const W = info.width, H = info.height;
  const bg = background(data, W, H, cfg.bg);
  const fg = bg.map((b) => 1 - b);
  const solid = opened(fg, W, H, cfg.step === 3 ? 1 : 3);
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? solid[(y | 0) * W + (x | 0)] : 0);
  const parts = {};
  for (const [part, [kind, x0, y0, x1, y1, cx, cy]] of Object.entries(cfg.parts)) {
    const step = cfg.step ?? 6;
    if (kind === 'blob') {
      // round the centre, the farthest figure pixel inside the box along each ray (holes don't matter)
      const outline = [];
      for (let k = 0; k < 64; k++) {
        const a = (k / 64) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        let far = 2;
        for (let t = 2; ; t += 1) {
          const x = cx + dx * t, y = cy + dy * t;
          if (x < x0 || x > x1 || y < y0 || y > y1) break;
          if (at(x, y)) far = t;
        }
        outline.push([round(cx + dx * (far - 1.5)), round(cy + dy * (far - 1.5))]);
      }
      parts[part] = { kind, center: [cx, cy], outline };
    } else if (kind === 'h') {
      const profile = [];
      for (let x = x0; x <= x1; x += step) {
        let top = -1, bot = -1;
        for (let y = y0; y <= y1; y++) if (at(x, y)) { if (top < 0) top = y; bot = y; }
        if (top >= 0 && bot - top >= 2) profile.push([x, top + 1, bot - 1]);
      }
      parts[part] = { kind, profile };
    } else {
      const profile = [];
      for (let y = y0; y <= y1; y += step) {
        let left = -1, right = -1;
        for (let x = x0; x <= x1; x++) if (at(x, y)) { if (left < 0) left = x; right = x; }
        if (left >= 0 && right - left >= 2) profile.push([y, left + 1, right - 1]);
      }
      parts[part] = { kind, profile };
    }
  }
  shapes[name] = { size: [W, H], parts };
  // The texture: the drawing with its cut-out as alpha; background pixels take the colour of the nearest figure
  // pixel (grown outwards a few rings) so sampling at the cut never picks up the paper or the checkerboard.
  const rgba = Buffer.alloc(W * H * 4), have = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { if (fg[i]) { rgba[i * 4] = raw[i * 3]; rgba[i * 4 + 1] = raw[i * 3 + 1]; rgba[i * 4 + 2] = raw[i * 3 + 2]; rgba[i * 4 + 3] = 255; have[i] = 1; } }
  for (let ring = 0; ring < 12; ring++) {
    const add = [];
    for (let i = 0; i < W * H; i++) {
      if (have[i]) continue;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && have[j]) { add.push([i, j]); break; }
    }
    for (const [i, j] of add) { rgba[i * 4] = rgba[j * 4]; rgba[i * 4 + 1] = rgba[j * 4 + 1]; rgba[i * 4 + 2] = rgba[j * 4 + 2]; have[i] = 1; }
  }
  const out = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 82, alphaQuality: 90 }).toFile(`public/assets/monsters/${name}.webp`);
  console.log(`${name.padEnd(9)} ${W}×${H}  ${(out.size / 1024).toFixed(0)} KB  parts: ${Object.entries(parts).map(([k, p]) => `${k}(${(p.outline ?? p.profile).length})`).join(' ')}`);
}

writeFileSync('src/actors/creature-shapes.js', `// Generated by tools/make-creatures.mjs from art/creatures/: do not edit by hand.
// Each creature's drawing size and its parts traced in drawing pixels: blob { center, outline },
// h { profile: [x, top, bottom] } (arms), v { profile: [y, left, right] } (legs, necks, bodies).
export const SHAPES = ${JSON.stringify(shapes)};
`);
