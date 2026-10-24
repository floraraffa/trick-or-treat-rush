// Dev only: the game's models, the Bitmoji clips and the sounds, exported for the Lens Studio project
// (Spectacles). tools/lens-studio/export.mjs opens dev/lens-export.html in headless Chromium and calls
// window.__export(), which returns { files: { path: base64 }, report }.
//   Models are GLB (glTF 2.0), in metres, made with PlayCanvas's own exporter from the very meshes the
//   game draws: the village (cut to a round board, its doors, porch lamps and clock hands kept as nodes
//   the Lens moves), the ghost, the five creatures (each part a node round its pivot, as the game
//   animates them) and the candy, power-up orbs and gems. Texture tiling is baked into the UVs.
//   Clips: the default Bitmoji playing each clip through bitmoji-anim.js, every joint's local rotation
//   recorded 30 times a second, so the Lens can pose any Bitmoji (same rig) without retargeting.
//   Sounds: the synthesised effects and the music box, rendered offline to WAV.
import { BLEND_NORMAL, Color, CULLFACE_NONE, Entity, GltfExporter, Mesh, MeshInstance, StandardMaterial, Vec2, Application } from 'playcanvas';
import { createTextures } from '../textures.js';
import { createVillage } from '../world/village.js';
import { HOUSES } from '../world/layout.js';
import { GEM_COLOR, ORB_COLOR, createCandy } from '../actors/candy.js';
import { CREATURES, createCreature } from '../actors/creatures.js';
import { ghostParts } from '../actors/monsters.js';
import { loadBitmoji } from '../lib/bitmoji-anim.js';
import { unpackGlb } from '../lib/meshopt-glb.js';
import { renderOffline, sfx, musicPhrase, MUSIC_STEP, MUSIC_STEPS } from '../audio.js';
import { Geo, blob } from '../geo.js';

const BASE = '../assets/';
export const BOARD_R = 39;
const SIMPLIFY = +(new URLSearchParams(location.search).get('cell') ?? 0.1); // metres: props and trees // metres: the round board (the fence is at 33, the woods thin out beyond)
const canvas = document.getElementById('app');
const app = new Application(canvas, {});
const device = app.graphicsDevice;
const report = {};
const files = {};

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- meshes ---------------------------------------------------------------------------------

/** A mesh's streams as plain arrays. */
function read(mesh) {
  const p = [], n = [], uv = [], c = [], i = [];
  mesh.getPositions(p); mesh.getNormals(n); mesh.getUvs(0, uv); mesh.getColors(c); mesh.getIndices(i);
  return { p, n, uv, c, i };
}
/** A new mesh from streams, keeping only the triangles `keep(a, b, c)` likes (unused vertices dropped). */
function rebuild(d, keep = () => true) {
  const map = new Map(), out = { p: [], n: [], uv: [], c: [], i: [] };
  const vert = (v) => {
    let k = map.get(v);
    if (k !== undefined) return k;
    k = out.p.length / 3; map.set(v, k);
    out.p.push(d.p[v * 3], d.p[v * 3 + 1], d.p[v * 3 + 2]);
    if (d.n.length) out.n.push(d.n[v * 3], d.n[v * 3 + 1], d.n[v * 3 + 2]);
    if (d.uv.length) out.uv.push(d.uv[v * 2], d.uv[v * 2 + 1]);
    if (d.c.length) out.c.push(d.c[v * 4], d.c[v * 4 + 1], d.c[v * 4 + 2], d.c[v * 4 + 3]);
    return k;
  };
  for (let t = 0; t < d.i.length; t += 3) {
    const [a, b, c] = [d.i[t], d.i[t + 1], d.i[t + 2]];
    if (keep(a, b, c)) out.i.push(vert(a), vert(b), vert(c));
  }
  const m = new Mesh(device);
  m.setPositions(out.p);
  if (out.n.length) m.setNormals(out.n);
  if (out.uv.length) m.setUvs(0, out.uv);
  if (out.c.length) {
    const big = out.c.some((v) => v > 1.001);
    m.setColors32(out.c.map((v) => Math.max(0, Math.min(255, Math.round(big ? v : v * 255)))));
  }
  m.setIndices(out.p.length / 3 > 65535 ? new Uint32Array(out.i) : new Uint16Array(out.i));
  m.update();
  return { mesh: m, tris: out.i.length / 3, verts: out.p.length / 3 };
}

