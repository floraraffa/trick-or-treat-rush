// Everything in the village that isn't a house: twisted trees with hand-like branches, crooked
// lamps, lopsided pumpkins (some carved and lit), bent picket fences, the Victorian cemetery, odd
// mushrooms, dark flowers, topiary and the clock tower in the plaza. All batched (see village.js).
import { Entity } from 'playcanvas';
import { Geo, blob, box, cylinder, trs } from '../geo.js';
import { rng } from '../rng.js';
import { archOutline, circleOutline, extrude, flat, lathe, tube } from './shapes.js';
import { CEMETERY, MAUSOLEUM, PAL, TOWER_R } from './layout.js';

const D2R = Math.PI / 180;
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// --- trees --------------------------------------------------------------------------
/** A tall, thin, twisted tree: a winding trunk, crooked branches ending in finger-like twigs, big roots. */
export function addTree(B, t, { detail = 1, key = 'bark' } = {}) {
  const R = rng(Math.round(t.seed * 13));
  const col = t.dead ? [0.42, 0.4, 0.44] : mixc([0.3, 0.24, 0.3], [0.22, 0.2, 0.26], R());
  const lean = [(R() - 0.5) * 1.6, (R() - 0.5) * 1.6];
  const trunkH = t.h * (0.5 + R() * 0.12);
  const pts = [], rad = [];
  const n = 8;
  for (let k = 0; k <= n; k++) {
    const s = k / n, wob = Math.sin(s * 5 + R() * 2) * 0.35 * s;
    pts.push([t.x + lean[0] * s * s + wob, s * trunkH, t.z + lean[1] * s * s + Math.cos(s * 4) * 0.25 * s]);
    rad.push(0.5 * (1 - s) * (1 - s) + 0.12 + (k === 0 ? 0.18 : 0));
  }
  B.get(key).add(tube(pts, rad, detail > 0.5 ? 9 : 6, { uvScale: 0.6 }), null, col);
  // Roots: thick, clawing into the ground.
  const nr = detail > 0.5 ? 5 : 3;
  for (let k = 0; k < nr; k++) {
    const a = (k / nr) * Math.PI * 2 + R(), l = 1.2 + R() * 1.3;
    const rp = [[t.x, 0.7, t.z], [t.x + Math.cos(a) * l * 0.45, 0.35, t.z + Math.sin(a) * l * 0.45], [t.x + Math.cos(a) * l, 0.05, t.z + Math.sin(a) * l], [t.x + Math.cos(a + 0.3) * l * 1.3, -0.15, t.z + Math.sin(a + 0.3) * l * 1.3]];
    B.get(key).add(tube(rp, [0.3, 0.22, 0.12, 0.04], 6, { uvScale: 0.6 }), null, col);
  }
  // Branches from the upper trunk, each splitting into curled "fingers".
  const top = pts[n];
  const nb = 3 + Math.floor(R() * 3);
  for (let b = 0; b < nb; b++) {
    const from = pts[Math.min(n, 4 + Math.floor(R() * 5))];
    const a = (b / nb) * Math.PI * 2 + R() * 0.8, len = t.h * (0.32 + R() * 0.22), rise = 0.6 + R() * 0.7;
    const bp = [];
    for (let k = 0; k <= 5; k++) {
      const s = k / 5, bend = Math.sin(s * 3 + b) * 0.5;
      bp.push([from[0] + Math.cos(a + bend * 0.4) * len * s, from[1] + len * s * rise - s * s * len * 0.25, from[2] + Math.sin(a + bend * 0.4) * len * s]);
    }
    B.get(key).add(tube(bp, [0.17, 0.14, 0.11, 0.08, 0.06, 0.045], 6, { uvScale: 0.6 }), null, col);
    if (detail < 0.5) continue;
    const tip = bp[5], nf = 3 + Math.floor(R() * 2);
    for (let f = 0; f < nf; f++) {
      const fa = a + (f - (nf - 1) / 2) * 0.55, fl = 0.7 + R() * 0.9, curl = (R() > 0.5 ? 1 : -1) * (0.8 + R());
      const fp = [];
      for (let k = 0; k <= 4; k++) {
        const s = k / 4, ang = fa + curl * s * s;
        fp.push([tip[0] + Math.cos(ang) * fl * s, tip[1] + Math.sin(s * 2.2) * fl * 0.45 - s * s * 0.3, tip[2] + Math.sin(ang) * fl * s]);
      }
      B.get(key).add(tube(fp, [0.045, 0.035, 0.026, 0.018, 0.006], 4, { caps: false }), null, col);
    }
  }
  // A crooked crown sprig on top.
  B.get(key).add(tube([top, [top[0] + 0.3, top[1] + 1.2, top[2]], [top[0] + 0.7, top[1] + 1.7, top[2] + 0.2]], [0.12, 0.06, 0.01], 5), null, col);
}

