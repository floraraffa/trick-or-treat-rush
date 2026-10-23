// MonsterManager (the drawing side): each monster the authority announces gets a body here, drawn
// where the snapshots put it (interpolated) and animated by its state. Not gory, a little uncanny:
// a small translucent ghost whose eyes flare red when it gives chase (and that turns a frightened blue
// when a giant or a candy thief is after it), and the team's four drawn creatures (creatures.js) in
// the role of the monsters that slow you down (the authority's 'zombie' kind), each walking or gliding
// its own way, leaning in to chase and shuddering, gone blue, when a gem frightens it.
// A monster that gets scared off spins away into nothing.
import { BLEND_NORMAL, CULLFACE_NONE, Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, blob, trs } from '../geo.js';
import { lathe } from '../world/shapes.js';
import { CREATURES, animateCreature, createCreature } from './creatures.js';

function mat({ color = [1, 1, 1], emissive = [0, 0, 0], opacity = 1, gloss = 0.4, twoSided = false } = {}) {
  const m = new StandardMaterial();
  m.diffuse = new Color(...color);
  m.diffuseVertexColor = true;
  m.emissive = new Color(...emissive);
  m.gloss = gloss;
  m.useMetalness = true;
  m.metalness = 0;
  if (opacity < 1) { m.blendType = BLEND_NORMAL; m.opacity = opacity; } // still writes depth, so the mist behind stays behind
  if (twoSided) m.cull = CULLFACE_NONE;
  m.update();
  return m;
}

/** The ghost's sheet: a rounded head flowing into a wavy hem. Height ~1.6, facing +Z. */
function ghostGeo() {
  const g = new Geo();
  const prof = [[0.56, 0], [0.54, 0.25], [0.5, 0.55], [0.46, 0.85], [0.44, 1.08], [0.41, 1.26], [0.34, 1.43], [0.22, 1.55], [0.08, 1.61], [0, 1.62]];
  g.add(lathe(prof, 20, { wave: (a, v) => (v < 0.01 ? Math.sin(a * 7) * 0.09 : 0), shape: (a, v) => 1 + (v < 0.4 ? 0.06 * Math.sin(a * 5 + v * 9) : 0) }), null, [0.92, 0.9, 1]);
  for (const s of [-1, 1]) g.add(blob(0.13, 8, { squashY: 0.6 }), trs(s * 0.5, 0.95, 0.05, 0, 0, s * 30), [0.9, 0.88, 1]); // little arms
  return g;
}
function ghostFace() {
  const g = new Geo();
  for (const s of [-1, 1]) g.add(blob(0.075, 8, { squashY: 1.45 }), trs(s * 0.14, 1.28, 0.395, 0, s * 12, 0), [1, 1, 1]);
  g.add(blob(0.06, 8, { squashY: 1.3 }), trs(0, 1.1, 0.42), [1, 1, 1]); // "oooh"
  return g;
}

/** Which of the four creatures a monster is: the same on every device (from its id and the round), changing each round. */
const creatureOf = (id, round) => CREATURES[(parseInt(String(id).slice(1), 10) + (round | 0)) % CREATURES.length];

