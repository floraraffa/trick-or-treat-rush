// Trick or Treat Rush for Snap Specs (and other see-through WebXR headsets): the same night, with the haunted
// village as a miniature on the table in front of you. Specs open it as a web page in their browser (WebXR,
// immersive AR); there is no Snapchat Lens API there, so the player is Snap's default Bitmoji and records stay
// on the glasses. Same rules, village, creatures and sound as the Lens (they are shared, not copied): only the
// view, the controls and the panels are the headset's own.
//   The miniature: the camera hangs from a rig scaled S times, so the world (built in metres) looks 1:S, both
//   eyes included; the rig follows the Bitmoji so it stays in the middle of the board.
//   Controls (hands.js): pinch and drag in the air to walk; a quick pinch knocks at a door or uses the power-up.
//   Only a round board of the village is drawn (BOARD.radius round the Bitmoji, a glowing rim at its edge):
//   the rest fades out, so the village is a diorama and never spills over the room.
//   Panels (panels.js): HUD, banners, hints and results drawn on canvases. The glasses see a small window of
//   the world, so the panels tag along with the gaze (they catch up when the head turns away).
// Dev: specs.html?emulate on the dev server emulates a headset with hands (IWER) for trying and testing.
import '@fontsource/griffy/latin-400.css';
import '@fontsource/mystery-quest/latin-400.css';
import { Application, Color, Entity, FILLMODE_FILL_WINDOW, Mesh, MeshInstance, Quat, RESOLUTION_AUTO, StandardMaterial, TONEMAP_NEUTRAL, TorusGeometry, Vec3, XRSPACE_LOCAL, XRTYPE_AR } from 'playcanvas';
import { createTextures } from '../textures.js';
import { createVillage } from '../world/village.js';
import { DOOR_RANGE, HOUSES } from '../world/layout.js';
import { createFx } from '../fx.js';
import { createAvatar } from '../actors/avatar.js';
import { createPlayer } from '../actors/player.js';
import { createMonsters } from '../actors/monsters.js';
import { createCandy } from '../actors/candy.js';
import { createAuras } from '../actors/effects.js';
import { createTransport } from '../net/transport.js';
import { Session } from '../net/session.js';
import { View, playerOf } from '../game/view.js';
import { DEFAULT_LEVEL, LEVELS, POSE_HZ, ROUND_SECONDS } from '../game/config.js';
import { music, musicMadness, sfx, unlockAudio } from '../audio.js';
import { LANGS, detectLang, getLang, setLang, t } from '../ui/i18n.js';
import { FLAGS } from '../ui/flags.js';
import { BODY_FONT, TITLE_FONT, createPanel, ink, plate } from './panels.js';
import { createHands } from './hands.js';

const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && params.has('emulate')) await import('./emulate.js'); // before the engine: it must see navigator.xr

const S = +params.get('scale') || 24; // the miniature: 1:S
const BOARD = { below: 0.45, ahead: 0.85, radius: 0.45 }; // where the Bitmoji stands, from the eyes at the start, and the board's size (metres)
const BRIGHT = +params.get('bright') || 1.7; // see-through glasses add light to the room (black is clear): lift the night
const $ = (id) => document.getElementById(id);

// --- save (on the glasses: no Snapchat storage here) ----------------------------------------
const SAVE_KEY = 'trick-or-treat-rush-specs';
let save = { level: DEFAULT_LEVEL, lang: null, bests: {} };
try { save = { ...save, ...JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') }; } catch { /* private mode: defaults */ }
const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* keep playing */ } };
if (!LEVELS.includes(save.level)) save.level = DEFAULT_LEVEL;
setLang(detectLang(params.get('lang') ?? save.lang));

