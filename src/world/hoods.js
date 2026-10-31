// What each neighbourhood (themes.js) has of its own, built from code like the rest of the village and batched
// with it: its trees, its street lamps, the landmark in the plaza, the far skyline, the houses' finery (balconies,
// fire escapes, awnings, signs, snow, neon...) and a few things about its streets. Everything keeps to the
// village plan: a tree stands where the plan's tree is (its collider is the plan's), a landmark within the clock
// tower's footprint, and a house's finery on its walls.
import { BLEND_ADDITIVEALPHA, Color, CULLFACE_NONE, Entity, StandardMaterial } from 'playcanvas';
import { Batches, DETAIL, Geo, blob, box, cylinder, trs } from '../geo.js';
import { FLEET, FLEET_LITE, policeRed, vehiclePose } from './traffic.js';
import { rng } from '../rng.js';
import { archOutline, circleOutline, extrude, flat, gableRoof, lathe, spireRoof, tube } from './shapes.js';
import { CANDY_SPOTS, CEMETERY, HOUSES, MAP_R, PLAZA_R, RING, TOWER_R, ringR } from './layout.js';

const D2R = Math.PI / 180;
const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dark = (c, k) => c.map((v) => v * k);
const IRON = [0.08, 0.07, 0.1], GOLD = [0.78, 0.6, 0.3], WHITE = [0.92, 0.92, 0.9], BLACK = [0.06, 0.06, 0.06];
const SNOW = [0.92, 0.95, 1];
const NEON = [[0.2, 0.9, 1], [1, 0.25, 0.75], [1, 0.8, 0.2], [0.5, 1, 0.4]]; // the cyberpunk city's neon
/** A squashed sphere (a hull, a canopy): `sx` × `sy` × `sz` m, its normals right for the squash. */
function ellipsoid(sx, sy, sz, segs = 10) {
  const m = blob(0.5, segs);
  for (let k = 0; k < m.p.length; k += 3) {
    m.p[k] *= sx; m.p[k + 1] *= sy; m.p[k + 2] *= sz;
    const nx = m.n[k] / sx, ny = m.n[k + 1] / sy, nz = m.n[k + 2] / sz, l = Math.hypot(nx, ny, nz) || 1;
    m.n[k] = nx / l; m.n[k + 1] = ny / l; m.n[k + 2] = nz / l;
  }
  return m;
}
/** Dark bars on a lit sign, like the strokes of letters (no real words: they read as signs from any language). */
function glyphs(B, M, w, h, R, n = 4) {
  if (DETAIL.k < 1) return; // (too small for the table: not on the glasses)
  for (let k = 0; k < n; k++) {
    const gy = h * (0.35 - (k / Math.max(1, n - 1)) * 0.7), gw = w * (0.3 + R() * 0.4);
    B.get('plain').add(box(gw, h * 0.07, 0.02), M.clone().mul(trs((R() - 0.5) * (w - gw) * 0.6, gy, 0)), [0.05, 0.04, 0.08]);
  }
}

/** A tube striped in two colours, `bands` long (along its points), into batch `key`. */
function stripedTube(B, key, pts, r, colors, bands, segs = 6) {
  if (DETAIL.k < 1) bands = Math.max(2, Math.round(bands * 0.6)); // (fewer, longer stripes for the glasses)
  // resample the path evenly, then lay one short tube per band
  const len = [0];
  for (let k = 1; k < pts.length; k++) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]));
  const total = len[len.length - 1], at = (s) => {
    let k = 1;
    while (k < pts.length - 1 && len[k] < s) k++;
    const t = (s - len[k - 1]) / Math.max(1e-6, len[k] - len[k - 1]);
    return pts[k - 1].map((v, i) => v + (pts[k][i] - v) * t);
  };
  const rad = (s) => (Array.isArray(r) ? r[0] + (r[1] - r[0]) * (s / total) : r);
  for (let b = 0; b < bands; b++) {
    const s0 = (b / bands) * total, s1 = ((b + 1) / bands) * total;
    B.get(key).add(tube([at(s0), at((s0 + s1) / 2), at(s1)], [rad(s0), rad((s0 + s1) / 2), rad(s1)], segs, { caps: b === 0 || b === bands - 1 }), null, colors[b % colors.length]);
  }
}

// --- trees ---------------------------------------------------------------------------------------------
/**
 * A tree of a neighbourhood at the plan's tree `t` (x, z, h, seed): cypress, plane, street, jacaranda, striped,
 * pine, rock. (The twisted and dead ones are props.js's own.)
 */
export function addHoodTree(B, t, style, { detail = 1, key = 'bark' } = {}) {
  const R = rng(Math.round(t.seed * 13) + 5);
  const lean = [(R() - 0.5) * 0.8, (R() - 0.5) * 0.8];
  const foliage = key === 'woods' ? 'woods' : 'plain';
  if (style === 'cypress') { // tall, dark, a flame of green, a little crooked
    const h = t.h * (0.9 + R() * 0.25);
    B.get(key).add(tube([[t.x, 0, t.z], [t.x + lean[0] * 0.2, h * 0.25, t.z + lean[1] * 0.2]], [0.18, 0.12], 6), null, [0.3, 0.22, 0.16]);
    const n = detail > 0.5 ? 6 : 3;
    for (let k = 0; k < n; k++) {
      const s = k / n, r = (1 - s) * 0.5 + 0.16, y = h * (0.2 + s * 0.7);
      B.get(foliage).add(blob(r, 8, { rand: R, jitter: 0.25, squashY: 2.4 }), trs(t.x + lean[0] * s * s, y, t.z + lean[1] * s * s), mixc([0.07, 0.15, 0.09], [0.05, 0.11, 0.08], R()));
    }
    return;
  }
  if (style === 'plane' || style === 'jacaranda' || style === 'street') { // a crooked trunk and a crown of puffs
    const h = t.h * (style === 'street' ? 0.7 : 0.82), top = [t.x + lean[0], h, t.z + lean[1]];
    B.get(key).add(tube([[t.x, 0, t.z], [t.x + lean[0] * 0.3, h * 0.5, t.z + lean[1] * 0.2], top], [0.32, 0.2, 0.13], 7), null, style === 'plane' ? [0.55, 0.5, 0.4] : [0.3, 0.24, 0.22]);
    if (style === 'street') { // a bare city tree in its square of earth, with a little iron guard
      for (let b = 0; b < 4; b++) {
        const a = (b / 4) * Math.PI * 2 + R(), l = 1.5 + R();
        B.get(key).add(tube([top, [top[0] + Math.cos(a) * l * 0.5, top[1] + l * 0.7, top[2] + Math.sin(a) * l * 0.5], [top[0] + Math.cos(a) * l, top[1] + l * 1.1, top[2] + Math.sin(a) * l]], [0.09, 0.05, 0.015], 5), null, [0.3, 0.24, 0.22]);
      }
      if (detail > 0.5) B.get('glossy').add(box(1.1, 0.35, 1.1), trs(t.x, 0.17, t.z), IRON);
      return;
    }
    const n = detail > 0.5 ? 7 : 4, colors = style === 'plane' ? [[0.12, 0.22, 0.1], [0.16, 0.27, 0.12]] : [[0.38, 0.24, 0.6], [0.3, 0.18, 0.52], [0.45, 0.3, 0.66]];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R(), r = k === 0 ? 0 : 0.6 + R() * 0.4, s = 0.65 + R() * 0.35;
      B.get(foliage).add(blob(s, 8, { rand: R, jitter: 0.3, squashY: 0.8 }), trs(top[0] + Math.cos(a) * r, top[1] + 0.3 + R() * 0.6, top[2] + Math.sin(a) * r), colors[k % colors.length]);
    }
    if (style === 'jacaranda' && detail > 0.5) for (let k = 0; k < 10; k++) { // blossom fallen round it
      const a = R() * Math.PI * 2, r = 0.6 + R() * 2.2;
      B.get('plain').add(blob(0.12 + R() * 0.1, 5, { squashY: 0.2 }), trs(t.x + Math.cos(a) * r, 0.02, t.z + Math.sin(a) * r), [0.6, 0.45, 0.82]);
    }
    return;
  }
  if (style === 'striped') { // black and white, twisting like the sandworms
    const pts = [];
    for (let k = 0; k <= 10; k++) { const s = k / 10; pts.push([t.x + Math.sin(s * 6 + R()) * 0.6 * s + lean[0] * s, s * t.h * 0.75, t.z + Math.cos(s * 5) * 0.5 * s + lean[1] * s]); }
    stripedTube(B, key === 'woods' ? 'woods' : 'plain', pts, [0.45, 0.08], [BLACK, WHITE], detail > 0.5 ? 9 : 5, detail > 0.5 ? 8 : 5);
    const tip = pts[10];
    B.get('plain').add(tube([tip, [tip[0] + 0.6, tip[1] + 0.8, tip[2]], [tip[0] + 1.2, tip[1] + 0.6, tip[2] + 0.2]], [0.08, 0.04, 0.01], 5), null, BLACK);
    return;
  }
  if (style === 'pine') { // a snowy fir: stacked cones, snow on every tier
    const h = t.h * (0.8 + R() * 0.25);
    B.get(key).add(cylinder(0.22, 0.16, h * 0.25, 6), trs(t.x, 0, t.z), [0.32, 0.22, 0.16]);
    const tiers = detail > 0.5 ? 5 : 3;
    for (let k = 0; k < tiers; k++) {
      const s = k / tiers, r = (1 - s * 0.75) * 1.9, y = h * (0.18 + s * 0.68), th = h * 0.32;
      const M = trs(t.x + lean[0] * s * 0.4, y, t.z + lean[1] * s * 0.4, (R() - 0.5) * 6, R() * 360, (R() - 0.5) * 6);
      B.get(foliage).add(cylinder(r, 0.05, th, 8), M, mixc([0.08, 0.26, 0.16], [0.06, 0.2, 0.14], R()));
      B.get(foliage).add(cylinder(r * 0.82, 0.05, th * 0.55, 8), M.clone().mul(trs(0, th * 0.45, 0)), SNOW);
    }
    return;
  }
  if (style === 'holo') { // the cyberpunk city: a slim lit pole and a crown of glowing rings, a hologram of a tree
    const h = t.h * 0.75, C1 = NEON[Math.floor(R() * 2) * 3 % 4], C2 = NEON[0];
    B.get('glossy').add(cylinder(0.14, 0.08, h * 0.62, 6), trs(t.x, 0, t.z), [0.16, 0.16, 0.2]);
    B.get('glossy').add(cylinder(0.6, 0.5, 0.35, 8), trs(t.x, 0, t.z), [0.14, 0.14, 0.18]);
    const rings = detail > 0.5 ? 4 : 2;
    for (let k = 0; k < rings; k++) {
      const y = h * (0.58 + k * 0.1), r = 1.5 * Math.sin(((k + 0.7) / (rings + 0.4)) * Math.PI) + 0.25;
      B.get('neon').add(tube(circleOutline(r, 14).concat([[r, 0]]).map(([x, z]) => [x, 0, z]), 0.04, 4, { caps: false }), trs(t.x, y, t.z, (R() - 0.5) * 16, 0, (R() - 0.5) * 16), k % 2 ? C1 : C2);
    }
    B.get('neon').add(blob(0.3, 6), trs(t.x, h * 0.72, t.z), mixc(C2, WHITE, 0.4));
    return;
  }
  if (style === 'tower') { // round the city: dark skyscrapers with strips of lit windows and a red light on top
    const w = 3.5 + R() * 2.5, h = 16 + R() * R() * 26, c = [0.1, 0.1, 0.13];
    const M = trs(t.x, 0, t.z, 0, R() * 90, 0);
    B.get('tower').add(box(w, h, w), M.clone().mul(trs(0, h / 2, 0)), c);
    if (R() < 0.5) B.get('tower').add(box(w * 0.6, h * 0.25, w * 0.6), M.clone().mul(trs(0, h + h * 0.125, 0)), c); // a setback
    const top = h * (1 + (R() < 0.5 ? 0.25 : 0));
    for (let f = 0; f < 4; f++) for (let k = 0; k < (detail > 0.2 ? 5 : 3); k++) { // floors of lit windows, here and there
      const col = mixc(NEON[(f + k + Math.floor(R() * 4)) % 4], [1, 0.88, 0.65], 0.6), bw = w * (0.35 + R() * 0.45);
      B.get('glow').add(box(bw, 0.32, 0.04), M.clone().mul(trs(0, 0, 0, 0, f * 90, 0)).mul(trs((R() - 0.5) * (w - bw), 1.5 + R() * (h - 3), w / 2 + 0.03)), col);
    }
    if (R() < 0.6) B.get('neon').add(box(w + 0.1, 0.2, w + 0.1), M.clone().mul(trs(0, h * (0.4 + R() * 0.4), 0)), NEON[Math.floor(R() * 4)]);
    B.get('emit').add(blob(0.25, 5), M.clone().mul(trs(0, top + 0.3, 0)), [1, 0.15, 0.1]);
    return;
  }
  if (style === 'rock') { // the Moon: a crooked pinnacle of rock and a few boulders round it
    const h = t.h * 0.55;
    B.get('rock').add(cylinder(0.75, 0.15, h, 6, { uvScale: 0.5 }), trs(t.x, 0, t.z, lean[0] * 6, R() * 360, lean[1] * 6), [0.5, 0.5, 0.52]);
    for (let k = 0; k < (detail > 0.5 ? 4 : 2); k++) {
      const a = R() * Math.PI * 2, r = 0.9 + R() * 1.2;
      B.get('rock').add(blob(0.3 + R() * 0.4, 6, { rand: R, jitter: 0.5, squashY: 0.6 }), trs(t.x + Math.cos(a) * r, 0.1, t.z + Math.sin(a) * r), [0.46, 0.46, 0.48]);
    }
  }
}

