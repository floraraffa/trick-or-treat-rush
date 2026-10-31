// The neighbourhoods: every night of the campaign happens in a different one, the same village plan (layout.js:
// the houses, doors, streets, colliders, candy spots and patrols, so the rules never change) dressed in its own
// look, still crooked and Burton-like. Only how things are drawn changes: the palette and the houses' style
// (walls, roofs, balconies, signs...), the trees, the lamps, the landmark in the plaza, the ground and streets, the
// sky, the fog, the light, and a few things of their own. Everything is built from code and vertex colours: no
// new textures or models, so the Lens doesn't grow (the 8 MB of a Web Lens).
//
//   classic       the original haunted village (the levels' rounds, rooms without a night, the viewer)
//   italy         a Little Italy: ochre and terracotta, campanile-like towers, cypresses, laundry lines, Pisa
//   france        Paris: limestone and zinc mansards, café awnings, plane trees, Paris lamps, the Eiffel Tower
//   newyork       New York: brownstones, fire escapes, water towers, cobra lights, a skyline, an Art Deco tower
//   buenosaires   Buenos Aires: La Boca's painted sheet-metal houses, fileteado signs, jacarandas, the Obelisco
//   modeltown     the model town in the attic: black-and-white stripes, neon signs, giant rafters, striped worms
//   northpole     the North Pole: snow, chalets with icicles and lights, firs, candy canes, the northern lights
//   transylvania  Transylvania: stone, red windows, very tall spires, torches, a castle keep, a blood-red sky
//   moon          the Moon: domes and portholes, antennas, craters, a rocket, the Earth in a black sky
const C = (r, g, b) => [r, g, b];

const CLASSIC = {
  name: 'classic',
  sky: { horizon: C(0.36, 0.22, 0.38), mid: C(0.11, 0.12, 0.24), zenith: C(0.02, 0.025, 0.07), stars: 520, moon: 'moon', moonSize: 26, halo: C(0.45, 0.5, 0.75) },
  fog: {
    calm: { color: C(0.12, 0.1, 0.2), density: 0.012, ground: 0.05, falloff: 0.5, mist: C(0.5, 0.5, 0.66) },
    mad: { color: C(0.19, 0.08, 0.16), density: 0.016, ground: 0.075, falloff: 0.42, mist: C(0.48, 0.4, 0.55) },
  },
  ambient: [C(0.2, 0.18, 0.32), C(0.26, 0.14, 0.24)],
  moonLight: [C(0.62, 0.7, 1), C(1, 0.48, 0.42)],
  lampColor: C(1, 0.68, 0.32),
  ground: { key: 'ground', a: C(0.36, 0.42, 0.3), b: C(0.46, 0.56, 0.36), patch: C(0.4, 0.32, 0.46) },
  streets: { key: 'cobble', kerb: C(0.24, 0.22, 0.28), road: C(0.48, 0.45, 0.54), radial: C(0.46, 0.43, 0.52), path: C(0.55, 0.45, 0.42), line: null },
  plaza: { key: 'stone', color: C(0.6, 0.56, 0.66), edge: C(0.36, 0.32, 0.4) },
  house: { style: 'classic' },
  trees: 'twisted', woods: 'twisted', lamp: 'crook', landmark: 'clock', skyline: 'hills',
};

/** A theme: the classic look with these changes (nested objects merged one level down). */
const theme = (name, changes) => {
  const t = { ...CLASSIC, ...changes, name };
  for (const k of ['sky', 'ground', 'streets', 'plaza', 'house']) t[k] = { ...CLASSIC[k], ...(changes[k] ?? {}) };
  t.fog = { calm: { ...CLASSIC.fog.calm, ...(changes.fog?.calm ?? {}) }, mad: { ...CLASSIC.fog.mad, ...(changes.fog?.mad ?? {}) } };
  return t;
};

