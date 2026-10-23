// Player avatars ("PlayerSpawner"): the local player's own 3D Bitmoji, asked from Snapchat through the
// Web Lens API (bitmoji-anim.js handles every fallback Snap's docs ask for), playing the walking clips
// baked from src/poses.js. Other players are shown with Snap's default Bitmoji: the API serves only
// the current user's avatar (its `participant` parameter is reserved and rejected). Until a GLB has
// loaded, a jointed stand-in plays the same clips. Costumes ride on the head or spine joints.
// A ghost gem turns the same Bitmoji into a ghost of itself: see-through, pale and floating.
import { BLEND_NORMAL, Color, Entity, Mat4, Quat } from 'playcanvas';
import { unpackGlb } from '../lib/meshopt-glb.js';
import { loadBitmoji } from '../lib/bitmoji-anim.js';
import { snapchat } from '../lib/snap.js';
import { Geo, along, blob, box, cylinder, texturedMaterial, trs } from '../geo.js';
import { JOINTS, J, POSES, REST, evaluate } from '../poses.js';
import { capeGeo, costumeGeo } from './costumes.js';

/** Bitmojis are about 1.2 m tall; the village is built for grown-up proportions. */
export const AVATAR_SCALE = 1.35;
/** Eye height of the scaled default Bitmoji (for the first-person camera), measured on avatar_default.glb. */
export const EYE_HEIGHT = 0.97 * AVATAR_SCALE;