/**
 * Fewer triangles (vertex clustering): vertices in the same `cell`-metre box, facing the same general way,
 * become one (their average); triangles that collapse go. On a table at 1:60 a 6 cm cell is a millimetre.
 */
function decimate(d, cell) {
  const key = new Map(), sums = [], remap = new Int32Array(d.p.length / 3);
  for (let v = 0; v < remap.length; v++) {
    const nx = d.n[v * 3] ?? 0, ny = d.n[v * 3 + 1] ?? 0, nz = d.n[v * 3 + 2] ?? 0, ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const bin = ax >= ay && ax >= az ? (nx > 0 ? 0 : 1) : ay >= az ? (ny > 0 ? 2 : 3) : nz > 0 ? 4 : 5; // (keeps hard edges and both sides of thin shells)
    const k = `${Math.floor(d.p[v * 3] / cell)},${Math.floor(d.p[v * 3 + 1] / cell)},${Math.floor(d.p[v * 3 + 2] / cell)},${bin}`;
    let c = key.get(k);
    if (c === undefined) { c = sums.length; key.set(k, c); sums.push({ n: 0, p: [0, 0, 0], nr: [0, 0, 0], uv: [0, 0], c: [0, 0, 0, 0] }); }
    const s = sums[c];
    s.n++;
    for (let a = 0; a < 3; a++) { s.p[a] += d.p[v * 3 + a]; s.nr[a] += d.n[v * 3 + a] ?? 0; }
    if (d.uv.length) { s.uv[0] += d.uv[v * 2]; s.uv[1] += d.uv[v * 2 + 1]; }
    if (d.c.length) for (let a = 0; a < 4; a++) s.c[a] += d.c[v * 4 + a];
    remap[v] = c;
  }
  const out = { p: [], n: [], uv: [], c: [], i: [] };
  for (const s of sums) {
    out.p.push(...s.p.map((x) => x / s.n));
    const l = Math.hypot(...s.nr) || 1; out.n.push(...s.nr.map((x) => x / l));
    if (d.uv.length) out.uv.push(s.uv[0] / s.n, s.uv[1] / s.n);
    if (d.c.length) out.c.push(...s.c.map((x) => x / s.n));
  }
  const seen = new Set();
  for (let t = 0; t < d.i.length; t += 3) {
    const a = remap[d.i[t]], b = remap[d.i[t + 1]], c = remap[d.i[t + 2]];
    if (a === b || b === c || a === c) continue;
    if (seen.has(`${a},${b},${c}`)) continue;
    seen.add(`${a},${b},${c}`);
    out.i.push(a, b, c);
  }
  return out;
}
/** Decimates every mesh under `root` whose triangle count is over `min`. */
function simplify(root, cell, min = 400) {
  for (const r of root.findComponents('render')) for (const mi of r.meshInstances) {
    if (mi.mesh.primitive[0].count / 3 <= min) continue;
    mi.mesh = rebuild(decimate(read(mi.mesh), cell)).mesh;
  }
}

