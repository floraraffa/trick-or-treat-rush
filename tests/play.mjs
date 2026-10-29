// Solo nights in headless Chromium, checking the rules from the outside. The nights: PLAY opens them, the
// first open and the rest locked, a night of 1:30 with only its own skill, its stars and the next night opened,
// NEXT NIGHT, the boo button and "Boo!" on its night. Then a full 3-minute round of the shared rules (as the
// Specs WebXR version still plays them): movement and running on its own, camera switch, a door visit and its
// cooldown, a candy pickup, a power-up, the cries, candy rain, gems (a ghost floats through a house), madness, the end.
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
// The language picker: the menu changes language at once (and back to English for the rest of the night).
for (const [l, word] of [['de', 'SPIELEN'], ['fr', 'JOUER'], ['es', 'JUGAR'], ['en', 'PLAY']]) {
  await page.click(`#langs button[data-id="${l}"]`);
  await page.waitForFunction((w) => document.getElementById('btnPlay').textContent === w && document.documentElement.lang, word, { timeout: 10000 });
}
console.log('✔ language picker: Deutsch, Français, Español, English');
await page.click('#btnPlay');
// The first night opens the tutorial: picture cards with one line each; the last one starts the night.
await page.waitForFunction(() => !document.getElementById('how').classList.contains('hidden'), null, { timeout: 10000 });
const cards = await G(() => document.querySelectorAll('#tutDots button').length);
assert.equal(cards, 8, 'eight cards (move, camera, knock, candy, monsters, powers, candy storm, win)');
for (let i = 0; i < cards; i++) {
  const c = await G(() => ({ art: document.querySelector('#tutStep .art')?.children.length ?? 0, text: document.querySelector('#tutStep .tutText')?.textContent.length ?? 0, last: document.getElementById('btnTutSkip').classList.contains('hidden') }));
  assert.ok(c.art > 0 && c.text > 10, `card ${i + 1} has a picture and a line`);
  assert.equal(c.last, i === cards - 1, 'SKIP on every card but the last');
  await page.click('#btnTutNext');
}
console.log(`✔ tutorial: the first PLAY shows ${cards} picture cards, then the nights`);

// The nights: eight tiles, the first open; a locked one says why; PLAY starts the night picked.
await page.waitForFunction(() => !document.getElementById('nights').classList.contains('hidden'), null, { timeout: 10000 });
const tiles = await G(() => [...document.querySelectorAll('#nightGrid .nightTile')].map((b) => ({ n: b.textContent.trim()[0], lock: b.classList.contains('lock'), on: b.classList.contains('on') })));
assert.equal(tiles.length, 8, 'eight nights');
assert.ok(!tiles[0].lock && tiles[0].on && tiles.slice(1).every((x) => x.lock), 'the first open and picked, the rest locked');
await page.click('#nightGrid .nightTile[data-n="2"]');
await page.waitForFunction(() => [...document.querySelectorAll('#popups .popup')].some((p) => /2/.test(p.textContent)), null, { timeout: 5000 }); // ("play night 2 to open this one")
assert.ok(await G(() => document.querySelector('#nightGrid .nightTile[data-n="0"]').classList.contains('on')), "a locked night can't be picked");
const info = await G(() => ({ name: document.getElementById('nightName').textContent, goals: document.getElementById('nightGoals').textContent }));
assert.ok(/1/.test(info.name) && /70/.test(info.goals) && /150/.test(info.goals), `the night's skill and its stars (${info.name} · ${info.goals})`);
await page.click('#btnNightPlay');
await page.waitForFunction(() => window.__game.screen === 'game' && window.__game.view.night === 0, null, { timeout: 30000 });
await page.waitForFunction(() => /^01:(30|2\d)$/.test(document.getElementById('timer').textContent), null, { timeout: 10000 }); // (the HUD's first frame)
const t0 = await G(() => ({ secs: window.__game.view.seconds, timer: document.getElementById('timer').textContent, skills: [...window.__game.view.skills] }));
assert.ok(t0.secs === 90 && /^01:(30|2\d)$/.test(t0.timer) && t0.skills.join() === 'knock', `a minute and a half, only its own skill (${t0.timer}, ${t0.skills})`);
await page.waitForFunction(() => window.__game.view.phase === 'playing', null, { timeout: 60000 });
await page.waitForFunction(() => /!/.test(document.getElementById('banner').textContent) && document.getElementById('banner').classList.contains('show') && document.querySelector('#banner small')?.textContent.length > 20, null, { timeout: 10000 });
assert.equal(await G(() => window.__game.view.orbs.size), 0, 'no power-up orbs on the first night');
assert.ok(await G(() => document.getElementById('btnBoo').classList.contains('hidden')), 'no boo button yet');
// Running on its own is the game's, from the first night: keep going one way and the Bitmoji breaks into a run.
await G(() => { const g = window.__game, A = g.session.authority; g.player.place(0, 9, 0); g.camCtl.snapBehind(0); A.players.get(g.me.id).inv = A.rt + 60; });
await page.keyboard.down('KeyW');
const run1 = await (await page.waitForFunction(() => { const s = window.__game.player.state; return s.sprinting && s.speed > 6.5 ? s.speed : null; }, null, { timeout: 80000 })).jsonValue();
await page.keyboard.up('KeyW');
console.log(`✔ the first night: running on its own (${run1.toFixed(1)} m/s)`);
const two = await G(() => { const g = window.__game, A = g.session.authority, s = 85, p = A.players.get(g.me.id); p.score = s; p.inv = 1e9; g.skip(91); return s; }); // (no monster takes any meanwhile)
await page.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 20000 });
await page.waitForTimeout(2200);
const r1 = await G(() => ({ stars: [...document.querySelectorAll('#resStars span')].map((s) => s.classList.contains('on')), king: document.getElementById('resKing').textContent, next: !document.getElementById('btnNext').classList.contains('hidden'), camp: JSON.parse(JSON.stringify(window.__game.camp)) }));
assert.deepEqual(r1.stars, [true, true, false], `${two} candy: two stars`);
assert.ok(/2/.test(r1.king) && r1.next && r1.camp.nights[0].stars === 2, `night 2 opens, NEXT NIGHT (${r1.king})`);
await page.screenshot({ path: `${out}/p0-night-results.png` });
await page.click('#btnNext');
await page.waitForFunction(() => window.__game.screen === 'game' && window.__game.view.night === 1, null, { timeout: 30000 });
assert.ok(await G(() => window.__game.view.skills.has('powers')), 'the second night: the power-up orbs');
console.log(`✔ nights: eight, the first open; 1:30 with its own skill; ${two} candy = 2 stars, night 2 opens; NEXT NIGHT`);

