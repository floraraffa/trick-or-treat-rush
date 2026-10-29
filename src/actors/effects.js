// What each player's power-ups and troubles look like, for everyone in the session: a shimmering
// bubble (shield), a turning ring at the feet and a sparkling circle as far as it reaches (magnet),
// a thundercloud overhead throwing lightning (candy storm), violet sparkles (double candy), green goo
// (slowed by a zombie or a web), spectral wisps (candy thief), pale trailing mist (ghost) and red dust
// round a giant's feet. Also the falling rain drawn round the camera while a storm is near.
import { BLEND_ADDITIVEALPHA, CULLFACE_NONE, Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, blob, trs } from '../geo.js';
import { rng } from '../rng.js';
import { circleOutline, tube } from '../world/shapes.js';
import { POWERUPS } from '../game/config.js';

function glowMat(color, opacity) {
  const m = new StandardMaterial();
  m.diffuse = new Color(0, 0, 0);
  m.emissive = new Color(...color);
  m.emissiveVertexColor = true;
  m.opacity = opacity;
  m.blendType = BLEND_ADDITIVEALPHA;
  m.depthWrite = false;
  m.cull = CULLFACE_NONE;
  m.useFog = false;
  m.update();
  return m;
}

// The thundercloud is tied to its player's head (the top of it as drawn, hat and a giant's size included,
// wherever the head goes), reaching a little ahead (where a third-person camera looks: its belly shows at the top
// of the view, under the HUD), and grows with a giant. Metres: the head's height (only where no head is given),
// the cloud's size (×1: 14 m across), its middle over the head and its underside under its middle (both ×size),
// how far ahead of the head its middle is (the same for a giant: it stays over the head), how far its belly
// reaches from its middle (×size).
export const CLOUD = { head: 1.65, size: 1.15, lift: 3, under: 1.6, ahead: 3.5, grow: 0.7, reach: 7 };
/** The cloud's size over a player `k` times as tall (a giant's grows, less than the giant). */
export const cloudSize = (k = 1) => CLOUD.size * (1 + (k - 1) * CLOUD.grow);

/** How bright a lightning strike is `t` seconds in: a blinding return stroke, a few re-strokes, then gone. */
export const flashAt = (t) => (t < 0.05 ? 1 : t < 0.08 ? 0.1 : t < 0.12 ? 0.85 : t < 0.16 ? 0.15 : t < 0.22 ? 0.6 : Math.max(0, 0.6 - (t - 0.22) * 3.5));
const FLASH_LEN = 0.4;

/**
 * A lightning channel from the cloud (x0, y0, z0) to the ground at (x1, z1). Midpoint displacement
 * makes the jagged, self-similar path real lightning has; forks split off downwards and peter out.
 * Returns polylines [{ pts, w }], w the relative width.
 */
export function lightningPaths(R, x0, y0, z0, x1, z1) {
  const crooked = (a, b, depth, rough) => {
    let pts = [a, b];
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k - 1], q = pts[k], len = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        next.push([(p[0] + q[0]) / 2 + (R() - 0.5) * len * rough, (p[1] + q[1]) / 2 + (R() - 0.5) * len * rough * 0.3, (p[2] + q[2]) / 2 + (R() - 0.5) * len * rough], q);
      }
      pts = next;
    }
    return pts;
  };
  const main = crooked([x0, y0, z0], [x1, 0, z1], 6, 0.5);
  const paths = [{ pts: main, w: 1 }];
  const forks = 4 + Math.floor(R() * 4);
  for (let f = 0; f < forks; f++) {
    const k = 3 + Math.floor(R() * main.length * 0.7), a = main[k];
    const drop = a[1] * (0.2 + R() * 0.35), ang = R() * Math.PI * 2, out = drop * (0.5 + R() * 0.8);
    const pts = crooked(a, [a[0] + Math.cos(ang) * out, Math.max(0.4, a[1] - drop), a[2] + Math.sin(ang) * out], 4, 0.6);
    paths.push({ pts, w: 0.5 * (1 - k / main.length) + 0.12 });
    if (R() < 0.5) { const c = pts[2 + Math.floor(R() * (pts.length - 4))]; paths.push({ pts: crooked(c, [c[0] + (R() - 0.5) * 1.2, c[1] - 0.3 - R() * 0.6, c[2] + (R() - 0.5) * 1.2], 3, 0.6), w: 0.1 }); }
  }
  return paths;
}

