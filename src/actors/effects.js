// What each player's power-ups and troubles look like, for everyone in the session: a shimmering
// bubble (shield), a turning ring at the feet (magnet), golden streaks (speed), violet sparkles
// (double candy), green goo (slowed by a zombie or a web), spectral wisps (ghost thief) and red dust
// round a giant's feet.
import { BLEND_ADDITIVEALPHA, CULLFACE_NONE, Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, blob, trs } from '../geo.js';
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

export function createAuras(app, fx) {
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
      a = { root, shield, mag, t: 0 };
      per.set(id, a);
    }
    if (a.root.parent !== parent) { a.root.parent?.removeChild(a.root); parent.addChild(a.root); }
    return a;
  }

  return {
    /** fxLeft(kind) → seconds left; x/z where the player is drawn; `fp`: this is my own body in first person. */
    update(dt, id, parent, fxLeft, x, z, fp = false) {
      const a = get(id, parent);
      a.t += dt;
      const shield = fxLeft('shield') > 0, magnet = fxLeft('magnet') > 0;
      a.shield.enabled = shield && !fp;
      if (shield) { const s = 1 + Math.sin(a.t * 5) * 0.04; a.shield.setLocalScale(s, s, s); }
      a.mag.enabled = magnet;
      if (magnet) { a.mag.setLocalEulerAngles(0, a.t * 120, 0); const s = 1 + 0.15 * Math.sin(a.t * 6); a.mag.setLocalScale(s * POWERUPS.magnet.radius / 4, 1, s * POWERUPS.magnet.radius / 4); }
      if (!fx) return;
      if (fxLeft('speed') > 0 && Math.random() < dt * 30) fx.emit({ x: x + (Math.random() - 0.5) * 0.4, y: 0.3 + Math.random() * 0.9, z: z + (Math.random() - 0.5) * 0.4 }, { x: 0, y: 0.2, z: 0 }, { n: 1, spread: 0.2, size: 0.18, grow: -0.5, life: 0.45, color: [1, 0.85, 0.3], gravity: 0, alpha: 0.9 });
      if (fxLeft('double') > 0 && Math.random() < dt * 14) { const ang = a.t * 4 + Math.random(); fx.emit({ x: x + Math.cos(ang) * 0.6, y: 1.2 + Math.sin(a.t * 3) * 0.4, z: z + Math.sin(ang) * 0.6 }, { x: 0, y: 0.6, z: 0 }, { n: 1, spread: 0.3, size: 0.14, grow: 0.2, life: 0.7, color: [0.85, 0.45, 1], gravity: 0, alpha: 1, twinkle: true }); }
      if (fxLeft('thief') > 0 && Math.random() < dt * 22) { const ang = -a.t * 5 + Math.random() * 0.5; fx.emit({ x: x + Math.cos(ang) * 0.75, y: 0.4 + Math.random() * 1.4, z: z + Math.sin(ang) * 0.75 }, { x: 0, y: 0.5, z: 0 }, { n: 1, spread: 0.2, size: 0.2, grow: 0.8, life: 0.8, color: [0.35, 1, 0.85], gravity: 0.2, alpha: 0.9, twinkle: true }); }
      if (fxLeft('giant') > 0 && Math.random() < dt * 10) fx.emit({ x: x + (Math.random() - 0.5) * 2, y: 0.15, z: z + (Math.random() - 0.5) * 2 }, { x: 0, y: 0.4, z: 0 }, { n: 1, spread: 1.2, size: 0.5, grow: 1.5, life: 0.8, color: [1, 0.45, 0.3], gravity: 0, alpha: 0.6 });
      if (fxLeft('slow') > 0 && Math.random() < dt * 12) fx.emit({ x: x + (Math.random() - 0.5) * 0.6, y: 0.15, z: z + (Math.random() - 0.5) * 0.6 }, { x: 0, y: 0.1, z: 0 }, { n: 1, spread: 0.1, size: 0.22, grow: 0.6, life: 0.9, color: [0.45, 1, 0.3], gravity: -0.3, alpha: 0.7 });
    },
    remove(id) { const a = per.get(id); if (a) { a.root.destroy(); per.delete(id); } },
    clear() { for (const a of per.values()) a.root.destroy(); per.clear(); },
  };
}
