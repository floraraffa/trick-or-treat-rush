// CandyManager (the drawing side): the candy and power-up orbs the authority has put on the
// streets, exaggerated and glowing, bobbing and turning above a pool of their own light. A candy
// the local player reaches is asked for once (the authority says who gets it); with the magnet it
// drifts towards its player first. Nothing is removed until the authority says so.
import { BLEND_ADDITIVEALPHA, CULLFACE_NONE, Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, blob, box, cylinder, texturedMaterial, trs } from '../geo.js';
import { circleOutline, extrude, flat, lathe, tube } from '../world/shapes.js';
import { CANDY, ORB_R, PICKUP_R, POWERUPS } from '../game/config.js';

const HUES = [[1, 0.3, 0.35], [1, 0.62, 0.15], [1, 0.95, 0.3], [0.35, 0.95, 0.5], [0.3, 0.7, 1], [0.7, 0.4, 1]];
export const CANDY_GLOW = { caramel: [1, 0.6, 0.2], lollipop: [1, 0.4, 0.7], chocolate: [0.75, 0.45, 1], pumpkin: [1, 0.8, 0.25], rainbow: [0.6, 0.9, 1] };
export const ORB_COLOR = { speed: [1, 0.86, 0.2], shield: [0.35, 0.85, 1], magnet: [1, 0.3, 0.3], double: [0.8, 0.4, 1] };

/** A spiral swirl coloured by angle and radius (lollipops), in the disc's local XY plane. */
const swirl = (cols, turns = 3) => (x, y) => {
  const a = Math.atan2(y, x), r = Math.hypot(x, y);
  const k = (((a / (Math.PI * 2)) + r * turns) % 1 + 1) % 1;
  return cols[Math.floor(k * cols.length) % cols.length];
};

function candyGeo(type) {
  const g = new Geo();
  if (type === 'caramel') {
    g.add(blob(0.2, 12, { squashY: 0.75 }), trs(0, 0, 0, 0, 0, 90), [1, 0.62, 0.18]);
    for (const s of [-1, 1]) g.add(lathe([[0.02, 0], [0.1, 0.1], [0.17, 0.2], [0.12, 0.23], [0, 0.22]], 8, { shape: (a) => 1 + 0.25 * Math.cos(a * 6) }), trs(s * 0.16, 0, 0, 0, 0, -s * 90), [1, 0.85, 0.35]);
    g.add(box(0.03, 0.31, 0.32), null, [1, 0.3, 0.2]); // a stripe
  } else if (type === 'lollipop') {
    g.add(tube([[0, -0.6, 0], [0, -0.1, 0]], 0.025, 6), null, [0.96, 0.94, 0.9]);
    const disc = extrude(circleOutline(0.3, 24), 0.08);
    g.add(disc, null, swirl([[1, 0.3, 0.55], [1, 0.95, 0.95]], 2.4));
  } else if (type === 'chocolate') {
    g.add(box(0.5, 0.26, 0.08), null, [0.36, 0.2, 0.12]);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.add(box(0.1, 0.1, 0.03), trs(-0.18 + i * 0.12, -0.06 + j * 0.12, 0.05), [0.45, 0.26, 0.15]);
    g.add(box(0.24, 0.28, 0.1), trs(0.15, 0, 0), [0.45, 0.15, 0.6]); // foil
    g.add(box(0.05, 0.285, 0.105), trs(0.06, 0, 0), [1, 0.82, 0.3]); // gold band
  } else if (type === 'pumpkin') {
    const prof = [];
    for (let k = 0; k <= 8; k++) { const v = k / 8; prof.push([Math.sin(v * Math.PI) * 0.32, -Math.cos(v * Math.PI) * 0.24]); }
    g.add(lathe(prof, 18, { shape: (a) => 0.88 + 0.12 * Math.abs(Math.sin(4 * a)) }), null, [1, 0.8, 0.25]);
    g.add(tube([[0, 0.2, 0], [0.03, 0.34, 0], [0.12, 0.42, 0]], [0.05, 0.035, 0.02], 5), null, [0.4, 0.6, 0.2]);
  } else { // rainbow: a big double-sided rainbow swirl with a star on the stick
    g.add(tube([[0, -0.75, 0], [0, -0.1, 0]], 0.03, 6), null, [1, 1, 1]);
    g.add(extrude(circleOutline(0.42, 28), 0.09), null, swirl(HUES, 1.8));
    const star = [];
    for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI * 2, r = k % 2 ? 0.07 : 0.16; star.push([Math.cos(a) * r, Math.sin(a) * r]); }
    for (let k = 0; k < 10; k += 2) g.add(flat([[0, 0], star[k], star[(k + 1) % 10]]), trs(0, 0, 0.055), [1, 1, 0.85]);
    for (let k = 0; k < 10; k += 2) g.add(flat([[0, 0], star[(k + 9) % 10], star[k]]), trs(0, 0, 0.055), [1, 1, 0.85]);
  }
  return g;
}

