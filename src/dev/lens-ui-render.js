// Draws every plate the Lens's panels use (lens-ui.js) with the web game's styles: index.html's own <style>,
// its fonts and flags, so the glasses' menu looks like the phone's. Text is left out (the Lens writes it in
// its own Text, in the player's language); the flags and the title are drawn in. Hover: lit with a gold edge.
import '@fontsource/griffy/latin-400.css';
import '@fontsource/mystery-quest/latin-400.css';
import page from '../../index.html?raw';
import { FLAGS } from '../ui/flags.js';
import { COSTUME_ICON } from '../actors/costumes.js';
import { vampireFace } from '../ui/vampire.js';
import { UI_PAD, UI_PX, uiPlates } from './lens-ui.js';

const style = document.createElement('style');
style.textContent = `${page.match(/<style>([\s\S]*?)<\/style>/)[1]}
  html, body, #plates, .uiplate { overflow: visible; height: auto; background: transparent !important; }
  #plates { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; width: 2600px; }
  .uiplate { position: relative; display: flex; align-items: center; justify-content: center; flex: none; }
  .uiplate > * { flex: none; margin: 0; }
  .uiplate .btn { transform: none; padding: 0; }
  .uiplate .btn.go { transform: rotate(-0.6deg); }
  .uiplate .plate { margin: 0; padding: 0; }
  .uiplate .lvl { font: inherit; color: var(--lav); background: rgba(0,0,0,.35); border: 2px solid #6d5a87; border-radius: 12px 4px 12px 4px; }
  .uiplate .lvl.on { background: linear-gradient(180deg, #ffe0a0, #ff9a3c); border-color: #3a1208; }
  .uiplate .lang { position: relative; }
  .uiplate .lang .flag { position: absolute; left: 50%; top: 7px; width: 27px; height: 20px; transform: translateX(-50%); border-radius: 3px;
    box-shadow: 0 0 0 1px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.5); opacity: .8; }
  .uiplate .lang.on .flag { opacity: 1; box-shadow: 0 0 0 1px #3a1208, 0 0 8px rgba(255,200,120,.8); }
  .uiplate .hover { filter: brightness(1.22); box-shadow: 0 0 0 2px #f0c25e, 0 0 16px rgba(240,194,94,.75) !important; }
  .uiplate .lvl.hover:not(.on) { border-color: #f0c25e; }
  .uiplate .round .bars { display: flex; gap: 5px; }
  .uiplate .round .bars i { display: block; width: 6px; height: 17px; border-radius: 2px; background: #f3e9d8; }
  .uiplate .title { white-space: nowrap; }
  .uiplate .grip { border-radius: 999px; background: linear-gradient(180deg, rgba(195,184,220,.6), rgba(110,90,150,.5)); border: 2px solid #9a86b8;
    box-shadow: 0 0 10px rgba(150,110,210,.4); display: flex; align-items: center; justify-content: center; gap: 6px; }
  .uiplate .grip i { display: block; width: 5px; height: 5px; border-radius: 50%; background: #2b1838; opacity: .8; }
  .uiplate .tome { padding: 0; max-width: none; }
  .uiplate .costume { border-radius: 50%; font-size: 25px; padding: 0; background: radial-gradient(#3e2652, #1a0f24); border: 2px solid #6d5a87;
    display: flex; align-items: center; justify-content: center; line-height: 1; }
  .uiplate .costume.on { border-color: var(--gold); box-shadow: 0 0 14px rgba(240,190,90,.6); transform: scale(1.12) rotate(-6deg); }
  .uiplate .costume svg.face { width: 40px; height: 40px; display: block; filter: drop-shadow(0 2px 2px rgba(0,0,0,.5)); }
  .uiplate .night { position: relative; border-radius: 14px 5px 14px 5px; background: linear-gradient(160deg, rgba(62,38,82,.92), rgba(26,15,36,.92));
    border: 2px solid #6d5a87; box-shadow: inset 0 0 12px rgba(150,110,210,.25); overflow: hidden; }
  .uiplate .night .moon { position: absolute; right: 7px; top: 6px; width: 16px; height: 16px; opacity: .55; }
  .uiplate .night.on { background: linear-gradient(180deg, #ffe0a0, #ff9a3c); border-color: #3a1208; box-shadow: 0 0 14px rgba(255,170,80,.6); }
  .uiplate .night.on .moon { opacity: .35; }
  .uiplate .night.lock { background: linear-gradient(160deg, rgba(36,26,46,.9), rgba(16,10,22,.9)); border-color: #3e3150; box-shadow: none; }
  .uiplate .night .padlock { position: absolute; left: 50%; top: 50%; width: 30px; height: 34px; transform: translate(-50%, -50%); opacity: .8; }
  .uiplate .star svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .uiplate .star.on svg { filter: drop-shadow(0 0 4px rgba(255,200,90,.85)) drop-shadow(0 2px 2px rgba(0,0,0,.45)); }
  .uiplate .star:not(.on) svg { opacity: .9; }
`;
const MOON = '<svg class="moon" viewBox="0 0 20 20"><path d="M13 2a8 8 0 1 0 5 13A7 7 0 0 1 13 2z" fill="#f3e9d8"/></svg>';
const PADLOCK = '<svg class="padlock" viewBox="0 0 30 34"><path d="M8 15V10a7 7 0 0 1 14 0v5" fill="none" stroke="#9a86b8" stroke-width="3.2"/><rect x="4" y="14" width="22" height="18" rx="4" fill="#6d5a87" stroke="#c3b8dc" stroke-width="1.6"/><circle cx="15" cy="22" r="2.6" fill="#2b1838"/><rect x="13.9" y="23" width="2.2" height="5" rx="1" fill="#2b1838"/></svg>';
/** A five-pointed star: gold when won, a dim violet one when not. */
const starSvg = (on, id) => {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 19 : 47; return `${(50 + Math.cos(a) * r).toFixed(1)},${(53 + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
  return `<svg viewBox="0 0 100 100"><defs><linearGradient id="sg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${on ? '#fff3b0' : '#3a2a50'}"/><stop offset=".55" stop-color="${on ? '#ffc94a' : '#2a1d3a'}"/><stop offset="1" stop-color="${on ? '#e8851c' : '#1d1328'}"/></linearGradient></defs>`
    + `<polygon points="${pts}" fill="url(#sg${id})" stroke="${on ? '#5a2a08' : '#8a78a8'}" stroke-width="${on ? 5 : 4}" stroke-linejoin="round"/>`
    + (on ? `<polygon points="${pts}" fill="none" stroke="#fff6cc" stroke-width="1.6" stroke-linejoin="round" transform="translate(50 53) scale(.78) translate(-50 -53)" opacity=".7"/>` : '')
    + '</svg>';
};
let stars = 0;
document.head.appendChild(style);

const px = (cm) => `${Math.round(cm * UI_PX)}px`;
const root = document.getElementById('plates');
for (const p of uiPlates()) {
  const slot = document.createElement('div');
  slot.className = 'uiplate';
  slot.id = `plate-${p.key}`;
  slot.style.width = px(p.w + UI_PAD * 2);
  slot.style.height = px(p.h + UI_PAD * 2);
  let el;
  if (p.kind === 'title') {
    el = document.createElement('h1');
    el.className = 'title';
    el.innerHTML = '<span class="w">TRICK</span> <span class="w">OR</span> <span class="w">TREAT</span><span class="rush">RUSH</span>';
  } else {
    el = document.createElement(['tome', 'plate', 'chip', 'grip', 'night', 'star', 'bigstar'].includes(p.kind) ? 'div' : 'button');
    el.className = { tome: 'tome', plate: 'plate', chip: 'chip', pill: 'lvl', lang: 'lvl lang', go: 'btn go', btn: 'btn', round: 'round', grip: 'grip', costume: 'costume', night: 'night', star: 'star', bigstar: 'star' }[p.kind];
    el.style.width = px(p.w);
    el.style.height = px(p.h);
    if (p.kind === 'lang') el.innerHTML = FLAGS[p.lang];
    if (p.kind === 'round') el.innerHTML = '<span class="bars"><i></i><i></i></span>';
    if (p.kind === 'grip') el.innerHTML = '<i></i><i></i><i></i>';
    if (p.kind === 'costume') el.innerHTML = p.costume === 'cape' ? vampireFace() : COSTUME_ICON[p.costume];
    if (p.kind === 'night') el.innerHTML = p.look === 'lock' ? PADLOCK : MOON;
    if (p.kind === 'night' && p.look === 'lock') el.classList.add('lock');
    if (p.kind === 'star' || p.kind === 'bigstar') el.innerHTML = starSvg(p.look === 'on', stars++);
    if (p.look === 'on') el.classList.add('on');
    if (p.look === 'hover') el.classList.add('hover');
  }
  slot.appendChild(el);
  root.appendChild(slot);
}
// The title at the size laid out for it.
await document.fonts.ready;
for (const p of uiPlates().filter((x) => x.kind === 'title')) {
  const el = document.querySelector(`#plate-${CSS.escape(p.key)} .title`), r = el.getBoundingClientRect();
  const k = Math.min((p.w * UI_PX) / r.width, (p.h * UI_PX) / r.height);
  el.style.transform = `scale(${k})`;
}
window.__plates = uiPlates();
window.__ready = true;
