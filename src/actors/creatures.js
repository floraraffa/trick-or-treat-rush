// The creatures: five monsters from the team's own drawings (front views in a T-pose, art/creatures/),
// built as 3D puppets. `npm run creatures` cuts each drawing out of its background into a texture with
// alpha and traces its parts (creature-shapes.js). Here every part is rebuilt from its trace: heads and
// torsos as rounded pillows, arms, legs, necks and gowns as shells whose round cross-sections follow the
// drawing's width row by row. The front of each part shows the drawing exactly (projected straight on,
// cut along its own outline); the back is painted from the drawing too, from a swatch of hair, fur,
// cloth or tin, so a creature seen from behind still looks like itself. Arms hang from the shoulders
// and swing, reach out to grab, flail when frightened; legs stride (the lips lady glides).
// They play the monsters that slow you down (the authority's 'zombie' kind).
import { ADDRESS_CLAMP_TO_EDGE, Color, Entity, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_SRGBA8, StandardMaterial, Texture, calculateNormals } from 'playcanvas';
import { Geo } from '../geo.js';
import { tube } from '../world/shapes.js';
import { SHAPES } from './creature-shapes.js';

export const CREATURES = ['catgirl', 'goggles', 'lips', 'catman', 'longneck'];

/** Drawing pixels ↔ metres: pixel (px, py) stands at ((px - cx) s, (ground - py) s); `uv` maps a point back. */
function drawing(name, height, cx, ground) {
  const [W, H] = SHAPES[name].size;
  let top = Infinity;
  for (const p of Object.values(SHAPES[name].parts)) {
    if (p.kind === 'blob') for (const [, y] of p.outline) top = Math.min(top, y);
    else if (p.kind === 'v') top = Math.min(top, p.profile[0][0]);
    else for (const [, y] of p.profile) top = Math.min(top, y);
  }
  const s = height / (ground - top);
  return { s, W, H, at: ([px, py], z = 0) => [(px - cx) * s, (ground - py) * s, z * s], uv: (x, y) => [(cx + x / s) / W, (ground - y / s) / H] };
}

/** Smooth normals, the faces turned so that vertex `probe` looks along `dir`. */
function orient(m, probe, dir) {
  m.n = Array.from(calculateNormals(m.p, m.i));
  const k = probe * 3;
  if (m.n[k] * dir[0] + m.n[k + 1] * dir[1] + m.n[k + 2] * dir[2] < 0) {
    for (let t = 0; t < m.i.length; t += 3) [m.i[t + 1], m.i[t + 2]] = [m.i[t + 2], m.i[t + 1]];
    m.n = m.n.map((v) => -v);
  }
  return m;
}

/** Back faces take their pixels from a swatch [x0, y0, x1, y1] of the drawing, stretched over the part (mirrored, as seen from behind). */
const swatch = (D, [x0, y0, x1, y1]) => (u, v) => [(x1 - (x1 - x0) * u) / D.W, (y0 + (y1 - y0) * v) / D.H];

/**
 * A blob part puffed into a pillow: `front` and `back` depths as fractions of its half width. The front
 * shows the drawing; the back a swatch (or the drawing again, mirrored, without one).
 */
function pillow(D, shape, { front = 0.5, back = 0.6, backSwatch = null, rings = 7 }) {
  const P = shape.outline.map((p) => D.at(p)), C = D.at(shape.center), n = P.length;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const half = (x1 - x0) / 2;
  const sw = backSwatch && swatch(D, backSwatch);
  const make = (depth, sign) => {
    const m = { p: [], n: [], uv: [], i: [] };
    for (let k = 0; k < rings; k++) {
      const th = (k / rings) * (Math.PI / 2), s = Math.cos(th), z = sign * depth * half * Math.sin(th);
      for (const q of P) m.p.push(C[0] + (q[0] - C[0]) * s, C[1] + (q[1] - C[1]) * s, z);
    }
    m.p.push(C[0], C[1], sign * depth * half);
    for (let k = 0; k < rings - 1; k++) {
      for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + ((i + 1) % n); m.i.push(a, b, a + n, b, b + n, a + n); }
    }
    const tip = rings * n;
    for (let i = 0; i < n; i++) m.i.push((rings - 1) * n + i, (rings - 1) * n + ((i + 1) % n), tip);
    for (let k = 0; k < m.p.length; k += 3) {
      const x = m.p[k], y = m.p[k + 1];
      m.uv.push(...(sign < 0 && sw ? sw((x - x0) / (x1 - x0 || 1), (y1 - y) / (y1 - y0 || 1)) : D.uv(x, y)));
    }
    return orient(m, tip, [0, 0, sign]);
  };
  return { front: make(front, 1), back: make(back, -1) };
}

