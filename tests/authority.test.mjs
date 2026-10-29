// Unit tests for the session authority (no rendering): node tests/authority.test.mjs
import assert from 'node:assert/strict';
import { Authority } from '../src/game/authority.js';
import * as C from '../src/game/config.js';
import { HOUSES } from '../src/world/layout.js';

const M = C.DIFFICULTY[C.DEFAULT_LEVEL].help; // what the night hands out at the default level (medium)
const events = [], snaps = [];
const A = new Authority({ emit: (e) => events.push(e), snapshot: (s) => snaps.push(s), seed: 1234 });
const of = (name) => events.filter((e) => e.e === name);
A.start([{ id: 'a', name: 'Ana', costume: 'witch' }, { id: 'b', name: 'Beto', costume: 'cape' }]);
assert.equal(of('start').length, 1);
assert.equal(of('candy+').length, M.candy, 'initial candy');
assert.equal(of('orb+').length, M.orbs, 'initial orbs');

// Nothing scores during the countdown.
const c0 = of('candy+')[0];
A.setPose('a', c0.x, c0.z);
A.intent('a', { kind: 'pickup', id: c0.id });
assert.equal(of('candy-').length, 0, 'no pickups before GO');
for (let i = 0; i < 31; i++) A.tick(0.1);
assert.deepEqual(of('count').map((e) => e.n), [3, 2, 1]);
assert.equal(of('go').length, 1);
assert.equal(A.phase, 'playing');

// Pickup: once, by whoever asks first; too far is refused.
A.setPose('b', c0.x + 0.5, c0.z);
A.intent('a', { kind: 'pickup', id: c0.id });
A.intent('b', { kind: 'pickup', id: c0.id });
assert.equal(of('candy-').length, 1, 'a candy is taken once');
assert.equal(of('candy-')[0].by, 'a');
const c1 = of('candy+')[1];
A.setPose('b', c1.x + 9, c1.z);
A.intent('b', { kind: 'pickup', id: c1.id });
assert.equal(of('candy-').length, 1, 'too far is refused');

// Knock: needs the door, then the house cools down for everyone.
const h = HOUSES[0];
A.setPose('a', h.door.x, h.door.z);
A.setPose('b', h.door.x + 0.3, h.door.z);
A.intent('a', { kind: 'knock', house: 0 });
A.intent('b', { kind: 'knock', house: 0 });
assert.equal(of('house').length, 1, 'cooldown blocks the second knock');
assert.equal(of('house')[0].until - A.rt, C.HOUSE_COOLDOWN - 0, 'cooldown is 15 s');
for (let i = 0; i < 151; i++) A.tick(0.1);
A.setPose('b', h.door.x, h.door.z);
A.intent('b', { kind: 'knock', house: 0 });
assert.equal(of('house').length, 2, 'usable again after 15 s');

// Odds over many visits (a fresh authority, cooldown skipped by reaching into its state).
{
  const ev = [];
  const B = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed: 99 });
  B.start([{ id: 'x', name: 'X', costume: 'none' }]);
  for (let i = 0; i < 31; i++) B.tick(0.1);
  const n = 20000, counts = { treat: 0, trick: 0, jackpot: 0 };
  for (let i = 0; i < n; i++) {
    B.houses[3].until = -1;
    B.players.get('x').held = 'shield';
    B.setPose('x', HOUSES[3].door.x, HOUSES[3].door.z);
    B.players.get('x').inv = 0;
    B.intent('x', { kind: 'knock', house: 3 });
  }
  for (const e of ev) if (e.e === 'house') counts[e.kind]++;
  const total = counts.treat + counts.trick + counts.jackpot;
  assert.equal(total, n);
  console.log('odds', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / n).toFixed(3)])));
  assert.ok(Math.abs(counts.treat / n - 0.7) < 0.015 && Math.abs(counts.trick / n - 0.2) < 0.015 && Math.abs(counts.jackpot / n - 0.1) < 0.01);
}