/** Groups of triangles that share vertices (a tree, a tomb...), as a label per vertex. */
function islands(d) {
  const parent = new Int32Array(d.p.length / 3).map((_, k) => k);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < d.i.length; t += 3) for (const v of [d.i[t + 1], d.i[t + 2]]) { const a = find(d.i[t]), b = find(v); if (a !== b) parent[a] = b; }
  // vertices at the same spot belong together too (Geo parts touch without sharing indices)
  const at = new Map();
  for (let v = 0; v < parent.length; v++) {
    const key = `${Math.round(d.p[v * 3] * 20)},${Math.round(d.p[v * 3 + 1] * 20)},${Math.round(d.p[v * 3 + 2] * 20)}`;
    const o = at.get(key);
    if (o === undefined) at.set(key, v); else { const a = find(o), b = find(v); if (a !== b) parent[a] = b; }
  }
  return parent.map((_, v) => find(v));
}

/** Cuts the village's merged meshes to the round board: whole props (islands) inside it, the ground cut along the edge. */
function cutToBoard(entity, key) {
  const mi = entity.render.meshInstances[0], d = read(mi.mesh);
  const r = (v) => Math.hypot(d.p[v * 3], d.p[v * 3 + 2]);
  let keep;
  if (key === 'ground') keep = (a, b, c) => (r(a) + r(b) + r(c)) / 3 < BOARD_R + 0.6;
  else {
    const label = islands(d), sum = new Map();
    for (let v = 0; v < label.length; v++) { const s = sum.get(label[v]) ?? [0, 0, 0]; s[0] += d.p[v * 3]; s[1] += d.p[v * 3 + 2]; s[2]++; sum.set(label[v], s); }
    const inside = new Map([...sum].map(([k, [x, z, n]]) => [k, Math.hypot(x / n, z / n) < BOARD_R - 0.8]));
    keep = (a) => inside.get(label[a]);
  }
  const { mesh, tris } = rebuild(d, keep);
  mi.mesh = mesh;
  return tris;
}

/** Bakes a material's texture tiling into a mesh's UVs (the Lens gets plain 0..n UVs, no texture transform). */
function bakeTiling(entities) {
  const done = new Set();
  for (const e of entities) for (const mi of e.render?.meshInstances ?? []) {
    const m = mi.material, t = m.diffuseMapTiling, o = m.diffuseMapOffset;
    if (!t || (t.x === 1 && t.y === 1 && o.x === 0 && o.y === 0)) continue;
    const d = read(mi.mesh);
    for (let k = 0; k < d.uv.length; k += 2) { d.uv[k] = d.uv[k] * t.x + o.x; d.uv[k + 1] = d.uv[k + 1] * t.y + o.y; }
    mi.mesh = rebuild(d).mesh;
    done.add(m);
  }
  for (const m of done) {
    for (const map of ['diffuseMap', 'normalMap', 'emissiveMap', 'opacityMap', 'glossMap', 'metalnessMap', 'aoMap']) {
      if (m[`${map}Tiling`]) m[`${map}Tiling`] = new Vec2(1, 1);
      if (m[`${map}Offset`]) m[`${map}Offset`] = new Vec2(0, 0);
    }
    m.update();
  }
}

const count = (root) => {
  let tris = 0, verts = 0, draws = 0;
  for (const r of root.findComponents('render')) for (const mi of r.meshInstances) { tris += mi.mesh.primitive[0].count / 3; verts += mi.mesh.vertexBuffer.numVertices; draws++; }
  return { tris: Math.round(tris), verts, draws };
};

/**
 * Tidies the exporter's GLB: byte colours marked `normalized` (glTF requires it; without it they read as
 * white), and meshes and materials named after their nodes (Lens Studio names its imported assets so).
 */
