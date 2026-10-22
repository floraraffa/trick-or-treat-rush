// GameManager: boots the Lens and runs the night. Wires the village, the player's Bitmoji and
// camera, the session (one authority, everyone else mirroring it), the monsters and candy on
// screen, the HUD and the screens: menu → (lobby) → 3, 2, 1, GO! → 180 s → TIME'S UP! → ranking.
import { Application, CameraFrame, Color, Entity, FILLMODE_FILL_WINDOW, RESOLUTION_AUTO, TONEMAP_NEUTRAL, Vec3 } from 'playcanvas';
import '@fontsource/griffy/latin-400.css';
import '@fontsource/mystery-quest/latin-400.css';
import { diagnostics, has, initSnap, loadSave, portraitUrl, save, showLeaderboard, snapchat, submitScore } from './lib/snap.js';
import { createTextures } from './textures.js';
import { createVillage } from './world/village.js';
import { HOUSES, DOOR_RANGE, SPAWNS } from './world/layout.js';
import { createFx } from './fx.js';
import { createAvatar } from './actors/avatar.js';
import { COSTUMES } from './actors/costumes.js';
import { createPlayer } from './actors/player.js';
import { createMonsters } from './actors/monsters.js';
import { createCandy } from './actors/candy.js';
import { createAuras } from './actors/effects.js';
import { createCameraController } from './camera.js';
import { createInput } from './input.js';
import { createTransport } from './net/transport.js';
import { Session } from './net/session.js';
import { View, playerOf } from './game/view.js';
import { DEFAULT_LEVEL, GEMS, LEVELS, MADNESS_AT, MIN_PLAYERS, POSE_HZ, ROUND_SECONDS } from './game/config.js';
import { buzz, music, musicMadness, sfx, suspendAudio, unlockAudio } from './audio.js';
import { createUI } from './ui/ui.js';
import { detectLang, setLang, t } from './ui/i18n.js';
import defaultFaceUrl from './assets/avatar_face.webp';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const D2R = Math.PI / 180;
const lowFx = params.has('lowfx');
const debug = params.has('debug') || params.has('test');

// Snapchat's controls sit at the top: test layouts with ?inset=120.
if (params.has('inset')) {
  const px = `${+params.get('inset') || 0}px`;
  for (const side of ['top', 'bottom']) document.documentElement.style.setProperty(`--safe-${side}`, side === 'top' ? px : `${Math.round(parseInt(px) / 3)}px`);
}

setLang(detectLang(null));
const ui = createUI({
  click: () => { unlockAudio(); sfx.click(); },
  play: () => onPlay(),
  start: () => session.startRound(),
  lobbyBack: () => toMenu(),
  again: () => onAgain(),
  friends: () => showLeaderboard(),
  menu: () => toMenu(),
  camera: () => input.press('camera'),
  sprint: (on) => input.holdSprint(on),
  level: (id) => setLevel(id),
  power: () => input.press('use'),
  knock: () => input.press('knock'),
  resume: () => setPaused(false),
  costume: (id) => setCostume(id),
  name: (n) => setName(n),
  diag: () => showDiagnostics(),
});
ui.texts();
ui.loadProgress(0.05, t('tips')[Math.floor(Math.random() * t('tips').length)]);
let lastScreen = 'menu';

