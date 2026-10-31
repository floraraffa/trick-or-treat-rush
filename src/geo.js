// Geometry toolkit: textured primitives with proper normals, merged into batched meshes so a whole
// stretch of scenery costs one draw call per material.
import { BLEND_NORMAL, CULLFACE_NONE, DETAILMODE_OVERLAY, SHADERLANGUAGE_GLSL, Entity, Mat4, Mesh, MeshInstance, Quat, StandardMaterial, Vec2, Vec3, calculateNormals } from 'playcanvas';

// --- primitives: { p, n, uv, i } in local space ------------------------------

/** Box centred on the origin; UVs in metres × uvScale so textures keep their size. */
export function box(sx, sy, sz, uvScale = 1) {
  const m = { p: [], n: [], uv: [], i: [] };
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const face = (o, u, v, nrm, su, sv) => {
    const b = m.p.length / 3;
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      m.p.push(o[0] + u[0] * a + v[0] * c, o[1] + u[1] * a + v[1] * c, o[2] + u[2] * a + v[2] * c);
      m.n.push(...nrm);
      m.uv.push(((a + 1) / 2) * su * uvScale, ((c + 1) / 2) * sv * uvScale);
    }
    m.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  };
  face([0, 0, hz], [hx, 0, 0], [0, hy, 0], [0, 0, 1], sx, sy);
  face([0, 0, -hz], [-hx, 0, 0], [0, hy, 0], [0, 0, -1], sx, sy);
  face([hx, 0, 0], [0, 0, -hz], [0, hy, 0], [1, 0, 0], sz, sy);
  face([-hx, 0, 0], [0, 0, hz], [0, hy, 0], [-1, 0, 0], sz, sy);
  face([0, hy, 0], [hx, 0, 0], [0, 0, -hz], [0, 1, 0], sx, sz);
  face([0, -hy, 0], [hx, 0, 0], [0, 0, hz], [0, -1, 0], sx, sz);
  return m;
}

/**
 * Detail of curved shapes (sides of cylinders, tubes, lathes, blobs): 1 in the game. The Lens export lowers it
 * while it builds the neighbourhoods for the glasses (their 25 MB), so round things get fewer sides; shapes of
 * few sides (square posts, pyramids) keep theirs.
 */
export const DETAIL = { k: 1 };
export const sides = (n, floor) => (DETAIL.k >= 1 || n <= floor ? n : Math.max(floor, Math.round(n * DETAIL.k)));

/** Smooth-sided cylinder / cone frustum standing on the origin along +Y. */
export function cylinder(rBottom, rTop, h, segs = 10, { caps = true, uvScale = 1, vScale = null } = {}) {
  segs = sides(segs, 6);
  const m = { p: [], n: [], uv: [], i: [] };
  const slope = (rBottom - rTop) / h;
  const circ = Math.PI * 2 * Math.max(rBottom, rTop);
  for (let k = 0; k <= segs; k++) {
    const a = (k / segs) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const nl = Math.hypot(1, slope);
    for (const [r, y] of [[rBottom, 0], [rTop, h]]) {
      m.p.push(c * r, y, s * r);
      m.n.push(c / nl, slope / nl, s / nl);
      m.uv.push((k / segs) * circ * uvScale, y * (vScale ?? uvScale));
    }
  }
  for (let k = 0; k < segs; k++) {
    const b = k * 2;
    m.i.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }
  if (caps) {
    for (const [r, y, ny] of [[rTop, h, 1], [rBottom, 0, -1]]) {
      if (r <= 0) continue;
      const b = m.p.length / 3;
      m.p.push(0, y, 0); m.n.push(0, ny, 0); m.uv.push(0.5, 0.5);
      for (let k = 0; k <= segs; k++) {
        const a = (k / segs) * Math.PI * 2;
        m.p.push(Math.cos(a) * r, y, Math.sin(a) * r); m.n.push(0, ny, 0);
        m.uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      }
      for (let k = 0; k < segs; k++) ny > 0 ? m.i.push(b, b + k + 2, b + k + 1) : m.i.push(b, b + k + 1, b + k + 2);
    }
  }
  return m;
}

