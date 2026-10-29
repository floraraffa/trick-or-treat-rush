// Plays every night of the Lens's campaign with a simulated player, on the real authority (no rendering), to
// see how much candy a night yields: the stars in config.js NIGHTS are set from it.
//   node tools/calibrate-nights.mjs [seeds = 16]
// Two players. A capable one runs (on its own, keeping one way), goes for the best candy near it, knocks
// on ready doors on the way, picks up orbs and gems, uses its powers at once, boos and dodges what chases it,
// and otherwise runs away from a monster closing in. A casual one goes at two thirds of that pace, makes up its
// mind every few seconds, notices a monster late and boos late. Walls stop both as they stop the Bitmoji.
// The stars: one for a little over half a casual player's poor night (its lower quarter: a first try on the
// glasses, pointing and pinching, should earn one and open the next night), two for its usual night (median),
// three for nine tenths of a capable player's ordinary night (a little under its median). Simulated players
// aren't people: tune them after playing (the suggestion is printed, NIGHTS keeps what was chosen).
import { Authority } from '../src/game/authority.js';
import * as C from '../src/game/config.js';
import { DOOR_RANGE, HOUSES, MAP_R, PLAYER_R } from '../src/world/layout.js';
import { slide } from '../src/world/collide.js';

const SEEDS = +(process.argv[2] ?? 16), DT = 0.1;
const PLAYERS = {
  capable: { pace: 1, think: 0, see: 4.5, boo: 4, reach: 3 },
  casual: { pace: 0.65, think: 3, see: 3, boo: 2.5, reach: 2 },
};