function tidyGlb(buf) {
  const dv = new DataView(buf), jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const bin = new Uint8Array(buf, 20 + jsonLen + 8, dv.getUint32(20 + jsonLen, true));
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    for (const [sem, a] of Object.entries(p.attributes)) {
      const acc = json.accessors[a];
      if (sem.startsWith('COLOR_') && (acc.componentType === 5121 || acc.componentType === 5123)) acc.normalized = true;
    }
  }
  for (const n of json.nodes ?? []) {
    if (n.mesh === undefined) continue;
    const mesh = json.meshes[n.mesh];
    mesh.name ??= n.name;
    for (const p of mesh.primitives) { const mat = json.materials?.[p.material]; if (mat && (!mat.name || mat.name === 'Untitled')) mat.name = n.name; }
  }
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonBytes = new TextEncoder().encode(text), total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(total), o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
  o.setUint32(12, jsonBytes.length, true); o.setUint32(16, 0x4e4f534a, true); out.set(jsonBytes, 20);
  o.setUint32(20 + jsonBytes.length, bin.length, true); o.setUint32(24 + jsonBytes.length, 0x004e4942, true); out.set(bin, 28 + jsonBytes.length);
  return out.buffer;
}

async function glb(name, root, maxTextureSize = 512) {
  // No normal maps: at table-top scale their detail is below a pixel, and they would double the textures.
  for (const r of root.findComponents('render')) for (const mi of r.meshInstances) if (mi.material.normalMap) { mi.material.normalMap = null; mi.material.update(); }
  const buf = tidyGlb(await new GltfExporter().build(root, { maxTextureSize, stripUnusedAttributes: false })); // (keeps the vertex colours)
  files[`Models/${name}.glb`] = b64(buf);
  report[name] = { ...count(root), kb: Math.round(buf.byteLength / 1024) };
}

/** A node at (0, 1, 0) metres: the Lens reads it back to learn the import's unit (1, or 100 in centimetres). */
const unitMarker = () => { const e = new Entity('unit-marker'); e.setLocalPosition(0, 1, 0); return e; };

// --- the village --------------------------------------------------------------------------------

async function village(tex) {
  const v = createVillage(app, tex, { lowFx: true });
  const root = v.root;
  // Not on a table: the sky, the lights (the Lens lights the board itself) and the camera-facing lamp halos.
  v.sky.root.destroy();
  for (const e of root.find((n) => n.light)) e.destroy();
  for (const e of root.find((n) => n.name === 'lamp-halo')) e.destroy();
  const statics = root.findByName('village-static');
  let cut = 0;
  for (const e of [...statics.children]) {
    const key = e.name.replace('village-static-', '');
    if (key === 'silhouette') { e.destroy(); continue; }
    cut += cutToBoard(e, key);
    if (['plain', 'bark', 'emit', 'glossy', 'woods', 'rock'].includes(key)) simplify(e, SIMPLIFY);
    else if (key === 'wood') simplify(e, 0.06);
  }
  // Clock hands: named so the Lens can turn them (minute and hour on each of the four faces).
  v.clock.hands.forEach((h, f) => { h.minute.name = `clock-${f}-minute`; h.hour.name = `clock-${f}-hour`; });
  // Porch lamps: a violet twin beside each gold one (the Lens shows one or the other: ready / cooling down).
  v.houses.forEach((h, i) => {
    const cool = h.lamp.clone();
    cool.name = `porch-cool-${HOUSES[i].id}`;
    const m = new StandardMaterial();
    m.diffuse = new Color(0.1, 0.08, 0.06); m.emissive = new Color(0.45, 0.25, 0.78); m.update();
    cool.render.meshInstances[0].material = m;
    h.lamp.parent.addChild(cool);
  });
  // The board's rim: a thin glowing ring where the village ends.
  const rimMat = new StandardMaterial();
  rimMat.useLighting = false; rimMat.diffuse = new Color(0, 0, 0); rimMat.emissive = new Color(1, 0.55, 0.16); rimMat.update();
  const rim = new Geo();
  const N = 160, tube = 0.22;
  const m = { p: [], n: [], uv: [], i: [] };
  for (let k = 0; k <= N; k++) {
    const a = (k / N) * Math.PI * 2;
    for (let s = 0; s <= 6; s++) {
      const b = (s / 6) * Math.PI * 2, rr = BOARD_R + 0.4 + Math.cos(b) * tube;
      m.p.push(Math.cos(a) * rr, 0.15 + Math.sin(b) * tube, Math.sin(a) * rr);
      m.n.push(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)); m.uv.push(k / N, s / 6);
    }
  }
  for (let k = 0; k < N; k++) for (let s = 0; s < 6; s++) { const a = k * 7 + s, b = a + 7; m.i.push(a, b, a + 1, a + 1, b, b + 1); }
  rim.add(m, null, [1, 1, 1]);
  root.addChild(rim.build(device, rimMat, 'board-rim'));
  root.addChild(unitMarker());
  bakeTiling(root.find((n) => !!n.render));
  report.villageCutTris = cut;
  await glb('village', root, 512);
  return v;
}