// The trick that robs: one trick in five takes every piece of candy you carry; a shield stops it.
{
  const ev = [];
  const B = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed: 42 });
  B.start([{ id: 'x', name: 'X', costume: 'none' }]);
  for (let i = 0; i < 31; i++) B.tick(0.1);
  const x = B.players.get('x');
  let robbed = 0, tricks = 0, kept = 0;
  for (let i = 0; i < 20000; i++) {
    B.houses[1].until = -1; x.inv = 0; x.score = 77; delete x.fx.slow;
    const shielded = i % 10 === 0;
    if (shielded) x.fx.shield = B.rt + 20; else delete x.fx.shield;
    B.setPose('x', HOUSES[1].door.x, HOUSES[1].door.z);
    const n = ev.length;
    B.intent('x', { kind: 'knock', house: 1 });
    const h = ev.slice(n).find((e) => e.e === 'house');
    if (h.kind !== 'trick') continue;
    tricks++;
    if (h.trick !== 'rob') continue;
    robbed++;
    if (shielded) { assert.equal(h.lost, 0); assert.equal(x.score, 77, 'a shield saves the candy'); kept++; } else { assert.equal(h.lost, 77); assert.equal(x.score, 0, 'robbed of everything'); }
  }
  B.monsters = [];
  assert.ok(Math.abs(robbed / tricks - C.TRICK_ROB) < 0.02, `about ${C.TRICK_ROB * 100}% of tricks rob (${(robbed / tricks * 100).toFixed(1)}%)`);
  assert.ok(kept > 0);
  console.log(`✔ the robbing trick: ${(robbed / tricks * 100).toFixed(1)}% of ${tricks} tricks (${(robbed / 200).toFixed(1)}% of knocks) took all the candy; a shield saved it ${kept} times`);
}

// Power-up: picked up into the slot, used, expires.
const orb = of('orb+')[0];
A.setPose('a', orb.x, orb.z);
A.intent('a', { kind: 'orb', id: orb.id });
assert.equal(A.players.get('a').held, orb.kind);
A.intent('a', { kind: 'use' });
assert.equal(of('power').length, 1);
const until = of('power')[0].until;
while (A.rt < until + 0.2) A.tick(0.1);
assert.ok(of('fx-end').some((e) => e.id === 'a' && e.kind === orb.kind) || (orb.kind === 'shield' && of('hit').some((e) => e.id === 'a' && e.blocked)), `power-up ${orb.kind} ends (expires, or a shield blocks a hit)`);
console.log(`power-up ${orb.kind}: ${of('fx-end').some((e) => e.id === 'a' && e.kind === orb.kind) ? 'expired' : 'blocked a hit'}`);

// Madness at 60 s left, with the giant ghost and special candy; the round lasts exactly 180 s.
while (A.phase === 'playing' && A.rt < C.ROUND_SECONDS - C.MADNESS_AT - 0.05) A.tick(0.1);
assert.equal(of('madness').length, 0);
A.tick(0.1);
assert.equal(of('madness').length, 1);
assert.ok(!of('mon+').some((e) => e.kind === 'giant'), 'no giant ghost any more');
let guard = 0;
while (A.phase !== 'over' && guard++ < 10000) A.tick(0.05);
const over = of('over')[0];
assert.ok(over, 'round ends');
assert.ok(Math.abs(A.rt - C.ROUND_SECONDS) < 1 / 30 + 1e-9, `ends at 180 s (rt ${A.rt.toFixed(3)})`);
assert.equal(over.ranking.length, 2);
assert.ok(over.ranking[0].score >= over.ranking[1].score);
const before = A.players.get('a').score;
const cLeft = [...A.candies.values()][0];
if (cLeft) { A.setPose('a', cLeft.x, cLeft.z); A.intent('a', { kind: 'pickup', id: cLeft.id }); }
assert.equal(A.players.get('a').score, before, 'no scoring after time is up');
const hits = of('hit');
console.log('hits', hits.length, 'monster kinds', [...new Set(of('mon+').map((e) => e.kind))].join(','), 'ranking', over.ranking.map((r) => `${r.name}:${r.score}`).join(' '), 'winners', over.winners.join(','));
// A monster hit costs 10 (or what's left), and protection follows each hit.
for (const e of hits.filter((h) => h.delta !== undefined)) assert.ok(e.delta <= 0 && e.delta >= -10);

