// The Specs version in an emulated headset (IWER, dev server only): the menu and its languages, entering AR,
// the table-top board, walking with a pinch dragged in the air, a quick pinch at a door, the results, a quick
// pinch to play again, a long still pinch back to the menu. An emulator, not the glasses: see README.
//   node tests/specs.mjs <outdir>        (dev server on http://localhost:3100/, or URL=...)
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';
const out = process.argv[2] ?? '.';
const base = process.env.URL ?? 'http://localhost:3100/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout });
// The emulated right hand: where it is (metres, the headset's space) and whether it pinches.
const hand = (x, y, z) => G(([x, y, z]) => window.__xrDevice.hands.right.position.set(x, y, z), [x, y, z]);
const pinch = (v) => G((v) => window.__xrDevice.hands.right.updatePinchValue(v), v);
const protect = (s) => G((s) => { const A = window.__specs.session.authority; for (const p of A.players.values()) p.inv = A.rt + s; }, s); // (software WebGL is slow: the monsters would catch up)

await page.goto(`${base}specs.html?emulate`);
await until(() => !!window.__specs, null, 120000);
await until(() => !document.getElementById('enter').disabled, null, 30000);
const words = {};
for (const l of ['de', 'fr', 'en', 'es']) {
  await page.click(`#langs button[data-id="${l}"]`);
  await until((l) => document.documentElement.lang === l, l, 10000);
  words[l] = await G(() => document.getElementById('enter').textContent);
}
assert.equal(new Set(Object.values(words)).size, 4, 'the menu changes language');
await page.click('#levels button[data-id="easy"]');
// The neighbourhoods (the phone's nights' ones): picked on the page, the village dressed as it before the night.
const hoods = await G(() => [...document.querySelectorAll('#hoods button')].map((b) => [b.dataset.id, b.textContent]));
assert.equal(hoods.length, 10, 'the classic village, the eight nights\' neighbourhoods and the Moon');
await page.click('#hoods button[data-id="northpole"]');
await until(() => window.__specs.village.theme === 'northpole' && document.querySelector('#hoods button.on')?.dataset.id === 'northpole', null, 30000);
console.log(`✔ neighbourhoods on the page: ${hoods.map((h) => h[1]).join(', ')}; the North Pole picked`);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/s1-menu.png` });
console.log(`✔ menu: four languages (${Object.values(words).join(' / ')}), headset found`);

await page.click('#enter');
await until(() => window.__specs.app.xr.active, null, 30000);
await until(() => window.__specs.view.phase === 'playing', null, 120000);
const set = await G(() => { const s = window.__specs; return { scale: s.rig.getLocalScale().x, hud: s.panels.hud.visible, menu: document.getElementById('menu').classList.contains('hidden') }; });
assert.ok(set.scale > 10 && set.hud && set.menu, `a miniature (1:${set.scale}), the HUD on, the page menu hidden`);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/s2-board.png` });
console.log(`✔ AR session: the village on the table at 1:${set.scale}, the night running`);

// Walk: pinch, then drag the hand 6 cm away (its pinch point is the joystick's centre).
await protect(90);
await hand(0.12, -0.25, -0.35);
await page.waitForTimeout(700);
const p0 = await G(() => [window.__specs.player.state.x, window.__specs.player.state.z]);
await pinch(1);
await page.waitForTimeout(900);
await hand(0.12, -0.25, -0.41);
const p1 = await (await until(([x, z]) => { const s = window.__specs.player.state; return Math.hypot(s.x - x, s.z - z) > 1.5 ? [s.x, s.z] : null; }, p0, 60000)).jsonValue();
await page.screenshot({ path: `${out}/s3-walk.png` });
await pinch(0);
const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
assert.ok(dz < 0 && Math.abs(dx) < Math.abs(dz), `walks away from the player, as the hand went (moved ${dx.toFixed(2)}, ${dz.toFixed(2)})`);
await until(() => window.__specs.player.state.speed < 0.05, null, 30000);
console.log(`✔ pinch and drag: walked ${Math.hypot(dx, dz).toFixed(1)} m the way the hand moved`);

// A quick pinch at a door: trick or treat, then the house cools down.
const door = await G(() => { const s = window.__specs, h = s.houses[2]; s.player.place(h.door.x, h.door.z, Math.atan2(h.x - h.door.x, h.z - h.door.z) * 57.2958); return h.id; });
await page.waitForTimeout(1500);
const hintOn = await G(() => window.__specs.panels.hint.visible);
await pinch(1); await page.waitForTimeout(500); await pinch(0);
const cool = await (await until((i) => { const c = (window.__specs.view.houses[i] ?? 0) - performance.now() / 1000; return c > 0 ? c : null; }, door, 30000)).jsonValue();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/s4-door.png` });
assert.ok(hintOn, 'a hint shows at the door');
console.log(`✔ quick pinch at a door: knocked, the house cools down ${cool.toFixed(1)} s`);

// The end of the night: results in front of the player; a quick pinch plays again.
await G(() => window.__specs.skip(Math.max(0, 180.2 - window.__specs.view.rt())));
await until(() => window.__specs.state === 'results' && window.__specs.panels.results.visible, null, 30000);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/s5-results.png` });
const round = await G(() => window.__specs.view.round);
await pinch(1); await page.waitForTimeout(500); await pinch(0);
await until((r) => window.__specs.state === 'game' && window.__specs.view.round > r, round, 30000);
console.log('✔ results, then a quick pinch: another night');

// A long still pinch on the results: back to the page menu, the best kept.
await G(() => window.__specs.skip(Math.max(0, 180.2 - window.__specs.view.rt())));
await until(() => window.__specs.state === 'results', null, 30000);
await pinch(1);
await until(() => window.__specs.hands.held > 0.4, null, 60000);
await page.screenshot({ path: `${out}/s6-hold.png` });
await until(() => !window.__specs.app.xr.active, null, 60000);
await pinch(0);
await until(() => !document.getElementById('menu').classList.contains('hidden'), null, 10000);
const saved = await G(() => JSON.parse(localStorage.getItem('trick-or-treat-rush-specs')));
assert.equal(saved.level, 'easy');
assert.ok('easy' in saved.bests, 'the best of the night is kept on the glasses');
console.log(`✔ long pinch: session over, back to the menu (best on easy: ${saved.bests.easy})`);

const bad = errors.filter((e) => !/favicon|404/.test(e));
assert.deepEqual(bad, [], 'no errors');
console.log('Specs (emulated) test passed');
await browser.close();
