// Unit tests for the session authority (no rendering): node tests/authority.test.mjs
import assert from 'node:assert/strict';
import { Authority } from '../src/game/authority.js';
import * as C from '../src/game/config.js';
import { HOUSES } from '../src/world/layout.js';

const events = [], snaps = [];
const A = new Authority({ emit: (e) => events.push(e), snapshot: (s) => snaps.push(s), seed: 1234 });
const of = (name) => events.filter((e) => e.e === name);
A.start([{ id: 'a', name: 'Ana', costume: 'witch' }, { id: 'b', name: 'Beto', costume: 'cape' }]);
assert.equal(of('start').length, 1);
assert.equal(of('candy+').length, C.CANDY_ON_MAP, 'initial candy');
assert.equal(of('orb+').length, C.ORBS_ON_MAP, 'initial orbs');

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
    B.players.get('x').held = 'speed';
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
assert.ok(of('mon+').some((e) => e.kind === 'giant'), 'giant ghost appears');
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
{ // zombie: slows for 5 s, no points lost
  const { X, of } = fresh();
  X.players.get('a').score = 30;
  X.setPose('a', 0, 12); X.setPose('b', 0, -12);
  const z = X.addMonster('zombie', [[0, 12], [3, 12]], 0.6, 12); Object.assign(z, { state: 'chase', target: 'a' });
  for (let i = 0; i < 10; i++) X.tick(0.1);
  const h = of('hit').find((e) => e.id === 'a');
  assert.ok(h && h.by === 'zombie' && h.slow, 'zombie slows');
  assert.ok(Math.abs(h.slow - X.rt - 5) < 1.1, 'for about 5 s');
  assert.equal(X.players.get('a').score, 30, 'zombies take no candy');
  console.log('✔ zombie slows for 5 s');
}
{ // giant ghost hunts the leader
  const { X } = fresh();
  X.players.get('a').score = 10; X.players.get('b').score = 80;
  X.setPose('a', 20, 0); X.setPose('b', -20, 0);
  X.clock = C.COUNTDOWN + C.ROUND_SECONDS - C.MADNESS_AT - 0.05;
  for (let i = 0; i < 40; i++) X.tick(0.1);
  const giant = X.monsters.find((m) => m.kind === 'giant');
  assert.ok(giant && giant.target === 'b', `giant targets the leader (got ${giant?.target})`);
  assert.ok(giant.x < 0, 'and heads their way');
  console.log('✔ giant ghost hunts the leader');
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
console.log('authority tests passed');