// The boo night: its button, "Boo!", the monsters near run off; a giant says "Boo!" too.
await G(() => window.__game.skip(91)); // (the second night played: the third, the boo night, opens)
await page.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 20000 });
await page.click('#btnMenu'); await page.click('#btnPlay');
await page.click('#nightGrid .nightTile[data-n="2"]');
await page.click('#btnNightPlay');
await page.waitForFunction(() => window.__game.view.night === 2 && window.__game.view.phase === 'playing', null, { timeout: 60000 });
await page.waitForFunction(() => !document.getElementById('btnBoo').classList.contains('hidden'), null, { timeout: 5000 });
await page.waitForTimeout(1500);
await page.click('#btnBoo');
await page.waitForFunction(() => window.__game.view.boo(window.__game.me.id) > 10 && window.__game.lastCry() === 'boo', null, { timeout: 10000 });
await page.waitForFunction(() => /\d+s/.test(document.getElementById('booLbl').textContent), null, { timeout: 5000 });
await page.waitForTimeout(1800); // (a grab's cry waits 1.5 s after the last cry)
await G(() => { const g = window.__game, A = g.session.authority; A.emit({ e: 'hit', id: g.me.id, by: 'ghost', mon: A.monsters[0].id, delta: 0 }); });
await page.waitForFunction(() => /^(aah|scream)/.test(window.__game.lastCry()), null, { timeout: 10000 });
await page.waitForTimeout(1000);
await G(() => { const g = window.__game, A = g.session.authority, me = A.players.get(g.me.id); me.fx.giant = A.rt + 5; A.emit({ e: 'gem-', id: 'test', by: g.me.id, kind: 'giant', until: me.fx.giant }); });
await page.waitForFunction(() => window.__game.lastCry() === 'boo', null, { timeout: 10000 });
console.log('✔ the boo night: the BOO! button, "Boo!" and its wait; a giant says "Boo!"');
await G(() => window.__game.skip(91));
await page.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 20000 });