// --- street lamps ----------------------------------------------------------------------------------------
/** A street lamp of a neighbourhood; returns the light's world position (for its glow and its light). */
export function addHoodLamp(B, l, style, light) {
  const M = trs(l.x, 0, l.z, 0, l.yaw, 0);
  const at = (L, dy = 0.25) => { const p = L.getTranslation(); return [p.x, p.y + dy, p.z]; };
  const glass = mixc(light, [1, 1, 1], 0.25);
  if (style === 'paris' || style === 'farol' || style === 'lantern') { // an iron post, a lantern on top (Paris: two)
    B.get('glossy').add(lathe([[0.26, 0], [0.24, 0.2], [0.12, 0.35], [0.1, 0.8], [0.07, 2.6], [0.1, 2.8], [0.05, 3.0]], 10), M, IRON);
    const heads = style === 'paris' ? [[-0.45, 2.95], [0.45, 2.95]] : [[0, 3.0]];
    if (style === 'paris') B.get('glossy').add(tube([[-0.5, 2.9, 0], [-0.3, 3.1, 0], [0, 3.05, 0], [0.3, 3.1, 0], [0.5, 2.9, 0]], 0.03, 4), M, IRON);
    let last = null;
    for (const [hx, hy] of heads) {
      const L = M.clone().mul(trs(hx, hy, 0, 0, 45, 0));
      B.get('glossy').add(lathe([[0.04, 0], [0.16, 0.05], [0.22, 0.12], [0.22, 0.16]], 4), L, IRON);
      B.get('emit').add(cylinder(0.2, 0.26, 0.42, 4), L.clone().mul(trs(0, 0.16, 0)), glass);
      B.get('glossy').add(lathe([[0.34, 0], [0.2, 0.14], [0.06, 0.28], [0.02, 0.36]], 4), L.clone().mul(trs(0, 0.58, 0)), IRON);
      last = L;
    }
    return at(last, 0.4);
  }
  if (style === 'cobra') { // New York: a tall grey pole bending over the street, a flat head
    B.get('glossy').add(cylinder(0.14, 0.08, 4.4, 8), M, [0.32, 0.34, 0.36]);
    const arm = [[0, 4.3, 0], [0.2, 4.75, 0], [0.7, 4.95, 0], [1.4, 4.95, 0]];
    B.get('glossy').add(tube(arm, 0.06, 6), M, [0.32, 0.34, 0.36]);
    const L = M.clone().mul(trs(1.5, 4.88, 0));
    B.get('glossy').add(box(0.7, 0.16, 0.34), L, [0.3, 0.32, 0.34]);
    B.get('emit').add(box(0.55, 0.05, 0.26), L.clone().mul(trs(0, -0.09, 0)), light);
    return at(L, -0.3);
  }
  if (style === 'neon') { // the model town: a striped pole with a ring of green neon
    stripedTube(B, 'plain', [[0, 0, 0], [0, 1.6, 0], [0, 3.2, 0]].map(([x, y, z]) => { const p = M.clone().mul(trs(x, y, z)).getTranslation(); return [p.x, p.y, p.z]; }), 0.07, [BLACK, WHITE], 8);
    const L = M.clone().mul(trs(0, 3.35, 0));
    B.get('neon').add(tube(circleOutline(0.32, 12).concat([[0.32, 0]]).map(([x, y]) => [x, y, 0]), 0.04, 5, { caps: false }), L.clone().mul(trs(0, 0, 0, 0, 0, 0)), [0.5, 1, 0.4]);
    B.get('emit').add(blob(0.14, 8), L, light);
    return at(L, 0);
  }
  if (style === 'cane') { // the North Pole: a candy cane with its lantern hanging from the crook
    const crook = [[0, 0, 0], [0, 2.4, 0], [0.04, 3.0, 0], [0.2, 3.32, 0], [0.44, 3.42, 0], [0.64, 3.32, 0], [0.72, 3.1, 0]].map(([x, y, z]) => { const p = M.clone().mul(trs(x, y, z)).getTranslation(); return [p.x, p.y, p.z]; });
    stripedTube(B, 'plain', crook, 0.08, [[0.85, 0.1, 0.1], WHITE], 14);
    const L = M.clone().mul(trs(0.72, 2.66, 0));
    B.get('glossy').add(lathe([[0, -0.05], [0.12, 0], [0.19, 0.08], [0.2, 0.12], [0.08, 0.5]], 6), L, GOLD);
    B.get('emit').add(lathe([[0, 0.06], [0.15, 0.12], [0.15, 0.36], [0, 0.42]], 6), L, light);
    return at(L);
  }
  if (style === 'torch') { // Transylvania: an iron tripod with a fire basket
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      B.get('glossy').add(tube([[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], [Math.cos(a) * 0.12, 1.6, Math.sin(a) * 0.12], [0, 2.4, 0]], 0.04, 4), M, IRON);
    }
    const L = M.clone().mul(trs(0, 2.4, 0));
    B.get('glossy').add(lathe([[0.05, 0], [0.32, 0.12], [0.36, 0.34]], 8), L, IRON);
    B.get('emit').add(lathe([[0.22, 0.18], [0.16, 0.36], [0.06, 0.62], [0, 0.72]], 7, { shape: (a) => 1 + 0.3 * Math.sin(5 * a) }), L, [0.9, 0.32, 0.06]);
    B.get('emit').add(lathe([[0.12, 0.18], [0.08, 0.3], [0, 0.46]], 6), L, [1, 0.7, 0.2]); // (its hot heart)
    return at(L, 0.5);
  }
  if (style === 'neonpost') { // the cyberpunk city: a dark post with a tube of neon down it and a lit head
    B.get('glossy').add(box(0.16, 4.3, 0.16), M.clone().mul(trs(0, 2.15, 0)), [0.12, 0.12, 0.16]);
    B.get('neon').add(box(0.07, 1.9, 0.07), M.clone().mul(trs(0.12, 2.9, 0)), mixc(light, WHITE, 0.2));
    const L = M.clone().mul(trs(0.35, 4.3, 0));
    B.get('glossy').add(box(0.8, 0.12, 0.32), L, [0.12, 0.12, 0.16]);
    B.get('emit').add(box(0.66, 0.04, 0.24), L.clone().mul(trs(0, -0.07, 0)), light);
    return at(L, -0.3);
  }
  if (style === 'mast') { // the Moon: a thin mast, a blue beacon, a little solar panel
    B.get('glossy').add(cylinder(0.08, 0.05, 3.6, 6), M, [0.7, 0.72, 0.76]);
    B.get('glossy').add(box(0.9, 0.04, 0.5), M.clone().mul(trs(0.2, 2.6, 0, 30, 0, 0)), [0.12, 0.18, 0.4]);
    const L = M.clone().mul(trs(0, 3.7, 0));
    B.get('emit').add(blob(0.18, 8), L, light);
    return at(L, 0);
  }
  return null;
}