function playNight(n, seed, P) {
  const A = new Authority({ emit: () => {}, snapshot: () => {}, seed });
  A.start([{ id: 'me', name: 'Bot', costume: 'none' }], C.DEFAULT_LEVEL, { night: n, candyMul: 1.5 });
  const me = A.players.get('me'), skills = A.skills;
  let think = 0, x = me.x, z = me.z, goal = null, stuck = 0, lastD = Infinity, fleeT = 0, fleeDir = [0, 0], dodge = 0, dodgeAt = -9, dodgeDir = [0, 0], run = 0;
  const T = A.seconds + C.COUNTDOWN + 0.5;
  for (let t = 0; t < T && A.phase !== 'over'; t += DT) {
    A.setPose('me', x, z);
    A.tick(DT);
    if (A.phase !== 'playing') continue;
    const rt = A.rt;
    // what's after it
    let threat = null, td = Infinity;
    for (const m of A.monsters) {
      if (m.state !== 'chase' || m.target !== 'me') continue;
      const d = Math.hypot(m.x - x, m.z - z);
      if (d < td) { td = d; threat = m; }
    }
    if (me.held) A.intent('me', { kind: 'use' });
    if (threat && td < P.boo && skills.has('boo') && !(me.booAt > rt)) A.intent('me', { kind: 'boo' });
    if (threat && td < C.SKILL.dodge.range && skills.has('dodge') && rt - dodgeAt > C.SKILL.dodge.cooldown) {
      dodgeAt = rt; dodge = C.SKILL.dodge.dur;
      const l = td || 1; dodgeDir = [(x - threat.x) / l, (z - threat.z) / l];
    }
    if (threat && td < P.see && !(me.fx.giant > rt) && !(me.fx.ghost > rt) && fleeT <= 0) { fleeT = 1.2; const l = td || 1; fleeDir = [(x - threat.x) / l, (z - threat.z) / l]; }
    // where to go: the best thing for the trip (a casual player makes up its mind now and then)
    think -= DT;
    if (!goal || stuck > 1.5 || (P.think && think <= 0) || (goal.kind === 'candy' && !A.candies.has(goal.id)) || (goal.kind === 'orb' && !A.orbs.has(goal.id)) || (goal.kind === 'gem' && !A.gems.has(goal.id)) || (goal.kind === 'door' && A.houses[goal.id].until > rt)) {
      let best = null, bv = 0;
      const consider = (kind, id, gx, gz, value) => { const d = Math.hypot(gx - x, gz - z), v = value / (d + 5); if (v > bv && !(goal && stuck > 1.5 && goal.id === id && goal.kind === kind)) { bv = v; best = { kind, id, x: gx, z: gz }; } };
      for (const c of A.candies.values()) if (!(c.land > rt + 0.5)) consider('candy', c.id, c.x, c.z, C.CANDY[c.type].points);
      HOUSES.forEach((h, i) => { if (!(A.houses[i].until > rt)) consider('door', i, h.door.x, h.door.z, 11); });
      for (const o of A.orbs.values()) consider('orb', o.id, o.x, o.z, 14);
      for (const g of A.gems.values()) consider('gem', g.id, g.x, g.z, 40);
      goal = best; stuck = 0; lastD = Infinity; think = P.think;
    }
    // move
    const slow = me.fx.slow > rt ? C.SLOW_MUL : 1, giant = me.fx.giant > rt ? C.GEMS.giant.speed : 1;
    let dx = 0, dz = 0, speed = C.MOVE.run * slow * giant * P.pace;
    if (dodge > 0) { dodge -= DT; [dx, dz] = dodgeDir; speed = C.MOVE.run * C.SKILL.dodge.speed; }
    else if (fleeT > 0) { fleeT -= DT; [dx, dz] = fleeDir; run = 0; }
    else if (goal) { const d = Math.hypot(goal.x - x, goal.z - z); if (d > 0.3) { dx = (goal.x - x) / d; dz = (goal.z - z) / d; } stuck = d < lastD - 0.05 ? 0 : stuck + DT; lastD = Math.min(lastD, d); }
    if (dodge <= 0) { run += DT; speed *= 1 + (C.AUTORUN.mul - 1) * Math.min(1, Math.max(0, (run - C.AUTORUN.after) / C.AUTORUN.ramp)); }
    if (goal && Math.hypot(goal.x - x, goal.z - z) < 1) run = 0; // (it slows down to turn at the goal)
    if (dx || dz) {
      if (me.fx.ghost > rt) { x += dx * speed * DT; z += dz * speed * DT; const r = Math.hypot(x, z), lim = MAP_R - PLAYER_R; if (r > lim) { x *= lim / r; z *= lim / r; } }
      else [x, z] = slide(x + dx * speed * DT, z + dz * speed * DT, PLAYER_R, { big: me.fx.giant > rt });
    }
    // reach out
    for (const c of A.candies.values()) if (Math.hypot(c.x - x, c.z - z) < P.reach) A.intent('me', { kind: 'pickup', id: c.id });
    for (const o of A.orbs.values()) if (Math.hypot(o.x - x, o.z - z) < 2) A.intent('me', { kind: 'orb', id: o.id });
    for (const g of A.gems.values()) if (Math.hypot(g.x - x, g.z - z) < 2) A.intent('me', { kind: 'gem', id: g.id });
    HOUSES.forEach((h, i) => { if (!(A.houses[i].until > rt) && Math.hypot(h.door.x - x, h.door.z - z) < DOOR_RANGE) A.intent('me', { kind: 'knock', house: i }); });
  }
  return me.score;
}

const q = (a, k) => a[Math.min(a.length - 1, Math.floor(k * a.length))];
const round = (v) => (v < 200 ? Math.round(v / 10) * 10 : Math.round(v / 25) * 25);
console.log(`${SEEDS} nights each.  night  skill     casual q25 / median   capable q40 / median   → stars suggested   (now)`);
const out = [];
C.NIGHTS.forEach((N, n) => {
  const cas = Array.from({ length: SEEDS }, (_, s) => playNight(n, 1000 + s * 77, PLAYERS.casual)).sort((a, b) => a - b);
  const cap = Array.from({ length: SEEDS }, (_, s) => playNight(n, 5000 + s * 77, PLAYERS.capable)).sort((a, b) => a - b);
  const s = [round(q(cas, 0.25) * 0.6), round(q(cas, 0.5)), round(q(cap, 0.4) * 0.9)];
  s[1] = Math.max(s[1], s[0] + 25); s[2] = Math.max(s[2], round(s[1] * 1.25)); // (each star a real step up)
  out.push(s);
  console.log(`  ${String(n + 1).padEnd(6)} ${N.skill.padEnd(9)} ${String(q(cas, 0.25)).padStart(6)} / ${String(q(cas, 0.5)).padEnd(10)} ${String(q(cap, 0.4)).padStart(6)} / ${String(q(cap, 0.5)).padEnd(10)}   ${s.join(' / ').padEnd(18)} (${N.stars.join(' / ')})`);
});
console.log(`stars: ${JSON.stringify(out)}`);
