// The creatures: five monsters from the team's own drawings (front views in a T-pose, art/creatures/),
// built as 3D puppets. `npm run creatures` cuts each drawing out of its background, paints what every
// part looks like from behind (hair, fur, cloth quilted from the drawing itself) into the same texture,
// and traces the parts (creature-shapes.js). Here every part is rebuilt from its trace: heads, round
// bodies and the ball are puffed up from their true outline as a union of spheres (ears, curls and the
// cat in the girl's hair get their own roundness, nothing is hollow); arms, legs, necks, gowns and slim
// bodies are shells whose round cross-sections follow the drawing's width row by row. The front of each
// part shows the drawing exactly (projected straight on); the back shows its painted back. Arms hang
// from the shoulders and swing, reach out to grab, flail when frightened; legs stride (the lips lady
// glides). Each creature's meshes are built once and shared by every copy (a trick lets many out at once).
// They play the monsters that slow you down (the authority's 'zombie' kind).
import { ADDRESS_CLAMP_TO_EDGE, Color, Entity, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, MeshInstance, PIXELFORMAT_SRGBA8, StandardMaterial, Texture, calculateNormals } from 'playcanvas';
import { Geo } from '../geo.js';
import { tube } from '../world/shapes.js';
import { SHAPES } from './creature-shapes.js';

export const CREATURES = ['catgirl', 'goggles', 'lips', 'catman', 'longneck'];

/**
 * Drawing pixels ↔ metres: pixel (px, py) stands at ((px - cx) s, (ground - py) s). `tex` maps a pixel to
 * the atlas: the drawing on the left, the backs at half size to its right.
 */