export function createMonsters(app, fx, { base = './assets/' } = {}) {
  const root = new Entity('monsters');
  const ghostMat = mat({ color: [0.95, 0.94, 1], emissive: [0.32, 0.3, 0.45], opacity: 0.86, gloss: 0.6, twoSided: true });
  const scaredMat = mat({ color: [0.45, 0.6, 1], emissive: [0.15, 0.3, 0.75], opacity: 0.8, gloss: 0.6, twoSided: true });
  const faceIdle = mat({ color: [0.02, 0.02, 0.04] });
  const faceChase = mat({ color: [0.2, 0, 0], emissive: [1, 0.12, 0.08] });
  const faceScared = mat({ color: [0.9, 0.95, 1], emissive: [0.8, 0.9, 1] });
  const plainMat = mat({ gloss: 0.3 });
  const ghostBody = ghostGeo(), face = ghostFace();
  const bodies = new Map();

  function make(m, round) {
    const e = new Entity(`monster-${m.id}`);
    const b = { e, kind: m.kind, t: Math.random() * 10, yaw: 0, scale: 0, chase: false, creature: null, gone: 0 };
    if (m.kind === 'zombie') {
      b.creature = createCreature(app, creatureOf(m.id, round), { base, plainMat });
      e.addChild(b.creature.root);
    } else {
      const inner = new Entity('ghost');
      const body = ghostBody.build(app.graphicsDevice, ghostMat, 'ghost-body');
      const fc = face.build(app.graphicsDevice, faceIdle, 'ghost-face');
      body.render.castShadows = true;
      inner.addChild(body); inner.addChild(fc);
      e.addChild(inner);
      b.inner = inner; b.face = fc; b.body = body; b.look = 'idle';
    }
    root.addChild(e);
    return b;
  }

  return {
    root,
    /** Draws every monster in the view (state from snapshots, a little in the past). */
    update(dt, view, now, cam = null) {
      for (const [id, m] of view.monsters) {
        let b = bodies.get(id);
        if (!b) { b = make(m, view.round); bodies.set(id, b); }
        const s = view.sample(m.track);
        if (!s) continue;
        b.t += dt;
        const gone = m.gone ? Math.min(1, (now - m.gone) / 0.5) : 0;
        if (gone >= 1) { b.e.destroy(); bodies.delete(id); view.monsters.delete(id); continue; }
        const banished = m.state === 'banished';
        b.scale = banished ? Math.max(0, b.scale - dt * 2.2) : Math.min(1, b.scale + dt * 2.5) * (1 - gone);
        if (banished && b.scale <= 0) { b.e.enabled = false; continue; }
        const moved = Math.hypot(s.x - (b.px ?? s.x), s.z - (b.pz ?? s.z)) / Math.max(dt, 1e-3);
        b.px = s.x; b.pz = s.z;
        const chasing = m.state === 'chase', fleeing = m.state === 'flee';
        let y = 0;
        if (m.kind === 'zombie') {
          b.w = (b.w ?? 0) + dt * (1.5 + moved * 1.6);
          animateCreature(b.creature, b.t, b.w, Math.min(1, moved / 1.2), m.state);
          b.creature.setScared(fleeing);
        } else {
          y = 0.3 + Math.sin(b.t * (fleeing ? 6 : 2.2)) * 0.12;
          b.inner.setLocalEulerAngles(Math.min(14, moved * 3), 0, Math.sin(b.t * (fleeing ? 9 : 1.7)) * (fleeing ? 14 : 7));
          const look = fleeing ? 'scared' : chasing ? 'chase' : 'idle';
          if (look !== b.look) {
            b.look = look;
            b.face.render.meshInstances[0].material = look === 'scared' ? faceScared : look === 'chase' ? faceChase : faceIdle;
            b.body.render.meshInstances[0].material = look === 'scared' ? scaredMat : ghostMat;
          }
          if ((chasing || fleeing) && Math.random() < dt * 8) fx?.emit({ x: s.x, y: y + 0.6, z: s.z }, { x: 0, y: 0.3, z: 0 }, { n: 1, size: 0.35, grow: 1, life: 0.8, color: fleeing ? [0.5, 0.7, 1] : [0.85, 0.85, 1], gravity: 0.2, alpha: 0.35, spread: 0.3 });
        }
        const d = ((((s.yaw - b.yaw) % 360) + 540) % 360) - 180;
        b.yaw += d * Math.min(1, dt * 8);
        b.e.setPosition(s.x, y, s.z);
        b.e.setEulerAngles(0, b.yaw + (banished ? (1 - b.scale) * 720 : 0), 0);
        const sc = b.scale * (m.state === 'recover' && m.kind !== 'zombie' ? 1 + Math.sin(b.t * 20) * 0.05 : 1);
        b.e.setLocalScale(sc, sc, sc);
        // A body that swallows the camera would fill the screen: hide it while the camera is inside.
        b.e.enabled = !cam || Math.hypot(cam.x - s.x, cam.z - s.z) > 0.8 || cam.y > 2.2;
      }
      for (const [id, b] of bodies) if (!view.monsters.has(id)) { b.e.destroy(); bodies.delete(id); }
    },
    clear() { for (const b of bodies.values()) b.e.destroy(); bodies.clear(); },
  };
}

