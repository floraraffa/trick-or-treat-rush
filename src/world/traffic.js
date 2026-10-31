// The cyberpunk city's flying traffic (themes.js `traffic`): cars, taxis and police cars streaming round the
// village in lanes stacked in the air, as pure data and maths, so the phone game (hoods.js createTraffic) and the
// Spectacles Lens (its Generated/traffic.ts) move them alike. Only for the look: no rule knows of them.
//
// A lane is a loop round the plaza: radius r (m, wavering by `wob` three times round), height y, speed (m/s), its
// direction. They keep clear of the village: over the ring street under the roofs (7 and 9.5 m), over the plaza's
// trees, between the houses and the far towers, and high over the rooftops.
export const LANES = [
  { r: 16, y: 7, speed: 9, dir: 1, wob: 0.03 },
  { r: 16, y: 9.5, speed: 11, dir: -1, wob: 0.03 },
  { r: 12.4, y: 12, speed: 8, dir: 1, wob: 0.02 },
  { r: 31, y: 13, speed: 13, dir: -1, wob: 0.02 },
  { r: 24, y: 29, speed: 15, dir: 1, wob: 0.05 },
];

/** The fleet: what each vehicle is (car: its paint, 0..2), its lane, and where on it it starts (radians). */
export const FLEET = [
  { kind: 'taxi', lane: 0, at: 0 }, { kind: 'car', paint: 0, lane: 0, at: 1.6 }, { kind: 'police', lane: 0, at: 3.3 }, { kind: 'car', paint: 1, lane: 0, at: 4.7 },
  { kind: 'car', paint: 2, lane: 1, at: 0.8 }, { kind: 'taxi', lane: 1, at: 2.9 }, { kind: 'car', paint: 0, lane: 1, at: 5.1 },
  { kind: 'taxi', lane: 2, at: 1.2 }, { kind: 'car', paint: 1, lane: 2, at: 4.3 },
  { kind: 'police', lane: 3, at: 0.4 }, { kind: 'car', paint: 2, lane: 3, at: 2.5 }, { kind: 'taxi', lane: 3, at: 4.6 },
  { kind: 'car', paint: 0, lane: 4, at: 1.9 }, { kind: 'police', lane: 4, at: 3.6 }, { kind: 'taxi', lane: 4, at: 5.6 },
];
/** Fewer when the phone asks for low effects (`lowFx`). */
export const FLEET_LITE = FLEET.filter((_, i) => i % 2 === 0);

/** The police lights' beat: red and blue take turns this many times a second. */
export const POLICE_FLASH = 3.5;

const R2D = 180 / Math.PI;
const laneAt = (L, a) => {
  const r = L.r * (1 + L.wob * Math.sin(3 * a));
  return [Math.cos(a) * r, Math.sin(a) * r];
};

/**
 * Where vehicle `v` is at time `t` (s): game metres, and its heading (`yaw`, degrees, the game's: 0 faces +Z) and
 * bank (degrees, leaning into the curve).
 */
export function vehiclePose(v, t) {
  const L = LANES[v.lane];
  const a = v.at + (L.dir * L.speed * t) / L.r;
  const [x, z] = laneAt(L, a), [nx, nz] = laneAt(L, a + 0.02 * L.dir);
  const y = L.y + 0.35 * Math.sin(t * 1.3 + v.at * 5); // (a gentle bob)
  return { x, y, z, yaw: Math.atan2(nx - x, nz - z) * R2D, bank: -L.dir * 9 };
}

/** Whether a police car's red light (else its blue one) is on at time `t`. */
export const policeRed = (t, v = { at: 0 }) => Math.floor(t * POLICE_FLASH * 2 + v.at * 3) % 2 === 0;
