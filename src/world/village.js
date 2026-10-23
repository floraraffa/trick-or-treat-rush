// Assembles the haunted village from its plan (layout.js): ground, cobbled streets, the plaza and
// its clock tower, the eight houses, the cemetery, the woods, the lamps, the sky, and the night's
// lighting (moonlight with long shadows, warm lamps, violet fog). `setMadness` turns the last
// minute sinister: thicker fog, a red moon, flickering, brighter lamps.
import { BLEND_ADDITIVEALPHA, CULLFACE_NONE, Color, Entity, FOG_EXP2, Quat, SHADOW_PCF3_32F, StandardMaterial, Vec3 } from 'playcanvas';
import { Batches, Geo, texturedMaterial } from '../geo.js';
import { flat } from './shapes.js';
import { installHeightFog } from './heightfog.js';
import { rng } from '../rng.js';
import { buildHouse } from './houses.js';
import { addBush, addCemetery, addClockTower, addFence, addFlowers, addLamp, addMushrooms, addPumpkin, addTree } from './props.js';
import { addSilhouettes, createSky } from './sky.js';
import { ribbon } from './shapes.js';
import { BUSHES, FENCES, FLOWERS, HOUSES, LAMPS, MAP_R, MUSHROOMS, PLAZA_R, PUMPKINS, RING, RING_W, STREETS, TOMBS, TREES, WOODS } from './layout.js';

const D2R = Math.PI / 180;
export const MOON_DIR = [-0.55, 0.42, -0.72]; // towards the moon: low in the north-west, long shadows

// Height fog (heightfog.js): a light haze overall, thick pale mist on the ground that thins as it
// rises and drifts in banks; the lamps glow into it.
const FOG_CALM = { color: [0.12, 0.1, 0.2], density: 0.012, ground: 0.05, falloff: 0.5, mist: [0.5, 0.5, 0.66] };
const FOG_MAD = { color: [0.19, 0.08, 0.16], density: 0.016, ground: 0.075, falloff: 0.42, mist: [0.48, 0.4, 0.55] };
const AMBIENT_CALM = [0.2, 0.18, 0.32], AMBIENT_MAD = [0.26, 0.14, 0.24];
const MOON_CALM = [0.62, 0.7, 1], MOON_MAD = [1, 0.48, 0.42];

/** Value noise for the ground's moss and earth patches. */
function noise2(seed) {
  const R = rng(seed), N = 64, v = Float32Array.from({ length: N * N }, R);
  const at = (i, j) => v[((j % N + N) % N) * N + ((i % N + N) % N)];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = sm(x - i), fz = sm(z - j);
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fz) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fz;
  };
}

