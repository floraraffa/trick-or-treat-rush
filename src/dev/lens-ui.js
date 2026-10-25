// The Spectacles Lens's panels, laid out once for both sides: the export draws each plate with the web game's
// own styles (dev/lens-ui.html, index.html's CSS) into ui.glb, and the Lens (Scripts/Generated/lensUi.ts) puts
// its texts on them and picks its buttons by these boxes. Centimetres in the panel's plane, y up, centred.
//   kind: tome (a panel), title (the logo), plate (a panel's name ribbon), pill (a level / view / size button),
//   lang (a language button with its flag), go (the orange button), btn (the violet one), chip (the HUD bar),
//   round (the HUD's menu button). Buttons come in three looks: off, on (chosen) and hover (pointed at).
//   text: the label's font (title: Griffy, ui: Mystery Quest), size and colour (the web game's).

export const UI_PX = 10; // CSS pixels a centimetre when the plates are drawn (at 4× for the texture)
export const UI_PAD = 1.2; // cm of room round each plate for its glow and shadow (the quads are that much larger)

const LEVEL = { kind: 'pill', w: 10, h: 3.4, text: { font: 'ui', size: 40, color: 'lav', on: 'ink' } };
const VIEW = { kind: 'pill', w: 15, h: 3.4, text: { font: 'ui', size: 38, color: 'lav', on: 'ink' } };
const SIZE = { kind: 'pill', w: 4.4, h: 3.4, text: { font: 'ui', size: 40, color: 'lav', on: 'ink' } };
const LANG = { kind: 'lang', w: 9.4, h: 4.8, text: { font: 'ui', size: 30, color: 'lav', on: 'ink', dy: -1.1 } };
const GO = (w, h = 4.8, size = 60) => ({ kind: 'go', w, h, text: { font: 'title', size, color: 'ink' } });
const BTN = (w, h = 4.8, size = 40) => ({ kind: 'btn', w, h, text: { font: 'ui', size, color: 'cream' } });