// --- the landmark in the plaza ---------------------------------------------------------------------------
/** Clock faces with hands (the round's clock creeps to midnight on them), round a frame `M`, `w` across. */
function clockFaces(app, B, clockMat, M, w, root, hands, faces = 4, r = 0.8) {
  for (let f = 0; f < faces; f++) {
    const FM = M.clone().mul(trs(0, 0, 0, 0, f * 90, 0)).mul(trs(0, 0, w / 2 + 0.02));
    B.get('plain').add(extrude(circleOutline(r * 1.1, 18), 0.1), FM, GOLD);
    const face = new Geo().add(flat(circleOutline(r, 24)), trs(0, 0, 0.06), [1, 1, 1]).build(app.graphicsDevice, clockMat, `clock-face-${f}`);
    const pivot = new Entity(`clock-${f}`);
    pivot.setLocalPosition(FM.getTranslation());
    pivot.setLocalEulerAngles(FM.getEulerAngles());
    pivot.addChild(face);
    const mk = (len, hw) => { const e = new Geo().add(extrude([[-hw, -0.1], [hw, -0.1], [hw * 0.5, len], [-hw * 0.5, len]], 0.03), trs(0, 0, 0.1), IRON).build(app.graphicsDevice, B.materials.plain, 'hand'); pivot.addChild(e); return e; };
    hands.push({ hour: mk(r * 0.52, 0.06), minute: mk(r * 0.85, 0.04) });
    root.addChild(pivot);
  }
}

/**
 * A neighbourhood's landmark in the middle of the plaza, inside the clock tower's footprint (TOWER_R): pisa,
 * eiffel, empire, obelisco, striped, pole, keep, rocket. Returns { root, hands, top } like the clock tower.
 */
export function addLandmark(app, B, clockMat, kind) {
  const root = new Entity(`landmark-${kind}`), hands = [];
  const R = rng(311);
  const base = (c) => B.get('masonry').add(lathe([[TOWER_R + 0.4, 0], [TOWER_R + 0.35, 0.3], [TOWER_R, 0.45], [TOWER_R, 0.9], [0, 0.9]], 10, { uvScale: 0.8 }), null, c);
  let top = 16;
  if (kind === 'pisa') { // the leaning bell tower: round tiers of arches, leaning (more than the real one)
    base([0.7, 0.66, 0.6]);
    let M = trs(0, 0.9, 0, 0, 0, 5);
    const marble = [0.88, 0.84, 0.76];
    for (let k = 0; k < 6; k++) {
      const h = k === 0 ? 3 : 2, r = 1.45 - k * 0.02;
      B.get('masonry').add(cylinder(r, r, h, 16, { uvScale: 0.6 }), M, marble);
      for (let c = 0; c < 12; c++) { // the arcade: columns round each tier
        const a = (c / 12) * 360;
        B.get('plain').add(cylinder(0.07, 0.07, h - 0.3, 6), M.clone().mul(trs(0, 0.15, 0, 0, a, 0)).mul(trs(0, 0, r + 0.12)), WHITE);
        B.get('glow').add(flat(archOutline(0.32, h * 0.55)), M.clone().mul(trs(0, h * 0.25, 0, 0, a + 15, 0)).mul(trs(0, 0, r + 0.01)), [0.9, 0.7, 0.4]);
      }
      B.get('plain').add(cylinder(r + 0.22, r + 0.22, 0.16, 16), M.clone().mul(trs(0, h - 0.08, 0)), marble);
      M = M.clone().mul(trs(0, h, 0, 0, 0, 0.35));
    }
    B.get('masonry').add(cylinder(0.95, 0.95, 1.6, 14, { uvScale: 0.6 }), M, marble);
    B.get('emit').add(lathe([[0, 0], [0.3, 0.05], [0.38, 0.5], [0.15, 0.7], [0, 0.72]], 10), M.clone().mul(trs(0, 0.3, 0)), [0.95, 0.75, 0.4]);
    B.get('shingle').add(lathe([[1.15, 0], [0.9, 0.25], [0.05, 1.2]], 12), M.clone().mul(trs(0, 1.6, 0)), [0.6, 0.26, 0.16]);
    top = M.getTranslation().y + 2.8;
  } else if (kind === 'eiffel') { // the iron lady: four bowed legs gathering into a spire, two platforms
    base([0.5, 0.46, 0.44]);
    const iron = [0.36, 0.26, 0.2], legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    const H = 15, at = (s) => { const w = 1.55 * Math.pow(1 - s, 1.8) + 0.12; return [w, 0.9 + s * H]; };
    for (const [sx, sz] of legs) {
      const pts = [];
      for (let k = 0; k <= 10; k++) { const s = k / 10, [w, y] = at(s); pts.push([sx * w, y, sz * w]); }
      B.get('glossy').add(tube(pts, pts.map((_, k) => 0.16 * (1 - k / 12) + 0.03), 6), null, iron);
    }
    for (let k = 1; k < 12; k++) { // cross bracing: the lattice
      const s = k / 12, [w, y] = at(s), [w2, y2] = at(s + 1 / 12);
      for (const [ax, az, bx, bz] of [[1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1], [-1, 1, 1, 1]]) {
        B.get('glossy').add(tube([[ax * w, y, az * w], [bx * w2, y2, bz * w2]], 0.025, 3, { caps: false }), null, iron);
      }
    }
    for (const s of [0.22, 0.5]) {
      const [w, y] = at(s);
      B.get('glossy').add(box(w * 2 + 0.6, 0.18, w * 2 + 0.6), trs(0, y, 0), iron);
      B.get('emit').add(box(w * 2 + 0.66, 0.05, w * 2 + 0.66), trs(0, y + 0.1, 0), [1, 0.78, 0.4]); // the lights along its decks
    }
    const arch = [];
    for (let k = 0; k <= 10; k++) { const a = (k / 10) * Math.PI; arch.push([-Math.cos(a) * 1.1, 0.9 + Math.sin(a) * 1.6, 0]); }
    for (const yaw of [0, 90]) for (const z of [1.18, -1.18]) B.get('glossy').add(tube(arch, 0.07, 5), trs(0, 0, 0, 0, yaw, 0).mul(trs(0, 0, z)), iron);
    B.get('emit').add(blob(0.25, 8), trs(0, 0.9 + H + 0.6, 0), [1, 0.85, 0.5]); // the beacon
    B.get('glossy').add(tube([[0, 0.9 + H - 0.5, 0], [0, 0.9 + H + 1.4, 0]], 0.04, 4), null, iron);
    top = 0.9 + H + 1.6;
  } else if (kind === 'empire') { // an Art Deco tower: setbacks, lit windows, a needle, a clock
    base([0.5, 0.5, 0.52]);
    let y = 0.9;
    const stone = [0.62, 0.6, 0.58];
    for (const [w, h] of [[2.9, 5], [2.3, 3.5], [1.7, 3], [1.1, 2]]) {
      B.get('masonry').add(box(w, h, w, 0.6), trs(0, y + h / 2, 0), stone);
      for (let f = 0; f < 4; f++) for (let c = -1; c <= 1; c++) { // strips of lit windows
        if (w < 1.5 && c !== 0) continue;
        B.get('glow').add(box(0.16, h * 0.82, 0.02), trs(0, y + h / 2, 0, 0, f * 90, 0).mul(trs(c * w * 0.3, 0, w / 2 + 0.01)), [1, 0.85, 0.55]);
      }
      if (w === 2.9) clockFaces(app, B, clockMat, trs(0, y + h + 0.0, 0).mul(trs(0, -1.1, 0)), w + 0.02, root, hands, 4, 0.55);
      y += h;
    }
    B.get('glossy').add(cylinder(0.32, 0.18, 1.6, 8), trs(0, y, 0), [0.7, 0.72, 0.76]);
    B.get('glossy').add(tube([[0, y + 1.5, 0], [0, y + 4.4, 0]], [0.08, 0.015], 5), null, [0.75, 0.76, 0.8]);
    B.get('emit').add(blob(0.12, 6), trs(0, y + 4.5, 0), [1, 0.25, 0.2]);
    top = y + 4.6;
  } else if (kind === 'obelisco') { // Buenos Aires: the tall white obelisk with its little window near the top
    B.get('masonry').add(box(3.2, 0.5, 3.2, 0.6), trs(0, 0.25, 0), [0.62, 0.62, 0.62]);
    const H = 15.5;
    B.get('plain').add(cylinder(1.55, 0.8, H, 4, { uvScale: 0.5 }), trs(0, 0.5, 0, 0, 45, 0), [0.88, 0.87, 0.84]);
    B.get('plain').add(cylinder(0.8, 0.02, 1.4, 4, { uvScale: 0.5 }), trs(0, 0.5 + H, 0, 0, 45, 0), [0.88, 0.87, 0.84]);
    for (let f = 0; f < 4; f++) B.get('glow').add(box(0.3, 0.45, 0.02), trs(0, 0.5 + H - 0.9, 0, 0, f * 90, 0).mul(trs(0, 0, 0.62)), [1, 0.85, 0.55]);
    top = 0.5 + H + 1.4;
  } else if (kind === 'striped') { // the model town's tower: twisting, striped, a clock and a neon crown
    base([0.12, 0.12, 0.12]);
    let M = trs(0, 0.9, 0);
    for (let k = 0; k < 7; k++) {
      const h = 1.6, w = 2.4 - k * 0.12;
      B.get('plain').add(box(w, h, w), M.clone().mul(trs(0, h / 2, 0)), k % 2 ? BLACK : WHITE);
      M = M.clone().mul(trs(0, h, 0, (R() - 0.5) * 4, 9, (R() - 0.5) * 4));
      if (k === 4) clockFaces(app, B, clockMat, M.clone().mul(trs(0, -h / 2, 0)), w + 0.04, root, hands, 4, 0.6);
    }
    const tip = [];
    for (let k = 0; k <= 10; k++) { const s = k / 10, a = s * Math.PI * 1.4; tip.push([(1 - Math.cos(a)) * 0.8, s * 3.2 + Math.sin(a) * 0.6, 0]); }
    const T = M;
    const tp = tip.map(([x, y, z]) => { const p = T.clone().mul(trs(x, y, z)).getTranslation(); return [p.x, p.y, p.z]; });
    stripedTube(B, 'plain', tp, [0.6, 0.05], [BLACK, WHITE], 10, 8);
    B.get('neon').add(tube(circleOutline(1.5, 18).concat([[1.5, 0]]).map(([x, z]) => [x, 0.3, z]), 0.06, 5, { caps: false }), M, [0.5, 1, 0.35]);
    B.get('neon').add(tube(circleOutline(1.2, 16).concat([[1.2, 0]]).map(([x, z]) => [x, 0.75, z]), 0.05, 5, { caps: false }), M, [0.85, 0.35, 1]);
    top = M.getTranslation().y + 4;
  } else if (kind === 'pole') { // the North Pole itself: a candy-striped pole, a golden ball, signposts and a clock
    B.get('snow').add(lathe([[TOWER_R + 0.5, 0], [TOWER_R + 0.2, 0.5], [0.4, 0.9], [0, 0.95]], 12), null, SNOW);
    stripedTube(B, 'plain', [[0, 0.5, 0], [0, 7, 0], [0, 13.5, 0]], 0.42, [[0.85, 0.1, 0.12], WHITE], 18, 12);
    B.get('glossy').add(blob(0.95, 14), trs(0, 14.4, 0), GOLD);
    B.get('emit').add(blob(1.05, 12), trs(0, 14.4, 0), [0.25, 0.2, 0.08]); // (its glow)
    B.get('plain').add(box(1.3, 1.3, 1.3), trs(0, 4.4, 0), [0.15, 0.4, 0.25]);
    clockFaces(app, B, clockMat, trs(0, 4.4, 0), 1.32, root, hands, 4, 0.5);
    for (const [y, yaw] of [[6.2, 20], [6.9, 140], [7.6, 260]]) { // signposts to everywhere
      B.get('wood').add(extrude([[0, -0.22], [1.6, -0.22], [1.95, 0], [1.6, 0.22], [0, 0.22]], 0.08), trs(0, y, 0, 0, yaw, (R() - 0.5) * 8).mul(trs(0.4, 0, 0)), [0.8, 0.7, 0.45]);
    }
    top = 15.4;
  } else if (kind === 'keep') { // Transylvania: a round stone keep, battlements, a pointed roof, a red banner and a clock
    base([0.34, 0.32, 0.36]);
    const stone = [0.4, 0.38, 0.42];
    B.get('masonry').add(cylinder(1.6, 1.4, 9, 14, { uvScale: 0.6 }), trs(0, 0.9, 0, 0, 0, 2), stone);
    for (let k = 0; k < 14; k++) { // merlons
      const a = (k / 14) * 360;
      B.get('masonry').add(box(0.45, 0.6, 0.35), trs(0, 9.9, 0, 0, a, 0).mul(trs(0, 0.3, 1.55)), stone);
    }
    for (let k = 0; k < 5; k++) B.get('glow').add(flat(archOutline(0.32, 0.8, { point: 0.6 })), trs(0, 2.2 + k * 1.4, 0, 0, k * 75, 0).mul(trs(0, 0, 1.52)), [1, 0.35, 0.2]);
    B.get('masonry').add(cylinder(1.0, 1.0, 1.6, 12), trs(0, 9.9, 0), stone);
    clockFaces(app, B, clockMat, trs(0, 10.7, 0), 2.0, root, hands, 4, 0.55);
    B.get('shingle').add(lathe([[1.3, 0], [1.05, 0.3], [0.05, 4.2]], 12), trs(0, 11.5, 0), [0.1, 0.08, 0.12]);
    B.get('glossy').add(tube([[0, 15.6, 0], [0, 17.2, 0]], 0.04, 4), null, IRON);
    B.get('plain').add(extrude([[0, 0], [1.2, 0.15], [1.0, -0.35], [1.2, -0.85], [0, -0.7]], 0.03), trs(0, 17.1, 0), [0.6, 0.06, 0.08]);
    top = 17.3;
  } else if (kind === 'rocket') { // the Moon: a rocket on its launch pad, ready for the trip home
    B.get('glossy').add(cylinder(TOWER_R + 0.3, TOWER_R + 0.3, 0.5, 16), null, [0.4, 0.42, 0.46]);
    const body = [[0.9, 0], [1.2, 1.5], [1.25, 6], [1.15, 9], [0.85, 11], [0.4, 12.6], [0.04, 13.4]];
    for (let k = 0; k < body.length - 1; k++) {
      B.get('glossy').add(lathe([body[k], body[k + 1]], 16), trs(0, 0.5, 0), k % 2 ? [0.85, 0.12, 0.1] : WHITE);
    }
    for (let f = 0; f < 4; f++) { // fins
      B.get('glossy').add(extrude([[0, 0], [1.3, -0.6], [1.4, 1.6], [0, 4]], 0.14), trs(0, 0.5, 0, 0, f * 90 + 45, 0).mul(trs(0.9, 0.2, 0, 0, 90, 0)), [0.85, 0.12, 0.1]);
    }
    for (let k = 0; k < 3; k++) B.get('glow').add(flat(circleOutline(0.3, 14)), trs(0, 0.5 + 4.5 + k * 2.2, 0, 0, k * 120, 0).mul(trs(0, 0, 1.26)), [0.6, 0.9, 1]);
    B.get('emit').add(lathe([[0.05, 0], [0.7, 0.1], [0.4, -1.2], [0.05, -1.6]], 10), trs(0, 0.5, 0), [1, 0.55, 0.2]); // the engine's glow
    for (let k = 0; k < 3; k++) { // the gantry
      const a = (k / 3) * Math.PI * 2 + 0.4;
      B.get('glossy').add(tube([[Math.cos(a) * 1.85, 0.5, Math.sin(a) * 1.85], [Math.cos(a) * 1.5, 7, Math.sin(a) * 1.5]], 0.07, 4), null, [0.55, 0.56, 0.6]);
    }
    top = 14;
  } else if (kind === 'spire') { // the cyberpunk city: a mega-tower in tiers edged with neon, a clock, a halo of light
    B.get('glossy').add(cylinder(TOWER_R + 0.35, TOWER_R + 0.45, 0.45, 16), null, [0.14, 0.14, 0.18]);
    let y = 0.45;
    const c = [0.16, 0.16, 0.21];
    [[3.0, 5.2], [2.5, 4.2], [2.1, 4], [1.7, 3.6], [1.25, 3.2]].forEach(([w, h], k) => {
      B.get('tower').add(box(w, h, w), trs(0, y + h / 2, 0, 0, k * 6, 0), c);
      const col = NEON[k % 2];
      for (let f = 0; f < 4; f++) {
        const F = trs(0, y, 0, 0, k * 6 + f * 90, 0);
        B.get('neon').add(box(w + 0.08, 0.1, 0.1), F.clone().mul(trs(0, h - 0.05, w / 2)), col); // its edge
        for (const cx of [-0.3, 0.3]) B.get('glow').add(box(0.14, h * 0.7, 0.03), F.clone().mul(trs(cx * w, h * 0.45, w / 2 + 0.02)), mixc(NEON[(f + k) % 4], [1, 0.95, 0.85], 0.55));
      }
      if (k === 1) clockFaces(app, B, clockMat, trs(0, y + h * 0.55, 0, 0, k * 6, 0), w + 0.02, root, hands, 4, 0.62);
      y += h;
    });
    B.get('neon').add(tube(circleOutline(2.7, 24).concat([[2.7, 0]]).map(([x, z]) => [x, 0, z]), 0.07, 5, { caps: false }), trs(0, y - 3, 0, 9, 0, 6), NEON[1]); // its halo
    B.get('neon').add(tube(circleOutline(2.1, 24).concat([[2.1, 0]]).map(([x, z]) => [x, 0, z]), 0.05, 5, { caps: false }), trs(0, y - 6.5, 0, -7, 0, 4), NEON[0]);
    B.get('glossy').add(tube([[0, y, 0], [0, y + 5, 0]], [0.18, 0.03], 5), null, [0.6, 0.62, 0.68]); // the needle
    B.get('emit').add(blob(0.16, 6), trs(0, y + 5.1, 0), [1, 0.15, 0.1]);
    top = y + 5.3;
  }
  return { root, hands, top };
}

