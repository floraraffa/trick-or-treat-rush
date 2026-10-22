// The haunted village as plain data, shared by the renderer (world/*.js), collisions
// (world/collide.js) and the session authority (game/authority.js): the same seed builds the same
// village on every device, so doors, candy spots and patrol routes agree everywhere.
//
// Plan (metres, +X east, -Z north): a round plaza with the clock tower in the middle, a winding ring
// street around it, eight crooked houses outside the ring facing the plaza, the Victorian cemetery in
// the northern gap, twisted woods all around. Compact on purpose: any house is ~5 s of running away.
import { rng } from '../rng.js';

export const MAP_R = 33; // playable radius (the woods and a crooked fence close it)
export const PLAZA_R = 9;
export const TOWER_R = 1.7;
export const CEMETERY = { x: 0, z: -25.5, w: 15, d: 10, gate: 3.2 }; // gate on its south (+Z) side
export const PLAYER_R = 0.35;

const D2R = Math.PI / 180;
export const ringR = (a) => 16 + 1.1 * Math.sin(3 * a + 0.7);
const polar = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];

/** Local (lx, lz) of something turned by `yaw` degrees and placed at (x, z) → world [x, z]. */
export function toWorld(x, z, yaw, lx, lz) {
  const c = Math.cos(yaw * D2R), s = Math.sin(yaw * D2R);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

// --- palette (linear-ish 0..1) ------------------------------------------------
export const PAL = {
  violet: [0.24, 0.14, 0.33], petrol: [0.1, 0.27, 0.33], night: [0.07, 0.08, 0.13], lavender: [0.55, 0.52, 0.64],
  moss: [0.32, 0.46, 0.24], rose: [0.78, 0.55, 0.6], pumpkin: [1, 0.48, 0.1], warm: [1, 0.8, 0.38],
  gold: [0.78, 0.6, 0.3], blood: [0.48, 0.08, 0.12], bone: [0.86, 0.82, 0.74], iron: [0.08, 0.07, 0.1],
};
const WALLS = [PAL.violet, PAL.petrol, PAL.lavender, PAL.moss, [0.5, 0.36, 0.42], [0.16, 0.18, 0.26], [0.36, 0.3, 0.46], [0.2, 0.33, 0.3]];
const TRIMS = [PAL.rose, PAL.gold, PAL.lavender, PAL.bone, PAL.rose, PAL.gold, PAL.bone, PAL.rose];
const ROOFS = [PAL.night, [0.2, 0.1, 0.2], [0.08, 0.16, 0.2], [0.15, 0.12, 0.2], PAL.night, [0.22, 0.12, 0.16], [0.1, 0.12, 0.16], [0.18, 0.1, 0.22]];
const DOORS = [PAL.blood, PAL.pumpkin, PAL.moss, [0.35, 0.15, 0.45], PAL.blood, [0.12, 0.3, 0.36], PAL.pumpkin, [0.4, 0.12, 0.2]];

// --- houses ---------------------------------------------------------------------
const NAMES = ['Crooked Manor', 'The Leaning Inn', 'Widow\'s Spire', 'Moth Cottage', 'Hollow House', 'Raven Roost', 'Lantern Lodge', 'Thimble Tower'];

function makeHouse(k) {
  const a = (-45 + k * (270 / 7)) * D2R; // eight houses, leaving the north to the cemetery
  const r = 24.5 + 0.7 * Math.sin(5 * a);
  const [x, z] = polar(a, r);
  const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) / D2R; // local +Z (the door) faces the plaza
  const R = rng(1000 + k * 77);
  const w = 4.6 + R() * 1, d = 4.4 + R() * 0.8;
  const nFloors = [3, 2, 4, 3, 2, 3, 4, 3][k];
  const floors = [];
  // Each house leans one way as it rises (Burton-crooked): floors drift, tilt and twist further up.
  const leanX = (R() > 0.5 ? 1 : -1) * (0.25 + R() * 0.3), leanZ = (R() - 0.5) * 0.3;
  let ox = 0, oz = 0, y = 0, twist = 0, tilt = 0;
  for (let f = 0; f < nFloors; f++) {
    const h = 2.7 + R() * 0.4 + (f === 0 ? 0.35 : 0);
    const grow = f === 0 ? 1 : 0.84 + R() * 0.3; // upper floors bulge out or pinch in
    const fw = (f === 0 ? w : floors[f - 1].w * grow), fd = (f === 0 ? d : floors[f - 1].d * (0.88 + R() * 0.2));
    if (f > 0) { ox += leanX + (R() - 0.5) * 0.35; oz += leanZ + (R() - 0.5) * 0.3; twist += (R() - 0.5) * 18; tilt += -leanX * 5; }
    floors.push({ w: fw, d: fd, h, x: ox, y, z: oz, yaw: twist, rx: f ? (R() - 0.5) * 6 : 0, rz: f ? tilt + (R() - 0.5) * 4 : 0 });
    y += h;
  }
  const roofH = 4.4 + R() * 3.4;
  const roof = { type: k % 3 === 1 ? 'gable' : 'spire', h: roofH, ax: -leanX * 1.6 + (R() - 0.5) * 0.8, az: (R() - 0.5) * 1, curl: R() > 0.3 };
  const tower = [true, false, true, false, true, false, false, true][k] ? { side: R() > 0.5 ? 1 : -1, r: 1 + R() * 0.25, h: y * (0.75 + R() * 0.3) } : null;
  const doorZ = d / 2;
  const [dx, dz] = toWorld(x, z, yaw, 0, doorZ + 1.35);
  return {
    id: k, name: NAMES[k], x, z, yaw, angle: a, w, d, floors, roof, tower, height: y + roofH, seed: 1000 + k * 77,
    wall: WALLS[k], trim: TRIMS[k], roofColor: ROOFS[k], doorColor: DOORS[k],
    door: { x: dx, z: dz, w: 1.25 + R() * 0.35, h: 2.75 + R() * 0.35 }, // oversized on purpose
  };
}
export const HOUSES = Array.from({ length: 8 }, (_, k) => makeHouse(k));
export const DOOR_RANGE = 2.3;

