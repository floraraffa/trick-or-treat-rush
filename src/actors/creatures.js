// The creatures: four monsters from the team's own drawings (art/creatures, turned into
// public/assets/monsters/<name>.webp by `npm run creatures`), built as paper-theatre puppets in 3D.
// Every part is a cut-out of the drawing puffed into a rounded pillow (or a rod, a coil, a ball) whose
// front shows the drawing exactly, projected straight on; backs take a matching plain colour. Parts
// hang on pivots (hips, legs, arms, neck, head) so each creature can walk, or glide, in its own way.
// They play the monsters that slow you down (the authority's 'zombie' kind).
import { ADDRESS_CLAMP_TO_EDGE, Color, Entity, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_SRGBA8, StandardMaterial, Texture, calculateNormals } from 'playcanvas';
import { Geo, blob, box, trs } from '../geo.js';
import { tube } from '../world/shapes.js';

export const CREATURES = ['longneck', 'goggles', 'doll', 'lips'];
const W = 1556, H = 2000; // the drawings' size in pixels

/** Drawing pixels ↔ metres: pixel (px, py) stands at ((px - cx) s, (ground - py) s); `uv` maps a point back. */
function drawing(s, cx, ground) {
  return {
    s,
    at: ([px, py], z = 0) => [(px - cx) * s, (ground - py) * s, z * s],
    uv: (x, y) => [(cx + x / s) / W, (ground - y / s) / H],
  };
}

/** Front projection: every vertex shows the drawing pixel straight behind it. */
function project(m, D) {
  m.uv = [];
  for (let k = 0; k < m.p.length; k += 3) m.uv.push(...D.uv(m.p[k], m.p[k + 1]));
  return m;
}

/** Smooth normals, with the faces turned so that vertex `probe` looks along `dir`. */
function orient(m, probe, dir) {
  m.n = Array.from(calculateNormals(m.p, m.i));
  const k = probe * 3;
  if (m.n[k] * dir[0] + m.n[k + 1] * dir[1] + m.n[k + 2] * dir[2] < 0) {
    for (let t = 0; t < m.i.length; t += 3) [m.i[t + 1], m.i[t + 2]] = [m.i[t + 2], m.i[t + 1]];
    m.n = m.n.map((v) => -v);
  }
  return m;
}

/**
 * A cut-out puffed into a pillow: the outline (drawing pixels, star-shaped round `center`) bulges
 * `front` px towards the viewer and `back` px away. Returns { art, plain }: the drawn front, the plain back.
 */
function pillow(D, outline, center, { front, back = front, z = 0, rings = 6 }) {
  const P = outline.map((p) => D.at(p)), C = D.at(center), n = P.length;
  const half = (depth, sign) => {
    const m = { p: [], n: [], uv: [], i: [] };
    for (let k = 0; k < rings; k++) {
      const th = (k / rings) * (Math.PI / 2), s = Math.cos(th), dz = (z + sign * depth * Math.sin(th)) * D.s;
      for (const q of P) m.p.push(C[0] + (q[0] - C[0]) * s, C[1] + (q[1] - C[1]) * s, dz);
    }
    m.p.push(C[0], C[1], (z + sign * depth) * D.s);
    for (let k = 0; k < rings - 1; k++) {
      for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + ((i + 1) % n); m.i.push(a, b, a + n, b, b + n, a + n); }
    }
    const tip = rings * n;
    for (let i = 0; i < n; i++) m.i.push((rings - 1) * n + i, (rings - 1) * n + ((i + 1) % n), tip);
    m.uv = new Array((m.p.length / 3) * 2).fill(0);
    return orient(m, tip, [0, 0, sign]);
  };
  return { art: project(half(front, 1), D), plain: half(back, -1) };
}

/** A rod along drawing points (px), radius in px, the drawing projected on it. */
const rod = (D, pts, r, z = 0, segs = 8) => project(tube(pts.map((p) => D.at(p, z)), Array.isArray(r) ? r.map((x) => x * D.s) : r * D.s, segs), D);
/** A ball at a drawing point, radius in px, the drawing projected on it. */
function ball(D, c, r, z = 0, squash = 1) {
  const m = blob(r * D.s, 12, { squashY: squash }), [x, y, zz] = D.at(c, z);
  for (let k = 0; k < m.p.length; k += 3) { m.p[k] += x; m.p[k + 1] += y; m.p[k + 2] += zz; }
  return project(m, D);
}

