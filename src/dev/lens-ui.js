// The Spectacles Lens's panels, laid out once for both sides: the export draws each plate with the web game's
// own styles (dev/lens-ui.html, index.html's CSS) into ui.glb, and the Lens (Scripts/Generated/lensUi.ts) puts
// its texts on them and picks its buttons by these boxes. Centimetres in the panel's plane, y up, centred.
//   kind: tome (a panel), title (the logo), plate (a panel's name ribbon), pill (a level / view / size button),
//   lang (a language button with its flag), go (the orange button), btn (the violet one), chip (the HUD bar),
//   round (the HUD's menu button), grip (the bar under a panel that moves it), costume (a round button with the
//   costume's icon, as the web menu's), night (a night of the campaign: its number is written over it; locked, a
//   padlock), star and bigstar (a star won or not: plates, not buttons). Buttons come in three looks: off, on
//   (chosen) and hover (pointed at), a night also `lock`. The wrist panel rides on the player's wrist (palm
//   turned to them).
//   text: the label's font (title: Griffy, ui: Mystery Quest), size and colour (the web game's).

export const UI_PX = 10; // CSS pixels a centimetre when the plates are drawn (at 4× for the texture)
export const UI_PAD = 1.2; // cm of room round each plate for its glow and shadow (the quads are that much larger)

const VIEW = { kind: 'pill', w: 15, h: 3.4, text: { font: 'ui', size: 38, color: 'lav', on: 'ink' } };
const SIZE = { kind: 'pill', w: 4.4, h: 3.4, text: { font: 'ui', size: 40, color: 'lav', on: 'ink' } };
const LANG = { kind: 'lang', w: 9.4, h: 4.8, text: { font: 'ui', size: 30, color: 'lav', on: 'ink', dy: -1.1 } };
const GO = (w, h = 4.8, size = 60) => ({ kind: 'go', w, h, text: { font: 'title', size, color: 'ink' } });
const BTN = (w, h = 4.8, size = 40) => ({ kind: 'btn', w, h, text: { font: 'ui', size, color: 'cream' } });
const GRIP = (y) => ({ id: 'grip', kind: 'grip', x: 0, y, w: 12, h: 1.6 });
const WRIST = { kind: 'pill', w: 11.6, h: 2.5, text: { font: 'ui', size: 28, color: 'lav', on: 'ink' } };
const COSTUME = { kind: 'costume', w: 4.8, h: 4.8 };
const NIGHT = { kind: 'night', w: 9.6, h: 6.6, text: { font: 'title', size: 80, color: 'lav', on: 'ink' } };
const STAR = { kind: 'star', w: 2.3, h: 2.3 };
export const NIGHT_COUNT = 8; // (the game's NIGHTS)
const nightX = (i) => -16.5 + (i % 4) * 11, nightY = (i) => (i < 4 ? 11.4 : 0.4);
export const COSTUME_IDS = ['witch', 'pumpkin', 'horns', 'cape', 'none']; // (the game's COSTUMES, in its order)