// --- streets --------------------------------------------------------------------
export const RING = Array.from({ length: 72 }, (_, k) => polar((k / 72) * Math.PI * 2, ringR((k / 72) * Math.PI * 2)));
export const RING_W = 4.4;

function curve(a, b, bend, n = 10) {
  const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  const cx = mx - (dz / l) * bend, cz = mz + (dx / l) * bend;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cz + t * t * b[1]];
  });
}
// Radial streets (east, south, west and north to the cemetery gate), then a footpath to each door.
export const STREETS = [
  ...[0, 90, 180].map((deg, i) => ({ w: 3.4, path: curve(polar(deg * D2R, PLAZA_R - 0.5), polar(deg * D2R, ringR(deg * D2R) + 0.2), i % 2 ? 1.2 : -1.2) })),
  { w: 3.4, path: curve(polar(-90 * D2R, PLAZA_R - 0.5), [0, CEMETERY.z + CEMETERY.d / 2 + 0.5], 1.4, 14) },
  { w: 2.2, path: curve([0, CEMETERY.z + CEMETERY.d / 2 - 0.5], [0, CEMETERY.z - CEMETERY.d / 2 + 2.8], 0.8) },
  ...HOUSES.map((h) => ({ w: 2.3, path: curve(polar(h.angle, ringR(h.angle) + 1.2), [h.door.x, h.door.z], (h.id % 2 ? 1 : -1) * 0.9, 8) })),
];

// --- props ------------------------------------------------------------------------
const R = rng(31337);
const jitter = (s) => (R() - 0.5) * s;

