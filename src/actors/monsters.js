// MonsterManager (the drawing side): each monster the authority announces gets a body here, drawn
// where the snapshots put it (interpolated) and animated by its state. Not gory, a little uncanny:
// a small translucent ghost whose eyes flare red when it gives chase (and that turns a frightened blue
// when a giant or a ghost thief is after it), and a lanky stitched zombie that lurches with its arms out.
// A monster that gets scared off spins away into nothing.
import { BLEND_NORMAL, CULLFACE_NONE, Color, Entity, StandardMaterial } from 'playcanvas';
import { Geo, blob, box, trs } from '../geo.js';
import { lathe, tube } from '../world/shapes.js';

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

/** A thin, tall, stitched zombie in parts so it can lurch. Facing +Z, ~1.9 m. */
function zombieParts(app, m) {
  const skin = [0.45, 0.58, 0.38], shirt = [0.12, 0.3, 0.36], pants = [0.24, 0.16, 0.3], dark = [0.08, 0.06, 0.08];
  const root = new Entity('zombie');
  const hips = new Entity('hips'); hips.setLocalPosition(0, 0.95, 0); root.addChild(hips);
  const torso = new Entity('torso'); hips.addChild(torso);
  const head = new Entity('head'); head.setLocalPosition(0, 0.72, 0.04); torso.addChild(head);
  const build = (geo, name, parent) => { const e = geo.build(app.graphicsDevice, m, name); e.render.castShadows = true; parent.addChild(e); return e; };
  const tg = new Geo();
  tg.add(lathe([[0.17, 0], [0.2, 0.2], [0.22, 0.45], [0.25, 0.62], [0.12, 0.7], [0, 0.72]], 9, { shape: (a, v) => (Math.cos(a * 9) > 0.7 && v < 0.2 ? 0.86 : 1) }), null, shirt); // ragged hem
  tg.add(box(0.08, 0.12, 0.02), trs(0.08, 0.35, 0.2, 0, 0, 20), [0.3, 0.12, 0.4]); // a patch
  build(tg, 'torso-mesh', torso);
  const hg = new Geo();
  hg.add(blob(0.25, 12, { squashY: 1.15, rand: (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })(), jitter: 0.18 }), trs(0, 0.22, 0), skin);
  hg.add(blob(0.07, 8), trs(-0.09, 0.27, 0.21), [1, 0.95, 0.6]); // big pale eye
  hg.add(blob(0.035, 6), trs(0.1, 0.25, 0.23), [0.15, 0.1, 0.1]); // small eye
  for (let k = 0; k < 4; k++) hg.add(box(0.012, 0.06, 0.02), trs(-0.06 + k * 0.04, 0.08, 0.235), dark); // stitched mouth
  hg.add(box(0.14, 0.012, 0.02), trs(0, 0.08, 0.232), dark);
  hg.add(box(0.012, 0.16, 0.02), trs(0.13, 0.38, 0.2, 0, 0, 70), dark); // forehead stitches
  for (let k = 0; k < 5; k++) hg.add(tube([[0.05 * (k - 2), 0.45, 0], [0.07 * (k - 2), 0.55, -0.04], [0.1 * (k - 2), 0.6, -0.1]], 0.012, 3), null, dark); // sparse hair
  build(hg, 'head-mesh', head);
  const limbs = {};
  for (const s of [-1, 1]) {
    const arm = new Entity(`arm${s}`); arm.setLocalPosition(s * 0.27, 0.6, 0); torso.addChild(arm);
    const ag = new Geo();
    ag.add(tube([[0, 0, 0], [0, -0.05, 0.3], [0, -0.08, 0.62]], [0.06, 0.05, 0.045], 6), null, shirt);
    ag.add(tube([[0, -0.08, 0.6], [0, -0.1, 0.78]], 0.04, 6), null, skin);
    for (let f = 0; f < 3; f++) ag.add(tube([[0, -0.1, 0.77], [(f - 1) * 0.035, -0.13, 0.86], [(f - 1) * 0.045, -0.18, 0.9]], 0.012, 3), null, skin);
    build(ag, 'arm-mesh', arm);
    const leg = new Entity(`leg${s}`); leg.setLocalPosition(s * 0.1, 0, 0); hips.addChild(leg);
    const lg = new Geo();
    lg.add(tube([[0, 0, 0], [0, -0.45, 0.02], [0, -0.88, 0]], [0.07, 0.055, 0.05], 6), null, pants);
    lg.add(box(0.12, 0.08, 0.26), trs(0, -0.91, 0.06), dark);
    build(lg, 'leg-mesh', leg);
    limbs[s] = { arm, leg };
  }
  return { root, hips, torso, head, limbs };
}

export function createMonsters(app, fx) {
  const root = new Entity('monsters');
  const ghostMat = mat({ color: [0.95, 0.94, 1], emissive: [0.32, 0.3, 0.45], opacity: 0.86, gloss: 0.6, twoSided: true });
  const scaredMat = mat({ color: [0.45, 0.6, 1], emissive: [0.15, 0.3, 0.75], opacity: 0.8, gloss: 0.6, twoSided: true });
  const faceIdle = mat({ color: [0.02, 0.02, 0.04] });
  const faceChase = mat({ color: [0.2, 0, 0], emissive: [1, 0.12, 0.08] });
  const faceScared = mat({ color: [0.9, 0.95, 1], emissive: [0.8, 0.9, 1] });
  const zombieMat = mat({ gloss: 0.25 });
  const ghostBody = ghostGeo(), face = ghostFace();
  const bodies = new Map();

  function make(m) {
    const e = new Entity(`monster-${m.id}`);
    const b = { e, kind: m.kind, t: Math.random() * 10, yaw: 0, scale: 0, chase: false, parts: null, gone: 0 };
    if (m.kind === 'zombie') {
      b.parts = zombieParts(app, zombieMat);
      e.addChild(b.parts.root);
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
        if (!b) { b = make(m); bodies.set(id, b); }
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
          const P = b.parts, w = b.t * (2.2 + moved * 1.3), amp = Math.min(1, moved / 1.2);
          P.limbs[-1].leg.setLocalEulerAngles(Math.sin(w) * 28 * amp, 0, 0);
          P.limbs[1].leg.setLocalEulerAngles(-Math.sin(w) * 28 * amp, 0, 0);
          P.torso.setLocalEulerAngles(8 + 6 * amp, Math.sin(w) * 10 * amp, Math.sin(w) * 9 * amp);
          P.head.setLocalEulerAngles(Math.sin(b.t * 1.3) * 10, Math.sin(b.t * 0.7) * 20, 18 + Math.sin(b.t * 0.9) * 14);
          const reach = fleeing ? -150 + Math.sin(b.t * 14) * 25 : chasing ? -18 : -4; // fleeing: arms up, flailing
          P.limbs[-1].arm.setLocalEulerAngles(reach + Math.sin(w + 1) * 12, 0, 0);
          P.limbs[1].arm.setLocalEulerAngles(reach - 6 + Math.sin(w) * 12, 0, 0);
          P.hips.setLocalPosition(0, 0.95 + Math.abs(Math.sin(w)) * 0.05 * amp, 0);
          if (m.state === 'recover') P.torso.setLocalEulerAngles(-15, 0, Math.sin(b.t * 9) * 12);
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