/** Polylines → flat ribbons turned to the eye, narrowing towards their ends (UV u across, 0..1). */
export function ribbons(paths, eye, width) {
  const m = { p: [], n: [], uv: [], i: [] };
  for (const { pts, w } of paths) {
    const base = m.p.length / 3, last = pts.length - 1;
    pts.forEach((p, k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(last, k + 1)];
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [p[0] - eye.x, p[1] - eye.y, p[2] - eye.z];
      const s = [d[1] * v[2] - d[2] * v[1], d[2] * v[0] - d[0] * v[2], d[0] * v[1] - d[1] * v[0]];
      const hw = (width * w * (1 - 0.65 * (k / last))) / 2 / (Math.hypot(...s) || 1);
      m.p.push(p[0] - s[0] * hw, p[1] - s[1] * hw, p[2] - s[2] * hw, p[0] + s[0] * hw, p[1] + s[1] * hw, p[2] + s[2] * hw);
      m.n.push(0, 1, 0, 0, 1, 0);
      m.uv.push(0, k / last, 1, k / last);
      if (k) { const i = base + k * 2; m.i.push(i - 2, i - 1, i, i - 1, i + 1, i); }
    });
  }
  return m;
}

/** Rain falling round the camera: thin crossed streaks in one mesh, slid down and wrapped. */
export function createRain(app) {
  const R = rng(77), g = new Geo(), H = 16, RAD = 14;
  for (let k = 0; k < 420; k++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * RAD, x = Math.cos(a) * r, z = Math.sin(a) * r, y = R() * H, l = 0.5 + R() * 0.5;
    for (const [dx, dz] of [[0.012, 0], [0, 0.012]]) g.add({ p: [x - dx, y, z - dz, x + dx, y, z + dz, x + dx + 0.06, y + l, z + dz, x - dx + 0.06, y + l, z - dz], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], uv: [0, 0, 1, 0, 1, 1, 0, 1], i: [0, 1, 2, 0, 2, 3] }, null, [0.75, 0.75, 1]);
  }
  const m = new StandardMaterial();
  m.diffuse = new Color(0, 0, 0); m.emissive = new Color(1, 1, 1); m.emissiveVertexColor = true;
  m.blendType = BLEND_ADDITIVEALPHA; m.depthWrite = false; m.cull = CULLFACE_NONE; m.useFog = false; m.opacity = 0;
  m.update();
  const root = new Entity('rain');
  const sheets = [0, 1].map(() => { const e = g.build(app.graphicsDevice, m, 'rain-sheet'); e.render.castShadows = false; root.addChild(e); return e; });
  root.enabled = false;
  app.root.addChild(root);
  let t = 0, shown = 0;
  return {
    /** k: how strong the storm is where the camera is (0 = none, 1 = right under it). */
    update(dt, cam, k) {
      shown += (k - shown) * Math.min(1, dt * 2);
      root.enabled = shown > 0.02;
      if (!root.enabled) return;
      t += dt;
      const fall = (t * 15) % H;
      root.setPosition(cam.x, cam.y - 4, cam.z);
      sheets[0].setLocalPosition(0, -fall, 0);
      sheets[1].setLocalPosition(0, H - fall, 0);
      m.opacity = 0.45 * shown; m.update();
    },
  };
}

/**
 * Per-player auras. `onStrike({ x, z, id })` hears every lightning strike of a candy storm (for the
 * flash, the thunder and the light), wherever it is.
 */
/** The thundercloud: dark billows, faintly violet (the same one every time). */
export function stormCloudGeo() {
  const cloudGeo = new Geo(), CR = rng(21);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + CR() * 0.5, r = k < 4 ? CR() * 1.2 : 2 + CR() * 2.6, s = 1.3 + CR() * 1.1;
    cloudGeo.add(blob(s, 10, { squashY: 0.62, rand: CR, jitter: 0.3 }), trs(Math.cos(a) * r, (CR() - 0.3) * 0.6, Math.sin(a) * r), [0.22 + CR() * 0.05, 0.22 + CR() * 0.05, 0.32 + CR() * 0.06]);
  }
  return cloudGeo;
}