// --- the far skyline -------------------------------------------------------------------------------------
/** Far silhouettes of a neighbourhood (lit by the fog only), ~140 m off: its hills, roofs and towers. */
export function addHoodSkyline(B, kind) {
  const R = rng(99), S = 'silhouette', col = [0.05, 0.05, 0.1];
  const ridge = (amp, base, color, jag = 0) => {
    const n = 96, m = { p: [], n: [], uv: [], i: [] };
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const h = base + amp * (0.5 + 0.5 * Math.sin(a * 3 + 1)) + amp * 0.4 * Math.sin(a * 7) + (jag ? (R() - 0.5) * jag : R() * 1.5);
      for (const [r, y] of [[150, -2], [150, h]]) { m.p.push(c * r, y, s * r); m.n.push(-c, 0, -s); m.uv.push(k, y); }
    }
    for (let k = 0; k < n; k++) { const a = k * 2; m.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    B.get(S).add(m, null, color);
  };
  const around = (n, rMin, rMax, fn) => { for (let k = 0; k < n; k++) { const a = R() * Math.PI * 2, r = rMin + R() * (rMax - rMin); fn(Math.cos(a) * r, Math.sin(a) * r, a); } };
  if (kind === 'tuscany') {
    ridge(6, 3, col);
    around(70, 132, 145, (x, z) => B.get(S).add(blob(1.2, 6, { squashY: 3.5 }), trs(x, 4 + R() * 6, z), [0.04, 0.05, 0.08])); // cypresses on the hills
    B.get(S).add(lathe([[9, 0], [9, 8], [7, 11], [4, 13.5], [0.6, 15], [0.6, 17]], 10), trs(-110, 0, -95), [0.05, 0.05, 0.09]); // a great dome far off
  } else if (kind === 'paris') {
    ridge(2, 4, col);
    around(55, 128, 140, (x, z) => { const w = 6 + R() * 6, h = 8 + R() * 6; B.get(S).add(box(w, h, 5), trs(x, h / 2, z, 0, R() * 360, 0), col); B.get(S).add(spireRoof(w, 5, 2.5), trs(x, h, z), col); });
    B.get(S).add(lathe([[6, 0], [6, 10], [5, 13], [2, 15.5], [0.3, 18]], 10), trs(30, 14, -138), col); // white domes on their hill
  } else if (kind === 'skyline') {
    ridge(0.5, 1, col);
    around(70, 125, 145, (x, z, a) => {
      const w = 5 + R() * 8, h = 18 + R() * R() * 55;
      B.get(S).add(box(w, h, w), trs(x, h / 2, z, 0, R() * 90, 0), [0.04, 0.04, 0.07]);
      if (R() < 0.3) B.get(S).add(cylinder(w * 0.3, 0.1, h * 0.25, 4), trs(x, h, z, 0, 45, 0), [0.04, 0.04, 0.07]);
      for (let k = 0; k < 6; k++) B.get('emit').add(box(0.6, 0.6, 0.2), trs(x + (R() - 0.5) * w * 0.8, R() * h, z, 0, (-a / D2R) + 90, 0).mul(trs(0, 0, w / 2 + 0.2)), [0.6, 0.48, 0.3]); // a few lit windows
    });
  } else if (kind === 'porteno') {
    ridge(1, 1.5, col);
    around(45, 125, 145, (x, z) => { const w = 6 + R() * 6, h = 14 + R() * 26; B.get(S).add(box(w, h, w), trs(x, h / 2, z, 0, R() * 90, 0), [0.04, 0.04, 0.08]); });
    for (let k = 0; k < 5; k++) { // the port's cranes
      const a = Math.PI * (0.2 + k * 0.08), x = Math.cos(a) * 140, z = Math.sin(a) * 140;
      B.get(S).add(tube([[x, 0, z], [x, 26, z], [x + 12, 27, z]], 0.8, 4), null, [0.05, 0.05, 0.09]);
    }
  } else if (kind === 'attic') { // the model sits in an attic: giant rafters overhead and a bare bulb (the sky's)
    ridge(1, 6, [0.08, 0.06, 0.06]);
    for (let k = -3; k <= 3; k++) B.get(S).add(box(320, 5, 6), trs(0, 80, k * 40, 0, 0, 0), [0.12, 0.08, 0.06]);
    for (const s of [-1, 1]) B.get(S).add(box(8, 6, 320), trs(s * 70, 76, 0), [0.1, 0.07, 0.05]);
    around(10, 120, 140, (x, z) => B.get(S).add(box(10 + R() * 15, 15 + R() * 20, 10), trs(x, 10, z, 0, R() * 90, 0), [0.07, 0.05, 0.05])); // boxes and old furniture
  } else if (kind === 'icebergs') {
    ridge(12, 2, [0.16, 0.22, 0.32], 9);
    around(30, 128, 142, (x, z) => B.get(S).add(cylinder(6 + R() * 6, 0.5, 14 + R() * 18, 5), trs(x, 0, z, 0, R() * 360, 0), [0.2, 0.26, 0.36]));
  } else if (kind === 'carpathians') {
    ridge(18, 6, [0.04, 0.03, 0.06], 6);
    const cx = -95, cz = -105, cy = 22; // the count's castle on its crag
    B.get(S).add(cylinder(14, 4, cy, 6), trs(cx, 0, cz), [0.03, 0.02, 0.05]);
    for (const [dx, dz, h] of [[0, 0, 16], [6, 3, 11], [-6, 2, 13], [3, -5, 19]]) {
      B.get(S).add(cylinder(2, 2, h, 8), trs(cx + dx, cy, cz + dz), [0.03, 0.02, 0.05]);
      B.get(S).add(cylinder(2.6, 0.1, 6, 8), trs(cx + dx, cy + h, cz + dz), [0.03, 0.02, 0.05]);
      B.get('glow').add(box(0.8, 1.4, 0.2), trs(cx + dx, cy + h - 3, cz + dz + 2.05), [1, 0.4, 0.2]);
    }
  } else if (kind === 'craters') {
    ridge(9, 1, [0.12, 0.12, 0.14], 7);
  } else if (kind === 'megacity') { // skyscrapers as far as the eye goes, lit windows and neon strips in the smog
    ridge(0.5, 1, col);
    around(95, 118, 150, (x, z, a) => {
      const w = 6 + R() * 10, h = 26 + R() * R() * 95, yaw = R() * 90;
      B.get(S).add(box(w, h, w), trs(x, h / 2, z, 0, yaw, 0), [0.035, 0.03, 0.06]);
      if (R() < 0.35) B.get(S).add(cylinder(w * 0.35, 0.2, h * 0.3, 4), trs(x, h, z, 0, yaw + 45, 0), [0.035, 0.03, 0.06]);
      const face = trs(x, 0, z, 0, (-a / D2R) + 90, 0);
      for (let k = 0; k < 5; k++) B.get('emit').add(box(0.8, 0.5, 0.2), face.clone().mul(trs((R() - 0.5) * w * 0.8, R() * h, w / 2 + 0.3)), mixc(NEON[Math.floor(R() * 4)], [1, 0.85, 0.6], 0.6));
      if (R() < 0.45) B.get('emit').add(box(0.5, h * (0.3 + R() * 0.4), 0.2), face.clone().mul(trs((R() - 0.5) * w * 0.6, h * 0.45, w / 2 + 0.35)), NEON[Math.floor(R() * 2)]);
    });
  }
}

