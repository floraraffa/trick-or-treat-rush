// How to play, for people who don't read: six cards, each a big animated picture and one short line.
// The pictures are made of the game's own pieces (its joystick and pumpkin button, the candy, the team's
// creatures with their heads cut from the drawings' textures, the gems); the styles live in index.html.
import { SHAPES } from '../actors/creature-shapes.js';
import { t } from './i18n.js';

/** A creature's head, cut from the front half of its texture atlas, `h` px tall. */
function head(name, h) {
  const { atlas: [AW, AH], parts: { head: { grid: g } } } = SHAPES[name];
  const k = h / ((g.rows - 1) * g.step), w = Math.round((g.cols - 1) * g.step * k);
  return `<i class="head" style="width:${w}px;height:${h}px;background-image:url(./assets/monsters/${name}.webp);background-size:${AW * k}px ${AH * k}px;background-position:${-g.x0 * k}px ${-g.y0 * k}px"></i>`;
}

const CANDY = [['🍬', 1], ['🍭', 5], ['🍫', 10], ['🎃', 25], ['🌈', 50]];

/** The cards in order: id (its title and line are t('tut.<id>')) and its picture. */
export const STEPS = [
  { id: 'move', art: () => '<div class="joyArt"><i class="knobArt"></i></div><div class="speed"><i>›</i><i>›</i><i>›</i></div>' },
  { id: 'knock', art: () => `<div class="door">🚪</div><div class="knockArt">${t('trickOrTreat')}</div><div class="odds"><span>🍬 70%</span><span>👻 20%</span><span>🎃 10%</span></div>` },
  { id: 'candy', art: () => CANDY.map(([c, n], i) => `<span class="candyArt" style="animation-delay:${i * 0.18}s"><i style="font-size:${30 + i * 5}px">${c}</i><b>${n}</b></span>`).join('') },
  { id: 'monsters', art: () => `<div class="ghostArt"><span>👻</span><em>−10 🍬</em></div><div class="crew">${Object.keys(SHAPES).map((n) => head(n, 33)).join('')}<em>🐢</em></div>` },
  { id: 'powers', art: () => '<div class="gems"><i class="gem red"></i><i class="gem green"></i><i class="gem white"></i></div><div class="orbs"><span>🍬</span><span>🛡️</span><span>🧲</span><span>✖2</span></div><div class="secs">⏱ 20 s</div>' },
  { id: 'win', art: () => '<div class="timerArt">3:00</div><div class="crown">👑</div><div class="moon">🌕</div>' },
];