// --- lamps --------------------------------------------------------------------------
/** A shepherd's-crook street lamp. Returns the lantern's world position (for its light). */
export function addLamp(B, l) {
  const M = trs(l.x, 0, l.z, 0, l.yaw, 0);
  B.get('glossy').add(lathe([[0.22, 0], [0.2, 0.12], [0.1, 0.2], [0.08, 0.5], [0.06, 0.55]], 10), M, PAL.iron);
  const crook = [[0, 0.5, 0], [0, 2.4, 0], [0.04, 3.0, 0], [0.18, 3.32, 0], [0.42, 3.42, 0], [0.62, 3.32, 0], [0.7, 3.12, 0]];
  B.get('glossy').add(tube(crook, 0.055, 6), M, PAL.iron);
  B.get('glossy').add(tube([[0, 2.2, 0], [0.25, 2.55, 0], [0.36, 2.9, 0], [0.2, 3.1, 0]], 0.025, 4), M, PAL.iron); // scroll
  const L = M.clone().mul(trs(0.7, 2.62, 0));
  B.get('glossy').add(lathe([[0, -0.05], [0.12, 0], [0.19, 0.08], [0.2, 0.12], [0.08, 0.5], [0.02, 0.56]], 6), L, PAL.iron);
  B.get('emit').add(lathe([[0, 0.06], [0.15, 0.12], [0.15, 0.36], [0, 0.42]], 6), L, PAL.warm);
  const p = L.getTranslation();
  return [p.x, p.y + 0.25, p.z];
}

// --- pumpkins -----------------------------------------------------------------------
/** A deformed pumpkin: ribbed, squashed, lopsided, with a crooked stem; lit ones get a carved face. */
export function addPumpkin(B, p, R) {
  const s = p.s, squash = 0.62 + R() * 0.25, lop = R() * Math.PI * 2;
  const prof = [];
  for (let k = 0; k <= 8; k++) { const v = k / 8; prof.push([Math.sin(v * Math.PI) * s * (1 + 0.1 * Math.sin(v * Math.PI * 2)), -Math.cos(v * Math.PI) * s * squash + s * squash]); }
  const shape = (a) => (0.9 + 0.1 * Math.abs(Math.sin(4 * a))) * (1 + 0.1 * Math.cos(a + lop));
  const color = p.lit ? mixc(PAL.pumpkin, [0.9, 0.35, 0.05], R()) : [[0.95, 0.5, 0.12], [0.82, 0.78, 0.68], [0.55, 0.3, 0.12], [0.36, 0.42, 0.3]][Math.floor(R() * 4)];
  const M = trs(p.x, 0, p.z, (R() - 0.5) * 14, p.yaw, (R() - 0.5) * 14);
  B.get('plain').add(lathe(prof, 16, { shape }), M, color);
  const top = 2 * s * squash;
  B.get('plain').add(tube([[0, top - 0.05, 0], [0.02, top + 0.12 * s + 0.05, 0], [0.12 * s, top + 0.26 * s, 0.05], [0.2 * s, top + 0.27 * s, 0.09]], [0.07 * s + 0.02, 0.05 * s + 0.015, 0.04 * s + 0.01, 0.02], 5), M, [0.28, 0.3, 0.14]);
  if (!p.lit) return;
  // Carved face: two triangle eyes and a jagged grin, glowing.
  const fz = s * 0.97, fy = s * squash;
  const face = M.clone().mul(trs(0, fy, fz));
  for (const ex of [-1, 1]) B.get('emit').add(flat([[-0.13 * s, -0.08 * s], [0.13 * s, -0.08 * s], [0, 0.14 * s]]), face.clone().mul(trs(ex * 0.24 * s, 0.14 * s, 0, 0, ex * 14, 0)), [1, 0.62, 0.15]);
  const grin = [[-0.36, 0.02], [-0.22, -0.06], [-0.12, -0.0], [0, -0.1], [0.12, -0.0], [0.22, -0.06], [0.36, 0.02], [0.2, -0.2], [-0.2, -0.2]].map(([x, y]) => [x * s, y * s]);
  // the grin is concave: split it into a fan of convex slices
  for (let k = 0; k < 6; k++) B.get('emit').add(flat([grin[k], [grin[k][0] * 0.6, -0.17 * s], [grin[k + 1][0] * 0.6, -0.17 * s], grin[k + 1]]), face.clone().mul(trs(0, -0.06 * s, 0.02)), [1, 0.55, 0.12]);
}