// --- the houses' finery ----------------------------------------------------------------------------------
/**
 * A floor's finery, on its front (local +Z, `M` the floor's frame, `f` its plan, `fh` its height): balconies
 * with flowers, fire escapes, shutters' colours, black-and-white stripes, neon edges, snow on the sills.
 */
export function floorFinery(B, S, M, f, fh, i, wall, trim, R) {
  const front = M.clone().mul(trs(0, 0, f.d / 2));
  if (S.balconies && i > 0 && R() < 0.75) { // a little balcony with an iron rail (and geraniums in Italy)
    const bw = Math.min(f.w * 0.55, 2.2), y = fh * 0.12;
    B.get('stone').add(box(bw, 0.12, 0.7), front.clone().mul(trs(0, y, 0.35)), dark(trim, 0.9));
    const bars = DETAIL.k < 1 ? 3 : 6; // (fewer bars for the glasses)
    for (let k = 0; k <= bars; k++) B.get('glossy').add(cylinder(0.02, 0.02, 0.6, 4), front.clone().mul(trs(-bw / 2 + (k / bars) * bw, y, 0.68)), IRON);
    B.get('glossy').add(box(bw, 0.04, 0.04), front.clone().mul(trs(0, y + 0.62, 0.68)), IRON);
    if (S.flowers) for (let k = 0; k < 5; k++) B.get('plain').add(blob(0.13, 6, { rand: R, jitter: 0.3 }), front.clone().mul(trs(-bw / 2 + 0.2 + (k / 4) * (bw - 0.4), y + 0.72, 0.62)), [[0.85, 0.15, 0.2], [0.95, 0.4, 0.55], [0.9, 0.85, 0.85]][k % 3]);
  }
  if (S.fireEscapes && i > 0) { // New York: an iron landing and a zigzag ladder on every floor
    const lw = Math.min(f.w * 0.7, 2.6), y = 0.1;
    B.get('glossy').add(box(lw, 0.06, 0.9), front.clone().mul(trs(0, y, 0.47)), IRON);
    B.get('glossy').add(box(lw, 0.04, 0.04), front.clone().mul(trs(0, y + 0.85, 0.9)), IRON);
    for (const s of [-1, 1]) B.get('glossy').add(box(0.04, 0.85, 0.04), front.clone().mul(trs(s * lw / 2, y + 0.42, 0.9)), IRON);
    B.get('glossy').add(tube([[-lw / 2 + 0.2, y - fh + 0.1, 0.55], [lw / 2 - 0.3, y, 0.55]], 0.03, 3), front, IRON); // the ladder to the floor below
  }
  if (S.stripes) { // black and white stripes down the walls (the model town's)
    for (let k = 0; k < 5; k++) B.get('plain').add(box(f.w * 0.1, fh * 0.98, 0.02), front.clone().mul(trs(-f.w * 0.4 + k * f.w * 0.2, fh / 2, 0.01)), BLACK);
  }
  if (S.billboards && i > 0 && R() < 0.5) { // a tall lit sign hung off the side, its letters dark strokes
    const s = R() < 0.5 ? -1 : 1, sh = fh * 0.85, col = (S.neonColors ?? NEON)[Math.floor(R() * 4) % (S.neonColors ?? NEON).length];
    const SG = M.clone().mul(trs(s * (f.w / 2 + 0.6), fh * 0.5, f.d * 0.25, 0, 90, 0));
    B.get('glossy').add(box(1.05, sh + 0.12, 0.14), SG, [0.08, 0.08, 0.1]);
    B.get('neon').add(box(0.9, sh, 0.16), SG, col);
    for (const side of [1, -1]) glyphs(B, SG.clone().mul(trs(0, 0, side * 0.09, 0, side > 0 ? 0 : 180, 0)), 0.9, sh, R);
    B.get('glossy').add(box(0.6, 0.06, 0.06), M.clone().mul(trs(s * (f.w / 2 + 0.3), fh * 0.5 + sh / 2, f.d * 0.25)), IRON); // its bracket
  }
  if (S.neon) { // neon along the floor's edges
    const c = (S.neonColors ?? [[0.5, 1, 0.35], [0.85, 0.35, 1], [1, 0.55, 0.15]])[i % (S.neonColors?.length ?? 3)];
    B.get('neon').add(box(f.w + 0.1, 0.06, 0.06), front.clone().mul(trs(0, fh - 0.12, 0.08)), c);
    for (const s of [-1, 1]) B.get('neon').add(box(0.06, fh * 0.9, 0.06), front.clone().mul(trs(s * (f.w / 2 + 0.05), fh / 2, 0.08)), c);
  }
  if (S.snow) B.get('snow').add(box(f.w + 0.36, 0.12, f.d + 0.36), M.clone().mul(trs(0, fh + 0.1, 0)), SNOW); // snow on the cornice
  if (S.lights && i === 0) for (let k = 0; k < 9; k++) { // a string of coloured lights under the first cornice
    const x = -f.w / 2 + (k / 8) * f.w;
    B.get('neon').add(blob(0.07, 5), front.clone().mul(trs(x, fh - 0.3 - Math.sin((k / 8) * Math.PI) * 0.15, 0.2)), [[1, 0.2, 0.2], [0.2, 1, 0.3], [0.3, 0.5, 1], [1, 0.85, 0.2]][k % 4]);
  }
}

/**
 * A roof of a neighbourhood on the top floor (`roofM` at its eaves, `tf` its plan): hip (low terracotta),
 * mansard (with dormers), flat (a parapet; New York's water tower), dome, gable with snow. Returns true when it
 * drew one (else the house keeps its own spire or gable).
 */