// --- engine ---------------------------------------------------------------------------
const canvas = $('app');
const app = new Application(canvas, { graphicsDeviceOptions: { antialias: false } });
app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
app.setCanvasResolution(RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = +params.get('res') || Math.min(window.devicePixelRatio || 1, lowFx ? 1.25 : 2); // ?res=0.3: cheap renders for automated tests
addEventListener('resize', () => app.resizeCanvas());

const camera = new Entity('camera');
camera.addComponent('camera', { fov: 60, nearClip: 0.1, farClip: 700, clearColor: new Color(0.05, 0.04, 0.09) });
app.root.addChild(camera);
let frame = null;
if (!lowFx) {
  try {
    frame = new CameraFrame(app, camera.camera);
    frame.rendering.toneMapping = TONEMAP_NEUTRAL;
    frame.rendering.samples = 2;
    frame.bloom.intensity = 0.03;
    frame.bloom.blurLevel = 12;
    frame.grading.enabled = true;
    frame.grading.saturation = 1.08;
    frame.grading.contrast = 1.06;
    frame.vignette.intensity = 0.5;
    frame.vignette.inner = 0.5;
    frame.vignette.outer = 1.25;
    frame.update();
  } catch (e) { console.warn('[fx] post-processing unavailable:', e.message); frame = null; }
}
if (!frame) camera.camera.toneMapping = TONEMAP_NEUTRAL;

const tex = createTextures(app.graphicsDevice);
const village = createVillage(app, tex, { lowFx });
app.root.addChild(village.root);
const fx = createFx(app, tex.glow, { max: 260 });
const sparks = createFx(app, tex.glow, { max: 320, additive: true });
for (const f of [fx, sparks]) app.root.addChild(f.entity);
const monsters = createMonsters(app, sparks);
app.root.addChild(monsters.root);
const candy = createCandy(app, tex, sparks);
app.root.addChild(candy.root);
const auras = createAuras(app, sparks);
const camCtl = createCameraController(camera, { distance: +params.get('camdist') || undefined });
const input = createInput(canvas, { joy: $('joy'), knob: $('knob') });
village.setClock(0);
app.start();
ui.loadProgress(0.2);

// --- profile, session ------------------------------------------------------------------
const DEFAULT_SAVE = { best: 0, bests: {}, level: DEFAULT_LEVEL, name: '', costume: 'witch', camera: 'third', nights: [], lang: null };
const SPOOKY = ['Pumpkin', 'Raven', 'Moth', 'Wisp', 'Bat', 'Ghoul', 'Hex', 'Toad', 'Newt', 'Crow'];
let saveData = structuredClone(DEFAULT_SAVE);
const me = { id: `p${Math.random().toString(36).slice(2, 9)}`, name: params.get('name') || `${SPOOKY[Math.floor(Math.random() * SPOOKY.length)]}${Math.floor(Math.random() * 90 + 10)}`, costume: 'witch' };
const transport = createTransport(params);
let session = null;
const view = new View(me.id);
let myAvatar = null, player = null;
const remotes = new Map(); // id → { avatar }
let screen = 'loading';
let poseT = 0, paused = false, knockLock = 0, lastTick = -1, madK = 0, menuT = 0;
const doors = HOUSES.map(() => ({ t: -1 }));
const houseReady = HOUSES.map(() => null);

function goTo(id) {
  if (screen !== 'game' && screen !== 'loading') lastScreen = screen;
  screen = id;
  ui.show(id);
  if (id === 'game') music(true);
}

async function boot() {
  const caps = await initSnap();
  ui.loadProgress(0.4);
  saveData = await loadSave(DEFAULT_SAVE);
  if (!COSTUMES.includes(saveData.costume)) saveData.costume = 'witch';
  if (!LEVELS.includes(saveData.level)) saveData.level = DEFAULT_LEVEL;
  if (LEVELS.includes(params.get('level'))) saveData.level = params.get('level');
  saveData.bests ??= {};
  if (saveData.name && !params.get('name')) me.name = saveData.name;
  me.costume = params.get('costume') && COSTUMES.includes(params.get('costume')) ? params.get('costume') : saveData.costume;
  ui.loadProgress(0.55);

  session = new Session({ transport, me });
  session.setLevel(saveData.level);
  session.on('event', onEvent);
  session.on('snapshot', (s) => view.snapshot(s));
  session.on('pose', (id, p) => view.pose(id, p));
  session.on('roster', () => renderLobby());
  session.on('hostLost', () => {
    if (screen === 'game' || screen === 'results') { endRoundVisuals(); ui.banner(t('hostLeft'), '', 2000, 'bad'); goTo('lobby'); }
    renderLobby();
  });

  // The player's own Bitmoji (asked from Snapchat; the default one outside it), standing in the plaza for the menu.
  myAvatar = createAvatar(app, tex, { own: true, costume: me.costume, bitmojiUrl: params.get('bitmoji') ?? undefined });
  app.root.addChild(myAvatar.root);
  player = createPlayer(myAvatar);
  player.place(0, 6.2, 180);
  myAvatar.ready.then(() => ui.loadProgress(1));
  if (camCtl.mode !== saveData.camera && saveData.camera === 'first') camCtl.setMode('first');

  if (!snapchat.isStub) portraitUrl().then((url) => ui.setPortrait(url ?? defaultFaceUrl)); // the desktop stub's portrait is a placeholder
  ui.setPortrait(defaultFaceUrl);
  ui.setCostume(me.costume);
  ui.setName(me.name);
  ui.showName(!session.solo);
  ui.setLevel(saveData.level);
  ui.setBest(bestFor(saveData.level));
  ui.setModeNote(session.solo ? (caps.isStub ? `${t('soloShort')} · ${t('solo')}` : t('solo')) : `${t('room')}: ${transport.room}`);
  await Promise.race([tex.ready, new Promise((r) => setTimeout(r, 4000))]);
  ui.loadProgress(0.85);
  goTo('menu');
  if (params.has('autostart')) setTimeout(() => onPlay(), 300);
  if (params.has('debug')) showDiagnostics();
}

function setCostume(id) {
  me.costume = id;
  saveData.costume = id;
  save(saveData);
  myAvatar?.setCostume(id);
  ui.setCostume(id);
  session?.setProfile(me.name, me.costume);
}
/** Best night at a level (nights from before levels existed count as hard: that was the only tuning). */
const bestFor = (level) => saveData.bests?.[level] ?? (level === 'hard' ? saveData.best : 0);
function setLevel(id) {
  saveData.level = id;
  save(saveData);
  ui.setLevel(id);
  ui.setBest(bestFor(id));
  session?.setLevel(id);
  renderLobby();
}
function setName(n) {
  me.name = (n || '').replace(/[<>]/g, '').trim().slice(0, 12) || me.name;
  saveData.name = me.name;
  save(saveData);
  ui.setName(me.name);
  session?.setProfile(me.name, me.costume);
}

function onPlay() {
  unlockAudio();
  if (session.solo) { session.startRound(); return; }
  goTo('lobby');
  renderLobby();
}
function onAgain() {
  if (session.solo) { session.startRound(); return; }
  if (session.isHost) session.toLobby();
  goTo('lobby');
  renderLobby();
}
function toMenu() {
  if (screen === 'game') return;
  goTo('menu');
  player.place(0, 6.2, 180);
}

function renderLobby() {
  if (!session || session.solo) return;
  ui.lobby({ room: transport.room, roster: session.rosterList(), isHost: session.isHost, phase: session.phase, meInRound: session.inRound.has(me.id), full: session.full, level: session.roomLevel });
}

// --- round events (from the authority) ------------------------------------------------------
function onEvent(ev) {
  view.apply(ev);
  if (ev.e === 'start') { if (view.inRound(me.id)) startRoundVisuals(ev); else renderLobby(); return; }
  if (screen !== 'game' || ev.round !== view.round) return;
  const mine = playerOf(ev) === me.id;
  switch (ev.e) {
    case 'count': ui.banner(String(ev.n), '', 800, 'big'); sfx.beep(); break;
    case 'go': ui.banner(t('go'), '', 900, 'big good'); sfx.go(); break;
    case 'candy-':
      if (mine) { ui.popup(t('plusCandy', { n: ev.pts })); sfx.candy(ev.pts); buzz(15); }
      break;
    case 'orb-':
      if (!mine) break;
      if (ev.used) { ui.banner(t(`power.${ev.kind}`), '', 1000, 'good'); sfx.power(); buzz(25); } // slot full: it works at once
      else { ui.popup(t('gotPower', { p: t(`powerName.${ev.kind}`) }), 'power'); sfx.orb(); }
      break;
    case 'power':
      if (mine) { ui.banner(t(`power.${ev.kind}`), '', 1000, 'good'); sfx.power(); buzz(25); }
      break;
    case 'gem-':
      if (mine) { ui.banner(t(`gem.${ev.kind}`), t(`gemSub.${ev.kind}`), 1800, 'good'); sfx.jackpot(); buzz(60); }
      break;
    case 'scare': {
      sparks.emit({ x: ev.x, y: 1.2, z: ev.z }, { x: 0, y: 3, z: 0 }, { n: 34, spread: 5, size: 0.3, grow: 0.5, life: 0.9, color: ev.kind === 'ghost' ? [0.6, 0.8, 1] : [0.6, 1, 0.5], gravity: -3, alpha: 1, twinkle: true });
      if (mine) { ui.popup(t(ev.power === 'thief' ? 'stolen' : 'scared', { n: ev.pts })); sfx.candy(ev.pts); sfx.blocked(); buzz(30); }
      break;
    }
    case 'house': {
      doors[ev.house].t = 0;
      const near = Math.hypot(player.state.x - HOUSES[ev.house].door.x, player.state.z - HOUSES[ev.house].door.z) < 14;
      if (near || mine) sfx.creak();
      if (!mine) break;
      if (ev.kind === 'treat') { setTimeout(() => { ui.banner(t('treat'), t('plusCandy', { n: ev.pts }), 1200, 'good'); sfx.treat(); }, 350); burstAtDoor(ev.house, [1, 0.7, 0.3]); }
      else if (ev.kind === 'jackpot') { setTimeout(() => { ui.banner(t('jackpot'), `${t('plusCandy', { n: ev.pts })}${ev.power ? ` · ${t(`power.${ev.power}`)}` : ''}`, 1600, 'good'); sfx.jackpot(); buzz(40); }, 350); burstAtDoor(ev.house, [1, 0.85, 0.3], 60); }
      else { setTimeout(() => { ui.banner(t('trick'), ev.trick === 'ghost' ? t('ghostOut') : '', 1200, 'bad'); sfx.trick(); }, 350); burstAtDoor(ev.house, [0.6, 1, 0.5]); }
      break;
    }
    case 'hit':
      if (!mine) break;
      if (ev.blocked) { ui.popup(t('blocked'), 'power'); sfx.blocked(); break; }
      player.spooked();
      camCtl.shake(1);
      ui.flash();
      buzz(80);
      sfx.hit();
      if (ev.by === 'zombie') ui.banner(t('zombieGrab'), '', 1100, 'bad');
      else if (ev.by === 'web') ui.banner(t('webbed'), '', 1100, 'bad');
      else ui.banner(t('ghostAttack'), ev.delta ? t('lostCandy', { n: -ev.delta }) : '', 1100, 'bad');
      if (ev.delta) ui.popup(t('lostCandy', { n: -ev.delta }), 'bad');
      break;
    case 'spot': if (ev.target === me.id) { const m = view.monsters.get(ev.id); if (m?.kind === 'zombie') sfx.zombie(); else sfx.ghost(); } break;
    case 'madness':
      ui.banner(t('madness'), t('madnessSub'), 2600, 'mad');
      ui.madness(true);
      sfx.madness();
      musicMadness(true);
      buzz(120);
      break;
    case 'over': finishRound(); break;
  }
}

function burstAtDoor(i, color, n = 30) {
  const d = HOUSES[i].door;
  sparks.emit({ x: d.x, y: 1.4, z: d.z }, { x: 0, y: 2.5, z: 0 }, { n, spread: 4, size: 0.22, grow: 0.4, life: 0.9, color, gravity: -3, alpha: 1, twinkle: true });
}

function startRoundVisuals(ev) {
  endRoundVisuals();
  const mine = ev.players.find((p) => p.id === me.id);
  const sp = mine?.spawn ?? SPAWNS[0];
  player.place(sp.x, sp.z, sp.yaw);
  camCtl.snapBehind(sp.yaw);
  input.reset();
  madK = 0;
  village.setMadness(0);
  ui.madness(false);
  musicMadness(false);
  for (const p of ev.players) {
    if (p.id === me.id) continue;
    const av = createAvatar(app, tex, { own: false, costume: p.costume });
    av.root.setPosition(p.spawn.x, 0, p.spawn.z);
    app.root.addChild(av.root);
    remotes.set(p.id, { avatar: av });
  }
  goTo('game');
}

function endRoundVisuals() {
  for (const r of remotes.values()) r.avatar.destroy();
  remotes.clear();
  monsters.clear();
  candy.clear();
  auras.clear();
  for (const d of doors) d.t = -1;
  HOUSES.forEach((_, i) => village.setDoor(i, 0));
}

async function finishRound() {
  const ranking = view.ranking ?? [];
  const won = view.winners.includes(me.id);
  const mine = ranking.find((r) => r.id === me.id)?.score ?? 0;
  player.finish(session.solo ? mine > 0 : won);
  ui.banner(t('timesUp'), '', 2200, 'mad');
  ((session.solo ? mine > 0 : won) ? sfx.win : sfx.lose)();
  music(false);
  // Personal records and Snapchat's leaderboard (friends compare there: the API can't read entries back).
  const level = view.level ?? saveData.level;
  const prevBest = bestFor(level);
  saveData.bests = { ...saveData.bests, [level]: Math.max(prevBest, mine) };
  saveData.nights = [...saveData.nights, { score: mine, at: Date.now(), players: ranking.length, level }].sort((a, b) => b.score - a.score).slice(0, 10);
  save(saveData);
  ui.setBest(bestFor(saveData.level));
  submitScore(mine);
  setTimeout(() => {
    if (screen !== 'game') return;
    let rows, king, note = '';
    if (session.solo) {
      const nights = saveData.nights.filter((n) => (n.level ?? 'hard') === level);
      const idx = nights.findIndex((n) => n.score === mine);
      rows = nights.slice(0, 5).map((n, i) => ({ pos: i + 1, name: i === idx ? `${me.name} · ${t('you')}` : new Date(n.at).toLocaleDateString(), score: n.score, win: i === idx && mine > prevBest, me: i === idx, costume: i === idx ? me.costume : 'none' }));
      king = mine > prevBest && mine > 0 ? `${t('newBest')} · ${t('king')}` : '';
      note = `${t(`levels.${level}`)} · ${t('solo')}`;
    } else {
      const tie = view.winners.length > 1;
      let pos = 0, last = null;
      rows = ranking.map((r, i) => { if (r.score !== last) { pos = i + 1; last = r.score; } return { pos, name: r.id === me.id ? `${r.name} (${t('you')})` : r.name, score: r.score, win: view.winners.includes(r.id), me: r.id === me.id, costume: r.costume }; });
      const names = ranking.filter((r) => view.winners.includes(r.id)).map((r) => r.name).join(' & ');
      king = tie ? `${t('tie')}: ${names}` : `${t('king')} ${won ? t('youWin') : names}`;
    }
    ui.results({ hero: t('timesUp'), king, rows, note, friends: has('leaderboards') && !snapchat.isStub });
    if (has('leaderboards') && !snapchat.isStub && session.solo) showLeaderboard();
    screen = 'results';
  }, 2600);
}

function setPaused(on) {
  if (!session?.solo || screen !== 'game') on = false;
  paused = on;
  session?.authority?.pause(on);
  ui.paused(on);
  if (on) { suspendAudio(); input.reset(); } else unlockAudio();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { setPaused(true); suspendAudio(); }
});