// --- fences -------------------------------------------------------------------------
/** A crooked picket fence from a to b ([x, z]). */
export function addFence(B, f) {
  const R = rng(900 + f.seed);
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz) / D2R;
  const n = Math.max(2, Math.round(len / 0.3));
  for (let k = 0; k <= n; k++) {
    const t = k / n, h = 0.85 + R() * 0.35;
    const M = trs(f.a[0] + dx * t, 0, f.a[1] + dz * t, 0, yaw + 90, (R() - 0.5) * 16);
    B.get('wood').add(extrude([[-0.05, 0], [0.05, 0], [0.05, h], [0, h + 0.14], [-0.05, h]], 0.035), M, mixc(f.color, [0.3, 0.28, 0.3], R() * 0.35));
  }
  for (const y of [0.3, 0.72]) {
    const pts = [];
    for (let k = 0; k <= 4; k++) { const t = k / 4; pts.push([f.a[0] + dx * t, y - Math.sin(t * Math.PI) * 0.08 + (R() - 0.5) * 0.05, f.a[1] + dz * t]); }
    B.get('wood').add(tube(pts, 0.03, 4), null, f.color);
  }
}

// --- cemetery -----------------------------------------------------------------------
export function addCemetery(B, tombs) {
  const { x: cx, z: cz, w, d, gate } = CEMETERY;
  const R = rng(4242);
  // Wrought-iron railings with spear tips, a little bent.
  const run = (a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.round(len / 0.24);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = a[0] + dx * t, z = a[1] + dz * t, h = 1.55 + (k % 4 === 0 ? 0.25 : 0), lx = (R() - 0.5) * 0.12;
      B.get('glossy').add(tube([[x, 0, z], [x + lx * 0.5, h * 0.6, z], [x + lx, h, z]], 0.022, 4, { caps: false }), null, PAL.iron);
      B.get('glossy').add(cylinder(0.05, 0, 0.16, 4), trs(x + lx, h, z), PAL.iron);
    }
    for (const y of [0.25, 1.35]) B.get('glossy').add(tube([[a[0], y, a[1]], [(a[0] + b[0]) / 2, y - 0.06, (a[1] + b[1]) / 2], [b[0], y, b[1]]], 0.03, 4), null, PAL.iron);
  };
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  run([x0, z0], [x1, z0]); run([x0, z0], [x0, z1]); run([x1, z0], [x1, z1]);
  run([x0, z1], [cx - gate / 2, z1]); run([cx + gate / 2, z1], [x1, z1]);
  // Gate pillars and a wrought arch with a crescent moon.
  for (const s of [-1, 1]) {
    B.get('rock').add(box(0.55, 2.3, 0.55, 0.8), trs(cx + s * (gate / 2 + 0.1), 1.15, z1), [0.45, 0.42, 0.5]);
    B.get('rock').add(lathe([[0.36, 0], [0.38, 0.12], [0.2, 0.2], [0.18, 0.42], [0, 0.48]], 8), trs(cx + s * (gate / 2 + 0.1), 2.3, z1), [0.5, 0.47, 0.54]);
  }
  const arch = [];
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * Math.PI; arch.push([cx - Math.cos(a) * (gate / 2 + 0.1), 2.5 + Math.sin(a) * 0.9, z1]); }
  B.get('glossy').add(tube(arch, 0.05, 5), null, PAL.iron);
  B.get('glossy').add(tube(circleOutline(0.32, 12).slice(2, 11).map(([x, y]) => [cx + x * 0.9, 3.15 + y, z1]), 0.045, 5), null, PAL.gold);
  // Earth inside the railings.
  B.get('dirt').add({ p: [x0, 0.025, z1, x1, 0.025, z1, x1, 0.025, z0, x0, 0.025, z0], n: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], uv: [x0 / 3, z1 / 3, x1 / 3, z1 / 3, x1 / 3, z0 / 3, x0 / 3, z0 / 3], i: [0, 1, 2, 0, 2, 3] }, null, [0.45, 0.42, 0.5]);

  for (const t of tombs) {
    const M = trs(t.x, 0, t.z, t.lean * 0.5, t.yaw, t.tilt * 0.5);
    const stone = mixc([0.62, 0.6, 0.68], [0.42, 0.45, 0.4], R());
    const s = t.s;
    if (t.kind === 'cross') {
      B.get('rock').add(box(0.18 * s, 1.35 * s, 0.16 * s, 0.6), M.clone().mul(trs(0, 0.67 * s, 0)), stone);
      B.get('rock').add(box(0.7 * s, 0.16 * s, 0.16 * s, 0.6), M.clone().mul(trs(0, 0.98 * s, 0)), stone);
    } else if (t.kind === 'obelisk') {
      B.get('rock').add(box(0.5 * s, 0.25 * s, 0.5 * s, 0.6), M.clone().mul(trs(0, 0.12 * s, 0)), stone);
      B.get('rock').add(cylinder(0.24 * s, 0.13 * s, 1.4 * s, 4, { uvScale: 0.6 }), M.clone().mul(trs(0, 0.25 * s, 0, 0, 45, 0)), stone);
      B.get('rock').add(cylinder(0.14 * s, 0, 0.25 * s, 4, { uvScale: 0.6 }), M.clone().mul(trs(0, 1.65 * s, 0, 0, 45, 0)), stone);
    } else {
      B.get('rock').add(extrude(archOutline(0.7 * s, 1.1 * s, { point: t.kind === 'pointed' ? 0.7 : 0 }), 0.16 * s), M, stone);
    }
    // grave mound
    B.get('dirt').add(blob(0.6, 8, { squashY: 0.22 }), trs(t.x, 0, t.z + 0.75, 0, t.yaw, 0), [0.4, 0.34, 0.36]);
    if (R() < 0.35) { // a candle left on the grave
      B.get('plain').add(cylinder(0.04, 0.04, 0.18, 6), trs(t.x + 0.25, 0, t.z + 0.3), PAL.bone);
      B.get('emit').add(blob(0.035, 6, { squashY: 1.6 }), trs(t.x + 0.25, 0.23, t.z + 0.3), [1, 0.75, 0.3]);
    }
  }

  // The mausoleum: columns, a pediment, a dark door with a ghostly green light leaking out.
  const m = MAUSOLEUM, MM = trs(m.x, 0, m.z);
  B.get('rock').add(box(m.w + 0.6, 0.35, m.d + 0.9, 0.8), MM.clone().mul(trs(0, 0.17, 0.2)), [0.5, 0.48, 0.55]);
  B.get('rock').add(box(m.w, m.h, m.d, 0.8), MM.clone().mul(trs(0, 0.35 + m.h / 2, -0.15)), [0.55, 0.53, 0.6]);
  for (const s of [-1, -0.36, 0.36, 1]) B.get('rock').add(cylinder(0.16, 0.14, m.h - 0.1, 10, { uvScale: 0.8 }), MM.clone().mul(trs(s * (m.w / 2 - 0.15), 0.35, m.d / 2 + 0.25)), [0.66, 0.64, 0.7]);
  B.get('rock').add(box(m.w + 0.3, 0.25, 0.7, 0.8), MM.clone().mul(trs(0, 0.35 + m.h, m.d / 2)), [0.6, 0.58, 0.64]);
  B.get('rock').add(extrude([[-m.w / 2 - 0.2, 0], [m.w / 2 + 0.2, 0], [0, 1.1]], m.d + 0.6), MM.clone().mul(trs(0, 0.6 + m.h, 0.1)), [0.55, 0.53, 0.6]);
  B.get('plain').add(flat(archOutline(1.1, 2.0)), MM.clone().mul(trs(0, 0.35, m.d / 2 - 0.13)), [0.05, 0.04, 0.07]);
  B.get('emit').add(box(0.04, 1.6, 0.02), MM.clone().mul(trs(0.05, 1.2, m.d / 2 - 0.1)), [0.45, 1, 0.6]);
  B.get('glossy').add(tube(circleOutline(0.35, 10).map(([x, y]) => [x, y + 0.6 + m.h + 1.4, m.d / 2 + 0.2]).concat([[0.35, 0.6 + m.h + 1.4, m.d / 2 + 0.2]]), 0.04, 4, { caps: false }), MM, PAL.gold);
}