export function hoodRoof(B, S, roofM, tf, h, roofC, trim, R, addWindow) {
  const w = tf.w + 0.6, d = tf.d + 0.6;
  switch (S.roof) {
    case 'hip':
      B.get('shingle').add(spireRoof(w + 0.3, d + 0.3, 1.6 + R() * 0.8, (R() - 0.5) * 0.4, 0), roofM, roofC);
      return true;
    case 'mansard': {
      const prof = (sx, sz, h2) => spireRoof(sx, sz, h2);
      B.get('shingle').add(prof(w, d, 5.2), roofM, roofC); // (cut by the flat top below: a steep zinc slope)
      B.get('shingle').add(box(w * 0.5, 0.25, d * 0.5), roofM.clone().mul(trs(0, 2.7, 0)), dark(roofC, 0.8));
      for (const x of [-w * 0.25, w * 0.25]) { // dormers with round-topped windows
        const DM = roofM.clone().mul(trs(x, 0.7, d / 2 - 0.65, -18, 0, 0));
        B.get('plain').add(box(0.9, 1.1, 0.7), DM.clone().mul(trs(0, 0.55, 0)), trim);
        addWindow(B, R, DM.clone().mul(trs(0, 0, 0.36)), 0, 0.55, 0.5, 0.75, { kind: 'arch', lit: R() < 0.8, roll: 0, trim });
      }
      for (let k = 0; k < 2; k++) B.get('masonry').add(box(0.5, 1.4, 0.4), roofM.clone().mul(trs((k ? 1 : -1) * w * 0.35, 2.4, -d * 0.2)), [0.62, 0.35, 0.3]); // chimney pots
      return true;
    }
    case 'flat': {
      B.get('plain').add(box(w, 0.7, d), roofM.clone().mul(trs(0, 0.35, 0)), dark(roofC, 1.2));
      B.get('stone').add(box(w + 0.2, 0.18, d + 0.2), roofM.clone().mul(trs(0, 0.75, 0)), trim);
      if (S.waterTowers && R() < 0.85) { // a wooden water tank on iron legs
        const x = (R() - 0.5) * w * 0.4, z = (R() - 0.5) * d * 0.4, TM = roofM.clone().mul(trs(x, 0.7, z));
        for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.78; B.get('glossy').add(tube([[Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7], [Math.cos(a) * 0.6, 1.4, Math.sin(a) * 0.6]], 0.05, 4), TM, IRON); }
        B.get('wood').add(cylinder(0.8, 0.75, 1.8, 12, { uvScale: 0.5 }), TM.clone().mul(trs(0, 1.4, 0)), [0.42, 0.3, 0.22]);
        B.get('shingle').add(cylinder(0.9, 0.05, 0.8, 12), TM.clone().mul(trs(0, 3.2, 0)), [0.25, 0.2, 0.18]);
      } else if (S.billboards) { // a big lit billboard on a frame, an antenna mast with a red light, a dish
        const BM = roofM.clone().mul(trs((R() - 0.5) * w * 0.3, 0.75, -d * 0.15, 0, (R() - 0.5) * 30, 0)), bw = w * 0.8, bh = 1.8 + R() * 0.8;
        for (const sx of [-1, 1]) B.get('glossy').add(box(0.12, bh + 0.8, 0.12), BM.clone().mul(trs(sx * bw * 0.4, (bh + 0.8) / 2, 0)), IRON);
        const P = BM.clone().mul(trs(0, 0.8 + bh / 2, 0.08)), col = (S.neonColors ?? NEON)[Math.floor(R() * 4) % (S.neonColors ?? NEON).length];
        B.get('neon').add(box(bw, bh, 0.1), P, col);
        glyphs(B, P.clone().mul(trs(0, 0, 0.06)), bw, bh, R, 3);
        B.get('glossy').add(box(bw + 0.15, bh + 0.15, 0.06), P.clone().mul(trs(0, 0, -0.08)), [0.08, 0.08, 0.1]);
        if (S.antennas) {
          const ax = w * 0.32 * (R() < 0.5 ? -1 : 1);
          B.get('glossy').add(tube([[ax, 0.8, d * 0.25], [ax, 4.6, d * 0.25]], [0.06, 0.02], 4), roofM, [0.55, 0.56, 0.6]);
          B.get('emit').add(blob(0.1, 5), roofM.clone().mul(trs(ax, 4.7, d * 0.25)), [1, 0.15, 0.1]);
          B.get('glossy').add(lathe([[0, 0], [0.5, 0.16], [0.55, 0.2]], 10), roofM.clone().mul(trs(-ax * 0.6, 1.3, d * 0.3, -35, 0, 15)), [0.75, 0.76, 0.8]);
        }
      } else if (!S.waterTowers) { // a rooftop terrace's rail and a water tank (Buenos Aires)
        B.get('glossy').add(cylinder(0.45, 0.45, 0.9, 10), roofM.clone().mul(trs(w * 0.25, 0.8, -d * 0.2)), [0.85, 0.85, 0.85]);
        for (let k = 0; k <= 8; k++) B.get('glossy').add(cylinder(0.02, 0.02, 0.6, 4), roofM.clone().mul(trs(-w / 2 + (k / 8) * w, 0.85, d / 2)), IRON);
      }
      return true;
    }
    case 'dome': {
      const r = Math.min(w, d) * 0.55;
      B.get('masonry').add(cylinder(r + 0.1, r + 0.1, 0.4, 14), roofM, trim);
      const prof = [];
      for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI / 2; prof.push([Math.cos(a) * r, 0.4 + Math.sin(a) * r * (S.style === 'moon' ? 1 : 1.2)]); }
      B.get(S.style === 'moon' ? 'glossy' : 'shingle').add(lathe(prof, 16), roofM, roofC);
      if (S.antennas) {
        B.get('glossy').add(tube([[r * 0.3, r + 0.2, 0], [r * 0.45, r + 2.4, 0.1]], 0.03, 4), roofM, [0.75, 0.76, 0.8]);
        B.get('emit').add(blob(0.09, 6), roofM.clone().mul(trs(r * 0.45, r + 2.5, 0.1)), [1, 0.3, 0.25]);
        B.get('glossy').add(lathe([[0, 0], [0.55, 0.18], [0.6, 0.22]], 12), roofM.clone().mul(trs(-r * 0.4, r * 0.85, 0, -30, 0, 20)), [0.82, 0.84, 0.88]); // a dish
      }
      return true;
    }
    case 'gable': if (S.snow) {
      const gM = roofM.clone().mul(trs(0, 0, 0, 0, -90, 0));
      B.get('shingle').add(gableRoof(d + 0.2, w, h.roof.h * 0.8, 0.3), gM, roofC);
      B.get('snow').add(gableRoof(d + 0.35, w + 0.15, h.roof.h * 0.8, 0.3), gM.clone().mul(trs(0, 0.12, 0)), SNOW);
      if (S.icicles) for (let k = 0; k < 10; k++) for (const z of [-1, 1]) {
        B.get('ice').add(cylinder(0.06, 0.005, 0.3 + R() * 0.45, 4), roofM.clone().mul(trs(-w / 2 + (k + 0.5) * (w / 10), 0.02, z * (d / 2 + 0.1), 180, 0, 0)), [0.8, 0.9, 1]);
      }
      return true;
    }
  }
  return false;
}

/** The house's top finery after its roof: battlements and gargoyles (Transylvania). */
export function topFinery(B, S, TM, tf, tfh, R) {
  if (S.battlements) for (let k = 0; k < 6; k++) for (const z of [-1, 1]) B.get('masonry').add(box(0.35, 0.5, 0.25), TM.clone().mul(trs(-tf.w / 2 + 0.2 + (k / 5) * (tf.w - 0.4), tfh + 0.3, z * tf.d / 2)), [0.36, 0.34, 0.38]);
  if (S.gargoyles) for (const s of [-1, 1]) { // a squat stone imp on each front corner
    const G = TM.clone().mul(trs(s * tf.w / 2, tfh - 0.1, tf.d / 2 + 0.1, 0, s * 30, 0));
    B.get('rock').add(blob(0.28, 7, { squashY: 1.2 }), G, [0.38, 0.36, 0.4]);
    B.get('rock').add(blob(0.18, 6), G.clone().mul(trs(0, 0.32, 0.12)), [0.38, 0.36, 0.4]);
    for (const w of [-1, 1]) B.get('rock').add(extrude([[0, 0], [0.45, 0.25], [0.3, -0.05]], 0.03), G.clone().mul(trs(w * 0.18, 0.1, -0.05, 0, w > 0 ? 0 : 180, 20)), [0.34, 0.32, 0.36]);
    B.get('emit').add(blob(0.03, 4), G.clone().mul(trs(0.06, 0.36, 0.28)), [1, 0.2, 0.15]);
    B.get('emit').add(blob(0.03, 4), G.clone().mul(trs(-0.06, 0.36, 0.28)), [1, 0.2, 0.15]);
  }
}

/** The porch's finery: a café awning (Paris), a fileteado sign (Buenos Aires), a wreath (North Pole), a coffin. */
export function porchFinery(B, S, H, doorX, dw, dh, stepTop, front, R) {
  if (S.awnings) { // a striped awning over the door, a café table and two chairs
    const A = H.clone().mul(trs(doorX, stepTop + dh + 0.5, front + 0.6, 22, 0, 0));
    const n = 7, aw = dw + 1.6;
    for (let k = 0; k < n; k++) B.get('plain').add(box(aw / n, 0.06, 1.4), A.clone().mul(trs(-aw / 2 + (k + 0.5) * aw / n, 0, 0)), k % 2 ? WHITE : [0.7, 0.1, 0.12]);
    const T = H.clone().mul(trs(doorX + dw + 0.9, 0, front + 1.7));
    B.get('glossy').add(cylinder(0.04, 0.04, 0.75, 6), T, IRON);
    B.get('plain').add(cylinder(0.38, 0.38, 0.04, 12), T.clone().mul(trs(0, 0.75, 0)), [0.85, 0.85, 0.82]);
    for (const s of [-1, 1]) {
      B.get('glossy').add(box(0.4, 0.04, 0.4), T.clone().mul(trs(s * 0.6, 0.45, 0)), IRON);
      B.get('glossy').add(box(0.4, 0.45, 0.04), T.clone().mul(trs(s * 0.6, 0.68, s * 0.2)), IRON);
    }
  }
  if (S.signs) { // a fileteado sign: a dark board with a coloured frame and scrolls
    const SG = H.clone().mul(trs(doorX, stepTop + dh + 0.7, front + 0.12));
    B.get('plain').add(box(dw + 1.4, 0.7, 0.08), SG, [0.08, 0.06, 0.08]);
    B.get('emit').add(box(dw + 1.5, 0.06, 0.1), SG.clone().mul(trs(0, 0.36, 0)), [0.95, 0.75, 0.2]);
    B.get('emit').add(box(dw + 1.5, 0.06, 0.1), SG.clone().mul(trs(0, -0.36, 0)), [0.95, 0.75, 0.2]);
    for (const s of [-1, 1]) {
      B.get('emit').add(tube(circleOutline(0.22, 10).map(([x, y]) => [s * (dw / 2 + 0.4) + x * 0.8, y, 0.06]), 0.025, 4, { caps: false }), SG, [0.9, 0.2, 0.25]);
      B.get('emit').add(tube([[s * 0.15, -0.15, 0.06], [s * 0.45, 0.12, 0.06], [s * (dw / 2), -0.05, 0.06]], 0.025, 4), SG, [0.2, 0.7, 0.9]);
    }
  }
  if (S.wreaths) { // a wreath with a red bow
    const W = H.clone().mul(trs(doorX, stepTop + dh * 0.72, front + 0.32));
    B.get('plain').add(tube(circleOutline(0.28, 12).concat([[0.28, 0]]).map(([x, y]) => [x, y, 0]), 0.09, 5, { caps: false }), W, [0.1, 0.35, 0.16]);
    B.get('plain').add(blob(0.1, 6), W.clone().mul(trs(0, -0.3, 0.05)), [0.85, 0.08, 0.1]);
  }
  if (S.gargoyles && R() < 0.6) { // a coffin leaning by the door
    const K = H.clone().mul(trs(doorX + (doorX > 0 ? -1 : 1) * (dw + 0.9), 0, front + 0.5, -12, 0, 0));
    B.get('wood').add(extrude([[-0.25, 0], [0.25, 0], [0.38, 1.3], [0.22, 1.8], [-0.22, 1.8], [-0.38, 1.3]], 0.3), K, [0.22, 0.12, 0.1]);
    B.get('plain').add(box(0.06, 0.8, 0.02), K.clone().mul(trs(0, 1.1, 0.16)), GOLD);
    B.get('plain').add(box(0.4, 0.06, 0.02), K.clone().mul(trs(0, 1.3, 0.16)), GOLD);
  }
}