/**
 * A limb or body from a profile ('v': rows [y, left, right]; 'h': columns [x, top, bottom]): a shell
 * of elliptical cross-sections `depth` × the half width deep, its ends closed. Front half projected,
 * back half from a swatch (or mirrored).
 */
function shell(D, shape, { depth = 0.9, backSwatch = null, segs = 8 }) {
  const vert = shape.kind === 'v', rows = shape.profile;
  const sw = backSwatch && swatch(D, backSwatch);
  const make = (sign) => {
    const m = { p: [], n: [], uv: [], i: [] };
    rows.forEach(([along, a, b], r) => {
      const c = (a + b) / 2, hw = (b - a) / 2;
      for (let k = 0; k <= segs; k++) {
        const phi = -Math.PI / 2 + (k / segs) * Math.PI, across = c + hw * Math.sin(phi), z = sign * depth * hw * Math.cos(phi);
        const [x, y, zz] = D.at(vert ? [across, along] : [along, across], z);
        m.p.push(x, y, zz);
        m.uv.push(...(sign < 0 && sw ? sw(k / segs, r / Math.max(1, rows.length - 1)) : D.uv(x, y)));
      }
    });
    const w = segs + 1;
    for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < segs; k++) { const a = r * w + k; m.i.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
    for (const r of [0, rows.length - 1]) { // close each end with a fan
      const [along, a, b] = rows[r], [x, y, z] = D.at(vert ? [(a + b) / 2, along] : [along, (a + b) / 2]);
      const ci = m.p.length / 3;
      m.p.push(x, y, z); m.uv.push(...D.uv(x, y));
      for (let k = 0; k < segs; k++) m.i.push(r * w + k, r * w + k + 1, ci);
    }
    return orient(m, Math.floor(rows.length / 2) * w + (segs >> 1), [0, 0, sign]);
  };
  return { front: make(1), back: make(-1) };
}

/** Lazily loaded drawings, one texture each (see-through until the picture arrives). */
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
  m.diffuseVertexColor = true; // backs a shade darker
  m.emissiveMap = tex; // the drawings read in the dark, as if lit for the stage
  m.emissive = scared ? new Color(0.2, 0.32, 0.75) : new Color(0.34, 0.33, 0.32);
  m.opacityMap = tex; m.opacityMapChannel = 'a'; m.alphaTest = 0.5; // cut along the drawing's own outline
  m.gloss = 0.25; m.useMetalness = true; m.metalness = 0;
  m.update();
  return m;
}

// Each creature: its height in metres, its drawing's centre line and ground (pixels), and its parts:
// [name, parent, pivot (px), options]. shape: the traced part; front / back: pillow depths; depth: shell
// depth; backSwatch: where its back is painted from; arm: 'L' / 'R' hangs it from the shoulder.
const DESIGNS = {
  // A big-eyed girl in cat-eye glasses with a cat asleep in her hair, in a little dress (drawing 5).
  catgirl: { height: 2.1, cx: 512, ground: 1410, parts: [
    ['hips', null, [512, 1066]],
    ['legL', 'hips', [482, 1066], { depth: 0.95 }], ['legR', 'hips', [543, 1066], { depth: 0.95 }],
    ['torso', 'hips', [512, 1066], { depth: 0.62, backSwatch: [405, 930, 465, 1040] }],
    ['head', 'torso', [512, 712], { front: 0.5, back: 0.72, backSwatch: [420, 300, 690, 440] }], // (hair to the right of the cat)
    ['armL', 'torso', [380, 734], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [645, 734], { arm: 'R', depth: 0.9 }],
  ] },
  // An enormous head with goggle eyes and slicked hair on a thin neck, a tin body, rod limbs, and a ball on a
  // cable tied to its knee (drawing 6).
  goggles: { height: 2.2, cx: 512, ground: 1430, parts: [
    ['hips', null, [505, 842]],
    ['legL', 'hips', [473, 842], { depth: 0.9 }], ['legR', 'hips', [549, 842], { depth: 0.9 }],
    ['torso', 'hips', [505, 842], { front: 0.42, back: 0.42, backSwatch: [425, 700, 478, 790] }],
    ['neck', 'torso', [522, 616], { depth: 0.9 }],
    ['head', 'neck', [522, 563], { front: 0.48, back: 0.72, backSwatch: [330, 140, 720, 252] }],
    ['armL', 'torso', [410, 628], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [600, 628], { arm: 'R', depth: 0.9 }],
    ['ball', 'torso', [722, 845], { front: 0.9, back: 0.9 }],
  ] },
  // A blue lady with a crown of purple curls, a mask of a mouth for a bodice and a long fluted gown that
  // pools on the ground: no legs, she glides (drawing 7).
  lips: { height: 2.4, cx: 512, ground: 1457, parts: [
    ['hips', null, [512, 1457]],
    ['dress', 'hips', [512, 1457], { depth: 0.8 }],
    ['torso', 'dress', [512, 612], { front: 0.42, back: 0.42, backSwatch: [425, 438, 470, 500] }],
    ['neck', 'torso', [515, 436], { depth: 0.9 }],
    ['head', 'neck', [512, 372], { front: 0.45, back: 0.6, backSwatch: [250, 22, 780, 140] }],
    ['armL', 'torso', [426, 445], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [596, 445], { arm: 'R', depth: 0.9 }],
  ] },
  // A cat in a tweed jacket and drainpipe trousers, a long tie, whiskers (drawing 8).
  catman: { height: 2.3, cx: 512, ground: 1470, parts: [
    ['hips', null, [512, 906]],
    ['legL', 'hips', [457, 906], { depth: 0.85 }], ['legR', 'hips', [563, 906], { depth: 0.85 }],
    ['torso', 'hips', [512, 906], { depth: 0.6, backSwatch: [418, 620, 478, 880] }],
    ['head', 'torso', [512, 512], { front: 0.48, back: 0.68, backSwatch: [300, 182, 430, 300] }],
    ['armL', 'torso', [418, 532], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [602, 532], { arm: 'R', depth: 0.9 }],
  ] },
  // Bat ears, huge eyes, a striped face and whiskers on a long patterned neck, in dungarees (drawing 9).
  longneck: { height: 2.5, cx: 224, ground: 714, parts: [
    ['hips', null, [224, 500]],
    ['legL', 'hips', [190, 496], { depth: 0.8 }], ['legR', 'hips', [262, 496], { depth: 0.8 }],
    ['torso', 'hips', [224, 500], { depth: 0.6, backSwatch: [178, 456, 272, 500] }],
    ['neck', 'torso', [222, 350], { depth: 1 }],
    ['head', 'neck', [222, 200], { front: 0.42, back: 0.55, backSwatch: [150, 30, 300, 78] }],
    ['armL', 'torso', [180, 376], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [268, 376], { arm: 'R', depth: 0.9 }],
  ] },
};
const ARM_DOWN = 76; // degrees from the T-pose to arms hanging at the sides