// Monster rules, one at a time on a fresh authority with a monster placed by hand.
function fresh(seed = 7) {
  const ev = [];
  const X = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed });
  X.start([{ id: 'a', name: 'A', costume: 'none' }, { id: 'b', name: 'B', costume: 'none' }]);
  for (let i = 0; i < 31; i++) X.tick(0.1);
  X.monsters = []; // only the monster under test
  return { X, ev, of: (n) => ev.filter((e) => e.e === n) };
}
{ // a trick: a swarm of ghosts and creatures pours out of the door, fans out, chases the knocker, then goes
  for (const level of C.LEVELS) {
    const ev = [], of = (n) => ev.filter((e) => e.e === n);
    const X = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed: 11 });
    X.start([{ id: 'a', name: 'A', costume: 'none' }], level);
    for (let i = 0; i < 31; i++) X.tick(0.1);
    X.monsters = [];
    const H = HOUSES[5], S = C.DIFFICULTY[level].swarm;
    let tr = null;
    for (let i = 0; i < 300 && !tr; i++) {
      X.houses[5].until = -1; X.players.get('a').score = 0; X.setPose('a', H.door.x, H.door.z);
      const n = ev.length;
      X.intent('a', { kind: 'knock', house: 5 });
      tr = ev.slice(n).find((e) => e.e === 'house' && e.kind === 'trick');
      if (!tr) continue;
    }
    assert.ok(tr && tr.n === S.count, `${level}: a trick announces its swarm`);
    const out = X.monsters.filter((m) => m.trick);
    assert.equal(out.length, S.count, `${level}: ${S.count} monsters come out`);
    assert.ok(S.count >= 6);
    assert.equal(out.filter((m) => m.kind === 'ghost').length, S.ghosts, 'ghosts among them');
    assert.ok(out.every((m) => Math.hypot(m.x - H.door.x, m.z - H.door.z) < 1), 'all out of the door');
    const ox = H.door.x - H.x, oz = H.door.z - H.z, ol = Math.hypot(ox, oz);
    X.setPose('a', H.door.x + (ox / ol) * 9, H.door.z + (oz / ol) * 9); // ran off down the path
    for (let i = 0; i < 15; i++) X.tick(0.1);
    let close = Infinity;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) close = Math.min(close, Math.hypot(out[i].x - out[j].x, out[i].z - out[j].z));
    assert.ok(close > C.SEPARATION * 0.6, `fanned out, not piled up (closest pair ${close.toFixed(2)} m)`);
    assert.ok(out.every((m) => !m.burst && m.state === 'chase' && m.target === 'a'), 'then every one chases the knocker');
    for (let i = 0; i < (C.DIFFICULTY[level].trickLife + 1) * 10; i++) X.tick(0.1);
    assert.equal(X.monsters.filter((m) => m.trick).length, 0, 'and they go home when their time is up');
    assert.equal(of('mon-').length, S.count);
  }
  console.log(`✔ a trick lets a swarm out of the house: ${C.LEVELS.map((l) => `${C.DIFFICULTY[l].swarm.count} (${C.DIFFICULTY[l].swarm.ghosts} ghosts)`).join(' / ')}, fanned out, chasing, gone after their time`);
}
{ // ghost: exactly -10, then protection: no second hit within 2.5 s
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  const g = X.addMonster('ghost', null, 0.5, 12); Object.assign(g, { state: 'chase', target: 'a', path: [[0, 12]] });
  for (let i = 0; i < 10; i++) X.tick(0.1);
  assert.equal(of('hit').filter((h) => h.id === 'a').length, 1);
  assert.equal(of('hit')[0].delta, -10); assert.equal(X.players.get('a').score, 20);
  Object.assign(g, { state: 'chase', target: 'a', x: 0.3, z: 12, t: 0 });
  for (let i = 0; i < 15; i++) X.tick(0.1); // still within the 2.5 s of protection
  assert.equal(X.players.get('a').score, 20, 'protected right after a hit');
  console.log('✔ ghost takes 10, then the player is protected');
}
{ // zombie: slows (5 s on the default level, medium: 4 s), no points lost
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  const z = X.addMonster('zombie', [[0, 12], [3, 12]], 0.6, 12); Object.assign(z, { state: 'chase', target: 'a' });
  for (let i = 0; i < 10; i++) X.tick(0.1);
  const h = of('hit').find((e) => e.id === 'a');
  assert.ok(h && h.by === 'zombie' && h.slow, 'zombie slows');
  assert.ok(Math.abs(h.slow - X.rt - X.cfg.zombie.slow) < 1.1, `for about ${X.cfg.zombie.slow} s`);
  assert.equal(X.players.get('a').score, 30, 'zombies take no candy');
  console.log(`✔ zombie slows for ${X.cfg.zombie.slow} s (${C.LEVELS.map((l) => C.DIFFICULTY[l].zombie.slow).join(' / ')} s by level)`);
}
{ // levels: the five creatures on every level; easy has fewer, slower monsters than hard
  const made = (level) => { const X = new Authority({ emit: () => {}, snapshot: () => {}, seed: 3 }); X.start([{ id: 'a', name: 'A', costume: 'none' }], level); return X.monsters; };
  for (const level of C.LEVELS) {
    const zs = made(level).filter((m) => m.kind === 'zombie');
    assert.deepEqual(zs.map((m) => m.id), ['z1', 'z2', 'z3', 'z4', 'z5'], `${level}: five creatures, one per route`);
    assert.equal(new Set(zs.map((m) => m.path)).size, 5, 'each on its own route');
  }
  assert.equal(made('easy').length, 7); assert.equal(made('medium').length, 7); assert.equal(made('hard').length, 9);
  const [E, Md, H] = C.LEVELS.map((l) => C.DIFFICULTY[l]);
  for (const k of ['ghost', 'zombie']) assert.ok(E[k].chase < Md[k].chase && Md[k].chase < H[k].chase && E[k].detect < H[k].detect && E[k].maxChase < H[k].maxChase, `${k}s get faster and keener`);
  assert.ok(E.zombie.slow < Md.zombie.slow && Md.zombie.slow < H.zombie.slow, 'a creature holds you longer on harder levels');
  assert.ok(E.swarm.count >= 6 && E.swarm.count <= Md.swarm.count && Md.swarm.count <= H.swarm.count, 'a trick lets out 6 or more monsters, more on harder levels');
  assert.ok(E.invulnerable > Md.invulnerable && Md.invulnerable > H.invulnerable);
  for (const k of ['candy', 'orbs', 'gems', 'banished', 'scareLoot', 'rain']) assert.ok(E.help[k] >= Md.help[k] && Md.help[k] >= H.help[k] && E.help[k] > H.help[k], `less ${k} on harder levels`);
  assert.ok(E.help.gemFirst < H.help.gemFirst && E.help.orbBack < H.help.orbBack);
  assert.ok(H.ghost.chase > C.MOVE.run * 0.9 && H.ghost.chase * H.madnessSpeed > C.MOVE.run && H.ghost.chase * H.madnessSpeed < C.MOVE.run * C.AUTORUN.mul, 'hard ghosts nearly keep up with a run, outrun it in the Madness, and only a sprint escapes');
  console.log('✔ levels: the five creatures on every level (2 / 2 / 4 ghosts); harder levels: faster, keener monsters, bigger swarms, less candy, fewer orbs and gems');
}
{ // giant gem: monsters can't hurt you, they flee, and touching one scares it off with its candy
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  X.players.get('a').fx.giant = X.rt + 8;
  const g = X.addMonster('ghost', [[0, 24], [5, 24]], 0, 24); Object.assign(g, { cool: 0 }); // beyond a giant's reach, well within its sight
  X.tick(0.1);
  assert.equal(g.state, 'flee', 'monsters flee from a giant');
  for (let i = 0; i < 20 && g.state !== 'banished'; i++) { X.setPose('a', g.x, g.z); X.tick(0.1); }
  const sc = of('scare')[0];
  assert.ok(sc && sc.id === 'a' && sc.power === 'giant' && sc.pts === M.scareLoot, 'stomped: the ghost drops candy');
  assert.equal(of('hit').filter((h) => h.id === 'a').length, 0, 'a giant takes no hits');
  X.setPose('a', 0, -25); // the giant strides off
  for (let i = 0; i < (M.banished + 0.5) * 10; i++) X.tick(0.1);
  assert.notEqual(g.state, 'banished', 'the ghost comes back after a while');
  console.log(`✔ giant gem: ghosts flee, a stomp scares one off (+${sc.pts}), it returns ${M.banished} s later`);
}
{ // thief gem: catch the ghost that robbed you, win its candy back (and more)
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  const g = X.addMonster('ghost', [[0, 14], [5, 14]], 0.5, 12); Object.assign(g, { state: 'chase', target: 'a' });
  for (let i = 0; i < 6; i++) X.tick(0.1);
  assert.equal(g.loot, 10, 'the ghost keeps the 10 it took');
  assert.equal(X.players.get('a').score, 20);
  X.players.get('a').fx.thief = X.rt + 10;
  for (let i = 0; i < 40 && g.state !== 'banished'; i++) { X.setPose('a', g.x, g.z); X.tick(0.1); }
  const sc = of('scare')[0];
  assert.ok(sc && sc.power === 'thief' && sc.pts === 10 + M.scareLoot, 'stolen back: its loot plus a bonus');
  assert.equal(X.players.get('a').score, 20 + 10 + M.scareLoot);
  console.log(`✔ thief gem: caught the ghost, stole back ${sc.pts} (score 30 → 20 → ${20 + sc.pts})`);
}
{ // the candy thief frightens zombies too, and lasts longer than the giant
  const { X, of } = fresh();
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  X.players.get('a').fx.thief = X.rt + C.GEMS.thief.dur;
  const z = X.addMonster('zombie', [[0, 16], [4, 16]], 0, 16); Object.assign(z, { cool: 0 });
  X.tick(0.1);
  assert.equal(z.state, 'flee', 'zombies flee from a candy thief');
  for (let i = 0; i < 60 && z.state !== 'banished'; i++) { X.setPose('a', z.x, z.z); X.tick(0.1); }
  const sc = of('scare')[0];
  assert.ok(sc && sc.kind === 'zombie' && sc.power === 'thief' && sc.pts === M.scareLoot, 'caught zombie drops candy');
  console.log(`✔ candy thief: zombies flee too, a caught one drops ${sc.pts}`);
}
{ // every gem and power-up lasts 20 s
  for (const [k, v] of Object.entries({ ...C.GEMS, ...C.POWERUPS })) assert.equal(v.dur, 20, `${k} lasts 20 s`);
  assert.equal(C.ROUND_SECONDS, 180);
  assert.ok(!('speed' in C.POWERUPS) && 'rain' in C.POWERUPS && 'ghost' in C.GEMS);
  console.log(`✔ every power lasts 20 s (${[...C.GEM_KINDS, ...C.POWERUP_KINDS].join(', ')}); the round lasts 180 s`);
}
{ // ghost gem: monsters can't see you, a chasing one gives up, nothing hurts you, not even a trick's swarm
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -20);
  const g = X.addMonster('ghost', [[0, 14], [5, 14]], 1.5, 12); Object.assign(g, { state: 'chase', target: 'a', cool: 0 });
  X.players.get('a').fx.ghost = X.rt + C.GEMS.ghost.dur;
  for (let i = 0; i < 40; i++) { X.setPose('a', g.x, g.z); X.tick(0.1); } // float right through it
  assert.equal(of('hit').filter((h) => h.id === 'a').length, 0, 'a ghost takes no hits');
  assert.notEqual(g.state, 'chase', 'the monster lost sight of the player');
  assert.equal(of('spot').filter((e) => e.target === 'a').length, 0, 'and never spots them again');
  const z = X.addMonster('zombie', [[0, 12], [3, 12]], 0.4, 12); Object.assign(z, { cool: 0 });
  for (let i = 0; i < 20; i++) { X.setPose('a', z.x, z.z); X.tick(0.1); }
  assert.equal(of('hit').filter((h) => h.id === 'a').length, 0, 'zombies ignore a ghost too');
  assert.equal(X.players.get('a').score, 30);
  X.monsters = [];
  // a trick's swarm can't see a ghost either
  for (let i = 0; i < 400 && !of('house').some((e) => e.trick === 'swarm'); i++) {
    X.houses[2].until = -1; X.setPose('a', HOUSES[2].door.x, HOUSES[2].door.z); X.intent('a', { kind: 'knock', house: 2 });
  }
  assert.ok(of('house').some((e) => e.trick === 'swarm'), 'got a swarm trick');
  for (let i = 0; i < 30; i++) { X.setPose('a', HOUSES[2].door.x, HOUSES[2].door.z); X.tick(0.1); }
  assert.ok(!of('hit').some((h) => h.id === 'a'), 'the swarm walks past a ghost');
  X.monsters = [];
  const left = X.players.get('a').fx.ghost - X.rt;
  for (let i = 0; i < (left + 0.3) * 10; i++) X.tick(0.1);
  assert.ok(of('fx-end').some((e) => e.id === 'a' && e.kind === 'ghost'), 'ghost form ends');
  console.log('✔ ghost gem: monsters lose you, no hits from ghosts, zombies or a swarm, it wears off');
}
{ // candy rain: candy falls round its player, can be taken once it lands, and melts away if left
  const { X, of } = fresh();
  X.setPose('a', 0, 12); X.setPose('b', 0, -20);
  X.players.get('a').held = 'rain';
  const streets = X.candies.size;
  X.intent('a', { kind: 'use' });
  X.tick(0.05);
  const first = of('candy+').filter((e) => e.fall);
  assert.equal(first.length, 1, 'the first piece falls at once');
  const c = first[0];
  const r = Math.hypot(c.x - 0, c.z - 12);
  assert.ok(r <= C.POWERUPS.rain.radius[1] + 1, `falls near its player (${r.toFixed(1)} m)`);
  X.setPose('a', c.x, c.z);
  X.intent('a', { kind: 'pickup', id: c.id });
  assert.equal(of('candy-').length, 0, 'not while it is still falling');
  for (let i = 0; i < 12; i++) X.tick(0.1);
  X.setPose('a', c.x, c.z);
  X.intent('a', { kind: 'pickup', id: c.id });
  assert.equal(of('candy-')[0]?.id, c.id, 'taken once it has landed');
  X.setPose('a', 0, 12);
  for (let i = 0; i < 100; i++) X.tick(0.1); // 10 s of rain, standing still
  const fell = of('candy+').filter((e) => e.fall).length;
  const want = 11 * M.rain;
  assert.ok(Math.abs(fell - want) <= 3, `about ${M.rain} a second (${fell} in 11 s)`);
  assert.ok([...X.candies.values()].filter((k) => k.spot >= 0).length <= Math.max(streets, M.candy), 'rain candy does not stop the streets refilling');
  for (let i = 0; i < 260; i++) X.tick(0.1); // the storm passes; what nobody took melts away
  assert.ok(of('fx-end').some((e) => e.id === 'a' && e.kind === 'rain'), 'the rain stops after 20 s');
  assert.equal([...X.candies.values()].filter((k) => k.spot < 0).length, 0, 'fallen candy does not pile up');
  assert.ok(of('candy-').some((e) => e.gone), 'left-over rain candy melts away');
  const total = of('candy+').filter((e) => e.fall).length;
  assert.ok(total >= C.POWERUPS.rain.dur * M.rain - 3, `a real downpour: ${total} pieces in ${C.POWERUPS.rain.dur} s`);
  console.log(`✔ candy storm: ${total} pieces in ${C.POWERUPS.rain.dur} s round its player (${fell} in the first 11 s), taken once landed, the rest melts away`);
}
{ // magnet: pulls candy in from far away (16 m)
  const { X, of } = fresh();
  const c = [...X.candies.values()][0];
  X.setPose('a', c.x + 15, c.z);
  X.intent('a', { kind: 'pickup', id: c.id });
  assert.equal(of('candy-').length, 0, 'out of reach without the magnet');
  X.players.get('a').fx.magnet = X.rt + C.POWERUPS.magnet.dur;
  X.intent('a', { kind: 'pickup', id: c.id });
  assert.equal(of('candy-')[0]?.id, c.id, 'the magnet reaches 15 m');
  console.log(`✔ magnet: reaches ${C.POWERUPS.magnet.radius} m`);
}
{ // gems: the first soon after GO, up to two out at once and of different kinds
  const { X, of } = fresh();
  X.setPose('a', 0, 40); X.setPose('b', 0, 40);
  let firstAt = null;
  while (X.gems.size < 2 && X.rt < 60) { X.tick(0.1); if (firstAt === null && X.gems.size) firstAt = X.rt; }
  const out = of('gem+');
  assert.ok(out[0], 'a gem appears');
  assert.ok(Math.abs(firstAt - M.gemFirst) < 0.2, `${M.gemFirst} s after GO`);
  assert.equal(X.gems.size, 2, 'two at a time');
  assert.notEqual(out[0].kind, out[1].kind, 'of different kinds');
  for (let i = 0; i < 200; i++) X.tick(0.1);
  assert.equal(X.gems.size, M.gems, 'never more than two');
  console.log(`✔ gems: ${out[0].kind} at ${M.gemFirst} s, then ${out[1].kind}; at most ${M.gems} out`);
}
{ // hard: ghosts aim where a running player is going; on easy they go straight for where you are
  const aim = (level) => {
    const X = new Authority({ emit: () => {}, snapshot: () => {}, seed: 5 });
    X.start([{ id: 'a', name: 'A', costume: 'none' }], level);
    for (let i = 0; i < 31; i++) X.tick(0.1);
    X.monsters = [];
    let x = -4;
    X.setPose('a', x, 12);
    for (let i = 0; i < 10; i++) { x += 0.5; X.setPose('a', x, 12); X.tick(0.1); } // running east at 5 m/s
    const g = X.addMonster('ghost', [[0, 22]], x, 20); Object.assign(g, { state: 'chase', target: 'a', t: 0 });
    X.tick(0.1);
    return g.x - x; // > 0: heading east of the player, to cut them off
  };
  const easy = aim('easy'), hard = aim('hard');
  assert.ok(Math.abs(easy) < 0.02 && hard > 0.1, `hard cuts you off (east drift easy ${easy.toFixed(2)}, hard ${hard.toFixed(2)})`);
  console.log(`✔ hard ghosts aim ahead of a running player (${hard.toFixed(2)} m in one step), easy ones don't`);
}
{ // hard is scarce: one gem at a time and late, two orbs, less candy on the streets
  const ev = [];
  const X = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed: 11 });
  X.start([{ id: 'a', name: 'A', costume: 'none' }], 'hard');
  const H = C.DIFFICULTY.hard.help;
  assert.equal(ev.filter((e) => e.e === 'candy+').length, H.candy);
  assert.equal(ev.filter((e) => e.e === 'orb+').length, H.orbs);
  X.setPose('a', 0, 40);
  let first = null;
  while (X.rt < 80) { X.tick(0.1); if (first === null && X.gems.size) first = X.rt; assert.ok(X.gems.size <= 1, 'one gem at a time'); }
  assert.ok(Math.abs(first - H.gemFirst) < 0.2, `the first gem only at ${H.gemFirst} s`);
  console.log(`✔ hard: ${H.candy} candy, ${H.orbs} orbs, first gem at ${first.toFixed(0)} s, one at a time`);
}
{ // gems are picked up through the authority
  const { X, of } = fresh();
  while (!X.gems.size && X.rt < 40) X.tick(0.1);
  const gem = [...X.gems.values()][0];
  assert.ok(gem, 'a gem appears');
  X.setPose('a', gem.x, gem.z);
  X.intent('a', { kind: 'gem', id: gem.id });
  X.intent('b', { kind: 'gem', id: gem.id });
  assert.equal(of('gem-').length, 1, 'one taker');
  assert.ok(X.players.get('a').fx[gem.kind] > X.rt, `${gem.kind} power on`);
  console.log(`✔ gem ${gem.kind} appeared at ${X.rt.toFixed(1)} s and went to one player`);
}
{ // orbs can always be taken: into an empty slot, or straight on when the slot is full
  const { X, of } = fresh();
  const [o1, o2] = [...X.orbs.values()];
  X.setPose('a', o1.x, o1.z); X.intent('a', { kind: 'orb', id: o1.id });
  assert.equal(X.players.get('a').held, o1.kind, 'first orb goes into the slot');
  X.setPose('a', o2.x, o2.z); X.intent('a', { kind: 'orb', id: o2.id });
  const ev = of('orb-')[1];
  assert.ok(ev && ev.used && X.players.get('a').fx[o2.kind] > X.rt, 'second orb works at once');
  assert.equal(X.players.get('a').held, o1.kind, 'the stored one stays for the button');
  console.log(`✔ orbs: ${o1.kind} stored, ${o2.kind} used at once (slot was full)`);
}
{ // double candy doubles candy
  const { X, of } = fresh();
  X.monsters = [];
  X.players.get('a').fx.double = X.rt + 10;
  const c = [...X.candies.values()][0];
  X.setPose('a', c.x, c.z);
  X.intent('a', { kind: 'pickup', id: c.id });
  assert.equal(of('candy-')[0].pts, C.CANDY[c.type].points * 2);
  console.log(`✔ double candy: ${c.type} worth ${of('candy-')[0].pts}`);
}
// --- the Lens's nights ------------------------------------------------------------------------------
const nightOf = (n, seed = 7) => {
  const ev = [], X = new Authority({ emit: (e) => ev.push(e), snapshot: () => {}, seed });
  X.start([{ id: 'n', name: 'N', costume: 'none' }], 'medium', { night: n });
  for (let i = 0; i < 31; i++) X.tick(0.1);
  return { X, ev, of: (k) => ev.filter((e) => e.e === k) };
};
/** The night that teaches a skill (0-based). */
const nightFor = (skill) => C.SKILLS.indexOf(skill);
{ // five minutes; the night's own rules; only the skills learnt by then (no orbs, no gems, a jackpot pays candy)
  const { X, ev, of } = nightOf(0);
  const st = ev.find((e) => e.e === 'start');
  assert.equal(st.seconds, C.NIGHT_SECONDS); assert.equal(st.night, 0); assert.deepEqual(st.skills, ['knock']);
  assert.equal(of('orb+').length, 0, 'no orbs on the first night');
  assert.equal(X.monsters.filter((m) => m.kind === 'ghost').length, 1, 'one ghost on the first night');
  assert.equal(X.monsters.filter((m) => m.kind === 'zombie').length, 3, 'three creatures');
  const p = X.players.get('n');
  X.setPose('n', HOUSES[2].door.x, HOUSES[2].door.z);
  let jackpot = null;
  for (let i = 0; i < 400 && !jackpot; i++) { X.houses[2].until = -1; X.intent('n', { kind: 'knock', house: 2 }); jackpot = ev.find((e) => e.e === 'house' && e.kind === 'jackpot'); }
  assert.ok(jackpot && !jackpot.power && !p.held, 'a jackpot before the powers night pays candy, not a power');
  assert.ok(!of('house').some((e) => e.trick === 'rob'), 'no robbing tricks on the first nights');
  p.inv = 1e9; // (nothing hits during the clock check)
  const madAt = C.NIGHT_SECONDS - C.NIGHT_MADNESS;
  while (X.rt < madAt - 0.3) X.tick(0.1);
  assert.ok(!X.madness, `no madness before its last ${C.NIGHT_MADNESS} s`);
  for (let i = 0; i < 5; i++) X.tick(0.1);
  assert.ok(X.madness, `the madness at ${madAt} s`);
  while (X.phase !== 'over' && X.rt < C.NIGHT_SECONDS + 5) X.tick(0.1);
  assert.equal(X.phase, 'over'); assert.equal(of('over')[0].night, 0);
  assert.ok(Math.abs(X.rt - C.NIGHT_SECONDS) < 0.15, `over at ${X.rt.toFixed(1)} s`);
  assert.equal(nightOf(nightFor('gems')).X.help.gems, C.DIFFICULTY[C.NIGHTS[nightFor('gems')].base].help.gems, 'gems from the gems night on');
  assert.equal(nightOf(nightFor('gems') - 1).X.help.gems, 0, 'none before it');
  assert.equal(C.NIGHTS.at(-1).skill, 'final', 'the last night: every skill, no new one');
  console.log(`✔ nights: ${C.NIGHT_SECONDS} s, the madness in the last ${C.NIGHT_MADNESS} s, only the skills learnt (${C.NIGHTS.map((N) => N.skill).join(', ')})`);
}
{ // boo: every monster round you runs off (a swarm too), then it waits
  const { X, of } = nightOf(nightFor('boo'));
  const p = X.players.get('n'), m = X.monsters[0];
  X.setPose('n', 0, 0);
  Object.assign(m, { x: 2, z: 0, state: 'chase', target: 'n', t: 0 });
  X.intent('n', { kind: 'boo' });
  assert.deepEqual(of('boo')[0]?.mons, [m.id], 'boo: the monster close by is frightened');
  for (let i = 0; i < 10; i++) X.tick(0.1);
  assert.ok(Math.hypot(m.x, m.z) > 3, `it runs off (${Math.hypot(m.x, m.z).toFixed(1)} m away)`);
  assert.notEqual(m.state, 'chase');
  X.intent('n', { kind: 'boo' });
  assert.equal(of('boo').length, 1, 'then it has to wait');
  for (let i = 0; i < C.SKILL.boo.cooldown * 10 + 1; i++) X.tick(0.1);
  X.intent('n', { kind: 'boo' });
  assert.equal(of('boo').length, 2, `ready again after ${C.SKILL.boo.cooldown} s`);
  const { X: Y, of: ofY } = nightOf(nightFor('boo') - 1);
  Y.intent('n', { kind: 'boo' });
  assert.equal(ofY('boo').length, 0, 'no boo before its night');
  console.log(`✔ boo: monsters within ${C.SKILL.boo.radius} m run off for ${C.SKILL.boo.fright} s; again after ${C.SKILL.boo.cooldown} s`);
}
{ // sneak: going at a walk, a monster only spots you close up; running, as ever
  const spotted = (pace) => {
    const { X, of } = nightOf(nightFor('sneak'));
    const m = X.monsters.find((k) => k.kind === 'ghost');
    X.monsters = [m]; // (just this one)
    Object.assign(m, { x: 7, z: 0, state: 'patrol', cool: 0, path: [[7, 0], [7, 0.01]], wp: 0 });
    let x = 0;
    for (let i = 0; i < 10; i++) { x += pace * 0.1; X.setPose('n', 0, x - 1); X.tick(0.1); } // (walking past, 7 m off)
    return of('spot').length > 0;
  };
  assert.ok(!spotted(2), 'walking: not spotted 7 m off');
  assert.ok(spotted(6), 'running: spotted');
  console.log(`✔ sneak: at a walk monsters see ${C.SKILL.sneak.detect * 100}% as far`);
}
{ // smell: candy from twice as far
  const reachOn = (n) => {
    const { X, of } = nightOf(n);
    const c = [...X.candies.values()][0];
    X.setPose('n', c.x + 3, c.z);
    X.intent('n', { kind: 'pickup', id: c.id });
    return of('candy-').length;
  };
  assert.equal(reachOn(nightFor('smell') - 1), 0, 'before the smell night: 3 m is too far');
  assert.equal(reachOn(nightFor('smell')), 1, 'with smell: taken from 3 m');
  console.log('✔ smell: candy from twice as far');
}
{ // stars
  const [a, b, c] = C.NIGHTS[0].stars;
  assert.deepEqual([C.starsFor(0, a - 1), C.starsFor(0, a), C.starsFor(0, b), C.starsFor(0, c + 5)], [0, 1, 2, 3]);
  assert.ok(C.NIGHTS.every((N) => N.stars[0] > 0 && N.stars[0] < N.stars[1] && N.stars[1] < N.stars[2]), 'every night: three rising targets');
  console.log(`✔ stars: ${C.NIGHTS.map((N, i) => `${i + 1}: ${N.stars.join('/')}`).join('  ')}`);
}
console.log('authority tests passed');