// --- each neighbourhood's own things -------------------------------------------------------------------
/** The neighbourhood's own odds and ends round the village (none on the plan's colliders' ground). */
export function addHoodExtras(B, T) {
  const R = rng(2024);
  const between = (i, j, y, fn) => { const a = HOUSES[i], b = HOUSES[(j + 8) % 8]; fn(a, b, y); };
  if (T.name === 'italy') { // laundry lines strung between neighbouring houses, sheets and shirts on them
    for (let i = 0; i < 7; i++) between(i, i + 1, 4.2 + R(), (a, b, y) => {
      const pa = [a.x + (b.x - a.x) * 0.18, y, a.z + (b.z - a.z) * 0.18], pb = [b.x + (a.x - b.x) * 0.18, y, b.z + (a.z - b.z) * 0.18];
      const mid = [(pa[0] + pb[0]) / 2, y - 0.8, (pa[2] + pb[2]) / 2];
      B.get('plain').add(tube([pa, mid, pb], 0.015, 3, { caps: false }), null, [0.85, 0.85, 0.8]);
      const yaw = Math.atan2(pb[0] - pa[0], pb[2] - pa[2]) / D2R + 90;
      for (let k = 1; k < 6; k++) {
        const t = k / 6, s = 4 * t * (1 - t), x = pa[0] + (pb[0] - pa[0]) * t, z = pa[2] + (pb[2] - pa[2]) * t, yy = y - 0.8 * s;
        B.get('plain').add(box(0.5 + R() * 0.3, 0.6 + R() * 0.3, 0.02), trs(x, yy - 0.35, z, 0, yaw, (R() - 0.5) * 10), [[0.95, 0.95, 0.92], [0.85, 0.25, 0.25], [0.3, 0.5, 0.8], [0.95, 0.85, 0.4]][Math.floor(R() * 4)]);
      }
    });
  }
  if (T.name === 'newyork') { // fire hydrants and green street signs along the ring, its yellow line drawn in village.js
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + 0.4, r = ringR(a) + 2.7, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (k % 2) {
        B.get('glossy').add(cylinder(0.16, 0.14, 0.55, 8), trs(x, 0, z), [0.75, 0.1, 0.08]);
        B.get('glossy').add(blob(0.15, 7), trs(x, 0.58, z), [0.75, 0.1, 0.08]);
      } else {
        B.get('glossy').add(cylinder(0.04, 0.04, 2.6, 5), trs(x, 0, z), [0.35, 0.36, 0.38]);
        B.get('plain').add(box(0.9, 0.22, 0.03), trs(x, 2.5, z, 0, a / D2R, 0), [0.1, 0.42, 0.22]);
        B.get('plain').add(box(0.9, 0.22, 0.03), trs(x, 2.25, z, 0, a / D2R + 90, 0), [0.1, 0.42, 0.22]);
      }
    }
  }
  if (T.name === 'modeltown') { // the striped sandworms rising out of the ground round the village, and neon signs
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.6, r = 38 + R() * 4, x = Math.cos(a) * r, z = Math.sin(a) * r;
      for (let s = 0; s < 2; s++) {
        const pts = [];
        for (let j = 0; j <= 12; j++) { const t = j / 12, b = t * Math.PI; pts.push([x + Math.cos(a + 1.6) * (t - 0.5) * 10 + s * 5 * Math.cos(a), Math.sin(b) * (5 + s * 2) - 1, z + Math.sin(a + 1.6) * (t - 0.5) * 10 + s * 5 * Math.sin(a)]); }
        stripedTube(B, 'woods', pts, [1.1, 0.6], [BLACK, WHITE], 14, 9);
      }
    }
    for (let k = 0; k < 6; k++) { // neon signs on poles round the plaza: an arrow, a star, an eye
      const a = (k / 6) * Math.PI * 2 + 0.25, r = PLAZA_R + 1.6, x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = a / D2R + 90;
      B.get('glossy').add(cylinder(0.05, 0.05, 2.8, 5), trs(x, 0, z), BLACK);
      const M = trs(x, 3.1, z, 0, yaw, 0), c = [[0.5, 1, 0.35], [0.9, 0.35, 1], [1, 0.55, 0.15]][k % 3];
      const shape = k % 3 === 0 ? [[-0.6, 0.1], [0.2, 0.1], [0.2, 0.35], [0.7, 0], [0.2, -0.35], [0.2, -0.1], [-0.6, -0.1]]
        : k % 3 === 1 ? Array.from({ length: 10 }, (_, j) => { const r2 = j % 2 ? 0.22 : 0.55, b = (j / 10) * Math.PI * 2 + Math.PI / 2; return [Math.cos(b) * r2, Math.sin(b) * r2]; })
          : circleOutline(0.5, 14).map(([u, v]) => [u * 1.2, v * 0.55]);
      B.get('neon').add(tube(shape.concat([shape[0]]).map(([u, v]) => [u, v, 0]), 0.04, 4, { caps: false }), M, c);
      if (k % 3 === 2) B.get('neon').add(blob(0.16, 8), M, c); // (the eye's pupil)
    }
  }
  if (T.name === 'northpole') { // snowmen, presents and giant candy canes
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.5, r = PLAZA_R + 1.3, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (k % 2) { // a crooked snowman
        let y = 0;
        for (const [s, lean] of [[0.55, 0], [0.4, 4], [0.28, -6]]) { B.get('snow').add(blob(s, 10, { rand: R, jitter: 0.12 }), trs(x + lean * 0.01, y + s, z), SNOW); y += s * 1.75; }
        B.get('plain').add(cylinder(0.05, 0.005, 0.35, 5), trs(x, y - 0.25, z, 80, a / D2R + 180, 0), [0.95, 0.5, 0.1]);
        B.get('plain').add(cylinder(0.22, 0.22, 0.3, 10), trs(x, y - 0.05, z, 0, 0, 12), BLACK);
      } else { // a stack of presents
        for (let j = 0; j < 3; j++) {
          const s = 0.6 - j * 0.15, c = [[0.8, 0.1, 0.12], [0.1, 0.45, 0.25], [0.2, 0.35, 0.75]][j];
          const M = trs(x + (R() - 0.5) * 0.2, j * 0.5 + s / 2, z, 0, R() * 90, 0);
          B.get('plain').add(box(s, s, s), M, c);
          B.get('plain').add(box(s + 0.02, s + 0.02, 0.1), M, GOLD);
          B.get('plain').add(box(0.1, s + 0.02, s + 0.02), M, GOLD);
        }
      }
    }
    for (let k = 0; k < 5; k++) { // giant candy canes in the snow
      const a = (k / 5) * Math.PI * 2 + 0.15, r = 31 + R() * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, yaw = a / D2R;
      const M = trs(x, 0, z, 0, yaw, (R() - 0.5) * 12);
      const crook = [[0, 0, 0], [0, 4, 0], [0.1, 5, 0], [0.5, 5.6, 0], [1.1, 5.7, 0], [1.5, 5.4, 0], [1.6, 4.9, 0]].map(([u, v, w]) => { const p = M.clone().mul(trs(u, v, w)).getTranslation(); return [p.x, p.y, p.z]; });
      stripedTube(B, 'plain', crook, 0.22, [[0.85, 0.1, 0.12], WHITE], 16);
    }
  }
  if (T.name === 'transylvania') { // candelabras on the cemetery wall, bats on the far trees
    for (let k = 0; k < 4; k++) {
      const x = CEMETERY.x - CEMETERY.w / 2 + 1 + k * (CEMETERY.w - 2) / 3, z = CEMETERY.z + CEMETERY.d / 2 + 1.2;
      B.get('glossy').add(cylinder(0.05, 0.05, 1.2, 5), trs(x, 0, z), GOLD);
      for (const s of [-1, 0, 1]) {
        B.get('glossy').add(tube([[x, 1.1, z], [x + s * 0.3, 1.25, z], [x + s * 0.3, 1.45, z]], 0.025, 4), null, GOLD);
        B.get('plain').add(cylinder(0.04, 0.04, 0.2, 5), trs(x + s * 0.3, 1.45, z), WHITE);
        B.get('emit').add(blob(0.04, 5, { squashY: 1.6 }), trs(x + s * 0.3, 1.72, z), [1, 0.7, 0.3]);
      }
    }
  }
  if (T.name === 'cyberpunk') { // holo screens floating over the outer side of the ring street, under the air lanes
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.9, r = ringR(a) + 3, x = Math.cos(a) * r, z = Math.sin(a) * r, col = NEON[k % 4];
      const SM = trs(x, 5.3, z, 0, -a / D2R, (R() - 0.5) * 6);
      B.get('glossy').add(box(0.12, 1.9, 3.2), SM, [0.07, 0.07, 0.09]);
      B.get('neon').add(box(0.16, 1.7, 3.0), SM, col);
      for (const side of [1, -1]) glyphs(B, SM.clone().mul(trs(side * 0.09, 0, 0, 0, side * 90, 0)), 3.0, 1.7, R);
      B.get('emit').add(blob(0.12, 5), SM.clone().mul(trs(0, -1.1, 0)), [0.4, 0.9, 1]); // its little hover light
    }
  }
  if (T.name === 'moon') { // craters drawn in village.js; a pumpkin flag, a little rover
    const fx = 6.5, fz = -6.5;
    B.get('glossy').add(cylinder(0.04, 0.04, 3, 5), trs(fx, 0, fz), [0.8, 0.8, 0.82]);
    B.get('plain').add(box(1.3, 0.8, 0.02), trs(fx + 0.66, 2.55, fz), [0.95, 0.5, 0.1]);
    B.get('plain').add(flat([[-0.15, 0], [0.15, 0], [0, 0.22]]), trs(fx + 0.5, 2.6, fz + 0.012), BLACK);
    B.get('plain').add(flat([[-0.15, 0], [0.15, 0], [0, 0.22]]), trs(fx + 0.85, 2.6, fz + 0.012), BLACK);
    const rx = -7, rz = 7;
    B.get('glossy').add(box(1.6, 0.4, 1), trs(rx, 0.6, rz, 0, 30, 0), [0.85, 0.85, 0.88]);
    for (const [dx, dz] of [[-0.6, -0.55], [0.6, -0.55], [-0.6, 0.55], [0.6, 0.55]]) B.get('plain').add(cylinder(0.25, 0.25, 0.15, 10), trs(rx, 0.3, rz, 90, 30, 0).mul(trs(dx, dz, 0)), [0.25, 0.25, 0.28]);
    B.get('glossy').add(lathe([[0, 0], [0.4, 0.12], [0.45, 0.16]], 10), trs(rx, 1.4, rz, -30, 30, 0), [0.82, 0.84, 0.88]);
  }
}