/** Lazily loaded drawings, one texture each (grey until the picture arrives). */
const art = new Map(), materials = new Map();
function drawingTexture(device, name, base) {
  if (art.has(name)) return art.get(name);
  const t = new Texture(device, { width: 4, height: 4, format: PIXELFORMAT_SRGBA8, mipmaps: true, minFilter: FILTER_LINEAR_MIPMAP_LINEAR, magFilter: FILTER_LINEAR, addressU: ADDRESS_CLAMP_TO_EDGE, addressV: ADDRESS_CLAMP_TO_EDGE, anisotropy: 4 });
  const img = new Image();
  img.onload = () => { t.resize(img.width, img.height); t.setSource(img); };
  img.onerror = () => console.warn('[creatures] missing drawing', name);
  img.src = `${base}monsters/${name}.webp`;
  art.set(name, t);
  return t;
}

function artMaterial(tex, scared = false) {
  const m = new StandardMaterial();
  m.diffuseMap = tex;
  m.diffuse = scared ? new Color(0.6, 0.72, 1) : new Color(1, 1, 1);
  m.emissiveMap = tex; // the drawings read in the dark, as if lit for the stage
  m.emissive = scared ? new Color(0.2, 0.32, 0.75) : new Color(0.36, 0.35, 0.34);
  m.gloss = 0.22; m.useMetalness = true; m.metalness = 0;
  m.update();
  return m;
}