/** Twisted trees: between the houses, at the plaza corners, in the cemetery, and the woods outside the map. */
export const TREES = [];
for (let k = 0; k < 8; k++) {
  const a = (-45 + (k + 0.5) * (270 / 7)) * D2R;
  if (k < 7) { const [x, z] = polar(a + jitter(0.1), 28 + R() * 2); TREES.push({ x, z, h: 9 + R() * 4, seed: 50 + k }); }
}
for (const deg of [45, 135, 225, 315]) { const [x, z] = polar(deg * D2R, 12); TREES.push({ x, z, h: 7 + R() * 2, seed: 70 + deg }); }
for (const [x, z] of [[-6, -27], [6.2, -23], [-5, -21.6]]) TREES.push({ x, z, h: 7 + R() * 2, seed: 90 + x, dead: true });
export const WOODS = []; // outside the playable circle: silhouettes only, no collisions needed
for (let k = 0; k < 40; k++) {
  const a = (k / 40) * Math.PI * 2 + jitter(0.08), r = 36 + R() * 9;
  WOODS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: 10 + R() * 7, seed: 200 + k });
}
// Mid-ring copses on the east and west, between the radial streets.
for (const [x, z] of [[11.5, 4.5], [-11.5, -4.6], [4.2, 12.4], [-4, 12.6]]) TREES.push({ x: x + jitter(0.6), z: z + jitter(0.6), h: 6 + R() * 2.5, seed: 300 + x });

/** Crooked street lamps: around the plaza, along the ring, at the cemetery gate. */
export const LAMPS = [];
for (const deg of [22, 112, 202, 292]) { const [x, z] = polar(deg * D2R, PLAZA_R - 0.6); LAMPS.push({ x, z, yaw: deg, real: true }); }
for (let k = 0; k < 10; k++) {
  const a = ((k + 0.5) / 10) * Math.PI * 2 + 0.12, r = ringR(a) - RING_W / 2 - 0.5;
  const [x, z] = polar(a, r);
  LAMPS.push({ x, z, yaw: a / D2R + 180, real: k % 2 === 0 });
}
for (const s of [-1, 1]) LAMPS.push({ x: s * (CEMETERY.gate / 2 + 0.7), z: CEMETERY.z + CEMETERY.d / 2 + 0.6, yaw: 90, real: s > 0 });

/** Pumpkins: on every porch, around the plaza, along the streets and among the graves. */
export const PUMPKINS = [];
for (const h of HOUSES) {
  for (const side of [-1, 1]) {
    const [x, z] = toWorld(h.x, h.z, h.yaw, side * (h.door.w / 2 + 0.75), h.d / 2 + 0.55);
    PUMPKINS.push({ x, z, s: 0.55 + R() * 0.3, lit: side > 0 || R() > 0.5, yaw: h.yaw + jitter(40) });
  }
}
for (let k = 0; k < 10; k++) {
  const a = (k / 10) * Math.PI * 2 + 0.3; const [x, z] = polar(a, PLAZA_R + 0.4);
  if (Math.abs(Math.sin(a * 2)) > 0.25) PUMPKINS.push({ x, z, s: 0.45 + R() * 0.5, lit: R() > 0.4, yaw: a / D2R + 90 });
}
for (let k = 0; k < 7; k++) {
  const a = (k / 7) * Math.PI * 2 + 0.5, r = ringR(a) + RING_W / 2 + 0.6; const [x, z] = polar(a, r);
  PUMPKINS.push({ x, z, s: 0.5 + R() * 0.6, lit: R() > 0.5, yaw: a / D2R - 90 });
}
for (const [x, z] of [[-4.6, -24.3], [4.2, -26.6], [2.2, -22.4], [-6.4, -29.1]]) PUMPKINS.push({ x, z, s: 0.4 + R() * 0.3, lit: true, yaw: 180 + jitter(60) });

/** Tombstones on a loose grid inside the cemetery, leaning every which way, and the mausoleum. */
export const TOMBS = [];
for (let row = 0; row < 3; row++) {
  for (let col = 0; col < 5; col++) {
    if (col === 2 && row < 2) continue; // the central path
    const x = CEMETERY.x - 5.6 + col * 2.8 + jitter(0.6), z = CEMETERY.z + 2.6 - row * 2.3 + jitter(0.5);
    TOMBS.push({ x, z, kind: ['round', 'cross', 'obelisk', 'pointed', 'round'][(row * 5 + col) % 5], s: 0.85 + R() * 0.4, lean: jitter(18), tilt: jitter(10), yaw: jitter(16) });
  }
}
export const MAUSOLEUM = { x: CEMETERY.x, z: CEMETERY.z - CEMETERY.d / 2 + 1.7, w: 3.6, d: 2.6, h: 3.2 };