/**
 * A creature puppet, facing +Z with its feet (or gown) on the origin. `base`: where the assets live;
 * `plainMat`: an untextured vertex-colour material for cords and whiskers.
 * Returns { name, root, parts, setScared(on) }.
 */
export function createCreature(app, name, { base = './assets/', plainMat } = {}) {
  const design = DESIGNS[name], D = drawing(name, design.height, design.cx, design.ground);
  const tex = drawingTexture(app.graphicsDevice, name, base);
  if (!materials.has(name)) materials.set(name, { calm: artMaterial(tex), scared: artMaterial(tex, true) });
  const M = materials.get(name), shapes = SHAPES[name].parts;
  const root = new Entity(`creature-${name}`);
  const parts = {}, meshes = [];
  for (const [part, parent, pivotPx, o = {}] of design.parts) {
    const pv = D.at(pivotPx), pp = parent ? parts[parent].pivot : [0, 0, 0];
    const e = new Entity(part);
    e.setLocalPosition(pv[0] - pp[0], pv[1] - pp[1], pv[2] - pp[2]);
    (parent ? parts[parent].e : root).addChild(e);
    let holder = e;
    if (o.arm) { holder = new Entity(`${part}-hang`); e.addChild(holder); } // swing (x) outside, hang (z) inside
    parts[part] = { e, hang: o.arm ? holder : null, side: o.arm, pivot: pv, rest: e.getLocalPosition().clone() };
    const shape = shapes[part];
    if (!shape) continue;
    const { front, back } = shape.kind === 'blob' ? pillow(D, shape, o) : shell(D, shape, o);
    const g = new Geo(), off = [-pv[0], -pv[1], -pv[2]];
    for (const [m, tint] of [[front, [1, 1, 1]], [back, [0.82, 0.8, 0.8]]]) {
      for (let k = 0; k < m.p.length; k += 3) { m.p[k] += off[0]; m.p[k + 1] += off[1]; m.p[k + 2] += off[2]; }
      g.add(m, null, tint);
    }
    const mesh = g.build(app.graphicsDevice, M.calm, `${part}-mesh`);
    mesh.render.castShadows = true;
    holder.addChild(mesh);
    meshes.push(mesh);
  }
  // A few extras the traces can't carry: the ball's stick and cable, the cat's whiskers.
  const extra = (part, geo) => { const p = parts[part], g = new Geo(); for (const [m, tint] of geo) { for (let k = 0; k < m.p.length; k += 3) { m.p[k] -= p.pivot[0]; m.p[k + 1] -= p.pivot[1]; m.p[k + 2] -= p.pivot[2]; } g.add(m, null, tint); } const e = g.build(app.graphicsDevice, plainMat, `${part}-extra`); e.render.castShadows = true; p.e.addChild(e); };
  if (plainMat && name === 'goggles') {
    const cord = [[727, 836], [714, 884], [690, 1000], [622, 1088], [566, 1126]].map((q, i) => D.at(q, i ? 10 : 0));
    extra('ball', [[tube(cord.slice(0, 2), 0.012, 5), [0.35, 0.35, 0.37]], [tube(cord.slice(1), 0.007, 4), [0.06, 0.06, 0.07]]]);
  }
  if (plainMat && name === 'catman') {
    const whiskers = [];
    for (const s of [-1, 1]) for (const [tx, ty] of [[300, 452], [304, 488], [330, 522], [362, 548]]) {
      const from = D.at([512 + s * 34, 470], 95), to = D.at([s < 0 ? tx : 1024 - tx, ty], 70);
      whiskers.push([tube([from, to], 0.004, 3, { caps: false }), [0.95, 0.95, 0.95]]);
    }
    extra('head', whiskers);
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
  const set = (n, x, y, z) => P[n]?.e.setLocalEulerAngles(x, y, z);
  if (P.legL) { set('legL', Math.sin(w) * 28 * amp, 0, 0); set('legR', -Math.sin(w) * 28 * amp, 0, 0); }
  // Arms: hanging and swinging against the legs; reaching out to grab when it chases; flailing over its head when it flees.
  for (const n of ['armL', 'armR']) {
    const a = P[n];
    if (!a) continue;
    const s = a.side === 'L' ? 1 : -1, phase = s * Math.sin(w) * 24 * amp;
    let swing = -phase, hang = s * ARM_DOWN + s * Math.sin(t * 1.3 + s) * 3;
    if (chase) { swing = -80 + Math.sin(t * 7 + s) * 7; hang = s * (ARM_DOWN - 8); }
    else if (flee) { swing = Math.sin(t * 12 + s) * 20; hang = -s * (35 + Math.sin(t * 16 + s) * 25); }
    else if (recover) { swing = Math.sin(t * 9) * 10; hang = s * (ARM_DOWN + 6); }
    a.e.setLocalEulerAngles(swing, 0, 0);
    a.hang.setLocalEulerAngles(0, 0, hang);
  }
  const hips = P.hips.e, r = P.hips.rest, lean = chase ? 9 : flee ? -12 : 0;
  if (c.name === 'lips') { // no legs: she glides, swaying like a tall flower
    hips.setLocalPosition(r.x, r.y + Math.sin(t * 2) * 0.02, r.z);
    set('dress', lean * 0.5 + Math.sin(t * 1.1) * 3, 0, Math.sin(t * 0.9) * 4 + shiver);
    set('torso', Math.sin(t * 1.4) * 3, Math.sin(t * 0.6) * 8, 0);
    set('head', chase ? 10 : 0, Math.sin(t * 0.8) * 16, Math.sin(t * 1.2) * 8);
    return;
  }
  hips.setLocalPosition(r.x, r.y + Math.abs(Math.sin(w)) * 0.04 * amp, r.z);
  set('torso', lean + (recover ? -10 : 0), Math.sin(w) * 6 * amp, Math.sin(w) * 3 * amp + shiver + (recover ? Math.sin(t * 9) * 8 : 0));
  if (c.name === 'goggles') {
    const n = P.neck.rest;
    P.neck.e.setLocalPosition(n.x, n.y + Math.sin(w * 2) * 0.03 * amp, n.z); // the head bobs on its thin neck
    set('head', (chase ? 8 : 0) + Math.sin(t * 2.1) * 4, Math.sin(t * 0.8) * 12, Math.sin(t * 1.7) * 6 + shiver);
    set('ball', Math.sin(t * 1.6) * 8, 0, Math.sin(t * 1.2 + 1) * 10);
  } else if (c.name === 'longneck') {
    set('neck', (chase ? 14 : 0) + Math.sin(t * 1.1) * 5, 0, Math.sin(t * 1.3) * 7);
    set('head', chase ? -6 : 0, Math.sin(t * 0.7) * 14, -Math.sin(t * 1.3) * 9 + shiver);
  } else if (c.name === 'catman') {
    set('head', chase ? 6 : 0, Math.sin(t * 0.6) * 18, Math.sin(t * 0.9) * 10 + shiver); // a cat's slow, curious head tilt
  } else {
    set('head', chase ? 6 : 0, Math.sin(t * 0.5) * 10, Math.sin(t * 0.6) * 14 + shiver); // the wrong, slow tilt of a doll
  }
}