/** Lumpy sphere (rocks, bushes, snowballs): smooth normals, optional noise and flattening. */
export function blob(r, segs = 8, { rand = null, jitter = 0, squashY = 1, uvScale = 1 } = {}) {
  segs = sides(segs, 5);
  const m = { p: [], n: [], uv: [], i: [] };
  const rings = Math.max(4, Math.round(segs / 2)), off = [];
  for (let k = 0; k < segs; k++) off.push(rand ? 1 + (rand() - 0.5) * jitter : 1);
  for (let j = 0; j <= rings; j++) {
    const v = j / rings, phi = v * Math.PI;
    for (let k = 0; k <= segs; k++) {
      const th = (k / segs) * Math.PI * 2;
      const o = j === 0 || j === rings ? 1 : off[k % segs] * (rand ? 1 + (rand() - 0.5) * jitter * 0.5 : 1);
      const x = Math.sin(phi) * Math.cos(th) * r * o, y = Math.cos(phi) * r * squashY, z = Math.sin(phi) * Math.sin(th) * r * o;
      m.p.push(x, y, z);
      m.uv.push((k / segs) * Math.PI * 2 * r * uvScale, v * Math.PI * r * uvScale);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k < segs; k++) {
      const a = j * (segs + 1) + k, b = a + segs + 1;
      m.i.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  m.n = Array.from(calculateNormals(m.p, m.i));
  return m;
}

/** Two crossed upright quads (billboard trees), bottom-centred. */
/** An upright w×h panel standing on its bottom edge, facing +Z, showing atlas cell rect (image coords). */
export function panel(w, h, rect = [0, 0, 1, 1]) {
  const [u0, v0, u1, v1] = rect, hw = w / 2;
  return {
    p: [-hw, 0, 0, hw, 0, 0, hw, h, 0, -hw, h, 0], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [u0, v1, u1, v1, u1, v0, u0, v0], i: [0, 1, 2, 0, 2, 3],
  };
}

export function crossQuads(w, h, rect = null) {
  const m = { p: [], n: [], uv: [], i: [] };
  // rect: [u0, v0, u1, v1] of an atlas cell, image coordinates (top-left origin).
  const [u0, v0, u1, v1] = rect ?? [0, 0, 1, 1];
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const b = m.p.length / 3;
    const hw = w / 2;
    m.p.push(-dx * hw, 0, -dz * hw, dx * hw, 0, dz * hw, dx * hw, h, dz * hw, -dx * hw, h, -dz * hw);
    for (let k = 0; k < 4; k++) m.n.push(0, 1, 0); // lit from above: no dark backsides
    m.uv.push(u0, v1, u1, v1, u1, v0, u0, v0); // images are stored top row first
    m.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return m;
}

/** Flat quad lying in XZ, facing +Y, centred. UVs in metres × uvScale, or 0..1 with uvScale 'fit'. */
export function plane(w, d, uvScale = 1) {
  const su = uvScale === 'fit' ? 1 : w * uvScale, sv = uvScale === 'fit' ? 1 : d * uvScale;
  return {
    p: [-w / 2, 0, d / 2, w / 2, 0, d / 2, w / 2, 0, -d / 2, -w / 2, 0, -d / 2],
    n: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    uv: [0, 0, su, 0, su, sv, 0, sv],
    i: [0, 1, 2, 0, 2, 3],
  };
}

// --- transforms -------------------------------------------------------------

const q = new Quat(), v0 = new Vec3(), v1 = new Vec3();

/** Matrix from position, Euler angles (degrees) and uniform scale. */
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
  return new Mat4().setTRS(new Vec3(x, y, z), q.setFromEulerAngles(rx, ry, rz), new Vec3(s, s, s));
}

/** Matrix that turns a +Y cylinder of length 1 into a segment from a to b ([x,y,z] arrays). */
export function along(a, b) {
  v0.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = v0.length();
  v0.mulScalar(1 / len);
  const up = new Vec3(0, 1, 0), axis = new Vec3().cross(up, v0);
  const ang = Math.acos(Math.max(-1, Math.min(1, up.dot(v0)))) * 57.2958;
  let rot;
  if (axis.length() > 1e-6) rot = new Quat().setFromAxisAngle(axis.normalize(), ang);
  else rot = v0.y > 0 ? new Quat() : new Quat().setFromAxisAngle(Vec3.RIGHT, 180); // straight up / straight down
  return { mat: new Mat4().setTRS(new Vec3(...a), rot, Vec3.ONE), len };
}

// --- batching ---------------------------------------------------------------

export class Geo {
  constructor() {
    this.p = []; this.n = []; this.uv = []; this.c = []; this.i = [];
  }

  get empty() { return this.i.length === 0; }

  /**
   * Appends a primitive, transformed by `mat` (rotation + translation + uniform scale only).
   * `tint` is [r, g, b] (0..1) or a function (x, y, z) -> [r, g, b] in world space.
   */
  add(m, mat = null, tint = [1, 1, 1], alpha = 1) {
    const base = this.p.length / 3;
    for (let k = 0; k < m.p.length; k += 3) {
      v0.set(m.p[k], m.p[k + 1], m.p[k + 2]);
      v1.set(m.n[k], m.n[k + 1], m.n[k + 2]);
      if (mat) { mat.transformPoint(v0, v0); mat.transformVector(v1, v1); v1.normalize(); }
      this.p.push(v0.x, v0.y, v0.z);
      this.n.push(v1.x, v1.y, v1.z);
      const t = typeof tint === 'function' ? tint(v0.x, v0.y, v0.z) : tint;
      this.c.push(t[0] * 255, t[1] * 255, t[2] * 255, alpha * 255);
    }
    this.uv.push(...m.uv);
    for (const ix of m.i) this.i.push(base + ix);
    return this;
  }

  /** The GPU mesh (to share between several entities, see build). */
  mesh(device) {
    const mesh = new Mesh(device);
    mesh.setPositions(this.p);
    mesh.setNormals(this.n);
    mesh.setUvs(0, this.uv);
    mesh.setColors32(this.c.map((x) => Math.max(0, Math.min(255, Math.round(x)))));
    mesh.setIndices(this.p.length / 3 > 65535 ? new Uint32Array(this.i) : new Uint16Array(this.i));
    mesh.update();
    return mesh;
  }

  build(device, material, name = 'geo') {
    const e = new Entity(name);
    e.addComponent('render', { meshInstances: [new MeshInstance(this.mesh(device), material)] });
    return e;
  }
}

/** Groups Geo batches by material key, then builds one entity holding them all. */
export class Batches {
  constructor(materials) {
    this.materials = materials;
    this.geos = {};
  }

  get(key) {
    return (this.geos[key] ??= new Geo());
  }

  build(device, name, { castShadows = false } = {}) {
    const root = new Entity(name);
    for (const [key, g] of Object.entries(this.geos)) {
      if (g.empty) continue;
      const e = g.build(device, this.materials[key], `${name}-${key}`);
      e.render.castShadows = castShadows;
      root.addChild(e);
    }
    return root;
  }
}

/** Standard textured material whose diffuse is tinted by vertex colours. */
// Anti-tiling for big ground surfaces (after Inigo Quilez, "texture repetition", technique 3): each
// pixel reads the tile twice at offsets picked by a slow value noise and cross-fades them, so the
// photo's features never line up into a grid. Diffuse and normal map use the same offsets.
const NO_TILE = `
#ifndef NO_TILE_FN
#define NO_TILE_FN
float ntHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ntNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(ntHash(i), ntHash(i + vec2(1.0, 0.0)), f.x), mix(ntHash(i + vec2(0.0, 1.0)), ntHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// offsets A and B in .xy/.zw; returns the blend weight
float ntOffsets(vec2 uv, out vec4 off) {
  float l = ntNoise(uv * 0.45) * 8.0 + ntNoise(uv * 0.13 + 17.0) * 4.0;
  float ia = floor(l);
  off = vec4(sin(vec2(3.0, 7.0) * ia), sin(vec2(3.0, 7.0) * (ia + 1.0)));
  return smoothstep(0.25, 0.75, fract(l));
}
#endif
`;
const NO_TILE_DIFFUSE = `${NO_TILE}
uniform vec3 material_diffuse;
#ifdef STD_DIFFUSEDETAIL_TEXTURE
	#include "detailModesPS"
#endif
void getAlbedo() {
	dAlbedo = material_diffuse.rgb;
	#ifdef STD_DIFFUSE_TEXTURE
		vec2 uv = {STD_DIFFUSE_TEXTURE_UV};
		vec2 dx = dFdx(uv), dy = dFdy(uv);
		vec4 off;
		float w = ntOffsets(uv, off);
		vec3 a = {STD_DIFFUSE_TEXTURE_DECODE}(textureGrad({STD_DIFFUSE_TEXTURE_NAME}, uv + off.xy, dx, dy)).{STD_DIFFUSE_TEXTURE_CHANNEL};
		vec3 b = {STD_DIFFUSE_TEXTURE_DECODE}(textureGrad({STD_DIFFUSE_TEXTURE_NAME}, uv + off.zw, dx, dy)).{STD_DIFFUSE_TEXTURE_CHANNEL};
		vec3 albedoTexture = mix(a, b, clamp(w + dot(b - a, vec3(0.3)), 0.0, 1.0));
		#ifdef STD_DIFFUSEDETAIL_TEXTURE
			vec3 albedoDetail = {STD_DIFFUSEDETAIL_TEXTURE_DECODE}(texture2DBias({STD_DIFFUSEDETAIL_TEXTURE_NAME}, {STD_DIFFUSEDETAIL_TEXTURE_UV}, {STD_TEXTURE_BIAS})).{STD_DIFFUSEDETAIL_TEXTURE_CHANNEL};
			albedoTexture = detailMode_{STD_DIFFUSEDETAIL_DETAILMODE}(albedoTexture, albedoDetail);
		#endif
		dAlbedo *= albedoTexture;
	#endif
	#ifdef STD_DIFFUSE_VERTEX
		dAlbedo *= saturate(vVertexColor.{STD_DIFFUSE_VERTEX_CHANNEL});
	#endif
}
`;
// `drift`: soft, sun-shaded swells from the noise's slope (snow dunes, sand ripples, ruts).
// `groom`: fine corduroy ridges across the UV's x (a groomed piste), faded out where they'd alias.
const noTileNormal = ({ drift = 0, groom = 0 }) => `${NO_TILE}
#ifdef STD_NORMAL_TEXTURE
	uniform float material_bumpiness;
#endif
void getNormal() {
#ifdef STD_NORMAL_TEXTURE
	vec2 uv = {STD_NORMAL_TEXTURE_UV};
	vec2 dx = dFdx(uv), dy = dFdy(uv);
	vec4 off;
	float w = ntOffsets(uv, off);
	vec3 a = {STD_NORMAL_TEXTURE_DECODE}(textureGrad({STD_NORMAL_TEXTURE_NAME}, uv + off.xy, dx, dy));
	vec3 b = {STD_NORMAL_TEXTURE_DECODE}(textureGrad({STD_NORMAL_TEXTURE_NAME}, uv + off.zw, dx, dy));
	vec3 normalMap = normalize(mix(a, b, w));
	normalMap = normalize(vec3(normalMap.xy * material_bumpiness, normalMap.z));
	${drift ? `vec2 p = uv * 0.9;
	float h0 = ntNoise(p) + 0.5 * ntNoise(p * 2.7 + 5.0);
	vec2 g = vec2(ntNoise(p + vec2(0.04, 0.0)) + 0.5 * ntNoise((p + vec2(0.04, 0.0)) * 2.7 + 5.0) - h0,
	              ntNoise(p + vec2(0.0, 0.04)) + 0.5 * ntNoise((p + vec2(0.0, 0.04)) * 2.7 + 5.0) - h0) / 0.04;
	normalMap.xy -= g * ${drift.toFixed(3)};` : ''}
	${groom ? `float gx = uv.x * ${groom.toFixed(1)};
	normalMap.x += cos(gx * 6.2832) * 0.22 * (1.0 - smoothstep(0.12, 0.45, fwidth(gx)));` : ''}
	dNormalW = normalize(dTBN * normalize(normalMap));
#else
	dNormalW = dVertexNormalW;
#endif
}
`;

export function texturedMaterial(texture, { gloss = 0.2, metal = 0, alphaTest = 0, emissive = null, unlit = false, fog = true, twoSided = false, blend = false, opacity = 1, normal = null, bumpiness = 1, macro = null, macroTiling = 1 / 14, noTile = false, drift = 0, groom = 0, tiling = 1 } = {}) {
  const m = new StandardMaterial();
  if (noTile) {
    const chunks = m.getShaderChunks(SHADERLANGUAGE_GLSL);
    chunks.set('diffusePS', NO_TILE_DIFFUSE);
    if (normal) chunks.set('normalMapPS', noTileNormal({ drift, groom }));
    m.shaderChunksVersion = '2.8';
  }
  m.diffuseMap = texture;
  if (normal) { m.normalMap = normal; m.bumpiness = bumpiness; }
  if (tiling !== 1) { // scales the photo on every mesh that uses the material (and its normal map with it)
    m.diffuseMapTiling = new Vec2(tiling, tiling);
    if (normal) m.normalMapTiling = new Vec2(tiling, tiling);
  }
  if (macro) { // a big, slow light/dark variation over a tiled ground texture
    m.diffuseDetailMap = macro;
    m.diffuseDetailMapTiling = new Vec2(macroTiling, macroTiling);
    m.diffuseDetailMode = DETAILMODE_OVERLAY;
  }
  m.diffuseVertexColor = true;
  m.gloss = gloss;
  m.useMetalness = true;
  m.metalness = metal;
  if (alphaTest) { m.opacityMap = texture; m.opacityMapChannel = 'a'; m.alphaTest = alphaTest; }
  if (blend) { m.blendType = BLEND_NORMAL; m.opacity = opacity; m.depthWrite = false; if (texture) { m.opacityMap = texture; m.opacityMapChannel = 'a'; } }
  if (emissive) { m.emissive = emissive; m.emissiveMap = texture; m.emissiveVertexColor = true; }
  if (unlit) { m.useLighting = false; m.useSkybox = false; m.emissive = emissive ?? m.emissive; }
  if (!fog) m.useFog = false;
  if (twoSided) m.cull = CULLFACE_NONE;
  m.update();
  return m;
}