/** Picket fences in each front yard, splayed from the house corners towards the street. */
export const FENCES = [];
for (const h of HOUSES) {
  for (const side of [-1, 1]) {
    const a = toWorld(h.x, h.z, h.yaw, side * (h.w / 2 + 0.2), h.d / 2 - 0.4);
    const b = toWorld(h.x, h.z, h.yaw, side * (h.w / 2 + 1.4), h.d / 2 + 2.6);
    FENCES.push({ a, b, seed: h.id * 2 + (side > 0 ? 1 : 0), color: side > 0 ? h.trim : PAL.bone });
  }
}

/** Fantastical mushroom clusters and dark flower beds, tucked away from the streets. */
export const MUSHROOMS = [];
for (let k = 0; k < 14; k++) {
  const a = R() * Math.PI * 2, r = [5.5, 20.5, 29.5][k % 3] + jitter(1.2);
  MUSHROOMS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, n: 3 + Math.floor(R() * 4), seed: 400 + k });
}
export const FLOWERS = [];
for (let k = 0; k < 18; k++) {
  const a = R() * Math.PI * 2, r = 19.8 + R() * 1.5 + (k % 2) * 9;
  FLOWERS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, n: 5 + Math.floor(R() * 6), seed: 500 + k });
}
/** Odd topiary: spirals and stacked balls. */
export const BUSHES = [];
for (let k = 0; k < 12; k++) {
  const a = ((k + 0.25) / 12) * Math.PI * 2, r = 20.6 + jitter(0.6);
  BUSHES.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, kind: k % 3, seed: 600 + k });
}

// --- colliders ---------------------------------------------------------------------
// circle: { x, z, r, h } — box: { x, z, hx, hz, yaw, h } (yaw in degrees, like the houses)
export const COLLIDERS = [];
for (const h of HOUSES) {
  COLLIDERS.push({ kind: 'box', x: h.x, z: h.z, hx: h.w / 2 + 0.15, hz: h.d / 2 + 0.15, yaw: h.yaw, h: h.height });
  if (h.tower) {
    const [tx, tz] = toWorld(h.x, h.z, h.yaw, h.tower.side * (h.w / 2 + 0.2), h.d / 2 - 0.6);
    h.tower.x = tx; h.tower.z = tz;
    COLLIDERS.push({ kind: 'circle', x: tx, z: tz, r: h.tower.r + 0.1, h: h.tower.h + 4 });
  }
}
COLLIDERS.push({ kind: 'circle', x: 0, z: 0, r: TOWER_R + 0.15, h: 16 });
for (const t of TREES) COLLIDERS.push({ kind: 'circle', x: t.x, z: t.z, r: 0.55, h: t.h });
for (const l of LAMPS) COLLIDERS.push({ kind: 'circle', x: l.x, z: l.z, r: 0.22, h: 3.4 });
for (const t of TOMBS) COLLIDERS.push({ kind: 'circle', x: t.x, z: t.z, r: 0.42 * t.s, h: 1.4 });
COLLIDERS.push({ kind: 'box', x: MAUSOLEUM.x, z: MAUSOLEUM.z, hx: MAUSOLEUM.w / 2, hz: MAUSOLEUM.d / 2, yaw: 0, h: MAUSOLEUM.h + 1.2 });
for (const f of FENCES) {
  const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1];
  COLLIDERS.push({ kind: 'box', x: (f.a[0] + f.b[0]) / 2, z: (f.a[1] + f.b[1]) / 2, hx: 0.08, hz: Math.hypot(dx, dz) / 2, yaw: Math.atan2(dx, dz) / D2R, h: 1.1 });
}
// Cemetery railings (west, east, north, and the south side either side of the gate).
{
  const { x, z, w, d, gate } = CEMETERY, side = (w - gate) / 2;
  COLLIDERS.push({ kind: 'box', x: x - w / 2, z, hx: 0.08, hz: d / 2, yaw: 0, h: 1.8 });
  COLLIDERS.push({ kind: 'box', x: x + w / 2, z, hx: 0.08, hz: d / 2, yaw: 0, h: 1.8 });
  COLLIDERS.push({ kind: 'box', x, z: z - d / 2, hx: w / 2, hz: 0.08, yaw: 0, h: 1.8 });
  for (const s of [-1, 1]) COLLIDERS.push({ kind: 'box', x: x + s * (gate / 2 + side / 2), z: z + d / 2, hx: side / 2, hz: 0.08, yaw: 0, h: 1.8 });
}