function drawing(name, height, cx, ground) {
  const { size: [W], atlas: [AW, AH], top } = SHAPES[name];
  const s = height / (ground - top);
  return {
    s,
    at: ([px, py], z = 0) => [(px - cx) * s, (ground - py) * s, z * s],
    tex: (px, py, behind) => (behind ? [(W + px / 2) / AW, py / 2 / AH] : [px / AW, py / AH]),
  };
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

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/**
 * A blob part from its height grid: the front surface rises `front` × the grid's heights towards the
 * viewer, the back `back` × behind; both meet at height 0 on the outline (the grid's rim points).
 */
function inflated(D, { grid: G }, { front = 0.7, back = 0.85 }) {
  const kind = bytes(G.h), rim = new Int8Array(bytes(G.rim).buffer), pts = [];
  let r = 0;
  for (let j = 0; j < G.rows; j++) for (let i = 0; i < G.cols; i++) {
    const k = kind[j * G.cols + i], x = G.x0 + i * G.step, y = G.y0 + j * G.step;
    if (k === 1) { pts.push([x + rim[r], y + rim[r + 1], 0, true]); r += 2; } // on the outline
    else pts.push(k ? [x, y, ((k - 2) / 253) * G.hmax, false] : null);
  }
  const make = (sign, depth) => {
    const m = { p: [], n: [], uv: [], i: [] }, index = new Int32Array(pts.length).fill(-1);
    let probe = 0, best = -1;
    pts.forEach((q, k) => {
      if (!q) return;
      index[k] = m.p.length / 3;
      m.p.push(...D.at([q[0], q[1]], sign * depth * q[2]));
      m.uv.push(...D.tex(q[0], q[1], sign < 0));
      if (q[2] > best) { best = q[2]; probe = index[k]; }
    });
    const tri = (a, b, c) => { if (pts[a] && pts[b] && pts[c] && !(pts[a][3] && pts[b][3] && pts[c][3])) m.i.push(index[a], index[b], index[c]); };
    for (let j = 0; j + 1 < G.rows; j++) for (let i = 0; i + 1 < G.cols; i++) {
      const a = j * G.cols + i, b = a + 1, c = a + G.cols, d = c + 1;
      if (!pts[a]) tri(b, c, d); else if (!pts[b]) tri(a, c, d); else if (!pts[c]) tri(a, d, b); else if (!pts[d]) tri(a, c, b);
      else { tri(a, c, b); tri(b, c, d); }
    }
    return orient(m, probe, [0, 0, sign]);
  };
  return { front: make(1, front), back: make(-1, back) };
}

/**
 * A limb or body from a profile ('v': rows [y, left, right]; 'h': columns [x, top, bottom]): a shell
 * of elliptical cross-sections `depth` × the half width deep, its ends closed. Front half shows the
 * drawing, back half its painted back.
 */
function shell(D, shape, { depth = 0.9, segs = 8 }) {
  const vert = shape.kind === 'v', rows = shape.profile;
  const px = (along, across) => (vert ? [across, along] : [along, across]);
  const make = (sign) => {
    const m = { p: [], n: [], uv: [], i: [] };
    for (const [along, a, b] of rows) {
      const c = (a + b) / 2, hw = (b - a) / 2;
      for (let k = 0; k <= segs; k++) {
        const phi = -Math.PI / 2 + (k / segs) * Math.PI, q = px(along, c + hw * Math.sin(phi));
        m.p.push(...D.at(q, sign * depth * hw * Math.cos(phi)));
        m.uv.push(...D.tex(q[0], q[1], sign < 0));
      }
    }
    const w = segs + 1;
    for (let r = 0; r < rows.length - 1; r++) for (let k = 0; k < segs; k++) { const a = r * w + k; m.i.push(a, a + 1, a + w, a + 1, a + w + 1, a + w); }
    for (const r of [0, rows.length - 1]) { // close each end with a fan
      const [along, a, b] = rows[r], q = px(along, (a + b) / 2), ci = m.p.length / 3;
      m.p.push(...D.at(q)); m.uv.push(...D.tex(q[0], q[1], sign < 0));
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
// [name, parent, pivot (px), options]. front / back: how far a blob part bulges forwards and backwards
// (× its own roundness); depth: a shell's depth (× its half width); arm: 'L' / 'R' hangs it from the shoulder.
const DESIGNS = {
  // A big-eyed girl in cat-eye glasses with a cat asleep in her hair, in a little dress (drawing 5).
  catgirl: { height: 2.1, cx: 512, ground: 1410, parts: [
    ['hips', null, [512, 1066]],
    ['legL', 'hips', [482, 1066], { depth: 0.95 }], ['legR', 'hips', [543, 1066], { depth: 0.95 }],
    ['torso', 'hips', [512, 1066], { depth: 0.62 }],
    ['neck', 'torso', [512, 716], { depth: 0.9 }], // (hidden under her chin; closes the gap when she tilts her head)
    ['head', 'torso', [512, 712], { front: 0.7, back: 0.85 }],
    ['armL', 'torso', [380, 734], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [645, 734], { arm: 'R', depth: 0.9 }],
  ] },
  // An enormous head with goggle eyes and slicked hair on a thin neck, a tin body, rod limbs, and a ball on a
  // cable tied to its knee (drawing 6).
  goggles: { height: 2.2, cx: 512, ground: 1430, parts: [
    ['hips', null, [505, 842]],
    ['legL', 'hips', [473, 842], { depth: 0.9 }], ['legR', 'hips', [549, 842], { depth: 0.9 }],
    ['torso', 'hips', [505, 842], { front: 0.9, back: 0.9 }],
    ['neck', 'torso', [522, 616], { depth: 0.9 }],
    ['head', 'neck', [522, 563], { front: 0.7, back: 0.85 }],
    ['armL', 'torso', [410, 628], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [600, 628], { arm: 'R', depth: 0.9 }],
    ['ball', 'torso', [722, 845], { front: 0.95, back: 0.95 }],
  ] },
  // A blue lady with a crown of purple curls, a mask of a mouth for a bodice and a long fluted gown that
  // pools on the ground: no legs, she glides (drawing 7).
  lips: { height: 2.4, cx: 512, ground: 1457, parts: [
    ['hips', null, [512, 1457]],
    ['dress', 'hips', [512, 1457], { depth: 0.8 }],
    ['torso', 'dress', [512, 612], { front: 0.85, back: 0.85 }],
    ['neck', 'torso', [515, 436], { depth: 0.9 }],
    ['head', 'neck', [512, 372], { front: 0.6, back: 0.75 }],
    ['armL', 'torso', [426, 445], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [596, 445], { arm: 'R', depth: 0.9 }],
  ] },
  // A cat in a tweed jacket and drainpipe trousers, a long tie, whiskers (drawing 8).
  catman: { height: 2.3, cx: 512, ground: 1470, parts: [
    ['hips', null, [512, 906]],
    ['legL', 'hips', [457, 906], { depth: 0.85 }], ['legR', 'hips', [563, 906], { depth: 0.85 }],
    ['torso', 'hips', [512, 906], { depth: 0.6 }],
    ['head', 'torso', [512, 512], { front: 0.75, back: 0.9 }],
    ['armL', 'torso', [418, 532], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [602, 532], { arm: 'R', depth: 0.9 }],
  ] },
  // Bat ears, huge eyes, a striped face and whiskers on a long patterned neck, in dungarees (drawing 9).
  longneck: { height: 2.5, cx: 224, ground: 714, parts: [
    ['hips', null, [224, 500]],
    ['legL', 'hips', [190, 496], { depth: 0.8 }], ['legR', 'hips', [262, 496], { depth: 0.8 }],
    ['torso', 'hips', [224, 500], { depth: 0.6 }],
    ['neck', 'torso', [222, 350], { depth: 1 }],
    ['head', 'neck', [222, 200], { front: 0.75, back: 0.85 }],
    ['armL', 'torso', [180, 376], { arm: 'L', depth: 0.9 }], ['armR', 'torso', [268, 376], { arm: 'R', depth: 0.9 }],
  ] },
};
const ARM_DOWN = 76; // degrees from the T-pose to arms hanging at the sides

/** Every creature's meshes, built the first time one appears (each part round its own pivot), kept for good. */
const built = new Map();
function geometry(device, name) {
  if (built.has(name)) return built.get(name);
  const design = DESIGNS[name], D = drawing(name, design.height, design.cx, design.ground), shapes = SHAPES[name].parts;
  const keep = (g) => { const mesh = g.mesh(device); mesh.incRefCount(); return mesh; }; // (never freed with the last copy)
  const parts = {};
  for (const [part, , pivotPx, o = {}] of design.parts) {
    const pivot = D.at(pivotPx), shape = shapes[part];
    parts[part] = { pivot, mesh: null, extras: [] };
    if (!shape) continue;
    const { front, back } = shape.kind === 'blob' ? inflated(D, shape, o) : shell(D, shape, o);
    const g = new Geo();
    for (const [m, tint] of [[front, [1, 1, 1]], [back, [0.82, 0.8, 0.8]]]) {
      for (let k = 0; k < m.p.length; k += 3) { m.p[k] -= pivot[0]; m.p[k + 1] -= pivot[1]; m.p[k + 2] -= pivot[2]; }
      g.add(m, null, tint);
    }
    parts[part].mesh = keep(g);
  }
  // A few extras the traces can't carry: the ball's stick and cable, the cat's whiskers.
  const extra = (part, list) => {
    const p = parts[part], g = new Geo();
    for (const [m, tint] of list) { for (let k = 0; k < m.p.length; k += 3) { m.p[k] -= p.pivot[0]; m.p[k + 1] -= p.pivot[1]; m.p[k + 2] -= p.pivot[2]; } g.add(m, null, tint); }
    p.extras.push(keep(g));
  };
  if (name === 'goggles') {
    const cord = [[727, 836], [714, 884], [690, 1000], [622, 1088], [566, 1126]].map((q, i) => D.at(q, i ? 10 : 0));
    extra('ball', [[tube(cord.slice(0, 2), 0.012, 5), [0.35, 0.35, 0.37]], [tube(cord.slice(1), 0.007, 4), [0.06, 0.06, 0.07]]]);
  }
  if (name === 'catman') {
    const whiskers = [];
    for (const s of [-1, 1]) for (const [tx, ty] of [[300, 452], [304, 488], [330, 522], [362, 548]]) {
      const from = D.at([512 + s * 34, 470], 95), to = D.at([s < 0 ? tx : 1024 - tx, ty], 70);
      whiskers.push([tube([from, to], 0.004, 3, { caps: false }), [0.95, 0.95, 0.95]]);
    }
    extra('head', whiskers);
  }
  const out = { parts };
  built.set(name, out);
  return out;
}

function meshEntity(mesh, material, name) {
  const e = new Entity(name);
  e.addComponent('render', { meshInstances: [new MeshInstance(mesh, material)] });
  e.render.castShadows = true;
  return e;
}

/**
 * A creature puppet, facing +Z with its feet (or gown) on the origin. `base`: where the assets live;
 * `plainMat`: an untextured vertex-colour material for cords and whiskers.
 * Returns { name, root, parts, setScared(on) }.
 */
export function createCreature(app, name, { base = './assets/', plainMat } = {}) {
  const design = DESIGNS[name], G = geometry(app.graphicsDevice, name);
  const tex = drawingTexture(app.graphicsDevice, name, base);
  if (!materials.has(name)) materials.set(name, { calm: artMaterial(tex), scared: artMaterial(tex, true) });
  const M = materials.get(name);
  const root = new Entity(`creature-${name}`);
  const parts = {}, meshes = [];
  for (const [part, parent, , o = {}] of design.parts) {
    const pv = G.parts[part].pivot, pp = parent ? G.parts[parent].pivot : [0, 0, 0];
    const e = new Entity(part);
    e.setLocalPosition(pv[0] - pp[0], pv[1] - pp[1], pv[2] - pp[2]);
    (parent ? parts[parent].e : root).addChild(e);
    let holder = e;
    if (o.arm) { holder = new Entity(`${part}-hang`); e.addChild(holder); } // swing (x) outside, hang (z) inside
    parts[part] = { e, hang: o.arm ? holder : null, side: o.arm, rest: e.getLocalPosition().clone() };
    if (G.parts[part].mesh) { const m = meshEntity(G.parts[part].mesh, M.calm, `${part}-mesh`); holder.addChild(m); meshes.push(m); }
    if (plainMat) for (const x of G.parts[part].extras) e.addChild(meshEntity(x, plainMat, `${part}-extra`));
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