export const THEMES = {
  classic: CLASSIC,
  italy: theme('italy', {
    sky: { horizon: C(0.5, 0.27, 0.3), mid: C(0.14, 0.11, 0.24), zenith: C(0.03, 0.025, 0.07) },
    fog: { calm: { color: C(0.16, 0.1, 0.14), density: 0.009, ground: 0.04, mist: C(0.62, 0.5, 0.52) } },
    ambient: [C(0.26, 0.2, 0.28), C(0.3, 0.14, 0.22)],
    moonLight: [C(0.8, 0.72, 0.9), C(1, 0.48, 0.42)],
    lampColor: C(1, 0.66, 0.3),
    ground: { a: C(0.42, 0.4, 0.24), b: C(0.52, 0.48, 0.28), patch: C(0.55, 0.38, 0.26) },
    streets: { kerb: C(0.3, 0.24, 0.22), road: C(0.6, 0.5, 0.42), radial: C(0.58, 0.48, 0.4), path: C(0.66, 0.52, 0.38) },
    plaza: { color: C(0.78, 0.7, 0.58), edge: C(0.5, 0.38, 0.3) },
    house: {
      style: 'italy', wallKey: 'masonry', roof: 'hip', towerRoof: 'campanile', shutters: C(0.2, 0.42, 0.28), balconies: true, flowers: true,
      walls: [C(0.8, 0.54, 0.28), C(0.74, 0.37, 0.24), C(0.84, 0.56, 0.5), C(0.86, 0.68, 0.32), C(0.62, 0.32, 0.2), C(0.88, 0.8, 0.62), C(0.9, 0.78, 0.46), C(0.85, 0.46, 0.36)],
      trims: [C(0.92, 0.86, 0.76)], roofs: [C(0.66, 0.28, 0.17), C(0.6, 0.24, 0.15), C(0.7, 0.33, 0.2)], doors: [C(0.18, 0.32, 0.22), C(0.36, 0.2, 0.12), C(0.15, 0.25, 0.4)],
    },
    trees: 'cypress', woods: 'cypress', lamp: 'lantern', landmark: 'pisa', skyline: 'tuscany',
  }),
  france: theme('france', {
    sky: { horizon: C(0.32, 0.26, 0.48), mid: C(0.1, 0.11, 0.27), zenith: C(0.02, 0.025, 0.08) },
    fog: { calm: { color: C(0.11, 0.11, 0.2), density: 0.011, mist: C(0.52, 0.55, 0.7) } },
    ambient: [C(0.2, 0.2, 0.32), C(0.26, 0.14, 0.24)],
    lampColor: C(1, 0.8, 0.55),
    ground: { a: C(0.3, 0.42, 0.28), b: C(0.38, 0.52, 0.32), patch: C(0.36, 0.34, 0.44) },
    streets: { kerb: C(0.22, 0.22, 0.26), road: C(0.46, 0.46, 0.52), radial: C(0.5, 0.5, 0.56), path: C(0.62, 0.56, 0.46) },
    plaza: { color: C(0.7, 0.66, 0.6), edge: C(0.4, 0.38, 0.42) },
    house: {
      style: 'france', wallKey: 'masonry', roof: 'mansard', towerRoof: 'dome', shutters: C(0.5, 0.58, 0.66), balconies: true, awnings: true,
      walls: [C(0.84, 0.78, 0.64), C(0.8, 0.74, 0.6), C(0.86, 0.8, 0.68), C(0.78, 0.72, 0.6), C(0.82, 0.76, 0.66), C(0.76, 0.7, 0.58), C(0.86, 0.82, 0.7), C(0.8, 0.75, 0.62)],
      trims: [C(0.92, 0.88, 0.8)], roofs: [C(0.36, 0.42, 0.5), C(0.32, 0.38, 0.46), C(0.4, 0.45, 0.52)], doors: [C(0.1, 0.28, 0.2), C(0.38, 0.08, 0.12), C(0.08, 0.12, 0.3), C(0.06, 0.06, 0.08)],
    },
    trees: 'plane', woods: 'plane', lamp: 'paris', landmark: 'eiffel', skyline: 'paris',
  }),
  newyork: theme('newyork', {
    sky: { horizon: C(0.46, 0.27, 0.2), mid: C(0.14, 0.11, 0.18), zenith: C(0.03, 0.03, 0.07), stars: 160 },
    fog: { calm: { color: C(0.15, 0.11, 0.12), density: 0.011, mist: C(0.55, 0.48, 0.48) } },
    ambient: [C(0.24, 0.2, 0.26), C(0.28, 0.14, 0.22)],
    moonLight: [C(0.7, 0.72, 0.9), C(1, 0.48, 0.42)],
    lampColor: C(1, 0.6, 0.25),
    ground: { key: 'dirt', a: C(0.3, 0.32, 0.26), b: C(0.36, 0.4, 0.3), patch: C(0.3, 0.28, 0.3) },
    streets: { key: 'asphalt', kerb: C(0.5, 0.5, 0.52), road: C(0.17, 0.17, 0.19), radial: C(0.19, 0.19, 0.21), path: C(0.52, 0.52, 0.54), line: C(0.95, 0.75, 0.15) },
    plaza: { color: C(0.52, 0.52, 0.55), edge: C(0.3, 0.3, 0.33) },
    house: {
      style: 'newyork', wallKey: 'masonry', roof: 'flat', towerRoof: 'flat', fireEscapes: true, waterTowers: true,
      walls: [C(0.48, 0.24, 0.18), C(0.42, 0.27, 0.21), C(0.55, 0.3, 0.22), C(0.38, 0.22, 0.18), C(0.5, 0.34, 0.26), C(0.44, 0.2, 0.16), C(0.56, 0.36, 0.28), C(0.4, 0.3, 0.26)],
      trims: [C(0.62, 0.56, 0.48), C(0.16, 0.15, 0.16)], roofs: [C(0.2, 0.19, 0.2)], doors: [C(0.1, 0.08, 0.06), C(0.2, 0.08, 0.06), C(0.06, 0.12, 0.08)],
    },
    trees: 'street', woods: 'street', lamp: 'cobra', landmark: 'empire', skyline: 'skyline',
  }),
  buenosaires: theme('buenosaires', {
    sky: { horizon: C(0.42, 0.28, 0.36), mid: C(0.11, 0.12, 0.26), zenith: C(0.02, 0.03, 0.08) },
    fog: { calm: { color: C(0.12, 0.11, 0.18), density: 0.01, mist: C(0.55, 0.52, 0.65) } },
    ambient: [C(0.24, 0.21, 0.32), C(0.28, 0.14, 0.24)],
    lampColor: C(1, 0.72, 0.4),
    ground: { a: C(0.34, 0.42, 0.28), b: C(0.42, 0.52, 0.32), patch: C(0.44, 0.36, 0.5) },
    streets: { kerb: C(0.24, 0.24, 0.28), road: C(0.42, 0.4, 0.44), radial: C(0.44, 0.42, 0.46), path: C(0.56, 0.46, 0.4) },
    plaza: { color: C(0.62, 0.6, 0.64), edge: C(0.34, 0.32, 0.38) },
    house: {
      style: 'buenosaires', wallKey: 'wood', roof: 'flat', towerRoof: 'flat', floorColors: true, balconies: true, signs: true,
      walls: [C(0.85, 0.2, 0.2), C(0.95, 0.75, 0.15), C(0.15, 0.45, 0.8), C(0.2, 0.62, 0.35), C(0.92, 0.5, 0.15), C(0.6, 0.3, 0.7), C(0.95, 0.9, 0.82), C(0.2, 0.68, 0.74)],
      trims: [C(0.95, 0.92, 0.85), C(0.15, 0.4, 0.75)], roofs: [C(0.55, 0.22, 0.18), C(0.3, 0.32, 0.36)], doors: [C(0.6, 0.12, 0.1), C(0.12, 0.3, 0.6), C(0.15, 0.45, 0.22)],
    },
    trees: 'jacaranda', woods: 'twisted', lamp: 'farol', landmark: 'obelisco', skyline: 'porteno',
  }),
  modeltown: theme('modeltown', {
    sky: { horizon: C(0.24, 0.17, 0.14), mid: C(0.1, 0.08, 0.1), zenith: C(0.04, 0.03, 0.05), stars: 0, moon: 'bulb', moonSize: 18, halo: C(1, 0.9, 0.6) },
    fog: { calm: { color: C(0.1, 0.1, 0.11), density: 0.009, ground: 0.04, mist: C(0.56, 0.55, 0.6) }, mad: { color: C(0.2, 0.1, 0.2) } },
    ambient: [C(0.26, 0.26, 0.27), C(0.3, 0.16, 0.28)],
    moonLight: [C(1, 0.94, 0.82), C(0.8, 0.5, 1)],
    lampColor: C(0.85, 0.82, 1),
    ground: { key: 'plainGround', a: C(0.32, 0.52, 0.22), b: C(0.4, 0.62, 0.26), patch: C(0.3, 0.46, 0.2) }, // (the model's grass mat)
    streets: { key: 'plain', kerb: C(0.08, 0.08, 0.08), road: C(0.75, 0.75, 0.72), radial: C(0.7, 0.7, 0.68), path: C(0.45, 0.32, 0.22), stripes: true },
    plaza: { key: 'plain', color: C(0.85, 0.85, 0.82), edge: C(0.08, 0.08, 0.08), checker: true },
    house: {
      style: 'modeltown', wallKey: 'plain', roof: 'spire', stripes: true, neon: true,
      walls: [C(0.92, 0.92, 0.88)], trims: [C(0.06, 0.06, 0.06)], roofs: [C(0.08, 0.08, 0.08), C(0.32, 0.18, 0.42)], doors: [C(0.4, 0.75, 0.25), C(0.5, 0.2, 0.65), C(0.9, 0.45, 0.1)],
      windows: C(0.6, 1, 0.5),
    },
    trees: 'striped', woods: 'striped', lamp: 'neon', landmark: 'striped', skyline: 'attic',
  }),
  northpole: theme('northpole', {
    sky: { horizon: C(0.1, 0.24, 0.34), mid: C(0.04, 0.09, 0.2), zenith: C(0.01, 0.015, 0.05), stars: 700, moonSize: 18, aurora: true },
    fog: { calm: { color: C(0.12, 0.16, 0.24), density: 0.009, ground: 0.045, mist: C(0.72, 0.8, 0.92) }, mad: { color: C(0.2, 0.1, 0.18) } },
    ambient: [C(0.3, 0.34, 0.44), C(0.32, 0.18, 0.28)],
    moonLight: [C(0.72, 0.85, 1), C(1, 0.5, 0.5)],
    lampColor: C(1, 0.74, 0.42),
    ground: { key: 'snowfield', a: C(0.82, 0.87, 0.96), b: C(0.9, 0.94, 1), patch: C(0.74, 0.82, 0.94) },
    streets: { key: 'snow', kerb: C(0.6, 0.66, 0.78), road: C(0.72, 0.78, 0.88), radial: C(0.74, 0.8, 0.9), path: C(0.8, 0.84, 0.92) },
    plaza: { key: 'ice', color: C(0.72, 0.84, 0.95), edge: C(0.55, 0.64, 0.78) },
    house: {
      style: 'northpole', wallKey: 'wood', roof: 'gable', snow: true, icicles: true, lights: true, wreaths: true,
      walls: [C(0.6, 0.14, 0.12), C(0.14, 0.38, 0.24), C(0.45, 0.3, 0.2), C(0.75, 0.2, 0.16), C(0.2, 0.3, 0.45), C(0.5, 0.36, 0.24), C(0.16, 0.44, 0.3), C(0.62, 0.22, 0.2)],
      trims: [C(0.95, 0.95, 0.95)], roofs: [C(0.22, 0.14, 0.12), C(0.15, 0.2, 0.18)], doors: [C(0.7, 0.12, 0.1), C(0.12, 0.35, 0.2)],
    },
    trees: 'pine', woods: 'pine', lamp: 'cane', landmark: 'pole', skyline: 'icebergs', snowfall: true,
  }),
  transylvania: theme('transylvania', {
    sky: { horizon: C(0.44, 0.12, 0.16), mid: C(0.13, 0.06, 0.14), zenith: C(0.02, 0.01, 0.05), moonSize: 40, halo: C(0.7, 0.4, 0.45) },
    fog: { calm: { color: C(0.14, 0.07, 0.12), density: 0.014, ground: 0.065, falloff: 0.45, mist: C(0.46, 0.38, 0.46) } },
    ambient: [C(0.2, 0.14, 0.22), C(0.28, 0.1, 0.18)],
    moonLight: [C(0.9, 0.75, 0.8), C(1, 0.4, 0.36)],
    lampColor: C(1, 0.5, 0.2),
    ground: { a: C(0.26, 0.28, 0.24), b: C(0.32, 0.34, 0.28), patch: C(0.34, 0.24, 0.3) },
    streets: { kerb: C(0.18, 0.16, 0.2), road: C(0.38, 0.35, 0.4), radial: C(0.36, 0.33, 0.38), path: C(0.4, 0.32, 0.3) },
    plaza: { color: C(0.42, 0.4, 0.46), edge: C(0.24, 0.22, 0.28) },
    house: {
      style: 'transylvania', wallKey: 'masonry', roof: 'spire', tall: 1.5, battlements: true, gargoyles: true,
      walls: [C(0.42, 0.4, 0.44), C(0.36, 0.34, 0.38), C(0.46, 0.42, 0.44), C(0.34, 0.32, 0.36), C(0.4, 0.36, 0.38), C(0.44, 0.42, 0.46)],
      trims: [C(0.12, 0.1, 0.12)], roofs: [C(0.1, 0.08, 0.12), C(0.16, 0.06, 0.1)], doors: [C(0.3, 0.05, 0.06), C(0.12, 0.08, 0.06)],
      windows: C(1, 0.32, 0.22),
    },
    trees: 'dead', woods: 'dead', lamp: 'torch', landmark: 'keep', skyline: 'carpathians',
  }),
  moon: theme('moon', {
    sky: { horizon: C(0.03, 0.03, 0.06), mid: C(0.01, 0.01, 0.03), zenith: C(0, 0, 0.01), stars: 1400, moon: 'earth', moonSize: 30, halo: C(0.3, 0.45, 0.8) },
    fog: { calm: { color: C(0.03, 0.03, 0.05), density: 0.004, ground: 0.006, falloff: 0.8, mist: C(0.5, 0.52, 0.6) }, mad: { color: C(0.12, 0.03, 0.05), density: 0.008, ground: 0.02 } },
    ambient: [C(0.22, 0.24, 0.3), C(0.28, 0.12, 0.16)],
    moonLight: [C(0.85, 0.9, 1), C(1, 0.45, 0.4)],
    lampColor: C(0.55, 0.85, 1),
    ground: { key: 'regolith', a: C(0.5, 0.5, 0.52), b: C(0.6, 0.6, 0.62), patch: C(0.42, 0.42, 0.45), craters: true },
    streets: { key: 'plain', kerb: C(0.3, 0.3, 0.34), road: C(0.62, 0.62, 0.66), radial: C(0.6, 0.6, 0.64), path: C(0.66, 0.66, 0.7) },
    plaza: { key: 'glossy', color: C(0.55, 0.58, 0.64), edge: C(0.25, 0.26, 0.3) },
    house: {
      style: 'moon', wallKey: 'plain', roof: 'dome', towerRoof: 'dome', antennas: true, portholes: true,
      walls: [C(0.86, 0.86, 0.88), C(0.8, 0.82, 0.86), C(0.9, 0.88, 0.84), C(0.78, 0.8, 0.84)],
      trims: [C(0.92, 0.5, 0.15), C(0.3, 0.32, 0.38)], roofs: [C(0.5, 0.62, 0.78), C(0.6, 0.66, 0.74)], doors: [C(0.25, 0.27, 0.32), C(0.9, 0.5, 0.15)],
      windows: C(0.55, 0.9, 1),
    },
    trees: 'rock', woods: 'rock', lamp: 'mast', landmark: 'rocket', skyline: 'craters',
  }),
};

/**
 * The Spectacles Lens: its neighbourhood models carry no images (their budget); their meshes wear the base
 * village's textured materials, matched by the key in the mesh's name, these keys through the material they take.
 */
export const HOOD_MATERIAL = { plainGround: 'plain', snowfield: 'plain', snow: 'plain', ice: 'glossy', asphalt: 'dirt', regolith: 'rock', neon: 'emit' };

/** The neighbourhood of night n (0-based) of the campaign, in its order; the classic village without a night. */
export const NIGHT_THEMES = ['italy', 'france', 'newyork', 'buenosaires', 'modeltown', 'northpole', 'transylvania', 'moon'];
export const themeOfNight = (n) => (Number.isInteger(n) && NIGHT_THEMES[n]) || 'classic';