export function createAuras(app, fx, { tex = null, onStrike = null } = {}) {
  // The thundercloud: dark billows, faintly violet, lit from inside by the lightning.
  const cloudGeo = stormCloudGeo();
  const cloudMat = new StandardMaterial();
  cloudMat.diffuse = new Color(1, 1, 1); cloudMat.diffuseVertexColor = true;
  const CLOUD_GLOW = [0.17, 0.12, 0.27]; // (dusky violet: a black cloud would vanish into the night sky)
  cloudMat.emissive = new Color(...CLOUD_GLOW); cloudMat.gloss = 0.05; cloudMat.useMetalness = true;
  cloudMat.useFog = false; // (near overhead: the fog would melt it into the night sky)
  cloudMat.update();
  // Lightning: a fresh channel every strike, white-hot core in a blue-white glow (tex.bolt across each
  // ribbon), with a light that floods the ground round it for the length of the flash.
  const boltMats = [0, 1, 2, 3].map(() => {
    const m = new StandardMaterial();
    m.useLighting = false; m.useSkybox = false; m.useFog = false;
    m.diffuse = new Color(0, 0, 0); m.emissive = new Color(1, 1, 1); m.emissiveIntensity = 3;
    if (tex) { m.emissiveMap = tex.bolt; m.opacityMap = tex.bolt; m.opacityMapChannel = 'a'; }
    m.blendType = BLEND_ADDITIVEALPHA; m.depthWrite = false; m.cull = CULLFACE_NONE;
    m.update();
    return m;
  });
  const boltRoot = new Entity('lightning');
  app.root.addChild(boltRoot);
  const flashLight = new Entity('lightning-light');
  flashLight.addComponent('light', { type: 'omni', color: new Color(0.78, 0.84, 1), intensity: 0, range: 24, castShadows: false });
  flashLight.enabled = false;
  app.root.addChild(flashLight);
  const live = []; // strikes on screen: { e, mat, t, x, z }
  const BR = rng(97);
  let eye = { x: 0, y: 2, z: 0 }, nextMat = 0;
  function strike(x, z, from, id) {
    const mat = boltMats[nextMat++ % boltMats.length];
    const e = new Geo().add(ribbons(lightningPaths(BR, from.x, from.y, from.z, x, z), eye, 0.75), null, [1, 1, 1]).build(app.graphicsDevice, mat, 'bolt');
    e.render.castShadows = false;
    boltRoot.addChild(e);
    while (live.length >= boltMats.length) live.shift().e.destroy();
    live.push({ e, mat, t: 0, x, z });
    fx?.emit({ x, y: 0.15, z }, { x: 0, y: 2, z: 0 }, { n: 8, spread: 3, size: 0.18, grow: 0.3, life: 0.35, color: [0.9, 0.95, 1], gravity: -5, alpha: 1 });
    onStrike?.({ x, z, id });
  }

  const shieldGeo = new Geo().add(blob(0.95, 18, { squashY: 1.15 }), null, [0.4, 0.9, 1]);
  const ring = circleOutline(0.85, 24).map(([x, z]) => [x, 0.08, z]);
  const ringGeo = new Geo().add(tube([...ring, ring[0]], 0.05, 5, { caps: false }), null, [1, 0.35, 0.3]);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ringGeo.add(blob(0.08, 6), trs(Math.cos(a) * 0.85, 0.08, Math.sin(a) * 0.85), [0.95, 0.95, 1]); } // silver studs
  const shieldM = glowMat([0.4, 0.85, 1], 0.28), ringM = glowMat([1, 0.4, 0.35], 0.9);
  const per = new Map();

  function get(id, parent) {
    let a = per.get(id);
    if (!a) {
      const root = new Entity(`aura-${id}`);
      const shield = shieldGeo.build(app.graphicsDevice, shieldM, 'shield');
      shield.setLocalPosition(0, 1.05, 0);
      const mag = ringGeo.build(app.graphicsDevice, ringM, 'magnet-ring');
      for (const e of [shield, mag]) { e.render.castShadows = false; e.enabled = false; root.addChild(e); }
      const cloud = cloudGeo.build(app.graphicsDevice, cloudMat, 'storm-cloud');
      cloud.render.castShadows = false; cloud.enabled = false;
      root.addChild(cloud);
      a = { root, shield, mag, cloud, storm: 0, strikeIn: 0.4, t: 0 };
      per.set(id, a);
    }
    if (a.root.parent !== parent) { a.root.parent?.removeChild(a.root); parent.addChild(a.root); }
    return a;
  }

  return {
    /**
     * fxLeft(kind) → seconds left; x/z where the player is drawn; `fp`: this is my own body in first person;
     * `head`: the top of its head in the world (avatar.headTop()), which the storm cloud is tied to.
     */
    update(dt, id, parent, fxLeft, x, z, fp = false, head = null) {
      const a = get(id, parent);
      a.t += dt;
      const shield = fxLeft('shield') > 0, magnet = fxLeft('magnet') > 0;
      a.shield.enabled = shield && !fp;
      if (shield) { const s = 1 + Math.sin(a.t * 5) * 0.04; a.shield.setLocalScale(s, s, s); }
      a.mag.enabled = magnet;
      if (magnet) { a.mag.setLocalEulerAngles(0, a.t * 120, 0); const s = 1 + 0.15 * Math.sin(a.t * 6); a.mag.setLocalScale(s * 2.2, 1, s * 2.2); }
      // Candy storm: the cloud gathers overhead, turns slowly, and throws lightning round its player.
      const rain = fxLeft('rain') > 0;
      a.storm += ((rain ? 1 : 0) - a.storm) * Math.min(1, dt * 3);
      a.cloud.enabled = a.storm > 0.02;
      if (a.cloud.enabled) {
        // Over the head (a giant's too), and never down round the camera: over it, it rises clear of it.
        const k = parent.getLocalScale().x || 1, g = cloudSize(k), s = a.storm * g;
        const p = parent.getPosition(), f = parent.forward, h = head ?? { x: p.x, y: p.y + CLOUD.head * k, z: p.z };
        let y = h.y - p.y + CLOUD.lift * g;
        const mx = h.x - f.x * CLOUD.ahead, mz = h.z - f.z * CLOUD.ahead; // (its middle: +Z ahead)
        const ey = eye.y - p.y; // (a camera high over it, as over a table, leaves it be)
        if (ey < y + 2 * g && Math.hypot(eye.x - mx, eye.z - mz) < (CLOUD.reach + 1.5) * g) y = Math.max(y, ey + CLOUD.under * g + 0.4);
        a.cloud.setLocalScale(s / k, s / k, s / k);
        a.cloud.setPosition(mx, p.y + y, mz);
        a.cloud.setEulerAngles(0, a.t * 12, 0);
        a.size = g;
      }
      if (rain && (a.strikeIn -= dt) <= 0) {
        a.strikeIn = 0.6 + Math.random() * 1.4;
        // mostly in front of its player (where a third-person camera is looking), now and then anywhere
        const f = parent.forward, ahead = Math.atan2(-f.z, -f.x);
        const ang = Math.random() < 0.7 ? ahead + (Math.random() - 0.5) * 2.4 : Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 6;
        const c = a.cloud.getPosition(), g = a.size ?? 1;
        strike(x + Math.cos(ang) * r, z + Math.sin(ang) * r, { x: c.x + (Math.random() - 0.5) * 3 * g, y: c.y - CLOUD.under * g * 0.6, z: c.z + (Math.random() - 0.5) * 3 * g }, id);
      }
      if (rain && fx && a.cloud.enabled && Math.random() < dt * 20) { // candy-pink glow under the cloud
        const c = a.cloud.getPosition(), g = a.size ?? 1;
        fx.emit({ x: c.x + (Math.random() - 0.5) * 5 * g, y: c.y - CLOUD.under * g, z: c.z + (Math.random() - 0.5) * 5 * g }, { x: 0, y: -0.2, z: 0 }, { n: 1, spread: 0.3, size: 1.1 * g, grow: 0.5, life: 1.2, color: [1, 0.5, 0.85], gravity: 0, alpha: 0.25 });
      }
      if (!fx) return;
      if (magnet && Math.random() < dt * 40) { const ang = Math.random() * Math.PI * 2, R = POWERUPS.magnet.radius; fx.emit({ x: x + Math.cos(ang) * R, y: 0.25, z: z + Math.sin(ang) * R }, { x: -Math.cos(ang) * 1.5, y: 0.4, z: -Math.sin(ang) * 1.5 }, { n: 1, spread: 0.2, size: 0.22, grow: 0.3, life: 0.9, color: [1, 0.4, 0.35], gravity: 0, alpha: 0.9, twinkle: true }); }
      if (fxLeft('ghost') > 0 && Math.random() < dt * 18) fx.emit({ x: x + (Math.random() - 0.5) * 0.5, y: 0.3 + Math.random() * 1.2, z: z + (Math.random() - 0.5) * 0.5 }, { x: 0, y: 0.35, z: 0 }, { n: 1, spread: 0.2, size: 0.3, grow: 1.2, life: 1.1, color: [0.85, 0.85, 1], gravity: 0, alpha: 0.5 });
      if (fxLeft('double') > 0 && Math.random() < dt * 14) { const ang = a.t * 4 + Math.random(); fx.emit({ x: x + Math.cos(ang) * 0.6, y: 1.2 + Math.sin(a.t * 3) * 0.4, z: z + Math.sin(ang) * 0.6 }, { x: 0, y: 0.6, z: 0 }, { n: 1, spread: 0.3, size: 0.14, grow: 0.2, life: 0.7, color: [0.85, 0.45, 1], gravity: 0, alpha: 1, twinkle: true }); }
      if (fxLeft('thief') > 0 && Math.random() < dt * 22) { const ang = -a.t * 5 + Math.random() * 0.5; fx.emit({ x: x + Math.cos(ang) * 0.75, y: 0.4 + Math.random() * 1.4, z: z + Math.sin(ang) * 0.75 }, { x: 0, y: 0.5, z: 0 }, { n: 1, spread: 0.2, size: 0.2, grow: 0.8, life: 0.8, color: [0.35, 1, 0.85], gravity: 0.2, alpha: 0.9, twinkle: true }); }
      if (fxLeft('giant') > 0 && Math.random() < dt * 14) fx.emit({ x: x + (Math.random() - 0.5) * 7, y: 0.2, z: z + (Math.random() - 0.5) * 7 }, { x: 0, y: 0.8, z: 0 }, { n: 1, spread: 3.5, size: 1.6, grow: 3, life: 1.1, color: [1, 0.45, 0.3], gravity: 0, alpha: 0.5 }); // dust round a giant's feet
      if (fxLeft('slow') > 0 && Math.random() < dt * 12) fx.emit({ x: x + (Math.random() - 0.5) * 0.6, y: 0.15, z: z + (Math.random() - 0.5) * 0.6 }, { x: 0, y: 0.1, z: 0 }, { n: 1, spread: 0.1, size: 0.22, grow: 0.6, life: 0.9, color: [0.45, 1, 0.3], gravity: -0.3, alpha: 0.7 });
    },
    /** Lightning flickers out on its own: call once a frame with the camera position. Returns how bright the brightest strike is now. */
    tick(dt, cam) {
      if (cam) eye = { x: cam.x, y: cam.y, z: cam.z };
      let top = 0, at = null;
      for (let k = live.length - 1; k >= 0; k--) {
        const b = live[k];
        b.t += dt;
        if (b.t > FLASH_LEN) { b.e.destroy(); live.splice(k, 1); continue; }
        const f = flashAt(b.t);
        b.mat.opacity = f; b.mat.update();
        if (f >= top) { top = f; at = b; }
      }
      flashLight.enabled = top > 0.01;
      if (at) { flashLight.setPosition(at.x, 1.6, at.z); flashLight.light.intensity = 7 * top; }
      cloudMat.emissive.set(CLOUD_GLOW[0] + top * 0.55, CLOUD_GLOW[1] + top * 0.58, CLOUD_GLOW[2] + top * 0.75);
      cloudMat.update();
      return top;
    },
    /** How bright lightning is at (x, z) right now (0..1), fading with distance. */
    flashAt(x, z) {
      let k = 0;
      for (const b of live) k = Math.max(k, flashAt(b.t) * Math.max(0, 1 - Math.hypot(b.x - x, b.z - z) / 45));
      return k;
    },
    /** The thundercloud nearest (x, z), if one is out: its underside's middle and how far its belly reaches (m). */
    cloudOver(x, z) {
      let best = null, bd = Infinity;
      for (const a of per.values()) {
        if (!a.cloud.enabled || a.storm < 0.3) continue;
        const c = a.cloud.getPosition(), g = a.size ?? 1, d = Math.hypot(c.x - x, c.z - z);
        if (d < 16 * g && d < bd) { bd = d; best = { x: c.x, y: c.y - CLOUD.under * g * 0.7, z: c.z, r: 4 * g }; }
      }
      return best;
    },
    /** How strong the storm is at (x, z): 1 under a cloud, fading out 20 m away. */
    stormAt(x, z, where) {
      let k = 0;
      for (const [id, a] of per) { const p = where(id); if (p && a.storm > 0.02) k = Math.max(k, a.storm * Math.max(0, 1 - Math.hypot(p.x - x, p.z - z) / 20)); }
      return k;
    },
    remove(id) { const a = per.get(id); if (a) { a.root.destroy(); per.delete(id); } },
    clear() { for (const a of per.values()) a.root.destroy(); per.clear(); for (const b of live) b.e.destroy(); live.length = 0; flashLight.enabled = false; },
  };
}
