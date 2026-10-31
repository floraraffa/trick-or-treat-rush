// Extra primitives for the haunted village, in the same { p, n, uv, i } form as geo.js: curved
// tubes (chimneys, branches, lamp crooks), lathes (pumpkins, ghosts, tower roofs), crooked roofs and
// extruded outlines (arched doors, tombstones). Everything is merged into batches by Geo.
import { calculateNormals } from 'playcanvas';
import { sides } from '../geo.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * A tube through `pts` ([x,y,z] list) with radius `r` (number, or array per point), `segs` sides.
 * Frames are carried along the curve (no twisting flips), UVs in metres.
 */
export function tube(pts, r, segs = 8, { caps = true, uvScale = 1 } = {}) {
  segs = sides(segs, 4);
  const m = { p: [], n: [], uv: [], i: [] };
  const rad = (k) => (Array.isArray(r) ? r[k] : r);
  const tangents = pts.map((p, k) => nrm(sub(pts[Math.min(pts.length - 1, k + 1)], pts[Math.max(0, k - 1)])));
  let normal = Math.abs(tangents[0][1]) < 0.9 ? nrm(cross(tangents[0], [0, 1, 0])) : nrm(cross(tangents[0], [1, 0, 0]));
  let along = 0;
  for (let k = 0; k < pts.length; k++) {
    const t = tangents[k];
    if (k > 0) {
      along += len(sub(pts[k], pts[k - 1]));
      normal = nrm(cross(cross(t, normal), t)); // project the previous normal onto the new plane
    }
    const bin = cross(t, normal);
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const d = [normal[0] * c + bin[0] * sn, normal[1] * c + bin[1] * sn, normal[2] * c + bin[2] * sn];
      const rr = rad(k);
      m.p.push(pts[k][0] + d[0] * rr, pts[k][1] + d[1] * rr, pts[k][2] + d[2] * rr);
      m.n.push(...d);
      m.uv.push((s / segs) * Math.PI * 2 * Math.max(rr, 0.05) * uvScale, along * uvScale);
    }
  }
  for (let k = 0; k < pts.length - 1; k++) {
    for (let s = 0; s < segs; s++) {
      const a = k * (segs + 1) + s, b = a + segs + 1;
      m.i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  if (caps) {
    for (const [k, dir] of [[0, -1], [pts.length - 1, 1]]) {
      if (rad(k) <= 0.001) continue;
      const t = tangents[k].map((c) => c * dir), base = m.p.length / 3;
      m.p.push(...pts[k]); m.n.push(...t); m.uv.push(0, 0);
      const ring = k * (segs + 1);
      for (let s = 0; s <= segs; s++) {
        m.p.push(m.p[(ring + s) * 3], m.p[(ring + s) * 3 + 1], m.p[(ring + s) * 3 + 2]);
        m.n.push(...t); m.uv.push(0, 0);
      }
      for (let s = 0; s < segs; s++) dir > 0 ? m.i.push(base, base + 1 + s, base + 2 + s) : m.i.push(base, base + 2 + s, base + 1 + s);
    }
  }
  return m;
}

/**
 * A surface of revolution about +Y from `profile` [[radius, y], ...] (bottom to top).
 * `shape(angle, v)` scales the radius per side (ribs, waves); `wave(angle, v)` shifts y (hems).
 */
export function lathe(profile, segs = 16, { shape = null, wave = null, uvScale = 1 } = {}) {
  segs = sides(segs, 6);
  const m = { p: [], n: [], uv: [], i: [] };
  const rows = profile.length;
  for (let j = 0; j < rows; j++) {
    const [r, y] = profile[j], v = j / (rows - 1);
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const rr = r * (shape ? shape(a, v) : 1), yy = y + (wave ? wave(a, v) : 0);
      m.p.push(Math.cos(a) * rr, yy, Math.sin(a) * rr);
      m.uv.push((s / segs) * Math.PI * 2 * Math.max(r, 0.1) * uvScale, y * uvScale);
    }
  }
  for (let j = 0; j < rows - 1; j++) {
    for (let s = 0; s < segs; s++) {
      const a = j * (segs + 1) + s, b = a + segs + 1;
      m.i.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  m.n = Array.from(calculateNormals(m.p, m.i));
  // The seam column shares positions but not indices: give both copies the same normal.
  for (let j = 0; j < rows; j++) {
    const a = j * (segs + 1), b = a + segs;
    for (let c = 0; c < 3; c++) { const v = (m.n[a * 3 + c] + m.n[b * 3 + c]) / 2; m.n[a * 3 + c] = m.n[b * 3 + c] = v; }
  }
  return m;
}

/** Flat-shaded triangle soup → { p, n, uv, i } (each triangle gets its own face normal). */
function facets(tris, uvOf) {
  const m = { p: [], n: [], uv: [], i: [] };
  for (const [a, b, c] of tris) {
    const n = nrm(cross(sub(b, a), sub(c, a)));
    for (const v of [a, b, c]) { m.p.push(...v); m.n.push(...n); m.uv.push(...uvOf(v, n)); }
    const k = m.p.length / 3;
    m.i.push(k - 3, k - 2, k - 1);
  }
  return m;
}

const planarUv = (v, n) => (Math.abs(n[1]) > 0.7 ? [v[0], v[2]] : Math.abs(n[0]) > Math.abs(n[2]) ? [v[2], v[1] + v[0] * 0.3] : [v[0], v[1] + v[2] * 0.3]);

/**
 * A crooked pyramid roof over a w×d rectangle (centred, base at y=0), apex `h` up and shifted by
 * (ax, az): the steep, lopsided spires of the village.
 */
export function spireRoof(w, d, h, ax = 0, az = 0) {
  const x = w / 2, z = d / 2, top = [ax, h, az];
  const c = [[-x, 0, z], [x, 0, z], [x, 0, -z], [-x, 0, -z]];
  return facets([[c[0], c[1], top], [c[1], c[2], top], [c[2], c[3], top], [c[3], c[0], top], [c[0], c[3], c[2]], [c[0], c[2], c[1]]], (v, n) => {
    // shingle rows run along the eaves
    const along = Math.abs(n[0]) > Math.abs(n[2]) ? v[2] : v[0];
    return [along, Math.hypot(v[1], Math.abs(n[0]) > Math.abs(n[2]) ? v[0] : v[2]) * 1.1];
  });
}

/** A steep gable roof: ridge along X, `h` high, ridge ends sagging by `sag` (a tired old roof). */
export function gableRoof(w, d, h, sag = 0) {
  const x = w / 2, z = d / 2;
  const L = [-x, h - sag, 0], Rr = [x, h - sag * 0.4, 0], M = [0, h, 0];
  const fl = [-x, 0, z], fr = [x, 0, z], bl = [-x, 0, -z], br = [x, 0, -z];
  return facets([
    [fl, fr, M], [fl, M, L], [fr, Rr, M], // front slope (split at the middle so it sags)
    [br, bl, M], [bl, L, M], [br, M, Rr], // back slope
    [fl, L, bl], [fr, br, Rr], // gable ends
    [fl, bl, br], [fl, br, fr],
  ], (v, n) => (Math.abs(n[0]) > 0.6 ? [v[2], v[1]] : [v[0], Math.hypot(v[1], v[2]) * 1.1]));
}

/** Extrudes a convex outline [[x, y], ...] (counter-clockwise, facing +Z) by `depth` along Z, centred. */
export function extrude(outline, depth) {
  const tris = [], hz = depth / 2;
  const f = outline.map(([x, y]) => [x, y, hz]), b = outline.map(([x, y]) => [x, y, -hz]);
  for (let k = 1; k < outline.length - 1; k++) { tris.push([f[0], f[k], f[k + 1]]); tris.push([b[0], b[k + 1], b[k]]); }
  for (let k = 0; k < outline.length; k++) {
    const k2 = (k + 1) % outline.length;
    tris.push([f[k], b[k], b[k2]], [f[k], b[k2], f[k2]]);
  }
  return facets(tris, (v) => [v[0], v[1]]);
}

/** An outline with a round (or pointed, `point` > 0) arch on top: doors, windows, tombstones. */
export function archOutline(w, h, { point = 0, segs = 8 } = {}) {
  const r = w / 2, spring = h - r * (1 + point);
  const out = [[-r, 0], [r, 0], [r, spring]];
  for (let k = 1; k < segs; k++) {
    const a = (k / segs) * Math.PI;
    out.push([Math.cos(a) * r, spring + Math.sin(a) * r * (1 + point * Math.sin(a) * Math.sin(a) * 1.4)]);
  }
  out.push([-r, spring]);
  return out;
}

/** Flat polygon (convex, CCW) facing +Z: window glass, clock faces. UVs 0..1 over its bounds. */
export function flat(outline) {
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const m = { p: [], n: [], uv: [], i: [] };
  for (const [x, y] of outline) { m.p.push(x, y, 0); m.n.push(0, 0, 1); m.uv.push((x - x0) / (x1 - x0 || 1), 1 - (y - y0) / (y1 - y0 || 1)); }
  for (let k = 1; k < outline.length - 1; k++) m.i.push(0, k, k + 1);
  return m;
}

/** Circle outline (CCW). */
export const circleOutline = (r, segs = 14) => Array.from({ length: segs }, (_, k) => [Math.cos((k / segs) * Math.PI * 2) * r, Math.sin((k / segs) * Math.PI * 2) * r]);

/** Ribbon lying on the ground along a 2D path [[x, z], ...] with width `w`; UV v runs along it in metres. */
export function ribbon(path, w, { y = 0.02, closed = false, uvScale = 1 } = {}) {
  const m = { p: [], n: [], uv: [], i: [] };
  const n = path.length;
  let along = 0;
  for (let k = 0; k < n; k++) {
    const a = path[closed ? (k - 1 + n) % n : Math.max(0, k - 1)], b = path[closed ? (k + 1) % n : Math.min(n - 1, k + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    if (k > 0) along += Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
    for (const s of [-1, 1]) {
      m.p.push(path[k][0] + nx * s * w / 2, y, path[k][1] + nz * s * w / 2);
      m.n.push(0, 1, 0);
      m.uv.push((s + 1) / 2 * w * uvScale, along * uvScale);
    }
  }
  const segs = closed ? n : n - 1;
  for (let k = 0; k < segs; k++) {
    const a = k * 2, b = ((k + 1) % n) * 2;
    m.i.push(a, a + 1, b + 1, a, b + 1, b);
  }
  return m;
}
