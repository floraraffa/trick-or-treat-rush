// How to play, for people who don't read: eight cards, each a big animated picture and one short line.
// The pictures are made of the game's own pieces (its joystick, camera and pumpkin buttons, the candy, the
// team's creatures with their heads cut from the drawings' textures, the gems, the storm cloud); the styles
// live in index.html.
import { SHAPES } from '../actors/creature-shapes.js';
import { t } from './i18n.js';

/** A creature's head, cut from the front half of its texture atlas, `h` px tall. */
function head(name, h) {
  const { atlas: [AW, AH], parts: { head: { grid: g } } } = SHAPES[name];
  const k = h / ((g.rows - 1) * g.step), w = Math.round((g.cols - 1) * g.step * k);
  return `<i class="head" style="width:${w}px;height:${h}px;background-image:url(./assets/monsters/${name}.webp);background-size:${AW * k}px ${AH * k}px;background-position:${-g.x0 * k}px ${-g.y0 * k}px"></i>`;
}

const CANDY = [['🍬', 1], ['🍭', 5], ['🍫', 10], ['🎃', 25], ['🌈', 50]];
const DROPS = [['🍬', 16, 0], ['🍭', 30, 0.5], ['🍫', 50, 0.2], ['🍬', 64, 0.8], ['🍭', 24, 1.1], ['🍬', 42, 0.9], ['🍫', 58, 1.4], ['🍬', 36, 1.7],
  ['🍭', 70, 0.3], ['🍬', 20, 1.5], ['🍫', 46, 0.6], ['🍬', 56, 1.2]]; // [candy, left %, delay s]

/** The cards in order: id (its title and line are t('tut.<id>')) and its picture. */
export const STEPS = [
  { id: 'move', art: () => '<div class="joyArt"><i class="knobArt"></i></div><div class="speed"><i>›</i><i>›</i><i>›</i></div>' },
  { id: 'look', art: () => `<div class="screenArt"><div class="pan">🏚️🌕🏚️🌲🏚️🌲</div><i class="half"></i><span class="finger">👆</span></div><div class="round camArt"><span class="i">👁</span><span class="lbl"><i>${t('third')}</i><i>${t('first')}</i></span></div>` },
  { id: 'knock', art: () => `<div class="door">🚪</div><div class="knockArt">${t('trickOrTreat')}</div><div class="odds"><span>🍬 70%</span><span>👻 20%</span><span>🎃 10%</span></div>` },
  { id: 'candy', art: () => CANDY.map(([c, n], i) => `<span class="candyArt" style="animation-delay:${i * 0.18}s"><i style="font-size:${30 + i * 5}px">${c}</i><b>${n}</b></span>`).join('') },
  { id: 'monsters', art: () => `<div class="ghostArt"><span>👻</span><em>−10 🍬</em></div><div class="crew">${Object.keys(SHAPES).map((n) => head(n, 33)).join('')}<em>🐢</em></div>` },
  { id: 'powers', art: () => '<div class="gems"><i class="gem red"></i><i class="gem green"></i><i class="gem white"></i></div><div class="orbs"><span>🍬</span><span>🛡️</span><span>🧲</span><span>✖2</span></div><div class="secs">⏱ 20 s</div>' },
  { id: 'storm', art: () => `<div class="cloudArt">⛈️</div><i class="boltArt">⚡</i>${DROPS.map(([c, x, d]) => `<i class="drop" style="left:${x}%;animation-delay:${d}s">${c}</i>`).join('')}<div class="round powArt"><span class="i">🍬</span><span>${t('powerup')}</span></div>` },
  { id: 'win', art: () => '<div class="timerArt">3:00</div><div class="crown">👑</div><div class="moon">🌕</div>' },
];