// --- monsters, candy ----------------------------------------------------------------------------

function mat({ color = [1, 1, 1], emissive = [0, 0, 0], opacity = 1, gloss = 0.4, twoSided = false } = {}) {
  const m = new StandardMaterial();
  m.diffuse = new Color(...color); m.diffuseVertexColor = true; m.emissive = new Color(...emissive);
  m.gloss = gloss; m.useMetalness = true; m.metalness = 0;
  if (opacity < 1) { m.blendType = BLEND_NORMAL; m.opacity = opacity; }
  if (twoSided) m.cull = CULLFACE_NONE;
  m.update();
  return m;
}

async function ghost() {
  // As monsters.js draws it: the sheet (calm and frightened) and the face (idle, chasing, frightened).
  const { body, face } = ghostParts();
  const root = new Entity('ghost'), inner = new Entity('inner');
  root.addChild(inner);
  const add = (geo, m, name, on = true) => { const e = geo.build(device, m, name); e.enabled = on; inner.addChild(e); };
  add(body, mat({ color: [0.95, 0.94, 1], emissive: [0.32, 0.3, 0.45], opacity: 0.86, gloss: 0.6, twoSided: true }), 'body');
  add(body, mat({ color: [0.45, 0.6, 1], emissive: [0.15, 0.3, 0.75], opacity: 0.8, gloss: 0.6, twoSided: true }), 'body-scared');
  add(face, mat({ color: [0.02, 0.02, 0.04] }), 'face-idle');
  add(face, mat({ color: [0.2, 0, 0], emissive: [1, 0.12, 0.08] }), 'face-chase');
  add(face, mat({ color: [0.9, 0.95, 1], emissive: [0.8, 0.9, 1] }), 'face-scared');
  root.addChild(unitMarker());
  await glb('ghost', root);
}

async function creatures() {
  const plainMat = mat({ gloss: 0.3 });
  for (const name of CREATURES) {
    const c = createCreature(app, name, { base: BASE, plainMat });
    // wait for the drawing (the texture starts as a 4×4 stand-in)
    const tex = c.root.findComponents('render')[0].meshInstances[0].material.diffuseMap;
    for (let k = 0; k < 200 && tex.width <= 4; k++) await wait(50);
    simplify(c.root, 0.035, 300);
    c.root.addChild(unitMarker());
    await glb(`creature-${name}`, c.root, 1024);
  }
}

/** A lit material tinted by vertex colours, glowing `glow` (glTF's emissive ignores vertex colours: it is set per kind). */
function pickupMat(glow, { opacity = 1, metal = 0, gloss = 0.7 } = {}) {
  const m = new StandardMaterial();
  m.diffuse = new Color(1, 1, 1); m.diffuseVertexColor = true; m.emissive = new Color(...glow);
  m.useMetalness = true; m.metalness = metal; m.gloss = gloss;
  if (opacity < 1) { m.blendType = BLEND_NORMAL; m.opacity = opacity; m.cull = CULLFACE_NONE; }
  m.update();
  return m;
}
const setMat = (e, m, only = () => true) => { for (const r of e.findComponents('render')) if (only(r.entity)) for (const mi of r.meshInstances) mi.material = m; };