function orbGeo(kind) {
  const inner = new Geo();
  const c = ORB_COLOR[kind];
  if (kind === 'speed') { // a lightning bolt in two convex pieces
    inner.add(extrude([[-0.02, 0.24], [-0.12, 0], [0.04, 0], [0.12, 0.24]], 0.06), null, c);
    inner.add(extrude([[-0.04, 0.04], [-0.1, -0.26], [0.12, 0.06]], 0.06), null, c);
  }
  if (kind === 'shield') inner.add(extrude([[-0.16, 0], [0, -0.22], [0.16, 0], [0.17, 0.18], [-0.17, 0.18]], 0.07), null, c);
  if (kind === 'magnet') {
    const arc = [];
    for (let k = 0; k <= 10; k++) { const a = Math.PI + (k / 10) * Math.PI; arc.push([Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0]); }
    inner.add(tube([[-0.13, 0.15, 0], ...arc, [0.13, 0.15, 0]], 0.05, 6), null, c);
    for (const s of [-1, 1]) inner.add(cylinder(0.055, 0.055, 0.07, 8), trs(s * 0.13, 0.13, 0), [0.9, 0.9, 0.95]);
  }
  if (kind === 'double') for (const s of [-1, 1]) inner.add(blob(0.1, 10), trs(s * 0.09, s * 0.06, 0), c);
  return inner;
}