export const UI = {
  menu: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: -1.6, w: 47, h: 37 },
      { id: 'title', kind: 'title', x: 0, y: 12.2, w: 25, h: 8.6 },
      ...['easy', 'medium', 'hard'].map((id, i) => ({ id: `level:${id}`, x: -11 + i * 11, y: 3.4, ...LEVEL })),
      ...['en', 'es', 'fr', 'de'].map((id, i) => ({ id: `lang:${id}`, x: -15.3 + i * 10.2, y: -1.6, ...LANG })),
      { id: 'view:table', x: -8.3, y: -6.6, ...VIEW },
      { id: 'view:first', x: 8.3, y: -6.6, ...VIEW },
      ...['s', 'm', 'l'].map((id, i) => ({ id: `size:${id}`, x: -6.6 + i * 5, y: -10.6, ...SIZE })),
      { id: 'move', x: 12.6, y: -10.6, ...BTN(13, 3.4, 30) },
      { id: 'play', x: -4.6, y: -15.2, ...GO(25) },
      { id: 'how', x: 14.4, y: -15.2, ...BTN(12, 4.8, 34) },
    ],
    texts: [
      { id: 'sub', x: 0, y: 7.2, w: 40, h: 1.8, font: 'ui', size: 34, color: 'lav' },
      { id: 'size', x: -15.4, y: -10.6, w: 8, h: 2.2, font: 'ui', size: 32, color: 'lav' },
      { id: 'best', x: -11.5, y: -19.1, w: 20, h: 1.8, font: 'ui', size: 30, color: 'gold' },
      { id: 'bitmoji', x: 9.5, y: -19.1, w: 24, h: 1.8, font: 'ui', size: 26, color: 'lav' },
    ],
  },
  how: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: 0, w: 44, h: 28 },
      { id: 'plate', kind: 'plate', x: 0, y: 13.6, w: 18, h: 4 },
      { id: 'back', x: 0, y: -11, ...GO(18, 4.6, 52) },
    ],
    texts: [
      { id: 'title', x: 0, y: 13.6, w: 16, h: 2.6, font: 'title', size: 56, color: 'gold' },
      ...[0, 1, 2, 3].map((i) => ({ id: `line${i}`, x: 0, y: 8.2 - i * 4.4, w: 38, h: 3.6, font: 'ui', size: 34, color: 'cream', wrap: true })),
    ],
  },
  results: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: 0, w: 36, h: 24 },
      { id: 'plate', kind: 'plate', x: 0, y: 11.6, w: 14, h: 4 },
      { id: 'again', x: -6, y: -7.4, ...GO(19, 4.8, 50) },
      { id: 'menu', x: 10.6, y: -7.4, ...BTN(10, 4.8, 38) },
    ],
    texts: [
      { id: 'plate', x: 0, y: 11.6, w: 12, h: 2.6, font: 'title', size: 52, color: 'gold' },
      { id: 'title', x: 0, y: 6.6, w: 32, h: 4.2, font: 'title', size: 100, color: 'gold' },
      { id: 'score', x: 0, y: 1.6, w: 30, h: 3.8, font: 'title', size: 90, color: 'cream' },
      { id: 'best', x: 0, y: -2.4, w: 30, h: 2.2, font: 'ui', size: 40, color: 'gold' },
    ],
  },
  pause: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: 0, w: 38, h: 22 },
      { id: 'plate', kind: 'plate', x: 0, y: 10.6, w: 16, h: 4 },
      { id: 'view:table', x: -8.3, y: 3.2, ...VIEW },
      { id: 'view:first', x: 8.3, y: 3.2, ...VIEW },
      { id: 'resume', x: -5, y: -4.6, ...GO(20, 4.8, 50) },
      { id: 'menu', x: 11, y: -4.6, ...BTN(10, 4.8, 38) },
    ],
    texts: [
      { id: 'title', x: 0, y: 10.6, w: 14, h: 2.6, font: 'title', size: 56, color: 'gold' },
      { id: 'view', x: 0, y: 6.6, w: 30, h: 1.8, font: 'ui', size: 30, color: 'lav' },
    ],
  },
  hud: {
    items: [
      { id: 'chip', kind: 'chip', x: 0, y: 0, w: 34, h: 3.6 },
      { id: 'pause', kind: 'round', x: 19.6, y: 0, w: 3.8, h: 3.8, text: { font: 'title', size: 44, color: 'cream' } },
    ],
    texts: [
      { id: 'time', x: -12.6, y: 0, w: 7, h: 2.6, font: 'title', size: 52, color: 'gold' },
      { id: 'candy', x: -2.6, y: 0, w: 12, h: 2.6, font: 'title', size: 44, color: 'gold' },
      { id: 'power', x: 10.4, y: 0, w: 12, h: 2.4, font: 'ui', size: 28, color: 'cream' },
    ],
  },
};

/** The colours the texts take (the web game's palette). */
export const UI_COLORS = { lav: [0.765, 0.722, 0.863], ink: [0.165, 0.059, 0.125], cream: [0.965, 0.906, 0.784], gold: [0.941, 0.761, 0.369], red: [0.95, 0.35, 0.3] };

/** Every plate image the panels need, once each: { key, kind, w, h, look, lang }. */
export function uiPlates() {
  const out = new Map();
  for (const panel of Object.values(UI)) for (const it of panel.items) {
    for (const look of plateLooks(it)) {
      const lang = it.kind === 'lang' ? it.id.split(':')[1] : '';
      const key = plateKey(it, look);
      if (!out.has(key)) out.set(key, { key, kind: it.kind, w: it.w, h: it.h, look, lang });
    }
  }
  return [...out.values()];
}

/** The image a plate look is drawn into (shared by plates of the same kind and size). */
export function plateKey(it, look) {
  return `${it.kind}${it.kind === 'lang' ? `-${it.id.split(':')[1]}` : ''}-${it.w}x${it.h}-${look}`;
}

/** The node a plate look is in ui.glb (a panel's node holds them all): "menu-level-easy-on". */
export function plateNode(panel, id, look) {
  return `${panel}-${id.replace(/:/g, '-')}-${look}`;
}

/** The looks an item has. */
export function plateLooks(it) {
  return ['tome', 'title', 'plate', 'chip'].includes(it.kind) ? ['off'] : ['off', 'on', 'hover'];
}
