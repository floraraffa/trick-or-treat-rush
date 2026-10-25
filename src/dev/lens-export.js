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
import { ADDRESS_REPEAT, BLEND_NORMAL, Color, CULLFACE_NONE, Entity, GltfExporter, Mesh, MeshInstance, PIXELFORMAT_SRGBA8, StandardMaterial, Texture, Vec2, Application } from 'playcanvas';
import { createTextures } from '../textures.js';
import { createVillage } from '../world/village.js';
import { HOUSES } from '../world/layout.js';
import { CANDY_GLOW, GEM_COLOR, ORB_COLOR, createCandy } from '../actors/candy.js';
import { CREATURES, createCreature } from '../actors/creatures.js';
import { ghostParts } from '../actors/monsters.js';
import { loadBitmoji } from '../lib/bitmoji-anim.js';
import { unpackGlb } from '../lib/meshopt-glb.js';
import { renderOffline, sfx, musicPhrase, MUSIC_STEP, MUSIC_STEPS } from '../audio.js';
import { Geo, blob, trs } from '../geo.js';
import { lightningPaths, ribbons, stormCloudGeo } from '../actors/effects.js';
import { rng } from '../rng.js';

const BASE = '../assets/';
export const BOARD_R = 39; // metres: the round board (the fence is at 33, the woods thin out beyond)
const SIMPLIFY = +(new URLSearchParams(location.search).get('cell') ?? 0.1); // metres: props and trees
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