// --- the frame ----------------------------------------------------------------------------
const tmp = new Vec3(), scr = new Vec3();
let last = performance.now();
app.on('update', () => {
  const nowMs = performance.now();
  const realDt = Math.min(5, (nowMs - last) / 1000); // the authority's clock wants real time
  last = nowMs;
  const dt = Math.min(realDt, 0.1); // motion and animation, scaled by frame time (120 Hz phones too)
  const now = nowMs / 1000;
  if (!session) { village.update(dt, camera); return; }
  if (!paused) session.update(realDt);

  if (screen === 'game' && !paused) playFrame(dt, now);
  else if (screen !== 'game') menuFrame(dt);

  village.update(dt, camera);
  fx.update(dt, camera);
  sparks.update(dt, camera);
});

/** Menus: the player's Bitmoji in costume by the clock tower, the camera drifting round. */
function menuFrame(dt) {
  menuT += dt;
  const a = Math.sin(menuT * 0.25) * 0.5;
  camera.setPosition(Math.sin(a) * 4.2, 1.7, 6.2 - Math.cos(a) * 4.2 + 0.2);
  camera.lookAt(0, 1.15, 6.2);
  camera.camera.fov = 52;
  myAvatar?.setVisible(true);
  myAvatar?.update(dt, 0);
  ambient(dt);
}

