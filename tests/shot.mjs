// Screenshots of a dev page in headless Chromium (software WebGL), e.g. dev/viewer.html:
//   node tests/shot.mjs "http://localhost:3000/dev/viewer.html?view=0,7,27,0,4,0" out.png [w] [h]
import { launch } from './browser.mjs';
const [url, out, w = 540, h = 960] = process.argv.slice(2);
const browser = await launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch((e) => logs.push('timeout waiting for __ready'));
await page.screenshot({ path: out });
console.log(logs.filter((l) => !l.includes('GPU stall')).slice(0, 30).join('\n'));
await browser.close();