/** A flat disc of radius r facing up, its UVs spanning the glow texture. `rings` > 1: vertex alpha fading to its rim. */
function disc(r, segs = 24, rings = 1, uvScale = 0) {
  const m = { p: [0, 0, 0], n: [0, 1, 0], uv: [uvScale ? 0 : 0.5, uvScale ? 0 : 0.5], i: [], a: [1] };
  for (let k = 1; k <= rings; k++) {
    const rr = (k / rings) * r;
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      m.p.push(x, 0, z); m.n.push(0, 1, 0);
      m.uv.push(uvScale ? x * uvScale : 0.5 + (x / r) * 0.5, uvScale ? z * uvScale : 0.5 + (z / r) * 0.5);
      m.a.push(rings > 1 ? Math.max(0, 1 - Math.pow(k / rings, 3)) : 1);
    }
  }
  for (let s = 0; s < segs; s++) m.i.push(0, s + 2, s + 1);
  for (let k = 1; k < rings; k++) {
    const a0 = 1 + (k - 1) * (segs + 1), a1 = a0 + segs + 1;
    for (let s = 0; s < segs; s++) m.i.push(a0 + s, a0 + s + 1, a1 + s, a0 + s + 1, a1 + s + 1, a1 + s);
  }
  return m;
}
/** Builds `geo` with its vertex alpha (a disc's fade) applied. */
function withAlpha(geom, colour = [1, 1, 1]) {
  const g = new Geo().add(geom, null, colour);
  for (let v = 0; v < geom.a.length; v++) g.c[v * 4 + 3] = geom.a[v] * 255;
  return g;
}
/** An unlit, see-through glow: `colour` × the texture (the game's soft glow by default), `opacity` at most. */
function glowMat(tex, colour, opacity = 1, map = null) {
  const m = new StandardMaterial();
  m.useLighting = false; m.useSkybox = false; m.useFog = false;
  m.diffuse = new Color(0, 0, 0); m.emissive = new Color(...colour); m.emissiveMap = map ?? tex.glow;
  m.opacity = opacity; m.blendType = BLEND_NORMAL; m.depthWrite = false; m.cull = CULLFACE_NONE;
  m.update();
  return m;
}
/** A ring (torus) of radius r lying flat. */
function ring(r, tube = 0.05, segs = 40) {
  const m = { p: [], n: [], uv: [], i: [] };
  for (let k = 0; k <= segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    for (let s = 0; s <= 6; s++) {
      const b = (s / 6) * Math.PI * 2, rr = r + Math.cos(b) * tube;
      m.p.push(Math.cos(a) * rr, Math.sin(b) * tube, Math.sin(a) * rr); m.n.push(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b)); m.uv.push(0.5, 0.5);
    }
  }
  for (let k = 0; k < segs; k++) for (let s = 0; s < 6; s++) { const a = k * 7 + s, b = a + 7; m.i.push(a, b, a + 1, a + 1, b, b + 1); }
  return m;
}
/** A soft, tileable cloud texture for the mist (white, its alpha the cloud). */
function mistTexture() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x, y, p) => { // value noise wrapping every p cells
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => hash(((i % p) + p) % p, ((j % p) + p) % p);
    return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, amp = 0.55, f = 4;
    for (let o = 0; o < 4; o++) { v += noise((x / N) * f, (y / N) * f, f) * amp; amp *= 0.5; f *= 2; }
    const a = Math.max(0, Math.min(1, (v - 0.3) / 0.45));
    const i = (y * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new Texture(device, { width: N, height: N, format: PIXELFORMAT_SRGBA8, mipmaps: true, addressU: ADDRESS_REPEAT, addressV: ADDRESS_REPEAT });
  t.setSource(c);
  return t;
}

// --- the village --------------------------------------------------------------------------------

async function village(tex) {
  const v = createVillage(app, tex, { lowFx: true });
  const root = v.root;
  // Not on a table: the sky and the lights (the Lens lights the board itself).
  v.sky.root.destroy();
  for (const e of root.find((n) => n.light)) e.destroy();
  // The lamps: an empty node where each one glows (the Lens turns a glow to the eyes there, as the game's
  // halos do) and a pool of warm light on the ground round its foot (the game's lamp lights and mist).
  const pools = new Geo();
  root.find((n) => n.name === 'lamp-halo').forEach((h, i) => {
    const p = h.getLocalPosition(), spot = new Entity(`halo-${i}`);
    spot.setLocalPosition(p.x, p.y, p.z);
    root.addChild(spot);
    pools.add(disc(3.6), trs(p.x, 0.08, p.z), [1, 1, 1]);
    h.destroy();
  });
  root.addChild(pools.build(device, glowMat(tex, [1, 0.62, 0.3], 0.5), 'lamp-pools'));
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

// --- effects: mist, glows, beams, auras, markers ------------------------------------------------

/**
 * fx.glb, the Lens's light and air (the game draws these with fog, lamps and particles):
 *   mist-0..3   four wide sheets of drifting mist low over the board (the Lens turns them slowly), and
 *               mist-mad-0..3, their red-violet twins for the Monster Madness
 *   moon, moon-mad, moon-halo, stars   the sky (cards the Lens turns to the eyes; stars on a unit dome)
 *   wisp, bat (wing-l / wing-r hinges)   will-o'-wisps and bats
 *   storm-cloud, bolt-0..2, flash-pool   the candy storm's thundercloud and lightning
 *   halo-warm   a lamp's glow, a card the Lens turns to the eyes
 *   pool-*      a glow on the ground under each kind of candy, orb and gem
 *   beam-*      a gem's beam of light, seen from across the village
 *   aura-*      a ring round the player while a gem or power-up is on
 *   target, cursor   where the player is going, and where they look
 */
async function fx(tex) {
  const root = new Entity('fx');
  const add = (geo, m, name) => { const e = geo.build(device, m, name); root.addChild(e); return e; };
  // Mist: four sheets, the densest on the ground (the game's height fog), and the Monster Madness's
  // red-violet twins (the Lens shows one set or the other).
  const mist = mistTexture();
  [[0.12, 0.34, 1 / 7], [0.35, 0.3, 1 / 9], [0.9, 0.22, 1 / 13], [1.8, 0.15, 1 / 17]].forEach(([y, opacity, uv], i) => {
    add(withAlpha(disc(BOARD_R - 1, 48, 6, uv)), glowMat(tex, [0.84, 0.82, 0.95], opacity, mist), `mist-${i}`).setLocalPosition(0, y, 0);
    add(withAlpha(disc(BOARD_R - 1, 48, 6, uv)), glowMat(tex, [1, 0.62, 0.72], opacity * 1.15, mist), `mist-mad-${i}`).setLocalPosition(0, y, 0);
  });
  const card = { p: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], uv: [0, 0, 1, 0, 1, 1, 0, 1], i: [0, 1, 2, 0, 2, 3] };
  add(new Geo().add(card, null, [1, 1, 1]), glowMat(tex, [1, 0.7, 0.38], 0.85), 'halo-warm');
  // The sky, as the game's: a big pale moon with a halo (a sickly red one in the madness), and stars on a
  // dome of radius 1 (the Lens sizes it), each a little card turned inwards, brighter overhead.
  add(new Geo().add(card, null, [1, 1, 1]), glowMat(tex, [1, 0.98, 0.92], 1, tex.moon), 'moon');
  add(new Geo().add(card, null, [1, 1, 1]), glowMat(tex, [1, 0.55, 0.48], 1, tex.moon), 'moon-mad');
  add(new Geo().add(card, null, [1, 1, 1]), glowMat(tex, [0.5, 0.56, 0.85], 0.55), 'moon-halo');
  {
    const R = rng(7), g = new Geo();
    for (let k = 0; k < 260; k++) {
      const a = R() * Math.PI * 2, e = Math.asin(0.15 + R() * 0.85), sz = 0.008 + R() * R() * 0.02;
      const p = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
      const yaw = Math.atan2(-p[0], -p[2]) * 57.2958, pitch = Math.asin(-p[1]) * 57.2958;
      const b = (0.45 + R() * 0.55) * (0.5 + 0.5 * Math.sin(e));
      g.add(card, trs(p[0], p[1], p[2]).mul(trs(0, 0, 0, 0, yaw, 0)).mul(trs(0, 0, 0, -pitch, 0, 0)).mul(trs(0, 0, 0, 0, 0, 0, sz)), [b, b, b * (0.9 + R() * 0.2)]);
    }
    add(g, glowMat(tex, [1, 1, 1], 1), 'stars');
  }
  // Will-o'-wisps: pale green lights drifting over the graves and streets.
  add(new Geo().add(card, null, [1, 1, 1]), glowMat(tex, [0.62, 1, 0.82], 0.85), 'wisp');
  // Bats: a body, two wings on hinges at its sides (the Lens flaps them), red eyes.
  {
    const bat = new Entity('bat');
    const batMat = new StandardMaterial();
    // (dusky violet, not black: on the glasses' see-through display black is clear)
    batMat.diffuse = new Color(0.3, 0.22, 0.38); batMat.emissive = new Color(0.13, 0.08, 0.18); batMat.gloss = 0.2; batMat.cull = CULLFACE_NONE; batMat.update();
    const eyeMat = new StandardMaterial(); eyeMat.useLighting = false; eyeMat.diffuse = new Color(0, 0, 0); eyeMat.emissive = new Color(1, 0.15, 0.1); eyeMat.update();
    const body = new Geo();
    body.add(blob(0.11, 8, { squashY: 1.25 }), null, [1, 1, 1]);
    body.add(blob(0.075, 8), trs(0, 0.1, 0.09), [1, 1, 1]);
    for (const sd of [-1, 1]) body.add(blob(0.03, 5, { squashY: 2.2 }), trs(sd * 0.04, 0.19, 0.08, 0, 0, -sd * 20), [1, 1, 1]); // ears
    bat.addChild(body.build(device, batMat, 'bat-body'));
    const eyes = new Geo();
    for (const sd of [-1, 1]) eyes.add(blob(0.016, 5), trs(sd * 0.028, 0.115, 0.155), [1, 1, 1]);
    bat.addChild(eyes.build(device, eyeMat, 'bat-eyes'));
    // a membrane: a fan from the shoulder to three finger tips, scalloped between them
    const outline = [[0, 0], [0.2, 0.16], [0.46, 0.2], [0.62, 0.06], [0.5, 0.0], [0.42, -0.06], [0.3, -0.02], [0.2, -0.1], [0.08, -0.06]];
    for (const sd of [-1, 1]) {
      const hinge = new Entity(sd < 0 ? 'wing-l' : 'wing-r');
      hinge.setLocalPosition(sd * 0.07, 0.03, 0);
      const m = { p: [], n: [], uv: [], i: [] };
      for (const [x, z] of outline) { m.p.push(sd * x, 0, z); m.n.push(0, 1, 0); m.uv.push(0.5, 0.5); }
      for (let k = 1; k < outline.length - 1; k++) m.i.push(0, k, k + 1);
      hinge.addChild(new Geo().add(m, null, [1, 1, 1]).build(device, batMat, `${sd < 0 ? 'wing-l' : 'wing-r'}-mesh`));
      bat.addChild(hinge);
    }
    root.addChild(bat);
  }
  // The candy storm: the game's thundercloud and three lightning strikes (crossed ribbons, to read from
  // any side) from it to the ground, with a cold flash of light on the ground where one lands.
  {
    const cloudMat = new StandardMaterial();
    cloudMat.diffuse = new Color(1, 1, 1); cloudMat.diffuseVertexColor = true; cloudMat.emissive = new Color(0.1, 0.08, 0.17); cloudMat.gloss = 0.05; cloudMat.update();
    add(stormCloudGeo(), cloudMat, 'storm-cloud');
    for (let v = 0; v < 3; v++) {
      const R = rng(97 + v * 13), paths = lightningPaths(R, 0, 5.8, 0, (R() - 0.5) * 5, (R() - 0.5) * 5);
      const g = new Geo().add(ribbons(paths, { x: 100, y: 3, z: 0 }, 0.75), null, [1, 1, 1]).add(ribbons(paths, { x: 0, y: 3, z: 100 }, 0.75), null, [1, 1, 1]);
      add(g, glowMat(tex, [0.85, 0.9, 1], 1, tex.bolt), `bolt-${v}`);
    }
    add(new Geo().add(disc(4), null, [1, 1, 1]), glowMat(tex, [0.78, 0.84, 1], 0.8), 'flash-pool');
  }
  const pools = { ...Object.fromEntries(Object.entries(CANDY_GLOW).map(([k, c]) => [`candy-${k}`, c])), ...Object.fromEntries(Object.entries(ORB_COLOR).map(([k, c]) => [`orb-${k}`, c])), ...Object.fromEntries(Object.entries(GEM_COLOR).map(([k, c]) => [`gem-${k}`, c])) };
  for (const [k, c] of Object.entries(pools)) add(new Geo().add(disc(1), null, [1, 1, 1]), glowMat(tex, c, 0.75), `pool-${k}`);
  // Gem beams: as candy.js draws them, fading out going up.
  for (const [kind, c] of Object.entries(GEM_COLOR)) {
    const m = { p: [], n: [], uv: [], i: [], a: [] };
    for (let k = 0; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      for (const y of [0, 9]) { m.p.push(Math.cos(a) * 0.35, y, Math.sin(a) * 0.35); m.n.push(Math.cos(a), 0, Math.sin(a)); m.uv.push(0.5, 0.5); m.a.push(y > 1 ? 0 : 0.7); }
    }
    for (let k = 0; k < 12; k++) { const a = k * 2; m.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const plain = glowMat(tex, c, 1, tex.plain);
    add(withAlpha(m), plain, `beam-${kind}`);
  }
  const AURA = { ...GEM_COLOR, ...ORB_COLOR, slow: [0.55, 0.55, 0.7] };
  for (const [kind, c] of Object.entries(AURA)) add(new Geo().add(ring(0.95, 0.07), null, [1, 1, 1]), glowMat(tex, c, 0.95, tex.plain), `aura-${kind}`);
  add(new Geo().add(ring(0.75, 0.08), null, [1, 1, 1]), glowMat(tex, [1, 0.85, 0.4], 0.95, tex.plain), 'target');
  add(new Geo().add(disc(0.9), null, [1, 1, 1]), glowMat(tex, [1, 0.9, 0.6], 0.8), 'target-glow');
  add(new Geo().add(ring(0.35, 0.05), null, [1, 1, 1]), glowMat(tex, [0.9, 0.95, 1], 0.8, tex.plain), 'cursor');
  root.addChild(unitMarker());
  await glb('fx', root, 256);
}

// --- Bitmoji clips ------------------------------------------------------------------------------

async function clips() {
  const get = async (url) => unpackGlb(await (await fetch(url)).arrayBuffer()); // (meshopt-packed for the Lens budget)
  const [lib, avatar] = await Promise.all([get(`${BASE}clips.glb`), get(`${BASE}avatar_default.glb`)]);
  const b = await loadBitmoji(app, { clips: lib, fallback: avatar, url: null, autoUpdate: false });
  app.root.addChild(b.entity);
  // Snap's default Bitmoji, rigged, for when the player's own can't load (as the game does): exported
  // before any clip plays, so its rest pose is the GLB's own.
  const marker = unitMarker();
  b.entity.addChild(marker);
  await glb('bitmoji-default', b.entity, 512);
  marker.destroy();
  // Every joint, and the scale-compensation node Snap's rig puts on each (`…_JNT_SSC`): those are what the
  // clips turn. Nodes a clip leaves alone are dropped below.
  const nodes = b.entity.find(() => true).filter((n) => /_JNT(_SSC)?$|^ROOT$/i.test(n.name));
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
  // Wind: filtered noise rising and falling, every swell a whole number of times in 12 s, so it loops.
  {
    const secs = 12, octx = new OfflineAudioContext(1, RATE * secs, RATE);
    const buf = octx.createBuffer(1, RATE * secs, RATE), d = buf.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    const src = octx.createBufferSource(), bp = octx.createBiquadFilter(), g = octx.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.4;
    for (let t = 0; t <= secs; t += 0.25) {
      const u = (t / secs) * Math.PI * 2;
      bp.frequency.linearRampToValueAtTime(320 + 200 * Math.sin(u * 2) + 90 * Math.sin(u * 5 + 1), t);
      g.gain.linearRampToValueAtTime(0.3 + 0.2 * Math.sin(u * 3 + 0.5) + 0.08 * Math.sin(u * 7), t);
    }
    src.connect(bp).connect(g).connect(octx.destination);
    src.start();
    files['Audio/wind.wav'] = b64(wav(await octx.startRendering()));
  }
  report.sounds = Object.keys(files).filter((f) => f.startsWith('Audio/')).length;
}

window.__export = async (only = null) => {
  const tex = createTextures(device, { base: BASE });
  await tex.ready;
  const steps = { village: () => village(tex), ghost, creatures, pickups: () => pickups(tex), fx: () => fx(tex), clips, sounds };
  const errors = [];
  for (const [name, step] of Object.entries(steps)) {
    if (only && !only.includes(name)) continue;
    try { await step(); } catch (e) { errors.push(`${name}: ${e.stack ?? e}`); }
  }
  return { files, report, errors };
};
window.__ready = true;
