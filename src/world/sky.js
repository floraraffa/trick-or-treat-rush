// The Halloween night sky: a gradient dome (blue-black overhead, dusty violet and rose at the
// horizon), a big pale moon with a halo, stars, and far-off hills, spires and woods as silhouettes
// that the fog swallows. Follows the camera so it never comes closer.
import { BLEND_ADDITIVEALPHA, BLEND_NORMAL, CULLFACE_FRONT, CULLFACE_NONE, Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { Geo, trs } from '../geo.js';
import { rng } from '../rng.js';
import { circleOutline, flat, lathe, tube } from './shapes.js';

const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const HORIZON = [0.36, 0.22, 0.38], MID = [0.11, 0.12, 0.24], ZENITH = [0.02, 0.025, 0.07];

function unlit(tex, { additive = false, blend = false, cull = CULLFACE_NONE } = {}) {
  const m = new StandardMaterial();
  m.useLighting = false;
  m.useSkybox = false;
  m.useFog = false;
  m.diffuse = new Color(0, 0, 0);
  m.emissive = new Color(1, 1, 1);
  m.emissiveVertexColor = true;
  if (tex) { m.emissiveMap = tex; m.opacityMap = tex; m.opacityMapChannel = 'a'; }
  if (additive) m.blendType = BLEND_ADDITIVEALPHA; else if (blend) m.blendType = BLEND_NORMAL;
  if (additive || blend) m.depthWrite = false;
  m.cull = cull;
  m.update();
  return m;
}

export function createSky(app, tex, moonDir) {
  const root = new Entity('sky');
  // Dome: seen from inside, so its outward faces are culled.
  const prof = [];
  for (let k = 0; k <= 16; k++) {
    const a = -0.15 + (k / 16) * (Math.PI / 2 + 0.15);
    prof.push([Math.cos(a) * 420, Math.sin(a) * 420]);
  }
  const dome = lathe(prof, 32);
  const domeGeo = new Geo().add(dome, null, (x, y) => {
    const h = Math.max(0, y / 420);
    return h < 0.18 ? mixc(HORIZON, MID, h / 0.18) : mixc(MID, ZENITH, Math.min(1, (h - 0.18) / 0.6));
  });
  const domeMat = unlit(null, { cull: CULLFACE_FRONT });
  const domeE = domeGeo.build(app.graphicsDevice, domeMat, 'sky-dome');
  domeE.render.castShadows = false;
  root.addChild(domeE);

  // Stars: tiny additive sprites on the upper sky, brighter towards the zenith.
  const R = rng(7);
  const sg = new Geo();
  for (let k = 0; k < 520; k++) {
    const a = R() * Math.PI * 2, e = Math.asin(0.08 + R() * 0.92), r = 400;
    const p = [Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r];
    const s = 0.6 + R() * R() * 2.2;
    const yaw = Math.atan2(-p[0], -p[2]) * 57.2958, pitch = Math.asin(-p[1] / r) * 57.2958;
    const b = (0.35 + R() * 0.65) * (0.4 + 0.6 * Math.sin(e));
    sg.add(flat(circleOutline(s, 5)), trs(p[0], p[1], p[2], 0, 0, 0).mul(trs(0, 0, 0, 0, yaw, 0)).mul(trs(0, 0, 0, -pitch, 0, 0)), [b, b, b * (0.9 + R() * 0.2)]);
  }
  const stars = sg.build(app.graphicsDevice, unlit(tex.glow, { additive: true }), 'stars');
  stars.render.castShadows = false;
  root.addChild(stars);

  // The moon and its halo, placed along the moonlight.
  const moonMat = unlit(tex.moon, { blend: true });
  const moon = new Geo().add(flat([[-1, -1], [1, -1], [1, 1], [-1, 1]]), null, [1, 1, 1]).build(app.graphicsDevice, moonMat, 'moon');
  const haloMat = unlit(tex.glow, { additive: true });
  const halo = new Geo().add(flat([[-1, -1], [1, -1], [1, 1], [-1, 1]]), null, [0.45, 0.5, 0.75]).build(app.graphicsDevice, haloMat, 'moon-halo');
  for (const e of [moon, halo]) e.render.castShadows = false;
  const moonPivot = new Entity('moon-pivot');
  moonPivot.addChild(halo);
  moonPivot.addChild(moon);
  root.addChild(moonPivot);
  const dir = new Vec3(...moonDir).normalize();
  moonPivot.setLocalPosition(dir.x * 330, dir.y * 330, dir.z * 330);
  moon.setLocalScale(26, 26, 1);
  halo.setLocalScale(120, 120, 1);
  halo.setLocalPosition(0, 0, -2);

  const tint = new Color(1, 1, 1);
  return {
    root,
    update(camera) {
      root.setPosition(camera.getPosition());
      moonPivot.lookAt(camera.getPosition());
      moonPivot.rotateLocal(0, 180, 0); // the quads face +Z
    },
    /** 0 = a calm night, 1 = Monster Madness (a sickly red moon, the sky bruised). */
    setMadness(k) {
      tint.set(1, 1 - 0.35 * k, 1 - 0.25 * k);
      domeMat.emissive = tint; domeMat.update();
      moonMat.emissive = new Color(1, 1 - 0.55 * k, 1 - 0.65 * k); moonMat.update();
      haloMat.emissive = new Color(1 + 0.6 * k, 1 - 0.3 * k, 1 - 0.5 * k); haloMat.update();
    },
  };
}

/** Far hills with crooked spires and bare trees, into the 'silhouette' batch (lit by fog only). */
export function addSilhouettes(B) {
  const R = rng(99);
  const ring = [], n = 96;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const h = 7 + 6 * Math.sin(a * 3 + 1) + 4 * Math.sin(a * 7) + R() * 2.5;
    ring.push([Math.cos(a), Math.sin(a), h]);
  }
  const m = { p: [], n: [], uv: [], i: [] };
  for (let k = 0; k <= n; k++) {
    const [c, s, h] = ring[k];
    for (const [r, y] of [[150, -2], [150, h]]) { m.p.push(c * r, y, s * r); m.n.push(-c, 0, -s); m.uv.push(k, y); }
  }
  for (let k = 0; k < n; k++) { const a = k * 2; m.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  B.get('silhouette').add(m, null, [0.05, 0.05, 0.1]);
  for (let k = 0; k < 9; k++) { // spires of far-off manors
    const a = R() * Math.PI * 2, r = 140 + R() * 10, x = Math.cos(a) * r, z = Math.sin(a) * r, base = 6 + R() * 8;
    B.get('silhouette').add(lathe([[3, 0], [3, base], [2.6, base + 0.5], [0.1, base + 9 + R() * 8]], 6), trs(x, 0, z), [0.04, 0.04, 0.08]);
    B.get('silhouette').add(lathe([[1.4, 0], [1.4, base + 4], [0.05, base + 10 + R() * 6]], 6), trs(x + 4, 0, z + 2), [0.04, 0.04, 0.08]);
  }
  for (let k = 0; k < 40; k++) { // bare trees on the ridges
    const a = R() * Math.PI * 2, r = 132 + R() * 12, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 10 + R() * 8;
    B.get('silhouette').add(tube([[x, 2, z], [x + 1, h * 0.6, z], [x + 2.5, h, z + 1]], [0.7, 0.4, 0.1], 4), null, [0.04, 0.04, 0.08]);
    B.get('silhouette').add(tube([[x + 1, h * 0.55, z], [x - 2, h * 0.8, z], [x - 3.5, h * 0.95, z - 1]], [0.3, 0.15, 0.05], 4), null, [0.04, 0.04, 0.08]);
  }
}
