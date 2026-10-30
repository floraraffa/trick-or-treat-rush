// Reference rounds for the Meta Quest version's C# port of the rules: the authority plays a whole round with
// scripted players (a test harness, never players in a game) and every event and every fifth snapshot is
// written down in a canonical form (keys sorted, numbers to 4 decimals). The Quest repo's tools/check plays
// the same rounds with the same script on its C# authority and must write the very same lines.
//
// The script, step by step (tools/check/Trace.cs there is the same, line by line): a giant or a candy thief
// hunts the nearest monster; else a chaser within 3.5 m → run from it (and boo, with the skill); else a door
// ready within 8 m → go and knock; else a gem within 12 m; else the nearest candy on the ground, else the
// nearest orb or gem, else the plaza. 4.2 m/s, 6 when chased, sliding on the walls.
// Anything within reach is picked up, a held power-up used at once.
import { Authority } from '../../src/game/authority.js';
import { DOOR_RANGE, HOUSES, PLAYER_R, SPAWNS } from '../../src/world/layout.js';
import { GEM_R, ORB_R, PICKUP_R } from '../../src/game/config.js';
import { slide } from '../../src/world/collide.js';

export const SCENARIOS = [
  { name: 'easy-1p', seed: 11, level: 'easy', players: 1 },
  { name: 'medium-3p', seed: 22, level: 'medium', players: 3, drop: 1500 },
  { name: 'hard-2p', seed: 33, level: 'hard', players: 2 },
  ...Array.from({ length: 8 }, (_, n) => ({ name: `night${n + 1}`, seed: 100 + n, night: n, players: 1 })),
  { name: 'night3-table', seed: 7, night: 2, players: 1, candyMul: 1.5 },
  { name: 'night6-2p', seed: 9, night: 5, players: 2 },
];

/** A number as both languages write it: 4 decimals, no trailing zeros, no -0. */
export const fmt = (v) => {
  if (v === Infinity) return 'inf';
  if (v === -Infinity) return '-inf';
  const r = +v.toFixed(4);
  return Object.is(r, -0) ? '0' : String(r);
};
export function canon(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return fmt(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => canon(x) ?? 'null').join(',')}]`;
  const keys = Object.keys(v).filter((k) => v[k] !== null && v[k] !== undefined).sort();
  return `{${keys.map((k) => `${k}:${canon(v[k])}`).join(',')}}`;
}

const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

function drive(A, b, dt) {
  const rt = A.rt;
  if (A.phase !== 'playing') { A.setPose(b.id, b.x, b.z); return; }
  let chaser = null, cd = 3.5;
  for (const m of A.monsters) {
    if (m.state !== 'chase' || m.target !== b.id) continue;
    const d = dist(m.x, m.z, b.x, b.z);
    if (d < cd) { cd = d; chaser = m; }
  }
  let tx = 0, tz = 0, speed = 4.2;
  const p = A.players.get(b.id), hunt = p.fx.giant > rt || p.fx.thief > rt;
  if (hunt) {
    let best = Infinity;
    for (const m of A.monsters) {
      if (m.state === 'banished') continue;
      const d = dist(m.x, m.z, b.x, b.z);
      if (d < best) { best = d; tx = m.x; tz = m.z; }
    }
  } else if (chaser) { tx = b.x + (b.x - chaser.x); tz = b.z + (b.z - chaser.z); speed = 6; }
  else {
    let best = Infinity, found = false;
    HOUSES.forEach((h, i) => {
      if (A.houses[i].until > rt) return;
      const d = dist(h.door.x, h.door.z, b.x, b.z);
      if (d < 8 && d < best) { best = d; tx = h.door.x; tz = h.door.z; found = true; }
    });
    if (!found) {
      for (const g of A.gems.values()) {
        const d = dist(g.x, g.z, b.x, b.z);
        if (d < 12 && d < best) { best = d; tx = g.x; tz = g.z; found = true; }
      }
    }
    if (!found) {
      for (const c of A.candies.values()) {
        if (c.land > rt) continue;
        const d = dist(c.x, c.z, b.x, b.z);
        if (d < best) { best = d; tx = c.x; tz = c.z; found = true; }
      }
    }
    if (!found) {
      for (const o of [...A.orbs.values(), ...A.gems.values()]) {
        const d = dist(o.x, o.z, b.x, b.z);
        if (d < best) { best = d; tx = o.x; tz = o.z; found = true; }
      }
    }
  }
  const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
  if (d > 1e-4) {
    const s = Math.min(d, speed * dt);
    [b.x, b.z] = slide(b.x + (dx / d) * s, b.z + (dz / d) * s, PLAYER_R);
  }
  A.setPose(b.id, b.x, b.z);
  for (const c of [...A.candies.values()]) if (dist(c.x, c.z, b.x, b.z) <= PICKUP_R) A.intent(b.id, { kind: 'pickup', id: c.id });
  for (const o of [...A.orbs.values()]) if (dist(o.x, o.z, b.x, b.z) <= ORB_R) A.intent(b.id, { kind: 'orb', id: o.id });
  for (const g of [...A.gems.values()]) if (dist(g.x, g.z, b.x, b.z) <= GEM_R) A.intent(b.id, { kind: 'gem', id: g.id });
  if (p.held) A.intent(b.id, { kind: 'use' });
  HOUSES.forEach((h, i) => { if (A.houses[i].until <= A.rt && dist(h.door.x, h.door.z, b.x, b.z) < DOOR_RANGE) A.intent(b.id, { kind: 'knock', house: i }); });
  if (chaser && A.skills.has('boo')) A.intent(b.id, { kind: 'boo' });
}

/** One reference round: its lines (events "E …", every fifth snapshot "S …"). */
export function runTrace({ seed, level = 'medium', night = null, players = 1, candyMul = 1, drop = null }) {
  const lines = [];
  let snaps = 0;
  const A = new Authority({ emit: (ev) => lines.push(`E ${canon(ev)}`), snapshot: (s) => { if (snaps++ % 5 === 0) lines.push(`S ${canon(s)}`); }, seed });
  const roster = Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, costume: ['witch', 'pumpkin', 'horns', 'cape'][i] }));
  A.start(roster, level, { night, candyMul });
  const bots = roster.map((r, i) => ({ id: r.id, x: SPAWNS[i].x, z: SPAWNS[i].z }));
  const dt = 0.05;
  for (let k = 0; k < 4000 && A.phase !== 'over'; k++) {
    if (k === drop) A.drop(bots[bots.length - 1].id); // (the last one leaves the room: it stops there)
    for (const b of bots) if (!(drop !== null && k >= drop && b === bots[bots.length - 1])) drive(A, b, dt);
    A.tick(dt);
  }
  return lines;
}