/** Each creature: its scale, its drawing's centre line and ground, and its parts on their pivots. */
const DESIGNS = {
  // Big-eyed, bat-eared, striped, with a long patterned neck, in dungarees (drawing 1). Legs added to walk on.
  longneck: { s: 0.00095, cx: 778, ground: 2789, plain: { skin: [0.56, 0.5, 0.41], cloth: [0.27, 0.24, 0.2], shoe: [0.09, 0.08, 0.07], whisker: [0.06, 0.05, 0.05] },
    build(D, B, c) {
      B.part('hips', null, [778, 2000]);
      for (const [n, x] of [['legL', 705], ['legR', 851]]) {
        B.part(n, 'hips', [x, 2000]);
        B.add(n, project(tube([D.at([x, 2000]), D.at([x, 2400]), D.at([x, 2760])], [0.05, 0.045, 0.042], 8), D), 'plain', c.cloth);
        B.add(n, box(0.12, 0.08, 0.26), 'plain', c.shoe, trs(...D.at([x, 2770], 30)));
      }
      B.part('torso', 'hips', [778, 2000]);
      B.pillow('torso', [[595, 1545], [640, 1515], [700, 1520], [778, 1530], [856, 1520], [915, 1515], [960, 1545], [975, 1600], [972, 1800], [966, 2000], [778, 2008], [590, 2000], [584, 1800], [582, 1600]], [778, 1760], { front: 105, back: 110 }, c.cloth);
      B.part('neck', 'torso', [776, 1525]);
      B.add('neck', rod(D, [[776, 1525], [776, 1230], [777, 940]], [27, 23, 22]));
      B.part('head', 'neck', [778, 940]);
      B.pillow('head', [[778, 312], [900, 318], [990, 330], [975, 380], [990, 450], [1060, 520], [1100, 600], [1100, 680], [1080, 740], [1040, 790], [990, 840], [930, 885], [860, 925], [778, 940], [696, 925], [626, 885], [566, 840], [516, 790], [476, 740], [456, 680], [456, 600], [496, 520], [566, 450], [581, 380], [566, 330], [656, 318]], [778, 640], { front: 290, back: 340 }, c.skin);
      for (const s of [-1, 1]) {
        const ear = [[255, 338], [330, 334], [430, 365], [515, 440], [560, 500], [520, 560], [460, 612], [380, 540], [305, 445], [262, 370]].map(([x, y]) => [s < 0 ? x : 1556 - x, y]);
        B.pillow('head', s < 0 ? ear : ear.slice().reverse(), [s < 0 ? 420 : 1136, 470], { front: 18, back: 18, z: -70 }, c.skin);
        // whiskers bristling from the cheeks
        for (let k = 0; k < 11; k++) {
          const y = 690 + k * 20, x0 = 778 + s * (250 - k * 6), len = 150 + ((k * 37) % 70), a = (-0.5 + k * 0.1) * s;
          B.add('head', tube([D.at([x0, y], 140), D.at([x0 + s * len * Math.cos(a), y + len * Math.sin(a) * s], 120)], 0.0035, 3, { caps: false }), 'plain', c.whisker);
        }
      }
    },
  },
  // An enormous head with slicked hair and goggle eyes on a coiled spring, a tin body, rod legs and arms
  // that nearly reach the ground, and a ball on a cable (drawing 2).
  goggles: { s: 0.00102, cx: 775, ground: 2040, plain: { hair: [0.07, 0.06, 0.07], tin: [0.3, 0.3, 0.31], foot: [0.1, 0.1, 0.11], cable: [0.08, 0.08, 0.09] },
    build(D, B, c) {
      B.part('hips', null, [775, 1690]);
      for (const [n, x] of [['legL', 718], ['legR', 832]]) {
        B.part(n, 'hips', [x, 1690]);
        B.add(n, rod(D, [[x, 1690], [x, 2015]], 16));
        B.add(n, ball(D, [x, 1835], 22));
        B.add(n, ball(D, [x, 2022], 30, 12, 0.55), 'plain', c.foot);
      }
      B.part('torso', 'hips', [775, 1690]);
      B.pillow('torso', [[640, 1385], [775, 1380], [905, 1385], [912, 1600], [882, 1690], [668, 1690], [638, 1600]], [775, 1530], { front: 80, back: 80 }, c.tin);
      B.add('torso', rod(D, [[640, 1405], [606, 1408], [600, 1440]], 14));
      B.add('torso', rod(D, [[905, 1405], [960, 1408], [966, 1440]], 14));
      for (const [n, x] of [['armL', 600], ['armR', 966]]) {
        B.part(n, 'torso', [x, 1430]);
        B.add(n, rod(D, [[x, 1430], [x + (x < 775 ? 3 : 0), 1995]], 13));
        B.add(n, ball(D, [x, 1660], 18));
      }
      B.part('ball', 'torso', [1150, 1600]);
      B.add('ball', ball(D, [1162, 1400], 72));
      B.add('ball', rod(D, [[1152, 1468], [1150, 1590]], 9));
      B.add('ball', ball(D, [1150, 1592], 18));
      B.add('ball', tube([D.at([1150, 1600]), D.at([1120, 1760], 20), D.at([1040, 1900], 30), D.at([975, 1985], 10)], 0.007, 4), 'plain', c.cable);
      B.part('neck', 'torso', [775, 1390]);
      const coil = [];
      for (let k = 0; k <= 90; k++) { const t = k / 90, a = t * Math.PI * 2 * 9; coil.push([775 + Math.cos(a) * 24, 1390 - t * 195, Math.sin(a) * 24]); }
      B.add('neck', project(tube(coil.map(([x, y, z]) => D.at([x, y], z)), 7 * D.s, 5), D));
      B.add('neck', ball(D, [775, 1300], 34, 0, 0.6));
      B.part('head', 'neck', [775, 1195]);
      B.pillow('head', [[762, 35], [880, 55], [950, 120], [975, 150], [1100, 135], [1225, 200], [1325, 350], [1340, 470], [1315, 585], [1352, 612], [1372, 700], [1340, 862], [1240, 962], [1212, 1000], [1100, 1100], [925, 1162], [760, 1196], [600, 1170], [475, 1125], [362, 1062], [320, 980], [287, 950], [225, 875], [185, 775], [180, 625], [244, 587], [250, 437], [275, 312], [362, 162], [500, 80], [640, 40]], [775, 650], { front: 400, back: 480 }, c.hair);
    },
  },
  // A pale doll with a vast black bob, huge eyes and a stitched mouth on a skeletal body with endless
  // arms and legs (drawing 3).
  doll: { s: 0.0011, cx: 780, ground: 2000, plain: { hair: [0.13, 0.12, 0.12], bone: [0.8, 0.78, 0.75] },
    build(D, B, c) {
      B.part('hips', null, [780, 1450]);
      for (const [n, x0, x1, x2] of [['legL', 745, 745, 750], ['legR', 818, 815, 808]]) {
        B.part(n, 'hips', [x0, 1450]);
        B.add(n, rod(D, [[x0, 1450], [x1, 1622]], [22, 19]));
        B.add(n, ball(D, [x1, 1632], 24, 0, 1.2));
        B.add(n, rod(D, [[x1, 1645], [x2, 1990]], [16, 12]));
        B.add(n, ball(D, [x2, 1994], 18, 14, 0.5), 'plain', c.bone);
      }
      B.part('torso', 'hips', [780, 1450]);
      B.pillow('torso', [[668, 1155], [780, 1145], [892, 1155], [880, 1220], [850, 1300], [860, 1400], [845, 1450], [780, 1462], [715, 1450], [700, 1400], [710, 1300], [680, 1220]], [780, 1300], { front: 70, back: 70 }, c.bone);
      for (const [n, x0, x1, x2] of [['armL', 675, 676, 668], ['armR', 885, 887, 893]]) {
        B.part(n, 'torso', [x0, 1165]);
        B.add(n, rod(D, [[x0, 1165], [x1, 1480]], [14, 11]));
        B.add(n, rod(D, [[x1, 1490], [x2, 1970]], [9, 7]));
      }
      B.part('neck', 'torso', [778, 1150]);
      B.add('neck', rod(D, [[778, 1150], [778, 1070]], 12));
      B.part('head', 'neck', [778, 1078]);
      B.pillow('head', [[1027, 204], [1180, 250], [1324, 325], [1405, 528], [1425, 757], [1418, 906], [1391, 1014], [1176, 1030], [960, 1060], [778, 1082], [600, 1050], [400, 1030], [217, 1027], [190, 825], [231, 595], [352, 474], [555, 420], [676, 433], [717, 339], [825, 244]], [800, 720], { front: 380, back: 480 }, c.hair);
    },
  },
  // A small curly-haired head on a thread of a neck, a great mask of a mouth, and a body that is a tree
  // trunk: it has no legs, it glides (drawing 4).
  lips: { s: 0.00115, cx: 785, ground: 2000, plain: { curls: [0.18, 0.17, 0.19], mask: [0.25, 0.24, 0.26], bark: [0.2, 0.19, 0.2] },
    build(D, B, c) {
      B.part('hips', null, [785, 2000]);
      B.part('torso', 'hips', [785, 2000]);
      B.pillow('torso', [[663, 1290], [805, 1282], [947, 1290], [915, 1500], [913, 1700], [950, 1880], [1030, 2000], [785, 2006], [560, 2000], [640, 1880], [650, 1700], [655, 1500]], [800, 1650], { front: 120, back: 120 }, c.bark);
      for (let k = 0; k < 6; k++) { // roots creeping over the ground
        const a = (k / 6) * Math.PI * 2 + 0.4, [x, , z] = D.at([785, 1990]);
        B.add('torso', tube([[x + Math.cos(a) * 0.12, 0.05, z + Math.sin(a) * 0.12], [x + Math.cos(a) * 0.45, 0.04, z + Math.sin(a) * 0.45], [x + Math.cos(a + 0.3) * 0.75, 0.01, z + Math.sin(a + 0.3) * 0.75]], [0.07, 0.04, 0.015], 5), 'plain', c.bark);
      }
      B.part('mask', 'torso', [785, 1280]);
      B.pillow('mask', [[603, 758], [700, 745], [785, 740], [870, 745], [967, 758], [1014, 987], [1088, 1183], [980, 1240], [893, 1262], [785, 1280], [650, 1255], [560, 1225], [461, 1176], [501, 1001]], [785, 1060], { front: 200, back: 190 }, c.mask);
      B.part('neck', 'mask', [785, 755]);
      B.add('neck', rod(D, [[785, 755], [783, 690]], 18));
      B.part('head', 'neck', [780, 700]);
      B.pillow('head', [[545, 0], [780, 0], [1005, 0], [1211, 34], [1303, 138], [1290, 230], [1211, 345], [1143, 400], [1125, 443], [1051, 552], [947, 667], [867, 724], [771, 752], [683, 713], [591, 644], [499, 552], [436, 443], [420, 400], [330, 330], [255, 240], [250, 140], [300, 60], [349, 23]], [780, 330], { front: 320, back: 380 }, c.curls);
    },
  },
};