// The shared rules' full round (3 minutes, the levels' rules): started through the session.
await G(() => { const s = window.__game.session; s.setNight(null); s.startRound(); });
await page.waitForFunction(() => window.__game.view.night == null && window.__game.view.phase === 'playing', null, { timeout: 60000 });
const p0 = await G(() => [window.__game.player.state.x, window.__game.player.state.z]);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForFunction(([x, z]) => Math.hypot(window.__game.player.state.x - x, window.__game.player.state.z - z) > 2, p0, { timeout: 30000 });
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
console.log('✔ moves with the keyboard');

// Running on its own: keep walking the same way (W alone walks) and the Bitmoji breaks into a sprint.
assert.equal(await page.$('#btnSprint'), null, 'no SPRINT button any more');
await page.waitForFunction(() => window.__game.player.state.speed < 0.05, null, { timeout: 30000 });
await G(() => { const g = window.__game, A = g.session.authority; g.player.place(0, 9, 0); g.camCtl.snapBehind(0); A.players.get(g.me.id).inv = A.rt + 60; }); // up the south street (protected: a slow software-WebGL frame rate lets the monsters catch up)
await page.keyboard.down('KeyW');
const walk = await (await page.waitForFunction(() => { const s = window.__game.player.state; return s.speed > 1.5 ? s.speed : null; }, null, { timeout: 60000 })).jsonValue();
const sprint = await (await page.waitForFunction(() => { const s = window.__game.player.state; return s.sprinting && s.speed > 6.5 ? { speed: s.speed, run: s.run } : null; }, null, { timeout: 90000 })).jsonValue();
await page.keyboard.up('KeyW');
await G(() => { const g = window.__game; g.session.authority.players.get(g.me.id).inv = 0; });
assert.ok(walk < 3, `starts at a walk (${walk.toFixed(1)} m/s)`);
console.log(`✔ runs on its own: walk ${walk.toFixed(1)} m/s → ${sprint.speed.toFixed(1)} m/s after ${sprint.run.toFixed(1)} s going the same way`);

// Touch: the left thumb walks (joystick), the right thumb turns the camera.
{
  const touch = (type, id, x, y) => page.evaluate(([type, id, x, y]) => document.getElementById('app').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })), [type, id, x, y]);
  const yaw0 = await G(() => window.__game.camCtl.yaw);
  await touch('pointerdown', 7, 300, 400);
  for (let k = 1; k <= 6; k++) await touch('pointermove', 7, 300 - k * 25, 400);
  await touch('pointerup', 7, 150, 400);
  await page.waitForFunction((y) => Math.abs(window.__game.camCtl.yaw - y) > 10, yaw0, { timeout: 60000 });
  const at = await G(() => [window.__game.player.state.x, window.__game.player.state.z]);
  await touch('pointerdown', 8, 80, 700);
  await touch('pointermove', 8, 80, 640);
  await page.waitForFunction(([x, z]) => Math.hypot(window.__game.player.state.x - x, window.__game.player.state.z - z) > 1, at, { timeout: 60000 });
  const anim = await G(() => window.__game.player.avatar.anim);
  await touch('pointerup', 8, 80, 640);
  console.log(`✔ touch: right-side drag turns the camera, the joystick moves the player (clip "${anim}")`);
}

// Camera: third → first → third, the player stays put (measured once they have come to a stop).
await page.waitForFunction(() => window.__game.player.state.speed < 0.01, null, { timeout: 60000 });
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

// Candy: stand on one; the authority credits it once. (Popups are recorded as they appear: each lives about a
// second, which a slow software-WebGL frame rate can let slip by between checks.)
await G(() => { window.__popups = []; new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.classList?.contains('popup') && window.__popups.push(n.textContent)))).observe(document.getElementById('popups'), { childList: true }); });
const c = await G(() => { const [id, c] = [...window.__game.view.candies][0]; window.__game.player.place(c.x, c.z, 0); return { id, type: c.type }; });
await page.waitForFunction((id) => !window.__game.view.candies.has(id), c.id, { timeout: 60000 });
const scoreAfter = await G(() => window.__game.view.players.get(window.__game.me.id).score);
await page.waitForFunction(() => window.__popups.some((t) => /\+\d+/.test(t)), null, { timeout: 20000 });
console.log(`✔ candy ${c.type} picked, "+N CANDY!" shown: score ${scoreBefore} → ${scoreAfter} (door visit included)`);

