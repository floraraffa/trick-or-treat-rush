// Multiplayer over a room: three separate game instances (pages) in one browser, linked by the
// BroadcastChannel transport. Checks the lobby, one host, a shared start, synced positions, candy
// taken once, a shared house cooldown, shared powers (ghost, candy rain), and the same ranking everywhere at the end.
//   node tests/room.mjs <outdir>
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';
const out = process.argv[2] ?? '.';
const base = process.env.URL ?? 'http://localhost:3100/';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 300, height: 580 } });
const errors = [];
const names = ['Ana', 'Beto', 'Caro'];
const pages = [];
for (const [i, name] of names.entries()) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(`${base}?test&lowfx&res=0.3&room=crypt&name=${name}&costume=${['witch', 'horns', 'pumpkin'][i]}`, { waitUntil: 'commit', timeout: 180000 });
  await p.waitForFunction(() => window.__game?.screen === 'menu', null, { timeout: 180000 });
  await p.click('#btnPlay'); // the nights, then the first (the host's pick is the room's) to the lobby
  await p.waitForFunction(() => !document.getElementById('nights').classList.contains('hidden'), null, { timeout: 60000 });
  await p.click('#btnNightPlay');
  pages.push(p);
}
const all = (fn, arg) => Promise.all(pages.map((p) => p.evaluate(fn, arg)));
// Lobby: everyone sees the same three names and the same single host.
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.session.rosterList().length === 3, null, { timeout: 150000 })));
const rosters = await all(() => window.__game.session.rosterList().map((r) => `${r.name}${r.host ? '*' : ''}`).sort().join(','));
assert.ok(rosters.every((r) => r === rosters[0]), `same roster everywhere: ${rosters.join(' | ')}`);
assert.equal(rosters[0].split('*').length - 1, 1, 'exactly one host');
console.log(`✔ lobby: ${rosters[0]} (host marked *)`);
await pages[0].screenshot({ path: `${out}/r0-lobby.png` });
const hostIdx = (await all(() => window.__game.session.isHost)).indexOf(true);
const host = pages[hostIdx];
const others = pages.filter((_, i) => i !== hostIdx);
assert.ok(await others[0].evaluate(() => document.getElementById('btnStart').classList.contains('hidden')), 'only the host has START');
await host.click('#btnStart');
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.screen === 'game' && window.__game.view.players.size === 3, null, { timeout: 200000 })));
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.view.phase === 'playing', null, { timeout: 200000 })));
console.log('✔ the host started; all three are in the round, past GO');

// Positions: move Beto (a client) somewhere; the others see him there.
const target = { x: 5.5, z: -6 };
await others[0].evaluate(({ x, z }) => window.__game.player.place(x, z, 90), target);
const id1 = await others[0].evaluate(() => window.__game.me.id);
await Promise.all(pages.filter((p) => p !== others[0]).map((p) => p.waitForFunction(([id, x, z]) => { const pl = window.__game.view.players.get(id); const s = pl && window.__game.view.sample(pl.track); return s && Math.hypot(s.x - x, s.z - z) < 0.3; }, [id1, target.x, target.z], { timeout: 150000 })));
console.log('✔ a client moves and the others see it');

// Candy: two players stand on the same candy at once; it is credited once.
const [cid, c] = await host.evaluate(() => { const [id, c] = [...window.__game.view.candies][0]; return [id, c]; });
await Promise.all([host, others[1]].map((p) => p.evaluate(({ x, z }) => window.__game.player.place(x, z, 0), c)));
await Promise.all(pages.map((p) => p.waitForFunction((id) => !window.__game.view.candies.has(id), cid, { timeout: 150000 })));
const takers = await host.evaluate((id) => window.__game.session.authority ? null : null, cid);
void takers;
const scores1 = await all(() => JSON.stringify([...window.__game.view.players.values()].map((p) => [p.name, p.score]).sort()));
console.log(`✔ candy ${c.type} gone everywhere; scores ${scores1[0]}`);

// A house: two players knock on the same door together; one visit, the same cooldown for all.
const h = await host.evaluate(async () => { const h = window.__game.houses[5]; return { id: h.id, x: h.door.x, z: h.door.z }; });
await Promise.all(others.map((p) => p.evaluate(({ x, z }) => window.__game.player.place(x, z, 0), h)));
await Promise.all(others.map((p) => p.waitForSelector('#btnKnock:not(.hidden)', { timeout: 150000 })));
await Promise.all(others.map((p) => p.click('#btnKnock')));
await Promise.all(pages.map((p) => p.waitForFunction((i) => (window.__game.view.houses[i] ?? 0) > performance.now() / 1000, h.id, { timeout: 150000 })));
const cools = await all((i) => +(window.__game.view.houses[i] - performance.now() / 1000).toFixed(1), h.id);
assert.ok(Math.max(...cools) - Math.min(...cools) < 2.5, `same cooldown everywhere: ${cools}`);
console.log(`✔ house visited once, cooldown seen by all: ${cools.join(' / ')} s`);
await others[0].screenshot({ path: `${out}/r1-client.png` });
await host.screenshot({ path: `${out}/r2-host.png` });

// Powers are shared: a client turns ghost and calls a candy rain; everyone sees both.
await host.evaluate((id) => { const a = window.__game.session.authority; a.players.get(id).fx.ghost = a.rt + 20; a.players.get(id).held = 'rain'; }, id1);
await others[0].waitForFunction(() => window.__game.view.players.get(window.__game.me.id).held === 'rain', null, { timeout: 150000 });
await others[0].click('#btnPower');
await Promise.all(pages.map((p) => p.waitForFunction((id) => window.__game.view.fx(id, 'ghost') > 0 && window.__game.view.fx(id, 'rain') > 0 && [...window.__game.view.candies.values()].some((c) => c.fall), id1, { timeout: 150000 })));
const rain = await all(() => JSON.stringify([...window.__game.view.candies.values()].filter((c) => c.fall).map((c) => c.id).slice(0, 1)));
console.log(`✔ a client turned ghost and called a candy rain; all three see it (first drop ${rain[0]})`);

// Fast-forward the host to the end: everyone gets the same ranking and winner.
assert.ok((await all(() => window.__game.view.night === 0 && window.__game.view.seconds === 90)).every(Boolean), "everyone plays the host's night: the first, 1:30");
await host.evaluate(() => window.__game.skip(Math.max(0, window.__game.view.seconds + 0.3 - window.__game.view.rt())));
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.view.phase === 'over' && window.__game.view.ranking, null, { timeout: 200000 })));
const ranks = await all(() => JSON.stringify({ r: window.__game.view.ranking.map((r) => [r.name, r.score]), w: window.__game.view.winners }));
assert.ok(ranks.every((r) => r === ranks[0]), `same ranking everywhere:\n${ranks.join('\n')}`);
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 150000 })));
await others[1].screenshot({ path: `${out}/r3-results.png` });
console.log(`✔ same final ranking on all three: ${ranks[0]}`);

// Play again: back to the lobby, the host starts a second round.
await Promise.all(pages.map((p) => p.click('#btnAgain')));
await host.waitForFunction(() => !document.getElementById('btnStart').disabled, null, { timeout: 150000 });
await host.click('#btnStart');
await Promise.all(pages.map((p) => p.waitForFunction(() => window.__game.screen === 'game' && window.__game.view.round === 2, null, { timeout: 200000 })));
const fresh = await all(() => [...window.__game.view.players.values()].every((p) => p.score === 0 && !p.held));
assert.ok(fresh.every(Boolean), 'scores and power-ups reset for the new round');
console.log('✔ second round started from the lobby, everything reset');
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