export const UI = {
  menu: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: -1.4, w: 47, h: 43.4 },
      { id: 'title', kind: 'title', x: 0, y: 15.6, w: 25, h: 8.6 },
      { id: 'star', x: -4.2, y: 6.8, ...STAR, w: 3.2, h: 3.2 }, // (the stars won so far, written beside it)
      ...['en', 'es', 'fr', 'de'].map((id, i) => ({ id: `lang:${id}`, x: -15.3 + i * 10.2, y: 1.8, ...LANG })),
      ...COSTUME_IDS.map((id, i) => ({ id: `costume:${id}`, x: -11.2 + i * 5.6, y: -4, ...COSTUME })),
      { id: 'view:table', x: -8.3, y: -9.6, ...VIEW },
      { id: 'view:first', x: 8.3, y: -9.6, ...VIEW },
      ...['s', 'm', 'l'].map((id, i) => ({ id: `size:${id}`, x: -6.6 + i * 5, y: -13.6, ...SIZE })),
      { id: 'move', x: 12.6, y: -13.6, ...BTN(13, 3.4, 30) },
      { id: 'play', x: -4.6, y: -18.2, ...GO(25) },
      { id: 'how', x: 14.4, y: -18.2, ...BTN(12, 4.8, 34) },
      GRIP(-24.6),
    ],
    texts: [
      { id: 'sub', x: 0, y: 10.6, w: 40, h: 1.8, font: 'ui', size: 34, color: 'lav' },
      { id: 'stars', x: 2.6, y: 6.8, w: 10, h: 2.6, font: 'title', size: 52, color: 'gold' },
      { id: 'costume', x: -18.7, y: -4, w: 8.4, h: 2.2, font: 'ui', size: 30, color: 'lav' },
      { id: 'costumeName', x: 18.6, y: -4, w: 9.2, h: 3.6, font: 'ui', size: 26, color: 'gold', wrap: true },
      { id: 'size', x: -15.4, y: -13.6, w: 8, h: 2.2, font: 'ui', size: 32, color: 'lav' },
      { id: 'best', x: -11.5, y: -22.1, w: 20, h: 1.8, font: 'ui', size: 30, color: 'gold' },
      { id: 'bitmoji', x: 9.5, y: -22.1, w: 24, h: 1.8, font: 'ui', size: 26, color: 'lav' },
      { id: 'tip', x: 0, y: -27.3, w: 46, h: 3.2, font: 'ui', size: 24, color: 'lav', wrap: true },
    ],
  },
  // The campaign: eight nights, each with the stars won (a padlock until the night before has a star), and the
  // night picked: its skill, the candy for each star, the best so far.
  nights: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: -1, w: 50, h: 46 },
      { id: 'plate', kind: 'plate', x: 0, y: 19.6, w: 18, h: 4 },
      ...Array.from({ length: NIGHT_COUNT }, (_, i) => ({ id: `night:${i}`, x: nightX(i), y: nightY(i), ...NIGHT })),
      ...Array.from({ length: NIGHT_COUNT }, (_, i) => [0, 1, 2].map((k) => ({ id: `star:${i}:${k}`, x: nightX(i) + (k - 1) * 2.6, y: nightY(i) - 4.9, ...STAR }))).flat(),
      ...[0, 1, 2].map((k) => [0, 1, 2].slice(0, k + 1).map((j) => ({ id: `goal:${k}:${j}`, x: -19 + k * 13.6 + j * 2.2, y: -14.6, ...STAR, w: 2, h: 2 }))).flat(),
      { id: 'play', x: -5.5, y: -20.6, ...GO(22) },
      { id: 'back', x: 12.5, y: -20.6, ...BTN(11, 4.8, 34) },
      GRIP(-26),
    ],
    texts: [
      { id: 'title', x: 0, y: 19.6, w: 16, h: 2.6, font: 'title', size: 56, color: 'gold' },
      { id: 'name', x: 0, y: -7.6, w: 44, h: 2.8, font: 'title', size: 60, color: 'gold' },
      { id: 'how', x: 0, y: -10.9, w: 44, h: 3.4, font: 'ui', size: 30, color: 'cream', wrap: true },
      ...[0, 1, 2].map((k) => ({ id: `goal${k}`, x: -19 + k * 13.6 + (k + 1) * 2.2 + 2.6, y: -14.6, w: 7, h: 2.2, font: 'title', size: 44, color: 'cream' })),
      { id: 'best', x: 0, y: -17.3, w: 30, h: 1.8, font: 'ui', size: 30, color: 'gold' },
    ],
  },
  how: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: 0, w: 44, h: 28 },
      { id: 'plate', kind: 'plate', x: 0, y: 13.6, w: 18, h: 4 },
      { id: 'back', x: 0, y: -11, ...GO(18, 4.6, 52) },
      GRIP(-15.4),
    ],
    texts: [
      { id: 'title', x: 0, y: 13.6, w: 16, h: 2.6, font: 'title', size: 56, color: 'gold' },
      ...[0, 1, 2, 3].map((i) => ({ id: `line${i}`, x: 0, y: 8.2 - i * 4.4, w: 38, h: 3.6, font: 'ui', size: 34, color: 'cream', wrap: true })),
    ],
  },
  // The night's end: up to three big stars (the middle one higher, as in Angry Birds), the candy, the record or
  // the night it opened; on to the next night, the same again, or the menu.
  results: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: -1.2, w: 40, h: 32.4 },
      { id: 'plate', kind: 'plate', x: 0, y: 14.4, w: 16, h: 4 },
      ...[0, 1, 2].map((k) => ({ id: `bigstar:${k}`, kind: 'bigstar', x: (k - 1) * 8.6, y: k === 1 ? 8.4 : 7.2, w: 7, h: 7 })),
      { id: 'next', x: -9.3, y: -11.2, ...GO(17.4, 4.8, 44) },
      { id: 'again', x: 4.8, y: -11.2, ...BTN(9.4, 4.8, 32) },
      { id: 'menu', x: 13.7, y: -11.2, ...BTN(7.4, 4.8, 30) },
      GRIP(-18.2),
    ],
    texts: [
      { id: 'plate', x: 0, y: 14.4, w: 14, h: 2.6, font: 'title', size: 52, color: 'gold' },
      { id: 'title', x: 0, y: 2.4, w: 34, h: 2.6, font: 'title', size: 60, color: 'gold' },
      { id: 'score', x: 0, y: -1.6, w: 30, h: 3.6, font: 'title', size: 90, color: 'cream' },
      { id: 'best', x: 0, y: -5.6, w: 34, h: 2.2, font: 'ui', size: 38, color: 'gold' },
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
      GRIP(-12.4),
    ],
    texts: [
      { id: 'title', x: 0, y: 10.6, w: 14, h: 2.6, font: 'title', size: 56, color: 'gold' },
      { id: 'view', x: 0, y: 6.6, w: 30, h: 1.8, font: 'ui', size: 30, color: 'lav' },
    ],
  },
  wrist: {
    items: [
      { id: 'tome', kind: 'tome', x: 0, y: 0, w: 14, h: 14.4 },
      { id: 'view:table', x: 0, y: 4.6, ...WRIST },
      { id: 'view:first', x: 0, y: 1.6, ...WRIST },
      { id: 'pause', x: 0, y: -1.6, ...GO(11.6, 2.7, 32) },
      { id: 'menu', x: 0, y: -4.7, ...BTN(11.6, 2.5, 26) },
    ],
    texts: [],
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
      const lang = it.kind === 'lang' ? it.id.split(':')[1] : '', costume = it.kind === 'costume' ? it.id.split(':')[1] : '';
      const key = plateKey(it, look);
      if (!out.has(key)) out.set(key, { key, kind: it.kind, w: it.w, h: it.h, look, lang, costume });
    }
  }
  return [...out.values()];
}

/** The image a plate look is drawn into (shared by plates of the same kind and size). */
export function plateKey(it, look) {
  return `${it.kind}${it.kind === 'lang' || it.kind === 'costume' ? `-${it.id.split(':')[1]}` : ''}-${it.w}x${it.h}-${look}`;
}

/** The node a plate look is in ui.glb (a panel's node holds them all): "menu-level-easy-on". */
export function plateNode(panel, id, look) {
  return `${panel}-${id.replace(/:/g, '-')}-${look}`;
}

/** The looks an item has. */
export function plateLooks(it) {
  if (['tome', 'title', 'plate', 'chip'].includes(it.kind)) return ['off'];
  if (it.kind === 'grip') return ['off', 'hover'];
  if (it.kind === 'star' || it.kind === 'bigstar') return ['off', 'on'];
  if (it.kind === 'night') return ['off', 'on', 'hover', 'lock'];
  return ['off', 'on', 'hover'];
}
