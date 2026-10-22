// Showcase screenshots for the README: node tests/showcase.mjs <outdir> (dev server on URL).
import { launch } from './browser.mjs';
const out = process.argv[2] ?? '.';
const base = process.env.URL ?? 'http://localhost:3100/';
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
const G = (fn, a) => page.evaluate(fn, a);
await page.goto(`${base}?test&costume=witch`, { timeout: 180000 });
await page.waitForFunction(() => window.__game?.screen === 'menu', null, { timeout: 180000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/1-menu.png` });
await page.click('#btnPlay');
await page.waitForFunction(() => window.__game.view.phase === 'playing', null, { timeout: 90000 });
await page.waitForTimeout(1500);
// Third person on the ring street, a house ahead, candy about.
const shot = async (name, setup, wait = 2500) => { await G(setup); await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}.png` }); };
const face = (h) => `const h = window.__game.houses[${h}]; const yaw = Math.atan2(h.x - h.door.x, h.z - h.door.z) * 57.2958;`;
await shot('2-third-person', new Function(`${face(3)} const x = h.door.x - (h.x - h.door.x) * 1.6, z = h.door.z - (h.z - h.door.z) * 1.6; window.__game.player.place(x, z, yaw); window.__game.camCtl.snapBehind(yaw); const c = [...window.__game.view.candies.values()]; c.slice(0, 3).forEach((k, i) => { k.x = x + Math.sin((yaw + 30 * (i - 1)) / 57.3) * (3 + i); k.z = z + Math.cos((yaw + 30 * (i - 1)) / 57.3) * (3 + i); });`));
await shot('3-knock', new Function(`${face(0)} window.__game.player.place(h.door.x, h.door.z, yaw); window.__game.camCtl.snapBehind(yaw + 25); window.__game.input.press('knock');`), 3500);
await G(() => window.__game.input.press('camera'));
await shot('4-first-person', new Function(`${face(6)} window.__game.player.place(h.door.x * 0.55, h.door.z * 0.55, yaw); window.__game.camCtl.snapBehind(yaw);`), 3000);
await G(() => window.__game.input.press('camera'));
await G(() => window.__game.skip(Math.max(0, 121 - window.__game.view.rt())));
await page.waitForFunction(() => window.__game.view.madness, null, { timeout: 90000 });
await shot('5-madness', () => { const g = [...window.__game.view.monsters.values()].find((m) => m.kind === 'ghost'); const x = g.x + 5, z = g.z + 14, yaw = Math.atan2(g.x - x, g.z - z) * 57.2958; window.__game.player.place(x, z, yaw); window.__game.camCtl.snapBehind(yaw); }, 900);
await browser.close();
