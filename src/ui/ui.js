// UIManager: every screen and the HUD, as plain DOM over the 3D canvas (index.html holds the
// markup and the gothic-storybook styles). It only shows what it is told; game rules live elsewhere.
import { COSTUMES, COSTUME_ICON } from '../actors/costumes.js';
import { vampireFace } from './vampire.js';
import { FLAGS } from './flags.js';
import { STEPS } from './tutorial.js';
import { LANGS, t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'menu', 'how', 'nights', 'lobby', 'results'];
/** A costume's icon as HTML: the drawn vampire face, emoji for the rest. */
const icon = (id, other = '🙂') => (id === 'cape' ? vampireFace() : COSTUME_ICON[id] ?? other);
const POWER_ICON = { rain: '🍬', shield: '🛡️', magnet: '🧲', double: '✖2' };
const FX_ICON = { ...POWER_ICON, rain: '🌧️', slow: '🕸️', giant: '⛰️', thief: '🔮', ghost: '👻' };
const LEVELS = ['easy', 'medium', 'hard'];
const pad3 = (n) => String(Math.max(0, n | 0)).padStart(3, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createUI(on) {
  let screen = 'loading';
  const tagEls = new Map();
  let bannerTimer = 0;

  // Buttons: every one plays a click and calls its handler; none of them starts a camera drag.
  const bind = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); on.click?.(); fn(e); });
  bind('btnPlay', () => on.play());
  bind('btnHow', () => tutorial());
  bind('btnTutSkip', () => finishTutorial());
  bind('btnTutNext', () => (step < STEPS.length - 1 ? goStep(step + 1) : finishTutorial()));
  bind('btnStart', () => on.start());
  bind('btnLobbyBack', () => on.lobbyBack());
  bind('btnAgain', () => on.again());
  bind('btnFriends', () => on.friends());
  bind('btnBoard', () => on.friends());
  bind('btnMenu', () => on.menu());
  bind('btnCam', () => on.camera());
  bind('btnPower', () => on.power());
  bind('btnKnock', () => on.knock());
  bind('btnBoo', () => on.boo());
  bind('btnNightPlay', () => on.nightPlay());
  bind('btnNightsBack', () => on.menu());
  bind('btnNext', () => on.next());
  $('paused').addEventListener('click', () => on.resume());
  for (const b of ['btnCam', 'btnPower', 'btnKnock', 'btnBoo']) $(b).addEventListener('pointerdown', (e) => e.stopPropagation());
  $('nameInput').addEventListener('change', (e) => on.name(e.target.value));
  $('nameInput').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
  let taps = 0, tapT = 0;
  $('titleText').addEventListener('click', () => { const n = performance.now(); taps = n - tapT < 600 ? taps + 1 : 1; tapT = n; if (taps >= 5) { taps = 0; on.diag(); } });

  const costumes = $('costumes');
  for (const id of COSTUMES) {
    const b = document.createElement('button');
    b.innerHTML = icon(id);
    b.dataset.id = id;
    b.setAttribute('aria-label', id);
    b.addEventListener('click', () => { on.click?.(); on.costume(id); });
    costumes.appendChild(b);
  }

  const levels = $('levels');
  for (const id of LEVELS) {
    const b = document.createElement('button');
    b.dataset.id = id;
    b.addEventListener('click', () => { on.click?.(); on.level(id); });
    levels.appendChild(b);
  }

  const langs = $('langs'); // each language with its flag, in its own words
  for (const [id, label] of Object.entries(LANGS)) {
    const b = document.createElement('button');
    b.dataset.id = id;
    b.lang = id;
    b.innerHTML = `${FLAGS[id]}<span>${label}</span>`;
    b.addEventListener('click', () => { on.click?.(); on.lang(id); });
    langs.appendChild(b);
  }

  // How to play: one card at a time; NEXT, the dots or a swipe move between them.
  let step = 0, after = null;
  const dots = $('tutDots');
  STEPS.forEach((_, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', String(i + 1));
    d.addEventListener('click', (e) => { e.stopPropagation(); goStep(i); });
    dots.appendChild(d);
  });
  let swipeX = null;
  $('tut').addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  $('tut').addEventListener('pointerup', (e) => {
    const dx = swipeX == null ? 0 : e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 45) goStep(Math.max(0, Math.min(STEPS.length - 1, step + (dx < 0 ? 1 : -1))));
  });
  function goStep(i) {
    step = i;
    const s = STEPS[i], [title, line] = t(`tut.${s.id}`), last = i === STEPS.length - 1;
    $('howTitle').textContent = title;
    $('tutStep').innerHTML = `<div class="art ${s.id}">${s.art()}</div><div class="tutText">${line}</div>`;
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    $('btnTutNext').textContent = last ? t(after ? 'letsGo' : 'close') : t('next');
    $('btnTutSkip').classList.toggle('hidden', last);
  }
  /** Shows the tutorial from its first card; `then` runs when it's finished or skipped (else back to the menu). */
  function tutorial(then = null) { after = then; goStep(0); show('how'); }
  function finishTutorial() {
    const then = after;
    after = null;
    on.tutorialSeen?.();
    if (then) then(); else show('menu');
  }

  function show(id) {
    screen = id;
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    $('hud').classList.toggle('hidden', id !== 'game');
    $('tags').classList.toggle('hidden', id !== 'game');
    if (id !== 'game') $('madVeil').classList.remove('on');
  }

  function texts() {
    $('subtitle').textContent = t('subtitle');
    $('btnPlay').textContent = t('play');
    $('btnHow').textContent = t('how');
    $('btnTutSkip').textContent = t('skip');
    $('btnStart').textContent = t('start');
    $('btnLobbyBack').textContent = t('back');
    $('lobbyTitle').textContent = t('lobby');
    $('btnAgain').textContent = t('playAgain');
    $('btnFriends').textContent = `🏆 ${t('friends')}`;
    $('btnBoard').textContent = `🏆 ${t('friends')}`;
    $('btnMenu').textContent = t('menu');
    $('lblCandy').textContent = t('myCandy');
    $('powerLbl').textContent = t('powerup');
    $('btnKnock').textContent = t('trickOrTreat');
    $('booLbl').textContent = t('lens.skills.boo');
    $('nightsTitle').textContent = t('lens.nights');
    $('btnNightPlay').textContent = t('play');
    $('btnNightsBack').textContent = t('back');
    $('btnNext').textContent = t('lens.next');
    for (const b of levels.children) b.textContent = t(`levels.${b.dataset.id}`);
    $('lblName').textContent = t('name');
    $('pausedTitle').textContent = t('paused');
    $('pausedSub').textContent = t('tapResume');
  }

  /** The best score Snapchat's board holds for the player, under the results (null: none to show). */
  function setBoardBest(n) {
    const el = $('resBoard');
    el.classList.toggle('hidden', n == null);
    el.textContent = n == null ? '' : `🏆 ${t('boardBest', { n })}`;
  }

  let lastHud = {};
  const setText = (id, v) => { if (lastHud[id] !== v) { lastHud[id] = v; $(id).textContent = v; } };

  return {
    get screen() { return screen; },
    show,
    texts,
    tutorial,
    loadProgress(p, tip) {
      $('loadFill').style.width = `${Math.round(p * 100)}%`;
      if (tip) $('loadTip').textContent = tip;
    },
    setPortrait(url) { $('portrait').src = url; },
    setCostume(id) {
      for (const b of costumes.children) b.classList.toggle('on', b.dataset.id === id);
      $('costumeName').textContent = t(`costumes.${id}`);
    },
    setName(n) { $('nameInput').value = n; },
    setLevel(id) { for (const b of levels.children) b.classList.toggle('on', b.dataset.id === id); },
    setLanguage(id) { for (const b of langs.children) b.classList.toggle('on', b.dataset.id === id); },
    showName(v) { $('nameField').classList.toggle('hidden', !v); },
    setBest(n) { $('bestLine').innerHTML = n > 0 ? `${t('best')}: <b>${n}</b>` : ''; },
    /** The stars won on every night, on the menu. */
    setStars(n) { $('bestLine').innerHTML = n > 0 ? `<b>${t('nights.total', { n })}</b>` : ''; },
    setModeNote(s) { $('modeNote').textContent = s; },
    /** The menu's button to Snapchat's friends ranking (only where there is one). */
    showBoard(on) { $('btnBoard').classList.toggle('hidden', !on); },
    setBoardBest,

    /**
     * The nights: `tiles` [{ n, stars, open }] (a tap on one: on.night(n)), the one picked (`pick`) and what it
     * holds (`info`: name, how, goals, best), a line under it all (`note`).
     */
    nights({ tiles, pick, info, note }) {
      $('nightGrid').innerHTML = tiles.map((s) => `<button class="nightTile${s.open ? '' : ' lock'}${s.n === pick ? ' on' : ''}" data-n="${s.n}">${s.n + 1}<span class="st">${[0, 1, 2].map((k) => (k < s.stars ? '<b>★</b>' : '★')).join('')}</span></button>`).join('');
      for (const b of $('nightGrid').children) b.addEventListener('click', (e) => { e.stopPropagation(); on.click?.(); on.night(+b.dataset.n); });
      $('nightName').textContent = info.name;
      $('nightHow').textContent = info.how;
      $('nightGoals').textContent = info.goals;
      $('nightBest').textContent = info.best;
      $('nightsNote').textContent = note ?? '';
    },

    lobby({ room, roster, isHost, phase, meInRound, full, level, night }) {
      $('roomName').textContent = `${t('room')}: ${room} · ${night != null ? t('lens.night', { n: night + 1 }) : t(`levels.${level}`)}`;
      const slots = [];
      for (let i = 0; i < 4; i++) {
        const p = roster[i];
        if (!p) { slots.push(`<div class="slot empty">· · ·</div>`); continue; }
        slots.push(`<div class="slot${p.me ? ' me' : ''}"><span class="ci">${icon(p.costume)}</span><span>${esc(p.name)}${p.me ? ` (${t('you')})` : ''}</span>${p.host ? `<span class="tag">${t('host')}</span>` : ''}</div>`);
      }
      $('slots').innerHTML = slots.join('');
      const busy = phase === 'countdown' || phase === 'playing';
      let status = full ? t('full') : busy && !meInRound ? t('roundOn') : roster.length < 2 ? t('waitPlayers') : isHost ? '' : t('waitHost');
      $('lobbyStatus').textContent = status;
      $('btnStart').classList.toggle('hidden', !isHost);
      $('btnStart').disabled = !isHost || roster.length < 2 || busy;
    },

    /** The in-game HUD. */
    hud(h) {
      const boo = $('btnBoo');
      boo.classList.toggle('hidden', !h.boo);
      if (h.boo) {
        boo.classList.toggle('ready', h.boo.left <= 0);
        boo.classList.toggle('wait', h.boo.left > 0);
        setText('booLbl', h.boo.left > 0 ? `${Math.ceil(h.boo.left)}s` : t('lens.skills.boo'));
      }
      const m = Math.floor(h.time / 60), s = Math.floor(h.time % 60);
      setText('timer', `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      $('timer').classList.toggle('mad', h.mad);
      $('timer').classList.toggle('low', h.time <= 10);
      $('madTag').classList.toggle('hidden', !h.mad);
      setText('myCandy', pad3(h.myCandy));
      setText('lblLeader', h.leaderLabel);
      setText('leaderName', h.leaderName);
      const fx = h.effects.map((e) => `<div class="fx ${e.kind}">${FX_ICON[e.kind]} ${Math.ceil(e.left)}s</div>`).join('');
      if (lastHud.fx !== fx) { lastHud.fx = fx; $('effects').innerHTML = fx; }
      const pw = $('btnPower');
      pw.classList.toggle('empty', !h.held);
      pw.classList.toggle('ready', !!h.held);
      setText('powerIcon', h.held ? POWER_ICON[h.held] : '✦');
      setText('powerLbl', h.held ? t(`powerName.${h.held}`).toUpperCase() : t('powerup'));
      setText('camLbl', h.camMode === 'first' ? t('first') : t('third'));
      const k = $('btnKnock');
      const wasHidden = k.classList.contains('hidden');
      k.classList.toggle('hidden', !h.knock.visible);
      if (wasHidden && h.knock.visible) { k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); }
      k.classList.toggle('cool', h.knock.visible && !h.knock.ready);
      setText('btnKnock', h.knock.visible && !h.knock.ready ? `⏳ ${Math.ceil(h.knock.left)}s` : t('trickOrTreat'));
      setText('doorHint', h.knock.visible ? (h.knock.ready ? h.knock.name : t('cooling', { n: Math.ceil(h.knock.left) })) : '');
    },

    banner(text, sub = '', ms = 1100, kind = '') {
      const b = $('banner');
      b.className = `ink show ${kind}`;
      b.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
    },
    popup(text, kind = '') {
      const el = document.createElement('div');
      el.className = `popup ink ${kind}`;
      el.textContent = text;
      el.style.top = `${44 + Math.random() * 10}%`;
      $('popups').appendChild(el);
      setTimeout(() => el.remove(), 1150);
    },
    flash() {
      const f = $('flash');
      f.classList.add('on');
      requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    },
    /** A lightning flash over the screen, `k` 0..1 by how near it struck (kept soft: storms flash often). */
    lightning(k) {
      const b = $('bolt');
      b.style.transition = 'none';
      b.style.opacity = String(Math.min(0.8, k));
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.transition = ''; b.style.opacity = '0'; }));
    },
    madness(on) { $('madVeil').classList.toggle('on', on); },

    /** Floating labels over players and houses: [{ key, x, y, text, cls }] in CSS pixels. */
    tags(list) {
      const seen = new Set();
      for (const tg of list) {
        let el = tagEls.get(tg.key);
        if (!el) { el = document.createElement('div'); el.className = 'tag3d'; $('tags').appendChild(el); tagEls.set(tg.key, el); }
        seen.add(tg.key);
        if (el.dataset.text !== tg.text) { el.dataset.text = tg.text; el.textContent = tg.text; }
        if (el.dataset.cls !== tg.cls) { el.dataset.cls = tg.cls; el.className = `tag3d ${tg.cls}`; }
        el.style.left = `${tg.x}px`; el.style.top = `${tg.y}px`;
        el.style.display = '';
      }
      for (const [k, el] of tagEls) if (!seen.has(k)) el.style.display = 'none';
    },

    /**
     * `night`: { plate, stars, next } for a night (its stars lit one by one, `onStar(k)` as each lights; NEXT NIGHT
     * when there is one), else null.
     */
    results({ hero, king, rows, note, friends, night = null, onStar }) {
      $('resHero').textContent = hero;
      $('resKing').textContent = king;
      $('resPlate').textContent = night?.plate ?? '🎃';
      const stars = $('resStars');
      stars.classList.toggle('hidden', !night);
      [...stars.children].forEach((s) => s.classList.remove('on'));
      if (night) for (let k = 0; k < night.stars; k++) setTimeout(() => { stars.children[k].classList.add('on'); onStar?.(k); }, 500 + k * 450);
      $('btnNext').classList.toggle('hidden', !night?.next);
      $('btnAgain').classList.toggle('go', !night?.next);
      $('btnAgain').textContent = night ? t('lens.again') : t('playAgain');
      // the player's own rows carry their 2D Bitmoji (the API gives no one else's)
      $('ranking').innerHTML = rows.map((r) => `<div class="rank${r.win ? ' win' : ''}${r.me ? ' me' : ''}"><span class="pos"><span>${r.pos}</span></span><span class="ci">${r.face ? `<img class="bitmoji" src="${esc(r.face)}" alt="" />` : icon(r.costume, '🎃')}</span><span class="nm">${esc(r.name)}</span><span class="sc">${r.score}</span></div>`).join('');
      setBoardBest(null);
      $('resNote').textContent = note ?? '';
      $('btnFriends').classList.toggle('hidden', !friends);
      show('results');
    },
    paused(on) { $('paused').classList.toggle('hidden', !on); },
    diag(text) { const d = $('diag'); d.classList.toggle('hidden', text == null); if (text != null) d.textContent = text; },
  };
}