function playFrame(dt, now) {
  const rt = view.rt();
  const playing = view.phase === 'playing';
  if (input.take('camera')) { saveData.camera = camCtl.toggle(); save(saveData); sfx.click(); }
  const move = input.read();
  const mods = { speed: view.fx(me.id, 'speed') > 0, slow: view.fx(me.id, 'slow') > 0, frozen: !playing, sprint: input.sprinting(), giant: view.fx(me.id, 'giant') > 0 };
  const pose = player.update(dt, move, camCtl, mods);
  const ps = player.state;
  session.authority?.setPose(me.id, ps.x, ps.z); // the host's own position, every frame
  if (ps.sprinting && ps.moving && Math.random() < dt * 25) fx.emit({ x: ps.x, y: 0.15, z: ps.z }, { x: -ps.vx * 0.15, y: 0.6, z: -ps.vz * 0.15 }, { n: 1, spread: 0.6, size: 0.35, grow: 1.6, life: 0.6, color: [0.62, 0.58, 0.7], gravity: 0, alpha: 0.45 });
  poseT += dt;
  if (poseT >= 1 / POSE_HZ) { poseT = 0; session.pose(pose); }
  camCtl.update(dt, ps, input.takeLook(), input.takeZoom(), input.sinceLook());
  const meP = view.players.get(me.id);
  const blink = meP && meP.inv > now && Math.floor(now * 10) % 2 === 0;
  myAvatar.setVisible(!camCtl.hideBody && !blink);

  // The door within reach, if any.
  let door = null;
  for (const h of HOUSES) { const d = Math.hypot(ps.x - h.door.x, ps.z - h.door.z); if (d < DOOR_RANGE && (!door || d < door.d)) door = { h, d }; }
  const coolLeft = door ? Math.max(0, (view.houses[door.h.id] ?? 0) - now) : 0;
  knockLock -= dt;
  if (input.take('knock') && door && playing && coolLeft <= 0 && knockLock <= 0) {
    knockLock = 1.2;
    player.knock(door.h.door.x + (door.h.x - door.h.door.x) * 0.3, door.h.door.z + (door.h.z - door.h.door.z) * 0.3);
    sfx.knock();
    session.intent({ kind: 'knock', house: door.h.id });
  }
  if (input.take('use') && meP?.held && playing) session.intent({ kind: 'use' });

  // Doors swing open on every device when the authority says a house was visited.
  doors.forEach((d, i) => {
    if (d.t < 0) return;
    d.t += dt;
    const k = d.t < 0.45 ? d.t / 0.45 : d.t < 1.9 ? 1 : Math.max(0, 1 - (d.t - 1.9) / 0.6);
    village.setDoor(i, k);
    if (d.t > 2.6) { d.t = -1; village.setDoor(i, 0); }
  });
  HOUSES.forEach((h, i) => {
    const ready = !((view.houses[i] ?? 0) > now);
    if (houseReady[i] !== ready) { houseReady[i] = ready; village.setHouseReady(i, ready); }
  });
  village.setClock(Math.max(0, rt) / ROUND_SECONDS);

  // Monster Madness: the fog thickens, the moon reddens, the lamps flicker.
  const mt = view.madness ? 1 : 0;
  if (Math.abs(madK - mt) > 0.001) { madK += Math.sign(mt - madK) * Math.min(Math.abs(mt - madK), dt / 3); village.setMadness(madK); }

  // Other players, a little in the past and interpolated.
  for (const [id, r] of remotes) {
    const p = view.players.get(id);
    const s = p && view.sample(p.track);
    if (!s) continue;
    r.avatar.root.setPosition(s.x, 0, s.z);
    r.avatar.root.setEulerAngles(0, s.yaw, 0);
    const ex = s.extra ?? {};
    if (ex.a) r.avatar.setAnim(ex.a, ex.a === 'walk' ? Math.max(0.5, (ex.s * 5) / 2.4) : ex.a === 'run' ? Math.max(0.6, ex.s) : 1);
    if (ex.c && ex.c !== r.avatar.costume) r.avatar.setCostume(ex.c);
    const rk = view.fx(id, 'giant') > 0 ? GEMS.giant.scale : 1; // remote giants grow too
    r.scale = (r.scale ?? 1) + (rk - (r.scale ?? 1)) * Math.min(1, dt * 3);
    r.avatar.root.setLocalScale(r.scale, r.scale, r.scale);
    const rblink = p.inv > now && Math.floor(now * 10) % 2 === 0;
    r.avatar.setVisible(!rblink);
    r.avatar.update(dt, (ex.s ?? 0) * 5);
    auras.update(dt, id, r.avatar.root, (k) => view.fx(id, k), s.x, s.z);
  }
  auras.update(dt, me.id, myAvatar.root, (k) => view.fx(me.id, k), ps.x, ps.z, camCtl.hideBody);
  monsters.update(dt, view, now, camera.getPosition());
  candy.update(dt, view, { x: ps.x, z: ps.z, magnet: view.fx(me.id, 'magnet') > 0, giant: mods.giant }, (kind, id) => session.intent({ kind, id }), now);
  ambient(dt);

  // HUD.
  const left = view.phase === 'countdown' ? ROUND_SECONDS : view.remaining();
  const leader = view.leader();
  const effects = ['giant', 'thief', 'speed', 'shield', 'magnet', 'double', 'slow'].map((k) => ({ kind: k, left: view.fx(me.id, k) })).filter((e) => e.left > 0);
  const solo = session.solo;
  ui.hud({
    time: Math.ceil(left - 1e-6), mad: view.madness, myCandy: meP?.score ?? 0,
    leaderLabel: solo ? t('best') : t('leader'),
    leaderName: solo ? String(Math.max(bestFor(view.level ?? saveData.level), meP?.score ?? 0)) : leader ? (leader.id === me.id ? t('you') : leader.name) : '—',
    effects, held: meP?.held ?? null, camMode: camCtl.mode, stamina: ps.stamina, sprinting: ps.sprinting,
    knock: { visible: !!door && playing, ready: coolLeft <= 0, left: coolLeft, name: door?.h.name ?? '' },
  });
  if (playing && left <= 10 && Math.ceil(left) !== lastTick) { lastTick = Math.ceil(left); sfx.tick(); }

  // Floating labels: other players' names, nearby houses' state.
  const tags = [];
  const label = (key, x, y, z, text, cls) => {
    tmp.set(x, y, z);
    camera.camera.worldToScreen(tmp, scr);
    const fwd = camera.forward, dx = x - camera.getPosition().x, dz = z - camera.getPosition().z;
    if (fwd.x * dx + fwd.z * dz <= 0.3) return;
    tags.push({ key, x: scr.x, y: scr.y, text, cls });
  };
  for (const [id, r] of remotes) { const p = view.players.get(id); const pos = r.avatar.root.getPosition(); if (p) label(id, pos.x, 2.25, pos.z, `${p.name} · ${p.score}`, leader?.id === id && !solo ? 'lead' : ''); }
  for (const [id, m] of view.monsters) { // what a ghost has taken, for a ghost thief to win back
    if (m.loot > 0 && m.state !== 'banished' && !m.gone && Math.hypot(ps.x - m.x, ps.z - m.z) < 18) label(id, m.x, 2.3, m.z, t('loot', { n: m.loot }), 'house');
  }
  for (const h of HOUSES) {
    const d = Math.hypot(ps.x - h.door.x, ps.z - h.door.z);
    if (d > 13) continue;
    const cl = Math.max(0, (view.houses[h.id] ?? 0) - now);
    label(`h${h.id}`, h.door.x, 3.6, h.door.z, cl > 0 ? `⏳ ${Math.ceil(cl)}s` : `🎃 ${h.name}`, cl > 0 ? 'house' : 'house ready');
  }
  ui.tags(tags);
}