async function pickups(tex) {
  const { models } = createCandy(app, tex, null);
  const root = new Entity('pickups');
  for (const [type, e] of Object.entries(models.candy)) {
    const c = e.clone(); c.name = `candy-${type}`;
    setMat(c, type === 'pumpkin' ? pickupMat([0.35, 0.25, 0.06], { metal: 0.7, gloss: 0.85 }) : pickupMat([0.12, 0.12, 0.12], { gloss: 0.85 }));
    root.addChild(c);
  }
  for (const [kind, e] of Object.entries(models.orbs)) {
    const c = e.clone(), col = ORB_COLOR[kind];
    c.name = `orb-${kind}`;
    // the game's shell is additive (glTF has none): a see-through tinted shell over a glowing icon
    setMat(c, pickupMat(col.map((v) => v * 0.45), { opacity: 0.4 }), (n) => n.name === 'orb-shell');
    setMat(c, pickupMat(col.map((v) => v * 0.8)), (n) => n.name === 'orb-icon');
    root.addChild(c);
  }
  for (const [kind, e] of Object.entries(models.gems)) {
    const c = e.clone(); c.name = `gem-${kind}`;
    setMat(c, pickupMat(GEM_COLOR[kind].map((v) => v * 0.55), { gloss: 0.95, metal: 0.3 }));
    root.addChild(c);
  }
  // A soft shadow-like glow disc under every pickup.
  const glow = new Geo().add(blob(0.5, 12, { squashY: 0.04 }), null, [1, 0.8, 0.4]);
  const gm = new StandardMaterial(); gm.useLighting = false; gm.diffuse = new Color(0, 0, 0); gm.emissive = new Color(1, 0.75, 0.35); gm.emissiveVertexColor = true; gm.blendType = BLEND_NORMAL; gm.opacity = 0.35; gm.update();
  root.addChild(glow.build(device, gm, 'glow-disc'));
  root.addChild(unitMarker());
  bakeTiling(root.find((n) => !!n.render));
  await glb('pickups', root);
}

// --- Bitmoji clips ------------------------------------------------------------------------------

async function clips() {
  const get = async (url) => unpackGlb(await (await fetch(url)).arrayBuffer()); // (meshopt-packed for the Lens budget)
  const [lib, avatar] = await Promise.all([get(`${BASE}clips.glb`), get(`${BASE}avatar_default.glb`)]);
  const b = await loadBitmoji(app, { clips: lib, fallback: avatar, url: null, autoUpdate: false });
  app.root.addChild(b.entity);
  const nodes = b.entity.find(() => true).filter((n) => /_JNT$|^ROOT$/i.test(n.name));
  const hips = b.joint('Hips');
  const FPS = 30, out = { fps: FPS, hips: hips?.name ?? null, hipsRest: hips ? [...hips.getLocalPosition().toArray()] : null, clips: {} };
  for (const name of b.clips) {
    const len = b.length(name), frames = Math.max(2, Math.round(len * FPS) + 1);
    b.play(name, { fade: 0, loop: false });
    const rec = Object.fromEntries(nodes.map((n) => [n.name, []]));
    const hp = [];
    for (let f = 0; f < frames; f++) {
      b.update(f === 0 ? 0 : 1 / FPS);
      for (const n of nodes) { const q = n.getLocalRotation(); rec[n.name].push(+q.x.toFixed(4), +q.y.toFixed(4), +q.z.toFixed(4), +q.w.toFixed(4)); }
      if (hips) { const p = hips.getLocalPosition(); hp.push(+p.x.toFixed(4), +p.y.toFixed(4), +p.z.toFixed(4)); }
    }
    // keep only joints that move in this clip
    const joints = {};
    for (const [k, arr] of Object.entries(rec)) { let moves = false; for (let i = 4; i < arr.length && !moves; i++) moves = Math.abs(arr[i] - arr[i % 4]) > 1e-3; joints[k] = moves ? arr : arr.slice(0, 4); }
    out.clips[name] = { frames, loop: b.isLoop(name), joints, hips: hp };
  }
  report.clips = Object.fromEntries(Object.entries(out.clips).map(([k, c]) => [k, `${c.frames} frames${c.loop ? ', loops' : ''}`]));
  files['Scripts/Generated/clips.ts'] = btoa(unescape(encodeURIComponent(
    `// Generated by tools/lens-studio/export.mjs (trick-or-treat-rush): the Bitmoji clips (idle, walk, run, knock, hit, cheer,\n` +
    `// sad) as every joint's local rotation [x, y, z, w] at ${FPS} fps, recorded on Snap's default Bitmoji. Do not edit.\n` +
    `// @ts-nocheck\nexport const CLIPS = ${JSON.stringify(out)};\n`)));
  b.destroy();
}

