// The store preview video: a 9-second vertical clip (720×1280, 30 fps) of the real game, shot by shot, for
// My Lenses. Needs the dev server (npm run dev) and ffmpeg.
//   URL=http://localhost:3100/ node tools/make-preview.mjs [out.mp4] [--lang en] [--every N]
// The page runs on a virtual clock: every frame advances exactly 1/30 s of game time (the game's own clock,
// its timers and the page's CSS animations) and is then captured, so the clip is smooth however slowly the
// machine renders (software WebGL here manages a few frames a second). --every N captures only every Nth
// frame, as stills, for a quick look at the framing.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from '../tests/browser.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const out = args[0] && !args[0].startsWith('--') ? args[0] : 'art/store/preview.mp4';
const lang = opt('lang', 'en'), every = +opt('every', 0), base = process.env.URL ?? 'http://localhost:3100/';
const FPS = 30, STEP = 1000 / FPS;
const frames = join(process.env.TMPDIR ?? '/tmp', 'tot-preview');
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

/** Runs in the page before anything else: time only moves when the tool says so. */
function virtualClock(save) {
  try { localStorage.setItem('trick-or-treat-rush-save', JSON.stringify(save)); } catch { /* no storage: defaults */ }
  let now = 0, rafs = [], timers = new Map(), seq = 0;
  const t0 = Date.now();
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.requestAnimationFrame = (cb) => { rafs.push([++seq, cb]); return seq; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter(([i]) => i !== id); };
  window.setTimeout = (fn, ms = 0, ...a) => { timers.set(++seq, { at: now + Math.max(0, +ms || 0), fn, a }); return seq; };
  window.setInterval = (fn, ms = 0, ...a) => { timers.set(++seq, { at: now + Math.max(1, +ms || 0), fn, a, every: Math.max(1, +ms || 0) }); return seq; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.__vt = {
    step(ms) {
      const end = now + ms;
      for (;;) { // due timers, in order
        let next = null;
        for (const [id, t] of timers) if (t.at <= end && (!next || t.at < next[1].at)) next = [id, t];
        if (!next) break;
        const [id, t] = next;
        now = Math.max(now, t.at);
        if (t.every) t.at += t.every; else timers.delete(id);
        try { if (typeof t.fn === 'function') t.fn(...t.a); } catch (e) { console.error(e); }
      }
      now = end;
      const list = rafs;
      rafs = [];
      for (const [, cb] of list) { try { cb(now); } catch (e) { console.error(e); } }
      for (const an of document.getAnimations()) { // CSS animations and transitions on the same clock
        if (!an.__vt) { an.__vt = true; an.pause(); an.currentTime = 0; } else an.currentTime = (an.currentTime ?? 0) + ms;
      }
      return now;
    },
  };
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(virtualClock, { tutorial: true, lang, costume: 'witch', level: 'medium', camera: 'third', best: 0, bests: {}, nights: [] });
await page.goto(`${base}?test&lang=${lang}`);
const G = (fn, arg) => page.evaluate(fn, arg);
// Unfilmed time isn't drawn (software WebGL takes seconds a frame, and queued frames would pile up).
const step = (n = 1, draw = false) => G(([k, d]) => { if (window.__game) window.__game.app.autoRender = d; for (let i = 0; i < k; i++) window.__vt.step(1000 / 30); }, [n, draw]);

/** Lets game time run (not filmed) until `cond` holds, giving the page real time for loading as it goes. */
async function until(cond, arg, max = 3000) {
  for (let i = 0; i < max; i++) {
    if (await G(cond, arg).catch(() => false)) return;
    await step(1);
    await page.waitForTimeout(15);
  }
  throw new Error(`timed out waiting for ${cond}`);
}
let frame = 0;
/** Films n frames; `each(i)` runs before frame i (key presses, cues). A few frames are drawn unfilmed first, so
 * the camera and the HUD have caught up with whatever the shot's setup changed. */
async function film(n, each = null) {
  await step(3, true);
  for (let i = 0; i < n; i++) {
    if (each) await each(i);
    const keep = !every || frame % every === 0;
    await step(1, keep);
    if (keep) await page.screenshot({ path: join(frames, `f${String(frame).padStart(4, '0')}.png`), timeout: 300000 });
    frame++;
  }
}

await until(() => window.__game?.screen === 'menu');
await until(() => document.fonts?.status === 'loaded');
for (let i = 0; i < 40; i++) { await step(1); await page.waitForTimeout(25); } // textures and the Bitmoji settle

// 1 · The menu: title, the Bitmoji in its witch hat, PLAY. (1.2 s)
await film(36, async (i) => { if (i === 30) await page.click('#btnPlay'); });

// Into the night (not filmed): skip the countdown; load every creature's drawing once.
await until(() => window.__game.view.phase === 'countdown' || window.__game.view.phase === 'playing');
await G(() => window.__game.skip(3.2));
await until(() => window.__game.view.phase === 'playing');
for (let i = 0; i < 45; i++) await step(1); // GO! fades

// 2 · A sprint up the north street to the cemetery with the candy magnet: candy flies in from all round. (2.0 s)
await G(() => {
  const g = window.__game, A = g.session.authority, p = A.players.get(g.me.id);
  for (let k = 0; k < 12; k++) A.spawnCandy();
  g.player.place(0.6, -9.5, 180); g.camCtl.snapBehind(180);
  p.inv = A.rt + 60; p.held = 'magnet'; A.intent(g.me.id, { kind: 'use' });
});
for (let i = 0; i < 12; i++) await step(1);
await page.keyboard.down('KeyW');
await film(60);
await page.keyboard.up('KeyW');

// 3 · Trick! A knock at Widow's Spire, and the swarm bursts out of the door. (2.2 s)
await G(() => {
  const g = window.__game, A = g.session.authority, p = A.players.get(g.me.id), h = g.houses[2];
  delete p.fx.magnet;
  const ox = h.door.x - h.x, oz = h.door.z - h.z, l = Math.hypot(ox, oz), yaw = Math.atan2(-ox, -oz) * 57.2958;
  g.player.place(h.door.x + (ox / l) * 1.2, h.door.z + (oz / l) * 1.2, yaw); g.camCtl.snapBehind(yaw);
  A.houses[2].until = -1;
  const knock = A.knock.bind(A); // this knock's roll: a trick (not a robbing one)
  A.knock = (...a) => { const R = A.R, seq = [0.75, 0.5]; A.R = () => (seq.length ? seq.shift() : R()); try { knock(...a); } finally { A.R = R; A.knock = knock; } };
});
for (let i = 0; i < 20; i++) await step(1);
await film(66, async (i) => { if (i === 4) { await page.keyboard.down('KeyE'); } if (i === 6) await page.keyboard.up('KeyE'); });

// 4 · The candy storm: a thundercloud, lightning, candy pouring down round the player. (2.0 s)
await G(() => {
  const g = window.__game, A = g.session.authority, p = A.players.get(g.me.id);
  for (const m of A.monsters.filter((o) => o.trick)) A.removeMonster(m);
  g.player.place(0, 6.5, 0); g.camCtl.snapBehind(0);
  p.held = 'rain'; A.intent(g.me.id, { kind: 'use' });
});
for (let i = 0; i < 24; i++) await step(1);
await page.keyboard.down('KeyW');
await film(60);
await page.keyboard.up('KeyW');

// 5 · The giant gem: the Bitmoji grows house-high and strides at the creatures, who run. The camera (far back
// and high for a giant) looks south from over the open north street. (1.6 s)
await G(() => {
  const g = window.__game, A = g.session.authority, p = A.players.get(g.me.id);
  delete p.fx.rain;
  g.player.place(3.2, -2, 0); g.camCtl.snapBehind(0);
  const zs = A.monsters.filter((m) => m.kind === 'zombie').slice(0, 4);
  zs.forEach((m, k) => Object.assign(m, { x: 0.8 + k * 1.5, z: 7 + (k % 2) * 1.8, state: 'patrol', cool: 30 }));
});
for (let i = 0; i < 20; i++) await step(1);
await G(() => {
  const g = window.__game, A = g.session.authority, p = A.players.get(g.me.id);
  A.spawnGem();
  const gem = [...A.gems.values()].at(-1);
  Object.assign(gem, { kind: 'giant', x: p.x, z: p.z });
  A.intent(g.me.id, { kind: 'gem', id: gem.id });
});
await page.keyboard.down('KeyW');
await film(48);
await page.keyboard.up('KeyW');

console.log(`${frame} frames${every ? ` (every ${every}th kept)` : ''}${errors.length ? `; page errors: ${errors.join(' | ')}` : ''}`);
await browser.close();
if (!every) {
  mkdirSync(out.replace(/[^/]+$/, '') || '.', { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log(`wrote ${out} (${(frame / FPS).toFixed(1)} s)`);
} else console.log(`stills in ${frames}`);