export function createCandy(app, tex, fx) {
  const root = new Entity('candy');
  const candyMat = texturedMaterial(tex.plain, { gloss: 0.85, emissive: new Color(0.45, 0.45, 0.45) });
  const goldMat = texturedMaterial(tex.plain, { gloss: 0.9, metal: 0.8, emissive: new Color(0.5, 0.4, 0.15) });
  const orbMat = new StandardMaterial();
  orbMat.diffuse = new Color(0.1, 0.1, 0.15);
  orbMat.emissive = new Color(1, 1, 1);
  orbMat.emissiveVertexColor = true;
  orbMat.opacity = 0.35;
  orbMat.blendType = BLEND_ADDITIVEALPHA;
  orbMat.depthWrite = false;
  orbMat.cull = CULLFACE_NONE;
  orbMat.update();
  const glowMat = texturedMaterial(tex.glow, { unlit: true, blend: true, emissive: new Color(1, 1, 1), fog: false });
  glowMat.blendType = BLEND_ADDITIVEALPHA; glowMat.emissiveVertexColor = true; glowMat.update();
  const iconMat = texturedMaterial(tex.plain, { emissive: new Color(1, 1, 1), gloss: 0.6 });

  const protos = {};
  for (const type of Object.keys(CANDY)) protos[type] = candyGeo(type).build(app.graphicsDevice, type === 'pumpkin' ? goldMat : candyMat, `candy-${type}`);
  const orbProtos = {};
  for (const kind of Object.keys(POWERUPS)) {
    const e = new Entity(`orb-${kind}`);
    const shell = new Geo().add(blob(0.36, 14), null, ORB_COLOR[kind]).build(app.graphicsDevice, orbMat, 'orb-shell');
    const icon = orbGeo(kind).build(app.graphicsDevice, iconMat, 'orb-icon');
    e.addChild(icon); e.addChild(shell);
    orbProtos[kind] = e;
  }
  const pool = (col, r) => new Geo().add({ p: [-r, 0, r, r, 0, r, r, 0, -r, -r, 0, -r], n: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], uv: [0, 0, 1, 0, 1, 1, 0, 1], i: [0, 1, 2, 0, 2, 3] }, null, col).build(app.graphicsDevice, glowMat, 'glow-pool');

  const shown = new Map(); // candy id → { e, item }
  const orbsShown = new Map();
  const asked = new Map(); // id → time we asked for it (one request per candy)

  function addEntity(proto, x, z, glowCol, glowR, name) {
    const e = new Entity(name);
    const spin = new Entity('spin');
    spin.addChild(proto.clone());
    for (const r of spin.findComponents('render')) r.castShadows = false;
    e.addChild(spin);
    const g = pool(glowCol, glowR);
    g.setLocalPosition(0, 0.06, 0);
    e.addChild(g);
    e.setPosition(x, 0, z);
    root.addChild(e);
    return { e, spin, t: Math.random() * 6, x, z, born: 0 };
  }

  return {
    root,
    /**
     * Mirrors view.candies/orbs; pulls magnet candy; asks for what the local player can reach.
     * `me`: { x, z, magnet, canHold }; `ask(kind, id)` sends the request.
     */
    update(dt, view, me, ask, now) {
      for (const [id, c] of view.candies) {
        if (!shown.has(id)) {
          const big = c.type === 'rainbow' ? 1.25 : c.type === 'pumpkin' ? 1.15 : 1;
          const s = addEntity(protos[c.type], c.x, c.z, CANDY_GLOW[c.type], 0.9 * big, `candy-${id}`);
          s.spin.setLocalScale(big, big, big);
          shown.set(id, s);
        }
      }
      for (const [id, s] of shown) {
        const c = view.candies.get(id);
        if (!c) { // taken (or gone): burst of sparkles where it was, then away
          fx?.emit({ x: s.x, y: 1, z: s.z }, { x: 0, y: 1.5, z: 0 }, { n: 12, spread: 3, size: 0.25, grow: 0.5, life: 0.6, color: CANDY_GLOW[s.type ?? 'caramel'] ?? [1, 1, 1], gravity: -3, alpha: 0.9 });
          s.e.destroy(); shown.delete(id); asked.delete(id); continue;
        }
        s.type = c.type;
        s.t += dt;
        s.born = Math.min(1, s.born + dt * 3);
        // Magnet: candy within reach drifts to its player (drawn only; the authority decides).
        if (me?.magnet) {
          const dx = me.x - s.x, dz = me.z - s.z, d = Math.hypot(dx, dz);
          if (d < POWERUPS.magnet.radius && d > 0.2) { const k = Math.min(1, dt * (3 + 6 / d)); s.x += dx * k * 0.5; s.z += dz * k * 0.5; }
        }
        const bob = 0.95 + Math.sin(s.t * 2.4) * 0.13;
        s.e.setPosition(s.x, 0, s.z);
        s.spin.setLocalPosition(0, bob, 0);
        s.spin.setLocalEulerAngles(0, s.t * 90, Math.sin(s.t * 1.3) * 10);
        const sc = s.born * (c.type === 'rainbow' ? 1.25 : c.type === 'pumpkin' ? 1.15 : 1);
        s.spin.setLocalScale(sc, sc, sc);
        if ((c.type === 'rainbow' || c.type === 'pumpkin') && Math.random() < dt * 6) fx?.emit({ x: s.x, y: bob, z: s.z }, { x: 0, y: 0.5, z: 0 }, { n: 1, spread: 1, size: 0.12, grow: 0.3, life: 0.7, color: CANDY_GLOW[c.type], gravity: 0.5, alpha: 0.9, twinkle: true });
        if (me && view.phase === 'playing') {
          const d = Math.hypot(me.x - s.x, me.z - s.z), reach = me.magnet ? Math.min(PICKUP_R + 0.5, POWERUPS.magnet.radius) : PICKUP_R;
          const real = Math.hypot(me.x - c.x, me.z - c.z);
          if ((d < reach || (me.magnet && real < POWERUPS.magnet.radius)) && (!asked.has(id) || now - asked.get(id) > 1.5)) { asked.set(id, now); ask('pickup', id); }
        }
      }
      for (const [id, o] of view.orbs) {
        if (!orbsShown.has(id)) { const s = addEntity(orbProtos[o.kind], o.x, o.z, ORB_COLOR[o.kind], 1.1, `orb-${id}`); s.kind = o.kind; orbsShown.set(id, s); }
      }
      for (const [id, s] of orbsShown) {
        const o = view.orbs.get(id);
        if (!o) { fx?.emit({ x: s.x, y: 1.1, z: s.z }, { x: 0, y: 2, z: 0 }, { n: 16, spread: 3, size: 0.3, grow: 0.5, life: 0.7, color: ORB_COLOR[s.kind], gravity: -2, alpha: 0.9 }); s.e.destroy(); orbsShown.delete(id); asked.delete(`o${id}`); continue; }
        s.t += dt;
        s.born = Math.min(1, s.born + dt * 2);
        s.spin.setLocalPosition(0, 1.1 + Math.sin(s.t * 2) * 0.15, 0);
        s.spin.setLocalEulerAngles(0, s.t * 70, 0);
        s.spin.setLocalScale(s.born, s.born, s.born);
        if (me && me.canHold && view.phase === 'playing' && Math.hypot(me.x - o.x, me.z - o.z) < ORB_R && (!asked.has(`o${id}`) || now - asked.get(`o${id}`) > 1.5)) { asked.set(`o${id}`, now); ask('orb', id); }
      }
    },
    clear() { for (const s of shown.values()) s.e.destroy(); for (const s of orbsShown.values()) s.e.destroy(); shown.clear(); orbsShown.clear(); asked.clear(); },
  };
}