/** A GLB's bytes. Hosts that can't serve .glb files (a claude.ai artifact) get them as base64 in `<name>.glb.json`. */
async function fetchGlb(url) {
  const r = await fetch(url).catch(() => null);
  if (r?.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) return r.arrayBuffer();
  const { base64 } = await (await fetch(`${url}.json`)).json();
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

let shared = null;
function sharedAssets() {
  // Both files are meshopt-compressed for the Lens budget: unpack once, in memory (no blob: URLs, which
  // stricter hosts refuse), and hand each avatar its own copy of the bytes.
  const get = async (url) => unpackGlb(await fetchGlb(url));
  shared ??= Promise.all([get('./assets/clips.glb'), get('./assets/avatar_default.glb')])
    .then(([clips, fallback]) => ({ clips, fallback }));
  return shared;
}

/**
 * An avatar: `root` is placed and turned by its controller (it faces +Z at yaw 0).
 * `own`: true asks Snapchat for the player's Bitmoji; false shows the default one.
 */
export function createAvatar(app, tex, { own = false, costume = 'none', bitmojiUrl } = {}) {
  const root = new Entity(own ? 'me' : 'player');
  const figure = new Entity('figure');
  figure.setLocalScale(AVATAR_SCALE, AVATAR_SCALE, AVATAR_SCALE);
  root.addChild(figure);
  const mat = texturedMaterial(tex.plain, { gloss: 0.35 });
  const costumeMat = texturedMaterial(tex.plain, { gloss: 0.45 });
  const puppet = createPuppet(app, mat);
  figure.addChild(puppet.entity);
  const status = { state: 'loading', real: false, error: null };
  let bitmoji = null, anim = 'idle', speed = 1, visible = true;
  let worn = [], costumeId = costume, cape = null, capeSway = 0;
  let ghost = false, ghostT = 0, float = 0;
  const original = new WeakMap(), ghostly = new Map(); // mesh instance → its own material; material → its ghost copy
  // Where the head is, in the figure's (unscaled) frame: puppet values until a Bitmoji arrives.
  let headInfo = { joint: puppet.joints[J.Head], spine: puppet.joints[J.Spine1], top: 1.12, cx: 0, cz: 0, r: 0.12, neckY: 0.86, neckZ: 0 };

  function attach(e, joint, desired) {
    const world = new Mat4().mul2(figure.getWorldTransform(), desired);
    const local = new Mat4().mul2(joint.getWorldTransform().clone().invert(), world);
    joint.addChild(e);
    e.setLocalPosition(local.getTranslation());
    e.setLocalRotation(new Quat().setFromMat4(local));
    e.setLocalScale(local.getScale());
  }
  function wear(id) {
    for (const e of worn) e.destroy();
    worn = []; cape = null;
    costumeId = id;
    if (id === 'none') return;
    const h = headInfo;
    if (id === 'cape') {
      const pivot = new Entity('cape');
      const mesh = capeGeo().build(app.graphicsDevice, costumeMat, 'cape-mesh');
      mesh.render.castShadows = true;
      pivot.addChild(mesh);
      attach(pivot, h.spine, trs(0, h.neckY - 0.03, h.neckZ + 0.02));
      cape = mesh;
      worn.push(pivot);
    } else {
      const e = costumeGeo(id).build(app.graphicsDevice, costumeMat, `costume-${id}`);
      e.render.castShadows = true;
      const drop = id === 'horns' ? 0.5 : id === 'pumpkin' ? 0.1 : 0.22;
      const holder = new Entity(`costume-${id}`);
      holder.addChild(e);
      attach(holder, h.joint, trs(h.cx, h.top - drop * h.r, h.cz, id === 'witch' ? -6 : 0, 0, id === 'witch' ? 8 : 0, h.r * (id === 'witch' ? 0.78 : 1)));
      worn.push(holder);
    }
    for (const e of worn) e.enabled = visible;
    dress();
  }

  /** The ghost look: every material of the figure (Bitmoji, stand-in, costume) swapped for a pale, see-through copy. */
  function ghostOf(m) {
    let g = ghostly.get(m);
    if (!g) {
      g = m.clone();
      g.blendType = BLEND_NORMAL;
      g.opacity = 0.45;
      g.depthWrite = false;
      g.diffuse = new Color(0.75, 0.75, 0.95);
      g.emissive = new Color(0.5, 0.48, 0.72);
      g.update();
      ghostly.set(m, g);
    }
    return g;
  }
  function dress() {
    for (const r of figure.findComponents('render')) {
      for (const mi of r.meshInstances) {
        if (!original.has(mi)) original.set(mi, mi.material);
        mi.material = ghost ? ghostOf(original.get(mi)) : original.get(mi);
      }
      r.castShadows = !ghost;
    }
  }

  /** Reads the head's size and place from the avatar's own meshes (bind pose), so hats fit every Bitmoji. */
  function measure(b) {
    let top = -Infinity, head = null;
    for (const r of b.entity.findComponents('render')) {
      for (const mi of r.meshInstances) {
        const a = mi.mesh.aabb;
        if (/head_GEO$/i.test(r.entity.name) && !/mouth/i.test(r.entity.name)) head = a;
        if (/(head|hair|headwear)_GEO$/i.test(r.entity.name)) top = Math.max(top, a.center.y + a.halfExtents.y);
      }
    }
    const joint = b.joint('Head'), spine = b.joint('Spine1') ?? b.joint('Spine'), neck = b.joint('Neck');
    if (!joint || !spine) return;
    const inFig = (e) => { const m = new Mat4().mul2(figure.getWorldTransform().clone().invert(), e.getWorldTransform()); return m.getTranslation(); };
    const jp = inFig(joint), np = neck ? inFig(neck) : jp;
    headInfo = {
      joint, spine,
      top: Number.isFinite(top) ? top : jp.y + 0.27,
      cx: head ? head.center.x : jp.x, cz: head ? head.center.z : jp.z + 0.01,
      r: head ? Math.max(0.12, Math.min(0.24, Math.max(head.halfExtents.x, head.halfExtents.z))) : 0.16,
      neckY: np.y, neckZ: np.z,
    };
  }

  const ready = sharedAssets()
    .then(({ clips, fallback }) => loadBitmoji(app, { clips: clips.slice(0), fallback: fallback.slice(0), snapchat, ...(own ? (bitmojiUrl !== undefined ? { url: bitmojiUrl } : {}) : { url: null }) }))
    .then((b) => {
      bitmoji = b;
      figure.addChild(b.entity);
      for (const r of b.entity.findComponents('render')) r.castShadows = true;
      puppet.entity.enabled = false;
      measure(b);
      wear(costumeId); // (and dresses the new meshes for a ghost, if one)
      b.play(anim, { fade: 0, speed });
      b.entity.enabled = visible;
      Object.assign(status, { state: b.isReal ? 'bitmoji' : 'default', real: b.isReal });
      return status;
    })
    .catch((e) => {
      console.warn('[avatar] stand-in character:', e.message);
      Object.assign(status, { state: 'stand-in', error: e.message });
      wear(costumeId);
      return status;
    });
  wear(costumeId);

  return {
    root,
    status,
    ready,
    get costume() { return costumeId; },
    setCostume(id) { if (id !== costumeId) wear(id); },
    /** Plays a clip (idle, walk, run, knock, hit, cheer, sad); same clip just changes its speed. */
    setAnim(name, s = 1, fade = 0.22) {
      if (name === anim) {
        if (Math.abs(s - speed) > 0.01) { speed = s; bitmoji?.setSpeed(s); }
        return;
      }
      anim = name; speed = s;
      bitmoji?.play(name, { fade, speed: s });
      puppet.play(name, fade);
    },
    get anim() { return anim; },
    /** Ghost form on or off (a ghost gem). */
    setGhost(on) { if (on !== ghost) { ghost = on; dress(); } },
    get ghost() { return ghost; },
    /** First person hides the body (and its hat) from its own camera; the clips keep playing. */
    setVisible(v) {
      visible = v;
      if (bitmoji) bitmoji.entity.enabled = v;
      else puppet.entity.enabled = v;
      for (const e of worn) e.enabled = v;
    },
    update(dt, moveSpeed = 0) {
      if (!bitmoji && puppet.entity.enabled) puppet.update(dt * speed);
      // A ghost floats a little off the ground, bobbing.
      ghostT += dt;
      float += ((ghost ? 0.3 + Math.sin(ghostT * 2.2) * 0.08 : 0) - float) * Math.min(1, dt * 4);
      figure.setLocalPosition(0, float, 0);
      if (cape) { // the cape streams back as you run
        capeSway += (Math.min(1, moveSpeed / 6) - capeSway) * Math.min(1, dt * 4);
        cape.setLocalEulerAngles(-capeSway * 38 - Math.sin(performance.now() / 160) * 4 * capeSway, 0, 0);
      }
    },
    destroy() {
      bitmoji?.destroy();
      root.destroy();
    },
  };
}

// --- stand-in character (from Cruise Rush) ----------------------------------------------
const H = 0.84; // hip height in metres: Bitmoji-like proportions, about 1.55 m tall
const COL = { skin: [0.98, 0.8, 0.66], hoodie: [0.98, 0.42, 0.22], jeans: [0.22, 0.34, 0.62], shoe: [0.96, 0.96, 0.98], sole: [0.9, 0.2, 0.25], hair: [0.32, 0.2, 0.12], eye: [0.08, 0.08, 0.1] };

/** A jointed figure whose limbs follow the same per-joint turns as the Bitmoji clips. */
function createPuppet(app, mat) {
  const entity = new Entity('stand-in');
  const joints = JOINTS.map((name) => {
    const e = new Entity(name);
    entity.addChild(e);
    return e;
  });
  const rp = (n) => REST[J[n]].map((c) => c * H);
  // Each part is modelled in the T-pose, relative to the joint that carries it.
  const part = (jointName, build) => {
    const g = new Geo();
    const o = rp(jointName);
    build(g, (p) => [p[0] - o[0], p[1] - o[1], p[2] - o[2]]);
    const e = g.build(app.graphicsDevice, mat, `${jointName}-mesh`);
    joints[J[jointName]].addChild(e);
  };
  const limb = (g, rel, a, b, r0, r1, col) => {
    const s = along(rel(a), rel(b));
    g.add(cylinder(r0, r1, s.len, 10, { caps: false }), s.mat, col);
    g.add(blob(r0 * 1.02, 8), trs(...rel(a)), col);
  };
  for (const side of ['Left', 'Right']) {
    part(`${side}Arm`, (g, rel) => limb(g, rel, rp(`${side}Arm`), rp(`${side}ForeArm`), 0.058, 0.05, COL.hoodie));
    part(`${side}ForeArm`, (g, rel) => limb(g, rel, rp(`${side}ForeArm`), rp(`${side}Hand`), 0.05, 0.042, COL.hoodie));
    part(`${side}Hand`, (g, rel) => g.add(blob(0.055, 8, { squashY: 0.8 }), trs(...rel(rp(`${side}Hand`).map((c, k) => c + (k === 0 ? (side === 'Left' ? 0.04 : -0.04) : 0)))), COL.skin));
    part(`${side}UpLeg`, (g, rel) => limb(g, rel, rp(`${side}UpLeg`), rp(`${side}Leg`), 0.085, 0.07, COL.jeans));
    part(`${side}Leg`, (g, rel) => limb(g, rel, rp(`${side}Leg`), rp(`${side}Foot`), 0.068, 0.058, COL.jeans));
    part(`${side}Foot`, (g, rel) => {
      const f = rp(`${side}Foot`);
      g.add(box(0.13, 0.09, 0.27), trs(...rel([f[0], f[1] - 0.02, f[2] + 0.07])), COL.shoe);
      g.add(box(0.135, 0.03, 0.28), trs(...rel([f[0], f[1] - 0.075, f[2] + 0.07])), COL.sole);
    });
  }
  part('Hips', (g, rel) => g.add(blob(0.17, 10, { squashY: 0.8 }), trs(...rel(rp('Hips'))), COL.jeans));
  part('Spine', (g, rel) => {
    const a = rp('Spine'), b = rp('Neck');
    const s = along(rel(a), rel(b));
    g.add(cylinder(0.16, 0.2, s.len, 12, { caps: false }), s.mat, COL.hoodie);
    g.add(blob(0.2, 12, { squashY: 0.55 }), trs(...rel(b)), COL.hoodie); // shoulders
    g.add(blob(0.16, 10, { squashY: 0.6 }), trs(...rel(a)), COL.hoodie);
  });
  part('Neck', (g, rel) => g.add(cylinder(0.05, 0.05, 0.1, 8), trs(...rel(rp('Neck'))), COL.skin));
  part('Head', (g, rel) => {
    const c = rp('Head').map((v, k) => v + (k === 1 ? 0.11 : 0));
    g.add(blob(0.17, 14, { squashY: 1.05 }), trs(...rel(c)), COL.skin);
    g.add(blob(0.178, 14, { squashY: 0.62 }), trs(...rel([c[0], c[1] + 0.07, c[2] - 0.015])), COL.hair);
    for (const x of [-0.055, 0.055]) g.add(blob(0.025, 8, { squashY: 1.3 }), trs(...rel([c[0] + x, c[1] + 0.01, c[2] + 0.155])), COL.eye);
    g.add(blob(0.03, 8, { squashY: 0.6 }), trs(...rel([c[0], c[1] - 0.07, c[2] + 0.15])), [0.85, 0.45, 0.4]); // smile
  });

  const q = new Quat();
  let from = null, current = 'idle', t = 0, fade = 0, fadeLen = 0.25;
  const apply = () => {
    const now = evaluate(current, t % POSES[current].length);
    let D = now.D, pos = now.pos;
    if (from && fade < fadeLen) { // blend from the pose on screen when the clip changed
      const k = fade / fadeLen;
      D = D.map((d, j) => nlerp(from.D[j], d, k));
      pos = pos.map((p, j) => p.map((c, i) => from.pos[j][i] + (c - from.pos[j][i]) * k));
    }
    for (let j = 0; j < JOINTS.length; j++) {
      joints[j].setLocalPosition(pos[j][0] * H, pos[j][1] * H, pos[j][2] * H);
      joints[j].setLocalRotation(q.set(...D[j]));
    }
    return { D, pos };
  };
  let last = apply();
  entity.setLocalScale(2 / 3, 2 / 3, 2 / 3); // built at 1.55 m; Bitmojis stand about 1.2 m before AVATAR_SCALE
  return {
    entity,
    joints,
    play(name, len = 0.25) {
      from = last;
      current = name;
      fade = 0;
      fadeLen = len;
      t = 0;
    },
    update(dt) {
      t += dt;
      fade += dt;
      last = apply();
    },
  };
}

function nlerp(a, b, k) {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const r = a.map((c, i) => c + (b[i] * sign - c) * k);
  const l = Math.hypot(...r);
  return r.map((c) => c / l);
}

