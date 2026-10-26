// Draws every plate the Lens's panels use (lens-ui.js) with the web game's styles: index.html's own <style>,
// its fonts and flags, so the glasses' menu looks like the phone's. Text is left out (the Lens writes it in
// its own Text, in the player's language); the flags and the title are drawn in. Hover: lit with a gold edge.
import '@fontsource/griffy/latin-400.css';
import '@fontsource/mystery-quest/latin-400.css';
import page from '../../index.html?raw';
import { FLAGS } from '../ui/flags.js';
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
`;
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
    el = document.createElement(p.kind === 'tome' || p.kind === 'plate' || p.kind === 'chip' || p.kind === 'grip' ? 'div' : 'button');
    el.className = { tome: 'tome', plate: 'plate', chip: 'chip', pill: 'lvl', lang: 'lvl lang', go: 'btn go', btn: 'btn', round: 'round', grip: 'grip' }[p.kind];
    el.style.width = px(p.w);
    el.style.height = px(p.h);
    if (p.kind === 'lang') el.innerHTML = FLAGS[p.lang];
    if (p.kind === 'round') el.innerHTML = '<span class="bars"><i></i><i></i></span>';
    if (p.kind === 'grip') el.innerHTML = '<i></i><i></i><i></i>';
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