// Power-up orb: pick it, use it, it shows and expires.
const orb = await G(() => { const [id, o] = [...window.__game.view.orbs][0]; window.__game.player.place(o.x, o.z, 0); return { id, kind: o.kind }; });
await page.waitForFunction(() => !!window.__game.view.players.get(window.__game.me.id).held, null, { timeout: 20000 });
await page.click('#btnPower');
await page.waitForFunction((k) => window.__game.view.fx(window.__game.me.id, k) > 0, orb.kind, { timeout: 20000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/p3-power.png` });
console.log(`✔ power-up ${orb.kind} picked and active`);

// The Bitmoji cries out (the MP3 cries, decoded): a monster spots it ("oh no" / "Nooo"), then it is grabbed.
await G(() => { const g = window.__game, A = g.session.authority; A.players.get(g.me.id).inv = A.rt + 30; }); // (no real monster meanwhile)
await page.waitForTimeout(6500); // (a spotted cry waits 6 s after the last: the nights' cries above)
await G(() => { const g = window.__game, A = g.session.authority, m = A.monsters[0]; A.emit({ e: 'spot', id: m.id, target: g.me.id }); });
const spotted = await (await page.waitForFunction(() => /^(ohno|nooo)$/.test(window.__game.lastCry()) && window.__game.lastCry(), null, { timeout: 10000 })).jsonValue();
await page.waitForTimeout(1800); // (one cry at a time: "oh no, oh no!" lasts 1.6 s)
await G(() => { const g = window.__game, A = g.session.authority; A.emit({ e: 'hit', id: g.me.id, by: 'ghost', mon: A.monsters[0].id, delta: 0 }); });
const grabbed = await (await page.waitForFunction(() => /^(aah-\d|scream)$/.test(window.__game.lastCry()) && window.__game.lastCry(), null, { timeout: 10000 })).jsonValue();
console.log(`✔ the Bitmoji cries out: spotted "${spotted}", grabbed "${grabbed}"`);

// Candy rain: candy falls from the sky round the player, and can be picked up once it has landed.
await page.waitForFunction(() => !window.__game.view.players.get(window.__game.me.id).held, null, { timeout: 20000 });
await G(() => { const g = window.__game; g.player.place(0, 9, 0); g.session.authority.players.get(g.me.id).held = 'rain'; });
await page.waitForFunction(() => window.__game.view.players.get(window.__game.me.id).held === 'rain', null, { timeout: 20000 });
await page.click('#btnPower');
const drop = await (await page.waitForFunction(() => { const c = [...window.__game.view.candies.values()].find((k) => k.fall); return c ? { id: c.id, x: c.x, z: c.z } : null; }, null, { timeout: 30000 })).jsonValue();
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/p3b-rain.png` });
// (in a heavy storm the player may scoop it up on the spot: then it's gone already)
await page.waitForFunction((id) => { const c = window.__game.view.candies.get(id); return !c || performance.now() / 1000 - c.born > 1.4; }, drop.id, { timeout: 30000 });
const scoreRain = await G(() => window.__game.view.players.get(window.__game.me.id).score);
await G((c) => window.__game.player.place(c.x, c.z, 0), drop);
await page.waitForFunction((id) => !window.__game.view.candies.has(id), drop.id, { timeout: 60000 });
await page.waitForTimeout(1500);
const fallen = await G(() => [...window.__game.view.candies.values()].filter((k) => k.fall).length);
const scoreRain2 = await G(() => window.__game.view.players.get(window.__game.me.id).score);
assert.ok(fallen >= 5, `a downpour, not a drizzle (${fallen} storm pieces out)`);
console.log(`✔ candy storm: a piece fell ${Math.hypot(drop.x, drop.z - 9).toFixed(1)} m away and was picked up once landed; ${fallen} more falling or waiting; score ${scoreRain} → ${scoreRain2}`);

// Ghost: the Bitmoji turns ghostly and floats through a house.
{
  await G(() => { const g = window.__game; g.session.authority.players.get(g.me.id).fx.ghost = g.session.authority.rt + 20; });
  await page.waitForFunction(() => window.__game.player.avatar.ghost, null, { timeout: 20000 });
  const h = await G(() => { const h = window.__game.houses[5], yaw = Math.atan2(h.x - h.door.x, h.z - h.door.z) * 57.2958; window.__game.player.place(h.door.x, h.door.z, yaw); window.__game.camCtl.snapBehind(yaw); return { x: h.x, z: h.z }; });
  await page.waitForFunction(() => window.__game.player.avatar.ghost, null, { timeout: 20000 });
  await page.keyboard.down('KeyW');
  await page.waitForFunction((c) => Math.hypot(window.__game.player.state.x - c.x, window.__game.player.state.z - c.z) < 1, h, { timeout: 90000 });
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: `${out}/p3c-ghost.png` });
  await G(() => { const g = window.__game; delete g.session.authority.players.get(g.me.id).fx.ghost; });
  await page.waitForFunction(() => !window.__game.player.avatar.ghost, null, { timeout: 20000 });
  await page.keyboard.down('KeyS'); await page.waitForTimeout(300); await page.keyboard.up('KeyS'); // solid again: pushed back out of the walls
  await page.waitForFunction((c) => Math.hypot(window.__game.player.state.x - c.x, window.__game.player.state.z - c.z) > 1.5, h, { timeout: 60000 });
  console.log('✔ ghost: the Bitmoji turns ghostly, floats into a house, and is solid again afterwards');
}

