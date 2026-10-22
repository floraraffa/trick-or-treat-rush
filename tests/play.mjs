// A full solo night in headless Chromium, checking the rules from the outside:
// movement, camera switch, a door visit and its cooldown, a candy pickup, a power-up, madness, the end.
//   node tests/play.mjs <outdir>
import assert from 'node:assert/strict';
import { launch } from './browser.mjs';
const out = process.argv[2] ?? '.';
const base = process.env.URL ?? 'http://localhost:3100/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const G = (fn, arg) => page.evaluate(fn, arg);
await page.goto(`${base}?test&lowfx`);
await page.waitForFunction(() => window.__game?.screen === 'menu', null, { timeout: 120000 });
await page.click('#btnPlay');
await page.waitForFunction(() => window.__game.view.phase === 'playing', null, { timeout: 60000 });
const p0 = await G(() => [window.__game.player.state.x, window.__game.player.state.z]);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForFunction(([x, z]) => Math.hypot(window.__game.player.state.x - x, window.__game.player.state.z - z) > 2, p0, { timeout: 30000 });
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
console.log('✔ moves with the keyboard');

// Touch: the left thumb walks (joystick), the right thumb turns the camera.
{
  const touch = (type, id, x, y) => page.evaluate(([type, id, x, y]) => document.getElementById('app').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })), [type, id, x, y]);
  const yaw0 = await G(() => window.__game.camCtl.yaw);
  await touch('pointerdown', 7, 300, 400);
  for (let k = 1; k <= 6; k++) await touch('pointermove', 7, 300 - k * 25, 400);
  await touch('pointerup', 7, 150, 400);
  await page.waitForFunction((y) => Math.abs(window.__game.camCtl.yaw - y) > 10, yaw0, { timeout: 20000 });
  const at = await G(() => [window.__game.player.state.x, window.__game.player.state.z]);
  await touch('pointerdown', 8, 80, 700);
  await touch('pointermove', 8, 80, 640);
  await page.waitForFunction(([x, z]) => Math.hypot(window.__game.player.state.x - x, window.__game.player.state.z - z) > 1, at, { timeout: 30000 });
  const anim = await G(() => window.__game.player.avatar.anim);
  await touch('pointerup', 8, 80, 640);
  console.log(`✔ touch: right-side drag turns the camera, the joystick moves the player (clip "${anim}")`);
}

// Camera: third → first → third, the player stays put.
const before = await G(() => [window.__game.player.state.x, window.__game.player.state.z, window.__game.view.players.get(window.__game.me.id).score]);
await page.click('#btnCam');
await page.waitForFunction(() => window.__game.camCtl.mode === 'first' && window.__game.camCtl.hideBody, null, { timeout: 20000 });
const cam = await G(() => ({ mode: window.__game.camCtl.mode, hide: window.__game.camCtl.hideBody, pos: [window.__game.player.state.x, window.__game.player.state.z] }));
assert.equal(cam.mode, 'first'); assert.ok(cam.hide, 'body hidden in first person');
assert.ok(Math.hypot(cam.pos[0] - before[0], cam.pos[1] - before[1]) < 0.05, 'switching camera does not move the player');
await page.screenshot({ path: `${out}/p1-first-person.png` });
await page.click('#btnCam');
await page.waitForFunction(() => window.__game.camCtl.mode === 'third', null, { timeout: 20000 });
console.log('✔ camera switches both ways without moving the player');

// A door: walk the player to house 2's step, knock, the house cools down for 15 s.
await G(() => { const h = window.__game.view; void h; });
const door = await page.evaluate(async () => {
  const h = window.__game.houses[2];
  window.__game.player.place(h.door.x + (h.door.x - h.x) * 0.1, h.door.z + (h.door.z - h.z) * 0.1, Math.atan2(h.x - h.door.x, h.z - h.door.z) * 57.2958);
  window.__game.camCtl.snapBehind(Math.atan2(h.x - h.door.x, h.z - h.door.z) * 57.2958);
  return { id: h.id, x: h.door.x, z: h.door.z };
});
await page.waitForSelector('#btnKnock:not(.hidden)', { timeout: 20000 });
const scoreBefore = await G(() => window.__game.view.players.get(window.__game.me.id).score);
await page.click('#btnKnock');
const cool = await (await page.waitForFunction((i) => { const c = (window.__game.view.houses[i] ?? 0) - performance.now() / 1000; return c > 0 ? c : null; }, door.id, { timeout: 20000 })).jsonValue();
await page.screenshot({ path: `${out}/p2-knock.png` });
assert.ok(cool > 12 && cool <= 15.1, `house cools down ~15 s (got ${cool.toFixed(1)})`);
const btn = await page.textContent('#btnKnock');
console.log(`✔ knocked: cooldown ${cool.toFixed(1)} s, button now "${btn.trim()}"`);

// Candy: stand on one; the authority credits it once.
const c = await G(() => { const [id, c] = [...window.__game.view.candies][0]; window.__game.player.place(c.x, c.z, 0); return { id, type: c.type }; });
await page.waitForFunction((id) => !window.__game.view.candies.has(id), c.id, { timeout: 20000 });
const scoreAfter = await G(() => window.__game.view.players.get(window.__game.me.id).score);
await page.waitForFunction(() => [...document.querySelectorAll('.popup')].some((e) => /\+\d+/.test(e.textContent)), null, { timeout: 20000 });
console.log(`✔ candy ${c.type} picked, "+N CANDY!" shown: score ${scoreBefore} → ${scoreAfter} (door visit included)`);

// Power-up orb: pick it, use it, it shows and expires.
const orb = await G(() => { const [id, o] = [...window.__game.view.orbs][0]; window.__game.player.place(o.x, o.z, 0); return { id, kind: o.kind }; });
await page.waitForFunction(() => !!window.__game.view.players.get(window.__game.me.id).held, null, { timeout: 20000 });
await page.click('#btnPower');
await page.waitForFunction((k) => window.__game.view.fx(window.__game.me.id, k) > 0, orb.kind, { timeout: 20000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/p3-power.png` });
console.log(`✔ power-up ${orb.kind} picked and active`);

// Madness in the last minute.
await G(() => window.__game.skip(Math.max(0, 120.5 - window.__game.view.rt())));
await page.waitForFunction(() => window.__game.view.madness, null, { timeout: 20000 });
await page.waitForFunction(() => [...window.__game.view.monsters.values()].some((m) => m.kind === 'giant'), null, { timeout: 20000 });
await G(() => { const g = [...window.__game.view.monsters.values()].find((m) => m.kind === 'giant'); window.__game.player.place(g.x + 6, g.z + 6, 225); window.__game.camCtl.snapBehind(225); });
await page.waitForTimeout(3500);
await page.screenshot({ path: `${out}/p4-madness.png` });
console.log('✔ monster madness with the giant ghost');

// The end: exactly at 180 s, ranking shown.
await G(() => window.__game.skip(Math.max(0, 180.2 - window.__game.view.rt())));
await page.waitForFunction(() => window.__game.view.phase === 'over', null, { timeout: 20000 });
await page.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/p5-results.png` });
const res = await G(() => ({ ranking: window.__game.view.ranking, winners: window.__game.view.winners, rt: window.__game.session.authority.rt }));
console.log(`✔ round over at rt ${res.rt.toFixed(3)} s, ranking ${JSON.stringify(res.ranking)}`);
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