export function createVillage(app, tex, { lowFx = false } = {}) {
  const root = new Entity('village');
  const heightFog = installHeightFog(app.graphicsDevice); // before any material is built
  const N = tex.normals;
  const materials = {
    wood: texturedMaterial(tex.siding, { normal: N.siding, gloss: 0.22, bumpiness: 1.3 }),
    shingle: texturedMaterial(tex.slates, { normal: N.slates, gloss: 0.45, bumpiness: 1.4, tiling: 0.75 }),
    stone: texturedMaterial(tex.flags, { normal: N.flags, gloss: 0.38, bumpiness: 1.2 }),
    masonry: texturedMaterial(tex.masonry, { normal: N.masonry, gloss: 0.2, bumpiness: 1.3 }),
    rock: texturedMaterial(tex.rock, { normal: N.rock, gloss: 0.18 }),
    bark: texturedMaterial(tex.bark, { normal: N.bark, gloss: 0.15, bumpiness: 1.3 }),
    woods: texturedMaterial(tex.bark, { gloss: 0.1 }), // the far woods: no normal map, no shadows
    plain: texturedMaterial(tex.plain, { gloss: 0.32 }),
    glossy: texturedMaterial(tex.plain, { gloss: 0.7, metal: 0.65 }),
    glow: texturedMaterial(tex.window, { emissive: new Color(1, 1, 1), gloss: 0.8 }),
    emit: texturedMaterial(tex.plain, { emissive: new Color(1, 1, 1) }),
    cobble: texturedMaterial(tex.cobbles, { normal: N.cobbles, gloss: 0.5, bumpiness: 1.5 }), // damp with mist: a little shine
    ground: texturedMaterial(tex.grass, { normal: N.grass, gloss: 0.12, noTile: true }),
    dirt: texturedMaterial(tex.dirt, { normal: N.dirt, gloss: 0.1 }),
    silhouette: texturedMaterial(tex.plain, { gloss: 0 }),
  };
  materials.glow.emissiveIntensity = 1.6; materials.glow.update();
  materials.emit.emissiveIntensity = 2; materials.emit.update();
  const B = new Batches(materials);

  // Ground: a big disc of moss and earth that rises into low mounds beyond the village.
  {
    const n = noise2(5), rings = 30, segs = 72, R0 = 95;
    const m = { p: [], n: [], uv: [], i: [] };
    const height = (x, z, r) => (r < MAP_R + 2 ? 0 : Math.pow((r - MAP_R - 2) / 20, 1.5) * 4 * (0.6 + n(x * 0.08, z * 0.08)));
    for (let k = 0; k <= rings; k++) {
      const r = Math.pow(k / rings, 1.35) * R0;
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        m.p.push(x, height(x, z, r), z); m.n.push(0, 1, 0); m.uv.push(x * 0.22, z * 0.22);
      }
    }
    for (let k = 0; k < rings; k++) for (let s = 0; s < segs; s++) { const a = k * (segs + 1) + s, b = a + segs + 1; m.i.push(a, a + 1, b, a + 1, b + 1, b); }
    B.get('ground').add(m, null, (x, y, z) => {
      const v = n(x * 0.12, z * 0.12), w = n(x * 0.03 + 9, z * 0.03 + 3), r = Math.hypot(x, z);
      const moss = [0.36 + 0.1 * v, 0.42 + 0.14 * v, 0.3 + 0.06 * v], violet = [0.4, 0.32, 0.46];
      const c = moss.map((cv, i) => cv + (violet[i] - cv) * Math.max(0, w - 0.45) * 1.6);
      const fade = r > MAP_R ? Math.max(0.45, 1 - (r - MAP_R) / 40) : 1;
      return c.map((cv) => cv * fade);
    });
  }
  // Streets: the cobbled ring with a dark kerb, the radial streets and the garden paths.
  B.get('cobble').add(ribbon(RING, RING_W + 0.7, { closed: true, y: 0.02, uvScale: 0.6 }), null, [0.24, 0.22, 0.28]);
  B.get('cobble').add(ribbon(RING, RING_W, { closed: true, y: 0.03, uvScale: 0.6 }), null, [0.48, 0.45, 0.54]);
  STREETS.forEach((s, i) => B.get(i < 5 ? 'cobble' : 'dirt').add(ribbon(s.path, s.w, { y: 0.035 + i * 0.0005, uvScale: i < 5 ? 0.6 : 0.3 }), null, i < 5 ? [0.46, 0.43, 0.52] : [0.55, 0.45, 0.42]));
  // Plaza: flagstones in a disc with a darker ring of cobbles round it.
  {
    const disc = { p: [0, 0.045, 0], n: [0, 1, 0], uv: [0, 0], i: [] }, segs = 48;
    for (let s = 0; s <= segs; s++) { const a = (s / segs) * Math.PI * 2; disc.p.push(Math.cos(a) * PLAZA_R, 0.045, Math.sin(a) * PLAZA_R); disc.n.push(0, 1, 0); disc.uv.push(Math.cos(a) * PLAZA_R * 0.4, Math.sin(a) * PLAZA_R * 0.4); }
    for (let s = 0; s < segs; s++) disc.i.push(0, s + 2, s + 1);
    B.get('stone').add(disc, null, [0.6, 0.56, 0.66]);
    const edge = Array.from({ length: 64 }, (_, k) => [Math.cos((k / 64) * Math.PI * 2) * (PLAZA_R + 0.35), Math.sin((k / 64) * Math.PI * 2) * (PLAZA_R + 0.35)]);
    B.get('cobble').add(ribbon(edge, 0.8, { closed: true, y: 0.05, uvScale: 0.5 }), null, [0.36, 0.32, 0.4]);
  }

  // Houses.
  const houses = HOUSES.map((h) => {
    const built = buildHouse(app, h, B);
    root.addChild(built.root);
    return built;
  });
  // Props.
  for (const t of TREES) addTree(B, t);
  for (const t of WOODS) addTree(B, t, { detail: 0.3, key: 'woods' });
  const PR = rng(123);
  for (const p of PUMPKINS) addPumpkin(B, p, PR);
  for (const f of FENCES) addFence(B, f);
  addCemetery(B, TOMBS);
  for (const m of MUSHROOMS) addMushrooms(B, m);
  for (const f of FLOWERS) addFlowers(B, f);
  for (const b of BUSHES) addBush(B, b);
  addSilhouettes(B);
  const clockMat = texturedMaterial(tex.clock, { emissive: new Color(0.55, 0.5, 0.4), alphaTest: 0.5 });
  const clock = addClockTower(app, B, clockMat);
  root.addChild(clock.root);
  const lampSpots = LAMPS.map((l) => ({ at: addLamp(B, l), real: l.real }));

  const statics = B.build(app.graphicsDevice, 'village-static', { castShadows: true });
  for (const r of statics.findComponents('render')) {
    const key = r.entity.name.replace('village-static-', '');
    r.castShadows = !['ground', 'cobble', 'dirt', 'silhouette', 'stone', 'glow', 'emit', 'woods'].includes(key);
    r.receiveShadows = key !== 'silhouette';
  }
  root.addChild(statics);

  // --- lighting ---
  const moon = new Entity('moonlight');
  moon.addComponent('light', {
    type: 'directional', color: new Color(...MOON_CALM), intensity: 0.95,
    castShadows: !lowFx, shadowDistance: 34, shadowResolution: lowFx ? 1024 : 2048, shadowType: SHADOW_PCF3_32F,
    shadowBias: 0.3, normalOffsetBias: 0.05,
  });
  {
    const down = new Vec3(0, -1, 0), to = new Vec3(...MOON_DIR).normalize().mulScalar(-1);
    const axis = new Vec3().cross(down, to).normalize();
    moon.setRotation(new Quat().setFromAxisAngle(axis, Math.acos(down.dot(to)) / D2R));
  }
  root.addChild(moon);
  app.scene.ambientLight = new Color(...AMBIENT_CALM);
  app.scene.fog.type = FOG_EXP2;
  app.scene.fog.color = new Color(...FOG_CALM.color);
  app.scene.fog.density = FOG_CALM.density;

  // Warm street lamps: real lights on some (a phone can afford a handful), all glow.
  const lamps = [];
  const maxLights = lowFx ? 4 : 10;
  for (const s of lampSpots) {
    if (!s.real || lamps.length >= maxLights) continue;
    const e = new Entity('lamp-light');
    e.addComponent('light', { type: 'omni', color: new Color(1, 0.68, 0.32), intensity: 1.8, range: 9, castShadows: false });
    e.setLocalPosition(...s.at);
    root.addChild(e);
    lamps.push({ e, base: 1.8, phase: Math.random() * 10 });
  }

  const sky = createSky(app, tex, MOON_DIR);
  root.addChild(sky.root);

  // Every lamp glows into the mist: a warm halo turned to the camera.
  const haloMat = new StandardMaterial();
  haloMat.useLighting = false; haloMat.useSkybox = false; haloMat.useFog = false;
  haloMat.diffuse = new Color(0, 0, 0);
  haloMat.emissive = new Color(1, 0.62, 0.3);
  haloMat.emissiveMap = tex.glow; haloMat.opacityMap = tex.glow; haloMat.opacityMapChannel = 'a';
  haloMat.opacity = 0.42;
  haloMat.blendType = BLEND_ADDITIVEALPHA; haloMat.depthWrite = false; haloMat.cull = CULLFACE_NONE;
  haloMat.update();
  const haloGeo = new Geo().add(flat([[-1, -1], [1, -1], [1, 1], [-1, 1]]), null, [1, 1, 1]);
  const halos = lampSpots.map((sp) => {
    const e = haloGeo.build(app.graphicsDevice, haloMat, 'lamp-halo');
    e.render.castShadows = false;
    e.setLocalPosition(...sp.at);
    root.addChild(e);
    return { e, at: sp.at };
  });

  let madness = 0, time = 0, storm = 0, flash = 0;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  return {
    root,
    houses,
    clock,
    materials,
    sky,
    lamps,
    /** Door swing for house i, 0 (shut) .. 1 (wide open). */
    setDoor(i, k) {
      const h = houses[i];
      h.open = k;
      h.hinge.setLocalEulerAngles(0, -105 * k * (2 - k), 0);
    },
    /** Porch lamp: gold when the house can be visited, a sulky violet while it cools down. */
    setHouseReady(i, ready, pulse = 0) {
      const m = houses[i].lampMat;
      if (ready) m.emissive.set(1, 0.72 + 0.1 * pulse, 0.32);
      else m.emissive.set(0.32, 0.18, 0.55);
      m.emissiveIntensity = ready ? 2.2 + pulse : 1.2;
      m.update();
    },
    /** Clock hands: from 11:57 to midnight over the round (k = 0 .. 1). */
    setClock(k) {
      const minute = 342 + 18 * Math.max(0, Math.min(1, k)), hour = 358.5 + 1.5 * k;
      for (const h of clock.hands) { h.minute.setLocalEulerAngles(0, 0, -minute); h.hour.setLocalEulerAngles(0, 0, -hour); }
    },
    setMadness(k) {
      madness = k;
      moon.light.color = new Color(...lerp(MOON_CALM, MOON_MAD, k));
      sky.setMadness(k);
    },
    /** A candy storm overhead (k 0..1): darker, mistier. */
    setStorm(k) { storm = k; },
    /** A lightning strike, `k` its brightness here (by distance). */
    lightning(k) { flash = Math.max(flash, k); },
    update(dt, camera) {
      time += dt;
      // Fog and ambient light: calm → madness, darkened by a storm, lit up white-violet by lightning.
      flash = Math.max(0, flash - dt * 4);
      const fl = flash * (0.7 + 0.3 * Math.sin(time * 60));
      const fogC = lerp(lerp(FOG_CALM.color, FOG_MAD.color, madness), [0.07, 0.06, 0.11], storm * 0.6);
      app.scene.fog.color.set(...fogC.map((v, i) => v + fl * [0.5, 0.48, 0.65][i]));
      app.scene.fog.density = FOG_CALM.density + (FOG_MAD.density - FOG_CALM.density) * madness + 0.006 * storm;
      app.scene.ambientLight.set(...lerp(AMBIENT_CALM, AMBIENT_MAD, madness).map((v, i) => v * (1 - 0.3 * storm) + fl * [0.9, 0.85, 1.2][i]));
      moon.light.intensity = 0.95 * (1 - 0.35 * storm) + fl * 3;
      sky.update(camera);
      const c = camera.getPosition();
      const m = madness;
      heightFog.update(time, {
        ground: FOG_CALM.ground + (FOG_MAD.ground - FOG_CALM.ground) * m,
        falloff: FOG_CALM.falloff + (FOG_MAD.falloff - FOG_CALM.falloff) * m,
        color: lerp(FOG_CALM.mist, FOG_MAD.mist, m),
      });
      const flick = madness > 0 ? 0.75 + 0.25 * Math.sin(time * 19) : 0.92 + 0.08 * Math.sin(time * 2.3);
      for (const h of halos) {
        // a soft glow at a distance, shrinking away as the camera comes close (no orange blotches)
        const d = Math.hypot(c.x - h.at[0], c.y - h.at[1], c.z - h.at[2]), k = 1.15 * Math.max(0.25, Math.min(1, (d - 1.5) / 5));
        h.e.setLocalScale(k, k, k);
        h.e.lookAt(c); h.e.rotateLocal(0, 180, 0);
      }
      haloMat.opacity = 0.42 * flick * (1 + 0.4 * madness);
      haloMat.update();
      for (const l of lamps) {
        const flick = madness > 0 ? (Math.sin(time * 23 + l.phase) * 0.5 + Math.sin(time * 7.3 + l.phase * 2) * 0.5) * 0.6 * madness : Math.sin(time * 2 + l.phase) * 0.08;
        l.e.light.intensity = l.base * (1 + 0.7 * madness) + flick;
        if (madness > 0) l.e.light.color.set(1, 0.68 - 0.25 * madness, 0.32 + 0.1 * madness);
      }
      materials.glow.emissiveIntensity = 1.6 + madness * (0.6 + 0.6 * Math.sin(time * 9));
      materials.glow.update();
    },
  };
}
