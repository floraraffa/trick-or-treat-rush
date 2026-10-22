// UIManager: every screen and the HUD, as plain DOM over the 3D canvas (index.html holds the
// markup and the gothic-storybook styles). It only shows what it is told; game rules live elsewhere.
import { COSTUMES, COSTUME_ICON } from '../actors/costumes.js';
import { t } from './i18n.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'menu', 'how', 'lobby', 'results'];
const POWER_ICON = { speed: '⚡', shield: '🛡️', magnet: '🧲', double: '✖2' };
const FX_ICON = { ...POWER_ICON, slow: '🕸️' };
const pad3 = (n) => String(Math.max(0, n | 0)).padStart(3, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createUI(on) {
  let screen = 'loading';
  const tagEls = new Map();
  let bannerTimer = 0;

  // Buttons: every one plays a click and calls its handler; none of them starts a camera drag.
  const bind = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); on.click?.(); fn(e); });
  bind('btnPlay', () => on.play());
  bind('btnHow', () => show('how'));
  bind('btnHowClose', () => show(on.backFromHow?.() ?? 'menu'));
  bind('btnStart', () => on.start());
  bind('btnLobbyBack', () => on.lobbyBack());
  bind('btnAgain', () => on.again());
  bind('btnFriends', () => on.friends());
  bind('btnMenu', () => on.menu());
  bind('btnCam', () => on.camera());
  bind('btnPower', () => on.power());
  bind('btnKnock', () => on.knock());
  $('paused').addEventListener('click', () => on.resume());
  for (const b of ['btnCam', 'btnPower', 'btnKnock']) $(b).addEventListener('pointerdown', (e) => e.stopPropagation());
  $('nameInput').addEventListener('change', (e) => on.name(e.target.value));
  $('nameInput').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); });
  let taps = 0, tapT = 0;
  $('titleText').addEventListener('click', () => { const n = performance.now(); taps = n - tapT < 600 ? taps + 1 : 1; tapT = n; if (taps >= 5) { taps = 0; on.diag(); } });

  const costumes = $('costumes');
  for (const id of COSTUMES) {
    const b = document.createElement('button');
    b.textContent = COSTUME_ICON[id];
    b.dataset.id = id;
    b.setAttribute('aria-label', id);
    b.addEventListener('click', () => { on.click?.(); on.costume(id); });
    costumes.appendChild(b);
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
    $('howTitle').textContent = t('how');
    $('btnHowClose').textContent = t('close');
    $('btnStart').textContent = t('start');
    $('btnLobbyBack').textContent = t('back');
    $('lobbyTitle').textContent = t('lobby');
    $('btnAgain').textContent = t('playAgain');
    $('btnFriends').textContent = t('friends');
    $('btnMenu').textContent = t('menu');
    $('lblCandy').textContent = t('myCandy');
    $('powerLbl').textContent = t('powerup');
    $('btnKnock').textContent = t('trickOrTreat');
    $('lblName').textContent = t('name');
    $('pausedTitle').textContent = t('paused');
    $('pausedSub').textContent = t('tapResume');
    $('howRows').innerHTML = t('howBody').map(([i, s]) => `<div class="row"><span class="ico">${i}</span><span>${s}</span></div>`).join('');
  }

  let lastHud = {};
  const setText = (id, v) => { if (lastHud[id] !== v) { lastHud[id] = v; $(id).textContent = v; } };

  return {
    get screen() { return screen; },
    show,
    texts,
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
    showName(v) { $('nameField').classList.toggle('hidden', !v); },
    setBest(n) { $('bestLine').innerHTML = n > 0 ? `${t('best')}: <b>${n}</b>` : ''; },
    setModeNote(s) { $('modeNote').textContent = s; },

    lobby({ room, roster, isHost, phase, meInRound, full }) {
      $('roomName').textContent = `${t('room')}: ${room}`;
      const slots = [];
      for (let i = 0; i < 4; i++) {
        const p = roster[i];
        if (!p) { slots.push(`<div class="slot empty">· · ·</div>`); continue; }
        slots.push(`<div class="slot${p.me ? ' me' : ''}"><span>${COSTUME_ICON[p.costume] ?? '🙂'}</span><span>${esc(p.name)}${p.me ? ` (${t('you')})` : ''}</span>${p.host ? `<span class="tag">${t('host')}</span>` : ''}</div>`);
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

    results({ hero, king, rows, note, friends }) {
      $('resHero').textContent = hero;
      $('resKing').textContent = king;
      $('ranking').innerHTML = rows.map((r) => `<div class="rank${r.win ? ' win' : ''}${r.me ? ' me' : ''}"><span class="pos"><span>${r.pos}</span></span><span>${COSTUME_ICON[r.costume] ?? '🎃'}</span><span class="nm">${esc(r.name)}</span><span class="sc">${r.score}</span></div>`).join('');
      $('resNote').textContent = note ?? '';
      $('btnFriends').classList.toggle('hidden', !friends);
      show('results');
    },
    paused(on) { $('paused').classList.toggle('hidden', !on); },
    diag(text) { const d = $('diag'); d.classList.toggle('hidden', text == null); if (text != null) d.textContent = text; },
  };
}