// --- small wonders ------------------------------------------------------------------
/** A cluster of tall fantastical mushrooms with glowing spots. */
export function addMushrooms(B, c) {
  const R = rng(c.seed);
  const caps = [PAL.rose, PAL.lavender, [0.55, 0.85, 0.9], [0.8, 0.4, 0.55]];
  for (let k = 0; k < c.n; k++) {
    const a = R() * Math.PI * 2, r = R() * 0.8, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    const h = 0.25 + R() * (k === 0 ? 1.1 : 0.6), bend = (R() - 0.5) * 0.4;
    const top = [x + bend, h, z + bend * 0.5];
    B.get('plain').add(tube([[x, 0, z], [x + bend * 0.3, h * 0.5, z], top], [0.06 + h * 0.03, 0.05 + h * 0.02, 0.04 + h * 0.02], 6), null, PAL.bone);
    const cr = 0.18 + h * 0.3, bell = R() > 0.5;
    const prof = bell ? [[cr, 0], [cr * 0.95, 0.12 * cr], [cr * 0.7, 0.55 * cr], [cr * 0.3, 0.9 * cr], [0, cr]] : [[cr * 1.1, 0], [cr, 0.12 * cr], [cr * 0.6, 0.32 * cr], [0, 0.38 * cr]];
    const col = caps[Math.floor(R() * caps.length)];
    B.get('plain').add(lathe(prof, 12), trs(...top, (R() - 0.5) * 20, 0, (R() - 0.5) * 20), col);
    for (let s = 0; s < 4; s++) {
      const sa = R() * Math.PI * 2, sr = cr * (0.35 + R() * 0.5);
      B.get('emit').add(blob(cr * 0.09, 5), trs(top[0] + Math.cos(sa) * sr, top[1] + (bell ? 0.5 : 0.22) * cr, top[2] + Math.sin(sa) * sr), [0.75, 1, 0.9]);
    }
  }
}