// --- sounds -------------------------------------------------------------------------------------

function wav(buffer) {
  const data = buffer.getChannelData(0), rate = buffer.sampleRate, n = data.length;
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => { for (let k = 0; k < s.length; k++) out.setUint8(o + k, s.charCodeAt(k)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 2, true);
  let peak = 0;
  for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(data[k]));
  const g = peak > 0.98 ? 0.98 / peak : 1;
  for (let k = 0; k < n; k++) out.setInt16(44 + k * 2, Math.round(Math.max(-1, Math.min(1, data[k] * g)) * 32767), true);
  return out.buffer;
}

async function sounds() {
  const RATE = 22050;
  const list = {
    knock: [() => sfx.knock(), 0.5], creak: [() => sfx.creak(), 1.1], candy: [() => sfx.candy(5), 0.4], candyBig: [() => sfx.candy(25), 0.5],
    treat: [() => sfx.treat(), 0.9], jackpot: [() => sfx.jackpot(), 1.2], trick: [() => sfx.trick(), 1.1], ghost: [() => sfx.ghost(), 1.3],
    creature: [() => sfx.creature(), 1.2], hit: [() => sfx.hit(), 0.5], blocked: [() => sfx.blocked(), 0.4], power: [() => sfx.power(), 0.5],
    orb: [() => sfx.orb(), 0.35], beep: [() => sfx.beep(), 0.25], go: [() => sfx.go(), 0.5], tick: [() => sfx.tick(), 0.1],
    madness: [() => sfx.madness(), 4], win: [() => sfx.win(), 1.3], lose: [() => sfx.lose(), 1.9], click: [() => sfx.click(), 0.1],
    thunder: [() => sfx.thunder(1), 3],
  };
  for (const [name, [fn, secs]] of Object.entries(list)) files[`Audio/${name}.wav`] = b64(wav(await renderOffline(fn, secs, RATE)));
  // The music box: one whole phrase, its tail folded back onto the start so it loops without a seam.
  const phrase = MUSIC_STEPS * MUSIC_STEP;
  for (const mad of [false, true]) {
    const buf = await renderOffline(() => musicPhrase(mad), phrase + 1.2, RATE);
    const n = Math.round(phrase * RATE), d = buf.getChannelData(0), loop = new AudioBuffer({ length: n, sampleRate: RATE, numberOfChannels: 1 }), o = loop.getChannelData(0);
    for (let k = 0; k < d.length; k++) o[k % n] += d[k];
    files[`Audio/${mad ? 'music-madness' : 'music'}.wav`] = b64(wav(loop));
  }
  report.sounds = Object.keys(files).filter((f) => f.startsWith('Audio/')).length;
}

window.__export = async (only = null) => {
  const tex = createTextures(device, { base: BASE });
  await tex.ready;
  const steps = { village: () => village(tex), ghost, creatures, pickups: () => pickups(tex), clips, sounds };
  const errors = [];
  for (const [name, step] of Object.entries(steps)) {
    if (only && !only.includes(name)) continue;
    try { await step(); } catch (e) { errors.push(`${name}: ${e.stack ?? e}`); }
  }
  return { files, report, errors };
};
window.__ready = true;