/** Moon craters: rims of dust and dark floors, off the streets (the ground's own, under everything). */
export function addCraters(B) {
  const R = rng(77), spots = [];
  for (let k = 0; k < 26; k++) {
    const a = R() * Math.PI * 2, r = 4 + R() * (MAP_R + 25), x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.8 + R() * (r > MAP_R ? 5 : 1.6);
    const ringDist = Math.abs(Math.hypot(x, z) - ringR(Math.atan2(z, x)));
    if (r < MAP_R + 2 && (ringDist < 3.5 || Math.hypot(x, z) < PLAZA_R + 1 || CANDY_SPOTS.some(([cx, cz]) => Math.hypot(cx - x, cz - z) < s + 1))) continue;
    spots.push([x, z, s]);
  }
  for (const [x, z, s] of spots) {
    B.get('regolith').add(lathe([[s * 1.35, 0], [s * 1.1, s * 0.18], [s, s * 0.2], [s * 0.85, 0.02], [0, 0.02]], 16, { uvScale: 0.4 }), trs(x, 0.01, z), [0.48, 0.48, 0.5]);
    B.get('regolith').add(flat(circleOutline(s * 0.86, 16)), trs(x, 0.025, z, -90, 0, 0), [0.36, 0.36, 0.39]);
  }
}

// --- falling snow --------------------------------------------------------------------------------------------
/** Snow drifting down round the camera (the North Pole): two sheets of flakes falling and wrapping round. */
export function createSnowfall(app, glow) {
  const R = rng(31), g = new Geo(), H = 14, RAD = 16;
  for (let k = 0; k < 520; k++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * RAD, x = Math.cos(a) * r, z = Math.sin(a) * r, y = R() * H, s = 0.03 + R() * 0.05;
    for (const yaw of [0, 90]) g.add(flat(circleOutline(s, 5)), trs(x, y, z, 0, yaw, 0), [0.9, 0.95, 1]);
  }
  const m = new StandardMaterial();
  m.diffuse = new Color(0, 0, 0); m.emissive = new Color(1, 1, 1); m.emissiveVertexColor = true;
  if (glow) { m.emissiveMap = glow; m.opacityMap = glow; m.opacityMapChannel = 'a'; }
  m.blendType = BLEND_ADDITIVEALPHA; m.depthWrite = false; m.cull = CULLFACE_NONE; m.useFog = false; m.opacity = 0.8;
  m.update();
  const root = new Entity('snowfall');
  const sheets = [0, 1].map(() => { const e = g.build(app.graphicsDevice, m, 'snow-sheet'); e.render.castShadows = false; root.addChild(e); return e; });
  let t = 0;
  return {
    root,
    update(dt, cam) {
      t += dt;
      const fall = (t * 1.2) % H, sway = Math.sin(t * 0.7) * 0.6;
      root.setPosition(cam.x + sway, cam.y - 5, cam.z);
      sheets[0].setLocalPosition(0, -fall, 0);
      sheets[1].setLocalPosition(0, H - fall, 0);
    },
  };
}

// --- the cyberpunk city's flying traffic ----------------------------------------------------------------------
const PAINT = [[0.8, 0.08, 0.14], [0.08, 0.62, 0.72], [0.78, 0.8, 0.88]];
/**
 * A flying car (its nose +Z, its middle at the origin, ~4.3 m long) into B: a rounded body and a dark cabin, head
 * and tail lights, glowing thrusters under it. A taxi is yellow with a lit roof sign and a chequered band; a police
 * car dark blue with white sides and a light bar, its red and blue halves into `bar.red` / `bar.blue` (Geo) to flash.
 */
export function vehicleParts(B, kind, paint = 0, bar = null) {
  const body = kind === 'taxi' ? [1, 0.74, 0.02] : kind === 'police' ? [0.1, 0.14, 0.36] : PAINT[paint % PAINT.length];
  // (the body in `paint`: a glossy finish with a little light of its own, so its colour reads in the night)
  B.get('paint').add(box(1.7, 0.44, 3.0), null, body); // the chassis, its nose and tail rounded
  B.get('paint').add(ellipsoid(1.7, 0.44, 1.5, 10), trs(0, 0, 1.5), body);
  B.get('paint').add(ellipsoid(1.7, 0.44, 1.1, 10), trs(0, 0, -1.5), body);
  B.get('paint').add(ellipsoid(1.3, 0.72, 1.9, 10), trs(0, 0.22, -0.2), [0.04, 0.05, 0.08]); // the cabin's dark glass (one material less to draw)
  for (const sx of [-1, 1]) {
    B.get('paint').add(box(0.1, 0.36, 0.9), trs(sx * 0.86, 0.22, -1.45, 0, 0, sx * 14), mixc(body, BLACK, 0.35)); // fins
    B.get('emit').add(box(0.38, 0.12, 0.08), trs(sx * 0.5, 0.06, 2.24), [1, 0.95, 0.82]); // headlights
    for (const sz of [-1, 1]) B.get('emit').add(cylinder(0.18, 0.14, 0.06, 8), trs(sx * 0.55, -0.25, sz * 1.1), kind === 'taxi' ? [1, 0.55, 0.15] : [0.25, 0.75, 1]); // thrusters
  }
  B.get('emit').add(box(1.3, 0.1, 0.08), trs(0, 0.1, -2.04), [1, 0.08, 0.1]); // tail light
  if (kind === 'taxi') {
    B.get('emit').add(box(0.72, 0.2, 0.32), trs(0, 0.66, -0.15), [1, 0.85, 0.3]);
    for (const sx of [-1, 1]) for (let k = 0; k < 9; k++) B.get('paint').add(box(0.04, 0.12, 0.3), trs(sx * 0.86, -0.02 + (k % 2) * 0.12, -1.3 + k * 0.3, 0, 0, 0), k % 2 ? BLACK : [0.98, 0.95, 0.85]);
    for (const sx of [-1, 1]) B.get('emit').add(box(0.03, 0.04, 2.4), trs(sx * 0.87, -0.2, 0), [1, 0.78, 0.1]); // a yellow underglow
  } else if (kind === 'police') {
    for (const sx of [-1, 1]) B.get('paint').add(box(0.04, 0.16, 2.6), trs(sx * 0.86, 0.02, 0.1), WHITE);
    for (const sx of [-1, 1]) B.get('emit').add(box(0.03, 0.04, 2.4), trs(sx * 0.87, -0.2, 0), [0.25, 0.4, 1]); // a blue underglow
    B.get('paint').add(box(0.9, 0.08, 0.26), trs(0, 0.6, -0.2), [0.1, 0.1, 0.12]);
    if (bar) { bar.red.add(box(0.4, 0.14, 0.22), trs(-0.22, 0.7, -0.2), [1, 0.08, 0.08]); bar.blue.add(box(0.4, 0.14, 0.22), trs(0.22, 0.7, -0.2), [0.15, 0.35, 1]); }
  } else {
    for (const sx of [-1, 1]) B.get('emit').add(box(0.03, 0.04, 2.4), trs(sx * 0.87, -0.2, 0), [0.3, 0.9, 1]); // an underglow line
  }
}

/** One vehicle as an entity (`vehicle-<kind>`; a police car's lights as `police-red` / `police-blue` children). */
export function buildVehicle(app, materials, kind, paint = 0) {
  const B = new Batches(materials), bar = kind === 'police' ? { red: new Geo(), blue: new Geo() } : null;
  vehicleParts(B, kind, paint, bar);
  const e = B.build(app.graphicsDevice, 'village-dress'); // (its meshes named as the village's: the Lens dresses them alike)
  e.name = kind === 'car' ? `vehicle-car-${paint}` : `vehicle-${kind}`;
  if (bar) for (const [n, g] of [['police-red', bar.red], ['police-blue', bar.blue]]) {
    const holder = new Entity(n);
    holder.addChild(g.build(app.graphicsDevice, materials.emit, 'village-dress-emit'));
    e.addChild(holder);
  }
  for (const r of e.findComponents('render')) r.castShadows = false;
  return e;
}

/** The flying traffic (traffic.js's lanes and fleet), moved by `update(t)`; fewer cars with `lite`. */
export function createTraffic(app, materials, { lite = false } = {}) {
  const root = new Entity('traffic');
  const cars = (lite ? FLEET_LITE : FLEET).map((v) => {
    const e = buildVehicle(app, materials, v.kind, v.paint ?? 0);
    root.addChild(e);
    return { v, e, red: e.findByName('police-red'), blue: e.findByName('police-blue') };
  });
  return {
    root,
    update(t) {
      for (const c of cars) {
        const p = vehiclePose(c.v, t);
        c.e.setLocalPosition(p.x, p.y, p.z);
        c.e.setLocalEulerAngles(0, p.yaw, p.bank);
        if (c.red) { const r = policeRed(t, c.v); c.red.enabled = r; c.blue.enabled = !r; }
      }
    },
  };
}