/** A bed of dark tulip-like flowers. */
export function addFlowers(B, c) {
  const R = rng(c.seed);
  const cols = [[0.35, 0.05, 0.1], [0.25, 0.08, 0.32], [0.08, 0.06, 0.1], [0.5, 0.15, 0.3]];
  for (let k = 0; k < c.n; k++) {
    const x = c.x + (R() - 0.5) * 1.6, z = c.z + (R() - 0.5) * 1.6, h = 0.3 + R() * 0.35, lean = (R() - 0.5) * 0.2;
    B.get('plain').add(tube([[x, 0, z], [x + lean, h, z]], 0.012, 3, { caps: false }), null, [0.15, 0.25, 0.12]);
    B.get('plain').add(lathe([[0.02, 0], [0.07, 0.04], [0.08, 0.1], [0.05, 0.16]], 6, { shape: (a) => 1 + 0.25 * Math.cos(5 * a) }), trs(x + lean, h, z), cols[Math.floor(R() * cols.length)]);
  }
}

/** Topiary: a corkscrew, a stack of balls, or a lumpy blob, on a stone pot. */
export function addBush(B, b) {
  const R = rng(b.seed);
  const green = mixc(PAL.moss, [0.2, 0.3, 0.26], R());
  B.get('rock').add(lathe([[0.32, 0], [0.38, 0.3], [0.42, 0.42], [0.3, 0.45], [0, 0.45]], 10), trs(b.x, 0, b.z), [0.5, 0.48, 0.55]);
  if (b.kind === 0) {
    const pts = [];
    for (let k = 0; k <= 26; k++) { const t = k / 26, a = t * Math.PI * 6; pts.push([b.x + Math.cos(a) * 0.45 * (1 - t * 0.7), 0.6 + t * 1.9, b.z + Math.sin(a) * 0.45 * (1 - t * 0.7)]); }
    B.get('plain').add(tube(pts, pts.map((_, k) => 0.24 * (1 - k / 32)), 7), null, green);
  } else if (b.kind === 1) {
    let y = 0.55;
    for (const r of [0.48, 0.36, 0.25]) { B.get('plain').add(blob(r, 10, { rand: R, jitter: 0.25 }), trs(b.x + (R() - 0.5) * 0.15, y + r, b.z), green); y += r * 1.75; }
    B.get('plain').add(tube([[b.x, y, b.z], [b.x + 0.2, y + 0.35, b.z]], 0.03, 4), null, green);
  } else {
    B.get('plain').add(blob(0.75, 12, { rand: R, jitter: 0.5, squashY: 1.3 }), trs(b.x, 1.2, b.z, 0, R() * 360, 15), green);
  }
}