// --- engine ---------------------------------------------------------------------------------
const canvas = $('app');
const app = new Application(canvas, { graphicsDeviceOptions: { alpha: true, antialias: true } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
addEventListener('resize', () => app.resizeCanvas());

const rig = new Entity('rig'); // the player's space: metres round their head (scaled S in the headset)
app.root.addChild(rig);
const camera = new Entity('camera');
const OPAQUE = new Color(0.04, 0.02, 0.07, 1), CLEAR = new Color(0, 0, 0, 0);
camera.addComponent('camera', { fov: 50, nearClip: 0.05, farClip: 500, clearColor: OPAQUE });
camera.camera.toneMapping = TONEMAP_NEUTRAL;
rig.addChild(camera);

const tex = createTextures(app.graphicsDevice);
const village = createVillage(app, tex, { lowFx: true });
app.root.addChild(village.root);
village.sky.root.enabled = false; // the room is the sky
app.scene.exposure = BRIGHT;
const fx = createFx(app, tex.glow, { max: 200 });
const sparks = createFx(app, tex.glow, { max: 260, additive: true });
for (const f of [fx, sparks]) app.root.addChild(f.entity);
const monsters = createMonsters(app, sparks);
app.root.addChild(monsters.root);
const candy = createCandy(app, tex, sparks, { cloudOver: (x, z) => auras.cloudOver(x, z) });
app.root.addChild(candy.root);
const auras = createAuras(app, sparks, {
  tex,
  onStrike({ x, z }) { // thunder by how near the lightning struck the Bitmoji
    if (state !== 'game') return;
    const d = Math.hypot(player.state.x - x, player.state.z - z), k = Math.max(0, 1 - d / 45);
    if (k > 0) sfx.thunder(k, d / 80);
  },
});
app.start();

// --- the night ------------------------------------------------------------------------------
const me = { id: `p${Math.random().toString(36).slice(2, 9)}`, name: 'Specs', costume: 'witch' };
const view = new View(me.id);
const session = new Session({ transport: createTransport(new URLSearchParams()), me }); // one player: the glasses run the night
session.setLevel(save.level);
session.on('event', onEvent);
session.on('snapshot', (s) => view.snapshot(s));
session.on('pose', (id, p) => view.pose(id, p));
const avatar = createAvatar(app, tex, { own: false, costume: me.costume });
app.root.addChild(avatar.root);
const player = createPlayer(avatar);
player.place(0, 6.2, 180);
const doors = HOUSES.map(() => ({ t: -1 }));
const houseReady = HOUSES.map(() => null);
let state = 'menu'; // menu | game | results
let poseT = 0, knockLock = 0, madK = 0, menuT = 0, lastTick = -1;

// --- the headset: rig, hands, panels -----------------------------------------------------------
const board = new Vec3(0, 0, 6.2); // the world point at the board's centre
const toUser = (w, out) => { const p = rig.getPosition(), k = 1 / rig.getLocalScale().x; return out.set((w.x - p.x) * k, (w.y - p.y) * k, (w.z - p.z) * k); };
const hands = createHands(app, toUser);
// The joystick's "forward" is away from the player, along the board (the rig never turns).
const steer = { mode: 'third', forward: () => [0, -1], right: () => [1, 0] };

// The board's rim: a thin glowing ring where the village fades out (in the player's space, under the Bitmoji).
const rimMat = new StandardMaterial();
rimMat.useLighting = false; rimMat.useFog = false; rimMat.useSkybox = false;
rimMat.diffuse = new Color(0, 0, 0); rimMat.emissive = new Color(1, 0.55, 0.16);
rimMat.update();
const rim = new Entity('board-rim');
rim.addComponent('render', { meshInstances: [new MeshInstance(Mesh.fromGeometry(app.graphicsDevice, new TorusGeometry({ ringRadius: BOARD.radius, tubeRadius: 0.0025, segments: 120, sides: 6 })), rimMat)], castShadows: false });
rim.setLocalPosition(0, -BOARD.below, -BOARD.ahead);
rim.enabled = false;
rig.addChild(rim);

// Panels hang from `face`, which tags along with the head: it stays put while the gaze wanders a little and
// catches up when it turns further (a small field of view: a fixed panel would soon be out of sight).
const face = new Entity('face');
rig.addChild(face);
const hud = createPanel(app, { width: 0.36, height: 0.06, name: 'hud' });
hud.entity.setLocalPosition(0, 0.15, -1);
const banner = createPanel(app, { width: 0.5, height: 0.15, name: 'banner', order: 2 });
banner.entity.setLocalPosition(0, 0.03, -1);
const toast = createPanel(app, { width: 0.3, height: 0.042, name: 'toast', order: 3 });
toast.entity.setLocalPosition(0, -0.065, -1);
const hint = createPanel(app, { width: 0.34, height: 0.045, name: 'hint' });
hint.entity.setLocalPosition(0, -0.14, -1);
const results = createPanel(app, { width: 0.46, height: 0.28, name: 'results' });
results.entity.setLocalPosition(0, 0, -1);
const panels = [hud, banner, hint, toast, results];
for (const p of panels) { face.addChild(p.entity); p.visible = false; }

const gaze = { yaw: 0, pitch: 0, follow: false };
const qYaw = new Quat(), qPitch = new Quat(), look = new Vec3();
/** Moves `face` after the head; `snap`: at once (the start of a session). */
function followHead(dt, snap = false) {
  camera.getLocalRotation().transformVector(Vec3.FORWARD, look);
  const yaw = Math.atan2(-look.x, -look.z) * 57.2958, pitch = Math.asin(Math.max(-1, Math.min(1, look.y))) * 57.2958;
  const dy = ((yaw - gaze.yaw + 540) % 360) - 180, dp = pitch - gaze.pitch;
  if (snap || Math.abs(dy) > 16 || Math.abs(dp) > 11) gaze.follow = true;
  if (gaze.follow) {
    const k = snap ? 1 : Math.min(1, dt * 4);
    gaze.yaw += dy * k; gaze.pitch += dp * k;
    if (Math.abs(dy) < 1.5 && Math.abs(dp) < 1.5) gaze.follow = false;
  }
  const hp = camera.getLocalPosition(), fp = face.getLocalPosition(), k = snap ? 1 : Math.min(1, dt * 6);
  face.setLocalPosition(fp.x + (hp.x - fp.x) * k, fp.y + (hp.y - fp.y) * k, fp.z + (hp.z - fp.z) * k);
  qYaw.setFromAxisAngle(Vec3.UP, gaze.yaw); qPitch.setFromAxisAngle(Vec3.RIGHT, gaze.pitch);
  face.setLocalRotation(qYaw.mul(qPitch));
}

/** The rig, so the board's centre (the world point `board`) sits below and ahead of where the eyes started. */
function placeRig() {
  rig.setPosition(board.x, BOARD.below * S, board.z + BOARD.ahead * S);
  village.setBoard(board.x, board.z, BOARD.radius * S);
}

let bannerT = 0, bannerMs = 0, toastT = 0;
/** A big message in front of the player for `ms`; `kind`: good, bad, mad, big. */
function say(text, sub = '', ms = 1200, kind = '') {
  const color = kind.includes('bad') ? '#ff9a8a' : kind.includes('mad') ? '#ff6a5a' : kind.includes('good') ? '#ffe08a' : '#f3e9d8';
  banner.draw(`${text}|${sub}|${kind}`, (ctx, w, h) => {
    ink(ctx, text, w / 2, sub ? h * 0.38 : h / 2, { size: h * (kind.includes('big') ? 0.62 : 0.4), font: TITLE_FONT, color, max: w * 0.96 });
    if (sub) ink(ctx, sub, w / 2, h * 0.78, { size: h * 0.17, color: '#f3e9d8', max: w * 0.96 });
  });
  bannerT = 0; bannerMs = ms; banner.visible = true;
}
/** A short line under the banner (+5 CANDY!). */
function pop(text, kind = '') {
  toast.draw(`${text}|${kind}`, (ctx, w, h) => ink(ctx, text, w / 2, h / 2, { size: h * 0.7, font: TITLE_FONT, color: kind === 'bad' ? '#ff9a8a' : '#ffe08a', max: w * 0.96 }));
  toastT = 0; toast.visible = true;
}
const later = (ms, fn) => setTimeout(() => { if (state === 'game') fn(); }, ms);

// --- the 2D page (the Specs browser, before and after a night) ----------------------------------
function menuTexts() {
  document.documentElement.lang = getLang();
  $('sub').textContent = t('specs.sub');
  $('how').innerHTML = t('specs.how').map((s) => `<div>${s}</div>`).join('');
  $('enter').textContent = t('specs.enter');
  for (const b of $('levels').children) { b.textContent = t(`levels.${b.dataset.id}`); b.classList.toggle('on', b.dataset.id === save.level); }
  for (const b of $('langs').children) b.classList.toggle('on', b.dataset.id === getLang());
  const best = save.bests[save.level] ?? 0;
  $('best').textContent = best > 0 ? `${t('specs.best')}: ${best}` : '';
  xrState();
}
for (const id of LEVELS) {
  const b = document.createElement('button');
  b.dataset.id = id;
  b.onclick = () => { save.level = id; store(); session.setLevel(id); sfx.click(); menuTexts(); };
  $('levels').appendChild(b);
}
for (const [id, label] of Object.entries(LANGS)) {
  const b = document.createElement('button');
  b.dataset.id = id;
  b.innerHTML = `${FLAGS[id]}<span>${label}</span>`;
  b.onclick = () => { setLang(id); save.lang = id; store(); menuTexts(); };
  $('langs').appendChild(b);
}
function xrState() {
  const ok = !!app.xr?.isAvailable(XRTYPE_AR);
  $('enter').disabled = !ok;
  $('note').textContent = ok ? t('specs.exit') : t('specs.noXr');
}
app.xr?.on(`available:${XRTYPE_AR}`, xrState);
menuTexts();
$('enter').onclick = () => {
  unlockAudio();
  camera.camera.startXr(XRTYPE_AR, XRSPACE_LOCAL, { callback: (err) => { if (err) $('note').textContent = err.message; } });
};
app.xr?.on('start', () => {
  $('menu').classList.add('hidden');
  camera.camera.clearColor = CLEAR;
  rig.setLocalScale(S, S, S);
  board.set(player.state.x, 0, player.state.z);
  placeRig();
  rim.enabled = true;
  followHead(0, true);
  hands.reset();
  say(t('specs.place'), '', 2400);
  setTimeout(() => { if (app.xr.active) startNight(); }, 1200);
});
app.xr?.on('end', () => {
  state = 'menu';
  endRoundVisuals();
  music(false);
  for (const p of panels) p.visible = false;
  camera.camera.clearColor = OPAQUE;
  rig.setLocalScale(1, 1, 1);
  rig.setPosition(0, 0, 0);
  rim.enabled = false;
  village.setBoard(0, 0, 0);
  $('menu').classList.remove('hidden');
  menuTexts();
});

function startNight() {
  results.visible = false;
  session.startRound();
}

// --- round events (from the authority, on the glasses) ----------------------------------------
function onEvent(ev) {
  view.apply(ev);
  if (ev.e === 'start') { startRoundVisuals(ev); return; }
  if (state !== 'game' || ev.round !== view.round) return;
  const mine = playerOf(ev) === me.id;
  switch (ev.e) {
    case 'count': say(String(ev.n), '', 800, 'big'); sfx.beep(); break;
    case 'go': say(t('go'), '', 900, 'big good'); sfx.go(); music(true); break;
    case 'candy-': if (mine) { pop(t('plusCandy', { n: ev.pts })); sfx.candy(ev.pts); } break;
    case 'orb-':
      if (!mine) break;
      if (ev.used) { say(t(`power.${ev.kind}`), '', 1000, 'good'); sfx.power(); } else { pop(t('gotPower', { p: t(`powerName.${ev.kind}`) })); sfx.orb(); }
      break;
    case 'power': if (mine) { say(t(`power.${ev.kind}`), '', 1000, 'good'); sfx.power(); } break;
    case 'gem-': if (mine) { say(t(`gem.${ev.kind}`), t(`gemSub.${ev.kind}`), 1800, 'good'); sfx.jackpot(); } break;
    case 'scare':
      sparks.emit({ x: ev.x, y: 1.2, z: ev.z }, { x: 0, y: 3, z: 0 }, { n: 34, spread: 5, size: 0.3, grow: 0.5, life: 0.9, color: ev.kind === 'ghost' ? [0.6, 0.8, 1] : [0.6, 1, 0.5], gravity: -3, alpha: 1, twinkle: true });
      if (mine) { pop(t(ev.power === 'thief' ? 'stolen' : 'scared', { n: ev.pts })); sfx.candy(ev.pts); sfx.blocked(); }
      break;
    case 'house': {
      doors[ev.house].t = 0;
      sfx.creak();
      if (!mine) break;
      const burst = (color, n = 30) => { const d = HOUSES[ev.house].door; sparks.emit({ x: d.x, y: 1.4, z: d.z }, { x: 0, y: 2.5, z: 0 }, { n, spread: 4, size: 0.22, grow: 0.4, life: 0.9, color, gravity: -3, alpha: 1, twinkle: true }); };
      if (ev.kind === 'treat') { later(350, () => { say(t('treat'), t('plusCandy', { n: ev.pts }), 1200, 'good'); sfx.treat(); }); burst([1, 0.7, 0.3]); }
      else if (ev.kind === 'jackpot') { later(350, () => { say(t('jackpot'), `${t('plusCandy', { n: ev.pts })}${ev.power ? ` · ${t(`power.${ev.power}`)}` : ''}`, 1600, 'good'); sfx.jackpot(); }); burst([1, 0.85, 0.3], 60); }
      else if (ev.trick === 'rob') {
        later(350, () => { say(t('robbed'), ev.lost ? t('lostCandy', { n: ev.lost }) : t('blocked'), 1800, 'bad'); sfx.trick(); if (ev.lost) sfx.hit(); });
        later(900, () => pop(t('swarmOut', { n: ev.n }), 'bad'));
        burst([0.6, 1, 0.5], 60);
      } else { later(350, () => { say(t('trick'), t('swarmOut', { n: ev.n }), 1500, 'bad'); sfx.trick(); sfx.ghost(); }); burst([0.6, 1, 0.5], 60); }
      break;
    }
    case 'hit':
      if (!mine) break;
      if (ev.blocked) { pop(t('blocked')); sfx.blocked(); break; }
      player.spooked();
      sfx.hit();
      if (ev.by === 'zombie') say(t('zombieGrab'), '', 1100, 'bad');
      else say(t('ghostAttack'), ev.delta ? t('lostCandy', { n: -ev.delta }) : '', 1100, 'bad');
      break;
    case 'spot': if (ev.target === me.id) { const m = view.monsters.get(ev.id); if (m?.kind === 'zombie') sfx.creature(); else sfx.ghost(); } break;
    case 'madness': say(t('madness'), t('madnessSub'), 2600, 'mad'); sfx.madness(); musicMadness(true); break;
    case 'over': finishRound(); break;
  }
}

function startRoundVisuals(ev) {
  endRoundVisuals();
  const sp = ev.players.find((p) => p.id === me.id)?.spawn ?? { x: 0, z: 6.2, yaw: 180 };
  player.place(sp.x, sp.z, sp.yaw);
  board.set(sp.x, 0, sp.z);
  hands.reset();
  madK = 0; lastTick = -1;
  village.setMadness(0);
  musicMadness(false);
  state = 'game';
}

function endRoundVisuals() {
  monsters.clear();
  candy.clear();
  auras.clear();
  for (const d of doors) d.t = -1;
  HOUSES.forEach((_, i) => village.setDoor(i, 0));
  banner.visible = false; toast.visible = false; hint.visible = false;
}

function finishRound() {
  const score = (view.ranking ?? []).find((r) => r.id === me.id)?.score ?? 0;
  const level = view.level ?? save.level, prev = save.bests[level] ?? 0;
  save.bests = { ...save.bests, [level]: Math.max(prev, score) };
  store();
  player.finish(score > 0);
  say(t('timesUp'), '', 2200, 'mad');
  (score > 0 ? sfx.win : sfx.lose)();
  music(false);
  later(2600, () => {
    state = 'results';
    results.draw(`${score}|${prev}|${getLang()}`, (ctx, w, h) => {
      plate(ctx, 0, 0, w, h, { r: h * 0.12 });
      ink(ctx, t('timesUp'), w / 2, h * 0.17, { size: h * 0.15, font: TITLE_FONT, color: '#ffe08a', max: w * 0.9 });
      ink(ctx, `🍬 ${score}`, w / 2, h * 0.42, { size: h * 0.2, font: TITLE_FONT, max: w * 0.9 });
      ink(ctx, score > prev && score > 0 ? t('newBest') : `${t('specs.best')}: ${Math.max(prev, score)}`, w / 2, h * 0.62, { size: h * 0.085, color: '#ffe08a', max: w * 0.9 });
      ink(ctx, t('specs.again'), w / 2, h * 0.78, { size: h * 0.075, max: w * 0.9 });
      ink(ctx, t('specs.exit'), w / 2, h * 0.9, { size: h * 0.06, color: '#c3b8dc', max: w * 0.9 });
    });
    results.visible = true;
    banner.visible = false;
  });
}

// --- the frame ----------------------------------------------------------------------------------
let last = performance.now();
app.on('update', () => {
  const nowMs = performance.now(), realDt = Math.min(5, (nowMs - last) / 1000);
  last = nowMs;
  const dt = Math.min(realDt, 0.1), now = nowMs / 1000;
  session.update(realDt);
  hands.update(dt);
  if (!app.xr?.active) menuFrame(dt);
  else { playFrame(dt, now); followHead(dt); panelsFrame(dt, now); }
  village.update(dt, camera);
  app.scene.ambientLight.mulScalar(1.35); // (after the village sets it: a lighter night for see-through glasses)
  fx.update(dt, camera);
  sparks.update(dt, camera);
});

/** The 2D page: a slow flight round the village behind the menu. */
function menuFrame(dt) {
  menuT += dt;
  const a = menuT * 0.06;
  rig.setPosition(0, 0, 0);
  camera.setLocalPosition(Math.sin(a) * 34, 26, Math.cos(a) * 34);
  camera.lookAt(0, 1, 0);
  avatar.update(dt, 0);
  auras.tick(dt, camera.getPosition());
}

function playFrame(dt, now) {
  const playing = view.phase === 'playing' && state === 'game';
  const move = state === 'game' ? hands.read() : { x: 0, y: 0, mag: 0 };
  const mods = { slow: view.fx(me.id, 'slow') > 0, frozen: !playing, giant: view.fx(me.id, 'giant') > 0, ghost: view.fx(me.id, 'ghost') > 0 };
  const pose = player.update(dt, move, steer, mods);
  const ps = player.state;
  session.authority?.setPose(me.id, ps.x, ps.z);
  poseT += dt;
  if (poseT >= 1 / POSE_HZ) { poseT = 0; session.pose(pose); }
  avatar.setGhost(mods.ghost);
  avatar.setVisible(true);

  // The board follows the Bitmoji (gently), so it stays in the middle of the table.
  const k = Math.min(1, dt * 2.5);
  board.x += (ps.x - board.x) * k; board.z += (ps.z - board.z) * k;
  placeRig();

  // A quick pinch: knock at the door in reach, else use the power-up; after a night, play again (a long
  // still pinch: back to the menu).
  if (hands.take('hold') && state === 'results') { app.xr.end(); return; }
  let door = null;
  for (const h of HOUSES) { const d = Math.hypot(ps.x - h.door.x, ps.z - h.door.z); if (d < DOOR_RANGE && (!door || d < door.d)) door = { h, d }; }
  const coolLeft = door ? Math.max(0, (view.houses[door.h.id] ?? 0) - now) : 0;
  const meP = view.players.get(me.id);
  knockLock -= dt;
  if (hands.take('action')) {
    if (state === 'results') startNight();
    else if (door && playing && coolLeft <= 0 && knockLock <= 0) {
      knockLock = 1.2;
      player.knock(door.h.door.x + (door.h.x - door.h.door.x) * 0.3, door.h.door.z + (door.h.z - door.h.door.z) * 0.3);
      sfx.knock();
      session.intent({ kind: 'knock', house: door.h.id });
    } else if (meP?.held && playing) session.intent({ kind: 'use' });
  }
  const holding = state === 'results' ? hands.held : 0;
  hint.visible = (state === 'game' && playing && (!!door || !!meP?.held)) || holding > 0;
  if (holding > 0) { // a bar filling up while a still pinch heads for the menu
    const k = Math.round(holding * 24) / 24;
    hint.draw(`hold|${k}|${getLang()}`, (ctx, w, h) => {
      plate(ctx, 0, 0, w, h);
      ctx.fillStyle = 'rgba(255,179,71,0.55)'; ctx.beginPath(); ctx.roundRect(h * 0.12, h * 0.12, (w - h * 0.24) * k, h * 0.76, h * 0.3); ctx.fill();
      ink(ctx, t('specs.exit'), w / 2, h / 2, { size: h * 0.42, max: w * 0.9 });
    });
  } else if (hint.visible) {
    const text = door ? (coolLeft > 0 ? t('cooling', { n: Math.ceil(coolLeft) }) : t('specs.knockHint')) : t('specs.useHint', { p: t(`powerName.${meP.held}`).toUpperCase() });
    hint.draw(text, (ctx, w, h) => { plate(ctx, 0, 0, w, h); ink(ctx, text, w / 2, h / 2, { size: h * 0.5, font: TITLE_FONT, color: door && coolLeft <= 0 ? '#ffe08a' : '#f3e9d8', max: w * 0.9 }); });
  }

  doors.forEach((d, i) => {
    if (d.t < 0) return;
    d.t += dt;
    const o = d.t < 0.45 ? d.t / 0.45 : d.t < 1.9 ? 1 : Math.max(0, 1 - (d.t - 1.9) / 0.6);
    village.setDoor(i, o);
    if (d.t > 2.6) { d.t = -1; village.setDoor(i, 0); }
  });
  HOUSES.forEach((h, i) => {
    const ready = !((view.houses[i] ?? 0) > now);
    if (houseReady[i] !== ready) { houseReady[i] = ready; village.setHouseReady(i, ready); }
  });
  village.setClock(Math.max(0, view.rt()) / ROUND_SECONDS);
  const mt = view.madness ? 1 : 0;
  if (Math.abs(madK - mt) > 0.001) { madK += Math.sign(mt - madK) * Math.min(Math.abs(mt - madK), dt / 3); village.setMadness(madK); }

  auras.update(dt, me.id, avatar.root, (kind) => view.fx(me.id, kind), ps.x, ps.z);
  auras.tick(dt, camera.getPosition()); // (lightning turns to the eyes)
  village.setLightning(auras.flashAt(ps.x, ps.z));
  village.setStorm(auras.stormAt(ps.x, ps.z, (id) => (id === me.id ? ps : null)));
  monsters.update(dt, view, now, camera.getPosition());
  candy.update(dt, view, { x: ps.x, z: ps.z, magnet: view.fx(me.id, 'magnet') > 0, giant: mods.giant }, (kind, id) => session.intent({ kind, id }), now);
  const edge = BOARD.radius * S; // (their beams and glows would float past the board's edge)
  for (const c of candy.root.children) { const p = c.getPosition(); c.enabled = Math.hypot(p.x - board.x, p.z - board.z) < edge; }

  const left = view.phase === 'countdown' ? ROUND_SECONDS : view.remaining();
  if (playing && left <= 10 && Math.ceil(left) !== lastTick) { lastTick = Math.ceil(left); sfx.tick(); }
}

/** The HUD (time, candy, power-up, what is on) and the fading banner and toast. */
function panelsFrame(dt) {
  if (state === 'game') {
    const meP = view.players.get(me.id);
    const left = Math.ceil((view.phase === 'countdown' ? ROUND_SECONDS : view.remaining()) - 1e-6);
    const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const on = ['giant', 'thief', 'ghost', 'rain', 'shield', 'magnet', 'double', 'slow'].filter((kind) => view.fx(me.id, kind) > 0);
    const ICON = { giant: '⛰️', thief: '🔮', ghost: '👻', rain: '🌧️', shield: '🛡️', magnet: '🧲', double: '✖2', slow: '🐢' };
    const HELD = { rain: '🍬', shield: '🛡️', magnet: '🧲', double: '✖2' };
    const key = `${time}|${meP?.score ?? 0}|${meP?.held}|${on.join()}|${view.madness}`;
    hud.draw(key, (ctx, w, h) => {
      plate(ctx, 0, 0, w, h, { rim: view.madness ? 'rgba(255,90,74,0.95)' : undefined });
      ink(ctx, `⏱ ${time}`, w * 0.17, h / 2, { size: h * 0.5, font: TITLE_FONT, color: view.madness ? '#ff8a7a' : '#ffe08a' });
      ink(ctx, `🍬 ${String(meP?.score ?? 0).padStart(3, '0')}`, w * 0.47, h / 2, { size: h * 0.5, font: TITLE_FONT });
      ink(ctx, meP?.held ? `✦ ${HELD[meP.held]}` : '✦', w * 0.7, h / 2, { size: h * 0.42, color: meP?.held ? '#ffe08a' : '#8a7aa8' });
      ink(ctx, on.map((kind) => ICON[kind]).join(' '), w * 0.88, h / 2, { size: h * 0.36, font: BODY_FONT });
    });
  }
  hud.visible = state === 'game';
  if (banner.visible) {
    bannerT += dt * 1000;
    banner.opacity = bannerT < bannerMs ? 1 : Math.max(0, 1 - (bannerT - bannerMs) / 400);
    if (bannerT > bannerMs + 400) banner.visible = false;
  }
  if (toast.visible) {
    toastT += dt;
    toast.opacity = toastT < 0.9 ? 1 : Math.max(0, 1 - (toastT - 0.9) / 0.3);
    if (toastT > 1.2) toast.visible = false;
  }
}

if (import.meta.env.DEV) {
  window.__specs = {
    app, session, view, player, hands, rig, face, village, houses: HOUSES, panels: { hud, banner, hint, toast, results },
    get state() { return state; },
    skip(seconds) { for (let k = 0; k < seconds * 10; k++) session.authority?.tick(0.1); },
  };
}