// --- gameplay spots --------------------------------------------------------------------
/** Is (x, z) clear of every collider by `pad` metres (and inside the map)? */
export function isClear(x, z, pad = 0.6) {
  if (Math.hypot(x, z) > MAP_R - pad) return false;
  for (const c of COLLIDERS) {
    if (c.kind === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false; }
    else {
      const cs = Math.cos(c.yaw * D2R), sn = Math.sin(c.yaw * D2R), dx = x - c.x, dz = z - c.z;
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      if (Math.abs(lx) < c.hx + pad && Math.abs(lz) < c.hz + pad) return false;
    }
  }
  return true;
}

/** Where candy can appear: the ring street, the plaza, the garden paths, the cemetery and the alleys. */
export const CANDY_SPOTS = (() => {
  const out = [];
  for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2; out.push(polar(a, ringR(a))); }
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.2; out.push(polar(a, 5.6)); }
  for (const h of HOUSES) { const p = STREETS[5 + h.id].path; out.push(p[4]); }
  for (let k = 0; k < 8; k++) { const a = (-45 + (k + 0.5) * (270 / 7)) * D2R; out.push(polar(a, 22.5)); out.push(polar(a + 0.12, 30.5)); }
  for (const [x, z] of [[0, -22.5], [-3.6, -25.6], [3.4, -25.2], [-6, -24], [6, -27.5], [0, -26.8]]) out.push([x, z]);
  return out.filter(([x, z]) => isClear(x, z, 0.7));
})();

/** Where power-up orbs float. */
export const ORB_SPOTS = [[0, 5.5], [5.5, 0], [-5.5, 0], [0, -24.6], ...[0.5, 2.6, 4.7].map((k) => polar((-45 + k * (270 / 7)) * D2R, 30))].filter(([x, z]) => isClear(x, z, 0.6));

/** Player spawn points around the clock tower (up to four), facing out. */
export const SPAWNS = [45, 135, 225, 315].map((deg) => { const [x, z] = polar(deg * D2R, 5); return { x, z, yaw: Math.atan2(x, z) / D2R }; });

/** Patrol loops: ghosts drift round the ring and out of the cemetery; zombies shamble east and west. */
const ringLoop = (from, to, n, r = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = (from + (to - from) * (i / n)) * D2R; return polar(a, ringR(a) + r); });
export const PATROLS = {
  ghost: [
    ringLoop(0, 360, 18).slice(0, -1),
    ringLoop(360, 0, 18, 0.6).slice(0, -1).map(([x, z]) => [x * 0.98, z * 0.98]),
    [[0, -23], [-5, -25.5], [-4, -28.5], [4, -28.5], [5, -25.5], [0, -21], [0, -14], [0, -10.5], [0, -14]],
  ],
  zombie: [
    [[6, 0], [12, 1], ...ringLoop(0, 75, 4), [3.5, 11], [0, 7.4], [5.2, 4.6]],
    [[-6, 0], [-12, -1], ...ringLoop(180, 255, 4), ...ringLoop(255, 180, 4, 0.8).slice(1), [-7.4, 1.5]],
  ],
};
export const GIANT_SPAWN = { x: 0, z: -27 };