/** A few will-o'-the-wisps drifting round the camera (the mist itself is the height fog). */
function ambient(dt) {
  const c = camera.getPosition();
  if (Math.random() < dt * 2) {
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 12;
    const col = [[0.5, 0.9, 1], [0.8, 0.6, 1], [0.6, 1, 0.7]][Math.floor(Math.random() * 3)];
    sparks.emit({ x: c.x + Math.cos(a) * r, y: 0.8 + Math.random() * 2, z: c.z + Math.sin(a) * r }, { x: (Math.random() - 0.5) * 0.4, y: 0.25, z: (Math.random() - 0.5) * 0.4 }, { n: 1, spread: 0.1, size: 0.16, grow: 0.2, life: 3, color: col, gravity: 0.05, alpha: 0.9, drag: 0.2, twinkle: true });
  }
}

// --- diagnostics: tap the title five times, or ?debug ---------------------------------------
async function showDiagnostics() {
  const d = await diagnostics();
  const lines = [
    'Trick or Treat Rush · diagnostics (tap to close)',
    JSON.stringify(d, null, 1),
    `avatar: ${JSON.stringify(myAvatar?.status)}`,
    `session: ${session?.solo ? 'solo (loopback)' : `room ${transport.room}`} · host ${session?.isHost} · players ${session?.roster.size}`,
    `phase ${view.phase} · rt ${view.rt().toFixed(1)} · madness at ${ROUND_SECONDS - MADNESS_AT}s · min players in a room ${MIN_PLAYERS}`,
  ];
  ui.diag(lines.join('\n'));
  $('diag').onclick = () => ui.diag(null);
}

if (debug) {
  window.__game = {
    get session() { return session; }, view, get player() { return player; }, camCtl, input, ui, me,
    get screen() { return screen; },
    houses: HOUSES,
    /** Test hook: fast-forwards the host's round clock (the authority still simulates every step). */
    skip(seconds) { for (let k = 0; k < seconds * 10; k++) session.authority?.tick(0.1); },
  };
}

boot().catch((e) => { console.error(e); ui.loadProgress(1, `Error: ${e.message}`); });