/**
 * A creature puppet, facing +Z with its feet (or roots) at the origin. `base`: where the assets live.
 * Returns { root, parts, setScared(on), name }.
 */
export function createCreature(app, name, { base = './assets/', plainMat } = {}) {
  const design = DESIGNS[name], D = drawing(design.s, design.cx, design.ground);
  const tex = drawingTexture(app.graphicsDevice, name, base);
  if (!materials.has(name)) materials.set(name, { calm: artMaterial(tex), scared: artMaterial(tex, true) });
  const M = materials.get(name);
  const root = new Entity(`creature-${name}`);
  const parts = {};
  const B = {
    part(n, parent, pivotPx, zPx = 0) {
      const pv = D.at(pivotPx, zPx), pp = parent ? parts[parent].pivot : [0, 0, 0];
      const e = new Entity(n);
      e.setLocalPosition(pv[0] - pp[0], pv[1] - pp[1], pv[2] - pp[2]);
      (parent ? parts[parent].e : root).addChild(e);
      parts[n] = { e, pivot: pv, art: new Geo(), plain: new Geo(), rest: e.getLocalPosition().clone() };
    },
    add(n, m, which = 'art', tint = [1, 1, 1], at = null) {
      const p = parts[n], M0 = trs(-p.pivot[0], -p.pivot[1], -p.pivot[2]);
      p[which].add(m, at ? M0.clone().mul(at) : M0, tint);
    },
    pillow(n, outline, center, opts, back) {
      const { art: a, plain } = pillow(D, outline, center, opts);
      this.add(n, a);
      this.add(n, plain, 'plain', back);
    },
  };
  design.build(D, B, design.plain);
  const meshes = [];
  for (const [n, p] of Object.entries(parts)) {
    for (const which of ['art', 'plain']) {
      if (p[which].empty) continue;
      const e = p[which].build(app.graphicsDevice, which === 'art' ? M.calm : plainMat, `${n}-${which}`);
      e.render.castShadows = true;
      p.e.addChild(e);
      if (which === 'art') meshes.push(e);
    }
  }
  let scared = false;
  return {
    name, root, parts,
    /** Frightened by a gem: the drawing turns a cold blue. */
    setScared(on) {
      if (on === scared) return;
      scared = on;
      for (const e of meshes) e.render.meshInstances[0].material = on ? M.scared : M.calm;
    },
  };
}