// --- clock tower ----------------------------------------------------------------------
/**
 * The crooked clock tower in the plaza. Its hands are entities: the minute hand creeps from
 * 11:57 to midnight over the three-minute round.
 */
export function addClockTower(app, B, clockMat) {
  const R = rng(77);
  B.get('rock').add(lathe([[TOWER_R + 0.4, 0], [TOWER_R + 0.35, 0.3], [TOWER_R, 0.45], [TOWER_R, 1.4], [TOWER_R - 0.15, 1.6], [0, 1.6]], 8, { uvScale: 0.8 }), trs(0, 0, 0, 0, 22.5, 0), [0.45, 0.42, 0.5]);
  let M = trs(0, 1.6, 0);
  const stages = [[2.3, 3.4, 4], [2.0, 3.0, -6], [1.8, 2.4, 9]];
  for (const [w, h, tw] of stages) {
    M = M.clone().mul(trs(0, 0, 0, (R() - 0.5) * 3, tw, (R() - 0.5) * 3));
    B.get('wood').add(box(w, h, w, 0.45), M.clone().mul(trs(0, h / 2, 0)), PAL.petrol);
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.get('plain').add(box(0.16, h, 0.16), M.clone().mul(trs(cx * w / 2, h / 2, cz * w / 2)), PAL.gold);
    B.get('plain').add(box(w + 0.3, 0.2, w + 0.3), M.clone().mul(trs(0, h, 0)), PAL.night);
    M = M.clone().mul(trs(0, h, 0));
  }
  // Clock stage: four faces, the hands on the plaza side first.
  const cw = 2.1, ch = 2.1;
  const CM = M.clone().mul(trs(0, 0, 0, 0, 6, 0));
  B.get('wood').add(box(cw, ch, cw, 0.45), CM.clone().mul(trs(0, ch / 2, 0)), PAL.violet);
  const hands = [];
  const root = new Entity('clock-tower');
  for (let f = 0; f < 4; f++) {
    const FM = CM.clone().mul(trs(0, ch / 2, 0, 0, f * 90, 0)).mul(trs(0, 0, cw / 2 + 0.02));
    B.get('plain').add(extrude(circleOutline(0.88, 18), 0.1), FM, PAL.gold);
    const face = new Geo().add(flat(circleOutline(0.8, 24)), trs(0, 0, 0.06), [1, 1, 1]).build(app.graphicsDevice, clockMat, `clock-face-${f}`);
    const pos = FM.getTranslation(), rot = FM.getEulerAngles();
    const pivot = new Entity(`clock-${f}`);
    pivot.setLocalPosition(pos);
    pivot.setLocalEulerAngles(rot);
    pivot.addChild(face);
    const mk = (len, w, col) => {
      const e = new Geo().add(extrude([[-w, -0.1], [w, -0.1], [w * 0.5, len], [-w * 0.5, len]], 0.03), trs(0, 0, 0.1), col).build(app.graphicsDevice, B.materials.plain, 'hand');
      pivot.addChild(e);
      return e;
    };
    hands.push({ hour: mk(0.42, 0.06, PAL.iron), minute: mk(0.68, 0.04, PAL.iron) });
    root.addChild(pivot);
  }
  // Belfry and a witch-hat roof with a curled tip and a bat weathervane.
  M = CM.clone().mul(trs(0, ch, 0));
  B.get('plain').add(box(cw + 0.4, 0.22, cw + 0.4), M, PAL.night);
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.get('plain').add(box(0.18, 1.3, 0.18), M.clone().mul(trs(cx * 0.8, 0.75, cz * 0.8)), PAL.gold);
  B.get('emit').add(lathe([[0, 0], [0.32, 0.05], [0.42, 0.6], [0.2, 0.8], [0, 0.85]], 10), M.clone().mul(trs(0, 0.2, 0)), [0.9, 0.7, 0.35]); // the bell, catching the light
  const hatH = 4.6;
  const prof = [[1.55, 0], [1.3, 0.3]];
  for (let k = 1; k <= 9; k++) { const s = k / 9; prof.push([1.3 * Math.pow(1 - s, 1.7) + 0.03, 0.3 + s * hatH]); }
  B.get('shingle').add(lathe(prof, 12, { uvScale: 0.55 }), M.clone().mul(trs(0, 1.4, 0)), [0.2, 0.1, 0.22]);
  const tip = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8, a = t * Math.PI * 1.1; tip.push([(1 - Math.cos(a)) * 0.6, 1.4 + hatH + Math.sin(a) * 0.8, 0]); }
  B.get('plain').add(tube(tip, tip.map((_, k) => 0.12 * (1 - k / 9) + 0.02), 6), M, [0.26, 0.14, 0.3]);
  // Weathervane: an iron rod with an arrow and a crescent moon.
  const vy = 1.4 + hatH + 0.75;
  B.get('glossy').add(tube([[1.2, vy - 0.4, 0], [1.2, vy + 0.9, 0]], 0.03, 4), M, PAL.iron);
  B.get('glossy').add(box(0.9, 0.05, 0.05), M.clone().mul(trs(1.2, vy + 0.55, 0)), PAL.iron);
  B.get('glossy').add(tube(circleOutline(0.28, 14).slice(3, 12).map(([x, y]) => [1.2 + x, vy + 1.15 + y, 0]), 0.05, 5), M, PAL.gold);
  return { root, hands, top: M.getTranslation().y + 1.4 + hatH };
}