// A trick's swarm: six or more monsters burst out of a door, each drawn on this device (forced through the
// authority, since a knock's outcome is random).
{
  const before = await G(() => window.__game.view.monsters.size);
  const n = await G(() => {
    const g = window.__game, h = g.houses[2], A = g.session.authority, ox = h.door.x - h.x, oz = h.door.z - h.z, l = Math.hypot(ox, oz), yaw = Math.atan2(-ox, -oz) * 57.2958;
    g.player.place(h.door.x + (ox / l) * 7, h.door.z + (oz / l) * 7, yaw); g.camCtl.snapBehind(yaw);
    const p = A.players.get(g.me.id); p.inv = A.rt + 30; // (watch them come, don't get caught)
    A.swarm(p, h);
    return A.D.swarm.count;
  });
  assert.ok(n >= 6);
  await page.waitForFunction((k) => window.__game.view.monsters.size >= k, before + n, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/p3d-swarm.png` });
  await G(() => { const A = window.__game.session.authority; for (const m of A.monsters.filter((o) => o.trick)) A.removeMonster(m); A.players.get(window.__game.me.id).inv = 0; });
  await page.waitForFunction((k) => window.__game.view.monsters.size <= k, before, { timeout: 20000 });
  console.log(`✔ trick swarm: ${n} monsters burst out of the door and are drawn (${before} → ${before + n} monsters), then go`);
}

// A gem: wait for one, walk onto it, get its power (a giant grows).
await G(() => window.__game.skip(Math.max(0, 11 - window.__game.view.rt())));
const gem = await (await page.waitForFunction(() => { const g = [...window.__game.view.gems.values()][0]; return g ? { id: g.id, kind: g.kind, x: g.x, z: g.z } : null; }, null, { timeout: 60000 })).jsonValue();
await G((g) => window.__game.player.place(g.x, g.z, 0), gem);
await page.waitForFunction((k) => window.__game.view.fx(window.__game.me.id, k) > 0, gem.kind, { timeout: 60000 });
const grown = gem.kind === 'giant' ? await (await page.waitForFunction(() => { const k = window.__game.player.state.scale; return k > 1.6 ? k : null; }, null, { timeout: 60000 })).jsonValue() : null;
if (gem.kind === 'ghost') await page.waitForFunction(() => window.__game.player.avatar.ghost, null, { timeout: 20000 });
await page.screenshot({ path: `${out}/p4-gem.png` });
console.log(`✔ gem ${gem.kind}: power on${grown ? `, grew to ×${grown.toFixed(2)}` : ''}`);

// Madness in the last minute (no giant ghost any more).
await G(() => window.__game.skip(Math.max(0, 120.5 - window.__game.view.rt())));
await page.waitForFunction(() => window.__game.view.madness, null, { timeout: 20000 });
await page.waitForTimeout(2500);
assert.ok(!(await G(() => [...window.__game.view.monsters.values()].some((m) => m.kind === 'giant'))), 'no giant ghost');
await page.screenshot({ path: `${out}/p5-madness.png` });
console.log('✔ monster madness, no giant ghost');

// The end: exactly at 180 s, ranking shown.
await G(() => window.__game.skip(Math.max(0, 180.2 - window.__game.view.rt())));
await page.waitForFunction(() => window.__game.view.phase === 'over', null, { timeout: 20000 });
await page.waitForFunction(() => window.__game.screen === 'results', null, { timeout: 20000 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/p6-results.png` });
const res = await G(() => ({ ranking: window.__game.view.ranking, winners: window.__game.view.winners, rt: window.__game.session.authority.rt }));
console.log(`✔ round over at rt ${res.rt.toFixed(3)} s, ranking ${JSON.stringify(res.ranking)}`);
console.log(errors.length ? `errors:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