/**
 * Moves a creature's parts. `w` the stride phase, `amp` 0..1 how fast it goes, `t` its own clock,
 * `state` the authority's (patrol, chase, recover, return, flee).
 */
export function animateCreature(c, t, w, amp, state) {
  const P = c.parts, chase = state === 'chase', flee = state === 'flee', recover = state === 'recover';
  const shiver = flee ? Math.sin(t * 38) * 4 : 0;
  const lean = chase ? 9 : flee ? -12 : 0;
  const set = (n, x, y, z) => P[n]?.e.setLocalEulerAngles(x, y, z);
  if (P.legL) { set('legL', Math.sin(w) * 26 * amp, 0, 0); set('legR', -Math.sin(w) * 26 * amp, 0, 0); }
  if (P.armL) { set('armL', -Math.sin(w) * 16 * amp + (flee ? -40 : 0), 0, flee ? -10 : 0); set('armR', Math.sin(w) * 16 * amp + (flee ? -40 : 0), 0, flee ? 10 : 0); }
  const hips = P.hips.e, r = P.hips.rest;
  hips.setLocalPosition(r.x, r.y + Math.abs(Math.sin(w)) * 0.035 * amp, r.z);
  set('torso', lean + (recover ? -10 : 0), Math.sin(w) * 6 * amp, Math.sin(w) * 4 * amp + shiver + (recover ? Math.sin(t * 9) * 8 : 0));
  if (c.name === 'longneck') {
    set('neck', (chase ? 14 : 0) + Math.sin(t * 1.1) * 5, 0, Math.sin(t * 1.3) * 7);
    set('head', chase ? -6 : 0, Math.sin(t * 0.7) * 14, -Math.sin(t * 1.3) * 9 + shiver);
  } else if (c.name === 'goggles') {
    const n = P.neck.rest;
    P.neck.e.setLocalPosition(n.x, n.y + Math.sin(w * 2) * 0.03 * amp + Math.sin(t * 3) * 0.01, n.z); // boing
    set('head', (chase ? 8 : 0) + Math.sin(t * 2.1) * 4, Math.sin(t * 0.8) * 12, Math.sin(t * 1.7) * 6 + shiver);
    set('ball', Math.sin(t * 1.6) * 8, 0, Math.sin(t * 1.2 + 1) * 10);
  } else if (c.name === 'doll') {
    set('head', chase ? 6 : 0, Math.sin(t * 0.5) * 10, Math.sin(t * 0.6) * 16 + shiver); // the slow, wrong tilt of a doll's head
  } else { // lips: no legs, it glides and sways like a tree in wind
    const r2 = P.hips.rest;
    hips.setLocalPosition(r2.x, r2.y + Math.sin(t * 2) * 0.02, r2.z);
    set('torso', lean * 0.6 + Math.sin(t * 1.1) * 3, 0, Math.sin(t * 0.9) * 4 + shiver);
    set('mask', Math.sin(t * 1.4) * 4, Math.sin(t * 0.6) * 8, 0);
    set('head', chase ? 10 : 0, Math.sin(t * 0.8) * 16, Math.sin(t * 1.2) * 8);
  }
}
