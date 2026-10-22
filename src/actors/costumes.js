// Halloween costume pieces worn over the Bitmoji: a witch hat, a pumpkin hat, little devil horns or
// a cape. They are separate meshes riding on the avatar's head (or upper spine) joint, so they
// never change the Bitmoji itself and come off with a tap. Built in head units: 1 = head radius.
import { Geo, blob, trs } from '../geo.js';
import { flat, lathe, tube } from '../world/shapes.js';
import { PAL } from '../world/layout.js';

export const COSTUMES = ['witch', 'pumpkin', 'horns', 'cape', 'none'];

/** Geometry for a costume, in the head's frame: origin on top of the head, +Z forward, unit = head radius. */
export function costumeGeo(id) {
  const g = new Geo();
  if (id === 'witch') {
    g.add(lathe([[0, -0.02], [2.1, 0], [2.15, 0.05], [1.9, 0.09], [0.95, 0.12], [0, 0.14]], 20), trs(0, -0.05, 0, -6, 0, 0), [0.16, 0.08, 0.22]); // brim
    const pts = [], rad = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, bend = t * t * t;
      pts.push([bend * 0.9, 0.05 + t * 2.6 - bend * 0.35, -bend * 0.5]);
      rad.push(0.92 * (1 - t) + 0.04);
    }
    g.add(tube(pts, rad, 14), null, [0.2, 0.1, 0.28]);
    g.add(lathe([[0.95, 0], [0.96, 0.22], [0.88, 0.26], [0.86, 0.04]], 18), trs(0, 0.1, 0), PAL.pumpkin); // band
    g.add(flat([[-0.18, -0.16], [0.18, -0.16], [0.18, 0.16], [-0.18, 0.16]]), trs(0, 0.22, 0.95, -4, 0, 0), PAL.gold); // buckle
  } else if (id === 'pumpkin') {
    const shape = (a) => 0.9 + 0.1 * Math.abs(Math.sin(4 * a));
    const prof = [];
    for (let k = 0; k <= 8; k++) { const v = k / 8; prof.push([Math.sin(Math.min(1, 0.25 + v * 0.75) * Math.PI) * 1.15 + (k === 0 ? 0.25 : 0), v * 1.35]); }
    g.add(lathe(prof, 18, { shape }), trs(0, -0.42, 0), [1, 0.5, 0.1]);
    g.add(tube([[0, 0.85, 0], [0.05, 1.15, 0], [0.25, 1.38, 0.05]], [0.16, 0.12, 0.06], 6), null, [0.3, 0.34, 0.14]);
    g.add(lathe([[0, 0], [0.35, 0.03], [0.3, 0.08], [0, 0.06]], 8), trs(0.35, 1.0, 0, 0, 0, -30), [0.35, 0.5, 0.2]); // leaf
    for (const ex of [-1, 1]) g.add(flat([[-0.17, -0.1], [0.17, -0.1], [0, 0.18]]), trs(ex * 0.38, 0.32, 1.14, 0, ex * 18, 0), [0.15, 0.05, 0.02]);
    const grin = [[-0.45, 0.05], [-0.3, -0.06], [-0.15, 0], [0, -0.08], [0.15, 0], [0.3, -0.06], [0.45, 0.05]];
    for (let k = 0; k < 6; k++) g.add(flat([grin[k], [grin[k][0] * 0.7, -0.22], [grin[k + 1][0] * 0.7, -0.22], grin[k + 1]]), trs(0, 0.06, 1.15), [0.15, 0.05, 0.02]);
  } else if (id === 'horns') {
    for (const s of [-1, 1]) {
      const pts = [], rad = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([s * (0.5 + t * 0.5 + t * t * 0.2), -0.1 + t * 1.25 - t * t * 0.15, 0.3 - t * t * 0.55]); rad.push(0.3 * (1 - t) + 0.025); }
      g.add(tube(pts, rad, 8), null, [0.62, 0.08, 0.1]);
    }
  } else if (id === 'cape') {
    // A cape hangs from the shoulders; built in the back's frame by capeGeo instead.
  }
  return g;
}

/**
 * The cape, in the upper spine's frame (unit = metres of the unscaled avatar): a curved sheet from
 * the shoulders to the knees, violet outside, blood red inside, with a high pointed collar.
 */
export function capeGeo() {
  const g = new Geo();
  const rows = 8, cols = 10, w0 = 0.34, w1 = 0.62, len = 0.62;
  const outside = { p: [], n: [], uv: [], i: [] }, inside = { p: [], n: [], uv: [], i: [] };
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, w = w0 + (w1 - w0) * t;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols - 0.5, a = u * Math.PI * 0.8;
      const x = Math.sin(a) * w * 0.65, z = -0.13 - Math.cos(a) * 0.08 - t * 0.12 + (c % 2 ? 0.012 : 0) * t; // folds
      const y = -t * len - (Math.abs(u) > 0.45 ? 0 : 0) + (r === rows ? (c % 2 ? 0.03 : -0.03) : 0);
      outside.p.push(x, y, z); outside.n.push(Math.sin(a), 0, -Math.cos(a)); outside.uv.push(u, t);
      inside.p.push(x, y, z + 0.006); inside.n.push(-Math.sin(a), 0, Math.cos(a)); inside.uv.push(u, t);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c, b = a + cols + 1;
      outside.i.push(a, a + 1, b, a + 1, b + 1, b);
      inside.i.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  g.add(outside, null, [0.22, 0.1, 0.3]);
  g.add(inside, null, [0.5, 0.06, 0.1]);
  for (const s of [-1, 1]) g.add(flat(s > 0 ? [[0, 0], [0.16, 0.02], [0.2, 0.2]] : [[0, 0], [-0.2, 0.2], [-0.16, 0.02]]), trs(s * 0.09, 0.02, -0.12, -20, s * 25, 0), [0.5, 0.06, 0.1]);
  g.add(blob(0.03, 6), trs(0, -0.01, 0.06), PAL.gold); // clasp
  g.add(tube([[-0.16, 0, -0.08], [0, -0.02, 0.07], [0.16, 0, -0.08]], 0.012, 4), null, PAL.gold); // cord
  return g;
}

export const COSTUME_ICON = { witch: '🧙', pumpkin: '🎃', horns: '😈', cape: '🦇', none: '🙂' };
