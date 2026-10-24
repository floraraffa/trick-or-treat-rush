// The store icon (512×512 PNG) for My Lenses: the team's cat creature, cut from its drawing, glowing in front
// of a Halloween moon on the game's violet night, with a jack-o'-lantern and a lollipop. Snapchat shows Lens
// icons in a circle, so everything sits inside the middle circle. Drawn as a page in headless Chromium (2×,
// then scaled down) so the emoji and the glows come out smooth.
//   node tools/make-icon.mjs [out.png] [creature]
import sharp from 'sharp';
import { launch } from '../tests/browser.mjs';
import { SHAPES } from '../src/actors/creature-shapes.js';

const out = process.argv[2] ?? 'art/store/icon.png', who = process.argv[3] ?? 'catman';
// The head: its grid's box, cut off just under the chin (the lowest row of the head's own height grid).
const g = SHAPES[who].parts.head.grid, kinds = Buffer.from(g.h, 'base64'), w = (g.cols - 1) * g.step;
let low = 0;
for (let j = 0; j < g.rows; j++) for (let i = 0; i < g.cols; i++) if (kinds[j * g.cols + i] >= 2) low = j;
const h = Math.min((g.rows - 1) * g.step, low * g.step + 4);
const head = await sharp(`public/assets/monsters/${who}.webp`).extract({ left: g.x0, top: g.y0, width: w, height: h }).png().toBuffer();
const headW = 330, headH = Math.round((headW * h) / w);
const stars = Array.from({ length: 26 }, (_, i) => { const a = i * 2.39996, r = 120 + ((i * 53) % 120); return [256 + Math.cos(a) * r, 230 + Math.sin(a) * r * 0.9, 1 + (i % 3) * 0.6]; })
  .map(([x, y, s]) => `<i class="star" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;width:${s * 2}px;height:${s * 2}px"></i>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; width: 512px; height: 512px; overflow: hidden; }
  body { position: relative; background: radial-gradient(circle at 50% 44%, #5a2a86 0%, #2c1244 42%, #10071c 78%, #07030d 100%); }
  .star { position: absolute; border-radius: 50%; background: #fff6e0; opacity: .8; box-shadow: 0 0 6px #fff; }
  .moon { position: absolute; left: 96px; top: 52px; width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle at 42% 38%, #fff4c8 0%, #ffd56e 38%, #ff9a2e 78%, #e0601a 100%);
    box-shadow: 0 0 70px 26px rgba(255,150,50,.5), 0 0 160px 60px rgba(255,110,30,.25); }
  .moon::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0) 40%, rgba(160,60,10,.18) 100%); }
  .head { position: absolute; left: ${256 - headW / 2}px; top: 118px; width: ${headW}px; height: ${headH}px; transform: rotate(-6deg);
    filter: drop-shadow(0 0 3px #000) drop-shadow(0 6px 10px rgba(0,0,0,.7)) drop-shadow(0 0 18px rgba(255,120,30,.55)); }
  .e { position: absolute; line-height: 1; filter: drop-shadow(0 4px 6px rgba(0,0,0,.7)) drop-shadow(0 0 14px rgba(255,170,60,.6)); }
  .pumpkin { left: 78px; top: 342px; font-size: 100px; transform: rotate(-12deg); }
  .lolly { left: 326px; top: 330px; font-size: 108px; transform: rotate(16deg); }
  .candy1 { left: 216px; top: 404px; font-size: 52px; transform: rotate(-20deg); }
  .candy2 { left: 404px; top: 262px; font-size: 38px; transform: rotate(24deg); }
  .candy3 { left: 66px; top: 268px; font-size: 34px; transform: rotate(-30deg); }
  .rim { position: absolute; inset: 10px; border-radius: 50%; box-shadow: inset 0 0 0 3px rgba(240,190,90,.35), inset 0 0 50px rgba(0,0,0,.55); }
</style></head><body>
  ${stars}<div class="moon"></div>
  <img class="head" src="data:image/png;base64,${head.toString('base64')}" alt="">
  <span class="e pumpkin">🎃</span><span class="e lolly">🍭</span><span class="e candy1">🍬</span><span class="e candy2">🍬</span><span class="e candy3">🍬</span>
  <div class="rim"></div>
</body></html>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.waitForTimeout(400);
const shot = await page.screenshot();
await browser.close();
await sharp(shot).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(out);
console.log(`wrote ${out} (512×512, ${who})`);
